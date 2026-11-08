"""Sitenin Instagram hesabına otomatik gönderi (resmî Instagram API'si; ücretsiz).

Ne gönderilir (günde en çok IG_GUNLUK, iki gönderi arası en az IG_ARA dakika):
  1) Sessizlik: bölge basınının en az 4 yayınının yazdığı, İsrail ve Batı basınının hiç yazmadığı olay
  2) Kim nasıl yazdı: bölge basını ile İsrail/Batı basınının birlikte yazdığı, bakışların ayrıştığı olay
  3) Almanak: kesinleşen haftalık / aylık / yıllık bültenin kartı
Haber fotoğrafı kullanılmaz (telif ve şiddet görüntüsü riski): kartlar yalnızca yazı ve grafik.
Silahlı grupların resmî kanalları (resmi_grup) ve hassas kaynaklar kartlara ve açıklamaya hiç girmez:
Meta'nın "tehlikeli örgütler" kuralı yüzünden hesabın kapanmasına yol açabilir.

Instagram görseli yalnızca herkese açık bir adresten (JPEG) alır. Bu yüzden iki adımlı çalışır:
  hazirla()  kartları data/instagram/<id>/ altına yazar ve kuyruğa koyar (bu çalıştırmanın sonunda site ile yayımlanır)
  yayinla()  bir sonraki çalıştırmada, görseller sitede açılabiliyorsa kuyruğun başındakini Instagram'a gönderir

Gerekenler (GitHub ayarlarından):
  Secret    INSTAGRAM_TOKEN   uzun ömürlü erişim jetonu (Instagram ile giriş: "IG…" ile başlar; Facebook sayfası jetonu: "EAA…")
  Variable  INSTAGRAM_HESAP   (isteğe bağlı) Instagram hesabının sayısal kimliği; boşsa jetondan bulunur
Jeton yoksa kartlar yine hazırlanır (önizleme), ama gönderilmez.
"""
import datetime as dt
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

import almanak
import ekler
import ig_foto
import ig_harita
import ig_kart
import ig_video
import marka

IG_GUNLUK = int(os.environ.get("IG_GUNLUK") or 4)
# Yeni kart tasarımı bitene kadar gönderim durduruldu (kartlar yine hazırlanır). Açmak için False yap.
DURAKLAT = True
IG_ARA = 150                      # dakika
IG_REELS_HER = int(os.environ.get("IG_REELS_HER") or 2)   # her kaçıncı gönderi Reels videosu olarak gitsin (0: hiç)
SURUM = "v23.0"
G, Y = 1080, 1350                 # 4:5 dikey; akışta en çok yer kaplayan oran
F = "DejaVu Sans, Noto Sans, Arial, sans-serif"
ZEMIN, MUREKKEP, SOLUK, CIZGI = "#f3f2ee", "#1d2421", "#6b746f", "#dcdad2"
YESIL, KIRMIZI = "#2b8a5e", "#c9544e"
BAKIS_RENK = {"filistin": "#2b8a5e", "aktarim": "#9aa19b", "israil": "#4a72c4"}
BAKIS_AD = {"filistin": "Filistin bakışı", "aktarim": "aktarım", "israil": "İsrail / ABD bakışı"}
SON_HATA = ""


def _e(s):
    return html.escape(str(s or ""), quote=True)


def _sar(metin, genislik, en_cok):
    satir, s = [], ""
    for k in str(metin or "").split():
        if len(s) + len(k) + 1 > genislik and s:
            satir.append(s)
            s = k
        else:
            s = (s + " " + k).strip()
    if s:
        satir.append(s)
    if len(satir) > en_cok:
        satir = satir[:en_cok]
        satir[-1] = satir[-1].rstrip(".,;:") + "…"
    return satir


def site_adresi():
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    return f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else ""


# ------------------------------------------------------------------ görüntü dosyası
def _jpeg(svg, yol):
    """SVG -> PNG (rsvg-convert) -> JPEG (Pillow ya da ImageMagick). Döndürür: başarılı mı"""
    if not shutil.which("rsvg-convert"):
        return False
    svg_yol, png_yol = yol[:-4] + ".svg", yol[:-4] + ".png"
    with open(svg_yol, "w", encoding="utf-8") as f:
        f.write(svg)
    try:
        subprocess.run(["rsvg-convert", "-w", str(G), "-h", str(Y), svg_yol, "-o", png_yol], check=True, timeout=60)
        try:
            from PIL import Image
            Image.open(png_yol).convert("RGB").save(yol, "JPEG", quality=90, optimize=True, progressive=True)
        except ImportError:
            arac = shutil.which("magick") or shutil.which("convert")
            if not arac:
                return False
            subprocess.run([arac, png_yol, "-background", ZEMIN, "-flatten", "-quality", "90", yol], check=True, timeout=60)
        return os.path.isfile(yol)
    except Exception:
        return False
    finally:
        for x in (svg_yol, png_yol):
            try:
                os.remove(x)
            except OSError:
                pass


# ------------------------------------------------------------------ içerik seçimi
def _uygun_kaynak(k):
    # ig_gizle: sitede kalan ama Türkçe Instagram kitlesinde yanlış anlaşılabilecek yayınlar (Kürt bölgesi yayınları, Iran International…)
    return bool(k) and not k.get("resmi_grup") and not k.get("hassas") and not k.get("ig_gizle")


