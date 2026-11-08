"""Geriye dönük arşiv taraması (A katmanı): 7 Ekim 2023'ten toplayıcının başladığı güne kadar her yayının haber listesi.

Yalnızca başlık, tarih, yayın ve bağlantı toplanır; yapay zekâ kullanılmaz, Gemini kotası harcanmaz.
Yöntemler (kaynak başına sırayla denenir; robots.txt'ye her zaman uyulur):
  wp        WordPress API'si: tarih aralığıyla sayfa sayfa, gerçek başlıklarla
  harita    site haritası dizini: tarih içeren alt haritalar; başlık yoksa adresten (slug) çıkarılır
  telegram  t.me/s/<kanal>?before=… ile geriye doğru sayfa sayfa (yalnızca Telegram kaynakları)
  cdx       Internet Archive (Wayback Machine) adres dizini: site bizi engelliyorsa; başlık adresten çıkarılır
Her çalıştırma ZAMAN saniye çalışır, kaldığı yerden devam eder. Durum ve veri "tarama" dalında, tarama/ klasöründe:
  tarama/durum.json            kaynak başına yöntem, görev kuyruğu, sayılar
  tarama/veri/<kaynak>/<yıl>.jsonl   {"u": adres, "b": başlık, "t": ISO tarih, "m": yöntem, "s": başlık slugdan mı}
  tarama/ilerleme.json         özet (yüzde, toplam, tahmini bitiş)
"""
import datetime as dt
import gzip
import shutil
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
import topla as T  # noqa: E402  (getir, izinli, site haritası ve WordPress çözücüleri)

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KLASOR = os.path.join(KOK, "tarama")
BAS = dt.datetime(2023, 10, 7, tzinfo=dt.timezone.utc)
BIT = dt.datetime(2026, 11, 6, tzinfo=dt.timezone.utc)
ZAMAN = int(os.environ.get("TARAMA_SURE") or 45 * 60)
TARAMA_SURUM = 2              # veri biçimi değişince artır: eski veri silinir, tarama baştan başlar
KAYNAK_SURE = 5 * 60          # bir çalıştırmada kaynak başına en çok; böylece her çalıştırmada çok sayıda kaynak ilerler
BASLANGIC = time.time()
_kilit = threading.Lock()
_alan_son = {}


def log(m):
    print(m, flush=True)


def sure_var(pay=60):
    return time.time() - BASLANGIC < ZAMAN - pay


def getir(url, zaman=25):
    """Alan adı başına en az 1,5 sn arayla (sitelere yük bindirmemek için)."""
    alan = urllib.parse.urlsplit(url).netloc
    with _kilit:
        bekle = _alan_son.get(alan, 0) + 1.5 - time.time()
        _alan_son[alan] = time.time() + max(0, bekle)
    if bekle > 0:
        time.sleep(bekle)
    return T.getir(url, zaman=zaman, en_fazla=20_000_000)


