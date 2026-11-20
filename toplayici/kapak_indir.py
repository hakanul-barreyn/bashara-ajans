"""Raporlar girişinin arka plan görselleri: seçilmiş Commons dosyalarını (açık lisans, İsrail ordusu/GPO kaynaklı değil,
grafik değil) 1600 piksel genişlikte indirir ve künyeleriyle kapak.json'a yazar. Çıktı klasörü argümandır (gorsel dalı)."""
import json, os, re, sys, urllib.error, urllib.parse, urllib.request
UA = "alboroto-gorsel/1.0 (+https://alborotonews.com)"
SECIM = [
    ("dheisheh-1952", "File:Dheisheh Camp 1952.jpg", "Dehişe kampı, 1952", "Dheisheh camp, 1952"),
    ("nahr-bared-1952", "File:Nahr al-Bared refugee camp 1952.webp", "Nahr el-Barid kampı, 1952", "Nahr al-Bared camp, 1952"),
    ("eriha-okul", "File:After the exodus (Nakba), the first school classes in Jericho were held in the open air.jpg",
     "Nekbe’den sonra Eriha’da açık havada ilk dersler", "After the Nakba: the first open-air classes in Jericho"),
    ("nasira-duvar", "File:Al Nakba - Graffiti - Nazareth.jpg", "Nasıra’da bir duvar: Nekbe", "A wall in Nazareth: Nakba"),
    ("beyt-itab", "File:Bayt Itab natural park - panoramio (11).jpg", "Beyt İtab köyünün kalıntıları", "Ruins of the village of Bayt Itab"),
    ("hayfa-1948", "File:Destruction of Haifa Old Town 1948.png", "Hayfa eski şehri, 1948", "Haifa old town, 1948"),
    ("ayn-hilve", "File:Palestinian refugees in Ein El Hilweh refugee camp in Lebanon.jpg", "Ayn el-Hilve kampı, Lübnan", "Ein el-Hilweh camp, Lebanon"),
]
cik = sys.argv[1] if len(sys.argv) > 1 else "kapak"
if len(sys.argv) > 2:  # ikinci argüman: seçim listesi (JSON: [ad, dosya, tr, en])
    SECIM = [tuple(x) for x in json.load(open(sys.argv[2], encoding="utf-8"))]
os.makedirs(cik, exist_ok=True)
sayfa = {}
basliklar = [t for _, t, _, _ in SECIM]
for i in range(0, len(basliklar), 50):   # API bir sorguda en çok 50 başlık kabul eder
    q = {"action": "query", "format": "json", "titles": "|".join(basliklar[i:i + 50]), "prop": "imageinfo",
         "iiprop": "url|extmetadata|mime", "iiurlwidth": 1600}
    with urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q), headers={"User-Agent": UA}), timeout=40) as r:
        v = json.loads(r.read())
    if "query" not in v:
        raise SystemExit("Commons API hatası: " + json.dumps(v.get("error", v))[:300])
    for p in v["query"]["pages"].values():
        sayfa[p["title"]] = p
    for n in v["query"].get("normalized", []):
        if n["to"] in sayfa:
            sayfa[n["from"]] = sayfa[n["to"]]
temiz = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s or "")).strip()   # noqa: E731
kunye = []
for ad, t, tr, en in SECIM:
    p = sayfa.get(t)
    ii = ((p or {}).get("imageinfo") or [{}])[0]
    url = ii.get("thumburl")
    if not url:
        print("yok:", t); continue
    md = ii.get("extmetadata") or {}
    g = lambda k: temiz((md.get(k) or {}).get("value"))   # noqa: E731
    uz = ".jpg" if "jpeg" in (ii.get("thumbmime") or ii.get("mime") or "jpeg") else os.path.splitext(urllib.parse.urlparse(url).path)[1]
    import time
    veri = None
    for bekle in (2, 8, 20, 45):   # Wikimedia istek sınırı (429): yavaşla ve yeniden dene
        time.sleep(bekle)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                veri = r.read()
            break
        except urllib.error.HTTPError as e:
            if e.code != 429:
                break
    if not veri:
        print("indirilemedi:", ad); continue
    open(os.path.join(cik, ad + uz), "wb").write(veri)
    kunye.append({"ad": ad, "dosya": ad + uz, "tr": tr, "en": en, "yazar": g("Artist")[:120] or "Bilinmiyor", "lisans": g("LicenseShortName"),
                  "lisans_url": g("LicenseUrl"), "sayfa": ii.get("descriptionurl")})
    print("indi:", ad, uz)
json.dump(kunye, open(os.path.join(cik, "kapak.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
