import req from '../../util/req.js';
import CryptoJS from 'crypto-js';
import { getHomeCache, setHomeCache, buildHomeCacheKey, HOME_CACHE_TTL } from '../../util/home-cache.js';
import { withConcurrencyControl, buildRequestKey } from '../../util/concurrency-limiter.js';

// ==================== 站点配置 ====================
const aggConfig = {
    keys: 'd3dGiJc651gSQ8w1',
    charMap: {
        '+': 'P', '/': 'X', '0': 'M', '1': 'U', '2': 'l', '3': 'E', '4': 'r', '5': 'Y', '6': 'W', '7': 'b', '8': 'd', '9': 'J',
        'A': '9', 'B': 's', 'C': 'a', 'D': 'I', 'E': '0', 'F': 'o', 'G': 'y', 'H': '_', 'I': 'H', 'J': 'G', 'K': 'i', 'L': 't',
        'M': 'g', 'N': 'N', 'O': 'A', 'P': '8', 'Q': 'F', 'R': 'k', 'S': '3', 'T': 'h', 'U': 'f', 'V': 'R', 'W': 'q', 'X': 'C',
        'Y': '4', 'Z': 'p', 'a': 'm', 'b': 'B', 'c': 'O', 'd': 'u', 'e': 'c', 'f': '6', 'g': 'K', 'h': 'x', 'i': '5', 'j': 'T',
        'k': '-', 'l': '2', 'm': 'z', 'n': 'S', 'o': 'Z', 'p': '1', 'q': 'V', 'r': 'v', 's': 'j', 't': 'Q', 'u': '7', 'v': 'D',
        'w': 'w', 'x': 'n', 'y': 'L', 'z': 'e'
    },
    headers: {
        default: { 'User-Agent': 'okhttp/3.12.11', 'content-type': 'application/json; charset=utf-8' }
    },
    platform: {
        星芽: { host: 'https://app.whjzjx.cn', url1: '/cloud/v2/theater/home_page?theater_class_id', url2: '/v2/theater_parent/detail', search: '/v3/search', classes: '/cloud/v2/theater/classes', rankDetail: '/cloud/v1/first_level_ranking/detail', loginUrl: 'https://u.shytkjgs.com/user/v1/account/login' },
        西饭: { host: 'https://xifan-api-cn.youlishipin.com', url1: '/xifan/drama/portalPage', url2: '/xifan/drama/getDuanjuInfo', search: '/xifan/search/getSearchList' },
        七猫: { host: 'https://api-store.qmplaylet.com', url1: '/api/v1/playlet/index', url2: 'https://api-read.qmplaylet.com/player/api/v1/playlet/info', search: '/api/v1/playlet/search' },
        围观: { host: 'https://api.drama.9ddm.com', url1: '/drama/home/shortVideoTags', url2: '/drama/home/shortVideoDetail', search: '/drama/home/search' },
        河马: { host: 'https://www.kuaikaw.cn', search: '/seo/video/6007' }
    },
    platformList: [
        { name: '七猫短剧', id: '七猫' },
        { name: '星芽短剧', id: '星芽' },
        { name: '西饭短剧', id: '西饭' },
        { name: '围观短剧', id: '围观' },
        { name: '河马短剧', id: '河马' }
    ],
    search: { limit: 30, timeout: 6000 }
};

const ruleFilterDef = {
    星芽: { area: '1', class2: '0', rank: '1' },
    西饭: { area: '都市' },
    七猫: { area: '0' },
    围观: { area: '' },
    河马: { area: '462' }
};

