# Tek seferlik: Gazze 1940'lar foto-mozaiği (517 Field Survey Coy.) ve 1917 haritası, yüksek çözünürlükte
import json, os, re, time, urllib.parse, urllib.request
os.makedirs("tarama/m", exist_ok=True)
UA = "alboroto-tarama/1.0 (+https://alborotonews.com)"
def api(q):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**q, "format": "json"})
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read())
for ad, t, gen in [("mozaik", "File:Great Britain army 517 Field Survey Company, Gaza (FL53910466 2714141).jpg", 7000),
                   ("gazze1917", "File:Gaza City 1917, British army map, from aerial photograph.jpg", 4000),
                   ("dirsuneyd1918", "File:DayrSunayd-1918.jpg", 1128), ("dirsuneyd1945", "File:DayrSunayd-1945.jpg", 880)]:
    v = api({"action": "query", "titles": t, "prop": "imageinfo|revisions", "rvprop": "content", "rvslots": "main", "iiprop": "url|extmetadata", "iiurlwidth": gen})
    p = list(v["query"]["pages"].values())[0]
    ii = p["imageinfo"][0]
    open(f"tarama/m/{ad}.txt", "w").write(p["revisions"][0]["slots"]["main"]["*"] + "\n\n" + json.dumps(ii.get("extmetadata"), ensure_ascii=False)[:6000])
    time.sleep(2)
    u = ii.get("thumburl") or ii["url"]
    open(f"tarama/m/{ad}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=120).read())
    print(ad, os.path.getsize(f"tarama/m/{ad}.jpg"))
