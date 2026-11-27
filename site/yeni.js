/* yeni.html: ana sayfa tasarım önizlemesi (üçüncü sürüm).
   Sıra: ortak gündem (manşet, yan haberler, en çok yazılan) → kim nasıl yazdı → süren hikâyeler → ülke ülke basın → arka plan → akış.
   Türk haber siteleri (kaynaklar.json "geri") verilerde kalır ama ön planda yer almaz; akışta isteğe bağlı gösterilir. */
(function () {
  "use strict";
  var EN = /[?&]dil=en/.test(location.search);
  try { if (!/[?&]dil=/.test(location.search) && localStorage.getItem("yeni-dil") === "en") EN = true; } catch (e) {}
  var t = function (tr, en) { return EN ? en : tr; };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function al(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  document.documentElement.lang = EN ? "en" : "tr";
  document.querySelectorAll("[data-tr]").forEach(function (n) { n.textContent = EN ? n.getAttribute("data-en") : n.getAttribute("data-tr"); });
  $("ara").placeholder = t("Haber ya da yayın ara", "Search stories or outlets");
  document.querySelectorAll(".dil button").forEach(function (b) {
    b.setAttribute("aria-pressed", String((b.dataset.dil === "en") === EN));
    b.onclick = function () { try { localStorage.setItem("yeni-dil", b.dataset.dil); } catch (e) {} location.search = b.dataset.dil === "en" ? "?dil=en" : ""; };
  });

  // ---- ülke grupları: "ülke ülke basın" bölümleri ve karşılaştırma kutuları aynı gruplarla
  var GRUPLAR = [
    { id: "filistin", ad: "Filistin basını", en: "Palestinian press", kisa: "Filistin", kisa_en: "Palestine", ulke: ["Filistin"], renk: "#007a3d" },
    { id: "israil", ad: "İsrail basını", en: "Israeli press", kisa: "İsrail", kisa_en: "Israel", ulke: ["İsrail"], renk: "#2f5fb3" },
    { id: "lubnan", ad: "Lübnan basını", en: "Lebanese press", kisa: "Lübnan", kisa_en: "Lebanon", ulke: ["Lübnan"], renk: "#5b8c3a" },
    { id: "korfez", ad: "Suudi ve Körfez basını", en: "Saudi and Gulf press", kisa: "Suudi-Körfez", kisa_en: "Saudi-Gulf", ulke: ["Suudi Arabistan", "BAE", "Kuveyt", "Bahreyn", "Umman"], renk: "#8a6d1f" },
    { id: "katar", ad: "Katar basını", en: "Qatari press", kisa: "Katar", kisa_en: "Qatar", ulke: ["Katar"], renk: "#7a1f3d" },
    { id: "misir", ad: "Mısır basını", en: "Egyptian press", kisa: "Mısır", kisa_en: "Egypt", ulke: ["Mısır"], renk: "#a0522d" },
    { id: "mesrik", ad: "Suriye, Irak ve Ürdün basını", en: "Syrian, Iraqi and Jordanian press", kisa: "Suriye-Irak-Ürdün", kisa_en: "Syria-Iraq-Jordan", ulke: ["Suriye", "Irak", "Ürdün"], renk: "#6b7f3a" },
    { id: "iran", ad: "İran basını", en: "Iranian press", kisa: "İran", kisa_en: "Iran", ulke: ["İran"], renk: "#3f7f6b" },
    { id: "yemen", ad: "Yemen basını", en: "Yemeni press", kisa: "Yemen", kisa_en: "Yemen", ulke: ["Yemen"], renk: "#6a4c93" },
    { id: "magrip", ad: "Mağrip basını", en: "Maghreb press", kisa: "Mağrip", kisa_en: "Maghreb", ulke: ["Cezayir", "Fas", "Tunus", "Libya"], renk: "#b5651d" },
    { id: "turkiye", ad: "Türkiye basını", en: "Turkish press", kisa: "Türkiye", kisa_en: "Türkiye", ulke: ["Türkiye"], renk: "#c8102e" },
    { id: "abd", ad: "ABD ve İngiltere basını", en: "US and UK press", kisa: "ABD-İngiltere", kisa_en: "US-UK", ulke: ["ABD", "İngiltere"], renk: "#555d66" },
    { id: "avrupa", ad: "Avrupa basını", en: "European press", kisa: "Avrupa", kisa_en: "Europe", ulke: ["İspanya", "Fransa", "Almanya", "İtalya", "Belçika"], renk: "#7d8790" },
    { id: "diger", ad: "Asya, Afrika ve Latin Amerika", en: "Asia, Africa and Latin America", kisa: "Diğer", kisa_en: "Other", ulke: [], renk: "#9aa1a6" }];
  var G_ULKE = {}; GRUPLAR.forEach(function (g) { g.ulke.forEach(function (u) { G_ULKE[u] = g; }); });
  function grupOf(k) { return (k && G_ULKE[k.ulke]) || GRUPLAR[GRUPLAR.length - 1]; }
  function gAd(g) { return EN ? g.en : g.ad; }
  function gKisa(g) { return EN ? g.kisa_en : g.kisa; }

  var K = {};
  function onde(id) { var k = K[id]; return k && !k.geri && !k.silahli && !k.dusunce; }   // ön planda sayılan yayın
  function gruplar(ids) {   // olayı yazan ön plan yayınlarının ülke grupları, en çok yayınla
    var s = {}, n = 0;
    (ids || []).forEach(function (id) { if (!onde(id)) return; n++; var g = grupOf(K[id]); s[g.id] = (s[g.id] || 0) + 1; });
    var L = GRUPLAR.filter(function (g) { return s[g.id]; }).sort(function (a, b) { return s[b.id] - s[a.id]; });
    return { L: L, n: n };
  }
  function kimSatir(ids) {
    var g = gruplar(ids);
    if (!g.n) return "";
    var adlar = g.L.slice(0, 5).map(gKisa).join(" · ") + (g.L.length > 5 ? " +" + (g.L.length - 5) : "");
    return adlar + " · " + g.n + t(" yayın", " outlets");
  }

  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{203C}\u{2049}\u{200D}]/gu;
  var SONDK = /^\s*(son dakika|breaking|urgent|acil|عاجل)\s*[|:\-–]\s*/i;
  function temiz(s) { return String(s || "").replace(EMOJI, "").replace(/\s{2,}/g, " ").trim(); }
  function sonDakikaMi(s) { return SONDK.test(temiz(s)); }
  function baslik(h) { var b = EN ? (h.baslik_en || h.baslik_orj || h.baslik_tr) : (h.baslik_tr || h.baslik_orj); return temiz(b).replace(SONDK, ""); }
  function ozet(h) { return temiz(EN ? h.ozet_en : h.ozet_tr); }
  function obas(o) { return temiz(EN ? o.baslik_en || o.baslik : o.baslik); }
  function saat(s) {
    var d = new Date(s); if (isNaN(d)) return "";
    var x = new Date(d.getTime() + 3 * 36e5), h = ("0" + x.getUTCHours()).slice(-2), m = ("0" + x.getUTCMinutes()).slice(-2);
    return EN ? h + ":" + m : h + "." + m;
  }
  function once(s) {
    var dk = Math.round((Date.now() - new Date(s)) / 6e4);
    if (isNaN(dk)) return "";
    if (dk < 60) return Math.max(dk, 1) + t(" dk önce", " min ago");
    if (dk < 1440) return Math.round(dk / 60) + t(" sa önce", " h ago");
    var g = Math.round(dk / 1440); return g === 1 ? t("dün", "yesterday") : g + t(" gün önce", " d ago");
  }
  function vekil(u, w) { return "https://wsrv.nl/?url=" + encodeURIComponent(u) + "&w=" + w + "&we&output=webp&q=78"; }
  function dis(a) { a.target = "_blank"; a.rel = "noopener"; return a; }
  function link(href, cls) { var a = el("a", cls); a.href = href || "#"; if (/^https?:/.test(a.getAttribute("href"))) dis(a); return a; }
  function resim(u, w, cls) {   // denetimden geçmiş görsel; yüklenmezse kutusuyla birlikte kalkar
    var f = el("div", cls || "kucuk-gorsel"), im = el("img"); im.src = vekil(u, w); im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer";
    im.onerror = function () { var li = f.closest("li"); if (li) li.classList.add("gorselsiz"); f.remove(); };
    f.appendChild(im); return f;
  }
  function olayGorsel(o) { return o.gorsel && o.gorsel_atif ? o.gorsel : null; }   // gündem görseli: denetim (gorsel_denetim.py) onayıyla
  function haberGorsel(h) { var k = K[h.kaynak]; return h.gorsel && h.gorsel_ok === true && !(k && k.gorsel_yok) ? h.gorsel : null; }
  var BOLGE = [
    ["Gazze", "Gaza", /Gazze|Han Yunus|Refah|Cebaliye|Deyr el-Belah|Nuseyrat|Beyt Lahiya|Gaza|Khan Yunis|Rafah|Jabalia/i],
    ["Kudüs", "Jerusalem", /Kudüs|Aksa|Jerusalem/i],
    ["Batı Şeria", "West Bank", /Batı Şeria|Cenin|Nablus|Ramallah|El-Halil|Tulkerim|Tubas|yerleşimci|West Bank|Jenin|Hebron|settler/i],
    ["Lübnan", "Lebanon", /Lübnan|Hizbullah|Beyrut|Lebanon|Hezbollah|Beirut/i],
    ["Yemen", "Yemen", /Yemen|Husi|Ensarullah|Hudeyde|Houthi|Hodeidah/i],
    ["İran", "Iran", /İran|Tahran|Hürmüz|Devrim Muhafızları|Iran|Tehran|Hormuz/i],
    ["Suriye", "Syria", /Suriye|Şam|Halep|Syria|Damascus|Aleppo/i],
    ["Irak", "Iraq", /Irak|Bağdat|Iraq|Baghdad|Kürdistan|Kurdistan/i],
    ["İsrail", "Israel", /Netanyahu|Eizenkot|Knesset|Tel Aviv|İsrail|Israel/i]];
  function bolgeBul(s) { for (var i = 0; i < BOLGE.length; i++) if (BOLGE[i][2].test(s || "")) return EN ? BOLGE[i][1] : BOLGE[i][0]; return null; }

  // ---- dosyalar
  var DOS = {}, DOS_L = [], HD = {}, FEED_DOS = {};
  function dosyaKur(D) {
    DOS_L = (D && D.dosyalar || []).slice().sort(function (p, q) { return String(q.son).localeCompare(String(p.son)) || (q.sicak || 0) - (p.sicak || 0); });
    DOS_L.forEach(function (x) { DOS[x.id] = x; });
    HD = (D && D.haber) || {};
    Object.keys(HD).forEach(function (h) { FEED_DOS[h] = HD[h][0]; });
  }
  function dosyaOf(o) {
    var say = {};
    (o.haberler || []).forEach(function (h) { var y = HD[h]; if (y) say[y[0]] = (say[y[0]] || 0) + 1; });
    var en = null; Object.keys(say).forEach(function (k) { if (!en || say[k] > say[en]) en = k; });
    return en ? DOS[en] : null;
  }
  function dosyaAd(x) { return EN ? x.ad_en || x.ad : x.ad; }
  function etiketOf(o) {   // olayın üst etiketi: dosyası varsa dosya adı (bağlantılı), yoksa bölge
    if (o._d) { var a = el("a", "etiket", dosyaAd(o._d)); a.href = "d/" + o._d.id + ".html"; return a; }
    return el("span", "etiket", bolgeBul(o.baslik + " " + (o.not || "")) || t("Bölge", "Region"));
  }

  // ---- 1. ortak gündem
  var OL = [];
  function gundemCiz(g) {
    OL = (g && g.olaylar || []).filter(function (o) { return gruplar(o.kaynaklar).n >= 2; });
    OL.forEach(function (o) {
      o._d = dosyaOf(o); var gg = gruplar(o.kaynaklar); o._g = gg.L.length; o._n = gg.n;
      if (o._d) (o.haberler || []).forEach(function (h) { FEED_DOS[h] = o._d.id; });
      var yas = (Date.now() - new Date(o.son)) / 36e5;
      o._p = o._g * 5 + Math.min(o._n, 12) + (bolgeBul(o.baslik + " " + (o.not || "")) ? 4 : 0) + (olayGorsel(o) ? 3 : 0) - Math.min(yas / 6, 8);
    });
    var m = $("manset"); m.textContent = "";
    if (!OL.length) { m.appendChild(el("p", "bekle", t("Gündem şu an boş.", "No top stories right now."))); return; }
    var sira = OL.slice().sort(function (a, b) { return b._p - a._p; });
    var ana = sira[0];
    if (olayGorsel(ana)) {
      var f = el("figure", "gorsel"), im = el("img"); im.src = vekil(olayGorsel(ana), 1000); im.alt = ""; im.referrerPolicy = "no-referrer";
      im.onerror = function () { f.remove(); };
      f.appendChild(im); if (ana.gorsel_atif) f.appendChild(el("figcaption", null, ana.gorsel_atif)); m.appendChild(f);
    }
    m.appendChild(etiketOf(ana));
    var h = el("h1"), a = el("a", null, obas(ana)); a.href = ana.sayfa || "#"; h.appendChild(a); m.appendChild(h);
    var not = EN ? ana.not_en : ana.not; if (not) m.appendChild(el("p", "not", not));
    m.appendChild(el("span", "kim", t("Yazan: ", "Covered by: ") + kimSatir(ana.kaynaklar) + " · " + once(ana.son)));

    var yl = $("yanListe"); yl.textContent = "";
    sira.slice(1, 5).forEach(function (o) {
      var li = el("li"), a2 = el("a"); a2.href = o.sayfa || "#";
      var gs = olayGorsel(o);
      if (gs) a2.appendChild(resim(gs, 320)); else li.className = "gorselsiz";
      var ic = el("div"); ic.append(el("b", null, obas(o)), el("span", "kim", kimSatir(o.kaynaklar)));
      a2.appendChild(ic); li.appendChild(a2); yl.appendChild(li);
    });

    var sr = $("sirali"); sr.textContent = "";
    OL.slice().sort(function (a, b) { return b._g - a._g || b._n - a._n || String(b.son).localeCompare(String(a.son)); }).slice(0, 8).forEach(function (o) {
      var li = el("li"), a3 = el("a"); a3.href = o.sayfa || "#";
      var ic = el("div"); ic.append(el("b", null, obas(o)), el("span", "kim", o._g + t(" ülke · ", " countries · ") + o._n + t(" yayın", " outlets")));
      a3.appendChild(ic); li.appendChild(a3); sr.appendChild(li);
    });
    karsiCiz();
    hikayeCiz();
  }

  // ---- 2. kim nasıl yazdı: en çok ülkenin yazdığı olayda, her ülke grubundan bir başlık
  function karsiCiz() {
    var aday = OL.filter(function (o) { return (o.basliklar || []).length >= 3; }).sort(function (a, b) { return b._g - a._g || b._n - a._n; })[0];
    if (!aday) return;
    var kutular = {}, sira = [];
    aday.basliklar.forEach(function (x) {
      if (!onde(x.k)) return;
      var g = grupOf(K[x.k]);
      if (!kutular[g.id]) { kutular[g.id] = { g: g, L: [] }; sira.push(g.id); }
      kutular[g.id].L.push(x);
    });
    if (sira.length < 2) return;
    $("karsiAlt").textContent = t("Aynı olay, farklı ülkelerin basınında: ", "The same event in the press of different countries: ") + obas(aday);
    var iz = $("karsiIzgara"); iz.textContent = "";
    sira.slice(0, 8).forEach(function (id) {
      var kx = kutular[id], x = kx.L[0], k = K[x.k];
      var d = el("div", "karsi-kutu"); d.style.setProperty("--renk", kx.g.renk);
      var a = link(x.u); a.textContent = temiz(EN ? x.be || x.b : x.b);
      d.append(el("span", "grup", gAd(kx.g)), a, el("span", "kaynak", k ? k.ad : ""));
      if (kx.L.length > 1) d.appendChild(el("span", "digerleri", t("ve ", "and ") + (kx.L.length - 1) + t(" yayın daha: ", " more: ") + kx.L.slice(1, 4).map(function (y) { return (K[y.k] || {}).ad; }).join(", ")));
      iz.appendChild(d);
    });
    $("karsiBag").href = aday.sayfa || "#";
    $("karsi").hidden = false;
  }

  // ---- 3. süren hikâyeler (ve başlıktaki konu şeridi)
  function hikayeCiz() {
    var ks = $("konuSerit"); ks.textContent = "";
    if (DOS_L.length) {
      ks.appendChild(el("b", null, t("Süren", "Ongoing")));
      DOS_L.forEach(function (x) { var a = el("a", null, dosyaAd(x)); a.href = "d/" + x.id + ".html"; ks.appendChild(a); });
    }
    var kap = $("hikaye"); kap.textContent = "";
    DOS_L.slice(0, 6).forEach(function (x) {
      var a = el("a", "hikaye-kart"); a.href = "d/" + x.id + ".html";
      if (x.gorsel && x.gorsel.u) a.appendChild(resim(x.gorsel.u, 640));
      var e = el("span", "etiket", (EN ? x.bolge_en || x.bolge : x.bolge) || t("Dosya", "File"));
      a.append(e, el("h3", null, dosyaAd(x)));
      var sb = EN ? x.son_be || x.son_b : x.son_b; if (sb) a.appendChild(el("p", null, t("Son: ", "Latest: ") + sb));
      var son14 = (x.nabiz || []).reduce(function (s, v) { return s + v; }, 0);
      a.appendChild(el("span", "kim", (x.olay || 0) + t(" olay · son 14 günde ", " events · ") + son14 + t("", " in the last 14 days") + " · " + once(x.son + "T12:00:00Z")));
      kap.appendChild(a);
    });
  }

  // ---- 4. ülke ülke basın
  var TUM = [], tamYuklendi = false;
  function uygun(h) { var k = K[h.kaynak]; return h.ilgili !== false && !(k && k.silahli) && (h.baslik_tr || h.baslik_orj); }
  // ülke bölümleri konuyla ilgili haberleri gösterir (bölge yayınlarının iç haberleri, spor, magazin dışarıda)
  var KONU = /filist|gazze|gaza|batı şeria|west bank|kudüs|jerusalem|israil|israel|siyon|zion|hamas|hizbullah|hezbollah|lübnan|leban|suriye|syria|yemen|husi|houthi|ensarullah|iran|irak|iraq|hürmüz|hormuz|kızıldeniz|red sea|unrwa|işgal|occupation|yerleşimci|settler|netanyahu|ateşkes|ceasefire|soykırım|genocide|mülteci|refugee|فلسطين|غزة|إسرائيل|اسرائيل|الاحتلال|الضفة|القدس|حماس|حزب الله|لبنان|سوري|اليمن|إيران|ايران|العراق|ישראל|עזה|פלסטינ|חמאס/i;
  function konuMu(h) { return !!FEED_DOS[h.id] || KONU.test(baslik(h) + " " + (h.baslik_orj || "")); }
  function ulkeCiz() {
    var kap = $("ulkeIzgara"); kap.textContent = "";
    var kova = {};
    TUM.forEach(function (h) { if (!onde(h.kaynak) || h.nitelik === "analiz" || !konuMu(h)) return; var g = grupOf(K[h.kaynak]); (kova[g.id] = kova[g.id] || []).push(h); });
    GRUPLAR.forEach(function (g) {
      var L = kova[g.id] || [], gor = {}, sec = [], yayin = {};
      // önce çevrilmiş başlıklar; bir yayından en çok iki haber, böylece tek kaynak bölümü doldurmaz
      var cevrili = function (h) { return EN ? !!h.baslik_en : !!h.baslik_tr; };
      L.filter(cevrili).concat(L.filter(function (h) { return !cevrili(h); })).forEach(function (h) {
        var b = baslik(h), an = b.slice(0, 40).toLocaleLowerCase("tr");
        if (!b || gor[an] || (yayin[h.kaynak] || 0) >= 2) return;
        gor[an] = 1; yayin[h.kaynak] = (yayin[h.kaynak] || 0) + 1; sec.push(h);
      });
      if (sec.length < 2) return;
      var kutu = el("section", "ulke");
      var h3 = el("h3"); h3.append(document.createTextNode(gAd(g)), el("small", null, once(sec[0].tarih)));
      kutu.appendChild(h3);
      var ilkG = sec.slice(0, 6).filter(haberGorsel)[0];
      var ilk = ilkG || sec[0];
      var a = link(ilk.url, "ilk");
      if (ilkG) a.appendChild(resim(haberGorsel(ilkG), 560));
      a.append(el("b", null, baslik(ilk)), el("span", "kaynak", ((K[ilk.kaynak] || {}).ad || "") + " · " + saat(ilk.tarih)));
      kutu.appendChild(a);
      var ol = el("ol");
      sec.filter(function (h) { return h !== ilk; }).slice(0, 4).forEach(function (h) {
        var li = el("li"), a2 = link(h.url); a2.textContent = baslik(h);
        li.append(a2, el("span", "kaynak", ((K[h.kaynak] || {}).ad || "") + " · " + saat(h.tarih)));
        ol.appendChild(li);
      });
      kutu.appendChild(ol);
      kap.appendChild(kutu);
    });
  }

  // ---- 5. arka plan
  function analizCiz(d) {
    var kap = $("analiz"); kap.textContent = "";
    var sinir = Date.now() - 4 * 864e5, gor = {}, L = (d && d.analizler || []).filter(function (a) { return ozet(a) && new Date(a.tarih) > sinir; });
    L.sort(function (a, b) { return (b.dusunce ? 1 : 0) - (a.dusunce ? 1 : 0) || String(b.tarih).localeCompare(String(a.tarih)); });
    L.filter(function (a) { if (gor[a.kaynak] || (K[a.kaynak] || {}).geri) return false; gor[a.kaynak] = 1; return true; }).slice(0, 3).forEach(function (a) {
      var k = link(a.url, "analiz-kart");
      k.append(el("span", "kurum", a.kurum + (a.dusunce ? t(" · düşünce kuruluşu", " · think tank") : "")), el("h3", null, baslik(a)), el("p", null, ozet(a)), el("span", "kim", once(a.tarih)));
      kap.appendChild(k);
    });
    if (!kap.children.length) $("arka").hidden = true;
  }

  // ---- 6. akış
  var goster = 30, sorgu = "", dosyaSec = "";
  function suzulmus() {
    var an = $("sAnaliz").checked, tg = $("sTg").checked, geri = $("sGeri").checked;
    return TUM.filter(function (h) {
      var k = K[h.kaynak];
      if (!geri && k && k.geri) return false;
      if (an && h.nitelik !== "analiz") return false;
      if (tg && h.telegram) return false;
      if (dosyaSec === "_yok" && FEED_DOS[h.id]) return false;
      if (dosyaSec && dosyaSec !== "_yok" && FEED_DOS[h.id] !== dosyaSec) return false;
      if (sorgu && (baslik(h) + " " + (h.baslik_orj || "") + " " + (k ? k.ad : "")).toLocaleLowerCase("tr").indexOf(sorgu) < 0) return false;
      return true;
    });
  }
  function akisCiz() {
    var g = suzulmus(), ol = $("akisL"); ol.textContent = "";
    $("akisSay").textContent = g.length + t(" haber", " stories") + (tamYuklendi ? "" : t(" · son saatler", " · recent hours"));
    if (!g.length) ol.appendChild(el("li", "bos", t("Eşleşen haber yok.", "Nothing matches.")));
    g.slice(0, goster).forEach(function (h) {
      var li = el("li"), k = K[h.kaynak], ust = el("div", "ust-s");
      ust.append(el("b", null, k ? k.ad : h.kaynak_ad || ""), el("span", null, saat(h.tarih)));
      if (h.nitelik === "analiz") ust.appendChild(el("span", "rozet a", t("Analiz", "Analysis")));
      else if (sonDakikaMi(h.baslik_orj) || sonDakikaMi(h.baslik_tr)) ust.appendChild(el("span", "rozet", t("Son dakika", "Breaking")));
      var a = link(h.url, "b"); a.textContent = baslik(h);
      li.append(ust, a);
      var dx = DOS[FEED_DOS[h.id]]; if (dx) { var de = el("a", "dosya-et", t("Dosya: ", "File: ") + dosyaAd(dx)); de.href = "d/" + dx.id + ".html"; li.appendChild(de); }
      ol.appendChild(li);
    });
    $("daha").hidden = g.length <= goster && tamYuklendi;
  }
  var tamSoz = null;
  function tamYukle() {
    if (!tamSoz) tamSoz = al("data/haberler-akis.json").then(function (d) {
      tamYuklendi = true;
      if (d && d.haberler) { var var_ = {}; TUM.forEach(function (h) { var_[h.id] = 1; }); TUM = TUM.concat(d.haberler.filter(function (h) { return !var_[h.id] && uygun(h); })); TUM.sort(function (a, b) { return String(b.tarih).localeCompare(String(a.tarih)); }); }
    });
    return tamSoz;
  }
  $("daha").onclick = function () {
    goster += 30;
    if (suzulmus().length < goster && !tamYuklendi) { $("daha").textContent = t("Yükleniyor…", "Loading…"); tamYukle().then(function () { $("daha").textContent = t("Daha fazla", "Show more"); akisCiz(); }); }
    else akisCiz();
  };
  var bek; $("ara").oninput = function () { clearTimeout(bek); bek = setTimeout(function () { sorgu = $("ara").value.trim().toLocaleLowerCase("tr"); goster = 30; akisCiz(); }, 200); };
  $("dahaSuz").onclick = function () { var e = $("suzEk"); e.hidden = !e.hidden; this.setAttribute("aria-expanded", String(!e.hidden)); };
  ["sAnaliz", "sTg", "sGeri"].forEach(function (id) { $(id).onchange = function () { goster = 30; akisCiz(); }; });
  function dosyaSuzKur() {
    var k = $("dosyaSuz"); k.textContent = "";
    [["", t("Hepsi", "All")]].concat(DOS_L.map(function (x) { return [x.id, dosyaAd(x)]; }), [["_yok", t("Dosyasız", "No file")]]).forEach(function (x) {
      var b = el("button", null, x[1]); b.type = "button"; b.setAttribute("aria-pressed", String(x[0] === dosyaSec));
      b.onclick = function () {
        dosyaSec = x[0]; goster = 30; k.querySelectorAll("button").forEach(function (y) { y.setAttribute("aria-pressed", String(y === b)); });
        akisCiz(); if (dosyaSec && !tamYuklendi) tamYukle().then(akisCiz);
      };
      k.appendChild(b);
    });
  }

  // ---- yükle
  al("kaynaklar.json").then(function (k) {
    (Array.isArray(k) ? k : (k && k.kaynaklar) || []).forEach(function (x) { K[x.id] = x; });
    Promise.all([al("data/gundem.json"), al("data/dosyalar-site.json")]).then(function (r) { dosyaKur(r[1]); gundemCiz(r[0]); dosyaSuzKur(); if (TUM.length) akisCiz(); });
    al("data/haberler-ilk.json").then(function (d) {
      TUM = (d && d.haberler || []).filter(uygun).sort(function (a, b) { return String(b.tarih).localeCompare(String(a.tarih)); });
      if (d && d.guncellendi) $("guncel").textContent = t("Güncellendi · ", "Updated · ") + once(d.guncellendi);
      ulkeCiz(); akisCiz();
      // ülke bölümleri son saatlerle sınırlı kalmasın: bütün akış arka planda gelir
      setTimeout(function () { tamYukle().then(function () { ulkeCiz(); akisCiz(); }); }, 1200);
    });
    al("data/analizler.json").then(analizCiz);
  });
})();