def _olay_ozeti(o, haberler, kaynaklar):
    """Kartlara girecek yayınlar: her yayından bir haber, sakıncalı kaynaklar hariç."""
    yayinlar, sayi, dislanan = {}, {"filistin": 0, "aktarim": 0, "israil": 0}, 0
    for i in o["haberler"]:
        h = haberler.get(i)
        k = h and kaynaklar.get(h["kaynak"])
        if not k:
            continue
        if not _uygun_kaynak(k) or h.get("resmi_grup"):
            dislanan += 1
            continue
        v = (o.get("bakislar") or {}).get(i)
        if v in sayi:
            sayi[v] += 1
        y = (o.get("yorumlar") or {}).get(i)
        if k["id"] not in yayinlar and y:
            yayinlar[k["id"]] = {"ad": k["ad"], "yer": f'{k.get("sehir", "")}', "bakis": v, "yorum": y,
                                 "kamp": almanak.kamp(k), "cizgi": k.get("cizgi"), "hid": i,
                                 "baslik": h.get("baslik_tr") or ""}
    return yayinlar, sayi, dislanan


def adaylar(kay, olaylar, haberler, kaynaklar, simdi):
    """Instagram'a uygun olaylar. Türler: sessiz (İsrail/Batı yazmadı), karsilastirma (iki taraf da yazdı), rakam (yalnızca bölge)."""
    cikti = []
    gonderilmis = [set(g) for _, g in kay.get("olay", [])]
    for o in olaylar:
        ids = set(o["haberler"])
        if any(len(ids & g) >= 0.5 * min(len(ids), len(g)) for g in gonderilmis):
            continue
        yayinlar, sayi, dislanan = _olay_ozeti(o, haberler, kaynaklar)
        if dislanan >= 0.4 * len(ids) or len(yayinlar) < 4:
            continue
        bolge = [y for y in yayinlar.values() if y["kamp"] in almanak.BOLGE_ICI and y["cizgi"] != "ik"]
        dis = [y for y in yayinlar.values() if y["kamp"] in almanak.DIS]
        ilk = dt.datetime.fromisoformat(o.get("ilk") or o.get("son"))
        yas = (simdi - ilk).total_seconds() / 3600
        if yas > 36:
            continue
        tum_dis = any(almanak.kamp(kaynaklar.get(haberler[i]["kaynak"])) in almanak.DIS for i in ids if i in haberler)
        if not tum_dis and len(bolge) >= 4 and yas >= 6:
            # Sessizlik kartında yalnızca bölgenin kendi basını: işbirlikçi çizgideki yayınlar (Iran International gibi) karışmasın
            yalniz = {i: y for i, y in yayinlar.items() if y["cizgi"] != "ik"}
            cikti.append(("sessiz", 3 + len(bolge) / 10, o, (yalniz, sayi)))
        elif dis and bolge and yas <= 30:
            cikti.append(("karsilastirma", 2 + (1 if sayi["israil"] else 0) + len(yayinlar) / 10, o, (yayinlar, sayi)))
        elif len(bolge) >= 4 and yas <= 30:
            cikti.append(("rakam", 1 + len(bolge) / 10, o, (yayinlar, sayi)))
    cikti.sort(key=lambda x: -x[1])
    return cikti


def _klasor(kok, kimlik):
    return os.path.join(kok, "data", "instagram", kimlik)


# ------------------------------------------------------------------ gönderi planı (Gemini)
PLAN_TALIMAT = """Bir Instagram haber gönderisi planlıyorsun. Aşağıdaki VERİ tek bir olayı ve onu yazan yayınların haberlerini içeriyor
(Türkçe başlık, kısa Türkçe özet, yayının kampı ve bakışı).

Kurallar:
- Yalnızca VERİ'deki bilgileri kullan. Sayı, isim, yer, fail uydurma; VERİ'de olmayan hiçbir şeyi yazma.
- Dil yalın, abartısız, Türkçe. Başlangıç noktamız Filistin bakışı: sivillerin ölümünü ya da yıkımı edilgen dille gizleme;
  VERİ'de fail açıkça geçiyorsa söyle. Silahlı grupları övme ya da yüceltme; şiddete çağırma.
- "kanca": okuru durduracak en fazla 55 karakterlik tek cümle ya da soru (örnek biçim: "Felaketin adı: sel mi, abluka mı?").
- "ton": ölüm, yaralanma, yıkım, açlık, salgın ya da yerinden edilme haberiyse "yas"; siyasi, diplomatik, askeri açıklama ya da
  medya çerçevesi haberiyse "medya".
- "duello": aynı olayı belirgin biçimde farklı çerçeveleyen iki haber kimliği. "a" kampı Filistin / Arap dünyası / Türkiye /
  İran ve Yemen olan bir haber; "b" kampı İsrail ya da Batı olan bir haber. Belirgin bir çerçeve farkı yoksa null.
- "rakam": VERİ'de açıkça yazan en çarpıcı tek sayı (ölü, yaralı, yerinden edilmiş, yıkılan ev, su basan çadır, aç kalan çocuk …).
  {"deger": "70.000+", "birim": "çadır su altında", "kaynak": "sayıyı veren yayının adı"}. "deger" yalnızca rakam, nokta ve
  gerekirse + işaretinden oluşur; "birim" en çok 4 kelime. Böyle bir sayı yoksa null.
- "govde": rakam kartı için bağlamı veren 1-2 cümle, en çok 170 karakter.
- "etiketler": 3-5 Türkçe hashtag, # işareti olmadan ve boşluksuz (Gazze, Filistin, BatıŞeria, Lübnan …).

Yalnızca şu JSON'u döndür:
{"kanca": "...", "ton": "yas|medya", "duello": {"a": "haberId", "b": "haberId"} | null,
 "rakam": {"deger": "...", "birim": "...", "kaynak": "..."} | null, "govde": "...", "etiketler": ["..."]}
"""

