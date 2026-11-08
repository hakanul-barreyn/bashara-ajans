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
import marka

IG_GUNLUK = int(os.environ.get("IG_GUNLUK") or 4)
IG_ARA = 150                      # dakika
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


# ------------------------------------------------------------------ kart çizimi
def _logo(kok):
    try:
        s = open(os.path.join(kok, "site", "logo.svg"), encoding="utf-8").read()
        ic = s[s.index(">", s.index("<svg")) + 1:s.rindex("</svg>")]
        for a in ("sol", "sag", "kure"):
            ic = ic.replace(f'id="{a}"', f'id="i-{a}"').replace(f"url(#{a})", f"url(#i-{a})")
        return ic
    except Exception:
        return ""


def _cerceve(kok, ic, sayfa, toplam, alan):
    M = marka.oku(kok)
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{G}" height="{Y}" viewBox="0 0 {G} {Y}">',
         f'<rect width="{G}" height="{Y}" fill="{ZEMIN}"/>',
         f'<rect width="{G // 2}" height="14" fill="{YESIL}"/><rect x="{G // 2}" width="{G // 2}" height="14" fill="{KIRMIZI}"/>',
         ic,
         f'<line x1="70" y1="{Y - 112}" x2="{G - 70}" y2="{Y - 112}" stroke="{CIZGI}" stroke-width="2"/>',
         f'<g transform="translate(70 {Y - 92}) scale(.82)">{_logo(kok)}</g>',
         f'<text x="140" y="{Y - 50}" font-family="{F}" font-size="30" font-weight="bold" fill="{MUREKKEP}">{_e(M["ad"])}</text>',
         f'<text x="{140 + 24 * len(M["ad"]) + 20}" y="{Y - 50}" font-family="{F}" font-size="24" fill="{SOLUK}">{_e(alan)}</text>']
    if toplam > 1:
        p.append(f'<text x="{G - 70}" y="{Y - 50}" text-anchor="end" font-family="{F}" font-size="26" fill="{SOLUK}">{sayfa} / {toplam}</text>')
    p.append("</svg>")
    return "\n".join(p)


def _metin(x, y, satirlar, boy, renk=MUREKKEP, kalin=False, aralik=1.28):
    k = ' font-weight="bold"' if kalin else ""
    p = [f'<text x="{x}" y="{y + i * boy * aralik:.0f}" font-family="{F}" font-size="{boy}"{k} fill="{renk}">{_e(s)}</text>'
         for i, s in enumerate(satirlar)]
    return "".join(p), y + len(satirlar) * boy * aralik


def _etiket(y, metin, renk):
    return f'<text x="70" y="{y}" font-family="{F}" font-size="26" font-weight="bold" fill="{renk}" letter-spacing="3">{_e(metin)}</text>'


def _denge_cubugu(y, sayi):
    toplam = sum(sayi.values()) or 1
    p, x = [], 70.0
    for v in ("filistin", "aktarim", "israil"):
        w = 940 * sayi.get(v, 0) / toplam
        if w > 0:
            p.append(f'<rect x="{x:.1f}" y="{y}" width="{w:.1f}" height="26" fill="{BAKIS_RENK[v]}"/>')
            x += w
    p.insert(0, f'<rect x="70" y="{y}" width="940" height="26" rx="13" fill="{CIZGI}"/>')
    # köşeleri yuvarlatmak için üstüne zemin renginde maske yerine kırpma
    p = [f'<clipPath id="cub"><rect x="70" y="{y}" width="940" height="26" rx="13"/></clipPath>',
         f'<g clip-path="url(#cub)">'] + p + ["</g>"]
    lx, ly = 70, y + 66
    for v in ("filistin", "aktarim", "israil"):
        if sayi.get(v):
            t = f"{BAKIS_AD[v]} {sayi[v]}"
            p.append(f'<circle cx="{lx + 11}" cy="{ly - 9}" r="11" fill="{BAKIS_RENK[v]}"/>')
            p.append(f'<text x="{lx + 32}" y="{ly}" font-family="{F}" font-size="26" fill="{MUREKKEP}">{_e(t)}</text>')
            lx += 32 + int(len(t) * 15.5) + 34
    return "".join(p), ly + 20


