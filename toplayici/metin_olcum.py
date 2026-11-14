"""Haber metni ölçümü, metin saklanmadan (.github/workflows/metin-olcum.yml).

Her haber indirilir, ana metni çıkarılır, bellekte ölçülür ve atılır. Kalıcı olan yalnızca ölçümlerdir:
  - künye: adres, indirme günü, metnin parmak izi (SHA-256; metin geri üretilemez, sonradan değişip değişmediği anlaşılır)
  - cümle düzeyinde kodlar: ölüm ilk kaçıncı cümlede, girişte (ilk 3 cümle) ve gövdede fail yazılı mı, kimin sözü aktarılıyor,
    "Hamas'ın yönettiği" gibi niteleme, bağlam (işgal, abluka, Nekbe, yerleşim, soykırım, 7 Ekim), terimler (alıntı dışı)
  - kelime sayıları: ilk beş paragrafın kelime sıklığı, sırasız (metin geri kurulamaz; yeni terim listeleri yeniden indirmeden denenir)
Ayrıntılı kayıtlar GİZLİ Hugging Face veri setine (HF_REPO, "metin/" klasörü) yazılır; açık depoya yalnızca toplu sayılar girer.

Kurallar: kimliğimizi açıkça söyleyen kullanıcı ajanı, robots.txt'e uyum, her siteye en çok 2 saniyede bir istek, ödeme duvarı
aşılmaz (duvarlı sitelere hiç gidilmez; kısa çıkan metin ölçülmez).

Kullanım:
  python toplayici/metin_olcum.py olc <durum klasörü> <haberler.json> [tarama klasörü]
  python toplayici/metin_olcum.py ozet <durum klasörü> <çıktı.json>
"""
import collections
import concurrent.futures as cf
import datetime as dt
import glob
import gzip
import hashlib
import json
import os
import random
import re
import sys
import threading
import time
import urllib.parse
import urllib.robotparser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gecmis  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
SURE = int(os.environ.get("METIN_SURE", "4200"))
ARALIK = 2.0                      # aynı siteye iki istek arası en az (saniye)
ESZAMANLI = 12                    # aynı anda işlenen site
EN_AZ_KELIME = 120                # bundan kısa metin (duvar, özet sayfası) ölçülmez
ORNEK_YAYIN_AY = 6                # geçmiş örneklemi: yayın x ay başına en çok ölüm başlığı
DUVARLI = ("nytimes.com", "washingtonpost.com", "wsj.com", "ft.com", "economist.com", "thetimes.co.uk", "telegraph.co.uk",
           "haaretz.com", "haaretz.co.il", "bloomberg.com", "lemonde.fr", "theatlantic.com", "newyorker.com", "spiegel.de",
           "corriere.it", "repubblica.it", "elpais.com", "lefigaro.fr", "nzz.ch", "faz.net", "sueddeutsche.de", "calcalist.co.il",
           "themarker.com", "globes.co.il")

# ---------------------------------------------------------------- ölçüm
ATIF = {
    "ordu": re.compile(r"\bIDF\b|israeli (?:army|military|forces|defen[cs]e forces)|the (?:army|military) (?:said|says|claimed)|"
                       r"military spokes|army spokes|israil ordusu|i̇srail ordusu|ordu sözcüsü|tsahal|armée israélienne|ejército israelí|"
                       r"esercito israeliano|israelische armee|جيش الاحتلال|الجيش الإسرائيلي|المتحدث باسم جيش|צה\"ל|דובר צה", re.I),
    "israil_yetkili": re.compile(r"netanyahu|nethanyahu|israeli (?:officials?|government|prime minister|minister)|prime minister'?s office|"
                                 r"gallant|\bkatz\b|smotrich|ben[- ]gvir|herzog|israil hükümeti|israil başbakan|نتنياهو|الحكومة الإسرائيلية", re.I),
    "bakanlik": re.compile(r"health ministry|ministry of health|sağlık bakanlığı|ministère de la santé|ministerio de sanidad|ministerio de salud|"
                           r"ministero della salute|gesundheitsministerium|وزارة الصحة", re.I),
    "bm": re.compile(r"\bUN\b|united nations|\bUNRWA\b|\bWHO\b|world health organi[sz]ation|\bOCHA\b|\bUNICEF\b|\bBM\b|birleşmiş milletler|"
                     r"nations unies|naciones unidas|nazioni unite|vereinten nationen|الأمم المتحدة|أونروا|الأونروا|منظمة الصحة", re.I),
    "tanik": re.compile(r"\bwitness(?:es)?\b|eyewitness|residents? (?:said|told|say)|survivors? (?:said|told)|tanık|görgü tanığı|"
                        r"témoin|testigo|testimon|augenzeuge|شهود|شاهد عيان|أفاد سكان", re.I),
    "filistin_yetkili": re.compile(r"palestinian (?:officials?|authority|civil defen[cs]e|red crescent)|civil defen[cs]e|sivil savunma|kızılay|"
                                   r"red crescent|الدفاع المدني|الهلال الأحمر|السلطة الفلسطينية", re.I),
}
NITELEME = re.compile(r"hamas[- ](?:run|controlled|led|governed)|run by hamas|controlled by hamas|hamas'?ın yönettiği|hamas yönetimindeki|"
                      r"dirigé par le hamas|contrôlé par le hamas|controlado por hamás|controllato da hamas|von der hamas kontrolliert|"
                      r"التي تديرها حماس|التابعة لحماس", re.I)
