"""Özel rapor: 7 Ekim 2023'ten bu yana basın (data/bulten/rapor-7-ekim.json).

Çerçeve: görünürlük ve sessizlik, dikkat ve zaman, adlandırma, faillik, kaynak, bağlam. Geriye dönük taramanın özetinden
(gecmis.py) yayın yayın, gün gün sayılar okunur ve dört grup karşılaştırılır: bölge basını, İsrail basını, Batı ana akım
basını, Batı'da muhalif basın. Kelimeler ve faillik yalnızca Filistin, İsrail ya da Gazze bağlamındaki başlıklarda sayılır.
Ölümler ve öldürülen gazeteciler dış veriden (dis_veri.py). Yapay zekâ kullanılmaz; her çalıştırmada yeniden hesaplanır.
"""
import datetime as dt
import gzip
import json
import os

import almanak
import dis_veri

GRUPLAR = [("bolge", "Bölge basını"), ("israil", "İsrail basını"), ("bati_ana", "Batı ana akım basını"),
           ("bati_muhalif", "Batı’da muhalif basın")]
TERIMLER = [(a, l, y) for a, l, y, _ in almanak.TERIMLER]
FAILLIK = ["aktif", "failli", "failsiz", "oldu", "sehadet", "pfail", "ikurban"]
# Karşıt çiftler: aynı şeyin iki adı
CIFTLER = [("saldiri", "catisma", "Şiddetin adı"), ("soykirim", "savas", "Olayın adı"), ("direnis", "teror", "Silahlı grupların adı"),
           ("esir", "rehine", "Tutulan insanların adı"), ("sehit", "etkisiz", "Ölümün adı"), ("isgal", "savas", "Toprağın durumu")]
# Dikkat çizelgesindeki olaylar (tarihler kamuya açık kayıtlardan)
OLAYLAR = [
    ("2023-11-24", "2023-11-30", "İlk ateşkes ve takas", "gazze"),
    ("2024-01-11", "2024-01-26", "Lahey'de soykırım davası", "gazze"),
    ("2024-02-29", None, "Un kuyruğu katliamı", "gazze"),
    ("2024-05-06", None, "Refah saldırısı başladı", "gazze"),
    ("2024-06-14", "2024-07-14", "Avrupa Futbol Şampiyonası", "dunya"),
    ("2024-07-26", "2024-08-11", "Paris Olimpiyatları", "dunya"),
    ("2024-09-17", "2024-11-27", "Lübnan’a saldırılar: çağrı cihazları, Nasrallah, kara harekâtı", "gazze"),
    ("2024-11-05", None, "ABD seçimi", "dunya"),
    ("2024-11-21", None, "UCM tutuklama kararları", "gazze"),
    ("2024-12-08", None, "Suriye'de rejimin çöküşü", "bolge"),
    ("2025-01-19", "2025-03-18", "Ateşkes", "gazze"),
    ("2025-06-13", "2025-06-24", "İsrail–İran savaşı", "bolge"),
    ("2025-08-22", None, "Gazze'de kıtlık ilanı", "gazze"),
    ("2025-09-16", None, "BM komisyonu: soykırım", "gazze"),
    ("2025-10-10", None, "Ateşkes", "gazze"),
    ("2026-06-11", "2026-07-19", "Dünya Kupası", "dunya"),
]


def grup(k):
    c = almanak.kamp(k)
    if c in almanak.BOLGE_ICI:
        return "bolge" if k.get("cizgi") != "ik" else None
    if c == "İsrail":
        return "israil"
    if c == "Batı":
        return "bati_muhalif" if k.get("cizgi") == "ad" else "bati_ana"
    return None


def _bos():
    return {"n": 0, "b": 0, "g": 0, "s": 0, "i": 0, "gz": 0, "t": {a: 0 for a, _, _ in TERIMLER}, "f": {f: 0 for f in FAILLIK}}


def _ekle(r, n, tt):
    r["n"] += n
    r["b"] += tt.get("_b", 0)
    r["g"] += tt.get("_g", 0)
    r["s"] += tt.get("_s", 0)
    r["i"] += tt.get("_i", 0)
    r["gz"] += tt.get("_gz", 0)
    for a in r["t"]:
        r["t"][a] += tt.get("b:" + a, 0)
    for f in FAILLIK:
        r["f"][f] += tt.get("f:" + f, 0)


