// ZBS sayfa kodu: kaynakları ve haberleri okur, vektör haritayı ve kart akışını çizer, 5 dakikada bir yeniler.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran-Yemen", "Mağrip", "Anadolu", "İsrail", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "karşı taraf" };
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const DUNYA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const SAYFA = 40;

  let kaynaklar = {}, haberler = [], guncellendi = null;
  let bolge = "Tümü", sehir = null, ara = "", kac = SAYFA;
  const $ = (id) => document.getElementById(id);
  const renk = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();

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

  // ---------------------------------------------------- harita (karo yok, ülke sınırları vektör olarak çiziliyor)
  let harita = null, katman = null;
  try {
    harita = L.map("harita", { worldCopyJump: true, zoomControl: true, minZoom: 2, maxZoom: 8, attributionControl: true, zoomSnap: 0.25 });
    harita.fitBounds([[14, -10], [54, 56]]);
    harita.attributionControl.setPrefix(false).addAttribution('Sınırlar: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
    fetch(DUNYA).then((r) => r.json()).then((topo) => {
      const ulkeler = topojson.feature(topo, topo.objects.countries);
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
    const yesil = renk("--yesil"), kirmizi = renk("--kirmizi");
    Object.entries(sayac).sort((a, b) => b[1].n - a[1].n).forEach(([ad, s]) => {
      const secili = ad === sehir, c = secili ? kirmizi : yesil;
      const r = 4 + Math.sqrt(s.n) * 1.8;
      if (s.n) katman.addLayer(L.circleMarker([s.lat, s.lon], { radius: r + 6, stroke: false, fillColor: c, fillOpacity: 0.12, interactive: false }));
      const m = L.circleMarker([s.lat, s.lon], { radius: r, weight: 1.5, color: c, fillColor: c, fillOpacity: s.n ? 0.6 : 0.15 });
      m.bindTooltip("<b>" + ad + "</b> · " + s.n + " haber · " + s.yayin.size + " yayın", { direction: "top", offset: [0, -r] });
      m.on("click", () => { sehir = secili ? null : ad; kac = SAYFA; ciz(); });
      katman.addLayer(m);
    });
  }

  // ---------------------------------------------------- akış
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

  function haberCiz(h) {
    const k = kaynaklar[h.kaynak];
    const kart = el("article", "haber");
    const ust = el("div", "kart-ust");
    ust.appendChild(el("div", "avatar " + k.tur, bas(k.ad)));
    const kim = el("div", "kim");
    kim.appendChild(el("span", "ad", k.ad));
    const yer = el("span", "yer", k.sehir + " · ");
    const z = el("time", null, once(h.tarih)); z.dateTime = h.tarih; z.title = new Date(h.tarih).toLocaleString("tr-TR"); yer.appendChild(z);
    kim.appendChild(yer); ust.appendChild(kim);
    const roz = el("div", "rozetler");
    if (dk(h.tarih) < 30) roz.appendChild(el("span", "rozet yeni", "YENİ"));
    if (h.telegram) roz.appendChild(el("span", "rozet tg", "Telegram"));
    roz.appendChild(el("span", "rozet " + k.tur, TUR[k.tur] || k.tur));
    ust.appendChild(roz);
    kart.appendChild(ust);

    if (h.baslik_tr) {
      kart.appendChild(el("h2", null, h.baslik_tr));
      if (h.ozet_tr) kart.appendChild(el("p", null, h.ozet_tr));
    } else {
      const b = el("h2", "orj", h.baslik_orj); b.dir = "auto"; b.lang = k.dil; kart.appendChild(b);
      kart.appendChild(el("span", "cevirisiz", (DIL[k.dil] || k.dil) + " · Türkçe özet " + (h.ilgili ? "sırada" : "yazılmadı")));
    }
    const ey = el("div", "eylemler");
    ey.appendChild(eylem(h.telegram ? "Telegram’da aç ↗" : "Kaynağa git ↗", h.url, "ana"));
    ey.appendChild(eylem("Wayback’e kaydet", "https://web.archive.org/save/" + h.url));
    ey.appendChild(eylem("archive.today", "https://archive.ph/?run=1&url=" + encodeURIComponent(h.url)));
    kart.appendChild(ey);
    return kart;
  }

  function sayilar(liste) {
    const s = $("sayilar"); s.innerHTML = "";
    [[liste.length, "haber bu görünümde"], [liste.filter((h) => h.ozet_tr).length, "Türkçe özetli"], [liste.filter((h) => dk(h.tarih) < 60).length, "son bir saatte"]]
      .forEach(([n, l]) => { const d = el("div", "sayi"); d.appendChild(el("b", null, n.toLocaleString("tr-TR"))); d.appendChild(el("span", null, l)); s.appendChild(d); });
  }

  function ciz() {
    document.querySelectorAll("#fBolge .cip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === bolge));
    const sc = $("fSehir"); sc.hidden = !sehir; if (sehir) sc.textContent = sehir + "  ✕";
    const liste = suz();
    haritaCiz(liste);
    const gor = sehir ? liste.filter((h) => kaynaklar[h.kaynak].sehir === sehir) : liste;
    sayilar(gor);
    const akis = $("akis"); akis.innerHTML = "";
    if (!haberler.length) akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek."));
    else if (!gor.length) akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
    gor.slice(0, kac).forEach((h) => akis.appendChild(haberCiz(h)));
    $("daha").hidden = gor.length <= kac;
    $("canliMetin").textContent = guncellendi ? "Güncellendi · " + once(guncellendi) : "Canlı";
  }

  // ---------------------------------------------------- veri
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
      ciz();
    } catch (e) {
      $("canliMetin").textContent = "Veri okunamadı";
    }
  }

  // ---------------------------------------------------- süzgeçler
  ["Tümü", ...BOLGELER].forEach((b) => {
    const c = el("button", "cip", b); c.type = "button"; c.dataset.k = b;
    c.onclick = () => { bolge = b; sehir = null; kac = SAYFA; ciz(); };
    $("fBolge").appendChild(c);
  });
  $("fIlgili").onchange = $("fOzet").onchange = () => { kac = SAYFA; ciz(); };
  let bekle;
  $("fAra").addEventListener("input", (e) => { clearTimeout(bekle); bekle = setTimeout(() => { ara = e.target.value.trim().toLocaleLowerCase("tr"); kac = SAYFA; ciz(); }, 150); });
  $("fSehir").onclick = () => { sehir = null; ciz(); };
  $("daha").onclick = () => { kac += SAYFA; ciz(); };

  yukle();
  setInterval(yukle, 5 * 60 * 1000);
  setInterval(() => { if (guncellendi) $("canliMetin").textContent = "Güncellendi · " + once(guncellendi); }, 60 * 1000);
})();
