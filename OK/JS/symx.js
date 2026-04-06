var rule = {
    title: '山有木兮',
    host: 'https://film.symx.club',
    // 使用站点自身的分类接口作为 homeUrl，结合 class_parse 自动生成分类
    homeUrl: '/api/category/top',
    // 从 JSON 中的 data 数组提取分类，name 作为显示名，id 作为分类 id
    class_parse: 'json:data;name;id',
    url: '/api/film/category/list?categoryId=fyclass&pageNum=fypage&pageSize=15&sort=updateTime',
    searchUrl: '/api/film/search?keyword=**&pageNum=fypage&pageSize=15',
    searchable: 2,
    quickSearch: 0,
    filterable: 0,
    play_parse: true,
    // 备用静态分类（如果 class_parse 失效，仍可用）
    class_name: '电视剧&电影&综艺&动漫&短剧',
    class_url: '1&2&3&4&5',
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    },
    timeout: 5000,
    推荐: $js.toString(() => {
        let d = [];
        let url = 'https://film.symx.club/api/film/category';
        let html = request(url);
        try {
            let json = JSON.parse(html);
            if (json.data) {
                json.data.forEach(cat => {
                    if (cat.filmList) {
                        cat.filmList.forEach(vod => {
                            d.push({
                                title: vod.name,
                                img: vod.cover,
                                desc: vod.updateStatus,
                                url: vod.id.toString(),
                                content: vod.blurb
                            });
                        });
                    }
                });
            }
        } catch (e) {
            // 解析异常时返回空列表，避免抛错导致 homeVod 直接变成 {}
        }
        setResult(d);
    }),
    一级: 'json:data.list;name;cover;updateStatus;id',
    二级: $js.toString(() => {
        // 兼容多种输入形式：纯数字 ID、/api/film/658、/api/film/category/658、带 id=658 的查询串
        let raw = typeof input === 'string' ? input : (input && (input.id || input.vod_id) || '');
        let id = '';

        if (raw) {
            let m = raw.match(/id=(\d+)/);
            if (m) {
                id = m[1];
            } else {
                m = raw.match(/(\d+)(?!.*\d)/);
                if (m) {
                    id = m[1];
                }
            }
        }

        if (!id && typeof input !== 'undefined' && input !== null && input !== '') {
            id = String(input);
        }

        // 再兜底一次：先从 MY_URL 中提取 ID，避免第一次详情请求出现 id 为空的情况
        if (!id && typeof MY_URL === 'string' && MY_URL) {
            let m2 = MY_URL.match(/id=(\d+)/);
            if (m2) {
                id = m2[1];
            } else {
                m2 = MY_URL.match(/(\d+)(?!.*\d)/);
                if (m2) {
                    id = m2[1];
                }
            }
        }

        // 最后兜底：从 detailParse 里传进来的 orId 提取 ID（第一次进详情时，真实 ID 常在 orId 而不是 MY_URL 里）
        if (!id && typeof orId !== 'undefined' && orId) {
            let s = String(orId);
            let m3 = s.match(/id=(\d+)/);
            if (m3) {
                id = m3[1];
            } else {
                m3 = s.match(/(\d+)(?!.*\d)/);
                if (m3) {
                    id = m3[1];
                }
            }
        }

        let url = 'https://film.symx.club/api/film/detail?id=' + id;
        let html = request(url);
        let json = {};
        try {
            json = JSON.parse(html);
        } catch (e) {
            json = {};
        }
        let data = json && json.data ? json.data : {};

        VOD = {
            vod_id: data.id || id,
            vod_name: data.name || '',
            vod_pic: data.cover || '',
            vod_remarks: data.updateStatus || '',
            vod_year: data.year || '',
            vod_area: data.area || '',
            vod_actor: data.actor || '',
            vod_director: data.director || '',
            vod_content: data.blurb || ''
        };

        let plays = data.playLineList || [];
        let tabs = [];
        let lists = [];

        plays.forEach(p => {
            tabs.push(p.playerName);
            let urls = (p.lines || []).map(l => {
                let name = l.name || ('第' + (l.index || '1') + '集');
                return name + '$' + l.id;
            });
            lists.push(urls.join('#'));
        });

        VOD.vod_play_from = tabs.join('$$$');
        VOD.vod_play_url = lists.join('$$$');
    }),
    搜索: 'json:data.list;name;cover;updateStatus;id',
    lazy: $js.toString(() => {
        let url = 'https://film.symx.club/api/line/play/parse?lineId=' + input;
        let html = request(url);
        let json = JSON.parse(html);
        if (json.code === 200 && json.data) {
            input = {
                parse: 0,
                url: json.data,
                header: rule.headers
            };
        } else {
            input = {
                parse: 1,
                url: input
            };
        }
    })
};
