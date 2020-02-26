# todolist系统主后台

#### 安装依赖：npm install

#### 启动服务：npm start

#### 物料：nodejs + express + mysql + redis

#### mysql：todolist的增删改查，数据存储于mysql

#### redis：用户会话管理，建立用户与websocket连接实例之间的联系

------------


## 数据库表

两张表：用户表（user），任务表（todolist）

### 用户表（user）

用户表中有password（密码密文）和show_password（密码明文）字段

注册时，客户端传输密码明文到服务端，

为了安全考虑，服务端将密码明文进行加密后，需要同时将密码明文和密码密文存入用户表
```sql
CREATE TABLE `user` (
  `id` int(32) NOT NULL AUTO_INCREMENT,
  `user_name` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL COMMENT '密码密文',
  `show_password` varchar(255) NOT NULL COMMENT '密码明文',
  `gender` enum('1','2') DEFAULT '1',
  `telephone` varchar(255) DEFAULT NULL,
  `wechat` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `register_time` timestamp NULL DEFAULT NULL,
  `update_time` timestamp NULL DEFAULT NULL,
  `last_login_time` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `admin_flag` enum('1','2') DEFAULT '2',
  PRIMARY KEY (`id`,`user_name`),
  UNIQUE KEY `user_name_unique` (`user_name`)
) ENGINE=InnoDB AUTO_INCREMENT=112 DEFAULT CHARSET=utf8;
```

### 任务表（todolist）
```sql
CREATE TABLE `todolist` (
  `id` int(32) NOT NULL AUTO_INCREMENT,
  `user_id` int(32) NOT NULL,
  `task_title` varchar(255) NOT NULL,
  `task_desc` varchar(512) DEFAULT NULL,
  `task_level` enum('1','2','3') DEFAULT NULL,
  `task_status` enum('1','2') DEFAULT '2',
  `task_conf` int(10) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fr_todolist` (`user_id`),
  CONSTRAINT `fr_todolist` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=106 DEFAULT CHARSET=utf8;
```

## 代码解析

### 会话管理核心代码（app.js）

```javascript
var cookieParser = require('cookie-parser');
var session = require('express-session');

