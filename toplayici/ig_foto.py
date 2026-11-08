"""Instagram kartlarının arka planı için açık lisanslı yer fotoğrafları (Wikimedia Commons).

Kurallar:
  - Yalnızca serbest lisanslar: kamu malı, CC0, CC BY, CC BY-SA. "NC" (ticari olmayan) ve "ND" (türetilemez) alınmaz.
  - Haber sitelerinin fotoğrafları alınmaz. İnsan, ceset, kan, yaralı, cenaze, çocuk içeren görseller ad ve açıklamasından elenir.
  - İndirilen her fotoğraf önce "aday"dır. Bir insan gözüyle bakılıp toplayici/foto_onay.json'a yazılmadan hiçbir karta girmez.
  - Fotoğrafçının adı ve lisans gönderi açıklamasına ve kartın altına yazılır.
Kütüphane yavaş yavaş dolar: her çalıştırmada en çok birkaç yer aranır. Dosyalar data/foto/ altında (veri dalında) durur.
"""
import base64
import html
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "ZBS-haber-toplayici/1.0 (otomatik haber ozeti; https://github.com/hakanul-barreyn/bashara-ajans)"

# Sitedeki yer adları (Türkçe) -> Commons'ta aranacak terimler
YERLER = {   # Türkçe ad -> Commons'taki İngilizce ad
    "Gazze": "Gaza City", "Han Yunus": "Khan Yunis", "Refah": "Rafah", "Cebaliye": "Jabalia", "Deyr el-Belah": "Deir al-Balah",
    "Nuseyrat": "Nuseirat", "Batı Şeria": "West Bank", "Cenin": "Jenin", "Nablus": "Nablus", "Ramallah": "Ramallah",
    "Tulkerim": "Tulkarm", "El Halil": "Hebron", "Kudüs": "Jerusalem", "Beyrut": "Beirut", "Güney Lübnan": "South Lebanon",
    "Şam": "Damascus", "Halep": "Aleppo", "Sana": "Sanaa", "Hudeyde": "Hodeidah", "Tahran": "Tehran", "Bağdat": "Baghdad",
    "Kahire": "Cairo", "Amman": "Amman", "Doha": "Doha", "Riyad": "Riyadh", "İstanbul": "Istanbul", "Ankara": "Ankara",
}
# Her yer için aranacak ifadeler: Al Jazeera English'in serbest lisanslı (CC BY-SA) Flickr arşivi en değerli kaynak
TERIMLER = ["{} Al Jazeera English", "{} destruction", "{} skyline", "{} street"]


ESANLAM = {"gazze seridi": "Gazze", "gaza": "Gazze", "han yunus": "Han Yunus", "hanyunus": "Han Yunus", "rafah": "Refah",
           "cabaliya": "Cebaliye", "cebalya": "Cebaliye", "bati seria": "Batı Şeria", "jenin": "Cenin", "kudus": "Kudüs",
           "dogu kudus": "Kudüs", "beirut": "Beyrut", "lubnan": "Güney Lübnan", "guney lubnan": "Güney Lübnan", "sam": "Şam",
           "san'a": "Sana", "sanaa": "Sana", "yemen": "Sana", "tahran": "Tahran", "iran": "Tahran", "bagdat": "Bağdat",
           "irak": "Bağdat", "kahire": "Kahire", "misir": "Kahire", "suriye": "Şam", "el halil": "El Halil", "hebron": "El Halil"}
SERBEST = re.compile(r"^(public domain|pd|cc0|cc by(-sa)? [0-9.]+( [a-z]+)?)$", re.I)
YASAK = re.compile(r"\b(dead|death|died|body|bodies|corpse|killed|kill|blood|injur|wound|martyr|funeral|massacre|victim|"
                   r"child|children|kid|baby|boy|girl|portrait|people|crowd|soldier|militant|weapon|rifle|gun|"
                   r"map|flag|logo|coat of arms|diagram|chart|poster|stamp|banknote|coin|archive|interior|mayor|minister|president|"
                   r"official|meeting|conference|ceremony|selfie)", re.I)


