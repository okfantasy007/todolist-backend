var express = require('express');
var router = express.Router();
var sprintf = require('sprintf');
var dateformat = require('dateformat');
var request = require('request');
var redis = require('../redis/redis.js').redis;

var redisClient1 = require("redis").createClient();

redisClient1.select(1, function (err) {
	if (err) {
		console.log("切换数据库db(1)失败", err);
	} else {
		console.log("切换数据库db(1)成功");
	}
});

var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);

function removeUnusedKeys(userId, userName) {
	//首先清除带undefined的key
	redis.keys(`sess:undefined/*`, (err, reply) => {
		if (err) {
			return console.log(err);
		}
		if (reply.length > 0) {
			//这一步可以确保用户异地登录后上一登录状态失效
			redis.del(reply[0]);
		}
	});
	if (userId && userName) {
		redis.keys(`sess:${userName}/*`, (err, reply) => {
			if (err) {
				return console.log(err);
			}
			if (reply.length > 0) {
				//这一步可以确保用户异地登录后上一登录状态失效
				//redis.del(reply[0]);
				//处理同一个账号重复登录的情况，实现将较早登录的客户端重定向到登录页
				redis.get(reply[0], function (err, reply1) {
					console.log("reply1", reply1);
					console.log("reply1.login_user_info", JSON.parse(reply1).login_user_info);
					var socketId = JSON.parse(reply1).login_user_info.socketId;
					var options = {
						url: APP.config.wsIP + '/ws/redirectToLogin',
						headers: {
							'Content-Type': 'application/json;charset=UTF-8',
						},
						body: JSON.stringify(
							{
								socketId: socketId
							}
						)
					};
					request.post(options, function (err, response, data) {
						if (err) {
							console.log(err);
							console.log("重复登录退出失败");
						} else {
							console.log("重复登录退出成功");
							redis.del(reply[0]);
						}
					});
				});
			}
		});
	}


}

function sqlConnError(conn, errMsg, res) {
	APP.dbpool.releaseConnection(conn);
	return res.status(200).json({
		success: false,
		msg: errMsg,
		code: '0001'
	});
}

function loginSuccessToBroadcast(userName) {
	var options = {
		url: APP.config.wsIP + '/ws/sendMsg',
		headers: {
			'Content-Type': 'application/json;charset=UTF-8',
		},
		body: JSON.stringify(
			{
				type: "public",
				content: {
					type: "login_success_broadcast",
					userName: userName,
					text: `[${userName}]登录了TODOLIST系统`
				}
			}
		)
	};
	request.post(options, function (err, response, data) {
		if (err) {
			console.log(err);
			console.log("广播消息失败");
		} else {
			console.log("广播消息成功");
		}
	});
}

