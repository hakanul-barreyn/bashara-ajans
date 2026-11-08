"""Dış veri: Gazze'de günlük ölümler ve öldürülen gazeteciler (Tech for Palestine, kamu malı; kaynak: Gazze Sağlık
Bakanlığı ve Gazze Hükümeti Medya Ofisi). Günde bir indirilir, data/dis/gazze-gunluk.json olarak sadeleştirilir.

Biçim: {"kaynak": ..., "guncellendi": ..., "gun": {"2023-10-07": {"olu": n, "gazeteci": n, "cocuk": n}, ...}}
Günlük sayılar birikimli alanların (ext_*_cum) farkından hesaplanır; ext_ alanları resmî raporun olmadığı günleri doldurur.
"""
import datetime as dt
import json
import os
import urllib.request

ADRES = "https://data.techforpalestine.org/api/v2/casualties_daily.min.json"


def sadelestir(liste):
    gun, onceki = {}, {}
    for x in sorted(liste, key=lambda x: x.get("report_date", "")):
        g = x.get("report_date")
        if not g:
            continue
        r = {}
        for ad, alan in (("olu", "ext_killed_cum"), ("gazeteci", "ext_press_killed_cum"), ("cocuk", "ext_killed_children_cum")):
            v = x.get(alan)
            if v is None:
                continue
            r[ad] = max(0, v - onceki.get(ad, 0)) if ad in onceki else (x.get("killed") or 0 if ad == "olu" else v)
            onceki[ad] = v
        gun[g] = r
    return gun


def guncelle(kok, log=print):
    yol = os.path.join(kok, "data", "dis", "gazze-gunluk.json")
    try:
        var = json.load(open(yol, encoding="utf-8"))
        if dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(var["indirildi"]) < dt.timedelta(hours=20):
            return var
    except (OSError, ValueError, KeyError):
        var = None
    try:
        istek = urllib.request.Request(ADRES, headers={"User-Agent": "zbs-toplayici (haber arastirmasi)"})
        with urllib.request.urlopen(istek, timeout=60) as r:
            liste = json.loads(r.read())
        veri = {"kaynak": "Tech for Palestine (data.techforpalestine.org), Gazze Sağlık Bakanlığı ve Hükümet Medya Ofisi verisi; kamu malı",
                "indirildi": dt.datetime.now(dt.timezone.utc).isoformat(), "gun": sadelestir(liste)}
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        log(f"Dış veri: Gazze günlük ölümler {len(veri['gun'])} gün")
        return veri
    except Exception as e:
        log(f"Dış veri indirilemedi: {e}")
        return var