def _oran(r):
    olum = sum(r["f"][f] for f in ("aktif", "failli", "failsiz", "oldu", "sehadet"))   # Filistinli ölümlerin anlatımı
    olum_fs = olum - r["f"]["sehadet"]
    israilli = r["f"]["pfail"] + r["f"]["ikurban"]                                     # İsraillilerin ölümü
    return {
            # faili yazılan pay: şehadet anlatımı paydaya girmez (faili yazmasa da ölümü saldırının sonucu olarak verir)
            "fail_yazilan": {"filistinli": round(100 * (r["f"]["aktif"] + r["f"]["failli"]) / olum_fs, 1) if olum_fs else None,
                             "israilli": round(100 * r["f"]["pfail"] / israilli, 1) if israilli >= 20 else None,
                             "israilli_n": israilli},"n": r["n"], "baglamli": r["b"], "gazze": r["g"], "gazeteci_haber": r["gz"],
            "gazze_pay": round(100 * r["g"] / r["n"], 1) if r["n"] else None,
            "savas_pay": round(100 * r["s"] / r["n"], 1) if r["n"] else None, "savas": r["s"],
            "iran_pay": round(100 * r["i"] / r["n"], 1) if r["n"] else None,
            "binde": {a: round(1000 * r["t"][a] / r["b"], 1) if r["b"] else None for a in r["t"]},
            "olum_haberi": olum, "faillik": {f: r["f"][f] for f in FAILLIK},
            "faillik_pay": {f: round(100 * r["f"][f] / olum, 1) if olum else None for f in ("aktif", "failli", "failsiz", "oldu", "sehadet")}}


def _hafta(g):
    d = dt.date.fromisoformat(g)
    return (d - dt.timedelta(days=d.weekday())).isoformat()


RAPOR_SURUM = 7


