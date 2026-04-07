/*
 * 📅【盘搜】追剧优选 - T4（不夜版）
 * 描述: 基于追剧日历和盘搜API的T4影视站点插件，支持网盘资源搜索、分组、线路解析和播放。
 * 
 * 🔥 主要功能:
 *    - 追剧日历数据（今日、明日、周历、榜单）
 *    - 盘搜关键词检索，链接有效性检测，按网盘类型分组展示
 *    - 多网盘线路优先级配置及显示数量限制
 *    - 详情页并发解析剧集线路，补充TMDB剧集信息
 *    - 内置缓存机制，大幅提升重复查询的响应速度
 *    - 播放线路有效性过滤，自动剔除zip等无效内容
 * 
 * ⚠️ 温馨提示：
 *    - 请填写重要参数后使用，可调整显示及并发数优化响应速度。
 *    - 小提示：适当精简盘搜不必要的插件可以使盘搜插件更加高效。
 *    - 盘搜盘检需要时间，建议减少同类盘搜插件的使用。
 * 
 * 日期: 2026-03-11
 */
const axios = require("axios");
const http = require("http");
const https = require("https");
const CryptoJS = require("crypto-js");
const dayjs = require("dayjs");


// ===================== ⚠️ 重要配置参数 =====================
const USE_TMDB_IMAGE = true;  // 是否优先使用TMDB图片信息，true=开启(使用TMDB海报)，false=关闭(显示默认网盘图片)
const MAX_LINES_PER_PAN = 3;  // 每个网盘最多显示 3 条线路
const CONCURRENCY_LIMIT = 20; // 最大并发请求数
const PAN_ORDER = ['baidu','uc','quark'];  // 网盘优先级 其他：ali,uc,a123,a115,a139,pikpak,xunlei
const TMDB_API_KEY = "";      // TMDB用于搜索详情信息
const PANSOU_CONFIG = {
  baseURL: "",  // 盘搜地址
  checkURL: ""  // 链接检查地址
};

// ===================== 基础配置 =====================
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const DATA_SOURCES = {
  zjrl: "https://zjrl-1318856176.cos.accelerate.myqcloud.com",
  gist: "https://gist.githubusercontent.com/huangxd-/5ae61c105b417218b9e5bad7073d2f36/raw",
  tmdbImage: "https://image.tmdb.org/t/p/w500",
  tmdbApi: "https://api.themoviedb.org/3"
};

// ===================== 日志 =====================
let log = {
  info: (msg) => console.log(`[INFO] ${msg}`)
};

const init = async (server) => {
  if (log.init) return;
  if (server && server.log) {
    log.info = (...args) => server.log.info(args.join(' '));
  }
  log.init = true;
};

// ===================== HTTP客户端 =====================
const _http = axios.create({
  timeout: 60 * 1000,
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: false }),
  httpAgent: new http.Agent({ keepAlive: true }),
  baseURL: PANSOU_CONFIG.baseURL,
});

// ===================== 缓存 =====================
const searchCache = new Map();          // 盘搜缓存
const pansouResultCache = new Map();      // 网盘搜索结果缓存
const driveParseCache = new Map();        // 网盘驱动解析缓存
// 缓存配置
const CACHE_TTL = {
  pansou: 30 * 60 * 1000,           // 网盘搜索结果 30分钟
  drive: 60 * 60 * 1000,            // 网盘驱动解析 1小时
  search: 5 * 60 * 1000             // 搜索页缓存 5分钟
};

// ===================== TMDB 图片缓存 =====================
const tmdbCache = new Map();

// ===================== 耗时日志工具 =====================
const logTiming = (step, startTime, extraInfo = '') => {
  const cost = Date.now() - startTime;
  log.info(`[⏱️ 耗时] ${step}: ${cost}ms ${extraInfo}`);
  return Date.now(); // 返回当前时间，用于链式计时
};

// ===================== 网盘搜索结果缓存获取 =====================
const getPansouWithCache = async (vodName) => {
  const cacheKey = vodName;
  const cached = pansouResultCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL.pansou) {
    log.info(`[盘搜缓存] 命中: ${vodName}, 网盘数: ${Object.keys(cached.data).length}`);
    return { data: cached.data, fromCache: true };
  }

  const start = Date.now();
  const data = await getAllPanResults(vodName);
  pansouResultCache.set(cacheKey, { data, time: Date.now() });
  logTiming('盘搜API请求', start, `(缓存已更新, 网盘数: ${Object.keys(data).length})`);
  return { data, fromCache: false };
};

// ===================== 网盘驱动解析缓存获取（带10秒超时） =====================
const getDriveParseWithCache = async (url, driveKey, drives) => {
  const cacheKey = `${driveKey}_${url}`;
  const cached = driveParseCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL.drive) {
    log.info(`[驱动缓存] 命中: ${driveKey}`);
    return { data: cached.data, fromCache: true };
  }

  const start = Date.now();
  // 包装驱动调用，增加10秒超时
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('驱动超时')), 10000)
  );

  try {
    const result = await Promise.race([
      getEpisodesFromDrive(url, driveKey, drives),
      timeoutPromise
    ]);

    driveParseCache.set(cacheKey, { data: result, time: Date.now() });
    logTiming('驱动解析', start, `${driveKey} ${result ? '成功' : '失败/无效'}`);
    return { data: result, fromCache: false };
  } catch (error) {
    logTiming('驱动解析', start, `${driveKey} 超时或错误: ${error.message}`);
    return { data: null, fromCache: false, error: error.message };
  }
};

