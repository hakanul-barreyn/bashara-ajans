"""Almanak bültenlerini dışa aktarma: CSV dosyaları (ve hepsini içeren zip) ile paylaşılabilir PNG özet kartı.

csv_yaz(b, klasor)  -> data/bulten/<tur>/<anahtar>/*.csv ve data/bulten/<tur>/<anahtar>.zip
kart_yaz(b, yol)    -> 1080x1080 PNG (rsvg-convert varsa); SVG her durumda yazılır
"""
import csv
import html
import io
import os
import re
import shutil
import subprocess
import zipfile

import marka

KR = {"Filistin": "#2b8a5e", "Arap dünyası": "#6fae92", "İran ve Yemen": "#c39a35", "Türkiye": "#c9544e", "İsrail": "#4a72c4",
      "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#8d969e", "Diğer": "#6b746f"}


def _tablolar(b):
    s = b["istatistik"]
    t = {}
    t["kamp_bakis"] = (["grup", "olculen_baslik", "uzaklik_0_2", "filistin_bakisi", "aktarim", "israil_abd_bakisi"],
                       [[x["ad"], x["n"], x["uzaklik"], x["filistin"], x["aktarim"], x["israil"]] for x in s["kamp_bakis"]])
    t["cizgi_bakis"] = (["cizgi", "olculen_baslik", "uzaklik_0_2", "filistin_bakisi", "aktarim", "israil_abd_bakisi"],
                        [[x["ad"], x["n"], x["uzaklik"], x["filistin"], x["aktarim"], x["israil"]] for x in s["cizgi_bakis"]])
    t["yayinlar"] = (["yayin", "olculen_baslik", "uzaklik_0_2", "filistin_bakisi", "aktarim", "israil_abd_bakisi"],
                     [[x["ad"], x["n"], x["uzaklik"], x["filistin"], x["aktarim"], x["israil"]] for x in s.get("yayin_tum", [])])
    t["konular"] = (["konu", "bolge_basini_haber", "bolge_basini_pay_yuzde", "israil_bati_haber", "israil_bati_pay_yuzde", "oran"],
                    [[x["konu"], x["bolge_ici"], x["bolge_ici_pay"], x["israil_bati"], x["israil_bati_pay"], x["oran"]] for x in s["konular"]])
    t["gorulmeyen_olaylar"] = (["kod", "tarih", "olay", "yayin_sayisi", "gruplar"],
                               [[x.get("kod", ""), x["tarih"], x["baslik"], x["kaynak"], "; ".join(f"{a} {n}" for a, n in x["kamplar"].items())]
                                for x in s["gormeyen_israil_bati"]])
    g = s.get("gecikme") or {}
    t["gecikme"] = (["kod", "tarih", "olay", "israil_bati_kac_saat_sonra"],
                    [[x["kod"], x["tarih"], x["baslik"], x["saat"]] for x in g.get("en_gec", [])])
    d = s.get("dil") or {}
    t["dil_sayaci"] = (["kelime", "anlati", "bolge_basini_sayi", "bolge_basini_binde", "israil_bati_sayi", "israil_bati_binde"],
                       [[x["ad"], x["yan"], x["ic"], x["ic_binde"], x["dis"], x["dis_binde"]] for x in d.get("terimler", [])])
    t["gunluk"] = (["gun", "bolge_basini_haber", "israil_bati_haber", "bolge_basini_gazze", "israil_bati_gazze",
                    "bolge_basini_uzaklik", "israil_bati_uzaklik"],
                   [[x["gun"], x["ic"], x["dis"], x["ic_gazze"], x["dis_gazze"], x["ic_uzaklik"], x["dis_uzaklik"]] for x in s.get("gunluk", [])])
    o = s.get("olum") or {}
    t["olu_basina_haber"] = (["grup", "haber", "filistinli_olumu_anan_haber", "israilli_olumu_anan_haber",
                              "filistinli_olu_basina_haber", "israilli_olu_basina_haber", "kat"],
                             [[x["ad"], x["haber"], x["filistinli_haber"], x["israilli_haber"], x["filistinli_olu_basina"],
                               x["israilli_olu_basina"], x["kat"]] for x in o.get("gruplar", [])])
    kanit = []
    for kod, v in (s.get("kodlar") or {}).items():
        for h in v["haberler"]:
            kanit.append([kod, v["tarih"], v["baslik"], h["yayin"], h["kamp"], h.get("bakis") or "", h.get("baslik") or "", h.get("url") or ""])
    t["kanitlar"] = (["kod", "tarih", "olay", "yayin", "grup", "bakis", "ozgun_baslik", "baglanti"], kanit)
    return t


