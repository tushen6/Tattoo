import { Crypto, _ } from 'assets://js/lib/cat.js';

let host = '';
let hkey = '';
let playerinfos = [];
let keys = ['rectangleadsadxa', '1e765e9b09b4dbba','aassddwwxxllsx1x'];
let cachedPlayUrls = {};

let headers = {
    'User-Agent': 'Dalvik/1.4.0 (Linux; U; Android 11; Redmi Build/M2012K10C)',
    'ua': '32e21d0ba2c2aa62770e4cfcafafa71d2IQCVRtk1x1UUDDV4b88e518aed7381a76eaf39811dab3c6',
    'version': '2.0.0'
};


function aesDecrypt(str, keyStr, type = 'base64') {
    try {
        const key = Crypto.enc.Utf8.parse(keyStr);
        let decrypted;
        
        if (type === 'hex') {
            const encryptedHexStr = Crypto.enc.Hex.parse(str);
            decrypted = Crypto.AES.decrypt(
                { ciphertext: encryptedHexStr },
                key,
                { 
                    mode: Crypto.mode.ECB,
                    padding: Crypto.pad.Pkcs7 
                }
            );
        } else {
            decrypted = Crypto.AES.decrypt(
                str, 
                key, 
                { 
                    mode: Crypto.mode.ECB,
                    padding: Crypto.pad.Pkcs7 
                }
            );
        }
        
        return decrypted.toString(Crypto.enc.Utf8);
    } catch (e) {
        return null;
    }
}


function aesEncrypt(str, keyStr, type = 'base64') {
    try {
        const key = Crypto.enc.Utf8.parse(keyStr);
        const encrypted = Crypto.AES.encrypt(
            str,
            key,
            {
                mode: Crypto.mode.ECB,
                padding: Crypto.pad.Pkcs7
            }
        );
        
        if (type === 'hex') {
            return encrypted.ciphertext.toString(Crypto.enc.Hex);
        }
        return encrypted.toString();
    } catch (e) {
        return null;
    }
}

function decodeBase64(str) {
    try {
        let words = Crypto.enc.Base64.parse(str);
        return words.toString(Crypto.enc.Utf8);
    } catch (e) {
        return str;
    }
}

async function request(reqUrl, data, header, method) {
    let options = {
        method: method || 'get',
        headers: header || headers,
        timeout: 10000,
    };
    
    if (method === 'post') {
        options.data = data || '';
        options.postType = 'form';
    }
    
    let res = await req(reqUrl, options);
    return res.content;
}


async function init(cfg) {
    try {
        if (!cfg.ext) {
            throw new Error('未提供ext参数');
        }
        
        let extValue = cfg.ext.trim();
        
        try {
            extValue = decodeBase64(extValue);
        } catch (e) {}
        
        if (extValue.startsWith('http') && (extValue.endsWith('.txt') || extValue.includes('api'))) {

            try {
                let hostHeaders = {
                    'User-Agent': 'okhttp/4.11.0',
                    'Connection': 'Keep-Alive'
                };
                

                let response = await request(extValue, '', hostHeaders);
                

                let decrypted = aesDecrypt(response.trim(), keys[0]);
                if (!decrypted) {
                    let cleaned = response.trim().replace(/[^A-Za-z0-9+/=]/g, '');
                    decrypted = aesDecrypt(cleaned, keys[0]);
                }
                
                if (!decrypted) {
                    throw new Error('解密host失败');
                }
                
                let hosts = JSON.parse(decrypted);
                if (!hosts || !hosts.length) {
                    throw new Error('解析host失败');
                }
                
                host = hosts[0];
            } catch (e) {
                if (extValue.startsWith('http')) {
                    host = extValue;
                } else {
                    throw new Error('无法获取host');
                }
            }
        } else {
            host = extValue;
        }

        let result = await getinfo();
        hkey = result[0];
        playerinfos = result[1];
    } catch (e) {
        throw new Error('初始化失败');
    }
}

