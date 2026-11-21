"""Dosyalar: haftalarca süren olayları (İran-ABD savaşı, İsrail'de seçim sonrası...) dallarıyla birlikte istifler.

Katmanlar: haber → olay (ekler.olaylari_kumele, 24 saat) → dal (dosyanın alt hikâyesi) → dosya.

data/dosyalar.json (durum, veri dalında):
  dosyalar: [{id, ad, ad_en, kapsam, durum: acik|kapali, acildi, dallar: [{id, ad, ad_en, acildi, onceki?}], ozet, ozet_en, ozet_tarih}]
  olaylar:  {anahtar: {b, b_en, g (ilk gün), son, n (haber), k (kaynak), h: [haber kimlikleri], yer: [[dosya, dal], ...], bakildi}}
  oneriler: [{id, ad, kapsam, olaylar: [anahtar], gerekce, tarih, durum: bekliyor|onaylandi|reddedildi}]
  islenen: [panel işlem kimlikleri]
data/dosyalar-site.json: sitenin okuduğu özet (dosya, dal, olay başlıkları; haber kimliği → dosya/dal).

Yerleştirme olay kümelemesinden sonra tek bir yapay zekâ çağrısıyla yapılır; aynı olay sonraki turlarda haber kimliklerinden
tanınır, yeniden sorulmaz. Yeni dal açmak serbest; yeni dosya yalnızca öneri olarak kuyruğa girer, panelden onaylanır.
Panel (panel.alborotonews.com, Cloudflare Worker) işlemleri "panel" dalındaki islemler.json'a yazar; burada uygulanır.
"""
import datetime as dt
import glob
import hashlib
import html
import json
import os
import re

import ekler

DURUM = os.path.join("data", "dosyalar.json")
SITE = os.path.join("data", "dosyalar-site.json")
SESSIZ_GUN = 5          # bu kadar gün haber almayan dal yeniden haber alırsa "yeniden gündemde"
PARTI = 40              # bir yerleştirme çağrısındaki en çok olay
ONERI_ESIGI = 3         # yeni dosya önerisi için en az olay

BASLANGIC = [
    {"id": "iran-abd-savasi", "ad": "İran-ABD savaşı", "ad_en": "Iran-US war",
     "kapsam": "ABD ve İsrail ile İran arasındaki savaş ve uzantıları: deniz ablukası ve Hürmüz Boğazı, karşılıklı saldırılar, "
               "arabuluculuk ve müzakereler, nükleer program, İran'ın uyarıları, casusluk ve gizli operasyonlar, savaşın Irak ve Körfez'e etkisi."},
    {"id": "suudi-yemen-savasi", "ad": "Suudi-Yemen savaşı", "ad_en": "Saudi-Yemen war",
     "kapsam": "Suudi Arabistan öncülüğündeki koalisyon ile Yemen'deki Ensarullah (Husiler) arasındaki savaş: hava saldırıları, "
               "füze ve İHA saldırıları, Kızıldeniz'deki gemi saldırıları, Yemen'deki insani durum, görüşmeler."},
    {"id": "guney-lubnanin-isgali", "ad": "Güney Lübnan'ın işgali", "ad_en": "Occupation of southern Lebanon",
     "kapsam": "İsrail'in Güney Lübnan'daki saldırıları, işgali ve yıkımı; Hizbullah'la çatışmalar; sınır köyleri ve göç; "
               "ateşkes, çekilme ve silahsızlandırma görüşmeleri; Lübnan hükümetinin tutumu."},
    {"id": "israilde-secim-sonrasi", "ad": "İsrail'de seçim sonrası ve hükümet kurma", "ad_en": "Israel after the election",
     "kapsam": "İsrail'deki son seçimin sonuçları ve sonrası: hükümet kurma ve koalisyon pazarlıkları, Knesset'teki görev dağılımı, "
               "sonuçlara itirazlar, liderlerin ve partilerin (Netanyahu, Eisenkot, Liberman, Ben-Gvir, Smotrich, Arap partileri) hamleleri. "
               "ABD'deki ya da başka ülkelerdeki seçimler bu dosyaya girmez."},
    {"id": "gazze-ateskesi-sari-hat", "ad": "Gazze ateşkesi ve sarı hat", "ad_en": "Gaza ceasefire and the yellow line",
     "kapsam": "Ekim 2025 Gazze ateşkesinden bu yana: ateşkes ihlalleri ve İsrail saldırıları, sarı hat ve İsrail'in denetimindeki bölge, "
               "yardım girişi ve sınır kapıları, esir ve cenaze takasları, ikinci aşama görüşmeleri, uluslararası güç ve Gazze'nin yönetimi."},
    {"id": "bati-seria-yerlesimci", "ad": "Batı Şeria'da yerleşimci saldırıları", "ad_en": "Settler attacks in the West Bank",
     "kapsam": "Batı Şeria'da yerleşimcilerin Filistinlilere, köylere, evlere, tarlalara ve zeytinliklere saldırıları; yerleşim genişlemesi "
               "ve ilhak adımları; bu saldırılara eşlik eden ordu uygulamaları."},
]

DIL_KURALI = ("Dil kuralları: Bölgeye “Orta Doğu” deme (bölge, Batı Asya). Kendi sesinle niyet yükleyen etiket kullanma "
              "(“katil”, “hain”, “terörist” yok); bir tarafın nitelemesini aktarıyorsan tırnak içinde ve kime ait olduğunu söyleyerek. "
              "Ölümleri “öldürüldü” diye yaz, “şehit” deme. İddiaları sahibine bağla (“… açıkladı”, “… bildirildi”). "
              "Verilmeyen bilgiyi ekleme, tahmin yürütme.")