const FILTER_OPTIONS = {
    七猫: [{
        key: 'area',
        name: '分类',
        value: [
            { n: '全部', v: '0' },
            { n: '男频', v: '1' },
            { n: '新剧', v: '3' },
            { n: '现代言情', v: '21' },
            { n: '神豪', v: '37' },
            { n: '萌宝', v: '356' },
            { n: '穿越', v: '373' },
            { n: '战神', v: '527' },
            { n: '神医', v: '1269' },
            { n: '古装', v: '1272' }
        ]
    }],
    星芽: [{
        key: 'area',
        name: '剧场',
        value: [
            { n: '剧场', v: '1' },
            { n: '热播短剧', v: '2' },
            { n: '会员专享', v: '8' },
            { n: '星选好剧', v: '7' },
            { n: '新剧', v: '3' },
            { n: '阳光剧场', v: '5' },
            { n: '排行榜', v: '9' }
        ]
    }, {
        key: 'class2',
        name: '类型',
        value: [
            { n: '全部', v: '0' },
            { n: '都市', v: '4' },
            { n: '逆袭', v: '7' },
            { n: '古装', v: '5' },
            { n: '亲情', v: '41' },
            { n: '现代言情', v: '15' },
            { n: '重生', v: '6' },
            { n: '虐恋', v: '8' },
            { n: '玄幻', v: '35' },
            { n: '穿越', v: '17' },
            { n: '脑洞', v: '32' },
            { n: '甜宠', v: '33' },
            { n: '古代言情', v: '37' },
            { n: '战神', v: '24' },
            { n: '历史', v: '40' },
            { n: '赘婿', v: '26' },
            { n: '萌宝', v: '9' },
            { n: '神医', v: '25' }
        ]
    }, {
        key: 'rank',
        name: '榜单',
        value: [
            { n: '实时热榜', v: '1' },
            { n: '热搜榜', v: '2' },
            { n: '新剧榜', v: '3' },
            { n: '剧单榜', v: '4' },
            { n: '口碑榜', v: '5' }
        ]
    }],
    西饭: [{
        key: 'area',
        name: '分类',
        value: [
            { n: '都市', v: '都市' },
            { n: '甜宠', v: '甜宠' },
            { n: '逆袭', v: '逆袭' },
            { n: '战神', v: '战神' },
            { n: '古装', v: '古装' },
            { n: '穿越', v: '穿越' },
            { n: '萌宝', v: '萌宝' }
        ]
    }],
    围观: [{
        key: 'area',
        name: '分类',
        value: [
            { n: '全部', v: '' },
            { n: '都市', v: '都市' },
            { n: '逆袭', v: '逆袭' },
            { n: '家庭', v: '家庭' },
            { n: '古装', v: '古装' },
            { n: '复仇', v: '复仇' },
            { n: '甜宠', v: '甜宠' },
            { n: '悬疑', v: '悬疑' },
            { n: '爱情', v: '爱情' },
            { n: '重生', v: '重生' },
            { n: '总裁', v: '总裁' },
            { n: '穿越', v: '穿越' },
            { n: '萌宝', v: '萌宝' },
            { n: '战神', v: '战神' },
            { n: '职场', v: '职场' },
            { n: '神豪', v: '神豪' },
            { n: '神医', v: '神医' },
            { n: '赘婿', v: '赘婿' }
        ]
    }],
    河马: [{
        key: 'area',
        name: '分类',
        value: [
            { n: '甜宠', v: '462' },
            { n: '古装仙侠', v: '1102' },
            { n: '现代言情', v: '1145' },
            { n: '青春', v: '1170' },
            { n: '豪门恩怨', v: '585' },
            { n: '逆袭', v: '417-464' },
            { n: '重生', v: '439-465' },
            { n: '系统', v: '1159' },
            { n: '总裁', v: '1147' },
            { n: '职场商战', v: '943' }
        ]
    }]
};


// 缓存对象
const cache = {
    filterOptions: null,
    qmHeader: { value: null, timestamp: 0 },
    xingyaToken: null,
    xingyaHeaders: aggConfig.headers.default,
    tokenKey: 'juhua_duanju_xingya_token',
    charMap: aggConfig.charMap
};

// ==================== 辅助函数 ====================
function normalizePage(page) {
    const parsed = Number.parseInt(page, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function makePagedResult(list, page, pagecount = 1, limit = list.length, total = list.length) {
    return {
        list,
        page,
        pagecount,
        limit,
        total
    };
}

function keywordMatched(name, wdLower) {
    return String(name || '').toLowerCase().includes(wdLower);
}

function stripHtml(text) {
    return String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function searchMatched(item, wdLower) {
    if (!wdLower) return true;
    const haystack = [
        item?.vod_name,
        item?.vod_remarks,
        item?.vod_tag,
        item?.vod_content
    ].map(stripHtml).filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(wdLower);
}

function safePushResult(target, seen, item, wdLower = '') {
    if (!item || !item.vod_id || !item.vod_name) return;
    const normalized = { ...item, vod_name: stripHtml(item.vod_name) };
    if (wdLower && !searchMatched(normalized, wdLower)) return;
    if (seen && seen.has(normalized.vod_id)) return;
    if (seen) seen.add(normalized.vod_id);
    target.push(normalized);
}

function buildSearchRemark(platform, episodeText = '', extra = '') {
    const parts = [platform];
    const ep = String(episodeText || '').trim();
    if (ep) parts.push(/集|期|完结|更新/.test(ep) ? ep : `${ep}集`);
    const suffix = String(extra || '').trim();
    return suffix ? `${parts.join('｜')} ${suffix}` : parts.join('｜');
}

function joinTags(tags) {
    if (Array.isArray(tags)) {
        return tags.map(tag => {
            if (!tag) return '';
            if (typeof tag === 'string') return tag;
            return tag.name || tag.title || tag.label || tag.text || '';
        }).filter(Boolean).join(' ');
    }
    return String(tags || '');
}

function base64Encode(text) {
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text));
}

function base64Decode(text) {
    return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text));
}

function parseNextData(html) {
    try {
        const match = String(html || '').match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        return match?.[1] ? JSON.parse(match[1]) : null;
    } catch (e) {
        return null;
    }
}

