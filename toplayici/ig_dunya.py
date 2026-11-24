"""Instagram Reels: "Dünya bu haberi nasıl yazdı?" — dünya haritası üzerinde gezinen dikey video (1080x1920).

Günün en çok ülkeden yayının yazdığı olayı seçilir. Kamera önce olayın yerine iner (olayın başlığı Türkçe, İngilizce,
Arapça), sonra o olayı yazan yayınların ülkelerine sırayla uçar; her durakta yayının adı ve manşeti üç dilde görünür.
Sonda bütün duraklar olayın yerine bağlanmış hâlde dünya görünümü.

Harita Natural Earth (kamu malı) kara poligonlarından çizilir; ülke sınırı çizilmez, yalnızca kara kütlesi (sitenin
"sınır çizme" kuralı). Kareler Pillow ile üretilip ffmpeg'e borudan verilir; yazılar rsvg-convert ile (Arapça doğru
birleşsin diye). Müzik yok; Instagram ses izi istediği için sessiz ses izi eklenir.
"""
import html
import json
import math
import os
import shutil
import subprocess
import tempfile

import ig_harita
import ig_kart

G, Y, FPS = 1080, 1920, 30
B = 22.0                       # taban haritada derece başına piksel
KUZEY, GUNEY = 84.0, -60.0
ZEMIN = (7, 9, 10)
KARA = "#1d3429"
YESIL, KIRMIZI, ALTIN, BEYAZ, SOLUK = "#19e68c", "#e2343f", "#f3c969", "#f5f2ec", "#8b948f"
DURAK_ZUM = 20.0               # durakta derece başına piksel (yaklaşık 54° genişlik)
GENEL_ZUM = 5.2                # dünya görünümü
ODAK_Y = 640                   # hedef noktanın karedeki yüksekliği (alt yarı yazı kartına ayrılır)
F = ig_kart.F
FA = ig_kart.FA


def _e(s):
    return html.escape(str(s or ""), quote=True)


# ------------------------------------------------------------------ taban harita
def taban(kok, yol):
    """Eşdikdörtgen (plate carrée) kara haritası PNG. Döndürür: (genişlik, yükseklik) ya da None."""
    halkalar = ig_harita.halkalar(kok)
    if not halkalar or not shutil.which("rsvg-convert"):
        return None
    w, h = int(360 * B), int((KUZEY - GUNEY) * B)
    yollar = []
    for r in halkalar:
        if len(r) < 3:
            continue
        # 180. boylamı kesen halkalar (Rusya, Fiji): boylamı aç, iki kopyasını çiz
        acik, onceki = [], None
        for lo, la in r:
            if onceki is not None:
                while lo - onceki > 180:
                    lo -= 360
                while lo - onceki < -180:
                    lo += 360
            acik.append((lo, la))
            onceki = lo
        for kay in (0, 360, -360):
            xs = [lo + kay for lo, _ in acik]
            if max(xs) < -180 or min(xs) > 180:
                continue
            yollar.append("M" + "L".join(f"{(lo + kay + 180) * B:.1f} {(KUZEY - la) * B:.1f}" for lo, la in acik) + "Z")
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
           f'<rect width="{w}" height="{h}" fill="#07090a"/>'
           f'<path d="{"".join(yollar)}" fill="{KARA}" stroke="{KARA}" stroke-width="1.2" fill-rule="nonzero"/></svg>')
    s_yol = yol[:-4] + ".svg"
    open(s_yol, "w").write(svg)
    try:
        subprocess.run(["rsvg-convert", "-w", str(w), "-h", str(h), s_yol, "-o", yol], check=True, timeout=180)
    except Exception:
        return None
    finally:
        os.remove(s_yol)
    return w, h


def _xy(lon, lat):
    return (lon + 180) * B, (KUZEY - lat) * B


# ------------------------------------------------------------------ yazı katmanları (SVG -> RGBA PNG)
def _png(svg, yol):
    s_yol = yol[:-4] + ".svg"
    open(s_yol, "w", encoding="utf-8").write(svg)
    subprocess.run(["rsvg-convert", "-w", str(G), "-h", str(Y), s_yol, "-o", yol], check=True, timeout=60)
    os.remove(s_yol)
    return yol


