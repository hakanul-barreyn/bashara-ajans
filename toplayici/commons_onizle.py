"""Seçilen Commons dosyalarının küçük önizlemelerini indirir (yalnızca editörün bakması için; siteye yazmaz).
Girdi: ONIZLE ortam değişkeni, '|' ile ayrılmış dosya adları ("File:" önekli ya da öneksiz). Çıktı: onizleme/NN.jpg + onizleme/dizin.json"""
import json, os, urllib.parse, urllib.request
UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
adlar = [a.strip() for a in os.environ.get("ONIZLE", "").split("|") if a.strip()]
os.makedirs("onizleme", exist_ok=True)
dizin = []
for i, ad in enumerate(adlar[:40]):
    t = ad if ad.startswith("File:") else "File:" + ad
    q = {"action": "query", "format": "json", "titles": t, "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 640}
    try:
        with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), headers={"User-Agent": UA}), timeout=40) as r:
            v = json.loads(r.read())
        sayfa = next(iter(v["query"]["pages"].values()))
        ii = sayfa["imageinfo"][0]; m = ii.get("extmetadata", {})
        with urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers={"User-Agent": UA}), timeout=60) as r:
            open(f"onizleme/{i:02d}.jpg", "wb").write(r.read())
        dizin.append({"n": f"{i:02d}.jpg", "t": t, "w": ii.get("width"), "h": ii.get("height"),
                      "lisans": (m.get("LicenseShortName") or {}).get("value"), "yazar": (m.get("Artist") or {}).get("value"),
                      "url": ii.get("url")})
    except Exception as e:   # noqa: BLE001
        dizin.append({"t": t, "hata": str(e)})
json.dump(dizin, open("onizleme/dizin.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(dizin), "dosya")
