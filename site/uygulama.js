// Sayfa kodu: haber akışı tek sütunda; bölge haritası sayfanın arkasında sabit bir zemin.
// Bir kartın üzerine gelince arkadaki haritada o haberin şehri parlar. Veri 5 dakikada bir yenilenir.
(function () {
  "use strict";
  const BOLGELER = ["Filistin", "Meşrik", "Körfez", "Mısır", "İran", "Yemen", "Mağrip", "Anadolu-Türkiye", "İsrail", "İsrail’de muhalif basın", "ABD", "İngiltere", "İspanya", "İtalya", "Almanya", "Fransa", "Asya ve diğer"];
  const TUR = { resmi: "devlet", grup: "bağlı", bagimsiz: "bağımsız", koop: "kooperatif", ozel: "özel", izle: "karşı taraf" };
  // Kartlarda yalnızca okura bir şey söyleyen sahiplik bilgisi gösterilir; ayrıntısı Kaynaklar sayfasında
  const ROZETLI = { resmi: "devlet", grup: "bağlı" };
  const DIL = { ar: "Arapça", en: "İngilizce", fr: "Fransızca", tr: "Türkçe", he: "İbranice", es: "İspanyolca", ca: "Katalanca", it: "İtalyanca", de: "Almanca" };
  const DUNYA = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const SAYFA = 30;
  const BAYRAK = '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>';
  const MARKA_AD = (window.MARKA && window.MARKA.ad) || "ZBS";
  const AZ_HAREKET = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const KONULAR = ["Gazze", "Batı Şeria", "Kudüs", "Lübnan", "Suriye", "Yemen ve Kızıldeniz", "İran", "Irak", "Mısır", "Ürdün", "Mağrip", "Türkiye", "Körfez", "Göç", "Diplomasi ve müzakere", "İnsani durum", "Esirler ve tutuklular", "Uluslararası hukuk", "Protesto ve dayanışma", "Ekonomi ve boykot", "İsrail iç siyaseti", "Avrupa", "ABD"];
  let logolar = {};
  let kaynaklar = {}, haberler = [], guncellendi = null, gor = [], olaylar = [], olayHarita = {};
  let konu = null, olaySec = null, odakId = null;
  let bilinen = null; // önceki yüklemede görülen haber kimlikleri
  let haberIdx = {};
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
    const kaynaklarim = [(logolar[k.id] || {}).url, host && "https://icons.duckduckgo.com/ip3/" + host + ".ico"].filter(Boolean);
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
  const zemin = $("zemin"), SVGNS = "http://www.w3.org/2000/svg";
  const zEl = (t, at) => { const e = document.createElementNS(SVGNS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  let zNoktalar = null;
  if (zemin) {
    zemin.setAttribute("viewBox", "0 0 " + (ZB.dogu - ZB.bat) * ZB.olcek + " " + (ZB.kuzey - ZB.guney) * ZB.olcek);
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
    const aktif = aktifId && haberIdx[aktifId];
    const aktifSehir = aktif && kaynaklar[aktif.kaynak] ? kaynaklar[aktif.kaynak].sehir : null;
    sirali.slice().reverse().forEach(([ad, s]) => {
      if (s.lon < ZB.bat || s.lon > ZB.dogu || s.lat < ZB.guney || s.lat > ZB.kuzey) return;
      const x = zx(s.lon), y = zy(s.lat), r = 3 + Math.sqrt(s.n) * 1.3;
      const vurgu = ad === sehir || ad === aktifSehir;
      const g = zEl("g", { class: "z-sehir" + (vurgu ? " vurgu" : "") + (s.taze ? " taze" : "") });
      if (s.taze) g.appendChild(zEl("circle", { class: "z-nabiz", cx: x, cy: y, r: r }));
      g.appendChild(zEl("circle", { class: "z-nokta", cx: x, cy: y, r: r }));
      if (vurgu) { const t = zEl("text", { x: x + r + 6, y: y + 4 }); t.textContent = ad; g.appendChild(t); }
      zNoktalar.appendChild(g);
    });
  }

  // ---------------------------------------------------- kartlar
  function suz() {
    const ilgili = $("fIlgili").checked, ozetli = $("fOzet").checked;
    return haberler.filter((h) => {
      const k = kaynaklar[h.kaynak]; if (!k || h.atla) return false;
      if (bolge !== "Tümü" && (k.kamp || k.bolge) !== bolge) return false;
      if (ilgili && !h.ilgili) return false;
      if (ozetli && !h.ozet_tr) return false;
      if (sadeceAnaliz && h.nitelik !== "analiz") return false;
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

  // ---------------------------------------------------- kapsama analizi (Ground News benzeri)
  const KAMP = { "Filistin": "Filistin", "Meşrik": "Arap dünyası", "Körfez": "Arap dünyası", "Mısır": "Arap dünyası", "Mağrip": "Arap dünyası",
    "İran": "İran ve Yemen", "Yemen": "İran ve Yemen", "Anadolu-Türkiye": "Türkiye", "İsrail": "İsrail", "ABD": "Batı", "İngiltere": "Batı",
    "İspanya": "Batı", "İtalya": "Batı", "Almanya": "Batı", "Fransa": "Batı", "Asya ve diğer": "Diğer" };
  const KAMP_RENK = { "Filistin": "#2b8a5e", "Arap dünyası": "#8cc2a8", "İran ve Yemen": "#c39a35", "Türkiye": "#c9544e", "İsrail": "#4a72c4", "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#9aa3ab", "Diğer": "#6b746f" };
  const TUR_GRUP = { resmi: "Devlet", grup: "Bağlı", bagimsiz: "Bağımsız", koop: "Bağımsız", ozel: "Özel", izle: "Karşı taraf" };
  const TUR_RENK = { "Devlet": "#c9544e", "Bağlı": "#8c8f8d", "Bağımsız": "#2b8a5e", "Özel": "#6d89a3", "Karşı taraf": "#4a5560" };
  const kampAd = (k) => k.kamp || KAMP[k.bolge] || "Diğer";
  const CIZGI = { ad: "Antiemperyalist / dekolonyal", ara: "Ara / ana akım", ik: "İşbirlikçi kompradorlar ve emperyalistler" };
  const CIZGI_RENK = { "Antiemperyalist / dekolonyal": "#2b8a5e", "Ara / ana akım": "#9aa3ab", "İşbirlikçi kompradorlar ve emperyalistler": "#c9544e" };
  const cizgiAd = (k) => CIZGI[k.cizgi] || CIZGI.ara;
  const BAKIS = { filistin: "Filistin bakışı", aktarim: "Aktarım", israil: "İsrail / ABD bakışı" };
  const BAKIS_RENK = { filistin: "#2b8a5e", aktarim: "#a7aeb3", israil: "#4a72c4" };
  const KAMP_SIRA = ["Filistin", "Arap dünyası", "Türkiye", "İran ve Yemen", "Batı", "İsrail", "İsrail’de muhalif basın", "Diğer"];

  // Bölge gruplarına göre bakış: her haber bir kare (sayı görünür kalsın), satırın sağında
  // grubun Filistin bakışından ortalama uzaklığı (0 = başlangıç noktası, 2 = İsrail / ABD bakışı).
  const UZAK = { filistin: 0, aktarim: 1, israil: 2 };
  function uzaklikMetni(u) {
    const t = u.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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
      satir[g][v].push(k.ad + ": " + (h.baslik_orj || h.baslik_tr || "")); satir[g].n++;
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
      um.textContent = kisa ? u.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : uzaklikMetni(u);
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
    if (ad / kp.toplam >= 0.6) return "Kör nokta: bu olayı ağırlıkla antiemperyalist çizgideki yayınlar yazdı; ana akım ve karşı taraf sessiz (%" + Math.round((100 * ad) / kp.toplam) + ").";
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
    const liste = olaylar.filter((o) => o.haberler.filter((i) => haberIdx[i]).length >= 2).slice(0, 8);
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
      const kp = kapsama(o);
      const sl = el("article", "slayt"); sl.setAttribute("aria-label", (n + 1) + " / " + liste.length);
      const gh = o.haberler.map((i) => haberIdx[i]).find((h) => h && h.gorsel && !h.gnews);
      const arka = el("div", "slayt-arka");
      if (gh) { const img = document.createElement("img"); img.src = gh.gorsel; img.alt = ""; img.loading = n ? "lazy" : "eager"; img.referrerPolicy = "no-referrer"; img.onerror = () => img.remove(); arka.appendChild(img);
        arka.appendChild(el("span", "kredi", "Görsel: " + kaynaklar[gh.kaynak].ad)); }
      sl.appendChild(arka);
      const ic = el("div", "slayt-ic");
      ic.appendChild(el("span", "slayt-sayi", (n + 1) + " / " + liste.length + " · " + kp.toplam + " kaynak · son " + once(o.son)));
      ic.appendChild(el("h3", null, o.baslik));
      if (o.not) ic.appendChild(el("p", null, o.not.length > 220 ? o.not.slice(0, 217) + "…" : o.not));
      ic.appendChild(bakisMatrisi(o, true) || cubuk(kp.cizgi, CIZGI_RENK, kp.toplam));
      const kn = korNokta(kp); if (kn) ic.appendChild(el("span", "kor-nokta", kn));
      const b = el("button", "slayt-dugme", "Kim nasıl yazdı →"); b.type = "button"; b.onclick = () => olayAc(o.id);
      ic.appendChild(b);
      sl.appendChild(ic);
      iz.appendChild(sl);
    });
    cerceve.append(iz, geri, ileri);
    kutu.appendChild(cerceve);
    const noktalar = el("div", "slayt-noktalar"); noktalar.setAttribute("role", "tablist");
    liste.forEach((o, n) => {
      const d = el("button"); d.type = "button"; d.setAttribute("role", "tab");
      d.setAttribute("aria-label", (n + 1) + ". olay: " + o.baslik); d.title = o.baslik;
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
  // Öncelikli yayınlar (Al-Akhbar) başta; Türkçe özeti yazılmış olanlar özeti yazılmamışlardan önce.
  function analizCiz() {
    const kutu = $("analizler"); kutu.innerHTML = "";
    const liste = haberler.filter((h) => h.nitelik === "analiz" && h.ilgili && !h.atla && kaynaklar[h.kaynak] && dk(h.tarih) < 72 * 60
      && (bolge === "Tümü" || (kaynaklar[h.kaynak].kamp || kaynaklar[h.kaynak].bolge) === bolge))
      .sort((a, b) => (!!kaynaklar[b.kaynak].oncelik - !!kaynaklar[a.kaynak].oncelik) || (!!b.ozet_tr - !!a.ozet_tr) || (a.tarih < b.tarih ? 1 : -1))
      .slice(0, 12);
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
      if (h.baslik_tr) a.appendChild(el("h3", null, h.baslik_tr));
      else { const b = el("h3", "orj", h.baslik_orj); b.dir = "auto"; b.lang = k.dil; a.appendChild(b); }
      if (h.ozet_tr) a.appendChild(el("p", null, h.ozet_tr));
      else a.appendChild(el("p", "cevirisiz", "Türkçe özet sırada"));
      const e = el("div", "eylemler");
      const git = el("a", "eylem ana", "Yazıyı oku ↗"); git.href = h.url; git.target = "_blank"; git.rel = "noopener"; e.appendChild(git);
      a.appendChild(e);
      a.addEventListener("click", (ev) => { if (!ev.target.closest("a")) a.classList.toggle("acik"); });
      iz.appendChild(a);
    });
    kutu.appendChild(iz);
  }

  // ---------------------------------------------------- olay ayrıntısı: kim nasıl yazdı
  function olayAyrinti(o) {
    const b = el("div", "olay-baslik");
    const kp = kapsama(o);
    const ust = el("div", "olay-ust");
    ust.appendChild(el("span", "olay-sayi", kp.toplam + " kaynak · " + o.haberler.length + " haber"));
    const kap = el("button", "kapat-olay", "Akışa dön ✕"); kap.type = "button"; kap.onclick = () => { olaySec = null; ciz(true); };
    ust.appendChild(kap); b.appendChild(ust);
    b.appendChild(el("h2", null, o.baslik));
    const ilkH = haberIdx[o.haberler[o.haberler.length - 1]];
    if (ilkH && kaynaklar[ilkH.kaynak]) b.appendChild(el("p", "ilk-haber", "İlk yazan: " + kaynaklar[ilkH.kaynak].ad + " · " + new Date(ilkH.tarih).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })));
    const mat = bakisMatrisi(o, false); if (mat) b.appendChild(mat);
    const denge = cubuk(kp.cizgi, CIZGI_RENK, kp.toplam, "Kaynakların çizgisi");
    denge.classList.add("denge"); b.appendChild(denge);
    const iki = el("div", "dagilimlar");
    iki.appendChild(cubuk(kp.kamp, KAMP_RENK, kp.toplam, "Kaynakların bölgesi"));
    iki.appendChild(cubuk(kp.tur, TUR_RENK, kp.toplam, "Kaynakların sahipliği"));
    b.appendChild(iki);
    const kn = korNokta(kp); if (kn) b.appendChild(el("span", "kor-nokta", kn));
    if (o.not) { const n = el("p", "cerceve"); n.appendChild(el("b", null, "Kaynaklar nasıl anlattı: ")); n.append(o.not); b.appendChild(n); }
    // kaynak kaynak liste, bölge grubuna göre
    const gruplar = {};
    o.haberler.forEach((i) => { const h = haberIdx[i]; const k = h && kaynaklar[h.kaynak]; if (!k) return; (gruplar[cizgiAd(k)] = gruplar[cizgiAd(k)] || []).push(h); });
    Object.keys(CIZGI_RENK).filter((g) => gruplar[g]).forEach((g) => {
      const sec = el("section", "kim-grup");
      const hb = el("h3"); const nk = el("i"); nk.style.background = CIZGI_RENK[g]; hb.appendChild(nk); hb.append(g); sec.appendChild(hb);
      gruplar[g].forEach((h) => {
        const k = kaynaklar[h.kaynak];
        const r = el("div", "kim-satir");
        const a = avatar(k); r.appendChild(a);
        const ic = el("div", "kim-ic");
        const ad = el("div", "kim-ad"); if (k.bolge === "İsrail" && !k.bayraksiz) ad.insertAdjacentHTML("afterbegin", BAYRAK); ad.append(k.ad); if (ROZETLI[k.tur]) ad.appendChild(el("span", "rozet sahip", ROZETLI[k.tur])); ad.appendChild(el("span", "kim-bolge", kampAd(k))); ic.appendChild(ad);
        ic.appendChild(el("div", "kim-baslik", h.baslik_tr || h.baslik_orj));
        if (h.baslik_tr && h.baslik_orj) { const oz = el("div", "kim-ozgun", h.baslik_orj); oz.dir = "auto"; oz.lang = k.dil; ic.appendChild(oz); }
        const bv = o.bakislar && o.bakislar[h.id];
        if (bv) { const c = el("span", "bakis-cip", BAKIS[bv]); c.style.background = BAKIS_RENK[bv]; ad.appendChild(c); }
        const y = o.yorumlar && o.yorumlar[h.id]; if (y) ic.appendChild(el("div", "kim-yorum", y));
        const l = el("a", "kim-bag", (h.gnews ? "Kaynağa git (Google Haberler üzerinden)" : "Kaynağa git") + " ↗"); l.href = h.url; l.target = "_blank"; l.rel = "noopener"; ic.appendChild(l);
        r.appendChild(ic); sec.appendChild(r);
      });
      b.appendChild(sec);
    });
    const yontem = el("p", "olay-uyari"); yontem.append("Denge çubuğu " + MARKA_AD + "’nin her yayına verdiği editoryal çizgi değerlendirmesine dayanır; ölçütleri ");
    const ya = el("a", null, "Hakkımızda"); ya.href = "hakkimizda.html#cizgi"; yontem.appendChild(ya); yontem.append(" sayfasında."); b.appendChild(yontem);
    b.appendChild(el("p", "olay-uyari", "Bölge ve sahiplik dağılımı kaynak listemizden hesaplanır. Çerçeve notu ve kaynak betimlemeleri başlıklar karşılaştırılarak yapay zekâyla yazılır; haberlerin tamamı için kaynaklara git."));
    return b;
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
    ust.appendChild(avatar(k));
    const kim = el("div", "kim");
    const adEl = el("span", "ad", k.ad);
    if (k.bolge === "İsrail" && !k.bayraksiz) adEl.insertAdjacentHTML("afterbegin", BAYRAK);
    kim.appendChild(adEl);
    const yer = el("span", "yer", k.sehir + " · ");
    const z = el("time", null, once(h.tarih)); z.dateTime = h.tarih; z.title = new Date(h.tarih).toLocaleString("tr-TR"); yer.appendChild(z);
    kim.appendChild(yer); ust.appendChild(kim);
    const roz = el("div", "rozetler");
    if (dk(h.tarih) < 30) roz.appendChild(el("span", "rozet yeni", "YENİ"));
    if (h.nitelik === "analiz") roz.appendChild(el("span", "rozet analiz", "Analiz"));
    if (h.telegram) roz.appendChild(el("span", "rozet tg", "Telegram"));
    if (ROZETLI[k.tur]) roz.appendChild(el("span", "rozet sahip", ROZETLI[k.tur]));
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
    if (k) haritaCiz(suz());
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
    const akis = $("akis");
    const kaydir = window.scrollY;
    akis.innerHTML = "";
    gundemCiz(); analizCiz(); seritCiz();
    if (secOlay) {
      akis.appendChild(olayAyrinti(secOlay));
    } else if (odakId && !odak) {
      const n = el("p", "bos"); n.append("Paylaşılan haber artık akışta değil (akış son iki günü gösteriyor). ");
      const a = el("a", null, "Arşivde ara"); a.href = "arsiv.html"; n.appendChild(a); akis.appendChild(n);
    }
    if (!haberler.length) akis.appendChild(el("p", "bos", "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek."));
    else if (!gor.length && !secOlay) akis.appendChild(el("p", "bos", "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene."));
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
    const s = $("sayilar"); s.innerHTML = ""; s.hidden = !!secOlay;
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
      const [k, h, o, lg] = await Promise.all([
        fetch("kaynaklar.json?t=" + t).then((r) => r.json()),
        fetch("data/haberler.json?t=" + t).then((r) => r.json()),
        fetch("data/olaylar.json?t=" + t).then((r) => r.json()).catch(() => ({ olaylar: [] })),
        fetch("data/logolar.json?t=" + Math.floor(t / 36e5)).then((r) => r.json()).catch(() => ({})),
      ]);
      logolar = lg || {};
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