def _blok(x, y, metin, boy, agirlik, renk, genislik, en_cok, arap=False):
    """Sarılmış metin; Arapça sağa yaslı. Döndürür: (svg, son satırın altı)."""
    satir = ig_kart.sar(metin, boy, agirlik, genislik * (0.86 if arap else 1), en_cok)
    p = []
    for i, s in enumerate(satir):
        yy = y + boy + i * boy * 1.24
        if arap:
            p.append(f'<text x="{G - 64}" y="{yy:.0f}" text-anchor="end" font-family="{FA}" font-weight="700" font-size="{boy}" '
                     f'fill="{renk}">‏{_e(s)}‏</text>')
        else:
            p.append(f'<text x="64" y="{yy:.0f}" font-family="{F}" font-weight="{agirlik}" font-size="{boy}" fill="{renk}">{_e(s)}</text>')
    return "".join(p), y + boy + (len(satir) - 1) * boy * 1.24


def _cerceve(ic, ust_tr, ust_en, tarih, marka, kullanici):
    golge = ('<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07090a" stop-opacity="0"/>'
             '<stop offset=".22" stop-color="#07090a" stop-opacity=".86"/><stop offset="1" stop-color="#07090a" stop-opacity=".97"/></linearGradient>'
             '<linearGradient id="u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07090a" stop-opacity=".9"/>'
             '<stop offset="1" stop-color="#07090a" stop-opacity="0"/></linearGradient></defs>'
             f'<rect y="0" width="{G}" height="250" fill="url(#u)"/><rect y="1040" width="{G}" height="{Y - 1040}" fill="url(#a)"/>')
    ust = (f'<text x="64" y="118" font-family="{F}" font-weight="900" font-size="30" letter-spacing="3" fill="{YESIL}">{_e(ust_tr)}</text>'
           f'<text x="64" y="160" font-family="{F}" font-weight="700" font-size="26" letter-spacing="2" fill="{SOLUK}">{_e(ust_en)}</text>'
           f'<text x="{G - 64}" y="118" text-anchor="end" font-family="{F}" font-weight="700" font-size="26" fill="{SOLUK}">{_e(tarih)}</text>')
    alt = (f'<g transform="translate(64 1800)"><rect width="46" height="46" rx="10" fill="{YESIL}"/>'
           f'<text x="23" y="33" text-anchor="middle" font-family="{F}" font-weight="900" font-size="24" fill="#07090a">{_e(marka[:1])}</text>'
           f'<text x="62" y="34" font-family="{F}" font-weight="900" font-size="32" fill="{BEYAZ}">{_e(marka)}</text>'
           + (f'<text x="{62 + ig_kart.olc(marka, 32, 900) + 16:.0f}" y="34" font-family="{F}" font-weight="500" font-size="26" fill="{SOLUK}">@{_e(kullanici)}</text>' if kullanici else "")
           + '</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{G}" height="{Y}" viewBox="0 0 {G} {Y}">{golge}{ust}{ic}{alt}</svg>'


def durak_karti(etiket, alt_etiket, tr, en, ar, renk):
    p = [f'<text x="64" y="1170" font-family="{F}" font-weight="900" font-size="34" letter-spacing="2" fill="{renk}">{_e(etiket)}</text>',
         f'<text x="64" y="1212" font-family="{F}" font-weight="600" font-size="26" fill="{SOLUK}">{_e(alt_etiket)}</text>',
         f'<line x1="64" y1="1236" x2="{G - 64}" y2="1236" stroke="{renk}" stroke-opacity=".45" stroke-width="2"/>']
    y = 1250
    for boy in (50, 46, 42, 38, 34):
        s1, y1 = _blok(64, y, tr, boy, 800, BEYAZ, G - 128, 4)
        s2, y2 = _blok(64, y1 + 30, en, round(boy * .72), 600, "#cfd6d1", G - 128, 3)
        s3, y3 = _blok(64, y2 + 30, ar, round(boy * .78), 700, "#e8e2d8", G - 128, 3, arap=True)
        if y3 <= 1760:
            break
    p += [s1, s2, s3]
    return "".join(p)


def kapanis_karti(sayi_ulke, sayi_yayin, alan):
    p = []
    s, y = _blok(64, 1190, f"Aynı olay, {sayi_ulke} ülke, {sayi_yayin} manşet.", 58, 900, BEYAZ, G - 128, 2)
    p.append(s)
    s, y = _blok(64, y + 26, f"One event, {sayi_ulke} countries, {sayi_yayin} headlines.", 38, 700, "#cfd6d1", G - 128, 2)
    p.append(s)
    s, y = _blok(64, y + 26, f"حدث واحد، {sayi_ulke} دول، {sayi_yayin} عناوين.", 42, 700, "#e8e2d8", G - 128, 2, arap=True)
    p.append(s)
    p.append(f'<text x="64" y="{y + 110:.0f}" font-family="{F}" font-weight="800" font-size="38" fill="{YESIL}">{_e(alan)}</text>')
    p.append(f'<text x="64" y="{y + 158:.0f}" font-family="{F}" font-weight="500" font-size="28" fill="{SOLUK}">'
             f'Kim nasıl yazdı: bağlantı profilde · Link in bio</text>')
    return "".join(p)


# ------------------------------------------------------------------ seçim
def _kokler(metin):
    import re
    return {w[:5] for w in re.findall(r"\w+", str(metin or "").lower()) if len(w) >= 5 and not w.isdigit()}


def sec(olaylar, haberler, kaynaklar, en_az_ulke=4, en_cok=6):
    """En çok ülkeden yayının yazdığı olay ve ülke başına bir yayın. Döndürür: (olay, duraklar) ya da None."""
    en_iyi = None
    for o in olaylar:
        yer = o.get("yer") or {}
        if yer.get("lat") is None:
            continue
        ulke = {}
        for hid in o.get("haberler", []):
            h = haberler.get(hid)
            k = kaynaklar.get(h.get("kaynak")) if h else None
            if not k or k.get("silahli") or k.get("lat") is None or not k.get("ulke") or k["ulke"] == "Belirsiz":
                continue
            bas_tr = h.get("baslik_tr") or (h.get("baslik_orj") if h.get("dil") == "tr" else "")
            if not bas_tr or not (_kokler(bas_tr) & _kokler(o.get("baslik"))):
                continue   # olay kümesine yanlışlıkla düşmüş başka bir haber: başlıkta olayın hiçbir anahtar sözcüğü yok
            aday = {"hid": hid, "ad": k["ad"], "ulke": k["ulke"], "sehir": k.get("sehir") or "", "lat": k["lat"], "lon": k["lon"],
                    "tr": bas_tr, "en": h.get("baslik_en") or (h.get("baslik_orj") if h.get("dil") == "en" else ""),
                    "ar": h.get("baslik_orj") if h.get("dil") == "ar" else "", "oncelik": bool(k.get("oncelik"))}
            eski = ulke.get(k["ulke"])
            if not eski or (aday["oncelik"] and not eski["oncelik"]):
                ulke[k["ulke"]] = aday
        if len(ulke) >= en_az_ulke and (not en_iyi or len(ulke) > len(en_iyi[1])):
            en_iyi = (o, ulke)
    if not en_iyi:
        return None
    o, ulke = en_iyi
    # en yakın komşu sırası: olayın yerinden başla
    kalan, yol = list(ulke.values()), []
    lat, lon = o["yer"]["lat"], o["yer"]["lon"]
    while kalan and len(yol) < en_cok:
        d = min(kalan, key=lambda a: (a["lat"] - lat) ** 2 + ((a["lon"] - lon) * math.cos(math.radians(lat))) ** 2)
        kalan.remove(d)
        yol.append(d)
        lat, lon = d["lat"], d["lon"]
    return o, yol


# ------------------------------------------------------------------ çizim
def _kare(taban_img, lon, lat, zum):
    """Kamera (lon, lat, zum) için 1080x1920 kare: hedef nokta ODAK_Y yüksekliğinde."""
    from PIL import Image
    oran = zum / B
    cx, cy = _xy(lon, lat)
    x0, y0 = cx - (G / 2) / oran, cy - ODAK_Y / oran
    x1, y1 = x0 + G / oran, y0 + Y / oran
    tw, th = taban_img.size
    kx0, ky0, kx1, ky1 = max(0, x0), max(0, y0), min(tw, x1), min(th, y1)
    kare = Image.new("RGB", (G, Y), ZEMIN)
    if kx1 > kx0 and ky1 > ky0:
        hx0, hy0 = round((kx0 - x0) * oran), round((ky0 - y0) * oran)
        hw, hh = max(1, round((kx1 - kx0) * oran)), max(1, round((ky1 - ky0) * oran))
        parca = taban_img.resize((hw, hh), Image.BILINEAR, box=(kx0, ky0, kx1, ky1), reducing_gap=2.0)
        kare.paste(parca, (hx0, hy0))
    donus = lambda lo, la: ((_xy(lo, la)[0] - x0) * oran, (_xy(lo, la)[1] - y0) * oran)
    return kare, donus


def _renk(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _isaretler(kare, donus, olay_yer, duraklar, ziyaret, hedef, nabiz):
    from PIL import ImageDraw
    d = ImageDraw.Draw(kare, "RGBA")
    ox, oy = donus(olay_yer[1], olay_yer[0])
    for i in ziyaret:
        x, y = donus(duraklar[i]["lon"], duraklar[i]["lat"])
        d.line([(ox, oy), (x, y)], fill=_renk(YESIL) + (110,), width=3)
    for i in ziyaret:
        x, y = donus(duraklar[i]["lon"], duraklar[i]["lat"])
        d.ellipse([x - 9, y - 9, x + 9, y + 9], fill=_renk(YESIL) + (255,))
    d.ellipse([ox - 12, oy - 12, ox + 12, oy + 12], fill=_renk(KIRMIZI) + (255,))
    if hedef is not None:
        x, y = (ox, oy) if hedef == -1 else donus(duraklar[hedef]["lon"], duraklar[hedef]["lat"])
        r = 16 + 40 * nabiz
        a = int(200 * (1 - nabiz))
        renk = _renk(KIRMIZI if hedef == -1 else YESIL)
        d.ellipse([x - r, y - r, x + r, y + r], outline=renk + (a,), width=4)


def _yumusak(t):
    return t * t * (3 - 2 * t)


def uret(kok, o, duraklar, ceviri, cikti_klasor, marka, kullanici, alan, tarih, log=print):
    """Video (video.mp4) ve kapak (1.jpg, 1080x1350) üretir. ceviri: {"olay_ar": "...", "ar": [durak başına Arapça]}."""
    from PIL import Image
    ff = shutil.which("ffmpeg")
    if not ff or not shutil.which("rsvg-convert"):
        return False
    Image.MAX_IMAGE_PIXELS = None
    gecici = tempfile.mkdtemp()
    try:
        tyol = os.path.join(gecici, "taban.png")
        if not taban(kok, tyol):
            return False
        taban_img = Image.open(tyol).convert("RGB")
        yer = (o["yer"]["lat"], o["yer"]["lon"])
        ust = ("DÜNYA BU HABERİ NASIL YAZDI?", "HOW THE WORLD REPORTED IT")
        # yazı katmanları
        katman = {}
        cer = lambda ic: _cerceve(ic, ust[0], ust[1], tarih, marka, kullanici)
        katman[-1] = Image.open(_png(cer(durak_karti("OLAY · EVENT · الحدث", o["yer"].get("ad", ""), o["baslik"],
                                                         o.get("baslik_en") or "", ceviri.get("olay_ar") or "", KIRMIZI)),
                                     os.path.join(gecici, "k-1.png"))).convert("RGBA")
        for i, dr in enumerate(duraklar):
            ar = dr["ar"] or (ceviri.get("ar") or [""] * len(duraklar))[i] or ""
            katman[i] = Image.open(_png(cer(durak_karti(dr["ad"].upper(), f'{dr["ulke"]}' + (f' · {dr["sehir"]}' if dr["sehir"] else ""),
                                                         dr["tr"], dr["en"], ar, YESIL)),
                                        os.path.join(gecici, f"k{i}.png"))).convert("RGBA")
        katman["son"] = Image.open(_png(cer(kapanis_karti(len(duraklar), len(duraklar), alan)),
                                        os.path.join(gecici, "kson.png"))).convert("RGBA")
        katman["bos"] = Image.open(_png(cer(""), os.path.join(gecici, "kbos.png"))).convert("RGBA")

        # zaman çizelgesi: (süre, başlangıç kamerası, bitiş kamerası, katman, hedef, ziyaret edilenler)
        genel = (yer[1] + 20, 25.0, GENEL_ZUM)
        olay_kam = (yer[1], yer[0], DURAK_ZUM)
        sahne = [(1.4, genel, genel, "bos", None, []), (1.6, genel, olay_kam, "bos", None, []), (4.0, olay_kam, olay_kam, -1, -1, [])]
        onceki = olay_kam
        for i, dr in enumerate(duraklar):
            kam = (dr["lon"], dr["lat"], DURAK_ZUM)
            sahne.append((1.7, onceki, kam, "bos", None, list(range(i))))
            sahne.append((4.4, kam, kam, i, i, list(range(i + 1))))
            onceki = kam
        sahne.append((1.8, onceki, genel, "bos", None, list(range(len(duraklar)))))
        sahne.append((3.6, genel, genel, "son", None, list(range(len(duraklar)))))

        video = os.path.join(cikti_klasor, "video.mp4")
        arg = [ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{G}x{Y}", "-r", str(FPS), "-i", "-",
               "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100", "-shortest",
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
               "-c:a", "aac", "-b:a", "64k", video]
        surec = subprocess.Popen(arg, stdin=subprocess.PIPE)
        kapak = None
        for sure, a, b, kat, hedef, ziyaret in sahne:
            n = max(1, round(sure * FPS))
            ucus = a != b
            for f in range(n):
                t = f / max(1, n - 1)
                e = _yumusak(t)
                lon = a[0] + (b[0] - a[0]) * e
                lat = a[1] + (b[1] - a[1]) * e
                zum = a[2] + (b[2] - a[2]) * e
                if ucus and a[2] == b[2]:          # durak arası: yolun ortasında biraz uzaklaş
                    zum *= 1 - 0.42 * math.sin(math.pi * e)
                kare, donus = _kare(taban_img, lon, lat, zum)
                _isaretler(kare, donus, yer, duraklar, ziyaret, hedef, (f / FPS * 1.1) % 1)
                k = katman[kat]
                if not ucus and kat != "bos":
                    gir = min(1, f / (0.35 * FPS)) * min(1, (n - f) / (0.3 * FPS))
                    if gir < 1:
                        k = Image.blend(katman["bos"], k, gir)
                kare.paste(k, (0, 0), k)
                if kat == -1 and f == n // 2:
                    kapak = kare.copy()
                surec.stdin.write(kare.tobytes())
        surec.stdin.close()
        surec.wait(timeout=600)
        if surec.returncode != 0 or not os.path.isfile(video):
            return False
        if kapak is not None:   # akış gönderisi gerekirse 4:5 kapak
            kapak.crop((0, 570, G, 570 + 1350)).save(os.path.join(cikti_klasor, "1.jpg"), "JPEG", quality=88, optimize=True)
        return True
    except Exception as e:
        log(f"Dünya videosu üretilemedi: {type(e).__name__}: {e}")
        return False
    finally:
        shutil.rmtree(gecici, ignore_errors=True)


CEVIRI_TALIMAT = """Aşağıdaki haber başlıklarını Arapçaya çevir. Gazete başlığı dili kullan, anlamı değiştirme, ekleme yapma.
Başlık bir yayının kendi ifadesiyse onun ifadesini koru (tırnak içindeki nitelemeleri olduğu gibi çevir).
Yalnızca şu JSON'u döndür: {"ar": ["...", ...]} (aynı sırayla, aynı sayıda)."""


def aciklama(o, duraklar, alan, ar=None):
    s = [f"🌍 Dünya bu haberi nasıl yazdı? · {o['baslik']}", ""]
    for d in duraklar:
        s.append(f"• {d['ulke']} · {d['ad']}: “{d['tr']}”")
    s += ["", f"Aynı olayı {len(duraklar)} ülkeden yayınlar böyle verdi. Tüm haberler ve özgün bağlantılar: profildeki bağlantı ({alan})",
          "", "— English —", f"How the world reported it: {o.get('baslik_en') or ''}"]
    s += [f"• {d['ad']} ({d['ulke']}): “{d['en']}”" for d in duraklar if d.get("en")]
    s += ["", "— العربية —", "كيف نقل العالم هذا الخبر؟"]
    s += [f"• {d['ad']}: «{a}»" for d, a in zip(duraklar, ar or []) if a]
    s += ["",
          "Başlıklar yayınların kendi başlıklarının çevirisidir; özgün metinler sitede.", "",
          "#Filistin #Gazze #medya #Palestine #Gaza #فلسطين #غزة"]
    m = "\n".join(s)
    while len(m) > 2150 and len(duraklar) > 3:
        duraklar = duraklar[:-1]
        return aciklama(o, duraklar, alan, (ar or [])[:len(duraklar)])
    return m[:2150]
