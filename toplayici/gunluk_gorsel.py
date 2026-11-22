"""Akıştaki iki özel kart için günlük görseller (.github/workflows/gunluk-gorsel.yml, "gorsel" dalı):

1) Gazze'den yıkım fotoğrafları: Wikimedia Commons'ta açık lisanslı, 2023 sonrası çekilmiş fotoğraflar. Her aday Gemini'nin
   görsel denetiminden geçer: insan görünmeyen (yalnızca yapılar, sokaklar, manzara), şiddet ve ceset içermeyen, Gazze'deki
   yıkımı gösteren fotoğraflar kalır. İsrail ordusunun ve hükümet basın ofisinin tanıtım fotoğrafları alınmaz.
   Çıktı: cikti/gazze-foto.json  [{url, sayfa, atif, yil, aciklama}]
2) Uydudan Gazze: Copernicus Sentinel-2 (ESA) L2A, son 60 günün bulutu en az görüntüsü (Element 84 Earth Search kataloğu,
   AWS'deki açık COG dosyaları). Gazze Şeridi kesilip JPEG'e çevrilir. Çıktı: cikti/uydu/gazze.jpg, gazze-kucuk.jpg, uydu.json
Sentinel verisi ücretsiz ve açıktır; kaynak gösterilir ("Copernicus Sentinel-2 verisi, değiştirilmiş").
"""
import base64
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import gorsel_denetim as GD   # noqa: E402

UA = GD.UA
GAZZE_BBOX = [34.20, 31.21, 34.58, 31.60]   # batı, güney, doğu, kuzey (WGS84)

FOTO_SORGU = ["Gaza destruction 2024", "Gaza Strip destroyed buildings", "Gaza City destruction", "Khan Yunis destruction",
              "Rafah destruction", "Jabalia destruction", "Beit Hanoun destruction", "Gaza rubble 2025", "Gaza ruins"]
FOTO_KATEGORI = ["Destruction in the Gaza Strip", "Damage in the Gaza Strip during the Gaza war", "Gaza war (2023–present)"]
# İsrail ordusu, hükümet basın ofisi ve silahlı grupların resmî görselleri alınmaz
YASAK_KAYNAK = re.compile(r"\bIDF\b|Israel Defense Forces|IDF Spokesperson|צה\"?ל|דובר|Government Press Office|\bGPO\b|Kobi Gideon|"
                          r"Haim Zach|Amos Ben Gershom|Avi Ohayon|Hamas|Qassam|Hezbollah", re.I)
# dosya adı ya da açıklama Gazze'deki bir yeri anmalı (İsrail ya da başka bir ülkedeki yıkım alınmaz)
GAZZE_AD = re.compile(r"gaza|gazze|غزة|khan[ _-]?y[ou]n|rafah|jabal[iy]a|jabalya|deir[ _-]?(?:al|el)[ _-]?bala|beit[ _-]?(?:hanoun|lahia|lahiya)|"
                      r"shati|nuseirat|bureij|maghazi|zeitoun|zaitoun|shuja|rimal|remal|mawasi|tal[ _-]?al[ _-]?hawa|abasan|khuza|bani[ _-]?suhaila", re.I)
FOTO_TALIMAT = ("Bu fotoğraf bir haber sitesinde \"Gazze'den: yıkım\" başlıklı bir kartta gösterilecek. Yalnızca JSON döndür: "
                "{\"insan\": true|false, \"siddet\": true|false, \"mustehcen\": true|false, \"yikim\": true|false, \"asker\": true|false, "
                "\"yazi_grafik\": true|false, \"aciklama\": \"...\", \"aciklama_en\": \"...\"}. "
                "insan: fotoğrafta tanınabilir ya da belirgin bir insan var mı (çok uzaktaki küçük siluetler hariç)? Şüphedeysen true. "
                "siddet: ceset, kan, yaralı, patlama anı ya da enkaz altında insan var mı? Şüphedeysen true. "
                "mustehcen: çıplaklık ya da müstehcen öğe var mı? "
                "yikim: fotoğrafın ana konusu savaşta yıkılmış ya da hasar görmüş binalar, sokaklar, mahalleler mi? "
                "asker: asker, tank, zırhlı araç ya da ordu tanıtım fotoğrafı mı? "
                "yazi_grafik: tasarlanmış grafik, afiş ya da harita mı? "
                "aciklama: fotoğrafta görüneni anlatan, en çok 12 kelimelik nötr Türkçe açıklama (yer adı biliniyorsa ekle); "
                "aciklama_en: aynısı İngilizce.")


