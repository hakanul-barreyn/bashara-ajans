"""Almanak: olay arşivi ve haftalık / aylık / yıllık bültenler.

1) olay_arsivle(): Saatlik olay kümeleri yalnızca son iki günü tutar. Her çalıştırmada kümeleri,
   her haberin yayınını, bakış etiketini, konu etiketlerini ve çerçeve notunu günlük dosyalara yazar:
   data/olay-arsiv/YYYY-AA-GG.json. Küme kimliği haberler eklendikçe değiştiği için, haberlerinin
   yarısı ortak olan kümeler aynı olay sayılır ve güncellenir.

2) bultenleri_guncelle(): Biten dönemler için kesin bülten, süren hafta / ay / yıl için günde bir
   yenilenen taslak üretir. Sayılar Python'da hesaplanır (kim neyi yazdı, kim neyi görmedi, kimin dili
   Filistin bakışından ne kadar uzak); yapay zekâ yalnızca bu sayılara bakıp yorum metnini yazar.
   Çıktı: data/bulten/<tur>/<anahtar>.json ve .md, dizin: data/bulten/dizin.json
"""
import datetime as dt
import json
import os
import re

import ekler
import disa_aktar

KAMP = {"Filistin": "Filistin", "Meşrik": "Arap dünyası", "Körfez": "Arap dünyası", "Mısır": "Arap dünyası",
        "Mağrip": "Arap dünyası", "İran": "İran ve Yemen", "Yemen": "İran ve Yemen", "Anadolu-Türkiye": "Türkiye",
        "İsrail": "İsrail", "ABD": "Batı", "İngiltere": "Batı", "İspanya": "Batı", "İtalya": "Batı",
        "Almanya": "Batı", "Fransa": "Batı"}
KAMP_SIRA = ["Filistin", "Arap dünyası", "Türkiye", "İran ve Yemen", "Batı", "İsrail", "İsrail’de muhalif basın", "Diğer"]
BOLGE_ICI = {"Filistin", "Arap dünyası", "İran ve Yemen", "Türkiye"}   # bölgenin kendi basını
DIS = {"Batı", "İsrail"}                                               # İsrail ve Batı basını
UZAK = {"filistin": 0, "aktarim": 1, "israil": 2}
CIZGI = {"ad": "Antiemperyalist / dekolonyal", "ara": "Ara / ana akım", "ik": "İşbirlikçi kompradorlar ve emperyalistler"}
# Dil sayacı: kim hangi kelimeyi kullanıyor? Kalıplar 9 dilde, küçük harfe çevrilmiş özgün başlıkta aranır.
# "yan": kelimenin hangi anlatıya ait olduğu (renk için); "operasyon" gibi kelimeler bazen direniş eylemi için de kullanılır.
TERIMLER = [
    ("soykirim", "soykırım", "filistin", r"soykırım|genocid|génocid|genocidi|völkermord|genozid|إباد|רצח עם|ג'נוסייד"),
    ("etnik", "etnik temizlik", "filistin", r"etnik temizl|ethnic cleansing|nettoyage ethnique|limpieza étnica|pulizia etnica|ethnische säuberung|تطهير عرقي|טיהור אתני"),
    ("katliam", "katliam", "filistin", r"katliam|massacr|masacre|massaker|slaughter|strage|مجزر|טבח"),
    ("isgal", "işgal", "filistin", r"işgal|occupation|occupied|occupé|ocupaci|occupazion|besatzung|احتلال|כיבוש"),
    ("sehit", "şehit", "filistin", r"şehit|martyr|mártir|martire|märtyrer|شهيد|شهداء|שהיד"),
    ("apartheid", "apartheid", "filistin", r"apartheid|أبارتهايد|فصل عنصري|אפרטהייד"),
    ("teror", "terör / terörist", "israil", r"terör|terror|إرهاب|ارهاب|טרור|מחבל"),
    ("catisma", "çatışma", "israil", r"çatışma|conflict|clash|conflit|affrontement|conflicto|enfrentamient|conflitto|scontri|konflikt|עימות|סכסוך"),
    ("operasyon", "operasyon", "israil", r"operasyon|operation|opération|operación|operazione|מבצע"),
    ("misilleme", "misilleme", "israil", r"misilleme|retaliat|représaille|riposte|represalia|rappresaglia|vergeltung|תגמול"),
    ("kalkan", "insan kalkanı", "israil", r"insan kalkan|human shield|bouclier humain|escudo humano|scudo umano|schutzschild|دروع بشرية|מגן אנושי"),
    # karşıt çiftler (Kasım 2026): saldırı ↔ savaş, direniş ↔ militan, esir ↔ rehine, kurbanın adı, yumuşatıcı adlar
    ("saldiri", "saldırı / bombardıman", "filistin", r"saldır|bombard|bombal|air ?strike|\bstrikes?\b|bombing|frappe|ataque|bombardeo|attacc|luftangriff|angriff|غارة|غارات|قصف|תקיפ|הפצצ"),
    ("savas", "savaş", "israil", r"savaş|\bwar\b|guerre|guerra|\bkrieg|حرب|מלחמ"),
    ("direnis", "direniş", "filistin", r"direniş|resistance|résistance|resistencia|resistenza|widerstand|مقاوم"),
    ("militan", "militan", "israil", r"militan|milicien|miliciano|milizian|kämpfer|مسلح"),
    ("esir", "esir / tutuklu", "filistin", r"\besir|tutuklu|prisoner|detainee|prisonnier|détenu|preso|detenid|prigionier|detenut|gefangene|häftling|أسير|أسرى|معتقل|אסיר|עציר"),
    ("rehine", "rehine", "israil", r"rehine|hostage|otage|rehén|ostagg|geisel|رهينة|رهائن|חטוף|חטופ|בן ערובה|בני ערובה"),
    ("cocuk", "çocuk", "filistin", r"çocuk|\bchild|children|\bkids?\b|enfant|niño|niña|menores|bambin|\bkinder|أطفال|طفل|ילד"),
    ("sivil", "sivil", "filistin", r"sivil|civilian|\bcivils?\b|civile|zivil|مدني|אזרח"),
    ("aclik", "açlık / kıtlık", "filistin", r"açlık|kıtlık|famine|starv|\bhunger|hambruna|hambre|carestia|\bfame\b|تجويع|مجاعة|רעב"),
    ("yerlesimci", "yerleşimci / sömürgeci", "filistin", r"yerleşimci|settler|\bcolons?\b|colono|coloni\b|siedler|مستوطن|מתנחל"),
    ("insani", "“insani kriz”", "israil", r"insani kriz|humanitarian crisis|crise humanitaire|crisis humanitaria|crisi umanitaria|humanitäre krise|أزمة إنسانية|משבר הומניטרי"),
    ("etkisiz", "etkisiz hale getirme", "israil", r"etkisiz hale|eliminat|neutraliz|neutralis|abatid|eliminier|neutralisier|تحييد|חוסל|חיסל|חוסלו"),
]
TERIM_RE = [(a, l, y, re.compile(k, re.I)) for a, l, y, k in TERIMLER]


