"""Yeni taksime göre rapor (data/bulten/taksim.json): ülke grubu × siyasi çizgi ve Filistin tutumu kırılımlarında
almanağın üç ölçüsü. Eski raporlar değişmez; bu ayrı bir bakış.

Ölçüler (alisma.py, yayın yayın): büyük olaylarda susma, Filistinli ölüm başlıklarında faili gizleme, İsrailli ölüye
ölü başına ayrılan başlık. Her yayın kendi dilindeki tanık basının ortalamasıyla karşılaştırılır (fark puan olarak);
bir hücrenin değeri, içindeki yayınların farklarının ortalamasıdır. Ölçümün zayıf olduğu dillerde (es, fr, it, de, ca)
fail farkı çıkarıma girmez. Yalnızca en az iki ölçülmüş yayını olan hücrelerden cümle kurulur.
Yapay zekâ kullanılmaz; cümleler sabit kalıplardan, sayılarla yazılır.
"""
import os

import almanak

SAGLAM = {"en", "ar", "tr"}
KUME = {"sol": "sol", "merkez-sol": "sol", "merkez": "merkez", "merkez-sağ": "sağ", "sağ": "sağ", "ulusalcı": "ulusalcı",
        "İslami düşünce": "İslami düşünce", "devlet / kamu": "devlet / kamu", "parti / hareket organı": "parti / hareket"}
KUME_AD_EN = {"sol": "the left", "merkez": "centrist outlets", "sağ": "the right", "ulusalcı": "nationalist outlets",
              "İslami düşünce": "Islamic-thought outlets", "devlet / kamu": "state and public media", "parti / hareket": "party and movement outlets"}
IYELIK = {"Türkiye": "Türkiye’nin", "İsrail": "İsrail’in", "ABD": "ABD’nin", "İspanya": "İspanya’nın", "İran": "İran’ın",
          "İngiltere": "İngiltere’nin", "Fransa": "Fransa’nın", "İtalya": "İtalya’nın", "Almanya": "Almanya’nın", "BAE": "BAE’nin",
          "Yemen": "Yemen’in", "Filistin": "Filistin’in", "Arap dünyası": "Arap dünyasının"}
BULUNMA = {"Türkiye": "Türkiye’de", "İsrail": "İsrail’de", "ABD": "ABD’de", "İspanya": "İspanya’da", "İran": "İran’da",
           "İngiltere": "İngiltere’de", "Fransa": "Fransa’da", "İtalya": "İtalya’da", "Almanya": "Almanya’da", "BAE": "BAE’de",
           "Yemen": "Yemen’de", "Filistin": "Filistin’de", "Arap dünyası": "Arap dünyasında"}
GRUP_EN = {"Türkiye": "Turkey", "İsrail": "Israel", "ABD": "the US", "İspanya": "Spain", "İran": "Iran", "İngiltere": "Britain",
           "Fransa": "France", "İtalya": "Italy", "Almanya": "Germany", "BAE": "the UAE", "Yemen": "Yemen", "Filistin": "Palestine",
           "Arap dünyası": "the Arab world"}
KUME_YAYIN = {"merkez": "merkez yayınlar", "ulusalcı": "ulusalcı yayınlar", "İslami düşünce": "İslami düşünce yayınları",
              "devlet / kamu": "devlet ve kamu yayınları", "parti / hareket": "parti ve hareket yayınları"}
ESIK = 0.12
KAT_EN_AZ_FO = 100   # Filistinli ölüm başlığı az olan yayının katı birkaç başlıkla uçar (ör. 16 başlıkta 68 kat)
KAT_ESIK = 2.0  # İsrailli ölüye ölü başına ayrılan başlık, tanık basının en az iki katıysa    # 12 puan: hücre ortalaması tanık basından bu kadar uzaksa cümle kurulur


def _yuz(x):
    return None if x is None else round(100 * x, 1)