//查询
router.post('/list', function (req, res, next) {
	console.log('req.session.login_user_info', req.session.login_user_info);
	var user_name = req.body.userName;
	var telephone = req.body.telephone;
	var gender = req.body.gender;
	var pageNo = req.body.pageNo || 1;
	var pageSize = req.body.pageSize || 10;

	var idSql = "";
	//非管理员账号只能查看自己的账号信息 admin_flag!='1' 为非管理员账号
	//管理员账号可以查看所有的账号信息 admin_flag='1' 为管理员账号
	// if (req.session.login_user_info.admin_flag !== '1') {
	//   idSql += " and id = " + req.session.login_user_info.id;
	// }
	//idSql += " and id = " + req.session.login_user_info.id;
	idSql += " and id = " + req.session.login_user_info.id;

	var listSql = "";

	var likeSql = "";
	if (gender) {
		likeSql += " and gender=" + gender;
	}
	if (user_name) {
		likeSql += sprintf(" and user_name like '%%%s%%'", user_name);
	}
	if (telephone) {
		likeSql += sprintf(" and telephone like '%%%s%%'", telephone);
	}

	var pageSql = ' limit ' + (pageNo - 1) * pageSize + "," + pageSize;

	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}
		//pageSql永远记得放到最后
		listSql = "SELECT id,\
              user_name,\
              password,\
              gender,\
              telephone,\
              wechat,\
              email,\
              date_format(register_time, '%Y-%m-%d %H:%i:%s') as register_time,\
              date_format(update_time, '%Y-%m-%d %H:%i:%s') as update_time,\
              date_format(last_login_time, '%Y-%m-%d %H:%i:%s') as last_login_time,\
              admin_flag FROM user where 1=1 " + likeSql + idSql + pageSql;
		console.log('listSql:', listSql);

		var count = 0;

		conn.query('select count(*) as count from user where 1=1 ' + likeSql + idSql, function (err, rows, fields) {
			if (err) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: err.message,
					code: '0001'
				});
			}
			console.log('rows:', rows);
			if (!rows) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: true,
					msg: "查询成功",
					code: '0000',
					data: {
						totalCount: 0,
						pageNo: pageNo,
						pageSize: pageSize,
						totalPage: 0,
						items: []
					}
				});
			}
			count = parseInt(rows[0].count);
			var totalPage = parseInt(count / pageSize) + 1;
			conn.query(listSql, function (err, rows, fields) {
				if (err) {
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: "查询失败",
						code: '0001',
						data: {
							totalCount: 0,
							pageNo: pageNo,
							pageSize: pageSize,
							totalPage: 0,
							items: []
						}
					});
				}
				APP.dbpool.releaseConnection(conn);
				res.status(200).json({
					success: true,
					msg: "查询成功",
					code: '0000',
					data: {
						totalCount: count,
						pageNo: pageNo,
						pageSize: pageSize,
						totalPage: totalPage,
						items: rows
					}
				});
				console.log("response end");
			});
		});
	});
});

router.post('/list/admin_other', function (req, res, next) {
	var user_name = req.body.userName;
	var telephone = req.body.telephone;
	var gender = req.body.gender;
	var pageNo = req.body.pageNo || 1;
	var pageSize = req.body.pageSize || 10;

	var idSql = "";
	//非管理员账号只能查看自己的账号信息 admin_flag!='1' 为非管理员账号
	//管理员账号可以查看所有的账号信息 admin_flag='1' 为管理员账号
	//普通账号调用该接口
	if (req.session.login_user_info.admin_flag !== '1') {
		return res.status(200).json({
			success: false,
			msg: "查询失败：非管理员账号",
			code: '0001',
			data: {
				totalCount: 0,
				pageNo: pageNo,
				pageSize: pageSize,
				totalPage: 0,
				items: []
			}
		});
	}

	idSql += " and id != " + req.session.login_user_info.id;

	var listSql = "";

	var likeSql = "";
	if (gender) {
		likeSql += " and gender=" + gender;
	}
	if (user_name) {
		likeSql += sprintf(" and user_name like '%%%s%%'", user_name);
	}
	if (telephone) {
		likeSql += sprintf(" and telephone like '%%%s%%'", telephone);
	}

	var pageSql = ' limit ' + (pageNo - 1) * pageSize + "," + pageSize;

	APP.dbpool.getConnection(function (err, conn) {
		//pageSql永远记得放到最后
		listSql = "SELECT id,\
              user_name,\
              gender,\
              telephone,\
              wechat,\
              email,\
              date_format(register_time, '%Y-%m-%d %H:%i:%s') as register_time,\
              date_format(update_time, '%Y-%m-%d %H:%i:%s') as update_time,\
              date_format(last_login_time, '%Y-%m-%d %H:%i:%s') as last_login_time,\
              admin_flag FROM user where 1=1 " + likeSql + idSql + pageSql;
		console.log('listSql:', listSql);

		var count = 0;

		conn.query('select count(*) as count from user where 1=1 ' + likeSql + idSql, function (err, rows, fields) {
			if (err) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: err.message,
					code: '0001'
				});
			}
			console.log('rows:', rows);
			if (!rows) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: true,
					msg: "查询成功",
					code: '0000',
					data: {
						totalCount: 0,
						pageNo: pageNo,
						pageSize: pageSize,
						totalPage: 0,
						items: []
					}
				});
			}
			count = parseInt(rows[0].count);
			var totalPage = parseInt(count / pageSize) + 1;
			conn.query(listSql, function (err, rows, fields) {
				if (err) {
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: "查询失败",
						code: '0001',
						data: {
							totalCount: 0,
							pageNo: pageNo,
							pageSize: pageSize,
							totalPage: 0,
							items: []
						}
					});
				}
				APP.dbpool.releaseConnection(conn);
				res.status(200).json({
					success: true,
					msg: "查询成功",
					code: '0000',
					data: {
						totalCount: count,
						pageNo: pageNo,
						pageSize: pageSize,
						totalPage: totalPage,
						items: rows
					}
				});
				console.log("response end");
			});
		});
	});
});