def _zaman(s):
    try:
        return dt.datetime.fromisoformat(s)
    except Exception:
        return None


AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def kamp(k):
    return (k or {}).get("kamp") or KAMP.get((k or {}).get("bolge"), "Diğer")


def _oku(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def _yaz(yol, veri, sik=True):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":") if sik else None, indent=None if sik else 1)


# ------------------------------------------------------------------ 1) olay arşivi
def olay_arsivle(kok, olaylar, haberler):
    """Güncel olay kümelerini günlük olay arşivine işler. Döndürür: güncellenen olay sayısı."""
    klasor = os.path.join(kok, "data", "olay-arsiv")
    os.makedirs(klasor, exist_ok=True)
    gunluk = {}
    n = 0
    for o in olaylar:
        hs = []
        for i in o.get("haberler", []):
            h = haberler.get(i)
            if not h:
                continue
            hs.append({"id": i, "k": h.get("kaynak"), "b": (o.get("bakislar") or {}).get(i), "e": h.get("etiket") or [], "ky": h.get("kayip"),
                       "t": h.get("tarih"), "bt": h.get("baslik_tr") or "", "bo": (h.get("baslik_orj") or "")[:160],
                       "u": h.get("url"), "y": (o.get("yorumlar") or {}).get(i, ""), "ye": (o.get("yorumlar_en") or {}).get(i, ""),
                       "an": (o.get("anlatim") or {}).get(i)})
        if len(hs) < 2:
            continue
        ilk = min(x["t"] for x in hs if x["t"])
        gun = ilk[:10]
        kayit = {"id": o["id"], "baslik": o.get("baslik", ""), "not": o.get("not", ""), "ilk": ilk, "yer": o.get("yer"), "yerler": o.get("yerler") or [],
                 "ortak": o.get("ortak"), "fark": o.get("fark"), "baslik_en": o.get("baslik_en"), "not_en": o.get("not_en"),
                 "olgular": o.get("olgular") or [], "golgeleme": o.get("golgeleme") or [],
                 "son": max(x["t"] for x in hs if x["t"]), "haberler": hs}
        # Önceki gün dosyasında da aynı olay olabilir (gece yarısını aşan olaylar)
        onceki = (dt.date.fromisoformat(gun) - dt.timedelta(days=1)).isoformat()
        yer = None
        for g in (gun, onceki):
            if g not in gunluk:
                gunluk[g] = _oku(os.path.join(klasor, g + ".json"), [])
            yeni_ids = {x["id"] for x in hs}
            for j, e in enumerate(gunluk[g]):
                eski_ids = {x["id"] for x in e["haberler"]}
                if e["id"] == o["id"] or ayni_olay(e["baslik"], eski_ids, kayit["baslik"], yeni_ids):
                    yer = (g, j)
                    break
            if yer:
                break
        if yer:
            g, j = yer
            eski = gunluk[g][j]
            birlesik = {x["id"]: x for x in eski["haberler"]}
            for x in hs:
                birlesik[x["id"]] = {**birlesik.get(x["id"], {}), **{a: b for a, b in x.items() if b not in (None, "", [])}}
            kayit["haberler"] = sorted(birlesik.values(), key=lambda x: x.get("t") or "")
            kayit["ilk"] = min(kayit["ilk"], eski.get("ilk") or kayit["ilk"])
            kayit["yer"] = kayit.get("yer") or eski.get("yer")
            gunluk[g][j] = kayit
        else:
            gunluk[gun].append(kayit)
        n += 1
    for g, liste in gunluk.items():
        if liste:
            _yaz(os.path.join(klasor, g + ".json"), sorted(birlestir(liste), key=lambda x: x["ilk"]))
    return n


