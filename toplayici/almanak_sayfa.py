"""Almanak'ın önceden çizilmiş (statik) sayfaları: arama motorları ve Google Scholar içeriği JavaScript çalıştırmadan görsün.

Almanak tek bir kabuk sayfa (almanak.html); içeriği site/sayfa-almanak.js adresin sonundaki #'e göre çizer. Bu betik o
çizimi yerel sunucuda Playwright ile bir kez yapar ve her görünümü ayrı bir HTML dosyası olarak kaydeder:

    almanak/<tur>-<anahtar>.html   (ör. almanak/haftalik-2026-W47.html)   ve İngilizcesi en/almanak/...
    almanak/kapak.html, almanak/sessizlik.html, almanak/sonuc.html

Her sayfaya kendi <title>, açıklama, canonical, hreflang (TR ↔ EN), Open Graph ve JSON-LD eklenir; bölümler arası bağlantılar
statik adreslere çevrilir. Okurun tarayıcısında aynı betik çalışır ve sayfayı yeniden çizer (içerik aynıdır); betik yoksa
ya da veri gelmezse HTML'deki içerik kalır. Tasarım ve çizim kodu tek kaynaktadır (sayfa-almanak.js).

Yalnızca değişen bölümler yeniden çizilir (bülten "uretildi" zamanı); sayfa betiği ya da bu betik değişince hepsi.
Kullanım: python toplayici/almanak_sayfa.py <site kökü> <çıktı klasörü>
Çıktı klasöründe: tr/, en/, sitemap-almanak.xml, _durum.json"""
import hashlib, html, http.server, json, os, re, socketserver, sys, threading
from playwright.sync_api import sync_playwright

KOK, CIK = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
SITE = "https://alborotonews.com"
PORT = 0   # boş bir bağlantı noktası seçilir


def ozet(*yollar):
    h = hashlib.sha1()
    for y in yollar:
        try:
            h.update(open(y, "rb").read())
        except OSError:
            pass
    return h.hexdigest()[:16]


dizin = json.load(open(os.path.join(KOK, "data/bulten/dizin.json"), encoding="utf-8"))
kod_ozeti = ozet(os.path.join(KOK, "site/sayfa-almanak.js"), os.path.join(KOK, "almanak.html"), os.path.join(KOK, "site/stil.css"),
                 os.path.join(KOK, "site/kitap.css"), os.path.join(KOK, "site/dil.js"), os.path.abspath(__file__))
durum_yol = os.path.join(CIK, "_durum.json")
try:
    durum = json.load(open(durum_yol, encoding="utf-8"))
except (OSError, ValueError):
    durum = {}
if durum.get("kod") != kod_ozeti:
    durum = {"kod": kod_ozeti, "sayfa": {}}
eski = durum.setdefault("sayfa", {})

# görünüm listesi: (# adresi, dosya adı, değişim imi)
son_uretim = max((x.get("uretildi") or "" for x in dizin), default="")
GORUNUM = [("#kapak", "kapak", son_uretim), ("#sessizlik", "sessizlik", son_uretim), ("#sonuc", "sonuc", son_uretim)]
for x in dizin:
    GORUNUM.append((f"#{x['tur']}-{x['anahtar']}", f"{x['tur']}-{x['anahtar']}", x.get("uretildi") or ""))
ROTA = re.compile(r"^#(kapak|bu-kitap|icindekiler|sessizlik|sonuc|(?:haftalik|aylik|yillik)-[\w-]+)$")


def adres(dil, dosya):
    on = "/en" if dil == "en" else ""
    if dosya == "kapak":   # kapak, almanak.html'nin kendisi (yayında kapak.html o adrese kopyalanır)
        return f"{SITE}{on}/almanak.html"
    return f"{SITE}{on}/almanak/{dosya}.html"


def statik_adres(dil, h):
    """# yönlendirmesini statik adrese çevir; bu-kitap ve içindekiler kapakta birer bölüm."""
    ad = h[1:]
    if ad in ("bu-kitap", "icindekiler"):
        return adres(dil, "kapak").replace(SITE, "") + h
    return adres(dil, ad).replace(SITE, "")


