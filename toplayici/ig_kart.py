"""Instagram kartlarının çizimi (1080x1350 SVG).

İki ton:
  medya  koyu zemin, Filistin bayrağının yeşil ve kırmızısıyla parlayan ışık; manşet düellosu ve medya çerçevesi gönderileri
  yas    sisli soğuk gri, bordo gölge, ince yağmur; kayıp, yıkım, açlık ve yerinden edilme haberleri (parlama yok)
Yazılar Inter (açık lisanslı, OFL). Satır kırma Pillow ile gerçek harf genişliği ölçülerek yapılır; Pillow yoksa yaklaşık hesap.
Hiçbir kartta haber fotoğrafı yok: yalnızca kendi çizdiğimiz desen, ışık ve yazı.
"""
import html
import os
import random

W, H = 1080, 1350
F = "Inter Display, Inter, DejaVu Sans, sans-serif"
YESIL, KIRMIZI, ALTIN, BEYAZ, SOLUK = "#19e68c", "#ff3b55", "#ffc247", "#f6f3ec", "#8d9792"
KAN, KAN_KOYU, SIS_YAZI, SIS_SOLUK = "#c7303d", "#7d1420", "#e8e4de", "#a9b1b8"
BAKIS_RENK = {"filistin": YESIL, "aktarim": "#9aa39e", "israil": "#4f8cff"}
BAKIS_AD = {"filistin": "Filistin bakışı", "aktarim": "aktarım", "israil": "İsrail / ABD bakışı"}
AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

_FONT_DOSYA = {900: "Inter-Black.otf", 800: "Inter-ExtraBold.otf", 700: "Inter-Bold.otf", 500: "Inter-Medium.otf", 400: "Inter-Regular.otf"}
_FONT_DIZIN = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/inter", os.path.expanduser("~/.local/share/fonts")]
_onbellek = {}


def _font(agirlik, boy):
    anahtar = (agirlik, boy)
    if anahtar in _onbellek:
        return _onbellek[anahtar]
    f = None
    try:
        from PIL import ImageFont
        ad = _FONT_DOSYA.get(agirlik) or _FONT_DOSYA[min(_FONT_DOSYA, key=lambda a: abs(a - agirlik))]
        for d in _FONT_DIZIN:
            if os.path.isfile(os.path.join(d, ad)):
                f = ImageFont.truetype(os.path.join(d, ad), boy)
                break
    except Exception:
        f = None
    _onbellek[anahtar] = f
    return f


def olc(metin, boy, agirlik=400, aralik=0):
    f = _font(agirlik, boy)
    if f is not None:
        return f.getlength(metin) + aralik * len(metin)
    return len(metin) * boy * (0.6 if agirlik >= 800 else 0.54) + aralik * len(metin)


def sar(metin, boy, agirlik, genislik, en_cok=99):
    satir, s = [], ""
    for k in str(metin or "").split():
        aday = (s + " " + k).strip()
        if s and olc(aday, boy, agirlik) > genislik:
            satir.append(s)
            s = k
        else:
            s = aday
    if s:
        satir.append(s)
    if len(satir) > en_cok:
        satir = satir[:en_cok]
        while satir[-1] and olc(satir[-1] + "…", boy, agirlik) > genislik:
            satir[-1] = satir[-1].rsplit(" ", 1)[0] if " " in satir[-1] else satir[-1][:-1]
        satir[-1] = satir[-1].rstrip(".,;:") + "…"
    return satir


def sigdir(metin, boylar, agirlik, genislik, en_cok):
    """Metni en çok en_cok satıra sığdıran en büyük yazı boyu."""
    for b in boylar:
        s = sar(metin, b, agirlik, genislik)
        if len(s) <= en_cok:
            return b, s
    b = boylar[-1]
    return b, sar(metin, b, agirlik, genislik, en_cok)


def buyuk(s):
    """Türkçe büyük harf: i → İ, ı → I (Python'un upper()'ı 'iki'yi 'IKI' yapar)."""
    return str(s or "").replace("i", "İ").replace("ı", "I").upper()


def _e(s):
    return html.escape(str(s or ""), quote=True)


