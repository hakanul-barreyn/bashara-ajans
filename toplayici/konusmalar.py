"""Cumhurbaşkanı Erdoğan'ın resmî konuşmaları (tccb.gov.tr): Filistin vurgusunun sayımı.

Her konuşma için tarih, başlık, adres, kelime sayısı, anahtar kelimelerin sayısı ve Filistin / Gazze / İsrail geçen
cümlelerden en çok on ikisi saklanır (konuşmanın tamamı saklanmaz). Kaynak sitenin robots.txt'i yok (HTML döndürüyor);
yine de istekler arasında bir buçuk saniye beklenir ve tanınabilir bir User-Agent kullanılır.

Çıktı (konusma dalında): konusma/erdogan.json  {"guncellendi", "konusmalar": [...]}
Kullanım: python toplayici/konusmalar.py <klasör> [süre_saniye]
"""
import datetime as dt
import html
import json
import os
import re
import socket
import sys
import time
import urllib.request

socket.setdefaulttimeout(30)
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
KOK = "https://www.tccb.gov.tr"
LISTE = KOK + "/receptayyiperdogan/konusmalar/"
BASLANGIC = "2023-01-01"     # savaştan önceki dokuz ay karşılaştırma için
BEKLE = 8          # site art arda isteklerde yanıt vermeyi kesiyor; yavaş git
WAYBACK = "https://web.archive.org"
ILK_ID = 142000    # Ocak 2023'ün konuşma numaraları bu civarda başlıyor

# (anahtar, kalıp) — küçük harfli metinde
KELIMELER = [
    ("gazze", r"gazze"), ("filistin", r"filistin"), ("israil", r"israil"), ("netanyahu", r"netanyahu"),
    ("siyonist", r"siyonis"), ("soykirim", r"soykırım"), ("katliam", r"katliam"), ("hamas", r"\bhamas"),
    ("kudus", r"kudüs"), ("aksa", r"aksa"), ("lubnan", r"lübnan"), ("iran", r"\biran"), ("ateskes", r"ateşkes"),
    ("abd", r"\babd\b|amerika"), ("trump", r"trump"), ("biden", r"biden"), ("isgal", r"işgal"),
    ("israil_yonetimi", r"israil (?:yönetim|hükümet)|netanyahu (?:yönetim|hükümet)"),
    ("teror_devleti", r"terör devlet"), ("katil", r"\bkatil"),
]
DERLI = [(a, re.compile(k)) for a, k in KELIMELER]
FILISTIN = re.compile(r"gazze|filistin|israil|netanyahu|siyonis|kudüs|aksa")