BAGLAM = {
    "isgal": re.compile(r"\boccup(?:ation|ied|ying)\b|işgal|احتلال|الاحتلال|\boccupation\b|ocupaci[oó]n|occupazione|besatzung|כיבוש", re.I),
    "abluka": re.compile(r"blockade|\bsiege\b|abluka|kuşatma|حصار|blocus|bloqueo|assedio|blockade", re.I),
    "nekbe": re.compile(r"\bnakba\b|nekbe|النكبة|\b1948\b", re.I),
    "yerlesim": re.compile(r"settlements?\b|settlers?\b|yerleşim|yerleşimci|استيطان|مستوطن|colonies|colons|asentamiento|colonos|insediament|siedlung", re.I),
    "soykirim": re.compile(r"genocid|soykırım|إبادة|génocide|völkermord", re.I),
    "yedi_ekim": re.compile(r"october 7|7 october|7 ekim|7 أكتوبر|السابع من أكتوبر|7 octobre|7 de octubre|7 ottobre|7\. oktober", re.I),
    "apartheid": re.compile(r"apartheid|أبارتهايد|الفصل العنصري", re.I),
}
CUMLE = re.compile(r"(?<=[.!?؟])\s+|\n+")
KELIME = re.compile(r"[^\W\d_]{3,}", re.U)


def olc(metin, baslik=""):
    """Metinden ölçümler; metnin kendisini döndürmez."""
    paragraflar = [p.strip() for p in metin.split("\n") if p.strip()]
    cumleler = [c.strip() for c in CUMLE.split(metin) if len(c.strip()) > 2]
    giris = cumleler[:3]
    disari = gecmis.tirnaksiz(metin)
    kd = gecmis.katla(disari)
    f_cumle = [gecmis.faillik(c, gecmis.katla(c)) for c in cumleler[:60]]
    ilk_olum = next((i for i, f in enumerate(f_cumle) if f), None)
    fg = [f for f in f_cumle[:3] if f]
    fa = [f for f in f_cumle if f]
    alinti = sum(len(m.group(0)) for m in gecmis.TIRNAK.finditer(metin))
    o = {
        "kelime": len(metin.split()), "cumle": len(cumleler), "paragraf": len(paragraflar),
        "baslik_f": gecmis.faillik(baslik, gecmis.katla(baslik)) if baslik else None,
        "ilk_olum": ilk_olum,
        "giris_f": collections.Counter(fg) or None, "govde_f": collections.Counter(fa) or None,
        "giris_fail": any(f in ("aktif", "failli") for f in fg) if fg else None,
        "govde_fail": any(f in ("aktif", "failli") for f in fa) if fa else None,
        "atif": {a: len(r.findall(metin)) for a, r in ATIF.items() if r.search(metin)},
        "niteleme": len(NITELEME.findall(metin)),
        "baglam": {a: len(r.findall(disari)) for a, r in BAGLAM.items() if r.search(disari)},
        "terim": {a: 1 for a, r1, r2 in gecmis.TERIM if r1.search(disari) or r2.search(kd)},
        "alinti_pay": round(alinti / max(1, len(metin)), 3),
    }
    return {k: (dict(v) if isinstance(v, collections.Counter) else v) for k, v in o.items()}