def yazi(x, y, satirlar, boy, renk=BEYAZ, agirlik=900, ara=1.12, ek=""):
    return "".join(f'<text x="{x}" y="{y + i * boy * ara:.0f}" font-family="{F}" font-weight="{agirlik}" font-size="{boy}" fill="{renk}" {ek}>{_e(s)}</text>'
                   for i, s in enumerate(satirlar)), y + (len(satirlar) - 1) * boy * ara


# ------------------------------------------------------------------ zeminler
def _tatriz(op):
    """Filistin nakışı (tatriz) esinli sekiz köşeli yıldız; küçük çarpı ilmeklerinden. Geleneksel motif, telifsiz."""
    p = []
    for x, y in [(0, -3), (-1, -2), (0, -2), (1, -2), (-2, -1), (-1, -1), (1, -1), (2, -1), (-3, 0), (-2, 0), (2, 0), (3, 0),
                 (-2, 1), (-1, 1), (1, 1), (2, 1), (-1, 2), (0, 2), (1, 2), (0, 3), (0, 0)]:
        cx, cy = 60 + x * 9, 60 + y * 9
        p.append(f'<path d="M{cx - 3} {cy - 3}l6 6M{cx + 3} {cy - 3}l-6 6" stroke="{BEYAZ}" stroke-width="1.6"/>')
    return (f'<defs><pattern id="tz" width="120" height="120" patternUnits="userSpaceOnUse">{"".join(p)}</pattern></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#tz)" opacity="{op}"/>')


_FILTRE = ('<defs><filter id="parla" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14" result="b"/>'
           '<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
           '<filter id="hafif" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" result="b"/>'
           '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>')


def zemin(ton, r1=YESIL, r2=KIRMIZI, tohum=1):
    if ton == "yas":
        rnd = random.Random(tohum)
        yagmur = "".join(
            f'<line x1="{x}" y1="{y}" x2="{x - 14}" y2="{y + 70}" stroke="#9fb0bf" stroke-width="1.4" opacity="{rnd.uniform(.05, .16):.2f}"/>'
            for x, y in [(rnd.randint(0, 1120), rnd.randint(-60, H)) for _ in range(260)])
        return (_FILTRE + f'<defs><radialGradient id="bordo" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(540 430) scale(700)">'
                f'<stop stop-color="#5a0f18" stop-opacity=".55"/><stop offset="1" stop-color="#5a0f18" stop-opacity="0"/></radialGradient>'
                f'<linearGradient id="sis" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0e11"/><stop offset="1" stop-color="#14181d"/></linearGradient>'
                f'<linearGradient id="kan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{KAN}"/><stop offset="1" stop-color="{KAN_KOYU}"/></linearGradient></defs>'
                f'<rect width="{W}" height="{H}" fill="url(#sis)"/><rect width="{W}" height="{H}" fill="url(#bordo)"/>{yagmur}{_tatriz(.035)}')
    return (_FILTRE + f'<defs><radialGradient id="g1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(80 120) scale(760)">'
            f'<stop stop-color="{r1}" stop-opacity=".38"/><stop offset="1" stop-color="{r1}" stop-opacity="0"/></radialGradient>'
            f'<radialGradient id="g2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1020 1180) scale(820)">'
            f'<stop stop-color="{r2}" stop-opacity=".40"/><stop offset="1" stop-color="{r2}" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="#07090a"/><rect width="{W}" height="{H}" fill="url(#g1)"/><rect width="{W}" height="{H}" fill="url(#g2)"/>{_tatriz(.07)}')


def etiket(x, y, metin, renk):
    w = olc(metin, 24, 900, 2) + 52
    return (f'<rect x="{x}" y="{y}" width="{w:.0f}" height="54" rx="27" fill="{renk}"/>'
            f'<text x="{x + 26}" y="{y + 36}" font-family="{F}" font-weight="900" font-size="24" letter-spacing="2" fill="#07090a">{_e(metin)}</text>')


def ust_yas(metin):
    return (f'<rect x="70" y="100" width="6" height="40" fill="{KAN}"/>'
            f'<text x="92" y="132" font-family="{F}" font-weight="700" font-size="26" letter-spacing="4" fill="#b8bfc6">{_e(buyuk(metin))}</text>')