def _kokler(baslik):
    """Başlığın kelime kökleri (ilk 5 harf; kesme işaretinden sonrası atılır): 'Eisenkot'un' ve 'Eisenkot'u' aynı."""
    s = re.sub(r"[’'][^\s]*", "", (baslik or "").replace("İ", "i").replace("I", "ı").lower())
    return {w[:5] for w in re.findall(r"\w{4,}", s)}


def ayni_olay(b1, ids1, b2, ids2):
    """İki küme aynı olay mı? Haberlerin yarısı ortaksa; ya da en az iki haber ortak ve başlıklar benziyorsa."""
    ortak = len(ids1 & ids2)
    if ortak >= 0.5 * min(len(ids1), len(ids2)):
        return True
    k1, k2 = _kokler(b1), _kokler(b2)
    benzer = len(k1 & k2) / len(k1 | k2) if k1 and k2 else 0
    return ortak >= 2 and benzer >= 0.3 or ortak >= 1 and benzer >= 0.5


def birlestir(liste):
    """Aynı gün dosyasında iki ayrı kayıt olarak kalmış aynı olayları tek kayıtta topla (büyük olanın metni kalır)."""
    liste = sorted(liste, key=lambda e: -len(e["haberler"]))
    sonuc = []
    for e in liste:
        ids = {x["id"] for x in e["haberler"]}
        hedef = next((s for s in sonuc if ayni_olay(s["baslik"], {x["id"] for x in s["haberler"]}, e["baslik"], ids)), None)
        if not hedef:
            sonuc.append(e)
            continue
        birlesik = {x["id"]: x for x in e["haberler"]}
        birlesik.update({x["id"]: x for x in hedef["haberler"]})
        hedef["haberler"] = sorted(birlesik.values(), key=lambda x: x.get("t") or "")
        hedef["ilk"] = min(hedef["ilk"], e["ilk"])
        hedef["son"] = max(hedef.get("son") or "", e.get("son") or "")
        hedef.setdefault("eski_idler", []).append(e["id"])
    return sonuc


# ------------------------------------------------------------------ dönemler
def donem(tur, anahtar):
    """(başlangıç tarihi, bitiş tarihi [hariç], okunur ad)"""
    if tur == "haftalik":
        y, w = map(int, re.fullmatch(r"(\d{4})-W(\d{2})", anahtar).groups())
        bas = dt.date.fromisocalendar(y, w, 1)
        bit = bas + dt.timedelta(days=7)
        son = bit - dt.timedelta(days=1)
        if bas.month == son.month:
            ad = f"{w}. hafta · {bas.day}–{son.day} {AYLAR[son.month - 1]} {son.year}"
        else:
            ad = f"{w}. hafta · {bas.day} {AYLAR[bas.month - 1]} – {son.day} {AYLAR[son.month - 1]} {son.year}"
        return bas, bit, ad
    if tur == "aylik":
        y, m = map(int, anahtar.split("-"))
        bas = dt.date(y, m, 1)
        bit = dt.date(y + (m == 12), m % 12 + 1, 1)
        return bas, bit, f"{AYLAR[m - 1]} {y}"
    y = int(anahtar)
    return dt.date(y, 1, 1), dt.date(y + 1, 1, 1), f"{y} yılı"


def anahtar_bul(tur, gun):
    if tur == "haftalik":
        y, w, _ = gun.isocalendar()
        return f"{y}-W{w:02d}"
    if tur == "aylik":
        return f"{gun.year}-{gun.month:02d}"
    return str(gun.year)


# ------------------------------------------------------------------ 2) istatistik
def _gunler(bas, bit):
    g = bas
    while g < bit:
        yield g.isoformat()
        g += dt.timedelta(days=1)