function normalizeHemaSearchBook(book) {
    if (!book?.bookId) return null;
    return {
        vod_id: `河马@/drama/${book.bookId}`,
        vod_name: book.bookName,
        vod_pic: book.coverWap,
        vod_remarks: buildSearchRemark('河马短剧', `${book.statusDesc || (book.status === 1 ? '完本' : '更新中') || ''} ${book.totalChapterNum || ''}集`.trim()),
        vod_tag: joinTags(book.bookTypeThree || book.tags || book.categoryName || book.categoryNames),
        vod_content: [book.introduction, book.desc, book.bookDesc, book.actor, book.actress].filter(Boolean).join(' ')
    };
}

function buildHemaTmpId() {
    return Math.random().toString(36).slice(2, 18);
}

function getHemaHeaders(referer = 'https://www.kuaikaw.cn') {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        Referer: referer,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    };
}

function getHemaApiHeaders(referer) {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        Referer: referer,
        Origin: 'https://www.kuaikaw.cn',
        'Content-Type': 'application/json',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        pname: 'www.kuaikaw.cn',
        tmpid: buildHemaTmpId()
    };
}

async function requestText(url, options = {}) {
    const { method = 'GET', headers = {}, body, timeout = 8000 } = options;
    const isPost = method.toUpperCase() === 'POST';
    const requestBody = body && typeof body === 'object' ? JSON.stringify(body) : body;
    try {
        const res = await req(url, {
            method,
            headers,
            data: isPost ? requestBody : null,
            timeout,
            responseType: 'text'
        });
        return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    } catch (e) {
        return '';
    }
}

function getFilterOptions() {
    if (!cache.filterOptions) {
        cache.filterOptions = FILTER_OPTIONS;
    }
    return cache.filterOptions;
}

async function request(url, options = {}) {
    const { method = 'GET', headers = {}, body, timeout = 5000 } = options;
    const isPost = method.toUpperCase() === 'POST';
    const requestBody = body && typeof body === 'object' ? JSON.stringify(body) : body;

    try {
        const res = await req(url, {
            method,
            headers: { ...aggConfig.headers.default, ...headers },
            data: isPost ? requestBody : null,
            timeout
        });
        return res.data;
    } catch (e) {
        return null;
    }
}

async function requestRaw(url, options = {}) {
    const { method = 'GET', headers = {}, body, timeout = 8000, maxRedirects = 5, validateStatus } = options;
    const isPost = method.toUpperCase() === 'POST';
    const requestBody = body && typeof body === 'object' ? JSON.stringify(body) : body;

    try {
        return await req(url, {
            method,
            headers: { ...aggConfig.headers.default, ...headers },
            data: isPost ? requestBody : null,
            timeout,
            maxRedirects,
            validateStatus: validateStatus || (status => status >= 200 && status < 400)
        });
    } catch (e) {
        return e?.response || null;
    }
}

async function resolveRedirectUrl(url, options = {}) {
    const res = await requestRaw(url, { ...options, maxRedirects: 0, validateStatus: status => status >= 200 && status < 400 });
    if (!res) return '';
    return res.headers?.location || res.request?.res?.responseUrl || res.config?.url || url;
}

async function md5(str) {
    return CryptoJS.MD5(str).toString(CryptoJS.enc.Hex).toLowerCase();
}

async function getQmParamsAndSign() {
    const now = Date.now();
    // 缓存5分钟
    if (cache.qmHeader.value && now - cache.qmHeader.timestamp < 300000) {
        return cache.qmHeader.value;
    }
    
    const sessionId = now.toString();
    const data = {
        "static_score": "0.8",
        "uuid": "00000000-7fc7-08dc-0000-000000000000",
        "device-id": "20250220125449b9b8cac84c2dd3d035c9052a2572f7dd0122edde3cc42a70",
        "sourceuid": "aa7de295aad621a6",
        "refresh-type": "0",
        "model": "22021211RC",
        "client-id": "aa7de295aad621a6",
        "brand": "Redmi",
        "sys-ver": "12",
        "phone-level": "H",
        "wlb-uid": "aa7de295aad621a6",
        "session-id": sessionId
    };
    
    const jsonStr = JSON.stringify(data);
    const base64Str = base64Encode(unescape(encodeURIComponent(jsonStr)));
    let qmParams = '';
    
    // 使用字符映射表提高转换速度
    const charMap = cache.charMap;
    for (let i = 0; i < base64Str.length; i++) {
        qmParams += charMap[base64Str[i]] || base64Str[i];
    }
    
    const paramsStr = `AUTHORIZATION=app-version=10001application-id=com.duoduo.readchannel=unknownis-white=net-env=5platform=androidqm-params=${qmParams}reg=${aggConfig.keys}`;
    const sign = await md5(paramsStr);
    
    cache.qmHeader.value = { qmParams, sign };
    cache.qmHeader.timestamp = now;
    return cache.qmHeader.value;
}

