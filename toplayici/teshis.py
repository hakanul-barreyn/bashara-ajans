"""Tek seferlik teşhis: okunamayan kaynakların ana sayfasında ve aday adreslerinde ne döndüğünü yazar.
Kendi tarayıcı kimliğimizle istek atar, robots.txt'ye uyar; hiçbir engeli aşmaya çalışmaz."""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import topla
ids = {int(x) for x in (os.environ.get("TESHIS_ID") or "").split(",") if x.strip()}
ks = json.load(open(os.path.join(topla.KOK, "kaynaklar.json")))
ks = ks if isinstance(ks, list) else ks["kaynaklar"]
def ozet(url):
    try:
        if not topla.izinli(url):
            return "robots.txt YASAK"
    except Exception as e:
        return f"robots hata {e}"
    try:
        r = topla.getir(url, zaman=20)
        kod = getattr(r, "status", None) or getattr(r, "kod", None)
        govde = getattr(r, "govde", None) or getattr(r, "icerik", None) or (r[1] if isinstance(r, tuple) else b"")
        if isinstance(r, tuple): kod = r[0]
        g = govde.decode("utf-8", "replace") if isinstance(govde, (bytes, bytearray)) else str(govde)
        tur = "RSS/Atom" if re.search(r"<(rss|feed|rdf:RDF)\b", g[:3000]) else ("sitemap" if "<urlset" in g[:3000] or "<sitemapindex" in g[:3000] else ("cloudflare" if "cf-chl" in g or "Just a moment" in g else "html/diğer"))
        return f"{kod} {tur} {len(g)}B"
    except Exception as e:
        return f"HATA {type(e).__name__}: {str(e)[:120]}"
for k in ks:
    if k["id"] not in ids:
        continue
    print(f"\n### {k['id']} {k['ad']}  {k['url']}")
    try:
        r = topla.getir(k["url"], zaman=20)
        g = r[1] if isinstance(r, tuple) else (getattr(r, "govde", b"") or b"")
        g = g.decode("utf-8", "replace") if isinstance(g, (bytes, bytearray)) else str(g)
        print("  ana sayfa:", ozet(k["url"]), "| başlık:", (re.search(r"<title[^>]*>([^<]{0,90})", g) or [None, "-"])[1].strip())
        for m in re.finditer(r'<link[^>]+(?:application/(?:rss|atom)\+xml)[^>]*>', g, re.I):
            print("  <link> besleme:", (re.search(r'href="([^"]+)"', m.group(0)) or [None, "?"])[1])
        for m in set(re.findall(r'href="([^"]*(?:rss|feed)[^"]*)"', g, re.I)):
            print("  bağlantı:", m[:150])
    except Exception as e:
        print("  ana sayfa HATA", e)
    for u in k.get("besleme") or []:
        print("  aday", u, "→", ozet(u))
    try:
        from urllib.parse import urljoin
        rb = topla.getir(urljoin(k["url"], "/robots.txt"), zaman=15)
        t = rb[1] if isinstance(rb, tuple) else b""
        t = t.decode("utf-8", "replace") if isinstance(t, (bytes, bytearray)) else str(t)
        for s in re.findall(r"(?im)^sitemap:\s*(\S+)", t)[:6]:
            print("  robots sitemap:", s, "→", ozet(s))
    except Exception as e:
        print("  robots HATA", e)

# İkinci kip: verilen site haritası / besleme adreslerinin yapısını dök
for u in [x.strip() for x in (os.environ.get("TESHIS_URL") or "").split(",") if x.strip()]:
    print(f"\n### DÖKÜM {u}")
    if not topla.izinli(u):
        print("  robots YASAK"); continue
    kod, m, son = topla.getir(u, zaman=25)
    print("  kod", kod, len(m), "B")
    alt = topla.harita_dizini_alt(m)
    if alt:
        print("  alt haritalar:", len(alt))
        for a in alt[:25]: print("   -", a)
        continue
    if re.search(r"<(rss|feed)\b", m[:3000]):
        for o in topla.besleme_coz(m)[:8]: print("   *", o["tarih"], o["url"][:110], "|", o["baslik"][:70])
        print("  öğe sayısı", len(topla.besleme_coz(m))); continue
    og = topla.site_haritasi_coz(m)
    og.sort(key=lambda o: o["tarih"] or topla.SIMDI.replace(year=2000), reverse=True)
    print("  url sayısı", len(og), "| tarihli", sum(1 for o in og if o["tarih"]))
    for o in og[:10]: print("   *", o["tarih"], o["url"][:140])
    if not any(o["tarih"] for o in og):
        for o in og[-8:] + og[len(og)//2:len(og)//2 + 6]: print("   ~", o["url"][:140])

# Üçüncü kip: genel_harita tanımlı kaynakları gerçekten okumayı dene
for k in ks:
    if k["id"] in ids and k.get("genel_harita"):
        d = {}
        og = topla.cek_genel_harita(k["genel_harita"], d)
        print(f"\n### GENEL HARİTA {k['id']} {k['ad']}: aday {len(d.get('gh_aday') or [])}, okunan {len(og)}")
        for o in og[:6]: print("   *", o["tarih"], o["baslik"][:80], "|", o["url"][:90], "|", (o["giris"] or "")[:60])
        if not og:
            for b in (d.get("gh_bellek") or [])[:4]: print("   bellek:", str(b)[:200])
            for a in (d.get("gh_aday") or [])[:8]: print("   aday:", a)

# Dördüncü kip: Google Haberler zorunlu kaynaklar
for k in ks:
    if k["id"] in ids and k.get("gnews_zorla"):
        u = topla.gnews_adresi(k, 14)
        kod, m, _ = topla.getir(u)
        og = topla.gnews_coz(m) if kod == 200 else []
        print(f"\n### GNEWS {k['id']} {k['ad']}: kod {kod}, öğe {len(og)}")
        for o in og[:6]: print("   *", o["tarih"], o["baslik"][:90])
