<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head>
<title>江苏反诈网</title>

<meta name="keywords" content="反诈,江苏反诈,江苏反诈网">
<meta name="description" content="江苏反诈网">
<meta name="content-type" content="text/html; charset=UTF-8">
<meta http-equiv="pragma" content="no-cache">
<meta http-equiv="cache-control" content="no-cache">
<meta http-equiv="expires" content="0">

<link rel="stylesheet" href="js/swiper-3.4.2/swiper-3.4.2.min.css">

<style type="text/css">
/* 国家重要日期，网站素装 */
/* html {
	filter: grayscale(100%);
	-webkit-filter: grayscale(100%);
	-moz-filter: grayscale(100%);
	-ms-filter: grayscale(100%);
	-o-filter: grayscale(100%);
} */

/* 网页主体样式 */
* {
	margin: 0;
	padding: 0;
	box-sizing: border-box;
}

body {
	background: #FFFFFF;
	font-family: "Microsoft Yahei", "微软雅黑", Tahoma, Arial;
}

/* 头部 */
.header-bg {
	width: 100%;
	height: 200px;
	background-size: cover;
	background-repeat: no-repeat;
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0 60px;
}

.header-logo {
	width: 550px;
	height: 140px;
	background-size: contain;
	background-repeat: no-repeat;
}

.header-app {
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;
	text-decoration: none;
}

.header-app-logo {
	width: 100px;
	height: 100px;
	margin-bottom: 10px;
	background-size: contain;
	background-repeat: no-repeat;
}

.header-app-text {
	color: white;
	font-size: 2rem;
	background-color: #097AD6;
	padding: 5px 20px;
	border-radius: 5px;
}

/* 导航 */
.nav-bg {
	width: 100%;
	height: 80px;
	background-color: #0A6DCB;
	display: flex;
	justify-content: center;
	align-items: center;
	position: sticky;
	top: 0;
	z-index: 1000;
	padding: 0 20px;
}

.nav-item {
	color: white;
	font-size: 3.0rem;
	font-weight: bold;
	text-decoration: none;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	flex: 1;
	transition: background-color 0.3s;
	text-decoration: none;
}

.nav-item.active {
	background-color: #035BC7;
}

/* 当前活跃的导航项(.active)创建一个视觉指示器 */
.nav-item.active::after {
	content: "";
	position: absolute;
	bottom: 6px;
	left: 50%;
	transform: translateX(-50%);
	width: 80px;
	height: 5px;
	background-color: white;
	border-radius: 5px;
}

/* 版块分区 */
.section {
	width: 100%;
	padding: 20px 20px 30px 20px;
	scroll-margin-top: 80px;
	display: flex;
	justify-content: center;
	align-items: center;
	flex-direction: column;
}

/* Swiper */
.info-swiper {
	width: 100%;
	height: 500px;
	position: relative;
	border-radius: 10px;
}

.promotion-swiper {
	width: 100%;
	height: 220px;
	position: relative;
}

.slide-link {
	width: 100%;
	height: 100%;
	display: block;
	position: relative;
	text-decoration: none;
}