router.post('/send_private_todolist_msg', function (req, res, next) {
	var userId = req.body.userId;
	var detectSql = "select task_title from todolist where 1=1 and task_status=2 and task_level=3";
	detectSql += sprintf(" and user_id = %d", userId);
	console.log('detectSql', detectSql);
	console.log("APP.config", APP.config);

	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			APP.dbpool.releaseConnection(conn);
			return res.status(200).json({
				success: false,
				code: '0001'
			});
		}
		conn.query(detectSql, function (err, rows, fields) {
			if (err) {
				console.log(err);
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					code: '0001'
				});
			}
			console.log('rows.length', rows.length);
			if (rows.length > 0) {
				var rLen = rows.length;
				var sRows = rows;
				var showContent = [];
				if (rLen > 2) {
					sRows = sRows.slice(0, 2);
				}
				sRows.forEach((item) => {
					showContent.push("[标题：" + item["task_title"] + "]");
				});
				var options = {
					url: APP.config.wsIP + '/ws/sendMsg',
					headers: {
						'Content-Type': 'application/json;charset=UTF-8',
					},
					body: JSON.stringify(
						{
							type: "private",
							uid: userId,
							content: "您有 " + rLen + " 项优先级高的任务（" + showContent.join("、") + (rLen > 2 ? "..." : "") + "）未完成！"
						}
					)
				};
				request.post(options, function (err, response, data) {
					if (err) {
						console.log(err);
						console.log("私发消息失败");
						APP.dbpool.releaseConnection(conn);
						return res.status(200).json({
							success: false,
							code: '0001'
						});
					}
					console.log("私发消息成功");
					APP.dbpool.releaseConnection(conn);
					res.status(200).json({
						success: true,
						code: '0000'
					});
				});
			}
		});
	});
});

router.post('/set_socket_id_to_user_session', function (req, res, next) {
	console.log("enter /set_socket_id_to_user_session", req.session, req.session.login_user_info, req.body.socketId);
	req.session.login_user_info.socketId = req.body.socketId;
	res.status(200).json({
		success: true,
		code: '0000'
	});
});

