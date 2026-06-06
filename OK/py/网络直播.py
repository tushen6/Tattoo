# -*- coding: utf-8 -*-
# by @星河
# 修复版本 - 参考最新三合一.js重构虎牙、斗鱼、B站直播逻辑
# 修复：虎牙清晰度选择，确保ratio参数正确传递码率值
# 修复：斗鱼切换分辨率只能播放1秒的问题（每次重新获取安全密钥和签名）
# 合并：B站直播功能（严格按哔哩直播.py实现）
import json
import re
import sys
import time
import hashlib
import random
import urllib.parse
from base64 import b64decode, b64encode
from urllib.parse import parse_qs
import requests
from pyquery import PyQuery as pq
from bs4 import BeautifulSoup
sys.path.append('..')
from base.spider import Spider
from concurrent.futures import ThreadPoolExecutor


class Spider(Spider):

    def init(self, extend=""):
        pass

    def getName(self):
        return "直播"

    def isVideoFormat(self, url):
        pass

    def manualVideoCheck(self):
        pass

    def destroy(self):
        pass

    # B站专用配置（严格按哔哩直播.py）
    xurl = "https://search.bilibili.com"
    xurl1 = "https://api.live.bilibili.com"
    headerx = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0'
    }

    headers = [
        {
            # 特殊UA绕过B站风控
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0"
        },
        {
            "User-Agent": "Dart/3.4 (dart:io)"
        }
    ]

    excepturl = 'https://www.baidu.com'

    hosts = {
        "huya": ["https://www.huya.com", "https://mp.huya.com"],
        "douyu": "https://www.douyu.com",
        "wangyi": "https://cc.163.com",
        "bili": ["https://api.live.bilibili.com", "https://api.bilibili.com"]
    }

    referers = {
        "huya": "https://live.cdn.huya.com",
        "douyu": "https://m.douyu.com",
        "bili": "https://live.bilibili.com"
    }

    playheaders = {
        "wangyi": {
            "User-Agent": "ExoPlayer",
            "Connection": "Keep-Alive",
            "Icy-MetaData": "1"
        },
        "bili": {
            'Accept': '*/*',
            'Icy-MetaData': '1',
            'referer': 'https://live.bilibili.com',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        'huya': {
            'User-Agent': 'ExoPlayer',
            'Connection': 'Keep-Alive',
            'Icy-MetaData': '1'
        },
        'douyu': {
            'User-Agent': 'libmpv',
            'Icy-MetaData': '1'
        }
    }

    def extract_middle_text(self, text, start_str, end_str, pl, start_index1: str = '', end_index2: str = ''):
        """严格按哔哩直播.py实现"""
        if pl == 3:
            plx = []
            while True:
                start_index = text.find(start_str)
                if start_index == -1:
                    break
                end_index = text.find(end_str, start_index + len(start_str))
                if end_index == -1:
                    break
                middle_text = text[start_index + len(start_str):end_index]
                plx.append(middle_text)
                text = text.replace(start_str + middle_text + end_str, '')
            if len(plx) > 0:
                purl = ''
                for i in range(len(plx)):
                    matches = re.findall(start_index1, plx[i])
                    output = ""
                    for match in matches:
                        match3 = re.search(r'(?:^|[^0-9])(\d+)(?:[^0-9]|$)', match[1])
                        if match3:
                            number = match3.group(1)
                        else:
                            number = 0
                        if 'http' not in match[0]:
                            output += f"#{match[1]}${number}{self.xurl}{match[0]}"
                        else:
                            output += f"#{match[1]}${number}{match[0]}"
                    output = output[1:]
                    purl = purl + output + "$$$"
                purl = purl[:-3]
                return purl
            else:
                return ""
        else:
            start_index = text.find(start_str)
            if start_index == -1:
                return ""
            end_index = text.find(end_str, start_index + len(start_str))
            if end_index == -1:
                return ""

        if pl == 0:
            middle_text = text[start_index + len(start_str):end_index]
            return middle_text.replace("\\", "")

        if pl == 1:
            middle_text = text[start_index + len(start_str):end_index]
            matches = re.findall(start_index1, middle_text)
            if matches:
                jg = ' '.join(matches)
                return jg

        if pl == 2:
            middle_text = text[start_index + len(start_str):end_index]
            matches = re.findall(start_index1, middle_text)
            if matches:
                new_list = [f'{item}' for item in matches]
                jg = '$$$'.join(new_list)
                return jg

    def homeContent(self, filter):
        result = {}
        cateManual = {
            "虎牙": "huya",
            "斗鱼": "douyu",
            "网易": "wangyi",
            "B站": "bili"
        }
        classes = []
        filters = {
            'huya': [{'key': 'cate', 'name': '分类',
                      'value': [{'n': '网游', 'v': '1'}, {'n': '单机', 'v': '2'},
                                {'n': '娱乐', 'v': '8'}, {'n': '手游', 'v': '3'}]}]
        }

        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {
                executor.submit(self.process_douyu): 'douyu'
            }

            for future in futures:
                platform, filter_data = future.result()
                if filter_data:
                    filters[platform] = filter_data

        for k in cateManual:
            classes.append({
                'type_name': k,
                'type_id': cateManual[k]
            })

        result['class'] = classes
        result['filters'] = filters
        return result

    def homeVideoContent(self):
        pass

    def categoryContent(self, tid, pg, filter, extend):
        vdata = []
        result = {}
        pagecount = 9999
        result['page'] = pg
        result['limit'] = 90
        result['total'] = 999999
        if tid == 'wangyi':
            vdata, pagecount = self.wyccContent(tid, pg, filter, extend, vdata)
        elif tid == 'bili':
            vdata, pagecount = self.biliContent(tid, pg, filter, extend, vdata)
        elif 'huya' in tid:
            vdata, pagecount = self.huyaContent(tid, pg, filter, extend, vdata)
        elif 'douyu' in tid:
            vdata, pagecount = self.douyuContent(tid, pg, filter, extend, vdata)
        result['list'] = vdata
        result['pagecount'] = pagecount
        return result

    def wyccContent(self, tid, pg, filter, extend, vdata):
        params = {
            'format': 'json',
            'start': (int(pg) - 1) * 20,
            'size': '20',
        }
        response = self.fetch(f'{self.hosts[tid]}/api/category/live/', params=params, headers=self.headers[0]).json()
        for i in response['lives']:
            if i.get('cuteid'):
                bvdata = self.buildvod(
                    vod_id=f"{tid}@@{i['cuteid']}",
                    vod_name=i.get('title'),
                    vod_pic=i.get('cover'),
                    vod_remarks=i.get('nickname'),
                    style={"type": "rect", "ratio": 1.33}
                )
                vdata.append(bvdata)
        return vdata, 9999

    def biliContent(self, tid, pg, filter, extend):
        """严格按哔哩直播.py实现 - 使用搜索页面HTML解析"""
        try:
            # 使用分类作为关键词搜索（注意：B站没有二级分类，直接用关键词）
            cid = extend.get('cate', '舞') if extend else '舞'
            page = int(pg) if pg else 1

            url = f'{self.xurl}/live?keyword={cid}&page={str(page)}'
            detail = requests.get(url=url, headers=self.headerx)
            detail.encoding = "utf-8"
            res = detail.text
            doc = BeautifulSoup(res, "lxml")

            soups = doc.find_all('div', class_="video-list-item")

            for vod in soups:
                try:
                    names = vod.find('h3', class_="bili-live-card__info--tit")
                    if not names:
                        continue
                    name = names.text.strip().replace('直播中', '')

                    id_tag = names.find('a')
                    if not id_tag:
                        continue
                    href = id_tag['href']
                    id = self.extract_middle_text(href, 'bilibili.com/', '?', 0)

                    pic_tag = vod.find('img')
                    pic = pic_tag['src'] if pic_tag else ''
                    if pic and 'http' not in pic:
                        pic = "https:" + pic

                    remarks_tag = vod.find('a', class_="bili-live-card__info--uname")
                    remark = remarks_tag.text.strip() if remarks_tag else ''

                    video = {
                        "vod_id": f"bili@@{id}",
                        "vod_name": name,
                        "vod_pic": pic,
                        "vod_remarks": remark
                    }
                    vdata.append(video)
                except Exception as e:
                    continue

            return vdata, 9999
        except Exception as e:
            print(f"B站内容获取错误: {e}")
            return vdata, 1

    def huyaContent(self, tid, pg, filter, extend, vdata):
        if extend.get('cate') and pg == '1' and 'click' not in tid:
            id = extend.get('cate')
            data = self.fetch(f'{self.referers[tid]}/liveconfig/game/bussLive?bussType={id}',
                              headers=self.headers[1]).json()
            for i in data['data']:
                v = self.buildvod(
                    vod_id=f"click_{tid}@@{int(i['gid'])}",
                    vod_name=i.get('gameFullName'),
                    vod_pic=f'https://huyaimg.msstatic.com/cdnimage/game/{int(i["gid"])}-MS.jpg',
                    vod_tag=1,
                    style={"type": "oval", "ratio": 1}
                )
                vdata.append(v)
            return vdata, 1
        else:
            gid = ''
            if 'click' in tid:
                ids = tid.split('_')[1].split('@@')
                tid = ids[0]
                gid = f'&gameId={ids[1]}'
            data = self.fetch(f'{self.hosts[tid][0]}/cache.php?m=LiveList&do=getLiveListByPage&tagAll=0{gid}&page={pg}',
                              headers=self.headers[1]).json()
            for i in data['data']['datas']:
                if i.get('profileRoom'):
                    v = self.buildvod(
                        f"{tid}@@{i['profileRoom']}",
                        i.get('introduction'),
                        i.get('screenshot'),
                        str(int(i.get('totalCount', '1')) / 10000) + '万',
                        0,
                        i.get('nick'),
                        style={"type": "rect", "ratio": 1.33}

                    )
                    vdata.append(v)
            return vdata, 9999

    def douyuContent(self, tid, pg, filter, extend, vdata):
        if extend.get('cate') and pg == '1' and 'click' not in tid:
            for i in self.dyufdata['data']['cate2Info']:
                if str(i['cate1Id']) == extend['cate']:
                    v = self.buildvod(
                        vod_id=f"click_{tid}@@{i['cate2Id']}",
                        vod_name=i.get('cate2Name'),
                        vod_pic=i.get('icon'),
                        vod_remarks=i.get('count'),
                        vod_tag=1,
                        style={"type": "oval", "ratio": 1}
                    )
                    vdata.append(v)
            return vdata, 1
        else:
            path = f'/japi/weblist/apinc/allpage/6/{pg}'
            if 'click' in tid:
                ids = tid.split('_')[1].split('@@')
                tid = ids[0]
                path = f'/gapi/rkc/directory/mixList/2_{ids[1]}/{pg}'
            url = f'{self.hosts[tid]}{path}'
            data = self.fetch(url, headers=self.headers[1]).json()
            for i in data['data']['rl']:
                v = self.buildvod(
                    vod_id=f"{tid}@@{i['rid']}",
                    vod_name=i.get('rn'),
                    vod_pic=i.get('rs16'),
                    vod_year=str(int(i.get('ol', 1)) / 10000) + '万',
                    vod_remarks=i.get('nn'),
                    style={"type": "rect", "ratio": 1.33}
                )
                vdata.append(v)
            return vdata, 9999

    def detailContent(self, ids):
        ids_split = ids[0].split('@@')
        if ids_split[0] == 'wangyi':
            vod = self.wyccDetail(ids_split)
        elif ids_split[0] == 'bili':
            vod = self.biliDetail(ids_split)
        elif ids_split[0] == 'huya':
            vod = self.huyaDetail(ids_split)
        elif ids_split[0] == 'douyu':
            vod = self.douyuDetail(ids_split)
        return {'list': [vod]}

    def wyccDetail(self, ids):
        try:
            vdata = self.getpq(f'{self.hosts[ids[0]]}/{ids[1]}', self.headers[0])('script').eq(-1).text()

            def get_quality_name(vbr):
                if vbr <= 600:
                    return "标清"
                elif vbr <= 1000:
                    return "高清"
                elif vbr <= 2000:
                    return "超清"
                else:
                    return "蓝光"

            data = json.loads(vdata)['props']['pageProps']['roomInfoInitData']
            name = data['live'].get('title', ids[0])
            vod = self.buildvod(vod_name=data.get('keywords_suffix'), vod_remarks=data['live'].get('title'),
                                vod_content=data.get('description_suffix'))
            resolution_data = data['live']['quickplay']['resolution']
            all_streams = {}
            sorted_qualities = sorted(resolution_data.items(),
                                      key=lambda x: x[1]['vbr'],
                                      reverse=True)
            for quality, data in sorted_qualities:
                vbr = data['vbr']
                quality_name = get_quality_name(vbr)
                for cdn_name, url in data['cdn'].items():
                    if cdn_name not in all_streams and type(url) == str and url.startswith('http'):
                        all_streams[cdn_name] = []
                    if isinstance(url, str) and url.startswith('http'):
                        all_streams[cdn_name].extend([quality_name, url])
            plists = []
            names = []
            for i, (cdn_name, stream_list) in enumerate(all_streams.items(), 1):
                names.append(f'线路{i}')
                pstr = f"{name}${ids[0]}@@{self.e64(json.dumps(stream_list))}"
                plists.append(pstr)
            vod['vod_play_from'] = "$$$".join(names)
            vod['vod_play_url'] = "$$$".join(plists)
            return vod
        except Exception as e:
            return self.handle_exception(e)

    def biliDetail(self, ids):
        """严格按哔哩直播.py实现 - 使用xlive/web-room/v2/index/getRoomPlayInfo"""
        try:
            did = ids[1]
            result = {}
            videos = []
            xianlu = ''
            bofang = ''

            url = f'{self.xurl1}/xlive/web-room/v2/index/getRoomPlayInfo?room_id={did}&platform=web&protocol=0,1&format=0,1,2&codec=0,1'
            detail = requests.get(url=url, headers=self.headerx)
            detail.encoding = "utf-8"
            data = detail.json()

            content = '欢迎观看哔哩直播'

            # 检查数据是否有效
            if data.get('code') != 0 or not data.get('data') or not data['data'].get('playurl_info'):
                return self.handle_exception(Exception("获取播放地址失败"))

            setup = data['data']['playurl_info']['playurl']['stream']

            nam = 0
            line_count = 0

            for vod in setup:
                try:
                    # 获取该流的所有格式
                    formats = vod.get('format', [])
                    if nam >= len(formats):
                        continue
                    
                    format_data = formats[nam]
                    codecs = format_data.get('codec', [])
                    if not codecs:
                        continue
                    
                    codec = codecs[0]
                    url_info_list = codec.get('url_info', [])
                    base_url = codec.get('base_url', '')
                    
                    if not url_info_list or not base_url:
                        continue
                    
                    # 使用第二个url_info（通常是主线路）
                    if len(url_info_list) > 1:
                        host = url_info_list[1].get('host', '')
                        extra = url_info_list[1].get('extra', '')
                    else:
                        host = url_info_list[0].get('host', '')
                        extra = url_info_list[0].get('extra', '')
                    
                    if not host:
                        continue
                    
                    play_url = host + base_url + extra
                    line_count += 1
                    namc = f"{line_count}号线路"
                    bofang = bofang + namc + '$' + play_url + '#'
                    nam += 1
                except (KeyError, IndexError, Exception) as e:
                    continue

            if not bofang:
                return self.handle_exception(Exception("无可用播放线路"))

            bofang = bofang[:-1]  # 移除最后一个#
            xianlu = '哔哩专线'

            videos.append({
                "vod_id": f"bili@@{did}",
                "vod_content": content,
                "vod_play_from": xianlu,
                "vod_play_url": bofang
            })

            result['list'] = videos
            return result
        except Exception as e:
            print(f"B站详情错误: {e}")
            return self.handle_exception(e)

    def huyaDetail(self, ids):
        """
        虎牙播放详情 - 参考最新三合一.js重构
        支持多线路多清晰度选择
        """
        try:
            room_id = ids[1]
            
            api_url = f'{self.hosts[ids[0]][1]}/cache.php?m=Live&do=profileRoom&roomid={room_id}'
            res = self.fetch(api_url, headers=self.headers[0])
            
            if res.status_code != 200:
                return self.handle_exception(Exception(f"API请求失败: {res.status_code}"))
            
            data = res.json()
            if not data or not data.get('data'):
                return self.handle_exception(Exception("房间数据为空"))
            
            room_data = data['data']
            uid = room_data.get('profileInfo', {}).get('uid')
            stream_info = room_data.get('stream', {})
            live_data = room_data.get('liveData', {})
            
            if not uid:
                return self.handle_exception(Exception("缺少uid"))
            
            base_stream_list = stream_info.get('baseSteamInfoList', [])
            if not base_stream_list:
                return self.handle_exception(Exception("无直播流信息"))
            
            base_stream = base_stream_list[0]
            stream_name = base_stream.get('sStreamName')
            if not stream_name:
                return self.handle_exception(Exception("无法获取streamName"))
            
            vod = self.buildvod(
                vod_name=live_data.get('introduction', '虎牙直播'),
                type_name=live_data.get('gameFullName', ''),
                vod_director=live_data.get('nick', ''),
                vod_remarks=live_data.get('contentIntro', ''),
            )
            
            cdn_list = []
            for stream in base_stream_list:
                cdn_type = stream.get('sCdnType', 'AL')
                flv_url = stream.get('sFlvUrl', '')
                hls_url = stream.get('sHlsUrl', '')
                stream_name_cdn = stream.get('sStreamName', stream_name)
                
                if flv_url:
                    cdn_list.append({
                        'cdn': cdn_type,
                        'flv_base': flv_url,
                        'hls_base': hls_url,
                        'stream_name': stream_name_cdn,
                        'priority': stream.get('iWebPriorityRate', 0)
                    })
            
            cdn_list.sort(key=lambda x: x['priority'], reverse=True)
            
            rate_array = stream_info.get('rateArray', [])
            if not rate_array and 'vMultiStreamInfo' in room_data:
                rate_array = room_data['vMultiStreamInfo']
            
            if not rate_array:
                rate_array = [
                    {'sDisplayName': '蓝光4M', 'iBitRate': 4000},
                    {'sDisplayName': '蓝光', 'iBitRate': 3000},
                    {'sDisplayName': '超清', 'iBitRate': 2000},
                    {'sDisplayName': '高清', 'iBitRate': 1200},
                    {'sDisplayName': '流畅', 'iBitRate': 500}
                ]
            
            filtered_rates = []
            seen_bitrates = set()
            
            for rate in rate_array:
                bit_rate = rate.get('iBitRate', 0)
                name = rate.get('sDisplayName', '')
                
                if bit_rate in seen_bitrates:
                    continue
                
                if bit_rate == 2000 and ('高清' in name or '720' in name):
                    name = '超清'
                elif bit_rate == 1200 and ('标清' in name or '480' in name):
                    name = '高清'
                elif bit_rate == 2000 and name == '原画':
                    name = '超清'
                
                seen_bitrates.add(bit_rate)
                filtered_rates.append({
                    'sDisplayName': name,
                    'iBitRate': bit_rate
                })
            
            sorted_rates = sorted(filtered_rates, key=lambda x: x['iBitRate'], reverse=True)
            
            play_lines = []
            line_names = []
            
            for cdn_idx, cdn in enumerate(cdn_list[:3]):
                cdn_name = cdn['cdn']
                line_names.append(f"线路{cdn_idx + 1}({cdn_name})")
                
                qualities = []
                for rate in sorted_rates:
                    quality_name = rate['sDisplayName']
                    bit_rate = rate['iBitRate']
                    
                    quality_url = self._generate_huya_play_url(
                        cdn, uid, stream_name, bit_rate
                    )
                    
                    qualities.extend([quality_name, quality_url])
                
                encoded_qualities = self.e64(json.dumps(qualities))
                play_lines.append(f"{live_data.get('introduction', '直播')}${ids[0]}@@{encoded_qualities}")
            
            vod['vod_play_from'] = "$$$".join(line_names)
            vod['vod_play_url'] = "$$$".join(play_lines)
            
            return vod
            
        except Exception as e:
            return self.handle_exception(e)
    
    def _generate_huya_play_url(self, cdn, uid, stream_name, bit_rate):
        """生成虎牙播放URL"""
        flv_base = cdn['flv_base']
        stream = cdn['stream_name']
        
        timestamp = int(time.time())
        seqid = f"{uid}{timestamp}"
        ss = hashlib.md5(f"{seqid}|huya_adr|102".encode()).hexdigest()
        ws_time = hex(timestamp + 21600)[2:]
        
        ws_secret = hashlib.md5(
            f"DWq8BcJ3h6DJt6TY_{uid}_{stream_name}_{ss}_{ws_time}".encode()
        ).hexdigest()
        
        base_url = f"{flv_base}/{stream}.flv"
        
        if bit_rate > 0:
            ratio_param = f"ratio={bit_rate}"
        else:
            ratio_param = "ratio=2000"
        
        play_url = (
            f"{base_url}?{ratio_param}&wsSecret={ws_secret}&wsTime={ws_time}"
            f"&ctype=huya_adr&seqid={seqid}&uid={uid}"
            f"&fs=bgct&ver=1&t=102"
        )
        
        return play_url

    def douyuDetail(self, ids):
        """斗鱼播放详情"""
        try:
            channel = ids[1]
            headers = self.gethr(0, zr=f'{self.hosts[ids[0]]}/{channel}')
            
            session = {}
            
            try:
                home_res = self.fetch(f'{self.hosts[ids[0]]}/{channel}', headers=headers)
                if home_res.headers.get('Set-Cookie'):
                    cookie_str = home_res.headers.get('Set-Cookie')
                    did_match = re.search(r'dy_did=([a-f0-9]{32})', cookie_str)
                    if did_match:
                        device_id = did_match.group(1)
                    else:
                        device_id = self._generate_random_hex(32)
                else:
                    device_id = self._generate_random_hex(32)
            except:
                device_id = self._generate_random_hex(32)
            
            session['dy_did'] = device_id
            session['mantine-color-scheme-value'] = 'light'
            
            betard_res = self.fetch(f'{self.hosts[ids[0]]}/betard/{channel}', headers=headers).json()
            if not betard_res or not betard_res.get('room'):
                return self.handle_exception(Exception("获取房间信息失败"))
            
            room_info = betard_res['room']
            vname = room_info.get('room_name', '斗鱼直播')
            
            vod = self.buildvod(
                vod_name=vname,
                vod_remarks=room_info.get('second_lvl_name', ''),
                vod_director=room_info.get('nickname', ''),
            )
            
            sec_url = f"{self.hosts[ids[0]]}/wgapi/livenc/liveweb/websec/getEncryption?did={device_id}"
            sec_res = self.fetch(sec_url, headers=headers).json()
            
            if not sec_res or sec_res.get('error') != 0:
                return self.handle_exception(Exception("获取加密密钥失败"))
            
            security_data = sec_res['data']
            secret_key = security_data.get('key')
            random_str = security_data.get('rand_str')
            enc_time = security_data.get('enc_time', 1)
            enc_data = security_data.get('enc_data')
            
            current_time = int(time.time())
            
            current = random_str
            for _ in range(enc_time):
                current = hashlib.md5(f"{current}{secret_key}".encode()).hexdigest()
            
            signature = hashlib.md5(f"{current}{secret_key}{channel}{current_time}".encode()).hexdigest()
            
            play_payload = {
                'enc_data': enc_data,
                'tt': str(current_time),
                'did': device_id,
                'auth': signature,
                'cdn': '',
                'rate': '',
                'hevc': '0',
                'fa': '0',
                'ive': '0'
            }
            
            play_api = f"{self.hosts[ids[0]]}/lapi/live/getH5PlayV1/{channel}"
            
            play_headers = headers.copy()
            cookie_str = '; '.join([f"{k}={v}" for k, v in session.items()])
            play_headers['Cookie'] = cookie_str
            play_headers['Content-Type'] = 'application/x-www-form-urlencoded'
            
            play_res = requests.post(play_api, data=play_payload, headers=play_headers, timeout=10).json()
            
            if not play_res or play_res.get('error') != 0:
                play_res = self._try_legacy_douyu_api(channel, device_id, signature, current_time, play_headers)
                if not play_res:
                    return self.handle_exception(Exception("获取播放地址失败"))
            
            stream_info = play_res.get('data', {})
            
            rtmp_live = stream_info.get('rtmp_live', '')
            if rtmp_live:
                did_match = re.search(r'did=([a-f0-9]{32})', rtmp_live)
                if did_match and did_match.group(1) != device_id:
                    device_id = did_match.group(1)
                    session['dy_did'] = device_id
                    play_payload['did'] = device_id
                    play_res = requests.post(play_api, data=play_payload, headers=play_headers, timeout=10).json()
                    if play_res and play_res.get('error') == 0:
                        stream_info = play_res.get('data', {})
            
            stream_url = None
            if stream_info.get('rtmp_url') and stream_info.get('rtmp_live'):
                stream_url = f"{stream_info['rtmp_url']}/{stream_info['rtmp_live']}"
            elif stream_info.get('hls_url'):
                stream_url = stream_info['hls_url']
            
            if not stream_url:
                return self.handle_exception(Exception("无法获取播放地址"))
            
            multirates = stream_info.get('multirates', [])
            
            qualities = []
            
            if multirates:
                sorted_rates = sorted(multirates, key=lambda x: x.get('bit', 0), reverse=True)
                for rate in sorted_rates:
                    bit_rate = rate.get('rate', -1)
                    name = rate.get('name', f"{bit_rate}P")
                    qualities.extend([name, f"#{bit_rate}"])
            else:
                qualities = ['原画', '#-1']
            
            session_info = {
                'channel': channel,
                'device_id': device_id,
                'secret_key': secret_key,
                'random_str': random_str,
                'enc_time': enc_time,
                'enc_data': enc_data
            }
            encoded_session = self.e64(json.dumps(session_info))
            
            encoded_qualities = self.e64(json.dumps(qualities))
            vod['vod_play_from'] = '斗鱼直播'
            vod['vod_play_url'] = f"{vname}${ids[0]}@@{encoded_qualities}@@{encoded_session}"
            
            return vod
            
        except Exception as e:
            return self.handle_exception(e)
    
    def _generate_random_hex(self, length):
        """生成随机十六进制字符串"""
        hex_chars = '0123456789abcdef'
        return ''.join(random.choice(hex_chars) for _ in range(length))

    def _try_legacy_douyu_api(self, channel, device_id, signature, timestamp, headers):
        """尝试使用旧版API获取播放地址"""
        try:
            legacy_payload = {
                'did': device_id,
                'tt': str(timestamp),
                'sign': signature,
                'cdn': '',
                'rate': '-1',
                'ver': 'Douyu_223061205',
                'iar': '1',
                'ive': '1',
                'hevc': '0',
                'fa': '0'
            }
            legacy_api = f"https://www.douyu.com/lapi/live/getH5Play/{channel}"
            res = requests.post(legacy_api, data=legacy_payload, headers=headers, timeout=10)
            return res.json() if res.status_code == 200 else None
        except:
            return None
    
    def _get_douyu_play_url(self, channel, device_id, secret_key, random_str, enc_time, enc_data, rate):
        """获取斗鱼指定码率的播放URL"""
        try:
            current_time = int(time.time())
            
            current = random_str
            for _ in range(enc_time):
                current = hashlib.md5(f"{current}{secret_key}".encode()).hexdigest()
            
            signature = hashlib.md5(f"{current}{secret_key}{channel}{current_time}".encode()).hexdigest()
            
            play_payload = {
                'enc_data': enc_data,
                'tt': str(current_time),
                'did': device_id,
                'auth': signature,
                'cdn': '',
                'rate': str(rate) if rate > 0 else '',
                'hevc': '0',
                'fa': '0',
                'ive': '0'
            }
            
            play_api = f"https://www.douyu.com/lapi/live/getH5PlayV1/{channel}"
            
            headers = {
                'User-Agent': self.headers[0]['User-Agent'],
                'Referer': f'https://www.douyu.com/{channel}',
                'Origin': 'https://www.douyu.com',
                'Cookie': f'dy_did={device_id}; mantine-color-scheme-value=light',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            play_res = requests.post(play_api, data=play_payload, headers=headers, timeout=10).json()
            
            if not play_res or play_res.get('error') != 0:
                return self._get_douyu_play_url_legacy(channel, device_id, signature, current_time, rate)
            
            stream_info = play_res.get('data', {})
            
            if stream_info.get('rtmp_live'):
                did_match = re.search(r'did=([a-f0-9]{32})', stream_info['rtmp_live'])
                if did_match and did_match.group(1) != device_id:
                    return self._get_douyu_play_url(channel, did_match.group(1), secret_key, random_str, enc_time, enc_data, rate)
            
            if stream_info.get('rtmp_url') and stream_info.get('rtmp_live'):
                return f"{stream_info['rtmp_url']}/{stream_info['rtmp_live']}"
            elif stream_info.get('hls_url'):
                return stream_info['hls_url']
            
            return None
        except Exception as e:
            print(f"获取斗鱼播放URL失败: {e}")
            return None
    
    def _get_douyu_play_url_legacy(self, channel, device_id, signature, timestamp, rate):
        """使用旧版API获取斗鱼播放URL"""
        try:
            legacy_payload = {
                'did': device_id,
                'tt': str(timestamp),
                'sign': signature,
                'cdn': '',
                'rate': str(rate) if rate > 0 else '-1',
                'ver': 'Douyu_223061205',
                'iar': '1',
                'ive': '1',
                'hevc': '0',
                'fa': '0'
            }
            legacy_api = f"https://www.douyu.com/lapi/live/getH5Play/{channel}"
            
            headers = {
                'User-Agent': self.headers[0]['User-Agent'],
                'Referer': f'https://www.douyu.com/{channel}',
                'Cookie': f'dy_did={device_id}',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
            
            res = requests.post(legacy_api, data=legacy_payload, headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data.get('error') == 0:
                    stream_info = data.get('data', {})
                    if stream_info.get('rtmp_url') and stream_info.get('rtmp_live'):
                        return f"{stream_info['rtmp_url']}/{stream_info['rtmp_live']}"
            return None
        except:
            return None

    def process_douyu(self):
        try:
            self.dyufdata = self.fetch(
                f'{self.referers["douyu"]}/api/cate/list',
                headers=self.headers[1]
            ).json()
            return ('douyu', [{'key': 'cate', 'name': '分类',
                               'value': [{'n': i['cate1Name'], 'v': str(i['cate1Id'])}
                                         for i in self.dyufdata['data']['cate1Info']]}])
        except Exception as e:
            print(f"douyu错误: {e}")
            return 'douyu', None

    def searchContent(self, key, quick, pg="1"):
        pass

    def playerContent(self, flag, id, vipFlags):
        try:
            ids = id.split('@@')
            p = 1
            if ids[0] in ['wangyi']:
                p, url = 0, json.loads(self.d64(ids[1]))
            elif ids[0] == 'bili':
                p, url = self.biliplay(ids)
            elif ids[0] == 'huya':
                p, url = self.huyaplay(ids)
            elif ids[0] == 'douyu':
                p, url = self.douyuplay(ids)
            return {'parse': p, 'url': url, 'header': self.playheaders[ids[0]]}
        except Exception as e:
            return {'parse': 1, 'url': self.excepturl, 'header': self.headers[0]}

    def biliplay(self, ids):
        """严格按哔哩直播.py实现 - 直接返回URL"""
        try:
            # ids[1] 是播放URL
            return 0, ids[1]
        except Exception as e:
            print(f"B站播放解析错误: {e}")
            return 1, self.excepturl

    def huyaplay(self, ids):
        """虎牙播放解析"""
        try:
            decoded = json.loads(self.d64(ids[1]))
            return 0, decoded
        except Exception as e:
            print(f"虎牙播放解析错误: {e}")
            return 1, self.excepturl

    def douyuplay(self, ids):
        """斗鱼播放解析"""
        try:
            if len(ids) < 3:
                decoded = json.loads(self.d64(ids[1]))
                return 0, decoded
            
            qualities = json.loads(self.d64(ids[1]))
            session_info = json.loads(self.d64(ids[2]))
            
            channel = session_info['channel']
            device_id = session_info['device_id']
            secret_key = session_info['secret_key']
            random_str = session_info['random_str']
            enc_time = session_info['enc_time']
            enc_data = session_info['enc_data']
            
            result = []
            for i in range(0, len(qualities), 2):
                name = qualities[i]
                rate_marker = qualities[i + 1]
                
                if rate_marker.startswith('#'):
                    rate = int(rate_marker[1:])
                else:
                    rate = -1
                
                play_url = self._get_douyu_play_url(
                    channel, device_id, secret_key, random_str, 
                    enc_time, enc_data, rate
                )
                
                if play_url:
                    result.extend([name, play_url])
            
            if not result:
                return 1, self.excepturl
            
            return 0, result
        except Exception as e:
            print(f"斗鱼播放解析错误: {e}")
            return 1, self.excepturl

    def localProxy(self, param):
        pass

    def e64(self, text):
        try:
            text_bytes = text.encode('utf-8')
            encoded_bytes = b64encode(text_bytes)
            return encoded_bytes.decode('utf-8')
        except Exception as e:
            print(f"Base64编码错误: {str(e)}")
            return ""

    def d64(self, encoded_text):
        try:
            encoded_bytes = encoded_text.encode('utf-8')
            decoded_bytes = b64decode(encoded_bytes)
            return decoded_bytes.decode('utf-8')
        except Exception as e:
            print(f"Base64解码错误: {str(e)}")
            return ""

    def josn_to_params(self, params, skip_empty=False):
        query = []
        for k, v in params.items():
            if skip_empty and not v:
                continue
            query.append(f"{k}={v}")
        return "&".join(query)

    def params_to_json(self, query_string):
        parsed_data = parse_qs(query_string)
        result = {key: value[0] for key, value in parsed_data.items()}
        return result

    def buildvod(self, vod_id='', vod_name='', vod_pic='', vod_year='', vod_tag='', vod_remarks='', style='',
                 type_name='', vod_area='', vod_actor='', vod_director='',
                 vod_content='', vod_play_from='', vod_play_url=''):
        vod = {
            'vod_id': vod_id,
            'vod_name': vod_name,
            'vod_pic': vod_pic,
            'vod_year': vod_year,
            'vod_tag': 'folder' if vod_tag else '',
            'vod_remarks': vod_remarks,
            'style': style,
            'type_name': type_name,
            'vod_area': vod_area,
            'vod_actor': vod_actor,
            'vod_director': vod_director,
            'vod_content': vod_content,
            'vod_play_from': vod_play_from,
            'vod_play_url': vod_play_url
        }
        vod = {key: value for key, value in vod.items() if value}
        return vod

    def getpq(self, url, headers=None, cookies=None):
        data = self.fetch(url, headers=headers, cookies=cookies).text
        try:
            return pq(data)
        except Exception as e:
            print(f"解析页面错误: {str(e)}")
            return pq(data.encode('utf-8'))

    def gethr(self, index, rf='', zr=''):
        headers = self.headers[index]
        if zr:
            headers['referer'] = zr
        else:
            headers['referer'] = f"{self.referers[rf]}/"
        return headers

    def handle_exception(self, e):
        print(f"报错: {str(e)}")
        return {'vod_play_from': '哎呀翻车啦', 'vod_play_url': f'翻车啦${self.excepturl}'}