def kapak_svg(kok, o, tur, ozet, sayfa, toplam, alan):
    tarih = dt.datetime.fromisoformat(o.get("son") or o.get("ilk")).astimezone(dt.timezone(dt.timedelta(hours=3)))
    AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
    p = []
    if tur == "sessiz":
        p.append(_etiket(110, "İSRAİL VE BATI BASINI YAZMADI", KIRMIZI))
    else:
        p.append(_etiket(110, "KİM NASIL YAZDI", YESIL))
    p.append(f'<text x="{G - 70}" y="110" text-anchor="end" font-family="{F}" font-size="26" fill="{SOLUK}">{tarih.day} {AY[tarih.month - 1]} {tarih.year}</text>')
    s, y = _metin(70, 200, _sar(o["baslik"], 25, 5), 64, kalin=True, aralik=1.2)
    p.append(s)
    y += 30
    if tur == "sessiz":
        p.append(f'<text x="70" y="{y + 110:.0f}" font-family="{F}" font-size="150" font-weight="bold" fill="{YESIL}">{ozet["bolge"]}</text>')
        p.append(f'<text x="{70 + 95 * len(str(ozet["bolge"])) + 30}" y="{y + 60:.0f}" font-family="{F}" font-size="30" fill="{MUREKKEP}">bölge yayını yazdı</text>')
        p.append(f'<text x="{70 + 95 * len(str(ozet["bolge"])) + 30}" y="{y + 104:.0f}" font-family="{F}" font-size="30" font-weight="bold" fill="{KIRMIZI}">İsrail ve Batı basınından: 0</text>')
        y += 170
        s, y = _metin(70, y + 20, _sar(" · ".join(ozet["adlar"]), 44, 5), 32, MUREKKEP, aralik=1.4)
        p.append(s)
    else:
        s, y = _metin(70, y + 10, _sar(o.get("not"), 46, 9), 34, MUREKKEP, aralik=1.38)
        p.append(s)
        y += 30
        p.append(_etiket(int(y + 10), "BAKIŞ DENGESİ", SOLUK))
        s, y = _denge_cubugu(int(y + 36), ozet["bakis"])
        p.append(s)
    p.append(f'<text x="70" y="{Y - 150}" font-family="{F}" font-size="28" fill="{SOLUK}">{ozet["yayin"]} yayın · {ozet["haber"]} haber   ·   kaydır →</text>')
    return _cerceve(kok, "".join(p), sayfa, toplam, alan)


def grup_svg(kok, bloklar, sayfa, toplam, alan):
    """bloklar: [("başlık", girdi) ya da ("girdi", girdi)] sırayla, yukarıdan aşağı akar."""
    p, y = [], 96
    for tur, g in bloklar:
        if tur == "baslik":
            y += 14
            p.append(f'<text x="70" y="{y}" font-family="{F}" font-size="26" font-weight="bold" fill="{SOLUK}" letter-spacing="3">{_e(g.upper())}</text>')
            p.append(f'<line x1="70" y1="{y + 18}" x2="{G - 70}" y2="{y + 18}" stroke="{CIZGI}" stroke-width="2"/>')
            y += 74
            continue
        p.append(f'<circle cx="84" cy="{y - 12}" r="14" fill="{BAKIS_RENK.get(g["bakis"], CIZGI)}"/>')
        p.append(f'<text x="112" y="{y}" font-family="{F}" font-size="36" font-weight="bold" fill="{MUREKKEP}">{_e(g["ad"])}</text>')
        p.append(f'<text x="112" y="{y + 38}" font-family="{F}" font-size="24" fill="{SOLUK}">{_e(g["yer"])} · {_e(BAKIS_AD.get(g["bakis"], ""))}</text>')
        s_, y = _metin(112, y + 86, g["_satir"], 32, MUREKKEP, aralik=1.34)
        p.append(s_)
        y += 44
    return _cerceve(kok, "".join(p), sayfa, toplam, alan)


