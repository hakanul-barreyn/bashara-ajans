"""Toplum ne yaptı? Basın bir olayı yazdı; okurlar o olayı ne kadar merak etti? (data/bulten/toplum.json)

Ölçü: Vikipedi sayfa görüntülenmeleri (Wikimedia Pageviews API, yalnızca insan okurlar: agent=user). Her olayın kendi
maddesi, olaydan sonraki ilk 7 ve 30 günde kaç kez okundu; altı dilde (İngilizce, Arapça, Türkçe, Almanca, Fransızca,
İspanyolca). Ayrıca savaşın kendisini ve soykırımı anlatan maddelerin gün gün okunması.
Maddeler İngilizce adlarıyla verilir; yönlendirmeler ve diğer dillerdeki karşılıkları Vikipedi API'sinden bulunur
(bulunamayan madde atlanır). Günde bir yenilenir. Kişi adı taşıyan maddeler (öldürülen bir kişinin adıyla anılan olaylar)
yöneticinin onayı olmadan listeye eklenmez.
"""
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

SURUM = 1
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
DILLER = ["en", "ar", "tr", "de", "fr", "es"]
BAS = "2023-10-01"
# (anahtar, olay türü (olay_turleri), olay günü, Türkçe ad, İngilizce madde adı adayları)
OLAYLAR = [
    ("ehli", "hastane", "2023-10-17", "El-Ehli Baptist Hastanesi patlaması", ["Al-Ahli Arab Hospital explosion"]),
    ("sifa1", "hastane", "2023-11-15", "Şifa Hastanesi kuşatması (Kasım 2023)", ["Siege of Al-Shifa Hospital", "Al-Shifa Hospital siege (November 2023)"]),
    ("un", "yardim", "2024-02-29", "Un katliamı", ["Flour massacre"]),
    ("sifa2", "hastane", "2024-03-18", "Şifa Hastanesi baskını (Mart 2024)", ["Al-Shifa Hospital siege", "March 2024 Al-Shifa Hospital siege", "Second siege of Al-Shifa Hospital"]),
    ("wck", "yardimci", "2024-04-01", "World Central Kitchen konvoyuna saldırı", ["World Central Kitchen aid convoy attack"]),
    ("cadir", "cadir", "2024-05-26", "Tel es-Sultan çadır katliamı", ["Tel al-Sultan massacre", "Tal as-Sultan massacre", "Rafah tent massacre"]),
    ("nuseyrat", "katliam", "2024-06-08", "Nusayrat katliamı", ["Nuseirat rescue and massacre"]),
    ("tabiin", "okul", "2024-08-10", "Et-Tabiin okulu saldırısı", ["Al-Tabi'in school attack", "Al-Tabi'een school attack"]),
    ("advan", "hastane", "2024-12-27", "Kemal Advan Hastanesi baskını", ["Kamal Adwan Hospital raid", "Raid on Kamal Adwan Hospital", "Kamal Adwan Hospital"]),
    ("sihhiye", "saglik", "2025-03-23", "Refah’ta sağlık ekibinin öldürülmesi", ["Rafah paramedic massacre", "2025 Rafah paramedic massacre", "Killing of Palestinian Red Crescent paramedics"]),
    ("ghf", "yardim", "2025-05-27", "Yardım dağıtım noktalarında öldürülenler", ["Gaza Humanitarian Foundation aid distribution killings", "Killings at Gaza Humanitarian Foundation sites", "Gaza Humanitarian Foundation"]),
    ("kitlik", "kitlik", "2025-08-22", "Gazze’de kıtlık ilanı", ["Gaza famine", "Famine in Gaza", "Gaza Strip famine"]),
]
GENEL = [("soykirim", "Gazze soykırımı", ["Gaza genocide"]), ("savas", "Gazze savaşı", ["Gaza war", "Gaza war (2023–present)"]),
         ("insani", "Gazze’deki insani kriz", ["Gaza humanitarian crisis (2023–present)", "Gaza humanitarian crisis"])]


def _json(url, sure=40):
    istek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(istek, timeout=sure) as r:
        return json.loads(r.read())