YERLESTIR_TALIMAT = """Alboroto haber sitesinde "dosyalar" var: haftalarca süren büyük olaylar. Her dosyanın dalları var (dosyanın içindeki alt hikâyeler).
Sana dosyalar (kapsamı ve dallarının son olaylarıyla) ve yeni olaylar veriliyor. Her olayı yerleştir.

Kurallar:
- Bir olay ancak dosyanın kapsamına AÇIKÇA giriyorsa o dosyaya konur. Emin değilsen dosya: null.
- Bir olay en çok iki dosyaya girebilir (örneğin Netanyahu'nun İran'a saldırı çağrısı hem İsrail siyaseti hem İran-ABD savaşı dosyasına). İkinciyi yalnızca gerçekten iki dosyanın da konusuysa yaz.
- Dal: olayın dosya içindeki alt hikâyesi. Uygun dal varsa onun kimliğini yaz. Yoksa yeni_dal ver: 2-5 kelimelik, tarafsız, Türkçe ad ("Hürmüz ve deniz ablukası", "Knesset'te görev dağılımı"); ad_en İngilizcesi. Aynı turda yeni açtığın bir dala başka olayları da koyabilirsin: aynı adı yaz.
- Dalları gereksiz bölme: birkaç günde bir haber çıkacak kadar geniş, ama dosyanın tamamı kadar geniş olmayan alt hikâyeler. Bir dosyada en fazla 7 dal olsun.
- Önce mevcut dallara bak; olay bir dala kabaca uyuyorsa oraya koy. Mevcut bir dala benzeyen yeni dal açma ("İsrail'in saldırı hazırlığı" varken "İsrail'in askeri adımları" açma).
- Tek bir olay için dal açma: yeni dal, bu turda en az iki olayı toplayacaksa ya da dosyanın gerçekten yeni bir yüzüyse açılır; tek seferlik ayrıntıyı en yakın dala koy.
- Hiçbir dosyaya girmeyen olaylardan, aynı süren hikâyeye ait en az 3 olay (en az 2 farklı gün) görürsen yeni dosya öner (oneriler). Tek seferlik olaylar için öneri yapma. Önerinin adı tarafsız ve kısa olsun.
- gerekce: en fazla 12 kelime.
""" + DIL_KURALI + """

Yalnızca şu JSON'u döndür:
{"atamalar": [{"olay": "<anahtar>", "dosya": "<dosya kimliği ya da null>", "dal": "<dal kimliği ya da null>", "yeni_dal": {"ad": "...", "ad_en": "..."} ya da null,
  "ikinci": {"dosya": "...", "dal": "... ya da null", "yeni_dal": {...} ya da null} ya da null, "gerekce": "..."}],
 "oneriler": [{"ad": "...", "kapsam": "tek cümle", "olaylar": ["<anahtar>", ...], "gerekce": "..."}]}"""

OZET_TALIMAT = """Alboroto haber sitesi için bir "dosya"nın (süren büyük olay) özetini yaz. Sana dosyanın adı, kapsamı, dalları ve dallardaki olaylar (tarih, başlık, haberi veren yayın sayısı) veriliyor.

- ozet: "Şu ana kadar" paragrafı; 3-5 cümle, Türkçe. Hikâyenin geldiği yeri anlat: en önemli gelişmeler, son durum, hangi dalın ısındığı ya da sustuğu. Tarihleri gün ve ay olarak ver (“12 Kasım”). Yalnızca verilen olaylardan çıkarılabilecekleri yaz.
- ozet_en: aynı paragrafın İngilizcesi.
- onceki: yalnızca istenen dallar için, o dalın “önceki bölümlerde” özeti: iki cümle, Türkçe; dal neden yeniden gündemde, öncesinde ne olmuştu.
""" + DIL_KURALI + """

Yalnızca şu JSON'u döndür: {"ozet": "...", "ozet_en": "...", "onceki": {"<dal kimliği>": "..."}}"""


def _oku(yol, vars_):
    try:
        return json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        return vars_