def son_svg(kok, sayfa, toplam, alan):
    p = [_etiket(110, "TAMAMI SİTEDE", YESIL)]
    s, y = _metin(70, 260, ["Her yayının özgün haberi,", "Türkçe özeti ve bakış", "dengesi sitede."], 60, kalin=True, aralik=1.2)
    p.append(s)
    p.append(f'<text x="70" y="{y + 70:.0f}" font-family="{F}" font-size="40" font-weight="bold" fill="{YESIL}">{_e(alan)}</text>')
    p.append(f'<text x="70" y="{y + 130:.0f}" font-family="{F}" font-size="30" fill="{MUREKKEP}">Bağlantı profilde.</text>')
    s, _ = _metin(70, Y - 330, _sar("Başlangıç noktamız Filistin bakışı. Kartlardaki açıklamaları yapay zekâ, kaynakların "
                                    "kendi haberlerine dayanarak yazdı; hangi yayının ne dediğini sitede özgün metinden doğrulayabilirsin.", 56, 5),
                  26, SOLUK, aralik=1.4)
    p.append(s)
    return _cerceve(kok, "".join(p), sayfa, toplam, alan)


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
    return bool(k) and not k.get("resmi_grup") and not k.get("hassas")


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
                                 "kamp": almanak.kamp(k), "cizgi": k.get("cizgi")}
    return yayinlar, sayi, dislanan


def adaylar(kay, olaylar, haberler, kaynaklar, simdi):
    cikti = []
    gonderilmis = [set(g) for _, g in kay.get("olay", [])]
    for o in olaylar:
        ids = set(o["haberler"])
        if any(len(ids & g) >= 0.5 * min(len(ids), len(g)) for g in gonderilmis):
            continue
        yayinlar, sayi, dislanan = _olay_ozeti(o, haberler, kaynaklar)
        if dislanan >= 0.4 * len(ids) or len(yayinlar) < 4:
            continue
        kamplar = {y["kamp"] for y in yayinlar.values()}
        bolge = [y for y in yayinlar.values() if y["kamp"] in almanak.BOLGE_ICI and y["cizgi"] != "ik"]
        dis = [y for y in yayinlar.values() if y["kamp"] in almanak.DIS]
        ilk = dt.datetime.fromisoformat(o.get("ilk") or o.get("son"))
        yas = (simdi - ilk).total_seconds() / 3600
        tum_dis = any(almanak.kamp(kaynaklar.get(haberler[i]["kaynak"])) in almanak.DIS for i in ids if i in haberler)
        if not tum_dis and len(bolge) >= 4 and 6 <= yas <= 36:
            # Sessizlik kartında yalnızca bölgenin kendi basını: işbirlikçi çizgideki yayınlar (Iran International gibi) karışmasın
            yalniz = {i: y for i, y in yayinlar.items() if y["cizgi"] != "ik"}
            cikti.append(("sessiz", 2 + len(bolge) / 10, o, (yalniz, sayi)))
        elif dis and bolge and sum(1 for n in sayi.values() if n) >= 2 and yas <= 30 and len(kamplar) >= 3:
            # İsrail/ABD bakışıyla yazılmış haber varsa karşılaştırma daha öğretici: öne al
            cikti.append(("karsilastirma", 1 + (1 if sayi["israil"] else 0) + len(yayinlar) / 10, o, (yayinlar, sayi)))
    cikti.sort(key=lambda x: -x[1])
    return cikti


def _klasor(kok, kimlik):
    return os.path.join(kok, "data", "instagram", kimlik)


def olay_kartlari(kok, tur, o, yayinlar, sayi, alan):
    """Kapak + kamp kamp yayınlar (kartlara sığdığı kadar akar) + kapanış; en çok 10 kart. Döndürür: SVG listesi"""
    sira = {k: i for i, k in enumerate(almanak.KAMP_SIRA)}
    ys = sorted(yayinlar.values(), key=lambda y: (sira.get(y["kamp"], 99), {"filistin": 0, "aktarim": 1, "israil": 2}.get(y["bakis"], 3)))
    sayfalar, simdiki, y, kamp_ad = [], [], 96, None
    ALT = Y - 150
    for g in ys:
        g["_satir"] = _sar(g["yorum"], 46, 4)
        boy = 86 + len(g["_satir"]) * 43 + 44
        ek = 88 if g["kamp"] != kamp_ad else 0
        if simdiki and y + ek + boy > ALT:
            sayfalar.append(simdiki)
            simdiki, y = [], 96
            ek = 88
        if ek:
            simdiki.append(("baslik", g["kamp"]))
            y += 88
            kamp_ad = g["kamp"]
        simdiki.append(("girdi", g))
        y += boy
    if simdiki:
        sayfalar.append(simdiki)
    sayfalar = sayfalar[:8]
    toplam = len(sayfalar) + 2
    ozet = {"bakis": sayi, "yayin": len(yayinlar), "haber": len(o["haberler"]),
            "bolge": sum(1 for y in yayinlar.values() if y["kamp"] in almanak.BOLGE_ICI and y["cizgi"] != "ik"),
            "adlar": [y["ad"] for y in yayinlar.values() if y["kamp"] in almanak.BOLGE_ICI and y["cizgi"] != "ik"][:14]}
    svgler = [kapak_svg(kok, o, tur, ozet, 1, toplam, alan)]
    for n, bloklar in enumerate(sayfalar, 2):
        svgler.append(grup_svg(kok, bloklar, n, toplam, alan))
    svgler.append(son_svg(kok, toplam, toplam, alan))
    return svgler


