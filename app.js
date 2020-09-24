var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var logger = require('morgan');
var cors = require('cors');
var mysql = require("mysql");
var svgCaptcha = require('svg-captcha');

var bcrypt = require('bcryptjs');
var salt = bcrypt.genSaltSync(10);

/*生成HASH值*/
var hash = bcrypt.hashSync('1234567', salt);
console.log("hash：", hash);

// redis一定要开启
// 将session存到redis中
// 不开启redis的话，会报错：Cannot set property 'login_user_info' of undefined
const RedisStore = require('connect-redis')(session);
var redis = require('./redis/redis.js').redis;

var indexRouter = require('./routes/index');
var userRouter = require('./routes/user');
var todolistRouter = require('./routes/todolist');
var wishRouter = require('./routes/wish');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

app.use(cookieParser('sessiontest'));
app.use(session({
    store: new RedisStore({
        client: redis,
        // prefix: 'hgk'
    }),
    cookie: {maxAge: 1 * 60 * 60 * 1000}, //默认1小时
    secret: 'sessiontest',
    resave: true,
    saveUninitialized: false,
    genid: req => {
        // 生成唯一ID作为reids存储的key值
        let gid = new Date().getTime();
        let username = req.body.userName;
        return `${username}/${gid}`;
    },
}));

app.use(function (req, res, next) {
    var url = req.originalUrl;
    if (url.indexOf("/user/fetch_verify_code") !== -1) {
        var captcha = svgCaptcha.create();
        // req.session.verifyCode = captcha.text.toLowerCase();
        // saveCaptchaToRedis(captcha.text.toLowerCase());
        res.cookie('verify_code', bcrypt.hashSync(captcha.text.toLowerCase(), salt));
        res.type('svg');
        return res.status(200).send(captcha.data);
    }
    next();
});


// 全局变量只能在运行环境中可以读取到
// 当全局变量中有了诸如连接数据库的动态赋值时，无法在其他文件中在读取静态资源阶段引用
// 当全局变量中只有读取静态配置文件信息时，是可以在其他文件中在读取静态资源阶段引用的
global.APP = {};// 全局变量
APP.config = require('./config/default.json');// 生产环境
// APP.config = require('./config/default_dev.json');// 家环境
// APP.config = require('./config/default_company.json');// 公司环境

// 登录拦截器
app.use(function (req, res, next) {
    var url = req.originalUrl;
    // 已登录
    if (req.session && req.session.login_user_info && req.session.login_user_info.id) {
        next();
        return;
    }
    // 未登录，可以走/user/login 或 /user/register 或 /user/logout 路由，其他都提示 请重新登录
    // 新增免登陆路由/user/send_private_todolist_msg，用于发送消息
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

app.use('/', indexRouter);
app.use('/user', userRouter);
app.use('/todolist', todolistRouter);
app.use('/wish', wishRouter);

// 连接数据库
APP.dbpool = mysql.createPool(APP.config.db);

APP.dbpool.getConnection(function (err, conn) {
    console.log('err:', err);
    if (err) {
        console.log("连接数据库失败");
    } else {
        console.log("连接数据库成功");
    }
    APP.dbpool.releaseConnection(conn);
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    console.error("err.message", err.message);

    // render the error page
    res.status(err.status || 500).json({
        success: false,
        msg: err.message || '系统异常',
        code: '0002'
    });
    // res.render('error');
});

module.exports = app;