// ===================== 分类配置 =====================
const filterConfig = {
  "today": [
    {
      "key": "type", "name": "类型", "value": [
        { "n": "剧集", "v": "juji" },
        { "n": "番剧", "v": "fanju" },
        { "n": "国漫", "v": "guoman" },
        { "n": "综艺", "v": "zongyi" }
      ]
    }
  ],
  "tomorrow": [
    {
      "key": "type", "name": "类型", "value": [
        { "n": "剧集", "v": "juji" },
        { "n": "番剧", "v": "fanju" },
        { "n": "国漫", "v": "guoman" },
        { "n": "综艺", "v": "zongyi" }
      ]
    }
  ],
  "week": [
    {
      "key": "type", "name": "类型", "value": [
        { "n": "剧集", "v": "juji_week" },
        { "n": "番剧", "v": "fanju_week" },
        { "n": "国漫", "v": "guoman_week" },
        { "n": "综艺", "v": "zongyi_week" }
      ]
    },
    {
      "key": "weekday", "name": "周几", "value": [
        { "n": "周一", "v": "Monday" },
        { "n": "周二", "v": "Tuesday" },
        { "n": "周三", "v": "Wednesday" },
        { "n": "周四", "v": "Thursday" },
        { "n": "周五", "v": "Friday" },
        { "n": "周六", "v": "Saturday" },
        { "n": "周日", "v": "Sunday" }
      ]
    }
  ],
  "rank": [
    {
      "key": "type", "name": "榜单", "value": [
        { "n": "华语热门", "v": "华语热门" },
        { "n": "今日推荐", "v": "今日推荐" },
        { "n": "现正热播", "v": "现正热播" },
        { "n": "新剧雷达", "v": "新剧雷达" },
        { "n": "已收官好剧", "v": "已收官好剧" },
        { "n": "人气 Top 10", "v": "人气 Top 10" },
        { "n": "热门国漫", "v": "热门国漫" },
        { "n": "本季新番", "v": "本季新番" },
      ]
    }
  ],
  "area": [
    {
      "key": "type", "name": "地区", "value": [
        { "n": "国产剧", "v": "国产剧" },
        { "n": "韩剧", "v": "韩剧" },
        { "n": "日剧", "v": "日剧" },
        { "n": "番剧", "v": "番剧" },
        { "n": "英美剧", "v": "英美剧" },
      ]
    }
  ]
};

// ===================== 网盘配置 =====================
// 内部标识到盘搜API类型的映射
const panTypes = {
  ali: "aliyun",
  quark: "quark",
  uc: "uc",
  pikpak: "pikpak",
  xunlei: "xunlei",
  a123: "123",
  a189: "tianyi",
  a139: "mobile",
  a115: "115",
  baidu: "baidu"
};

// 盘搜API类型到内部标识的反向映射
const reversePanTypes = {
  aliyun: "ali",
  quark: "quark",
  uc: "uc",
  pikpak: "pikpak",
  xunlei: "xunlei",
  '123': "a123",
  tianyi: "a189",
  mobile: "a139",
  '115': "a115",
  baidu: "baidu"
};

const panPic = {
  ali: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/ali.jpg",
  quark: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/quark.png",
  uc: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/uc.png",
  pikpak: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/pikpak.jpg",
  xunlei: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/thunder.png",
  '123': "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/123.png",
  tianyi: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/189.png",
  mobile: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/139.jpg",
  '115': "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/115.jpg",
  'baidu': "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/baidu.jpg",
};

const panNames = {
  ali: "阿里云盘",
  quark: "夸克网盘",
  uc: "UC网盘",
  pikpak: "PikPak",
  xunlei: "迅雷网盘",
  a123: "123云盘",
  a189: "天翼网盘",
  a139: "移动云盘",
  a115: "115网盘",
  baidu: "百度网盘"
};

// ===================== 工具函数 =====================
const fetchJSON = async (url) => {
  try {
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 15000 });
    return res.data;
  } catch (e) {
    log.info(`请求失败: ${url}, ${e.message}`);
    return null;
  }
};

// ===================== TMDB 图片获取 =====================
const fetchTMDBImage = async (tmdbId, mediaType = 'tv') => {
  if (!TMDB_API_KEY || !tmdbId) return null;
  const cacheKey = `${mediaType}_${tmdbId}`;
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);
  try {
    const url = `${DATA_SOURCES.tmdbApi}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`;
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
    const posterPath = res.data?.poster_path;
    if (posterPath) {
      const imageUrl = `${DATA_SOURCES.tmdbImage}${posterPath}`;
      tmdbCache.set(cacheKey, imageUrl);
      return imageUrl;
    }
  } catch (e) {
    log.info(`[TMDB] 获取图片失败: ${tmdbId}`);
  }
  return null;
};