//登入
router.post('/login', function (req, res, next) {
	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}

		console.log("=====req=====", req);

		var user_name = req.body.userName;
		var password = req.body.password;
		var verifyCode = req.body.verifyCode;

		if (!user_name) {
			return res.status(200).json({
				success: false,
				msg: "用户名为空",
				code: '0001'
			});
		}

		if (!password) {
			return res.status(200).json({
				success: false,
				msg: "密码为空",
				code: '0001'
			});
		}

		if (!verifyCode) {
			return res.status(200).json({
				success: false,
				msg: "验证码为空",
				code: '0001'
			});
		}

		if (!req.cookies.verify_code) {
			return res.status(200).json({
				success: false,
				msg: "登录失败：验证码（cookie）为空",
				code: '0001'
			});
		}

		if (!bcrypt.compareSync(verifyCode, req.cookies.verify_code)) {
			return res.status(200).json({
				success: false,
				msg: "登录失败：验证码错误",
				code: '0001'
			});
		}

		var loginSql = "select id,\
                    user_name,\
                    password,\
                    gender,\
                    telephone,\
                    wechat,\
                    email,\
                    date_format(register_time, '%Y-%m-%d %H:%i:%s') as register_time,\
                    date_format(update_time, '%Y-%m-%d %H:%i:%s') as update_time,\
                    date_format(last_login_time, '%Y-%m-%d %H:%i:%s') as last_login_time,\
                    admin_flag from user where 1=1 ";
		loginSql += sprintf(" and user_name = '%s'", user_name);
		//loginSql += sprintf(" and password = '%s'", password);


		console.log('loginSql:', loginSql);

		var count = 0;

		//查询数据库
		conn.query(loginSql, function (err, rows, fields) {
			if (err) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: err.message || "登录失败",
					code: '0001'
				});
			}
			console.log("rows:", rows);
			if (!rows) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: "登录失败：用户名或密码错误",
					code: '0001'
				});
			}
			count = rows.length;
			if (count !== 1) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: "登录失败：用户名或密码错误",
					code: '0001'
				});
			}

			if (!bcrypt.compareSync(password, rows[0].password)) {
				APP.dbpool.releaseConnection(conn);
				return res.status(200).json({
					success: false,
					msg: "登录失败：密码错误",
					code: '0001'
				});
			}

			//最近登录成功的时间
			var last_login_time = new Date();
			console.log("before:", last_login_time);
			last_login_time = dateformat(last_login_time, "yyyy-mm-dd HH:MM:ss"); //需要引入dateformat插件
			console.log("after:", last_login_time);

			var login_user_info = {
				id: rows[0].id,
				user_name: rows[0].user_name,
				admin_flag: rows[0].admin_flag,
				last_login_time: last_login_time,
				password: rows[0].password
			};

			removeUnusedKeys(rows[0].id, user_name, "");

			//在这一步，会将会话信息插入Redis
			req.session.login_user_info = login_user_info;
			console.log('req.session.verifyCode:', req.session.verifyCode);
			console.log('req.session.login_user_info:', req.session.login_user_info);

			res.status(200).json({
				success: true,
				msg: "恭喜您！登录成功！加个鸡腿！",
				code: '0000',
				data: req.session.login_user_info
			});
			loginSuccessToBroadcast(user_name);
			//更新最近登录时间
			var lastLoginTimeSql = sprintf(" last_login_time = '%s'", last_login_time);
			var updateSql = 'UPDATE user SET ' + lastLoginTimeSql + ' WHERE id = ' + req.session.login_user_info.id;
			console.log('updateSql:', updateSql);
			conn.query(updateSql, function (err, rows, fields) {
				if (err) {
					console.log("更新最近登录时间失败");
				} else {
					console.log("更新最近登录时间成功");
				}
				APP.dbpool.releaseConnection(conn);
			});
			console.log("response end");
		});
	});
});

//登出
router.post('/logout', function (req, res, next) {
	//针对同一个账号不同时刻登录系统，前一个时刻标记为A，后一个时刻标记为B
	//时刻A已经登录进去，但是未退出来
	//时刻B登录进去时，时刻A的session信息已经被清空
	//这个时候时刻B再次点击退出时，会报错Cannot read property 'user_name' of undefined
	//针对这一情况，特作如下处理
	if (req.session.login_user_info && req.session.login_user_info.user_name) {
		let user_name = req.session.login_user_info.user_name;
		removeUnusedKeys(req.session.login_user_info.id, user_name, req.session.login_user_info.socketId);
		req.session.login_user_info = "";
		res.status(200).json({
			success: true,
			msg: "登出成功",
			code: '0000'
		});
	} else {
		req.session.login_user_info = "";
		removeUnusedKeys();
		res.status(200).json({
			success: true,
			msg: "登出成功",
			code: '0000'
		});
	}
});