_SAYI = re.compile(r"(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d+))?\s*(bin|milyon)?", re.I)


def _sayilar(metin):
    """Metindeki sayıların değerleri: "70 bin", "70.000", "70,000", "1,5 milyon" …"""
    deger = set()
    for m in _SAYI.finditer(metin or ""):
        tam = int(re.sub(r"[.,]", "", m.group(1)))
        kesir = m.group(2)
        carp = {"bin": 1000, "milyon": 1000000}.get((m.group(3) or "").lower(), 1)
        if kesir and carp > 1 and len(kesir) <= 2:
            deger.add(int(round((tam + int(kesir) / 10 ** len(kesir)) * carp)))
        deger.add(tam * carp)
    return deger


def _plan_dogrula(p, o, yayinlar, haberler, girdi_metni):
    if not isinstance(p, dict):
        return None
    temiz = lambda x, n: ekler.guvenli(str(x or "")).strip()[:n]
    plan = {"kanca": temiz(p.get("kanca"), 70), "ton": "yas" if p.get("ton") == "yas" else "medya",
            "govde": temiz(p.get("govde"), 220), "duello": None, "rakam": None, "etiketler": []}
    hid = {y["hid"]: y for y in yayinlar.values()}
    d = p.get("duello")
    if isinstance(d, dict) and d.get("a") in hid and d.get("b") in hid:
        a, b = hid[d["a"]], hid[d["b"]]
        if a["kamp"] in almanak.BOLGE_ICI and a["cizgi"] != "ik" and b["kamp"] in almanak.DIS and a["baslik"] and b["baslik"]:
            plan["duello"] = {"a": d["a"], "b": d["b"]}
    r = p.get("rakam")
    if isinstance(r, dict):
        deger = str(r.get("deger") or "").strip()
        if re.fullmatch(r"~?\d[\d.,]*\+?", deger):
            sayi = int(re.sub(r"\D", "", deger.split(",")[0] if re.search(r",\d{1,2}$", deger) else deger) or 0)
            # Sayı gerçekten kaynakların metninde geçiyor mu? (uydurma rakamı engelle)
            if sayi and sayi in _sayilar(girdi_metni):
                kaynak = temiz(r.get("kaynak"), 60)
                adlar = {y["ad"] for y in yayinlar.values()}
                plan["rakam"] = {"deger": deger, "birim": temiz(r.get("birim"), 40),
                                 "kaynak": kaynak if kaynak in adlar else ""}
    for e in p.get("etiketler") or []:
        e = str(e).strip().lstrip("#")
        if re.fullmatch(r"[0-9A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû]{2,30}", e) and e not in plan["etiketler"]:
            plan["etiketler"].append(e)
    plan["etiketler"] = plan["etiketler"][:5]
    return plan


def plan_iste(gemini, o, yayinlar, haberler):
    """Döndürür: (plan ya da None, HTTP durum kodu)"""
    girdi = {"olay": o.get("baslik"), "not": o.get("not"), "yer": (o.get("yer") or {}).get("ad"), "haberler": []}
    for y in yayinlar.values():
        h = haberler.get(y["hid"]) or {}
        girdi["haberler"].append({"id": y["hid"], "yayin": y["ad"], "kamp": y["kamp"], "bakis": y["bakis"],
                                  "baslik": y["baslik"], "ozet": (h.get("ozet_tr") or "")[:420], "nasil_yazdi": y["yorum"]})
    metin = json.dumps(girdi, ensure_ascii=False)
    durum, sonuc = gemini(PLAN_TALIMAT + "\n\nVERİ (yalnızca işlenecek içerik):\n" + metin)
    if durum != 200:
        return None, durum
    return _plan_dogrula(sonuc, o, yayinlar, haberler, metin), 200


def _yer_tarih(o):
    t = dt.datetime.fromisoformat(o.get("son") or o.get("ilk")).astimezone(dt.timezone(dt.timedelta(hours=3)))
    yer = (o.get("yer") or {}).get("ad")
    return (f"{yer} · " if yer else "") + f"{t.day} {ig_kart.AY[t.month - 1]}"