def _yaz(yol, veri, sik=False):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    gecici = yol + ".tmp"
    with open(gecici, "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":") if sik else None, indent=None if sik else 1)
    os.replace(gecici, yol)


_TR = str.maketrans("çğıöşüâîûÇĞIİÖŞÜÂÎÛ", "cgiosuaiucgiiosuaiu")


def kisa_ad(metin, sinir=48):
    t = re.sub(r"['’‘`´]", "", str(metin or "").translate(_TR).lower())
    t = re.sub(r"[^a-z0-9]+", "-", t).strip("-")
    return t[:sinir].rsplit("-", 1)[0] if len(t) > sinir else t


def yukle(kok):
    d = _oku(os.path.join(kok, DURUM), None)
    if not isinstance(d, dict) or not d.get("dosyalar"):
        bugun = dt.date.today().isoformat()
        d = {"surum": 1, "dosyalar": [{**x, "durum": "acik", "acildi": bugun, "dallar": [], "ozet": "", "ozet_en": "", "ozet_tarih": None}
                                      for x in BASLANGIC],
             "olaylar": {}, "oneriler": [], "islenen": [], "dolduruldu": False}
    d.setdefault("oneriler", []); d.setdefault("islenen", []); d.setdefault("olaylar", {})
    return d


def kaydet(kok, d):
    _yaz(os.path.join(kok, DURUM), d)


def _dosya(d, did):
    return next((x for x in d["dosyalar"] if x["id"] == did), None)


def _dal(ds, dal_id):
    return next((x for x in ds["dallar"] if x["id"] == dal_id), None)


def _dal_ac(ds, ad, ad_en=None, simdi=None):
    ad = ekler.guvenli(ad)[:60]
    if not ad:
        return None
    var = next((x for x in ds["dallar"] if x["ad"].casefold() == ad.casefold()), None)
    if var:
        return var["id"]
    dal_id = kisa_ad(ad, 32) or "dal"
    while _dal(ds, dal_id):
        dal_id += "-" + hashlib.sha1(ad.encode()).hexdigest()[:3]
    ds["dallar"].append({"id": dal_id, "ad": ad, "ad_en": ekler.guvenli(ad_en)[:60] or None,
                         "acildi": (simdi or dt.datetime.now(dt.timezone.utc)).date().isoformat()})
    return dal_id


# ---------------------------------------------------------------- olayları topla

def olaylari_isle(kok, d, olaylar, haberler):
    """Güncel olay kümelerini (data/olaylar.json) ve olay arşivini dosya durumuna işler. Yeni (sorulmamış) olay anahtarlarını döndürür.
    Aynı olay haber kimliklerinden tanınır; anahtar ilk görüldüğü kimlikte kalır."""
    O = d["olaylar"]
    hid_to = {h: k for k, o in O.items() for h in o.get("h", [])}
    yeni = []
    for o in olaylar:
        ids = [x["id"] if isinstance(x, dict) else x for x in o.get("haberler", [])]
        if len(ids) < 2:
            continue
        # aynı olay: haberlerinin en az yarısı (küçük kümeye göre) daha önce görülmüş bir olayda; tek ortak haber yetmez
        aday = {hid_to[i] for i in ids if i in hid_to}
        k = None
        for c in aday:
            ortak = len(set(ids) & set(O[c].get("h", [])))
            if ortak >= 0.5 * min(len(ids), len(O[c].get("h", [])) or 1):
                k = c
                break
        if not k:
            k = o["id"]
            while k in O:
                k += "x"
        kay = O.setdefault(k, {"h": [], "yer": [], "bakildi": False})
        kay["h"] = list(dict.fromkeys(kay["h"] + ids))[-80:]
        for i in ids:
            hid_to[i] = k
        tarihler = [(x.get("t") if isinstance(x, dict) else (haberler.get(x) or {}).get("tarih")) for x in o.get("haberler", [])]
        tarihler = [t for t in tarihler if t] or [o.get("ilk") or o.get("son") or ""]
        kay["b"] = ekler.guvenli(o.get("baslik"))[:160] or kay.get("b")
        kay["b_en"] = ekler.guvenli(o.get("baslik_en"))[:160] or kay.get("b_en")
        kay["not"] = ekler.guvenli(o.get("not"))[:300] or kay.get("not")
        kay["g"] = min([kay.get("g") or "9999"] + [t[:10] for t in tarihler])
        kay["son"] = max([kay.get("son") or ""] + tarihler)
        kay["n"] = len(kay["h"])
        kaynak = {(x.get("k") if isinstance(x, dict) else (haberler.get(x) or {}).get("kaynak")) for x in o.get("haberler", [])}
        kay["k"] = max(kay.get("k") or 0, len({x for x in kaynak if x}))
        if not kay["bakildi"] and k not in yeni:
            yeni.append(k)
    return yeni


def arsivden(kok, d, gun=14):
    """Olay arşivindeki son günlerin olaylarını işler (ilk doldurma)."""
    yeni = []
    for yol in sorted(glob.glob(os.path.join(kok, "data", "olay-arsiv", "*.json")))[-gun:]:
        liste = _oku(yol, [])
        yeni += olaylari_isle(kok, d, liste if isinstance(liste, list) else liste.get("olaylar", []), {})
    return list(dict.fromkeys(yeni))


# ---------------------------------------------------------------- yerleştirme

def _dosya_girdi(d):
    girdi = []
    for ds in d["dosyalar"]:
        if ds.get("durum") != "acik":
            continue
        dallar = []
        for dal in ds["dallar"]:
            ol = sorted([o for o in d["olaylar"].values() if [ds["id"], dal["id"]] in o.get("yer", [])], key=lambda o: o.get("son") or "")[-3:]
            dallar.append({"id": dal["id"], "ad": dal["ad"], "son_olaylar": [f'{o["g"]}: {o.get("b")}' for o in ol]})
        girdi.append({"id": ds["id"], "ad": ds["ad"], "kapsam": ds["kapsam"], "dallar": dallar})
    return girdi


def yerlestir(kok, d, anahtarlar, cagir, simdi, log=print, butce=lambda: True):
    """anahtarlar: sorulacak olaylar. cagir(metin) → (kod, json). Döndürür: (yerleşen, kod)."""
    O = d["olaylar"]
    sira = [k for k in anahtarlar if k in O and not O[k].get("bakildi") and O[k].get("b")]
    sira.sort(key=lambda k: O[k].get("son") or "")
    # dosyaya girmemiş son 7 günün olayları, öneri için bağlam
    esik = (simdi - dt.timedelta(days=7)).date().isoformat()
    yerlesen, kod = 0, 200
    for bas in range(0, len(sira), PARTI):
        if bas and not butce():
            break
        parti = sira[bas:bas + PARTI]
        bos = [k for k, o in O.items() if o.get("bakildi") and not o.get("yer") and (o.get("g") or "") >= esik
               and not o.get("oneride") and k not in parti][-40:]
        girdi = {"dosyalar": _dosya_girdi(d),
                 "yeni_olaylar": [{"anahtar": k, "tarih": O[k]["g"], "baslik": O[k]["b"], "not": (O[k].get("not") or "")[:200]} for k in parti],
                 "dosyasiz_onceki_olaylar": [{"anahtar": k, "tarih": O[k]["g"], "baslik": O[k]["b"]} for k in bos]}
        kod, sonuc = cagir(YERLESTIR_TALIMAT + "\n\n" + json.dumps(girdi, ensure_ascii=False))
        if kod != 200 or not isinstance(sonuc, dict):
            log(f"Dosya yerleştirme yapılamadı ({kod})")
            return yerlesen, kod
        yeni_dal_adi = {}   # (dosya, ad) → dal kimliği; aynı turda aynı adlı yeni dal tek dal olsun

        def yer_bul(did, dal_id, yeni_d):
            ds = _dosya(d, did) if isinstance(did, str) else None
            if not ds or ds.get("durum") != "acik":
                return None
            if isinstance(dal_id, str) and _dal(ds, dal_id):
                return [ds["id"], dal_id]
            if isinstance(yeni_d, dict) and yeni_d.get("ad"):
                anahtar = (ds["id"], str(yeni_d["ad"]).casefold())
                if anahtar not in yeni_dal_adi:
                    yeni_dal_adi[anahtar] = _dal_ac(ds, yeni_d["ad"], yeni_d.get("ad_en"), simdi)
                return [ds["id"], yeni_dal_adi[anahtar]] if yeni_dal_adi[anahtar] else None
            return None

        for a in sonuc.get("atamalar") or []:
            if not isinstance(a, dict) or a.get("olay") not in parti:
                continue
            o = O[a["olay"]]
            yer = []
            y1 = yer_bul(a.get("dosya"), a.get("dal"), a.get("yeni_dal"))
            if y1:
                yer.append(y1)
            ik = a.get("ikinci")
            if y1 and isinstance(ik, dict) and ik.get("dosya") != y1[0]:
                y2 = yer_bul(ik.get("dosya"), ik.get("dal"), ik.get("yeni_dal"))
                if y2:
                    yer.append(y2)
            if not o.get("elle"):
                o["yer"] = yer
            o["gerekce"] = ekler.guvenli(a.get("gerekce"))[:120]
            o["bakildi"] = True
            yerlesen += bool(yer)
        for k in parti:   # yanıtta unutulan olaylar dosyasız sayılır
            O[k]["bakildi"] = True
        for p in sonuc.get("oneriler") or []:
            if not isinstance(p, dict) or not p.get("ad"):
                continue
            ol = [k for k in map(str, p.get("olaylar") or []) if k in O and not O[k].get("yer")]
            if len(ol) < ONERI_ESIGI or len({O[k]["g"] for k in ol}) < 2:
                continue
            ad = ekler.guvenli(p["ad"])[:70]
            if any(x["ad"].casefold() == ad.casefold() for x in d["oneriler"] if x["durum"] == "bekliyor") or any(
                    x["ad"].casefold() == ad.casefold() for x in d["dosyalar"]):
                continue
            pid = "p" + hashlib.sha1((ad + simdi.isoformat()).encode()).hexdigest()[:8]
            d["oneriler"].append({"id": pid, "ad": ad, "kapsam": ekler.guvenli(p.get("kapsam"))[:300], "olaylar": ol,
                                  "gerekce": ekler.guvenli(p.get("gerekce"))[:160], "tarih": simdi.isoformat(), "durum": "bekliyor"})
            for k in ol:
                O[k]["oneride"] = pid
            log(f"Yeni dosya önerisi: {ad} ({len(ol)} olay)")
    return yerlesen, kod


# ---------------------------------------------------------------- durum

def dal_olaylari(d, did, dal_id):
    return sorted([(k, o) for k, o in d["olaylar"].items() if [did, dal_id] in o.get("yer", [])], key=lambda x: (x[1].get("g") or "", x[1].get("son") or ""))


def dal_durumu(olaylar, bugun):
    """(durum, yeniden_gun): sicak ≤2 gün, suruyor ≤7, sessiz; son olay SESSIZ_GUN+ boşluktan sonra geldiyse ve son 3 gündeyse yeniden_gun."""
    if not olaylar:
        return "sessiz", None
    gunler = sorted({o["g"] for _, o in olaylar if o.get("g")})
    son = dt.date.fromisoformat(gunler[-1])
    fark = (bugun - son).days
    durum = "sicak" if fark <= 2 else "suruyor" if fark <= 7 else "sessiz"
    yeniden = None
    if len(gunler) >= 2 and fark <= 3:
        bosluk = (son - dt.date.fromisoformat(gunler[-2])).days
        if bosluk >= SESSIZ_GUN:
            yeniden = bosluk
    return durum, yeniden


# ---------------------------------------------------------------- özetler

def ozetle(d, cagir, simdi, en_cok=3, log=print):
    """Yeni olay almış dosyaların "şu ana kadar" özetini (ve yeniden gündeme gelen dalların "önceki bölümlerde" notunu) yazar."""
    bugun = simdi.date()
    yazilan = 0
    for ds in d["dosyalar"]:
        if yazilan >= en_cok or ds.get("durum") != "acik":
            continue
        tum = [(k, o) for k, o in d["olaylar"].items() if any(y[0] == ds["id"] for y in o.get("yer", []))]
        if not tum:
            continue
        en_son = max(o.get("son") or "" for _, o in tum)
        ot = ds.get("ozet_tarih")
        if ot and (en_son <= ot or (simdi - dt.datetime.fromisoformat(ot)).total_seconds() < 6 * 3600):
            continue
        istenen = []
        dallar = []
        for dal in ds["dallar"]:
            ol = dal_olaylari(d, ds["id"], dal["id"])
            if not ol:
                continue
            durum, yeniden = dal_durumu(ol, bugun)
            if yeniden and not (dal.get("onceki") and dal.get("onceki_tarih", "") >= ol[-1][1]["g"]):
                istenen.append(dal["id"])
            dallar.append({"id": dal["id"], "ad": dal["ad"], "durum": durum,
                           "olaylar": [f'{o["g"]} · {o.get("b")} ({o.get("k") or 2} yayın)' for _, o in ol[-12:]]})
        girdi = {"dosya": ds["ad"], "kapsam": ds["kapsam"], "bugun": bugun.isoformat(), "dallar": dallar,
                 "onceki_ozet": ds.get("ozet") or "", "onceki_istenen_dallar": istenen}
        kod, s = cagir(OZET_TALIMAT + "\n\n" + json.dumps(girdi, ensure_ascii=False))
        if kod != 200 or not isinstance(s, dict) or not s.get("ozet"):
            log(f"Dosya özeti yazılamadı: {ds['ad']} ({kod})")
            if kod == 429:
                break
            continue
        ds["ozet"] = ekler.guvenli(s["ozet"])[:1400]
        ds["ozet_en"] = ekler.guvenli(s.get("ozet_en"))[:1400]
        ds["ozet_tarih"] = simdi.isoformat()
        for dal_id, metin in (s.get("onceki") or {}).items() if isinstance(s.get("onceki"), dict) else []:
            dal = _dal(ds, dal_id)
            if dal and dal_id in istenen and metin:
                dal["onceki"] = ekler.guvenli(metin)[:500]
                dal["onceki_tarih"] = bugun.isoformat()
        yazilan += 1
    return yazilan


# ---------------------------------------------------------------- dalları toparla

TOPARLA_TALIMAT = """Alboroto haber sitesindeki bir "dosya"nın (süren büyük olay) dalları fazla bölünmüş. Sana dalların adı, olay sayısı ve son olayları veriliyor.
Dalları en fazla 7 dala indirecek şekilde birleştirme öner: aynı alt hikâyeyi anlatan ya da tek olaylık dalları en yakın dala kat.
"sabit": true olan dallar editörün elle düzenlediği dallardır: onları başka dala KATMA (onlara katabilirsin), adlarını değiştirme.
Gerekirse birleşen dalın yeni, tarafsız, 2-5 kelimelik adını ver.
""" + DIL_KURALI + """

Yalnızca şu JSON'u döndür: {"birlestir": [{"dal": "<katılacak dal>", "hedef": "<kalacak dal>"}], "ad": [{"dal": "<dal>", "ad": "...", "ad_en": "..."}]}"""


def dal_birlestir(d, ds, kaynak, hedef):
    for o in d["olaylar"].values():
        o["yer"] = [[y[0], hedef] if y == [ds["id"], kaynak] else y for y in o.get("yer", [])]
        o["yer"] = [list(x) for x in dict.fromkeys(tuple(y) for y in o["yer"])]
    ds["dallar"] = [x for x in ds["dallar"] if x["id"] != kaynak]


def toparla(d, cagir, simdi, en_cok=2, log=print):
    """Yedi daldan fazlası ya da üçten fazla tek olaylık dalı olan dosyaların dallarını birleştirir (dosya başına 12 saatte bir)."""
    n = 0
    for ds in d["dosyalar"]:
        if n >= en_cok or ds.get("durum") != "acik":
            continue
        sayi = {x["id"]: len(dal_olaylari(d, ds["id"], x["id"])) for x in ds["dallar"]}
        tekli = sum(1 for v in sayi.values() if v <= 1)
        tt = ds.get("toparla_tarih")
        if not (len(ds["dallar"]) > 7 or tekli > 3) or (tt and (simdi - dt.datetime.fromisoformat(tt)).total_seconds() < 12 * 3600):
            continue
        girdi = {"dosya": ds["ad"], "kapsam": ds["kapsam"], "dallar": [
            {"id": x["id"], "ad": x["ad"], "sabit": bool(x.get("elle")), "olay_sayisi": sayi[x["id"]],
             "son_olaylar": [o.get("b") for _, o in dal_olaylari(d, ds["id"], x["id"])[-3:]]} for x in ds["dallar"]]}
        kod, s = cagir(TOPARLA_TALIMAT + "\n\n" + json.dumps(girdi, ensure_ascii=False))
        ds["toparla_tarih"] = simdi.isoformat()
        n += 1
        if kod != 200 or not isinstance(s, dict):
            continue
        once = len(ds["dallar"])
        for b in s.get("birlestir") or []:
            if not isinstance(b, dict):
                continue
            k, h = _dal(ds, b.get("dal")), _dal(ds, b.get("hedef"))
            if k and h and k["id"] != h["id"] and not k.get("elle"):
                dal_birlestir(d, ds, k["id"], h["id"])
        for a in s.get("ad") or []:
            dal = _dal(ds, (a or {}).get("dal")) if isinstance(a, dict) else None
            if dal and not dal.get("elle") and a.get("ad"):
                dal["ad"] = ekler.guvenli(a["ad"])[:60]
                if a.get("ad_en"):
                    dal["ad_en"] = ekler.guvenli(a["ad_en"])[:60]
        log(f"Dosyalar: {ds['ad']} dalları toparlandı ({once} → {len(ds['dallar'])})")
    return n


# ---------------------------------------------------------------- panel işlemleri

def panel_uygula(d, islemler, simdi, log=print):
    """Panelden gelen işlemleri sırayla uygular. Her işlem bir kez: {id, tur, ...}."""
    yapilan = set(d["islenen"])
    n = 0
    for i in islemler if isinstance(islemler, list) else []:
        if not isinstance(i, dict) or not i.get("id") or i["id"] in yapilan:
            continue
        tur, ds = i.get("tur"), _dosya(d, i.get("dosya")) if i.get("dosya") else None
        O = d["olaylar"]
        try:
            if tur == "oneri_onayla":
                p = next((x for x in d["oneriler"] if x["id"] == i.get("oneri") and x["durum"] == "bekliyor"), None)
                if p:
                    ad = ekler.guvenli(i.get("ad") or p["ad"])[:70]
                    did = kisa_ad(ad, 40) or p["id"]
                    while _dosya(d, did):
                        did += "-2"
                    d["dosyalar"].append({"id": did, "ad": ad, "ad_en": ekler.guvenli(i.get("ad_en"))[:70] or None,
                                          "kapsam": ekler.guvenli(i.get("kapsam") or p["kapsam"])[:400], "durum": "acik",
                                          "acildi": simdi.date().isoformat(), "dallar": [], "ozet": "", "ozet_en": "", "ozet_tarih": None})
                    p["durum"], p["dosya"] = "onaylandi", did
                    for k in p["olaylar"]:   # yeni dosyanın dallarına yerleşsinler diye yeniden sorulur
                        if k in O:
                            O[k]["bakildi"] = False
                            O[k].pop("oneride", None)
            elif tur == "oneri_reddet":
                p = next((x for x in d["oneriler"] if x["id"] == i.get("oneri")), None)
                if p:
                    p["durum"] = "reddedildi"
            elif tur == "dosya_ekle" and i.get("ad") and i.get("kapsam"):
                ad = ekler.guvenli(i["ad"])[:70]
                did = kisa_ad(ad, 40)
                if did and not _dosya(d, did):
                    d["dosyalar"].append({"id": did, "ad": ad, "ad_en": ekler.guvenli(i.get("ad_en"))[:70] or None,
                                          "kapsam": ekler.guvenli(i["kapsam"])[:400], "durum": "acik", "acildi": simdi.date().isoformat(),
                                          "dallar": [], "ozet": "", "ozet_en": "", "ozet_tarih": None})
            elif tur == "dosya_duzenle" and ds:
                for a in ("ad", "ad_en", "kapsam"):
                    if i.get(a):
                        ds[a] = ekler.guvenli(i[a])[:400 if a == "kapsam" else 70]
            elif tur in ("dosya_kapat", "dosya_ac") and ds:
                ds["durum"] = "kapali" if tur == "dosya_kapat" else "acik"
            elif tur == "dal_duzenle" and ds and _dal(ds, i.get("dal")):
                dal = _dal(ds, i["dal"])
                for a in ("ad", "ad_en"):
                    if i.get(a):
                        dal[a] = ekler.guvenli(i[a])[:60]
                dal["elle"] = True
            elif tur == "dal_birlestir" and ds and _dal(ds, i.get("dal")) and _dal(ds, i.get("hedef")) and i["dal"] != i["hedef"]:
                dal_birlestir(d, ds, i["dal"], i["hedef"])
                _dal(ds, i["hedef"])["elle"] = True
            elif tur == "dal_ekle" and ds and i.get("ad"):
                dal_id = _dal_ac(ds, i["ad"], i.get("ad_en"), simdi)
                if dal_id:
                    _dal(ds, dal_id)["elle"] = True
            elif tur == "olay_tasi" and i.get("olay") in O and ds:
                o = O[i["olay"]]
                dal_id = i.get("dal") if _dal(ds, i.get("dal")) else _dal_ac(ds, i.get("yeni_dal") or "", None, simdi)
                if dal_id:
                    o["yer"] = [y for y in o.get("yer", []) if y[0] != ds["id"] and y[0] != i.get("eski_dosya")] + [[ds["id"], dal_id]]
                    o["yer"] = o["yer"][-2:]
                    o["elle"] = True
            elif tur == "olay_cikar" and i.get("olay") in O:
                o = O[i["olay"]]
                o["yer"] = [y for y in o.get("yer", []) if y[0] != i.get("dosya")]
                o["elle"] = True
            else:
                log(f"Panel işlemi uygulanamadı: {tur}")
        except Exception as e:
            log(f"Panel işlemi hatası ({tur}): {e}")
        yapilan.add(i["id"])
        d["islenen"].append(i["id"])
        n += 1
    d["islenen"] = d["islenen"][-1000:]
    # boş kalan dalları temizle (elle açılmışlar en az bir gün kalır)
    for ds in d["dosyalar"]:
        dolu = {y[1] for o in d["olaylar"].values() for y in o.get("yer", []) if y[0] == ds["id"]}
        ds["dallar"] = [x for x in ds["dallar"] if x["id"] in dolu or x.get("acildi", "") >= (simdi.date() - dt.timedelta(days=1)).isoformat()]
    return n


# ---------------------------------------------------------------- budama ve site verisi

def buda(d, simdi):
    """Yerleştirilmiş ama dosyasız ve önerisiz kalan olayları 10 gün sonra unutur; dosyadaki ve henüz sorulmamış olaylar kalır."""
    esik = (simdi - dt.timedelta(days=10)).date().isoformat()
    for k in [k for k, o in d["olaylar"].items() if o.get("bakildi") and not o.get("yer") and not o.get("oneride") and (o.get("g") or "") < esik]:
        del d["olaylar"][k]
    d["oneriler"] = [p for p in d["oneriler"] if p["durum"] == "bekliyor" or (p.get("tarih") or "") >= esik]


def site_verisi(kok, d, simdi, sayfa_adi=None):
    """data/dosyalar-site.json: açık dosyalar, dallar (durum, olaylar), haber kimliği → [dosya, dal]."""
    bugun = simdi.date()
    cikti, harita = [], {}
    adlar = {x["id"]: x["ad"] for x in d["dosyalar"] if x.get("durum") == "acik"}
    for ds in d["dosyalar"]:
        if ds.get("durum") != "acik":
            continue
        dallar = []
        for dal in ds["dallar"]:
            ol = dal_olaylari(d, ds["id"], dal["id"])
            if not ol:
                continue
            durum, yeniden = dal_durumu(ol, bugun)
            olaylar = []
            for k, o in ol:
                link = None
                if sayfa_adi:
                    link = next((sayfa_adi(h) for h in o.get("h", []) if sayfa_adi(h)), None)
                olaylar.append({"a": k, "b": o.get("b"), "be": o.get("b_en"), "g": o.get("g"), "n": o.get("n"), "k": o.get("k"),
                                "s": link, "x": [adlar[y[0]] for y in o.get("yer", []) if y[0] != ds["id"] and y[0] in adlar]})
                if (o.get("son") or "")[:10] >= (bugun - dt.timedelta(days=8)).isoformat():
                    for h in o.get("h", []):
                        harita.setdefault(h, [ds["id"], dal["id"]])
            dallar.append({"id": dal["id"], "ad": dal["ad"], "ad_en": dal.get("ad_en"), "durum": durum, "yeniden": yeniden,
                           "onceki": dal.get("onceki") if yeniden else None, "olaylar": olaylar})
        if not dallar:
            continue
        dallar.sort(key=lambda x: x["olaylar"][-1]["g"], reverse=True)
        tum = [o for x in dallar for o in x["olaylar"]]
        gunluk = {}
        for o in {o["a"]: o for o in tum}.values():
            gunluk[o["g"]] = gunluk.get(o["g"], 0) + 1
        nabiz = [gunluk.get((bugun - dt.timedelta(days=13 - i)).isoformat(), 0) for i in range(14)]
        son = max(tum, key=lambda o: (o["g"], o["a"]))
        cikti.append({"id": ds["id"], "ad": ds["ad"], "ad_en": ds.get("ad_en"), "ozet": ds.get("ozet"), "ozet_en": ds.get("ozet_en"),
                      "ozet_tarih": ds.get("ozet_tarih"), "ilk": min(o["g"] for o in tum), "son": son["g"], "son_b": son["b"], "son_be": son.get("be"),
                      "olay": len({o["a"] for o in tum}), "sicak": sum(1 for x in dallar if x["durum"] == "sicak"), "nabiz": nabiz,
                      "dallar": dallar})
    cikti.sort(key=lambda x: (x["son"], x["sicak"], sum(x["nabiz"][-3:])), reverse=True)
    veri = {"guncellendi": simdi.isoformat(), "dosyalar": cikti, "haber": harita}
    _yaz(os.path.join(kok, SITE), veri, sik=True)
    return veri


# ---------------------------------------------------------------- dosya sayfaları (d/<kimlik>.html)

def _e(s):
    return html.escape(str(s or ""), quote=True)


AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def _gun(g):
    try:
        t = dt.date.fromisoformat(g)
        return f"{t.day} {AY[t.month - 1]}"
    except (TypeError, ValueError):
        return g or ""


DURUM_AD = {"sicak": "sıcak", "suruyor": "sürüyor", "sessiz": "sessiz"}


def sayfalar_yaz(kok, veri, site_adres, surum):
    """Her açık dosya için d/<kimlik>.html (arama motoru ve paylaşım için içerik sayfada yazılı) ve d/index.html."""
    klasor = os.path.join(kok, "data", "d")
    os.makedirs(klasor, exist_ok=True)
    yazilan = set()
    for ds in veri["dosyalar"]:
        dal_html = []
        for dal in ds["dallar"]:
            rozet = f'<span class="ds-rozet ds-{dal["durum"]}">{DURUM_AD[dal["durum"]]}</span>'
            if dal.get("yeniden"):
                rozet += f'<span class="ds-rozet ds-geri">{dal["yeniden"]} gün sonra yeniden gündemde</span>'
            ol = "".join(
                f'<li><time datetime="{_e(o["g"])}">{_e(_gun(o["g"]))}</time>'
                + (f'<a href="../h/{_e(o["s"])}">{_e(o["b"])}</a>' if o.get("s") else f'<span>{_e(o["b"])}</span>')
                + f'<small>{int(o.get("k") or 0)} yayın</small></li>' for o in reversed(dal["olaylar"]))
            onceki = f'<p class="ds-onceki"><b>Önceki bölümlerde.</b> {_e(dal["onceki"])}</p>' if dal.get("onceki") else ""
            dal_html.append(f'<section class="ds-dal" id="dal-{_e(dal["id"])}"><div class="ds-dal-bas"><h3>{_e(dal["ad"])}</h3>{rozet}</div>'
                            f'{onceki}<ol class="ds-olaylar">{ol}</ol></section>')
        ozet = ds.get("ozet") or ""
        aciklama = (ozet[:200].rsplit(" ", 1)[0] + "…") if len(ozet) > 200 else ozet or f'{ds["ad"]}: süren gelişmeler, dallarıyla birlikte.'
        adres = f'{site_adres}d/{ds["id"]}.html'
        veri_js = json.dumps({k: ds[k] for k in ("id", "ad", "dallar", "ilk", "son")}, ensure_ascii=False).replace("</", "<\\/")
        sayfa = f'''<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://zbshaber.goatcounter.com; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="theme-color" content="#faf8f4">
<title>{_e(ds["ad"])} | Alboroto</title>
<meta name="description" content="{_e(aciklama)}">
<link rel="canonical" href="{_e(adres)}">
<meta property="og:title" content="{_e(ds["ad"])}">
<meta property="og:description" content="{_e(aciklama)}">
<meta property="og:url" content="{_e(adres)}">
<meta property="og:image" content="{_e(site_adres)}site/paylas-2026.png">
<link rel="icon" href="../site/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=JetBrains+Mono:wght@500;600&display=swap">
<link rel="stylesheet" href="../site/haber.css?v={surum}">
<link rel="stylesheet" href="../site/dosya.css?v={surum}">
</head>
<body class="ds-govde">
<header class="mk-bas"><div class="mk-bas-ic"><a class="mk-logo" href="../"><img src="../site/logo.svg" alt="" width="32" height="32"><b>Alboroto</b><span>Haberin haberi</span></a>
<nav class="mk-menu"><a href="../">Akış</a><a href="./">Dosyalar</a><a href="../arsiv.html">Arşiv</a><a href="../raporlar.html">Raporlar</a><a href="../almanak.html">Almanak</a></nav></div></header>
<main class="ds">
<p class="ds-etiket">Dosya · {_e(_gun(ds["ilk"]))}’den bu yana · {ds["olay"]} olay</p>
<h1>{_e(ds["ad"])}</h1>
{f'<div class="ds-suana"><span>Şu ana kadar</span><p>{_e(ozet)}</p></div>' if ozet else ''}
<div class="ds-serit-kap" id="dsSerit" hidden></div>
<div class="ds-secili" id="dsSecili" hidden></div>
<div class="ds-dallar">{"".join(dal_html)}</div>
<p class="ds-not">Olayları dallara yapay zekâ yerleştiriyor, editör denetliyor. Her olay birden çok yayının aynı gelişmeyi nasıl anlattığının karşılaştırmasıdır; başlığa basınca karşılaştırma açılır.</p>
</main>
<script type="application/json" id="dsVeri">{veri_js}</script>
<script src="../site/dosya.js?v={surum}"></script>
</body>
</html>
'''
        yol = os.path.join(klasor, ds["id"] + ".html")
        try:
            eski = open(yol, encoding="utf-8").read()
        except OSError:
            eski = None
        if eski != sayfa:
            with open(yol, "w", encoding="utf-8") as f:
                f.write(sayfa)
        yazilan.add(ds["id"] + ".html")
    # dizin
    kartlar = "".join(
        f'<a class="ds-kart" href="{_e(ds["id"])}.html"><b>{_e(ds["ad"])}</b><span>{ds["olay"]} olay · {len(ds["dallar"])} dal'
        f'{" · " + str(ds["sicak"]) + " sıcak" if ds["sicak"] else ""}</span><small>Son: {_e(_gun(ds["son"]))} · {_e(ds["son_b"])}</small></a>'
        for ds in veri["dosyalar"])
    dizin = f'''<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="theme-color" content="#faf8f4"><title>Dosyalar | Alboroto</title>
<meta name="description" content="Süren büyük olaylar, dallarıyla birlikte: her gelişme, onu haber yapan yayınların karşılaştırmasıyla.">
<link rel="canonical" href="{_e(site_adres)}d/"><link rel="icon" href="../site/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="../site/haber.css?v={surum}"><link rel="stylesheet" href="../site/dosya.css?v={surum}"></head>
<body class="ds-govde"><header class="mk-bas"><div class="mk-bas-ic"><a class="mk-logo" href="../"><img src="../site/logo.svg" alt="" width="32" height="32"><b>Alboroto</b><span>Haberin haberi</span></a>
<nav class="mk-menu"><a href="../">Akış</a><a href="./" aria-current="page">Dosyalar</a><a href="../arsiv.html">Arşiv</a><a href="../raporlar.html">Raporlar</a></nav></div></header>
<main class="ds"><p class="ds-etiket">Süren olaylar</p><h1>Dosyalar</h1><div class="ds-dizin">{kartlar}</div></main></body></html>
'''
    with open(os.path.join(klasor, "index.html"), "w", encoding="utf-8") as f:
        f.write(dizin)
    yazilan.add("index.html")
    for f in os.listdir(klasor):   # kapanan dosyaların sayfası kalır (paylaşılmış bağlantılar kırılmasın); yalnızca geçici dosyalar silinir
        if f.endswith(".tmp"):
            os.remove(os.path.join(klasor, f))
    return len(yazilan)


# ---------------------------------------------------------------- yeniden gündem bildirimi

def yeniden_gundem(d, veri, simdi):
    """Bu turda yeniden gündeme gelen dallar (her dal için olay başına bir kez): [(dosya, dal, gün, son olay)]."""
    bil = d.setdefault("bildirildi", {})
    cikti = []
    for ds in veri["dosyalar"]:
        for dal in ds["dallar"]:
            if dal.get("yeniden") and dal["olaylar"]:
                son = dal["olaylar"][-1]
                anahtar = f'{ds["id"]}/{dal["id"]}'
                if bil.get(anahtar) != son["a"]:
                    bil[anahtar] = son["a"]
                    cikti.append((ds, dal, dal["yeniden"], son))
    return cikti


# ---------------------------------------------------------------- tur

def calistir(kok, olaylar, haberler, cagir_yer, cagir_ozet, simdi, panel_yolu=None, butce=lambda: True, log=print):
    """topla.py her turda çağırır. Döndürür: (site verisi, yeniden gündeme gelenler)."""
    d = yukle(kok)
    if panel_yolu and os.path.exists(panel_yolu):
        n = panel_uygula(d, _oku(panel_yolu, []), simdi, log=log)
        if n:
            log(f"Panel: {n} işlem uygulandı")
    yeni = olaylari_isle(kok, d, olaylar, haberler)
    if not d.get("dolduruldu"):
        yeni = arsivden(kok, d) + yeni
    sorulacak = [k for k, o in d["olaylar"].items() if not o.get("bakildi")]
    if sorulacak and not (cagir_yer and butce()):
        log(f"Dosyalar: {len(sorulacak)} olay sırada; " + ("yapay zekâ şu an kapalı" if not cagir_yer else "süre ya da istek sınırı") + ", sonraki tura kaldı")
    if sorulacak and cagir_yer and butce():
        # ilk doldurmada bütün arşiv tek turda (en çok 8 çağrı); sonra turda en çok bir parti
        sinir = PARTI * 2
        n, kod = yerlestir(kok, d, sorulacak[-sinir:] if d.get("dolduruldu") else sorulacak[:sinir], cagir_yer, simdi, log=log, butce=butce)
        log(f"Dosyalar: {len(sorulacak[:sinir])} olaya bakıldı, {n} olay dosyaya girdi")
        if kod == 200 and not any(not o.get("bakildi") for o in d["olaylar"].values()):
            d["dolduruldu"] = True
    if cagir_yer and butce():
        try:
            toparla(d, cagir_yer, simdi, log=log)
        except Exception as e:
            log(f"Dal toparlama hatası: {e}")
    if cagir_ozet and butce():
        try:
            n = ozetle(d, cagir_ozet, simdi, en_cok=2, log=log)
            if n:
                log(f"Dosyalar: {n} dosyanın özeti yazıldı")
        except Exception as e:
            log(f"Dosya özeti hatası: {e}")
    buda(d, simdi)
    kaydet(kok, d)
    return d
