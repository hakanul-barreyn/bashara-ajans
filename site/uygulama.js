// ZBS sayfa kodu: haber kartları ortada, harita ve şehir listesi yanda.
// Bir habere tıklayınca ya da üzerine gelince harita o haberin şehrine uçar. Veri 5 dakikada bir yenilenir.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran", "Yemen", "Mağrip", "Anadolu-Türkiye", "İsrail", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "karşı taraf" };
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const DUNYA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const SAYFA = 30;
  const BAYRAK = '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>';
  const AZ_HAREKET = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const KONULAR = ["Gazze", "Batı Şeria", "Kudüs", "Lübnan", "Suriye", "Yemen ve Kızıldeniz", "İran", "Irak", "Mısır", "Ürdün", "Mağrip", "Türkiye", "Körfez", "Göç", "Diplomasi ve müzakere", "İnsani durum", "Esirler ve tutuklular", "Uluslararası hukuk", "Protesto ve dayanışma", "Ekonomi ve boykot", "İsrail iç siyaseti", "Avrupa", "ABD"];
  let kaynaklar = {}, haberler = [], guncellendi = null, gor = [], olaylar = [], olayHarita = {};
  let konu = null, olaySec = null, odakId = null;
  let bilinen = null; // önceki yüklemede görülen haber kimlikleri
  let haberIdx = {};
  let bolge = "Tümü", sehir = null, ara = "", kac = SAYFA, aktifId = null;
  const $ = (id) => document.getElementById(id);
  const renk = (ad) => getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
  const tel = () => window.matchMedia("(max-width:820px)").matches;
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
    harita.fitBounds([[12, -12], [52, 58]]);
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

  function ucur(lat, lon) {
    if (!harita) return;
    const z = Math.max(harita.getZoom(), 3.5);
    if (AZ_HAREKET) harita.setView([lat, lon], z); else harita.flyTo([lat, lon], z, { duration: 0.9 });
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
    const sirali = Object.entries(sayac).sort((a, b) => b[1].n - a[1].n);
    // Yan sütundaki şehir listesi
    const ol = $("sehirler"); ol.innerHTML = "";
    const enCok = (sirali[0] && sirali[0][1].n) || 1;
    sirali.filter(([, s]) => s.n).slice(0, 10).forEach(([ad, s]) => {
      const li = el("li"), b = el("button"); b.type = "button"; b.setAttribute("aria-pressed", ad === sehir);
      b.appendChild(el("span", "ad", ad));
      const c = el("span", "cubuk"), i = el("i"); i.style.width = Math.max(4, (100 * s.n) / enCok) + "%"; c.appendChild(i); b.appendChild(c);
      b.appendChild(el("span", "n", s.n));
      b.onclick = () => { sehir = ad === sehir ? null : ad; kac = SAYFA; document.body.classList.remove("harita-acik"); ciz(true); ucur(s.lat, s.lon); };
      li.appendChild(b); ol.appendChild(li);
    });
    sirali.forEach(([ad, s]) => {
      const vurgu = ad === sehir || ad === aktifSehir, c = vurgu ? kirmizi : yesil;
      const r = 4 + Math.sqrt(s.n) * 1.8;
      if (s.n) katman.addLayer(L.circleMarker([s.lat, s.lon], { radius: r + (vurgu ? 10 : 6), stroke: false, fillColor: c, fillOpacity: vurgu ? 0.22 : 0.12, interactive: false }));
      const m = L.circleMarker([s.lat, s.lon], { radius: r, weight: vurgu ? 2.5 : 1.5, color: c, fillColor: c, fillOpacity: s.n ? 0.65 : 0.15 });
      m.bindTooltip("<b>" + ad + "</b> · " + s.n + " haber · " + s.yayin.size + " yayın", { direction: "top", offset: [0, -r] });
      m.on("click", () => { sehir = ad === sehir ? null : ad; kac = SAYFA; document.body.classList.remove("harita-acik"); ciz(true); });
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
      if (konu && !(h.etiket || []).includes(konu)) return false;
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

  function kalici(id) { return location.origin + location.pathname + "#h-" + id; }
  function paylasDugme(h) {
    const kutu = el("span", "paylas");
    const b = el("button", "eylem", "Paylaş"); b.type = "button"; b.setAttribute("aria-expanded", "false");
    const menu = el("span", "paylas-menu"); menu.hidden = true;
    const url = kalici(h.id), metin = (h.baslik_tr || h.baslik_orj) + " · " + kaynaklar[h.kaynak].ad;
    const bag = (l, u) => { const a = el("a", null, l); a.href = u; a.target = "_blank"; a.rel = "noopener"; menu.appendChild(a); };
    const kop = el("button", null, "Bağlantıyı kopyala"); kop.type = "button";
    kop.onclick = async () => { try { await navigator.clipboard.writeText(url); kop.textContent = "Kopyalandı"; } catch (e) { prompt("Bağlantı", url); } setTimeout(() => (kop.textContent = "Bağlantıyı kopyala"), 2000); };
    menu.appendChild(kop);
    bag("WhatsApp", "https://wa.me/?text=" + encodeURIComponent(metin + " " + url));
    bag("Telegram", "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(metin));
    bag("X", "https://x.com/intent/post?text=" + encodeURIComponent(metin) + "&url=" + encodeURIComponent(url));
    b.onclick = async (e) => {
      e.stopPropagation();
      if (navigator.share && tel()) { try { await navigator.share({ title: metin, text: h.ozet_tr || "", url }); } catch (x) {} return; }
      menu.hidden = !menu.hidden; b.setAttribute("aria-expanded", String(!menu.hidden));
    };
    kutu.append(b, menu);
    return kutu;
  }

  function olayAc(id) { olaySec = id; ciz(true); }

  function gundemCiz() {
    const kutu = $("gundem"); kutu.innerHTML = "";
    const liste = olaylar.filter((o) => o.haberler.some((i) => haberIdx[i])).slice(0, 10);
    kutu.hidden = !liste.length || !!olaySec;
    if (!liste.length) return;
    kutu.appendChild(el("h2", "bolum", "Gündem: birden fazla kaynağın yazdığı olaylar"));
    const serit = el("div", "gundem-serit");
    liste.forEach((o) => {
      const b = el("button", "olay-kart"); b.type = "button"; b.onclick = () => olayAc(o.id);
      b.appendChild(el("span", "olay-sayi", o.kaynak_sayisi + " kaynak"));
      b.appendChild(el("span", "olay-ad", o.baslik));
      const av = el("span", "olay-avatarlar");
      [...new Set(o.haberler.map((i) => haberIdx[i] && haberIdx[i].kaynak).filter(Boolean))].slice(0, 6).forEach((kid) => {
        const k = kaynaklar[kid]; if (k) { const a = el("span", "avatar " + k.tur, bas(k.ad)); a.title = k.ad; av.appendChild(a); }
      });
      b.appendChild(av);
      serit.appendChild(b);
    });
    kutu.appendChild(serit);
  }

  function seritCiz() {
    const son = haberler.filter((h) => h.ilgili && !h.atla && dk(h.tarih) < 90).slice(0, 14);
    const s = $("serit"); s.hidden = !son.length;
    document.documentElement.style.setProperty("--serit", son.length ? "38px" : "0px");
    const ic = $("seritIc"); ic.innerHTML = "";
    const parca = () => {
      const p = el("span", "serit-parca");
      son.forEach((h) => {
        const a = el("a", "serit-oge"); a.href = "#h-" + h.id;
        a.appendChild(el("b", null, kaynaklar[h.kaynak] ? kaynaklar[h.kaynak].ad : ""));
        const t = el("span", null, h.baslik_tr || h.baslik_orj); if (!h.baslik_tr) t.dir = "auto"; a.appendChild(t);
        p.appendChild(a);
      });
      return p;
    };
    ic.appendChild(parca()); ic.appendChild(parca());
    ic.style.animationDuration = Math.max(40, son.length * 9) + "s";
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
    if (h.etiket && h.etiket.length) {
      const et = el("div", "etiketler");
      h.etiket.forEach((t) => { const b = el("button", "etiket", "#" + t); b.type = "button"; b.onclick = () => { konu = t; kac = SAYFA; ciz(true); }; et.appendChild(b); });
      g.appendChild(et);
    }
    const o = h.olay && olayHarita[h.olay];
    if (o && !olaySec) {
      const b = el("button", "olay-bag", "Bu olayı " + o.kaynak_sayisi + " kaynak yazdı · nasıl anlattıklarını gör →"); b.type = "button";
      b.onclick = () => olayAc(o.id);
      g.appendChild(b);
    }
    const ey = el("div", "eylemler");
    ey.appendChild(eylem(h.telegram ? "Telegram’da aç ↗" : h.gnews ? "Kaynağa git (Google Haberler üzerinden) ↗" : "Kaynağa git ↗", h.url, "ana"));
    if (!h.gnews) {
      if (h.arsiv) ey.appendChild(eylem("Arşivlendi ✓", h.arsiv, "arsivli"));
      else ey.appendChild(eylem("Wayback’e kaydet", "https://web.archive.org/save/" + h.url));
      ey.appendChild(eylem("archive.today", "https://archive.ph/?run=1&url=" + encodeURIComponent(h.url)));
    }
    ey.appendChild(paylasDugme(h));
    g.appendChild(ey);
    kart.appendChild(g);
    kart.addEventListener("click", (e) => { if (!e.target.closest("a,button")) aktifEt(h.id, true); });
    let ust_ = null;
    kart.addEventListener("mouseenter", () => { clearTimeout(ust_); ust_ = setTimeout(() => aktifEt(h.id), 350); });
    kart.addEventListener("mouseleave", () => clearTimeout(ust_));
    return kart;
  }

  // ---------------------------------------------------- etkin kart ve harita takibi
  function aktifEt(id, zorla) {
    if (id === aktifId && !zorla) return;
    aktifId = id;
    document.querySelectorAll(".haber.aktif").forEach((x) => x.classList.remove("aktif"));
    const kart = document.querySelector('.haber[data-id="' + id + '"]'); if (kart) kart.classList.add("aktif");
    const h = haberler.find((x) => x.id === id); const k = h && kaynaklar[h.kaynak];
    if (k) { ucur(k.lat, k.lon); haritaCiz(suz()); }
  }

  let sonGozcu = null;
  function sonrakiYukle() {
    if (sonGozcu) sonGozcu.disconnect();
    const son = $("akis").querySelector(".nota-son");
    if (!son || !("IntersectionObserver" in window)) return;
    sonGozcu = new IntersectionObserver((g) => { if (g[0].isIntersecting) { kac += SAYFA; ciz(false, true); } }, { rootMargin: "600px" });
    sonGozcu.observe(son);
  }

  // Ekranın altında kalan kartlar, kaydırıp görünür olunca yumuşakça yukarı kayarak gelsin
  let belirtici = null;
  function belirt() {
    if (AZ_HAREKET || !("IntersectionObserver" in window)) return;
    if (belirtici) belirtici.disconnect();
    belirtici = new IntersectionObserver((g) => g.forEach((x) => {
      if (x.isIntersecting) { x.target.classList.add("gir"); x.target.classList.remove("bekle"); belirtici.unobserve(x.target); }
    }), { rootMargin: "0px 0px -40px 0px" });
    const alt = window.innerHeight;
    document.querySelectorAll("#akis .haber:not(.goruldu)").forEach((k) => {
      k.classList.add("goruldu");
      if (k.getBoundingClientRect().top > alt) { k.classList.add("bekle"); belirtici.observe(k); }
    });
  }

  function ciz(basaDon, devam) {
    document.querySelectorAll("#fBolge .cip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === bolge));
    const sc = $("fSehir"); sc.hidden = !sehir; if (sehir) sc.textContent = sehir + "  ✕";
    document.querySelectorAll("#fKonu .cip").forEach((b) => b.setAttribute("aria-pressed", b.dataset.k === (konu || "")));
    const liste = suz();
    const secOlay = olaySec && olayHarita[olaySec];
    if (olaySec && !secOlay) olaySec = null;
    gor = secOlay ? secOlay.haberler.map((i) => haberIdx[i]).filter((h) => h && kaynaklar[h.kaynak])
      : (sehir ? liste.filter((h) => kaynaklar[h.kaynak].sehir === sehir) : liste);
    const odak = odakId && haberIdx[odakId];
    if (odak && !secOlay) gor = [odak, ...gor.filter((h) => h.id !== odakId)];
    const akis = $("akis");
    const kaydir = window.scrollY;
    akis.innerHTML = "";
    gundemCiz(); seritCiz();
    if (secOlay) {
      const b = el("div", "olay-baslik");
      const ust = el("div", "olay-ust");
      ust.appendChild(el("span", "olay-sayi", secOlay.kaynak_sayisi + " kaynak · " + secOlay.haberler.length + " haber"));
      const kap = el("button", "kapat-olay", "Akışa dön ✕"); kap.type = "button"; kap.onclick = () => { olaySec = null; ciz(true); };
      ust.appendChild(kap); b.appendChild(ust);
      b.appendChild(el("h2", null, secOlay.baslik));
      if (secOlay.not) { const n = el("p", "cerceve"); n.appendChild(el("b", null, "Kaynaklar nasıl anlattı: ")); n.append(secOlay.not); b.appendChild(n); }
      b.appendChild(el("p", "olay-uyari", "Bu not, başlıklar karşılaştırılarak yapay zekâyla yazıldı. Haberlerin tamamı için kaynaklara git."));
      akis.appendChild(b);
    } else if (odakId && !odak) {
      const n = el("p", "bos"); n.append("Paylaşılan haber artık akışta değil (akış son iki günü gösteriyor). ");
      const a = el("a", null, "Arşivde ara"); a.href = "arsiv.html"; n.appendChild(a); akis.appendChild(n);
    }
    if (!haberler.length) akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek."));
    else if (!gor.length) akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
    gor.slice(0, kac).forEach((h, i) => {
      const k = haberCiz(h); if (i === 0 && !secOlay) k.classList.add("manset");
      if (h.id === odakId) { k.classList.add("odak"); k.insertBefore(el("span", "odak-etiket", "Paylaşılan haber"), k.firstChild); }
      if (bilinen && !bilinen.has(h.id)) k.classList.add("taze");
      akis.appendChild(k);
    });
    if (gor.length > kac) akis.appendChild(el("p", "nota nota-son", "Yükleniyor…"));
    else if (gor.length) {
      const n = el("p", "nota"); n.append("Hepsi bu kadar. Yayınların kim olduğunu ");
      const a = el("a", null, "Kaynaklar"); a.href = "kaynaklar.html"; n.appendChild(a); n.append(" sayfasında bulabilirsin."); akis.appendChild(n);
    }
    if (basaDon) { if (window.scrollY > 0) window.scrollTo({ top: 0 }); } else window.scrollTo({ top: kaydir });
    const s = $("sayilar"); s.innerHTML = "";
    s.appendChild(el("b", null, gor.length.toLocaleString("tr-TR"))); s.append(" haber · ");
    s.appendChild(el("b", null, gor.filter((h) => h.ozet_tr).length.toLocaleString("tr-TR"))); s.append(" Türkçe · ");
    s.appendChild(el("b", null, gor.filter((h) => dk(h.tarih) < 60).length.toLocaleString("tr-TR"))); s.append(" son saatte");
    $("canliMetin").textContent = guncellendi ? "Güncellendi · " + once(guncellendi) : "Canlı";
    if (aktifId && !gor.slice(0, kac).some((h) => h.id === aktifId)) aktifId = null;
    if (aktifId) { const k = document.querySelector('.haber[data-id="' + aktifId + '"]'); if (k) k.classList.add("aktif"); }
    haritaCiz(liste);
    sonrakiYukle(); belirt();
    if (basaDon && gor[0] && !devam) aktifEt(gor[0].id, true);
    const sk = $("fKonuSil"); sk.hidden = !konu; if (konu) sk.textContent = "#" + konu + "  ✕";
  }

  // ---------------------------------------------------- veri
  let ilk = true;
  async function yukle() {
    const t = Date.now();
    try {
      const [k, h, o] = await Promise.all([
        fetch("kaynaklar.json?t=" + t).then((r) => r.json()),
        fetch("data/haberler.json?t=" + t).then((r) => r.json()),
        fetch("data/olaylar.json?t=" + t).then((r) => r.json()).catch(() => ({ olaylar: [] })),
      ]);
      olaylar = o.olaylar || []; olayHarita = {}; olaylar.forEach((x) => (olayHarita[x.id] = x));
      kaynaklar = {}; k.forEach((x) => (kaynaklar[x.id] = x));
      haberler = (h.haberler || []).slice().sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
      guncellendi = h.guncellendi;
      haberIdx = {}; haberler.forEach((x) => (haberIdx[x.id] = x));
      hashOku();
      ciz(ilk); ilk = false;
      bilinen = new Set(haberler.map((x) => x.id));
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
  [["", "Tüm konular"], ...KONULAR.map((k) => [k, k])].forEach(([k, l]) => {
    const c = el("button", "cip", l); c.type = "button"; c.dataset.k = k;
    c.onclick = () => { konu = k || null; kac = SAYFA; ciz(true); };
    $("fKonu").appendChild(c);
  });
  $("fKonuSil").onclick = () => { konu = null; ciz(true); };
  function hashOku() { const m = /^#h-([0-9a-f]+)$/.exec(location.hash); odakId = m ? m[1] : null; }
  window.addEventListener("hashchange", () => { hashOku(); olaySec = null; ciz(true); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".paylas")) document.querySelectorAll(".paylas-menu").forEach((m) => (m.hidden = true)); });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  $("fIlgili").onchange = $("fOzet").onchange = () => { kac = SAYFA; ciz(true); };
  const bul = $("fBulanik");
  bul.checked = oku("zbs-bulanik") === "1";
  document.body.classList.toggle("bulanik", bul.checked);
  bul.onchange = () => { document.body.classList.toggle("bulanik", bul.checked); sakla("zbs-bulanik", bul.checked ? "1" : "0"); };
  let bekle;
  $("fAra").addEventListener("input", (e) => { clearTimeout(bekle); bekle = setTimeout(() => { ara = e.target.value.trim().toLocaleLowerCase("tr"); kac = SAYFA; ciz(true); }, 180); });
  $("fSehir").onclick = () => { sehir = null; ciz(true); };
  $("haritaAc").onclick = () => { document.body.classList.add("harita-acik"); setTimeout(() => harita && harita.invalidateSize(), 350); };
  $("haritaKapat").onclick = () => document.body.classList.remove("harita-acik");
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input,textarea")) return;
    const i = gor.findIndex((h) => h.id === aktifId);
    const git = (j) => { const h = gor[j]; if (!h) return; const k = document.querySelector('.haber[data-id="' + h.id + '"]'); if (k) { k.scrollIntoView({ behavior: AZ_HAREKET ? "auto" : "smooth", block: "center" }); aktifEt(h.id); } };
    if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); git(i + 1); }
    if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); git(Math.max(0, i - 1)); }
  });

  yukle();
  setInterval(yukle, 5 * 60 * 1000);
  setInterval(() => { if (guncellendi) $("canliMetin").textContent = "Güncellendi · " + once(guncellendi); }, 60 * 1000);
})();
