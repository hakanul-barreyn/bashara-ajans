"""Analiz arşivi: düşünce kuruluşlarının ve yayınların analiz yazıları, uzun süreli.

haberler.json yalnızca son günleri tutar; bu dosya analiz yazılarını aylarca saklar.
Yazının metni saklanmaz: başlık, bizim Türkçe özetimiz (varsa) ve orijinal bağlantı.
Silahlı örgütlerin kanalları girmez.

data/analizler.json = {guncellendi, analizler: [...]}
"""
import datetime as dt
import glob
import json
import os
import re

SAKLA_GUN = 365
EN_FAZLA = 5000
ALANLAR = ("baslik_orj", "baslik_tr", "baslik_en", "ozet_tr", "ozet_en", "dil")


def _oku(yol, vars_):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return vars_


# Düşünce kuruluşları her konuda yazıyor: genel kelimeler ("soykırım", "mülteci") yetmez, bölge adı gerekir
CEKIRDEK = re.compile(
    r"palestin|gaza|west bank|jerusalem|israel|hamas|hezbollah|lebanon|syria|yemen|houthi|iran|iraq|jordan|egypt|"
    r"red sea|golan|unrwa|settler|al-aqsa|netanyahu|zionis|rafah|libya|algeria|morocco|tunisia|western sahara|"
    r"filistin|gazze|batı şeria|kudüs|i̇srail|israil|hizbullah|lübnan|suriye|husi|irak|ürdün|mısır|kızıldeniz|siyonis|"
    r"فلسطين|غزة|إسرائيل|اسرائيل|الاحتلال|الضفة|القدس|حماس|حزب الله|لبنان|سوري|اليمن|إيران|ايران|العراق|الأردن|مصر|"
    r"ישראל|עזה|פלסטינ|חמאס|לבנון")
BULTEN = re.compile(r"^\W*(نشرة|daily brief|daily bulletin|günlük bülten)", re.I)


def _baslik(h):
    return re.sub(r"^[^\w\"'“«(]+", "", str(h.get("baslik_orj") or "")).strip()


def _dil(h, k):
    t = _baslik(h)
    if re.search(r"[\u0600-\u06ff]", t):
        return "ar"
    if re.search(r"[\u0590-\u05ff]", t):
        return "he"
    return h.get("dil") or k.get("dil")


def _uygun(h, k):
    if k and k.get("dusunce"):
        metin = (h.get("baslik_orj") or "") + " " + (h.get("baslik_tr") or "") + " " + (h.get("ozet_tr") or "")[:300]
        if not CEKIRDEK.search(metin.lower()) or BULTEN.search(_baslik(h)):
            return False
    return (k and h.get("nitelik") == "analiz" and not h.get("atla") and not k.get("silahli")
            and h.get("ilgili", True)
            and str(h.get("url", "")).startswith(("https://", "http://"))
            and not h.get("ozet_spot"))      # spot (ilk paragraf) özeti arşivde tutulmaz


def _kayit(h, k):
    a = {"id": h["id"], "kaynak": k["id"], "kurum": k.get("ad"), "url": h["url"], "tarih": h.get("tarih"),
         "dusunce": bool(k.get("dusunce")) or None, "ulke": k.get("ulke")}
    for f in ALANLAR:
        if h.get(f):
            a[f] = h[f]
    if a.get("baslik_orj"):
        a["baslik_orj"] = _baslik(h)
    a["dil"] = _dil(h, k)
    return a


def guncelle(kok, haberler, kaynaklar, simdi, log=print):
    yol = os.path.join(kok, "data", "analizler.json")
    K = {str(k["id"]): k for k in kaynaklar}
    eski = _oku(yol, {}).get("analizler", [])
    tablo = {a["id"]: a for a in eski}
    if not eski:
        # İlk kurulum: günlük arşivdeki analiz yazılarıyla doldur
        for f in sorted(glob.glob(os.path.join(kok, "data", "arsiv", "*.json"))):
            for h in _oku(f, []):
                if isinstance(h, dict) and _uygun(h, K.get(str(h.get("kaynak")))):
                    tablo[h["id"]] = _kayit(h, K[str(h["kaynak"])])
    yeni = 0
    for h in haberler:
        k = K.get(str(h.get("kaynak")))
        if not _uygun(h, k):
            continue
        a = _kayit(h, k)
        if h["id"] not in tablo:
            yeni += 1
            tablo[h["id"]] = a
        else:
            tablo[h["id"]].update({x: y for x, y in a.items() if y})   # özet sonradan yazıldıysa ekle
    esik = (simdi - dt.timedelta(days=SAKLA_GUN)).isoformat()
    # kaynak listesinden çıkarılan ya da silahlı işaretlenen yayınlar arşivden de çıkar
    liste = [a for a in tablo.values() if (a.get("tarih") or "") >= esik
             and K.get(str(a.get("kaynak"))) and not K[str(a["kaynak"])].get("silahli")
             and (not a.get("dusunce") or _uygun(dict(a, nitelik="analiz"), K[str(a["kaynak"])]))]
    liste.sort(key=lambda a: a.get("tarih") or "", reverse=True)
    liste = liste[:EN_FAZLA]
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump({"guncellendi": simdi.isoformat(), "analizler": liste}, f, ensure_ascii=False, separators=(",", ":"))
    log(f"Analiz arşivi: {len(liste)} yazı ({yeni} yeni, {sum(1 for a in liste if a.get('dusunce'))} düşünce kuruluşu)")
    return yeni
