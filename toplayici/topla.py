"""ZBS haber toplayıcı.

Her çalıştırmada:
 1. kaynaklar.json'daki her kaynak için en iyi izleme yolunu bulur (haber site haritası, RSS/Atom,
    WordPress API'si) ve bulduğunu data/durum.json'a kaydeder. Bulunan yol bozulursa yeniden arar.
 2. Yeni haberleri çeker. Kaynağın sitesinde Telegram kanalı bağlantısı varsa onu da son dakika hattı olarak okur.
 3. Konu filtresinden geçen haberleri Gemini'ye toplu halde gönderip Türkçe başlık ve özet yazdırır.
 4. Son üç günün haberlerini data/haberler.json'a yazar.

Yalnızca Python'un standart kütüphanesini kullanır. robots.txt kurallarına uyar; engellenen sayfayı atlar.
Ortam değişkenleri: GEMINI_API_KEY (zorunlu değil; yoksa özet yazılmaz), GEMINI_MODEL (isteğe bağlı),
OZET_SINIRI (bir çalıştırmada en fazla kaç özet, varsayılan 45).
"""
import datetime as dt
import gzip
import hashlib
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser
import xml.etree.ElementTree as ET
import zlib
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from konular import ilgili_mi  # noqa: E402
import ekler  # noqa: E402
import marka  # noqa: E402
import almanak  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KAYNAKLAR = os.path.join(KOK, "kaynaklar.json")
HABERLER = os.path.join(KOK, "data", "haberler.json")
DURUM = os.path.join(KOK, "data", "durum.json")
OLAYLAR = os.path.join(KOK, "data", "olaylar.json")

MARKA = marka.oku()
UA = (re.sub(r"[^A-Za-z0-9]+", "-", MARKA["kisa_ad"]).strip("-") or "haber") + "-haber-toplayici/1.0 (+https://github.com)"
SAKLA_GUN = 2
EN_FAZLA_HABER = 6000
KAYNAK_BASINA = 60  # bir kaynaktan bir çalıştırmada alınacak en yeni haber sayısı
KESIF_SURUMU = 5
OZET_SINIRI = int(os.environ.get("OZET_SINIRI") or 45)
PARTI = 15
YENIDEN_KESIF_GUN = 7
CALISMA_SURESI = 9 * 60  # saniye; Actions işi bu süreyi aşmasın

BASLANGIC = time.time()
SIMDI = dt.datetime.now(dt.timezone.utc)


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- ağ
def getir(url, zaman=15, en_fazla=4_000_000, basliklar=None):
    """(durum kodu, metin, son adres) döndürür; hata olursa (0, '', url)."""
    h = {"User-Agent": UA, "Accept-Encoding": "gzip, deflate", "Accept": "*/*"}
    if basliklar:
        h.update(basliklar)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=zaman) as r:
            veri = r.read(en_fazla)
            enc = (r.headers.get("Content-Encoding") or "").lower()
            if enc == "gzip" or veri[:2] == b"\x1f\x8b":
                veri = gzip.decompress(veri)
            elif enc == "deflate":
                veri = zlib.decompress(veri)
            cs = r.headers.get_content_charset() or "utf-8"
            return r.status, veri.decode(cs, errors="replace"), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, "", url
    except Exception:
        return 0, "", url


_robots = {}


def izinli(url):
    p = urllib.parse.urlsplit(url)
    kok = f"{p.scheme}://{p.netloc}"
    if kok not in _robots:
        rp = urllib.robotparser.RobotFileParser()
        kod, metin, _ = getir(kok + "/robots.txt", zaman=10, en_fazla=500_000)
        if kod == 200 and metin:
            rp.parse(metin.splitlines())
            haritalar = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", metin)
        else:
            rp.parse([])  # robots.txt yoksa her şey serbest
            haritalar = []
        _robots[kok] = (rp, haritalar)
    return _robots[kok][0].can_fetch(UA, url)


def robots_haritalari(url):
    p = urllib.parse.urlsplit(url)
    izinli(url)
    return _robots[f"{p.scheme}://{p.netloc}"][1]


# ---------------------------------------------------------------- yardımcılar
def yerel(etiket):
    return etiket.rsplit("}", 1)[-1].lower() if etiket else ""


def temiz(metin, sinir=600):
    if not metin:
        return ""
    m = re.sub(r"<[^>]+>", " ", metin)
    m = html.unescape(m)
    m = re.sub(r"\s+", " ", m).strip()
    return m[:sinir]


