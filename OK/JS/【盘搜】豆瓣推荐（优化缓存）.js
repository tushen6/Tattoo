/*
 * 🎾【盘搜】豆瓣推荐 - T4（不夜版）
 * 描述: 基于豆瓣和盘搜API的T4影视站点插件，支持网盘资源搜索、分组、线路解析和播放。
 * 
 * 🔥 主要功能:
 *    - 豆瓣影视推荐分类数据获取（电影/电视剧/综艺/热门榜单）
 *    - 盘搜关键词检索，链接有效性检测，按网盘类型分组展示
 *    - 多网盘线路优先级配置及显示数量限制
 *    - 详情页并发解析剧集线路，补充豆瓣剧集信息
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
const dayjs = require("dayjs");

// ===================== ⚠️ 重要配置参数 =====================
const MAX_LINES_PER_PAN = 3;                        // 每个网盘最多显示线路数
const MAX_RESOURCES_TO_PARSE = 6;                  // 每个网盘最多解析的资源数
const CONCURRENCY_LIMIT = 20;                       // 最大并发请求数
const PAN_ORDER = ['baidu','a189','quark'];  // 网盘优先级 其他：ali,uc,a123,a115,a139,pikpak,xunlei
const PANSOU_CONFIG = {
  baseURL: "",            // 盘搜地址
  checkURL: "*/api/v1/links/check"// 链接检查地址
};
// ===================== 搜索分组图片显示参数 =====================
const USE_TMDB_IMAGE = true;       // 是否优先使用TMDB图片信息，true=开启(使用TMDB海报)，false=关闭(显示默认网盘图片)
const TMDB_API_KEY = "";          // TMDB API Key，开启USE_TMDB_IMAGE后必填（获取TMDB图片和详情信息）

// ===================== 基础配置 =====================
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const DATA_SOURCES = {
  zjrl: "https://zjrl-1318856176.cos.accelerate.myqcloud.com",
  gist: "https://gist.githubusercontent.com/huangxd-/5ae61c105b417218b9e5bad7073d2f36/raw",
  tmdbImage: "https://image.tmdb.org/t/p/w500",
  tmdbApi: "https://api.themoviedb.org/3"
};

// 豆瓣 API 配置
const DOUBAN_HOST = "https://frodo.douban.com/api/v2";
const DOUBAN_API_KEY = "0ac44ae016490db2204ce0a042db2916";
const DOUBAN_UA = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36 MicroMessenger/7.0.9.501 NetType/WIFI MiniProgramEnv/Windows WindowsWechat";
const DOUBAN_REFERER = "https://servicewechat.com/wx2f9b06c1de1ccfca/84/page-frame.html";

