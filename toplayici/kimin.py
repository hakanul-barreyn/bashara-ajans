"""Kimin ölümü haber oldu? (data/bulten/kimin.json)

1) Bir ölüm kaç başlık eder: grup grup, İsraillilerin ölümünü anlatan başlıklar / öldürülen İsrailli sayısı ile
   Filistinlilerin ölümünü anlatan başlıklar / öldürülen Filistinli sayısı. Dönem: 7 Ekim 2023 – 9 Ekim 2025.
2) Adı olan ölüler: İsrailli rehinelerin adlarının kaç başlıkta geçtiği (olay_turleri.REHINELER).
3) Ateşkes: ateşkesten önce ve sonra savaşın başlıklardaki payı, ölümler ve ölüm başına başlık.

Başlık türleri geçmiş taramanın özetinden (gecmis.py: k:io, k:fo, k:r, r:<ad>), ölümler Tech for Palestine'den.
"""
import datetime as dt
import gzip
import json
import os

import almanak
import alisma
import dis_veri
import olay_turleri as OT

SURUM = 1
BAS, SON = "2023-10-07", "2025-10-09"
# İsrail tarafının ölümleri: İsrail Savunma Bakanlığı (6 Ekim 2025: 1.152 güvenlik personeli) ve Ulusal Sigorta
# Kurumu (9 Mayıs 2024: 822 sivil; sonraki aylarda az sayıda arttı). Toplam en az 1.974: oranlar İsrail lehine yuvarlanmaz.
ISRAIL_OLU = 1152 + 822
ISRAIL_KAYNAK = [("İsrail Savunma Bakanlığı, Ynetnews, 6 Ekim 2025: 1.152 güvenlik personeli", "https://www.ynetnews.com/article/bkmtqextex"),
                 ("İsrail Savunma Bakanlığı ve Ulusal Sigorta Kurumu, Ynetnews, 9 Mayıs 2024: 822 sivil", "https://www.ynetnews.com/article/bk1lmv9gr")]
ATESKESLER = [("2025-01-19", "2025-03-18", "Ocak 2025 ateşkesi"), ("2025-10-10", None, "Ekim 2025 ateşkesi")]


def _oz(kok):
    try:
        with gzip.open(os.path.join(kok, "data", "bulten", "gecmis-ozet.json.gz"), "rt", encoding="utf-8") as f:
            oz = json.load(f)
    except (OSError, ValueError, EOFError):
        return None
    return oz if oz.get("surum", 1) >= 7 else None


def _gun_gecerli(g):
    try:
        dt.date.fromisoformat(g)
        return True
    except ValueError:
        return False