def aciklama(tur, o, yayinlar, sayi, alan):
    satir = [("🔇 İsrail ve Batı basını yazmadı" if tur == "sessiz" else "⚖️ Kim nasıl yazdı"), "", o["baslik"]]
    if o.get("not"):
        satir += ["", o["not"]]
    denge = " · ".join(f"{BAKIS_AD[v]} {n}" for v, n in sayi.items() if n)
    if denge:
        satir += ["", "Bakış dengesi: " + denge]
    satir += ["🗞 " + ", ".join(y["ad"] for y in list(yayinlar.values())[:12]) + (" …" if len(yayinlar) > 12 else "")]
    satir += ["", f"Özgün haberler ve tüm yayınlar: profildeki bağlantı ({alan})",
              "Açıklamalar yapay zekâyla, kaynakların kendi haberlerine dayanarak yazıldı.",
              "", "#Filistin #Gazze #medya #basın #haber"]
    return "\n".join(satir)[:2150]


def hazirla(kok, durum, olaylar, haberler, kaynaklar_liste, simdi, log=print):
    """Kuyrukta yer varsa yeni kartlar üretir; bayatlayanları siler."""
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
    for tur, _, o, (yayinlar, sayi) in adaylar(kay, olaylar, haberler, kaynaklar, simdi):
        ids = set(o["haberler"])
        if any(len(ids & g) >= 0.5 * min(len(ids), len(g)) for g in sirada):
            continue
        kimlik = ("s-" if tur == "sessiz" else "k-") + o["id"]
        k = _klasor(kok, kimlik)
        os.makedirs(k, exist_ok=True)
        svgler = olay_kartlari(kok, tur, o, yayinlar, sayi, alan)
        if not all(_jpeg(s, os.path.join(k, f"{n}.jpg")) for n, s in enumerate(svgler, 1)):
            shutil.rmtree(k, ignore_errors=True)
            log("Instagram: kart üretilemedi (rsvg-convert / Pillow eksik olabilir)")
            return yeni
        kay["kuyruk"].append({"id": kimlik, "tur": tur, "olay": o["id"], "haberler": list(o["haberler"]), "kart": len(svgler),
                              "aciklama": aciklama(tur, o, yayinlar, sayi, alan), "hazir": simdi.isoformat()})
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
            r = q("me", "id,username")          # birleşik girişte /me doğrudan Instagram hesabı olabilir
            if r and r.get("id") and r.get("username"):
                bulunan = (str(r["id"]), r["username"])
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
    if not token:
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
        kimlik = _gonder(sunucu, hesap, token, gorseller, q["aciklama"])
        if kimlik:
            kay["gonderim"].append(simdi.isoformat())
            if q["tur"] == "bulten":
                kay["bulten"][q["bulten"]] = simdi.isoformat()
            else:
                kay["olay"].append([simdi.isoformat(), q["haberler"]])
            kay["kuyruk"].remove(q)
            shutil.rmtree(_klasor(kok, q["id"]), ignore_errors=True)
            log(f"Instagram: gönderi yayımlandı ({q['tur']}, {q['kart']} kart)")
            return 1
        q["deneme"] = q.get("deneme", 0) + 1
        hata = _gizle(SON_HATA, token)
        ipucu = {"190": "jeton geçersiz ya da süresi dolmuş", "10/": "izin eksik (instagram_business_content_publish)",
                 "9/": "Instagram'ın günlük gönderi sınırı", "36003": "görsel oranı uygun değil", "2207": "görsel alınamadı ya da işlenemedi"}
        neden = next((v for k, v in ipucu.items() if k in hata), "")
        log(f"Instagram: gönderilemedi: {hata}" + (f" → {neden}" if neden else ""))
        return 0
    return 0
