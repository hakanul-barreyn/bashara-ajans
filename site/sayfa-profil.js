/* Hesap profili: profil.html?k=<yayın no>. Yayının kimliği, ölçümleri ve son 14 günün gönderileri. */
(function () {
  "use strict";
  const H = window.ZBSHesap, EN = window.DIL === "en", YR = EN ? "en-GB" : "tr-TR";
  const kok = document.getElementById("profil");
  const tt = (tr, en) => (EN ? en : tr);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const id = new URLSearchParams(location.search).get("k");
  const j = (u, v) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : v)).catch(() => v);
  function once(iso) {
    const d = (Date.now() - Date.parse(iso)) / 6e4;
    if (!isFinite(d)) return "";
    if (d < 60) return Math.max(1, Math.round(d)) + tt(" dk", "m");
    if (d < 1440) return Math.round(d / 60) + tt(" sa", "h");
    if (d < 7 * 1440) return Math.round(d / 1440) + tt(" g", "d");
    return new Date(iso).toLocaleDateString(YR, { day: "numeric", month: "short" });
  }
  const BT = (h) => (EN ? h.baslik_en : h.baslik_tr) || h.baslik_en || h.baslik_orj;
  const OZ = (h) => (EN ? h.ozet_en : h.ozet_tr);
  const CIZGI = { ad: tt("Antiemperyalist / dekolonyal", "Anti-imperialist / decolonial"), ara: tt("Ara / ana akım", "Middle / mainstream"),
    ik: tt("İsrail ve Batı ana akımı", "Israeli and Western mainstream") };

  if (!id) { kok.textContent = tt("Hesap bulunamadı.", "Account not found."); return; }
  Promise.all([window.ALB_BOLGE ? window.ALB_BOLGE.hazir : null]).then(() => Promise.all([j("kaynaklar.json", []), j("data/logolar.json", {}), j("data/hesap/" + encodeURIComponent(id) + ".json", null), j("data/karne.json", null)])
    .then(([K, logolar, hs, karne]) => {
      const k = K.find((x) => String(x.id) === String(id));
      if (!k) { kok.textContent = tt("Hesap bulunamadı.", "Account not found."); return; }
      if (window.ALB_BOLGE && window.ALB_BOLGE.gizli(k)) { kok.textContent = tt("Bu hesap bulunduğun ülkede gösterilmiyor.", "This account is not shown in your country."); return; }
      document.title = k.ad + " · " + document.title.split("·")[0].trim();
      kok.textContent = "";
      const r = H.renk(k);
      kok.style.setProperty("--hesap", r.ana);
      // üst: kapak şeridi, simge, ad
      const ust = el("section", "pf-ust");
      ust.appendChild(el("div", "pf-kapak"));
      const kimlik = el("div", "pf-kimlik");
      kimlik.appendChild(H.avatar(k, logolar, "pf-avatar"));
      const ad = el("div", "pf-ad");
      ad.append(el("h1", null, k.ad), el("span", "pf-kul", H.kulAd(k)));
      ad.appendChild(el("span", "pf-resmi-degil", tt("Resmî hesap değil · Bu yayının haberlerini Alboroto derler; her gönderi kaynağına bağlanır.", "Not an official account · Alboroto collects " + k.ad + "’s stories; every post links to the source.")));
      kimlik.appendChild(ad);
      ust.appendChild(kimlik);
      // eylemler
      const ey = el("div", "pf-eylem");
      ey.appendChild(H.takipDugme(k.id, "buyuk"));
      // Instagram ve X: sitenin içine gömmüyoruz (okurları Meta ve X izlemesine açmamak için); ayrı bir pencerede açılır
      const sosyal = [];
      if (k.sadece_instagram) sosyal.push(["Instagram", "https://www.instagram.com/" + k.sadece_instagram + "/", "Instagram’da"]);
      if (k.x) sosyal.push(["X", "https://x.com/" + k.x, "X’te"]);
      if (sosyal.length) {
        sosyal.forEach(([ad, u, ek]) => {
          const a = el("a", "pf-dugme pf-sosyal", tt(ek + " gör ↗", "See on " + ad + " ↗")); a.href = u; a.target = "_blank"; a.rel = "noopener";
          a.onclick = (e) => {
            if (window.matchMedia("(max-width: 760px)").matches) return;   // telefonda yeni sekme ya da uygulama açılır
            const w = window.open(u, "alb-sosyal", "popup,width=480,height=860,left=" + Math.max(0, screen.width - 520) + ",top=40");
            if (w) { e.preventDefault(); try { w.opener = null; } catch (x) { /* başka köken */ } }
          };
          ey.appendChild(a);
        });
      } else {
        const site = el("a", "pf-dugme", tt("Web sitesi ↗", "Website ↗")); site.href = k.url; site.target = "_blank"; site.rel = "noopener"; ey.appendChild(site);
      }
      const ka = el("a", "pf-dugme", tt("Kaynaklar sayfası", "Sources page")); ka.href = "kaynaklar.html"; ey.appendChild(ka);
      ust.appendChild(ey);
      // künye
      const kun = el("div", "pf-kunye");
      [k.sehir && k.ulke ? k.sehir + ", " + k.ulke : k.ulke, H.dilYaz(k.dil), H.turYaz(k)].filter(Boolean).forEach((x) => kun.appendChild(el("span", null, x)));
      const kp = el("span", "pf-kamp"); const i_ = el("i"); i_.style.background = r.ana; kp.append(i_, document.createTextNode(H.kampYaz(k))); kun.appendChild(kp);
      ust.appendChild(kun);
      if (H.taksimCip) { const tx = H.taksimCip(k); tx.classList.add("pf-taksim"); ust.appendChild(tx); }
      if (k.profil) {
        const p = el("p", "pf-bio", (EN && k.profil_en) || k.profil); if (EN && !k.profil_en) p.lang = "tr"; ust.appendChild(p);
      }
      if (k.dogrulanmadi) ust.appendChild(el("p", "pf-uyari", tt("OSINT hesabı · Paylaşımları doğrulanmadı.", "OSINT account · Its posts have not been verified.")));
      if (k.cizgi) {
        const c = el("p", "pf-cizgi");
        c.append(el("span", "cz cz-" + k.cizgi, CIZGI[k.cizgi] || CIZGI.ara));
        if (k.cizgi_et) c.append(el("b", "pf-cizgi-et", " " + ((EN && k.cizgi_et_en) || k.cizgi_et) + "."));
        c.append(el("span", null, tt(" Alboroto’nun editoryal değerlendirmesi; ölçütleri Kaynaklar sayfasında.", " Alboroto’s editorial assessment; criteria on the Sources page.")));
        ust.appendChild(c);
      }
      // sayılar
      const say = el("div", "pf-sayilar");
      const kut = (v, e) => { const d = el("div"); d.append(el("b", null, v), el("span", null, e)); say.appendChild(d); };
      kut(String((hs && hs.gun7) || 0), tt("haber · 7 gün", "stories · 7 days"));
      const kr = karne && (karne.karne || []).find((x) => String(x.id) === String(id));
      if (kr && kr.fail_gizli != null && kr.olum_baslik >= 20) {
        kut("%" + (100 - kr.fail_gizli), tt("ölüm başlığında fail yazılı · 30 gün", "death headlines naming a perpetrator · 30 days"));
        kut(String(kr.olum_baslik), tt("ölüm başlığı · 30 gün", "death headlines · 30 days"));
      }
      ust.appendChild(say);
      kok.appendChild(ust);
      // hakkında: kanıtlar
      if ((k.kanitlar || []).length) {
        const d = el("details", "pf-kanit");
        d.appendChild(el("summary", null, tt("Kim yayınlıyor: kanıtlar (" + k.kanitlar.length + ")", "Who publishes it: evidence (" + k.kanitlar.length + ")")));
        k.kanitlar.forEach((x) => {
          const p = el("p", null, x.metin + " ");
          if (x.url) { const a = el("a", null, (x.kaynak || tt("kaynak", "source")) + " ↗"); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; p.appendChild(a); }
          d.appendChild(p);
        });
        kok.appendChild(d);
      }
      // sekmeler
      const xs = (hs && hs.haberler) || [];
      const sek = el("div", "pf-sekmeler"); sek.setAttribute("role", "tablist");
      const govde = el("div", "pf-govde");
      const sekmeler = [[tt("Gönderiler", "Posts"), () => gonderiler(xs)]];
      sekmeler.forEach(([a, f], i) => {
        const b = el("button", "pf-sekme", a); b.type = "button"; b.setAttribute("role", "tab");
        b.onclick = () => { sek.querySelectorAll("button").forEach((x) => x.setAttribute("aria-selected", x === b)); govde.textContent = ""; govde.appendChild(f()); };
        sek.appendChild(b); if (!i) b.setAttribute("aria-selected", "true");
      });
      kok.append(sek, govde);
      govde.appendChild(gonderiler(xs));

      function gonderiler(liste) {
        const ol = el("ol", "pf-gonderiler");
        if (!liste.length) { ol.appendChild(el("li", "pf-bos", tt("Son 14 günde bu hesaptan konuyla ilgili haber yok.", "No relevant stories from this account in the last 14 days."))); return ol; }
        liste.forEach((h) => {
          const li = el("li", "pf-gonderi"); li.id = "g-" + h.id;
          const bas = el("div", "pf-g-ust");
          bas.append(H.avatar(k, logolar, "kucuk"), el("b", null, k.ad), el("span", null, H.kulAd(k) + " · " + once(h.tarih)));
          if (h.nitelik === "analiz") bas.appendChild(el("em", "pf-analiz", tt("Analiz", "Analysis")));
          li.appendChild(bas);
          const b = BT(h);
          li.appendChild(el("p", "pf-g-baslik", b));
          if (h.baslik_orj && h.baslik_orj !== b) { const o = el("p", "pf-g-orj", h.baslik_orj); o.lang = h.dil || ""; o.dir = "auto"; li.appendChild(o); }
          if (OZ(h)) li.appendChild(el("p", "pf-g-oz", OZ(h)));
          if (h.gorsel && !k.gorsel_yok) {
            const f = el("figure", "pf-g-gorsel"); const im = document.createElement("img");
            im.src = (window.AKTAR || ((u) => u))(h.gorsel, 360); im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; im.onerror = () => f.remove();
            f.appendChild(im); li.appendChild(f);
          }
          const alt = el("div", "pf-g-alt");
          const a = el("a", null, tt("Habere git ↗", "Open story ↗")); a.href = h.url; a.target = "_blank"; a.rel = "noopener"; alt.appendChild(a);
          const p = el("button", null, tt("Paylaş", "Share")); p.type = "button";
          p.onclick = () => { const u = h.url; if (navigator.share) navigator.share({ title: b, url: u }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).then(() => { p.textContent = tt("Bağlantı kopyalandı", "Link copied"); }, () => {}); };
          alt.appendChild(p);
          const hb = el("a", "pf-hata", tt("Hata bildir", "Report an error")); hb.href = H.hataBildir(h, k.ad); alt.appendChild(hb);
          if (OZ(h)) alt.appendChild(el("span", "pf-yz", tt("Özet ve çeviri: yapay zekâ", "Summary and translation: AI")));
          li.appendChild(alt);
          ol.appendChild(li);
        });
        return ol;
      }
      function izgara(liste) {
        const g = el("div", "pf-izgara");
        if (!liste.length) { g.appendChild(el("p", "pf-bos", tt("Gösterilebilecek görsel yok.", "No photos to show."))); return g; }
        liste.forEach((h) => {
          const a = el("a"); a.href = "#g-" + h.id; a.title = BT(h);
          a.onclick = (e) => { e.preventDefault(); sek.querySelector("button").click(); setTimeout(() => { const y = document.getElementById("g-" + h.id); if (y) y.scrollIntoView({ block: "center" }); }, 30); };
          const im = document.createElement("img"); im.src = (window.AKTAR || ((u) => u))(h.gorsel, 360); im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; im.onerror = () => a.remove();
          a.appendChild(im); g.appendChild(a);
        });
        return g;
      }
    }));
})();