def hesapla(kok, kaynaklar, simdi, log=print):
    yol = os.path.join(kok, "data", "bulten", "gecmis-ozet.json.gz")
    try:
        with gzip.open(yol, "rt", encoding="utf-8") as f:
            oz = json.load(f)
    except (OSError, ValueError, EOFError):
        return None
    if oz.get("surum", 1) < 6:
        return None   # bağlamlı sayılar ve faillik yok; özetin yeni sürümü bekleniyor
    dis = dis_veri.guncelle(kok, log) or {"gun": {}}
    # özet ve dış veri değişmediyse yeniden hesaplama (her 15 dakikada iki dakika kazandırır)
    try:
        eski = json.load(open(os.path.join(kok, "data", "bulten", "rapor-7-ekim.json"), encoding="utf-8"))
        if (eski.get("surum") == RAPOR_SURUM and eski.get("ozet_guncellendi") == oz.get("guncellendi")
                and (eski.get("dis") or {}).get("indirildi") == dis.get("indirildi")):
            return eski
    except (OSError, ValueError):
        pass
    K = {str(k["id"]): k for k in kaynaklar}
    gk = {kid: grup(k) for kid, k in K.items()}
    ay, hafta, toplam, yay = {}, {}, {g: _bos() for g, _ in GRUPLAR}, {}
    for gun, d in oz["yayin"].items():
        try:
            dt.date.fromisoformat(gun)
        except ValueError:
            continue
        for kid, v in d.items():
            gr = gk.get(kid)
            if not gr:
                continue
            n, tt = (v, {}) if isinstance(v, int) else (v[0], v[1])
            for r in (ay.setdefault(gun[:7], {g: _bos() for g, _ in GRUPLAR})[gr], hafta.setdefault(_hafta(gun), {g: _bos() for g, _ in GRUPLAR})[gr],
                      toplam[gr], yay.setdefault(kid, _bos())):
                _ekle(r, n, tt)
    # dış veri: ay ay ve hafta hafta ölümler, öldürülen gazeteciler
    olu_ay, olu_hafta, gzt_ay = {}, {}, {}
    for g, x in dis.get("gun", {}).items():
        olu_ay[g[:7]] = olu_ay.get(g[:7], 0) + x.get("olu", 0)
        olu_hafta[_hafta(g)] = olu_hafta.get(_hafta(g), 0) + x.get("olu", 0)
        gzt_ay[g[:7]] = gzt_ay.get(g[:7], 0) + x.get("gazeteci", 0)
    aylar = sorted(ay)
    seri = []
    for m in aylar:
        s = {"ay": m, "olu": olu_ay.get(m), "gazeteci_olu": gzt_ay.get(m)}
        for g, _ in GRUPLAR:
            o = _oran(ay[m][g])
            o["yuz_olu_basina_gazze"] = round(100 * o["gazze"] / olu_ay[m], 1) if olu_ay.get(m) else None
            s[g] = o
        seri.append(s)
    haftalar = [{"hafta": h, "olu": olu_hafta.get(h), **{g: {"n": hafta[h][g]["n"], "gazze": hafta[h][g]["g"],
                                                              "savas_pay": round(100 * hafta[h][g]["s"] / hafta[h][g]["n"], 1)
                                                              if hafta[h][g]["n"] >= 40 else None,
                                                              "gazze_pay": round(100 * hafta[h][g]["g"] / hafta[h][g]["n"], 1)
                                                              if hafta[h][g]["n"] >= 40 else None} for g, _ in GRUPLAR}}
                for h in sorted(hafta)]
    ceyrek = {}
    for m in aylar:
        c = f"{m[:4]}-Ç{(int(m[5:]) - 1) // 3 + 1}"
        r = ceyrek.setdefault(c, {g: _bos() for g, _ in GRUPLAR})
        for g, _ in GRUPLAR:
            for x in ("n", "g", "s"):
                r[g][x] += ay[m][g][x]
    ceyrekler = [{"ceyrek": c, **{g: round(100 * r[g]["s"] / r[g]["n"], 1) if r[g]["n"] else None for g, _ in GRUPLAR}}
                 for c, r in sorted(ceyrek.items())]
    yayinlar = []
    for kid, r in yay.items():
        if r["b"] < 150:
            continue
        yayinlar.append({"id": int(kid), "ad": K[kid]["ad"], "grup": gk[kid], "kamp": almanak.kamp(K[kid]), **_oran(r)})
    yayinlar.sort(key=lambda x: -x["baglamli"])
    zirve = []
    for s in sorted(seri, key=lambda s: -(s["bati_ana"]["binde"]["soykirim"] or 0))[:4]:
        ornek = [o for o in ((oz["ornek"].get(s["ay"]) or {}).get("soykirim") or {}).get("dis", [])
                 if gk.get(str(o[0])) in ("israil", "bati_ana")]
        zirve.append({"ay": s["ay"], "binde": s["bati_ana"]["binde"]["soykirim"],
                      "ornek": [{"yayin": K[str(o[0])]["ad"], "baslik": o[1], "url": o[2], "gun": o[3]} for o in ornek[:3]]})
    gruplar = []
    for g, a in GRUPLAR:
        o = _oran(toplam[g])
        gruplar.append({"anahtar": g, "ad": a, "olculen_yayin": sum(1 for kid, r in yay.items() if gk.get(kid) == g and r["n"]), **o})
    toplam_olu = sum(olu_ay.values())
    veri = {
        "surum": RAPOR_SURUM, "guncellendi": simdi.isoformat(), "ozet_guncellendi": oz["guncellendi"], "tarama_bitti": oz.get("tarama_bitti"),
        "bas": aylar[0] if aylar else None, "son": aylar[-1] if aylar else None,
        "baslik": sum(t["n"] for t in toplam.values()), "tarihsiz": oz.get("tarihsiz"),
        "dis": {"kaynak": dis.get("kaynak"), "olu": toplam_olu, "gazeteci": sum(gzt_ay.values()), "indirildi": dis.get("indirildi")},
        "gruplar": gruplar, "terimler": [{"anahtar": a, "ad": l, "yan": y} for a, l, y in TERIMLER],
        "ciftler": [{"a": a, "b": b, "ad": ad} for a, b, ad in CIFTLER],
        "olaylar": [{"bas": b, "bit": e, "ad": ad, "tur": t} for b, e, ad, t in OLAYLAR],
        "aylik": seri, "haftalik": haftalar, "ceyrek": ceyrekler, "yayinlar": yayinlar, "soykirim_zirve": zirve,
    }
    almanak._yaz(os.path.join(kok, "data", "bulten", "rapor-7-ekim.json"), veri)
    log(f"Rapor (7 Ekim): {veri['baslik']} başlık, {len(yayinlar)} yayın, {len(seri)} ay")
    return veri
