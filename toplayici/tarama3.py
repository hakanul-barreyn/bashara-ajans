"""Tek seferlik: tarihçe için (1) Commons aday görsel taraması (kontrol tabloları), (2) Oslo bölgeleri haritaları (izlemek için büyük),
(3) Landsat 5 ile Gazze yerleşimleri 2004 (tahliye öncesi) ve 2006 (yıkım sonrası) görüntüleri (Microsoft Planetary Computer, anahtarsız).
Çıktı: tarama/ (yz-tarama dalı). Siteye bir şey yazmaz."""
import io, json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw

UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
os.makedirs("tarama", exist_ok=True)


def al(url, n=5, veri=None, bas=None):
    for d in range(n):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=veri, headers=dict({"User-Agent": UA}, **(bas or {}))), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep([2, 6, 15, 30, 45][d]); continue
            print("HTTP", e.code, url[:120]); return None
        except Exception as e:
            print("hata", e, url[:120]); time.sleep(2)
    return None


def api(q):
    b = al("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q))
    return json.loads(b) if b else {}


SORGULAR = ["Allenby entering Jerusalem 1917", "Jerusalem 1917 British entry Jaffa Gate", "Arab Higher Committee 1936", "Izz ad-Din al-Qassam",
            "1936 Palestine general strike", "Arab revolt Palestine 1938", "Palestinian rebels 1936", "Qassam grave Balad al-Sheikh",
            "Protests in Cairo against the UN partition of Palestine", "Nakba 1948 Galilee refugees", "Palestinian refugees 1949 tents",
            "Nasser Port Said 1956", "Suez crisis 1956 Port Said", "Nasser crowd 1958", "Sinai 1967 Egyptian army", "Six Day War 1967 Egypt",
            "1973 October war Suez canal crossing", "Bar Lev line 1973", "Sinai withdrawal 1982", "Fedayeen 1969 Jordan", "Leila Khaled",
            "Palestinian fighters 1970 Jordan", "Dome of the Rock 1980s", "Al-Aqsa mosque 1980", "Ahmed Yassin", "Hamas founding 1987",
            "Gaza City destruction October 2023", "Gaza 2023 airstrike buildings", "Ottoman soldiers Palestine 1917", "Ottoman Gaza 1917 battle",
            "Oslo II Accord West Bank areas map", "West Bank Area C map", "Areas A B C West Bank map"]
YASAK = re.compile(r"IDF|Israel Defense Forces|Government Press Office|\bGPO\b|Hamas|Qassam Brigades|Quds Brigades|CCTV|Hezbollah", re.I)
liste = []
for si, s in enumerate(SORGULAR):
    v = api({"action": "query", "format": "json", "generator": "search", "gsrsearch": s, "gsrnamespace": 6, "gsrlimit": 18,
             "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 260})
    ps = sorted((v.get("query") or {}).get("pages", {}).values(), key=lambda p: p.get("index", 99))
    hucre = []
    for p in ps:
        ii = (p.get("imageinfo") or [{}])[0]
        if not str(ii.get("mime", "")).startswith("image/"):
            continue
        md = ii.get("extmetadata") or {}
        g = lambda k: re.sub(r"<[^>]+>", "", (md.get(k) or {}).get("value") or "")[:220]
        x = {"s": si, "n": len(hucre), "t": p.get("title"), "w": ii.get("width"), "h": ii.get("height"), "lisans": g("LicenseShortName"),
             "yazar": g("Artist"), "kaynak": g("Credit"), "tarih": g("DateTimeOriginal"), "acik": g("ImageDescription")[:160]}
        if YASAK.search(x["yazar"] + " " + x["kaynak"]) or not x["lisans"]:
            continue
        b = al(ii.get("thumburl") or "")
        time.sleep(0.3)
        if not b:
            continue
        try:
            im = Image.open(io.BytesIO(b)).convert("RGB")
        except Exception:
            continue
        im.thumbnail((260, 200)); hucre.append(im); liste.append(x)
    if not hucre:
        continue
    K, HW, HH = 6, 270, 230
    tab = Image.new("RGB", (K * HW, ((len(hucre) + K - 1) // K) * HH + 30), (30, 30, 30)); d = ImageDraw.Draw(tab)
    d.text((8, 8), f"{si}: {s}", fill=(255, 220, 120))
    for i, im in enumerate(hucre):
        x0, y0 = (i % K) * HW + 5, (i // K) * HH + 34
        tab.paste(im, (x0, y0)); d.rectangle([x0, y0, x0 + 26, y0 + 16], fill=(0, 0, 0)); d.text((x0 + 4, y0 + 3), str(i), fill=(255, 255, 0))
    tab.save(f"tarama/{si:02d}.jpg", quality=80)
    print(si, s, len(hucre), flush=True)
    # harita sorgularında ilk adayları büyük indir (izlemek için)
    if "map" in s.lower():
        for x in [y for y in liste if y["s"] == si][:5]:
            v2 = api({"action": "query", "format": "json", "titles": x["t"], "prop": "imageinfo", "iiprop": "url", "iiurlwidth": 2600})
            for p in (v2.get("query") or {}).get("pages", {}).values():
                ii = (p.get("imageinfo") or [{}])[0]; b = al(ii.get("thumburl") or ii.get("url") or "")
                if b:
                    open(f"tarama/harita-{si:02d}-{x['n']}.png", "wb").write(b)
json.dump(liste, open("tarama/liste.json", "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# Landsat 5: Gazze yerleşimleri öncesi / sonrası
try:
    import numpy as np, rasterio
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds
    tok = json.loads(al("https://planetarycomputer.microsoft.com/api/sas/v1/token/landsat-c2-l2"))["token"]
    BOL = {"gushkatif": [34.22, 31.27, 34.36, 31.39], "netzarim": [34.36, 31.43, 34.47, 31.50], "kuzey": [34.47, 31.55, 34.58, 31.62]}
    ARALIK = {"2004": "2004-03-01/2005-07-31", "2006": "2006-01-01/2007-06-30"}
    meta = {}
    for ad, aralik in ARALIK.items():
        govde = {"collections": ["landsat-c2-l2"], "bbox": [34.2, 31.25, 34.6, 31.65], "datetime": aralik, "limit": 50,
                 "query": {"eo:cloud_cover": {"lt": 5}, "platform": {"in": ["landsat-5"]}}}
        r = json.loads(al("https://planetarycomputer.microsoft.com/api/stac/v1/search", veri=json.dumps(govde).encode(), bas={"Content-Type": "application/json"}))
        fs = sorted(r.get("features", []), key=lambda f: f["properties"].get("eo:cloud_cover", 99))
        print("landsat", ad, len(fs), [f["properties"]["datetime"][:10] for f in fs[:6]])
        for f in fs[:4]:
            try:
                bantlar = {}
                for b in ("red", "green", "blue"):
                    src = rasterio.open(f["assets"][b]["href"] + "?" + tok); bantlar[b] = src
                ok = True
                for bol, bb in BOL.items():
                    src = bantlar["red"]; w = from_bounds(*transform_bounds("EPSG:4326", src.crs, *bb), src.transform)
                    rgb = np.dstack([bantlar[b].read(1, window=w, boundless=True, fill_value=0).astype("float32") for b in ("red", "green", "blue")])
                    if (rgb == 0).mean() > 0.02:
                        ok = False; break
                    ref = np.clip(rgb * 0.0000275 - 0.2, 0, 1)
                    lo, hi = np.percentile(ref, 1), np.percentile(ref, 99.5)
                    img = (np.clip((ref - lo) / (hi - lo), 0, 1) ** (1 / 1.25) * 255).astype("uint8")
                    im = Image.fromarray(img); im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
                    im.save(f"tarama/uydu-{bol}-{ad}.jpg", quality=86)
                if ok:
                    meta[ad] = {"tarih": f["properties"]["datetime"][:10], "sahne": f["id"], "bulut": f["properties"].get("eo:cloud_cover")}
                    break
            except Exception as e:
                print("landsat okunamadı", f.get("id"), e)
    json.dump(meta, open("tarama/uydu.json", "w"), indent=1); print("uydu", meta)
except Exception as e:
    print("landsat hata", e)