//注册
router.post('/register', function (req, res, next) {
	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}

		var user_name = req.body.userName;
		var password = req.body.password;

		if (!user_name) {
			return res.status(200).json({
				success: false,
				msg: "用户名为空",
				code: '0001'
			});
		}

		if (!password) {
			return res.status(200).json({
				success: false,
				msg: "密码为空",
				code: '0001'
			});
		}

		var gender = req.body.gender;
		var telephone = req.body.telephone;
		var wechat = req.body.wechat;
		var email = req.body.email;
		var admin_flag = req.body.adminFlag;

		var register_time = new Date();
		console.log("before:", register_time);
		register_time = dateformat(register_time, "yyyy-mm-dd HH:MM:ss"); //需要引入dateformat插件
		console.log("after:", register_time);

		var insertFieldArr = [];
		var addSql_Params = [];

		if (user_name) {
			insertFieldArr.push("user_name");
			addSql_Params.push(user_name);
		}
		if (password) {
			insertFieldArr.push("show_password");
			addSql_Params.push(password);
			insertFieldArr.push("password");
			/*生成HASH值*/
			var hash = bcrypt.hashSync(password, salt);
			addSql_Params.push(hash);
		}
		if (gender) {
			insertFieldArr.push("gender");
			addSql_Params.push(gender);
		}
		if (telephone) {
			insertFieldArr.push("telephone");
			addSql_Params.push(telephone);
		}
		if (wechat) {
			insertFieldArr.push("wechat");
			addSql_Params.push(wechat);
		}
		if (email) {
			insertFieldArr.push("email");
			addSql_Params.push(email);
		}
		if (admin_flag) {
			insertFieldArr.push("admin_flag");
			addSql_Params.push(admin_flag);
		}
		if (register_time) {
			insertFieldArr.push("register_time");
			addSql_Params.push(register_time);
		}

		var questionArr = [];
		for (var q = 0; q < insertFieldArr.length; q++) {
			questionArr.push("?");
		}

		//sql语句需要拼接字符串型或date数据时 最好是统一放入参数数组中 数字型数据可以在sql语句中直接填入

		var addSql = 'INSERT INTO user ( ' + insertFieldArr.join(",") + ' ) VALUES( ' + questionArr.join(",") + ' )';

		console.log('addSql:', addSql);
		console.log('addSql_Params:', addSql_Params);

		//增 add
		conn.query(addSql, addSql_Params, function (err, result) {
			if (err) {
				console.log('[INSERT ERROR] - ', err.message);
				APP.dbpool.releaseConnection(conn);
				//数据库针对user_name创建了unique索引，索引名为user_name_unique
				//当插入一条用户名相同的记录时，会报索引错误，就可以判断用户名重复了
				//"ER_DUP_ENTRY: Duplicate entry '333' for key 'user_name_unique'"
				if (err.message.indexOf("ER_DUP_ENTRY") !== -1) {
					res.status(200).json({
						success: false,
						msg: '注册失败：该用户名已被注册，请更换其他用户名！',
						code: '0001'
					});
				} else {
					res.status(200).json({
						success: false,
						msg: err.message,
						code: '0001'
					});
				}
				return;
			}
			console.log('-------INSERT----------');
			console.log('INSERT result:', result);
			console.log('#######################');
			APP.dbpool.releaseConnection(conn);
			res.status(200).json({
				success: true,
				msg: "注册成功",
				code: '0000',
				data: {
					user_name: user_name,
					id: result.insertId
				}
			});
		});

	});
});