def kelime_sayilari(metin, en_cok=300):
    ilk = "\n".join([p for p in metin.split("\n") if p.strip()][:5]).lower()
    return dict(collections.Counter(KELIME.findall(ilk)).most_common(en_cok))


# ---------------------------------------------------------------- indirme
_robot, _son, _kilit = {}, {}, threading.Lock()


def _oturum():
    import requests
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "*"})
    return s


def _izin(s, url):
    p = urllib.parse.urlsplit(url)
    kok = f"{p.scheme}://{p.netloc}"
    with _kilit:
        rp = _robot.get(kok)
    if rp is None:
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = s.get(kok + "/robots.txt", timeout=15)
            rp.parse(r.text.splitlines() if r.status_code == 200 else [])
        except Exception:   # noqa: BLE001
            rp.parse([])
        with _kilit:
            _robot[kok] = rp
    return rp.can_fetch(UA, url)


def _bekle(host):
    while True:
        with _kilit:
            g = _son.get(host, 0) + ARALIK - time.time()
            if g <= 0:
                _son[host] = time.time()
                return
        time.sleep(g)


def _host(u):
    h = urllib.parse.urlsplit(u).netloc.lower()
    return h[4:] if h.startswith("www.") else h


def getir(s, x):
    """x: {u, kid, t, b, kay}. Döndürür: kayıt (ölçümlerle) ya da durum kaydı."""
    import trafilatura
    u = x["u"]
    kayit = {"h": hashlib.sha256(u.encode()).hexdigest()[:20], "u": u, "kid": x.get("kid"), "t": x.get("t"), "kay": x.get("kay"),
             "indirildi": dt.date.today().isoformat()}
    host = _host(u)
    if any(host == d or host.endswith("." + d) for d in DUVARLI):
        return {**kayit, "durum": "duvar"}
    if not _izin(s, u):
        return {**kayit, "durum": "robots"}
    adresler = [u]
    if x.get("kay") == "orneklem" and x.get("t"):
        adresler.append(f"https://web.archive.org/web/{x['t'].replace('-', '')[:8]}id_/{u}")   # silinmişse İnternet Arşivi kopyası
    for i, a in enumerate(adresler):
        _bekle(_host(a))
        try:
            r = s.get(a, timeout=25, allow_redirects=True)
        except Exception as e:   # noqa: BLE001
            durum = "hata:" + type(e).__name__
            continue
        if r.status_code != 200 or "html" not in r.headers.get("content-type", ""):
            durum = f"http:{r.status_code}"
            continue
        metin = trafilatura.extract(r.text, include_comments=False, include_tables=False, favor_precision=True) or ""
        if len(metin.split()) < EN_AZ_KELIME:
            durum = "kisa"
            continue
        kayit.update({"durum": "ok", "arsiv": bool(i), "parmak": hashlib.sha256(metin.encode()).hexdigest()[:24],
                      "olc": olc(metin, x.get("b") or ""), "tf": kelime_sayilari(metin)})
        del metin, r
        return kayit
    return {**kayit, "durum": durum}