def _gemini(anahtar, model, veri, tur, talimat):
    import yz
    if yz.etkin():
        return GD._sozluk(GD._yz_gorsel(anahtar, model, talimat, veri, tur))
    govde = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}},
                                                     {"text": talimat}]}],
             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    istek = urllib.request.Request(f"{GD.GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        v = json.loads(r.read())
    return GD._sozluk(json.loads(v["candidates"][0]["content"]["parts"][0]["text"]))


def _yil(sayfa_bilgi):
    m = re.search(r"(20\d{2})", sayfa_bilgi or "")
    return int(m.group(1)) if m else None


def fotolar(cikti, anahtar, model, en_cok=10, en_cok_deneme=36):
    yol = os.path.join(cikti, "gazze-foto.json")
    eski = json.load(open(yol, encoding="utf-8")) if os.path.exists(yol) else {"fotolar": [], "red": []}
    red = set(eski.get("red", []))
    tamam = {f["sayfa"]: f for f in eski.get("fotolar", [])}
    adaylar, gorulen = [], set()
    for q in FOTO_KATEGORI:
        try:
            adaylar += GD._commons({"generator": "categorymembers", "gcmtitle": "Category:" + q, "gcmtype": "file", "gcmlimit": 50})
        except Exception as e:   # noqa: BLE001
            print("kategori", q, e)
    for q in FOTO_SORGU:
        try:
            adaylar += GD._commons({"generator": "search", "gsrsearch": "filetype:bitmap " + q, "gsrnamespace": 6, "gsrlimit": 20})
        except Exception as e:   # noqa: BLE001
            print("arama", q, e)
    secilen = []
    for a in sorted(adaylar, key=lambda x: -x.get("puan", 0)):
        if a["sayfa"] in gorulen:
            continue
        gorulen.add(a["sayfa"])
        if a["sayfa"] in tamam:
            secilen.append(tamam[a["sayfa"]])
            continue
        if a["sayfa"] in red or YASAK_KAYNAK.search(a["atif"]) or YASAK_KAYNAK.search(a["sayfa"]):
            continue
        if not GAZZE_AD.search(urllib.parse.unquote(a["sayfa"])):
            red.add(a["sayfa"]); continue
        yil = a.get("yil")
        if yil is not None and yil < 2023:
            red.add(a["sayfa"]); continue
        if en_cok_deneme <= 0 or len(secilen) >= en_cok:
            continue
        en_cok_deneme -= 1
        time.sleep(4)   # Wikimedia'nın istek sınırı: sık indirmeye 429 döner
        try:
            veri, tur = GD._indir(a["url"])
            if not veri:
                continue
            c = _gemini(anahtar, model, veri, tur, FOTO_TALIMAT)
        except Exception as e:   # noqa: BLE001
            print("denetim hatası", a["sayfa"][-60:], e)
            if "429" in str(e):
                print("Wikimedia istek sınırı: bugünlük bu kadar, yarın kaldığı yerden")
                break
            continue
        uygun = c.get("yikim") is True and not any(c.get(k) is not False for k in ("insan", "siddet", "mustehcen", "asker", "yazi_grafik"))
        print("uygun" if uygun else "red", a["sayfa"][-70:], {k: c.get(k) for k in ("insan", "siddet", "yikim", "asker")})
        if not uygun:
            red.add(a["sayfa"]); continue
        secilen.append({"url": a["url"], "sayfa": a["sayfa"], "atif": a["atif"], "yil": yil,
                        "aciklama": str(c.get("aciklama") or "")[:120], "aciklama_en": str(c.get("aciklama_en") or "")[:120]})
    secilen = sorted(secilen, key=lambda f: -(f.get("yil") or 0))[:en_cok]
    json.dump({"guncellendi": dt.datetime.now(dt.timezone.utc).isoformat(), "fotolar": secilen, "red": sorted(red)},
              open(yol, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Gazze fotoğrafları:", len(secilen))


STAC = "https://earth-search.aws.element84.com/v1/search"
# Yakın kareler (batı, güney, doğu, kuzey). Savaş öncesi görüntü Ağustos – 6 Ekim 2023 arasından.
BOLGELER = [
    ("gazze-kenti", "Gazze kenti", "Gaza City", [34.40, 31.47, 34.50, 31.55]),
    ("kuzey", "Cebaliye, Beyt Lahiya, Beyt Hanun", "Jabalia, Beit Lahia, Beit Hanoun", [34.46, 31.51, 34.57, 31.59]),
    ("orta", "Deyr el-Belah ve orta kamplar", "Deir al-Balah and the central camps", [34.32, 31.39, 34.43, 31.47]),
    ("han-yunus", "Han Yunus", "Khan Yunis", [34.25, 31.31, 34.36, 31.38]),
    ("refah", "Refah", "Rafah", [34.21, 31.26, 34.31, 31.32]),
]
ONCE_ARALIK = ("2023-08-01T00:00:00Z", "2023-10-06T23:59:59Z")


def _stac(gun=60, bulut=8, aralik=None, bbox=None):
    bit = dt.datetime.now(dt.timezone.utc)
    zaman = "/".join(aralik) if aralik else f"{(bit - dt.timedelta(days=gun)).strftime('%Y-%m-%dT00:00:00Z')}/{bit.strftime('%Y-%m-%dT%H:%M:%SZ')}"
    govde = {"collections": ["sentinel-2-l2a"], "bbox": bbox or GAZZE_BBOX, "datetime": zaman,
             "query": {"eo:cloud_cover": {"lt": bulut}}, "sortby": [{"field": "properties.datetime", "direction": "desc"}], "limit": 60}
    istek = urllib.request.Request(STAC, data=json.dumps(govde).encode(), headers={"Content-Type": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        return json.loads(r.read()).get("features", [])


GEO = {}   # kesilen her bbox'ın UTM sınırları: üstüne lon/lat çizgi koymak için


def _sari_hat(geo):
    """toplayici/sari_hat.json'daki (lon/lat) katmanları Gazze görüntüsünün piksel oranlarına çevirir (0-1)."""
    yol = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sari_hat.json")
    if not geo or not os.path.exists(yol):
        return None
    from rasterio.warp import transform
    v = json.load(open(yol, encoding="utf-8"))
    b, g, d, k = geo["sinir"]
    def cevir(h):
        xs, ys = transform("EPSG:4326", geo["crs"], [p[0] for p in h], [p[1] for p in h])
        return [[round((x - b) / (d - b), 5), round((k - y) / (k - g), 5)] for x, y in zip(xs, ys)]
    return {**{a: v[a] for a in v if a != "katmanlar"}, "katmanlar": {ad: [cevir(h) for h in hs] for ad, hs in v["katmanlar"].items()}}


def _kes(fs, bbox, res=10):
    """Aynı güne ait Sentinel-2 karelerinden bbox'ı keser (varsayılan 10 m). Döndürür: RGB dizisi ya da None (kare eksikse)."""
    import numpy as np
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import transform_bounds
    kaynaklar = [rasterio.open(f["assets"]["visual"]["href"]) for f in fs]
    crs = kaynaklar[0].crs
    kaynaklar = [k for k in kaynaklar if k.crs == crs]
    dizi, tr = merge(kaynaklar, bounds=transform_bounds("EPSG:4326", crs, *bbox), res=res, nodata=0)
    rgb = np.moveaxis(dizi[:3], 0, -1)
    h, w = rgb.shape[:2]
    GEO[tuple(bbox)] = {"crs": str(crs), "sinir": [tr.c, tr.f + tr.e * h, tr.c + tr.a * w, tr.f]}   # batı, güney, doğu, kuzey (UTM)
    return None if float((rgb.sum(axis=2) == 0).mean()) > 0.03 else rgb


def _kaydet(rgb, yol, en=2200, kontrast=True):
    from PIL import Image, ImageEnhance
    im = Image.fromarray(rgb.astype("uint8"))
    if kontrast:   # Sentinel "visual" görüntüsü biraz soluk
        im = ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(1.08)).enhance(1.12)
    if max(im.size) < en:   # yakın kareler 10 m çözünürlükte ~1000 piksel: görüntülemede yumuşak büyütme
        k = en / max(im.size); im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    else:
        im.thumbnail((en, en))
    im.save(yol, quality=84, optimize=True, progressive=True)


def _gun_sec(ogeler, bboxlar, res=10):
    """Bütün bbox'ları eksiksiz kapsayan en yeni gün: {gün: kareler}"""
    gunler = {}
    for f in ogeler:
        gunler.setdefault(f["properties"]["datetime"][:10], []).append(f)
    for gun in sorted(gunler, reverse=True):
        try:
            kesitler = [_kes(gunler[gun], b, res) for b in bboxlar]
        except Exception as e:   # noqa: BLE001
            print("uydu okunamadı", gun, e); continue
        if all(k is not None for k in kesitler):
            return gun, gunler[gun], kesitler
        print("uydu", gun, "eksik kare, atlandı")
    return None, None, None


def uydu(cikti):
    klasor = os.path.join(cikti, "uydu"); os.makedirs(klasor, exist_ok=True)
    meta_yol = os.path.join(klasor, "uydu.json")
    eski = json.load(open(meta_yol)) if os.path.exists(meta_yol) else {}
    bboxlar = [GAZZE_BBOX] + [b for *_, b in BOLGELER]
    gun, fs, kesitler = _gun_sec(_stac(), bboxlar)
    if not gun:
        print("Son 60 günde uygun uydu görüntüsü yok"); return
    _kaydet(kesitler[0], os.path.join(klasor, "gazze.jpg"))
    _kaydet(kesitler[0], os.path.join(klasor, "gazze-kucuk.jpg"), en=900)
    for (k, *_), r in zip(BOLGELER, kesitler[1:]):
        _kaydet(r, os.path.join(klasor, f"{k}-simdi.jpg"), en=1400)
    # savaş öncesi: bir kez üretilir, sonra saklanır
    geo = GEO.get(tuple(GAZZE_BBOX))
    once = eski.get("once")
    if not once or not os.path.exists(os.path.join(klasor, "gazze-once.jpg")) or not all(os.path.exists(os.path.join(klasor, f"{k}-once.jpg")) for k, *_ in BOLGELER):
        ogun, _, okes = _gun_sec(_stac(bulut=5, aralik=ONCE_ARALIK), [GAZZE_BBOX] + [b for *_, b in BOLGELER])
        if ogun:
            _kaydet(okes[0], os.path.join(klasor, "gazze-once.jpg"))
            for (k, *_), r in zip(BOLGELER, okes[1:]):
                _kaydet(r, os.path.join(klasor, f"{k}-once.jpg"), en=1400)
            once = ogun
            print("Savaş öncesi görüntü:", ogun)
    galeri = [{"id": k, "ad": ad, "ad_en": en, "bbox": b, "simdi": f"{k}-simdi.jpg", "once": f"{k}-once.jpg" if once else None}
              for k, ad, en, b in BOLGELER]
    json.dump({"tarih": gun, "once": once, "bulut": max(f["properties"].get("eo:cloud_cover", 0) for f in fs), "uydu": "Sentinel-2",
               "kare": [f["id"] for f in fs], "galeri": galeri, "gazze_once": "gazze-once.jpg" if os.path.exists(os.path.join(klasor, "gazze-once.jpg")) else None,
               "sari": _sari_hat(geo),
               "atif": f"Copernicus Sentinel-2 verisi ({gun[:4]}{', ' + once[:4] if once and once[:4] != gun[:4] else ''}), ESA; işleme: Alboroto",
               "lisans": "https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice",
               "guncellendi": dt.datetime.now(dt.timezone.utc).isoformat()},
              open(meta_yol, "w"), ensure_ascii=False, indent=1)
    print("Uydu görüntüsü:", gun, "· savaş öncesi:", once)


def dosya_kapaklari(cikti):
    """Her dosyaya sabit bir uydu kapağı (toplayici/dosya_kapak.json). Bir kez üretilir; dosya varsa dokunulmaz."""
    secim = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "dosya_kapak.json"), encoding="utf-8"))
    klasor = os.path.join(cikti, "uydu", "dosya"); os.makedirs(klasor, exist_ok=True)
    meta_yol = os.path.join(klasor, "dosya.json")
    meta = json.load(open(meta_yol, encoding="utf-8")) if os.path.exists(meta_yol) else {}
    for did, v in secim.items():
        if did.startswith("_") or (did in meta and os.path.exists(os.path.join(klasor, did + ".jpg"))):
            continue
        try:
            gun, _, kes = _gun_sec(_stac(gun=150, bulut=3, bbox=v["bbox"]), [v["bbox"]], res=v.get("cozunurluk", 10))
        except Exception as e:   # noqa: BLE001
            print("dosya kapağı alınamadı", did, e); continue
        if not gun:
            print("dosya kapağı: uygun görüntü yok", did); continue
        _kaydet(kes[0], os.path.join(klasor, did + ".jpg"), en=1600)
        meta[did] = {"dosya": did + ".jpg", "tarih": gun, "yer": v["yer"], "yer_en": v.get("yer_en"),
                     "atif": f"Copernicus Sentinel-2 verisi ({gun[:4]}), ESA; işleme: Alboroto",
                     "atif_en": f"Contains Copernicus Sentinel-2 data ({gun[:4]}), ESA; processed by Alboroto"}
        print("dosya kapağı:", did, gun)
        json.dump(meta, open(meta_yol, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    cikti = sys.argv[1] if len(sys.argv) > 1 else "cikti"
    os.makedirs(cikti, exist_ok=True)
    try:
        uydu(cikti)
    except Exception as e:   # noqa: BLE001
        print("uydu hatası", e)
    try:
        dosya_kapaklari(cikti)
    except Exception as e:   # noqa: BLE001
        print("dosya kapakları hatası", e)
    anahtar = os.environ.get("GEMINI_API_KEY")
    if anahtar:
        model = os.environ.get("GEMINI_MODEL")
        if not model:
            import topla
            model = (topla.gemini_modeller(anahtar) or ["gemini-3.5-flash-lite"])[0]
        print("model:", model)
        fotolar(cikti, anahtar, model)
