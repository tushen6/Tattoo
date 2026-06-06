# -*- coding: utf-8 -*-
# @Author  : Doubebly
# @Time    : 2025/7/15 12:10
# @Function: 哔哩哔哩·可自动生成年份筛选器（2010-2025）

import time
from urllib.parse import quote
import requests
import re
import sys
import base64
sys.path.append('..')
from base.spider import Spider


class Spider(Spider):
    def getName(self):
        return self.vod.name

    def init(self, extend):
        self.vod = BiliBili()

    def getDependence(self):
        return []

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def homeContent(self, filter):
        return self.vod.homeContent(filter)

    def homeVideoContent(self):
        return self.vod.homeVideoContent()

    def categoryContent(self, cid, page, filter, ext):
        return self.vod.categoryContent(cid, page, filter, ext)

    def detailContent(self, did):
        return self.vod.detailContent(did)

    def searchContent(self, key, quick, page='1'):
        return self.vod.searchContent(key, quick, page='1')

    def playerContent(self, flag, pid, vipFlags):
        return self.vod.playerContent(flag, pid, vipFlags)

    def localProxy(self, params):
        if params['type'] == "mpd":
            return self.vod.get_mpd(params)
        if params['type'] == "media":
            return self.vod.get_media(params)
        return None

    def destroy(self):
        return '正在Destroy'


