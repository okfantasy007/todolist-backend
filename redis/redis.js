var ioRedis = require('ioredis');
var logger = require('morgan');
var redis = new ioRedis('redis://:lyb171049@127.0.0.1:6379/4');
// 默认127.0.0.1:6379
// redis 链接错误
redis.on("error", function (error) {
  console.log(error);
});
exports.redis = redis;