async function getHeaderX() {
    const { qmParams, sign } = await getQmParamsAndSign();
    return {
        'net-env': '5',
        'reg': '',
        'channel': 'unknown',
        'is-white': '',
        'platform': 'android',
        'application-id': 'com.duoduo.read',
        'authorization': '',
        'app-version': '10001',
        'user-agent': 'webviewversion/0',
        'qm-params': qmParams,
        'sign': sign
    };
}

function getXingyaHeaders() {
    if (cache.xingyaHeaders.authorization) {
        return cache.xingyaHeaders;
    }
    return aggConfig.headers.default;
}

async function ensureXingyaAuth(server) {
    if (cache.xingyaHeaders.authorization) return cache.xingyaHeaders;
    try {
        const tokenCache = server ? await server.db.getObjectDefault(cache.tokenKey, {}) : {};
        if (tokenCache.token) {
            cache.xingyaHeaders = { ...aggConfig.headers.default, authorization: tokenCache.token };
            cache.xingyaToken = tokenCache.token;
            return cache.xingyaHeaders;
        }
    } catch (e) {}

    try {
        const res = await request(aggConfig.platform.星芽.loginUrl, {
            method: 'POST',
            headers: { 'User-Agent': 'okhttp/4.10.0', platform: '1', 'Content-Type': 'application/json' },
            body: { device: '24250683a3bdb3f118dff25ba4b1cba1a' },
            timeout: 10000
        });
        const token = res?.data?.token || res?.token;
        if (token) {
            cache.xingyaHeaders = { ...aggConfig.headers.default, authorization: token };
            cache.xingyaToken = token;
            if (server) await server.db.push(cache.tokenKey, { token });
        }
    } catch (e) {
        cache.xingyaHeaders = aggConfig.headers.default;
    }

    return cache.xingyaHeaders;
}

// ==================== 核心方法 ====================
async function init(inReq, _outResp) {
    ensureXingyaAuth(inReq.server).catch(() => {});
    return {};
}

async function home(_inReq, _outResp) {
    const cacheKey = buildHomeCacheKey('duanju', _inReq);
    const cached = getHomeCache(cacheKey);
    if (cached) return cached;

    const classes = aggConfig.platformList.map(p => ({ type_name: p.name, type_id: p.id }));
    const filters = {};
    const filterOptions = getFilterOptions();
    aggConfig.platformList.forEach(item => {
        const platformId = item.id;
        if (filterOptions[platformId]) {
            filters[platformId] = filterOptions[platformId];
        }
    });

    const result = { class: classes, filters };
    setHomeCache(cacheKey, result, HOME_CACHE_TTL.semiStatic);
    return result;
}

async function homeVod(_inReq, _outResp) {
    const platId = '七猫';
    const area = ruleFilterDef[platId]?.area || '';

    try {
        const plat = aggConfig.platform[platId];
        const sign = await md5(`operation=1playlet_privacy=1tag_id=${area}${aggConfig.keys}`);
        const url = `${plat.host}${plat.url1}?tag_id=${area}&playlet_privacy=1&operation=1&sign=${sign}`;
        const headerX = await getHeaderX();
        const res = await request(url, {
            headers: { ...headerX, ...aggConfig.headers.default },
            timeout: 3000
        });

        if (res?.data?.list) {
            const list = res.data.list.slice(0, 6).map(i => ({
                vod_id: `七猫@${encodeURIComponent(i.playlet_id)}`,
                vod_name: i.title,
                vod_pic: i.image_link,
                vod_remarks: `${i.total_episode_num}集`,
                vod_content: `七猫短剧 | ${i.total_episode_num}集`
            }));
            return { list };
        }
    } catch (e) {}

    return { list: [] };
}