async function getinfo() {
    try {
        let data = await request(`${host}/shark/api.php?action=configs`, {username: '', token: ''}, headers, 'post');

        let decrypted = aesDecrypt(data, keys[2]);
        if (!decrypted) {
            let cleaned = data.replace(/[^A-Za-z0-9+/=]/g, '');
            decrypted = aesDecrypt(cleaned, keys[2]);
        }
        
        if (!decrypted) {
            throw new Error('解密配置失败');
        }
        
        let datas = JSON.parse(decrypted);
        let hkey = datas.config.hulue.split('&')[0];
        let playerinfos = datas.playerinfos;
        
        return [hkey, playerinfos];
    } catch (e) {
        return ['', []];
    }
}

async function getdata(path, method = true, data = null) {
    try {
        let url = `${host}${path}`;
        let response;
        
        if (method) {
            response = await request(url, '', headers);
        } else {
            response = await request(url, data, headers, 'post');
        }
        
        let decrypted = aesDecrypt(response, keys[1]);
        if (!decrypted) {
            let cleaned = response.replace(/[^A-Za-z0-9+/=]/g, '');
            decrypted = aesDecrypt(cleaned, keys[1]);
        }
        
        if (!decrypted) {
            throw new Error(`解密API响应失败(${path})`);
        }
        
        return JSON.parse(decrypted);
    } catch (e) {
        return { data: {} };
    }
}

async function getf(type_id) {
    try {
        let fdata = await getdata(`/api.php/v1.classify/types?type_id=${type_id}`);
        
        let filter_list = [];
        for (let key in fdata.data) {
            let value = fdata.data[key];
            if (value && value.length) {
                filter_list.push({
                    key: key.split('_')[0],
                    name: key.split('_')[0],
                    value: value.filter(j => j.type_name).map(j => ({
                        n: j.type_name,
                        v: j.type_name
                    }))
                });
            }
        }
        
        return [type_id, filter_list];
    } catch (e) {
        return [type_id, []];
    }
}

async function getparse(id) {
    for (let i of playerinfos) {
        if (i.playername === id) {
            let j = i.playerjiekou;
            return aesDecrypt(j, hkey);
        }
    }
    return '';
}

async function home(filter) {
    try {
        let cdata = await getdata('/api.php/v1.home/types');
        
        let classes = [];
        let filters = {};
        
        if (!cdata.data || !cdata.data.types) {
            throw new Error('分类数据格式不正确');
        }
       
        for (let i of cdata.data.types.slice(1)) {
            classes.push({
                type_id: i.type_id.toString(),
                type_name: i.type_name
            });
        }
        
        const promises = classes.map(i => getf(i.type_id));
        const results = await Promise.all(promises);
        
        for (let [type_id, filter_data] of results) {
            if (filter_data.length) {
                filters[type_id] = filter_data;
            }
        }
        
        return JSON.stringify({
            class: classes,
            filters: filters
        });
    } catch (e) {
        return JSON.stringify({
            class: [],
            filters: {}
        });
    }
}

async function homeVod() {
    try {
        let data = await getdata('/api.php/v1.home/data?type_id=26');
        
        if (!data.data || !data.data.banners) {
            throw new Error('首页数据格式不正确');
        }
        
        return JSON.stringify({
            list: data.data.banners
        });
    } catch (e) {
        return JSON.stringify({
            list: []
        });
    }
}

async function category(tid, pg, filter, extend) {
    try {
        let jsonData = {
            area: extend && extend.area ? extend.area : '全部地区',
            lang: extend && extend.lang ? extend.lang : '全部语言', 
            rank: extend && extend.rank ? extend.rank : '最新',
            type: extend && extend.type ? extend.type : '全部类型',
            type_id: parseInt(tid),
            year: extend && extend.year ? extend.year : '全部年代',
        };

        let data = await getdata(
            `/api.php/v1.classify/content?page=${pg}`,
            false,
            jsonData
        );
        
        if (!data.data || !data.data.video_list) {
            throw new Error('分类内容数据格式不正确');
        }
        
        return JSON.stringify({
            list: data.data.video_list,
            page: pg,
            pagecount: 9999,
            limit: 90,
            total: 999999
        });
    } catch (e) {
        return JSON.stringify({
            list: [],
            page: pg,
            pagecount: 0,
            limit: 0,
            total: 0
        });
    }
}

