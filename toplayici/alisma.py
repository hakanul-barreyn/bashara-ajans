"""Olaylar ve alışma (data/bulten/alisma.json), liderler (data/bulten/liderler.json).

Soru: aynı türden olaylar (hastane saldırısı, çadır yakılması, yardım bekleyenlere ateş, ...) tekrarlandıkça basın ve
liderler ne kadar tepki verdi; bir tür ne zaman "tetiklemeyi" bıraktı?

Yöntem (yapay zekâ yok; geriye dönük taramanın özetinden, gecmis.py):
1) Olay günleri: bir türün bölge basınındaki (Türkiye dahil) günlük payı, önceki 28 günün ortancasının 2,5 katını aşıyorsa
   o gün bir olaydır; arka arkaya gelen günler tek olay sayılır. Bölge basını burada tanık basındır: olayın büyüklüğünün
   ölçüsü olarak kullanılır. Yeri, başlıklardaki yer adlarından okunur.
2) Tepki: her olayın penceresinde (bir gün önce, iki gün sonra) her grubun bin başlığından kaçının o türden olduğu.
   Türün ilk büyük olayı (bölge basınında en büyük olayın en az %40'ı kadar yer bulan ilk olay) 100 sayılır; sonraki
   olaylar ona göre ölçülür. Bir grubun "son tepkisi", tepkinin 50'yi geçtiği son olaydır.
3) Batı'nın izleme oranı: bir olayda Batı ana akım basınının payı / bölge basınının payı. Büyüklükten bağımsız ölçü.
4) Liderler: başlıklarda Filistin bağlamında adı geçen liderler (olay_turleri.LIDERLER). Kitlesel ölüm günleri ve olay
   türlerinden sonra adlarının ne kadar arttığı (önceki 28 günün ortalamasına göre).
Kaynak başlık sayıları gruptan gruba, dönemden döneme değiştiği için hep oranlar (binde) kullanılır.
"""
import datetime as dt
import gzip
import json
import os
import statistics

import almanak
import dis_veri
import olay_turleri as OT
import rapor

GRUPLAR = [("bolge", "Bölge basını (Türkiye hariç)"), ("turkiye", "Türkiye basını"), ("israil", "İsrail basını"),
           ("bati_ana", "Batı ana akım basını"), ("bati_muhalif", "Batı’da muhalif basın")]
GK = [g for g, _ in GRUPLAR]
TURLER = [(t[0], t[1]) for t in OT.TURLER] + [(a, ad) for a, ad, _ in OT.TUREV]
# Olay kataloğuna girmeyen, yalnızca dikkat çizgisi çizilen türler (olay değil, durum)
DURUM = {"kitlik", "katliam"}
ESIK_KAT, PENCERE_ONCE, PENCERE_SONRA, TABAN_GUN = 2.5, 1, 2, 28
ALISMA_SURUM = 2
TR_OLAYLAR = [("2024-03-31", "Türkiye’de yerel seçim"), ("2024-05-02", "Türkiye İsrail’le ticareti durdurdu")]


def grup(k):
    g = rapor.grup(k)
    if g == "bolge" and k.get("ulke") == "Türkiye":
        return "turkiye"
    return g


def _hafta(g):
    d = dt.date.fromisoformat(g)
    return (d - dt.timedelta(days=d.weekday())).isoformat()


def _oz(kok):
    try:
        with gzip.open(os.path.join(kok, "data", "bulten", "gecmis-ozet.json.gz"), "rt", encoding="utf-8") as f:
            oz = json.load(f)
    except (OSError, ValueError, EOFError):
        return None
    return oz if oz.get("surum", 1) >= 6 else None