//修改 sql有问题
router.post('/update_error', function (req, res, next) {

	APP.dbpool.getConnection(function (err, conn) {

		var id = req.body.id;

		var user_name = req.body.userName;
		var password = req.body.password;
		var gender = req.body.gender;
		var telephone = req.body.telephone;
		var wechat = req.body.wechat;
		var email = req.body.email;
		var admin_flag = req.body.adminFlag;

		var update_time = new Date();
		console.log("before:", update_time);
		update_time = dateformat(update_time, "yyyy-mm-dd HH:MM:ss"); //需要引入dateformat插件
		console.log("after:", update_time);

		var setSqlArr = [];
		var updateSql_Params = [];
		if (user_name) {
			setSqlArr.push("user_name=?");
			updateSql_Params.push(user_name);
		}
		if (password) {
			setSqlArr.push("password=?");
			updateSql_Params.push(password);
		}
		if (gender) {
			setSqlArr.push("gender=?");
			updateSql_Params.push(parseInt(gender));
		}
		if (telephone) {
			setSqlArr.push("telephone=?");
			updateSql_Params.push(telephone);
		}
		if (wechat) {
			setSqlArr.push("wechat=?");
			updateSql_Params.push(wechat);
		}
		if (email) {
			setSqlArr.push("email=?");
			updateSql_Params.push(email);
		}
		if (admin_flag) {
			setSqlArr.push("admin_flag=?");
			updateSql_Params.push(parseInt(admin_flag));
		}
		if (update_time) {
			setSqlArr.push("update_time=?");
			updateSql_Params.push(update_time);
		}

		if (id && setSqlArr.length > 0) {
			var setSql = setSqlArr.join(",");
			updateSql_Params.push(parseInt(id));

			var updateSql = 'UPDATE user SET ' + setSql + ' WHERE id = ?';

			console.log('updateSql:', updateSql);
			console.log('updateSql_Params:', updateSql_Params);
			//改 update
			conn.query(updateSql, updateSql_Params, function (err, result) {
				if (err) {
					console.log('[UPDATE ERROR] - ', err.message);
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: err.message,
						code: '0001'
					});
				}
				console.log('----------UPDATE-------------');
				console.log('UPDATE affectedRows:', result.affectedRows);
				if (result.affectedRows !== 1) {
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: '修改用户信息失败',
						code: '0001'
					});
				}
				console.log('******************************');
				APP.dbpool.releaseConnection(conn);
				res.status(200).json({
					success: true,
					msg: "修改用户信息成功",
					code: '0000'
				});
			});
		} else {
			APP.dbpool.releaseConnection(conn);
			res.status(200).json({
				success: false,
				msg: '修改用户信息失败：id传参错误，一次只能传一个id',
				code: '0001'
			});
		}
	});
});


router.post('/update', function (req, res, next) {
	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}
		var id = req.body.id;

		var user_name = req.body.userName;
		var oldPassword = req.body.oldPassword;//旧密码字段
		var newPassword = req.body.newPassword;//如果有新密码字段
		var gender = req.body.gender;
		var telephone = req.body.telephone;
		var wechat = req.body.wechat;
		var email = req.body.email;
		var admin_flag = req.body.adminFlag;

		var sessionPassword = req.session.login_user_info.password;
		//首先判断旧密码是否正确
		if (oldPassword && !bcrypt.compareSync(oldPassword, sessionPassword)) {
			return res.status(200).json({
				success: false,
				msg: "修改用户信息失败：旧密码错误",
				code: '0001'
			});
		} else {
			//如果新密码不为空，说明用户不修改密码
			if (newPassword && bcrypt.compareSync(newPassword, sessionPassword)) {
				return res.status(200).json({
					success: false,
					msg: "修改用户信息失败：新密码不能与旧密码相同",
					code: '0001'
				});
			}
		}

		var update_time = new Date();
		console.log("before:", update_time);
		update_time = dateformat(update_time, "yyyy-mm-dd HH:MM:ss"); //需要引入dateformat插件
		console.log("after:", update_time);


		var setSqlArr = [];
		if (user_name) {
			setSqlArr.push(sprintf(" user_name= '%s' ", user_name));
		}
		if (newPassword) {
			setSqlArr.push(sprintf(" show_password= '%s' ", newPassword));
			/*生成HASH值*/
			var hash = bcrypt.hashSync(newPassword, salt);
			setSqlArr.push(sprintf(" password= '%s' ", hash));
		}
		if (gender) {
			setSqlArr.push(" gender=  " + gender);
		}
		setSqlArr.push(sprintf(" telephone= '%s' ", telephone ? telephone : ""));
		setSqlArr.push(sprintf(" wechat= '%s' ", wechat ? wechat : ""));
		setSqlArr.push(sprintf(" email= '%s' ", email ? email : ""));
		if (admin_flag) {
			setSqlArr.push(" admin_flag=  " + admin_flag);
		}
		if (update_time) {
			setSqlArr.push(sprintf(" update_time= '%s' ", update_time));
		}
		var last_login_time = req.session.login_user_info.last_login_time;
		setSqlArr.push(sprintf(" last_login_time= '%s' ", last_login_time));

		if (id && setSqlArr.length > 0) {
			var setSql = setSqlArr.join(",");

			var updateSql = 'UPDATE user SET ' + setSql + ' WHERE id = ' + parseInt(id);

			console.log('updateSql:', updateSql);
			//改 update
			conn.query(updateSql, function (err, result) {
				if (err) {
					console.log('[UPDATE ERROR] - ', err.message);
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: err.message,
						code: '0001'
					});
				}
				console.log('----------UPDATE-------------');
				console.log('UPDATE affectedRows:', result.affectedRows);
				if (result.affectedRows !== 1) {
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: false,
						msg: '修改用户信息失败',
						code: '0001'
					});
				}
				console.log('==============================');
				if (newPassword && !bcrypt.compareSync(newPassword, sessionPassword)) {
					//新密码不能与旧密码相同
					APP.dbpool.releaseConnection(conn);
					return res.status(200).json({
						success: true,
						msg: "修改用户信息成功",
						relogin: true,
						code: '0000'
					});
				}
				APP.dbpool.releaseConnection(conn);
				res.status(200).json({
					success: true,
					msg: "修改用户信息成功",
					code: '0000'
				});
			});
		} else {
			APP.dbpool.releaseConnection(conn);
			res.status(200).json({
				success: false,
				msg: '修改用户信息失败：id传参错误，一次只能传一个id',
				code: '0001'
			});
		}
	});
});