def csv_yaz(b, klasor):
    """Döndürür: zip dosyasının yolu"""
    hedef = os.path.join(klasor, b["anahtar"])
    os.makedirs(hedef, exist_ok=True)
    zyol = os.path.join(klasor, b["anahtar"] + ".zip")
    with zipfile.ZipFile(zyol, "w", zipfile.ZIP_DEFLATED) as z:
        for ad, (baslik, satirlar) in _tablolar(b).items():
            tampon = io.StringIO()
            w = csv.writer(tampon)
            w.writerow(baslik)
            w.writerows(satirlar)
            veri = "﻿" + tampon.getvalue()   # Excel Türkçe karakterleri doğru açsın
            with open(os.path.join(hedef, ad + ".csv"), "w", encoding="utf-8", newline="") as f:
                f.write(veri)
            z.writestr(f"{b['anahtar']}/{ad}.csv", veri)
    return zyol


# ------------------------------------------------------------------ görsel kart
def _sar(metin, genislik):
    satir, simdiki = [], ""
    for k in metin.split():
        if len(simdiki) + len(k) + 1 > genislik and simdiki:
            satir.append(simdiki)
            simdiki = k
        else:
            simdiki = (simdiki + " " + k).strip()
    if simdiki:
        satir.append(simdiki)
    return satir


def _logo_ic(kok):
    try:
        s = open(os.path.join(kok, "site", "logo.svg"), encoding="utf-8").read()
        ic = s[s.index(">", s.index("<svg")) + 1:s.rindex("</svg>")]
        for a in ("sol", "sag", "kure"):
            ic = ic.replace(f'id="{a}"', f'id="k-{a}"').replace(f"url(#{a})", f"url(#k-{a})")
        return ic
    except Exception:
        return ""