def _topla(oz, gk):
    """Gün gün, grup grup sayılar: n (bütün başlıklar), b (bağlamlı), g (Gazze), o[tür], l[lider], lk[(lider, kelime)]."""
    gunler = sorted(g for g in oz["yayin"] if len(g) == 10 and g >= "2023-10-07")
    gecerli = []
    for g in gunler:
        try:
            dt.date.fromisoformat(g)
            gecerli.append(g)
        except ValueError:
            pass
    if not gecerli:
        return None
    bas, son = dt.date.fromisoformat(gecerli[0]), dt.date.fromisoformat(gecerli[-1])
    D = [(bas + dt.timedelta(days=i)).isoformat() for i in range((son - bas).days + 1)]
    ix = {g: i for i, g in enumerate(D)}
    N = len(D)
    sifir = lambda: {g: [0] * N for g in GK}  # noqa: E731
    S = {"n": sifir(), "b": sifir(), "g": sifir(), "o": {a: sifir() for a, _ in TURLER}, "l": {}, "lk": {}, "ltr": {}}
    for gun in gecerli:
        i = ix[gun]
        for kid, v in oz["yayin"][gun].items():
            gr = gk.get(kid)
            if not gr:
                continue
            n, tt = (v, {}) if isinstance(v, int) else (v[0], v[1])
            S["n"][gr][i] += n
            S["b"][gr][i] += tt.get("_b", 0)
            S["g"][gr][i] += tt.get("_s", 0)   # savaş başlığı: Gazze, Filistin, Lübnan
            for a, x in tt.items():
                if a.startswith("o:"):
                    if a[2:] in S["o"]:
                        S["o"][a[2:]][gr][i] += x
                elif a.startswith("l:"):
                    S["l"].setdefault(a[2:], sifir())[gr][i] += x
                elif a.startswith("lk:"):
                    _, ld, kl = a.split(":")
                    S["lk"].setdefault((ld, kl), [0] * N)[i] += x
                    if gr == "turkiye":
                        S["ltr"].setdefault((ld, kl), [0] * N)[i] += x
    return D, S


def _binde(x, n):
    return round(1000 * x / n, 2) if n else None


def _olay_gunleri(r, nr, en_az):
    """r: bölge basınında türün günlük sayısı, nr: bölge basınının günlük başlık sayısı. Döndürür: [(baş, son, tepe)]."""
    oran = [1000 * a / b if b >= 50 else None for a, b in zip(r, nr)]
    isaret = []
    for i, x in enumerate(oran):
        if x is None or r[i] < en_az:
            continue
        onceki = [v for v in oran[max(0, i - TABAN_GUN):i] if v is not None]
        taban = statistics.median(onceki) if len(onceki) >= 7 else 0
        if x >= ESIK_KAT * taban + 0.3:
            isaret.append(i)
    olaylar = []
    for i in isaret:
        if olaylar and i - olaylar[-1][1] <= 2:
            b, _, t = olaylar[-1]
            olaylar[-1] = (b, i, i if r[i] > r[t] else t)
        else:
            olaylar.append((i, i, i))
    return olaylar


def _izleme(olaylar, anahtar):
    kume = {}
    for x in olaylar:
        kume.setdefault(anahtar(x), []).append(x)
    cikti = []
    for c in sorted(kume):
        xs = kume[c]
        rs, rt = sum(x["bolge_pencere"][0] for x in xs), sum(x["bolge_pencere"][1] for x in xs)
        s = {"donem": c, "olay": len(xs), "bolge_binde": _binde(rs, rt)}
        for g in GK:
            gs, gt = sum(x["sayi"][g] for x in xs), sum(x["pencere_baslik"][g] for x in xs)
            s[g] = round((gs / gt) / (rs / rt), 2) if gt >= 600 and rs else None
            s[g + "_sayi"] = gs
        cikti.append(s)
    return cikti


def _pencere(i, j, N):
    return range(max(0, i - PENCERE_ONCE), min(N, j + PENCERE_SONRA + 1))


def _ornekler(oz, D, K, gk, b, e, tur, en_cok=4):
    sec, gor = [], set()
    for i in sorted(range(b, e + 1), key=lambda i: 0 if i == b else 1):
        for o in (oz.get("olay_ornek", {}).get(D[i], {}).get(tur) or []):
            if o[0] in gor or str(o[0]) not in K:
                continue
            gor.add(o[0])
            sec.append({"yayin": K[str(o[0])]["ad"], "grup": gk.get(str(o[0])), "baslik": o[1], "url": o[2], "gun": D[i]})
    # önce farklı gruplardan birer örnek
    sirali, gruplar = [], set()
    for o in sec:
        if o["grup"] not in gruplar:
            sirali.append(o)
            gruplar.add(o["grup"])
    sirali += [o for o in sec if o not in sirali]
    return sirali[:en_cok]


def _yer(oz, D, b, e, tur):
    say = {}
    for i in range(b, e + 1):
        for y, n in ((oz.get("olay_yer", {}).get(D[i], {}).get(tur)) or {}).items():
            say[y] = say.get(y, 0) + n
    return [y for y, _ in sorted(say.items(), key=lambda x: -x[1])[:2]]