# Sayfanın içinde çalışır: çizimi bitmiş belgeyi statik hâle getirir
HAZIRLA = r"""
([h, dil, kendi, es_tr, es_en, rotalar]) => {
  const rota = new RegExp(rotalar);
  const masa = document.getElementById("masa");
  // betiğin yeniden ekleyeceği öğeler ve geçici durumlar
  document.querySelectorAll(".dil-sec, .sk-ipucu:not(#ipucu)").forEach((e) => e.remove());
  // öbür dilin blokları (data-dil) bu sayfada hiç görünmez: HTML'den de çıkar
  document.querySelectorAll("[data-dil]").forEach((e) => { if (e.getAttribute("data-dil") !== dil) e.remove(); });
  document.querySelectorAll("[aria-busy]").forEach((e) => e.removeAttribute("aria-busy"));
  const kp = document.getElementById("kanitPanel"); if (kp) { kp.hidden = true; kp.innerHTML = ""; }
  const ip = document.getElementById("ipucu"); if (ip) { ip.hidden = true; ip.innerHTML = ""; }
  // bölümler arası bağlantılar: #... yerine statik adres (botlar bölümden bölüme gezebilsin)
  document.querySelectorAll("a[href^='#']").forEach((a) => {
    const x = a.getAttribute("href");
    if (!rota.test(x)) return;
    const ad = x.slice(1), on = dil === "en" ? "/en" : "";
    a.setAttribute("href", (ad === "kapak") ? on + "/almanak.html" : (ad === "bu-kitap" || ad === "icindekiler") ? on + "/almanak.html" + x : on + "/almanak/" + ad + ".html");
  });
  masa.dataset.onceden = h;
  document.documentElement.setAttribute("data-sabit-dil", dil);
  document.documentElement.lang = dil;
  // başlık ve açıklama: çizilen içerikten
  const bas = (masa.querySelector("h1, h2") || {}).textContent || "";
  let aciklama = "";
  for (const p of masa.querySelectorAll("p")) { const t = p.textContent.trim().replace(/\s+/g, " "); if (t.length > 80) { aciklama = t; break; } }
  if (aciklama.length > 158) aciklama = aciklama.slice(0, 155).replace(/\s+\S*$/, "") + "…";
  const kitap = dil === "en" ? "Alboroto Almanac" : "Alboroto Almanak";
  const baslik = (bas.trim() ? bas.trim().replace(/\s+/g, " ") + " · " : "") + kitap;
  const head = document.head;
  head.querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"], base, meta[name="alb-gorunum"]').forEach((e) => e.remove());
  const ekle = (tag, at) => { const e = document.createElement(tag); for (const k in at) e.setAttribute(k, at[k]); head.appendChild(e); return e; };
  // <base> her şeyden önce: göreli adresler (site/, data/) kökten çözülsün
  const base = document.createElement("base"); base.href = "/"; head.insertBefore(base, head.firstChild);
  // görünüm imi statik.js'ten önce okunabilsin diye başta
  const gm = document.createElement("meta"); gm.name = "alb-gorunum"; gm.content = h; base.after(gm);
  document.title = baslik;
  const t = head.querySelector("title"); if (t) t.removeAttribute("data-marka-sablon");
  let md = head.querySelector('meta[name="description"]'); if (!md) md = ekle("meta", { name: "description" });
  if (aciklama) md.setAttribute("content", aciklama);
  ekle("link", { rel: "canonical", href: kendi });
  ekle("link", { rel: "alternate", hreflang: "tr", href: es_tr });
  ekle("link", { rel: "alternate", hreflang: "en", href: es_en });
  ekle("link", { rel: "alternate", hreflang: "x-default", href: es_tr });
  ekle("meta", { property: "og:type", content: "article" });
  ekle("meta", { property: "og:site_name", content: "Alboroto News" });
  ekle("meta", { property: "og:title", content: baslik });
  ekle("meta", { property: "og:description", content: aciklama });
  ekle("meta", { property: "og:url", content: kendi });
  ekle("meta", { property: "og:locale", content: dil === "en" ? "en_GB" : "tr_TR" });
  ekle("meta", { name: "twitter:card", content: "summary" });
  const ld = ekle("script", { type: "application/ld+json" });
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org", "@type": "Chapter", "name": baslik, "headline": bas.trim() || kitap, "description": aciklama,
    "url": kendi, "inLanguage": dil, "isPartOf": { "@type": "Book", "name": kitap, "url": dil === "en" ? "https://alborotonews.com/en/almanak.html" : "https://alborotonews.com/almanak.html" },
    "publisher": { "@type": "NewsMediaOrganization", "name": "Alboroto News", "url": "https://alborotonews.com/" },
    "isAccessibleForFree": true
  });
  // statik.js betiklerden önce: görünümü adrese yazar, # bağlantılarını sayfada tutar
  const sj = document.createElement("script"); sj.src = "site/statik.js?v=1";
  const ilk = head.querySelector("script[src]"); head.insertBefore(sj, ilk || null);
  return "<!doctype html>\n" + document.documentElement.outerHTML;
}
"""