async function category(inReq, _outResp) {
    const body = inReq.body || {};
    const tid = body.id;
    const pg = normalizePage(body.page);
    const extend = body.filters || {};
    const plat = aggConfig.platform[tid];
    const area = (extend?.area !== undefined ? extend.area : ruleFilterDef[tid]?.area) || '';
    const videos = [];

    if (!plat) return { list: videos, page: pg, pagecount: 1, limit: 0, total: 0 };

    try {
        if (tid === '七猫') {
            if (pg > 1) {
                return makePagedResult([], pg, 1, 0, 0);
            }
            const sign = await md5(`operation=1playlet_privacy=1tag_id=${area}${aggConfig.keys}`);
            const url = `${plat.host}${plat.url1}?tag_id=${area}&playlet_privacy=1&operation=1&sign=${sign}`;
            const headerX = await getHeaderX();
            const res = await request(url, { headers: { ...headerX, ...aggConfig.headers.default } });
            const list = res?.data?.list || [];
            list.forEach(i => videos.push({
                vod_id: `七猫@${encodeURIComponent(i.playlet_id)}`,
                vod_name: i.title,
                vod_pic: i.image_link,
                vod_remarks: `${i.total_episode_num}集`
            }));
            return makePagedResult(videos, pg, 1, list.length, list.length);
        }

        if (tid === '星芽') {
            const headers = await ensureXingyaAuth(inReq.server);
            if (area === '9') {
                const rank = extend?.rank || extend?.class2 || ruleFilterDef.星芽.rank || '1';
                if (pg > 1) {
                    return makePagedResult([], pg, 1, 0, 0);
                }
                const res = await request(`${plat.host}${plat.rankDetail}?id=${rank}`, { headers, timeout: 10000 });
                const list = res?.data?.list || [];
                list.forEach(item => {
                    const i = item.theater || item;
                    if (!i?.id) return;
                    videos.push({
                        vod_id: `星芽@${plat.host}${plat.url2}?theater_parent_id=${i.id}`,
                        vod_name: i.title,
                        vod_pic: i.cover_url,
                        vod_remarks: `${i.total || ''}集`
                    });
                });
                return makePagedResult(videos, pg, 1, list.length, list.length);
            }
            const class2 = extend?.class2 || ruleFilterDef.星芽.class2 || '0';
            const url = `${plat.host}${plat.url1}=${area}&type=1&class2_ids=${class2}&page_num=${pg}&page_size=24`;
            const res = await request(url, { headers, timeout: 10000 });
            const data = res?.data || {};
            const list = data?.list || [];
            list.forEach(i => {
                const item = i.theater || i;
                if (!item?.id) return;
                videos.push({
                    vod_id: `星芽@${plat.host}${plat.url2}?theater_parent_id=${item.id}`,
                    vod_name: item.title,
                    vod_pic: item.cover_url,
                    vod_remarks: `${item.total || ''}集`
                });
            });
            const total = Number(data?.total) || list.length;
            const isSinglePage = !list.length || data?.is_end === true || total <= list.length || list.length > 24;
            if (isSinglePage) {
                return makePagedResult(pg > 1 ? [] : videos, pg, 1, pg > 1 ? 0 : list.length, total);
            }
            const pagecount = Math.max(1, Math.ceil(total / 24));
            return makePagedResult(videos, pg, pagecount, 24, total);
        }

        if (tid === '西饭') {
            const typeName = area;
            if (pg > 1) {
                return makePagedResult([], pg, 1, 0, 0);
            }
            const searchUrl = `${plat.host}${plat.search}?reqType=search&offset=0&keyword=${encodeURIComponent(typeName || '')}&quickEngineVersion=-1&scene=`;
            const searchRes = await request(searchUrl, { timeout: 10000 });
            const elements = searchRes?.result?.elements || [];
            for (const block of elements) {
                const contents = Array.isArray(block?.contents) ? block.contents : [];
                for (const item of contents) {
                    const dj = item?.duanjuVo || {};
                    if (!dj.duanjuId) continue;
                    const categories = Array.isArray(dj.categories) ? dj.categories : [];
                    if (typeName && !categories.includes(typeName)) continue;
                    videos.push({
                        vod_id: `西饭@${dj.duanjuId}#${dj.source}`,
                        vod_name: dj.title,
                        vod_pic: dj.coverImageUrl,
                        vod_remarks: `${dj.total || ''}集`
                    });
                }
            }
            return makePagedResult(videos, pg, 1, videos.length, videos.length);
        }

        if (tid === '围观') {
            const deviceName = 'Pixel 8 Pro';
            const deviceFirm = 'Google';
            const clientInfo = await md5(String(Date.now()).slice(-10));
            const url = `${plat.host}${plat.search}?version_code=1500&version_name=1.5.0&device_name=${encodeURIComponent(deviceName)}&device_type=phone&is_first_day=true&is_first_24h=true&app_launch_way=icon&default_homepage=homepage_interaction&device_owning_firm=${encodeURIComponent(deviceFirm)}&font_scale=default&os_type=1&clientInfo=${clientInfo}`;
            const res = await request(url, {
                method: 'POST',
                headers: { 'User-Agent': 'okhttp/5.1.0', 'Content-Type': 'application/json; charset=utf-8' },
                body: { audience: '全部', order: '最新', page: pg, pageSize: 30, searchWord: '', subject: area || '' },
                timeout: 10000
            });
            const list = res?.data || [];
            list.forEach(i => videos.push({
                vod_id: `围观@${i.oneId}`,
                vod_name: i.title,
                vod_pic: i.horzPoster || i.vertPoster,
                vod_remarks: `${i.episodeCount || ''}集`
            }));
            return makePagedResult(videos, pg, list.length < 30 ? pg : pg + 1, 30, (pg - 1) * 30 + list.length);
        }

        if (tid === '河马') {
            const url = `${plat.host}/browse/${area || ruleFilterDef.河马.area}/${pg}`;
            const html = await requestText(url, { headers: getHemaHeaders(url), timeout: 10000 });
            const json = parseNextData(html);
            const pageProps = json?.props?.pageProps || {};
            const bookList = pageProps.bookList || [];
            for (const book of bookList) {
                if (!book?.bookId) continue;
                videos.push({
                    vod_id: `河马@/drama/${book.bookId}`,
                    vod_name: book.bookName,
                    vod_pic: book.coverWap,
                    vod_remarks: `${book.statusDesc || ''} ${book.totalChapterNum || ''}集`.trim()
                });
            }
            return makePagedResult(videos, pg, Number(pageProps.pages) || pg, bookList.length, (Number(pageProps.pages) || pg) * bookList.length);
        }
    } catch (e) {}

    return { list: videos, page: pg, pagecount: 1, limit: videos.length, total: videos.length };
}

