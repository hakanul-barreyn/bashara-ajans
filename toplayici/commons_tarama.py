"""Tek seferlik: tarihçe için Commons'ta aday görsel taraması. Her sorgu için küçük resimleri numaralı bir kontrol tablosuna dizer
(tarama/<no>.jpg) ve listeyi tarama/liste.json'a yazar. Ayrıca 1947 taksim planı için açık sınır verisi arar (Commons Data:, OpenHistoricalMap).
Siteye bir şey yazmaz; çıktı yz-durum dalına gider."""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw

UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
SORGULAR = [
    "Nakba 1948 Palestinian refugees", "Palestinian refugees 1948 camp", "UNRWA archive refugees 1948", "Palestinian exodus 1948 Jaffa",
    "Lydda Ramle 1948 Palestinians", "Palestinian refugee camp 1950s", "Nakba Day march", "Deir Yassin",
    "First Intifada 1987", "Intifada 1988 West Bank", "Intifada stone throwing 1987 Gaza", "Second Intifada 2000", "al-Aqsa Intifada 2000 protest",
    "Oslo Accords signing 1993", "Rabin Arafat Clinton White House 1993", "Oslo II 1995 signing", "Rhodes armistice 1949", "Israel Egypt armistice 1949",
    "Camp David Accords 1978", "Egypt Israel peace treaty 1979 signing", "Cairo Agreement 1969 Arafat", "San Remo conference 1920", "Sykes Picot map 1916",
    "Gaza war protest 2023", "Gaza ceasefire demonstration 2023", "Gaza Strip destruction 2023 buildings", "Gaza 2024 rubble", "Free Palestine march 2024",
    "Great March of Return Gaza 2018", "King Farouk", "Free Officers 1952 Egypt", "Naguib Nasser 1953", "Gaza 2005 disengagement settlement",
    "Jerusalem 1917 surrender", "Ottoman Jerusalem 1900 photochrom", "Jaffa 1900 photochrom", "Arab revolt 1936 Palestine strike",
    "Land Day 1976", "Karameh 1968", "Beirut 1982 PLO evacuation", "Sabra Shatila memorial", "Arafat United Nations 1974",
]
YASAK = re.compile(r"IDF|Israel Defense Forces|Government Press Office|GPO|\bצה\"ל|Hamas|al-Qassam Brigades|Qassam Brigades|Quds Brigades|CCTV|Hezbollah media", re.I)


def al(url, n=5):
    for d in range(n):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=40) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep([2, 6, 15, 30, 45][d]); continue
            return None
        except Exception:
            time.sleep(2)
    return None


def api(q):
    b = al("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
    return json.loads(b) if b else {}


os.makedirs("tarama", exist_ok=True)
liste = []
for si, s in enumerate(SORGULAR):
    v = api({"action": "query", "format": "json", "generator": "search", "gsrsearch": s + " filetype:bitmap", "gsrnamespace": 6, "gsrlimit": 24,
             "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 260})
    ps = sorted((v.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    hucre = []
    for p in ps:
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        g = lambda k: re.sub(r"<[^>]+>", "", (md.get(k) or {}).get("value") or "")[:220]
        x = {"s": si, "n": len(hucre), "t": p.get("title"), "w": ii.get("width"), "h": ii.get("height"), "lisans": g("LicenseShortName"),
             "yazar": g("Artist"), "kaynak": g("Credit"), "tarih": g("DateTimeOriginal"), "acik": g("ImageDescription")[:160]}
        if YASAK.search(x["yazar"] + " " + x["kaynak"] + " " + (x["t"] or "")) or not x["lisans"]:
            continue
        b = al(ii.get("thumburl") or "")
        time.sleep(0.4)
        if not b:
            continue
        try:
            im = Image.open(io.BytesIO(b)).convert("RGB")
        except Exception:
            continue
        im.thumbnail((260, 200))
        hucre.append(im); liste.append(x)
    if not hucre:
        continue
    K, HW, HH = 6, 270, 230
    sat = (len(hucre) + K - 1) // K
    tab = Image.new("RGB", (K * HW, sat * HH + 30), (30, 30, 30))
    d = ImageDraw.Draw(tab)
    d.text((8, 8), f"{si}: {s}", fill=(255, 220, 120))
    for i, im in enumerate(hucre):
        x0, y0 = (i % K) * HW + 5, (i // K) * HH + 34
        tab.paste(im, (x0, y0))
        d.rectangle([x0, y0, x0 + 26, y0 + 16], fill=(0, 0, 0)); d.text((x0 + 4, y0 + 3), str(i), fill=(255, 255, 0))
    tab.save(f"tarama/{si:02d}.jpg", quality=80)
    print(si, s, len(hucre), flush=True)
json.dump(liste, open("tarama/liste.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# 1947 taksim planı: açık sınır verisi
sinir = {}
v = api({"action": "query", "format": "json", "list": "search", "srsearch": "partition Palestine", "srnamespace": 486, "srlimit": 20})
sinir["commons_data"] = [x["title"] for x in (v.get("query") or {}).get("search", [])]
for t in sinir["commons_data"][:6]:
    b = al("https://commons.wikimedia.org/w/index.php?" + urllib.parse.urlencode({"title": t, "action": "raw"}))
    if b:
        open("tarama/" + re.sub(r"[^\w.-]+", "_", t)[:80], "wb").write(b)
q = '[out:json][timeout:90];(relation(29.3,34.0,33.6,36.0)["name"~"Arab State|Jewish State|Corpus Separatum|Partition|Teilungsplan",i];' \
    'relation(29.3,34.0,33.6,36.0)["name:en"~"Arab State|Jewish State|Corpus Separatum|Partition",i];);out tags;'
for ep in ["https://overpass-api.openhistoricalmap.org/api/interpreter"]:
    b = None
    try:
        b = urllib.request.urlopen(urllib.request.Request(ep, data=urllib.parse.urlencode({"data": q}).encode(), headers={"User-Agent": UA}), timeout=120).read()
    except Exception as e:
        sinir["ohm_hata"] = str(e)
    if b:
        v = json.loads(b)
        sinir["ohm"] = [{"id": e["id"], "tags": e.get("tags")} for e in v.get("elements", [])]
        for e in v.get("elements", [])[:8]:
            q2 = f"[out:json][timeout:90];relation({e['id']});out geom;"
            try:
                g = urllib.request.urlopen(urllib.request.Request(ep, data=urllib.parse.urlencode({"data": q2}).encode(), headers={"User-Agent": UA}), timeout=120).read()
                open(f"tarama/ohm-{e['id']}.json", "wb").write(g)
            except Exception as ex:
                sinir.setdefault("ohm_geom_hata", []).append(str(ex))
json.dump(sinir, open("tarama/sinir.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(sinir)