os.chdir(KOK)
class Sessiz(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), Sessiz)
srv.daemon_threads = True
srv.handle_error = lambda *a: None   # tarayıcının yarıda kestiği istekler (about:blank) gürültü yapmasın
PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
yazilan, atlanan, hatali = 0, 0, []
yeni = {}
with sync_playwright() as p:
    b = p.chromium.launch()
    for dil in ("tr", "en"):
        s = b.new_page(viewport={"width": 1280, "height": 1600})
        s.add_init_script(f"try{{localStorage.setItem('zbs-dil','{dil}')}}catch(e){{}}")
        s.route(re.compile(r"goatcounter|gc\.zgo\.at"), lambda r: r.abort())
        for h, dosya, imi in GORUNUM:
            anahtar = f"{dil}:{dosya}"
            yol = os.path.join(CIK, dil, "almanak", dosya + ".html")
            if eski.get(anahtar) == imi and os.path.exists(yol):
                yeni[anahtar] = imi; atlanan += 1
                continue
            try:
                # her görünüm temiz bir yüklemeyle: önceki görünümün DOM değişiklikleri karışmasın
                s.goto("about:blank")   # yalnızca # değişirse tarayıcı sayfayı yeniden yüklemez
                s.goto(f"http://127.0.0.1:{PORT}/almanak.html{h}", wait_until="networkidle")
                s.wait_for_function("document.querySelector('#masa') && document.querySelector('#masa').children.length && !document.querySelector('#masa > .bos2:only-child')", timeout=60000)
                s.wait_for_timeout(700)
                metin = s.evaluate(HAZIRLA, [h, dil, adres(dil, dosya), adres("tr", dosya), adres("en", dosya), ROTA.pattern])
            except Exception as e:
                hatali.append(f"{anahtar}: {str(e)[:120]}")
                continue
            os.makedirs(os.path.dirname(yol), exist_ok=True)
            open(yol, "w", encoding="utf-8").write(metin)
            yeni[anahtar] = imi; yazilan += 1
        s.close()
    b.close()
srv.shutdown()

# artık dizinde olmayan bölümlerin sayfaları silinir
for dil in ("tr", "en"):
    d = os.path.join(CIK, dil, "almanak")
    for ad in (os.listdir(d) if os.path.isdir(d) else []):
        if ad.endswith(".html") and f"{dil}:{ad[:-5]}" not in yeni:
            os.remove(os.path.join(d, ad))

# site haritası (iki dil, hreflang eşleriyle)
sat = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
son = {x_dosya: imi for _, x_dosya, imi in GORUNUM}
for _, dosya, imi in GORUNUM:
    for dil in ("tr", "en"):
        if f"{dil}:{dosya}" not in yeni:
            continue
        sat.append("<url><loc>" + html.escape(adres(dil, dosya)) + "</loc>" + (f"<lastmod>{imi[:10]}</lastmod>" if imi else "")
                   + "".join(f'<xhtml:link rel="alternate" hreflang="{d2}" href="{html.escape(adres(d2, dosya))}"/>' for d2 in ("tr", "en")) + "</url>")
sat.append("</urlset>")
open(os.path.join(CIK, "sitemap-almanak.xml"), "w", encoding="utf-8").write("\n".join(sat))
durum["sayfa"] = yeni
json.dump(durum, open(durum_yol, "w", encoding="utf-8"), ensure_ascii=False)
print(f"almanak sayfaları: {yazilan} yazıldı, {atlanan} değişmedi, {len(hatali)} hata")
for x in hatali[:20]:
    print("  hata:", x)
if hatali and not yazilan and not atlanan:
    sys.exit(1)
