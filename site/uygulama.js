// ZBS sayfa kodu: harita tüm sahneyi kaplar, haberler yüzen paneldeki kartlarda akar.
// Okunan kart değiştikçe harita o haberin şehrine uçar. Veri 5 dakikada bir yenilenir.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran", "Yemen", "Mağrip", "Anadolu-Türkiye", "İsrail", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "karşı taraf" };
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const DUNYA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const SAYFA = 30;
  const BAYRAK = '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>';
  const AZ_HAREKET = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let kaynaklar = {}, haberler = [], guncellendi = null, gor = [];
  let bolge = "Tümü", sehir = null, ara = "", kac = SAYFA, aktifId = null;
  const $ = (id) => document.getElementById(id);
  const renk = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
  const tel = () => window.matchMedia("(max-width:760px)").matches;
  const sakla = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const oku = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function dk(iso) { return (Date.now() - new Date(iso).getTime()) / 60000; }
  function once(iso) {
    const d = dk(iso);
    if (!isFinite(d)) return "";
    if (d < 1) return "az önce";
    if (d < 60) return Math.round(d) + " dk önce";
    if (d < 1440) return Math.round(d / 60) + " sa önce";
    return Math.round(d / 1440) + " gün önce";
  }
  function bas(ad) {
    const k = ad.replace(/^(The|Al|El|La|Le|Il|L’|Der|Die)[\s-]+/i, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
    return ((k[0] || "")[0] + ((k[1] || "")[0] || (k[0] || "")[1] || "")).toUpperCase();
  }

  // ---------------------------------------------------- harita
  let harita = null, katman = null;
  try {
    harita = L.map("harita", { worldCopyJump: true, zoomControl: true, minZoom: 2, maxZoom: 8, zoomSnap: 0.25 });
    harita.fitBounds(tel() ? [[22, 0], [48, 50]] : [[10, -20], [56, 60]], { paddingBottomRight: tel() ? [0, 0] : [480, 0] });
    harita.attributionControl.setPrefix(false).addAttribution('Sınırlar: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
    fetch(DUNYA).then((r) => r.json()).then((topo) => {
      const ulkeler = topojson.feature(topo, topo.objects.countries);
      // 180. boylamı kesen ülkeler (Rusya, Fiji) yatay şerit çizmesin; Antarktika’yı çizme.
      const duzelt = (halka) => {
        const x = halka.map((p) => p[0]);
        if (Math.max(...x) - Math.min(...x) > 180) halka.forEach((p) => { if (p[0] < 0) p[0] += 360; });
      };
      ulkeler.features = ulkeler.features.filter((f) => f.id !== "010" && f.properties.name !== "Antarctica");
      ulkeler.features.forEach((f) => {
        const g = f.geometry; if (!g) return;
        if (g.type === "Polygon") g.coordinates.forEach(duzelt);
        if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach(duzelt));
      });
      L.geoJSON(ulkeler, {
        interactive: false,
        style: () => ({ color: renk("--sinir"), weight: 0.8, fillColor: renk("--kara"), fillOpacity: 1 }),
      }).addTo(harita).bringToBack();
    }).catch(() => {});
    katman = L.layerGroup().addTo(harita);
    window.addEventListener("resize", () => harita.invalidateSize());
    setTimeout(() => harita.invalidateSize(), 300);
  } catch (e) {
    const h = $("harita"); h.innerHTML = "";
    h.appendChild(el("div", "harita-hata", "Harita yüklenemedi. Haber akışı çalışmaya devam ediyor."));
  }

  // Noktayı panelin örtmediği alanın ortasına getir
  function ucur(lat, lon) {
    if (!harita) return;
    const z = Math.max(harita.getZoom(), 4);
    const panel = $("panel");
    let ofs = [0, 0];
    if (tel()) ofs = [0, (panel.offsetHeight) / 2];
    else ofs = [(panel.offsetWidth + 16) / 2, 0];
    const p = harita.project([lat, lon], z).add(ofs);
    const hedef = harita.unproject(p, z);
    if (AZ_HAREKET) harita.setView(hedef, z); else harita.flyTo(hedef, z, { duration: 0.9 });
  }

  function haritaCiz(liste) {
    if (!katman) return;
    katman.clearLayers();
    const sayac = {};
    Object.values(kaynaklar).forEach((k) => {
      if (bolge !== "Tümü" && k.bolge !== bolge) return;
      const s = (sayac[k.sehir] = sayac[k.sehir] || { lat: k.lat, lon: k.lon, n: 0, yayin: new Set() });
      s.yayin.add(k.ad);
    });
    liste.forEach((h) => { const k = kaynaklar[h.kaynak]; if (k && sayac[k.sehir]) sayac[k.sehir].n++; });
    const aktif = aktifId && haberler.find((h) => h.id === aktifId);
    const aktifSehir = aktif && kaynaklar[aktif.kaynak] ? kaynaklar[aktif.kaynak].sehir : null;
    const yesil = renk("--yesil"), kirmizi = renk("--kirmizi");
    Object.entries(sayac).sort((a, b) => b[1].n - a[1].n).forEach(([ad, s]) => {
      const vurgu = ad === sehir || ad === aktifSehir, c = vurgu ? kirmizi : yesil;
      const r = 4 + Math.sqrt(s.n) * 1.8;
      if (s.n) katman.addLayer(L.circleMarker([s.lat, s.lon], { radius: r + (vurgu ? 10 : 6), stroke: false, fillColor: c, fillOpacity: vurgu ? 0.22 : 0.12, interactive: false }));
      const m = L.circleMarker([s.lat, s.lon], { radius: r, weight: vurgu ? 2.5 : 1.5, color: c, fillColor: c, fillOpacity: s.n ? 0.65 : 0.15 });
      m.bindTooltip("<b>" + ad + "</b> · " + s.n + " haber · " + s.yayin.size + " yayın", { direction: "top", offset: [0, -r] });
      m.on("click", () => { sehir = ad === sehir ? null : ad; kac = SAYFA; ciz(true); });
      katman.addLayer(m);
    });
  }

  // ---------------------------------------------------- kartlar
  function suz() {
    const ilgili = $("fIlgili").checked, ozetli = $("fOzet").checked;
    return haberler.filter((h) => {
      const k = kaynaklar[h.kaynak]; if (!k || h.atla) return false;
      if (bolge !== "Tümü" && k.bolge !== bolge) return false;
      if (ilgili && !h.ilgili) return false;
      if (ozetli && !h.ozet_tr) return false;
      if (ara) {
        const m = [h.baslik_tr, h.ozet_tr, h.baslik_orj, k.ad, k.sehir, k.ulke].join(" ").toLocaleLowerCase("tr");
        if (!m.includes(ara)) return false;
      }
      return true;
    });
  }

  function eylem(metin, url, sinif) {
    const a = el("a", "eylem" + (sinif ? " " + sinif : ""), metin); a.href = url; a.target = "_blank"; a.rel = "noopener"; return a;
  }

  function yerTutucu(kutu, k) {
    kutu.innerHTML = ""; kutu.classList.add("yok");
    const y = el("div", "yer-tutucu yt-" + k.tur);
    y.appendChild(el("b", null, bas(k.ad)));
    y.appendChild(el("span", null, k.ad + " · " + k.sehir));
    kutu.appendChild(y);
  }

  function gorselCiz(h, k) {
    const kutu = el("div", "gorsel");
    if (h.gorsel) {
      const img = document.createElement("img");
      img.loading = "lazy"; img.decoding = "async"; img.alt = ""; img.referrerPolicy = "no-referrer"; img.src = h.gorsel;
      img.onerror = () => yerTutucu(kutu, k);
      kutu.appendChild(img);
      kutu.appendChild(el("span", "kredi", "Görsel: " + k.ad));
      const ac = el("button", "ac", "Görseli göstermek için dokun"); ac.type = "button";
      ac.onclick = () => kutu.classList.add("acik");
      kutu.appendChild(ac);
    } else {
      yerTutucu(kutu, k);
    }
    return kutu;
  }

  function haberCiz(h) {
    const k = kaynaklar[h.kaynak];
    const kart = el("article", "haber"); kart.dataset.id = h.id;
    kart.appendChild(gorselCiz(h, k));
    const g = el("div", "govde");
    const ust = el("div", "kart-ust");
    ust.appendChild(el("div", "avatar " + k.tur, bas(k.ad)));
    const kim = el("div", "kim");
    const adEl = el("span", "ad", k.ad);
    if (k.bolge === "İsrail") adEl.insertAdjacentHTML("afterbegin", BAYRAK);
    kim.appendChild(adEl);
    const yer = el("span", "yer", k.sehir + " · ");
    const z = el("time", null, once(h.tarih)); z.dateTime = h.tarih; z.title = new Date(h.tarih).toLocaleString("tr-TR"); yer.appendChild(z);
    kim.appendChild(yer); ust.appendChild(kim);
    const roz = el("div", "rozetler");
    if (dk(h.tarih) < 30) roz.appendChild(el("span", "rozet yeni", "YENİ"));
    if (h.telegram) roz.appendChild(el("span", "rozet tg", "Telegram"));
    roz.appendChild(el("span", "rozet " + k.tur, TUR[k.tur] || k.tur));
    ust.appendChild(roz);
    g.appendChild(ust);
    if (h.baslik_tr) {
      g.appendChild(el("h2", null, h.baslik_tr));
      if (h.ozet_tr) g.appendChild(el("p", null, h.ozet_tr));
    } else {
      const b = el("h2", "orj", h.baslik_orj); b.dir = "auto"; b.lang = k.dil; g.appendChild(b);
      g.appendChild(el("span", "cevirisiz", (DIL[k.dil] || k.dil) + " · Türkçe özet " + (h.ilgili ? "sırada" : "yazılmadı")));
    }
    const ey = el("div", "eylemler");
    ey.appendChild(eylem(h.telegram ? "Telegram’da aç ↗" : "Kaynağa git ↗", h.url, "ana"));
    ey.appendChild(eylem("Wayback’e kaydet", "https://web.archive.org/save/" + h.url));
    ey.appendChild(eylem("archive.today", "https://archive.ph/?run=1&url=" + encodeURIComponent(h.url)));
    g.appendChild(ey);
    kart.appendChild(g);
    kart.addEventListener("click", (e) => { if (!e.target.closest("a,button")) aktifEt(h.id, true); });
    return kart;
  }

  // ---------------------------------------------------- etkin kart ve harita takibi
  let gozcu = null;
  function aktifEt(id, zorla) {
    if (id === aktifId && !zorla) return;
    aktifId = id;
    document.querySelectorAll(".haber.aktif").forEach((x) => x.classList.remove("aktif"));
    const kart = document.querySelector('.haber[data-id="' + id + '"]'); if (kart) kart.classList.add("aktif");
    const h = haberler.find((x) => x.id === id); const k = h && kaynaklar[h.kaynak];
    if (k) { ucur(k.lat, k.lon); haritaCiz(suz()); }
  }
  function gozle() {
    if (gozcu) gozcu.disconnect();
    if (!("IntersectionObserver" in window)) return;
    gozcu = new IntersectionObserver((girdiler) => {
      const gorunen = girdiler.filter((g) => g.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (gorunen) aktifEt(gorunen.target.dataset.id);
    }, { root: $("akis"), threshold: [0.6] });
    document.querySelectorAll("#akis .haber").forEach((k) => gozcu.observe(k));
  }

  let sonGozcu = null;
  function sonrakiYukle() {
    if (sonGozcu) sonGozcu.disconnect();
    const son = $("akis").querySelector(".nota-son");
    if (!son || !("IntersectionObserver" in window)) return;
    sonGozcu = new IntersectionObserver((g) => { if (g[0].isIntersecting) { kac += SAYFA; ciz(false, true); } }, { root: $("akis"), rootMargin: "400px" });
    sonGozcu.observe(son);
  }

  function ciz(basaDon, devam) {
    document.querySelectorAll("#fBolge .cip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === bolge));
    const sc = $("fSehir"); sc.hidden = !sehir; if (sehir) sc.textContent = sehir + "  ✕";
    const liste = suz();
    gor = sehir ? liste.filter((h) => kaynaklar[h.kaynak].sehir === sehir) : liste;
    const akis = $("akis");
    const kaydir = akis.scrollTop;
    akis.innerHTML = "";
    if (!haberler.length) akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek."));
    else if (!gor.length) akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
    gor.slice(0, kac).forEach((h) => akis.appendChild(haberCiz(h)));
    if (gor.length > kac) akis.appendChild(el("p", "nota nota-son", "Yükleniyor…"));
    else if (gor.length) {
      const n = el("p", "nota"); n.append("Hepsi bu kadar. Yayınların kim olduğunu ");
      const a = el("a", null, "Kaynaklar"); a.href = "kaynaklar.html"; n.appendChild(a); n.append(" sayfasında bulabilirsin."); akis.appendChild(n);
    }
    if (basaDon) akis.scrollTop = 0; else akis.scrollTop = kaydir;
    const s = $("sayilar"); s.innerHTML = "";
    s.appendChild(el("b", null, gor.length.toLocaleString("tr-TR"))); s.append(" haber · ");
    s.appendChild(el("b", null, gor.filter((h) => h.ozet_tr).length.toLocaleString("tr-TR"))); s.append(" Türkçe · ");
    s.appendChild(el("b", null, gor.filter((h) => dk(h.tarih) < 60).length.toLocaleString("tr-TR"))); s.append(" son saatte");
    $("canliMetin").textContent = guncellendi ? "Güncellendi · " + once(guncellendi) : "Canlı";
    if (aktifId && !gor.slice(0, kac).some((h) => h.id === aktifId)) aktifId = null;
    if (aktifId) { const k = document.querySelector('.haber[data-id="' + aktifId + '"]'); if (k) k.classList.add("aktif"); }
    haritaCiz(liste);
    gozle(); sonrakiYukle();
    if (basaDon && gor[0] && !devam) aktifEt(gor[0].id, true);
  }

  // ---------------------------------------------------- veri
  let ilk = true;
  async function yukle() {
    const t = Date.now();
    try {
      const [k, h] = await Promise.all([
        fetch("kaynaklar.json?t=" + t).then((r) => r.json()),
        fetch("data/haberler.json?t=" + t).then((r) => r.json()),
      ]);
      kaynaklar = {}; k.forEach((x) => (kaynaklar[x.id] = x));
      haberler = (h.haberler || []).slice().sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
      guncellendi = h.guncellendi;
      ciz(ilk); ilk = false;
    } catch (e) {
      $("canliMetin").textContent = "Veri okunamadı";
    }
  }

  // ---------------------------------------------------- denetimler
  ["Tümü", ...BOLGELER].forEach((b) => {
    const c = el("button", "cip", b); c.type = "button"; c.dataset.k = b;
    c.onclick = () => { bolge = b; sehir = null; kac = SAYFA; ciz(true); };
    $("fBolge").appendChild(c);
  });
  $("fIlgili").onchange = $("fOzet").onchange = () => { kac = SAYFA; ciz(true); };
  const bul = $("fBulanik");
  bul.checked = oku("zbs-bulanik") === "1";
  document.body.classList.toggle("bulanik", bul.checked);
  bul.onchange = () => { document.body.classList.toggle("bulanik", bul.checked); sakla("zbs-bulanik", bul.checked ? "1" : "0"); };
  let bekle;
  $("fAra").addEventListener("input", (e) => { clearTimeout(bekle); bekle = setTimeout(() => { ara = e.target.value.trim().toLocaleLowerCase("tr"); kac = SAYFA; ciz(true); }, 180); });
  $("fSehir").onclick = () => { sehir = null; ciz(true); };
  // Telefonda kartlar kaydırılınca süzgeçleri gizle, en üste dönünce geri getir
  $("akis").addEventListener("scroll", () => { $("panel").classList.toggle("kompakt", tel() && $("akis").scrollTop > 40); }, { passive: true });
  $("tutamak").onclick = () => { $("panel").classList.toggle("kucuk"); setTimeout(() => harita && harita.invalidateSize(), 400); };
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    const i = gor.findIndex((h) => h.id === aktifId);
    const git = (j) => { const h = gor[j]; if (!h) return; const k = document.querySelector('.haber[data-id="' + h.id + '"]'); if (k) k.scrollIntoView({ behavior: AZ_HAREKET ? "auto" : "smooth", block: "start" }); };
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); git(i + 1); }
    if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); git(Math.max(0, i - 1)); }
  });

  yukle();
  setInterval(yukle, 5 * 60 * 1000);
  setInterval(() => { if (guncellendi) $("canliMetin").textContent = "Güncellendi · " + once(guncellendi); }, 60 * 1000);
})();