async function detail(ids) {
    try {
        let id = Array.isArray(ids) ? ids[0] : ids;
        
        let data = await getdata(`/api.php/v1.player/details?vod_id=${id}`);
        
        if (!data.data || !data.data.detail) {
            throw new Error('详情数据格式不正确');
        }
        
        let vod = data.data.detail;
        let names = [], plist = [];
        
        for (let i of vod.play_url_list) {
            names.push(i.show);
            let urls = [];
            for (let j of i.urls) {
                urls.push(`${j.name}$${i.from}@@${j.url}`);
            }
            plist.push(urls.join('#'));
        }
        
        delete vod.play_url_list;
        vod.vod_play_from = names.join('$$$');
        vod.vod_play_url = plist.join('$$$');
        
        return JSON.stringify({
            list: [vod]
        });
    } catch (e) {
        return JSON.stringify({
            list: []
        });
    }
}

async function search(wd, quick, pg) {
    try {
        let data = await getdata(
            `/api.php/v1.search/data?wd=${wd}&type_id=0&page=${pg || '1'}`
        );
        
        if (!data.data || !data.data.search_data) {
            throw new Error('搜索数据格式不正确');
        }
        
        return JSON.stringify({
            list: data.data.search_data,
            page: pg || '1'
        });
    } catch (e) {
        return JSON.stringify({
            list: [],
            page: pg || '1'
        });
    }
}

async function play(flag, id, flags) {
    try {
        let ids = id.split('@@');
        let p = 0;
        let url = '';
        
        let cacheKey = ids.join('_');
        if (cachedPlayUrls[cacheKey]) {
            return cachedPlayUrls[cacheKey];
        }
        
        try {
            let parse = '';
            for (let i of playerinfos) {
                if (i.playername === ids[0]) {
                    let j = i.playerjiekou;
                    parse = aesDecrypt(j, hkey);
                    break;
                }
            }

            let formData = {
                parse: parse || '',
                url: ids[1] || '',
                matching: ''
            };

            let response = await request(
                `${host}/shark/api.php?action=parsevod`,
                formData,
                {
                    ...headers,
                    'ua':'32e21d0ba2c2aa62770e4cfcafafa71dxP9psmjWgIFOpDz9d463b65f235b29552dc10fde92afa0f6',
                   'User-Agent': 'Dalvik/2.0.0 (Linux; U; Android 9; nubia Build/NX629J)',
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                'post'
            );
            
            let decrypted = null;
            if (hkey) {
                decrypted = aesDecrypt(response, hkey);
            }

            if (!decrypted) {
                decrypted = aesDecrypt(response, keys[1]);
            }

            if (!decrypted) {
                let cleaned = response.replace(/[^A-Za-z0-9+/=]/g, '');

                if (hkey) {
                    decrypted = aesDecrypt(cleaned, hkey);
                }

                if (!decrypted) {
                    decrypted = aesDecrypt(cleaned, keys[1]);
                }
            }
            
            if (!decrypted) {
                throw new Error('解密播放信息失败');
            }

            let data = JSON.parse(decrypted);

            if (data.url) {
                url = data.url;
            } else if (data.data && data.data.url) {
                url = data.data.url;
            } else if (data.data && data.data.data && data.data.data.url) {
                url = data.data.data.url;
            } else {
                throw new Error('未获取到播放地址');
            }
            
        } catch (e) {
            p = 1;
            url = ids[1];
        }

        let result = JSON.stringify({
            parse: p,
            url: url,
            header: {
                'User-Agent': 'aliplayer(appv=1.4.0&av=6.16.0&av2=6.16.0_40316683&os=android&ov=11&dm=M2012K10C)'
            }
        });
        
        cachedPlayUrls[cacheKey] = result;
        return result;
    } catch (e) {
        return JSON.stringify({
            parse: 0,
            url: ''
        });
    }
}

export function __jsEvalReturn() {
    return {
        init: init,
        home: home,
        homeVod: homeVod,
        category: category,
        detail: detail,
        play: play,
        search: search
    };
}
