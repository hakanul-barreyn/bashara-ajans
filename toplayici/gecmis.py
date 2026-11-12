"""Geriye dönük taramadan Almanak: 7 Ekim 2023'ten toplayıcının başladığı güne kadar haftalık, aylık ve yıllık bültenler.

İki adım:
1) ozetle()  — tarama iş akışında çalışır. "tarama" dalındaki milyonlarca başlığı (veri/<kaynak>/<yıl>.jsonl.gz) gün gün
   sayar ve küçük bir özet yazar: tarama/gecmis.json.gz. Yapay zekâ kullanılmaz.
2) bultenler() — toplayıcıda çalışır. Özeti indirir, canlı arşivin başladığı günden önceki dönemler için
   data/bulten/<tür>/<anahtar>.json bültenleri yazar (kaynak: "tarama").

Bu bültenlerde yalnızca başlıklardan ölçülebilenler var: kim ne kadar yazdı, Gazze ne kadar yer buldu, hangi kelimeler
kullanıldı (dil sayacı, almanak.TERIMLER ile aynı kalıplar), yayın yayın dil. Olay kümeleri ve bakış ölçümü yok;
bunlar ikinci aşamada (önemli dönemlerin yapay zekâyla işlenmesi) eklenecek.
"""
import datetime as dt
import gzip
import json
import os
import re
import sys
import unicodedata
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import almanak  # noqa: E402
import olay_turleri as OT  # noqa: E402

BASLANGIC = dt.date(2023, 10, 7)
# \b şart: İtalyanca "ragazze" (kızlar) içinde "gazze" geçiyor
GAZZE = re.compile(r"\bgazze|\bgaza|غزة|غزه|עזה", re.I)
BAGLAM = re.compile(r"filist|palest|palästin|palestin|israil|israel|isra[eë]l|siyon|zionis|sionis|sionist|cisjord|west bank|batı şeria|"
                    r"westjordan|kudüs|jerusalem|jérusalem|gerusalem|ramallah|cenin|jenin|hamas|\bidf\b|lübnan|lebanon|liban|líbano|libano|hizbullah|hezbollah|hizbollah|hisbollah|nasrallah|لبنان|حزب الله|فلسطين|إسرائيل|اسرائيل|"
                    r"الاحتلال|القدس|الضفة|غزة|حماس|ישראל|פלסטינ|עזה|חמאס|יהודה ושומרון", re.I)
# Faillik: ölüm haberinde fail yazılmış mı? (başlık düzeyinde, kalıplarla)
OLDURME = re.compile(r"öldür|katlet|\bkill|\bslay|\btu(?:e|ent|é|és|ée|ées)\b|\bmat(?:a|an|ó|aron|ado|ados)\b|asesin|uccid|uccis|tötet|töten|getötet|قتل|يقتل|تقتل|הרג|נהרג", re.I)
EDILGEN_TR = re.compile(r"öldürül|katledil", re.I)
OLUM = re.compile(r"öldü|hayatını kaybet|can verdi|\böl[üu]\b|ölü sayısı|\bdie[sd]?\b|\bdead\b|death toll|deaths|\bmeur|\bmorts?\b|muer[et]|muertos|\bmort[ie]\b|muoion|\bstirbt|sterben|starben|\btote\b|todesopfer|استشهاد|شهيد|شهداء|مقتل|وفاة|ضحايا|נהרג|מתו|הרוגים", re.I)
FAIL_ISRAIL = re.compile(r"israel|israël|israil|isra[eé]l|\bidf\b|tsahal|siyonist|zionis|sionis|الاحتلال|إسرائيل|اسرائيل|الإسرائيلي|الاسرائيلي|الصهيون|צה\"?ל|ישראל", re.I)
FAIL_HAMAS = re.compile(r"hamas|حماس|חמאס|qassam|kassam|القسام|islamic jihad|cihad|hezbollah|hizbullah|حزب الله|houthi|husi|"
                        r"palestinian (?:gunm[ae]n|attacker|assailant|militant)|\bgunm[ae]n\b|attacker|assailant|saldırgan|terrorist|מחבל|مسلح", re.I)
FAIL_SONRA = re.compile(r"(?:\b(?:in|by|from|after|amid|during|par|lors|dans|por|en|tras|durante|da|dal|nel|von|durch|bei|nach)\b|"
                        r"بقصف|بغارة|بغارات|برصاص|جراء|في قصف|في غارة|في غارات|إثر)\W+(?:\w+\W+){0,3}?"
                        r"(?:israel|israël|isra[eé]l|israil|idf|tsahal|الاحتلال|إسرائيل|اسرائيل|الإسرائيلي|الاسرائيلي|الصهيون|צה\"?ל|ישראל)", re.I)
ISRAIL_KURBAN = re.compile(r"(?:israeli|israélien|israelí|israeliano|israelisch|israilli|إسرائيلي|اسرائيلي)(?:ne|s|es|a|i|e|en)?\W+(?:\w+\W+)?"
                           r"(?:soldier|soldat|soldad|soldat|asker|جندي|جنود|hostage|otage|rehén|ostagg|geisel|rehine|civilian|civil|"
                           r"\bm[ae]n\b|wom[ae]n|settler|reservist|officer|teen|girl|boy|kadın|erkek|مستوطن)|\bisraelis\b|\bisraéliens\b|"
                           r"\bisraelíes\b|\bisraeliani\b|\bisraelis\b|israilliler", re.I)
