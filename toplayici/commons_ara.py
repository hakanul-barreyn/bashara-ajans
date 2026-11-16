"""Tek seferlik: Wikimedia Commons'ta kategori kategori açık lisanslı görsel listesi (raporlar girişi için aday arama)."""
import json, sys, urllib.parse, urllib.request
UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
KAT = sys.argv[1:] or ["Kamal_Adwan_Hospital", "Nakba", "1948_Palestinian_expulsion_and_flight", "Palestinian_refugees_in_1948", "Palestinian_refugee_camps_in_the_1940s"]
out = {}
for kat in KAT:
    q = {"action": "query", "format": "json", "generator": "categorymembers", "gcmtitle": "Category:" + kat, "gcmtype": "file|subcat", "gcmlimit": 80,
         "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1600}
    try:
        with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), headers={"User-Agent": UA}), timeout=40) as r:
            v = json.loads(r.read())
    except Exception as e:
        out[kat] = {"hata": str(e)}
        continue
    xs = []
    for p in (v.get("query") or {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        g = lambda k: ((md.get(k) or {}).get("value") or "")[:200]
        xs.append({"t": p.get("title"), "url": ii.get("thumburl") or ii.get("url"), "sayfa": ii.get("descriptionurl"), "w": ii.get("width"),
                   "lisans": g("LicenseShortName"), "yazar": g("Artist"), "kaynak": g("Credit"), "tarih": g("DateTimeOriginal"), "acik": g("ImageDescription")})
    out[kat] = xs
json.dump(out, open("commons.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print({k: len(v) if isinstance(v, list) else v for k, v in out.items()})
