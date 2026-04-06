import { load, _ } from 'assets://js/lib/cat.js';
import 'assets://js/lib/crypto-js.js';

const host = 'https://v.qq.com'

const apihost = 'https://pbaccess.video.qq.com'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0';

let danmakuAPI = '';

// 初始化配置
async function init(cfg) {
    danmakuAPI = cfg.ext;
    // 	console.log("==========================================");
    // 	console.log(cfg.ext);
    // 	console.log("==========================================");
    // 	cfg.skey = '最新';
    // 	cfg.stype = '2'; // 假设 2 表示电影分类
}

// 封装请求
async function request(baseUrl, apiPath, params = {}, method = 'get') {
    // 拼接完整的 URL
    const url = `${baseUrl}/${apiPath}`;

    // 根据 HTTP 方法处理参数
    let reqOptions = {
        method: method,
        headers: {
            'User-Agent': UA,
            'Referer': host,
            'Origin': host
        }
    };

    if (method.toLowerCase() === 'get') {
        // GET 请求：将参数拼接到 URL 的查询字符串中
        const queryString = Object.entries(params)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        reqOptions.url = queryString ? `${url}?${queryString}` : url;
    } else if (method.toLowerCase() === 'post') {
        // POST 请求：将参数作为请求体数据发送
        reqOptions.body = JSON.stringify(params);
        reqOptions.headers['Content-Type'] = 'application/json'; // 设置 Content-Type
    }

    // 发起请求
    // console.log("====================== Request =====================");
    // console.log('URL:', reqOptions.url || url);
    // console.log('Params:', params);
    // console.log('Header:', reqOptions.headers);
    const res = await req(reqOptions.url || url, reqOptions);
    return JSON.parse(res.content);
}

// 首页分类
async function home() {
    const classes = [
        { type_id: '100113', type_name: '电视剧' },
        { type_id: '100173', type_name: '电影' },
        { type_id: '100109', type_name: '综艺' },
        { type_id: '100105', type_name: '纪录片' },
        { type_id: '100119', type_name: '动漫' },
        { type_id: '100150', type_name: '少儿' },
        { type_id: '110755', type_name: '短剧' }
    ];
    return JSON.stringify({ class: classes });
}


// 首页推荐
async function homeVod() {
    // 	try {
    // 		//         let html = await request(`https://gctf.tfdh.top/api.php/provide/vod/?ac=detail&t=1&pg=1`);
    // 		// let res = JSON.parse(html);
    // 		// let videos = [];
    // 		// if (res.data && res.data.vodrows) {
    // 		//     videos = res.data.vodrows
    // 		//         .filter(item => item.isvip !== "1")  // 新增过滤条件
    // 		//         .map(item => ({
    // 		//             vod_id: item.vodid,
    // 		//             vod_name: item.title,
    // 		//             vod_pic: item.vod_pic,
    // 		//             vod_remarks: item.duration,
    // 		//             vod_content: item.intro,
    // 		//             vod_year: item.yearname
    // 		//         }));
    // 		// }

    // 		// return JSON.stringify({
    // 		//     list: videos,
    // 		// });
    // 	} catch (error) {
    // 		console.error('请求失败:', error);
    // 		return JSON.stringify({ error: '请求失败' });
    // 	}
}


// 分类页
async function category(tid, pg, filter, extend) {
    // 构造 URL
    const url = `trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=1000005&vplatform=2&vversion_name=8.9.10&new_mark_label_enabled=1`;

    // 动态构造 JSON 对象
    const sdk_page_ctx = {
        "page_offset": pg,
        "page_size": 1,
        "used_module_num": Number(pg) + 1
    };

    // 转换为 JSON 字符串（如果需要）
    const sdk_page_ctx_json = JSON.stringify(sdk_page_ctx);

    const res = await request(apihost, url,
        {
            "page_params": {
                "channel_id": tid,
                "filter_params": "sort=75&itype=-1&ipay=-1&iarea=-1&iyear=-1&producer=-1&characteristic=-1",
                "page_type": "channel_operation",
                "page_id": "channel_list_second_page"
            },
            "page_context": {
                "view_ad_ssp_mg_ctx_version": "1",
                "view_ad_ssp_mgv2_ctx_version": "1",
                "view_ad_ssp_mg_cards_consumed": "0",
                "view_ad_ssp_mgv2_flush_num": pg,
                "sdk_page_ctx": sdk_page_ctx_json,
                "view_ad_ssp_mgv2_cards_consumed": "0",
                "view_ad_ssp_remaining": "0",
                "data_src_647bd63b21ef4b64b50fe65201d89c6e_page": pg,
                "view_ad_ssp_ad_count_send": "0",
                "view_ad_ssp_ctx_version": "1",
                "view_ad_ssp_mgv2_remaining": "0",
                "view_ad_ssp_mgv2_ad_count_send": "0",
                "data_src_647bd63b21ef4b64b50fe65201d89c6e_data_version": "",
                "view_ad_ssp_mg_ad_count_send": "0",
                "view_ad_ssp_mg_remaining": "0",
                "view_ad_ssp_flush_num": pg,
                "view_ad_ssp_mg_flush_num": pg,
                "view_ad_ssp_cards_consumed": "0",
                "page_index": pg
            }
            //...extend // 扩展参数（如筛选条件）
        }, "POST");
    let result = res.data.module_list_datas[0].module_datas[0].item_data_lists.item_datas.filter(item => item.item_type === "2");

    // 转换为目标格式
    return JSON.stringify({
        page: parseInt(pg), // 当前页码减 1
        pagecount: 999999, // 总页数，默认为 1
        limit: 90, // 每页条数，默认为 20
        total: 9999999, // 总数据量，默认为 0
        list: (result || []).map(i => ({
            vod_id: i.item_params.cid + "&&&" + i.item_params.title + "&&&" + i.item_params.second_title, // 视频 ID
            vod_name: i.item_params.title, // 视频名称
            vod_pic: i.item_params.new_pic_vt, // 视频封面图
            vod_year: i.item_params.year, // 年份
            vod_remarks: i.item_params.second_title // 视频备注信息
        }))
    });
}