def alt(ton, n, toplam, marka, kullanici):
    rozet = "#5b6168" if ton == "yas" else YESIL
    p = [f'<g transform="translate(70 1262)"><rect width="42" height="42" rx="10" fill="{rozet}"/>'
         f'<text x="21" y="30" text-anchor="middle" font-family="{F}" font-weight="900" font-size="22" fill="#07090a">{_e(marka[:1])}</text>'
         f'<text x="58" y="31" font-family="{F}" font-weight="900" font-size="30" fill="{BEYAZ}">{_e(marka)}</text>']
    if kullanici:
        p.append(f'<text x="{58 + olc(marka, 30, 900) + 16:.0f}" y="31" font-family="{F}" font-weight="500" font-size="24" fill="{SOLUK}">@{_e(kullanici)}</text>')
    p.append("</g>")
    if toplam > 1:
        ok = "  →" if n < toplam else ""
        p.append(f'<text x="{W - 70}" y="1293" text-anchor="end" font-family="{F}" font-weight="700" font-size="24" fill="{SOLUK}">{n}/{toplam}{ok}</text>')
    return "".join(p)


def svg(ic):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}" '
            f'viewBox="0 0 {W} {H}">{ic}</svg>')


def foto_katmani(uri, ton):
    """Açık lisanslı yer fotoğrafı: kartın arkasında, karartılmış; yas tonunda neredeyse siyah-beyaz."""
    filtre = '<filter id="gri"><feColorMatrix type="saturate" values="0.12"/></filter>' if ton == "yas" else ""
    return (f'<defs>{filtre}<linearGradient id="fo" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="#07090a" stop-opacity=".45"/><stop offset=".5" stop-color="#07090a" stop-opacity=".72"/>'
            f'<stop offset="1" stop-color="#07090a" stop-opacity=".96"/></linearGradient></defs>'
            f'<image xlink:href="{uri}" href="{uri}" x="0" y="0" width="{W}" height="{H}" preserveAspectRatio="xMidYMid slice" '
            f'opacity="{.5 if ton == "yas" else .6}"{" filter=" + chr(34) + "url(#gri)" + chr(34) if ton == "yas" else ""}/>'
            f'<rect width="{W}" height="{H}" fill="url(#fo)"/>')


def kunye(metin):
    return (f'<text x="70" y="1236" font-family="{F}" font-weight="500" font-size="19" fill="#6f777e">{_e(metin[:110])}</text>'
            if metin else "")


# ------------------------------------------------------------------ kart türleri
def duello(a, b, yer_tarih, kanca, alt_, ton="medya", arka="", kunye_=""):
    """a: {kaynak, kamp, baslik} Filistin/bölge; b: İsrail/Batı. Yazı boyları iki manşet ve kanca sığacak biçimde birlikte seçilir."""
    if ton == "yas":   # acı haberde düello da yas tonunda: parlama yok, soluk renkler
        p = [zemin("yas", tohum=2), arka, ust_yas("Aynı olay · iki manşet · " + yer_tarih)]
    else:
        p = [zemin("medya"), arka, etiket(70, 90, "AYNI OLAY · İKİ MANŞET", ALTIN),
             f'<text x="{W - 70}" y="127" text-anchor="end" font-family="{F}" font-weight="700" font-size="26" fill="{SOLUK}">{_e(buyuk(yer_tarih))}</text>']
    YS, KR, AL = (("#3f9f78", KAN, "#d8cfc4") if ton == "yas" else (YESIL, KIRMIZI, ALTIN))
    parla = "" if ton == "yas" else ' filter="url(#hafif)"'
    genis = W - 110 - 70
    kb, ks = sigdir(kanca, [44, 40, 36], 900, W - 140, 2) if kanca else (0, [])
    kanca_ust = 1215 - (len(ks) - 1) * kb * 1.15 - kb - 30 if ks else 1210
    for boy in [70, 64, 58, 52, 48, 44, 40]:
        sa = sar(f"“{a['baslik']}”", boy, 900, genis, 4)
        sb = sar(f"“{b['baslik']}”", boy, 900, genis, 4)
        yuk = lambda s_: 60 + boy + (len(s_) - 1) * boy * 1.12 + 24
        if 200 + yuk(sa) + 150 + yuk(sb) <= kanca_ust:
            break
    y = 200
    for blok, sat, renk, yrenk in ((a, sa, YS, SIS_YAZI if ton == "yas" else BEYAZ), (b, sb, KR, SIS_SOLUK if ton == "yas" else "#d9d4cc")):
        h_ = yuk(sat)
        p.append(f'<rect x="70" y="{y}" width="10" height="{h_:.0f}" rx="5" fill="{renk}"{parla}/>')
        p.append(f'<text x="110" y="{y + 34}" font-family="{F}" font-weight="800" font-size="26" letter-spacing="3" fill="{renk}">'
                 f'{_e(buyuk(blok["kaynak"] + " · " + blok["kamp"]))}</text>')
        s_, _ = yazi(110, y + 54 + boy, sat, boy, yrenk)
        p.append(s_)
        if blok is a:
            vs = y + h_ + 75
            p.append(f'<circle cx="540" cy="{vs:.0f}" r="54" fill="#07090a" stroke="{AL}" stroke-width="4"{parla}/>'
                     f'<text x="540" y="{vs + 17:.0f}" text-anchor="middle" font-family="{F}" font-weight="900" font-size="46" fill="{AL}">VS</text>')
            y = vs + 75
    if ks:
        s_, _ = yazi(70, 1215 - (len(ks) - 1) * kb * 1.15 - (22 if kunye_ else 0), ks, kb, AL, 900, 1.15, parla.strip())
        p.append(s_)
    p.append(kunye(kunye_))
    p.append(alt_)
    return svg("".join(p))