// ===================== 日志 =====================
let log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`)
};

const init = async (server) => {
  if (log.init) return;
  if (server && server.log) {
    log.info = (...args) => server.log.info(args.join(' '));
    log.error = (...args) => server.log.error(args.join(' '));
    log.warn = (...args) => server.log.warn(args.join(' '));
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

const doubanHttp = axios.create({
  timeout: 15000,
  headers: { "User-Agent": DOUBAN_UA, "Referer": DOUBAN_REFERER }
});

// ===================== 缓存 =====================
const searchCache = new Map();          // 盘搜缓存
const doubanSearchCache = new Map();      // 豆瓣搜索缓存
const doubanDetailCache = new Map();      // 豆瓣详情缓存（新增）
const pansouResultCache = new Map();      // 网盘搜索结果缓存（新增）
const driveParseCache = new Map();        // 网盘驱动解析缓存（新增）
// 缓存配置
const CACHE_TTL = {
  douban: 24 * 60 * 60 * 1000,      // 豆瓣数据 1天
  pansou: 30 * 60 * 1000,           // 网盘搜索结果 30分钟
  drive: 60 * 60 * 1000,            // 网盘驱动解析 1小时
  search: 5 * 60 * 1000             // 搜索页缓存 5分钟
};

// ===================== 耗时日志工具 =====================
const logTiming = (step, startTime, extraInfo = '') => {
  const cost = Date.now() - startTime;
  log.info(`[⏱️ 耗时] ${step}: ${cost}ms ${extraInfo}`);
  return Date.now(); // 返回当前时间，用于链式计时
};

// ===================== TMDB 图片缓存 =====================
const tmdbCache = new Map();

// ===================== 从 TMDB 搜索影视信息获取封面 =====================
const fetchTMDBImage = async (title) => {
  if (!USE_TMDB_IMAGE || !TMDB_API_KEY || !title) return null;
  
  const cacheKey = `tmdb_search_${title}`;
  if (tmdbCache.has(cacheKey)) return tmdbCache.get(cacheKey);
  
  try {
    // 先尝试搜索电影
    let url = `${DATA_SOURCES.tmdbApi}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    let res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
    let results = res.data?.results;
    
    // 如果没找到电影，尝试搜索电视剧
    if (!results || results.length === 0) {
      url = `${DATA_SOURCES.tmdbApi}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
      res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
      results = res.data?.results;
    }
    
    if (results && results.length > 0) {
      const first = results[0];
      const posterPath = first.poster_path;
      if (posterPath) {
        const imageUrl = `${DATA_SOURCES.tmdbImage}${posterPath}`;
        tmdbCache.set(cacheKey, imageUrl);
        // 24小时后过期
        setTimeout(() => tmdbCache.delete(cacheKey), 24 * 60 * 60 * 1000);
        return imageUrl;
      }
    }
  } catch (e) {
    log.info(`[TMDB搜索] 获取封面失败: ${title}, 原因: ${e.message}`);
  }
  
  return null;
};
// ===================== 从 TMDB 搜索获取详细信息（带缓存） =====================
const fetchTMDBDetailWithCache = async (title) => {
  if (!TMDB_API_KEY || !title) return null;
  
  const cacheKey = `tmdb_detail_${title}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL.tmdb) {
    log.info(`[TMDB详情缓存] 命中: ${title}`);
    return { data: cached.data, fromCache: true };
  }
  
  try {
    // 先搜索TV
    let url = `${DATA_SOURCES.tmdbApi}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
    let res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
    let results = res.data?.results;
    
    // 如果没找到，搜索电影
    if (!results || results.length === 0) {
      url = `${DATA_SOURCES.tmdbApi}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=zh-CN&page=1`;
      res = await axios.get(url, { headers: { "User-Agent": UA }, timeout: 5000 });
      results = res.data?.results;
    }
    
    if (results && results.length > 0) {
      const first = results[0];
      // 获取详情
      const mediaType = first.media_type || (first.first_air_date ? 'tv' : 'movie');
      const detailUrl = `${DATA_SOURCES.tmdbApi}/${mediaType}/${first.id}?api_key=${TMDB_API_KEY}&language=zh-CN`;
      const detailRes = await axios.get(detailUrl, { headers: { "User-Agent": UA }, timeout: 5000 });
      const detail = detailRes.data;
      
      const data = {
        title: detail.name || detail.title || title,
        pic: detail.poster_path ? `${DATA_SOURCES.tmdbImage}${detail.poster_path}` : "",
        genres: (detail.genres || []).map(g => g.name).join('/'),
        year: (detail.first_air_date || detail.release_date || "").substring(0, 4),
        countries: (detail.origin_country || []).join('/'),
        rating: detail.vote_average ? { value: detail.vote_average } : null,
        intro: detail.overview || "",
        actors: (detail.credits?.cast || []).slice(0, 5).map(a => a.name).join('/'),
        directors: (detail.credits?.crew || []).filter(c => c.job === 'Director').slice(0, 3).map(c => c.name).join('/'),
        runtime: detail.runtime || detail.episode_run_time?.[0] || "",
        status: detail.status || ""
      };
      
      tmdbCache.set(cacheKey, { data, time: Date.now() });
      log.info(`[TMDB详情] 获取成功: ${title}`);
      return { data, fromCache: false };
    }
  } catch (e) {
    log.info(`[TMDB详情] 获取失败: ${title}, ${e.message}`);
  }
  
  return { data: null, fromCache: false };
};
// ===================== 豆瓣详情缓存获取 =====================
const getDoubanDetailWithCache = async (vid) => {
  const cacheKey = vid;
  const cached = doubanDetailCache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL.douban) {
    log.info(`[豆瓣缓存] 命中: ${vid}`);
    return { data: cached.data, fromCache: true };
  }
  
  const start = Date.now();
  let data = await requestDouban(`${DOUBAN_HOST}/movie/${vid}`);
  if (!data || data.code) data = await requestDouban(`${DOUBAN_HOST}/tv/${vid}`);
  
  if (data && !data.code) {
    doubanDetailCache.set(cacheKey, { data, time: Date.now() });
    logTiming('豆瓣API请求', start, `(缓存已更新)`);
    return { data, fromCache: false };
  }
  return { data: null, fromCache: false };
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

// ===================== 网盘映射 =====================
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
  baidu: "https://xget.xi-xu.me/gh/power721/alist-tvbox/raw/refs/heads/master/web-ui/public/baidu.jpg",
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

// ===================== 豆瓣 API 请求 =====================
const requestDouban = async (url, options = {}) => {
  try {
    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${separator}apikey=${DOUBAN_API_KEY}`;
    const res = await axios({
      method: options.method || 'GET',
      url: finalUrl,
      headers: {
        "User-Agent": DOUBAN_UA,
        "Referer": DOUBAN_REFERER,
        "Host": "frodo.douban.com",
        "Connection": "Keep-Alive",
        ...options.headers
      },
      data: options.data,
      timeout: 10000,
    });
    return res.data;
  } catch (e) {
    log.error(`豆瓣请求失败: ${url}, 原因: ${e.message}`);
    return null;
  }
};

// ===================== 豆瓣搜索获取封面 =====================
const fetchDoubanSearchImage = async (title) => {
  if (!title) return null;
  
  const cacheKey = `douban_search_${title}`;
  if (doubanSearchCache.has(cacheKey)) {
    return doubanSearchCache.get(cacheKey);
  }
  
  try {
    // 使用豆瓣搜索API查找影视信息
    const searchUrl = `${DOUBAN_HOST}/search/movie?count=1&q=${encodeURIComponent(title)}`;
    const data = await requestDouban(searchUrl);
    
    if (data && data.items && data.items.length > 0) {
      const item = data.items[0];
      let pic = "";
      if (item.cover && item.cover.image && item.cover.image.large) {
        pic = item.cover.image.large.url;
      } else if (item.pic) {
        pic = item.pic.large || item.pic.normal || "";
      }
      pic = pic.replace(/img\d\.doubanio\.com/g, "img1.doubanio.com");
      
      if (pic) {
        doubanSearchCache.set(cacheKey, pic);
        setTimeout(() => doubanSearchCache.delete(cacheKey), CACHE_TTL);
        return pic;
      }
    }
    
    // 如果没找到电影，尝试搜索电视剧
    const tvSearchUrl = `${DOUBAN_HOST}/search/tv?count=1&q=${encodeURIComponent(title)}`;
    const tvData = await requestDouban(tvSearchUrl);
    
    if (tvData && tvData.items && tvData.items.length > 0) {
      const item = tvData.items[0];
      let pic = "";
      if (item.cover && item.cover.image && item.cover.image.large) {
        pic = item.cover.image.large.url;
      } else if (item.pic) {
        pic = item.pic.large || item.pic.normal || "";
      }
      pic = pic.replace(/img\d\.doubanio\.com/g, "img1.doubanio.com");
      
      if (pic) {
        doubanSearchCache.set(cacheKey, pic);
        setTimeout(() => doubanSearchCache.delete(cacheKey), CACHE_TTL);
        return pic;
      }
    }
  } catch (e) {
    log.info(`[豆瓣搜索] 获取封面失败: ${title}, 原因: ${e.message}`);
  }
  
  return null;
};

// ===================== 盘搜核心函数 =====================
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