def hesapla(kok, kaynaklar, simdi, log=print):
    al = almanak._oku(os.path.join(kok, "data", "bulten", "alisma.json"), {})
    olc = {str(r["id"]): r for r in al.get("yayin_olcu") or []}
    if not olc:
        return None
    hucre = {}
    for k in kaynaklar:
        r = olc.get(str(k["id"]))
        if not r or not k.get("grup"):
            continue
        t = r.get("taban") or {}
        kume = KUME.get(k.get("siyasi"))
        for anahtar in ((k["grup"], kume), (k["grup"], None), ("Hepsi", kume)):
            if anahtar[1] is None and anahtar[0] == "Hepsi":
                continue
            h = hucre.setdefault(anahtar, {"yayinlar": [], "s": {}, "g": {}, "k": {}})
            kur = k.get("kurum") or k["ad"]
            h["yayinlar"].append(kur)
            if r.get("sessiz_oran") is not None and t.get("sessiz_oran") is not None:
                h["s"].setdefault(kur, []).append(r["sessiz_oran"] - t["sessiz_oran"])
            if r.get("gizli_oran") is not None and t.get("gizli_oran") is not None and r.get("dil") in SAGLAM:
                h["g"].setdefault(kur, []).append(r["gizli_oran"] - t["gizli_oran"])
            if r.get("kat") is not None and t.get("kat") and r.get("dil") in SAGLAM and (r.get("fo") or 0) >= KAT_EN_AZ_FO:
                h["k"].setdefault(kur, []).append(r["kat"] / t["kat"])

    def ort(d):
        # önce kurum içi (AA'nın masaları tek kurum), sonra kurumlar arası ortalama
        xs = [sum(v) / len(v) for v in d.values()]
        return sum(xs) / len(xs) if xs else None
    satirlar, cumle = [], []
    for (g, kume), h in sorted(hucre.items(), key=lambda x: (x[0][0] == "Hepsi", x[0][0], x[0][1] or "")):
        yay = sorted(set(h["yayinlar"]))
        say = lambda n: f"ölçülen {n} yayın"  # noqa: E731
        say_en = lambda n: f"{n} measured outlets"  # noqa: E731
        s, gz, kt = ort(h["s"]), ort(h["g"]), ort(h["k"])
        satirlar.append({"grup": g, "cizgi": kume, "yayin": len(yay), "yayinlar": yay[:12], "susma_fark": _yuz(s), "susma_n": len(h["s"]),
                         "fail_fark": _yuz(gz), "fail_n": len(h["g"]), "agirlik_kat": round(kt, 2) if kt else None, "agirlik_n": len(h["k"])})
        if not kume or g not in IYELIK:
            continue
        ozne_tr = f"{IYELIK[g]} {'solu' if kume == 'sol' else 'sağı'}" if kume in ("sol", "sağ") else f"{BULUNMA[g]} {KUME_YAYIN.get(kume, kume)}"
        ozne_en = f"{KUME_AD_EN.get(kume, kume)} in {GRUP_EN[g]}"
        ozne_en = ozne_en[0].upper() + ozne_en[1:]
        if s is not None and len(h["s"]) >= 2 and s >= ESIK:
            cumle.append({"tr": f"{ozne_tr} büyük olaylarda sessiz kaldı: kendi dilindeki tanık basından ortalama {abs(_yuz(s)):.0f} puan daha sık sustu ({say(len(h['s']))}).",
                          "en": f"{ozne_en} stayed silent on major events: on average {abs(_yuz(s)):.0f} points more often than witness press in the same language ({say_en(len(h['s']))}).",
                          "grup": g, "cizgi": kume, "olcu": "susma", "fark": _yuz(s)})
        if gz is not None and len(h["g"]) >= 2 and gz >= ESIK:
            cumle.append({"tr": f"{ozne_tr} Filistinli ölümlerde faili daha sık gizledi: tanık basından ortalama {abs(_yuz(gz)):.0f} puan fazla ({say(len(h['g']))}).",
                          "en": f"{ozne_en} hid the perpetrator of Palestinian deaths more often: {abs(_yuz(gz)):.0f} points above witness press ({say_en(len(h['g']))}).",
                          "grup": g, "cizgi": kume, "olcu": "fail", "fark": _yuz(gz)})
        if s is not None and len(h["s"]) >= 2 and s <= -ESIK:
            cumle.append({"tr": f"{ozne_tr} büyük olaylarda tanık basından ortalama {abs(_yuz(s)):.0f} puan daha az sustu ({say(len(h['s']))}).",
                          "en": f"{ozne_en} was silent on major events {abs(_yuz(s)):.0f} points less often than witness press ({say_en(len(h['s']))}).",
                          "grup": g, "cizgi": kume, "olcu": "susma", "fark": _yuz(s)})
        if kt is not None and len(h["k"]) >= 2 and kt >= KAT_ESIK:
            cumle.append({"tr": f"{ozne_tr}, İsrailli ölüye ölü başına kendi dilindeki tanık basının {str(round(kt, 1)).replace('.', ',')} katı başlık ayırdı ({say(len(h['k']))}).",
                          "en": f"{ozne_en} gave Israeli dead {round(kt, 1)} times as many headlines per death as witness press in the same language ({say_en(len(h['k']))}).",
                          "grup": g, "cizgi": kume, "olcu": "agirlik", "fark": round(kt, 2)})
    veri = {"guncellendi": simdi.isoformat(), "alisma_guncellendi": al.get("guncellendi"), "esik_puan": round(100 * ESIK),
            "hucreler": satirlar, "cumleler": cumle}
    almanak._yaz(os.path.join(kok, "data", "bulten", "taksim.json"), veri)
    log(f"Taksim raporu: {len(satirlar)} hücre, {len(cumle)} çıkarım")
    return veri