def hesapla(kok, kaynaklar, simdi, log=print):
    oz = _oz(kok)
    if not oz:
        return None
    dis = dis_veri.guncelle(kok, log) or {"gun": {}}
    yol = os.path.join(kok, "data", "bulten", "kimin.json")
    eski = almanak._oku(yol, {})
    if (eski.get("surum") == SURUM and eski.get("ozet_guncellendi") == oz.get("guncellendi")
            and (eski.get("dis") or {}).get("indirildi") == dis.get("indirildi")):
        return eski
    K = {str(k["id"]): k for k in kaynaklar}
    gk = {kid: alisma.grup(k) for kid, k in K.items()}
    GK = alisma.GK
    sifir = lambda: {"n": 0, "io": 0, "fo": 0, "r": 0, "s": 0}  # noqa: E731
    donem = {g: sifir() for g in GK}
    ay, hafta, adlar = {}, {}, {g: {} for g in GK}
    for gun in sorted(oz["yayin"]):
        if len(gun) != 10 or gun < BAS or not _gun_gecerli(gun):
            continue
        a, h = gun[:7], alisma._hafta(gun)
        for kid, v in oz["yayin"][gun].items():
            g = gk.get(kid)
            if not g:
                continue
            n, tt = (v, {}) if isinstance(v, int) else (v[0], v[1])
            x = {"n": n, "io": tt.get("k:io", 0), "fo": tt.get("k:fo", 0), "r": tt.get("k:r", 0), "s": tt.get("_s", 0)}
            for hedef in ([donem[g]] if gun <= SON else []) + [ay.setdefault(a, {}).setdefault(g, sifir()), hafta.setdefault(h, {}).setdefault(g, sifir())]:
                for k2, d in x.items():
                    hedef[k2] += d
            for k2, d in tt.items():
                if k2.startswith("r:"):
                    adlar[g][k2[2:]] = adlar[g].get(k2[2:], 0) + d
    olu_gun = {g: (x or {}).get("olu", 0) for g, x in dis.get("gun", {}).items()}
    pal_olu = sum(o for g, o in olu_gun.items() if BAS <= g <= SON)
    oran = {}
    for g in GK:
        d = donem[g]
        bi, bf = (d["io"] / ISRAIL_OLU if ISRAIL_OLU else 0), (d["fo"] / pal_olu if pal_olu else 0)
        oran[g] = {"israilli_baslik": d["io"], "filistinli_baslik": d["fo"], "rehine_baslik": d["r"], "baslik": d["n"],
                   "israilli_olu_basina": round(bi, 3), "filistinli_olu_basina": round(bf, 4),
                   "kat": round(bi / bf, 1) if bf and d["io"] >= 30 else None}
    aylar = sorted(ay)
    aylik = [{"ay": a, "olu": sum(o for g, o in olu_gun.items() if g[:7] == a),
              **{g: {k2: ay[a].get(g, sifir())[k2] for k2 in ("n", "io", "fo", "r")} for g in GK}} for a in aylar]
    # rehineler
    rehine = []
    for a, ad, _ in OT.REHINELER:
        gg = {g: adlar[g].get(a, 0) for g in GK}
        if sum(gg.values()):
            rehine.append({"anahtar": a, "ad": ad, "toplam": sum(gg.values()), "gruplar": gg})
    rehine.sort(key=lambda x: -x["toplam"])
    try:
        isim = json.load(open(os.path.join(kok, "data", "isimler", "dizin.json"), encoding="utf-8"))
        bebek = next((y["n"] for y in isim.get("yaslar", []) if y["yas"] == 0), None)
        cocuk = isim.get("cocuk")
    except (OSError, ValueError):
        bebek = cocuk = None
    # ateşkesler: önceki 8 hafta ile ateşkes süresi
    hafta_sira = sorted(hafta)

    def pencere(b, e):
        hs = [h for h in hafta_sira if b <= h <= e]
        if not hs:
            return None
        olu = sum(o for g, o in olu_gun.items() if b <= g <= e)
        gun_sayisi = max(1, (dt.date.fromisoformat(min(e, simdi.date().isoformat())) - dt.date.fromisoformat(b)).days + 1)
        s = {"bas": b, "son": e, "olu": olu, "olu_hafta": round(7 * olu / gun_sayisi), "gruplar": {}}
        for g in GK:
            t = {k2: sum(hafta[h].get(g, sifir())[k2] for h in hs) for k2 in ("n", "fo", "s")}
            s["gruplar"][g] = {"savas_pay": round(100 * t["s"] / t["n"], 1) if t["n"] >= 200 else None,
                               "fo": t["fo"], "olu_basina": round(t["fo"] / olu, 3) if olu >= 30 else None}
        return s
    ateskes = []
    for b, e, ad in ATESKESLER:
        e2 = e or simdi.date().isoformat()
        once_b = (dt.date.fromisoformat(b) - dt.timedelta(days=56)).isoformat()
        once_e = (dt.date.fromisoformat(b) - dt.timedelta(days=1)).isoformat()
        ateskes.append({"ad": ad, "once": pencere(once_b, once_e), "sirasinda": pencere(b, e2)})
    veri = {"surum": SURUM, "guncellendi": simdi.isoformat(), "ozet_guncellendi": oz.get("guncellendi"), "tarama_bitti": oz.get("tarama_bitti"),
            "donem": [BAS, SON], "israil_olu": ISRAIL_OLU, "israil_kaynak": [{"ad": a, "url": u} for a, u in ISRAIL_KAYNAK],
            "filistin_olu": pal_olu, "gruplar": [{"anahtar": g, "ad": a} for g, a in alisma.GRUPLAR], "oran": oran,
            "aylik": aylik, "rehineler": rehine, "bebek": bebek, "cocuk": cocuk, "ateskes": ateskes,
            "haftalik": [{"hafta": h, "olu": sum(o for g, o in olu_gun.items() if alisma._hafta(g) == h) if _gun_gecerli(h) else 0,
                          **{g: {"savas_pay": round(100 * hafta[h].get(g, sifir())["s"] / hafta[h][g]["n"], 1) if hafta[h].get(g, sifir())["n"] >= 40 else None,
                                 "fo": hafta[h].get(g, sifir())["fo"]} for g in GK}} for h in hafta_sira if h >= "2025-01-01"],
            "dis": {"kaynak": dis.get("kaynak"), "indirildi": dis.get("indirildi")}}
    almanak._yaz(yol, veri)
    log(f"Kimin ölümü: Batı ana akım {oran['bati_ana']['kat']} kat, {len(rehine)} rehine adı")
    return veri