# ---------------------------------------------------------------- iş listesi
def is_listesi(haberler_yol, tarama, islenen, durum=None):
    K = {str(k["id"]): k for k in json.load(open(os.path.join(KOK, "kaynaklar.json"), encoding="utf-8"))}
    isler = []
    # 1) canlı: savaş bağlamındaki bütün ölüm başlıkları ve öteki haberlerin onda biri
    try:
        hs = json.load(open(haberler_yol, encoding="utf-8"))
        hs = hs.get("haberler", hs)
    except (OSError, ValueError):
        hs = []
    rnd = random.Random(1)
    for h in hs:
        u, b = h.get("url") or "", h.get("baslik_orj") or ""
        if not u.startswith("http") or "t.me/" in u or not h.get("ilgili"):
            continue
        kb = gecmis.katla(b)
        if not (gecmis.GAZZE.search(b) or gecmis.BAGLAM.search(b) or gecmis.BAGLAM.search(kb)):
            continue
        if not gecmis.faillik(b, kb) and rnd.random() > 0.1:
            continue
        x = {"u": u, "kid": str(h.get("kaynak")), "t": (h.get("tarih") or "")[:10], "b": b, "kay": "canli"}
        if hashlib.sha256(u.encode()).hexdigest()[:20] not in islenen:
            isler.append(x)
    # 2) geçmiş: ölüm başlıklarından yayın x ay katmanlı örneklem (sabit tohum; her çalıştırmada aynı liste, işlenenler atlanır)
    #    Liste bir kez kurulur ve durum klasöründe (gizli) saklanır; sonraki çalıştırmalar tarama dalını indirmez.
    oy = os.path.join(durum, "orneklem.json.gz") if durum else None
    if oy and os.path.exists(oy):
        ornek = json.load(gzip.open(oy, "rt"))
        isler += [x for x in ornek if hashlib.sha256(x["u"].encode()).hexdigest()[:20] not in islenen]
    elif tarama and os.path.isdir(tarama):
        rnd = random.Random(20261114)
        kova = collections.defaultdict(list)
        for f in sorted(glob.glob(os.path.join(tarama, "veri", "*", "*.jsonl.gz"))):
            kid = f.split(os.sep)[-2]
            if kid not in K or (K[kid].get("rss") or "").startswith("https://t.me"):
                continue
            for satir in gzip.open(f, "rt", encoding="utf-8"):
                try:
                    r = json.loads(satir)
                except ValueError:
                    continue
                t, u = (r.get("t") or "")[:10], r.get("u") or ""
                if not t or t < "2023-10-07" or not u.startswith("http"):
                    continue
                b = r.get("b") or ""
                kb = gecmis.katla(b)
                if not (gecmis.GAZZE.search(b) or gecmis.GAZZE.search(kb) or gecmis.BAGLAM.search(b) or gecmis.BAGLAM.search(kb)):
                    continue
                if gecmis.faillik(b, kb):
                    kova[(kid, t[:7])].append({"u": u, "kid": kid, "t": t, "b": b, "kay": "orneklem"})
        ornek = []
        for k in sorted(kova):
            xs = kova[k]
            rnd.shuffle(xs)
            ornek += xs[:ORNEK_YAYIN_AY]
        rnd.shuffle(ornek)
        if oy:
            with gzip.open(oy, "wt") as f:
                json.dump(ornek, f, ensure_ascii=False)
            print(f"Geçmiş örneklemi kuruldu: {len(ornek)} haber, {len(kova)} yayın-ay")
        isler += [x for x in ornek if hashlib.sha256(x["u"].encode()).hexdigest()[:20] not in islenen]
    return isler


def olc_calistir(durum, haberler_yol, tarama=None):
    t0 = time.time()
    os.makedirs(os.path.join(durum, "parca"), exist_ok=True)
    islenen_yol = os.path.join(durum, "islenen.json.gz")
    try:
        islenen = json.load(gzip.open(islenen_yol, "rt"))
    except (OSError, ValueError):
        islenen = {}
    isler = is_listesi(haberler_yol, tarama, islenen, durum)
    print(f"İş listesi: {len(isler)} haber ({sum(1 for x in isler if x['kay'] == 'canli')} canlı)")
    # site site kuyruk: her site kendi sırasında, aynı anda en çok ESZAMANLI site
    kuyruk = collections.defaultdict(list)
    for x in isler:
        kuyruk[_host(x["u"])].append(x)
    sonuc, say = [], collections.Counter()
    yazi_kilit = threading.Lock()

    def site_isle(xs):
        s = _oturum()
        for x in xs:
            if time.time() - t0 > SURE:
                return
            k = getir(s, x)
            with yazi_kilit:
                sonuc.append(k); say[k["durum"].split(":")[0]] += 1
                islenen[k["h"]] = k["durum"]
            if k["durum"] == "duvar":
                for y in xs[xs.index(x) + 1:]:      # aynı siteye bir daha gitme
                    with yazi_kilit:
                        islenen[hashlib.sha256(y["u"].encode()).hexdigest()[:20]] = k["durum"]
                return

    with cf.ThreadPoolExecutor(ESZAMANLI) as ex:
        list(ex.map(site_isle, sorted(kuyruk.values(), key=len, reverse=True)))
    if sonuc:
        ad = dt.datetime.utcnow().strftime("%Y%m%dT%H%M")
        with gzip.open(os.path.join(durum, "parca", ad + ".jsonl.gz"), "wt", encoding="utf-8") as f:
            for k in sonuc:
                f.write(json.dumps(k, ensure_ascii=False) + "\n")
    with gzip.open(islenen_yol, "wt") as f:
        json.dump(islenen, f)
    print(f"Bu çalıştırmada {len(sonuc)} haber: {dict(say)}; toplam işlenen {len(islenen)}")