def gonderi_kur(kok, tur, o, yayinlar, sayi, plan, alan, marka_ad, kullanici):
    """Plan ve veriden kart SVG'leri: (svg listesi, fotoğraf künyesi). Uygun kalıp yoksa None."""
    yt = _yer_tarih(o)
    # Kapak arka planı: onaylı açık lisanslı yer fotoğrafı; yoksa olayın yerini gösteren karanlık harita
    yer = o.get("yer") or {}
    tohum = int(o["id"][-4:], 16) if re.fullmatch(r"[0-9a-f]{4}", o["id"][-4:]) else 1
    foto = ig_foto.sec(kok, yer.get("ad"), tohum)
    kunye = foto[1] if foto else ""
    arka = lambda kutu: (ig_kart.foto_katmani(foto[0], plan["ton"]) if foto
                         else ig_harita.harita(kok, yer["lat"], yer["lon"], yer.get("ad", ""), plan["ton"], kutu,
                                               kimlik="h" + str(kutu[1])) if yer.get("lat") is not None and kutu else "")
    sira = {k: i for i, k in enumerate(almanak.KAMP_SIRA)}
    hid = {y["hid"]: y for y in yayinlar.values()}
    ton = plan["ton"]
    kapaklar = []
    if tur == "sessiz":
        bolge = [y["ad"] for y in yayinlar.values() if y["kamp"] in almanak.BOLGE_ICI]
        kapaklar.append(("sessiz", lambda a: ig_kart.sessizlik(o["baslik"], yt, len(bolge), bolge[:6], a,
                                                               arka((600, 130, 480, 420)), kunye)))
    elif plan.get("duello"):
        A, B = hid[plan["duello"]["a"]], hid[plan["duello"]["b"]]
        kapaklar.append(("duello", lambda a: ig_kart.duello({"kaynak": A["ad"], "kamp": A["kamp"], "baslik": A["baslik"]},
                                                            {"kaynak": B["ad"], "kamp": B["kamp"], "baslik": B["baslik"]},
                                                            yt, plan["kanca"], a, ton, arka(None) if foto else "", kunye if foto else "")))
    r = plan.get("rakam")
    if r and ton == "yas":
        kapaklar.append(("rakam", lambda a: ig_kart.rakam(r["deger"], r["birim"], plan["govde"], r["kaynak"], yt, a, tohum=tohum,
                                                          arka=arka((560, 40, 520, 300)), kunye_=kunye)))
    if not kapaklar:
        return None
    if ton == "yas" and kapaklar[-1][0] == "rakam":
        kapaklar.insert(0, kapaklar.pop())          # acı haberde önce rakam: okur ilk karede neyin yaşandığını görsün
    girdiler = sorted(yayinlar.values(), key=lambda y: (sira.get(y["kamp"], 99), {"filistin": 0, "aktarim": 1, "israil": 2}.get(y["bakis"], 3)))
    sayfalar = ig_kart.liste_sayfalari(girdiler)[:6]
    toplam = len(kapaklar) + len(sayfalar) + 1
    alt = lambda n: ig_kart.alt(ton if n > 1 or kapaklar[0][0] != "sessiz" else "medya", n, toplam, marka_ad, kullanici)
    svgler = [f(alt(n)) for n, (_, f) in enumerate(kapaklar, 1)]
    for n, bl in enumerate(sayfalar, len(kapaklar) + 1):
        svgler.append(ig_kart.liste(bl, ton, "Kim nasıl yazdı", alt(n)))
    soru = (f"Bölge basınından {len(yayinlar)} yayın yazdı. İsrail ve Batı basını yazmadı." if tur == "sessiz"
            else f"Aynı olayı {len(yayinlar)} yayın nasıl yazdı?")
    svgler.append(ig_kart.son(ton, soru, alan, alt(toplam)))
    return svgler, kunye


def aciklama(tur, o, yayinlar, sayi, plan, alan, kunye=""):
    bas = plan.get("kanca") or o["baslik"]
    isaret = "🔇" if tur == "sessiz" else ("🕯️" if plan["ton"] == "yas" else "⚖️")
    satir = [f"{isaret} {bas}", "", o["baslik"]]
    if o.get("not"):
        satir += ["", o["not"]]
    denge = " · ".join(f"{BAKIS_AD[v]} {n}" for v, n in sayi.items() if n)
    if denge:
        satir += ["", "Bakış dengesi: " + denge]
    satir += ["🗞 " + ", ".join(y["ad"] for y in list(yayinlar.values())[:12]) + (" …" if len(yayinlar) > 12 else "")]
    satir += ["", f"Özgün haberler ve tüm yayınlar: profildeki bağlantı ({alan})",
              "Başlıklar Türkçeye çevrildi; açıklamalar yapay zekâyla, yayınların kendi haberlerine dayanarak yazıldı."]
    if kunye:
        satir += [kunye.replace("Fotoğraf:", "Kapak fotoğrafı:")]
    etiket = ["Filistin"] + [e for e in plan.get("etiketler", []) if e != "Filistin"]
    satir += ["", " ".join("#" + e for e in etiket[:6])]
    return "\n".join(satir)[:2150]


