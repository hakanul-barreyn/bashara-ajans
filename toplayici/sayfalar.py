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


def _dogrulama_blogu(dg, dil):
    if not dg or dg.get("tur") not in DOG:
        return ""
    tr, en, zemin, renk = DOG[dg["tur"]]
    kanit = "".join(f' <a href="{_e(u)}" target="_blank" rel="noopener nofollow" style="color:inherit;font-weight:700">'
                    f'{"Kanıt" if dil == "tr" else "Evidence"} ↗</a>' for u in dg.get("kanit", []) if str(u).startswith(("http://", "https://")))
    return (f'<p style="margin:0;padding:10px 12px;border-radius:10px;background:{zemin};color:{renk};font-size:.9rem">'
            f'<b>{_e(tr if dil == "tr" else en)}</b> {_e(dg.get("aciklama", ""))}{kanit}</p>')


def sayfa(h, k, M, site, surum, dg=None):
    bas_tr = h.get("baslik_tr") or h.get("baslik_orj") or ""
    oz_tr = h.get("ozet_tr") or ""
    bas_en, oz_en = h.get("baslik_en") or bas_tr, h.get("ozet_en") or oz_tr
    yayin = k.get("ad", "")
    adres = f"{site}h/{h['id']}.html"
    aciklama = _kisa(oz_tr or h.get("baslik_orj"), 200)
    resim = f"{site}site/paylas.png"
    etiket = "Analiz" if h.get("nitelik") == "analiz" else "Haber"
    v = f"?v={surum}"

    def blok(dil, bas, oz, git, kim, tum, ozgun):
        p = [f'<div data-dil="{dil}">',
             f'<p class="hs-ust"><span class="hs-tur">{_e(etiket if dil == "tr" else ("Analysis" if etiket == "Analiz" else "News"))}</span>'
             f'<b>{_e(yayin)}</b> · {_e(k.get("sehir", ""))} · <time datetime="{_e(h.get("tarih"))}">{_e(_tarih(h.get("tarih"), dil))}</time></p>',
             _dogrulama_blogu(dg, dil),
             f'<h1>{_e(bas)}</h1>']
        if oz:
            p.append(f'<p class="hs-ozet">{_e(oz)}</p>')
        if h.get("baslik_orj") and h.get("baslik_orj") != bas:
            p.append(f'<p class="hs-orj" dir="auto" lang="{_e(h.get("dil", ""))}"><small>{_e(ozgun)}</small> {_e(h["baslik_orj"])}</p>')
        p.append('<p class="hs-eylem">'
                 f'<a class="eylem ana" href="{_e(h["url"])}" target="_blank" rel="noopener">{_e(git)} ↗</a>'
                 f'<a class="eylem" href="../#o-{_e(h["id"])}">{_e(kim)}</a>'
                 f'<a class="eylem" href="../">{_e(tum)}</a></p>')
        p.append("</div>")
        return "".join(p)

    govde = (blok("tr", bas_tr, oz_tr, "Haberin aslı", "Kim nasıl yazdı", "Tüm haberler", "Özgün başlık:")
             + blok("en", bas_en, oz_en, "Original article", "Who told it how", "All stories", "Original headline:"))
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#f4f3ef">
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
<script src="../site/dil.js{v}"></script>
<script src="../site/marka.js{v}"></script>
<style>
.hs{{max-width:760px;margin:0 auto;padding:28px max(var(--kanat),env(safe-area-inset-right,0px)) 72px max(var(--kanat),env(safe-area-inset-left,0px))}}
.hs-kart{{background:var(--kart);color:var(--k-ink);box-shadow:var(--golge);border-radius:18px;padding:24px;display:flex;flex-direction:column;gap:14px}}
.hs-kart h1{{margin:4px 0 0;font-size:clamp(1.45rem,4vw,2rem);line-height:1.25;letter-spacing:-.01em;text-wrap:balance}}
.hs-ust{{margin:0;font-size:.86rem;color:var(--k-ink2);display:flex;flex-wrap:wrap;gap:6px;align-items:center}}
.hs-tur{{font-family:var(--mono);font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;background:var(--yuzey);border:1px solid var(--k-cizgi);border-radius:999px;padding:2px 8px}}
.hs-ozet{{margin:0;font-size:1.05rem;line-height:1.6;color:var(--k-ink2);max-width:66ch}}
.hs-orj{{margin:0;font-size:.9rem;color:var(--k-soluk)}}
.hs-eylem{{margin:6px 0 0;display:flex;flex-wrap:wrap;gap:8px}}
.hs-not{{margin:18px 4px 0;font-size:.82rem;color:var(--soluk)}}
</style>
</head>
<body>
<header class="ust">
  <div class="ust-ic">
    <a class="marka" href="../"><img class="logo" src="../site/logo.svg" alt="" width="32" height="32"><span class="marka-ad" data-marka="ad">{_e(M["ad"])}</span></a>
    <p class="slogan" data-marka="slogan">{_e(M.get("slogan", ""))}</p>
    <nav class="menu"><a href="../">Akış</a><a href="../arsiv.html">Arşiv</a><a href="../almanak.html">Almanak</a><a href="../kaynaklar.html">Kaynaklar</a></nav>
  </div>
</header>
<main class="hs">
<article class="hs-kart">{govde}</article>
<p class="hs-not"><span data-dil="tr">Bu özet, yayının kendi haberinden yapay zekâyla yazıldı; haberin aslı yayının sitesinde.</span><span data-dil="en">This summary was written with AI from the outlet's own report; the original is on the outlet's site.</span></p>
</main>
</body>
</html>
"""


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
    tut, yeni = set(), 0
    for h in haberler:
        k = kmap.get(h.get("kaynak"))
        if not k or not h.get("url", "").startswith(("http://", "https://")) or not (h.get("baslik_tr") or h.get("baslik_orj")):
            continue
        if (h.get("tarih") or "") < sinir or h.get("atla"):
            continue
        ad = f"{h['id']}.html"
        tut.add(ad)
        metin = sayfa(h, k, M, site, surum, etiketler.get(h["id"]))
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