app.use(cookieParser('sessiontest'));
app.use(session({
	//会话信息保存在redis中
	store: new RedisStore({
		client: redis
	}),
	cookie: {maxAge: 1 * 60 * 60 * 1000}, //默认会话有效时间为1小时
	secret: 'sessiontest',//此处的secrect必须与cookieParser保持一致
	resave: true,
	saveUninitialized: false,
	genid: req = > {
		//生成唯一ID作为reids存储的key值
		let gid = new Date().getTime();
		let username = req.body.userName;
		return `${username}/${gid}`;
	},
}));
```
注意genid的作用在于对会话信息做特殊处理，可以指定保存到redis中的key会话信息格式。

本项目中采用的格式为`${用户名}/${时间戳}`，但是实际上保存到redis中的key会话信息格式类似于`sess:test1/1582641611442`，即中间件会自动加前缀`sess:`，这点需要特别注意。

### 路由拦截器（app.js）
```javascript
//路由拦截器
app.use(function (req, res, next) {
  var url = req.originalUrl;
  //已登录
  if (req.session && req.session.login_user_info && req.session.login_user_info.id) {
    next();
    return;
  }
  //未登录，可以走/user/login 或 /user/register 或 /user/logout 路由，其他都提示 请重新登录
  //新增免登陆路由/user/send_private_todolist_msg，用于发送消息
  if (url !== "/user/login"
    && url !== "/user/register"
    && url !== "/user/logout"
    && url !== "/user/send_private_todolist_msg"
    && url !== "/user/set_socket_id_to_user_session"
		&& !url.startsWith("/wish")) {
    res.status(200).json({
      success: true,
      msg: "请重新登录",
      code: '0003'
    });
    return;
  }
  next();
});
```
配置路由拦截器的作用在于可以指定哪些路由是需要用户登录会话信息的，哪些是不需要用户登录会话信息的。

指定哪些路由是需要登录会话信息，那么用户在调用这些路由接口时需要对用户信息进行校验，校验通过后才能进行下一个接口的调用。

一般表现为，无会话信息接口请求，会返回`请重新登录`信息给接口调用者，引导其先登录后再使用后续的接口调用服务。

这在一定程度上可以降低接口受到不明攻击的风险。

仔细的朋友可能这时观察到，在nodejs这一端我们是怎么判断用户是否有正确的会话信息的呢？

从代码里我们也可以看到，我们是通过`req.session && req.session.login_user_info && req.session.login_user_info.id`这个条件来判断用户是否有正确的会话信息的。

那问题又来了，这个`login_user_info`为什么会在`req.session`里呢？

我们再往下看：

```javascript
router.post('/login', function (req, res, next) {
	//......，一系列登录信息校验，......
	//在这一步，会将会话信息插入Redis，同时将用户信息塞入req.session中
	
	removeUnusedKeys(rows[0].id, user_name, "");//在这里处理同一个账号重复登录的情况
	req.session.login_user_info = login_user_info;
	console.log('req.session.verifyCode:', req.session.verifyCode);
	console.log('req.session.login_user_info:', req.session.login_user_info);

	res.status(200).json({
		success: true,
		msg: "恭喜您！登录成功！",
		code: '0000',
		data: req.session.login_user_info
	});
});
```

上述代码是登录接口的一段逻辑，我们可以看到在通过一系列登录信息校验之后，会将登录成功的用户信息塞入`req.session`中，同时前面的会话管理中间件会将该用户信息插入redis。

插入redis的会话信息如下所示：

```javascript
{
  "cookie": {
    "originalMaxAge": 3600000,
    "expires": "2020-02-25T15:40:11.975Z",
    "httpOnly": true,
    "path": "/"
  },
  "login_user_info": {
    "id": 107,
    "user_name": "test1",
    "admin_flag": "2",
    "last_login_time": "2020-02-25 22:40:11",
    "password": "$2a$10$PH4ct/Un5ks.ejcthjt9cemsA4NKec7bbWw2iPJBpAZrZQizk/S4m",
    "socketId": "n_KgQFidbWqZlLP5AAAK"
  }
}
```
通过观察，我们发现上述存储到redis的用户会话信息，包含`socketId`这个参数，那么这个参数是怎么来的呢？让我来为你揭晓吧！

其实，这个参数是客户端登录成功后，连接websocket后返回的一个socket连接id，然后再通过接口（`set_socket_id_to_user_session`）调用的方式，将其塞入到用户会话信息中，同时该会话信息会保存到redis中。

代码如下所示：

```javascript
router.post('/set_socket_id_to_user_session', function (req, res, next) {
	console.log("enter /set_socket_id_to_user_session", req.session, req.session.login_user_info, req.body.socketId);
	req.session.login_user_info.socketId = req.body.socketId;
	res.status(200).json({
		success: true,
		code: '0000'
	});
});
```
这样在后续的接口调用中，所有的请求都会携带该会话信息，所以可以正常调用获取响应。

同时，我们应该注意到，如果遇到同一个账号，先后在两个终端（这种情况我们可以通过打开两个浏览器，可以尝试同时打开谷歌浏览器和火狐浏览器用同一个账号登录）用同一个账号登录，可以实现前面登录的终端会被后面登录的终端挤出，并重定向到登录页。这一步流程是通过`removeUnusedKeys`这个函数来进行处理的。

具体代码如下：

```javascript
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
```
**具体思路**

- 首先，通过传入的用户名在redis中查找到对应的socketId，同时将该请求的`req.session`置空

- 然后，通过调用另外一个消息转发后台的接口，向特定的客户端私发信息

- 最后，收到信息的客户端进行一系列退出登录并重定向到登录页的操作


类似地，在用户退出的时候，我们需要将`req.session`中的会话信息清空，如下：

```javascript
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
```

### 统计在线用户列表并广播推送给各个已登录的终端

这个功能主要是通过消息转发后台实现的，这里就不叙述了，详情可参见[node-websocket-msg-sender](https://github.com/okfantasy007/node-websocket-msg-sender "node-websocket-msg-sender")

### 数据库事务

数据库事务的作用在于可以保证数据的原子性，典型的应用场景就是删除数据时，如果因为特殊原因造成删除数据失败，我们可以回滚保留原始数据，而不去删除它。

样例如下：
```javascript
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
```
**基本用法**

- 首先，通过数据库连接池获取一个可用的连接

- 然后，通过`conn.beginTransaction`开启事务，在事务代码块中进行删除数据以及更新数据操作

	- 如果在该过程中出现异常导致删除失败，我们可以通过`conn.rollback`实现数据回滚，以防出现误删的情况

	- 如果一切正常，则通过`conn.commit`提交事务，完成整个事务流程

## 部署

该项目结合自己搭建的jenkins实现自动化部署。

### Build阶段

```shell
node -v
npm -v
#安装依赖包
npm install
#如果myapp.tar.gz存在，则删除；如果myapp.tar.gz不存在，则不进行删除操作
rm -rf myapp.tar.gz
#将当前workspace目录下的所有文件压缩到myapp.tar.gz
tar -czf myapp.tar.gz *
```

### Post-Build阶段

```shell
#!/bin/bash
echo "=====deploy todolist backend start====="

