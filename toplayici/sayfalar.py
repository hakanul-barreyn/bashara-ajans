"""Her haber için ayrı, paylaşılabilir bir sayfa: h/<id>.html.

Amaç: bağlantı WhatsApp, Telegram, X ya da Facebook'ta paylaşıldığında önizlemede sitenin adı değil, haberin başlığı, kısa
Türkçe özeti ve yayının adı görünsün (Open Graph etiketleri); arama motorları da haberleri tek tek bulabilsin.
Sayfalar data/h/ altına yazılır; yayımlamadan önce iş akışı onları sitenin köküne (h/) kopyalar. Yalnızca son SAKLA_GUN günün
sayfaları tutulur; daha eski bir bağlantı 404.html üzerinden ana sayfadaki "#h-<id>" görünümüne yönlendirilir
(o görünüm haberi arşivde arar).
"""
import datetime as dt
import html
import json
import os
import re

import almanak
import marka

SAKLA_GUN = 7
AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
CSP = ("default-src 'self'; script-src 'self' https://gc.zgo.at; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://zbshaber.goatcounter.com; "
       "object-src 'none'; base-uri 'self'; form-action 'none'")


def _e(s):
    return html.escape(str(s or ""), quote=True)


def _kisa(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[:n - 1].rsplit(" ", 1)[0] + "…"


AY_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def _tarih(iso, dil="tr"):
    try:
        t = dt.datetime.fromisoformat(iso).astimezone(dt.timezone(dt.timedelta(hours=3)))
        return f"{t.day} {(AY if dil == 'tr' else AY_EN)[t.month - 1]} {t.year}, {t:%H:%M}"
    except Exception:
        return ""


DOG = {"yanlis": ("❌ Yanlış çıktı", "❌ Proven false", "#fbeaea", "#5d1a1a"),
       "celiskili": ("⚠️ Çelişkili iddia", "⚠️ Disputed claim", "#fdf3e1", "#5a3d06"),
       "dogrulanmamis": ("🔍 Doğrulanmamış", "🔍 Unverified", "#eef1f4", "#2e3a45")}
BAKIS = {"filistin": ("Filistin bakışı", "Palestinian lens", "#19e68c"), "aktarim": ("aktarım", "relaying", "#9aa39e"),
         "israil": ("İsrail / ABD bakışı", "Israeli / US lens", "#5b8cff")}
T = {  # sayfadaki sabit yazılar
    "tr": {"git": "Haberin aslı", "paylas": "Paylaş", "kim": "Kim nasıl yazdı", "fark": "Anlatım farkları", "diger": "Öteki haberler",
           "yayin": "yayın karşılaştırıldı", "tek": "Tek yayın", "bu": "bu haber", "ozgun": "Özgün başlık", "farkyok": "Fark yok.",
           "not": "Özetler ve karşılaştırma, yayınların kendi haberlerinden yapay zekâyla çıkarıldı; haberlerin aslı yayınların sitesinde.",
           "akis": "Akış", "haber": "Haber", "analiz": "Analiz", "oku": "Haberi oku ↗", "cerceve": "Çerçeve"},
    "en": {"git": "Original article", "paylas": "Share", "kim": "Who told it how", "fark": "How the framing differs", "diger": "More stories",
           "yayin": "outlets compared", "tek": "Single outlet", "bu": "this story", "ozgun": "Original headline", "farkyok": "No difference.",
           "not": "Summaries and the comparison were extracted with AI from the outlets' own reports; the originals are on their sites.",
           "akis": "Feed", "haber": "News", "analiz": "Analysis", "oku": "Read ↗", "cerceve": "Framing"},
}


def _dogrulama_blogu(dg, dil):
    if not dg or dg.get("tur") not in DOG:
        return ""
    tr, en, zemin, renk = DOG[dg["tur"]]
    kanit = "".join(f' <a href="{_e(u)}" target="_blank" rel="noopener nofollow" style="color:inherit;font-weight:700">'
                    f'{"Kanıt" if dil == "tr" else "Evidence"} ↗</a>' for u in dg.get("kanit", []) if str(u).startswith(("http://", "https://")))
    return (f'<p style="margin:0;padding:10px 12px;border-radius:10px;background:{zemin};color:{renk};font-size:.9rem;max-width:68ch">'
            f'<b>{_e(tr if dil == "tr" else en)}</b> {_e(dg.get("aciklama", ""))}{kanit}</p>')


def _fark(olay, kmap, dil):
    """Anlatım farkları: olay arşivindeki her haberin 'an' alanlarından (dayanak, fail, bağlam, rakam, kelime)."""
    hs = [x for x in olay.get("haberler", []) if isinstance(x.get("an"), dict) and kmap.get(x.get("k"))]
    if len(hs) < 2:
        return ""
    t = T[dil]
    if olay.get("fark") is False:
        icerik = f'<p><b>{t["farkyok"]}</b> {_e(olay.get("ortak") or "")}</p>'
    else:
        ad = lambda x: kmap[x["k"]]["ad"]
        satir = []
        acik = [x for x in hs if x["an"].get("fail") == "acik"]
        edil = [x for x in hs if x["an"].get("fail") == "edilgen"]
        if acik and edil:
            satir.append(("Fail", f"{len(acik)} yayın faili açıkça yazdı; {len(edil)} yayın edilgen dil kullandı ({', '.join(map(ad, edil))})."))
        elif edil:
            satir.append(("Fail", "Bütün yayınlar edilgen dil kullandı: faili yazan yok."))
        dy = {}
        for x in hs:
            if x["an"].get("dayanak"):
                dy.setdefault(x["an"]["dayanak"], []).append(ad(x))
        if dy:
            satir.append(("Dayanak", "Hepsi: " + next(iter(dy)) + "." if len(dy) == 1 else " · ".join(f"{d} ({len(v)})" for d, v in dy.items())))
        bg = [x for x in hs if x["an"].get("baglam") is True]
        if bg and len(bg) < len(hs):
            satir.append(("Bağlam", f"{len(hs)} yayından {len(bg)} tanesi işgal, abluka ya da öncesi gibi bir bağlam verdi."))
        def grupla(alan, tirnak=False):
            g = {}
            for x in hs:
                if x["an"].get(alan):
                    g.setdefault(x["an"][alan], [])
                    if ad(x) not in g[x["an"][alan]]:
                        g[x["an"][alan]].append(ad(x))
            return g
        rk = grupla("rakam")
        if len(rk) == 1:
            satir.append(("Rakam", f"Hepsi aynı rakamı verdi: {next(iter(rk))}."))
        elif rk:
            satir.append(("Rakam", " · ".join(f"{d}: {', '.join(v[:3])}{f' +{len(v) - 3}' if len(v) > 3 else ''}" for d, v in rk.items())))
        kl = grupla("kelime")
        if len(kl) > 1:
            satir.append(("Kelime", " · ".join(f"“{d}”: {', '.join(v[:3])}{f' +{len(v) - 3}' if len(v) > 3 else ''}" for d, v in kl.items())))
        if not satir:
            return ""
        icerik = ((f'<p>{_e(olay["ortak"])}</p>' if olay.get("ortak") else "")
                  + '<dl class="hs-fark">' + "".join(f"<dt>{_e(a)}</dt><dd>{_e(b)}</dd>" for a, b in satir) + "</dl>")
    return f'<section class="hs-bolum" id="fark-{dil}"><h2>{t["fark"]}</h2>{icerik}</section>'


def _kim_nasil(olay, h, kmap, sayfa_var, dil):
    """Haberin ait olduğu olayı öteki yayınlar nasıl anlattı: kamp kamp, bakış, anlatım çipleri ve kısa betimleme."""
    if not olay or len(olay.get("haberler", [])) < 2:
        return ""
    t = T[dil]
    sira = {k: i for i, k in enumerate(almanak.KAMP_SIRA)}
    satir = []
    for x in sorted(olay["haberler"], key=lambda x: (sira.get(almanak.kamp(kmap.get(x.get("k"))), 99), x.get("t") or "")):
        k = kmap.get(x.get("k"))
        if not k:
            continue
        b = BAKIS.get(x.get("b"))
        hedef = f'{x["id"]}.html' if x["id"] in sayfa_var else (x.get("u") or "")
        if not (hedef.endswith(".html") or hedef.startswith(("http://", "https://"))):
            hedef = ""
        ad = f'<a href="{_e(hedef)}">{_e(k["ad"])}</a>' if hedef else f"<b>{_e(k['ad'])}</b>"
        bu = f' <span class="hs-cip">{t["bu"]}</span>' if x["id"] == h["id"] else ""
        cip = ""
        a = x.get("an") or {}
        if a.get("dayanak"):
            cip += f'<span class="hs-cip">Dayanak: {_e(a["dayanak"])}</span>'
        if a.get("fail") == "acik":
            cip += '<span class="hs-cip iyi">Fail açık</span>'
        elif a.get("fail") == "edilgen":
            cip += '<span class="hs-cip kotu">Edilgen dil</span>'
        if a.get("baglam") is True:
            cip += '<span class="hs-cip iyi">Bağlam var</span>'
        if a.get("rakam"):
            cip += f'<span class="hs-cip">{_e(a["rakam"])}</span>'
        meta = _e(almanak.kamp(k)) + (" · " + _e(b[0] if dil == "tr" else b[1]) if b else "")
        satir.append(f'<li><div class="hs-su"><i style="background:{b[2] if b else "#c9cfcb"}"></i>{ad}{bu}</div>'
                     f'<small>{meta}</small>'
                     + (f'<span>{_e(x.get("bt") or x.get("bo"))}</span>' if (x.get("bt") or x.get("bo")) else "")
                     + (f'<span style="color:var(--k-ink2)">{_e(x.get("ye") if dil == "en" and x.get("ye") else x.get("y"))}</span>' if x.get("y") else "")
                     + (f'<div class="hs-su">{cip}</div>' if cip else "") + "</li>")
    if len(satir) < 2:
        return ""
    return (f'<section class="hs-bolum" id="kim-{dil}"><h2>{t["kim"]} · {len({x.get("k") for x in olay["haberler"]})}</h2>'
            + (f'<p>{_e(olay.get("not_en") if dil == "en" and olay.get("not_en") else olay.get("not"))}</p>' if olay.get("not") else "")
            + f'<ul class="hs-kim">{"".join(satir)}</ul></section>')


def _giris(h, k, olay, kmap, dil, foto, dg):
    """Siyah giriş bölümü: başlık, sayılar, bakış dağılımı, paylaşılan haberin alıntısı ve karşı alıntı, düğmeler."""
    t = T[dil]
    bas = (h.get("baslik_en") if dil == "en" else None) or h.get("baslik_tr") or h.get("baslik_orj") or ""
    oz = (h.get("ozet_en") if dil == "en" else None) or h.get("ozet_tr") or ""
    hs = (olay or {}).get("haberler", [])
    yayin_say = len({x.get("k") for x in hs}) if len(hs) >= 2 else 1
    sayi = {}
    for x in hs:
        if x.get("b") in BAKIS:
            sayi[x["b"]] = sayi.get(x["b"], 0) + 1
    hap = [f'<span class="hs-hap">{_e(t["analiz"] if h.get("nitelik") == "analiz" else t["haber"])}</span>',
           f'<span class="hs-hap">{yayin_say} {t["yayin"]}</span>' if yayin_say > 1 else f'<span class="hs-hap">{t["tek"]}</span>']
    hap += [f'<span class="hs-hap"><i style="background:{BAKIS[v][2]}"></i>{_e(BAKIS[v][0] if dil == "tr" else BAKIS[v][1])} {n}</span>'
            for v, n in sayi.items()]
    # Alıntılar: paylaşılan haber + (varsa) farklı bakıştan bir karşı haber
    alinti = [(h["id"], k, bas, h.get("url"), True)]
    benim_b = next((x.get("b") for x in hs if x["id"] == h["id"]), None)
    karsi = next((x for x in hs if x["id"] != h["id"] and x.get("b") and x.get("b") != benim_b and kmap.get(x.get("k"))), None)
    if karsi:
        alinti.append((karsi["id"], kmap[karsi["k"]], karsi.get("bt") or karsi.get("bo"), karsi.get("u"), False))
    al = "".join(f'<div class="hs-al{" secili" if sec else ""}"><small>{_e(kk.get("ad"))} · {_e(almanak.kamp(kk))}</small>'
                 f'<p>“{_e(_kisa(b_, 160))}”</p>'
                 + (f'<a href="{_e(u)}" target="_blank" rel="noopener">{t["oku"]}</a>' if str(u or "").startswith(("http://", "https://")) else "")
                 + "</div>" for i, kk, b_, u, sec in alinti)
    seridi = "".join(f"<span>{_e(kmap[k_]['ad'])}</span>" for k_ in dict.fromkeys(x.get("k") for x in hs) if kmap.get(k_))
    baslik = ((olay or {}).get("baslik_en" if dil == "en" else "baslik") or (olay or {}).get("baslik")) if len(hs) >= 2 else bas
    # Gecikme: İsrail ve Batı basınının ilk haberi bölge basınının ilk haberinden ne kadar sonra geldi
    gec = ""
    if len(hs) >= 2:
        ic = [x["t"] for x in hs if x.get("t") and almanak.kamp(kmap.get(x.get("k"))) in almanak.BOLGE_ICI]
        ds = [x["t"] for x in hs if x.get("t") and almanak.kamp(kmap.get(x.get("k"))) in almanak.DIS]
        if ic and not ds:
            gec = "İsrail ve Batı basını bu olayı yazmadı." if dil == "tr" else "Israeli and Western outlets did not report this."
        elif ic and ds:
            sa = (dt.datetime.fromisoformat(min(ds)) - dt.datetime.fromisoformat(min(ic))).total_seconds() / 3600
            if abs(sa) < .25:
                gec = "İki taraf da aynı saatlerde yazdı." if dil == "tr" else "Both sides reported it at the same time."
            elif sa > 0:
                gec = (f"İsrail ve Batı basını {sa:.1f} saat sonra yazdı.".replace(".", ",", 1) if dil == "tr"
                       else f"Israeli and Western outlets reported it {sa:.1f} hours later.")
        ilk = min((x for x in hs if x.get("t") and kmap.get(x.get("k"))), key=lambda x: x["t"], default=None)
        if ilk:
            gec += (" İlk yazan: " if dil == "tr" else " First to report: ") + kmap[ilk["k"]]["ad"] + "."
    return (f'<div data-dil="{dil}" class="hs-ic">'
            f'<div class="hs-meta"><time datetime="{_e(h.get("tarih"))}">{_e(_tarih(h.get("tarih"), dil))}</time>'
            + (f' · {_e((olay or {}).get("yer", {}).get("ad"))}' if isinstance((olay or {}).get("yer"), dict) and olay["yer"].get("ad") else "")
            + "</div>"
            f'<div class="hs-meta">{"".join(hap)}</div>'
            + (f'<p class="hs-meta" style="color:#ff9aa8">⏱ {_e(gec.strip())}</p>' if gec else "")
            + _dogrulama_blogu(dg, dil)
            + f'<h1>{_e(baslik or bas)}</h1>'
            + (f'<p class="hs-ozet-ust">{_e(oz)}</p>' if oz else "")
            + f'<div class="hs-alinti">{al}</div>'
            + '<div class="hs-dugmeler">'
            + f'<a class="hs-d ana" href="{_e(h["url"])}" target="_blank" rel="noopener">{t["git"]} ↗</a>'
            + f'<button class="hs-d" type="button" data-paylas>{t["paylas"]}</button>'
            + (f'<a class="hs-d" href="#kim-{dil}">{t["kim"]} ↓</a>' if len(hs) >= 2 else "")
            + "</div>"
            + (f'<div class="hs-seridi">{seridi}</div>' if len(hs) >= 2 else "")
            + (f'<p class="hs-kunye">{_e(foto[1])}</p>' if foto else "")
            + "</div>")


def _diger(digerler, dil, haric):
    t = T[dil]
    kart = []
    for o, hedef in digerler:
        if o.get("id") == haric:
            continue
        n = len({x.get("k") for x in o.get("haberler", [])})
        yer = o["yer"].get("ad") if isinstance(o.get("yer"), dict) else ""
        kart.append(f'<a class="hs-dk" href="{_e(hedef)}"><b>{_e(o.get("baslik"))}</b>'
                    f'<small>{n} {"yayın" if dil == "tr" else "outlets"}{" · " + _e(yer) if yer else ""} · {_e(_tarih(o.get("son") or o.get("ilk"), dil))}</small></a>')
        if len(kart) >= 8:
            break
    if not kart:
        return ""
    return f'<section><h2 style="margin:6px 4px 10px;font-size:1.15rem">{t["diger"]}</h2><div class="hs-diger">{"".join(kart)}</div></section>'


def sayfa(h, k, M, site, surum, dg=None, olay=None, kmap=None, sayfa_var=(), foto=None, digerler=()):
    kmap = kmap or {}
    bas_tr = h.get("baslik_tr") or h.get("baslik_orj") or ""
    yayin = k.get("ad", "")
    adres = f"{site}h/{h['id']}.html"
    hs = (olay or {}).get("haberler", [])
    n = len({x.get("k") for x in hs}) if len(hs) >= 2 else 0
    aciklama = _kisa((f"{n} yayın bu olayı nasıl anlattı? " if n else "") + (h.get("ozet_tr") or h.get("baslik_orj") or ""), 200)
    resim = f"{site}site/paylas.png"
    v = f"?v={surum}"
    foto_ic = f'<div class="hs-foto" style="background-image:url(\'../data/foto/{_e(foto[0])}.jpg\')"></div>' if foto else ""
    govde = "".join(f'<div data-dil="{d}" style="display:contents">{_fark(olay or {}, kmap, d)}{_kim_nasil(olay, h, kmap, sayfa_var, d)}'
                    f'{_diger(digerler, d, (olay or {}).get("id"))}<p class="hs-not">{T[d]["not"]}</p></div>' for d in ("tr", "en"))
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0c0e0d">
<title>{_e(_kisa(bas_tr, 90))} · {_e(yayin)} | {_e(M["ad"])}</title>
<meta name="description" content="{_e(aciklama)}">
<link rel="canonical" href="{_e(adres)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="{_e(M["ad"])}">
<meta property="og:title" content="{_e(_kisa(bas_tr, 110))} · {_e(yayin)}">
<meta property="og:description" content="{_e(aciklama)}">
<meta property="og:url" content="{_e(adres)}">
<meta property="og:image" content="{_e(resim)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="tr_TR">
<meta property="article:published_time" content="{_e(h.get("tarih"))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{_e(_kisa(bas_tr, 110))} · {_e(yayin)}">
<meta name="twitter:description" content="{_e(aciklama)}">
<meta name="twitter:image" content="{_e(resim)}">
<link rel="icon" href="../site/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="../site/stil.css{v}">
<link rel="stylesheet" href="../site/haber.css{v}">
<script src="../site/dil.js{v}"></script>
<script src="../site/marka.js{v}"></script>
<script src="../site/sayfa-haber.js{v}" defer></script>
</head>
<body>
<header class="hs-su">
  <div class="ust-ic">
    <a class="marka" href="../"><img class="logo" src="../site/logo.svg" alt="" width="32" height="32"><span class="marka-ad" data-marka="ad">{_e(M["ad"])}</span></a>
    <p class="slogan" data-marka="slogan">{_e(M.get("slogan", ""))}</p>
    <nav class="menu"><a href="../">Akış</a><a href="../arsiv.html">Arşiv</a><a href="../almanak.html">Almanak</a><a href="../kaynaklar.html">Kaynaklar</a></nav>
  </div>
</header>
<section class="hs-giris">{foto_ic}{_giris(h, k, olay, kmap, "tr", foto, dg)}{_giris(h, k, olay, kmap, "en", foto, dg)}</section>
<main class="hs-govde">{govde}</main>
</body>
</html>
"""


def _foto_sec(kok, yer_ad, tohum):
    """Olayın yeri için onaylı açık lisanslı fotoğraf: (kimlik, künye) ya da None."""
    try:
        import ig_foto
        anahtar = ig_foto.yer_anahtari(yer_ad)
        if not anahtar:
            return None
        onayli, red = ig_foto._onay(kok)
        kat = ig_foto.katalog(kok)
        ad = sorted(i for i, f in kat["fotolar"].items() if f["yer"] == anahtar and i in onayli and i not in red
                    and os.path.isfile(os.path.join(kok, "data", "foto", f"{i}.jpg")))
        if not ad:
            return None
        i = ad[tohum % len(ad)]
        f = kat["fotolar"][i]
        return i, f"Fotoğraf: {f['sanatci']} · {f['lisans']} · Wikimedia Commons"
    except Exception:
        return None


def yaz(kok, haberler, kaynaklar, simdi, log=print):
    """haberler: liste. Döndürür: yazılan sayfa sayısı"""
    M = marka.oku(kok)
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    site = f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else "./"
    kmap = {k["id"]: k for k in kaynaklar}
    try:
        etiketler = json.load(open(os.path.join(kok, "data", "dogrulama.json"), encoding="utf-8")).get("etiketler", {})
    except Exception:
        etiketler = {}
    d = os.path.join(kok, "data", "h")
    os.makedirs(d, exist_ok=True)
    sinir = (simdi - dt.timedelta(days=SAKLA_GUN)).isoformat()
    surum = simdi.strftime("%Y%m%d")
    # Haber -> olay (son SAKLA_GUN+1 günün olay arşivinden; yeni günün kaydı eskisinin üstüne yazar)
    olay_of, tum = {}, {}
    for n in range(SAKLA_GUN + 1, -1, -1):
        g = (simdi - dt.timedelta(days=n)).date().isoformat()
        try:
            for o in json.load(open(os.path.join(kok, "data", "olay-arsiv", g + ".json"), encoding="utf-8")):
                tum[o["id"]] = o
                for x in o.get("haberler", []):
                    olay_of[x["id"]] = o
        except Exception:
            pass
    sayfa_var = {h["id"] for h in haberler}
    # Öteki haberler: en yeni ve en çok yayının yazdığı olaylar (sayfası olan ilk haberine bağlanır)
    digerler = []
    for o in sorted(tum.values(), key=lambda o: (o.get("son") or "", len(o.get("haberler", []))), reverse=True):
        if len({x.get("k") for x in o.get("haberler", [])}) < 3:
            continue
        hedef = next((f'{x["id"]}.html' for x in o["haberler"] if x["id"] in sayfa_var), None)
        if hedef:
            digerler.append((o, hedef))
        if len(digerler) >= 12:
            break
    tut, yeni = set(), 0
    for h in haberler:
        k = kmap.get(h.get("kaynak"))
        if not k or not h.get("url", "").startswith(("http://", "https://")) or not (h.get("baslik_tr") or h.get("baslik_orj")):
            continue
        if (h.get("tarih") or "") < sinir or h.get("atla"):
            continue
        ad = f"{h['id']}.html"
        tut.add(ad)
        olay = olay_of.get(h["id"])
        yer = (olay or {}).get("yer") if isinstance((olay or {}).get("yer"), dict) else None
        foto = _foto_sec(kok, yer.get("ad"), int(h["id"][-4:], 16) if re.fullmatch(r"[0-9a-f]{4}", h["id"][-4:]) else 0) if yer else None
        metin = sayfa(h, k, M, site, surum, etiketler.get(h["id"]), olay, kmap, sayfa_var, foto, digerler)
        yol = os.path.join(d, ad)
        try:
            if open(yol, encoding="utf-8").read() == metin:
                continue
        except OSError:
            pass
        with open(yol, "w", encoding="utf-8") as f:
            f.write(metin)
        yeni += 1
    # Akıştan düşen haberlerin sayfaları SAKLA_GUN boyunca kalır, sonra silinir
    silinen, eski = 0, (simdi - dt.timedelta(days=SAKLA_GUN)).timestamp()
    for ad in os.listdir(d):
        yol = os.path.join(d, ad)
        if ad.endswith(".html") and ad not in tut and os.path.getmtime(yol) < eski:
            os.remove(yol)
            silinen += 1
    log(f"Haber sayfaları: {len(tut)} sayfa ({yeni} yeni ya da güncel, {silinen} eski silindi)")
    return yeni
