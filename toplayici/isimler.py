"""Gazze'de hayatını kaybedenlerin isimleri (data/isimler/): yaşa göre, sıfır yaşından başlayarak.

Kaynak: Tech for Palestine "killed-in-gaza" listesi (kamu malı); kaynağı Gazze Sağlık Bakanlığı'nın kimliği belirlenmiş
ölü listeleri. Günde bir indirilir. Kimlik numarası ve doğum tarihi sayfaya konmaz; ad (Arapça ve Latin harfli), yaş,
cinsiyet yeter.
Çıktı: data/isimler/dizin.json ve data/isimler/yas-<n>.json ([[latin ad, arapça ad, cinsiyet], ...], ada göre sıralı)
"""
import datetime as dt
import json
import os
import urllib.request

ADRES = "https://raw.githubusercontent.com/TechForPalestine/palestine-datasets/main/killed-in-gaza-v3.min.json"


def yaz(kok, satirlar, kaynak_tarihi=None, log=print):
    bas, kayitlar = satirlar[0], satirlar[1:]
    i = {a: bas.index(a) for a in ("en_name", "ar_name", "age", "sex")}
    yaslar = {}
    for r in kayitlar:
        y = r[i["age"]]
        if not isinstance(y, (int, float)) or y < 0:
            continue
        yaslar.setdefault(int(y), []).append([r[i["en_name"]] or "", r[i["ar_name"]] or "", r[i["sex"]] or ""])
    klasor = os.path.join(kok, "data", "isimler")
    os.makedirs(klasor, exist_ok=True)
    dizin = []
    for y in sorted(yaslar):
        liste = sorted(yaslar[y], key=lambda x: x[0].lower())
        with open(os.path.join(klasor, f"yas-{y}.json"), "w", encoding="utf-8") as f:
            json.dump(liste, f, ensure_ascii=False, separators=(",", ":"))
        dizin.append({"yas": y, "n": len(liste), "kadin": sum(1 for x in liste if x[2] == "f"), "erkek": sum(1 for x in liste if x[2] == "m")})
    veri = {"kaynak": "Tech for Palestine (data.techforpalestine.org), Gazze Sağlık Bakanlığı'nın kimliği belirlenmiş ölü listeleri; kamu malı",
            "indirildi": dt.datetime.now(dt.timezone.utc).isoformat(), "toplam": sum(d["n"] for d in dizin),
            "cocuk": sum(d["n"] for d in dizin if d["yas"] < 18), "yaslar": dizin}
    with open(os.path.join(klasor, "dizin.json"), "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    log(f"İsimler: {veri['toplam']} kişi, {veri['cocuk']} çocuk")
    return veri


def guncelle(kok, log=print):
    try:
        var = json.load(open(os.path.join(kok, "data", "isimler", "dizin.json"), encoding="utf-8"))
        if dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(var["indirildi"]) < dt.timedelta(hours=23):
            return var
    except (OSError, ValueError, KeyError):
        pass
    try:
        istek = urllib.request.Request(ADRES, headers={"User-Agent": "zbs-toplayici"})
        with urllib.request.urlopen(istek, timeout=120) as r:
            satirlar = json.loads(r.read())
        return yaz(kok, satirlar, log=log)
    except Exception as e:
        log(f"İsimler indirilemedi: {e}")
        return None