def kart_svg(b, kok, site=""):
    s, a = b["istatistik"], b.get("anlati") or {}
    M = marka.oku(kok)
    e = lambda x: html.escape(str(x), quote=True)
    F = "DejaVu Sans, Noto Sans, Arial, sans-serif"
    y = 0
    parca = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">',
             '<rect width="1080" height="1080" fill="#f3f2ee"/>',
             '<rect x="0" y="0" width="1080" height="14" fill="#2b8a5e"/><rect x="540" y="0" width="540" height="14" fill="#c9544e"/>',
             f'<g transform="translate(70 62) scale(1.15)">{_logo_ic(kok)}</g>',
             f'<text x="160" y="104" font-family="{F}" font-size="38" font-weight="bold" fill="#1d2421">{e(M["ad"])} Almanak</text>',
             f'<text x="160" y="140" font-family="{F}" font-size="24" fill="#6b746f">{e(b["ad"])}{" · taslak" if b.get("taslak") else ""}</text>']
    y = 230
    for satir in _sar(a.get("baslik") or b["ad"], 30)[:3]:
        parca.append(f'<text x="70" y="{y}" font-family="{F}" font-size="50" font-weight="bold" fill="#1d2421">{e(satir)}</text>')
        y += 62
    y += 20
    # uzaklık ekseni
    parca.append(f'<text x="70" y="{y}" font-family="{F}" font-size="22" font-weight="bold" fill="#6b746f" letter-spacing="2">FİLİSTİN BAKIŞINDAN UZAKLIK</text>')
    y += 30
    x0, x1 = 330, 980
    satirlar = [x for x in s["kamp_bakis"] if x["uzaklik"] is not None][:6]
    for r in satirlar:
        y += 50
        parca.append(f'<text x="70" y="{y + 8}" font-family="{F}" font-size="26" fill="#1d2421">{e(r["ad"])}</text>')
        parca.append(f'<rect x="{x0}" y="{y - 3}" width="{x1 - x0}" height="6" rx="3" fill="#dcdad2"/>')
        cx = x0 + (x1 - x0) * r["uzaklik"] / 2
        parca.append(f'<circle cx="{cx:.0f}" cy="{y}" r="15" fill="{KR.get(r["ad"], "#6b746f")}" stroke="#f3f2ee" stroke-width="4"/>')
        parca.append(f'<text x="{x1 + 10}" y="{y + 8}" font-family="{F}" font-size="22" fill="#4a5550">{f"{r['uzaklik']:.1f}".replace(".", ",")}</text>')
    y += 46
    parca.append(f'<text x="{x0}" y="{y}" font-family="{F}" font-size="18" fill="#7b847e">0 · Filistin bakışı</text>')
    parca.append(f'<text x="{(x0 + x1) / 2:.0f}" y="{y}" text-anchor="middle" font-family="{F}" font-size="18" fill="#7b847e">1 · aktarım</text>')
    parca.append(f'<text x="{x1}" y="{y}" text-anchor="end" font-family="{F}" font-size="18" fill="#7b847e">2 · İsrail / ABD</text>')
    # üç kutu
    g = s.get("gecikme") or {}
    terim = sorted([t for t in (s.get("dil") or {}).get("terimler", []) if t["ic_binde"] is not None and t["dis_binde"] is not None],
                   key=lambda t: -abs((t["ic_binde"] or 0) - (t["dis_binde"] or 0)))
    kutular = [(str(len(s["gormeyen_israil_bati"])), "olayı İsrail ve Batı", "basını hiç yazmadı")]
    if g.get("medyan_saat") is not None:
        kutular.append((f'{g["medyan_saat"]:+.1f} sa'.replace(".", ","), "İsrail ve Batı basını", "olayları bu kadar sonra"))
    if terim:
        t = terim[0]
        kutular.append((f'“{t["ad"]}”', f'bölge basını: binde {t["ic_binde"]:.0f}', f'İsrail ve Batı: binde {t["dis_binde"]:.0f}'))
    y = max(y + 40, 820)
    w = (1080 - 140 - 20 * (len(kutular) - 1)) / max(1, len(kutular))
    for i, (buyuk, k1, k2) in enumerate(kutular):
        x = 70 + i * (w + 20)
        parca.append(f'<rect x="{x:.0f}" y="{y}" width="{w:.0f}" height="170" rx="22" fill="#ffffff"/>')
        boy = 50 if len(buyuk) <= 8 else 36
        parca.append(f'<text x="{x + 26:.0f}" y="{y + 70}" font-family="{F}" font-size="{boy}" font-weight="bold" fill="#c9544e">{e(buyuk)}</text>')
        parca.append(f'<text x="{x + 26:.0f}" y="{y + 112}" font-family="{F}" font-size="21" fill="#4a5550">{e(k1)}</text>')
        parca.append(f'<text x="{x + 26:.0f}" y="{y + 140}" font-family="{F}" font-size="21" fill="#4a5550">{e(k2)}</text>')
    parca.append(f'<text x="70" y="1040" font-family="{F}" font-size="22" fill="#7b847e">{e(site.replace("https://", "").rstrip("/"))}</text>')
    parca.append(f'<text x="1010" y="1040" text-anchor="end" font-family="{F}" font-size="22" fill="#7b847e">{s["haber_sayisi"]} haber · {s["olay_sayisi"]} olay</text>')
    parca.append("</svg>")
    return "\n".join(parca)


def kart_yaz(b, kok, yol_png, site=""):
    """SVG'yi yazar, rsvg-convert varsa PNG üretir. Döndürür: PNG yolu ya da None"""
    svg = kart_svg(b, kok, site)
    yol_svg = yol_png[:-4] + ".svg"
    with open(yol_svg, "w", encoding="utf-8") as f:
        f.write(svg)
    if shutil.which("rsvg-convert"):
        try:
            subprocess.run(["rsvg-convert", "-w", "1080", "-h", "1080", yol_svg, "-o", yol_png], check=True, timeout=60)
            return yol_png
        except Exception:
            return None
    return None