//删除
router.post('/delete', function (req, res, next) {
	APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}

		conn.beginTransaction(function (err) {
			if (err) {
				console.log(err);
				return;
			}

			//事务逻辑开始
			const {id, userName} = req.body;

			if (id) {
				var delSql = 'DELETE FROM user WHERE id = ' + parseInt(id);
				console.log('delSql:', delSql);
				//删 delete
				conn.query(delSql, function (err, result) {
					if (err) {
						console.log('[DELETE ERROR] - ', err.message);
						APP.dbpool.releaseConnection(conn);
						return res.status(200).json({
							success: false,
							msg: err.message,
							code: '0001'
						});
					}
					console.log('-------------DELETE--------------');
					console.log('DELETE affectedRows', result.affectedRows);
					console.log('==============================');
					if (result.affectedRows !== 1) {
						conn.rollback(function () {
							console.log('删除失败,回滚!');
							//释放资源
							APP.dbpool.releaseConnection(conn);
							res.status(200).json({
								success: false,
								msg: '删除账号失败',
								code: '0001'
							});
						});
						return;
					}
					//没有错误，提交事务
					conn.commit(function (err) {
						if (err) {
							return res.status(200).json({
								success: false,
								msg: '删除账号失败',
								code: '0001'
							});
						}

						console.log('成功,提交!');
						var options = {
							url: APP.config.wsIP + '/ws/deleteAccountToUpdateOnline',
							headers: {
								'Content-Type': 'application/json;charset=UTF-8',
							},
							body: JSON.stringify(
								{
									uid: id,
									userName: userName
								}
							)
						};
						request.post(options, function (err, response, data) {
							if (err) {
								console.log(err);
								console.log("广播消息失败");
								APP.dbpool.releaseConnection(conn);
								return res.status(200).json({
									success: false,
									msg: "删除账号失败",
									code: '0001'
								});
							}
							console.log("广播消息成功");
							APP.dbpool.releaseConnection(conn);
							return res.status(200).json({
								success: true,
								msg: "删除账号成功",
								code: '0000'
							});
						});
						//释放资源
						/*APP.dbpool.releaseConnection(conn);
						res.status(200).json({
							success: true,
							msg: "删除账号成功",
							code: '0000'
						});*/
					});
				});
			} else {
				APP.dbpool.releaseConnection(conn);
				res.status(200).json({
					success: false,
					msg: '删除账号失败',
					code: '0001'
				});
			}
			//事务逻辑结束
		});
	});
});


module.exports = router;
