"""Ana sayfa Gündem görselleri için denetim (data/gundem.json üzerinde, her görsel bir kez; data/gorsel-denetim.json önbellek).

Gemini'ye görselin kendisi gösterilir ve iki şey sorulur:
- Görsel bir yazı grafiği mi? (son dakika bandı, haber kartı, afiş, alıntı kartı, infografik: yazının ana öğe olduğu,
  tasarlanmış görseller). Öyleyse kullanılmaz; sıradaki aday görsele geçilir, hiçbiri uygun değilse görselsiz kalır.
  Fotoğrafta tabela, pankart, bayrak üzerindeki yazı sorun değildir.
- İnsanlar varsa kafalarının (yüzlerinin) görseldeki yeri: ekran kırpması kafaları kesmesin diye görsel o noktaya hizalanır.
Lisans: büyük Gündem görselleri yalnızca açık lisanslı olur. Kaynakların kendi fotoğrafları lisanssız olduğu için
Gündem'de kullanılmaz (akışta küçük önizleme olarak kalır). Gündem görseli Wikimedia Commons'tan gelir: olayın konumunun
10 km çevresinde coğrafi etiketli dosyalar, yoksa yer adı ve "Gaza" aramasıyla; yalnızca kamu malı, CC0, CC BY ve
CC BY-SA lisanslılar; altında fotoğrafçı ve lisans yazılır. Ölü ya da yaralı gösteren görseller de elenir.
Kullanım: topla.py her çalıştırmada denetle(kok, anahtar, model, log) çağırır; çalıştırma başına en çok 12 yeni görsel.
"""
import base64
import json
import os
import urllib.request

GEMINI = "https://generativelanguage.googleapis.com/v1beta"
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
EN_COK = 12
TALIMAT = ("Bu bir haber görseli. Yalnızca JSON döndür: {\"yazi_grafik\": true|false, \"siddet\": true|false, \"portre\": true|false, \"insan\": true|false, \"odak_x\": 0-100, \"odak_y\": 0-100}. "
           "yazi_grafik: yazının görselin ana öğesi olduğu TASARLANMIŞ bir grafik mi (son dakika / breaking bandı, haber kartı, afiş, "
           "alıntı kartı, infografik, logo ekranı, harita)? Gerçek bir fotoğraftaki tabela, pankart ya da yazı bunu true yapmaz. "
           "Ayrıca \"siddet\": true|false: görselde ölü beden, kan ya da ağır yaralı var mı? "
           "\"portre\": true|false: görselin ana konusu tanınabilir bir ya da iki kişi mi (portre, kişinin yakın çekimi)? "
           "odak_x, odak_y: insan varsa kafalarının (yüzlerinin) ortalama yeri, yüzde olarak (sol üst 0,0); insan yoksa görselin ana konusunun yeri.")


def _indir(url, sinir=3_000_000):
    istek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(istek, timeout=20) as r:
        tur = (r.headers.get("Content-Type") or "image/jpeg").split(";")[0]
        veri = r.read(sinir + 1)
    if len(veri) > sinir or not tur.startswith("image/") or tur == "image/svg+xml":
        return None, None
    return veri, tur


