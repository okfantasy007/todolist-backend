/*
Navicat MySQL Data Transfer

Source Server         : lyb
Source Server Version : 50129
Source Host           : localhost:3306
Source Database       : todolist

Target Server Type    : MYSQL
Target Server Version : 50129
File Encoding         : 65001

Date: 2019-01-06 00:10:04
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for `todolist`
-- ----------------------------
DROP TABLE IF EXISTS `todolist`;
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
) ENGINE=InnoDB AUTO_INCREMENT=81 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Records of todolist
-- ----------------------------
INSERT INTO `todolist` VALUES ('22', '4', '4_222', '99999地方大幅度发', '2', '1', '8');
INSERT INTO `todolist` VALUES ('33', '4', '333333', null, null, '1', null);
INSERT INTO `todolist` VALUES ('38', '4', '898989', null, '2', '1', null);
INSERT INTO `todolist` VALUES ('59', '4', '测试走一波', null, '2', '1', '8');
INSERT INTO `todolist` VALUES ('60', '4', '测试走一波222', null, '2', '1', '8');
INSERT INTO `todolist` VALUES ('61', '4', '测试一波9090又有', '我又改状态啦啦啦啦啦啦啦啦啦', '2', '1', '7');
INSERT INTO `todolist` VALUES ('79', '4', '999', '999', '2', '1', '9');