def cozumle(adlar):
    """İngilizce adayları (yönlendirmelerle) gerçek maddeye çevirir; {aday: {"en": ad, "ar": ad, ...}}"""
    sonuc = {}
    for i in range(0, len(adlar), 40):
        parca = adlar[i:i + 40]
        q = urllib.parse.urlencode({"action": "query", "format": "json", "redirects": 1, "prop": "langlinks", "lllimit": 500,
                                    "titles": "|".join(parca)})
        v = _json("https://en.wikipedia.org/w/api.php?" + q)
        sorgu = v.get("query", {})
        harita = {a: a for a in parca}
        for n in sorgu.get("normalized", []):
            for a, b in list(harita.items()):
                if b == n["from"]:
                    harita[a] = n["to"]
        for r in sorgu.get("redirects", []):
            for a, b in list(harita.items()):
                if b == r["from"]:
                    harita[a] = r["to"]
        sayfa = {p.get("title"): p for p in sorgu.get("pages", {}).values() if "missing" not in p and "invalid" not in p}
        for a, b in harita.items():
            p = sayfa.get(b)
            if not p:
                continue
            d = {"en": p["title"]}
            for ll in p.get("langlinks", []):
                if ll.get("lang") in DILLER:
                    d[ll["lang"]] = ll.get("*")
            sonuc[a] = d
        time.sleep(1)
    return sonuc


def goruntulenme(dil, baslik, bas, son):
    """{gün: okunma} (insan okurlar)"""
    m = urllib.parse.quote(baslik.replace(" ", "_"), safe="")
    url = (f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{dil}.wikipedia/all-access/user/{m}/daily/"
           f"{bas.replace('-', '')}00/{son.replace('-', '')}00")
    try:
        v = _json(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {}
        raise
    return {x["timestamp"][:4] + "-" + x["timestamp"][4:6] + "-" + x["timestamp"][6:8]: x["views"] for x in v.get("items", [])}


def guncelle(kok, log=print):
    yol = os.path.join(kok, "data", "bulten", "toplum.json")
    try:
        var = json.load(open(yol, encoding="utf-8"))
        if var.get("surum") == SURUM and dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(var["indirildi"]) < dt.timedelta(hours=20):
            return var
    except (OSError, ValueError, KeyError):
        var = None
    son = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).date().isoformat()
    try:
        adaylar = [a for o in OLAYLAR for a in o[4]] + [a for g in GENEL for a in g[2]]
        coz = cozumle(adaylar)
        D = []
        d = dt.date.fromisoformat(BAS)
        while d.isoformat() <= son:
            D.append(d.isoformat())
            d += dt.timedelta(days=1)

        def seri(basliklar):
            cikti = {}
            for dil, b in basliklar.items():
                try:
                    g = goruntulenme(dil, b, BAS, son)
                except Exception as e:
                    log(f"Vikipedi {dil}:{b}: {e}")
                    continue
                cikti[dil] = {"baslik": b, "gun": [g.get(x, 0) for x in D]}
                time.sleep(0.3)
            return cikti

        olaylar = []
        for anahtar, tur, gun, ad, adlar in OLAYLAR:
            b = next((coz[a] for a in adlar if a in coz), None)
            if not b:
                log(f"Vikipedi: {ad} maddesi bulunamadı")
                continue
            olaylar.append({"anahtar": anahtar, "tur": tur, "gun": gun, "ad": ad, "diller": seri(b)})
        genel = []
        for anahtar, ad, adlar in GENEL:
            b = next((coz[a] for a in adlar if a in coz), None)
            if b:
                genel.append({"anahtar": anahtar, "ad": ad, "diller": seri(b)})
        veri = {"surum": SURUM, "indirildi": dt.datetime.now(dt.timezone.utc).isoformat(), "bas": BAS, "son": son,
                "kaynak": "Wikimedia Pageviews API (yalnızca insan okurlar)", "olaylar": olaylar, "genel": genel}
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        log(f"Toplum: {len(olaylar)} olay maddesi, {len(genel)} genel madde")
        return veri
    except Exception as e:
        log(f"Toplum verisi indirilemedi: {e}")
        return var
