// Sayfa kodu: haber akışı tek sütunda; bölge haritası akışın içinde (6. haberden sonra) ayrı bir bölüm.
// Bir kartın üzerine gelince arkadaki haritada o haberin şehri parlar. Veri 5 dakikada bir yenilenir.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran", "Yemen", "Mağrip", "Anadolu-Türkiye", "İsrail", "İsrail’de muhalif basın", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "özel" };
  // Kartlarda yalnızca okura bir şey söyleyen sahiplik bilgisi gösterilir; ayrıntısı Kaynaklar sayfasında
  const ROZETLI = { resmi: "devlet", grup: "bağlı" };
  // rozet: okurun anlayacağı açıklama ("Hizbullah’ın yayın organı", "İran devletinin yayını")
  const rozetMetni = (k) => k.bagli ? k.bagli : k.tur === "resmi" ? (window.DIL === "en" ? "state media" : (k.ulke ? k.ulke + " devletinin yayını" : "devlet yayını")) : ROZETLI[k.tur];
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const DUNYA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const SAYFA = 30;
  const BAYRAK = '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>';
  // Dil: içerik alanları seçilen dilden okunur; arayüz metinlerini site/dil.js çevirir
  const DL = window.DIL || "tr", YR = window.YEREL || "tr-TR";
  const BT = (h) => (DL === "tr" ? h.baslik_tr : h["baslik_" + DL]);
  const OZ = (h) => (DL === "tr" ? h.ozet_tr : h["ozet_" + DL]);
  const OB = (o) => (DL !== "tr" && o["baslik_" + DL]) || o.baslik;
  const ON = (o) => (DL !== "tr" && o["not_" + DL]) || o.not;
  const OY = (o, id) => (DL !== "tr" && (o["yorumlar_" + DL] || {})[id]) || (o.yorumlar || {})[id];
  const MARKA_AD = (window.MARKA && window.MARKA.ad) || "ZBS";
  const BAYRAK_AE = '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="BAE yayını"><title>BAE yayını</title><rect width="22" height="16" rx="1.5" fill="#fff"/><path d="M6 0h14.5A1.5 1.5 0 0 1 22 1.5v3.8H6z" fill="#00732f"/><path d="M6 10.7h16v3.8a1.5 1.5 0 0 1-1.5 1.5H6z" fill="#000"/><path d="M1.5 0H6v16H1.5A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0z" fill="#c8102e"/><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="none" stroke="#c9d1cc" stroke-width=".5"/></svg>';
  // Uyarı bayrağı: İsrail merkezli yayınlar (muhalif basın hariç) ve kaynaklar.json'da bayrak alanı olanlar
  const bayrakHTML = (k) => k.bayrak === "ae" ? BAYRAK_AE : (k.bolge === "İsrail" && !k.bayraksiz ? BAYRAK : "");
  const AZ_HAREKET = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const KONULAR = ["Gazze", "Batı Şeria", "Kudüs", "Lübnan", "Suriye", "Yemen ve Kızıldeniz", "İran", "Irak", "Mısır", "Ürdün", "Mağrip", "Türkiye", "Körfez", "Göç", "Diplomasi ve müzakere", "İnsani durum", "Esirler ve tutuklular", "Uluslararası hukuk", "Protesto ve dayanışma", "Ekonomi ve boykot", "İsrail iç siyaseti", "Avrupa", "ABD"];
  let logolar = {};
  let kaynaklar = {}, haberler = [], guncellendi = null, gor = [], olaylar = [], olayHarita = {};
  let konu = null, olaySec = null, odakId = null;
  let bilinen = null; // önceki yüklemede görülen haber kimlikleri
  let haberIdx = {};
  let dogrulama = {};   // elle onaylı doğrulama etiketleri: {haberId: {tur, aciklama, kanit[]}}
  const DOG_AD = { yanlis: "❌ Yanlış çıktı", celiskili: "⚠️ Çelişkili iddia", dogrulanmamis: "🔍 Doğrulanmamış" };
  let sadeceAnaliz = false;
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
  // Yayın simgesi: toplayıcının bulduğu logo, olmazsa DuckDuckGo simge servisi, o da yoksa baş harfler
  function avatar(k, ek) {
    const a = el("div", "avatar " + k.tur + (ek ? " " + ek : ""), bas(k.ad));
    const host = (() => { try { return new URL(k.url).hostname; } catch (e) { return ""; } })();
    const ddg = host && "https://icons.duckduckgo.com/ip3/" + host + ".ico";
    const AK = window.AKTAR || ((u) => u);
    // Önce aktarıcıdan; İsrail merkezli yayınlarda kaynağın kendi sunucusuna hiç gidilmez
    const kaynaklarim = [(logolar[k.id] || {}).url && AK((logolar[k.id] || {}).url, 96), ddg && AK(ddg, 96), k.bolge !== "İsrail" && ddg].filter(Boolean);
    if (kaynaklarim.length) {
      const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.decoding = "async";
      let i = 0; img.src = kaynaklarim[0];
      img.onerror = () => { i++; if (i < kaynaklarim.length) img.src = kaynaklarim[i]; else img.remove(); };
      img.onload = () => { if (img.naturalWidth < 8) img.onerror(); else a.classList.add("logolu"); };
      a.appendChild(img);
    }
    return a;
  }
  function bas(ad) {
    const k = ad.replace(/^(The|Al|El|La|Le|Il|L’|Der|Die)[\s-]+/i, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
    return ((k[0] || "")[0] + ((k[1] || "")[0] || (k[0] || "")[1] || "")).toUpperCase();
  }

  // ---------------------------------------------------- arka plan haritası
  // Leaflet yok: bölgeyi eşdikdörtgen izdüşümle tek bir SVG'ye çizeriz. Harita sayfanın arkasında sabit durur;
  // haber gelen şehirler nokta olur, son bir saatte haber gelenler nabız gibi atar, üzerine gelinen kartın şehri parlar.
  const ZB = { bat: -24, dogu: 76, kuzey: 62, guney: 2, olcek: 10 };
  const zx = (lon) => (lon - ZB.bat) * ZB.olcek, zy = (lat) => (ZB.kuzey - lat) * ZB.olcek;
  const SABIT_ZEMIN = matchMedia("(max-width:820px),(hover:none)").matches;
  const zemin = $("zemin"), SVGNS = "http://www.w3.org/2000/svg";
  const HARITA_BOLUM = $("haritaBolum"), HARITA_SIRA = 6;   // harita bölümü akışta 6. haberden sonra durur
  const zEl = (t, at) => { const e = document.createElementNS(SVGNS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  let zNoktalar = null;
  if (zemin) {
    // Bölüm haritası: Mağrip'ten Pakistan'a, Yemen'den Anadolu'ya
    zemin.setAttribute("viewBox", zx(-12) + " " + zy(45) + " " + (zx(70) - zx(-12)) + " " + (zy(10) - zy(45)));
    zemin.addEventListener("click", (e) => {
      const g = e.target.closest(".z-sehir"); if (!g) return;
      sehir = sehir === g.dataset.ad ? null : g.dataset.ad; kac = SAYFA; ciz(true);
      const sz = document.querySelector(".suzgec"); if (sz && sehir) sz.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const kara = zEl("g", { class: "z-kara" }); zNoktalar = zEl("g", { class: "z-noktalar" });
    zemin.append(kara, zNoktalar);
    fetch(DUNYA).then((r) => r.json()).then((topo) => {
      const halka = (h) => {
        let xs = h.map((p) => p[0]);
        if (Math.max(...xs) < ZB.bat - 5 || Math.min(...xs) > ZB.dogu + 5) return "";
        const ys = h.map((p) => p[1]);
        if (Math.max(...ys) < ZB.guney - 5 || Math.min(...ys) > ZB.kuzey + 5) return "";
        return "M" + h.map((p) => zx(p[0]).toFixed(1) + "," + zy(p[1]).toFixed(1)).join("L") + "Z";
      };
      let d = "";
      topojson.feature(topo, topo.objects.countries).features.forEach((f) => {
        const g = f.geometry; if (!g) return;
        const poli = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        poli.forEach((p) => p.forEach((h) => (d += halka(h))));
      });
      kara.appendChild(zEl("path", { d }));
    }).catch(() => {});
  }

  function haritaCiz(liste) {
    const sayac = {};
    liste.forEach((h) => {
      const k = kaynaklar[h.kaynak]; if (!k || k.lat == null) return;
      const s = (sayac[k.sehir] = sayac[k.sehir] || { lat: k.lat, lon: k.lon, n: 0, taze: 0 });
      s.n++; if (dk(h.tarih) < 60) s.taze++;
    });
    const sirali = Object.entries(sayac).sort((a, b) => b[1].n - a[1].n);
    // Şehir seçici
    const sec = $("fSehirSec");
    if (sec) {
      sec.innerHTML = ""; sec.appendChild(new Option("Tüm şehirler", ""));
      const adlar = sirali.map(([ad]) => ad);
      if (sehir && !adlar.includes(sehir)) adlar.unshift(sehir);
      adlar.forEach((ad) => sec.appendChild(new Option(ad + (sayac[ad] ? " · " + sayac[ad].n : ""), ad)));
      sec.value = sehir || "";
    }
    if (!zNoktalar) return;
    zNoktalar.innerHTML = "";
    // Sessizlik halkaları: bölge basınının yazdığı ama İsrail ve Batı basınının hiç yazmadığı güncel olayların yerleri
    const DIS_K = new Set(["İsrail", "Batı"]);
    olaylar.forEach((o) => {
      const y = o.yer; if (!y || y.lon < ZB.bat || y.lon > ZB.dogu || y.lat < ZB.guney || y.lat > ZB.kuzey) return;
      const ks = o.haberler.map((i) => haberIdx[i] && kaynaklar[haberIdx[i].kaynak]).filter(Boolean);
      if (ks.length < 3 || ks.some((k) => DIS_K.has(kampAd(k)))) return;
      const g = zEl("g", { class: "z-sessiz" });
      g.appendChild(zEl("circle", { cx: zx(y.lon), cy: zy(y.lat), r: 14 }));
      g.appendChild(zEl("circle", { class: "z-sessiz-ic", cx: zx(y.lon), cy: zy(y.lat), r: 4 }));
      zNoktalar.appendChild(g);
    });
    // Telefonda zemin sabit: kaydırırken kartın şehri parlamaz, yalnızca seçilen şehir vurgulanır
    const aktif = !SABIT_ZEMIN && aktifId && haberIdx[aktifId];
    const aktifSehir = aktif && kaynaklar[aktif.kaynak] ? kaynaklar[aktif.kaynak].sehir : null;
    const etiketler = [];
    sirali.slice().reverse().forEach(([ad, s]) => {
      if (s.lon < ZB.bat || s.lon > ZB.dogu || s.lat < ZB.guney || s.lat > ZB.kuzey) return;
      const x = zx(s.lon), y = zy(s.lat), r = 3 + Math.sqrt(s.n) * 1.3;
      const vurgu = ad === sehir || ad === aktifSehir, buyuk = sirali.findIndex(([a]) => a === ad) < 12;
      const g = zEl("g", { class: "z-sehir" + (vurgu ? " vurgu" : "") + (s.taze ? " taze" : "") + (buyuk ? " buyuk" : ""), "data-ad": ad });
      const ti = zEl("title", {}); ti.textContent = ad + " · " + s.n + (window.DIL === "en" ? " stories" : " haber"); g.appendChild(ti);
      if (s.taze) g.appendChild(zEl("circle", { class: "z-nabiz", cx: x, cy: y, r: r }));
      g.appendChild(zEl("circle", { class: "z-nokta", cx: x, cy: y, r: r }));
      g.appendChild(zEl("circle", { class: "z-alan", cx: x, cy: y, r: Math.max(r, 7) }));
      if (vurgu || buyuk) etiketler.push({ ad, x, y, r, vurgu, n: s.n, g });
      zNoktalar.appendChild(g);
    });
    // Şehir adları çakışmasın: önce seçili, sonra en çok haber gelen; çakışan ad yazılmaz (noktanın üstüne gelince görünür)
    const kutular = [];
    etiketler.sort((a, b) => (b.vurgu - a.vurgu) || (b.n - a.n)).forEach((e) => {
      const w = e.ad.length * (e.vurgu ? 8.5 : 7) + 4, h = e.vurgu ? 17 : 14;
      for (const [dx, yon] of [[e.r + 5, "start"], [-(e.r + 5), "end"]]) {
        const x0 = yon === "start" ? e.x + dx : e.x + dx - w, k = { x0, x1: x0 + w, y0: e.y - h / 2 - 2, y1: e.y + h / 2 };
        if (kutular.some((b) => k.x0 < b.x1 && k.x1 > b.x0 && k.y0 < b.y1 && k.y1 > b.y0)) continue;
        kutular.push(k);
        const t = zEl("text", { x: e.x + dx, y: e.y + 4, "text-anchor": yon }); t.textContent = e.ad; e.g.appendChild(t);
        break;
      }
    });
  }

  // ---------------------------------------------------- kartlar
  function suz() {
    const ilgili = $("fIlgili").checked, ozetli = $("fOzet").checked;
    return haberler.filter((h) => {
      const k = kaynaklar[h.kaynak]; if (!k || h.atla) return false;
      if (bolge !== "Tümü" && (k.kamp || k.bolge) !== bolge) return false;
      if (ilgili && !h.ilgili) return false;
      if (ozetli && !OZ(h)) return false;
      if (sadeceAnaliz && h.nitelik !== "analiz") return false;
      if (konu && !(h.etiket || []).includes(konu)) return false;
      if (ara) {
        const m = [h.baslik_tr, h.ozet_tr, BT(h), OZ(h), h.baslik_orj, k.ad, k.sehir, k.ulke].join(" ").toLocaleLowerCase("tr");
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
    const kutu = el("div", "gorsel" + (k.hassas ? " hassas" : ""));
    if (h.gorsel) {
      const img = document.createElement("img");
      img.loading = "lazy"; img.decoding = "async"; img.alt = ""; img.referrerPolicy = "no-referrer";
      img.src = (window.AKTAR || ((u) => u))(h.gorsel, 900);
      // Aktarıcı getiremezse: İsrail merkezli yayınlarda yer tutucu, diğerlerinde doğrudan kaynaktan bir kez dene
      let dogrudan = false;
      img.onerror = () => { if (!dogrudan && k.bolge !== "İsrail" && img.src !== h.gorsel) { dogrudan = true; img.src = h.gorsel; } else yerTutucu(kutu, k); };
      kutu.appendChild(img);
      kutu.appendChild(el("span", "kredi", "Görsel: " + k.ad));
      const ac = el("button", "ac", k.hassas ? "Sahadan görsel; ağır olabilir. Göstermek için dokun" : "Görseli göstermek için dokun"); ac.type = "button";
      ac.onclick = () => kutu.classList.add("acik");
      kutu.appendChild(ac);
    } else {
      yerTutucu(kutu, k);
    }
    return kutu;
  }

  // Her haberin kendi sayfası (h/<id>.html): paylaşıldığında önizlemede başlık, özet ve yayın adı görünür
  function kalici(id) { return location.origin + location.pathname.replace(/[^/]*$/, "") + "h/" + id + ".html"; }
  function paylasDugme(h) {
    const kutu = el("span", "paylas");
    const b = el("button", "eylem", "Paylaş"); b.type = "button"; b.setAttribute("aria-expanded", "false");
    const menu = el("span", "paylas-menu"); menu.hidden = true;
    const url = kalici(h.id), metin = (BT(h) || h.baslik_orj) + " · " + kaynaklar[h.kaynak].ad;
    const bag = (l, u) => { const a = el("a", null, l); a.href = u; a.target = "_blank"; a.rel = "noopener"; menu.appendChild(a); };
    const kop = el("button", null, "Bağlantıyı kopyala"); kop.type = "button";
    kop.onclick = async () => { try { await navigator.clipboard.writeText(url); kop.textContent = "Kopyalandı"; } catch (e) { prompt("Bağlantı", url); } setTimeout(() => (kop.textContent = "Bağlantıyı kopyala"), 2000); };
    menu.appendChild(kop);
    bag("WhatsApp", "https://wa.me/?text=" + encodeURIComponent(metin + " " + url));
    bag("Telegram", "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent(metin));
    bag("X", "https://x.com/intent/post?text=" + encodeURIComponent(metin) + "&url=" + encodeURIComponent(url));
    b.onclick = async (e) => {
      e.stopPropagation();
      if (navigator.share && tel()) { try { await navigator.share({ title: metin, text: OZ(h) || "", url }); } catch (x) {} return; }
      menu.hidden = !menu.hidden; b.setAttribute("aria-expanded", String(!menu.hidden));
    };
    kutu.append(b, menu);
    return kutu;
  }

  // Olay sayfası ve paylaşılan haber görünümü adres çubuğuna (#o-…, #h-…) yazılır: tarayıcının geri tuşu akışa döner
  let icGezinti = false;
  function olayAc(id) {
    const o = olayHarita[id];
    if (!o || !o.haberler || !o.haberler[0]) { olaySec = id; ciz(true); return; }
    const icGit = () => { icGezinti = true; location.hash = "#o-" + o.haberler[0]; };
    // Olayın haber sayfası (siyah girişli, paylaşılabilir) hazırsa oraya git; henüz üretilmediyse sitedeki görünümü aç
    const adaylar = o.haberler.slice(0, 4);
    (async () => {
      for (const i of adaylar) {
        try { const r = await fetch("h/" + i + ".html", { method: "HEAD" }); if (r.ok) { location.href = "h/" + i + ".html"; return; } } catch (e) {}
      }
      icGit();
    })();
  }
  function akisaDon() {
    if (icGezinti && history.length > 1) { icGezinti = false; history.back(); return; }
    history.replaceState(null, "", location.pathname + location.search);
    olaySec = null; odakId = null; kac = SAYFA; ciz(true);
  }
  // Paylaşılan bir bağlantıyla dışarıdan gelindiyse (#h-…, #o-…) geçmişe önce ana sayfa yazılır: geri tuşu siteden çıkmaz, akışa döner
  if (/^#[ho]-/.test(location.hash) && !(document.referrer && new URL(document.referrer).origin === location.origin)) {
    const h0 = location.hash;
    history.replaceState(null, "", location.pathname + location.search);
    history.pushState(null, "", location.pathname + location.search + h0);
  }

  // ---------------------------------------------------- kapsama analizi (Ground News benzeri)
  const KAMP = { "Filistin": "Filistin", "Meşrik": "Arap dünyası", "Körfez": "Arap dünyası", "Mısır": "Arap dünyası", "Mağrip": "Arap dünyası",
    "İran": "İran", "Yemen": "Yemen", "Anadolu-Türkiye": "Türkiye", "İsrail": "İsrail", "ABD": "Batı", "İngiltere": "Batı",
    "İspanya": "Batı", "İtalya": "Batı", "Almanya": "Batı", "Fransa": "Batı", "Asya ve diğer": "Diğer" };
  const KAMP_RENK = { "Filistin": "#2b8a5e", "Arap dünyası": "#8cc2a8", "İran": "#c39a35", "Yemen": "#8f6a2a", "Türkiye": "#c9544e", "İsrail": "#4a72c4", "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#9aa3ab", "Diğer": "#6b746f" };
  const TUR_GRUP = { resmi: "Devlet", grup: "Bağlı", bagimsiz: "Bağımsız", koop: "Bağımsız", ozel: "Özel", izle: "Özel" };
  const TUR_RENK = { "Devlet": "#c9544e", "Bağlı": "#8c8f8d", "Bağımsız": "#2b8a5e", "Özel": "#6d89a3" };
  const kampAd = (k) => k.kamp || KAMP[k.bolge] || "Diğer";
  const CIZGI = { ad: "Antiemperyalist / dekolonyal", ara: "Ara / ana akım", ik: "İşbirlikçi kompradorlar ve emperyalistler" };
  const CIZGI_RENK = { "Antiemperyalist / dekolonyal": "#2b8a5e", "Ara / ana akım": "#9aa3ab", "İşbirlikçi kompradorlar ve emperyalistler": "#c9544e" };
  const cizgiAd = (k) => CIZGI[k.cizgi] || CIZGI.ara;
  const BAKIS = { filistin: "Filistin bakışı", aktarim: "Aktarım", israil: "İsrail / ABD bakışı" };
  const BAKIS_RENK = { filistin: "#2b8a5e", aktarim: "#a7aeb3", israil: "#4a72c4" };
  const KAMP_SIRA = ["Filistin", "Arap dünyası", "Türkiye", "İran", "Yemen", "Batı", "İsrail", "İsrail’de muhalif basın", "Diğer"];

  // Bölge gruplarına göre bakış: her haber bir kare (sayı görünür kalsın), satırın sağında
  // grubun Filistin bakışından ortalama uzaklığı (0 = başlangıç noktası, 2 = İsrail / ABD bakışı).
  const UZAK = { filistin: 0, aktarim: 1, israil: 2 };
  function uzaklikMetni(u) {
    const t = u.toLocaleString(YR, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return t + (u < 0.5 ? " · başlangıçta" : u < 1.5 ? " · bir adım uzak" : " · en uzak");
  }
  function bakisMatrisi(o, kisa) {
    const b = o.bakislar || {};
    if (!Object.keys(b).length) return null;
    const satir = {};
    o.haberler.forEach((i) => {
      const h = haberIdx[i], k = h && kaynaklar[h.kaynak], v = b[i];
      if (!k || !v) return;
      const g = kampAd(k); satir[g] = satir[g] || { filistin: [], aktarim: [], israil: [], n: 0 };
      satir[g][v].push(k.ad + ": " + (h.baslik_orj || BT(h) || "")); satir[g].n++;
    });
    let gruplar = KAMP_SIRA.filter((g) => satir[g]);
    if (!gruplar.length) return null;
    if (kisa) gruplar = gruplar.sort((x, y) => satir[y].n - satir[x].n).slice(0, 4).sort((x, y) => KAMP_SIRA.indexOf(x) - KAMP_SIRA.indexOf(y));
    const kutu = el("div", "matris" + (kisa ? " kisa" : ""));
    if (!kisa) {
      const bas = el("div", "matris-bas");
      bas.appendChild(el("span", "dagilim-ad", "Denge: kim, kimin gözünden anlattı"));
      bas.appendChild(el("span", "matris-bas-sag", "Filistin bakışından uzaklık (0–2)"));
      kutu.appendChild(bas);
    }
    gruplar.forEach((g) => {
      const r = satir[g], sat = el("div", "matris-satir");
      const ad = el("span", "matris-ad"); const nk = el("i"); nk.style.background = KAMP_RENK[g]; ad.appendChild(nk); ad.append(g);
      ad.appendChild(el("small", null, r.n + " haber")); sat.appendChild(ad);
      const kare = el("div", "kareler"); kare.setAttribute("role", "img");
      kare.setAttribute("aria-label", g + ": " + ["filistin", "aktarim", "israil"].filter((v) => r[v].length).map((v) => r[v].length + " " + BAKIS[v]).join(", "));
      ["filistin", "aktarim", "israil"].forEach((v) => r[v].forEach((t) => { const i = el("i"); i.style.background = BAKIS_RENK[v]; i.title = BAKIS[v] + " · " + t; kare.appendChild(i); }));
      sat.appendChild(kare);
      const u = (r.aktarim.length + 2 * r.israil.length) / r.n;
      const um = el("span", "uzaklik"); um.style.color = u < 0.5 ? BAKIS_RENK.filistin : u < 1.5 ? "" : BAKIS_RENK.israil;
      um.textContent = kisa ? u.toLocaleString(YR, { maximumFractionDigits: 1 }) : uzaklikMetni(u);
      um.title = "Filistin bakışından ortalama uzaklık: 0 başlangıç noktası, 1 aktarım, 2 İsrail / ABD bakışı";
      sat.appendChild(um); kutu.appendChild(sat);
    });
    const ef = el("div", "dagilim-efsane");
    Object.entries(BAKIS).forEach(([v, l]) => { const x = el("span"); const nk = el("i"); nk.style.background = BAKIS_RENK[v]; x.appendChild(nk); x.append(UZAK[v] + " · " + l); ef.appendChild(x); });
    if (!kisa) ef.appendChild(el("span", "ef-not", "Her kare bir haber; üzerine gelince yayını ve başlığı görürsün."));
    kutu.appendChild(ef);
    if (!kisa) {
      const n = el("p", "olay-uyari"); n.append("Ölçeğin başlangıç noktası Filistin bakışıdır; aktarım bir adım, İsrail / ABD bakışı en uzak basamaktır. ");
      const a = el("a", null, "Bakış ölçeği nasıl işliyor"); a.href = "hakkimizda.html#bakis"; n.appendChild(a); kutu.appendChild(n);
    }
    return kutu;
  }

  function kapsamaK(ids) {
    const kamp = {}, tur = {}, cizgi = {}; let n = 0;
    ids.forEach((id) => { const k = kaynaklar[id]; if (!k) return; n++; const a = kampAd(k); kamp[a] = (kamp[a] || 0) + 1; const t = TUR_GRUP[k.tur] || "Özel"; tur[t] = (tur[t] || 0) + 1; const c = cizgiAd(k); cizgi[c] = (cizgi[c] || 0) + 1; });
    return { kamp, tur, cizgi, toplam: n };
  }
  let gundemArsiv = null;
  fetch("data/gundem.json?t=" + Math.floor(Date.now() / 3e5)).then((r) => r.json()).then((d) => { gundemArsiv = d.olaylar || []; if (Object.keys(kaynaklar).length && olaylar.length + gundemArsiv.length) gundemCiz(); }).catch(() => {});
  function kapsama(o) {
    const ks = new Map();
    o.haberler.forEach((i) => { const h = haberIdx[i]; const k = h && kaynaklar[h.kaynak]; if (k && !ks.has(k.id)) ks.set(k.id, k); });
    const kamp = {}, tur = {}, cizgi = {};
    ks.forEach((k) => { const a = kampAd(k); kamp[a] = (kamp[a] || 0) + 1; const t = TUR_GRUP[k.tur] || "Özel"; tur[t] = (tur[t] || 0) + 1; const c = cizgiAd(k); cizgi[c] = (cizgi[c] || 0) + 1; });
    return { kamp, tur, cizgi, toplam: ks.size };
  }

  function korNokta(kp) {
    if (kp.toplam < 3) return null;
    const ad = kp.cizgi[CIZGI.ad] || 0, ik = kp.cizgi[CIZGI.ik] || 0;
    if (ik / kp.toplam >= 0.6) return "Kör nokta: bu olayı ağırlıkla işbirlikçi ve emperyalist çizgideki yayınlar yazdı (%" + Math.round((100 * ik) / kp.toplam) + ").";
    if (ad / kp.toplam >= 0.6) return "Kör nokta: bu olayı ağırlıkla antiemperyalist çizgideki yayınlar yazdı; ana akım ve işbirlikçi çizgideki yayınlar az yazdı (%" + Math.round((100 * ad) / kp.toplam) + ").";
    const en = Object.entries(kp.kamp).sort((a, b) => b[1] - a[1])[0];
    const arap = (kp.kamp["Filistin"] || 0) + (kp.kamp["Arap dünyası"] || 0);
    const bati = (kp.kamp["Batı"] || 0) + (kp.kamp["İsrail"] || 0);
    if (en && en[1] / kp.toplam >= 0.7) return "Kör nokta: kaynakların %" + Math.round((100 * en[1]) / kp.toplam) + "’i " + en[0] + " basınından.";
    if (!arap && bati) return "Kör nokta: Filistin ve Arap basını bu olayı yazmadı.";
    if (!bati && arap) return "Kör nokta: Batı ve İsrail basını bu olayı yazmadı.";
    return null;
  }

  function cubuk(dagilim, renkler, toplam, baslik) {
    const kutu = el("div", "dagilim");
    if (baslik) kutu.appendChild(el("span", "dagilim-ad", baslik));
    const bar = el("div", "dagilim-cubuk"); bar.setAttribute("role", "img");
    const sirali = Object.entries(dagilim).sort((a, b) => b[1] - a[1]);
    bar.setAttribute("aria-label", sirali.map(([a, n]) => a + " " + n).join(", "));
    sirali.forEach(([a, n]) => { const i = el("i"); i.style.width = (100 * n) / toplam + "%"; i.style.background = renkler[a] || "#777"; i.title = a + ": " + n + " kaynak"; bar.appendChild(i); });
    kutu.appendChild(bar);
    const ef = el("div", "dagilim-efsane");
    sirali.forEach(([a, n]) => { const x = el("span"); const nk = el("i"); nk.style.background = renkler[a] || "#777"; x.appendChild(nk); x.append(a + " " + Math.round((100 * n) / toplam) + "%"); ef.appendChild(x); });
    kutu.appendChild(ef);
    return kutu;
  }

  // ---------------------------------------------------- manşet slaytları
  let slaytZaman = null, slaytNo = 0;
  function gundemCiz() {
    const kutu = $("gundem"); kutu.innerHTML = "";
    clearInterval(slaytZaman);
    // canlı olaylar önce, sonra son 30 günün arşivinden en yeni karşılaştırmalar: toplam en son 20
    const liste = olaylar.filter((o) => o.haberler.filter((i) => haberIdx[i]).length >= 2);
    const gorulen = new Set(liste.flatMap((o) => o.haberler));
    (gundemArsiv || []).forEach((a) => { if (liste.length < 20 && !liste.some((o) => o.id === a.id) && !a.haberler.some((i) => gorulen.has(i))) { liste.push(Object.assign({ arsiv: true }, a)); a.haberler.forEach((i) => gorulen.add(i)); } });
    liste.splice(20);
    kutu.hidden = !liste.length || !!olaySec;
    if (!liste.length || olaySec) return;
    const ust = el("div", "slayt-ust");
    const bh = el("h2", "bolum", "Gündem"); bh.appendChild(el("span", "bolum-ek", " · birden fazla kaynağın yazdığı olaylar")); ust.appendChild(bh);
    kutu.appendChild(ust);
    const cerceve = el("div", "slayt-cerceve");
    const iz = el("div", "slaytlar"); iz.setAttribute("aria-roledescription", "slayt gösterisi");
    const OK = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + (d < 0 ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7") + '"/></svg>';
    const geri = el("button", "slayt-ok geri"), ileri = el("button", "slayt-ok ileri");
    geri.type = ileri.type = "button"; geri.innerHTML = OK(-1); ileri.innerHTML = OK(1);
    geri.setAttribute("aria-label", "Önceki olay"); ileri.setAttribute("aria-label", "Sonraki olay");
    liste.forEach((o, n) => {
      const kp = o.arsiv ? kapsamaK(o.kaynaklar) : kapsama(o);
      const sl = el("article", "slayt"); sl.setAttribute("aria-label", (n + 1) + " / " + liste.length);
      // denetlenmiş görsel (gorsel_denetim.py): yazı grafikleri atlanır, odak noktası kafaları kesmemek için
      const gd = o.arsiv ? o : (gundemArsiv || []).find((a) => a.id === o.id);
      const gh = gd && "adaylar" in gd ? (gd.gorsel && gd.gorsel_atif ? { gorsel: gd.gorsel, atif: gd.gorsel_atif, sayfa: gd.gorsel_sayfa, odak: gd.odak } : null)
        : o.arsiv ? (o.gorsel && kaynaklar[o.gorsel_kaynak] ? { gorsel: o.gorsel, kaynak: o.gorsel_kaynak } : null)
        : o.haberler.map((i) => haberIdx[i]).find((h) => h && h.gorsel && !h.gnews && !(kaynaklar[h.kaynak] || {}).hassas);
      const arka = el("div", "slayt-arka");
      if (gh) { const img = document.createElement("img"); img.src = (window.AKTAR || ((u) => u))(gh.gorsel, 1400); img.alt = ""; img.loading = n ? "lazy" : "eager"; img.referrerPolicy = "no-referrer"; img.style.objectPosition = gh.odak || "50% 25%"; img.onerror = () => img.remove(); arka.appendChild(img);
        if (gh.atif) { const kr = el("a", "kredi", (window.DIL === "en" ? "Photo: " : "Fotoğraf: ") + gh.atif); if (gh.sayfa) { kr.href = gh.sayfa; kr.target = "_blank"; kr.rel = "noopener"; } arka.appendChild(kr); }
        else arka.appendChild(el("span", "kredi", "Görsel: " + kaynaklar[gh.kaynak].ad)); }
      sl.appendChild(arka);
      const ic = el("div", "slayt-ic");
      ic.appendChild(el("span", "slayt-sayi", (n + 1) + " / " + liste.length + " · " + kp.toplam + " kaynak · son " + once(o.son)));
      ic.appendChild(el("h3", null, OB(o)));
      if (ON(o)) ic.appendChild(el("p", null, ON(o).length > 220 ? ON(o).slice(0, 217) + "…" : ON(o)));
      // Sade özet: kaç bölge yayını, kaç İsrail/Batı yayını yazdı (ayrıntılar haber sayfasında)
      const kk = kp.kamp || {}, en = window.DIL === "en";
      const bolgeN = ["Filistin", "Arap dünyası", "İran", "Yemen", "Türkiye"].reduce((t, x) => t + (kk[x] || 0), 0);
      const disN = ["İsrail", "Batı"].reduce((t, x) => t + (kk[x] || 0), 0);
      const sat = el("p", "slayt-kim");
      sat.appendChild(el("b", null, (en ? "Regional press " : "Bölge basını ") + bolgeN));
      sat.appendChild(document.createTextNode(" · "));
      sat.appendChild(el("b", null, (en ? "Israeli & Western press " : "İsrail ve Batı basını ") + disN));
      if (!disN && bolgeN >= 3) sat.appendChild(el("span", "slayt-sessiz", en ? "Israeli and Western outlets did not report it" : "İsrail ve Batı basını yazmadı"));
      ic.appendChild(sat);
      let b;
      if (o.arsiv) { b = el("a", "slayt-dugme", "Kim nasıl yazdı →"); b.href = o.sayfa; }
      else { b = el("button", "slayt-dugme", "Kim nasıl yazdı →"); b.type = "button"; b.onclick = () => olayAc(o.id); }
      ic.appendChild(b);
      sl.appendChild(ic);
      iz.appendChild(sl);
    });
    cerceve.append(iz, geri, ileri);
    kutu.appendChild(cerceve);
    const noktalar = el("div", "slayt-noktalar"); noktalar.setAttribute("role", "tablist");
    liste.forEach((o, n) => {
      const d = el("button"); d.type = "button"; d.setAttribute("role", "tab");
      d.setAttribute("aria-label", (n + 1) + ". olay: " + OB(o)); d.title = OB(o);
      d.appendChild(el("span", "nokta-ic"));
      d.addEventListener("click", () => git(n, true));
      noktalar.appendChild(d);
    });
    kutu.appendChild(noktalar);
    const isaretle = () => {
      [...noktalar.children].forEach((d, j) => d.setAttribute("aria-current", j === slaytNo));
      geri.disabled = false; ileri.disabled = false;
    };
    let kendim = 0; // kendi kaydırmamız sürerken kaydırma olayı seçimi geri almasın
    const git = (n, el_) => {
      slaytNo = (n + liste.length) % liste.length;
      kendim = Date.now();
      iz.scrollTo({ left: slaytNo * iz.clientWidth, behavior: AZ_HAREKET ? "auto" : "smooth" });
      isaretle();
      if (el_) yeniden();
    };
    geri.onclick = () => git(slaytNo - 1, true); ileri.onclick = () => git(slaytNo + 1, true);
    iz.addEventListener("scroll", () => {
      if (Date.now() - kendim < 700) return;
      const n = Math.round(iz.scrollLeft / Math.max(1, iz.clientWidth));
      if (n !== slaytNo && n >= 0 && n < liste.length) { slaytNo = n; isaretle(); }
    }, { passive: true });
    kutu.onkeydown = (e) => { if (e.key === "ArrowLeft") { e.stopPropagation(); git(slaytNo - 1, true); } if (e.key === "ArrowRight") { e.stopPropagation(); git(slaytNo + 1, true); } };
    let dur = false;
    kutu.addEventListener("mouseenter", () => (dur = true)); kutu.addEventListener("mouseleave", () => (dur = false));
    kutu.addEventListener("focusin", () => (dur = true)); kutu.addEventListener("focusout", () => (dur = false));
    const yeniden = () => { clearInterval(slaytZaman); if (!AZ_HAREKET && liste.length > 1) slaytZaman = setInterval(() => { if (!dur && !document.hidden) git(slaytNo + 1); }, 7000); };
    slaytNo = Math.min(slaytNo, liste.length - 1);
    requestAnimationFrame(() => { iz.scrollLeft = slaytNo * iz.clientWidth; isaretle(); });
    yeniden();
  }

  // ---------------------------------------------------- analizler: haberin aktarımından çok yorum ve inceleme
  // Sabit yerler: 1. Yakın Doğu Haber, 2. Haaretz, 3. Al-Akhbar (Arapça ya da İngilizce), her birinin en yeni analizi
  // (son 72 saatte yoksa son 14 günün en yenisi; hiç analiz yoksa bölgeyle ilgili en yeni yazısı). Kalan yerlerde her yayından en çok bir analiz.
  const ANALIZ_SABIT = [[71], [19], [1, 2]];
  function analizCiz() {
    const kutu = $("analizler"); kutu.innerHTML = "";
    const uygun = (h, gun) => h.nitelik === "analiz" && h.ilgili && !h.atla && kaynaklar[h.kaynak] && dk(h.tarih) < gun * 24 * 60
      && (bolge === "Tümü" || (kaynaklar[h.kaynak].kamp || kaynaklar[h.kaynak].bolge) === bolge);
    const sira = (a, b) => (!!OZ(b) - !!OZ(a)) || (a.tarih < b.tarih ? 1 : -1);
    const sabitId = new Set(ANALIZ_SABIT.flat());
    const liste = [];
    ANALIZ_SABIT.forEach((idler) => {
      const aday = haberler.filter((h) => idler.includes(+h.kaynak));
      // Yayının analiz olarak işaretlenmiş yazısı yoksa bölgeyle ilgili en yeni yazısı: yer hep o yayına ayrılı kalır
      const ilgiliSon = (x) => x.ilgili && !x.atla && kaynaklar[x.kaynak] && dk(x.tarih) < 3 * 24 * 60;
      const h = aday.filter((x) => uygun(x, 3)).sort(sira)[0] || aday.filter((x) => uygun(x, 14)).sort((a, b) => (a.tarih < b.tarih ? 1 : -1))[0]
        || aday.filter(ilgiliSon).sort(sira)[0];
      if (h) liste.push(h);
    });
    const gorulen = new Set();
    haberler.filter((h) => uygun(h, 3) && !sabitId.has(+h.kaynak))
      .sort((a, b) => (!!kaynaklar[b.kaynak].oncelik - !!kaynaklar[a.kaynak].oncelik) || sira(a, b))
      .forEach((h) => { if (liste.length < 12 && !gorulen.has(h.kaynak)) { gorulen.add(h.kaynak); liste.push(h); } });
    kutu.hidden = !liste.length || !!olaySec || sadeceAnaliz;
    if (kutu.hidden) return;
    const ust = el("div", "slayt-ust");
    const bh = el("h2", "bolum", "Analizler"); bh.appendChild(el("span", "bolum-ek", " · olayların ötesine bakan yazılar")); ust.appendChild(bh);
    const tum = el("button", "kapat-olay", "Tümünü gör →"); tum.type = "button"; tum.onclick = () => { $("fAnaliz").checked = true; sadeceAnaliz = true; kac = SAYFA; ciz(true); };
    ust.appendChild(tum); kutu.appendChild(ust);
    const iz = el("div", "analiz-serit");
    liste.forEach((h) => {
      const k = kaynaklar[h.kaynak];
      const a = el("article", "analiz-kart" + (k.oncelik ? " oncelikli" : ""));
      const u = el("div", "kart-ust"); u.appendChild(avatar(k));
      const kim = el("div", "kim"); kim.appendChild(el("span", "ad", k.ad)); kim.appendChild(el("span", "yer", k.sehir + " · " + once(h.tarih))); u.appendChild(kim);
      a.appendChild(u);
      if (BT(h)) a.appendChild(el("h3", null, BT(h)));
      else { const b = el("h3", "orj", h.baslik_orj); b.dir = "auto"; b.lang = k.dil; a.appendChild(b); }
      if (OZ(h)) a.appendChild(el("p", null, OZ(h)));
      else a.appendChild(el("p", "cevirisiz", "Türkçe özet sırada"));
      const e = el("div", "eylemler");
      const git = el("a", "eylem ana", "Yazıyı oku ↗"); git.href = h.url; git.target = "_blank"; git.rel = "noopener"; e.appendChild(git);
      a.appendChild(e);
      // Kartın herhangi bir yerine tıklamak yazıyı kaynağında açar (sürükleme sonrası tıklama yutulur)
      a.addEventListener("click", (ev) => { if (!ev.target.closest("a") && /^https?:\/\//.test(h.url)) window.open(h.url, "_blank", "noopener"); });
      iz.appendChild(a);
    });
    kutu.appendChild(iz);
    surukle(iz);
  }

  // Yatay şeridi fareyle kartın gövdesinden tutup kaydırma (dokunmatikte tarayıcı zaten kaydırır).
  // Sürükleme olduysa ardından gelen tıklama yutulur: kart açılmaz, bağlantı açılmaz.
  function surukle(iz) {
    let x0 = 0, s0 = 0, basili = false, kaydi = false;
    iz.addEventListener("dragstart", (e) => e.preventDefault());
    iz.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      basili = true; kaydi = false; x0 = e.clientX; s0 = iz.scrollLeft;
    });
    iz.addEventListener("pointermove", (e) => {
      if (!basili) return;
      const dx = e.clientX - x0;
      if (!kaydi && Math.abs(dx) > 5) { kaydi = true; iz.classList.add("suruk"); try { iz.setPointerCapture(e.pointerId); } catch (_) {} }
      if (kaydi) { iz.scrollLeft = s0 - dx; e.preventDefault(); }
    });
    const birak = () => {
      if (!basili) return; basili = false;
      if (kaydi) {
        iz.classList.remove("suruk");
        const yut = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
        iz.addEventListener("click", yut, { capture: true, once: true });
        setTimeout(() => iz.removeEventListener("click", yut, { capture: true }), 50);
      }
    };
    iz.addEventListener("pointerup", birak);
    iz.addEventListener("pointercancel", birak);
    iz.addEventListener("lostpointercapture", birak);
  }

  // ---------------------------------------------------- olay ayrıntısı: kim nasıl yazdı
  function olayAyrinti(o) {
    const b = el("div", "olay-baslik");
    const kp = kapsama(o);
    const ust = el("div", "olay-ust");
    ust.appendChild(el("span", "olay-sayi", kp.toplam + " kaynak · " + o.haberler.length + " haber"));
    const kap = el("button", "kapat-olay", "Akışa dön ✕"); kap.type = "button"; kap.onclick = akisaDon;
    ust.appendChild(kap); b.appendChild(ust);
    b.appendChild(el("h2", null, OB(o)));
    const ilkH = haberIdx[o.haberler[o.haberler.length - 1]];
    // Gecikme: İsrail ve Batı basınının ilk haberi bölge basınının ilk haberinden ne kadar sonra geldi?
    {
      const DIS_K = new Set(["İsrail", "Batı"]), IC_K = new Set(["Filistin", "Arap dünyası", "İran", "Yemen", "Türkiye"]);
      let ic = null, ds = null;
      o.haberler.forEach((i) => { const h = haberIdx[i], k = h && kaynaklar[h.kaynak]; if (!k) return; const t = Date.parse(h.tarih), c = kampAd(k);
        if (IC_K.has(c) && (ic == null || t < ic)) ic = t; if (DIS_K.has(c) && (ds == null || t < ds)) ds = t; });
      let metin = null;
      if (ic != null && ds == null) metin = "İsrail ve Batı basını bu olayı henüz yazmadı.";
      else if (ic != null && ds != null) { const sa = (ds - ic) / 36e5;
        metin = Math.abs(sa) < 0.25 ? "İki taraf da aynı saatlerde yazdı." : sa > 0 ? "İsrail ve Batı basını " + (sa < 1 ? Math.round(sa * 60) + " dakika" : sa.toLocaleString(YR, { maximumFractionDigits: 1 }) + " saat") + " sonra yazdı."
          : "İsrail ve Batı basını bölge basınından " + (-sa < 1 ? Math.round(-sa * 60) + " dakika" : (-sa).toLocaleString(YR, { maximumFractionDigits: 1 }) + " saat") + " önce yazdı."; }
      if (metin) b.appendChild(el("p", "ilk-haber gecikme", "⏱ " + metin));
    }
    if (ilkH && kaynaklar[ilkH.kaynak]) b.appendChild(el("p", "ilk-haber", "İlk yazan: " + kaynaklar[ilkH.kaynak].ad + " · " + new Date(ilkH.tarih).toLocaleString(YR, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
    const mat = bakisMatrisi(o, false); if (mat) b.appendChild(mat);
    // Anlatım farkları: yayınların genel çizgisi değil, bu haberde ne yaptıkları (dayanak, fail, bağlam, rakam, kelime)
    const an = o.anlatim || {};
    const anIds = o.haberler.filter((i) => an[i] && haberIdx[i] && kaynaklar[haberIdx[i].kaynak]);
    if (anIds.length >= 2) {
      const kutu = el("div", "anlatim");
      kutu.appendChild(el("h3", null, "Anlatım farkları"));
      if (o.fark === false) kutu.appendChild(el("p", "anlatim-ozet", "Fark yok. " + (o.ortak || "Yayınlar olayı aynı dayanakla ve benzer dille veriyor.")));
      else {
        const say = (f) => anIds.filter(f).length, ad = (i) => kaynaklar[haberIdx[i].kaynak].ad;
        const satir = [];
        const acik = say((i) => an[i].fail === "acik"), edil = say((i) => an[i].fail === "edilgen");
        if (acik && edil) satir.push(["Fail", acik + " yayın faili açıkça yazdı; " + edil + " yayın edilgen dil kullandı (" + anIds.filter((i) => an[i].fail === "edilgen").map(ad).join(", ") + ")."]);
        else if (edil) satir.push(["Fail", "Bütün yayınlar edilgen dil kullandı: faili yazan yok."]);
        const dy = {}; anIds.forEach((i) => { const d = an[i].dayanak; if (d) (dy[d] = dy[d] || []).push(ad(i)); });
        const dk = Object.keys(dy); if (dk.length) satir.push(["Dayanak", dk.length === 1 ? "Hepsi: " + dk[0] + "." : dk.map((d) => d + " (" + dy[d].length + ")").join(" · ")]);
        const bg = say((i) => an[i].baglam === true); if (bg && bg < anIds.length) satir.push(["Bağlam", anIds.length + " yayından " + bg + " tanesi işgal, abluka ya da öncesi gibi bir bağlam verdi."]);
        const grupla = (alan) => { const g = {}; anIds.forEach((i) => { const v = an[i][alan]; if (!v) return; g[v] = g[v] || []; if (!g[v].includes(ad(i))) g[v].push(ad(i)); }); return g; };
        const yaz2 = (g, t) => Object.entries(g).map(([d, v]) => (t ? "“" + d + "”" : d) + ": " + v.slice(0, 3).join(", ") + (v.length > 3 ? " +" + (v.length - 3) : "")).join(" · ");
        const rk = Object.fromEntries(Object.entries(grupla("rakam")).filter(([d]) => /\p{L}/u.test(d))), rkS = Object.keys(rk).length; if (rkS) satir.push(["Rakam", rkS === 1 ? "Hepsi aynı rakamı verdi: " + Object.keys(rk)[0] + "." : yaz2(rk, false)]);
        const kl = Object.fromEntries(Object.entries(grupla("kelime")).sort((a, b) => b[1].length - a[1].length).slice(0, 4)); if (Object.keys(kl).length > 1) satir.push(["Kelime", yaz2(kl, true)]);
        if (o.ortak) kutu.appendChild(el("p", "anlatim-ozet", o.ortak));
        const dl = el("dl", "anlatim-liste");
        satir.forEach(([b2, t]) => { dl.appendChild(el("dt", null, b2)); dl.appendChild(el("dd", null, t)); });
        if (satir.length) kutu.appendChild(dl);
        else kutu.appendChild(el("p", "anlatim-ozet", "Dayanak, fail, bağlam ve rakam bakımından belirgin bir fark yok."));
      }
      b.appendChild(kutu);
    }
    if (ON(o)) { const n = el("p", "cerceve"); n.appendChild(el("b", null, "Kaynaklar nasıl anlattı: ")); n.append(ON(o)); b.appendChild(n); }
    // kaynak kaynak liste, bölge grubuna göre
    const gruplar = {};
    o.haberler.forEach((i) => { const h = haberIdx[i]; const k = h && kaynaklar[h.kaynak]; if (!k) return; (gruplar[kampAd(k)] = gruplar[kampAd(k)] || []).push(h); });
    Object.keys(KAMP_RENK).concat(Object.keys(gruplar).filter((g) => !KAMP_RENK[g])).filter((g) => gruplar[g]).forEach((g) => {
      const sec = el("section", "kim-grup");
      const hb = el("h3"); const nk = el("i"); nk.style.background = KAMP_RENK[g] || "#8d969e"; hb.appendChild(nk); hb.append(g); sec.appendChild(hb);
      gruplar[g].forEach((h) => {
        const k = kaynaklar[h.kaynak];
        const r = el("div", "kim-satir");
        const a = avatar(k); r.appendChild(a);
        const ic = el("div", "kim-ic");
        const ad = el("div", "kim-ad"); if (bayrakHTML(k)) ad.insertAdjacentHTML("afterbegin", bayrakHTML(k)); ad.append(k.ad); if (ROZETLI[k.tur] || k.bagli) ad.appendChild(el("span", "rozet sahip", rozetMetni(k))); ad.appendChild(el("span", "kim-bolge", kampAd(k))); ic.appendChild(ad);
        ic.appendChild(el("div", "kim-baslik", BT(h) || h.baslik_orj));
        if (BT(h) && h.baslik_orj) { const oz = el("div", "kim-ozgun", h.baslik_orj); oz.dir = "auto"; oz.lang = k.dil; ic.appendChild(oz); }
        const bv = o.bakislar && o.bakislar[h.id];
        if (bv) { const c = el("span", "bakis-cip", BAKIS[bv]); c.style.background = BAKIS_RENK[bv]; ad.appendChild(c); }
        const y = OY(o, h.id); if (y) ic.appendChild(el("div", "kim-yorum", y));
        const a2 = an[h.id];
        if (a2) {
          const cp = el("div", "anlatim-cipler");
          if (a2.dayanak) cp.appendChild(el("span", null, "Dayanak: " + a2.dayanak));
          if (a2.fail === "acik") cp.appendChild(el("span", "iyi", "Fail açık"));
          if (a2.fail === "edilgen") cp.appendChild(el("span", "kotu", "Edilgen dil"));
          if (a2.baglam === true) cp.appendChild(el("span", "iyi", "Bağlam var"));
          if (a2.rakam) cp.appendChild(el("span", null, a2.rakam));
          if (a2.kelime) { const kw = el("span", null, "“" + a2.kelime + "”"); kw.dir = "auto"; cp.appendChild(kw); }
          ic.appendChild(cp);
        }
        const l = el("a", "kim-bag", (h.gnews ? "Kaynağa git (Google Haberler üzerinden)" : "Kaynağa git") + " ↗"); l.href = h.url; l.target = "_blank"; l.rel = "noopener"; ic.appendChild(l);
        r.appendChild(ic); sec.appendChild(r);
      });
      b.appendChild(sec);
    });
    b.appendChild(el("p", "olay-uyari", "Çerçeve notu, anlatım farkları ve kaynak betimlemeleri başlıklar ve özetler karşılaştırılarak yapay zekâyla çıkarılır; haberlerin tamamı için kaynaklara git. Yayınların genel çizgisi Kaynaklar sayfasında."));
    return b;
  }

  function seritCiz() {
    const sd = (h) => kaynaklar[h.kaynak] && kaynaklar[h.kaynak].son_dakika;
    const son = [...haberler.filter((h) => sd(h) && !h.atla && dk(h.tarih) < 180).slice(0, 8),
                 ...haberler.filter((h) => !sd(h) && h.ilgili && !h.atla && dk(h.tarih) < 90)].slice(0, 16);
    const s = $("serit"); s.hidden = !son.length;
    document.documentElement.style.setProperty("--serit", son.length ? "38px" : "0px");
    const ic = $("seritIc"); ic.innerHTML = "";
    const parca = () => {
      const p = el("span", "serit-parca");
      son.forEach((h) => {
        const a = el("a", "serit-oge"); a.href = "#h-" + h.id;
        a.appendChild(el("b", null, kaynaklar[h.kaynak] ? kaynaklar[h.kaynak].ad : ""));
        const t = el("span", null, BT(h) || h.baslik_orj); if (!BT(h)) t.dir = "auto"; a.appendChild(t);
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
    ust.appendChild(avatar(k));
    const kim = el("div", "kim");
    const adEl = el("span", "ad", k.ad);
    if (bayrakHTML(k)) adEl.insertAdjacentHTML("afterbegin", bayrakHTML(k));
    kim.appendChild(adEl);
    const yer = el("span", "yer", k.sehir + " · ");
    const z = el("time", null, once(h.tarih)); z.dateTime = h.tarih; z.title = new Date(h.tarih).toLocaleString(YR); yer.appendChild(z);
    kim.appendChild(yer); ust.appendChild(kim);
    const roz = el("div", "rozetler");
    if (dk(h.tarih) < 30 && !k.son_dakika) roz.appendChild(el("span", "rozet yeni", "YENİ"));
    if (k.resmi_grup) roz.appendChild(el("span", "rozet aciklama", k.resmi_grup + " açıklaması"));
    if (k.son_dakika && dk(h.tarih) < 120) roz.appendChild(el("span", "rozet yeni", "SON DAKİKA"));
    if (h.nitelik === "analiz") roz.appendChild(el("span", "rozet analiz", "Analiz"));
    if (h.telegram) roz.appendChild(el("span", "rozet tg", /instagram\.com/.test(h.url) ? "Instagram" : "Telegram"));
    if (ROZETLI[k.tur] || k.bagli) roz.appendChild(el("span", "rozet sahip", rozetMetni(k)));
    ust.appendChild(roz);
    g.appendChild(ust);
    const dg = dogrulama[h.id];
    if (dg && DOG_AD[dg.tur]) {
      const d = el("div", "dogrulama " + dg.tur);
      d.appendChild(el("b", null, DOG_AD[dg.tur]));
      if (dg.aciklama) d.appendChild(el("span", null, dg.aciklama));
      (dg.kanit || []).forEach((u, i) => {
        if (!/^https?:\/\//.test(u)) return;
        const a = el("a", null, (i ? "Kanıt " + (i + 1) : "Kanıt") + " ↗"); a.href = u; a.target = "_blank"; a.rel = "noopener nofollow";
        a.addEventListener("click", (e) => e.stopPropagation()); d.appendChild(a);
      });
      g.appendChild(d);
    }
    if (BT(h)) {
      g.appendChild(el("h2", null, BT(h)));
      if (OZ(h)) g.appendChild(el("p", null, OZ(h)));
      if (h.ceviri_tr && DL === "tr") {
        const d = document.createElement("details"); d.className = "ceviri";
        d.appendChild(el("summary", null, "Açıklamanın tam çevirisi"));
        // [[ATLANDI: …]] : çevrilmeyen cümle; kapalı bir kutuda, dokununca özgün dilinde açılır
        h.ceviri_tr.split(/\n+/).forEach((par) => {
          if (!par.trim()) return;
          const p = el("p");
          par.split(/(\[\[ATLANDI:[\s\S]*?\]\]|\[sivillere şiddet çağrısı içeren bölüm çevrilmedi\])/).forEach((x) => {
            const m = /^\[\[ATLANDI:([\s\S]*?)\]\]$/.exec(x);
            if (m || x.startsWith("[sivillere")) {
              const b = el("button", "atlandi"); b.type = "button";
              b.appendChild(el("span", "atlandi-ust", "Çevrilmedi: sivillere şiddet çağrısı içeriyor" + (m ? " · özgün metni görmek için dokun" : "")));
              if (m) { const o = el("span", "atlandi-ozgun", m[1].trim()); o.dir = "auto"; b.appendChild(o); }
              b.onclick = (e) => { e.stopPropagation(); if (m) b.classList.toggle("acik"); };
              p.appendChild(b);
            } else if (x) p.append(x);
          });
          d.appendChild(p);
        });
        d.appendChild(el("p", "ceviri-not", (k.resmi_grup || k.ad) + "’nin kendi metninin yapay zekâ ile yapılmış çevirisi. Silah taşımayan sivillerin öldürülmesine çağıran ya da bunu kutlayan cümleler çevrilmez; kapalı kutuda özgün dilinde durur."));
        d.addEventListener("click", (e) => e.stopPropagation());
        g.appendChild(d);
      }
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
    const ey = el("div", "eylemler");
    // Telegram duyurusu yayının sitesindeki habere bağlandıysa önce site bağlantısı
    const web = h.web && /^https?:\/\//.test(h.web.url) ? h.web.url : null;
    if (web) {
      ey.appendChild(eylem(k.ad + " sitesinde oku ↗", web, "ana"));
      ey.appendChild(eylem("Telegram duyurusu ↗", h.url));
    } else ey.appendChild(eylem(h.telegram ? "Telegram’da aç ↗" : h.gnews ? "Kaynağa git (Google Haberler üzerinden) ↗" : "Kaynağa git ↗", h.url, "ana"));
    if (!h.gnews) {
      if (h.arsiv) ey.appendChild(eylem("Arşivlendi ✓", h.arsiv, "arsivli"));
      else ey.appendChild(eylem("Wayback’e kaydet", "https://web.archive.org/save/" + (web || h.url)));
    }
    ey.appendChild(paylasDugme(h));
    g.appendChild(ey);
    // Kartın en altında kendi haber sayfamıza giden geniş düğme (kim nasıl yazdı, karşılaştırma, grafikler)
    const sb = el("a", "kart-sayfa"); sb.href = "h/" + encodeURIComponent(h.id) + ".html";
    if (o && o.kaynak_sayisi > 1) {
      sb.classList.add("olayli");
      sb.appendChild(el("b", null, "Kim nasıl yazdı"));
      sb.appendChild(el("span", null, o.kaynak_sayisi + " yayının karşılaştırması · ZBS analizi"));
    } else {
      sb.appendChild(el("b", null, "ZBS sayfasında oku"));
      sb.appendChild(el("span", null, "Özet, bağlam ve kaynak bilgisi"));
    }
    sb.appendChild(el("i", null, "→"));
    g.appendChild(sb);
    kart.appendChild(g);
    // Kartın gövdesine dokunmak haberi kaynağında açar (analiz kartlarıyla aynı); metin seçerken açılmaz
    kart.addEventListener("click", (e) => {
      if (e.target.closest("a,button,details,summary,input,label")) return;
      if (String(window.getSelection && window.getSelection()).trim()) return;
      aktifEt(h.id, true);
      if (/^https?:\/\//.test(h.url)) window.open(h.url, "_blank", "noopener");
    });
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
    if (k && !SABIT_ZEMIN) haritaCiz(suz());
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
    gor = secOlay ? []
      : (sehir ? liste.filter((h) => kaynaklar[h.kaynak].sehir === sehir) : liste);
    const odak = odakId && haberIdx[odakId];
    if (odak && !secOlay) gor = [odak, ...gor.filter((h) => h.id !== odakId)];
    // Haberlerin arasında tutuklu hekim kartı: Dr. Hüsam Ebu Safiye (27 Aralık 2024'ten bu yana)
    function sayacKart() {
      const EN = window.DIL === "en", s = new Date(), gun = Math.floor((Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()) - Date.UTC(2024, 11, 27)) / 864e5);
      const a = el("a", "sayac-kart"); a.href = "ebu-safiye.html";
      a.append(el("span", "sk-ust", EN ? "Detained doctor" : "Tutuklu hekim"), el("b", null, gun.toLocaleString(EN ? "en-GB" : "tr-TR")),
        el("span", "sk-gun", EN ? "days detained" : "gündür tutuklu"), el("strong", null, EN ? "Dr. Hussam Abu Safiya" : "Dr. Hüsam Ebu Safiye"),
        el("span", "sk-alt", EN ? "Director of Kamal Adwan Hospital. No charge, no trial, tortured." : "Kemal Advan Hastanesi Başhekimi. Suçlama yok, yargılama yok, işkence var."),
        el("i", null, EN ? "His story →" : "Hikâyesi →"));
      return a;
    }
    const akis = $("akis");
    const kaydir = window.scrollY;
    akis.innerHTML = "";
    gundemCiz(); analizCiz(); seritCiz();
    // Paylaşılan bağlantı (#h-…): sayfa doğrudan o haberle açılır; gündem, analizler ve süzgeç gizlenir
    const odakModu = !!odakId && !secOlay;
    document.body.classList.toggle("odak-modu", odakModu);
    if (odakModu) {
      const geri = el("button", "kapat-olay odak-geri", "← Tüm haberler"); geri.type = "button";
      geri.onclick = akisaDon;
      akis.appendChild(geri);
    }
    if (secOlay) {
      akis.appendChild(olayAyrinti(secOlay));
    } else if (odakId && !odak) {
      if (arsivAraniyor !== odakId) arsivdeBul(odakId);
      const n = el("p", "bos", arsivBulunamadi === odakId ? "Paylaşılan haber bulunamadı. " : "Paylaşılan haber arşivde aranıyor… ");
      const a = el("a", null, "Arşivde ara"); a.href = "arsiv.html"; n.appendChild(a); akis.appendChild(n);
    }
    if (!haberler.length) akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek."));
    else if (!gor.length && !secOlay) akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
    gor.slice(0, kac).forEach((h, i) => {
      const k = haberCiz(h); if (i === 0 && !secOlay) k.classList.add("manset");
      if (h.id === odakId) { k.classList.add("odak"); k.insertBefore(el("span", "odak-etiket", "Paylaşılan haber"), k.firstChild); }
      if (bilinen && !bilinen.has(h.id)) k.classList.add("taze");
      akis.appendChild(k);
      if (i === 4 && !secOlay) akis.appendChild(sayacKart());
      if (i === HARITA_SIRA - 1 && HARITA_BOLUM && !secOlay) akis.appendChild(HARITA_BOLUM);
    });
    if (HARITA_BOLUM) { if (secOlay) HARITA_BOLUM.remove(); else if (!HARITA_BOLUM.isConnected || HARITA_BOLUM.parentNode !== akis) akis.appendChild(HARITA_BOLUM); }
    if (gor.length > kac) akis.appendChild(el("p", "nota nota-son", "Yükleniyor…"));
    else if (gor.length) {
      const n = el("p", "nota"); n.append("Hepsi bu kadar. Yayınların kim olduğunu ");
      const a = el("a", null, "Kaynaklar"); a.href = "kaynaklar.html"; n.appendChild(a); n.append(" sayfasında bulabilirsin."); akis.appendChild(n);
    }
    if (basaDon || odakModu) { if (window.scrollY > 0) window.scrollTo({ top: 0 }); } else window.scrollTo({ top: kaydir });
    const s = $("sayilar"); s.innerHTML = ""; s.hidden = !!secOlay;
    s.appendChild(el("b", null, gor.length.toLocaleString(YR))); s.append(" haber · ");
    s.appendChild(el("b", null, gor.filter((h) => OZ(h)).length.toLocaleString(YR))); s.append(" Türkçe · ");
    s.appendChild(el("b", null, gor.filter((h) => dk(h.tarih) < 60).length.toLocaleString(YR))); s.append(" son saatte");
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
      const [k, h, o, lg, dg] = await Promise.all([
        fetch("kaynaklar.json?t=" + t).then((r) => r.json()),
        fetch("data/haberler.json?t=" + t).then((r) => r.json()),
        fetch("data/olaylar.json?t=" + t).then((r) => r.json()).catch(() => ({ olaylar: [] })),
        fetch("data/logolar.json?t=" + Math.floor(t / 36e5)).then((r) => r.json()).catch(() => ({})),
        fetch("data/dogrulama.json?t=" + t).then((r) => r.json()).catch(() => ({})),
      ]);
      logolar = lg || {};
      dogrulama = (dg && dg.etiketler) || {};
      olaylar = o.olaylar || []; olayHarita = {}; olaylar.forEach((x) => (olayHarita[x.id] = x));
      kaynaklar = {}; k.forEach((x) => (kaynaklar[x.id] = x));
      haberler = (h.haberler || []).slice().sort((a, b) => (a.tarih < b.tarih ? 1 : -1));
      guncellendi = h.guncellendi;
      haberIdx = { ...arsivBulunan }; haberler.forEach((x) => (haberIdx[x.id] = x));
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
  let arsivAraniyor = null, arsivBulunamadi = null;
  const arsivBulunan = {};
  async function arsivdeBul(id) {
    arsivAraniyor = id;
    try {
      const dizin = await (await fetch("data/arsiv/dizin.json?t=" + Date.now())).json();
      for (const g of dizin.slice(0, 21)) {
        const gun = await (await fetch("data/arsiv/" + g.gun + ".json")).json();
        const h = (Array.isArray(gun) ? gun : gun.haberler || []).find((x) => x.id === id);
        if (h && kaynaklar[h.kaynak]) {
          if (h.ilgili === undefined) h.ilgili = true;
          haberIdx[h.id] = h; arsivBulunan[h.id] = h;
          if (odakId === id) ciz(true);
          return;
        }
      }
    } catch (e) { /* arşiv okunamadı */ }
    arsivBulunamadi = id;
    if (odakId === id) ciz(true);
  }
  function hashOku() {
    const m = /^#h-([0-9a-f]+)$/.exec(location.hash); odakId = m ? m[1] : null;
    // #o-<haber kimliği>: o haberin bulunduğu olayın "kim nasıl yazdı" sayfası (Telegram bağlantıları)
    const o = /^#o-([0-9a-f]+)$/.exec(location.hash);
    if (o) { const ol = olaylar.find((x) => x.haberler.includes(o[1])); if (ol) olaySec = ol.id; }
  }
  window.addEventListener("hashchange", () => { olaySec = null; hashOku(); ciz(true); });
  document.addEventListener("click", (e) => { if (!e.target.closest(".paylas")) document.querySelectorAll(".paylas-menu").forEach((m) => (m.hidden = true)); });
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  $("fIlgili").onchange = $("fOzet").onchange = () => { kac = SAYFA; ciz(true); };
  $("fAnaliz").onchange = (e) => { sadeceAnaliz = e.target.checked; kac = SAYFA; ciz(true); };
  const bul = $("fBulanik");
  bul.checked = oku("zbs-bulanik") === "1";
  document.body.classList.toggle("bulanik", bul.checked);
  bul.onchange = () => { document.body.classList.toggle("bulanik", bul.checked); sakla("zbs-bulanik", bul.checked ? "1" : "0"); };
  let bekle;
  $("fAra").addEventListener("input", (e) => { clearTimeout(bekle); bekle = setTimeout(() => { ara = e.target.value.trim().toLocaleLowerCase("tr"); kac = SAYFA; ciz(true); }, 180); });
  $("fSehir").onclick = () => { sehir = null; ciz(true); };
  $("fSehirSec").onchange = (e) => { sehir = e.target.value || null; kac = SAYFA; ciz(true); };
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