def sessizlik(baslik, yer_tarih, bolge_sayi, adlar, alt_, arka="", kunye_=""):
    p = [zemin("medya"), arka, etiket(70, 90, "İSRAİL VE BATI BASINI", KIRMIZI),
         f'<text x="{W - 70}" y="127" text-anchor="end" font-family="{F}" font-weight="700" font-size="26" fill="{SOLUK}">{_e(buyuk(yer_tarih))}</text>',
         f'<text x="540" y="640" text-anchor="middle" font-family="{F}" font-weight="900" font-size="560" fill="{KIRMIZI}" filter="url(#parla)">0</text>',
         f'<text x="540" y="730" text-anchor="middle" font-family="{F}" font-weight="800" font-size="56" fill="{BEYAZ}">haber</text>']
    boy, sat = sigdir(baslik, [64, 58, 52, 46], 900, W - 140, 3)
    s, y = yazi(70, 850, sat, boy)
    p.append(s)
    y += 150
    p.append(f'<text x="70" y="{y:.0f}" font-family="{F}" font-weight="900" font-size="120" fill="{YESIL}" filter="url(#hafif)">{bolge_sayi}</text>')
    x = 70 + olc(str(bolge_sayi), 120, 900) + 24
    s, _ = yazi(x, y - 46, ["bölge yayını yazdı:"] + sar(", ".join(adlar), 30, 700, W - 70 - x, 2), 30, BEYAZ, 700, 1.4)
    p.append(s)
    p.append(kunye(kunye_))
    p.append(alt_)
    return svg("".join(p))


def rakam(deger, birim, govde, kaynak, yer_tarih, alt_, tohum=1, arka="", kunye_=""):
    p = [zemin("yas", tohum=tohum), arka, ust_yas(yer_tarih)]
    boy, _ = sigdir(deger, [230, 200, 170, 140, 120], 900, W - 140, 1)
    p.append(f'<text x="70" y="520" font-family="{F}" font-weight="900" font-size="{boy}" fill="url(#kan)">{_e(deger)}</text>')
    b2, sat = sigdir(birim, [78, 66, 56], 800, W - 140, 2)
    s, y = yazi(70, 640, sat, b2, SIS_YAZI, 800)
    p.append(s)
    y += 60
    p.append(f'<line x1="70" y1="{y:.0f}" x2="250" y2="{y:.0f}" stroke="{KAN}" stroke-width="3"/>')
    s, _ = yazi(70, y + 80, sar(govde, 38, 400, W - 140, 6), 38, SIS_SOLUK, 400, 1.45)
    p.append(s)
    if kaynak:
        s, _ = yazi(70, 1150 - (30 if kunye_ else 0), sar("Kaynak: " + kaynak, 26, 500, W - 140, 2), 26, "#8a9198", 500, 1.35)
        p.append(s)
    p.append(kunye(kunye_))
    p.append(alt_)
    return svg("".join(p))


