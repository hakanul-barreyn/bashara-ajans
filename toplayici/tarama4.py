# Tek seferlik: Commons'ta Gazze'nin eski hava fotoğrafları ve 1940'lar Survey of Palestine paftaları; künye + 1600 px kopya + temas sayfası.
import json, os, re, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw
os.makedirs("tarama/g", exist_ok=True)
UA = "alboroto-tarama/1.0 (+https://alborotonews.com)"
def api(q):
    u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({**q, "format": "json"})
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=60).read())
basliklar = []
for s in ["Survey of Palestine, Gaza", "Gaza aerial 1917", "Gaza aerial 1918", "Air views of Palestine Gaza", "Gaza from the air 1918",
          "Gaza aerial photograph Royal Flying Corps", "Southern Palestine Gaza air view Matson", "Bavarian aerial Gaza", "Gaza 1945 aerial"]:
    v = api({"action": "query", "list": "search", "srsearch": s, "srnamespace": 6, "srlimit": 25})
    for x in v["query"]["search"]:
        if x["title"] not in basliklar: basliklar.append(x["title"])
temiz = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()
liste = []
for i in range(0, len(basliklar), 40):
    v = api({"action": "query", "titles": "|".join(basliklar[i:i + 40]), "prop": "imageinfo", "iiprop": "url|extmetadata|size|mime", "iiurlwidth": 1600})
    for p in v["query"]["pages"].values():
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata") or {}
        g = lambda k: temiz((md.get(k) or {}).get("value"))[:300]
        liste.append({"t": p["title"], "w": ii.get("width"), "h": ii.get("height"), "thumb": ii.get("thumburl"), "lisans": g("LicenseShortName"),
                      "yazar": g("Artist"), "tarih": g("DateTimeOriginal"), "aciklama": g("ImageDescription"), "kaynak": g("Credit"), "sayfa": ii.get("descriptionurl")})
liste = [x for x in liste if x["thumb"]]
print(len(liste))
ims = []
for n, x in enumerate(liste):
    time.sleep(1.5)
    try:
        veri = urllib.request.urlopen(urllib.request.Request(x["thumb"], headers={"User-Agent": UA}), timeout=60).read()
    except Exception as e:
        print("indirilemedi", x["t"], e); continue
    yol = f"tarama/g/{n:02d}.jpg"; open(yol, "wb").write(veri); x["dosya"] = yol
    try:
        im = Image.open(yol).convert("RGB"); im.thumbnail((300, 300)); ims.append((n, im))
    except Exception:
        pass
json.dump(liste, open("tarama/g/liste.json", "w"), ensure_ascii=False, indent=1)
for s in range(0, len(ims), 20):
    kt = Image.new("RGB", (5 * 310, 4 * 330), "white"); d = ImageDraw.Draw(kt)
    for k, (n, im) in enumerate(ims[s:s + 20]):
        x, y = (k % 5) * 310, (k // 5) * 330; kt.paste(im, (x, y)); d.text((x + 4, y + 304), f"{n:02d}", fill=(200, 0, 0))
    kt.save(f"tarama/g/temas-{s // 20}.jpg", quality=80)