def hazirla(kok, durum, olaylar, haberler, kaynaklar_liste, simdi, gemini=None, log=print):
    """Kuyrukta yer varsa yeni kartlar üretir; bayatlayanları siler.
    gemini: metin -> (durum kodu, JSON) ya da None (istek bütçesi yoksa). Plan olmadan olay gönderisi hazırlanmaz."""
    kay = durum.setdefault("_instagram", {"kuyruk": [], "olay": [], "bulten": {}, "gonderim": []})
    kaynaklar = {k["id"]: k for k in kaynaklar_liste}
    alan = (site_adresi() or "").replace("https://", "").rstrip("/")
    # Bayat kuyruk ögeleri (24 saatte gönderilemeyen olaylar) ve gönderilmiş ögelerin klasörleri
    tut = []
    for q in kay["kuyruk"]:
        bayat = q["tur"] != "bulten" and (simdi - dt.datetime.fromisoformat(q["hazir"])).total_seconds() > 24 * 3600
        if bayat or q.get("deneme", 0) >= 3:
            shutil.rmtree(_klasor(kok, q["id"]), ignore_errors=True)
        else:
            tut.append(q)
    kay["kuyruk"] = tut
    kok_klasor = os.path.join(kok, "data", "instagram")
    if os.path.isdir(kok_klasor):
        canli = {q["id"] for q in kay["kuyruk"]}
        for ad in os.listdir(kok_klasor):
            if ad not in canli:
                shutil.rmtree(os.path.join(kok_klasor, ad), ignore_errors=True)
    try:
        ig_foto.kutuphane_doldur(kok, simdi, en_cok_yer=2, log=log)
    except Exception as e:
        log(f"Fotoğraf kütüphanesi hatası: {type(e).__name__}")
    if len(kay["kuyruk"]) >= 3 or not shutil.which("rsvg-convert"):
        return 0
    yeni = 0
    sirada = [set(q.get("haberler", [])) for q in kay["kuyruk"]]
    # Almanak bültenleri (kesinleşmiş): var olan kare kartı JPEG'e çevir
    klasor = os.path.join(kok, "data", "bulten")
    for t in ("yillik", "aylik", "haftalik"):
        d = os.path.join(klasor, t)
        if not os.path.isdir(d):
            continue
        for ad in sorted(os.listdir(d))[-2:]:
            anahtar = f"{t}/{ad}"
            if not ad.endswith(".json") or anahtar in kay["bulten"] or any(q.get("bulten") == anahtar for q in kay["kuyruk"]):
                continue
            try:
                b = json.load(open(os.path.join(d, ad), encoding="utf-8"))
            except Exception:
                continue
            if b.get("taslak") or not b.get("anlati"):
                continue
            # Bülten Instagram açılmadan önce çıktıysa geriye dönük gönderme
            if not kay.get("basladi") or b.get("uretildi", "") < kay["basladi"]:
                kay["bulten"][anahtar] = "eski"
                continue
            svg_yol = os.path.join(kok, (b.get("indir") or {}).get("svg") or "")
            if not os.path.isfile(svg_yol):
                continue
            kimlik = "b-" + re.sub(r"[^a-z0-9-]", "-", anahtar.lower().replace(".json", ""))
            os.makedirs(_klasor(kok, kimlik), exist_ok=True)
            svg = open(svg_yol, encoding="utf-8").read()
            if not _jpeg_kare(svg, os.path.join(_klasor(kok, kimlik), "1.jpg")):
                continue
            a = b.get("anlati") or {}
            metin = "\n".join([f"📚 Almanak · {b['ad']}", "", a.get("baslik") or b["ad"], "",
                               ((a.get("ozet") or [""])[0])[:1400], "", f"Bültenin tamamı: profildeki bağlantı ({alan})",
                               "Bülten metni yapay zekâyla, hesaplanan verilere dayanarak yazıldı.", "", "#Filistin #medya #almanak"])
            kay["kuyruk"].append({"id": kimlik, "tur": "bulten", "bulten": anahtar, "kart": 1, "aciklama": metin[:2150],
                                  "hazir": simdi.isoformat()})
            yeni += 1
            if len(kay["kuyruk"]) >= 3:
                return yeni
    planlar = kay.setdefault("plan", {})
    sinir = (simdi - dt.timedelta(days=3)).isoformat()
    for i in [i for i, v in planlar.items() if v.get("t", "") < sinir]:
        del planlar[i]
    M = marka.oku(kok)
    istek = 0
    for tur, _, o, (yayinlar, sayi) in adaylar(kay, olaylar, haberler, kaynaklar, simdi):
        ids = set(o["haberler"])
        if any(len(ids & g) >= 0.5 * min(len(ids), len(g)) for g in sirada):
            continue
        kayitli = planlar.get(o["id"])
        if kayitli and kayitli.get("p") is None:
            continue                                   # bu olay için daha önce uygun kalıp bulunamadı
        if kayitli:
            plan = kayitli["p"]
        else:
            if not gemini or istek >= 3:
                continue
            g = gemini
            istek += 1
            plan, kod = plan_iste(g, o, yayinlar, haberler)
            if kod != 200:
                break                                  # kota ya da geçici hata: bir sonraki çalıştırmada yeniden dene
            planlar[o["id"]] = {"t": simdi.isoformat(), "p": plan}
            if plan is None:
                continue
        kurulan = gonderi_kur(kok, tur, o, yayinlar, sayi, plan, alan, M["ad"], kay.get("kullanici"))
        svgler, kunye = kurulan if kurulan else (None, "")
        if not svgler:
            planlar[o["id"]] = {"t": simdi.isoformat(), "p": None}
            continue
        kimlik = {"sessiz": "s-", "karsilastirma": "k-", "rakam": "r-"}[tur] + o["id"]
        k = _klasor(kok, kimlik)
        os.makedirs(k, exist_ok=True)
        if not all(_jpeg(s_, os.path.join(k, f"{n}.jpg")) for n, s_ in enumerate(svgler, 1)):
            shutil.rmtree(k, ignore_errors=True)
            log("Instagram: kart üretilemedi (rsvg-convert / Pillow eksik olabilir)")
            return yeni
        # Her IG_REELS_HER gönderiden biri Reels videosu olarak da hazırlanır (Instagram'ın en çok gösterdiği biçim)
        kay["sayac"] = kay.get("sayac", 0) + 1
        reel = bool(IG_REELS_HER) and kay["sayac"] % IG_REELS_HER == 0 and ig_video.uret(
            [os.path.join(k, f"{n}.jpg") for n in range(1, len(svgler) + 1)], os.path.join(k, "video.mp4"), log=log)
        kay["kuyruk"].append({"id": kimlik, "tur": tur, "olay": o["id"], "haberler": list(o["haberler"]), "kart": len(svgler),
                              "reel": reel, "aciklama": aciklama(tur, o, yayinlar, sayi, plan, alan, kunye), "hazir": simdi.isoformat()})
        sirada.append(ids)
        yeni += 1
        if len(kay["kuyruk"]) >= 3:
            break
    if yeni:
        log(f"Instagram: {yeni} gönderi hazırlandı (kuyrukta {len(kay['kuyruk'])})")
    return yeni


