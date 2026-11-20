# Tek seferlik: Commons'ta görsel adayları; künye + 900 px kopya + temas sayfası
import json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw
os.makedirs("tarama/c", exist_ok=True)
UA = "alboroto-tarama/1.0 (+https://alborotonews.com)"
def api(q):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**q, "format": "json"})
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read())
ARA = {"intifada": ["Second Intifada 2000 protest", "Al-Aqsa Intifada 2000", "Second Intifada Ramallah 2002", "intifada 2001 Palestinian demonstration", "Jenin 2002 camp"],
       "leyla": ["Leila Khaled 1970", "Leila Khaled young", "Leila Khaled"],
       "serm": ["Sharm el-Sheikh Peace Summit 2025", "Trump Sharm el-Sheikh October 2025", "Trump Knesset October 2025", "Gaza peace summit 2025 signing"],
       "faysal": ["King Faisal of Saudi Arabia", "Faisal bin Abdulaziz 1973"],
       "enerji": ["Leviathan gas field platform", "Leviathan platform Israel", "Abraham Accords signing", "Abraham Accords White House 2020", "Gaza Marine gas", "East Mediterranean Gas Forum"]}
liste = []
for grup, sorgular in ARA.items():
    gor = set()
    for s in sorgular:
        v = api({"action": "query", "list": "search", "srsearch": s, "srnamespace": 6, "srlimit": 12})
        for x in v["query"]["search"]:
            if x["title"] not in gor and not re.search(r"\.(pdf|djvu|svg|webm|ogv)$", x["title"], re.I):
                gor.add(x["title"]); liste.append({"grup": grup, "t": x["title"]})
temiz = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()
for i in range(0, len(liste), 40):
    parca = liste[i:i + 40]
    v = api({"action": "query", "titles": "|".join(x["t"] for x in parca), "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 900})
    sayfa = {p["title"]: p for p in v["query"]["pages"].values()}
    for n in v["query"].get("normalized", []):
        if n["to"] in sayfa: sayfa[n["from"]] = sayfa[n["to"]]
    for x in parca:
        p = sayfa.get(x["t"]) or {}; ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata") or {}
        g = lambda k: temiz((md.get(k) or {}).get("value"))[:260]
        x.update({"thumb": ii.get("thumburl"), "w": ii.get("width"), "h": ii.get("height"), "lisans": g("LicenseShortName"), "yazar": g("Artist"),
                  "tarih": g("DateTimeOriginal"), "aciklama": g("ImageDescription"), "kaynak": g("Credit")})
liste = [x for x in liste if x.get("thumb")]
for n, x in enumerate(liste):
    time.sleep(1.2)
    try:
        open(f"tarama/c/{n:03d}.jpg", "wb").write(urllib.request.urlopen(urllib.request.Request(x["thumb"], headers={"User-Agent": UA}), timeout=60).read()); x["n"] = n
    except Exception as e:
        print("indirilemedi", x["t"], e)
json.dump(liste, open("tarama/c/liste.json", "w"), ensure_ascii=False, indent=1)
for grup in ARA:
    ims = [x for x in liste if x["grup"] == grup and "n" in x]
    for s in range(0, len(ims), 20):
        kt = Image.new("RGB", (5 * 260, 4 * 280), "white"); d = ImageDraw.Draw(kt)
        for k, x in enumerate(ims[s:s + 20]):
            try:
                im = Image.open(f"tarama/c/{x['n']:03d}.jpg").convert("RGB"); im.thumbnail((250, 250))
            except Exception:
                continue
            X, Y = (k % 5) * 260, (k // 5) * 280; kt.paste(im, (X, Y)); d.text((X + 4, Y + 254), f"{x['n']:03d}", fill=(200, 0, 0))
        kt.save(f"tarama/c/temas-{grup}-{s // 20}.jpg", quality=80)
print(len(liste))