.slide-link img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.slide-title {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: 80px;
	line-height: 80px;
	background: rgba(0, 0, 0, 0.5);
	color: white;
	font-size: 2.6rem;
	font-weight: bold;
	padding: 0 30px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.swiper-custom-prev {
	width: 80px !important;
	height: 120px !important;
	margin-top: -60px !important;
	left: 0px !important;
	background-color: rgba(0, 0, 0, 0);
	background-image: url('images/xhm/v2/xhm_v2_arrow_left_fat.png')
		!important;
	background-repeat: no-repeat;
	background-size: 40px 40px !important;
}

.swiper-custom-next {
	width: 80px !important;
	height: 120px !important;
	margin-top: -60px !important;
	right: 0px !important;
	background-color: rgba(0, 0, 0, 0);
	background-image: url('images/xhm/v2/xhm_v2_arrow_right_fat.png')
		!important;
	background-repeat: no-repeat;
	background-size: 40px 40px !important;
}

.promotion-slide-image {
	border-radius: 10px;
}

.promotion-slide-title {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: 60px;
	line-height: 60px;
	background: rgba(0, 0, 0, 0.5);
	color: white;
	font-size: 2.4rem;
	padding: 0 10px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* 新闻 */
.news-container {
	width: 100%;
	height: auto;
	padding: 20px 0;
}

.news-item {
	width: 100%;
	height: 80px;
	line-height: 80px;
	font-size: 2.6rem;
	color: #333333;
	position: relative;
	padding-left: 60px;
	text-decoration: none;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 1;
	-webkit-box-orient: vertical;
}

.news-item::before {
	content: "";
	position: absolute;
	left: 25px;
	top: 50%;
	transform: translateY(-50%);
	width: 10px;
	height: 10px;
	background-color: #333333;
	border-radius: 50%;
}

.more-link {
	line-height: 80px;
	height: 80px;
	font-size: 2.4rem;
	text-align: center;
	color: #949494;
	border: 1px solid #949494;
	text-decoration: none;
	width: 100%;
}

.news-item-main {
	display: block;
	width: 100%;
	height: 300px;
	box-sizing: border-box;
	text-decoration: none;
	color: inherit;
	display: flex;
	gap: 20px;
	margin-bottom: 20px;
}

.news-item-main-left {
	flex: 1;
	overflow: hidden;
	border-radius: 10px;
}

.news-item-main-left img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.news-item-main-right {
	flex: 1;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
}

.news-item-main-right-text {
	font-size: 2.6rem;
	color: #333333;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
	text-overflow: ellipsis;
}

.news-item-main-right-info {
	display: flex;
	justify-content: right;
	font-size: 2rem;
	color: #949494;
}

/* 版块标题 */
.section-title-container {
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 30px;
	padding-bottom: 10px;
}

.section-title-line {
	flex: 1;
	height: 2px;
	background-color: #CACACA;
	position: relative;
}

.left-line::after {
	content: "";
	position: absolute;
	right: 0;
	top: 50%;
	transform: translateY(-50%);
	width: 5px;
	height: 50px;
	background-color: #025AC6;
}

.right-line::before {
	content: "";
	position: absolute;
	left: 0;
	top: 50%;
	transform: translateY(-50%);
	width: 5px;
	height: 50px;
	background-color: #025AC6;
}

.section-title {
	font-size: 3.2rem;
	font-weight: 800;
	color: #025AC6;
	white-space: nowrap;
}

/* 推荐 */
.recommend-container {
	width: 100%;
	height: 350px;
	display: flex;
	align-items: center;
	display: flex;
}

.recommend-left {
	width: 90px;
	height: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	flex-direction: column;
	gap: 20px;
	background: linear-gradient(to bottom, #0362D0, #145BA9);
}

.recommend-left-content {
	color: #FFFFFF;
	font-size: 3.2rem;
	font-weight: 800;
}

.recommend-right {
	width: calc(100% - 90px);
	height: 100%;
	padding: 20px 10px;
	display: flex;
	justify-content: center;
	align-items: center;
	background: linear-gradient(to bottom, #F5F6F8, #E8F1F8);
}

.recommend-slide-link {
	width: 100%;
	height: 100%;
	display: block;
	position: relative;
	text-decoration: none;
}

.recommend-slide-link img {
	width: 100%;
	height: 200px;
	object-fit: cover;
	display: block;
}

.recommend-slide-link span {
	width: 100%;
	line-height: 50px;
	margin-top: 10px;
	color: #333333;
	font-size: 2.4rem;
	padding: 0 5px;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

/* 运营商 */
.telecom-container {
	width: 100%;
	margin-top: 30px;
	display: flex;
	gap: 20px;
}

.telecom-container a {
	flex: 1;
	background-color: #F3F7FA;
	border-radius: 10px;
	padding: 30px 10px 30px 20px;
	display: flex;
	align-items: center;
	gap: 20px;
	box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.1);
	text-decoration: none;
}

.telecom-container img {
	width: 70px;
	height: auto;
	object-fit: cover;
}

.telecom-container span {
	font-size: 2.1rem;
	color: #333333;
}

/* 联系方式 */
.service-contact {
	margin-top: 50px;
	width: 100%;
	border-radius: 10px;
	display: flex;
	flex-direction: column;
	box-shadow: 0 0 2px 1px rgba(0, 0, 0, 0.1);
	padding-bottom: 20px;
	gap: 20px;
}

.service-contact-main {
	width: fit-content;
	font-size: 2.4rem;
	color: #FFFFFF;
	background: linear-gradient(to right, #162E8D, #0762CD);
	padding: 15px 40px;
	border-radius: 10px;
}

.service-contact-other {
	display: flex;
	flex-wrap: wrap;
}

.service-contact-other div {
	box-sizing: border-box;
	width: 50%;
	font-size: 2.2rem;
	padding: 15px 20px;
}

/* 让「南京市」单独占满第一行 */
.service-contact-other div:first-child {
	width: 100%;
	order: -1;
}

/* 二维码 */
.qr-container {
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	flex-wrap: wrap;
	margin-top: 50px;
}

.qr-item {
	display: flex;
	flex: 1;
	flex-direction: column;
	align-items: center;
	gap: 10px;
}

.qr-code {
	width: 200px;
	height: 200px;
	object-fit: cover;
	display: block;
}

.qr-desc {
	font-size: 2rem;
	width: 100%;
	text-align: center;
	color: #333333;
}

/* 底部 */
.footer-container {
	width: 100%;
	display: flex;
	align-items: center;
	flex-direction: column;
	margin-top: 20px;
	padding: 50px 30px 70px 30px;
	background-color: #EEEEEE;
}

.footer-spacer {
	margin-left: 20px;
}

.footer-line {
	margin-top: 20px;
	font-size: 1.6rem;
	color: #666666;
}

.footer-line a {
	color: #666666;
	text-decoration: none;
}

/* 飘窗相关 */
.bay-window-content-left {
	position: fixed;
	left: 0;
	z-index: 9999;
	width: 315px;
	height: 180px;
	background-size: 100% 100%;
	border-radius: 10px;
}

.bay-window-content-right {
	position: fixed;
	right: 0;
	z-index: 9999;
	width: 315px;
	height: 180px;
	background-size: 100% 100%;
	border-radius: 10px;
}

.bay-window-close {
	position: absolute;
	right: 5px;
	top: 5px;
	cursor: pointer;
	width: 40px;
	border: 0;
}
/* 飘窗相关 */

/* 关于我们 */
.aboutUs-container {
	display: none;
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 95%;
	padding: 40px 40px 20px 40px;
	background-color: white;
	border-radius: 10px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	z-index: 10001;
}

.aboutUs-title {
	font-size: 3rem;
	font-weight: bold;
	margin-bottom: 20px;
}

.aboutUs-content {
	font-size: 2.6rem;
	text-indent: 2em;
	line-height: 1.6;
	margin-bottom: 20px;
	text-align: justify;
}

.aboutUs-close {
	position: absolute;
	top: 5px;
	right: 30px;
	cursor: pointer;
	font-size: 5rem;
	font-weight: bold;
	color: #666;
}

.overlay {
	display: none;
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.4);
	z-index: 10000;
}
/* 关于我们 */
</style>

</head>

<body>
	<!-- 顶部 -->
	<div class="header-bg"
		style="background-image: url('images/xhm/v2/xhm_v2_back_mobile.png');">
		<div class="header-logo"
			style="background-image: url('images/xhm/v2/xhm_v2_logo.png');"></div>
		<a href="https://a.app.qq.com/o/simple.jsp?pkgname=com.jhdapp.xhbycm"
			target="_blank" class="header-app">
			<div class="header-app-logo"
				style="background-image: url('images/xhm/xhm_jhd_download.png');"></div>
			<span class="header-app-text">下载</span>
		</a>
	</div>

	<!-- 导航 -->
	<div class="nav-bg">
		<a href="#info" class="nav-item active">要闻</a> <a href="#trend"
			class="nav-item">动态</a> <a href="#law" class="nav-item">拍案</a> <a
			href="#society" class="nav-item">社会</a> <a href="#service"
			class="nav-item">服务</a>
	</div>

	<!-- 要闻 -->
	<div id="info" class="section">
		<div class="swiper-container info-swiper" id="id_info_swiper">
			<div class="swiper-wrapper" id="id_info_swiper_content"></div>
			<div class="swiper-button-prev swiper-custom-prev info-swiper-prev"></div>
			<div class="swiper-button-next swiper-custom-next info-swiper-next"></div>
		</div>
		<div class="news-container" id="id_info_news_container"></div>
		<a href="javascript:void(0);" class="more-link"
			onclick="viewArticles(1)">查看更多 >></a>
	</div>

	<!-- 推广 -->
	<div class="section">
		<div class="swiper-container promotion-swiper"
			id="id_promotion_swiper">
			<div class="swiper-wrapper" id="id_promotion_swiper_content"></div>
		</div>
	</div>

	<!-- 动态 -->
	<div id="trend" class="section">
		<div class="section-title-container">
			<div class="section-title-line left-line"></div>
			<div class="section-title">动态</div>
			<div class="section-title-line right-line"></div>
		</div>
		<div class="news-container" id="id_trend_news_container"></div>
		<a href="javascript:void(0);" class="more-link"
			onclick="viewArticles(2)">查看更多 >></a>
	</div>

	<!-- 视频 -->
	<div id="video" class="section">
		<div class="recommend-container">
			<div class="recommend-left">
				<div class="recommend-left-content">视</div>
				<div class="recommend-left-content">频</div>
			</div>
			<div class="recommend-right">
				<div class="swiper-container video-swiper">
					<div class="swiper-wrapper" id="id_video_swiper_content"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- 拍案 -->
	<div id="law" class="section">
		<div class="section-title-container">
			<div class="section-title-line left-line"></div>
			<div class="section-title">拍案</div>
			<div class="section-title-line right-line"></div>
		</div>
		<div class="news-container" id="id_law_news_container"></div>
		<a href="javascript:void(0);" class="more-link"
			onclick="viewArticles(4)">查看更多 >></a>
	</div>

	<!-- 推荐 -->
	<div id="video" class="section">
		<div class="recommend-container">
			<div class="recommend-left">
				<div class="recommend-left-content">推</div>
				<div class="recommend-left-content">荐</div>
			</div>
			<div class="recommend-right">
				<div class="swiper-container recommend-swiper">
					<div class="swiper-wrapper" id="id_recommend_swiper_content"></div>
				</div>
			</div>
		</div>
	</div>

	<!-- 社会 -->
	<div id="society" class="section">
		<div class="section-title-container">
			<div class="section-title-line left-line"></div>
			<div class="section-title">社会</div>
			<div class="section-title-line right-line"></div>
		</div>
		<div class="news-container" id="id_society_news_container"></div>
		<a href="javascript:void(0);" class="more-link"
			onclick="viewArticles(5)">查看更多 >></a>
	</div>

	<!-- 服务 -->
	<div id="service" class="section">
		<div class="section-title-container">
			<div class="section-title-line left-line"></div>
			<div class="section-title">服务</div>
			<div class="section-title-line right-line"></div>
		</div>

		<div class="telecom-container">
			<a href="javascript:void(0);" onclick="openTelcomLink('1')"> <img
				src="images/xhm/xhm_dx.png" alt=""> <span>天翼防骚扰</span>
			</a> <a href="javascript:void(0);"> <img src="images/xhm/xhm_yd.png"
				alt=""> <span>中国移动</span>
			</a> <a href="javascript:void(0);"> <img src="images/xhm/xhm_lt.png"
				alt=""> <span>中国联通</span>
			</a>
		</div>

		<div class="service-contact">
			<div class="service-contact-main">江苏省反网络诈骗中心：025-66096110</div>
			<div class="service-contact-other">
				<div>南京市：025-96110</div>
				<div>无锡市：0510-82693110</div>
				<div>镇江市：0511-88956432</div>
				<div>苏州市：0512-69866035</div>
				<div>南通市：0513-85021281</div>
				<div>盐城市：0515-88887110</div>
				<div>徐州市：0516-68900001</div>
				<div>扬州市：0514-89898110</div>
				<div>常州市：0519-81993450</div>
				<div>泰州市：0523-96110</div>
				<div>连云港：0518-81861922</div>
				<div>淮安市：0517-81330529</div>
				<div>宿迁市：0527-84352422</div>
			</div>
		</div>
		<div class="qr-container">
			<div class="qr-item">
				<img class="qr-code" src="images/xhm/xhm_xhrb_wxgzh.png" alt="">
				<div class="qr-desc">
					新华日报<br>微信公众号
				</div>
			</div>
			<div class="qr-item">
				<img class="qr-code" src="images/jsfz/JSFZ_GZH.png" alt="">
				<div class="qr-desc">
					江苏反诈<br>微信公众号
				</div>
			</div>
			<div class="qr-item">
				<img class="qr-code" src="images/gjfzzx/GJFZZX_SHIPINHAO.png" alt="">
				<div class="qr-desc">
					国家反诈中心<br>微信视频号
				</div>
			</div>
			<div class="qr-item">
				<img class="qr-code" src="images/gjfzzx/GJFZZX_DOUYIN.png" alt="">
				<div class="qr-desc">
					国家反诈中心<br>抖音
				</div>
			</div>
		</div>
	</div>

	<div class="footer-container">
		<div style="height: 140px;display: flex;align-items: center;">
			<p style="color:#333333;font-size: 2rem;padding-left: 30px;">主办单位：</p>
			<img src="images/xhm/xhm_company_logo.png"
				style="width: auto;height: 140px;object-fit: cover;" />
		</div>
		<div
			style="line-height: 70px;color:#333333;font-size: 2rem;text-align: center;">
			指导单位：江苏省公安厅反诈总队</div>
		<div
			style="line-height: 70px;color:#333333;font-size: 2rem;text-align: center;">
			版权所有：江苏新华云媒科技股份有限公司</div>

		<div class="footer-line">
			<a href="https://beian.miit.gov.cn/#/Integrated/index"
				target="_blank">苏ICP备2021042539号-2</a> <span class="footer-spacer">互联网新闻信息服务许可证32120170002号</span>
		</div>
		<div class="footer-line">
			<span>增值电信业务经营许可证苏B2-20140164</span> <a href="javascript:void(0);"
				class="footer-spacer" id="aboutBtn">关于我们</a>
		</div>
		<div class="footer-line">如有不良内容或者侵权内容，请拨打上方各地市反诈中心联系方式进行投诉处理</div>
	</div>

	<!-- 关于我们 遮罩层 -->
	<div id="overlay" class="overlay"></div>
	<!-- 关于我们 内容 -->
	<div id="aboutModal" class="aboutUs-container">
		<span id="closeModal" class="aboutUs-close">&times;</span>
		<p class="aboutUs-title">关于我们</p>
		<p class="aboutUs-content">江苏反诈网是江苏省委网信办批准建设的专业新闻网站，由江苏新华报业传媒集团主办，交汇点新闻客户端运维主体单位——江苏新华云媒有限公司负责日常运维。江苏省公安厅反诈总队对该网站提供反诈宣传指导，江苏电信等单位提供技术支持。</p>
		<p class="aboutUs-content">近年来，以电信网络诈骗为代表的新型违法犯罪给广大人民群众带来巨大损失。党和国家对此高度重视，制定并颁布实施《中华人民共和国反电信网络诈骗法》。江苏反诈网依法开展新闻宣传、防范警示、教育劝阻等各项工作，以智能化、精准化、互动化手段实时传递反诈信息，全面宣传安全防范知识，帮助广大人民群众提高识别诈骗的能力，共同守好钱袋子，大力营造“全民反诈”的浓厚社会氛围。</p>
		<p class="aboutUs-content">联系电话：025—58683671。</p>
	</div>

	<!-- 云媒埋点，不可删除 -->
	<iframe style="width: 100%;height: 1px;background: #EEEEEE;border: 0;"
		id="id_iframe_maidian"></iframe>

	<!-- 云媒引流，不可删除 -->
	<div id="id_iframe_traffic" style="display: flex;"></div>

	<!-- 云媒埋点 -->
	<script type="text/javascript" charset="utf-8"
		src="web/js96110/xhm/maidian/autotrack.js"></script>

	<script>
		// 设置埋点iframe的src
		document.getElementById('id_iframe_maidian').setAttribute('src', 'http://jhd-o1.oss-cn-hangzhou.aliyuncs.com/H5/maidian1202.html');
	
		// 设置cookie
		function setIsUVCookie() {
			// 检查 isUV Cookie 是否已经存在  
			const cookies = document.cookie.split('; ');
			const isUVExists = cookies.some(cookie => cookie.trim().startsWith('isUV='));
	
			if (!isUVExists) {
				const randomString = generateRandomString(24); // 生成24位随机字符串  
				const now = new Date(); // 获取当前日期  
				const expires = new Date(); // 创建新的日期对象用于设置过期时间  
				expires.setHours(23, 59, 59, 999); // 设置过期时间为今天的 23:59:59.999  
	
				// 设置 Cookie  
				document.cookie = `isUV=${randomString}; expires=${expires.toUTCString()}; path=/`;
				console.log('isUV cookie has been set:', randomString);
			} else {
				console.log('isUV cookie already exists.');
			}
		}
	
		// 记录登录信息
		function recordLoginInfo() {
			let isUvValue;
			// 取出isUV
			const cookies = document.cookie.split('; ');
			// 查找指定名称的 Cookie  
			for (let cookie of cookies) {
				const [name, value] = cookie.split('=');
				if (name.trim() === 'isUV') {
					isUvValue = decodeURIComponent(value);
					break;
				} }
			if (isUvValue && isUvValue !== '') {
				// 创建 XMLHttpRequest 对象
				const xhr = new XMLHttpRequest();
				xhr.open('POST', 'loginInfo', true);
				xhr.timeout = 6000;
				// 设置请求头
				xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
				// 准备发送的数据
				const data = new URLSearchParams();
				data.append('flag', 'MOBILE');
				data.append('cookie', isUvValue);
				xhr.onload = function() {
					if (xhr.status >= 200 && xhr.status < 300) {
						// 请求成功的处理
						console.log('loginInfo request successful');
					}
				};
				xhr.onerror = function() {
					console.log('loginInfo request failed');
				};
				xhr.ontimeout = function() {
					console.log('loginInfo request timed out');
				};
				xhr.onreadystatechange = function() {
					if (xhr.readyState === 4) {
						// 请求完成（无论成功或失败）
						console.log('loginInfo request completed');
					}
				};
				// 发送请求
				xhr.send(data.toString());
			}
		}
	
		// 设置cookie
		setIsUVCookie();
		// 记录登录信息
		recordLoginInfo();
	
		// 加载JS（不添加版本号，允许缓存）
		function loadJS(src, callback) {
			var script = document.createElement('script');
			script.src = src;
			if (callback)
				script.onload = callback;
			document.head.appendChild(script);
		}
	
		// 加载JS（添加随机版本号，避免缓存）
		function loadJSNoCache(src, callback) {
			var script = document.createElement('script');
			script.src = src + '?v=' + generateRandomString(16);
			if (callback)
				script.onload = callback;
			document.head.appendChild(script);
		}
	
		// 生成指定位数的随机字符串
		function generateRandomString(length) {
			const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
			let result = '';
			const values = new Uint32Array(length); // 创建一个足够大的数组来存储随机数
			window.crypto.getRandomValues(values); // 填充数组
			for (let i = 0; i < length; i++) {
				// 将随机数缩放到字符集的长度范围内  
				const randomIndex = values[i] % charset.length;
				result += charset[randomIndex]; // 构建字符串
			}
			return result;
		}
	
		// 加载jQuery和Swiper（允许缓存）
		loadJS('js/jquery.js', function() {
			loadJS('js/swiper-3.4.2/swiper-3.4.2.jquery.min.js', function() {
				// 加载需要避免缓存的JS
				loadJSNoCache('web/js96110/xhm/data/indexData.js', function() {
					// 最后加载主JS（避免缓存）
					loadJSNoCache('web/js96110/xhm/mobile/xhmMobileMainV2.js');
				});
			});
		});
	</script>
</body>
</html>