def _sor(anahtar, model, veri, tur):
    govde = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}}, {"text": TALIMAT}]}],
             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        v = json.loads(r.read())
    metin = v["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(metin)


COMMONS = "https://commons.wikimedia.org/w/api.php"
LISANS_TAMAM = ("cc0", "public domain", "pd", "cc by ", "cc by-sa", "cc-by", "cc-by-sa")
import html as _html
import re as _re
import urllib.parse as _up


def _commons(params):
    q = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1400, **params}
    istek = urllib.request.Request(COMMONS + "?" + _up.urlencode(q), headers={"User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=30) as r:
        v = json.loads(r.read())
    cikti = []
    for p in (v.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lis = _html.unescape((md.get("LicenseShortName") or {}).get("value", "")).strip()
        if not lis or not any(lis.lower().startswith(x) or x in lis.lower() for x in LISANS_TAMAM) or "nc" in lis.lower().split("-") or "nd" in lis.lower().split("-"):
            continue
        if (ii.get("width") or 0) < 900:
            continue
        sanatci = _re.sub(r"<[^>]+>", "", _html.unescape((md.get("Artist") or {}).get("value", ""))).strip()[:80] or "Wikimedia Commons"
        cikti.append({"url": ii.get("thumburl") or ii.get("url"), "sayfa": ii.get("descriptionurl"), "atif": f"{sanatci} · {lis} · Wikimedia Commons"})
    return cikti


def commons_ara(konum, yer_ad):
    """Olayın yerine yakın, açık lisanslı fotoğraflar (aday listesi)."""
    a = []
    if konum:
        try:
            a += _commons({"generator": "geosearch", "ggscoord": f"{konum[0]}|{konum[1]}", "ggsradius": 10000, "ggslimit": 20, "ggsnamespace": 6})
        except Exception:
            pass
    if len(a) < 3:
        ara = (yer_ad + " " if yer_ad else "") + "Gaza"
        try:
            a += _commons({"generator": "search", "gsrsearch": "filetype:bitmap " + ara, "gsrnamespace": 6, "gsrlimit": 15})
        except Exception:
            pass
    return a


def denetle(kok, anahtar, model, log=print, sayac=None):
    yol_g = os.path.join(kok, "data", "gundem.json")
    yol_o = os.path.join(kok, "data", "gorsel-denetim.json")
    try:
        g = json.load(open(yol_g, encoding="utf-8"))
    except (OSError, ValueError):
        return
    try:
        onb = json.load(open(yol_o, encoding="utf-8"))
    except (OSError, ValueError):
        onb = {}
    yeni = 0
    for o in g.get("olaylar", []):
        # Gündem görseli yalnızca açık lisanslı: Commons adayları (önbellekte olay başına)
        anah = "commons:" + o["id"]
        if anah not in onb:
            try:
                onb[anah] = commons_ara(o.get("konum"), o.get("yer_ad"))[:6]
            except Exception as e:
                log(f"Commons araması: {e}")
                onb[anah] = []
        adaylar = onb.get(anah) or []
        secilen = None
        for c in adaylar:
            url = c["url"]
            k = onb.get(url)
            if k is None and anahtar and model and yeni < EN_COK:
                try:
                    veri, tur = _indir(url)
                    if veri:
                        if sayac:
                            sayac()
                        k = _sor(anahtar, model, veri, tur)
                        yeni += 1
                    else:
                        k = {"yazi_grafik": True, "indirilemedi": True}
                except Exception as e:
                    log(f"Görsel denetimi: {url[:80]}: {e}")
                    k = None
                if k is not None:
                    onb[url] = k
            if k is None:
                continue                    # denetlenmeden kullanılmaz (şiddet içerebilir)
            if not k.get("yazi_grafik") and not k.get("siddet") and not k.get("portre"):
                secilen = (c, k)
                break
        o["gorsel"], o["gorsel_kaynak"] = None, None
        if secilen:
            c, k = secilen
            o["gorsel"], o["gorsel_atif"], o["gorsel_sayfa"] = c["url"], c["atif"], c.get("sayfa")
            try:
                o["odak"] = f'{max(0, min(100, int(k.get("odak_x", 50))))}% {max(0, min(100, int(k.get("odak_y", 35))))}%'
            except (TypeError, ValueError):
                o["odak"] = "50% 35%"
    if len(onb) > 4000:
        onb = dict(list(onb.items())[-3000:])
    with open(yol_o, "w", encoding="utf-8") as f:
        json.dump(onb, f, ensure_ascii=False, separators=(",", ":"))
    with open(yol_g, "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))
    if yeni:
        log(f"Görsel denetimi: {yeni} yeni görsel")