def al(u):
    istek = urllib.request.Request(u, headers={"User-Agent": UA, "Accept-Language": "tr"})
    with urllib.request.urlopen(istek, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


class Yavas:
    """Doğrudan istekler: zaman aşımında bekleyip bir kez daha dener; art arda başarısızlıkta durur."""
    def __init__(self, log):
        self.hata, self.log = 0, log

    def al(self, u):
        if self.hata >= 4:
            raise RuntimeError("site yanıt vermiyor")
        for deneme in range(2):
            try:
                h = al(u)
                self.hata = 0
                return h
            except Exception as e:
                if deneme == 0:
                    time.sleep(90)
                else:
                    self.hata += 1
                    raise e


def wayback_liste(log):
    """İnternet Arşivi'nde kayıtlı konuşma adresleri: {adres: zaman damgası} (2023 ve sonrası)."""
    sonuc = {}
    for kalip in ("tccb.gov.tr/konusmalar/353/*", "tccb.gov.tr/receptayyiperdogan/konusmalar/353/*"):
        try:
            v = json.loads(al(f"{WAYBACK}/cdx/search/cdx?url={kalip}&output=json&fl=original,timestamp&filter=statuscode:200&collapse=urlkey&limit=20000"))
        except Exception as e:
            log(f"Wayback listesi alınamadı ({kalip}): {e}")
            continue
        for u, ts in v[1:]:
            m = re.search(r"/konusmalar/353/(\d+)/([^/?#]+)", u)
            if m and int(m.group(1)) >= ILK_ID:
                sonuc[f"{KOK}/konusmalar/353/{m.group(1)}/{m.group(2)}"] = ts
    log(f"Wayback: {len(sonuc)} konuşma adresi")
    return sonuc


def kucult(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


def metin_cikar(h):
    b = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
    t = re.search(r"<h6[^>]*>\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*</h6>", h)
    i = h.find('id="divContentArea"')
    if i < 0 or not t:
        return None
    j = h.find('<div id="icons_bottom', i)
    govde = h[i:j if j > 0 else i + 400000]
    govde = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", govde, flags=re.S)
    paragraflar = [html.unescape(re.sub(r"<[^>]+>", " ", p)) for p in re.findall(r"<p[^>]*>(.*?)</p>", govde, re.S)]
    yazi = "\n".join(re.sub(r"\s+", " ", p).strip() for p in paragraflar if p.strip())
    return {"baslik": html.unescape(re.sub(r"<[^>]+>", "", b.group(1))).strip() if b else "",
            "tarih": f"{t.group(3)}-{int(t.group(2)):02d}-{int(t.group(1)):02d}", "metin": yazi}


def say(k):
    m = kucult(k["metin"])
    sayi = {a: len(r.findall(m)) for a, r in DERLI}
    cumleler = [c.strip() for c in re.split(r"(?<=[.!?])\s+", k["metin"]) if FILISTIN.search(kucult(c))]
    return {"tarih": k["tarih"], "baslik": k["baslik"], "kelime": len(m.split()),
            "sayi": {a: n for a, n in sayi.items() if n}, "cumle": [c[:320] for c in cumleler[:12]],
            "filistin_cumle": len(cumleler)}


def calistir(klasor, sure=2400, log=print):
    os.makedirs(klasor, exist_ok=True)
    yol = os.path.join(klasor, "erdogan.json")
    try:
        veri = json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        veri = {"konusmalar": []}
    bilinen = {k["url"] for k in veri["konusmalar"]}
    bilinen_id = {re.search(r"/353/(\d+)/", k["url"]).group(1) for k in veri["konusmalar"]}
    bitis = time.time() + sure
    yeni = 0

    def ekle(adres, h):
        nonlocal yeni
        k = metin_cikar(h)
        if not k:
            log(f"{adres}: metin bulunamadı")
            return None
        if k["tarih"] >= BASLANGIC:
            kayit = say(k)
            kayit["url"] = adres
            veri["konusmalar"].append(kayit)
            yeni += 1
        bilinen.add(adres)
        bilinen_id.add(re.search(r"/353/(\d+)/", adres).group(1))
        return k["tarih"]

    # 1) doğrudan: güncel liste sayfaları (yavaş)
    y = Yavas(log)
    sayfa, ust, tumu_bilinen = 1, None, 0
    while time.time() < bitis and y.hata < 4:
        u = LISTE if sayfa == 1 else f"{LISTE}?&page={sayfa}"
        try:
            h = y.al(u)
        except Exception as e:
            log(f"Liste {sayfa} alınamadı: {e}")
            break
        linkler = []
        for x in re.findall(r'href="(/(?:receptayyiperdogan/)?konusmalar/353/\d+/[^"#?]+)"', h):
            adres = KOK + re.sub(r"^/receptayyiperdogan", "", x)
            if adres not in linkler:
                linkler.append(adres)
        if not linkler or linkler == ust:
            break
        ust = linkler
        en_eski = None
        for adres in linkler:
            if re.search(r"/353/(\d+)/", adres).group(1) in bilinen_id or time.time() > bitis:
                continue
            time.sleep(BEKLE)
            try:
                t = ekle(adres, y.al(adres))
                en_eski = min(en_eski or t, t) if t else en_eski
            except Exception as e:
                log(f"{adres} alınamadı: {e}")
                if y.hata >= 4:
                    break
        log(f"Sayfa {sayfa}: {len(linkler)} bağlantı, en eski {en_eski}, toplam yeni {yeni}")
        tumu_bilinen = tumu_bilinen + 1 if en_eski is None else 0
        if tumu_bilinen >= 3 or (en_eski and en_eski < BASLANGIC):
            break
        sayfa += 1
        time.sleep(BEKLE)
    # 2) İnternet Arşivi: doğrudan alınamayanlar ve eski konuşmalar
    if time.time() < bitis - 60:
        for adres, ts in sorted(wayback_liste(log).items(), key=lambda x: -int(re.search(r"/353/(\d+)/", x[0]).group(1))):
            if time.time() > bitis:
                break
            if re.search(r"/353/(\d+)/", adres).group(1) in bilinen_id:
                continue
            time.sleep(1)
            try:
                ekle(adres, al(f"{WAYBACK}/web/{ts}id_/{adres.replace(KOK, 'https://www.tccb.gov.tr')}"))
            except Exception as e:
                log(f"Wayback {adres}: {e}")
        log(f"Wayback sonrası toplam yeni {yeni}")
    veri["konusmalar"].sort(key=lambda k: k["tarih"])
    veri["guncellendi"] = dt.datetime.now(dt.timezone.utc).isoformat()
    veri["kaynak"] = "T.C. Cumhurbaşkanlığı, tccb.gov.tr (Konuşmalar)"
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    log(f"Konuşmalar: {len(veri['konusmalar'])} kayıt ({yeni} yeni); tamam: {veri.get('tamam')}")
    return veri


if __name__ == "__main__":
    calistir(sys.argv[1] if len(sys.argv) > 1 else "konusma", int(sys.argv[2]) if len(sys.argv) > 2 else 2400)


def indir(kok, log=print):
    """Toplayıcıdan: konuşma özetini konusma dalından data/konusma/erdogan.json'a indirir (6 saatte bir)."""
    yol = os.path.join(kok, "data", "konusma", "erdogan.json")
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    zyol = os.path.join(kok, "data", "konusma", "indirme.json")
    try:
        son = json.load(open(zyol))["zaman"]
    except (OSError, ValueError, KeyError):
        son = 0
    if not depo or (os.path.exists(yol) and time.time() - son < 6 * 3600):
        return
    try:
        istek = urllib.request.Request(f"https://raw.githubusercontent.com/{depo}/konusma/erdogan.json", headers={"User-Agent": "zbs-toplayici"})
        with urllib.request.urlopen(istek, timeout=60) as r:
            icerik = r.read()
        json.loads(icerik)
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        with open(yol, "wb") as f:
            f.write(icerik)
        with open(zyol, "w") as f:
            json.dump({"zaman": time.time()}, f)
    except Exception as e:
        log(f"Konuşmalar indirilemedi: {e}")