def aylar():
    a, s = [], dt.date(BAS.year, BAS.month, 1)
    while s <= BIT.date():
        a.append(s.strftime("%Y-%m"))
        s = (s.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return a


# ------------------------------------------------------------------ adres ve başlık
_ELE = re.compile(r"/(tag|tags|category|categories|author|authors|page|feed|search|wp-content|wp-json|video|videos|photo|photos|"
                  r"gallery|live|amp|print|comment)s?(/|$)|\.(jpg|jpeg|png|gif|webp|pdf|css|js|xml|mp4|mp3)$", re.I)


def haber_adresi_mi(url, alan):
    p = urllib.parse.urlsplit(url)
    if p.netloc.lower().removeprefix("www.") != alan or _ELE.search(p.path):
        return False
    yol = p.path.strip("/")
    return len(yol) >= 12 and ("/" in yol or "-" in yol or yol.isdigit() is False)


def slug_baslik(url):
    yol = urllib.parse.unquote(urllib.parse.urlsplit(url).path.strip("/"))
    parca = [x for x in yol.split("/") if x]
    if not parca:
        return ""
    son = re.sub(r"\.(html?|php|aspx?)$", "", parca[-1])
    if re.fullmatch(r"[\d\-_]+", son) and len(parca) > 1:
        son = re.sub(r"\.(html?|php|aspx?)$", "", parca[-2])
    metin = re.sub(r"[-_+]+", " ", son)
    metin = re.sub(r"\b\d{5,}\b", "", metin).strip()
    return metin[:200] if sum(ch.isalpha() for ch in metin) >= 6 else ""


# Bölgeyle ilgili başlık ya da adres (Filistin yayınları dışındaki kaynaklarda yalnızca bunlar tutulur). 9 dil, küçük harf.
ILGI = re.compile(
    r"gaza|gazze|غزة|עזה|palestin|filist|فلسطين|פלסטינ|israel|isra[iı]l|إسرائيل|اسرائيل|ישראל|zionis|siyon|صهيون|hamas|حماس|חמאס|"
    r"hezbollah|hizbullah|hizbollah|حزب الله|חיזבאללה|lebanon|liban|lübnan|libano|líbano|لبنان|לבנון|west bank|cisjordan|batı şeria|"
    r"الضفة|westjordanland|cisgiordania|jerusalem|kudüs|القدس|ירושלים|gerusalemme|jérusalem|jerusalén|al-?aqsa|aksa|الأقصى|"
    r"yemen|اليمن|houthi|husi|الحوثي|ansarallah|iran|إيران|איראן|syria|suriye|syrie|siria|سوريا|سورية|netanyahu|نتنياهو|נתניהו|"
    r"\bidf\b|tsahal|occupation|işgal|احتلال|genocid|soykırım|إبادة|ceasefire|ateşkes|cessez|hudna|هدنة|rafah|refah|رفح|khan ?y[ou]nis|"
    r"han yunus|خان يونس|jenin|cenin|جنين|nablus|نابلس|tulkarm|طولكرم|unrwa|أونروا|sinwar|السنوار|nasrallah|نصر الله|"
    r"middle east|orta doğu|ortadoğu|moyen-orient|oriente medio|medio oriente|nahost|الشرق الأوسط|flotilla|أسطول الصمود", re.I)
_ILGISIZ_DEGIL = {"Filistin"}   # bu kamptaki yayınların her haberi tutulur


def ilgili_mi(r):
    return bool(ILGI.search((r.get("b") or "") + " " + urllib.parse.unquote(r.get("u") or "")))


_KAMP = {}
_BILINEN = {}   # dosya -> bilinen adresler (çalıştırma boyunca bellekte)


def yaz(kid, kayitlar):
    """Kayıtları sıkıştırılmış yıl dosyalarına ekler (aynı adres bir kez). Filistin yayınları dışında yalnızca bölgeyle ilgililer."""
    hepsi = _KAMP.get(kid) in _ILGISIZ_DEGIL
    yil = {}
    for r in kayitlar:
        if not hepsi and r.get("m") != "telegram" and not ilgili_mi(r):
            continue
        if r["t"] and BAS.isoformat() <= r["t"] < BIT.isoformat():
            yil.setdefault(r["t"][:4], []).append(r)
    n = 0
    for y, rs in yil.items():
        d = os.path.join(KLASOR, "veri", str(kid))
        os.makedirs(d, exist_ok=True)
        yol = os.path.join(d, f"{y}.jsonl.gz")
        with _kilit:
            var = _BILINEN.get(yol)
            if var is None:
                var = set()
                if os.path.exists(yol):
                    with gzip.open(yol, "rt", encoding="utf-8") as f:
                        for satir in f:
                            try:
                                var.add(json.loads(satir)["u"])
                            except Exception:
                                pass
                _BILINEN[yol] = var
            with gzip.open(yol, "at", encoding="utf-8") as f:
                for r in rs:
                    if r["u"] not in var:
                        var.add(r["u"])
                        f.write(json.dumps(r, ensure_ascii=False) + "\n")
                        n += 1
    return n


def _iso(t):
    return t.astimezone(dt.timezone.utc).isoformat() if isinstance(t, dt.datetime) else None


# ------------------------------------------------------------------ planlama
def planla(k):
    """Kaynak için yöntem ve görev kuyruğu."""
    if k.get("sadece_telegram") or k.get("telegram"):
        kanal = k.get("sadece_telegram") or k.get("telegram")
        if T.izinli(f"https://t.me/s/{kanal}"):
            kod, metin, _ = getir(f"https://t.me/s/{kanal}")
            if kod == 200 and T.telegram_coz(metin, kanal):
                return {"yontem": "telegram", "kanal": kanal, "gorev": [{"once": None}]}
        if k.get("sadece_telegram"):
            return {"yontem": "yok", "gorev": [], "not": "Telegram web önizlemesi kapalı"}
    p = urllib.parse.urlsplit(k["url"])
    kok = f"{p.scheme}://{p.netloc}"
    alan = p.netloc.lower().removeprefix("www.")
    # 1) WordPress API'si
    wp = kok + "/wp-json/wp/v2/posts?per_page=1&_fields=link,date_gmt,title&after=" + BAS.strftime("%Y-%m-%dT00:00:00")
    if T.izinli(wp):
        kod, metin, _ = getir(wp)
        if kod == 200 and T.wp_coz(metin):
            return {"yontem": "wp", "kok": kok, "gorev": [{"ay": a, "sayfa": 1} for a in aylar()]}
    # 2) Site haritası dizini: tarih içeren ya da yeterince yeni alt haritalar
    adaylar = list(dict.fromkeys((T.robots_haritalari(kok + "/") or []) + [kok + "/sitemap.xml", kok + "/sitemap_index.xml"]))
    alt = []
    for a in adaylar[:6]:
        if not T.izinli(a):
            continue
        kod, metin, _ = getir(a)
        if kod != 200:
            continue
        cocuk = _dizin(metin)
        if cocuk:
            alt += cocuk
        elif "<urlset" in metin[:3000]:
            alt.append((a, None))
    secilen = []
    for u, lastmod in dict.fromkeys(alt):
        yil = re.findall(r"(20(?:23|24|25|26))", u)
        if yil or (lastmod and lastmod[:10] >= BAS.date().isoformat()) or re.search(r"sitemap-?\d+\.xml|post-sitemap\d*\.xml", u):
            secilen.append(u)
    if secilen:
        return {"yontem": "harita", "alan": alan, "gorev": [{"url": u} for u in secilen[:4000]]}
    # 3) Internet Archive adres dizini
    cdx = "https://web.archive.org/cdx/search/cdx"
    if T.izinli(cdx + "?url=" + alan):
        return {"yontem": "cdx", "alan": alan, "gorev": [{"ay": a} for a in aylar()]}
    return {"yontem": "yok", "gorev": [], "not": "uygun yol yok"}


def _dizin(metin):
    kok = T.xml_kok(metin)
    if kok is None or T.yerel(kok.tag) != "sitemapindex":
        return []
    cikti = []
    for sm in kok:
        loc = lastmod = None
        for c in sm.iter():
            t = T.yerel(c.tag)
            if t == "loc":
                loc = (c.text or "").strip()
            elif t == "lastmod":
                lastmod = (c.text or "").strip()
        if loc:
            cikti.append((loc, lastmod))
    return cikti


# ------------------------------------------------------------------ görevler
def gorev_isle(k, d):
    """Kuyruğun başındaki görevi işler. Döndürür: yazılan kayıt sayısı (görev bittiyse kuyruktan çıkar)."""
    g = d["gorev"][0]
    kid = k["id"]
    y = d["yontem"]
    if y == "wp":
        a0 = dt.datetime.strptime(g["ay"] + "-01", "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
        a1 = (a0.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
        url = (d["kok"] + "/wp-json/wp/v2/posts?per_page=100&_fields=link,date_gmt,title&orderby=date&order=asc"
               f"&after={a0:%Y-%m-%dT%H:%M:%S}&before={a1:%Y-%m-%dT%H:%M:%S}&page={g['sayfa']}")
        kod, metin, _ = getir(url, zaman=40)
        ogeler = T.wp_coz(metin) if kod == 200 else []
        n = yaz(kid, [{"u": o["url"], "b": o["baslik"], "t": _iso(o["tarih"]), "m": "wp"} for o in ogeler])
        if kod == 200 and len(ogeler) == 100:
            g["sayfa"] += 1
        else:
            d["gorev"].pop(0)                       # ay bitti (ya da sayfa yok: 400)
        return n
    if y == "harita":
        url = g["url"]
        d["gorev"].pop(0)
        if not T.izinli(url):
            return 0
        kod, metin, _ = getir(url, zaman=40)    # .gz haritaları getir() kendisi açar
        if kod != 200:
            return 0
        cocuk = _dizin(metin)
        if cocuk:   # iç içe dizin: yeni görevler
            for u, lastmod in cocuk:
                if re.findall(r"20(?:23|24|25|26)", u) or (lastmod and lastmod[:10] >= BAS.date().isoformat()):
                    d["gorev"].append({"url": u})
            return 0
        kay = []
        for o in T.site_haritasi_coz(metin):
            if not haber_adresi_mi(o["url"], d["alan"]):
                continue
            b = o["baslik"] or slug_baslik(o["url"])
            kay.append({"u": o["url"], "b": b, "t": _iso(o["tarih"]), "m": "harita", **({"s": 1} if not o["baslik"] else {})})
        return yaz(kid, kay)
    if y == "telegram":
        kanal = d["kanal"]
        url = f"https://t.me/s/{kanal}" + (f"?before={g['once']}" if g.get("once") else "")
        kod, metin, _ = getir(url)
        og = T.telegram_coz(metin, kanal, 700) if kod == 200 else []
        if not og:
            d["gorev"].pop(0)
            return 0
        n = yaz(kid, [{"u": o["url"], "b": o["baslik"], "t": _iso(o["tarih"]), "m": "telegram"} for o in og])
        enk = min(int(o["url"].rsplit("/", 1)[-1]) for o in og if o["url"].rsplit("/", 1)[-1].isdigit())
        en_eski = min((o["tarih"] for o in og if o["tarih"]), default=None)
        if (en_eski and en_eski < BAS) or enk <= 1:
            d["gorev"].pop(0)
        else:
            g["once"] = enk
        return n
    if y == "cdx":
        ay = g["ay"].replace("-", "")
        q = {"url": d["alan"] + "/*", "from": ay, "to": ay, "output": "json", "fl": "timestamp,original",
             "filter": ["statuscode:200", "mimetype:text/html"], "collapse": "urlkey", "limit": "50000"}
        url = "https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(q, doseq=True)
        kod, metin, _ = getir(url, zaman=90)
        if kod != 200:
            g["deneme"] = g.get("deneme", 0) + 1
            if g["deneme"] >= 3:
                d["gorev"].pop(0)
            return 0
        d["gorev"].pop(0)
        try:
            satirlar = json.loads(metin or "[]")[1:]
        except Exception:
            return 0
        kay = []
        for ts, orj in satirlar:
            orj = orj.split("?")[0].split("#")[0]
            if not haber_adresi_mi(orj, d["alan"]):
                continue
            b = slug_baslik(orj)
            if not b:
                continue
            t = dt.datetime.strptime(ts[:14], "%Y%m%d%H%M%S").replace(tzinfo=dt.timezone.utc)
            kay.append({"u": orj, "b": b, "t": t.isoformat(), "m": "cdx", "s": 1})
        return yaz(kid, kay)
    d["gorev"].clear()
    return 0


def kaynak_calis(k, d):
    """Bir kaynağın görevlerini zaman bitene kadar işler."""
    n, t0 = 0, time.time()
    if not sure_var(120):
        return 0
    try:
        if "yontem" not in d:
            d.update(planla(k))
            d["toplam_gorev"] = len(d.get("gorev", []))
        while d.get("gorev") and sure_var() and time.time() - t0 < KAYNAK_SURE:
            n += gorev_isle(k, d)
    except Exception as e:
        d["hata"] = f"{type(e).__name__}: {str(e)[:120]}"
    d["sayi"] = d.get("sayi", 0) + n
    d["bitti"] = not d.get("gorev")
    return n


def ilerleme(durum, kaynaklar, simdi):
    ks = [str(k["id"]) for k in kaynaklar]
    bitti = sum(1 for i in ks if durum["kaynak"].get(i, {}).get("bitti"))
    gorev_kalan = sum(len(durum["kaynak"].get(i, {}).get("gorev", [])) for i in ks)
    toplam = sum(durum["kaynak"].get(i, {}).get("sayi", 0) for i in ks)
    yontem = {}
    for i in ks:
        y = durum["kaynak"].get(i, {}).get("yontem", "planlanmadı")
        yontem[y] = yontem.get(y, 0) + 1
    gecmis = durum.setdefault("gecmis", [])
    gecmis.append([simdi.isoformat(), gorev_kalan])
    durum["gecmis"] = gecmis[-200:]
    tahmin = None
    if len(gecmis) >= 6:
        t0, g0 = gecmis[-6]
        hiz = (g0 - gorev_kalan) / max(1, (simdi - dt.datetime.fromisoformat(t0)).total_seconds())
        if hiz > 0:
            tahmin = (simdi + dt.timedelta(seconds=gorev_kalan / hiz)).isoformat()
    return {"guncellendi": simdi.isoformat(), "kaynak": len(ks), "biten_kaynak": bitti, "kalan_gorev": gorev_kalan,
            "toplanan_haber": toplam, "yontemler": yontem, "tahmini_bitis": tahmin, "baslangic": durum.get("baslangic")}


def bildir(metin):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    m = re.search(r"\d{6,12}:[A-Za-z0-9_-]{30,}", token)
    yonetici = re.sub(r"\D", "", os.environ.get("TELEGRAM_YONETICI", ""))
    if not m or not yonetici:
        return
    try:
        urllib.request.urlopen(urllib.request.Request(f"https://api.telegram.org/bot{m.group(0)}/sendMessage",
                                                      data=json.dumps({"chat_id": yonetici, "text": metin}).encode(),
                                                      headers={"Content-Type": "application/json"}), timeout=20).read()
    except Exception:
        pass


def main():
    os.makedirs(KLASOR, exist_ok=True)
    simdi = dt.datetime.now(dt.timezone.utc)
    yol = os.path.join(KLASOR, "durum.json")
    try:
        durum = json.load(open(yol, encoding="utf-8"))
    except Exception:
        durum = {"kaynak": {}, "baslangic": simdi.isoformat()}
    kaynaklar = json.load(open(os.path.join(KOK, "kaynaklar.json"), encoding="utf-8"))
    if durum.get("surum") != TARAMA_SURUM:
        shutil.rmtree(os.path.join(KLASOR, "veri"), ignore_errors=True)
        durum = {"kaynak": {}, "baslangic": simdi.isoformat(), "surum": TARAMA_SURUM}
        log("Tarama: veri biçimi değişti, baştan başlanıyor")
    import almanak
    for k in kaynaklar:
        _KAMP[k["id"]] = almanak.kamp(k)
    for k in kaynaklar:
        durum["kaynak"].setdefault(str(k["id"]), {})
    # Bitmemiş kaynaklar, en az ilerlemiş olan önce; her kaynak kendi alan adında sırayla, kaynaklar paralel
    sira = sorted((k for k in kaynaklar if not durum["kaynak"][str(k["id"])].get("bitti")),
                  key=lambda k: durum["kaynak"][str(k["id"])].get("sayi", 0))
    with ThreadPoolExecutor(max_workers=12) as ex:
        sonuc = list(ex.map(lambda k: kaynak_calis(k, durum["kaynak"][str(k["id"])]), sira))
    log(f"Tarama: bu çalıştırmada {sum(sonuc)} haber eklendi")
    ozet = ilerleme(durum, kaynaklar, simdi)
    json.dump(durum, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(ozet, open(os.path.join(KLASOR, "ilerleme.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log("Tarama ilerlemesi: " + json.dumps(ozet, ensure_ascii=False))
    # Bildirimler: bittiğinde bir kez; ayrıca haftada bir özet
    if ozet["kalan_gorev"] == 0 and not durum.get("bitti_bildirildi"):
        bildir(f"📚 Geriye dönük tarama bitti: {ozet['toplanan_haber']:,} haber, {ozet['kaynak']} kaynak.".replace(",", "."))
        durum["bitti_bildirildi"] = simdi.isoformat()
        json.dump(durum, open(yol, "w", encoding="utf-8"), ensure_ascii=False)
    elif not durum.get("son_ozet") or (simdi - dt.datetime.fromisoformat(durum["son_ozet"])).days >= 7:
        bildir(f"📚 Tarama haftalık: {ozet['toplanan_haber']:,} haber, {ozet['biten_kaynak']}/{ozet['kaynak']} kaynak bitti, "
               f"{ozet['kalan_gorev']} görev kaldı. Tahmini bitiş: {(ozet['tahmini_bitis'] or 'hesaplanıyor')[:10]}.".replace(",", "."))
        durum["son_ozet"] = simdi.isoformat()
        json.dump(durum, open(yol, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main()