const getAllPanResults = async (wd) => {
  log.info(`[盘搜] 搜索所有网盘: ${wd}`);
  try {
    const cloudTypes = PAN_ORDER.map(key => panTypes[key]).filter(Boolean);
    if (cloudTypes.length === 0) return {};

    const res = await _http.post("/api/search", { kw: wd, cloud_types: cloudTypes });
    if (res.data.code !== 0) {
      log.info(`[盘搜] 搜索失败: ${res.data.message}`);
      return {};
    }

    const data = res.data.data;
    const allLinks = [];
    for (const key in data.merged_by_type || {}) {
      for (const row of data.merged_by_type[key] || []) allLinks.push(row.url);
    }
    const validLinksSet = await checkLinksValidity(allLinks);
    const results = {};

    for (const key in data.merged_by_type || {}) {
      const panKey = reversePanTypes[key];
      if (!panKey || !PAN_ORDER.includes(panKey)) continue;
      const validItems = (data.merged_by_type[key] || [])
        .filter(item => validLinksSet.has(item.url))
        .map(item => ({ url: item.url, name: item.note, datetime: item.datetime }));
      if (validItems.length > 0) results[panKey] = validItems;
    }

    const counts = Object.entries(results).map(([k, v]) => `${k}:${v.length}`).join(', ');
    log.info(`[盘搜] 搜索结果: ${counts}`);
    return results;
  } catch (error) {
    log.info(`[盘搜] 搜索异常: ${error.message}`);
    return {};
  }
};

