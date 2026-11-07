// ZBS sayfa kodu: kaynakları ve haberleri okur, haritayı ve akışı çizer, 5 dakikada bir yeniler.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran-Yemen", "Mağrip", "Anadolu", "İsrail", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "karşı taraf" };
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const SAYFA = 60;

  let kaynaklar = {}, haberler = [], guncellendi = null;
  let bolge = "Tümü", sehir = null, ara = "", kac = SAYFA;
  const $ = (id) => document.getElementById(id);

  function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }

  function once(iso) {
    const d = (Date.now() - new Date(iso).getTime()) / 60000;
    if (!isFinite(d)) return "";
    if (d < 1) return "az önce";
    if (d < 60) return Math.round(d) + " dk önce";
    if (d < 1440) return Math.round(d / 60) + " sa önce";
    return Math.round(d / 1440) + " gün önce";
  }

  // ---------------------------------------------------- harita
  const koyu = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  let katman = null;
  try {
    const harita = L.map("harita", { worldCopyJump: true, zoomControl: true, minZoom: 2, maxZoom: 9 });
    harita.fitBounds([[12, -12], [55, 58]]);
    const carto = L.tileLayer("https://{s}.basemaps.cartocdn.com/" + (koyu ? "dark_all" : "light_all") + "/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd", maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(harita);
    // CARTO karoları gelmezse OpenStreetMap'in kendi karolarına geç
    let hata = 0;
    carto.on("tileerror", () => {
      if (++hata !== 4) return;
      harita.removeLayer(carto);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(harita);
    });
    katman = L.layerGroup().addTo(harita);
    window.addEventListener("resize", () => harita.invalidateSize());
    setTimeout(() => harita.invalidateSize(), 300);
  } catch (e) {
    // Harita kütüphanesi yüklenemezse akış yine çalışsın
    const h = document.getElementById("harita");
    h.textContent = "Harita yüklenemedi. Haber akışı çalışmaya devam ediyor.";
    h.style.cssText += ";display:flex;align-items:center;justify-content:center;color:var(--soluk);padding:16px;text-align:center";
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
    const yesil = getComputedStyle(document.documentElement).getPropertyValue("--yesil").trim() || "#1f5c3c";
    const kirmizi = getComputedStyle(document.documentElement).getPropertyValue("--kirmizi").trim() || "#b0282b";
    Object.entries(sayac).forEach(([ad, s]) => {
      const secili = ad === sehir;
      const m = L.circleMarker([s.lat, s.lon], {
        radius: 5 + Math.sqrt(s.n) * 2.2, weight: secili ? 3 : 1,
        color: secili ? kirmizi : yesil, fillColor: secili ? kirmizi : yesil, fillOpacity: s.n ? 0.55 : 0.18,
      });
      m.bindTooltip(ad + " · " + s.n + " haber · " + s.yayin.size + " yayın");
      m.on("click", () => { sehir = secili ? null : ad; kac = SAYFA; ciz(); });
      katman.addLayer(m);
    });
  }

  // ---------------------------------------------------- akış
  function suz() {
    const ilgili = $("fIlgili").checked, ozetli = $("fOzet").checked;
    return haberler.filter((h) => {
      const k = kaynaklar[h.kaynak]; if (!k) return false;
      if (h.atla) return false;
      if (bolge !== "Tümü" && k.bolge !== bolge) return false;
      if (ilgili && !h.ilgili) return false;
      if (ozetli && !h.ozet_tr) return false;
      if (ara) {
        const m = [h.baslik_tr, h.ozet_tr, h.baslik_orj, k.ad, k.sehir].join(" ").toLocaleLowerCase("tr");
        if (!m.includes(ara)) return false;
      }
      return true;
    });
  }

  function arsivBag(url) {
    return [
      ["Wayback’e kaydet", "https://web.archive.org/save/" + url],
      ["archive.today", "https://archive.ph/?run=1&url=" + encodeURIComponent(url)],
    ];
  }

  function haberCiz(h) {
    const k = kaynaklar[h.kaynak];
    const kutu = el("article", "haber");
    const ust = el("div", "ust-bilgi");
    ust.appendChild(el("span", "kaynak", k.ad));
    ust.appendChild(el("span", "etiket " + k.tur, TUR[k.tur] || k.tur));
    if (h.telegram) ust.appendChild(el("span", "etiket tg", "Telegram"));
    ust.appendChild(el("span", null, k.sehir));
    const z = el("time", "zaman", once(h.tarih)); z.dateTime = h.tarih; z.title = new Date(h.tarih).toLocaleString("tr-TR"); ust.appendChild(z);
    kutu.appendChild(ust);
    if (h.baslik_tr) {
      kutu.appendChild(el("h2", null, h.baslik_tr));
      if (h.ozet_tr) kutu.appendChild(el("p", null, h.ozet_tr));
    } else {
      const b = el("h2", "orj", h.baslik_orj); b.dir = "auto"; b.lang = k.dil; kutu.appendChild(b);
      kutu.appendChild(el("span", "cevirisiz", (DIL[k.dil] || k.dil) + " · Türkçe özet " + (h.ilgili ? "sırada" : "yazılmadı")));
    }
    const bag = el("div", "baglantilar");
    const a = el("a", null, h.telegram ? "Telegram’da aç" : "Haberin orijinali"); a.href = h.url; a.target = "_blank"; a.rel = "noopener"; bag.appendChild(a);
    arsivBag(h.url).forEach(([l, u]) => { const x = el("a", "arsiv", l); x.href = u; x.target = "_blank"; x.rel = "noopener"; bag.appendChild(x); });
    kutu.appendChild(bag);
    return kutu;
  }

  function ciz() {
    document.querySelectorAll("#fBolge .cip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === bolge));
    const s = $("fSehir"); s.hidden = !sehir; if (sehir) s.textContent = sehir + "  ×";
    const liste = suz();
    haritaCiz(liste);
    const gor = sehir ? liste.filter((h) => kaynaklar[h.kaynak].sehir === sehir) : liste;
    const akis = $("akis"); akis.innerHTML = "";
    if (!haberler.length) {
      akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek; bu 15 dakikayı bulabilir."));
    } else if (!gor.length) {
      akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
    }
    gor.slice(0, kac).forEach((h) => akis.appendChild(haberCiz(h)));
    $("daha").hidden = gor.length <= kac;
    const d = $("durum"); d.innerHTML = "";
    d.appendChild(el("b", null, gor.length)); d.append(" haber gösteriliyor");
    if (guncellendi) d.append(" · son güncelleme " + once(guncellendi));
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
      $("durum").textContent = "Veriler okunamadı. Sayfayı yenilemeyi dene.";
    }
  }

  // ---------------------------------------------------- süzgeçler
  ["Tümü", ...BOLGELER].forEach((b) => {
    const c = el("button", "cip", b); c.type = "button"; c.dataset.k = b;
    c.onclick = () => { bolge = b; sehir = null; kac = SAYFA; ciz(); };
    $("fBolge").appendChild(c);
  });
  $("fIlgili").onchange = $("fOzet").onchange = () => { kac = SAYFA; ciz(); };
  $("fAra").addEventListener("input", (e) => { ara = e.target.value.trim().toLocaleLowerCase("tr"); kac = SAYFA; ciz(); });
  $("fSehir").onclick = () => { sehir = null; ciz(); };
  $("daha").onclick = () => { kac += SAYFA; ciz(); };

  yukle();
  setInterval(yukle, 5 * 60 * 1000);
})();