// 详情页
async function detail(id) {
    // 分割字符串，分别获取 cid 和 vid
    let [cid, title, second_title] = id.split("&&&");
    let next_page_context = ""; // 初始化 next_page_context
    const url = "trpc.universal_backend_service.page_server_rpc.PageServer/GetPageData?video_appid=3000010&vplatform=2&vversion_name=8.2.96";
    const allData = []; // 存储所有分页数据

    while (true) {
        // 请求参数
        const requestData = {
            "page_params": {
                "req_from": "web_vsite",
                "page_id": "vsite_episode_list",
                "page_type": "detail_operation",
                "id_type": "1",
                "page_size": "",
                "cid": cid,
                "vid": "",
                "lid": "",
                "page_num": "",
                "page_context": next_page_context,
                "detail_page_type": "1"
            },
            "has_cache": 1
        };

        // 发起请求
        const res = await request(apihost, url, requestData, "POST");

        // 提取当前页的数据
        const currentPageData = res.data.module_list_datas[0].module_datas[0].item_data_lists.item_datas;
        allData.push(...currentPageData); // 将当前页数据追加到总数据中

        // 更新 next_page_context
        next_page_context = res.data.module_list_datas[0].module_datas[0].module_params.next_page_context;

        // 检查是否还有下一页
        if (!next_page_context || next_page_context === "") {
            break; // 如果没有下一页，则退出循环
        }
    }


    // 假设 vod 是输入的数据数组
    let filterPlayUrl = allData.filter(item => {
        // 检查 item_params 是否存在，并且 play_title 是否存在
        if (item.item_params && item.item_params.play_title) {
            // 排除 play_title 包含 "预" 的项
            return !item.item_params.play_title.includes("预");
        }
        // 如果 item_params 或 play_title 不存在，则过滤掉该项
        return false;
    });

    // 处理数据
    const playUrl = filterPlayUrl
        .map(item => {
            // 拼接完整 URL
            const title = item.item_params.title; // 剧集名称
            const url = `${host}/x/cover/${item.item_params.cid}/${item.item_id}.html`; // 拼接完整 URL
            return `${title}$${url}`;
        }).join('#'); // 用 # 分隔多个剧集

    return JSON.stringify({
        list: [{
            vod_id: cid,
            vod_name: title,
            vod_content: second_title,
            vod_play_from: '腾讯',
            vod_play_url: playUrl
        }]
    });
}

// 播放解析
async function play(flag, id, flags) {
     //const res = await request("https://www.52h.top", "/api/", {"key":"S8I6aYgKPnuYRknLiF","url":id}, "GET");
    
    
    return JSON.stringify({
        //parse: 0, // 0 表示直连
        jx: 1,
        url: id,
        danmaku: danmakuAPI + id
    });
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 搜索
async function search(wd, quick) {
    let url = "trpc.videosearch.mobile_search.MultiTerminalSearch/MbSearch?vplatform=2";
    const uuid=uuidv4().toUpperCase();
    const res = await request(apihost, url,
        {
            "version": "25031901",
            "clientType": 1,
            "filterValue": "",
            "uuid": uuid,
            "retry": 0,
            "query": wd,
            "pagenum": 0,
            "isPrefetch": true,
            "pagesize": 30,
            "queryFrom": 0,
            "searchDatakey": "",
            "transInfo": "",
            "isneedQc": true,
            "preQid": "",
            "adClientInfo": "",
            "extraInfo": {
                "isNewMarkLabel": "1",
                "multi_terminal_pc": "1",
                "themeType": "1",
                "sugRelatedIds": "{}"
            }
        },"POST");

let result = [];

// 获取 normalList 的内容
let normalList = res.data.normalList.itemList;

// 初始化 result 为 normalList 的内容
result = [...normalList];

// 动态提取 areaBoxList 中的所有 itemList 并合并到 result
if (Array.isArray(res.data.areaBoxList)) {
    result = res.data.areaBoxList.reduce((acc, box) => {
        // 将每个 box 的 itemList 添加到结果中
        return acc.concat(box.itemList || []);
    }, result);
}

// 先过滤掉 doc.id 为 "rec_query" 的项，再映射生成 vod 数组
let vod = result
  .filter(i => i.doc.dataType === 2) // 关键过滤条件
  .map(i => ({
    vod_id: i.doc.id,
    vod_name: i.videoInfo.title,
    vod_pic: i.videoInfo.imgUrl,
    vod_remarks: i.videoInfo.descrip
  }));
    return JSON.stringify({
        list: vod
    });
}

export function __jsEvalReturn() {
    return { init, home, homeVod, category, detail, play, search };
}