FILISTIN_NESNE = re.compile(r"palestin|filistinli|فلسطيني|فلسطينيين|فلسطينيا|gazan|\bchild|children|\bteen|\bboys?\b|\bgirls?\b|"
                            r"çocu|genç|journalist|gazeteci|paramedic|\bman\b|\bwoman\b|طفل|أطفال|شاب|شابا|صحفي", re.I)
ISRAIL_ASKER_OLUM = re.compile(r"(?:\bidf\b|soldiers?|reservists?|troops|soldat|soldad|asker[a-z]*)[ ,:'-]+(?:[a-z0-9]+[ ,:'-]+){0,3}(?:killed|dead|die[sd]?|slain|fall|fell|oldu|olduruldu|hayatini|tues?|muert|uccis|getotet)|"
                           r"مقتل جندي|مقتل جنود|مقتل ضابط|هلاك|مصرع جندي|مصرع جنود|נהרג|נפלו", re.I)
SEHADET = re.compile(r"şehit|şehadet|martyr|martyre|mártir|martire|märtyrer|استشهاد|شهيد|شهداء|ارتقاء|ارتقى", re.I)
GAZETECI = re.compile(r"gazeteci|muhabir|journalist|reporter|photojournalist|periodista|giornalist|صحف|صحاف|مراسل|עיתונא|כתב", re.I)


def faillik(b, kb):
    """Başlıktaki ölüm anlatımının türü: aktif (İsrail öldürdü), failli (İsrail'in saldırısında öldürüldü),
    failsiz (öldürüldü, kim olduğu yok), oldu (öldü / ölü sayısı), pfail (fail olarak Hamas, Hizbullah ya da bir silahlı Filistinli yazılmış), ikurban (ölen İsrailli). Ölüm yoksa None."""
    if ISRAIL_ASKER_OLUM.search(kb) and not FILISTIN_NESNE.search(kb):
        return "pfail" if (FAIL_HAMAS.search(b) or FAIL_HAMAS.search(kb)) else "ikurban"   # ölen İsrail askeri
    m = OLDURME.search(b) or OLDURME.search(kb)
    i = FAIL_ISRAIL.search(b) or FAIL_ISRAIL.search(kb)
    h = FAIL_HAMAS.search(b) or FAIL_HAMAS.search(kb)
    if m:
        metin = b if OLDURME.search(b) else kb
        m = OLDURME.search(metin)
        i = FAIL_ISRAIL.search(metin)
        h = FAIL_HAMAS.search(metin)
        edilgen = bool(EDILGEN_TR.search(metin))
        k = ISRAIL_KURBAN.search(metin[:m.start()])
        if k and FILISTIN_NESNE.search(metin[m.end():m.end() + 60]):
            # "İsrail askerleri 3 Filistinliyi öldürdü": fiilden önceki İsrailli kurban değil, faildir
            return "aktif"
        if k and (i is None or i.start() >= k.start()):
            # fiilden önceki "İsrailli asker", "Israelis" kurbanı anlatır: ölen İsraillidir
            i2 = FAIL_ISRAIL.search(metin[k.end():m.start()])
            if not i2:
                return "pfail" if h and h.start() < m.start() else "ikurban"
        once_i = i is not None and i.start() < m.start()
        once_h = h is not None and h.start() < m.start()
        if once_i and not edilgen and not (once_h and h.start() < i.start()):
            return "aktif"
        if once_h and not edilgen and not once_i:
            return "pfail"
        if once_i:
            return "failli"                          # İsrail'in saldırısında ... öldürüldü
        # fiilden sonra gelen İsrail ancak bir fail ipucuyla failtir ("in an Israeli strike", "by Israel");
        # "kills 20 Israelis" gibi kurbanı anlatan kullanımlar fail sayılmaz
        if FAIL_SONRA.search(metin[m.end():]):
            return "failli"
        return "failsiz"
    if SEHADET.search(b) or SEHADET.search(kb):
        return "sehadet"                             # şehit / istişhad: ölüm bir şehadet olarak anlatılıyor
    if OLUM.search(b) or OLUM.search(kb):
        return "oldu"
    return None


IRAN = re.compile(r"\biran|إيران|ايران|איראן|tahran|tehran|téhéran|teheran|teherán", re.I)
OZET_SURUM = 10
BULTEN_SURUM = 1


def katla(s):
    """Adresten türetilen başlıklarda (s=1) harf işaretleri yok: 'soykirim'. Karşılaştırma için her şeyi sadeleştir."""
    s = s.lower().replace("ı", "i").replace("İ", "i")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


TERIM = [(a, re.compile(k, re.I), re.compile(katla(k), re.I)) for a, _, _, k in almanak.TERIMLER]
ANAHTARLAR = [a for a, _, _ in TERIM]


def _derle(k):
    """Kalıp sadeleştirilmiş (katla) başlıkta aranır: küçük harf, harf işaretsiz. Büyük/küçük harf seçeneği gerekmez, hızlıdır."""
    return re.compile(katla(k))