def tarih_coz(s):
    if not s:
        return None
    s = s.strip()
    try:
        from email.utils import parsedate_to_datetime
        d = parsedate_to_datetime(s)
        if d:
            return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
    except Exception:
        pass
    try:
        d = dt.datetime.fromisoformat(s.replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def kimlik(url):
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


def xml_kok(metin):
    metin = metin.lstrip("﻿ \r\n\t")
    if not metin.startswith("<"):
        return None
    try:
        return ET.fromstring(metin.encode("utf-8"))
    except ET.ParseError:
        # bazı siteler XML başına çöp basıyor; ilk etiketten itibaren dene
        i = metin.find("<?xml")
        try:
            return ET.fromstring(metin[i:].encode("utf-8")) if i > 0 else None
        except ET.ParseError:
            return None


# ---------------------------------------------------------------- ayrıştırıcılar
def site_haritasi_coz(metin):
    """Haber site haritası: <url><loc>, <news:title>, <news:publication_date>."""
    kok = xml_kok(metin)
    if kok is None:
        return []
    cikti = []
    for u in kok.iter():
        if yerel(u.tag) != "url":
            continue
        loc = baslik = tarih = gorsel = None
        for c in u.iter():
            t = yerel(c.tag)
            if t == "loc" and loc is None:
                loc = (c.text or "").strip()
            elif t == "title":
                baslik = c.text
            elif t in ("publication_date", "lastmod") and tarih is None:
                tarih = c.text
            elif t == "image" and gorsel is None:
                for cc in c:
                    if yerel(cc.tag) == "loc" and (cc.text or "").strip().startswith("http"):
                        gorsel = cc.text.strip()
        if loc:
            cikti.append({"url": loc, "baslik": temiz(baslik, 300), "tarih": tarih_coz(tarih), "giris": "", "gorsel": gorsel})
    return cikti


def haber_haritasi_mi(metin):
    return "<urlset" in metin[:3000] and ("sitemap-news" in metin[:3000] or "<news:" in metin)


def harita_dizini_alt(metin):
    kok = xml_kok(metin)
    if kok is None or yerel(kok.tag) != "sitemapindex":
        return []
    return [(c.text or "").strip() for c in kok.iter() if yerel(c.tag) == "loc"]


def besleme_coz(metin):
    """RSS 2.0, RSS 1.0 (RDF) ve Atom."""
    kok = xml_kok(metin)
    if kok is None:
        return []
    cikti = []
    for it in kok.iter():
        t = yerel(it.tag)
        if t not in ("item", "entry"):
            continue
        d = {"url": "", "baslik": "", "tarih": None, "giris": "", "gorsel": None}
        for c in it:
            ct = yerel(c.tag)
            if ct == "title":
                d["baslik"] = temiz(c.text, 300)
            elif ct == "link":
                href = c.get("href")
                rel = c.get("rel", "alternate")
                if href and rel == "alternate":
                    d["url"] = href.strip()
                elif c.text and not d["url"]:
                    d["url"] = c.text.strip()
            elif ct == "guid" and not d["url"] and (c.text or "").startswith("http") and c.get("isPermaLink", "true") != "false":
                d["url"] = c.text.strip()
            elif ct in ("pubdate", "published", "updated", "date") and d["tarih"] is None:
                d["tarih"] = tarih_coz(c.text)
            elif ct in ("content", "thumbnail", "enclosure") and c.get("url"):
                if d["gorsel"]:
                    continue
                tip = (c.get("type") or c.get("medium") or "image").lower()
                if "image" in tip or re.search(r"\.(jpe?g|png|webp)(\?|$)", c.get("url"), re.I):
                    d["gorsel"] = c.get("url")
            elif ct in ("description", "summary", "encoded", "content") and not d["giris"]:
                d["giris"] = temiz(c.text)
                if not d["gorsel"]:
                    m = re.search(r'<img[^>]+src=["\']([^"\']+)', c.text or "")
                    if m and m.group(1).startswith("http"):
                        d["gorsel"] = html.unescape(m.group(1))
        if d["url"] and d["baslik"]:
            cikti.append(d)
    return cikti


def wp_coz(metin):
    try:
        veri = json.loads(metin)
    except Exception:
        return []
    if not isinstance(veri, list):
        return []
    cikti = []
    for p in veri:
        try:
            cikti.append({
                "url": p["link"],
                "baslik": temiz(p["title"]["rendered"], 300),
                "tarih": tarih_coz((p.get("date_gmt") or p.get("date") or "") + ("+00:00" if p.get("date_gmt") else "")),
                "giris": temiz((p.get("excerpt") or {}).get("rendered", "")),
            })
        except Exception:
            continue
    return cikti


def telegram_coz(metin, kanal):
    cikti = []
    for blok in re.split(r'<div class="tgme_widget_message_wrap', metin)[1:]:
        m = re.search(r'data-post="([^"]+)"', blok)
        z = re.search(r'<time[^>]+datetime="([^"]+)"', blok)
        y = re.search(r'<div class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>', blok, re.S)
        if not (m and y):
            continue
        metin_ = temiz(y.group(1), 700)
        if len(metin_) < 15:
            continue
        g = re.search(r"tgme_widget_message_photo_wrap[^>]+background-image:url\('([^']+)'\)", blok)
        cikti.append({
            "url": "https://t.me/" + m.group(1),
            "baslik": metin_[:140] + ("…" if len(metin_) > 140 else ""),
            "tarih": tarih_coz(z.group(1)) if z else None,
            "giris": metin_,
            "telegram": True,
            "gorsel": g.group(1) if g else None,
        })
    return cikti


def gorsel_bul(html_, taban):
    """Haber sayfasının paylaşım görseli (og:image ya da twitter:image). Yalnızca adresi alınır, görsel indirilmez."""
    for ad in ("og:image", "og:image:url", "twitter:image", "twitter:image:src"):
        m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']+)' % re.escape(ad), html_, re.I) \
            or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(ad), html_, re.I)
        if m:
            u = urllib.parse.urljoin(taban, html.unescape(m.group(1).strip()))
            if u.startswith("http"):
                return u
    return None