// ===================== 批量获取TMDB图片（并发版本） =====================
const batchFetchTMDBImagesConcurrent = async (items, mediaType = 'tv', concurrency = 5) => {
  if (!USE_TMDB_IMAGE || !TMDB_API_KEY || items.length === 0) return items;

  const newItems = [...items];
  const needFetch = [];
  const indexMap = new Map();

  // 找出需要获取图片的项
  for (let i = 0; i < newItems.length; i++) {
    const item = newItems[i];
    if (item.tmdb_id && !item.poster_path && !item._fetched_poster) {
      needFetch.push({
        index: i,
        tmdbId: item.tmdb_id,
        mediaType: mediaType
      });
    }
  }

  if (needFetch.length === 0) return newItems;

  log.info(`[TMDB并发] 需要获取 ${needFetch.length} 条图片，并发数: ${concurrency}`);

  // 并发控制函数
  async function runWithConcurrency(tasks, limit) {
    const results = [];
    const executing = new Set();

    for (const task of tasks) {
      const p = Promise.resolve().then(() => task());
      results.push(p);

      const e = p.then(() => executing.delete(e));
      executing.add(e);

      if (executing.size >= limit) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  // 创建获取图片的任务
  const tasks = needFetch.map(({ index, tmdbId, mediaType }) => async () => {
    try {
      const url = `${DATA_SOURCES.tmdbApi}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&language=zh-CN`;
      const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
      const posterPath = res.data?.poster_path;
      if (posterPath) {
        const imageUrl = `${DATA_SOURCES.tmdbImage}${posterPath}`;
        return { index, imageUrl, success: true };
      }
    } catch (e) {
      log.info(`[TMDB并发] 获取图片失败: ${tmdbId}`);
    }
    return { index, success: false };
  });

  // 并发执行所有任务
  const fetchResults = await runWithConcurrency(tasks, concurrency);

  // 更新结果到新数组
  for (const result of fetchResults) {
    if (result.success) {
      newItems[result.index] = {
        ...newItems[result.index],
        _fetched_poster: result.imageUrl
      };
    }
  }

  // 缓存成功的图片
  for (const result of fetchResults) {
    if (result.success) {
      const item = newItems[result.index];
      const cacheKey = `${mediaType}_${item.tmdb_id}`;
      tmdbCache.set(cacheKey, result.imageUrl);
    }
  }

  log.info(`[TMDB并发] 完成: ${fetchResults.filter(r => r.success).length}/${needFetch.length} 成功`);

  return newItems;
};

// ===================== 从 TMDB 搜索剧集信息 =====================
const fetchTMDBInfo = async (title) => {
  if (!USE_TMDB_IMAGE || !TMDB_API_KEY || !title) return null;
  try {
    const url = `${DATA_SOURCES.tmdbApi}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    const res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
    const results = res.data?.results;
    if (results && results.length > 0) {
      const first = results[0];
      return {
        vod_pic: first.poster_path ? `${DATA_SOURCES.tmdbImage}${first.poster_path}` : "",
        vod_content: first.overview || "",
        vod_year: first.first_air_date ? first.first_air_date.substring(0, 4) : "",
        vod_actor: "",
        vod_director: ""
      };
    }
  } catch (e) {
    log.info(`[TMDB] 搜索失败: ${title}`);
  }
  return null;
};

// ===================== 追剧日历数据获取 =====================

// 获取榜单数据
const getRankData = async (rankType) => {
  log.info(`[getRankData] 开始获取: ${rankType}`);
  const areaTypes = ["国产剧", "日剧", "英美剧", "番剧", "韩剧", "港台剧"];

  if (areaTypes.includes(rankType)) {
    const url = `${DATA_SOURCES.zjrl}/home0.json`;
    const data = await fetchJSON(url);
    if (!data) {
      log.info(`[getRankData] home0.json 获取失败`);
      return [];
    }
    const category = data.find(item => item.type === "category");
    if (!category) {
      log.info(`[getRankData] 未找到category`);
      return [];
    }
    const area = category.content.find(item => item.title === rankType);
    if (!area) {
      log.info(`[getRankData] 未找到地区: ${rankType}`);
      return [];
    }
    const result = area.data || area;
    log.info(`[getRankData] ${rankType} 返回 ${result?.length || 0} 条`);
    return result || [];
  }

  const specialRanks = ["华语热门", "本季新番", "今日推荐"];
  const isSpecial = specialRanks.includes(rankType);
  const url = isSpecial ? `${DATA_SOURCES.zjrl}/home0.json` : `${DATA_SOURCES.zjrl}/home1.json`;
  const data = await fetchJSON(url);
  if (!data) return [];

  if (rankType === "今日推荐") {
    const rec = data.find(item => item.type === "1s");
    return rec ? rec.content : [];
  }
  const item = data.find(i => i.title === rankType);
  return item ? item.content : [];
};

// ===================== 获取今日/明日数据（也使用并发加载） =====================
const getDayData = async (type, day) => {
  // 剧集和番剧从主JSON获取
  if (type === 'juji' || type === 'fanju') {
    const url = `${DATA_SOURCES.zjrl}/home1.json`;
    const data = await fetchJSON(url);
    if (!data) return [];

    const titleMap = {
      'juji_today': '今天播出的剧集',
      'juji_tomorrow': '明天播出的剧集',
      'fanju_today': '今天播出的番剧',
      'fanju_tomorrow': '明天播出的番剧'
    };
    const item = data.find(i => i.title === titleMap[`${type}_${day}`]);
    let items = item ? item.content : [];

    // 使用并发加载TMDB图片
    if (TMDB_API_KEY && items.length > 0) {
      items = await batchFetchTMDBImagesConcurrent(items, 'tv', 10);
    }

    return items;
  }

  // 国漫和综艺从 gist 获取
  const url = `${DATA_SOURCES.gist}/${type}_${day}.json`;
  let data = await fetchJSON(url);
  if (!data) return [];

  if (!Array.isArray(data)) {
    return [];
  }

  log.info(`[${type}_${day}] 获取到 ${data.length} 条`);

  // 使用并发加载TMDB图片
  if (TMDB_API_KEY && data.length > 0) {
    data = await batchFetchTMDBImagesConcurrent(data, 'tv', 10);
  }

  return data;
};


// ===================== 获取周历数据（使用并发加载） =====================
const getWeekData = async (type, weekday) => {
  const url = `${DATA_SOURCES.gist}/${type}.json`;
  const data = await fetchJSON(url);
  if (!data) {
    return [];
  }

  const targetDay = (!weekday || weekday === 'All') ? 'Monday' : weekday;
  let items = data[targetDay] || [];

  log.info(`[周历] ${targetDay}: ${items.length} 条`);

  // 使用并发加载TMDB图片，提高效率
  if (TMDB_API_KEY && items.length > 0) {
    const mediaType = type.includes('movie') ? 'movie' : 'tv';
    // 使用并发数10，可以根据需要调整
    items = await batchFetchTMDBImagesConcurrent(items, mediaType, 10);
  }

  return items;
};


// ===================== 数据转换 =====================
const convertItem = (item, index = 0, sourceType = '') => {
  if (!item || typeof item !== 'object') {
    log.info(`[转换] 无效数据项: ${JSON.stringify(item)}`);
    return null;
  }

  let title = item.title || item.name || item.cn_name || item.original_name;
  if (!title && item.t1) title = item.t1;
  if (!title) {
    const possibleFields = ['show_name', 'tv_name', 'series_name', 'program_name', 'zh_name'];
    for (const field of possibleFields) {
      if (item[field]) { title = item[field]; break; }
    }
  }
  if (!title) {
    log.info(`[转换] 无法找到标题，数据字段: ${Object.keys(item).join(',')}`);
    title = `未知_${index}`;
  }

  const year = item.year || item.release_year || (item.first_air_date ? item.first_air_date.substring(0, 4) : "") || "";
  const episode = item.episode || item.episode_number || item.latest_episode || "";

  // 图片处理
  let pic = "";

  if (USE_TMDB_IMAGE) {
    // 开启TMDB时，优先使用TMDB图片
    if (item.poster_path) {
      pic = `${DATA_SOURCES.tmdbImage}${item.poster_path}`;
    } else if (item._fetched_poster) {
      pic = item._fetched_poster;
    } else if (item.backdrop_path) {
      pic = `${DATA_SOURCES.tmdbImage}${item.backdrop_path}`;
    }
  }

  // 如果开关关闭或上面未获取到，则使用原有图片字段
  if (!pic) {
    if (item.pic) pic = item.pic;
    else if (item.cover) pic = item.cover;
    else if (item.image) pic = item.image;
    else if (item.img) pic = item.img;
    else if (item.poster) pic = item.poster;
    else if (item.thumb) pic = item.thumb;
    else if (item.thumbnail) pic = item.thumbnail;
  }

  const uniqueId = item.id || item.tmdb_id || item.douban_id || `${index}`;
  const encodedTitle = encodeURIComponent(title);
  const vod_id = `zjrl_${encodedTitle}_${uniqueId}`;

  let remarks = episode;
  if (!remarks && (item.vote_average || item.t3)) remarks = `${item.vote_average || item.t3}分`;
  if (!remarks && item.rating) remarks = `${item.rating}分`;
  if (!remarks) remarks = year || "追剧日历";

  return {
    vod_id: vod_id,
    vod_name: title,
    vod_pic: pic,
    vod_remarks: remarks,
    vod_year: String(year),
    _raw: item
  };
};

// ===================== 盘搜核心逻辑 =====================

// 链接有效性检测
const checkLinksValidity = async (links) => {
  const uniqueLinks = [...new Set(links)];
  const VALID_STATUS = ["valid_links"];
  let validLinksSet = new Set();
  try {
    const checkRes = await _http.post(
      PANSOU_CONFIG.checkURL,
      { links: uniqueLinks, selected_platforms: ["quark", "uc", "baidu", "tianyi", "pan115", "cmcc"] },
      { timeout: 30000, headers: { "Content-Type": "application/json" } }
    );
    const checkData = checkRes.data;
    for (const status of VALID_STATUS) {
      (checkData[status] || []).forEach((link) => validLinksSet.add(link));
    }
  } catch (e) {
    log.info(`[盘搜校验链接失败] ${e.message}`);
    uniqueLinks.forEach((l) => validLinksSet.add(l));
  }
  return validLinksSet;
};

// ===================== 搜索（带缓存，分组图片优先使用TMDB） =====================
const _search = async (wd, page, drives) => {
  log.info(`[搜索] 关键词: ${wd}, 页码: ${page}`);

  // 搜索页级别缓存
  const cacheKey = `search_${wd}_${page}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expire > Date.now()) {
    log.info(`[搜索缓存] 命中: ${wd}`);
    return cached.data;
  }

  const result = {
    list: [],
    page: parseInt(page),
    pagecount: 1,
    total: 0,
  };

  try {
    // 根据 PAN_ORDER 生成需要请求的 cloud_types
    const cloudTypes = PAN_ORDER.map(key => panTypes[key]).filter(Boolean);
    if (cloudTypes.length === 0) {
      log.info(`[搜索] PAN_ORDER 未配置任何网盘类型`);
      return result;
    }

    const res = await _http.post("/api/search", {
      kw: wd,
      cloud_types: cloudTypes,
    });
    const ret = res.data;
    if (ret.code !== 0) throw new Error(ret.message || "请求失败");

    // 收集所有链接进行校验
    const allLinks = [];
    for (const key in ret.data.merged_by_type || {}) {
      for (const row of ret.data.merged_by_type[key] || []) allLinks.push(row.url);
    }
    const validLinksSet = await checkLinksValidity(allLinks);

    // 按网盘类型聚合（只处理 PAN_ORDER 中的类型）
    const driveMap = new Map();
    for (const driveKey of PAN_ORDER) {
      const drive = drives.find(d => d.key === driveKey);
      if (drive && panNames[driveKey]) {
        driveMap.set(driveKey, {
          driveName: drive.name || panNames[driveKey],
          drivePic: panPic[driveKey] || "",
          resourceCount: 0,
          latestDate: null,
        });
      }
    }

    // 统计各网盘类型的有效资源，并存入缓存
    for (const key in ret.data.merged_by_type || {}) {
      const driveKey = reversePanTypes[key];
      if (!driveKey || !PAN_ORDER.includes(driveKey) || !driveMap.has(driveKey)) continue;

      const driveData = driveMap.get(driveKey);
      const resources = (ret.data.merged_by_type[key] || []).filter((row) => validLinksSet.has(row.url));
      driveData.resourceCount += resources.length;

      // 更新最新日期
      for (const row of resources) {
        const dt = dayjs(row.datetime);
        if (!driveData.latestDate || dt.isAfter(driveData.latestDate)) driveData.latestDate = dt;
      }

      // 存入缓存（关键词+网盘类型 -> 资源列表）
      if (resources.length > 0) {
        const cacheKey = `${wd}_${driveKey}`;
        searchCache.set(cacheKey, {
          items: resources.map(item => ({
            url: item.url,
            name: item.note,
            datetime: item.datetime,
          })),
          expire: Date.now() + CACHE_TTL.search
        });
      }
    }

    // ===== 获取TMDB图片（如果开启且存在）=====
    let tmdbPoster = null;
    if (USE_TMDB_IMAGE && TMDB_API_KEY) {
      try {
        const tmdbInfo = await fetchTMDBInfo(wd);
        if (tmdbInfo && tmdbInfo.vod_pic) {
          tmdbPoster = tmdbInfo.vod_pic;
          log.info(`[搜索] 获取到TMDB图片: ${tmdbPoster}`);
        }
      } catch (e) {
        log.info(`[搜索] 获取TMDB图片失败: ${e.message}`);
      }
    }

    // 构建搜索结果列表
    for (const [driveKey, driveData] of driveMap) {
      if (driveData.resourceCount > 0) {
        // 如果开启了TMDB，则在网盘名称后加上关键词
        const displayName = USE_TMDB_IMAGE
          ? `${driveData.driveName}【${wd}】`
          : driveData.driveName;

        result.list.push({
          vod_id: `drive_${driveKey}_${encodeURIComponent(wd)}`,
          vod_name: displayName,
          vod_pic: (USE_TMDB_IMAGE && tmdbPoster) ? tmdbPoster : driveData.drivePic,
          vod_remarks: `${driveData.resourceCount}个资源 | ${driveData.latestDate.format("MM-DD")}`,
          time: driveData.latestDate.unix(),
        });
      }
    }

    result.list.sort((a, b) => b.time - a.time);
    result.total = result.list.length;
    result.pagecount = Math.ceil(result.total / 20) || 1;

    // 缓存搜索结果页
    searchCache.set(cacheKey, { data: result, expire: Date.now() + CACHE_TTL.search });

    log.info(`[搜索] 返回 ${result.list.length}/${result.total} 个网盘分组，使用TMDB图片: ${!!tmdbPoster}`);
  } catch (error) {
    log.info(`[搜索] 失败: ${error.message}`);
  }
  return result;
};
// ===================== 调用网盘驱动获取剧集列表（带有效性检测） =====================
const getEpisodesFromDrive = async (url, driveKey, drives) => {
  log.info(`[网盘驱动] 获取剧集: ${driveKey}, URL: ${url.substring(0, 50)}...`);

  const drive = drives.find(d => d.key === driveKey);
  if (!drive) {
    log.info(`[网盘驱动] 未找到驱动: ${driveKey}`);
    return null;
  }

  try {
    // 检查是否匹配
    if (!drive.matchShare || !drive.matchShare(url)) {
      log.info(`[网盘驱动] 驱动不匹配: ${driveKey}`);
      return null;
    }

    // 获取VOD信息
    const vod = await drive.getVod(url);
    if (!vod) {
      log.info(`[网盘驱动] 获取VOD失败: ${driveKey}`);
      return null;
    }

    // 检测播放串是否有效：避免出现只有“播放$url”这种无效线路
    let isValid = true;
    if (vod.vod_play_url) {
      const parts = vod.vod_play_url.split('#');
      // 如果只有一集，且该集的名称为“播放”或“全集”，则视为无效
      if (parts.length === 1) {
        const single = parts[0];
        const [name, link] = single.split('$');
        if (name === '播放' || name === '全集' || name === '点击播放' || name === '立即播放') {
          isValid = false;
        }
      }
    } else {
      isValid = false;
    }

    if (!isValid) {
      log.info(`[网盘驱动] 播放串无效: ${driveKey}`);
      return null;
    }

    log.info(`[网盘驱动] 获取成功: ${driveKey}, 线路: ${vod.vod_play_from}, 集数: ${vod.vod_play_url?.split('#').length || 0}`);

    return {
      playFrom: vod.vod_play_from || driveKey,
      playUrl: vod.vod_play_url,
      vodPic: vod.vod_pic || "",
      vodContent: vod.vod_content || "",
      vodActor: vod.vod_actor || "",
      vodDirector: vod.vod_director || ""
    };
  } catch (error) {
    log.info(`[网盘驱动] 错误: ${error.message}`);
    return null;
  }
};

// ===================== 通用并发控制函数 =====================
async function runWithConcurrency(tasks, limit = CONCURRENCY_LIMIT) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    const e = p.then(() => executing.delete(e));
    executing.add(e);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ===================== 详情（调用网盘驱动解析剧集，并从 TMDB 补充信息） =====================
const _detail = async (id, title, drives) => {
  log.info(`[详情] ID: ${id}, 标题: ${title || '未知'}`);

  // 处理网盘类型聚合的详情 (drive_ 开头)
  if (id.startsWith('drive_')) {
    try {
      const [, driveKey, encodedWd] = id.split('_');
      const wd = decodeURIComponent(encodedWd);
      const cacheKey = `${wd}_${driveKey}`;
      const cached = searchCache.get(cacheKey);
      let driveTypeData = [];

      if (cached && cached.expire > Date.now()) {
        driveTypeData = cached.items;
        log.info(`[详情] 使用缓存数据: ${cacheKey}, 共 ${driveTypeData.length} 条`);
      } else {
        // 缓存不存在或过期，重新搜索（只搜索该网盘类型）
        log.info(`[详情] 缓存未命中，重新搜索: ${cacheKey}`);
        const panTypeMap = {
          ali: "aliyun", quark: "quark", uc: "uc", pikpak: "pikpak", xunlei: "xunlei",
          a123: "123", a189: "tianyi", a139: "mobile", a115: "115", baidu: "baidu"
        };
        const res = await _http.post("/api/search", { kw: wd, cloud_types: [panTypeMap[driveKey]] });
        const ret = res.data;
        if (ret.code !== 0) throw new Error(ret.message || "请求失败");
        let rawData = ret.data.merged_by_type[panTypeMap[driveKey]] || [];
        const allLinks = rawData.map(item => item.url);
        const validLinksSet = await checkLinksValidity(allLinks);
        driveTypeData = rawData.filter(item => validLinksSet.has(item.url)).map(item => ({
          url: item.url,
          name: item.note,
          datetime: item.datetime,
        }));
        searchCache.set(cacheKey, { items: driveTypeData, expire: Date.now() + CACHE_TTL.search });
      }

      if (driveTypeData.length === 0) {
        return {
          vod_id: id,
          vod_name: wd,
          vod_pic: panPic[driveKey] || "",
          vod_remarks: "无有效资源",
          vod_content: "",
          vod_play_from: "",
          vod_play_url: "",
        };
      }

      // 限制每个网盘的线路数
      const limitedData = driveTypeData.slice(0, MAX_LINES_PER_PAN);
      const parseStart = Date.now();

      // 使用带缓存的驱动解析，保持顺序
      const tasks = limitedData.map((row, index) => async () => {
        const start = Date.now();
        const result = await getDriveParseWithCache(row.url, driveKey, drives);
        return { 
          result, 
          index, 
          row,
          cost: Date.now() - start
        };
      });

      const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
      logTiming('网盘解析', parseStart, `${driveKey} ${results.filter(r => r.result.data).length}/${results.length} 成功`);

      const playFromList = [];
      const playUrlList = [];
      let mainVodInfo = null;

      // 按原顺序过滤有效结果
      for (const parseRes of results) {
        const episodeData = parseRes.result.data;
        if (episodeData && episodeData.playUrl) {
          const lineName = playFromList.length === 0 ? (panNames[driveKey] || driveKey) : `${panNames[driveKey] || driveKey}#${playFromList.length + 1}`;
          playFromList.push(lineName);
          playUrlList.push(episodeData.playUrl);
          if (!mainVodInfo) {
            mainVodInfo = episodeData;
          }
          log.info(`[线路] 已添加: ${lineName}, 耗时${parseRes.cost}ms`);
        } else {
          log.info(`[详情] 跳过无效线路: ${panNames[driveKey] || driveKey}${parseRes.index === 0 ? '' : '#' + (parseRes.index + 1)}`);
        }
      }

      if (playFromList.length === 0) {
        return {
          vod_id: id,
          vod_name: wd,
          vod_pic: panPic[driveKey] || "",
          vod_remarks: "无有效播放线路",
          vod_content: `搜索: ${wd}\n未找到有效播放资源`,
          vod_play_from: "温馨提示",
          vod_play_url: "未找到有效播放资源$https://www.douban.com",
        };
      }

      // 尝试从 TMDB 获取更多信息
      const tmdbInfo = await fetchTMDBInfo(wd);

      const mainResource = {
        vod_id: id,
        vod_name: wd,
        vod_pic: (USE_TMDB_IMAGE && tmdbInfo?.vod_pic) ? tmdbInfo.vod_pic : (mainVodInfo?.vodPic || panPic[driveKey] || ""),
        vod_remarks: `${driveTypeData.length}个资源`,
        vod_content: tmdbInfo?.vod_content || mainVodInfo?.vodContent || `搜索: ${wd}`,
        vod_actor: tmdbInfo?.vod_actor || mainVodInfo?.vodActor || "",
        vod_director: tmdbInfo?.vod_director || mainVodInfo?.vodDirector || "",
        vod_year: tmdbInfo?.vod_year || "",
        vod_play_from: playFromList.join('$$$'),
        vod_play_url: playUrlList.join('$$$'),
      };

      log.info(`[详情] 返回 ${driveKey} 分组详情, 共 ${playFromList.length} 条有效线路`);
      return mainResource;
    } catch (error) {
      log.info(`[详情] 处理 drive_ 详情失败: ${error.message}`);
      return {
        vod_id: id,
        vod_name: title || "未知",
        vod_pic: "",
        vod_remarks: "获取详情失败",
        vod_content: "",
        vod_play_from: "",
        vod_play_url: "",
      };
    }
  }

  // 处理网盘资源链接（http 开头）
  if (id.startsWith('http')) {
    let vodData = {
      vod_id: id,
      vod_name: "网盘资源",
      vod_pic: "",
      vod_remarks: "点击播放",
      vod_content: id,
      vod_play_from: "网盘",
      vod_play_url: `播放$${id}`,
    };

    // 尝试匹配网盘驱动（只匹配 PAN_ORDER 中的驱动，串行即可，通常只有一个）
    for (const driveKey of PAN_ORDER) {
      const drive = drives.find(d => d.key === driveKey);
      if (!drive || !drive.matchShare) continue;

      try {
        if (drive.matchShare(id)) {
          const episodeData = await getEpisodesFromDrive(id, driveKey, drives);
          if (episodeData) {
            vodData = {
              ...vodData,
              vod_pic: episodeData.vodPic || vodData.vod_pic,
              vod_content: episodeData.vodContent || vodData.vod_content,
              vod_actor: episodeData.vodActor || vodData.vod_actor,
              vod_director: episodeData.vodDirector || vodData.vod_director,
              vod_play_from: episodeData.playFrom,
              vod_play_url: episodeData.playUrl,
            };
            break;
          }
        }
      } catch (error) {
        log.info(`[详情] 获取网盘详情失败: ${error.message}`);
      }
    }
    return vodData;
  }

  // 追剧日历剧集 (zjrl_ 开头) - 使用搜索逻辑，带缓存和并发控制
  if (id.startsWith('zjrl_')) {
    const totalStart = Date.now();
    let searchTitle = title;
    if (!searchTitle) {
      const parts = id.split('_');
      if (parts.length >= 2) {
        try { searchTitle = decodeURIComponent(parts[1]); } catch { searchTitle = parts[1]; }
      }
    }
    if (!searchTitle) searchTitle = id;
    log.info(`[详情] 搜索剧集: ${searchTitle}`);

    // 使用缓存获取盘搜结果
    const pansouRes = await getPansouWithCache(searchTitle);
    const panResults = pansouRes.data || {};
    const t1 = logTiming('阶段1-盘搜获取', totalStart, `缓存:${pansouRes.fromCache}`);

    // 收集所有需要并发的任务（使用带缓存的驱动解析）
    const tasks = [];
    for (const panKey of PAN_ORDER) {
      const items = panResults[panKey];
      if (!items || items.length === 0) continue;
      const limitedItems = items.slice(0, MAX_LINES_PER_PAN);
      for (let i = 0; i < limitedItems.length; i++) {
        const item = limitedItems[i];
        tasks.push(async () => {
          const start = Date.now();
          const result = await getDriveParseWithCache(item.url, panKey, drives);
          return { 
            result, 
            panKey, 
            index: i, 
            item,
            cost: Date.now() - start
          };
        });
      }
    }

    // 并发执行所有任务（带并发限制）
    const parseStart = Date.now();
    const results = await runWithConcurrency(tasks, CONCURRENCY_LIMIT);
    logTiming('阶段2-网盘解析', parseStart, `共${tasks.length}任务,成功${results.filter(r => r.result.data).length}个`);

    const playFromList = [];
    const playUrlList = [];
    let mainVodInfo = {};

    // 按网盘顺序和资源顺序重组有效线路
    for (const panKey of PAN_ORDER) {
      const panTasks = results.filter(r => r.panKey === panKey).sort((a, b) => a.index - b.index);
      for (let i = 0; i < panTasks.length; i++) {
        const parseRes = panTasks[i];
        const episodeData = parseRes.result.data;
        if (episodeData && episodeData.playUrl) {
          const lineName = playFromList.length === 0 ? (panNames[panKey] || panKey) : `${panNames[panKey] || panKey}#${i + 1}`;
          playFromList.push(lineName);
          playUrlList.push(episodeData.playUrl);
          if (!mainVodInfo.vodPic) {
            mainVodInfo = episodeData;
          }
          log.info(`[线路] 已添加: ${lineName}, 耗时${parseRes.cost}ms`);
        } else {
          log.info(`[详情] 跳过无效线路: ${panNames[panKey] || panKey}${i === 0 ? '' : '#' + (i + 1)}`);
        }
      }
    }

    // 尝试从 TMDB 获取更多信息
    const tmdbInfo = await fetchTMDBInfo(searchTitle);

    const t3 = logTiming('详情页总耗时', totalStart, `线路数:${playFromList.length}`);

    if (playFromList.length > 0) {
      return {
        vod_id: id,
        vod_name: searchTitle,
        vod_pic: (USE_TMDB_IMAGE && tmdbInfo?.vod_pic) ? tmdbInfo.vod_pic : (mainVodInfo.vodPic || ""),
        vod_remarks: `${playFromList.length}个线路`,
        vod_content: tmdbInfo?.vod_content || mainVodInfo.vodContent || `搜索: ${searchTitle}`,
        vod_actor: tmdbInfo?.vod_actor || mainVodInfo.vodActor || "",
        vod_director: tmdbInfo?.vod_director || mainVodInfo.vodDirector || "",
        vod_year: tmdbInfo?.vod_year || "",
        vod_play_from: playFromList.join('$$$'),
        vod_play_url: playUrlList.join('$$$'),
      };
    } else {
      return {
        vod_id: id,
        vod_name: searchTitle,
        vod_pic: tmdbInfo?.vod_pic || "",
        vod_remarks: "未找到有效播放线路",
        vod_content: tmdbInfo?.vod_content || `搜索: ${searchTitle}\n未找到有效播放资源`,
        vod_play_from: "温馨提示",
        vod_play_url: "未找到有效播放资源$https://www.douban.com",
      };
    }
  }

  return {
    vod_id: id,
    vod_name: title || "未知",
    vod_pic: "",
    vod_remarks: "",
    vod_content: "",
    vod_play_from: "",
    vod_play_url: "",
  };
};

// ===================== 获取所有网盘的搜索结果（只返回 PAN_ORDER 中的网盘） =====================
const getAllPanResults = async (wd) => {
  log.info(`[盘搜] 搜索所有网盘: ${wd}`);

  try {
    // 只请求 PAN_ORDER 中的类型
    const cloudTypes = PAN_ORDER.map(key => panTypes[key]).filter(Boolean);
    if (cloudTypes.length === 0) return {};

    const res = await _http.post("/api/search", {
      kw: wd,
      cloud_types: cloudTypes,
    });

    if (res.data.code !== 0) {
      log.info(`[盘搜] 搜索失败: ${res.data.message}`);
      return {};
    }

    const data = res.data.data;
    const allLinks = [];

    for (const key in data.merged_by_type || {}) {
      for (const row of data.merged_by_type[key] || []) {
        allLinks.push(row.url);
      }
    }

    const validLinksSet = await checkLinksValidity(allLinks);
    const results = {};

    for (const key in data.merged_by_type || {}) {
      const panKey = reversePanTypes[key];
      if (!panKey || !PAN_ORDER.includes(panKey)) continue;

      const validItems = (data.merged_by_type[key] || [])
        .filter(item => validLinksSet.has(item.url))
        .map(item => ({
          url: item.url,
          name: item.note,
          datetime: item.datetime,
        }));

      if (validItems.length > 0) {
        results[panKey] = validItems;
      }
    }

    // 记录各网盘结果数
    const counts = Object.entries(results).map(([k, v]) => `${k}:${v.length}`).join(', ');
    log.info(`[盘搜] 搜索结果: ${counts}`);

    return results;
  } catch (error) {
    log.info(`[盘搜] 搜索异常: ${error.message}`);
    return {};
  }
};

// ===================== 播放（调用网盘驱动，带清晰度映射和排序） =====================
const _play = async ({ flag, flags, id, drives }) => {
  log.info(`[播放] 处理播放请求, flag: ${flag}, id: ${id?.substring(0, 50)}`);

  // 根据flag找到对应的网盘驱动
  let driveKey = flag;

  // 处理带序号的flag，如 "quark#2"
  if (flag && flag.includes('#')) {
    driveKey = flag.split('#')[0];
  }

  // 处理中文名称，映射到key
  const nameToKey = {
    '夸克网盘': 'quark',
    'UC网盘': 'uc',
    '百度网盘': 'baidu',
    '阿里云盘': 'ali',
    'PikPak': 'pikpak',
    '迅雷网盘': 'xunlei',
    '123云盘': 'a123',
    '天翼网盘': 'a189',
    '移动云盘': 'a139',
    '115网盘': 'a115'
  };

  if (nameToKey[driveKey]) {
    driveKey = nameToKey[driveKey];
  }

  // 查找对应的驱动
  const drive = drives.find((o) => o.key === driveKey);

  let result = null;

  if (drive) {
    log.info(`[播放] 找到网盘驱动: ${driveKey}, 调用play方法`);
    try {
      result = await drive.play(id, flag);
      log.info(`[播放] 驱动返回结果: ${JSON.stringify(result).substring(0, 100)}`);
    } catch (error) {
      log.info(`[播放] 驱动播放失败: ${error.message}`);
      return { error: `播放失败: ${error.message}` };
    }
  } else {
    // 如果没有找到指定驱动，尝试遍历所有驱动（只限 PAN_ORDER）
    log.info(`[播放] 未找到指定驱动: ${driveKey}, 尝试遍历 PAN_ORDER 中的驱动`);
    for (const key of PAN_ORDER) {
      const d = drives.find(o => o.key === key);
      if (!d || !d.matchShare) continue;
      try {
        if (d.matchShare(id)) {
          log.info(`[播放] 找到匹配驱动: ${d.key}`);
          result = await d.play(id, flag);
          break;
        }
      } catch (error) {
        log.info(`[播放] 驱动 ${d.key} 播放失败: ${error.message}`);
      }
    }
  }

  // ======== 清晰度重命名 + 排序 ========
  if (result && Array.isArray(result.url)) {
    const renameMap = {
      RAW: '原画',
      '4k': '4K高清',
      '2k': '2K高清',
      super: '超清',
      high: '标清',
      low: '流畅',
    };

    // 目标顺序（从高到低）
    const order = ['4K高清', '2K高清', '超清', '标清', '流畅', '原画'];
    const orderIndex = new Map(order.map((k, i) => [k, i]));

    // 将 ["RAW", "url1", "4k", "url2", ...] => [{q, u}, ...]
    const pairs = [];
    for (let i = 0; i < result.url.length; i += 2) {
      const q0 = result.url[i];
      const u0 = result.url[i + 1];
      if (typeof q0 !== 'string' || typeof u0 !== 'string') continue;

      const q = renameMap[q0] || q0; // 未命中的保持原样
      pairs.push({ q, u: u0 });
    }

    // 排序：按指定order，未在order里的放最后且保持相对顺序
    const sorted = pairs
      .map((p, idx) => ({
        ...p,
        _idx: idx,
        _ord: orderIndex.has(p.q) ? orderIndex.get(p.q) : 999,
      }))
      .sort((a, b) => (a._ord - b._ord) || (a._idx - b._idx));

    // 还原为原格式数组
    result.url = sorted.flatMap(p => [p.q, p.u]);

    log.info(`[播放] 清晰度映射完成: ${sorted.map(p => p.q).join(', ')}`);
  }
  // ======== 这里结束 ========

  if (!result) {
    log.info(`[播放] 未找到匹配的网盘驱动，返回错误`);
    return {
      error: "未找到对应的网盘驱动",
      flag: flag,
      id: id
    };
  }

  return result;
};

// ===================== 追剧日历分类 =====================
const _category = async ({ id, page, filters }) => {
  const pg = parseInt(page) || 1;
  log.info(`[分类] ${id}, 页码: ${pg}, 筛选: ${JSON.stringify(filters)}`);
  let items = [];
  let sourceType = '';

  switch (id) {
    case "today":
      sourceType = 'today';
      items = await getDayData(filters.type || 'juji', 'today');
      break;
    case "tomorrow":
      sourceType = 'tomorrow';
      items = await getDayData(filters.type || 'juji', 'tomorrow');
      break;
    case "week":
      sourceType = 'week';
      const weekday = filters.weekday || 'Monday';
      items = await getWeekData(filters.type || 'juji_week', weekday);
      break;
    case "rank":
      sourceType = 'rank';
      items = await getRankData(filters.type || '华语热门');
      break;
    case "area":
      sourceType = 'area';
      items = await getRankData(filters.type || '国产剧');
      break;
  }

  if (!Array.isArray(items)) items = [];
  const totalItems = items.length;
  const pageSize = 20;
  const start = (pg - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const list = pageItems.map((item, idx) => convertItem(item, start + idx, sourceType)).filter(Boolean);
  const pagecount = Math.ceil(totalItems / pageSize) || 1;

  log.info(`[分类] 返回 ${list.length}/${totalItems} 条，页码 ${pg}/${pagecount}`);
  return { list, page: pg, pagecount, limit: pageSize, total: totalItems };
};

// ===================== T4协议处理 =====================
const decodeExt = (ext) => {
  if (!ext) return {};
  try { return JSON.parse(Buffer.from(ext, 'base64').toString('utf-8')); } catch (e) {
    try { return JSON.parse(ext); } catch (e2) { return {}; }
  }
};

const handleT4Request = async (req) => {
  const { ids, id, wd, play, t, pg, ext, ac } = req.query;
  const page = parseInt(pg) || 1;
  const drives = req.server?.drives || [];
  log.info(`[请求] ${req.url.substring(0, 80)}`);

  if (play) {
    // 播放请求，直接使用flag和play参数
    return await _play({ flag: req.query.flag || '', flags: [], id: play, drives });
  }
  if (wd) return await _search(wd, page, drives);
  if ((ids || id) && (ids || id) !== "undefined") {
    const detailId = (ids || id).toString();
    const filters = decodeExt(ext);
    const title = filters.title || filters.wd;
    const detail = await _detail(detailId, title, drives);
    return { list: detail ? [detail] : [], page: 1, pagecount: 1, total: 1 };
  }
  if (t) {
    const filters = decodeExt(ext);
    if (t === 'week' && !filters.weekday) {
      filters.weekday = 'Monday';
      filters.type = filters.type || 'juji_week';
    }
    return await _category({ id: t, page, filters });
  }
  return {
    class: [
      { type_id: "rank", type_name: "🔥 热门榜单" },
      { type_id: "today", type_name: "📺 今日播出" },
      { type_id: "tomorrow", type_name: "📅 明日播出" },
      { type_id: "week", type_name: "📆 播出周历" },
      { type_id: "area", type_name: "🌏 地区榜单" }
    ],
    filters: filterConfig
  };
};

// ===================== 模块导出 =====================
module.exports = async (server, opt) => {
  await init(server);
  const apiPath = "/video/zjyx_pansou";

  server.get(apiPath, async (req, reply) => {
    try { return await handleT4Request(req); } catch (error) {
      log.info(`[错误] ${error.message}`);
      return { error: "Server Error", message: error.message };
    }
  });

  server.get(`${apiPath}/proxy`, async (req, reply) => {
    try {
      log.info(`[代理路由] ${apiPath}/proxy 被调用`);
      const { url } = req.query;
      if (!url) return { error: 'url parameter is required' };
      return { url, status: 'proxied', headers: req.headers };
    } catch (error) {
      log.info(`[代理错误] ${error.message}`);
      return { error: error.message };
    }
  });

  server.post(`${apiPath}/batch`, async (req, reply) => {
    try {
      log.info(`[批量路由] ${apiPath}/batch 被调用`);
      const { urls } = req.body;
      if (!urls || !Array.isArray(urls)) return { error: 'urls array is required' };
      return { total: urls.length, matched: 0, results: [] };
    } catch (error) {
      log.info(`[批量错误] ${error.message}`);
      return { error: error.message };
    }
  });

  opt.sites.push({
    key: "zjyx_pansou",
    name: "📅 追剧优选【盘搜】 ",
    type: 4,
    api: apiPath,
    searchable: 1,
    quickSearch: 1,
    filterable: 1,
  });

  log.info(`✅ 追剧盘搜已加载 (TMDB: ${TMDB_API_KEY ? "已配置" : "未配置"}, 每网盘最多${MAX_LINES_PER_PAN}线路)`);
  log.info(`✅ PAN_ORDER 配置: ${PAN_ORDER.join(', ')}`);
};