# Olay türleri (hastane, çadır, yardım bekleyenlere ateş, ...), yerler ve liderler: olay_turleri.py
OLAY = [(t[0], [_derle(k) for k in t[2]], _derle(t[3]) if len(t) > 3 else None) for t in OT.TURLER]
OLAY_ON = _derle("|".join(t[2][0] for t in OT.TURLER))     # hızlı ön eleme: türlerin ilk kalıpları
YER = [(ad, _derle(k)) for ad, k in OT.YERLER]
LIDER = [(a, _derle(k)) for a, _, _, k in OT.LIDERLER]
LIDER_ON = _derle("|".join(k for *_, k in OT.LIDERLER))
LKEL = [(a, _derle(k)) for a, _, k in OT.LIDER_KELIME]
REHINE_AD = [(a, _derle(k)) for a, _, k in OT.REHINELER]
REHINE_ON = _derle("|".join(k for _, _, k in OT.REHINELER))
REHINE = _derle(r"rehine|hostage|otage|rehén|ostagg|geisel|رهينة|رهائن|محتجز|חטוף|חטופ|בן ערובה|בני ערובה")
# İsrailli asker: Gazze bağlamında "asker" neredeyse hep İsrail askeridir
YARALI = _derle(r"wound|injur|yaralan|yaralı|blessé|herid|ferit|verletzt|جرحى|إصابة|مصاب|פצוע")
FILISTIN = _derle(r"filist|palest|palästin|فلسطين|الفلسطيني|الضفة|west bank|batı şeria|cisjord|cisgiord|westjordan|ramallah|رام الله")
# Lübnan ve Hizbullah: aynı savaşın parçası; Gazze'den ayrı okunmaz
LUBNAN = _derle(r"lübnan|lebanon|liban|líbano|libano|hizbullah|hezbollah|hizbollah|hisbollah|nasrallah|beyrut|beirut|لبنان|حزب الله|بيروت|الضاحية")


def olay_bul(kb):
    """Sadeleştirilmiş başlığın girdiği olay türleri (kesişim türleri dahil)."""
    if not OLAY_ON.search(kb):
        return []
    bul = [a for a, gr, har in OLAY if all(c.search(kb) for c in gr) and not (har and har.search(kb))]
    if bul:
        s = set(bul)
        for x, y in OT.BASTIR:
            if x in s and y in s:
                s.discard(y)
                bul.remove(y)
        bul += [a for a, _, p in OT.TUREV if all(x in s for x in p)]
    return bul


def lider_bul(kb):
    if not LIDER_ON.search(kb):
        return []
    return [a for a, c in LIDER if c.search(kb)]


def _yan(k):
    c = almanak.kamp(k)
    return "dis" if c in almanak.DIS else "ic" if c in almanak.BOLGE_ICI and k.get("cizgi") != "ik" else None


# ------------------------------------------------------------------ 1) tarama verisinden özet
# Wayback (cdx) kayıtlarında tarih, sayfanın arşive alındığı andır; yayın tarihi değil. Eski bir yazı 2024'te yeniden
# arşivlenince 2024'e sayılmasın diye cdx kayıtlarından yalnızca adresinde tarih olanlar (/2024/01/15/, 20240115) alınır,
# tarih adresten okunur. Adresinde tarih olmayan cdx kayıtları tarihlenemez ve Almanak'a girmez (sayısı özete yazılır).
# (Haber numarasından tarih tahmini denendi: arşivin boş ayları yüzünden aylık sayıları bozduğu için bırakıldı.)
URL_TARIH = re.compile(r"/(20[12]\d)[/-](0[1-9]|1[0-2])(?:[/-](0[1-9]|[12]\d|3[01]))?(?=[/-]|$)|[/_-](20[12]\d)(0[1-9]|1[0-2])([0-3]\d)(?=[/_-]|$)")


def _cdx_tarihle(kayitlar):
    """kayitlar: [{'u','t',...}] (aynı kaynak, cdx). Döndürür: {url: 'YYYY-MM-DD' | None}, yöntem adı."""
    ilk = {}
    for r in kayitlar:
        if r["u"] not in ilk or r["t"] < ilk[r["u"]]:
            ilk[r["u"]] = r["t"]
    sonuc = {}
    tarihli = 0
    for u in ilk:
        m = URL_TARIH.search(u)
        if m:
            y, a, g = (m.group(1), m.group(2), m.group(3)) if m.group(1) else (m.group(4), m.group(5), m.group(6))
            try:
                sonuc[u] = dt.date(int(y), int(a), int(g or 15)).isoformat()   # 30 Şubat gibi geçersiz tarihler elenir
                tarihli += 1
            except ValueError:
                pass
    return {u: sonuc.get(u) for u in ilk}, ("adres" if tarihli >= 0.5 * len(ilk) else "kismi" if tarihli else "yok")


