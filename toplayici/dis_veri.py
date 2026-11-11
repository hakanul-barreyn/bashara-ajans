"""Dış veri: Gazze'de günlük ölümler ve öldürülen gazeteciler (Tech for Palestine, kamu malı; kaynak: Gazze Sağlık
Bakanlığı ve Gazze Hükümeti Medya Ofisi). Günde bir indirilir, data/dis/gazze-gunluk.json olarak sadeleştirilir.

Biçim: {"kaynak": ..., "guncellendi": ..., "gun": {"2023-10-07": {"olu": n, "gazeteci": n, "cocuk": n, ...}, ...}}
Günlük sayılar birikimli alanların (ext_*_cum) farkından hesaplanır; ext_ alanları resmî raporun olmadığı günleri doldurur.
Ext karşılığı olmayan alanlarda (yardım bekleyenler, açlık) fark yalnızca rapor verilen günlere yazılır.
Gerçek olay sayıları (alışma raporundaki "gerçekte ne oldu" bölümü için):
  saglik: öldürülen sağlık çalışanı, sivil_savunma: öldürülen sivil savunma görevlisi, katliam: Bakanlığın "katliam" (aile
  katliamı) diye kaydettiği olay, yardim: yardım beklerken öldürülen, aclik: açlıktan ölen, cami / kilise / okul: yıkılan ya
  da hasar gören cami, kilise, eğitim binası (Hükümet Medya Ofisi; infrastructure-damaged).
"""
import datetime as dt
import json
import os
import urllib.request

ADRES = "https://data.techforpalestine.org/api/v2/casualties_daily.min.json"
ALTYAPI = "https://data.techforpalestine.org/api/v3/infrastructure-damaged.min.json"
SURUM = 2
ALANLAR = (("olu", "ext_killed_cum"), ("gazeteci", "ext_press_killed_cum"), ("cocuk", "ext_killed_children_cum"),
           ("saglik", "ext_med_killed_cum"), ("sivil_savunma", "ext_civdef_killed_cum"), ("katliam", "ext_massacres_cum"),
           ("yardim", "aid_seeker_killed_cum"), ("aclik", "famine_cum"))
ALTYAPI_ALAN = (("cami", (("places_of_worship", "ext_mosques_destroyed"), ("places_of_worship", "ext_mosques_damaged"))),
                ("kilise", (("places_of_worship", "ext_churches_destroyed"),)),
                ("okul", (("educational_buildings", "ext_destroyed"), ("educational_buildings", "ext_damaged"))))


def sadelestir(liste, altyapi=None):
    gun, onceki = {}, {}
    for x in sorted(liste, key=lambda x: x.get("report_date", "")):
        g = x.get("report_date")
        if not g:
            continue
        r = gun.setdefault(g, {})
        for ad, alan in ALANLAR:
            v = x.get(alan)
            if v is None:
                continue
            r[ad] = max(0, v - onceki.get(ad, 0)) if ad in onceki else (x.get("killed") or 0 if ad == "olu" else v)
            onceki[ad] = v
    onceki = {}
    for x in sorted(altyapi or [], key=lambda x: x.get("report_date", "")):
        g = x.get("report_date")
        if not g:
            continue
        for ad, yollar in ALTYAPI_ALAN:
            vs = [(x.get(a) or {}).get(b) if isinstance(x.get(a), dict) else x.get(a + "." + b) for a, b in yollar]
            if any(v is None for v in vs):
                continue
            v = sum(vs)
            gun.setdefault(g, {})[ad] = max(0, v - onceki[ad]) if ad in onceki else v
            onceki[ad] = v
    return gun


def _al(adres):
    istek = urllib.request.Request(adres, headers={"User-Agent": "zbs-toplayici (haber arastirmasi)"})
    with urllib.request.urlopen(istek, timeout=60) as r:
        return json.loads(r.read())


def guncelle(kok, log=print):
    yol = os.path.join(kok, "data", "dis", "gazze-gunluk.json")
    try:
        var = json.load(open(yol, encoding="utf-8"))
        if var.get("surum") == SURUM and dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(var["indirildi"]) < dt.timedelta(hours=20):
            return var
    except (OSError, ValueError, KeyError):
        var = None
    try:
        liste = _al(ADRES)
        try:
            altyapi = _al(ALTYAPI)
        except Exception as e:
            log(f"Altyapı verisi indirilemedi: {e}")
            altyapi = None
        veri = {"kaynak": "Tech for Palestine (data.techforpalestine.org), Gazze Sağlık Bakanlığı ve Hükümet Medya Ofisi verisi; kamu malı",
                "surum": SURUM, "indirildi": dt.datetime.now(dt.timezone.utc).isoformat(), "gun": sadelestir(liste, altyapi)}
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
        log(f"Dış veri: Gazze günlük ölümler {len(veri['gun'])} gün")
        return veri
    except Exception as e:
        log(f"Dış veri indirilemedi: {e}")
        return var