def sayfa_ozeti(html_):
    """Haber sayfasından özet için malzeme: meta açıklama ve ilk paragraflar (en fazla ~1200 karakter)."""
    parca = []
    for ad in ("og:description", "description", "twitter:description"):
        m = re.search(r'<meta[^>]+(?:property|name)=["\']%s["\'][^>]*content=["\']([^"\']+)' % re.escape(ad), html_, re.I) \
            or re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']%s["\']' % re.escape(ad), html_, re.I)
        if m:
            parca.append(temiz(m.group(1), 400))
            break
    for p in re.findall(r"<p[^>]*>(.*?)</p>", html_, re.S | re.I)[:8]:
        t = temiz(p, 400)
        if len(t) > 60:
            parca.append(t)
        if sum(map(len, parca)) > 1200:
            break
    return " ".join(parca)[:1400]


# ---------------------------------------------------------------- keşif
HABER_HARITA_YOLLARI = ["/news-sitemap.xml", "/sitemap-news.xml", "/sitemap_news.xml", "/news_sitemap.xml",
                        "/sitemaps/news.xml", "/sitemap/news.xml", "/googlenews.xml"]
BESLEME_YOLLARI = ["/feed", "/feed/", "/rss", "/rss.xml", "/feed.xml", "/atom.xml", "/index.xml", "/rss/"]


def dene_harita(url):
    if not izinli(url):
        return None
    kod, metin, son = getir(url)
    if kod != 200:
        return None
    if haber_haritasi_mi(metin) and site_haritasi_coz(metin):
        return {"tip": "harita", "url": son}
    for alt in harita_dizini_alt(metin)[:40]:
        if "news" in alt.lower() and izinli(alt):
            k2, m2, s2 = getir(alt)
            if k2 == 200 and haber_haritasi_mi(m2) and site_haritasi_coz(m2):
                return {"tip": "harita", "url": s2}
    return None


def dene_besleme(url):
    if not izinli(url):
        return None
    kod, metin, son = getir(url)
    if kod == 200 and besleme_coz(metin):
        return {"tip": "besleme", "url": son}
    return None


def kesfet(k):
    """Kaynak için en iyi yolu sırayla dener."""
    sayfa = k["url"]
    p = urllib.parse.urlsplit(sayfa)
    kok = f"{p.scheme}://{p.netloc}"
    alt_bolum = p.path.strip("/") != ""
    sonuc = {"yontem": None, "telegram": k.get("telegram")}

    kod, ana, _ = getir(sayfa) if izinli(sayfa) else (0, "", sayfa)

    # Telegram kanalı: sayfadaki t.me bağlantısı
    if not sonuc["telegram"] and ana:
        for h in re.findall(r'https?://(?:t\.me|telegram\.me)/([A-Za-z0-9_]{4,})', ana):
            if h.lower() not in ("share", "joinchat", "addstickers", "iv", "s"):
                sonuc["telegram"] = h
                break

    # 0) Kaynak listesinde elle verilmiş besleme adresleri
    for a in k.get("besleme") or []:
        r = dene_besleme(a) or dene_harita(a)
        if r:
            sonuc["yontem"] = r
            break

    # Sayfada bulunan kanal gerçekten mesaj veriyor mu? Vermiyorsa adaylara geç.
    if sonuc["telegram"] and not cek_telegram(sonuc["telegram"]):
        sonuc["telegram"] = None
    # Telegram adayları (sayfada çalışan bağlantı bulunamadıysa)
    if not sonuc["telegram"]:
        for h in k.get("telegram_aday") or []:
            if cek_telegram(h):
                sonuc["telegram"] = h
                break
    if sonuc["yontem"]:
        return sonuc

    # 1) Alt bölüm verilmişse önce o sayfanın kendi beslemesi
    adaylar = []
    if ana:
        for m in re.finditer(r'<link[^>]+type=["\']application/(?:rss|atom)\+xml["\'][^>]*>', ana, re.I):
            h = re.search(r'href=["\']([^"\']+)', m.group(0))
            if h:
                adaylar.append(urllib.parse.urljoin(sayfa, html.unescape(h.group(1))))
    if alt_bolum:
        for a in adaylar[:3]:
            r = dene_besleme(a)
            if r:
                sonuc["yontem"] = r
                return sonuc

    # 2) Haber site haritası (robots.txt'de bildirilenler, sonra bilinen yollar)
    for h in robots_haritalari(sayfa)[:15]:
        if "news" in h.lower():
            r = dene_harita(h)
            if r:
                sonuc["yontem"] = r
                return sonuc
    for yol in HABER_HARITA_YOLLARI:
        r = dene_harita(kok + yol)
        if r:
            sonuc["yontem"] = r
            return sonuc
    for h in robots_haritalari(sayfa)[:5]:
        if "news" not in h.lower():
            r = dene_harita(h)  # dizinin içinde haber haritası olabilir
            if r:
                sonuc["yontem"] = r
                return sonuc

    # 3) RSS/Atom: sayfada bildirilen, sonra bilinen yollar
    for a in adaylar[:5]:
        r = dene_besleme(a)
        if r:
            sonuc["yontem"] = r
            return sonuc
    for yol in BESLEME_YOLLARI:
        r = dene_besleme(kok + yol)
        if r:
            sonuc["yontem"] = r
            return sonuc

    # 4) WordPress API'si
    wp = kok + "/wp-json/wp/v2/posts?per_page=20&_fields=link,date,date_gmt,title,excerpt"
    if izinli(wp):
        kod, metin, _ = getir(wp)
        if kod == 200 and wp_coz(metin):
            sonuc["yontem"] = {"tip": "wp", "url": wp}
            return sonuc

    return sonuc