def liste_sayfalari(girdiler):
    """Yayın girdilerini (kamp başlıklarıyla) kartlara böler. Girdi: {ad, yer, bakis, yorum, kamp}"""
    sayfalar, simdiki, y, kamp = [], [], 120, None
    ALT = H - 160
    for g in girdiler:
        g["_satir"] = sar(g["yorum"], 32, 500, W - 182, 3)
        boy = 84 + len(g["_satir"]) * 43 + 40
        ek = 86 if g["kamp"] != kamp else 0
        if simdiki and y + ek + boy > ALT:
            sayfalar.append(simdiki)
            simdiki, y, ek = [], 120, 86
        if ek:
            simdiki.append(("baslik", g["kamp"]))
            y += 86
            kamp = g["kamp"]
        simdiki.append(("girdi", g))
        y += boy
    if simdiki:
        sayfalar.append(simdiki)
    return sayfalar


def liste(bloklar, ton, ust, alt_):
    p = [zemin(ton, tohum=3)]
    p.append(ust_yas(ust) if ton == "yas" else etiket(70, 90, buyuk(ust), BEYAZ))
    y = 190
    for tur, g in bloklar:
        if tur == "baslik":
            renk = KAN if ton == "yas" else ALTIN
            p.append(f'<text x="70" y="{y + 10}" font-family="{F}" font-weight="900" font-size="26" letter-spacing="3" fill="{renk}">{_e(buyuk(g))}</text>'
                     f'<line x1="70" y1="{y + 30}" x2="{W - 70}" y2="{y + 30}" stroke="{renk}" stroke-opacity=".35" stroke-width="2"/>')
            y += 86
            continue
        nokta = BAKIS_RENK.get(g["bakis"], SOLUK)
        p.append(f'<circle cx="86" cy="{y - 12}" r="13" fill="{nokta}"{"" if ton == "yas" else " filter=" + chr(34) + "url(#hafif)" + chr(34)}/>')
        p.append(f'<text x="112" y="{y}" font-family="{F}" font-weight="900" font-size="36" fill="{BEYAZ}">{_e(g["ad"])}</text>')
        p.append(f'<text x="112" y="{y + 38}" font-family="{F}" font-weight="500" font-size="24" fill="{SOLUK}">'
                 f'{_e(g["yer"])} · {_e(BAKIS_AD.get(g["bakis"], ""))}</text>')
        s, y2 = yazi(112, y + 84, g["_satir"], 32, "#d7d2ca" if ton != "yas" else SIS_SOLUK, 500, 1.34)
        p.append(s)
        y = y2 + 84
    p.append(alt_)
    return svg("".join(p))


def son(ton, soru, alan, alt_):
    p = [zemin(ton, tohum=5)]
    p.append(ust_yas("Tamamı sitede") if ton == "yas" else etiket(70, 90, "TAMAMI SİTEDE", YESIL))
    boy, sat = sigdir(soru, [66, 60, 54], 900, W - 140, 4)
    s, y = yazi(70, 330, sat, boy, SIS_YAZI if ton == "yas" else BEYAZ, 900, 1.15)
    p.append(s)
    renk = KAN if ton == "yas" else YESIL
    p.append(f'<text x="70" y="{y + 110:.0f}" font-family="{F}" font-weight="800" font-size="34" fill="{renk}">{_e(alan)}</text>')
    p.append(f'<text x="70" y="{y + 165:.0f}" font-family="{F}" font-weight="500" font-size="30" fill="{SOLUK}">Bağlantı profilde.</text>')
    s, _ = yazi(70, H - 330, sar("Başlangıç noktamız Filistin bakışı. Kartlardaki açıklamaları yapay zekâ, yayınların kendi "
                                  "haberlerine dayanarak yazdı; başlıklar Türkçeye çevrildi. Özgün metinler sitede.", 26, 400, W - 140, 5),
                26, "#7b847f", 400, 1.45)
    p.append(s)
    p.append(alt_)
    return svg("".join(p))
