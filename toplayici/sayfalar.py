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
import ekler
import marka

SAKLA_GUN = 7
AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
CSP = ("default-src 'self'; script-src 'self' https://gc.zgo.at https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
       "font-src https://fonts.gstatic.com; img-src 'self' https: data: blob:; connect-src 'self' https://zbshaber.goatcounter.com https://tiles.openfreemap.org; worker-src blob:; "
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
           "not": "Özetler ve karşılaştırma, yayınların kendi haberlerinden yapay zekâyla çıkarıldı; haberlerin aslı yayınların sitesinde. Paylaşılan her haber görüşümüzü yansıtmaz; haberler fikir vermesi ve basın dilinin karşılaştırılması amacıyla paylaşılır.",
           "akis": "Akış", "haber": "Haber", "analiz": "Analiz", "oku": "Haberi oku ↗", "cerceve": "Çerçeve"},
    "en": {"git": "Original article", "paylas": "Share", "kim": "Who told it how", "fark": "How the framing differs", "diger": "More stories",
           "yayin": "outlets compared", "tek": "Single outlet", "bu": "this story", "ozgun": "Original headline", "farkyok": "No difference.",
           "not": "Summaries and the comparison were extracted with AI from the outlets' own reports; the originals are on their sites. Sharing a story does not mean we share its views; stories are shared to inform and to compare how the press tells them.",
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
        rk = {d: v for d, v in grupla("rakam").items() if re.search(r"[^\W\d_]", d)}   # birimsiz çıplak sayı gösterilmez
        if len(rk) == 1:
            satir.append(("Rakam", f"Hepsi aynı rakamı verdi: {next(iter(rk))}."))
        elif rk:
            satir.append(("Rakam", " · ".join(f"{d}: {', '.join(v[:3])}{f' +{len(v) - 3}' if len(v) > 3 else ''}" for d, v in rk.items())))
        kl = dict(sorted(grupla("kelime").items(), key=lambda x: -len(x[1]))[:4])
        if len(kl) > 1:
            satir.append(("Kelime", " · ".join(f"“{d}”: {', '.join(v[:3])}{f' +{len(v) - 3}' if len(v) > 3 else ''}" for d, v in kl.items())))
        if not satir:
            return ""
        icerik = ((f'<p>{_e(olay["ortak"])}</p>' if olay.get("ortak") else "")
                  + '<dl class="hs-fark">' + "".join(f"<dt>{_e(a)}</dt><dd>{_e(b)}</dd>" for a, b in satir) + "</dl>")
    return f'<section class="hs-bolum" id="fark-{dil}"><h2>{t["fark"]}</h2>{icerik}</section>'


_TAKSIM = None


def _taksim():
    """site/taksim.json: grup, siyasi çizgi ve Filistin tutumu için kısa açıklamalar (ⓘ)."""
    global _TAKSIM
    if _TAKSIM is None:
        try:
            _TAKSIM = json.load(open(os.path.join(_KOK or os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "site", "taksim.json"), encoding="utf-8"))
        except Exception:
            _TAKSIM = {}
    return _TAKSIM


def _bilgi(metin, dil):
    if not metin:
        return ""
    return (f'<details class="hs-bilgi"><summary aria-label="{"Bilgi" if dil == "tr" else "Info"}">i</summary>'
            f'<span>{_e(metin)}</span></details>')


def _taksim_cip(k, dil):
    """Yayının grubu, siyasi çizgisi ve Filistin tutumu: her biri ⓘ ile kısa açıklamalı."""
    tx, out = _taksim(), ""
    g = k.get("grup")
    if g:
        out += f'<span class="hs-cip">{_e(g)}{_bilgi(((tx.get("grup") or {}).get(g) or {}).get(dil), dil)}</span>'
    sy = k.get("siyasi")
    if sy and sy != "belirsiz":
        out += f'<span class="hs-cip">{_e(sy)}{_bilgi(((tx.get("siyasi") or {}).get(sy) or {}).get(dil), dil)}</span>'
    tu = k.get("tutum")
    if tu:
        ad = ((tx.get("tutum_ad") or {}).get(tu) or {}).get(dil) or tu
        acik = (((tx.get("tutum") or {}).get(tu) or {}).get(dil) or "") + " " + \
            (((tx.get("tutum") or {}).get("_" + (k.get("tutum_dayanak") or "editoryal")) or {}).get(dil) or "")
        if dil == "tr" and k.get("tutum_not"):
            acik += " " + k["tutum_not"]
        out += f'<span class="hs-cip tutum-{_e(tu)}">{_e(ad)}{_bilgi(acik.strip(), dil)}</span>'
    elif k.get("tutum_dayanak") == "bekliyor":
        out += f'<span class="hs-cip">{"tutum ölçülüyor" if dil == "tr" else "stance pending"}{_bilgi(((tx.get("tutum") or {}).get("_bekliyor") or {}).get(dil), dil)}</span>'
    return out


def _alan(u):
    """Bağlantının alan adı (www. olmadan): okur nereye gideceğini görsün."""
    m = re.match(r"https?://(?:www\.)?([^/:?#]+)", u or "")
    return m.group(1) if m else ""


def _kim_nasil(olay, h, kmap, sayfa_var, dil):
    """Haberin ait olduğu olayı öteki yayınlar nasıl anlattı: kamp kamp, bakış, anlatım çipleri ve kısa betimleme."""
    if not olay or len(olay.get("haberler", [])) < 2:
        return ""
    t = T[dil]
    sira = {k: i for i, k in enumerate(almanak.KAMP_SIRA)}
    satir = []
    # Yayın başına tek satır: yayının ilk (ya da bu sayfanın) haberi; öteki haberlerinin sayısı yanında
    gorulen, ek = {}, {}
    hepsi = [x for x in olay["haberler"] if x["id"] == h["id"] or not ekler.ILGISIZ_RE.search(x.get("y") or "")]
    sirali = sorted(hepsi, key=lambda x: (x["id"] != h["id"], sira.get(almanak.kamp(kmap.get(x.get("k"))), 99), x.get("t") or ""))
    secilen = []
    anah = lambda x: (kmap.get(x.get("k")) or {}).get("kurum") or x.get("k")   # AA, TRT, BBC: masaları tek kurum
    for x in sirali:
        if anah(x) in gorulen:
            ek[anah(x)] = ek.get(anah(x), 0) + 1
            continue
        gorulen[anah(x)] = True
        secilen.append(x)
    secilen.sort(key=lambda x: (sira.get(almanak.kamp(kmap.get(x.get("k"))), 99), x.get("t") or ""))
    for x in secilen:
        k = kmap.get(x.get("k"))
        if not k:
            continue
        b = BAKIS.get(x.get("b"))
        # Yayın adı ve başlık doğrudan yayının kendi haberine gider (yeni sekmede)
        hedef = x.get("u") or ""
        if not hedef.startswith(("http://", "https://")):
            hedef = ""
        dis = f' href="{_e(hedef)}" target="_blank" rel="noopener"'
        gad = k.get("kurum") or k["ad"]
        ad = f"<b>{_e(gad)}</b>"
        if k.get("kurum") and k["ad"] != k["kurum"]:
            ad += f' <small>{_e(k["ad"])}</small>'
        bu = f' <span class="hs-cip">{t["bu"]}</span>' if x["id"] == h["id"] else ""
        if ek.get(anah(x)):
            bu += f' <small>+{ek[anah(x)]} {"haber daha" if dil == "tr" else "more"}</small>'
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
        meta = (_e(b[0] if dil == "tr" else b[1]) + " · " if b else "") + (_e(k.get("ulke") or "") if k.get("ulke") and k.get("ulke") != "Belirsiz" else "")
        tc = _taksim_cip(k, dil)
        satir.append(f'<li><div class="hs-su"><i style="background:{b[2] if b else "#c9cfcb"}"></i>{ad}{bu}</div>'
                     f'<small>{meta}</small>'
                     + (f'<div class="hs-su hs-taksim">{tc}</div>' if tc else "")
                     + ((f'<a class="hs-kim-bas"{dis}>{_e(x.get("bt") or x.get("bo"))}<small class="hs-alan">{_e(_alan(hedef))} ↗</small></a>' if hedef else f'<span>{_e(x.get("bt") or x.get("bo"))}</span>')
                        if (x.get("bt") or x.get("bo")) else "")
                     + (f'<span style="color:var(--k-ink2)">{_e(x.get("ye") if dil == "en" and x.get("ye") else x.get("y"))}</span>' if x.get("y") else "")
                     + (f'<div class="hs-su">{cip}</div>' if cip else "") + "</li>")
    if len(satir) < 2:
        return ""
    return (f'<section class="hs-bolum" id="kim-{dil}"><h2>{t["kim"]} · {len(satir)}</h2>'
            + f'<ul class="hs-kim">{"".join(satir[:10])}</ul>'
            + (f'<details class="hs-kim-daha"><summary>{"Tümünü göster" if dil == "tr" else "Show all"} ({len(satir)})</summary>'
               f'<ul class="hs-kim">{"".join(satir[10:])}</ul></details>' if len(satir) > 10 else "")
            + "</section>")


def _adlar(liste, n=5):
    return ", ".join(liste[:n]) + (f" +{len(liste) - n}" if len(liste) > n else "")


def _olgular(olay, kmap, dil):
    """İsrail ve Batı basını olayı nasıl gölgeledi: yapay zekânın gölgeleme maddeleri ve bölge basınının verip İsrail/Batı
    yayınlarının vermediği olgular. Bölge yayınlarının kendi aralarındaki farklar burada gösterilmez."""
    hs = (olay or {}).get("haberler") or []
    if len(hs) < 2:
        return ""
    dis = lambda x: almanak.kamp(kmap.get(x.get("k"))) in almanak.DIS
    yayin_of = {x["id"]: kmap[x["k"]]["ad"] for x in hs if kmap.get(x.get("k"))}
    dis_ad = list(dict.fromkeys(yayin_of[x["id"]] for x in hs if dis(x) and x["id"] in yayin_of))
    bolge_ad = list(dict.fromkeys(yayin_of[x["id"]] for x in hs if not dis(x) and x["id"] in yayin_of))
    bas = "İsrail ve Batı basını neyi gölgeledi" if dil == "tr" else "What Israeli and Western outlets obscured"
    if not dis_ad:
        if len(bolge_ad) < 3:
            return ""
        metin = (f"Bu olayı bölge basınından {len(bolge_ad)} yayın yazdı; İsrail ve Batı basınında hiç haber yok." if dil == "tr"
                 else f"{len(bolge_ad)} regional outlets reported this; there is no coverage in Israeli or Western outlets.")
        return f'<section class="hs-bolum"><h2>{bas}</h2><p class="hs-sessiz">{_e(metin)}</p></section>'
    madde = []
    TUR = {"atlanan olgu": "Atlanan olgu", "edilgen dil": "Edilgen dil", "tek taraflı kaynak": "Tek taraflı kaynak", "bağlamsız": "Bağlamsız",
           "örtmeceli kelime": "Örtmeceli kelime", "önemsizleştirme": "Önemsizleştirme"}
    for g in (olay.get("golgeleme") or []):
        adlar = list(dict.fromkeys(yayin_of[i] for i in g["ids"] if i in yayin_of))
        if adlar:
            madde.append(f'<li><span class="hs-g-tur">{_e(TUR.get(g.get("tur"), g.get("tur") or ""))}</span>'
                         f'<b>{_e(", ".join(adlar))}</b> {_e(g["aciklama"])}</li>')
    # Bölge basınının verdiği ama İsrail/Batı yayınlarından en az birinin vermediği olgular
    for x in (olay.get("olgular") or []):
        veren = set(x["ids"])
        bolge_veren = list(dict.fromkeys(yayin_of[i] for i in veren if i in yayin_of and not dis(next(y for y in hs if y["id"] == i))))
        dis_vermeyen = [a for a in dis_ad if a not in {yayin_of[i] for i in veren if i in yayin_of}]
        if bolge_veren and dis_vermeyen:
            if dil == "tr":
                t = f"Bölge basınından {len(bolge_veren)} yayın verdi; {', '.join(dis_vermeyen)} vermedi."
            else:
                t = f"{len(bolge_veren)} regional outlets reported it; {', '.join(dis_vermeyen)} did not."
            madde.append(f'<li><span class="hs-g-tur">{"Verilmeyen olgu" if dil == "tr" else "Left out"}</span>'
                         f'<b>{_e(x["olgu"])}</b> {_e(t)}</li>')
    if not madde:
        metin = (f"İsrail ve Batı basınından {', '.join(dis_ad)} olayı bölge basınıyla aynı temel olgularla verdi; belirgin bir gölgeleme yok."
                 if dil == "tr" else f"{', '.join(dis_ad)} reported the same core facts as the regional press; no clear obscuring.")
        return f'<section class="hs-bolum"><h2>{bas}</h2><p>{_e(metin)}</p></section>'
    return f'<section class="hs-bolum"><h2>{bas}</h2><ul class="hs-golge">{"".join(madde[:6])}</ul></section>'


def _zaman(olay, kmap, dil):
    """Kim ne zaman yazdı: her yayının ilk haberi, olayın ilk haberinden bu yana geçen süreye göre bir çizgide."""
    hs = [x for x in (olay or {}).get("haberler") or [] if x.get("t") and kmap.get(x.get("k"))]
    ilk = {}
    for x in sorted(hs, key=lambda x: x["t"]):
        ilk.setdefault(x["k"], x["t"])
    if len(ilk) < 3:
        return ""
    t0 = dt.datetime.fromisoformat(min(ilk.values()))
    t1 = dt.datetime.fromisoformat(max(ilk.values()))
    aralik = max(1.0, (t1 - t0).total_seconds())
    renk = lambda k: ("#2b8a5e" if almanak.kamp(k) in almanak.BOLGE_ICI else "#4a72c4" if almanak.kamp(k) in almanak.DIS else "#9aa39e")
    satir = []
    for kid, t in sorted(ilk.items(), key=lambda x: x[1]):
        k = kmap[kid]
        sa = (dt.datetime.fromisoformat(t) - t0).total_seconds()
        yuzde = 100 * sa / aralik
        etiket = ("ilk" if dil == "tr" else "first") if sa < 60 else (f"+{sa / 3600:.1f} sa" if dil == "tr" else f"+{sa / 3600:.1f} h").replace(".", "," if dil == "tr" else ".")
        satir.append(f'<li><span class="hs-z-ad">{_e(k["ad"])}</span><span class="hs-z-iz"><i style="left:{yuzde:.1f}%;background:{renk(k)}"></i></span>'
                     f'<span class="hs-z-sa">{_e(etiket)}</span></li>')
    bas = "Kim ne zaman yazdı" if dil == "tr" else "Who reported when"
    acik = ("Yeşil: bölge basını · mavi: İsrail ve Batı basını" if dil == "tr" else "Green: regional press · blue: Israeli and Western press")
    return f'<section class="hs-bolum"><h2>{bas}</h2><p><small>{acik}</small></p><ul class="hs-zaman">{"".join(satir)}</ul></section>'


_ONEMSIZ = set("ve ile için bir bu da de olarak sonra yeni üzerine karşı daha göre gibi olan oldu etti açıkladı dedi".split())


def _kelimeler(b):
    return {w for w in re.findall(r"\w{5,}", (b or "").lower()) if w not in _ONEMSIZ}


def _onceki(olay, tum, sayfa_hedef, dil):
    """Önceki gelişmeler: aynı yerde ya da aynı konuda daha önceki olaylar (olay arşivinden)."""
    if not olay:
        return ""
    yer = ((olay.get("yer") or {}).get("ad") or "").lower() if isinstance(olay.get("yer"), dict) else ""
    kw = _kelimeler(olay.get("baslik"))
    ilk = olay.get("ilk") or ""
    aday = []
    for o in tum.values():
        if o.get("id") == olay.get("id") or (o.get("ilk") or "") >= ilk:
            continue
        oy = ((o.get("yer") or {}).get("ad") or "").lower() if isinstance(o.get("yer"), dict) else ""
        ortak = len(kw & _kelimeler(o.get("baslik")))
        if ortak >= 2 or (yer and oy == yer and ortak >= 1):
            aday.append((ortak, o))
    aday = sorted(aday, key=lambda x: x[1].get("ilk") or "", reverse=True)[:6]
    if not aday:
        return ""
    satir = []
    for _, o in aday:
        hedef = sayfa_hedef.get(o["id"])
        b = _e(o.get("baslik_en") if dil == "en" and o.get("baslik_en") else o.get("baslik"))
        satir.append(f'<li><time>{_e(_tarih(o.get("ilk"), dil))}</time>' + (f'<a href="{_e(hedef)}">{b}</a>' if hedef else f"<span>{b}</span>") + "</li>")
    bas = "Önceki gelişmeler" if dil == "tr" else "Earlier developments"
    return f'<section class="hs-bolum"><h2>{bas}</h2><ul class="hs-onceki">{"".join(satir)}</ul></section>'


# ------------------------------------------------------------------ haber sayfası grafikleri
def _iki_kamp(olay, kmap):
    hs = [x for x in (olay or {}).get("haberler") or [] if kmap.get(x.get("k"))]
    b = [x for x in hs if almanak.kamp(kmap[x["k"]]) in almanak.BOLGE_ICI]
    d = [x for x in hs if almanak.kamp(kmap[x["k"]]) in almanak.DIS]
    return b, d


def _grup_ad(dil):
    return ("Bölge basını", "İsrail ve Batı basını") if dil == "tr" else ("Regional press", "Israeli & Western press")


RENK_B, RENK_D = "#1f7a52", "#3e63b8"


def _dil_terazisi(olay, kmap, dil):
    b, d = _iki_kamp(olay, kmap)
    say = lambda hs: {}
    def kelime(hs):
        c = {}
        for x in hs:
            w = ((x.get("an") or {}).get("kelime") or "").strip()
            if w:
                c[w] = c.get(w, 0) + 1
        return sorted(c.items(), key=lambda x: -x[1])[:5]
    kb, kd = kelime(b), kelime(d)
    if not kb or not kd:
        return ""
    en = max([n for _, n in kb + kd])
    sutun = lambda ad, lst, renk, sag: (f'<div class="gr-tz-sutun{" sag" if sag else ""}"><h3>{_e(ad)}</h3>'
        + "".join(f'<div class="gr-tz-satir"><span dir="auto">“{_e(w)}”</span><i style="width:{100 * n / en:.0f}%;background:{renk}"></i><b>{n}</b></div>' for w, n in lst) + "</div>")
    ga, gd = _grup_ad(dil)
    bas = "Dil terazisi: aynı olay, farklı kelimeler" if dil == "tr" else "Word scale: same event, different words"
    return f'<section class="hs-bolum"><h2>{bas}</h2><div class="gr-tz">{sutun(ga, kb, RENK_B, False)}{sutun(gd, kd, RENK_D, True)}</div></section>'


def _yigin(sayi, renkler, toplam):
    return "".join(f'<i style="width:{100 * n / toplam:.1f}%;background:{renkler[j % len(renkler)]}" title="{_e(a)} {n}"></i>'
                   for j, (a, n) in enumerate(sayi))


def _soz(olay, kmap, dil):
    """Kime söz verildi: iki kampın dayandığı kaynakların payı."""
    b, d = _iki_kamp(olay, kmap)
    def pay(hs):
        c = {}
        for x in hs:
            v = ((x.get("an") or {}).get("dayanak") or "").strip()
            if v:
                c[v] = c.get(v, 0) + 1
        lst = sorted(c.items(), key=lambda x: -x[1])
        if len(lst) > 4:
            lst = lst[:4] + [("Diğer" if dil == "tr" else "Other", sum(n for _, n in lst[4:]))]
        return lst
    pb, pd = pay(b), pay(d)
    if not pb or not pd:
        return ""
    renk = ["#c9302c", "#e3a23b", "#5f8f7a", "#7a6fb0", "#9aa39e"]
    ga, gd = _grup_ad(dil)
    def satir(ad, lst):
        top = sum(n for _, n in lst)
        return (f'<div class="gr-yig"><span class="gr-yig-ad">{_e(ad)}</span><div class="gr-yig-cubuk">{_yigin(lst, renk, top)}</div>'
                f'<div class="gr-yig-acik">' + "".join(f'<span><i style="background:{renk[j % 5]}"></i>{_e(a)} %{round(100 * n / top)}</span>'
                                                      for j, (a, n) in enumerate(lst)) + "</div></div>")
    bas = "Kime söz verildi" if dil == "tr" else "Whose account was carried"
    return f'<section class="hs-bolum"><h2>{bas}</h2>{satir(ga, pb)}{satir(gd, pd)}</section>'


def _fail_grafik(olay, kmap, dil):
    b, d = _iki_kamp(olay, kmap)
    def c(hs):
        a = sum(1 for x in hs if (x.get("an") or {}).get("fail") == "acik")
        e = sum(1 for x in hs if (x.get("an") or {}).get("fail") == "edilgen")
        return a, e
    (ab, eb), (ad_, ed) = c(b), c(d)
    if not (eb or ed) or not ((ab + eb) and (ad_ + ed)):
        return ""
    ga, gd = _grup_ad(dil)
    acik, edil = ("Faili açıkça yazdı", "Edilgen dil") if dil == "tr" else ("Named the perpetrator", "Passive voice")
    def satir(ad, a, e):
        t = a + e
        return (f'<div class="gr-yig"><span class="gr-yig-ad">{_e(ad)}</span><div class="gr-yig-cubuk">'
                f'<i style="width:{100 * a / t:.1f}%;background:#1f7a52"></i><i style="width:{100 * e / t:.1f}%;background:#c9302c"></i></div>'
                f'<div class="gr-yig-acik"><span><i style="background:#1f7a52"></i>{acik} %{round(100 * a / t)}</span>'
                f'<span><i style="background:#c9302c"></i>{edil} %{round(100 * e / t)}</span></div></div>')
    bas = "Faili yazan, gizleyen" if dil == "tr" else "Who named the perpetrator"
    return f'<section class="hs-bolum"><h2>{bas}</h2>{satir(ga, ab, eb)}{satir(gd, ad_, ed)}</section>'


_SAYI = re.compile(r"(\d[\d.,]*)\s*(\w+)")


def _rakam_grafik(olay, kmap, dil):
    """Yayınların verdiği rakamlar bir sayı doğrusunda (en çok rastlanan birim için)."""
    hs = [x for x in (olay or {}).get("haberler") or [] if kmap.get(x.get("k")) and (x.get("an") or {}).get("rakam")]
    birim = {}
    for x in hs:
        m = _SAYI.search(x["an"]["rakam"])
        if m:
            try:
                v = float(m.group(1).replace(".", "").replace(",", "."))
            except ValueError:
                continue
            birim.setdefault(m.group(2).lower(), {})
            birim[m.group(2).lower()].setdefault(x["k"], v)
    if not birim:
        return ""
    ad, deg = max(birim.items(), key=lambda x: len(x[1]))
    if len(deg) < 2 or len(set(deg.values())) < 2:
        return ""
    en = max(deg.values()) or 1
    nokta = "".join(f'<li><span class="hs-z-ad">{_e(kmap[k]["ad"])}</span><span class="hs-z-iz"><i style="left:{100 * v / en:.1f}%;'
                    f'background:{RENK_B if almanak.kamp(kmap[k]) in almanak.BOLGE_ICI else RENK_D if almanak.kamp(kmap[k]) in almanak.DIS else "#9aa39e"}"></i></span>'
                    f'<span class="hs-z-sa">{int(v) if v == int(v) else v} {_e(ad)}</span></li>'
                    for k, v in sorted(deg.items(), key=lambda x: -x[1]))
    bas = "Verilen rakamlar" if dil == "tr" else "Figures reported"
    return f'<section class="hs-bolum"><h2>{bas}</h2><ul class="hs-zaman">{nokta}</ul></section>'


def _yayilis(olay, kmap, dil):
    """İlk 24 saatte saat saat haber sayısı, iki kamp üst üste."""
    b, d = _iki_kamp(olay, kmap)
    tum_t = [x["t"] for x in b + d if x.get("t")]
    if len(tum_t) < 5:
        return ""
    t0 = dt.datetime.fromisoformat(min(tum_t))
    kova = lambda hs: [sum(1 for x in hs if x.get("t") and int((dt.datetime.fromisoformat(x["t"]) - t0).total_seconds() // 3600) == s) for s in range(24)]
    kb, kd = kova(b), kova(d)
    son = max([i for i in range(24) if kb[i] or kd[i]] or [0]) + 1
    son = max(son, 6)
    en = max(kb[:son] + kd[:son]) or 1
    W, Hh = 600, 120
    w = W / son
    cub = "".join(f'<rect x="{i * w + 1:.1f}" y="{Hh - Hh * kb[i] / en:.1f}" width="{w / 2 - 1:.1f}" height="{Hh * kb[i] / en:.1f}" fill="{RENK_B}"/>'
                  f'<rect x="{i * w + w / 2:.1f}" y="{Hh - Hh * kd[i] / en:.1f}" width="{w / 2 - 1:.1f}" height="{Hh * kd[i] / en:.1f}" fill="{RENK_D}"/>'
                  for i in range(son))
    etk = "".join(f'<text x="{i * w + w / 2:.1f}" y="{Hh + 14}" text-anchor="middle" font-size="10" fill="#6f7772">{i}</text>' for i in range(0, son, max(1, son // 8)))
    ga, gd = _grup_ad(dil)
    bas = "Haberin yayılışı (ilk saatler)" if dil == "tr" else "How the story spread (first hours)"
    alt = "saat" if dil == "tr" else "hours"
    return (f'<section class="hs-bolum"><h2>{bas}</h2><svg class="gr-svg" viewBox="0 0 {W} {Hh + 20}" role="img">{cub}{etk}</svg>'
            f'<div class="gr-yig-acik"><span><i style="background:{RENK_B}"></i>{ga}</span><span><i style="background:{RENK_D}"></i>{gd}</span>'
            f'<span>{"x ekseni: ilk haberden bu yana " + alt if dil == "tr" else "x axis: " + alt + " since the first report"}</span></div></section>')


def _seyir(olay, tum, dil):
    """Konunun seyri: son 30 günde aynı konudaki olay sayısı (gün gün)."""
    if not olay:
        return ""
    kw = _kelimeler(olay.get("baslik"))
    yer = ((olay.get("yer") or {}).get("ad") or "").lower() if isinstance(olay.get("yer"), dict) else ""
    gun = {}
    for o in tum.values():
        oy = ((o.get("yer") or {}).get("ad") or "").lower() if isinstance(o.get("yer"), dict) else ""
        ortak = len(kw & _kelimeler(o.get("baslik")))
        if o.get("ilk") and (ortak >= 2 or (yer and oy == yer and ortak >= 1)):
            g = o["ilk"][:10]
            gun[g] = gun.get(g, 0) + len(o.get("haberler", []))
    if len(gun) < 3:
        return ""
    son = dt.date.fromisoformat(max(gun))
    gunler = [(son - dt.timedelta(days=i)).isoformat() for i in range(29, -1, -1)]
    deg = [gun.get(g, 0) for g in gunler]
    en = max(deg) or 1
    W, Hh = 600, 80
    nok = " ".join(f"{i * W / 29:.1f},{Hh - Hh * v / en:.1f}" for i, v in enumerate(deg))
    bas = "Konunun seyri (30 gün)" if dil == "tr" else "Story over 30 days"
    acik = "Aynı konudaki haber sayısı, gün gün" if dil == "tr" else "Reports on the same topic, per day"
    return (f'<section class="hs-bolum"><h2>{bas}</h2><p><small>{acik}</small></p><svg class="gr-svg" viewBox="0 0 {W} {Hh + 16}" role="img">'
            f'<polyline points="0,{Hh} {nok} {W},{Hh}" fill="rgba(201,48,44,.12)" stroke="none"/>'
            f'<polyline points="{nok}" fill="none" stroke="#c9302c" stroke-width="2"/>'
            f'<text x="0" y="{Hh + 14}" font-size="10" fill="#6f7772">{gunler[0][5:]}</text>'
            f'<text x="{W}" y="{Hh + 14}" font-size="10" fill="#6f7772" text-anchor="end">{gunler[-1][5:]}</text></svg></section>')


def harita_yaz(kok, olay):
    """Olayın yeri için küçük karanlık harita (data/h/harita/<olay>.svg); adres ya da boş."""
    yer = olay.get("yer") if isinstance(olay.get("yer"), dict) else None
    if not yer or yer.get("lat") is None:
        return ""
    ad = f"harita/{olay['id']}.svg"
    yol = os.path.join(kok, "data", "h", ad)
    if not os.path.isfile(yol):
        try:
            import ig_harita
            ic = ig_harita.harita(kok, float(yer["lat"]), float(yer["lon"]), yer.get("ad", ""), "medya", (0, 0, 600, 340), yaricap=5.0, kimlik="m")
        except Exception:
            ic = ""
        if not ic:
            return ""
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        with open(yol, "w", encoding="utf-8") as f:
            f.write('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">'
                    '<defs><filter id="hafif" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b"/>'
                    '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
                    f'<rect width="600" height="340" fill="#0a0d0c"/>{ic}</svg>')
    return ad


def paylasim_gorseli(kok, olay, kmap):
    """Olay için 1200x630 paylaşım görseli (data/h/og/<olay>.png): başlık, yayın sayısı, bakış dağılımı. Adres ya da boş."""
    import shutil
    import subprocess
    ad = f"og/{olay['id']}.png"
    yol = os.path.join(kok, "data", "h", ad)
    if os.path.isfile(yol):
        return ad
    if not shutil.which("rsvg-convert"):
        return ""
    try:
        import ig_kart
    except Exception:
        return ""
    hs = olay.get("haberler") or []
    n = len({x.get("k") for x in hs})
    sayi = {}
    for x in hs:
        if x.get("b") in BAKIS:
            sayi[x["b"]] = sayi.get(x["b"], 0) + 1
    boy, sat = ig_kart.sigdir(olay.get("baslik") or "", [68, 60, 54, 48], 900, 1060, 3)
    F = ig_kart.F
    cub, x0, top = "", 70.0, sum(sayi.values()) or 1
    for v in ("filistin", "aktarim", "israil"):
        w = 1060 * sayi.get(v, 0) / top
        if w:
            cub += f'<rect x="{x0:.1f}" y="520" width="{w:.1f}" height="14" fill="{BAKIS[v][2]}"/>'
            x0 += w
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">'
           f'<defs><radialGradient id="g" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 0) scale(700)">'
           f'<stop stop-color="#19e68c" stop-opacity=".25"/><stop offset="1" stop-color="#19e68c" stop-opacity="0"/></radialGradient>'
           f'<radialGradient id="r" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(1200 630) scale(700)">'
           f'<stop stop-color="#ff3b55" stop-opacity=".25"/><stop offset="1" stop-color="#ff3b55" stop-opacity="0"/></radialGradient></defs>'
           f'<rect width="1200" height="630" fill="#0b0d0c"/><rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#r)"/>'
           f'<text x="70" y="100" font-family="{F}" font-weight="900" font-size="26" letter-spacing="3" fill="#ffc247">KİM NASIL YAZDI · {n} YAYIN</text>'
           + "".join(f'<text x="70" y="{190 + i * boy * 1.12:.0f}" font-family="{F}" font-weight="900" font-size="{boy}" fill="#f6f3ec">{_e(t)}</text>'
                     for i, t in enumerate(sat))
           + (f'<clipPath id="c"><rect x="70" y="520" width="1060" height="14" rx="7"/></clipPath><g clip-path="url(#c)">{cub}</g>' if cub else "")
           + f'<text x="70" y="580" font-family="{F}" font-weight="900" font-size="30" fill="#f6f3ec">Alboroto</text>'
           f'<text x="250" y="580" font-family="{F}" font-weight="500" font-size="24" fill="#8d9792">Haberin haberi</text></svg>')
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    gecici = yol[:-4] + ".svg"
    try:
        open(gecici, "w", encoding="utf-8").write(svg)
        subprocess.run(["rsvg-convert", "-w", "1200", "-h", "630", gecici, "-o", yol], check=True, timeout=60)
        return ad
    except Exception:
        return ""
    finally:
        try:
            os.remove(gecici)
        except OSError:
            pass


def _grafikler(bolumler, dil):
    """Grafik bölümleri tek bir açılır kutuda, kapalı başlar: sayfa kısa kalır, isteyen açar."""
    bolumler = [b for b in bolumler if b]
    if not bolumler:
        return ""
    bas = f"Grafikler · {len(bolumler)}" if dil == "tr" else f"Charts · {len(bolumler)}"
    alt = "Dil, kaynak, fail, rakam ve zaman karşılaştırmaları" if dil == "tr" else "Words, sources, perpetrators, figures and timing compared"
    return (f'<details class="hs-grafikler"><summary><span class="hs-gr-bas">{bas}</span><span class="hs-gr-alt">{alt}</span></summary>'
            + "".join(bolumler) + "</details>")


def _konum(olay):
    y = (olay or {}).get("yer")
    try:
        la, lo = float(y["lat"]), float(y["lon"])
        return (la, lo) if (la or lo) and -90 <= la <= 90 and -180 <= lo <= 180 else None
    except Exception:
        return None


_KOK = None
_YAZI = {}


def _yazi(olay):
    """Olayın kendi haber metni (data/yazi/<olay no>.json, haber_yaz.py), yoksa None."""
    oid = (olay or {}).get("id")
    if not oid or not _KOK:
        return None
    if oid not in _YAZI:
        try:
            y = json.load(open(os.path.join(_KOK, "data", "yazi", oid + ".json"), encoding="utf-8"))
            _YAZI[oid] = y if y.get("baslik") and y.get("paragraflar") else None
        except Exception:
            _YAZI[oid] = None
    return _YAZI[oid]


def _cumleler(t):
    return [c for c in re.split(r"(?<=[.!?])\s+", (t or "").strip()) if c]


def _makale(h, k, olay, kmap, dil, foto, dg, harita, sayfa_var, tum, sayfa_hedef, ilgili, site):
    """Bir dilde makale gövdesi: üst bilgi, başlık, özet, künye, paylaş, kapak, metin, bölümler, etiketler."""
    t = T[dil]
    hs = (olay or {}).get("haberler", []) if len((olay or {}).get("haberler", [])) >= 2 else []
    bas = ((olay or {}).get("baslik_en" if dil == "en" else "baslik") or (olay or {}).get("baslik")) if hs else None
    bas = bas or (h.get("baslik_en") if dil == "en" else None) or h.get("baslik_tr") or h.get("baslik_orj") or ""
    oz = (h.get("ozet_en") if dil == "en" else None) or h.get("ozet_tr") or ""
    yer = (olay or {}).get("yer", {}).get("ad") if isinstance((olay or {}).get("yer"), dict) else None
    n = len({x.get("k") for x in hs})
    kategori = (t["analiz"] if h.get("nitelik") == "analiz" else t["haber"]) + (f" · {yer}" if yer else "")
    # Künye satırı
    kunye = (f'<span>{_e("Alboroto masası" if dil == "tr" else "Alboroto desk")}</span>'
             + (f'<span>{n} {t["yayin"]}</span>' if n else f'<span>{_e(k.get("ad"))}</span>')
             + f'<time datetime="{_e(h.get("tarih"))}">{_e(_tarih(h.get("tarih"), dil))}</time>')
    # Gecikme ve ilk yazan
    gec = ""
    if hs:
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
    # Bakış dağılımı
    sayi = {}
    for x in hs:
        if x.get("b") in BAKIS:
            sayi[x["b"]] = sayi.get(x["b"], 0) + 1
    top = sum(sayi.values()) or 1
    denge = ""
    if sayi:
        denge = ('<div class="mk-denge"><div class="mk-denge-cubuk">'
                 + "".join(f'<i style="width:{100 * sayi.get(v, 0) / top:.1f}%;background:{BAKIS[v][2]}"></i>' for v in ("filistin", "aktarim", "israil") if sayi.get(v))
                 + '</div><div class="mk-denge-acik">'
                 + "".join(f'<span><i style="background:{BAKIS[v][2]}"></i>{_e(BAKIS[v][0] if dil == "tr" else BAKIS[v][1])} {sayi[v]}</span>' for v in ("filistin", "aktarim", "israil") if sayi.get(v))
                 + "</div></div>")
    # Kapak: onaylı fotoğraf, yoksa harita
    if foto:
        kapak = (f'<figure class="mk-kapak"><img src="../data/foto/{_e(foto[0])}.jpg" alt="" loading="eager">'
                 f'<figcaption>{_e(yer or "")}{" · " if yer else ""}{_e(foto[1])}</figcaption></figure>')
    elif harita or _konum(olay):
        # Harita: sayfa-haber.js görününce kendi bölge altlığımızla (site/bolge-harita.json) çizer; betik yoksa eski küçük harita
        ky = _konum(olay)
        alt_y = (f'<noscript><img src="{_e(harita)}" alt="" width="600" height="340"></noscript>' if harita else "")
        ekyer = json.dumps([{"ad": y["ad"], "lat": y["lat"], "lon": y["lon"]} for y in (olay or {}).get("yerler") or []
                            if isinstance(y, dict) and y.get("ad")][:3], ensure_ascii=False)
        # Haritanın anlattığı: son 30 günde aynı çevrede yazılan başka olaylar (gri noktalar, sayfaları varsa bağlantılı)
        yakin = []
        if ky:
            for o2 in sorted((tum or {}).values(), key=lambda o: o.get("son") or "", reverse=True):
                y2 = _konum(o2)
                if not y2 or o2.get("id") == (olay or {}).get("id") or abs(y2[0] - ky[0]) > 0.45 or abs(y2[1] - ky[1]) > 0.45:
                    continue
                b2 = (o2.get("baslik_en") if dil == "en" else None) or o2.get("baslik") or ""
                yakin.append([round(y2[0], 4), round(y2[1], 4), _kisa(b2, 90), (o2.get("ilk") or "")[:10], (sayfa_hedef or {}).get(o2["id"], "")])
                if len(yakin) >= 30:
                    break
        yakin_js = json.dumps(yakin, ensure_ascii=False)
        ic = (f'<div class="mk-osm" data-lat="{ky[0]:.4f}" data-lon="{ky[1]:.4f}" data-ad="{_e(yer or "")}" data-yerler="{_e(ekyer)}" data-yakin="{_e(yakin_js)}" role="img" '
              f'aria-label="{_e(("Harita: " if dil == "tr" else "Map: ") + (yer or ""))}">{alt_y}</div>') if ky else f'<img src="{_e(harita)}" alt="" width="600" height="340">'
        kapak = (f'<figure class="mk-kapak mk-harita">{ic}'
                 f'<figcaption>{_e(("Olayın yeri: " if dil == "tr" else "Location: ") + (yer or ""))}'
                 + (_e((f" · Gri noktalar: son 30 günde bu çevrede yazılan {len(yakin)} olay daha" if dil == "tr"
                        else f" · Grey dots: {len(yakin)} other events reported nearby in the last 30 days")) if ky and yakin else "")
                 + '</figcaption></figure>')
    else:
        kapak = ""
    # Karşı manşetler (alıntı kutusu)
    benim_b = next((x.get("b") for x in hs if x["id"] == h["id"]), None)
    karsi = next((x for x in hs if x["id"] != h["id"] and x.get("b") and x.get("b") != benim_b and kmap.get(x.get("k"))), None)
    alinti = ""
    if karsi:
        b1 = (h.get("baslik_en") if dil == "en" else None) or h.get("baslik_tr") or h.get("baslik_orj")
        alinti = ('<aside class="mk-iki">'
                  f'<blockquote><cite>{_e(k.get("ad"))} · {_e(almanak.kamp(k))}</cite><p>“{_e(_kisa(b1, 170))}”</p></blockquote>'
                  f'<blockquote><cite>{_e(kmap[karsi["k"]]["ad"])} · {_e(almanak.kamp(kmap[karsi["k"]]))}</cite>'
                  f'<p>“{_e(_kisa(karsi.get("bt") or karsi.get("bo"), 170))}”</p></blockquote></aside>')
    # Önce haber: kendi metnimiz varsa o; yoksa bu haberin özeti (ilk cümlesi spot olur).
    # Çerçeve notu (kaynakların olayı nasıl anlattığı) haberin altında, "Kaynaklar nasıl anlattı" bölümünde.
    not_ = ((olay or {}).get("not_en") if dil == "en" and (olay or {}).get("not_en") else (olay or {}).get("not")) if hs else ""
    yz = _yazi(olay) if dil == "tr" else None
    govde, spot = "", ""
    if yz:
        bas = yz["baslik"]
        spot = yz.get("spot") or ""

        def atif(liste):
            ls, gor = [], set()
            for x in liste or []:
                if kmap.get(x.get("k")) and str(x.get("u") or "").startswith("http") and x.get("k") not in gor:
                    gor.add(x.get("k"))
                    ls.append(f'<a href="{_e(x.get("u"))}" target="_blank" rel="noopener">{_e(kmap[x["k"]].get("ad"))} ↗</a>')
            return f'<p class="mk-kaynak">Kaynak: {" · ".join(ls)}</p>' if ls else ""
        for i, p_ in enumerate(yz["paragraflar"]):
            sinif = ' class="mk-ilk"' if i == 0 else ""
            govde += f'<p{sinif}>{_e(p_.get("metin"))}</p>' + atif(p_.get("kaynaklar"))
        bg_ = yz.get("baglam") or {}
        if bg_.get("metin"):
            govde += f'<h2 class="mk-ara">Bağlam</h2><p>{_e(bg_["metin"])}</p>' + atif(bg_.get("kaynaklar"))
        govde += (f'<p class="mk-kaynak">Bu metni Alboroto, {yz.get("yayin_sayisi") or n} yayının haberlerinden yapay zekâ yardımıyla derledi; '
                  'her bilgi kaynağıyla verilir, kaynaklarda olmayan bilgi eklenmez.</p>')
    else:
        cs = _cumleler(oz)
        spot = cs[0] if len(cs) > 1 else ""
        govde_metin = " ".join(cs[1:]) if len(cs) > 1 else oz
        if govde_metin:
            govde += f'<p class="mk-ilk">{_e(govde_metin)}</p>'
        govde += (f'<p class="mk-kaynak">{_e("Bu haberin kaynağı" if dil == "tr" else "Source of this story")}: '
                  + (f'<a href="{_e(h["web"]["url"])}" target="_blank" rel="noopener">{_e(k.get("ad"))} ↗</a> · '
                     f'<a href="{_e(h["url"])}" target="_blank" rel="noopener">Telegram ↗</a></p>'
                     if (h.get("web") or {}).get("url", "").startswith("http") else
                     f'<a href="{_e(h["url"])}" target="_blank" rel="noopener">{_e(k.get("ad"))} ↗</a></p>'))
    anlatim = (f'<section class="hs-bolum"><h2>{"Kaynaklar nasıl anlattı" if dil == "tr" else "How the outlets framed it"}</h2><p>{_e(not_)}</p></section>'
               if not_ else "")
    paylas = (f'<div class="mk-paylas"><button type="button" data-paylas>{t["paylas"]}</button>'
              f'<a data-ag="whatsapp" href="#" rel="noopener">WhatsApp</a><a data-ag="telegram" href="#" rel="noopener">Telegram</a>'
              f'<a data-ag="x" href="#" rel="noopener">X</a></div>')
    etiket = "".join(f'<span>{_e(e)}</span>' for e in dict.fromkeys(
        ([yer] if yer else []) + [almanak.kamp(kmap[x["k"]]) for x in hs if kmap.get(x.get("k"))][:12]))
    return (f'<div data-dil="{dil}" class="mk-dil">'
            f'<p class="mk-ust">{_e(kategori)}</p>'
            f'<h1 class="mk-baslik">{_e(bas)}</h1>'
            + (f'<p class="mk-ozet">{_e(_kisa(spot, 320))}</p>' if spot else "")
            + f'<div class="mk-kunye">{kunye}</div>'
            + (f'<p class="mk-gec">⏱ {_e(gec.strip())}</p>' if gec else "")
            + _dogrulama_blogu(dg, dil)
            + paylas + kapak + denge
            + f'<div class="mk-metin">{govde}{alinti}</div>'
            + _onceki(olay, tum or {}, sayfa_hedef or {}, dil)
            + anlatim + _olgular(olay, kmap, dil) + _fark(olay or {}, kmap, dil) + _kim_nasil(olay, h, kmap, sayfa_var, dil)
            + _grafikler([_dil_terazisi(olay, kmap, dil), _soz(olay, kmap, dil), _fail_grafik(olay, kmap, dil), _rakam_grafik(olay, kmap, dil),
                          _zaman(olay, kmap, dil), _yayilis(olay, kmap, dil), _seyir(olay, tum or {}, dil)], dil)
            + (f'<div class="mk-etiket">{etiket}</div>' if etiket else "")
            + f'<p class="mk-not">{T[dil]["not"]}</p>'
            + "</div>")


def _yan(digerler, dil, haric):
    """Yan sütun: en çok yayının yazdığı son olaylar."""
    liste = sorted([(o, h_) for o, h_ in digerler if o.get("id") != haric], key=lambda x: -len({y.get("k") for y in x[0].get("haberler", [])}))[:6]
    if not liste:
        return ""
    satir = "".join(f'<li><a href="{_e(h_)}"><span class="mk-no">{i}</span><b>{_e(o.get("baslik_en") if dil == "en" and o.get("baslik_en") else o.get("baslik"))}</b>'
                    f'<small>{len({y.get("k") for y in o.get("haberler", [])})} {"yayın" if dil == "tr" else "outlets"}</small></a></li>'
                    for i, (o, h_) in enumerate(liste, 1))
    return f'<div data-dil="{dil}"><h2 class="mk-yan-bas">{"En çok yazılanlar" if dil == "tr" else "Most covered"}</h2><ol class="mk-yan">{satir}</ol></div>'


def _alt(digerler, dil, haric):
    kart = []
    for o, hedef in digerler:
        if o.get("id") == haric:
            continue
        n = len({x.get("k") for x in o.get("haberler", [])})
        yer = o["yer"].get("ad") if isinstance(o.get("yer"), dict) else ""
        kart.append(f'<a class="mk-kart" href="{_e(hedef)}"><small>{_e(yer or ("Haber" if dil == "tr" else "News"))}</small>'
                    f'<b>{_e(o.get("baslik_en") if dil == "en" and o.get("baslik_en") else o.get("baslik"))}</b>'
                    f'<span>{n} {"yayın" if dil == "tr" else "outlets"} · {_e(_tarih(o.get("son") or o.get("ilk"), dil))}</span></a>')
        if len(kart) >= 6:
            break
    if not kart:
        return ""
    return f'<section data-dil="{dil}" class="mk-daha"><h2>{"Okumaya devam" if dil == "tr" else "Keep reading"}</h2><div class="mk-kartlar">{"".join(kart)}</div></section>'


def sayfa(h, k, M, site, surum, dg=None, olay=None, kmap=None, sayfa_var=(), foto=None, digerler=(), tum=None, sayfa_hedef=None,
          harita="", og=""):
    kmap = kmap or {}
    bas_tr = h.get("baslik_tr") or h.get("baslik_orj") or ""
    yayin = k.get("ad", "")
    adres = f"{site}h/{h['id']}.html"
    # Aynı olayın her haberi ayrı sayfa; arama motoruna olayın tek sayfası gösterilir (yinelenen içerik sayılmasın)
    kanon = f"{site}h/{(sayfa_hedef or {}).get((olay or {}).get('id'), h['id'] + '.html')}"
    hs = (olay or {}).get("haberler", [])
    n = len({x.get("k") for x in hs}) if len(hs) >= 2 else 0
    baslik_ol = (olay or {}).get("baslik") if n else None
    aciklama = _kisa((h.get("ozet_tr") or h.get("baslik_orj") or ""), 200)
    yz_ = _yazi(olay)
    if yz_:
        baslik_ol, aciklama = yz_["baslik"], _kisa(yz_.get("spot") or aciklama, 200)
    resim = f"{site}h/{og}" if og else f"{site}site/paylas-2026.png"
    v = f"?v={surum}"
    haric = (olay or {}).get("id")
    # Sıradaki haber: "okumaya devam" listesinde bu olaydan sonraki ilk olay (sonsuz akış için)
    sira = [h_ for o, h_ in digerler if o.get("id") != haric]
    sonraki = sira[0] if sira else ""
    # İlgili olay (metin içi "Ayrıca okuyun"): önceki gelişmelerden en yenisi
    ilgili = []
    if olay:
        kw = _kelimeler(olay.get("baslik"))
        for o in sorted((tum or {}).values(), key=lambda o: o.get("ilk") or "", reverse=True):
            if o.get("id") != haric and len(kw & _kelimeler(o.get("baslik"))) >= 2 and (sayfa_hedef or {}).get(o["id"]):
                ilgili.append((o, sayfa_hedef[o["id"]]))
                break
    makale = "".join(_makale(h, k, olay, kmap, d, foto, dg, harita, sayfa_var, tum, sayfa_hedef, ilgili, site) for d in ("tr", "en"))
    yan = "".join(_yan(digerler, d, haric) for d in ("tr", "en"))
    alt = "".join(_alt(digerler, d, haric) for d in ("tr", "en"))
    baslik_sekme = _kisa(baslik_ol or bas_tr, 90)
    return f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0c0e0d">
<title>{_e(baslik_sekme)} | {_e(M["ad"])}</title>
<meta name="description" content="{_e(aciklama)}">
<link rel="canonical" href="{_e(kanon)}">
<script type="application/ld+json">{_ld(h, baslik_ol or bas_tr, aciklama, kanon, resim, M, site)}</script>
<meta property="og:type" content="article">
<meta property="og:site_name" content="{_e(M["ad"])}">
<meta property="og:title" content="{_e(_kisa(baslik_ol or bas_tr, 110))}{"" if n else " · " + _e(yayin)}">
<meta property="og:description" content="{_e(aciklama)}">
<meta property="og:url" content="{_e(adres)}">
<meta property="og:image" content="{_e(resim)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="tr_TR">
<meta property="article:published_time" content="{_e(h.get("tarih"))}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{_e(_kisa(baslik_ol or bas_tr, 110))}">
<meta name="twitter:description" content="{_e(aciklama)}">
<meta name="twitter:image" content="{_e(resim)}">
<link rel="icon" href="../site/logo.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Reem+Kufi+Fun:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700;8..60,800&display=swap">
<link rel="stylesheet" href="../site/stil.css{v}">
<link rel="stylesheet" href="../site/haber.css{v}">
<script src="../site/dil.js{v}"></script>
<script src="../site/marka.js{v}"></script>
<script src="../site/sayfa-haber.js{v}" defer></script>
</head>
<body class="mk-govde">
<header class="mk-bas">
  <div class="mk-bas-ic">
    <a class="mk-logo" href="../"><img src="../site/logo.svg" alt="" width="30" height="30"><b data-marka="ad">{_e(M["ad"])}</b><span data-marka="slogan">{_e(M.get("slogan", ""))}</span></a>
    <nav class="mk-menu"><a href="../">Akış</a><a href="../arsiv.html">Arşiv</a><a href="../raporlar.html">Raporlar</a><a href="../almanak.html">Almanak</a><a href="../kaynaklar.html">Kaynaklar</a><a href="../hakkimizda.html">Hakkımızda</a></nav>
  </div>
</header>
<div class="mk-sayfa">
  <article class="mk-makale" data-sonraki="{_e(sonraki)}" data-baslik="{_e(baslik_sekme)} | {_e(M["ad"])}">{makale}</article>
  <aside class="mk-yan-sutun">{yan}</aside>
</div>
<div class="mk-akis" id="akis"></div>
<div class="mk-alt">{alt}</div>
</body>
</html>
"""


def _ld(h, baslik, aciklama, adres, resim, M, site):
    """NewsArticle yapılandırılmış verisi (arama motorları için); </script> kaçışıyla."""
    v = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": _kisa(baslik, 110), "description": aciklama,
         "datePublished": h.get("tarih"), "dateModified": h.get("tarih"), "inLanguage": "tr", "mainEntityOfPage": adres, "image": [resim],
         "author": {"@type": "Organization", "name": f'{M["ad"]} masası', "url": site},
         "publisher": {"@type": "Organization", "name": M["ad"], "logo": {"@type": "ImageObject", "url": f"{site}site/logo.svg"}}}
    return json.dumps(v, ensure_ascii=False).replace("</", "<\\/")


def site_haritasi(d, haberler, sayfa_hedef, olay_of, site, simdi):
    """h/ klasörüne iki harita: sitemap-haber.xml (olay başına tek sayfa ve kendi metnimiz olanlar, son SAKLA_GUN gün)
    ve sitemap-news.xml (Google News: son 48 saat). Tek kaynaklı sayfalar haritaya girmez (ince içerik)."""
    from xml.sax.saxutils import escape as x
    secili = {}
    for h in haberler:
        o = olay_of.get(h["id"])
        if not o or len(o.get("haberler", [])) < 2:
            continue
        ad = sayfa_hedef.get(o["id"])
        if not ad or not os.path.isfile(os.path.join(d, ad)):
            continue
        t = max(o.get("son") or "", h.get("tarih") or "")
        if ad not in secili or t > secili[ad][0]:
            secili[ad] = (t, o.get("baslik") or h.get("baslik_tr") or "", o.get("ilk") or h.get("tarih") or "")
    sirali = sorted(secili.items(), key=lambda x: x[1][0], reverse=True)
    satir = [f"<url><loc>{x(site)}h/{x(ad)}</loc><lastmod>{x(t[:19])}+00:00</lastmod></url>" for ad, (t, _, _) in sirali[:45000]]
    with open(os.path.join(d, "sitemap-haber.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(satir) + "\n</urlset>\n")
    sinir = (simdi - dt.timedelta(hours=48)).isoformat()
    haber = [f"<url><loc>{x(site)}h/{x(ad)}</loc><news:news><news:publication><news:name>Alboroto</news:name><news:language>tr</news:language>"
             f"</news:publication><news:publication_date>{x(ilk[:19])}+00:00</news:publication_date><news:title>{x(b[:200])}</news:title></news:news></url>"
             for ad, (t, b, ilk) in sirali if ilk >= sinir][:1000]
    with open(os.path.join(d, "sitemap-news.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
                'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' + "\n".join(haber) + "\n</urlset>\n")
    return len(satir), len(haber)


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
    global _KOK
    _KOK = kok
    _YAZI.clear()
    M = marka.oku(kok)
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    site = __import__("marka").site()
    kmap = {k["id"]: k for k in kaynaklar}
    try:
        etiketler = json.load(open(os.path.join(kok, "data", "dogrulama.json"), encoding="utf-8")).get("etiketler", {})
    except Exception:
        etiketler = {}
    d = os.path.join(kok, "data", "h")
    os.makedirs(d, exist_ok=True)
    sinir = (simdi - dt.timedelta(days=SAKLA_GUN)).isoformat()
    # Sürüm, dosyaların içeriğinden: CSS/JS değişince tarayıcı eskisini önbellekten kullanmaz
    import hashlib
    hs = hashlib.md5()
    for f in ("stil.css", "haber.css", "dil.js", "marka.js", "sayfa-haber.js"):
        try:
            hs.update(open(os.path.join(kok, "site", f), "rb").read())
        except OSError:
            pass
    surum = hs.hexdigest()[:10]
    # Haber -> olay (son SAKLA_GUN+1 günün olay arşivinden; yeni günün kaydı eskisinin üstüne yazar)
    olay_of, tum = {}, {}
    for n in range(30, -1, -1):
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
    sayfa_hedef = {}
    for o in tum.values():
        h0 = next((f'{x["id"]}.html' for x in o.get("haberler", []) if x["id"] in sayfa_var), None)
        if h0:
            sayfa_hedef[o["id"]] = h0
    # Ana sayfadaki Gündem slaytı için son 20 karşılaştırma (canlı olaylar bittikten sonra da görünsün)
    try:
        hidx = {h["id"]: h for h in haberler}
        gundem = []
        for o in sorted(tum.values(), key=lambda o: o.get("son") or "", reverse=True):
            ks = []
            for x in o.get("haberler", []):
                if x.get("k") not in ks:
                    ks.append(x.get("k"))
            if len(ks) < 2:
                continue
            gorsel = next((hidx[x["id"]].get("gorsel") for x in o["haberler"] if x["id"] in hidx and hidx[x["id"]].get("gorsel")
                           and not hidx[x["id"]].get("gnews") and not (kmap.get(hidx[x["id"]].get("kaynak")) or {}).get("hassas")), None)
            gk = next((hidx[x["id"]].get("kaynak") for x in o["haberler"] if x["id"] in hidx and hidx[x["id"]].get("gorsel") == gorsel), None) if gorsel else None
            # aday görseller (gorsel_denetim.py: yazı grafiği olanı atlar, kafaları kesmemek için odak noktası bulur)
            adaylar = []
            for x in o["haberler"]:
                hx = hidx.get(x["id"])
                if hx and hx.get("gorsel") and not hx.get("gnews") and not (kmap.get(hx.get("kaynak")) or {}).get("hassas") \
                        and hx["gorsel"] not in [a[0] for a in adaylar]:
                    adaylar.append([hx["gorsel"], hx.get("kaynak")])
                if len(adaylar) >= 4:
                    break
            gundem.append({"id": o["id"], "baslik": o.get("baslik"), "not": o.get("not"), "baslik_en": o.get("baslik_en"), "not_en": o.get("not_en"),
                           "son": o.get("son"), "sayfa": ("h/" + sayfa_hedef[o["id"]]) if o["id"] in sayfa_hedef else "arsiv.html#gun-" + (o.get("ilk") or "")[:10], "kaynaklar": ks,
                           "haberler": [x["id"] for x in o["haberler"]], "gorsel": gorsel, "gorsel_kaynak": gk, "adaylar": adaylar,
                           "konum": list(_konum(o)) if _konum(o) else None, "yer_ad": ((o.get("yer") or {}).get("ad") if isinstance(o.get("yer"), dict) else None)})
            if len(gundem) >= 20:
                break
        with open(os.path.join(kok, "data", "gundem.json"), "w", encoding="utf-8") as f:
            json.dump({"guncellendi": simdi.isoformat(), "olaylar": gundem}, f, ensure_ascii=False, separators=(",", ":"))
    except Exception as e:
        log(f"Gündem listesi yazılamadı: {e}")
    harita_of, og_of = {}, {}
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
        hr = og = ""
        if olay and len(olay.get("haberler", [])) >= 2:
            if olay["id"] not in harita_of:
                harita_of[olay["id"]] = harita_yaz(kok, olay)
                og_of[olay["id"]] = paylasim_gorseli(kok, olay, kmap)
            hr, og = harita_of[olay["id"]], og_of[olay["id"]]
        metin = sayfa(h, k, M, site, surum, etiketler.get(h["id"]), olay, kmap, sayfa_var, foto, digerler, tum, sayfa_hedef, hr, og)
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
    for alt in ("harita", "og"):
        da = os.path.join(d, alt)
        for ad in (os.listdir(da) if os.path.isdir(da) else []):
            if os.path.getmtime(os.path.join(da, ad)) < eski:
                os.remove(os.path.join(da, ad))
    for ad in os.listdir(d):
        yol = os.path.join(d, ad)
        if ad.endswith(".html") and ad not in tut and os.path.isfile(yol) and os.path.getmtime(yol) < eski:
            os.remove(yol)
            silinen += 1
    try:
        n1, n2 = site_haritasi(d, haberler, sayfa_hedef, olay_of, site, simdi)
        log(f"Site haritası: {n1} haber sayfası, son 48 saatte {n2}")
    except Exception as e:
        log(f"Site haritası yazılamadı: {e}")
    log(f"Haber sayfaları: {len(tut)} sayfa ({yeni} yeni ya da güncel, {silinen} eski silindi)")
    return yeni