def _jpeg_kare(svg, yol):
    """Almanak kartı 1080x1080: Instagram'da kare gönderi olarak gider."""
    global G, Y
    eski = (G, Y)
    G, Y = 1080, 1080
    try:
        return _jpeg(svg, yol)
    finally:
        G, Y = eski


# ------------------------------------------------------------------ Instagram API
def _istek(yontem, adres, veri=None, zaman=60):
    global SON_HATA
    govde = urllib.parse.urlencode(veri).encode() if veri is not None else None
    r = urllib.request.Request(adres, data=govde, method=yontem,
                               headers={"Content-Type": "application/x-www-form-urlencoded"} if govde else {})
    try:
        with urllib.request.urlopen(r, timeout=zaman) as y:
            return json.loads(y.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            h = json.loads(e.read().decode()).get("error", {})
            SON_HATA = f'{e.code} {h.get("code", "")}/{h.get("error_subcode", "")} {h.get("message", "")}'.strip()
        except Exception:
            SON_HATA = str(e.code)
        return None
    except Exception as e:
        SON_HATA = type(e).__name__
        return None


def _gizle(s, token):
    return s.replace(token, "***") if token else s


def _hesap(kay, sunucu, token):
    """Instagram hesabının sayısal kimliği. Önce INSTAGRAM_HESAP değişkeni; yoksa jeton türüne göre sırayla denenir."""
    h = os.environ.get("INSTAGRAM_HESAP", "").strip() or kay.get("hesap")
    if h:
        return h
    q = lambda yol, alan: _istek("GET", f"{sunucu}/{yol}?" + urllib.parse.urlencode({"fields": alan, "access_token": token}))
    bulunan = None
    if "instagram" in sunucu:
        r = q("me", "user_id,username")
        if r and (r.get("user_id") or r.get("id")):
            bulunan = (str(r.get("user_id") or r["id"]), r.get("username"))
    else:
        # EAA (Facebook / birleşik giriş) jetonu: sayfa jetonu, kullanıcı jetonu ya da sistem kullanıcısı olabilir
        r = q("me", "instagram_business_account{id,username}")
        iba = (r or {}).get("instagram_business_account") or {}
        if iba.get("id"):
            bulunan = (str(iba["id"]), iba.get("username"))
        if not bulunan:
            r = q("me/accounts", "instagram_business_account{id,username}")
            for sayfa in (r or {}).get("data", []):
                iba = sayfa.get("instagram_business_account") or {}
                if iba.get("id"):
                    bulunan = (str(iba["id"]), iba.get("username"))
                    break
        if not bulunan:
            # Birleşik giriş jetonu bazen Instagram sunucusunda da geçer: orada /me doğrudan Instagram hesabıdır
            r = _istek("GET", f"https://graph.instagram.com/{SURUM}/me?" + urllib.parse.urlencode({"fields": "user_id,username", "access_token": token}))
            if r and (r.get("user_id") or r.get("id")):
                bulunan = (str(r.get("user_id") or r["id"]), r.get("username"))
    if bulunan:
        kay["hesap"], kay["kullanici"] = bulunan[0], bulunan[1]
        return bulunan[0]
    return None


def _bekle_hazir(sunucu, kap, token, sure=90):
    son = time.time() + sure
    while time.time() < son:
        r = _istek("GET", f"{sunucu}/{kap}?" + urllib.parse.urlencode({"fields": "status_code", "access_token": token}))
        d = (r or {}).get("status_code")
        if d == "FINISHED":
            return True
        if d in ("ERROR", "EXPIRED"):
            return False
        time.sleep(4)
    return False


def _herkese_acik(adres):
    try:
        with urllib.request.urlopen(urllib.request.Request(adres, method="HEAD"), timeout=20) as r:
            return r.status == 200
    except Exception:
        return False


def _gonder_reel(sunucu, hesap, token, video, metin):
    """Reels videosu (akışta da görünür). Döndürür: gönderi kimliği ya da None"""
    veri = {"media_type": "REELS", "video_url": video, "caption": metin, "share_to_feed": "true", "access_token": token}
    kap = _istek("POST", f"{sunucu}/{hesap}/media", {**veri, "is_ai_generated": "true"})
    if not kap and "is_ai_generated" in SON_HATA:
        kap = _istek("POST", f"{sunucu}/{hesap}/media", veri)
    if not kap or not kap.get("id") or not _bekle_hazir(sunucu, kap["id"], token, sure=300):
        return None
    r = _istek("POST", f"{sunucu}/{hesap}/media_publish", {"creation_id": kap["id"], "access_token": token})
    return (r or {}).get("id")


def _gonder(sunucu, hesap, token, gorseller, metin):
    """Tek görsel ya da kaydırmalı gönderi. Döndürür: gönderi kimliği ya da None"""
    if len(gorseller) == 1:
        kap = _istek("POST", f"{sunucu}/{hesap}/media", {"image_url": gorseller[0], "caption": metin, "access_token": token})
    else:
        cocuk = []
        for g in gorseller:
            c = _istek("POST", f"{sunucu}/{hesap}/media", {"image_url": g, "is_carousel_item": "true", "access_token": token})
            if not c or not c.get("id"):
                return None
            cocuk.append(c["id"])
        for c in cocuk:
            if not _bekle_hazir(sunucu, c, token):
                return None
        veri = {"media_type": "CAROUSEL", "children": ",".join(cocuk), "caption": metin, "access_token": token}
        kap = _istek("POST", f"{sunucu}/{hesap}/media", {**veri, "is_ai_generated": "true"})
        if not kap and "is_ai_generated" in SON_HATA:
            kap = _istek("POST", f"{sunucu}/{hesap}/media", veri)
    if not kap or not kap.get("id"):
        return None
    if not _bekle_hazir(sunucu, kap["id"], token):
        return None
    r = _istek("POST", f"{sunucu}/{hesap}/media_publish", {"creation_id": kap["id"], "access_token": token})
    return (r or {}).get("id")


def _jeton_yenile(kay, token, simdi, log):
    """Instagram ile giriş jetonları 60 gün geçerli; haftada bir uzatılır. Jetonun kendisi hiçbir yere yazılmaz."""
    son = kay.get("yenilendi")
    if son and (simdi - dt.datetime.fromisoformat(son)).days < 7:
        return
    r = _istek("GET", "https://graph.instagram.com/refresh_access_token?" + urllib.parse.urlencode(
        {"grant_type": "ig_refresh_token", "access_token": token}))
    if r and r.get("expires_in"):
        kay["yenilendi"] = simdi.isoformat()
        if r.get("access_token") == token:
            kay["bitis"] = (simdi + dt.timedelta(seconds=int(r["expires_in"]))).isoformat()
            log(f"Instagram: jeton uzatıldı, {kay['bitis'][:10]} tarihine kadar geçerli")
        else:
            # Yeni bir dize döndü: kayıtlı jeton kendi süresi dolana kadar çalışır; hatırlatma o tarihe göre
            log("Instagram: uzatma yeni bir jeton üretti; kayıtlı jetonun süresi dolmadan GitHub'daki INSTAGRAM_TOKEN yenilenmeli")
    else:
        # Jeton 24 saatten gençse ya da geçici hata: yarın yeniden dene
        kay["yenilendi"] = (simdi - dt.timedelta(days=6)).isoformat()
        log("Instagram: jeton uzatılamadı (" + _gizle(SON_HATA, token) + ")")


def _hatirlat(kay, simdi, log):
    """Jetonun bitmesine 10 günden az kaldıysa depoda bir kez hatırlatma kaydı (issue) açar; jeton yazılmaz."""
    if not kay.get("bitis") or kay.get("hatirlatildi") == kay["bitis"]:
        return
    kalan = (dt.datetime.fromisoformat(kay["bitis"]) - simdi).days
    if kalan > 10:
        return
    depo, gt = os.environ.get("GITHUB_REPOSITORY", ""), os.environ.get("GITHUB_TOKEN", "")
    if not depo or not gt:
        return
    govde = json.dumps({"title": f"Instagram jetonunun süresi {kalan} gün içinde doluyor",
                        "body": "Instagram'a otomatik gönderi için kullanılan erişim jetonunun süresi "
                                f"{kay['bitis'][:10]} tarihinde doluyor. Meta geliştirici panelinden yeni bir uzun ömürlü jeton alıp "
                                "Settings → Secrets and variables → Actions altındaki INSTAGRAM_TOKEN değerini güncelle."}).encode()
    r = urllib.request.Request(f"https://api.github.com/repos/{depo}/issues", data=govde, method="POST",
                               headers={"Authorization": f"Bearer {gt}", "Accept": "application/vnd.github+json"})
    try:
        urllib.request.urlopen(r, timeout=20).read()
        kay["hatirlatildi"] = kay["bitis"]
        log("Instagram: jeton hatırlatması açıldı")
    except Exception:
        pass


def yayinla(kok, durum, simdi, log=print):
    token = os.environ.get("INSTAGRAM_TOKEN", "").strip()
    m = re.search(r"(IG|EAA)[A-Za-z0-9_-]{40,}", token)
    if m:
        token = m.group(0)
    kay = durum.setdefault("_instagram", {"kuyruk": [], "olay": [], "bulten": {}, "gonderim": []})
    sinir = (simdi - dt.timedelta(days=7)).isoformat()
    kay["olay"] = [x for x in kay.get("olay", []) if x[0] >= sinir]
    if not token or DURAKLAT:
        return 0
    if not kay.get("basladi"):
        kay["basladi"] = simdi.isoformat()
        log("Instagram: hesap bağlandı; bundan sonraki içerik gönderilecek")
    # Jeton değiştiyse (GitHub'da güncellendiyse) süre baştan sayılır. Jetonun kendisi değil, yalnızca kısa bir özeti tutulur.
    iz = hashlib.sha256(token.encode()).hexdigest()[:12]
    if kay.get("jeton_iz") != iz:
        kay["jeton_iz"] = iz
        kay["bitis"] = (simdi + dt.timedelta(days=60)).isoformat() if token.startswith("IG") else None
        kay.pop("yenilendi", None)
        kay.pop("hesap", None)
    sunucu = f"https://graph.instagram.com/{SURUM}" if token.startswith("IG") else f"https://graph.facebook.com/{SURUM}"
    if token.startswith("IG"):
        _jeton_yenile(kay, token, simdi, log)
    _hatirlat(kay, simdi, log)
    gun = [t for t in kay.get("gonderim", []) if (simdi - dt.datetime.fromisoformat(t)).total_seconds() < 24 * 3600]
    kay["gonderim"] = gun
    if len(gun) >= IG_GUNLUK or (gun and (simdi - dt.datetime.fromisoformat(max(gun))).total_seconds() < IG_ARA * 60):
        return 0
    site = site_adresi()
    if not site:
        return 0
    # Sitede yayımlanmış (bir önceki çalıştırmada hazırlanmış) ilk öge
    for q in kay["kuyruk"]:
        if (simdi - dt.datetime.fromisoformat(q["hazir"])).total_seconds() < 8 * 60:
            continue
        gorseller = [f"{site}data/instagram/{q['id']}/{n}.jpg" for n in range(1, q["kart"] + 1)]
        if not _herkese_acik(gorseller[0]):
            continue
        hesap = _hesap(kay, sunucu, token)
        if not hesap:
            log("Instagram: hesap kimliği bulunamadı (" + _gizle(SON_HATA, token) + "). GitHub'da INSTAGRAM_HESAP değişkenine "
                "Meta panelinde hesabın altında yazan sayısal kimliği gir")
            return 0
        if not kay.get("kullanici"):
            r = _istek("GET", f"{sunucu}/{hesap}?" + urllib.parse.urlencode({"fields": "username", "access_token": token}))
            if r and r.get("username"):
                kay["kullanici"] = r["username"]
        kimlik = None
        if q.get("reel"):
            video = f"{site}data/instagram/{q['id']}/video.mp4"
            kimlik = _gonder_reel(sunucu, hesap, token, video, q["aciklama"]) if _herkese_acik(video) else None
            if not kimlik:
                log("Instagram: Reels gönderilemedi (" + _gizle(SON_HATA, token) + "); kaydırmalı gönderiyle deneniyor")
        if not kimlik:
            kimlik = _gonder(sunucu, hesap, token, gorseller, q["aciklama"])
        if kimlik:
            kay["gonderim"].append(simdi.isoformat())
            if q["tur"] == "bulten":
                kay["bulten"][q["bulten"]] = simdi.isoformat()
            else:
                kay["olay"].append([simdi.isoformat(), q["haberler"]])
            kay["kuyruk"].remove(q)
            shutil.rmtree(_klasor(kok, q["id"]), ignore_errors=True)
            log(f"Instagram: gönderi yayımlandı ({q['tur']}, {q['kart']} kart{', Reels' if q.get('reel') else ''})")
            return 1
        q["deneme"] = q.get("deneme", 0) + 1
        hata = _gizle(SON_HATA, token)
        ipucu = {"190": "jeton geçersiz ya da süresi dolmuş", "10/": "izin eksik (instagram_business_content_publish)",
                 "9/": "Instagram'ın günlük gönderi sınırı", "36003": "görsel oranı uygun değil", "2207": "görsel alınamadı ya da işlenemedi"}
        neden = next((v for k, v in ipucu.items() if k in hata), "")
        log(f"Instagram: gönderilemedi: {hata}" + (f" → {neden}" if neden else ""))
        return 0
    return 0