async function detail(inReq, _outResp) {
    const rawIds = inReq.body?.id;
    const ids = (!Array.isArray(rawIds) ? [rawIds] : rawIds).filter(Boolean);
    const videoPromises = ids.map(async (id) => {
        const requestKey = buildRequestKey('detail', { id });
        return withConcurrencyControl(
            'juhua_duanju',
            'detail',
            requestKey,
            async () => {
                const [platId, ...rest] = id.split('@');
                const did = rest.join('@');
                const plat = aggConfig.platform[platId];
        
        if (!plat) {
            return { vod_id: id, vod_name: '平台不支持', vod_play_url: '' };
        }
        
        let vod = { 
            vod_id: id, 
            vod_name: '未知', 
            vod_pic: '', 
            vod_remarks: '', 
            vod_content: '', 
            vod_play_from: '', 
            vod_play_url: '' 
        };
        
        try {
            if (platId === '七猫') {
                const didDecoded = decodeURIComponent(did);
                const sign = await md5(`playlet_id=${didDecoded}${aggConfig.keys}`);
                const url = `${plat.url2}?playlet_id=${didDecoded}&sign=${sign}`;
                const headerX = await getHeaderX();
                const res = await request(url, { headers: { ...headerX, ...aggConfig.headers.default } });
                if (res?.data) {
                    const d = res.data;
                    vod = {
                        ...vod,
                        vod_name: d.title,
                        vod_pic: d.image_link,
                        vod_remarks: `${d.total_episode_num}集`,
                        vod_content: d.intro,
                        vod_play_from: '七猫短剧',
                        vod_play_url: (d.play_list || []).map(i => `${i.sort}$${i.video_url}`).join('#')
                    };
                }
            } else if (platId === '星芽') {
                const headers = await ensureXingyaAuth(inReq.server);
                const res = await request(did, { headers, timeout: 10000 });
                if (res?.data) {
                    const d = res.data;
                    const u = (d.theaters || []).map(i => `${i.num}$${i.son_video_url}`).join('#');
                    vod = {
                        ...vod,
                        vod_name: d.title,
                        vod_pic: d.cover_url,
                        vod_remarks: d.desc_tags + '',
                        vod_play_from: '星芽短剧',
                        vod_play_url: u
                    };
                }
            } else if (platId === '西饭') {
                const [duanjuId, source] = did.split('#');
                const url = `${plat.host}${plat.url2}?duanjuId=${duanjuId}&source=${source}`;
                const res = await request(url);
                if (res?.result) {
                    const d = res.result;
                    const u = (d.episodeList || []).map(e => `${e.index}$${e.playUrl}`).join('#');
                    vod = {
                        ...vod,
                        vod_name: d.title,
                        vod_pic: d.coverImageUrl,
                        vod_remarks: d.updateStatus === 'over' ? `${d.total}集 已完结` : `更新${d.total}集`,
                        vod_play_from: '西饭短剧',
                        vod_play_url: u
                    };
                }
            } else if (platId === '围观') {
                const deviceName = 'Pixel 8 Pro';
                const deviceFirm = 'Google';
                const clientInfo = await md5(String(Date.now()).slice(-10));
                const url = `${plat.host}${plat.url2}?version_code=1500&version_name=1.5.0&device_name=${encodeURIComponent(deviceName)}&device_type=phone&is_first_day=true&is_first_24h=true&app_launch_way=icon&default_homepage=homepage_interaction&device_owning_firm=${encodeURIComponent(deviceFirm)}&font_scale=default&os_type=1&clientInfo=${clientInfo}&oneId=${did}&page=1&pageSize=1000&userId=0&queryAll=true`;
                const res = await request(url, {
                    headers: { 'User-Agent': 'okhttp/5.1.0', 'Content-Type': 'application/json; charset=utf-8' },
                    timeout: 10000
                });
                if (res?.data?.length) {
                    const episodes = res.data;
                    vod = {
                        ...vod,
                        vod_name: res.title || episodes[0]?.title || vod.vod_name,
                        vod_pic: res.vertPoster || episodes[0]?.vertPoster || '',
                        vod_remarks: `共${episodes.length}集`,
                        vod_content: res.description || '',
                        vod_play_from: '围观短剧',
                        vod_play_url: episodes.map(e => `${e.playOrder || e.title}$${base64Encode(JSON.stringify(e.videoClarityList || []))}`).join('#')
                    };
                }
            } else if (platId === '河马') {
                const didPath = did.startsWith('/drama/') ? did : `/drama/${did}`;
                const html = await requestText(`${plat.host}${didPath}`, { headers: getHemaHeaders(`${plat.host}${didPath}`), timeout: 10000 });
                const json = parseNextData(html);
                const pageProps = json?.props?.pageProps || {};
                const bookInfo = pageProps.bookInfoVo || {};
                const chapterList = pageProps.chapterList || [];
                vod = {
                    ...vod,
                    vod_name: bookInfo.title || bookInfo.bookName || vod.vod_name,
                    vod_pic: bookInfo.coverWap || '',
                    vod_remarks: `${bookInfo.statusDesc || ''} ${bookInfo.totalChapterNum || ''}集`.trim(),
                    vod_content: bookInfo.introduction || '',
                    vod_play_from: '河马短剧',
                    vod_play_url: chapterList.map(chapter => {
                        const chapterId = chapter.chapterId;
                        const chapterName = chapter.chapterName;
                        const videoVo = chapter.chapterVideoVo || {};
                        const directUrl = videoVo.mp4 || videoVo.mp4720p || videoVo.vodMp4Url;
                        return `${chapterName}$${directUrl && /\.(mp4|m3u8)/.test(directUrl) ? directUrl : `${didPath.replace('/drama/', '')}+${chapterId}`}`;
                    }).join('#')
                };
            }
        } catch (e) {
            vod.vod_name = '加载失败';
        }

        return vod;
            },
            { timeout: 30000 }
        );
    });

    const videos = await Promise.all(videoPromises);
    return { list: videos };
}

