"""Özel rapor: 7 Ekim 2023'ten bu yana basın (data/bulten/rapor-7-ekim.json).

Geriye dönük taramanın özetinden (gecmis.py) yayın yayın, gün gün sayılar okunur ve dört grup karşılaştırılır:
bölge basını, İsrail basını, Batı ana akım basını, Batı'da muhalif basın. Kelime sıklıkları yalnızca Filistin,
İsrail ya da Gazze bağlamındaki başlıklarda sayılır (Ruanda ya da Myanmar soykırımı haberleri karışmasın).
Yapay zekâ kullanılmaz; sayılar her çalıştırmada taramanın son hâlinden yeniden hesaplanır.
"""
import datetime as dt
import json
import os

import almanak
import gecmis

GRUPLAR = [("bolge", "Bölge basını"), ("israil", "İsrail basını"), ("bati_ana", "Batı ana akım basını"),
           ("bati_muhalif", "Batı’da muhalif basın")]
TERIMLER = [(a, l, y) for a, l, y, _ in almanak.TERIMLER]


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
    return {"n": 0, "b": 0, "g": 0, "i": 0, "t": {a: 0 for a, _, _ in TERIMLER}}


def _oran(r):
    """Bağlamlı başlıkta binde sıklıklar ve Gazze payı."""
    return {"n": r["n"], "baglamli": r["b"], "gazze_pay": round(100 * r["g"] / r["n"], 1) if r["n"] else None,
            "iran_pay": round(100 * r["i"] / r["n"], 1) if r["n"] else None,
            "binde": {a: round(1000 * r["t"][a] / r["b"], 1) if r["b"] else None for a, _, _ in TERIMLER}}


def hesapla(kok, kaynaklar, simdi, log=print):
    yol = os.path.join(kok, "data", "bulten", "gecmis-ozet.json.gz")
    try:
        import gzip
        with gzip.open(yol, "rt", encoding="utf-8") as f:
            oz = json.load(f)
    except (OSError, ValueError, EOFError):
        return None
    if oz.get("surum", 1) < 2:
        return None   # bağlamlı sayılar yok; özetin yeni sürümü bekleniyor
    K = {str(k["id"]): k for k in kaynaklar}
    gk = {kid: grup(k) for kid, k in K.items()}
    ay, toplam, yay = {}, {g: _bos() for g, _ in GRUPLAR}, {}
    for gun, d in oz["yayin"].items():
        m = gun[:7]
        for kid, v in d.items():
            gr = gk.get(kid)
            if not gr:
                continue
            n, tt = (v, {}) if isinstance(v, int) else (v[0], v[1])
            for r in (ay.setdefault(m, {g: _bos() for g, _ in GRUPLAR})[gr], toplam[gr], yay.setdefault(kid, _bos())):
                r["n"] += n
                r["b"] += tt.get("_b", 0)
                r["g"] += tt.get("_g", 0)
                r["i"] += tt.get("_i", 0)
                for a, _, _ in TERIMLER:
                    r["t"][a] += tt.get("b:" + a, 0)
    aylar = sorted(ay)
    seri = [{"ay": m, **{g: _oran(ay[m][g]) for g, _ in GRUPLAR}} for m in aylar]
    # Çeyrek çeyrek Gazze payı: ilgi nasıl değişti
    ceyrek = {}
    for m in aylar:
        y, a = int(m[:4]), int(m[5:])
        c = f"{y}-Ç{(a - 1) // 3 + 1}"
        r = ceyrek.setdefault(c, {g: _bos() for g, _ in GRUPLAR})
        for g, _ in GRUPLAR:
            for x in ("n", "b", "g"):
                r[g][x] += ay[m][g][x]
    ceyrekler = [{"ceyrek": c, **{g: round(100 * r[g]["g"] / r[g]["n"], 1) if r[g]["n"] else None for g, _ in GRUPLAR}}
                 for c, r in sorted(ceyrek.items())]
    yayinlar = []
    for kid, r in yay.items():
        if r["b"] < 150:
            continue
        o = _oran(r)
        yayinlar.append({"id": int(kid), "ad": K[kid]["ad"], "grup": gk[kid], "kamp": almanak.kamp(K[kid]), **o})
    yayinlar.sort(key=lambda x: -x["baglamli"])
    # Zirve aylar: İsrail ve Batı basınında 'soykırım'ın en sık geçtiği aylar, örnek başlıklarla
    zirve = []
    for s in sorted(seri, key=lambda s: -(s["bati_ana"]["binde"]["soykirim"] or 0))[:4]:
        ornek = [o for o in ((oz["ornek"].get(s["ay"]) or {}).get("soykirim") or {}).get("dis", [])
                 if gk.get(str(o[0])) in ("israil", "bati_ana")]
        zirve.append({"ay": s["ay"], "binde": s["bati_ana"]["binde"]["soykirim"],
                      "ornek": [{"yayin": K[str(o[0])]["ad"], "baslik": o[1], "url": o[2], "gun": o[3]} for o in ornek[:3]]})
    veri = {
        "guncellendi": simdi.isoformat(), "ozet_guncellendi": oz["guncellendi"], "tarama_bitti": oz.get("tarama_bitti"),
        "bas": aylar[0] if aylar else None, "son": aylar[-1] if aylar else None,
        "baslik": sum(t["n"] for t in toplam.values()), "tarihsiz": oz.get("tarihsiz"),
        "gruplar": [{"anahtar": g, "ad": a, "yayin": sum(1 for x in gk.values() if x == g),
                     "olculen_yayin": sum(1 for kid, r in yay.items() if gk.get(kid) == g and r["n"]), **_oran(toplam[g])}
                    for g, a in GRUPLAR],
        "terimler": [{"anahtar": a, "ad": l, "yan": y} for a, l, y in TERIMLER],
        "aylik": seri, "ceyrek": ceyrekler, "yayinlar": yayinlar, "soykirim_zirve": zirve,
    }
    almanak._yaz(os.path.join(kok, "data", "bulten", "rapor-7-ekim.json"), veri)
    log(f"Rapor (7 Ekim): {veri['baslik']} başlık, {len(yayinlar)} yayın, {len(seri)} ay")
    return veri