const getEpisodesFromDrive = async (url, driveKey, drives) => {
  log.info(`[网盘驱动] 获取剧集: ${driveKey}, URL: ${url}`);
  const drive = drives.find(d => d.key === driveKey);
  if (!drive) {
    log.info(`[网盘驱动] 未找到驱动: ${driveKey}`);
    return null;
  }
  try {
    if (!drive.matchShare || !drive.matchShare(url)) {
      log.info(`[网盘驱动] 驱动不匹配: ${driveKey}`);
      return null;
    }
    const vod = await drive.getVod(url);
    if (!vod) {
      log.info(`[网盘驱动] 获取VOD失败: ${driveKey}`);
      return null;
    }
    let isValid = true;
    if (vod.vod_play_url) {
      const parts = vod.vod_play_url.split('#');
      if (parts.length === 1) {
        const [name, link] = parts[0].split('$');
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

// ===================== 搜索缓存时间更新 =====================
const _search = async (wd, page, drives) => {
  log.info(`[搜索] 关键词: ${wd}, 页码: ${page}`);
  const result = { list: [], page: parseInt(page), pagecount: 1, total: 0 };

  try {
    // 检查缓存（使用新的TTL）
    const cacheKey = `search_${wd}_${page}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL.search) {
      log.info(`[搜索缓存] 命中: ${wd}`);
      return cached.data;
    }

    const cloudTypes = PAN_ORDER.map(key => panTypes[key]).filter(Boolean);
    if (cloudTypes.length === 0) return result;

    const res = await _http.post("/api/search", { kw: wd, cloud_types: cloudTypes });
    const ret = res.data;
    if (ret.code !== 0) throw new Error(ret.message || "请求失败");

    const allLinks = [];
    for (const key in ret.data.merged_by_type || {}) {
      for (const row of ret.data.merged_by_type[key] || []) allLinks.push(row.url);
    }
    const validLinksSet = await checkLinksValidity(allLinks);

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

    for (const key in ret.data.merged_by_type || {}) {
      const driveKey = reversePanTypes[key];
      if (!driveKey || !PAN_ORDER.includes(driveKey) || !driveMap.has(driveKey)) continue;
      const driveData = driveMap.get(driveKey);
      const resources = (ret.data.merged_by_type[key] || []).filter((row) => validLinksSet.has(row.url));
      driveData.resourceCount += resources.length;
      for (const row of resources) {
        const dt = dayjs(row.datetime);
        if (!driveData.latestDate || dt.isAfter(driveData.latestDate)) driveData.latestDate = dt;
      }
      if (resources.length > 0) {
        const cacheKey = `${wd}_${driveKey}`;
        searchCache.set(cacheKey, {
          items: resources.map(item => ({ url: item.url, name: item.note, datetime: item.datetime })),
          expire: Date.now() + CACHE_TTL
        });
      }
    }

    // ===== 获取TMDB图片（如果开启）=====
    let tmdbPoster = null;
    if (USE_TMDB_IMAGE && TMDB_API_KEY) {
      tmdbPoster = await fetchTMDBImage(wd);
      if (tmdbPoster) {
        log.info(`[搜索] 获取到TMDB图片: ${tmdbPoster}`);
      }
    }

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
    
    // 更新缓存（带时间戳）
    searchCache.set(cacheKey, { data: result, time: Date.now() });
    log.info(`[搜索] 返回 ${result.list.length}/${result.total} 个网盘分组，使用TMDB图片: ${!!tmdbPoster}`);
  } catch (error) {
    log.info(`[搜索] 失败: ${error.message}`);
  }
  return result;
};

// ===================== 详情（支持豆瓣和TMDB双源，容错处理） =====================
const _detail = async (id, title, drives) => {
  const totalStart = Date.now();
  let vid = String(id).trim();
  log.info(`[详情] 开始处理: ${vid}, title: ${title || '无'}`);

  let doubanResult = null;
  let tmdbResult = null;
  let vodName = title;
  let isSearchEntry = vid.startsWith('drive_');
  let targetDriveKey = null;  // 新增：目标网盘驱动标识

  // ----- 解析ID -----
  if (isSearchEntry) {
    // 搜索分组入口：drive_网盘Key_关键词
    try {
      const parts = vid.split('_');
      if (parts.length >= 3) {
        targetDriveKey = parts[1];
        if (!PAN_ORDER.includes(targetDriveKey)) {
          log.warn(`[详情] 未知的网盘驱动: ${targetDriveKey}，将显示所有线路`);
          targetDriveKey = null;
        }
        vodName = decodeURIComponent(parts.slice(2).join('_'));
        log.info(`[详情] 搜索入口解析: driveKey=${targetDriveKey}, keyword=${vodName}`);
      } else {
        log.warn(`[详情] drive_id格式异常: ${vid}`);
      }
    } catch (e) {
      log.info(`[详情] 解析drive_id失败: ${vid}, ${e.message}`);
    }
  } else if (vid.includes('@')) {
    // 豆瓣分类入口新格式：豆瓣ID@base64标题
    const [realVid, encodedTitle] = vid.split('@');
    if (realVid && encodedTitle) {
      vid = realVid; // 真实豆瓣ID
      try {
        const decodedTitle = Buffer.from(encodedTitle, 'base64').toString('utf-8');
        if (decodedTitle) {
          vodName = decodedTitle;
          log.info(`[详情] 从id解析出标题: ${vodName}`);
        }
      } catch (e) {
        log.info(`[详情] base64解码失败: ${encodedTitle}`);
      }
    }
  }
  // 如果以上都不匹配，则保持原vid不变，vodName沿用传入的title或为空

  // ----- 数据获取 -----
  if (isSearchEntry) {
    log.info(`[详情] 搜索入口，使用TMDB数据源`);
    // 并行：TMDB详情 + 盘搜
    const [tmdbRes, pansouRes] = await Promise.all([
      fetchTMDBDetailWithCache(vodName),
      getPansouWithCache(vodName)
    ]);
    tmdbResult = tmdbRes;
    var pansouResult = pansouRes; // 注意：var 提升
    // ✅ 修复：使用可选链避免 tmdbResult 为 null 时报错
    if (!tmdbResult?.data) {
      log.warn(`[详情] TMDB获取失败或无数据，使用默认数据: ${vodName}`);
    }
  } else {
    // 豆瓣入口
    const doubanPromise = getDoubanDetailWithCache(vid);
    if (vodName) {
      // 已有标题（来自参数或base64解码），并行执行
      log.info(`[详情] 豆瓣入口，有title，并行执行: ${vodName}`);
      const [doubanRes, pansouRes] = await Promise.all([
        doubanPromise,
        getPansouWithCache(vodName)
      ]);
      doubanResult = doubanRes;
      var pansouResult = pansouRes;
    } else {
      // 无标题，串行执行（先豆瓣，再盘搜）
      log.info(`[详情] 豆瓣入口，无title，串行执行`);
      doubanResult = await doubanPromise;
      if (!doubanResult.data) {
        log.error(`[详情] 豆瓣未返回有效数据，尝试TMDB兜底`);
        const fallbackTitle = title || vid;
        tmdbResult = await fetchTMDBDetailWithCache(fallbackTitle);
        vodName = tmdbResult.data?.title || fallbackTitle;
        pansouResult = await getPansouWithCache(vodName);
      } else {
        vodName = doubanResult.data.title || "未知标题";
        pansouResult = await getPansouWithCache(vodName);
      }
    }
  }

  const t1 = logTiming('阶段1-数据获取', totalStart, 
    `豆瓣缓存:${doubanResult?.fromCache || false}, TMDB缓存:${tmdbResult?.fromCache || false}, 盘搜缓存:${pansouResult.fromCache}`);

  // ----- 合并数据源 -----
  const dbData = doubanResult?.data;
  const tmdbData = tmdbResult?.data;
  
  let vodPic = "";
  if (dbData?.cover?.image?.large?.url) {
    vodPic = dbData.cover.image.large.url;
  } else if (dbData?.pic?.large) {
    vodPic = dbData.pic.large;
  } else if (tmdbData?.pic) {
    vodPic = tmdbData.pic;
  }
  vodPic = vodPic.replace(/img\d\.doubanio\.com/g, "img1.doubanio.com");

  const directors = dbData?.directors?.map(d => d.name).join('/') 
    || tmdbData?.directors 
    || "";
  const actors = dbData?.actors?.map(a => a.name).join('/') 
    || tmdbData?.actors 
    || "";
  const genres = (dbData?.genres || []).join('/') 
    || tmdbData?.genres 
    || "";
  const countries = (dbData?.countries || []).join('/') 
    || tmdbData?.countries 
    || "";
  const year = dbData?.year 
    || tmdbData?.year 
    || "";
  const rating = dbData?.rating?.value 
    || tmdbData?.rating?.value;
  const remarks = rating ? `${Number(rating).toFixed(1)}分` : "暂无评分";
  const content = dbData?.intro 
    || dbData?.summary 
    || tmdbData?.intro 
    || tmdbData?.overview 
    || (vodName ? `《${vodName}》` : "暂无简介");

  // ----- 过滤盘搜结果（仅保留目标网盘） -----
  let panResults = pansouResult.data || {};
  if (targetDriveKey) {
    const filtered = {};
    if (panResults[targetDriveKey]) {
      filtered[targetDriveKey] = panResults[targetDriveKey];
    }
    panResults = filtered;
    log.info(`[详情] 已过滤网盘结果: 只保留 ${targetDriveKey}, 资源数: ${filtered[targetDriveKey]?.length || 0}`);
  }

  // ----- 并行解析网盘线路 -----
  const parseTasks = [];
  for (const panKey of PAN_ORDER) {
    const items = panResults[panKey];
    if (!items || items.length === 0) continue;
    
    const itemsToParse = items.slice(0, MAX_RESOURCES_TO_PARSE);
    
  for (let i = 0; i < itemsToParse.length; i++) {
    const item = itemsToParse[i];
    parseTasks.push(async () => {
      const start = Date.now();
      const result = await getDriveParseWithCache(item.url, panKey, drives);
      return { 
        result, 
        panKey, 
        item,
        index: i,                 // 保留原始顺序索引
        cost: Date.now() - start
      };
      });
    }
  }

  if (parseTasks.length === 0) {
    log.warn(`[详情] 无盘搜结果，返回基础信息: ${vodName}`);
    return {
      vod_id: vid,
      vod_name: vodName,
      vod_pic: vodPic || (isSearchEntry ? "" : ""),
      vod_type: genres,
      vod_year: year,
      vod_area: countries,
      vod_remarks: remarks,
      vod_actor: actors,
      vod_director: directors,
      vod_content: content,
      vod_play_from: "温馨提示",
      vod_play_url: `未找到网盘资源$https://www.douban.com`,
    };
  }

  const parseStart = Date.now();
  const parseResults = await runWithConcurrency(parseTasks, CONCURRENCY_LIMIT);
  const t2 = logTiming('阶段2-网盘解析', parseStart, 
    `共${parseTasks.length}个任务, 成功${parseResults.filter(r => r.result.data).length}个`);

  // ----- 组装播放线路 -----
  const playFromList = [];
  const playUrlList = [];
  
  for (const panKey of PAN_ORDER) {
    const panSuccessResults = parseResults
      .filter(r => r.panKey === panKey && r.result.data)
      .sort((a, b) => a.index - b.index)
      .slice(0, MAX_LINES_PER_PAN);
    
    for (let i = 0; i < panSuccessResults.length; i++) {
      const parseRes = panSuccessResults[i];
      const episodeData = parseRes.result.data;
      if (episodeData.playUrl) {
        const lineName = i === 0 ? (panNames[panKey] || panKey) : `${panNames[panKey] || panKey}#${i + 1}`;
        playFromList.push(lineName);
        playUrlList.push(episodeData.playUrl);
        log.info(`[线路] 已添加: ${lineName}, 耗时${parseRes.cost}ms`);
      }
    }
  }

  if (playFromList.length === 0) {
    playFromList.push("温馨提示");
    playUrlList.push("未找到有效播放资源$https://www.douban.com");
  }

  const result = {
    vod_id: vid,
    vod_name: vodName,
    vod_pic: vodPic,
    vod_type: genres,
    vod_year: year,
    vod_area: countries,
    vod_remarks: remarks,
    vod_actor: actors,
    vod_director: directors,
    vod_content: content,
    vod_play_from: playFromList.join('$$$'),
    vod_play_url: playUrlList.join('$$$')
  };

  logTiming('详情页总耗时', totalStart, 
    `线路数:${playFromList.length}, 数据源:${dbData ? '豆瓣' : (tmdbData ? 'TMDB' : '默认')}`);

  return result;
};

// ===================== 播放 =====================
const _play = async ({ flag, flags, id, drives }) => {
  log.info(`[播放] flag: ${flag}, id: ${id?.substring(0, 50)}`);

  let driveKey = flag;
  if (flag && flag.includes('#')) driveKey = flag.split('#')[0];

  const nameToKey = {
    '夸克网盘': 'quark', 'UC网盘': 'uc', '百度网盘': 'baidu',
    '阿里云盘': 'ali', 'PikPak': 'pikpak', '迅雷网盘': 'xunlei',
    '123云盘': 'a123', '天翼网盘': 'a189', '移动云盘': 'a139', '115网盘': 'a115'
  };
  if (nameToKey[driveKey]) driveKey = nameToKey[driveKey];

  const drive = drives.find(o => o.key === driveKey);
  if (drive) {
    try {
      const result = await drive.play(id, flag);

      // ======== 重命名 + 排序（保持原 url 数组格式）========
      if (result && Array.isArray(result.url)) {
        const renameMap = {
          RAW: '原画',
          '4k': '4K高清',
          '2k': '2K高清',
          super: '超清',
          high: '标清',
          low: '流畅',
        };

        // 目标顺序
        const order = [ '2K高清', '4K高清', '超清', '标清', '流畅', '原画'];
        const orderIndex = new Map(order.map((k, i) => [k, i]));

        // 将 ["RAW", "url1", "4k", "url2", ...] => [{q, u}, ...]
        const pairs = [];
        for (let i = 0; i < result.url.length; i += 2) {
          const q0 = result.url[i];
          const u0 = result.url[i + 1];
          if (typeof q0 !== 'string' || typeof u0 !== 'string') continue;

          const q = renameMap[q0] || q0; // 未命中的不改
          pairs.push({ q, u: u0 });
        }

        // 排序：按指定 order，未在 order 里的放最后且保持相对顺序
        const sorted = pairs
          .map((p, idx) => ({
            ...p,
            _idx: idx,
            _ord: orderIndex.has(p.q) ? orderIndex.get(p.q) : 999,
          }))
          .sort((a, b) => (a._ord - b._ord) || (a._idx - b._idx));

        // 再还原为原格式数组
        result.url = sorted.flatMap(p => [p.q, p.u]);
      }
      // ======== 这里结束 ========

      return result;
    } catch (error) {
      log.info(`[播放] 驱动播放失败: ${error.message}`);
      return { error: `播放失败: ${error.message}` };
    }
  }

  for (const key of PAN_ORDER) {
    const d = drives.find(o => o.key === key);
    if (!d || !d.matchShare) continue;
    try {
      if (d.matchShare(id)) {
        const result = await d.play(id, flag);
        return result;
      }
    } catch (error) {
      log.info(`[播放] 驱动 ${d.key} 播放失败: ${error.message}`);
    }
  }

  return { error: "未找到对应的网盘驱动", flag, id };
};


// ===================== 分类列表（豆瓣API） =====================
const filterConfig = {
  "movie": [
    { "key": "类型", "name": "类型", "init": "", "value": [{ "n": "全部类型", "v": "" }, { "n": "喜剧", "v": "喜剧" }, { "n": "爱情", "v": "爱情" }, { "n": "动作", "v": "动作" }, { "n": "科幻", "v": "科幻" }, { "n": "动画", "v": "动画" }, { "n": "悬疑", "v": "悬疑" }, { "n": "犯罪", "v": "犯罪" }, { "n": "惊悚", "v": "惊悚" }, { "n": "冒险", "v": "冒险" }, { "n": "音乐", "v": "音乐" }, { "n": "历史", "v": "历史" }, { "n": "奇幻", "v": "奇幻" }, { "n": "恐怖", "v": "恐怖" }, { "n": "战争", "v": "战争" }, { "n": "传记", "v": "传记" }, { "n": "歌舞", "v": "歌舞" }, { "n": "武侠", "v": "武侠" }, { "n": "情色", "v": "情色" }, { "n": "灾难", "v": "灾难" }, { "n": "西部", "v": "西部" }, { "n": "纪录片", "v": "纪录片" }, { "n": "短片", "v": "短片" }] },
    { "key": "地区", "name": "地区", "init": "", "value": [{ "n": "全部地区", "v": "" }, { "n": "华语", "v": "华语" }, { "n": "欧美", "v": "欧美" }, { "n": "韩国", "v": "韩国" }, { "n": "日本", "v": "日本" }, { "n": "中国大陆", "v": "中国大陆" }, { "n": "美国", "v": "美国" }, { "n": "中国香港", "v": "中国香港" }, { "n": "中国台湾", "v": "中国台湾" }, { "n": "英国", "v": "英国" }, { "n": "法国", "v": "法国" }, { "n": "德国", "v": "德国" }, { "n": "意大利", "v": "意大利" }, { "n": "西班牙", "v": "西班牙" }, { "n": "印度", "v": "印度" }, { "n": "泰国", "v": "泰国" }, { "n": "俄罗斯", "v": "俄罗斯" }, { "n": "加拿大", "v": "加拿大" }, { "n": "澳大利亚", "v": "澳大利亚" }, { "n": "爱尔兰", "v": "爱尔兰" }, { "n": "瑞典", "v": "瑞典" }, { "n": "巴西", "v": "巴西" }, { "n": "丹麦", "v": "丹麦" }] },
    { "key": "年代", "name": "年代", "init": "", "value": [{ "n": "全部年代", "v": "" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2010年代", "v": "2010年代" }, { "n": "2000年代", "v": "2000年代" }, { "n": "90年代", "v": "90年代" }, { "n": "80年代", "v": "80年代" }, { "n": "70年代", "v": "70年代" }, { "n": "60年代", "v": "60年代" }, { "n": "更早", "v": "更早" }] },
    { "key": "sort", "name": "排序", "init": "U", "value": [{ "n": "近期热度", "v": "U" },{ "n": "综合排序", "v": "T" },  { "n": "首映时间", "v": "R" }, { "n": "高分优先", "v": "S" }] }
  ],
  "tv": [
    { "key": "形式", "name": "形式", "init": "", "value": [{ "n": "全部类型", "v": "" }, { "n": "喜剧", "v": "喜剧" }, { "n": "爱情", "v": "爱情" }, { "n": "悬疑", "v": "悬疑" }, { "n": "动画", "v": "动画" }, { "n": "武侠", "v": "武侠" }, { "n": "古装", "v": "古装" }, { "n": "家庭", "v": "家庭" }, { "n": "犯罪", "v": "犯罪" }, { "n": "科幻", "v": "科幻" }, { "n": "恐怖", "v": "恐怖" }, { "n": "历史", "v": "历史" }, { "n": "战争", "v": "战争" }, { "n": "动作", "v": "动作" }, { "n": "冒险", "v": "冒险" }, { "n": "传记", "v": "传记" }, { "n": "剧情", "v": "剧情" }, { "n": "奇幻", "v": "奇幻" }, { "n": "惊悚", "v": "惊悚" }, { "n": "灾难", "v": "灾难" }, { "n": "歌舞", "v": "歌舞" }, { "n": "音乐", "v": "音乐" }] },
    { "key": "地区", "name": "地区", "init": "", "value": [{ "n": "全部地区", "v": "" }, { "n": "华语", "v": "华语" }, { "n": "欧美", "v": "欧美" }, { "n": "国外", "v": "国外" }, { "n": "韩国", "v": "韩国" }, { "n": "日本", "v": "日本" }, { "n": "中国大陆", "v": "中国大陆" }, { "n": "中国香港", "v": "中国香港" }, { "n": "美国", "v": "美国" }, { "n": "英国", "v": "英国" }, { "n": "泰国", "v": "泰国" }, { "n": "中国台湾", "v": "中国台湾" }, { "n": "意大利", "v": "意大利" }, { "n": "法国", "v": "法国" }, { "n": "德国", "v": "德国" }, { "n": "西班牙", "v": "西班牙" }, { "n": "俄罗斯", "v": "俄罗斯" }, { "n": "瑞典", "v": "瑞典" }, { "n": "巴西", "v": "巴西" }, { "n": "丹麦", "v": "丹麦" }, { "n": "印度", "v": "印度" }, { "n": "加拿大", "v": "加拿大" }, { "n": "爱尔兰", "v": "爱尔兰" }, { "n": "澳大利亚", "v": "澳大利亚" }] },
    { "key": "年代", "name": "年代", "init": "", "value": [{ "n": "全部年代", "v": "" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2010年代", "v": "2010年代" }, { "n": "2000年代", "v": "2000年代" }, { "n": "90年代", "v": "90年代" }, { "n": "80年代", "v": "80年代" }, { "n": "70年代", "v": "70年代" }, { "n": "60年代", "v": "60年代" }, { "n": "更早", "v": "更早" }] },
    { "key": "平台", "name": "平台", "init": "", "value": [{ "n": "全部平台", "v": "" }, { "n": "腾讯视频", "v": "腾讯视频" }, { "n": "爱奇艺", "v": "爱奇艺" }, { "n": "优酷", "v": "优酷" }, { "n": "湖南卫视", "v": "湖南卫视" }, { "n": "Netflix", "v": "Netflix" }, { "n": "HBO", "v": "HBO" }, { "n": "BBC", "v": "BBC" }, { "n": "NHK", "v": "NHK" }, { "n": "CBS", "v": "CBS" }, { "n": "NBC", "v": "NBC" }, { "n": "tvN", "v": "tvN" }] },
    { "key": "sort", "name": "排序", "init": "U", "value": [{ "n": "近期热度", "v": "U" },{ "n": "综合排序", "v": "T" },  { "n": "首播时间", "v": "R" }, { "n": "高分优先", "v": "S" }] }
  ],
  "tvshow": [
    { "key": "形式", "name": "形式", "init": "", "value": [{ "n": "全部类型", "v": "" }, { "n": "真人秀", "v": "真人秀" }, { "n": "脱口秀", "v": "脱口秀" }, { "n": "音乐", "v": "音乐" }, { "n": "歌舞", "v": "歌舞" }] },
    { "key": "地区", "name": "地区", "init": "", "value": [{ "n": "全部地区", "v": "" }, { "n": "华语", "v": "华语" }, { "n": "欧美", "v": "欧美" }, { "n": "国外", "v": "国外" }, { "n": "韩国", "v": "韩国" }, { "n": "日本", "v": "日本" }, { "n": "中国大陆", "v": "中国大陆" }, { "n": "中国香港", "v": "中国香港" }, { "n": "美国", "v": "美国" }, { "n": "英国", "v": "英国" }, { "n": "泰国", "v": "泰国" }, { "n": "中国台湾", "v": "中国台湾" }, { "n": "意大利", "v": "意大利" }, { "n": "法国", "v": "法国" }, { "n": "德国", "v": "德国" }, { "n": "西班牙", "v": "西班牙" }, { "n": "俄罗斯", "v": "俄罗斯" }, { "n": "瑞典", "v": "瑞典" }, { "n": "巴西", "v": "巴西" }, { "n": "丹麦", "v": "丹麦" }, { "n": "印度", "v": "印度" }, { "n": "加拿大", "v": "加拿大" }, { "n": "爱尔兰", "v": "爱尔兰" }, { "n": "澳大利亚", "v": "澳大利亚" }] },
    { "key": "年代", "name": "年代", "init": "", "value": [{ "n": "全部年代", "v": "" }, { "n": "2026", "v": "2026" }, { "n": "2025", "v": "2025" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2010年代", "v": "2010年代" }, { "n": "2000年代", "v": "2000年代" }, { "n": "90年代", "v": "90年代" }, { "n": "80年代", "v": "80年代" }, { "n": "70年代", "v": "70年代" }, { "n": "60年代", "v": "60年代" }, { "n": "更早", "v": "更早" }] },
    { "key": "平台", "name": "平台", "init": "", "value": [{ "n": "全部平台", "v": "" }, { "n": "腾讯视频", "v": "腾讯视频" }, { "n": "爱奇艺", "v": "爱奇艺" }, { "n": "优酷", "v": "优酷" }, { "n": "湖南卫视", "v": "湖南卫视" }, { "n": "Netflix", "v": "Netflix" }, { "n": "HBO", "v": "HBO" }, { "n": "BBC", "v": "BBC" }, { "n": "NHK", "v": "NHK" }, { "n": "CBS", "v": "CBS" }, { "n": "NBC", "v": "NBC" }, { "n": "tvN", "v": "tvN" }] },
    { "key": "sort", "name": "排序", "init": "U", "value": [{ "n": "近期热度", "v": "U" },{ "n": "综合排序", "v": "T" },  { "n": "首播时间", "v": "R" }, { "n": "高分优先", "v": "S" }] }
  ],
  "hot_movie": [{ "key": "slug", "name": "榜单", "init": "all", "value": [{ "n": "全部榜单", "v": "all" }, { "n": "实时热门电影", "v": "movie_real_time_hotest" }, { "n": "一周口碑电影榜", "v": "movie_weekly_best" }] }],
  "hot_tv": [{ "key": "slug", "name": "榜单", "init": "all", "value": [{ "n": "全部榜单", "v": "all" }, { "n": "实时热门电视", "v": "tv_real_time_hotest" }, { "n": "华语口碑剧集榜", "v": "tv_chinese_best_weekly" }, { "n": "全球口碑剧集榜", "v": "tv_global_best_weekly" }] }],
  "hot_tvshow": [{ "key": "slug", "name": "榜单", "init": "all", "value": [{ "n": "全部榜单", "v": "all" }, { "n": "国内口碑综艺榜", "v": "show_chinese_best_weekly" }, { "n": "国外口碑综艺榜", "v": "show_global_best_weekly" }] }],
  "top_250": [{ "key": "slug", "name": "榜单", "init": "movie_top250", "value": [{ "n": "豆瓣电影Top250", "v": "movie_top250" }] }]
};

const _category = async ({ id, page, filters }) => {
  let pg = parseInt(page);
  if (isNaN(pg) || pg < 1) pg = 1;
  const count = 20;
  const start = (pg - 1) * count;

  log.info(`[列表] 请求分类: ${id}, 页码: ${pg}`);

  let items = [];
  let total = 0;

  if (id === "hot_movie") {
    const slug = filters.slug || "all";
    if (slug === "all") {
      // 融合实时热门电影 + 一周口碑电影榜
      const slugs = ["movie_real_time_hotest", "movie_weekly_best"];
      for (const s of slugs) {
        const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${s}/items?start=${start}&count=${count}`);
        if (data) {
          const list = data.subject_collection_items || data.items || [];
          items = items.concat(list);
        }
      }
      total = items.length;
    } else {
      const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${slug}/items?start=${start}&count=${count}`);
      if (data) {
        items = data.subject_collection_items || data.items || [];
        total = data.total || (data.subject_collection ? data.subject_collection.total : 0) || 100;
      }
    }
  } else if (id === "hot_tv") {
    const slug = filters.slug || "all";
    if (slug === "all") {
      // 融合实时热门电视 + 华语口碑剧集榜 + 全球口碑剧集榜
      const slugs = ["tv_real_time_hotest", "tv_chinese_best_weekly", "tv_global_best_weekly"];
      for (const s of slugs) {
        const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${s}/items?start=${start}&count=${count}`);
        if (data) {
          const list = data.subject_collection_items || data.items || [];
          items = items.concat(list);
        }
      }
      total = items.length;
    } else {
      const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${slug}/items?start=${start}&count=${count}`);
      if (data) {
        items = data.subject_collection_items || data.items || [];
        total = data.total || (data.subject_collection ? data.subject_collection.total : 0) || 100;
      }
    }
  } else if (id === "hot_tvshow") {
    const slug = filters.slug || "all";
    if (slug === "all") {
      // 融合国内口碑综艺榜 + 国外口碑综艺榜
      const slugs = ["show_chinese_best_weekly", "show_global_best_weekly"];
      for (const s of slugs) {
        const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${s}/items?start=${start}&count=${count}`);
        if (data) {
          const list = data.subject_collection_items || data.items || [];
          items = items.concat(list);
        }
      }
      total = items.length;
    } else {
      const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/${slug}/items?start=${start}&count=${count}`);
      if (data) {
        items = data.subject_collection_items || data.items || [];
        total = data.total || (data.subject_collection ? data.subject_collection.total : 0) || 100;
      }
    }
  } else if (id === "top_250") {
    const data = await requestDouban(`${DOUBAN_HOST}/subject_collection/movie_top250/items?start=${start}&count=${count}`);
    if (data) {
      items = data.subject_collection_items || data.items || [];
      total = data.total || (data.subject_collection ? data.subject_collection.total : 0) || 250;
    }
  } else if (id === "tv") {
    const tags = [filters.形式, filters.地区, filters.年代, filters.平台,"电视剧"].filter(Boolean).join(",");
    const sort = filters.sort || "U";
    const data = await requestDouban(`${DOUBAN_HOST}/tv/recommend?tags=${encodeURIComponent(tags)}&sort=${sort}&start=${start}&count=${count}`);
    if (data && data.items) {
      items = data.items;
      total = data.total || 999;
    }
  } else if (id === "tvshow") {
    const tags = [filters.形式, filters.地区, filters.年代, filters.平台,"综艺"].filter(Boolean).join(",");
    const sort = filters.sort || "U";
    const data = await requestDouban(`${DOUBAN_HOST}/tv/recommend?tags=${encodeURIComponent(tags)}&sort=${sort}&start=${start}&count=${count}`);
    if (data && data.items) {
      items = data.items;
      total = data.total || 999;
    }
  } else if (id === "movie") {
    const area = filters.地区 || "华语";
    const tags = [filters.类型, area, filters.年代].filter(Boolean).join(",");
    const sort = filters.sort || "U";
    const data = await requestDouban(`${DOUBAN_HOST}/movie/recommend?tags=${encodeURIComponent(tags)}&sort=${sort}&start=${start}&count=${count}`);
    if (data && data.items) {
      items = data.items;
      total = data.total || 999;
    }
  }

  const list = items.map(it => {
    const rawId = it.id || (it.subject && it.subject.id);
    const title = it.title || (it.subject && it.subject.title) || "未知";
    if (!rawId) return null;
    const vid = String(rawId).trim();
    const ratingObj = it.rating || (it.subject && it.subject.rating);
    const picObj = it.cover || it.pic || (it.subject && it.subject.pic);
    let pic = picObj ? (picObj.url || picObj.normal || "") : "";
    // 修改：vod_id 格式为 豆瓣ID@base64标题
    const encodedTitle = Buffer.from(title).toString('base64');
    return {
      vod_id: `${vid}@${encodedTitle}`,
      vod_name: title,
      vod_pic: pic.replace(/img\d.doubanio.com/g, "img1.doubanio.com"),
      vod_remarks: `${(ratingObj?.value || 0).toFixed(1)}分`,
      vod_year: String(it.year || it.subject?.year || "")
    };
  }).filter(Boolean);

  log.info(`[列表] 下发 ${list.length} 条数据`);
  return {
    list,
    page: pg,
    pagecount: Math.ceil(total / count) || pg + 1,
    limit: count,
    total
  };
};

// ===================== T4协议处理 =====================
const decodeExt = (ext) => {
  if (!ext) return {};
  try {
    return JSON.parse(Buffer.from(ext, 'base64').toString('utf-8'));
  } catch (e) {
    try {
      return JSON.parse(ext);
    } catch (e2) {
      return {};
    }
  }
};

const handleT4Request = async (req) => {
  const { ids, id, wd, play, t, pg, ext } = req.query;
  const page = parseInt(pg) || 1;
  const drives = req.server?.drives || [];

  const detailId = (ids || id || "").toString().trim();
  if (detailId && detailId !== "undefined" && detailId !== "") {
    log.info(`[T4] 详情: ${detailId}`);
    const filters = decodeExt(ext);
    // 从filters中获取title，支持多种可能的字段名
    const title = filters.title || filters.wd || filters.name || filters.vod_name || "";
    log.info(`[T4] 详情ext解码: title=${title}, keys=${Object.keys(filters).join(',')}`);
    const detail = await _detail(detailId, title, drives);
    return { list: detail ? [detail] : [], page: 1, pagecount: 1 };
  }

  if (play) {
    log.info(`[T4] 播放: ${play}`);
    return await _play({ flag: req.query.flag || '', flags: [], id: play, drives });
  }

  if (wd) {
    log.info(`[T4] 搜索: ${wd}`);
    return await _search(wd, page, drives);
  }

  if (t) {
    log.info(`[T4] 分类: ${t}`);
    const filters = decodeExt(ext);
    return await _category({ id: t, page, filters });
  }

  return {
    class: [
      { type_id: "movie", type_name: "🎬 豆瓣电影" },
      { type_id: "tv", type_name: "📺 豆瓣剧集" },
      { type_id: "tvshow", type_name: "🎭 豆瓣综艺" },
      { type_id: "hot_movie", type_name: "📕 电影榜单" },
      { type_id: "hot_tv", type_name: "📙 剧集榜单" },
      { type_id: "hot_tvshow", type_name: "📒 综艺榜单" },
      { type_id: "top_250", type_name: "🏆 电影Top250" }
    ],
    filters: filterConfig
  };
};
// ===================== 模块导出 =====================
module.exports = async (server, opt) => {
  await init(server);

  const apiPath = "/video/dou2ban";

  server.get(apiPath, async (req, reply) => {
    try {
      log.info(`收到请求: ${req.url.substring(0, 100)}`);
      return await handleT4Request(req);
    } catch (error) {
      log.error(`插件出错: ${error.message}`);
      return { error: "Internal Server Error", message: error.message };
    }
  });

  opt.sites.push({
    key: "dou2ban",
    name: "🎾 豆瓣推荐【盘搜】",
    type: 4,
    api: apiPath,
    searchable: 1,
    quickSearch: 0,
    filterable: 1,
  });

  log.info(`✅ 豆瓣网盘版已加载 (豆瓣搜索封面)`);
};