async function play(inReq, _outResp) {
    const flag = inReq.body?.flag || '';
    const id = inReq.body?.id;
    
    if (/七猫/.test(flag)) {
        return { parse: 0, url: id };
    }

    if (/西饭/.test(flag)) {
        const finalUrl = await resolveRedirectUrl(id, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        return { parse: 0, url: finalUrl || id };
    }

    if (/围观/.test(flag)) {
        try {
            const ps = JSON.parse(base64Decode(id));
            const urls = [];
            for (const item of ps || []) {
                if (item?.name && item?.url) {
                    urls.push(item.name, item.url);
                }
            }
            return { parse: 0, url: urls.length ? urls : id, headers: { 'User-Agent': 'okhttp/5.1.0' } };
        } catch (e) {
            return { parse: 0, url: id };
        }
    }

    if (/河马/.test(flag)) {
        if (/\.(mp4|m3u8)(\?|$)/i.test(id)) {
            return { parse: 0, url: id, header: getHemaHeaders() };
        }
        const parts = String(id || '').split('+');
        if (parts.length >= 2) {
            const [dramaId, chapterId] = parts;
            const episodeUrl = `${aggConfig.platform.河马.host}/episode/${dramaId}/${chapterId}`;
            const html = await requestText(episodeUrl, { headers: getHemaHeaders(episodeUrl), timeout: 10000 });
            const json = parseNextData(html);
            const videoInfo = json?.props?.pageProps?.chapterInfo?.chapterVideoVo || {};
            const videoUrl = videoInfo.mp4 || videoInfo.mp4720p || videoInfo.vodMp4Url || (String(html).match(/(https?:\/\/[^"']+\.mp4[^"']*)/) || [])[1] || '';
            return { parse: 0, url: videoUrl, header: getHemaHeaders() };
        }
        return { parse: 0, url: id, header: getHemaHeaders() };
    }

    return { parse: 0, url: id };
}

async function search(inReq, _outResp) {
    const wd = (inReq.body?.wd || '').trim();
    const pg = normalizePage(inReq.body?.page);
    if (!wd) return { list: [], page: pg, pagecount: 1, limit: 0, total: 0 };

    const requestKey = buildRequestKey('search', { wd, page: pg });
    return withConcurrencyControl(
      'juhua_duanju',
      'search',
      requestKey,
      async () => {
        const videos = [];
        const seen = new Set();
        const wdLower = wd.toLowerCase();

        // 并行搜索所有平台
        const searchPromises = [];
    
    // 七猫搜索
    searchPromises.push((async () => {
        try {
            const sign = await md5(`page=${pg}wd=${wd}${aggConfig.keys}`);
            const url = `${aggConfig.platform.七猫.host}${aggConfig.platform.七猫.search}?page=${pg}&wd=${encodeURIComponent(wd)}&sign=${sign}`;
            const headerX = await getHeaderX();
            const res = await request(url, {
                headers: { ...headerX, ...aggConfig.headers.default },
                timeout: aggConfig.search.timeout
            });
            (res?.data?.list || []).forEach(i => {
                safePushResult(videos, seen, {
                    vod_id: `七猫@${encodeURIComponent(i.id || i.playlet_id)}`,
                    vod_name: i.title,
                    vod_pic: i.image_link,
                    vod_remarks: buildSearchRemark('七猫短剧', i.total_num || i.total_episode_num || '', i.hot_value || ''),
                    vod_tag: joinTags(i.sub_title || i.tags || i.tag_name || i.category_name),
                    vod_content: [i.sub_title, i.actor].filter(Boolean).join(' ')
                }, wdLower);
            });
        } catch (e) {}
    })());
    
    // 其他平台搜索
    const platforms = ['星芽', '西饭', '围观', '河马'];
    
    for (const tid of platforms) {
        searchPromises.push((async () => {
            const plat = aggConfig.platform[tid];
            try {
                let res, data;
                if (tid === '星芽') {
                    const headers = await ensureXingyaAuth(inReq.server);
                    res = await request(plat.host + plat.search, { method: 'POST', headers, body: { text: wd }, timeout: 10000 });
                    data = (res?.data?.theater?.search_data || []).map(i => {
                        const itemTags = joinTags(i.classes || i.tags || i.high_light);
                        return {
                            vod_id: `星芽@${plat.host}${plat.url2}?theater_parent_id=${i.id}`,
                            vod_name: i.title,
                            vod_pic: i.cover_url,
                            vod_remarks: buildSearchRemark('星芽短剧', i.total || i.current_num, i.play_amount_str || i.pv_str ? `播放:${i.play_amount_str || i.pv_str}` : ''),
                            vod_tag: itemTags,
                            vod_content: i.introduction || itemTags
                        };
                    });
                } else if (tid === '西饭') {
                    const url = `${plat.host}${plat.search}?reqType=search&offset=${(pg - 1) * 30}&keyword=${encodeURIComponent(wd)}&quickEngineVersion=-1&scene=`;
                    res = await request(url);
                    const elements = Array.isArray(res?.result?.elements) ? res.result.elements : [];
                    const contents = elements.flatMap(el => Array.isArray(el?.contents) ? el.contents : [el]);
                    data = contents.map(vod => {
                        const dj = vod?.duanjuVo || vod || {};
                        if (!dj.duanjuId || !dj.title) return null;
                        const tags = joinTags(dj.categories || dj.tags || dj.tag);
                        return {
                            vod_id: `西饭@${dj.duanjuId}#${dj.source || ''}`,
                            vod_name: dj.title,
                            vod_pic: dj.coverImageUrl,
                            vod_remarks: buildSearchRemark('西饭短剧', dj.total),
                            vod_tag: tags,
                            vod_content: dj.desc || tags
                        };
                    }).filter(Boolean);
                } else if (tid === '围观') {
                    const deviceName = 'Pixel 8 Pro';
                    const deviceFirm = 'Google';
                    const clientInfo = await md5(String(Date.now()).slice(-10));
                    res = await request(`${plat.host}${plat.search}?version_code=1500&version_name=1.5.0&device_name=${encodeURIComponent(deviceName)}&device_type=phone&is_first_day=true&is_first_24h=true&app_launch_way=icon&default_homepage=homepage_interaction&device_owning_firm=${encodeURIComponent(deviceFirm)}&font_scale=default&os_type=1&clientInfo=${clientInfo}`, {
                        method: 'POST',
                        headers: { 'User-Agent': 'okhttp/5.1.0', 'Content-Type': 'application/json; charset=utf-8' },
                        body: { audience: '', order: '', page: pg, pageSize: 30, keyword: wd, subject: '' },
                        timeout: 10000
                    });
                    data = (res?.data || []).map(i => ({
                        vod_id: `围观@${i.oneId}`,
                        vod_name: i.title,
                        vod_pic: i.horzPoster || i.vertPoster,
                        vod_remarks: buildSearchRemark('围观短剧', i.episodeCount || ''),
                        vod_tag: joinTags(i.shortPlayTag || i.channelName || i.category),
                        vod_content: i.description || ''
                    }));
                } else if (tid === '河马') {
                    res = await request(`${plat.host}${plat.search}`, {
                        method: 'POST',
                        headers: getHemaApiHeaders(`${plat.host}/search?searchValue=${encodeURIComponent(wd)}`),
                        body: { sourceType: 1, keyword: wd, index: pg },
                        timeout: 10000
                    });
                    const apiBookList = Array.isArray(res?.data?.bookList) ? res.data.bookList : [];
                    data = apiBookList.map(normalizeHemaSearchBook).filter(Boolean);
                }
                
                if (data) {
                    for (const v of data) {
                        safePushResult(videos, seen, v, wdLower);
                    }
                }
            } catch (e) {}
        })());
    }
    
    await Promise.all(searchPromises);

    return makePagedResult(videos, pg);
      },
      { timeout: 30000 }
    );
}

// ==================== 导出模块 ====================
export default {
    meta: {
        key: 'juhua_duanju',
        name: '短剧聚合',
        type: 3,
        version: '1.0.1'
    },
    api: async (fastify) => {
        fastify.post('/init', init);
        fastify.post('/home', home);
        fastify.post('/homeVod', homeVod);
        fastify.post('/category', category);
        fastify.post('/detail', detail);
        fastify.post('/play', play);
        fastify.post('/search', search);
    },
};
