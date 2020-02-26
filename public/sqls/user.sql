/*
Navicat MySQL Data Transfer

Source Server         : lyb
Source Server Version : 50129
Source Host           : localhost:3306
Source Database       : todolist

Target Server Type    : MYSQL
Target Server Version : 50129
File Encoding         : 65001

Date: 2019-01-06 00:09:56
*/

SET FOREIGN_KEY_CHECKS=0;

-- ----------------------------
-- Table structure for `user`
-- ----------------------------
DROP TABLE IF EXISTS `user`;
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
) ENGINE=InnoDB AUTO_INCREMENT=80 DEFAULT CHARSET=utf8;

-- ----------------------------
-- Records of user
-- ----------------------------
INSERT INTO `user` VALUES ('4', '888', '$2a$10$GwMuUFg4KMk2AhsnPROCyuFsP4GNltLvAiqHqFxzOjUqHW7v2E.Xm', '123456', '2', '15201591613', 'okfantasy006', '724460216@qq.com', '2018-12-04 20:51:10', '2019-01-06 00:05:18', '2019-01-06 00:05:07', '1');
INSERT INTO `user` VALUES ('76', 'bcryptjs', '$2a$10$GwMuUFg4KMk2AhsnPROCyu4evXpPUe0T2MGppULk8DhVyZxRmXOJS', '888', '1', '', '', '', '2019-01-05 15:11:41', '2019-01-06 00:05:47', '2019-01-06 00:05:35', '2');
INSERT INTO `user` VALUES ('79', 'bcryptjs1', '$2a$10$GwMuUFg4KMk2AhsnPROCyu4evXpPUe0T2MGppULk8DhVyZxRmXOJS', '888', '1', null, null, null, '2019-01-06 00:06:06', null, '2019-01-06 00:06:19', '2');