# ---------------------------------------------------------------- toplu sayılar (açık)
def ozet(durum, cikti):
    import rapor
    K = {str(k["id"]): k for k in json.load(open(os.path.join(KOK, "kaynaklar.json"), encoding="utf-8"))}
    T = collections.defaultdict(lambda: collections.Counter())
    durumlar = collections.Counter()
    for f in sorted(glob.glob(os.path.join(durum, "parca", "*.jsonl.gz"))):
        for satir in gzip.open(f, "rt", encoding="utf-8"):
            k = json.loads(satir)
            durumlar[k["durum"].split(":")[0]] += 1
            if k["durum"] != "ok" or k.get("kid") not in K:
                continue
            g = rapor.grup(K[k["kid"]]) or "diger"
            o = k["olc"]
            for anahtar in (g, "hepsi"):
                c = T[anahtar]
                c["haber"] += 1
                if o.get("govde_f"):
                    c["olum_govde"] += 1
                    c["govde_fail"] += bool(o.get("govde_fail"))
                if o.get("giris_f"):
                    c["olum_giris"] += 1
                    c["giris_fail"] += bool(o.get("giris_fail"))
                if o.get("baslik_f") in ("failsiz", "oldu"):     # başlıkta fail yok: gövdede var mı?
                    c["baslik_failsiz"] += 1
                    c["baslik_failsiz_govde_fail"] += bool(o.get("govde_fail"))
                for a in o.get("atif") or {}:
                    c["atif:" + a] += 1
                if (o.get("atif") or {}).get("bakanlik"):
                    c["niteleme_bakanlikla"] += bool(o.get("niteleme"))
                for a in o.get("baglam") or {}:
                    c["baglam:" + a] += 1
    gruplar = {}
    for g, c in T.items():
        n = c["haber"] or 1
        gruplar[g] = {"haber": c["haber"],
                      "govde_fail": round(100 * c["govde_fail"] / c["olum_govde"], 1) if c["olum_govde"] else None,
                      "govde_fail_ga": rapor.wilson(c["govde_fail"], c["olum_govde"]),
                      "baslikta_yok_govdede_var_ga": rapor.wilson(c["baslik_failsiz_govde_fail"], c["baslik_failsiz"]),
                      "giris_fail": round(100 * c["giris_fail"] / max(1, c["olum_giris"]), 1) if c["olum_giris"] else None,
                      "baslikta_yok_govdede_var": round(100 * c["baslik_failsiz_govde_fail"] / c["baslik_failsiz"], 1) if c["baslik_failsiz"] else None,
                      "baslik_failsiz_n": c["baslik_failsiz"],
                      "atif": {a.split(":")[1]: round(100 * v / n, 1) for a, v in c.items() if a.startswith("atif:")},
                      "niteleme_bakanlikla": round(100 * c["niteleme_bakanlikla"] / c["atif:bakanlik"], 1) if c["atif:bakanlik"] else None,
                      "baglam": {a.split(":")[1]: round(100 * v / n, 1) for a, v in c.items() if a.startswith("baglam:")},
                      "olum_govde_n": c["olum_govde"]}
    json.dump({"guncellendi": dt.datetime.utcnow().isoformat() + "Z", "durumlar": dict(durumlar), "gruplar": gruplar,
               "not": "Metin saklanmadan ölçüldü; yüzdeler: haber başına (atıf, bağlam) ya da ölüm geçen haberler içinde (fail)."},
              open(cikti, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("Özet:", {g: v["haber"] for g, v in gruplar.items()})


if __name__ == "__main__":
    if sys.argv[1] == "olc":
        olc_calistir(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif sys.argv[1] == "ozet":
        ozet(sys.argv[2], sys.argv[3])