def ozetle(tarama_kok, kaynaklar, log=print):
    K = {str(k["id"]): k for k in kaynaklar}
    gun = {}      # "2024-01-05": {"k": {kamp: n}, "ic": n, "dis": n, "gi": n, "gd": n, "t": {terim: [ic, dis]}}
    yayin = {}    # "2024-01-05": {kid: n | [n, {terim: c}]}
    ornek = {}    # "2024-01": {terim: {"ic": [[kid, başlık, url, gün]], "dis": [...]}}
    olay_ornek = {}   # "2024-01-05": {tür: [[kid, başlık, url, yan], ...]}
    olay_yer = {}     # "2024-01-05": {tür: {yer: n}}
    lider_ornek = {}  # "2024-01": {lider: [[kid, başlık, url, gün], ...]}
    tarih_yontem, toplu_gun = {}, {}
    toplam = 0
    kok = os.path.join(tarama_kok, "veri")
    # Canlı toplayıcının günlük başlıkları (veri dalı, data/canli): taramanın son gününden sonrası için. Aynı adres
    # geriye dönük kayıtlarda da varsa bir kez sayılır.
    canli = {}
    ck = os.environ.get("CANLI_KLASOR", os.path.join(tarama_kok, "canli"))
    for ad in sorted(os.listdir(ck)) if os.path.isdir(ck) else []:
        if not ad.endswith(".json.gz"):
            continue
        try:
            with gzip.open(os.path.join(ck, ad), "rt", encoding="utf-8") as f:
                for kid_, u, t, b in json.load(f):
                    canli.setdefault(str(kid_), []).append({"u": u, "t": t, "b": b, "m": "canli"})
        except (OSError, ValueError, EOFError) as e:
            log(f"Canlı başlıklar: {ad} okunamadı: {e}")
    if canli:
        log(f"Canlı başlıklar: {sum(len(x) for x in canli.values())} başlık, {len(canli)} yayın")
    kidler = sorted(set(os.listdir(kok) if os.path.isdir(kok) else []) | set(canli))
    for kid in kidler:
        k = K.get(kid)
        if not k:
            continue
        kmp, yan = almanak.kamp(k), _yan(k)
        kayitlar = []
        for ad in sorted(os.listdir(os.path.join(kok, kid))) if os.path.isdir(os.path.join(kok, kid)) else []:
            if not ad.endswith(".jsonl.gz"):
                continue
            try:
                with gzip.open(os.path.join(kok, kid, ad), "rt", encoding="utf-8") as f:
                    for satir in f:
                        try:
                            r = json.loads(satir)
                        except ValueError:
                            continue
                        if r.get("u") and r.get("t") and r.get("b"):
                            kayitlar.append(r)
            except (OSError, EOFError) as e:
                log(f"Geçmiş özeti: {kid}/{ad} okunamadı: {e}")
        # canlı başlıklar yalnızca taramada kaydı olmayan günler için (aynı haber farklı adresle iki kez sayılmasın)
        tgun = {r["t"][:10] for r in kayitlar if r.get("m") != "cdx"}
        kayitlar += [r for r in canli.get(kid, []) if r["t"][:10] not in tgun]
        cdx = [r for r in kayitlar if r.get("m") == "cdx"]
        cdx_tarih, yontem = _cdx_tarihle(cdx) if cdx else ({}, "")
        if cdx:
            tarihsiz = sum(1 for v in cdx_tarih.values() if not v)
            tarih_yontem[kid] = {"yontem": yontem, "adres": len(cdx_tarih), "tarihsiz": tarihsiz}
        gorulen, tarihli = set(), []
        for r in sorted(kayitlar, key=lambda r: r["t"]):
            if r["u"] in gorulen:
                continue
            gorulen.add(r["u"])
            g = cdx_tarih.get(r["u"]) if r.get("m") == "cdx" else r["t"][:10]
            if g and g >= BASLANGIC.isoformat():
                tarihli.append((g, r))
        # Site haritasındaki "son değişiklik" tarihi bazen binlerce eski yazıda aynı güne toplu yazılır (ör. bir sitenin
        # arşivini yenilemesi). Bir kaynağın bir günü, o kaynağın olağan günlük sayısının 6 katını (en az 200) aşıyorsa
        # o gün toplu güncelleme sayılır ve dışarıda bırakılır.
        gunluk_say = {}
        for g, _ in tarihli:
            gunluk_say[g] = gunluk_say.get(g, 0) + 1
        if gunluk_say:
            orta = sorted(gunluk_say.values())[len(gunluk_say) // 2]
            sinir = max(200, 6 * orta)
            toplu = {g for g, n in gunluk_say.items() if n > sinir}
            if toplu:
                toplu_gun[kid] = sorted(toplu)
                tarihli = [(g, r) for g, r in tarihli if g not in toplu]
        for g, r in tarihli:
            b = r["b"]
            toplam += 1
            d = gun.setdefault(g, {"k": {}, "ic": 0, "dis": 0, "gi": 0, "gd": 0, "t": {}})
            d["k"][kmp] = d["k"].get(kmp, 0) + 1
            kb = katla(b)
            bulunan = [a for a, r1, r2 in TERIM if r1.search(b) or r2.search(kb)]
            y = yayin.setdefault(g, {})
            eski = y.get(kid, 0)
            n, tt = (eski, {}) if isinstance(eski, int) else (eski[0], eski[1])
            for a in bulunan:
                tt[a] = tt.get(a, 0) + 1
            # Rapor için: Gazze geçen başlık (_g) ve Filistin / İsrail / Gazze bağlamındaki başlık (_b); bağlamdaki
            # başlıklarda geçen kelimeler "b:<kelime>" (ör. Ruanda soykırımı haberleri 'soykırım' sayısını şişirmesin)
            gz = bool(GAZZE.search(b) or GAZZE.search(kb))
            bg = gz or bool(BAGLAM.search(b) or BAGLAM.search(kb))
            if gz:
                tt["_g"] = tt.get("_g", 0) + 1
            iran = bool(IRAN.search(b) or IRAN.search(kb))
            if iran:
                tt["_i"] = tt.get("_i", 0) + 1
            # Savaş başlığı (_s): Gazze, Batı Şeria, Kudüs, Lübnan ve İsrail bağlamındaki bütün başlıklar. Lübnan'a ve
            # İran'a karşı savaş da aynı savaşın parçasıdır (direniş cephesi); İsrail'le birlikte geçen İran başlıkları da sayılır.
            if bg:
                tt["_s"] = tt.get("_s", 0) + 1
            ozgun = r.get("s") != 1
            if bg:
                tt["_b"] = tt.get("_b", 0) + 1
                for a in bulunan:
                    tt["b:" + a] = tt.get("b:" + a, 0) + 1
                f = faillik(b, kb)
                if f:
                    tt["f:" + f] = tt.get("f:" + f, 0) + 1
                    if GAZETECI.search(b) or GAZETECI.search(kb):
                        tt["_gz"] = tt.get("_gz", 0) + 1   # gazeteci ölümü haberi
                ot = olay_bul(kb)
                if ot:
                    yerler = [ad for ad, c in YER if c.search(kb)]
                    if not (gz or yerler or FILISTIN.search(kb) or LUBNAN.search(kb)):
                        ot = []        # İran'ın İsrail'e saldırıları gibi olaylar bu katalogda değil
                if ot:
                    oy, oo = olay_yer.setdefault(g, {}), olay_ornek.setdefault(g, {})
                    for a in ot:
                        tt["o:" + a] = tt.get("o:" + a, 0) + 1
                        for yr in yerler:
                            oy.setdefault(a, {})[yr] = oy.setdefault(a, {}).get(yr, 0) + 1
                        lst = oo.setdefault(a, [])
                        yk = yan or "x"
                        if (ozgun and len(lst) < 6 and sum(1 for x in lst if x[3] == yk) < 2
                                and all(x[0] != int(kid) for x in lst)):
                            lst.append([int(kid), b[:170], r.get("u"), yk])
                # kimin ölümü haber oldu: İsrailli ölüm / Filistinli ölüm başlığı, rehine başlığı, rehine adları
                # faillik sırayı gözetir: "İsrail askerleri 3 Filistinliyi öldürdü" İsrailli ölüm değildir
                asker = bool(ISRAIL_ASKER_OLUM.search(kb))
                if f in ("ikurban", "pfail") or asker:
                    tt["k:io"] = tt.get("k:io", 0) + 1
                elif f and (gz or FILISTIN.search(kb)):
                    tt["k:fo"] = tt.get("k:fo", 0) + 1
                if REHINE.search(kb):
                    tt["k:r"] = tt.get("k:r", 0) + 1
                if REHINE_ON.search(kb):
                    for a, c in REHINE_AD:
                        if c.search(kb):
                            tt["r:" + a] = tt.get("r:" + a, 0) + 1
                ls = lider_bul(kb)
                if ls:
                    ks = [a for a, c in LKEL if c.search(kb)]
                    lo = lider_ornek.setdefault(g[:7], {})
                    for a in ls:
                        tt["l:" + a] = tt.get("l:" + a, 0) + 1    # bağlamdaki başlıklar
                        for kl in ks:
                            tt[f"lk:{a}:{kl}"] = tt.get(f"lk:{a}:{kl}", 0) + 1
                        lst = lo.setdefault(a, [])
                        if ozgun and len(lst) < 4 and all(x[0] != int(kid) for x in lst):
                            lst.append([int(kid), b[:170], r.get("u"), g])
            y[kid] = [n + 1, tt] if tt else n + 1
            if not yan:
                continue
            d[yan] += 1
            if GAZZE.search(b) or GAZZE.search(kb):
                d["gi" if yan == "ic" else "gd"] += 1
            for a in bulunan:
                c = d["t"].setdefault(a, [0, 0])
                c[0 if yan == "ic" else 1] += 1
                o = ornek.setdefault(g[:7], {}).setdefault(a, {"ic": [], "dis": []})[yan]
                if len(o) < 4 and r.get("s") != 1:   # örnek olarak özgün başlıkları tercih et
                    o.append([int(kid), b[:180], r.get("u"), g])
    ilerleme = {}
    try:
        ilerleme = json.load(open(os.path.join(tarama_kok, "ilerleme.json"), encoding="utf-8"))
    except (OSError, ValueError):
        pass
    veri = {"surum": OZET_SURUM, "guncellendi": dt.datetime.now(dt.timezone.utc).isoformat(), "baslik": toplam,
            "tarama_bitti": ilerleme.get("kalan_gorev") == 0, "ilerleme": ilerleme, "tarih_yontem": tarih_yontem,
            "tarihsiz": sum(v["tarihsiz"] for v in tarih_yontem.values()), "toplu_gun": toplu_gun,
            "gun": gun, "yayin": yayin, "ornek": ornek,
            "olay_ornek": olay_ornek, "olay_yer": olay_yer, "lider_ornek": lider_ornek}
    yol = os.path.join(tarama_kok, "gecmis.json.gz")
    with gzip.open(yol, "wt", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    log(f"Geçmiş özeti: {toplam} başlık, {len(gun)} gün; {os.path.getsize(yol) // 1024} KB")
    return veri


# ------------------------------------------------------------------ 2) özetten bültenler
def _indir(kok, log):
    """Özeti tarama dalından indirir (herkese açık depo); 6 saatte bir yeniler."""
    yol = os.path.join(kok, "data", "bulten", "gecmis-ozet.json.gz")
    zyol = os.path.join(kok, "data", "bulten", "gecmis-indirme.json")
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    ind = almanak._oku(zyol, {})
    son = ind.get("zaman")
    # Elimizdeki özet eski sürümdeyse (yeni ölçüler yoksa) 6 saati beklemeden yeniden indir
    taze = (os.path.exists(yol) and son and ind.get("surum") == OZET_SURUM
            and dt.datetime.now(dt.timezone.utc) - dt.datetime.fromisoformat(son) < dt.timedelta(hours=6))
    if depo and not taze:
        try:
            istek = urllib.request.Request(f"https://raw.githubusercontent.com/{depo}/tarama/gecmis.json.gz",
                                           headers={"User-Agent": "zbs-toplayici"})
            with urllib.request.urlopen(istek, timeout=60) as r:
                icerik = r.read()
            os.makedirs(os.path.dirname(yol), exist_ok=True)
            with open(yol, "wb") as f:
                f.write(icerik)
            try:
                gelen = json.loads(gzip.decompress(icerik)).get("surum")
            except Exception:
                gelen = None
            almanak._yaz(zyol, {"zaman": dt.datetime.now(dt.timezone.utc).isoformat(), "surum": gelen})
        except Exception as e:
            log(f"Geçmiş özeti indirilemedi: {e}")
    try:
        with gzip.open(yol, "rt", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError, EOFError):
        return None


def _gunler(bas, bit):
    g = bas
    while g < bit:
        yield g.isoformat()
        g += dt.timedelta(days=1)


def istatistik(oz, bas, bit, kaynaklar):
    K = {k["id"]: k for k in kaynaklar}
    hacim, say, terim, gunluk = {}, {"ic": 0, "dis": 0}, {a: [0, 0] for a in ANAHTARLAR}, []
    yay = {}
    for g in _gunler(max(bas, BASLANGIC), bit):
        d = oz["gun"].get(g)
        gunluk.append({"gun": g, "ic": d["ic"] if d else 0, "dis": d["dis"] if d else 0, "ic_gazze": d["gi"] if d else 0,
                       "dis_gazze": d["gd"] if d else 0, "ic_uzaklik": None, "dis_uzaklik": None, "ic_n": 0, "dis_n": 0})
        if not d:
            continue
        for c, n in d["k"].items():
            hacim[c] = hacim.get(c, 0) + n
        say["ic"] += d["ic"]
        say["dis"] += d["dis"]
        for a, (i, s) in d["t"].items():
            terim[a][0] += i
            terim[a][1] += s
        for kid, v in (oz["yayin"].get(g) or {}).items():
            n, tt = (v, {}) if isinstance(v, int) else (v[0], v[1])
            r = yay.setdefault(int(kid), {"n": 0, "t": {}})
            r["n"] += n
            for a, c in tt.items():
                r["t"][a] = r["t"].get(a, 0) + c
    toplam = sum(hacim.values())
    if not toplam:
        return None
    ornekler = {a: {"ic": [], "dis": []} for a in ANAHTARLAR}
    ay = dt.date(bas.year, bas.month, 1)
    while ay < bit:
        for a, d in (oz["ornek"].get(ay.isoformat()[:7]) or {}).items():
            for yan in ("ic", "dis"):
                for kid, b, u, g in d.get(yan, []):
                    if bas.isoformat() <= g < bit.isoformat() and len(ornekler[a][yan]) < 3 and K.get(kid):
                        ornekler[a][yan].append({"yayin": K[kid]["ad"], "baslik": b, "url": u, "gun": g})
        ay = dt.date(ay.year + (ay.month == 12), ay.month % 12 + 1, 1)
    dil = {"baslik_ic": say["ic"], "baslik_dis": say["dis"], "terimler": []}
    for a, l, y, _ in almanak.TERIMLER:
        i, s = terim[a]
        dil["terimler"].append({"anahtar": a, "ad": l, "yan": y, "ic": i, "dis": s,
                                "ic_binde": round(1000 * i / say["ic"], 1) if say["ic"] else None,
                                "dis_binde": round(1000 * s / say["dis"], 1) if say["dis"] else None,
                                "ornek_ic": ornekler[a]["ic"], "ornek_dis": ornekler[a]["dis"]})
    # Yayın yayın dil: en az 30 başlığı olan yayınlarda öne çıkan kelimelerin bin başlıktaki sıklığı
    yayin_dil = []
    for kid, r in yay.items():
        k = K.get(kid)
        if not k or r["n"] < 30:
            continue
        yayin_dil.append({"ad": k["ad"], "kamp": almanak.kamp(k), "n": r["n"],
                          **{a: round(1000 * r["t"].get(a, 0) / r["n"], 1) for a in ANAHTARLAR}})
    yayin_dil.sort(key=lambda x: (almanak.KAMP_SIRA.index(x["kamp"]) if x["kamp"] in almanak.KAMP_SIRA else 99, -x["n"]))
    gazze_ic = sum(x["ic_gazze"] for x in gunluk)
    gazze_dis = sum(x["dis_gazze"] for x in gunluk)
    return {
        "kaynak": "tarama", "haber_sayisi": toplam, "olay_sayisi": 0,
        "gun_sayisi": sum(1 for x in gunluk if x["ic"] or x["dis"]),
        "hacim": [{"ad": c, "n": hacim[c]} for c in almanak.KAMP_SIRA if hacim.get(c)],
        "gazze": {"ic": gazze_ic, "dis": gazze_dis,
                  "ic_pay": round(100 * gazze_ic / say["ic"], 1) if say["ic"] else None,
                  "dis_pay": round(100 * gazze_dis / say["dis"], 1) if say["dis"] else None},
        "dil": dil, "gunluk": gunluk, "yayin_dil": yayin_dil,
        # canlı bültenlerle aynı biçim: bu dönemde ölçülmeyenler boş
        "kodlar": {}, "gecikme": None, "olum": None, "yerler": [], "yayin_tum": [], "konular": [], "kamp_bakis": [],
        "cizgi_bakis": [], "yayin_yakin": [], "yayin_uzak": [], "konu_bakis": [], "gormeyen_israil_bati": [],
        "gormeyen_bolge": [], "buyuk_olaylar": [],
    }


ANLATI_TARAMA = """Sen bir haber ajansının almanak editörüsün. Aşağıda {ad} dönemine ait ÖLÇÜLMÜŞ veriler var. Bu dönemin
verisi geriye dönük taramadan geliyor: yayınların özgün başlıkları sayıldı; olay karşılaştırması ve bakış ölçümü YOK.
Bu verilere bakarak Türkçe kısa bir bülten yaz. Kurallar:
- Yalnızca verilen veriyi kullan. Veride olmayan olay, sayı ya da alıntı uydurma; sayıları veriden aynen al.
  Dönemde ne olduğunu kendi bilginden anlatma; yalnızca örnek başlıklarda geçen olaylardan, başlık olarak söz et.
- "bolge_ici" ve "ic" Filistin, Arap, İran-Yemen ve Türkiye basını; "dis" İsrail ve Batı basınıdır.
- "dil.terimler": kelimenin bin başlıkta kaç kez geçtiği (ic_binde, dis_binde). İki tarafın kelime seçimini karşılaştır.
- "gazze": başlığında Gazze geçen haberlerin payı. "hacim": grupların başlık sayısı (arşive erişime de bağlıdır, mutlak
  sayıya değil orana bak). "yayin_dil": yayın yayın kelime sıklığı; dikkat çekenleri adıyla an. "onceki": önceki dönem.
- Örneklem küçükse (başlık sayısı < 300) bunu belirt ve kesin hüküm kurma. Sakin, kanıta dayalı bir dil kullan.
Yalnızca şu JSON'u döndür:
{"baslik": "en çok 12 kelime", "ozet": ["1-2 paragraf"], "veri_notu": "verinin sınırları üzerine bir cümle"}

VERİ:
"""


def anlati_yaz(anahtar_api, model, ad, ist):
    import ekler
    hafif = {k: ist[k] for k in ("haber_sayisi", "gun_sayisi", "hacim", "gazze", "onceki") if k in ist}
    hafif["dil"] = {**ist["dil"], "terimler": [{k: v for k, v in t.items() if k != "ornek_ic" and k != "ornek_dis"}
                                               | {"ornek_ic": [o["baslik"] for o in t["ornek_ic"]], "ornek_dis": [o["baslik"] for o in t["ornek_dis"]]}
                                               for t in ist["dil"]["terimler"]]}
    hafif["yayin_dil"] = ist.get("yayin_dil", [])[:40]
    kod, cevap = ekler.gemini_cagir(anahtar_api, model, ANLATI_TARAMA.replace("{ad}", ad) + json.dumps(hafif, ensure_ascii=False)[:60000], zaman=100)
    if kod != 200 or not isinstance(cevap, dict):
        return kod, None
    temiz = lambda x, n: ekler.guvenli(x)[:n]
    return 200, {"baslik": temiz(cevap.get("baslik"), 140), "ozet": [temiz(p, 1500) for p in (cevap.get("ozet") or []) if p][:3],
                 "veri_notu": temiz(cevap.get("veri_notu"), 400)}


def _donemler(son_gun):
    """7 Ekim 2023'ten son_gun'e (hariç) kadar tamamen biten haftalar, aylar ve yıllar."""
    for tur in ("yillik", "aylik", "haftalik"):
        anahtar = almanak.anahtar_bul(tur, BASLANGIC)
        while True:
            bas, bit, ad = almanak.donem(tur, anahtar)
            if bit > son_gun:
                break
            yield tur, anahtar, bas, bit, ad
            anahtar = almanak.anahtar_bul(tur, bit)


def bultenler(kok, kaynaklar, simdi, en_cok=300, anahtar_api="", model="", yorum=1, log=print):
    """Bültenleri yazar. Tarama bittiyse, yorum metni olmayan bültenlerden en çok `yorum` tanesine yapay zekâ yorumu ekler
    (önce yıllar, sonra aylar, sonra haftalar). Döndürür: (yazılan, yorum isteği sayısı, 429 alındı mı)."""
    oz = _indir(kok, log)
    if not oz:
        return 0, 0, False
    arsiv = os.path.join(kok, "data", "arsiv")
    gunler = sorted(a[:10] for a in os.listdir(arsiv) if a.endswith(".json") and a[:4].isdigit()) if os.path.isdir(arsiv) else []
    canli_bas = dt.date.fromisoformat(gunler[0]) if gunler else simdi.date()
    klasor = os.path.join(kok, "data", "bulten")
    yazilan = 0
    for tur, anahtar, bas, bit, ad in _donemler(canli_bas):
        if yazilan >= en_cok:
            break
        yol = os.path.join(klasor, tur, anahtar + ".json")
        var = almanak._oku(yol, None)
        if var and var.get("istatistik", {}).get("kaynak") != "tarama":
            continue   # canlı bülten varsa ona dokunma
        if var and var.get("ozet_guncellendi") == oz["guncellendi"] and var.get("surum") == BULTEN_SURUM:
            continue
        ist = istatistik(oz, bas, bit, kaynaklar)
        if not ist:
            continue
        o_anahtar = almanak.anahtar_bul(tur, bas - dt.timedelta(days=1))
        ob, obit, oad = almanak.donem(tur, o_anahtar)
        if obit > BASLANGIC:
            onc = istatistik(oz, ob, obit, kaynaklar)
            if onc:
                ist["onceki"] = {"ad": oad, "anahtar": o_anahtar, "haber_sayisi": onc["haber_sayisi"], "kamp_bakis": {},
                                 "gormeyen": 0, "gecikme_medyan": None,
                                 "dil": {t["anahtar"]: {"ic": t["ic_binde"], "dis": t["dis_binde"]} for t in onc["dil"]["terimler"]}}
        b = {"tur": tur, "anahtar": anahtar, "ad": ad, "bas": bas.isoformat(), "bit": bit.isoformat(),
             "taslak": not oz.get("tarama_bitti"), "uretildi": simdi.isoformat(), "istatistik": ist,
             "anlati": (var or {}).get("anlati") if (var or {}).get("ozet_guncellendi") == oz["guncellendi"] else None,
             "surum": BULTEN_SURUM, "ozet_guncellendi": oz["guncellendi"], "kaynak": "tarama"}
        almanak._yaz(yol, b)
        yazilan += 1
    # Yorum metni: yalnızca tarama bitince (sayılar artık değişmeyecek)
    istek, kota = 0, False
    if oz.get("tarama_bitti") and anahtar_api and model:
        for tur, anahtar, bas, bit, ad in _donemler(canli_bas):
            if istek >= yorum:
                break
            yol = os.path.join(klasor, tur, anahtar + ".json")
            b = almanak._oku(yol, None)
            if not b or b.get("kaynak") != "tarama" or b.get("anlati") or b.get("deneme", 0) >= 4:
                continue
            kod, a = anlati_yaz(anahtar_api, model, ad, b["istatistik"])
            istek += 1
            if kod == 429:
                kota = True
                break
            b["anlati"] = a
            b["deneme"] = 0 if a else b.get("deneme", 0) + 1
            almanak._yaz(yol, b)
            yazilan += 1
            log(f"Almanak (geçmiş): {ad} yorumu {'yazıldı' if a else 'yazılamadı'}")
    if yazilan:
        dizin_yaz(klasor)
        log(f"Almanak (geçmiş): {yazilan} bülten güncellendi; tarama {'bitti' if oz.get('tarama_bitti') else 'sürüyor'}")
    return yazilan, istek, kota


def dizin_yaz(klasor):
    dizin = []
    for tur in ("haftalik", "aylik", "yillik"):
        d = os.path.join(klasor, tur)
        if not os.path.isdir(d):
            continue
        for ad in os.listdir(d):
            if ad.endswith(".json"):
                b = almanak._oku(os.path.join(d, ad), None)
                if b:
                    dizin.append({"tur": tur, "anahtar": b["anahtar"], "ad": b["ad"], "bas": b["bas"], "taslak": b["taslak"],
                                  "baslik": (b.get("anlati") or {}).get("baslik", ""), "haber": b["istatistik"]["haber_sayisi"],
                                  "olay": b["istatistik"]["olay_sayisi"], "uretildi": b["uretildi"],
                                  "kaynak": b.get("kaynak", "canli")})
    dizin.sort(key=lambda x: (x["bas"], x["tur"]), reverse=True)
    almanak._yaz(os.path.join(klasor, "dizin.json"), dizin)


if __name__ == "__main__":
    # tarama iş akışından: python toplayici/gecmis.py ozetle
    kok = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ks = json.load(open(os.path.join(kok, "kaynaklar.json"), encoding="utf-8"))
    ks = ks["kaynaklar"] if isinstance(ks, dict) else ks
    ozetle(os.path.join(kok, "tarama"), ks)