def _sade(s):
    s = unicodedata.normalize("NFKD", str(s or "").replace("ı", "i").replace("İ", "i")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z' ]", "", s).strip()


def yer_anahtari(ad):
    """Olayın yer adını kütüphane anahtarına çevirir (yoksa None)."""
    if not ad:
        return None
    if ad in YERLER:
        return ad
    s = _sade(ad)
    for k in YERLER:
        if _sade(k) == s:
            return k
    return ESANLAM.get(s)


def _klasor(kok):
    return os.path.join(kok, "data", "foto")


def katalog(kok):
    try:
        return json.load(open(os.path.join(_klasor(kok), "katalog.json"), encoding="utf-8"))
    except Exception:
        return {"fotolar": {}, "arandi": {}}


def _onay(kok):
    try:
        o = json.load(open(os.path.join(kok, "toplayici", "foto_onay.json"), encoding="utf-8"))
        return set(o.get("onayli", [])), set(o.get("red", []))
    except Exception:
        return set(), set()


def _temiz(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", str(s or "")))).strip()


def _ara(terim):
    q = {"action": "query", "format": "json", "generator": "search", "gsrsearch": terim + " filetype:bitmap", "gsrnamespace": "6",
         "gsrlimit": "40", "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "1400"}
    r = urllib.request.Request(API + "?" + urllib.parse.urlencode(q), headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=40) as y:
        return list((json.loads(y.read()).get("query") or {}).get("pages", {}).values())


def kutuphane_doldur(kok, simdi, en_cok_yer=3, yer_basina=8, log=print):
    """Henüz aranmamış yerler için Commons'ta arar, uygun adayları indirir."""
    kat = katalog(kok)
    os.makedirs(_klasor(kok), exist_ok=True)
    # Reddedilen fotoğrafların dosyalarını sil (katalogda kalırlar ki bir daha indirilmesinler)
    _, red = _onay(kok)
    for i in red:
        try:
            os.remove(os.path.join(_klasor(kok), f"{i}.jpg"))
        except OSError:
            pass
    aranacak = [y for y in YERLER if f"v2:{y}" not in kat["arandi"]][:en_cok_yer]
    for yer in aranacak:
        bulunan = 0
        try:
            for terim in (t.format(YERLER[yer]) for t in TERIMLER):
                for p in _ara(terim):
                    if bulunan >= yer_basina:
                        break
                    ii = (p.get("imageinfo") or [{}])[0]
                    em = ii.get("extmetadata") or {}
                    lis = _temiz((em.get("LicenseShortName") or {}).get("value"))
                    metin = " ".join([p.get("title", ""), _temiz((em.get("ImageDescription") or {}).get("value")),
                                      _temiz((em.get("Categories") or {}).get("value"))])
                    kimlik = str(p.get("pageid"))
                    yatay = (ii.get("width") or 0) >= 1.25 * (ii.get("height") or 1)   # dikey ve kare taramalar kapak için uygun değil
                    if (kimlik in kat["fotolar"] or ii.get("mime") != "image/jpeg" or (ii.get("width") or 0) < 1600 or not yatay
                            or not SERBEST.match(lis) or YASAK.search(metin) or not ii.get("thumburl")):
                        continue
                    yol = os.path.join(_klasor(kok), f"{kimlik}.jpg")
                    try:
                        with urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers={"User-Agent": UA}), timeout=60) as y:
                            open(yol, "wb").write(y.read())
                    except Exception:
                        continue
                    kat["fotolar"][kimlik] = {
                        "yer": yer, "baslik": p.get("title"), "sanatci": _temiz((em.get("Artist") or {}).get("value"))[:80] or "bilinmiyor",
                        "lisans": lis, "lisans_url": (em.get("LicenseUrl") or {}).get("value", ""),
                        "kaynak": ii.get("descriptionurl", ""), "genislik": ii.get("thumbwidth"), "yukseklik": ii.get("thumbheight")}
                    bulunan += 1
            kat["arandi"][f"v2:{yer}"] = simdi.isoformat()
        except Exception as e:
            log(f"Fotoğraf kütüphanesi: {yer} aranamadı ({type(e).__name__})")
            break
        log(f"Fotoğraf kütüphanesi: {yer} için {bulunan} aday indirildi (onay bekliyor)")
    json.dump(kat, open(os.path.join(_klasor(kok), "katalog.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


def sec(kok, yer_ad, tohum=0):
    """Onaylı bir fotoğraf: (data URI, künye metni) ya da None."""
    anahtar = yer_anahtari(yer_ad)
    if not anahtar:
        return None
    onayli, red = _onay(kok)
    kat = katalog(kok)
    adaylar = sorted(i for i, f in kat["fotolar"].items() if f["yer"] == anahtar and i in onayli and i not in red)
    if not adaylar:
        return None
    i = adaylar[tohum % len(adaylar)]
    f = kat["fotolar"][i]
    try:
        veri = open(os.path.join(_klasor(kok), f"{i}.jpg"), "rb").read()
    except Exception:
        return None
    kunye = f"Fotoğraf: {f['sanatci']} · {f['lisans']} · Wikimedia Commons"
    return "data:image/jpeg;base64," + base64.b64encode(veri).decode(), kunye, f