def istatistik(kok, bas, bit, kaynaklar):
    K = {k["id"]: k for k in kaynaklar}
    haberler, olaylar = [], []
    for g in _gunler(bas, bit):
        haberler += _oku(os.path.join(kok, "data", "arsiv", g + ".json"), [])
        olaylar += _oku(os.path.join(kok, "data", "olay-arsiv", g + ".json"), [])
    if not haberler and not olaylar:
        return None

    # Haber hacmi ve konu dağılımı (özeti yazılan bütün haberler)
    hacim = {}
    konu = {}
    for h in haberler:
        c = kamp(K.get(h.get("kaynak")))
        hacim[c] = hacim.get(c, 0) + 1
        for e in h.get("etiket") or []:
            konu.setdefault(e, {}).setdefault(c, 0)
            konu[e][c] += 1
    ic_top = sum(hacim.get(c, 0) for c in BOLGE_ICI) or 1
    dis_top = sum(hacim.get(c, 0) for c in DIS) or 1
    konular = []
    for e, d in konu.items():
        ic = sum(d.get(c, 0) for c in BOLGE_ICI)
        ds = sum(d.get(c, 0) for c in DIS)
        if ic + ds < 8:
            continue
        ic_pay, dis_pay = ic / ic_top, ds / dis_top
        konular.append({"konu": e, "bolge_ici": ic, "israil_bati": ds, "bolge_ici_pay": round(100 * ic_pay, 1),
                        "israil_bati_pay": round(100 * dis_pay, 1),
                        "oran": round(dis_pay / ic_pay, 2) if ic_pay else None})
    konular.sort(key=lambda x: (x["oran"] if x["oran"] is not None else 99))

    # Olaylar: kim yazdı, kim görmedi, kimin dili ne kadar uzak
    olay_ozet, gormeyen_dis, gormeyen_ic = [], [], []
    kamp_b, cizgi_b, yayin_b, konu_b = {}, {}, {}, {}

    def ekle(d, a, v):
        r = d.setdefault(a, {"filistin": 0, "aktarim": 0, "israil": 0, "n": 0})
        r[v] += 1
        r["n"] += 1

    for o in olaylar:
        yayinlar = {}
        for x in o["haberler"]:
            k = K.get(x.get("k"))
            if not k:
                continue
            yayinlar[k["id"]] = k
            v = x.get("b")
            if v in UZAK:
                ekle(kamp_b, kamp(k), v)
                ekle(cizgi_b, CIZGI.get(k.get("cizgi"), CIZGI["ara"]), v)
                ekle(yayin_b, k["ad"], v)
                for e in x.get("e") or []:
                    ekle(konu_b.setdefault(e, {}), "dis" if kamp(k) in DIS else "ic" if kamp(k) in BOLGE_ICI else "diger", v)
        kamplar = {}
        for k in yayinlar.values():
            kamplar[kamp(k)] = kamplar.get(kamp(k), 0) + 1
        ic = sum(kamplar.get(c, 0) for c in BOLGE_ICI)
        ds = sum(kamplar.get(c, 0) for c in DIS)
        oz = {"baslik": o["baslik"], "tarih": o["ilk"][:10], "kaynak": len(yayinlar), "kamplar": kamplar}
        olay_ozet.append((o, oz))
        if ic >= 3 and ds == 0:
            gormeyen_dis.append(oz)
        if ds >= 2 and ic == 0:
            gormeyen_ic.append(oz)
    gormeyen_dis.sort(key=lambda x: -x["kaynak"])
    gormeyen_ic.sort(key=lambda x: -x["kaynak"])

    def uzaklik(r):
        return round((r["aktarim"] + 2 * r["israil"]) / r["n"], 2) if r["n"] else None

    def tablo(d, en_az=1):
        return [{"ad": a, "n": r["n"], "uzaklik": uzaklik(r), "filistin": r["filistin"], "aktarim": r["aktarim"],
                 "israil": r["israil"]} for a, r in d.items() if r["n"] >= en_az]

    kamp_t = sorted(tablo(kamp_b), key=lambda x: KAMP_SIRA.index(x["ad"]) if x["ad"] in KAMP_SIRA else 99)
    yayin_t = sorted(tablo(yayin_b, 4), key=lambda x: x["uzaklik"])
    konu_bakis = []
    for e, d in konu_b.items():
        i, s = d.get("ic"), d.get("dis")
        if i and s and i["n"] >= 3 and s["n"] >= 3:
            konu_bakis.append({"konu": e, "bolge_ici_uzaklik": uzaklik(i), "israil_bati_uzaklik": uzaklik(s),
                               "bolge_ici_n": i["n"], "israil_bati_n": s["n"], "fark": round(uzaklik(s) - uzaklik(i), 2)})
    konu_bakis.sort(key=lambda x: -x["fark"])

    # En çok yazılan olaylar ve iki taraftan çerçeve örnekleri (yorum için malzeme)
    olay_ozet.sort(key=lambda p: -p[1]["kaynak"])
    buyuk = []
    for o, oz in olay_ozet[:12]:
        ornek = {"bolge_ici": [], "israil_bati": []}
        for x in o["haberler"]:
            k = K.get(x.get("k"))
            if not k or not (x.get("y") or x.get("bo")):
                continue
            yer = "israil_bati" if kamp(k) in DIS else "bolge_ici" if kamp(k) in BOLGE_ICI else None
            if yer and len(ornek[yer]) < 4:
                ornek[yer].append({"yayin": k["ad"], "bakis": x.get("b"), "baslik": x.get("bo") or x.get("bt"), "cerceve": x.get("y")})
        buyuk.append({**oz, "not": o.get("not", "")[:500], "ornekler": ornek})

    # ---- kanıt kodları: metindeki her olay iddiası tıklanabilir olsun
    kodlar, kod_of = {}, {}

    def kodla(o):
        if o["id"] in kod_of:
            return kod_of[o["id"]]
        kod = f"E{len(kodlar) + 1}"
        kod_of[o["id"]] = kod
        hs = []
        for x in o["haberler"]:
            k = K.get(x.get("k"))
            if k and len(hs) < 12:
                hs.append({"yayin": k["ad"], "kamp": kamp(k), "baslik": x.get("bo") or x.get("bt"), "tr": x.get("bt"),
                           "url": x.get("u"), "bakis": x.get("b"), "saat": (x.get("t") or "")[:16]})
        kodlar[kod] = {"baslik": o["baslik"], "tarih": o["ilk"][:10], "yer": (o.get("yer") or {}).get("ad"), "haberler": hs}
        return kod

    olay_by = {o["baslik"] + o["ilk"][:10]: o for o in olaylar}
    for liste in (gormeyen_dis, gormeyen_ic, buyuk):
        for oz in liste:
            o = olay_by.get(oz["baslik"] + oz["tarih"])
            if o:
                oz["kod"] = kodla(o)

    # ---- gecikme: aynı olayı bölge basını ile İsrail ve Batı basını ne zaman yazdı?
    gecikmeler = []
    for o in olaylar:
        ic_t, ds_t = [], []
        for x in o["haberler"]:
            k, t = K.get(x.get("k")), _zaman(x.get("t") or "")
            if not k or not t:
                continue
            (ds_t if kamp(k) in DIS else ic_t if kamp(k) in BOLGE_ICI else []).append(t)
        if ic_t and ds_t:
            fark = (min(ds_t) - min(ic_t)).total_seconds() / 3600
            gecikmeler.append({"kod": kodla(o), "baslik": o["baslik"], "tarih": o["ilk"][:10], "saat": round(fark, 1)})
    gecikmeler.sort(key=lambda x: -x["saat"])
    sirali = sorted(x["saat"] for x in gecikmeler)
    medyan = (sirali[len(sirali) // 2] if len(sirali) % 2 else (sirali[len(sirali) // 2 - 1] + sirali[len(sirali) // 2]) / 2) if sirali else None
    gecikme = {"olay": len(gecikmeler), "medyan_saat": round(medyan, 1) if medyan is not None else None,
               "bolge_once": sum(1 for x in gecikmeler if x["saat"] > 0.25), "bati_once": sum(1 for x in gecikmeler if x["saat"] < -0.25),
               "en_gec": [x for x in gecikmeler if x["saat"] > 0][:8]}

    # ---- dil sayacı: özgün başlıklarda kelime sıklığı (1000 başlıkta)
    basliklar = {}
    for h in haberler:
        if h.get("baslik_orj"):
            basliklar[h["id"]] = (h.get("kaynak"), h["baslik_orj"])
    for o in olaylar:
        for x in o["haberler"]:
            if x.get("bo") and x["id"] not in basliklar:
                basliklar[x["id"]] = (x.get("k"), x["bo"])
    say = {"ic": 0, "dis": 0}
    terim = {a: {"ic": 0, "dis": 0, "ornek_ic": [], "ornek_dis": []} for a, _, _, _ in TERIM_RE}
    for kid, b in basliklar.values():
        k = K.get(kid)
        if not k:
            continue
        yan = "dis" if kamp(k) in DIS else "ic" if kamp(k) in BOLGE_ICI else None
        if not yan:
            continue
        say[yan] += 1
        for a, _, _, r in TERIM_RE:
            if r.search(b):
                terim[a][yan] += 1
                if len(terim[a]["ornek_" + yan]) < 3:
                    terim[a]["ornek_" + yan].append({"yayin": k["ad"], "baslik": b[:160]})
    dil = {"baslik_ic": say["ic"], "baslik_dis": say["dis"], "terimler": []}
    for a, l, y, _ in TERIM_RE:
        t = terim[a]
        dil["terimler"].append({"anahtar": a, "ad": l, "yan": y, "ic": t["ic"], "dis": t["dis"],
                                "ic_binde": round(1000 * t["ic"] / say["ic"], 1) if say["ic"] else None,
                                "dis_binde": round(1000 * t["dis"] / say["dis"], 1) if say["dis"] else None,
                                "ornek_ic": t["ornek_ic"], "ornek_dis": t["ornek_dis"]})

    # ---- günlük seri: takvim ve eğilim
    gunluk = {}
    for g in _gunler(bas, bit):
        gunluk[g] = {"gun": g, "ic": 0, "dis": 0, "ic_gazze": 0, "dis_gazze": 0, "ic_b": [0, 0], "dis_b": [0, 0]}
    for h in haberler:
        g, k = h.get("tarih", "")[:10], K.get(h.get("kaynak"))
        if g in gunluk and k:
            yan = "dis" if kamp(k) in DIS else "ic" if kamp(k) in BOLGE_ICI else None
            if yan:
                gunluk[g][yan] += 1
                if "Gazze" in (h.get("etiket") or []):
                    gunluk[g][yan + "_gazze"] += 1
    for o in olaylar:
        for x in o["haberler"]:
            g, k, v = (x.get("t") or "")[:10], K.get(x.get("k")), x.get("b")
            if g in gunluk and k and v in UZAK:
                yan = "dis" if kamp(k) in DIS else "ic" if kamp(k) in BOLGE_ICI else None
                if yan:
                    gunluk[g][yan + "_b"][0] += UZAK[v]
                    gunluk[g][yan + "_b"][1] += 1
    gunluk_l = []
    for g in gunluk.values():
        gunluk_l.append({"gun": g["gun"], "ic": g["ic"], "dis": g["dis"], "ic_gazze": g["ic_gazze"], "dis_gazze": g["dis_gazze"],
                         "ic_uzaklik": round(g["ic_b"][0] / g["ic_b"][1], 2) if g["ic_b"][1] else None, "ic_n": g["ic_b"][1],
                         "dis_uzaklik": round(g["dis_b"][0] / g["dis_b"][1], 2) if g["dis_b"][1] else None, "dis_n": g["dis_b"][1]})

    # ---- ölü başına haber: hangi ölüm kaç haberde anıldı?
    olu = {"filistinli": 0, "israilli": 0}
    for o in olaylar:
        for t in olu:
            m = max([(x.get("ky") or {}).get(t) or 0 for x in o["haberler"]] or [0])
            olu[t] += m
    anilma = {"ic": {"filistinli": 0, "israilli": 0, "n": 0}, "dis": {"filistinli": 0, "israilli": 0, "n": 0}}
    for h in haberler:
        k = K.get(h.get("kaynak"))
        if not k:
            continue
        yan = "dis" if kamp(k) in DIS else "ic" if kamp(k) in BOLGE_ICI else None
        if not yan:
            continue
        anilma[yan]["n"] += 1
        for t in ("filistinli", "israilli"):
            if (h.get("kayip") or {}).get(t):
                anilma[yan][t] += 1
    olum = {"olu": olu, "gruplar": []}
    for yan, ad in (("ic", "Bölge basını"), ("dis", "İsrail ve Batı basını")):
        a = anilma[yan]
        fb = a["filistinli"] / olu["filistinli"] if olu["filistinli"] else None
        ib = a["israilli"] / olu["israilli"] if olu["israilli"] else None
        olum["gruplar"].append({"ad": ad, "haber": a["n"], "filistinli_haber": a["filistinli"], "israilli_haber": a["israilli"],
                                "filistinli_olu_basina": round(fb, 3) if fb is not None else None,
                                "israilli_olu_basina": round(ib, 3) if ib is not None else None,
                                "kat": round(ib / fb, 1) if fb and ib else None})

    # ---- yerler: olayların yaşandığı yerler; İsrail ve Batı basınının görmedikleri işaretli
    yerler = {}
    for o in olaylar:
        y = o.get("yer")
        if not y:
            continue
        kamplar = {kamp(K[x["k"]]) for x in o["haberler"] if K.get(x.get("k"))}
        ic = any(c in BOLGE_ICI for c in kamplar)
        ds = any(c in DIS for c in kamplar)
        r = yerler.setdefault(y["ad"], {"ad": y["ad"], "lat": y["lat"], "lon": y["lon"], "olay": 0, "gorulmeyen": 0, "kodlar": []})
        r["olay"] += 1
        if ic and not ds:
            r["gorulmeyen"] += 1
            if len(r["kodlar"]) < 6:
                r["kodlar"].append(kodla(o))

    return {
        "kodlar": kodlar, "gecikme": gecikme, "dil": dil, "gunluk": gunluk_l, "olum": olum,
        "yerler": sorted(yerler.values(), key=lambda x: -x["olay"]),
        "yayin_tum": yayin_t,
        "haber_sayisi": len(haberler), "olay_sayisi": len(olaylar),
        "gun_sayisi": len({h["tarih"][:10] for h in haberler} | {o["ilk"][:10] for o in olaylar}),
        "hacim": [{"ad": c, "n": hacim[c]} for c in KAMP_SIRA if hacim.get(c)],
        "konular": konular,
        "kamp_bakis": kamp_t,
        "cizgi_bakis": [x for c in CIZGI.values() for x in tablo(cizgi_b) if x["ad"] == c],
        "yayin_yakin": yayin_t[:8], "yayin_uzak": yayin_t[::-1][:8],
        "konu_bakis": konu_bakis[:10],
        "gormeyen_israil_bati": gormeyen_dis[:15], "gormeyen_bolge": gormeyen_ic[:10],
        "buyuk_olaylar": buyuk,
    }


# ------------------------------------------------------------------ 3) yorum metni
ANLATI = """Sen bir haber ajansının almanak editörüsün. Aşağıda {ad} dönemine ait ÖLÇÜLMÜŞ veriler var.
Bu verilere bakarak Türkçe bir bülten yaz. Kurallar:
- Yalnızca verilen veriyi kullan. Veride olmayan olay, sayı ya da alıntı uydurma. Sayıları veriden aynen al.
- Bakış ölçeğinin başlangıç noktası Filistin bakışıdır: 0 = Filistin bakışı, 1 = aktarım, 2 = İsrail / ABD bakışı. "uzaklik" bu ölçekte ortalamadır.
- "bolge_ici" Filistin, Arap, İran-Yemen ve Türkiye basını; "israil_bati" İsrail ve Batı basınıdır.
- "konular.oran" İsrail ve Batı basınının o konuya ayırdığı payın bölge basınının payına oranıdır; 1'in altı "daha az işledi" demektir.
- "gormeyen_israil_bati": bölge basınında en az üç yayının yazdığı ama İsrail ve Batı basınında hiç yer bulmayan olaylar.
- "gecikme": aynı olayı İsrail ve Batı basınının bölge basınından kaç saat sonra yazdığı (artı değer = sonra).
- "dil.terimler": kelimenin bin başlıkta kaç kez geçtiği ("ic_binde" bölge basını, "dis_binde" İsrail ve Batı basını).
- "olum": olay kümelerinde bildirilen ölü sayıları ve her grubun bu ölümleri kaç haberde andığı; "kat" İsrailli ölü başına haberin Filistinli ölü başına habere oranıdır.
- "onceki": bir önceki dönemin aynı ölçüleri; değişimi belirt.
- Bir olaydan söz ettiğinde cümlenin sonuna o olayın kodunu köşeli parantezle yaz, örneğin [E3]. Kodu olmayan olaydan söz etme.
- Örneklem küçükse (n < 5) bunu belirt ve kesin hüküm kurma.
- Açık, sakin, kanıta dayalı bir dil kullan; slogan atma.
Yalnızca şu JSON'u döndür:
{"baslik": "bültenin başlığı (en çok 12 kelime)",
 "ozet": ["dönemin genel tablosu, 2-3 paragraf"],
 "gorulmeyenler": "İsrail ve Batı basınının görmediği olaylar ve konular üzerine bir paragraf",
 "nasil_anlatildi": [{"konu": "olay ya da konu adı", "metin": "bölge basını ile İsrail ve Batı basınının aynı şeyi nasıl farklı anlattığı, örnek yayın adlarıyla"}],
 "veri_notu": "verinin sınırları üzerine bir cümle"}
"nasil_anlatildi" en çok 5 madde olsun.

VERİ:
"""


def anlati_yaz(anahtar_api, model, ad, ist):
    hafif = {k: v for k, v in ist.items() if k not in ("kodlar", "gunluk", "yayin_tum", "yerler")}
    hafif["olay_kodlari"] = {k: {"baslik": v["baslik"], "tarih": v["tarih"]} for k, v in ist.get("kodlar", {}).items()}
    girdi = json.dumps(hafif, ensure_ascii=False)[:70000]
    kod, cevap = ekler.gemini_cagir(anahtar_api, model, ANLATI.replace("{ad}", ad) + girdi, zaman=100)
    if kod != 200 or not isinstance(cevap, dict):
        return kod, None
    temiz = lambda s, n: ekler.guvenli(s)[:n]
    return 200, {
        "baslik": temiz(cevap.get("baslik"), 140),
        "ozet": [temiz(p, 1500) for p in (cevap.get("ozet") or []) if p][:4],
        "gorulmeyenler": temiz(cevap.get("gorulmeyenler"), 1500),
        "nasil_anlatildi": [{"konu": temiz(x.get("konu"), 120), "metin": temiz(x.get("metin"), 1200)}
                            for x in (cevap.get("nasil_anlatildi") or []) if isinstance(x, dict)][:5],
        "veri_notu": temiz(cevap.get("veri_notu"), 400),
    }


def markdown(b):
    a, s = b.get("anlati") or {}, b["istatistik"]
    sat = [f"# {a.get('baslik') or b['ad']}", "", f"*{b['ad']}{' · taslak' if b['taslak'] else ''} · {s['haber_sayisi']} haber, {s['olay_sayisi']} olay*", ""]
    sat += [p + "\n" for p in a.get("ozet", [])]
    if a.get("gorulmeyenler"):
        sat += ["## İsrail ve Batı basınının görmedikleri", "", a["gorulmeyenler"], ""]
    for o in s["gormeyen_israil_bati"]:
        sat.append(f"- {o['tarih']} · {o['baslik']} ({o['kaynak']} kaynak)")
    if a.get("nasil_anlatildi"):
        sat += ["", "## Nasıl anlatıldı", ""]
        for x in a["nasil_anlatildi"]:
            sat += [f"### {x['konu']}", "", x["metin"], ""]
    sat += ["## Filistin bakışından uzaklık (0–2)", "", "| Grup | Haber | Uzaklık |", "|---|---|---|"]
    sat += [f"| {x['ad']} | {x['n']} | {x['uzaklik']} |" for x in s["kamp_bakis"]]
    if a.get("veri_notu"):
        sat += ["", "*" + a["veri_notu"] + "*"]
    return "\n".join(sat) + "\n"


# ------------------------------------------------------------------ 4) üretim döngüsü
BULTEN_SURUM = 2   # yeni ölçüler eklendiğinde artır; eski bültenler bir kez yeniden üretilir


def _site():
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    return f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else ""


def bultenleri_guncelle(kok, kaynaklar, anahtar_api, model, simdi, sure_var=lambda: True, log=print):
    """Gereken bültenleri üretir. Döndürür: (üretilen sayısı, 429 alındı mı)."""
    klasor = os.path.join(kok, "data", "bulten")
    bugun = simdi.date()
    isler = []
    for tur in ("haftalik", "aylik", "yillik"):
        su_an = anahtar_bul(tur, bugun)
        bas, _, _ = donem(tur, su_an)
        onceki = anahtar_bul(tur, bas - dt.timedelta(days=1))
        isler.append((tur, onceki, False))   # biten dönem: kesin bülten
        isler.append((tur, su_an, True))     # süren dönem: taslak
    uretilen, kota = 0, False
    for tur, anahtar, taslak in isler:
        if not sure_var() or uretilen >= 2:   # bir çalıştırmada en çok iki bülten; kalanlar sonraki turda
            break
        yol = os.path.join(klasor, tur, anahtar + ".json")
        var = _oku(yol, None)
        if var and not var.get("taslak") and var.get("anlati") and var.get("surum") == BULTEN_SURUM:
            continue                                    # kesinleşmiş bülten bir daha yazılmaz
        if var and taslak and var.get("surum") == BULTEN_SURUM:
            yas = simdi - dt.datetime.fromisoformat(var["uretildi"])
            if yas < dt.timedelta(hours=24 if tur != "yillik" else 24 * 7) and var.get("anlati"):
                continue
        if var and not var.get("anlati") and var.get("deneme", 0) >= 6 and not taslak:
            continue
        bas, bit, ad = donem(tur, anahtar)
        ist = istatistik(kok, bas, bit, kaynaklar)
        if not ist:
            continue
        o_anahtar = anahtar_bul(tur, bas - dt.timedelta(days=1))
        ob, obit, oad = donem(tur, o_anahtar)
        onc = istatistik(kok, ob, obit, kaynaklar)
        if onc:
            ist["onceki"] = {"ad": oad, "anahtar": o_anahtar, "haber_sayisi": onc["haber_sayisi"],
                             "kamp_bakis": {x["ad"]: x["uzaklik"] for x in onc["kamp_bakis"]},
                             "gormeyen": len(onc["gormeyen_israil_bati"]), "gecikme_medyan": onc["gecikme"]["medyan_saat"],
                             "dil": {t["anahtar"]: {"ic": t["ic_binde"], "dis": t["dis_binde"]} for t in onc["dil"]["terimler"]}}
        anlati = None
        if anahtar_api and model and not kota:
            kod, anlati = anlati_yaz(anahtar_api, model, ad, ist)
            if kod == 429:
                kota = True
        b = {"tur": tur, "anahtar": anahtar, "ad": ad, "bas": bas.isoformat(), "bit": bit.isoformat(),
             "taslak": taslak, "uretildi": simdi.isoformat(), "istatistik": ist,
             "anlati": anlati or (var or {}).get("anlati"), "deneme": (0 if anlati else (var or {}).get("deneme", 0) + 1),
             "surum": BULTEN_SURUM}
        # Dışa aktarım: CSV'ler (zip) ve paylaşılabilir kart
        try:
            zyol = disa_aktar.csv_yaz(b, os.path.dirname(yol))
            png = disa_aktar.kart_yaz(b, kok, yol[:-5] + ".png", _site())
            b["indir"] = {"zip": os.path.relpath(zyol, kok), "csv": os.path.relpath(os.path.join(os.path.dirname(yol), anahtar), kok),
                          "png": os.path.relpath(png, kok) if png else None, "svg": os.path.relpath(yol[:-5] + ".svg", kok)}
        except Exception as e:
            log(f"Almanak dışa aktarım hatası: {e}")
        _yaz(yol, b)
        with open(yol[:-5] + ".md", "w", encoding="utf-8") as f:
            f.write(markdown(b))
        uretilen += 1
        log(f"Almanak: {ad}{' (taslak)' if taslak else ''} yazıldı{'' if anlati else '; yorum metni sonra yazılacak'}")
    # Dizin
    dizin = []
    for tur in ("haftalik", "aylik", "yillik"):
        d = os.path.join(klasor, tur)
        if not os.path.isdir(d):
            continue
        for ad in os.listdir(d):
            if ad.endswith(".json"):
                b = _oku(os.path.join(d, ad), None)
                if b:
                    dizin.append({"tur": tur, "anahtar": b["anahtar"], "ad": b["ad"], "bas": b["bas"], "taslak": b["taslak"],
                                  "baslik": (b.get("anlati") or {}).get("baslik", ""), "haber": b["istatistik"]["haber_sayisi"],
                                  "olay": b["istatistik"]["olay_sayisi"], "uretildi": b["uretildi"],
                                  "kaynak": b.get("kaynak", "canli")})
    dizin.sort(key=lambda x: (x["bas"], x["tur"]), reverse=True)
    if dizin or os.path.isdir(klasor):
        _yaz(os.path.join(klasor, "dizin.json"), dizin)
    return uretilen, kota