# ---------------------------------------------------------------- çekme
GN_DIL = {"ar": ("ar", "EG", "EG:ar"), "en": ("en-US", "US", "US:en"), "fr": ("fr", "FR", "FR:fr"), "tr": ("tr", "TR", "TR:tr"),
          "he": ("he", "IL", "IL:he"), "es": ("es", "ES", "ES:es"), "ca": ("es", "ES", "ES:es"), "it": ("it", "IT", "IT:it"),
          "de": ("de", "DE", "DE:de")}


def gnews_adresi(k):
    """Kaynağın kendi sitesine ulaşılamadığında son çare: Google Haberler'in o alan adı için RSS araması."""
    p = urllib.parse.urlsplit(k["url"])
    alan = p.netloc.lower().removeprefix("www.")
    yol = p.path.strip("/")
    q = f"site:{alan}" + (f"/{yol}" if yol and len(yol.split("/")[0]) == 2 else "") + " when:2d"
    hl, gl, ceid = GN_DIL.get(k["dil"], GN_DIL["en"])
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q": q, "hl": hl, "gl": gl, "ceid": ceid})


def gnews_coz(metin):
    ogeler = besleme_coz(metin)
    for o in ogeler:
        o["baslik"] = re.sub(r"\s+-\s+[^-]{2,80}$", "", o["baslik"]).strip()  # sondaki " - Yayın Adı"
        o["giris"] = ""
        o["gorsel"] = None
        o["gnews"] = True
    return ogeler


GDELT = "https://api.gdeltproject.org/api/v2/doc/doc"


def alan_adi(url):
    return urllib.parse.urlsplit(url).netloc.lower().removeprefix("www.")