class BiliBili:
    def __init__(self):
        self.name = "哔哩哔哩"
        self.get_proxy_url = 'http://127.0.0.1:9978/proxy?do=py'

        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.54 Safari/537.36',
            'Referer': 'https://www.bilibili.com',
            'Cookie': 'DedeUserID=1647569046;DedeUserID__ckMd5=9ceb1acdcfded2be;Expires=1793892299;SESSDATA=e60bfede%2C1793892299%2Cf037d*51CjBqtNj-ZR3qYGznqnCrwUAqMz47h7FQvvDYLPo3B3BTlSHKw24aGtkMdgt--MiaUDsSVlZxUkhwZHZpX3NwV3A2dWxSS1lnTXZzcjNLbDZfUzctaVFsTnVCd1FVS014SjNHNUM2c3BQbjB2QWc0YXpsWFdDQzB1MTFtY2RrdGVhVmFRem1VbGN3IIEC;bili_jct=5628bce7cc0714181319f5d419a0ea8f;gourl=https://www.bilibili.com;first_domain=.bilibili.com'
        }
        self.cache = {}

    # -------------------- 自动生成年份筛选器 --------------------
    @staticmethod
    def build_year_filter(start: int = 2010, end: int = 2025):
        """生成 [start, end] 闭区间每年的筛选器项"""
        arr = [{"v": "-1", "n": "全部"}]
        for y in range(end, start - 1, -1):
            arr.append({"v": f"[{y},{y + 1})", "n": str(y)})
        return arr

    # -------------------- 主分类 --------------------
    def homeContent(self, filter):
        year_filter = self.build_year_filter()          # 自动 2010-2025
        return {
            'class': [
                {'type_id': '1', 'type_name': '番剧'},
                {'type_id': '4', 'type_name': '国创'},   # 原4，避免与电影冲突
                {'type_id': '2', 'type_name': '电影'},
                {'type_id': '7', 'type_name': '综艺'},
                {'type_id': '5', 'type_name': '电视剧'},
                {'type_id': '3', 'type_name': '纪录片'},
            ],
            'filters': {
                "1": [
                    {"key": "season_version", "name": "类型", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "正片"}, {"v": '2', "n": "电影"}, {"v": '3', "n": "其他"}]},
                    {"key": "area", "name": "地区", "value": [{"v": '-1', "n": "全部"}, {"v": '2', "n": "日本"}, {"v": '3', "n": "美国"}, {"v": "1,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70", "n": "其他"}]},
                    {"key": "is_finish", "name": "状态", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "完结"}, {"v": '0', "n": "连载"}]},
                    {"key": "copyright", "name": "版权", "value": [{"v": '-1', "n": "全部"}, {"v": '3', "n": "独家"}, {"v": "1,2,4", "n": "其他"}]},
                    {"key": "season_status", "name": "付费", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "免费"}, {"v": "2,6", "n": "付费"}, {"v": "4,6", "n": "大会员"}]},
                    {"key": "season_month", "name": "季度", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "1月"}, {"v": '4', "n": "4月"}, {"v": '7', "n": "7月"}, {"v": '10', "n": "10月"}]},
                    {"key": "year", "name": "年份", "value": year_filter},
                    {"key": "style_id", "name": "风格", "value": [{"v": '-1', "n": "全部"}, {"v": '10010', "n": "原创"}, {"v": '10011', "n": "漫画改"}, {"v": '10012', "n": "小说改"}, {"v": '10013', "n": "游戏改"}, {"v": '10102', "n": "特摄"}, {"v": '10015', "n": "布袋戏"}, {"v": '10016', "n": "热血"}, {"v": '10017', "n": "穿越"}, {"v": '10018', "n": "奇幻"}, {"v": '10020', "n": "战斗"}, {"v": '10021', "n": "搞笑"}, {"v": '10022', "n": "日常"}, {"v": '10023', "n": "科幻"}, {"v": '10024', "n": "萌系"}, {"v": '10025', "n": "治愈"}, {"v": '10026', "n": "校园"}, {"v": '10027', "n": "少儿"}, {"v": '10028', "n": "泡面"}, {"v": '10029', "n": "恋爱"}, {"v": '10030', "n": "少女"}, {"v": '10031', "n": "魔法"}, {"v": '10032', "n": "冒险"}, {"v": '10033', "n": "历史"}, {"v": '10034', "n": "架空"}, {"v": '10035', "n": "机战"}, {"v": '10036', "n": "神魔"}, {"v": '10037', "n": "声控"}, {"v": '10038', "n": "运动"}, {"v": '10039', "n": "励志"}, {"v": '10040', "n": "音乐"}, {"v": '10041', "n": "推理"}, {"v": '10042', "n": "社团"}, {"v": '10043', "n": "智斗"}, {"v": '10044', "n": "催泪"}, {"v": '10045', "n": "美食"}, {"v": '10046', "n": "偶像"}, {"v": '10047', "n": "乙女"}, {"v": '10048', "n": "职场"}]}
                ],
                "3": [
                    {"key": "season_version", "name": "类型", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "正片"}, {"v": '2', "n": "电影"}, {"v": '3', "n": "其他"}]},
                    {"key": "area", "name": "地区", "value": [{"v": '-1', "n": "全部"}, {"v": '2', "n": "日本"}, {"v": '3', "n": "美国"}, {"v": "1,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70", "n": "其他"}]},
                    {"key": "is_finish", "name": "状态", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "完结"}, {"v": '0', "n": "连载"}]},
                    {"key": "copyright", "name": "版权", "value": [{"v": '-1', "n": "全部"}, {"v": '3', "n": "独家"}, {"v": "1,2,4", "n": "其他"}]},
                    {"key": "season_status", "name": "付费", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "免费"}, {"v": "2,6", "n": "付费"}, {"v": "4,6", "n": "大会员"}]},
                    {"key": "year", "name": "年份", "value": year_filter},
                    {"key": "style_id", "name": "风格", "value": [{"v": '-1', "n": "全部"}, {"v": '10010', "n": "原创"}, {"v": '10011', "n": "漫画改"}, {"v": '10012', "n": "小说改"}, {"v": '10013', "n": "游戏改"}, {"v": '10014', "n": "动态漫"}, {"v": '10015', "n": "布袋戏"}, {"v": '10016', "n": "热血"}, {"v": '10018', "n": "奇幻"}, {"v": '10019', "n": "玄幻"}, {"v": '10020', "n": "战斗"}, {"v": '10021', "n": "搞笑"}, {"v": '10078', "n": "武侠"}, {"v": '10022', "n": "日常"}, {"v": '10023', "n": "科幻"}, {"v": '10024', "n": "萌系"}, {"v": '10025', "n": "治愈"}, {"v": '10057', "n": "悬疑"}, {"v": '10026', "n": "校园"}, {"v": '10027', "n": "少儿"}, {"v": '10028', "n": "泡面"}, {"v": '10029', "n": "恋爱"}, {"v": '10030', "n": "少女"}, {"v": '10031', "n": "魔法"}, {"v": '10033', "n": "历史"}, {"v": '10035', "n": "机战"}, {"v": '10036', "n": "神魔"}, {"v": '10037', "n": "声控"}, {"v": '10038', "n": "运动"}, {"v": '10039', "n": "励志"}, {"v": '10040', "n": "音乐"}, {"v": '10041', "n": "推理"}, {"v": '10042', "n": "社团"}, {"v": '10043', "n": "智斗"}, {"v": '10044', "n": "催泪"}, {"v": '10045', "n": "美食"}, {"v": '10046', "n": "偶像"}, {"v": '10047', "n": "乙女"}, {"v": '10048', "n": "职场"}, {"v": '10049', "n": "古风"}]}
                ],
                "4": [
                    {"key": "area", "name": "地区", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "中国大陆"}, {"v": "6,7", "n": "中国港台"}, {"v": '3', "n": "美国"}, {"v": '2', "n": "日本"}, {"v": '8', "n": "韩国"}, {"v": '9', "n": "法国"}, {"v": '4', "n": "英国"}, {"v": '15', "n": "德国"}, {"v": '10', "n": "泰国"}, {"v": '35', "n": "意大利"}, {"v": '13', "n": "西班牙"}, {"v": "5,11,12,14,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70", "n": "其他"}]},
                    {"key": "season_status", "name": "付费", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "免费"}, {"v": "2,6", "n": "付费"}, {"v": "4,6", "n": "大会员"}]},
                    {"key": "style_id", "name": "风格", "value": [{"v": '-1', "n": "全部"}, {"v": '10104', "n": "短片"}, {"v": '10050', "n": "剧情"}, {"v": '10051', "n": "喜剧"}, {"v": '10052', "n": "爱情"}, {"v": '10053', "n": "动作"}, {"v": '10054', "n": "恐怖"}, {"v": '10023', "n": "科幻"}, {"v": '10055', "n": "犯罪"}, {"v": '10056', "n": "惊悚"}, {"v": '10057', "n": "悬疑"}, {"v": '10018', "n": "奇幻"}, {"v": '10058', "n": "战争"}, {"v": '10059', "n": "动画"}, {"v": '10060', "n": "传记"}, {"v": '10061', "n": "家庭"}, {"v": '10062', "n": "歌舞"}, {"v": '10033', "n": "历史"}, {"v": '10032', "n": "冒险"}, {"v": '10063', "n": "纪实"}, {"v": '10064', "n": "灾难"}, {"v": '10011', "n": "漫画改"}, {"v": '10012', "n": "小说改"}]},
                    {"key": "release_date", "name": "年份", "value": year_filter}
                ],
                "5": [
                    {"key": "area", "name": "地区", "value": [{"v": '-1', "n": "全部"}, {"v": "1,6,7", "n": "中国"}, {"v": '2', "n": "日本"}, {"v": '3', "n": "美国"}, {"v": '4', "n": "英国"}, {"v": '10', "n": "泰国"}, {"v": "5,8,9,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70", "n": "其他"}]},
                    {"key": "season_status", "name": "付费", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "免费"}, {"v": "2,6", "n": "付费"}, {"v": "4,6", "n": "大会员"}]},
                    {"key": "style_id", "name": "风格", "value": [{"v": '-1', "n": "全部"}, {"v": '10021', "n": "搞笑"}, {"v": '10018', "n": "奇幻"}, {"v": '10058', "n": "战争"}, {"v": '10078', "n": "武侠"}, {"v": '10079', "n": "青春"}, {"v": '10103', "n": "短剧"}, {"v": '10080', "n": "都市"}, {"v": '10081', "n": "古装"}, {"v": '10082', "n": "谍战"}, {"v": '10083', "n": "经典"}, {"v": '10084', "n": "情感"}, {"v": '10057', "n": "悬疑"}, {"v": '10039', "n": "励志"}, {"v": '10085', "n": "神话"}, {"v": '10017', "n": "穿越"}, {"v": '10086', "n": "年代"}, {"v": '10087', "n": "农村"}, {"v": '10088', "n": "刑侦"}, {"v": '10050', "n": "剧情"}, {"v": '10061', "n": "家庭"}, {"v": '10033', "n": "历史"}, {"v": '10089', "n": "军旅"}, {"v": '10023', "n": "科幻"}]},
                    {"key": "release_date", "name": "年份", "value": year_filter}
                ],
                "7": [
                    {"key": "season_status", "name": "付费", "value": [{"v": '-1', "n": "全部"}, {"v": '1', "n": "免费"}, {"v": "2,6", "n": "付费"}, {"v": "4,6", "n": "大会员"}]},
                    {"key": "style_id", "name": "风格", "value": [{"v": '-1', "n": "全部"}, {"v": '10040', "n": "音乐"}, {"v": '10090', "n": "访谈"}, {"v": '10091', "n": "脱口秀"}, {"v": '10092', "n": "真人秀"}, {"v": '10094', "n": "选秀"}, {"v": '10045', "n": "美食"}, {"v": '10095', "n": "旅游"}, {"v": '10098', "n": "晚会"}, {"v": '10096', "n": "演唱会"}, {"v": '10084', "n": "情感"}, {"v": '10051', "n": "喜剧"}, {"v": '10097', "n": "亲子"}, {"v": '10100', "n": "文化"}, {"v": '10048', "n": "职场"}, {"v": '10069', "n": "萌宠"}, {"v": '10099', "n": "养成"}]},
                    {"key": "release_date", "name": "年份", "value": year_filter}
                ]
            }
        }

    def homeVideoContent(self):
        return {'list': [], 'parse': 0, 'jx': 0}

    def categoryContent(self, cid, page, filter, ext):
        video_list = []
        url = f"https://api.bilibili.com/pgc/season/index/result?order=2&sort=2&pagesize=20&type=1&st={cid}&season_type={cid}&page={page}"
        if ext:
            k, v = next(iter(ext.items()))
            url += f'&{k}={quote(v)}'
        rsp = requests.get(url, headers=self.headers, timeout=5)
        for vod in rsp.json()['data']['list']:
            video_list.append({
                "vod_id": str(vod['season_id']).strip(),
                "vod_name": self.remove_html_tags(vod['title']),
                "vod_pic": vod['cover'].strip(),
                "vod_remarks": vod['index_show'].strip()
            })
        return {'list': video_list, 'parse': 0, 'jx': 0}

    def detailContent(self, did):
        sid = did[0]
        url = f"https://api.bilibili.com/pgc/view/web/season?season_id={sid}"
        data = requests.get(url, headers=self.headers, timeout=10).json()['result']
        vod = {
            "vod_id": sid,
            "vod_name": self.remove_html_tags(data['title']),
            "vod_pic": data['cover'],
            "type_name": data['share_sub_title'],
            "vod_actor": data['actors'].replace('\n', '，'),
            "vod_content": self.remove_html_tags(data['evaluate'])
        }
        play_url = []
        for ep in data['episodes']:
            name = self.remove_html_tags(ep['share_copy']).replace('#', '-').replace('$', '*')
            dur = time.strftime('%H:%M:%S', time.gmtime(ep['duration'] / 1000))
            if dur.startswith('00:'):
                dur = dur[3:]
            play_url.append(f"[{dur}]{name}${ep['id']}_{ep['cid']}")
        vod['vod_play_from'] = self.name
        vod['vod_play_url'] = '#'.join(play_url)
        return {"list": [vod], 'parse': 0, 'jx': 0}

    def searchContent(self, key, quick, page='1'):
        url = f"https://api.bilibili.com/x/web-interface/search/type?search_type=media_bangumi&keyword={key}&page={page}"
        data = requests.get(url, headers=self.headers).json()['data']
        video_list = []
        if 'result' in data:
            for vod in data['result']:
                video_list.append({
                    "vod_id": str(vod['season_id']).strip(),
                    "vod_name": self.remove_html_tags(vod['title']),
                    "vod_pic": vod['eps'][0]['cover'].strip(),
                    "vod_remarks": self.remove_html_tags(vod['index_show']).strip()
                })
        return {'list': video_list, 'parse': 0, 'jx': 0}

    def playerContent(self, flag, pid, vipFlags):
        aid, cid = pid.split('_')
        return {
            'url': f'{self.get_proxy_url}&type=mpd&aid={aid}&cid={cid}',
            'parse': 0,
            'jx': 0,
            'header': {'User-Agent': self.headers['User-Agent'], 'Referer': self.headers['Referer']}
        }

    def get_mpd(self, params):
        aid, cid = params['aid'], params['cid']
        key = f'Bili_{aid}_{cid}'
        dash = self.cache.get(key)
        if not dash:
            url = f'https://api.bilibili.com/pgc/player/web/playurl?ep_id={aid}&cid={cid}&qn=120&fnval=4048&fnver=0&fourk=1'
            data = requests.get(url, headers=self.headers, timeout=5).json()
            if data['result']['type'] == 'DASH':
                dash = data['result']['dash']
                self.cache[key] = dash
            elif data['result']['type'] == 'MP4':
                return [302, "text/plain", None, {'Location': data['result']['durl'][0]['url']}]
            else:
                return [302, "text/plain", None, {'Location': 'https://sf1-cdn-tos.huoshanstatic.com/obj/media-fe/xgplayer_doc_video/mp4/xgplayer-demo-720p.mp4'}]

        dur, buf = dash['duration'], dash['minBufferTime']
        video_repr = []
        for v in dash['video']:
            base_url = f"{self.get_proxy_url}&type=media&url=".replace('&', '&amp;') + base64.b64encode(v['baseUrl'].encode()).decode()
            video_repr.append(
                f'<Representation bandwidth="{v["bandwidth"]}" codecs="{v["codecs"]}" frameRate="{v["frameRate"]}" height="{v["height"]}" id="{v["id"]}" width="{v["width"]}">'
                f'<BaseURL>{base_url}</BaseURL>'
                f'<SegmentBase indexRange="{v["SegmentBase"]["indexRange"]}"><Initialization range="{v["SegmentBase"]["Initialization"]}"/></SegmentBase>'
                '</Representation>'
            )
        audio_repr = []
        for a in dash['audio']:
            base_url = f"{self.get_proxy_url}&type=media&url=".replace('&', '&amp;') + base64.b64encode(a['baseUrl'].encode()).decode()
            audio_repr.append(
                f'<Representation audioSamplingRate="44100" bandwidth="{a["bandwidth"]}" codecs="{a["codecs"]}" id="{a["id"]}">'
                f'<BaseURL>{base_url}</BaseURL>'
                f'<SegmentBase indexRange="{a["SegmentBase"]["indexRange"]}"><Initialization range="{a["SegmentBase"]["Initialization"]}"/></SegmentBase>'
                '</Representation>'
            )
        mpd = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="PT{dur}S" minBufferTime="PT{buf}S">',
            '<Period>',
            '<AdaptationSet mimeType="video/mp4" startWithSAP="1" scanType="progressive" segmentAlignment="true">',
            '\n'.join(video_repr),
            '</AdaptationSet>',
            '<AdaptationSet mimeType="audio/mp4" startWithSAP="1" segmentAlignment="true" lang="und">',
            '\n'.join(audio_repr),
            '</AdaptationSet>',
            '</Period>',
            '</MPD>'
        ]
        return [200, "application/dash+xml", '\n'.join(mpd)]

    def get_media(self, params):
        url = base64.b64decode(params['url'].encode()).decode()
        headers = {'User-Agent': self.headers['User-Agent'], 'Referer': self.headers['Referer']}
        if params.get('range'):
            headers['Range'] = params['range']
        return [206, "application/octet-stream", requests.get(url, headers=headers, stream=True).content]

    @staticmethod
    def remove_html_tags(text):
        return re.sub(r'<.*?>', '', text)


if __name__ == '__main__':
    pass