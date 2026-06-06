# -*- coding: utf-8 -*-
import sys
import requests
import base64
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.append('..')
from base.spider import Spider as BaseSpider

requests.packages.urllib3.disable_warnings(requests.packages.urllib3.exceptions.InsecureRequestWarning)


class Spider(BaseSpider):

    def __init__(self):
        super().__init__()
        self.site = "https://pinglian.lol"
        self.api_list = f"{self.site}/api/get_videos.php"
        self.api_pan = f"{self.site}/api/search_pan_links.php"
        self.check_api = ""
        self.username = ""  # 你提供的账号
        self.password = ""           # 你提供的密码
        self.enable_check = True
        self.ua = (
            "Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro Build/BP1A.250305.019) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.7743.101 Mobile Safari/537.36"
        )
        self.session = requests.Session()
        self.session.verify = False
        self.session.headers.update({
            "User-Agent": self.ua,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "*/*",
            "Referer": f"{self.site}/all-videos.php",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Dest": "empty",
            "sec-ch-ua": '"Android WebView";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": '"Android"',
            "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        })

        self.channels = {
            "1": "电影",
            "2": "电视剧",
            "3": "综艺",
            "4": "动漫",
        }

        self.session.cookies.set("announcement_dismissed", "true", domain="pinglian.lol", path="/")

    def init(self, extend=""):
        if extend:
            try:
                cfg = json.loads(extend)
                if isinstance(cfg, dict):
                    self.username = cfg.get("username", self.username)
                    self.password = cfg.get("password", self.password)
                    self.check_api = cfg.get("check_api", self.check_api)
                    self.enable_check = cfg.get("enable_check", self.enable_check)
            except Exception:
                pass

        if self.username and self.password:
            if not self._login():
                print("⚠️ 自动登录失败，将采用未登录状态抓取。")
        else:
            print("⚠️ 未提供账号密码，跳过登录。")
        return self

    def getName(self):
        return "pinglian"

    def isVideoFormat(self, url):
        return False

    def manualVideoCheck(self):
        return False

    def destroy(self):
        self.session.close()

    def _login(self):
        try:
            self.session.get(self.site, timeout=10)
            time.sleep(0.3)

            login_url = f"{self.site}/api/login.php"
            login_data = {
                "username": self.username,
                "password": self.password,
                "remember": "on"
            }
            resp = self.session.post(login_url, data=login_data, timeout=10)
            result = resp.json()

            if result.get("success"):
                print(f"✅ 登录成功，用户：{result['user']['username']}")
                return True
            else:
                print(f"❌ 登录失败: {result.get('message')}")
                return False
        except Exception as e:
            print(f"❌ 登录异常: {e}")
            return False

    def _b64e(self, obj):
        if isinstance(obj, str):
            text = obj
        else:
            text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
        return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")

    def _b64d(self, s):
        try:
            s += "=" * (-len(s) % 4)
            return json.loads(base64.urlsafe_b64decode(s.encode()).decode())
        except:
            return s

    def _safe_title(self, title):
        return title.replace("#", "＃").replace("$", "￥")

    def _check_links(self, links, disk_type, batch_size=30):
        if not links:
            return []
        valid_urls = []
        for i in range(0, len(links), batch_size):
            batch = links[i:i + batch_size]
            try:
                items = [{"disk_type": disk_type, "url": url} for url in batch]
                resp = requests.post(
                    self.check_api,
                    json={"items": items},
                    headers={"User-Agent": self.ua, "Accept": "application/json, text/plain, */*"},
                    timeout=15,
                    verify=False
                )
                data = resp.json()
                batch_valid = [
                    r["url"]
                    for r in data.get("results", [])
                    if r.get("state") == "ok"
                ]
            except Exception:
                batch_valid = batch
            valid_urls.extend(batch_valid)
        return valid_urls

    def _process_disk(self, disk_key, disk_info):
        """返回 (disk_name, episode_string) 或 (None, None)"""
        links = disk_info.get("links", [])
        if not links:
            return None, None

        raw_urls = []
        seen_urls = set()
        for link in links:
            url = link.get("url", "")
            if url and url not in seen_urls:
                raw_urls.append(url)
                seen_urls.add(url)

        SKIP_CHECK_DISKS = {"others", "guangya"}

        if self.enable_check and disk_key not in SKIP_CHECK_DISKS:
            check_urls = raw_urls[:20]
            valid_urls = self._check_links(check_urls, disk_type=disk_key)
        else:
            valid_urls = raw_urls   
        if not valid_urls:
            return None, None

        valid_url_set = set(valid_urls)
        valid_links = [link for link in links if link.get("url", "") in valid_url_set]
        if not valid_links:
            return None, None

        disk_name = disk_info.get("name", disk_key)
        episode_parts = []
        for link in valid_links:
            title = link.get("title", disk_name)
            url = link["url"]
            pwd = link.get("password", "")
            if pwd and "pwd=" not in url and "password=" not in url:
                if "?" in url:
                    url += f"&pwd={pwd}"
                else:
                    url += f"?pwd={pwd}"
            encoded_url = self._b64e(url)
            safe_title = self._safe_title(title)
            episode_parts.append(f"{safe_title}${encoded_url}")

        if episode_parts:
            # ===== 新增：插入占位，防止自动播放 =====
            # 在每个盘的第一个资源前插入 "点击选择$noop"
            episode_parts.insert(0, "点击选择$noop")
            return disk_name, "#".join(episode_parts)
        return None, None

    def _fetch_list(self, t=None, wd=None, page=1):
        params = {"pg": page}
        if wd:
            params["wd"] = wd
        elif t:
            params["t"] = t
        else:
            return {"list": [], "page": page, "pagecount": 0, "total": 0}

        try:
            resp = self.session.get(self.api_list, params=params, timeout=15)
            data = resp.json()
            if data.get("code") == 1:
                return {
                    "list": data.get("list", []),
                    "page": data.get("page", page),
                    "pagecount": data.get("pagecount", 1),
                    "total": data.get("total", 0),
                }
            else:
                return {"list": [], "page": page, "pagecount": 0, "total": 0}
        except Exception as e:
            return {"list": [], "page": page, "pagecount": 0, "total": 0}

    def _fetch_pan_links(self, keyword, vod_id):
        """并发获取所有网盘链接，夸克优先"""
        try:
            params = {"keyword": keyword, "vod_id": vod_id, "_t": int(time.time() * 1000)}
            resp = self.session.get(self.api_pan, params=params, timeout=10)
            data = resp.json()
            if not data.get("success"):
                return "", ""

            pan_data = data.get("data", {})

            preferred_order = ["quark"]
            sorted_items = []
            for key in preferred_order:
                if key in pan_data:
                    sorted_items.append((key, pan_data.pop(key)))
            sorted_items.extend(pan_data.items())

            from_parts = []
            url_parts = []

            with ThreadPoolExecutor(max_workers=4) as executor:
                results = executor.map(lambda args: self._process_disk(*args), sorted_items)
                for disk_name, episodes in results:
                    if disk_name and episodes:
                        from_parts.append(disk_name)
                        url_parts.append(episodes)

            play_from = "$$$".join(from_parts)
            play_url = "$$$".join(url_parts)
            return play_from, play_url
        except Exception as e:
            print(f"获取网盘链接异常: {e}")
            return "", ""

    def homeContent(self, filter):
        class_list = [{"type_name": v, "type_id": k} for k, v in self.channels.items()]
        return {"class": class_list, "filters": {}}

    def homeVideoContent(self):
        lst = []
        result = self._fetch_list(t="1", page=1)
        for item in result["list"][:10]:
            lst.append({
                "vod_id": self._b64e(item),
                "vod_name": item.get("vod_name", ""),
                "vod_pic": item.get("vod_pic", ""),
                "vod_remarks": item.get("vod_remarks", ""),
            })
        return {"list": lst}

    def categoryContent(self, tid, pg, filter, extend):
        if tid not in self.channels:
            return {"list": [], "page": 1, "pagecount": 0, "limit": 20, "total": 0}
        page = int(pg) if pg and pg.isdigit() else 1
        result = self._fetch_list(t=tid, page=page)
        vod_list = []
        for item in result["list"]:
            vod_list.append({
                "vod_id": self._b64e(item),
                "vod_name": item.get("vod_name", ""),
                "vod_pic": item.get("vod_pic", ""),
                "vod_remarks": item.get("vod_remarks", ""),
            })
        return {
            "list": vod_list,
            "page": page,
            "pagecount": result["pagecount"],
            "limit": 30,
            "total": result["total"]
        }

    def searchContent(self, key, quick, pg="1"):
        if not key:
            return {"list": [], "page": 1, "pagecount": 0, "limit": 20, "total": 0}
        result = self._fetch_list(wd=key, page=1)
        vod_list = []
        for item in result["list"]:
            vod_list.append({
                "vod_id": self._b64e(item),
                "vod_name": item.get("vod_name", ""),
                "vod_pic": item.get("vod_pic", ""),
                "vod_remarks": item.get("vod_remarks", ""),
            })
        return {
            "list": vod_list,
            "page": 1,
            "pagecount": result["pagecount"],
            "limit": len(vod_list) if vod_list else 20,
            "total": result["total"]
        }

    def detailContent(self, ids):
        vid = ids[0]
        item = self._b64d(vid)
        if not item or not isinstance(item, dict):
            return {"list": []}
        title = item.get("vod_name", "")
        local_id = item.get("vod_id")
        pan_from, pan_url = "", ""
        if local_id and title:
            pan_from, pan_url = self._fetch_pan_links(title, local_id)
        if not pan_from:
            pan_from = "暂无播放源"
            pan_url = ""
        return {"list": [{
            "vod_id": vid,
            "vod_name": title,
            "vod_pic": item.get("vod_pic", ""),
            "vod_year": item.get("vod_year", ""),
            "vod_area": item.get("vod_area", ""),
            "vod_actor": item.get("vod_actor", ""),
            "vod_content": item.get("vod_content", ""),
            "vod_remarks": f"{item.get('vod_remarks', '')} {item.get('vod_score', '')}",
            "vod_play_from": pan_from,
            "vod_play_url": pan_url,
        }]}

    def playerContent(self, flag, id, vipFlags):
        # ===== 新增：处理 noop 占位 =====
        if id == "noop" or not id:
            return {"parse": 1, "jx": 0, "url": ""}

        try:
            padded = id + "=" * (-len(id) % 4)
            decoded_bytes = base64.urlsafe_b64decode(padded)
            url = decoded_bytes.decode()
        except:
            url = id
        if isinstance(url, str):
            try:
                obj = json.loads(url)
                if isinstance(obj, dict):
                    url = obj.get("url", "")
            except:
                pass
        if isinstance(url, str) and url.startswith("http"):
            if not url.startswith("push://"):
                url = "push://" + url
            return {"parse": 0, "jx": 0, "url": url}
        if isinstance(url, str) and url.startswith("magnet:"):
            return {"parse": 0, "jx": 0, "url": url}
        return {"parse": 0, "jx": 0, "url": ""}