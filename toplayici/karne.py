"""Yayın karnesi ve sessizlik endeksi (data/karne.json): olay arşivindeki anlatım alanlarından, yapay zekâya yeni istek olmadan.

Yayın karnesi (son 30 gün): faili saklama oranı (Filistinlilerin ölümünü anlatan özgün başlıklarda öldürenin yazılmaması; en az 10 başlık), İsrail ordusuna dayanma oranı,
bağlam verme oranı, ortalama gecikme (yayının bir olaydaki ilk haberi, olayın bölge basınındaki ilk haberinden ne kadar sonra).
Sessizlik endeksi (haftalık): bölge basınından en az 4 yayının yazdığı olaylardan İsrail ve Batı basınının hiç yazmadıklarının oranı.
"""
import datetime as dt
import json
import os
import re

import almanak

ORDU = re.compile(r"israil ordusu|idf|israeli army|israeli military|tsahal|ordu sözcüsü", re.I)


def hesapla(kok, kaynaklar, simdi, log=print):
    kmap = {k["id"]: k for k in kaynaklar}
    olaylar = {}
    for n in range(120, -1, -1):
        g = (simdi - dt.timedelta(days=n)).date().isoformat()
        try:
            for o in json.load(open(os.path.join(kok, "data", "olay-arsiv", g + ".json"), encoding="utf-8")):
                olaylar[o["id"]] = o
        except Exception:
            pass
    sinir = (simdi - dt.timedelta(days=30)).isoformat()
    y = {}
    hafta = {}
    for o in olaylar.values():
        hs = [x for x in o.get("haberler", []) if kmap.get(x.get("k"))]
        bolge = [x for x in hs if almanak.kamp(kmap[x["k"]]) in almanak.BOLGE_ICI and kmap[x["k"]].get("cizgi") != "ik"]
        dis = [x for x in hs if almanak.kamp(kmap[x["k"]]) in almanak.DIS]
        # sessizlik endeksi
        if o.get("ilk") and len({x["k"] for x in bolge}) >= 4:
            t = dt.date.fromisoformat(o["ilk"][:10])
            hk = (t - dt.timedelta(days=t.weekday())).isoformat()
            hw = hafta.setdefault(hk, {"buyuk": 0, "sessiz": 0})
            hw["buyuk"] += 1
            hw["sessiz"] += 0 if dis else 1
        if (o.get("ilk") or "") < sinir:
            continue
        ilk_bolge = min((x["t"] for x in bolge if x.get("t")), default=None)
        gorulen = set()
        for x in hs:
            k = x["k"]
            r = y.setdefault(k, {"haber": 0, "fail": 0, "edilgen": 0, "dayanak": 0, "ordu": 0, "baglam_n": 0, "baglam": 0, "gecikme": []})
            r["haber"] += 1
            a = x.get("an") or {}
            if a.get("fail") in ("acik", "edilgen"):
                r["fail"] += 1
                r["edilgen"] += a["fail"] == "edilgen"
            if a.get("dayanak"):
                r["dayanak"] += 1
                r["ordu"] += bool(ORDU.search(a["dayanak"]))
            if isinstance(a.get("baglam"), bool):
                r["baglam_n"] += 1
                r["baglam"] += a["baglam"]
            if ilk_bolge and x.get("t") and k not in gorulen and almanak.kamp(kmap[k]) in almanak.DIS:
                r["gecikme"].append((dt.datetime.fromisoformat(x["t"]) - dt.datetime.fromisoformat(ilk_bolge)).total_seconds() / 3600)
            gorulen.add(k)
    # Faili saklama: son 30 günün arşivindeki özgün başlıklar, geriye dönük taramayla aynı ölçüyle (gecmis.faillik).
    # Filistinlilerin ölümünü anlatan başlıklardan kaçında öldüren yazılmıyor ("öldü", "hayatını kaybetti", failsiz "öldürüldü").
    import gecmis
    fk = {}
    ornek = {}
    for i in range(30):
        gun = (simdi.date() - dt.timedelta(days=i)).isoformat()
        try:
            gunluk = json.load(open(os.path.join(kok, "data", "arsiv", gun + ".json"), encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for h in gunluk if isinstance(gunluk, list) else []:
            b = h.get("baslik_orj") or ""
            if not b or h.get("kaynak") not in kmap:
                continue
            f = gecmis.faillik(b, gecmis.katla(b))
            if f not in ("aktif", "failli", "failsiz", "oldu", "sehadet"):
                continue
            r = fk.setdefault(h["kaynak"], {"n": 0, "gizli": 0})
            r["n"] += 1
            if f in ("failsiz", "oldu"):
                r["gizli"] += 1
                o = ornek.setdefault(h["kaynak"], [])
                if len(o) < 3:
                    o.append({"b": b[:200], "tr": (h.get("baslik_tr") or "")[:200], "url": h.get("url"), "gun": gun})
    karne = []
    for k in set(y) | set(fk):
        r = y.get(k) or {"haber": 0, "fail": 0, "edilgen": 0, "dayanak": 0, "ordu": 0, "baglam_n": 0, "baglam": 0, "gecikme": []}
        f = fk.get(k) or {"n": 0, "gizli": 0}
        if r["haber"] < 5 and f["n"] < 10:
            continue
        oran = lambda a, b: round(100 * a / b) if b >= 3 else None  # noqa: E731
        gec = sorted(g for g in r["gecikme"] if g >= 0)
        karne.append({"id": k, "ad": kmap[k]["ad"], "kamp": almanak.kamp(kmap[k]), "haber": r["haber"],
                      "olum_baslik": f["n"], "fail_gizli": round(100 * f["gizli"] / f["n"]) if f["n"] >= 10 else None,
                      "fail_ornek": ornek.get(k, []), "ordu": oran(r["ordu"], r["dayanak"]),
                      "baglam": oran(r["baglam"], r["baglam_n"]),
                      "gecikme": round(gec[len(gec) // 2], 1) if len(gec) >= 3 else None})
    karne.sort(key=lambda r: -(r["olum_baslik"] or 0))
    sessizlik = [{"hafta": h, **v, "oran": round(100 * v["sessiz"] / v["buyuk"]) if v["buyuk"] else None}
                 for h, v in sorted(hafta.items()) if v["buyuk"] >= 3]
    veri = {"guncellendi": simdi.isoformat(), "donem_gun": 30, "karne": karne, "sessizlik": sessizlik}
    json.dump(veri, open(os.path.join(kok, "data", "karne.json"), "w", encoding="utf-8"), ensure_ascii=False)
    log(f"Yayın karnesi: {len(karne)} yayın, sessizlik endeksi {len(sessizlik)} hafta")
    return veri
