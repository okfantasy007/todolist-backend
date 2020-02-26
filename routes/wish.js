var express = require('express');
var router = express.Router();
const request = require("request-promise");
const userAgentList = require("../user-agent");

const proxyMode = true;

function GetRandomNum(Min, Max) {
	var Range = Max - Min;
	var Rand = Math.random();
	return (Min + Math.round(Rand * Range));
}

// 请求配置
function getOption(url, query, proxyUrl) {
	let proxyIpPort = "";
	if (proxyMode && !!proxyUrl) {
		proxyIpPort = proxyUrl;
	}
	const uaLen = userAgentList.length;
	const uaR = GetRandomNum(0, uaLen - 1);
	const ua = userAgentList[uaR];
	console.log(ua);

	let option = {
		method: 'POST',
		uri: url,
		qs: query,
		json: true,
		timeout: 3000,// 设置超时时间为3秒
		headers: {
			"cookie": "G_ENABLED_IDPS=google; _fbp=fb.1.1568885298768.1028227621; cto_lwid=76ca76ac-9601-4469-b93a-f29ade7a3983; __stripe_mid=5058fbba-dc30-4c03-a5c5-eb51193463c9; _ga=GA1.2.1441911769.1570584124; notice_preferences=2:; notice_gdpr_prefs=0,1,2:; G_AUTHUSER_H=0; _gid=GA1.2.588850865.1570758980; logged_out_locale=en; bsid=318cf496a9aa4607a719d7632e9c5ed9; _xsrf=2|3b5a32a5|bdbd82d343d79ec6b8248f1dd25e5a5a|1570759484; _timezone=8; _is_desktop=true; sweeper_session=\\\"2|1:0|10:1570760360|15:sweeper_session|84:YjFiN2U0NjctZjllNS00MTJhLWEzMTYtNGZjMGUyYjc4MTUxMjAxOS0xMC0xMSAwMjoxOToxOS41NjkwMzQ=|eedaf54d14b2aad447f3fe8f4ab090cec5ceb6cc937276619d60d3d47dddfc4f\\\"; sessionRefreshed_5bfbc2b1545ba58e68eee3e7=true; isDailyLoginBonusModalLoaded=true; __stripe_sid=7bac0a93-bdbd-4ea0-83a7-04c9253269b2; _derived_epik=dj0yJnU9d3A0LTRPcW55aUhqbG9TcV9xZGJMSnNrRkU5XzFCVTEmbj1kMjE5cmJSVzdWRUVKaTdFRzFVME1BJm09NCZ0PUFBQUFBRjJnR2ZrJnJtPTQmcnQ9QUFBQUFGMmdHZms; sweeper_uuid=d53f1cfea8dd4c7b94109206ab6f0c5c",
			// "user-agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.157 Safari/537.36",
			"user-agent": ua,
			"content-type": "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW",
			"x-xsrftoken": "2|3b5a32a5|bdbd82d343d79ec6b8248f1dd25e5a5a|1570759484",
			"cache-control": "no-cache"
		}
	};
	if (proxyIpPort) {
		let ipPort = proxyUrl.replace("https://", "").replace("http://", "");
		option.host = ipPort.split(":")[0];
		option.port = ipPort.split(":")[1];
		// option.proxy = proxyUrl;
	}
	return option;
}

async function getCommentResult(productId, proxyUrl) {
	let query = {
		"product_id": productId,
		"start": 0,
		"count": 30,
		"request_count": 1
	};
	console.log("---------------getCommentResult query---------------->", query);
	let option = await getOption('https://www.wish.com/api/product-ratings/get', query, proxyUrl);
	if (option === "get proxy info error") {
		return option;
	}
	console.log("---------------getCommentResult option---------------->", option);
	let res = [];
	try {
		let data = await request(option);
		let results = data.data ? data.data.results : [];
		console.log("---------------getCommentResult results---------------->", results);
		if (results.length > 0) {
			results.forEach(item => {
				let data = {
					id: item.id,
					// goods_sn: line.goods_sn,
					target_goods_sn: productId,
					// detail_url: line.detail_url,
					comment_rank: item.rating,
					comment_content: item.comment,
					language_code: item.user.locale,
					good_reviews: item.upvote_count
				};
				res.push(data);
			})
		}
	} catch (err) {
		res = "timeout or error"
	}
	return res;
}


/* GET home page. */
router.get('/', async function (req, res, next) {
	let productId = req.query.product_id;
	let proxyUrl = req.query.proxy_ip_port;
	if (productId) {
		let result = await getCommentResult(productId, proxyUrl);
		if (result === "timeout or error") {
			res.status(200).json({
				success: false,
				msg: result,
				code: '0002',
				data: []
			});
		} else {
			res.status(200).json({
				success: true,
				msg: "success",
				code: '0000',
				data: result
			});
		}
	} else {
		res.status(200).json({
			success: false,
			msg: "missing param product_id",
			code: '0001',
			data: []
		});
	}
});

module.exports = router;