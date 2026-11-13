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
                time.sleep(60)
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


def _stac(gun=60, bulut=8):
    bit = dt.datetime.now(dt.timezone.utc)
    govde = {"collections": ["sentinel-2-l2a"], "bbox": GAZZE_BBOX,
             "datetime": f"{(bit - dt.timedelta(days=gun)).strftime('%Y-%m-%dT00:00:00Z')}/{bit.strftime('%Y-%m-%dT%H:%M:%SZ')}",
             "query": {"eo:cloud_cover": {"lt": bulut}}, "sortby": [{"field": "properties.datetime", "direction": "desc"}], "limit": 40}
    istek = urllib.request.Request(STAC, data=json.dumps(govde).encode(), headers={"Content-Type": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        return json.loads(r.read()).get("features", [])


def uydu(cikti):
    import numpy as np
    import rasterio
    from rasterio.merge import merge
    from rasterio.warp import transform_bounds
    from PIL import Image
    klasor = os.path.join(cikti, "uydu"); os.makedirs(klasor, exist_ok=True)
    ogeler = _stac()
    gunler = {}
    for f in ogeler:
        gunler.setdefault(f["properties"]["datetime"][:10], []).append(f)
    for gun in sorted(gunler, reverse=True):
        fs = gunler[gun]
        bulut = max(f["properties"].get("eo:cloud_cover", 0) for f in fs)
        try:
            kaynaklar = [rasterio.open(f["assets"]["visual"]["href"]) for f in fs]
            crs = kaynaklar[0].crs
            kaynaklar = [k for k in kaynaklar if k.crs == crs]
            sinir = transform_bounds("EPSG:4326", crs, *GAZZE_BBOX)
            dizi, _ = merge(kaynaklar, bounds=sinir, res=10, nodata=0)
        except Exception as e:   # noqa: BLE001
            print("uydu okunamadı", gun, e)
            continue
        rgb = np.moveaxis(dizi[:3], 0, -1)
        bos = float((rgb.sum(axis=2) == 0).mean())
        print("uydu", gun, "bulut", bulut, "boş pay", round(bos, 3), rgb.shape)
        if bos > 0.03:
            continue   # Gazze'nin bir kısmı bu günün karelerinin dışında
        im = Image.fromarray(rgb.astype("uint8"))
        # hafif kontrast: Sentinel "visual" görüntüsü biraz soluk
        from PIL import ImageEnhance
        im = ImageEnhance.Contrast(ImageEnhance.Brightness(im).enhance(1.08)).enhance(1.12)
        b = im.copy(); b.thumbnail((2200, 2200)); b.save(os.path.join(klasor, "gazze.jpg"), quality=84, optimize=True, progressive=True)
        k = im.copy(); k.thumbnail((900, 900)); k.save(os.path.join(klasor, "gazze-kucuk.jpg"), quality=80, optimize=True, progressive=True)
        json.dump({"tarih": gun, "bulut": bulut, "uydu": "Sentinel-2", "kare": [f["id"] for f in fs],
                   "atif": f"Copernicus Sentinel-2 verisi ({gun[:4]}), ESA; işleme: ZBS", "lisans": "https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice",
                   "guncellendi": dt.datetime.now(dt.timezone.utc).isoformat()},
                  open(os.path.join(klasor, "uydu.json"), "w"), ensure_ascii=False, indent=1)
        print("Uydu görüntüsü:", gun)
        return
    print("Son 60 günde uygun uydu görüntüsü yok")


if __name__ == "__main__":
    cikti = sys.argv[1] if len(sys.argv) > 1 else "cikti"
    os.makedirs(cikti, exist_ok=True)
    try:
        uydu(cikti)
    except Exception as e:   # noqa: BLE001
        print("uydu hatası", e)
    anahtar = os.environ.get("GEMINI_API_KEY")
    if anahtar:
        model = os.environ.get("GEMINI_MODEL")
        if not model:
            import topla
            model = (topla.gemini_modeller(anahtar) or ["gemini-3.5-flash-lite"])[0]
        print("model:", model)
        fotolar(cikti, anahtar, model)