#获取系统当前时间
t=$(date +%y%m%d_%H%M%S)

#打开后端文件myapp所在目录
cd /home/liuyuanbing/todolist/backend

#备份当前myapp文件夹，备份后的文件夹以"myapp_ + 当前时间戳"的形式命名
cp -r myapp myapp_$t

#清理myapp的备份文件夹，最多只保留最近的两个备份文件夹
sh /home/liuyuanbing/shell/keep_most_2_myapp_copy_by_for.sh

#清空服务器当前目录下myapp文件夹中的内容
rm -rf ./myapp/*

#将myapp.tar.gz解压到服务器当前目录下的myapp文件夹中
tar vxf myapp.tar.gz -C ./myapp

#删除服务器当前目录下的myapp.tar.gz
rm -rf myapp.tar.gz

#pm2路径变量
pm2=/root/node-v8.0.0-linux-x64/bin/pm2

#www路径变量
www=/home/liuyuanbing/todolist/backend/myapp/bin/www

#pm2版本
echo "pm2 --version："
$pm2 --version

#获取当前pm2任务列表
echo "current pm2 list："
$pm2 list

#停止名字为myapp的pm2任务
$pm2 stop myapp

#删除名字为myapp的pm2任务
$pm2 delete myapp

#创建新的名字为myapp的pm2任务
$pm2 start $www -i 0 --name "myapp" --log-date-format="YYYY-MM-DD HH:mm Z"

#重新获取pm2任务列表
echo "updated pm2 list："
$pm2 list

echo "=====deploy todolist backend end====="
```
**具体思路**

- 首先，备份当前的myapp，加上时间戳，以供查阅备份时间，执行`keep_most_2_myapp_copy_by_for.sh`脚本，最多只保留两份最新的myapp版本

- 然后，删除当前的myapp，将拉取的最新代码压缩包解压为myapp，作为最新版本以供使用

- 最后，pm2重启myapp服务

`keep_most_2_myapp_copy_by_for.sh`脚本代码如下，感兴趣的朋友可以参考：

```shell
#!/bin/bash 
# 删除历史项目，只保留最近2个项目文件和myapp项目

CurrentPath=/home/liuyuanbing/todolist/backend
LogFile="$CurrentPath/"run.log
MaxSaveCount=2
RunDir="myapp"
DirArr=()
RetainArr=()
echo "=====>一次清理log开始<=====" >> $LogFile
for element in `ls $CurrentPath`
do
	dir_or_file=$CurrentPath"/"$element
	if [[ -d $dir_or_file && "$element" != $RunDir && "$element" =~ ^myapp_.* ]]
	then
		DirArr=(${DirArr[@]} $element)
	fi
done

echo "-----所有目录------" >> $LogFile
echo ${DirArr[@]}  >> $LogFile
len=${#DirArr[*]}
echo "len:"$len  >> $LogFile

if [ $len -gt $MaxSaveCount ]
then
	#按文件名从大到小排序
	for((i=0;i<len;i++))
	do
		for((j=0;j<len-i-1;j++))
		do
			if [[ "${DirArr[j]}" < "${DirArr[j+1]}" ]]
			then
				temp=${DirArr[j]}
				DirArr[j]=${DirArr[j+1]}
				DirArr[j+1]=$temp
			fi
		done
	done

	echo "-----排序后目录------" >> $LogFile
	echo ${DirArr[@]} >> $LogFile
	echo "-----清理开始------" >> $LogFile
	echo "-----删除历史目录------" >> $LogFile
	for((t=$MaxSaveCount;t<len;t++))
	do
		removeDir=$CurrentPath"/${DirArr[t]}"
		echo "rm -r "$removeDir >> $LogFile
		rm -r $removeDir
	done

	echo "-----清理完成------" >> $LogFile
else
	echo "no more than $MaxSaveCount myapp copy dirs in $CurrentPath"
fi
echo "=====>一次清理log结束<=====" >> $LogFile
```
