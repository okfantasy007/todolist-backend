var express = require('express');
var router = express.Router();
var sprintf = require('sprintf');

/*
  `task_title` varchar(255) DEFAULT NULL,
  `task_desc` varchar(512) DEFAULT NULL,
  `task_level` enum('1','2','3') DEFAULT NULL,
  `task_status` enum('1','2') DEFAULT NULL,
  `task_conf` int(10) DEFAULT NULL,
*/

function sqlConnError(conn, errMsg, res) {
	APP.dbpool.releaseConnection(conn);
	return res.status(200).json({
		success: false,
		msg: errMsg,
		code: '0001'
	});
}

//查询
router.post('/list/unfinished', function (req, res, next) {
  var task_title = req.body.taskTitle;
  var task_level = req.body.taskLevel;
  // var task_status = req.body.taskStatus;
  var task_conf = req.body.taskConf;
  var pageNo = req.body.pageNo || 1;
  var pageSize = req.body.pageSize || 10;

  var idSql = " and user_id = " + req.session.login_user_info.id;
  //非管理员账号只能查看自己的todolist信息 admin_flag!='1' 为非管理员账号
  //管理员账号可以查看所有用户的todolist信息 admin_flag='1' 为管理员账号

  var listSql = "";

  var likeSql = "";
  if (task_level) {
    likeSql += " and task_level=" + task_level;
  }
  likeSql += " and task_status=2";
  if (task_conf) {
    likeSql += " and task_conf=" + task_conf;
  }
  if (task_title) {
    likeSql += sprintf(" and task_title like '%%%s%%'", task_title);
  }

  var pageSql = ' limit ' + (pageNo - 1) * pageSize + "," + pageSize;

  var orderSql = ' order by task_level desc ';

  APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}
    //pageSql永远记得放到最后
    listSql = 'SELECT * FROM todolist where 1=1 ' + likeSql + idSql + orderSql + pageSql ;
    console.log('listSql:', listSql);

    var count = 0;

    conn.query('select count(*) as count from todolist where 1=1 ' + likeSql + idSql, function (err, rows, fields) {
      if (err) {
        conn.release();
        return res.status(200).json({
          success: false,
          msg: err.message,
          code: '0001'
        });
      }
      console.log('rows:', rows);
      if (!rows) {
        conn.release();
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
        if(err) {
          conn.release();
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
        conn.release();
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

router.post('/list/finished', function (req, res, next) {
  var task_title = req.body.taskTitle;
  var task_level = req.body.taskLevel;
  // var task_status = req.body.taskStatus;
  var task_conf = req.body.taskConf;
  var pageNo = req.body.pageNo || 1;
  var pageSize = req.body.pageSize || 10;

  var idSql = " and user_id = " + req.session.login_user_info.id;
  //非管理员账号只能查看自己的todolist信息 admin_flag!='1' 为非管理员账号
  //管理员账号可以查看所有用户的todolist信息 admin_flag='1' 为管理员账号

  var listSql = "";

  var likeSql = "";
  if (task_level) {
    likeSql += " and task_level=" + task_level;
  }
  likeSql += " and task_status=1";
  if (task_conf) {
    likeSql += " and task_conf=" + task_conf;
  }
  if (task_title) {
    likeSql += sprintf(" and task_title like '%%%s%%'", task_title);
  }

  var pageSql = ' limit ' + (pageNo - 1) * pageSize + "," + pageSize;

  var orderSql = ' order by task_level desc ';

  APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}
    //pageSql永远记得放到最后
    listSql = 'SELECT * FROM todolist where 1=1 ' + likeSql + idSql + orderSql + pageSql ;
    console.log('listSql:', listSql);

    var count = 0;

    conn.query('select count(*) as count from todolist where 1=1 ' + likeSql + idSql, function (err, rows, fields) {
      if (err) {
        conn.release();
        return res.status(200).json({
          success: false,
          msg: err.message,
          code: '0001'
        });
      }
      console.log('rows:', rows);
      if (!rows) {
        conn.release();
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
        if(err) {
          conn.release();
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
        conn.release();
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

  var task_title = req.body.taskTitle;
  var task_level = req.body.taskLevel;
  // var task_status = req.body.taskStatus;
  var task_conf = req.body.taskConf;
  var pageNo = req.body.pageNo || 1;
  var pageSize = req.body.pageSize || 10;

  //普通账号调用该接口
  if(req.session.login_user_info.admin_flag !== '1') {
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

  var idSql = " and user_id != " + req.session.login_user_info.id;
  //非管理员账号只能查看自己的todolist信息 admin_flag!='1' 为非管理员账号
  //管理员账号可以查看所有用户的todolist信息 admin_flag='1' 为管理员账号

  var listSql = "";

  var likeSql = "";
  if (task_level) {
    likeSql += " and task_level=" + task_level;
  }
  //likeSql += " and task_status=2";
  if (task_conf) {
    likeSql += " and task_conf=" + task_conf;
  }
  if (task_title) {
    likeSql += sprintf(" and task_title like '%%%s%%'", task_title);
  }

  var pageSql = ' limit ' + (pageNo - 1) * pageSize + "," + pageSize;

  var orderSql = ' order by task_status asc ';

  APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}
    //pageSql永远记得放到最后 limit语句永远记得放在最后
    listSql = 'SELECT * FROM todolist where 1=1 ' + likeSql + idSql  + orderSql/* + pageSql*/;
    console.log('listSql:', listSql);

    var count = 0;

    conn.query('select count(*) as count from todolist where 1=1 ' + likeSql + idSql, function (err, rows, fields) {
      if (err) {
        conn.release();
        return res.status(200).json({
          success: false,
          msg: err.message,
          code: '0001'
        });
      }
      console.log('rows:', rows);
      if (!rows) {
        conn.release();
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
      var leftJoinSql = 'SELECT * FROM ( ' + listSql + ' ) a LEFT JOIN user b on a.user_id = b.id ORDER BY a.user_id' + pageSql;
      console.log("leftJoinSql", leftJoinSql);
      conn.query(/*listSql*/leftJoinSql, function (err, rows, fields) {
        if(err) {
          conn.release();
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
        conn.release();
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

//新增
router.post('/add', function (req, res, next) {
  APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}

    var task_title = req.body.taskTitle;
    var task_desc = req.body.taskDesc;
    var task_level = req.body.taskLevel;
    var task_status = req.body.taskStatus;
    var task_conf = req.body.taskConf;

    if(!task_title) {
      conn.release();
      return res.status(200).json({
        success: false,
        msg: "新增失败：标题为空",
        code: '0001'
      });
    }

    var user_id = req.session.login_user_info.id;

    var insertFieldArr = ["user_id"];
    var addSql_Params = [user_id];

    if (task_title) {
      insertFieldArr.push("task_title");
      addSql_Params.push(task_title);
    }
    if (task_desc) {
      insertFieldArr.push("task_desc");
      addSql_Params.push(task_desc);
    }
    if (task_level) {
      insertFieldArr.push("task_level");
      addSql_Params.push(task_level);
    }
    if (task_status) {
      insertFieldArr.push("task_status");
      addSql_Params.push(task_status);
    }
    if (task_conf) {
      insertFieldArr.push("task_conf");
      addSql_Params.push(task_conf);
    }

    var questionArr = [];
    for (var q = 0; q < insertFieldArr.length; q++) {
      questionArr.push("?");
    }

    // var addSql = 'INSERT INTO todolist(user_id,\
    //               task_title,\
    //               task_desc,\
    //               task_level,\
    //               task_status,\
    //               task_conf) VALUES(?,?,?,?,?,?)';
    //
    // var addSql_Params = [user_id, task_title, task_desc, task_level, task_status, task_conf];

    var addSql = 'INSERT INTO todolist ( ' + insertFieldArr.join(",") + ' ) VALUES( ' + questionArr.join(",") + ' )';

    console.log('addSql:', addSql);
    console.log('addSql_Params:', addSql_Params);

    //增 add
    conn.query(addSql, addSql_Params, function (err, result) {
      if (err) {
        console.log('[INSERT ERROR] - ', err.message);
        conn.release();
        return res.status(200).json({
          success: false,
          msg: err.message,
          code: '0001'
        });
      }
      console.log('-------INSERT----------');
      console.log('INSERT result:', result);
      console.log('#######################');
      conn.release();
      res.status(200).json({
        success: true,
        msg: "新增成功",
        code: '0000'
      });
    });

  });
});

//修改
router.post('/update', function (req, res, next) {
  APP.dbpool.getConnection(function (err, conn) {
		if (err) {
			return sqlConnError(conn, "获取数据库连接失败", res);
		}

    var id = req.body.id;

    var task_title = req.body.taskTitle;
    var task_desc = req.body.taskDesc;
    var task_level = req.body.taskLevel;
    var task_status = req.body.taskStatus;
    var task_conf = req.body.taskConf;

    if(!task_title) {
      conn.release();
      return res.status(200).json({
        success: false,
        msg: "修改失败：标题为空",
        code: '0001'
      });
    }

    var setSqlArr = [];
    var updateSql_Params = [];
    // if (task_title) {
      setSqlArr.push("task_title=?");
      updateSql_Params.push(task_title);
    // }
    // if (task_desc) {
      setSqlArr.push("task_desc=?");
      updateSql_Params.push(task_desc);
    // }
    if (task_level) {
      setSqlArr.push("task_level=?");
      updateSql_Params.push(task_level);
    }
    if (task_status) {
      setSqlArr.push("task_status=?");
      updateSql_Params.push(task_status);
    }
    if (task_conf) {
      setSqlArr.push("task_conf=?");
      updateSql_Params.push(task_conf);
    }

    if (id && setSqlArr.length > 0) {
      var setSql = setSqlArr.join(",");
      updateSql_Params.push(parseInt(id));

      var updateSql = 'UPDATE todolist SET ' + setSql + ' WHERE id = ?';

      console.log('updateSql:', updateSql);
      console.log('updateSql_Params:', updateSql_Params);
      //改 update
      conn.query(updateSql, updateSql_Params, function (err, result) {
        if (err) {
          console.log('[UPDATE ERROR] - ', err.message);
          conn.release();
          return res.status(200).json({
            success: false,
            msg: err.message,
            code: '0001'
          });
        }
        console.log('----------UPDATE-------------');
        console.log('UPDATE affectedRows:', result.affectedRows);
        if (result.affectedRows !== 1) {
          conn.release();
          return res.status(200).json({
            success: false,
            msg: '修改失败',
            code: '0001'
          });
        }
        console.log('******************************');
        conn.release();
        res.status(200).json({
          success: true,
          msg: "修改成功",
          code: '0000'
        });
      });

    } else {
      conn.release();
      res.status(200).json({
        success: false,
        msg: '修改失败：任务id为空',
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

    conn.beginTransaction(function(err) {
      if (err) {
        return console.log(err);
      }

      //事务逻辑开始
      var id = req.body.id;

      if(!id) {
        conn.release();
        return res.status(200).json({
          success: false,
          msg: "id不能为空",
          code: '0001'
        });
      }
      var idCount = 1;
      if(String(id).indexOf(",") !== -1) {
        idCount = String(id).split(",").length;
      }

      if (id) {
        var delSql = 'DELETE FROM todolist WHERE id in(' + id + ')';
        console.log('delSql:', delSql);
        //删 delete
        conn.query(delSql, function (err, result) {
          if (err) {
            console.log('[DELETE ERROR] - ', err.message);
            conn.release();
            return res.status(200).json({
              success: false,
              msg: err.message,
              code: '0001'
            });
          }
          console.log('-------------DELETE--------------');
          console.log('DELETE result', result);
          console.log('DELETE affectedRows', result.affectedRows);
          console.log('==============================');
          if (result.affectedRows !== 0 && result.affectedRows !== idCount) {
            //回滚
            //对应于这种情况：如何传参id:16,17，但是数据库表中只有id=16的记录，
            //这个时候执行sql语句，会将id=16的记录删除掉
            //但是从请求者的角度来看，请求者是想删除id=16,17两条记录的
            //执行sql语句并没有达到其目的，这个时候就需要将删除动作回滚，保证记录的原子性
            conn.rollback(function() {
              console.log('删除失败,回滚!');
              //释放资源
              conn.release();
              res.status(200).json({
                success: false,
                msg: '删除失败',
                code: '0001'
              });
            });
            return;
            // conn.release();
            // res.status(200).json({
            //   success: false,
            //   msg: '删除失败',
            //   code: '0001'
            // });
            // return;
          }
          //conn.release();
          //没有错误，提交事务
          conn.commit(function(err) {
            if (err) {
              return console.log(err);
            }

            console.log('成功,提交!');
            //释放资源
            conn.release();
            res.status(200).json({
              success: true,
              msg: "删除成功",
              code: '0000'
            });
          });
        });
      } else {
        conn.release();
        res.status(200).json({
          success: false,
          msg: '删除失败',
          code: '0001'
        });
      }
      //事务逻辑结束
    });
  });
});

//report
router.post('/report', function (req, res, next) {
  console.log('params', req.body);
  res.status(200).json({
    success: true,
    msg: 'report success',
    code: '0000'
  });
});

module.exports = router;