def _lider_grup_gunluk(S, N):
    """Lider grubu (Türkiye, ABD, ...) için günlük adı geçen başlık sayısı (bütün basın)."""
    lg = {g: [0] * N for g in OT.LIDER_GRUP}
    grubu = {a: gr for a, _, gr, _ in OT.LIDERLER}
    for a, seri in S["l"].items():
        gr = grubu.get(a)
        if not gr:
            continue
        for g in GK:
            for i, x in enumerate(seri[g]):
                lg[gr][i] += x
    return lg


def _artis(seri, i, j, N):
    """Pencere içindeki günlük ortalamanın önceki 28 günün ortalamasına oranı (1 = değişim yok)."""
    w = list(_pencere(i, j, N))
    once = seri[max(0, i - TABAN_GUN):max(0, i - PENCERE_ONCE)]
    if len(once) < 7:
        return None, None
    taban = sum(once) / len(once)
    icinde = sum(seri[k] for k in w) / len(w)
    return (round(icinde / taban, 2) if taban >= 0.5 else None), round(icinde, 1)


def hesapla(kok, kaynaklar, simdi, log=print):
    oz = _oz(kok)
    if not oz:
        return None
    dis = dis_veri.guncelle(kok, log) or {"gun": {}}
    # özet ve dış veri değişmediyse yeniden hesaplama (toplayıcı 15 dakikada bir çalışır, özet saatte bir yenilenir)
    eski = almanak._oku(os.path.join(kok, "data", "bulten", "alisma.json"), {})
    if (eski.get("surum") == ALISMA_SURUM and eski.get("ozet_guncellendi") == oz.get("guncellendi")
            and (eski.get("dis") or {}).get("indirildi") == dis.get("indirildi")
            and os.path.exists(os.path.join(kok, "data", "bulten", "liderler.json"))):
        return eski
    K = {str(k["id"]): k for k in kaynaklar}
    gk = {kid: grup(k) for kid, k in K.items()}
    t = _topla(oz, gk)
    if not t:
        return None
    D, S = t
    N = len(D)
    olu = [0] * N
    for i, g in enumerate(D):
        olu[i] = (dis.get("gun", {}).get(g) or {}).get("olu", 0)
    nreg = [S["n"]["bolge"][i] + S["n"]["turkiye"][i] for i in range(N)]
    lg = _lider_grup_gunluk(S, N)
    hafta_ix = {}
    for i, g in enumerate(D):
        hafta_ix.setdefault(_hafta(g), []).append(i)
    haftalar = sorted(hafta_ix)

    turler, tum_olaylar = [], []
    for tur, ad in TURLER:
        o = S["o"][tur]
        r = [o["bolge"][i] + o["turkiye"][i] for i in range(N)]
        toplam = {g: sum(o[g]) for g in GK}
        haftalik = {g: [_binde(sum(o[g][i] for i in hafta_ix[h]), sum(S["n"][g][i] for i in hafta_ix[h]))
                        if sum(S["n"][g][i] for i in hafta_ix[h]) >= 40 else None for h in haftalar] for g in GK}
        kayit = {"anahtar": tur, "ad": ad, "toplam": toplam, "haftalik": haftalik, "durum": tur in DURUM}
        if tur in DURUM or sum(r) < 30:
            turler.append(kayit)
            continue
        sifir_olmayan = sorted(x for x in r if x)
        en_az = max(5, sifir_olmayan[len(sifir_olmayan) // 2] * 2) if sifir_olmayan else 5
        olaylar = []
        for b, e, p in _olay_gunleri(r, nreg, en_az):
            w = _pencere(b, e, N)
            tep, sayi, tops = {}, {}, {}
            for g in GK:
                tot = sum(S["n"][g][i] for i in w)
                sayi[g], tops[g] = sum(o[g][i] for i in w), tot
                tep[g] = _binde(sayi[g], tot) if tot >= 300 else None   # az başlıklı pencerede ölçüm yok
            bolge_tum = _binde(sum(r[i] for i in w), sum(nreg[i] for i in w))
            yer = _yer(oz, D, b, e, tur)
            olaylar.append({"tur": tur, "bas": D[b], "son": D[e], "tepe": D[p], "yer": yer, "bolge_sayi": sum(r[i] for i in range(b, e + 1)),
                            "bolge_binde": bolge_tum, "tepki": tep, "sayi": sayi, "pencere_baslik": tops,
                            "bolge_pencere": [sum(r[i] for i in w), sum(nreg[i] for i in w)],
                            "izleme": round(tep["bati_ana"] / bolge_tum, 2) if tep.get("bati_ana") is not None and bolge_tum else None,
                            "olu": max(olu[i] for i in range(max(0, b - 1), min(N, e + 2))),
                            "lider": {lgk: _artis(lg[lgk], b, e, N)[0] for lgk in OT.LIDER_GRUP},
                            "ornek": _ornekler(oz, D, K, gk, b, e, tur)})
        # referans: bölge basınında en büyük olayın en az %40'ı kadar yer bulan ilk olay
        ref = None
        if olaylar:
            enb = max(x["bolge_sayi"] for x in olaylar)
            ref = next(x for x in olaylar if x["bolge_sayi"] >= 0.4 * enb)
            for x in olaylar:
                x["endeks"] = {g: (round(100 * x["tepki"][g] / ref["tepki"][g]) if x["tepki"].get(g) is not None and ref["tepki"].get(g) else None)
                               for g in GK}
        son = {}
        for g in GK:
            sonraki = [x for x in olaylar if ref and x["bas"] >= ref["bas"]]
            tetik = [x for x in sonraki if (x["endeks"].get(g) or 0) >= 50 and x["sayi"][g] >= 3]
            if not tetik:
                continue
            st = tetik[-1]
            sonra = [x for x in sonraki if x["bas"] > st["bas"]]
            buyuk = [x for x in sonra if x["bolge_sayi"] >= 0.5 * ref["bolge_sayi"]]
            son[g] = {"gun": st["tepe"], "yer": st["yer"], "endeks": st["endeks"][g], "sonraki_olay": len(sonra),
                      "sonraki_buyuk_olay": len(buyuk),
                      "sonraki_ortanca_endeks": statistics.median([x["endeks"][g] for x in sonra if x["endeks"].get(g) is not None])
                      if any(x["endeks"].get(g) is not None for x in sonra) else None}
        kayit.update({"olay_sayisi": len(olaylar), "referans": ref and {"gun": ref["tepe"], "yer": ref["yer"]}, "son_tepki": son,
                      "yariyil": _izleme(olaylar, lambda x: x["bas"][:4] + ("-1" if x["bas"][5:7] <= "06" else "-2"))})
        turler.append(kayit)
        tum_olaylar += olaylar
    tum_olaylar.sort(key=lambda x: x["bas"])

    # alışma eğrisi: çeyrek çeyrek, bütün olayların penceresi birlikte. Bir grubun izleme oranı = grubun olay
    # pencerelerindeki türden başlık payı / bölge basınının aynı pencerelerdeki payı (1 = bölge basını kadar)
    egri = _izleme(tum_olaylar, lambda x: f"{x['bas'][:4]}-Ç{(int(x['bas'][5:7]) - 1) // 3 + 1}")
    # kitlesel ölüm günleri: Sağlık Bakanlığı'nın o gün açıkladığı yeni ölüm sayısı 300 ve üstü
    olum_gunleri = []
    for i, x in enumerate(olu):
        if x < 300 or D[i] < "2023-10-14":   # ilk hafta: 7 Ekim'in kendisi ölçümü bozar
            continue
        w = list(_pencere(i, i, N))
        s = {"gun": D[i], "olu": x}
        for g in GK:
            tot = sum(S["n"][g][k] for k in w)
            once = list(range(max(0, i - 14), max(0, i - 1)))
            tot0 = sum(S["n"][g][k] for k in once)
            s[g] = {"gazze_pay": round(100 * sum(S["g"][g][k] for k in w) / tot, 1) if tot >= 60 else None,
                    "once": round(100 * sum(S["g"][g][k] for k in once) / tot0, 1) if tot0 >= 200 else None}
        s["lider"] = {lgk: _artis(lg[lgk], i, i, N)[0] for lgk in OT.LIDER_GRUP}
        olum_gunleri.append(s)

    gunluk_olu_hafta = [sum(olu[i] for i in hafta_ix[h]) for h in haftalar]
    veri = {"surum": ALISMA_SURUM, "guncellendi": simdi.isoformat(), "ozet_guncellendi": oz.get("guncellendi"),
            "tarama_bitti": oz.get("tarama_bitti"), "bas": D[0], "son": D[-1], "gruplar": [{"anahtar": g, "ad": a} for g, a in GRUPLAR],
            "lider_gruplari": OT.LIDER_GRUP, "haftalar": haftalar, "olu_hafta": gunluk_olu_hafta,
            "esik": {"kat": ESIK_KAT, "pencere": [PENCERE_ONCE, PENCERE_SONRA], "taban_gun": TABAN_GUN},
            "turler": turler, "olaylar": tum_olaylar, "egri": egri, "olum_gunleri": olum_gunleri,
            "dis": {"kaynak": dis.get("kaynak"), "indirildi": dis.get("indirildi")}}
    almanak._yaz(os.path.join(kok, "data", "bulten", "alisma.json"), veri)
    log(f"Alışma: {len(tum_olaylar)} olay, {len(olum_gunleri)} kitlesel ölüm günü")
    liderler(kok, oz, K, gk, D, S, olu, lg, tum_olaylar, simdi, log)
    return veri


def liderler(kok, oz, K, gk, D, S, olu, lg, olaylar, simdi, log=print):
    N = len(D)
    ay_ix = {}
    for i, g in enumerate(D):
        ay_ix.setdefault(g[:7], []).append(i)
    aylar = sorted(ay_ix)
    hafta_ix = {}
    for i, g in enumerate(D):
        hafta_ix.setdefault(_hafta(g), []).append(i)
    haftalar = sorted(hafta_ix)
    kel = [a for a, _, _ in OT.LIDER_KELIME]
    cikti = []
    for a, ad, lgr, _ in OT.LIDERLER:
        seri = S["l"].get(a)
        if not seri:
            continue
        tum = [sum(seri[g][i] for g in GK) for i in range(N)]
        toplam = sum(tum)
        if toplam < 20:
            continue
        kelime = {k: sum(S["lk"].get((a, k), [0])) for k in kel}
        x = {"anahtar": a, "ad": ad, "grup": lgr, "toplam": toplam,
             "gruba_gore": {g: sum(seri[g]) for g in GK},
             "aylik": [sum(tum[i] for i in ay_ix[m]) for m in aylar],
             "aylik_kelime": {k: [sum(S["lk"].get((a, k), [0] * N)[i] for i in ay_ix[m]) for m in aylar] for k in kel if kelime[k]},
             "kelime": kelime,
             "ornek": {m: [{"yayin": K[str(o[0])]["ad"], "baslik": o[1], "url": o[2], "gun": o[3]}
                           for o in (oz.get("lider_ornek", {}).get(m, {}).get(a) or []) if str(o[0]) in K][:3]
                       for m in aylar if (oz.get("lider_ornek", {}).get(m, {}).get(a))}}
        if a in ("erdogan", "fidan"):
            x["haftalik_tr"] = {"toplam": [sum(seri["turkiye"][i] for i in hafta_ix[h]) for h in haftalar],
                                **{k: [sum(S["ltr"].get((a, k), [0] * N)[i] for i in hafta_ix[h]) for h in haftalar] for k in kel}}
        cikti.append(x)
    cikti.sort(key=lambda x: -x["toplam"])
    # tetikleyiciler: lider grubunun adının olay pencerelerinde ortalama kaç kat arttığı, türe göre
    tetik = {}
    for x in olaylar:
        for lgk, v in x["lider"].items():
            if v is not None:
                tetik.setdefault(lgk, {}).setdefault(x["tur"], []).append(v)
    tetikleyici = {lgk: sorted([{"tur": t, "ad": OT.AD.get(t, t), "olay": len(v), "ortanca_artis": round(statistics.median(v), 2)}
                                for t, v in d.items() if len(v) >= 3], key=lambda y: -y["ortanca_artis"])
                   for lgk, d in tetik.items()}
    grup_aylik = {lgk: [sum(lg[lgk][i] for i in ay_ix[m]) for m in aylar] for lgk in OT.LIDER_GRUP}
    veri = {"guncellendi": simdi.isoformat(), "aylar": aylar, "haftalar": haftalar,
            "kelimeler": [{"anahtar": a, "ad": ad} for a, ad, _ in OT.LIDER_KELIME],
            "lider_gruplari": OT.LIDER_GRUP, "grup_aylik": grup_aylik, "liderler": cikti, "tetikleyici": tetikleyici,
            "tr_olaylar": [{"gun": g, "ad": ad} for g, ad in TR_OLAYLAR],
            "olu_ay": [sum(olu[i] for i in ay_ix[m]) for m in aylar]}
    almanak._yaz(os.path.join(kok, "data", "bulten", "liderler.json"), veri)
    log(f"Liderler: {len(cikti)} kişi")
    return veri