def gdelt_topla(kaynaklar):
    """Sessiz kaynakların son 24 saatteki haberlerini GDELT'ten toplu sorgularla çeker.
    GDELT asıl haber adreslerini, başlıkları ve paylaşım görsellerini verir. 5 saniyede bir istek sınırına uyulur."""
    alanlar = {}
    for k in kaynaklar:
        alanlar.setdefault(alan_adi(k["url"]), []).append(k)
    liste = sorted(alanlar)
    # GitHub sunucuları GDELT'i paylaşımlı IP'den çağırdığı için sık sık 429 alınıyor.
    # Her çalıştırmada başlangıç grubu kaydırılır; böylece reddedilen gruplar sonraki çalıştırmalarda önce sorulur.
    gruplar = [liste[i:i + 8] for i in range(0, len(liste), 8)]
    if gruplar:
        kay = int(time.time() // 900) % len(gruplar)
        gruplar = gruplar[kay:] + gruplar[:kay]
    sonuc = {}
    ret = 0
    for grup in gruplar:
        if time.time() - BASLANGIC > CALISMA_SURESI - 60:
            break
        q = "(" + " OR ".join(f"domainis:{a}" for a in grup) + ")"
        url = GDELT + "?" + urllib.parse.urlencode({"query": q, "mode": "artlist", "format": "json", "maxrecords": "250",
                                                     "timespan": "24h", "sort": "datedesc"})
        if not izinli(url):
            log("GDELT robots.txt tarafından engelli")
            return sonuc
        kod, metin, _ = getir(url, zaman=40)
        for bekle in (20, 45):
            if kod != 429 or time.time() - BASLANGIC > CALISMA_SURESI - 120:
                break
            time.sleep(bekle)
            kod, metin, _ = getir(url, zaman=40)
        if kod == 429:
            ret += 1
            if ret >= 3:
                log("GDELT üst üste reddediyor; kalan gruplar sonraki çalıştırmaya kaldı")
                break
        else:
            ret = 0
        if kod == 200:
            try:
                for m in json.loads(metin).get("articles", []):
                    a = alan_adi(m.get("url", ""))
                    for k in alanlar.get(a, []):
                        try:
                            t = dt.datetime.strptime(m.get("seendate", ""), "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc)
                        except Exception:
                            t = None
                        sonuc.setdefault(k["id"], []).append({"url": m["url"], "baslik": temiz(m.get("title"), 300), "tarih": t,
                                                               "giris": "", "gorsel": m.get("socialimage") or None})
            except Exception as e:
                log(f"GDELT yanıtı okunamadı: {e}")
        else:
            log(f"GDELT yanıtı: {kod}")
        time.sleep(5.5)
    for kid in sonuc:
        sonuc[kid] = sonuc[kid][:KAYNAK_BASINA]
    return sonuc


def cek(yontem):
    if not yontem or not izinli(yontem["url"]):
        return None
    kod, metin, _ = getir(yontem["url"])
    if kod != 200:
        return None
    if yontem["tip"] == "harita":
        return site_haritasi_coz(metin)
    if yontem["tip"] == "besleme":
        return besleme_coz(metin)
    if yontem["tip"] == "wp":
        return wp_coz(metin)
    if yontem["tip"] == "gnews":
        return gnews_coz(metin)
    return None


def cek_telegram(kanal):
    url = f"https://t.me/s/{kanal}"
    if not izinli(url):
        return []
    kod, metin, _ = getir(url)
    return telegram_coz(metin, kanal) if kod == 200 else []


def kaynak_isle(k, durum):
    d = dict(durum.get(str(k["id"]), {}))
    son_kesif = tarih_coz(d.get("kesif")) or SIMDI - dt.timedelta(days=99)
    gecen = SIMDI - son_kesif
    if d.get("surum") != KESIF_SURUMU and (not d.get("son_basari") or (SIMDI - tarih_coz(d["son_basari"])).days >= 1):
        gerek = True  # yeni keşif yöntemleri yalnızca çalışmayan kaynaklarda denensin
    elif d.get("surum") != KESIF_SURUMU:
        d["surum"] = KESIF_SURUMU
        gerek = False
    elif d.get("yontem"):
        gerek = d.get("hata", 0) >= 3 or gecen.days >= YENIDEN_KESIF_GUN
    else:
        gerek = gecen >= dt.timedelta(hours=24)  # yol bulunamadıysa günde bir kez yeniden dene
    if gerek:
        s = kesfet(k)
        d["yontem"] = s["yontem"]
        d["telegram"] = s["telegram"] or d.get("telegram")
        d["kesif"] = SIMDI.isoformat()
        d["surum"] = KESIF_SURUMU
        d["hata"] = 0
    ogeler = cek(d.get("yontem")) if d.get("yontem") else None
    if ogeler is None:
        d["hata"] = d.get("hata", 0) + 1
        ogeler = []
    else:
        d["hata"] = 0
        d["son_basari"] = SIMDI.isoformat()
    if d.get("telegram"):
        tg = cek_telegram(d["telegram"])
        ogeler += tg
        if tg:
            d["son_basari"] = SIMDI.isoformat()
    # Otomatik bulunan yol başka bir dilin ya da alt sitenin haberlerini getirmesin:
    # kaynak adresi bir dil bölümüyse (/en/, /fr/ ...) yalnızca o bölümün haberlerini tut.
    p = urllib.parse.urlsplit(k["url"])
    ilk = p.path.strip("/").split("/")[0] if p.path.strip("/") else ""
    host = p.netloc.lower().removeprefix("www.")
    elle = set(k.get("besleme") or [])
    if d.get("yontem") and d["yontem"].get("url") not in elle and d["yontem"].get("tip") != "gnews":
        def uygun(o):
            if o.get("telegram"):
                return True
            q = urllib.parse.urlsplit(o["url"])
            if q.netloc.lower().removeprefix("www.") != host:
                return False
            return not (len(ilk) == 2 and not q.path.strip("/").startswith(ilk + "/"))
        ogeler = [o for o in ogeler if uygun(o)]
    d["son_oge"] = len(ogeler)
    ogeler.sort(key=lambda o: o["tarih"] or SIMDI, reverse=True)
    return k, d, ogeler[:KAYNAK_BASINA]


# ---------------------------------------------------------------- Gemini
GEMINI = "https://generativelanguage.googleapis.com/v1beta"


def gemini_model(anahtar):
    if os.environ.get("GEMINI_MODEL"):
        return os.environ["GEMINI_MODEL"]
    kod, metin, _ = getir(GEMINI + "/models?pageSize=200", basliklar={"x-goog-api-key": anahtar})
    if kod != 200:
        return None
    adlar = []
    for m in json.loads(metin).get("models", []):
        ad = m.get("name", "").split("/")[-1]
        if "generateContent" not in m.get("supportedGenerationMethods", []):
            continue
        if any(x in ad for x in ("preview", "exp", "image", "tts", "audio", "live", "thinking", "embedding")):
            continue
        if "flash" in ad:
            adlar.append(ad)

    def puan(ad):
        surum = re.search(r"(\d+(?:\.\d+)?)", ad)
        return ("lite" in ad, float(surum.group(1)) if surum else 0)

    adlar.sort(key=puan, reverse=True)
    return adlar[0] if adlar else None


TALIMAT = """Sen bir Türkçe haber ajansının editörüsün. Aşağıdaki JSON listesindeki her haber için Türkçe bir başlık ve özet yaz.

Kurallar:
- baslik: Türkçe, en fazla 14 kelime, haberin özünü veren sade bir başlık.
- ozet: Türkçe, 2-3 cümle. Tamamen kendi cümlelerinle yaz; kaynaktan cümle kopyalama. Doğrudan alıntı gerekiyorsa en fazla bir tane ve 10 kelimeyi geçmesin.
- Yalnızca verilen metindeki bilgileri kullan, bilgi ekleme, yorum katma.
- İddiaları sahibine atfet ("... göre", "... açıkladı"). Ölü sayısı gibi rakamları kaynağıyla birlikte ver.
- metin alanı boşsa yalnızca başlıkta yazanı Türkçe bir cümleyle aktar; başlıkta olmayan hiçbir bilgi ekleme.
- Metin bir Telegram mesajıysa ve haber değeri yoksa (reklam, selamlama, tek bağlantı) ozet alanına "ATLA" yaz.
- etiketler: haberin konusuna uyan en fazla 3 etiket; YALNIZCA şu listeden seç: {ETIKETLER}
- Yalnızca şu biçimde bir JSON dizisi döndür: [{"id": "...", "baslik": "...", "ozet": "...", "etiketler": ["..."]}]
"""
TALIMAT = TALIMAT.replace("{ETIKETLER}", ", ".join(ekler.ETIKETLER))


def gemini_ozetle(anahtar, model, parti):
    girdi = [{"id": h["id"], "kaynak": h["kaynak_ad"], "dil": h["dil"], "baslik": h["baslik_orj"], "metin": h.get("_malzeme", "")}
             for h in parti]
    govde = {
        "contents": [{"role": "user", "parts": [{"text": TALIMAT + "\n\n" + json.dumps(girdi, ensure_ascii=False)}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    istek = urllib.request.Request(
        f"{GEMINI}/models/{model}:generateContent",
        data=json.dumps(govde).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(istek, timeout=90) as r:
            yanit = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, []
    except Exception:
        return 0, []
    try:
        metin = yanit["candidates"][0]["content"]["parts"][0]["text"]
        metin = re.sub(r"^```(?:json)?|```$", "", metin.strip()).strip()
        return 200, json.loads(metin)
    except Exception:
        return 200, []


def malzeme_hazirla(h):
    m = h.get("giris") or ""
    if (len(m) < 150 or not h.get("gorsel")) and not h.get("telegram") and not h.get("gnews") and izinli(h["url"]):
        kod, sayfa, _ = getir(h["url"], zaman=12, en_fazla=1_500_000)
        if kod == 200:
            if len(m) < 150:
                m = (m + " " + sayfa_ozeti(sayfa)).strip()
            h["gorsel"] = h.get("gorsel") or gorsel_bul(sayfa, h["url"])
        h["gorsel_denendi"] = True
    h["_malzeme"] = m[:1500]


def gorsel_tamamla(h):
    if izinli(h["url"]):
        kod, sayfa, _ = getir(h["url"], zaman=12, en_fazla=1_500_000)
        if kod == 200:
            h["gorsel"] = gorsel_bul(sayfa, h["url"])
    h["gorsel_denendi"] = True


# ---------------------------------------------------------------- ana akış
def oku(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def yaz(yol, veri):
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(gecici, yol)


def main():
    try:
        marka.uygula()
    except Exception as e:
        log(f"Marka uygulanamadı: {e}")
    kaynaklar = oku(KAYNAKLAR, [])
    durum = oku(DURUM, {})
    eski = {h["id"]: h for h in oku(HABERLER, {}).get("haberler", [])}
    sinir = SIMDI - dt.timedelta(days=SAKLA_GUN)

    with ThreadPoolExecutor(max_workers=16) as ex:
        sonuclar = list(ex.map(lambda k: kaynak_isle(k, durum), kaynaklar))

    # Son çare: hiçbir yolla okunamayan kaynaklar için GDELT haber veritabanı (asıl haber adresini verir)
    yolsuz = [(k, d) for k, d, ogeler in sonuclar if not ogeler]
    if yolsuz:
        gd = gdelt_topla([k for k, _ in yolsuz])
        bulunan = 0
        for k, d in yolsuz:
            og = gd.get(k["id"], [])
            if og:
                bulunan += 1
                d["son_basari"] = SIMDI.isoformat()
                d["gdelt"] = True
                for j, (kk, dd, oo) in enumerate(sonuclar):
                    if kk["id"] == k["id"]:
                        sonuclar[j] = (kk, dd, og)
        log(f"GDELT: {len(yolsuz)} sessiz kaynaktan {bulunan} tanesinde haber bulundu")

    yeni = 0
    for k, d, ogeler in sonuclar:
        durum[str(k["id"])] = d
        for o in ogeler:
            t = o["tarih"] or SIMDI
            if t < sinir or t > SIMDI + dt.timedelta(hours=2):
                continue
            hid = kimlik(o["url"])
            if hid in eski:
                continue
            eski[hid] = {
                "id": hid, "kaynak": k["id"], "kaynak_ad": k["ad"], "dil": k["dil"],
                "url": o["url"], "tarih": t.astimezone(dt.timezone.utc).isoformat(), "eklendi": SIMDI.isoformat(),
                "baslik_orj": o["baslik"], "giris": o.get("giris", ""),
                "telegram": bool(o.get("telegram")),
                "gnews": bool(o.get("gnews")) or None,
                "gorsel": o.get("gorsel"),
                "ilgili": ilgili_mi(o["baslik"] + " " + o.get("giris", ""), k["dil"], k["bolge"]),
            }
            yeni += 1
    log(f"{yeni} yeni haber; {sum(1 for _, d, _ in sonuclar if d.get('yontem'))}/{len(kaynaklar)} kaynakta yol bulundu")

    # Özetler
    anahtar = os.environ.get("GEMINI_API_KEY", "").strip()
    bekle = tarih_coz(durum.get("_gemini_bekle"))
    model = None
    if anahtar and not (bekle and bekle > SIMDI):
        model = gemini_model(anahtar)
        sira = sorted((h for h in eski.values() if h["ilgili"] and not h.get("ozet_tr") and not h.get("atla")
                       and h.get("deneme", 0) < 3), key=lambda h: h["tarih"], reverse=True)[:OZET_SINIRI]
        if model and sira:
            with ThreadPoolExecutor(max_workers=8) as ex:
                list(ex.map(malzeme_hazirla, sira))
            yazilan = 0
            for i in range(0, len(sira), PARTI):
                if time.time() - BASLANGIC > CALISMA_SURESI:
                    break
                parti = sira[i:i + PARTI]
                kod, sonuc = gemini_ozetle(anahtar, model, parti)
                if kod == 429:
                    durum["_gemini_bekle"] = (SIMDI + dt.timedelta(minutes=60)).isoformat()
                    log("Gemini kotası doldu; bir saat sonra yeniden denenecek")
                    break
                if kod != 200:
                    log(f"Gemini hatası: {kod}")
                    for h in parti:
                        h["deneme"] = h.get("deneme", 0) + 1
                    continue
                cevap = {str(c.get("id")): c for c in sonuc if isinstance(c, dict)}
                for h in parti:
                    c = cevap.get(h["id"])
                    if not c:
                        h["deneme"] = h.get("deneme", 0) + 1
                    elif (c.get("ozet") or "").strip().upper() == "ATLA":
                        h["atla"] = True
                    else:
                        h["baslik_tr"] = temiz(c.get("baslik"), 200)
                        h["ozet_tr"] = temiz(c.get("ozet"), 700)
                        et = [e for e in (c.get("etiketler") or []) if e in ekler.ETIKETLER][:3]
                        if et:
                            h["etiket"] = et
                        yazilan += 1
                time.sleep(4)  # dakika başı istek sınırına takılmamak için
            durum["_model"] = model
            log(f"{yazilan} özet yazıldı ({model})")
        elif not model:
            log("Uygun Gemini modeli bulunamadı; GEMINI_MODEL ile elle belirtilebilir")

        # Aynı olayı anlatan haberleri saatte bir kümele ve çerçeve notu yazdır
        son_olay = tarih_coz(durum.get("_olay_son"))
        bekle = tarih_coz(durum.get("_gemini_bekle"))
        if model and not (bekle and bekle > SIMDI) and (not son_olay or SIMDI - son_olay >= dt.timedelta(minutes=55) or durum.get("_olay_surum") != 4) \
                and time.time() - BASLANGIC < CALISMA_SURESI:
            sonuc = ekler.olaylari_kumele(anahtar, model, list(eski.values()), SIMDI)
            if isinstance(sonuc, list):
                yaz(OLAYLAR, {"guncellendi": SIMDI.isoformat(), "olaylar": sonuc})
                try:
                    log(f"Kanıt defteri: {ekler.kanit_guncelle(KOK, sonuc, eski)} yeni ölçüm")
                except Exception as e:
                    log(f"Kanıt defteri hatası: {e}")
                durum["_olay_son"] = SIMDI.isoformat()
                durum["_olay_surum"] = 4
                log(f"{len(sonuc)} olay kümesi çıkarıldı")
            elif sonuc == 429:
                durum["_gemini_bekle"] = (SIMDI + dt.timedelta(minutes=60)).isoformat()
                log("Olay kümeleme: Gemini kotası doldu")
            else:
                log(f"Olay kümeleme yapılamadı ({sonuc})")
    elif not anahtar:
        log("GEMINI_API_KEY yok; özet yazılmadı")

    # Görseli olmayan özetli haberler için sayfadan paylaşım görselini bul (çalıştırma başına en fazla 40)
    eksik = [h for h in eski.values() if h.get("ozet_tr") and not h.get("gorsel") and not h.get("gorsel_denendi")
             and not h.get("telegram") and not h.get("gnews")][:40]
    if eksik and time.time() - BASLANGIC < CALISMA_SURESI:
        with ThreadPoolExecutor(max_workers=8) as ex:
            list(ex.map(gorsel_tamamla, eksik))
        log(f"{sum(1 for h in eksik if h.get('gorsel'))}/{len(eksik)} habere görsel bulundu")

    # Olay kümelerini haberlere işle
    olay_veri = oku(OLAYLAR, {"olaylar": []})
    for h in eski.values():
        h.pop("olay", None)
    for o in olay_veri.get("olaylar", []):
        for i in o["haberler"]:
            if i in eski:
                eski[i]["olay"] = o["id"]
    try:
        log(f"Olay arşivi: {almanak.olay_arsivle(KOK, olay_veri.get('olaylar', []), eski)} olay işlendi")
    except Exception as e:
        log(f"Olay arşivi hatası: {e}")

    # Birden fazla kaynağın yazdığı olayların haberlerini Wayback Machine'e kaydet
    wb = durum.setdefault("_wayback", {})
    for hid, kayit in wb.items():
        if hid in eski and kayit.get("url"):
            eski[hid]["arsiv"] = kayit["url"]
    wb_bekle = tarih_coz(durum.get("_wayback_bekle"))
    if not (wb_bekle and wb_bekle > SIMDI):
        sira = [eski[i] for o in olay_veri.get("olaylar", []) for i in o["haberler"]
                if i in eski and not (wb.get(i) or {}).get("url") and (wb.get(i) or {}).get("deneme", 0) < 3
                and not eski[i].get("telegram") and not eski[i].get("gnews")]
        kaydedilen = 0
        for h in sira[:8]:
            if time.time() - BASLANGIC > CALISMA_SURESI + 120:
                break
            sonuc = ekler.wayback_kaydet(h["url"])
            if sonuc == "KOTA":
                durum["_wayback_bekle"] = (SIMDI + dt.timedelta(minutes=30)).isoformat()
                log("Wayback kotası doldu; yarım saat sonra yeniden denenecek")
                break
            wb[h["id"]] = {"zaman": SIMDI.isoformat(), "url": sonuc, "deneme": (wb.get(h["id"]) or {}).get("deneme", 0) + 1}
            if sonuc:
                h["arsiv"] = sonuc
                kaydedilen += 1
        if sira:
            log(f"Wayback: {kaydedilen}/{min(len(sira), 8)} haber arşivlendi")
    for hid in [i for i, k in wb.items() if (SIMDI - (tarih_coz(k.get("zaman")) or SIMDI)).days > 3]:
        wb.pop(hid, None)

    # Kaydet: eski haberleri at, ham metinleri temizle
    tut = [h for h in eski.values() if (tarih_coz(h["tarih"]) or SIMDI) >= sinir]
    tut.sort(key=lambda h: h["tarih"], reverse=True)
    tut = tut[:EN_FAZLA_HABER]
    for h in tut:
        h.pop("_malzeme", None)
        if h.get("ozet_tr") or h.get("atla") or not h.get("ilgili"):
            h["giris"] = ""  # özeti yazılanların ham metnini saklamıyoruz
        else:
            h["giris"] = h.get("giris", "")[:300]
    yaz(HABERLER, {"guncellendi": SIMDI.isoformat(), "haberler": tut})
    try:
        gun = ekler.arsive_yaz(KOK, tut)
        ekler.rss_yaz(KOK, tut, SIMDI)
        log(f"Arşiv: {gun} günlük dosya güncellendi; RSS yazıldı")
    except Exception as e:  # arşiv hatası toplamayı durdurmasın
        log(f"Arşiv/RSS hatası: {e}")
    # Almanak: biten hafta / ay / yıl için kesin bülten, sürenler için günlük taslak
    try:
        bekle = tarih_coz(durum.get("_gemini_bekle"))
        n, kota = almanak.bultenleri_guncelle(
            KOK, kaynaklar, anahtar if not (bekle and bekle > SIMDI) else "", model, SIMDI,
            sure_var=lambda: time.time() - BASLANGIC < 12 * 60, log=log)
        if kota:
            durum["_gemini_bekle"] = (SIMDI + dt.timedelta(minutes=60)).isoformat()
    except Exception as e:
        log(f"Almanak hatası: {e}")
    durum["_son_calisma"] = SIMDI.isoformat()
    yaz(DURUM, durum)
    log(f"{len(tut)} haber kaydedildi; süre {int(time.time() - BASLANGIC)} sn")


if __name__ == "__main__":
    main()
