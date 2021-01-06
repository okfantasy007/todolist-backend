var ioRedis = require('ioredis');
var logger = require('morgan');
var redis = new ioRedis({
    port: 6379,                  // Redis port
    host: '127.0.0.1',           // Redis host
    family: 4,                   // 4 (IPv4) or 6 (IPv6)
    password: 'lyb171049',
    db: 0,                       // 数据库号
    enableReadyCheck: true,
    autoResubscribe: true
});
// 默认127.0.0.1:6379
// redis 链接错误
redis.on("error", function (error) {
  console.log(error);
});
exports.redis = redis;