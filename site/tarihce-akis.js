// Tarihçe: bir yüzyılın akışları. Veri: site/tarihce-akis.json (akışlar), site/donum.json (olay metinleri ve eski görseller),
// site/tarihce-harita.json ve site/tarihce-harita-genis.json (Natural Earth'ten üretilmiş harita yolları).
// Bütün akışların olayları tek bir zaman çizgisinde, tarih sırasıyla akar; her akış ilk olayından önce açılır, son olayından
// sonra bir geçiş cümlesiyle kapanır. Toprak el değiştirdiğinde olayın altında önce/sonra haritası durur: çizgiyi sürükleyerek
// iki hâl karşılaştırılır (2005 çekilmesi için uydu görüntüsü). Her .izle öğesi görünüme girdikçe 0'dan 1'e giden bir --p alır.
(function () {
  "use strict";
  var EN = window.DIL === "en", YER = EN ? "en-GB" : "tr-TR";
  var kok = document.getElementById("ta");
  var BG = window.ALB_BOLGE, N = function (s) { return BG && s ? BG.notr(s, EN ? "en" : "tr") : s; };
  var AZALT = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function svg(t, a) { var e = document.createElementNS("http://www.w3.org/2000/svg", t); for (var k in a || {}) e.setAttribute(k, a[k]); return e; }
  function tarihAd(t) {
    t = String(t);
    if (t.length === 4) return t;
    if (t.length === 7) return new Date(t + "-15T12:00:00Z").toLocaleDateString(YER, { month: "long", year: "numeric" });
    return new Date(t + "T12:00:00Z").toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" });
  }
  function yil(t) { return parseInt(String(t).slice(0, 4), 10); }
  function dis(a, href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; return a; }
  function D2(o, k) { return EN && o[k + "_en"] ? o[k + "_en"] : o[k]; }

  Promise.all([
    fetch("site/tarihce-akis.json?v=21").then(function (r) { return r.json(); }),
    fetch("site/donum.json?v=21").then(function (r) { return r.json(); }),
    fetch("site/tarihce-harita.json?v=3").then(function (r) { return r.json(); }),
    fetch("site/tarihce-harita-genis.json?v=3").then(function (r) { return r.json(); }),
    fetch("data/gorsel/tarihce/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("data/gorsel/kapak/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("data/gorsel/uydu/uydu.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    BG ? BG.hazir : null
  ]).then(function (x) { kur(x[0], x[1], x[2], x[3], (x[4] || []).concat(x[5] || []), x[6]); })
    .catch(function (e) { kok.textContent = EN ? "The history page could not be loaded." : "Tarihçe yüklenemedi."; console.error(e); });

  // Metni yazar; "vurgu" listesindeki parçaları fosforlu kalemle işaretler
  function vurgula(e, metin, liste) {
    metin = metin || "";
    var L = (liste || []).filter(function (x) { return x && metin.indexOf(x) >= 0; });
    if (!L.length) { e.textContent = metin; return e; }
    var re = new RegExp("(" + L.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")");
    metin.split(re).forEach(function (p) {
      if (!p) return;
      if (L.indexOf(p) >= 0) e.appendChild(el("mark", "ta-isaret", p)); else e.appendChild(document.createTextNode(p));
    });
    return e;
  }

  function kur(A, D, H, H2, K, U) {
    kok.textContent = "";
    var kunye = {}; K.forEach(function (k) { kunye[k.ad] = k; });
    var KUL = {};   // sayfada kullanılan künyeler (sonda listelenir)
    function bul(ref) {
      var p = String(ref).split("|");
      return D.olaylar.find(function (o) { return o.tarih === p[0] && (!p[1] || o.baslik.indexOf(p[1]) >= 0); });
    }
    function kredi(yazar) { var y = String(yazar || ""); if (y.indexOf("@") >= 0) y = y.split(/[.,;(]\s|\s\S+@/)[0]; return y.replace(/^Unknown author.*/, EN ? "unknown photographer" : "fotoğrafçısı bilinmiyor").replace(/\s+/g, " ").trim(); }
    function gorsel(ad, klasor) {
      var k = kunye[ad];
      return { src: "data/gorsel/" + (klasor || "tarihce") + "/" + (k && k.dosya ? k.dosya : ad + ".jpg"), ad: ad,
        yazi: k ? (EN ? k.en : k.tr) : "", kredi: k ? kredi(k.yazar) + (k.lisans ? ", " + k.lisans : "") : "", sayfa: k && k.sayfa };
    }
    // bir öğenin bütün görselleri: kendi görselleri + donum.json'daki eski görseller
    function gorseller(o, v) {
      var L = [];
      if (o.gorsel) L.push(gorsel(o.gorsel, o.gorsel_klasor));
      (o.gorseller || []).forEach(function (g) { L.push(gorsel(g)); });
      ((v && v.gorseller) || (v && v.gorsel ? [v.gorsel] : [])).forEach(function (g) {
        if (!g || !g.url) return;
        L.push({ src: g.url, yazi: (EN ? g.aciklama_en : g.aciklama) || "", kredi: g.atif || "", sayfa: g.sayfa });
      });
      return L;
    }

    // --- giriş ---
    var giris = el("section", "ta-giris izle");
    var ic = el("div", "ta-giris-ic");
    ic.appendChild(tatriz(46, "ta-tatriz ilk"));
    var h = el("h1", "ta-baslik");
    harfle(h, EN ? "Currents of a century" : "Bir yüzyılın akışları");
    ic.append(el("p", "ta-ust", EN ? "Palestine · 1882–2026" : "Filistin · 1882–2026"), h, el("p", "ta-ar", "تيارات قرن"),
      el("p", "ta-dek", EN
        ? "The Zionist movement set its sights on Palestine in the 1880s, while it was still Ottoman land; Abdülhamid II refused to hand it over in return for paying off the debt. Then the Ottomans marched on Suez to win back British-held Egypt; within four years they had lost every Arab land Selim I had taken from the Mamluks in 1516–17. Gaza, Jerusalem, Damascus and Aleppo fell within a year, and in October 1918 the Committee of Union and Progress government laid down its arms at Mudros. The empire’s Arab lands were divided between the colonial powers, and through Balfour’s promise Palestine became the target of the Zionist settlement project. From then on each generation carried the resistance a step further: Qassam’s peasants took to the hills, the nationalism of Nasser and the Ba’ath mobilised armies, the fedayeen and the left carried the struggle into the camps, and the Islamic movements spread it from Gaza across the region. The currents flow on a single timeline and overlap where history did; whenever the land changed hands, a before-and-after map lets you compare the two."
        : "Siyonist hareket Filistin’i 1880’lerde, henüz Osmanlı toprağıyken hedef aldı; II. Abdülhamid toprağı borç karşılığında vermeyi reddetti. Sonra Osmanlı, İngiliz elindeki Mısır’ı geri almak için Süveyş’e yürüdü; dört yıl dolmadan Yavuz Selim’in 1516-17’de Memlüklerden aldığı Arap topraklarının tamamını kaybetmişti. Gazze, Kudüs, Şam ve Halep bir yıl içinde düştü, Ekim 1918’de İttihat ve Terakki yönetimi Mondros’ta silah bıraktı. İmparatorluğun Arap toprakları sömürgeci güçler arasında paylaşıldı; Filistin ise Balfour’un verdiği sözle Siyonist yerleşim planının hedefi oldu. O günden sonra her kuşak direnişi bir adım ileri taşıdı: Kassam’ın köylüleri dağa çıktı, Nasır’ın ve Baas’ın milliyetçiliği orduları seferber etti, fedailer ve sol mücadeleyi kamplara taşıdı, İslami hareketler onu Gazze’den bütün bölgeye yaydı. Akışlar tek bir zaman çizgisinde ilerler, tarihin iç içe geçtiği yerde birbirine karışır. Toprak her el değiştirdiğinde önce ve sonra haritası gelir; çizgiyi sürükleyip iki hâli karşılaştırabilirsiniz."));
    ic.appendChild(tatriz(46, "ta-tatriz son"));
    ic.appendChild(el("p", "ta-ipucu", EN ? "Scroll ↓" : "Kaydır ↓"));
    giris.appendChild(ic);
    kok.appendChild(giris);

    // --- sahne: solda zaman şeridi, ortada tek akış ---
    var sahne = el("div", "ta-sahne");
    var nehir = el("nav", "ta-nehir"); nehir.setAttribute("aria-label", EN ? "Timeline" : "Zaman şeridi");
    var akis = el("div", "ta-akis");
    sahne.append(nehir, akis);
    kok.appendChild(sahne);
    var lb = isikKutusu();
    var HR = haritaci(H, H2);
    nehirKur(nehir, A.akislar, function (k) { var e = document.getElementById("akis-" + k); if (e) e.scrollIntoView({ behavior: AZALT ? "auto" : "smooth", block: "start" }); });

    // bütün olaylar tek sırada: tarih, eşitse akış sırası, o da eşitse akıştaki sıra.
    // Tarihsiz öğeler (alıntı, biyografi) kendi akışındaki bir önceki öğenin hemen ardında kalır.
    var sira = [];
    A.akislar.forEach(function (a, ai) {
      var son = "";
      a.olaylar.forEach(function (o, i) {
        var t = o.tur === "alinti" || o.tur === "biyografi" ? null : (o.ref ? (bul(o.ref) || {}).tarih : o.tarih);
        if (t) son = String(t);
        sira.push({ a: a, ai: ai, o: o, t: t ? String(t) : son + "~", i: i });
      });
    });
    sira.sort(function (x, y) { return x.t < y.t ? -1 : x.t > y.t ? 1 : x.ai - y.ai || x.i - y.i; });
    var ilk = {}, son = {};
    sira.forEach(function (x, n) { if (!(x.a.anahtar in ilk)) ilk[x.a.anahtar] = n; son[x.a.anahtar] = n; });

    var serit = el("div", "ta-serit");
    akis.appendChild(serit);
    sira.forEach(function (x, n) {
      var a = x.a;
      if (ilk[a.anahtar] === n) { var ac0 = acilis(a, x.ai); if (a.karanlik) ac0.dataset.karanlik = "1"; serit.appendChild(ac0); }
      var e = oge(x.o, a);
      boya(e, a, x.t);
      if ((a.karanlik || x.o.karanlik) && e.nodeType === 1) e.dataset.karanlik = "1";
      serit.appendChild(e);
      if (x.o.karsilastir) serit.appendChild(boya(haritaKars(x.o.karsilastir), a, x.t));
      if (x.o.uydu) serit.appendChild(boya(uyduKars(x.o.uydu), a, x.t));
      if (x.o.hava) serit.appendChild(boya(havaKars(x.o.hava), a, x.t));
      if (x.o.gazete_kars && A.gazeteler && A.gazeteler[x.o.gazete_kars]) serit.appendChild(boya(gazeteKars(A.gazeteler[x.o.gazete_kars]), a, x.t));
      if (x.o.uydu_gazze && U && U.gazze_once && U.sari) serit.appendChild(boya(uyduGazze(U, x.o.uydu_gazze), a, x.t));
      if (son[a.anahtar] === n && a.gecis) serit.appendChild(boya(gecis(a, x.ai), a, x.t));
    });

    var sonu = el("footer", "ta-son");
    sonu.appendChild(el("p", null, EN
      ? "Relief from AWS Terrain Tiles, coastlines and borders from Natural Earth (public domain). The 1947 plan and the Oslo areas are traced from public-domain maps and are approximate; the Sykes–Picot zones, the 1956 and 1973 fronts and the 2025 line are schematic. Satellite images: Landsat 5 (USGS/NASA). Photographs from Wikimedia Commons, openly licensed or public domain. Older list view: "
      : "Arazi AWS Terrain Tiles’tan, kıyılar ve sınırlar Natural Earth’ten (kamu malı). 1947 planı ve Oslo bölgeleri kamu malı haritalardan izlendi, yaklaşıktır; Sykes–Picot bölgeleri, 1956 ve 1973 cepheleri ve 2025 hattı şematiktir. Uydu görüntüleri: Landsat 5 (USGS/NASA). Fotoğraflar Wikimedia Commons’tan, açık lisanslı ya da kamu malı. Eski liste görünümü: "));
    sonu.lastChild.appendChild(Object.assign(el("a", null, EN ? "all entries by date" : "bütün olaylar tarih sırasıyla"), { href: "tarihce-liste.html" }));
    var kl = el("p", "ta-kunyeler"); kl.id = "taKunye"; sonu.appendChild(kl);
    kok.appendChild(sonu);
    kunyeYaz(kl);

    function boya(e, a, t) {
      if (e.nodeType !== 1) return e;
      e.style.setProperty("--renk", a.renk);
      e.dataset.akis = a.anahtar;
      if (!e.dataset.yil && t) { var y = yil(t); if (y) e.dataset.yil = y; }
      return e;
    }
    function akisEt(a) {
      var s = el("span", "ta-akis-et", D2(a, "ad"));
      return s;
    }

    // --- akış açılışı: numara, yıllar, ad, tez ve bir görsel ---
    function acilis(a, ai) {
      var ac = el("header", "ta-acilis izle"); ac.id = "akis-" + a.anahtar;
      boya(ac, a, a.yillar[0]); ac.dataset.yil = a.yillar[0];
      var m = el("div", "ta-acilis-metin");
      m.appendChild(el("p", "ta-no", String(ai + 1).padStart(2, "0") + " / " + String(A.akislar.length).padStart(2, "0")));
      var yy = el("p", "ta-yillar"); harfle(yy, a.yillar[0] + "–" + (a.yillar[1] >= 2026 ? "" : a.yillar[1])); m.appendChild(yy);
      var ad = el("h2", "ta-ad"); harfle(ad, D2(a, "ad")); m.appendChild(ad);
      if (a.alt) m.appendChild(el("p", "ta-alt", D2(a, "alt")));
      m.appendChild(el("p", "ta-ar", a.ar));
      var tz = el("p", "ta-tez", D2(a, "tez"));
      if (a.tez_kaynak) tz.appendChild(dis(el("a", "ta-kaynak", " " + a.tez_kaynak.ad + " ↗"), a.tez_kaynak.url));
      m.appendChild(tz);
      m.appendChild(tatriz(24, "ta-tatriz kucuk"));
      ac.appendChild(m);
      if (a.gorsel) {
        var g = gorsel(a.gorsel), f = el("figure", "ta-acilis-gorsel");
        var b = el("button", "ta-g-dugme"); b.type = "button"; b.setAttribute("aria-label", (EN ? "Enlarge: " : "Büyüt: ") + g.yazi);
        var im = new Image(); im.src = g.src; im.alt = g.yazi; im.loading = "lazy"; im.decoding = "async";
        im.onerror = function () { f.remove(); ac.classList.remove("gorselli"); };
        b.appendChild(im); b.onclick = function () { lb.ac([g], 0); };
        f.appendChild(b);
        var fc = el("figcaption");
        if (g.yazi) fc.appendChild(el("span", null, g.yazi));
        if (g.kredi) { var k = el("a", "ta-g-kredi", (EN ? "Image: " : "Görsel: ") + g.kredi); if (g.sayfa) dis(k, g.sayfa); fc.appendChild(k); }
        f.appendChild(fc);
        ac.appendChild(f); ac.classList.add("gorselli");
        KUL[a.gorsel] = 1;
      }
      return ac;
    }
    // --- akış kapanışı ---
    function gecis(a, ai) {
      var g = el("div", "ta-gecis izle");
      var et = el("p", "ta-gecis-et");
      et.append(el("span", "ta-gecis-no", String(ai + 1).padStart(2, "0")), document.createTextNode(D2(a, "ad") + " · " + a.yillar[0] + "–" + (a.yillar[1] >= 2026 ? "" : a.yillar[1])));
      g.append(et, el("p", "ta-gecis-soz", D2(a, "gecis")), el("i", "ta-gecis-cizgi"));
      return g;
    }

    function oge(o, a) {
      var e = o.tur === "alinti" ? alinti(o) : o.tur === "biyografi" ? biyografi(o) : o.tur === "gazete" ? kupur(o) : kart(o);
      if (e.nodeType === 1) {
        var et = akisEt(a);
        if (o.ortak && o.ortak.length) {   // öğe birden çok akışa ait: her biri kendi renginde etiket
          var kap = el("div", "ta-akis-etler"); kap.appendChild(et);
          o.ortak.forEach(function (k) { var b = A.akislar.find(function (x) { return x.anahtar === k; }); if (b) { var e2 = akisEt(b); e2.style.setProperty("--renk", b.renk); kap.appendChild(e2); } });
          et = kap;
        }
        e.insertBefore(et, e.firstChild);
      }
      return e;
    }
    function kaynakSatiri(ks) {
      ks = (ks || []).filter(function (x) { return x && x.url; });
      if (!ks.length) return null;
      var kk = el("p", "ta-kaynaklar");
      ks.slice(0, 3).forEach(function (x, i) { if (i) kk.append(" · "); kk.appendChild(dis(el("a", null, (x.ad || "kaynak") + " ↗"), x.url)); });
      return kk;
    }
    // akademik kaynakça ve birincil belgeler (bağlantısız)
    function kaynakca(L) {
      if (!L || !L.length) return null;
      var d = el("div", "ta-kaynakca");
      var ak = L.filter(function (x) { return x.tur !== "birincil"; }), bi = L.filter(function (x) { return x.tur === "birincil"; });
      [[ak, EN ? "Reading" : "Kaynakça"], [bi, EN ? "Documents" : "Belgeler"]].forEach(function (g) {
        if (!g[0].length) return;
        var p = el("p"); p.appendChild(el("b", null, g[1]));
        g[0].forEach(function (x, i) { p.appendChild(el("span", null, (i ? " · " : " ") + (EN && x.ad_en ? x.ad_en : x.ad))); });
        d.appendChild(p);
      });
      return d;
    }
    function kart(o) {
      var v = o.ref ? bul(o.ref) : o;
      if (!v) { console.warn("yok", o.ref); return document.createComment("yok " + o.ref); }
      var Q = function (k) { return (EN && (o[k + "_en"] || v[k + "_en"])) || o[k] || v[k]; };
      var gz = o.gazete;
      var k = el("article", "ta-kart izle" + (o.yan ? " sag" : "") + (gz ? " gazete" : "") + (o.buyuk ? " buyuk" : ""));
      k.dataset.yil = yil(v.tarih);
      if (typeof gz === "string") k.appendChild(el("p", "ta-manset", EN && o.gazete_en ? o.gazete_en : gz));
      k.appendChild(el("time", "ta-tarih", tarihAd(v.tarih)));
      k.appendChild(vurgula(el("h3"), N(Q("baslik")), EN ? o.vurgu_en : o.vurgu));
      var gs = gorseller(o, o.ref ? v : null);
      var metin = N(Q("metin")) || "";
      var p = vurgula(el("p", "ta-metin" + (gz && metin.length > 420 && !o.buyuk ? " iki" : "")), metin, EN ? o.vurgu_en : o.vurgu);
      if (gs.length) k.appendChild(galeri(gs, o.buyuk));
      k.appendChild(p);
      if (o.sonuc) { var sn = el("div", "ta-sonuc"); sn.append(el("b", null, EN ? "Outcome" : "Sonuç"), el("p", null, D2(o, "sonuc"))); k.appendChild(sn); }
      if (o.sina) k.appendChild(sinaSerit(o.sina));
      var kk = kaynakSatiri(o.kaynaklar || v.kaynaklar); if (kk) k.appendChild(kk);
      var kc = kaynakca(o.kaynakca); if (kc) k.appendChild(kc);
      return k;
    }
    // Sina'nın iki işgali: 1948–1990 arasında iki taralı dilim; bu olayın ait olduğu işgal öne çıkar
    function sinaSerit(n) {
      var Y0 = 1948, Y1 = 1990, y = function (t) { return ((t - Y0) / (Y1 - Y0) * 100).toFixed(2) + "%"; };
      var d = el("div", "ta-sina"); d.setAttribute("role", "img");
      d.setAttribute("aria-label", EN ? "Israeli occupation of Sinai: first 1956–57, second 1967–82" : "Sina’da İsrail işgali: birincisi 1956–57, ikincisi 1967–82");
      d.appendChild(el("p", "ta-sina-et", EN ? "Sinai: occupied twice, returned twice" : "Sina: iki kez işgal, iki kez iade"));
      var c = el("div", "ta-sina-cubuk"), lej = el("div", "ta-sina-lej");
      [1950, 1960, 1970, 1980, 1990].forEach(function (t) { var i = el("span", "ta-sina-yil", String(t)); i.style.left = y(t); c.appendChild(i); });
      [[1956.83, 1957.18, 1, EN ? "1st · 29 Oct 1956 – 8 Mar 1957" : "1. işgal · 29 Ekim 1956 – 8 Mart 1957"],
       [1967.43, 1982.31, 2, EN ? "2nd · 5 Jun 1967 – 25 Apr 1982" : "2. işgal · 5 Haziran 1967 – 25 Nisan 1982"]].forEach(function (x) {
        var b = el("span", "ta-sina-dilim" + (x[2] === n ? " su" : "")); b.style.left = y(x[0]); b.style.width = "calc(" + y(x[1]) + " - " + y(x[0]) + ")";
        c.appendChild(b);
        var e = el("p", "ta-sina-ad" + (x[2] === n ? " su" : ""), x[3]); lej.appendChild(e);
      });
      d.append(c, lej);
      return d;
    }
    // gazete kupürü: künye, başlık, büyük alıntı, açıklama
    function kupur(o) {
      var Q = function (x) { return D2(o, x); };
      var k = el("article", "ta-kupur izle"); k.dataset.yil = yil(o.tarih);
      k.appendChild(el("p", "ta-manset", Q("kunye")));
      k.appendChild(el("h3", null, Q("baslik")));
      var gs = gorseller(o, null);
      var gov = el("div", "ta-kupur-gov");
      if (gs.length) gov.appendChild(galeri(gs));
      var bq = el("blockquote", "ta-kupur-soz"); bq.textContent = "“" + Q("alinti") + "”"; gov.appendChild(bq);
      k.appendChild(gov);
      k.appendChild(vurgula(el("p", "ta-metin"), Q("metin"), EN ? o.vurgu_en : o.vurgu));
      var kk = kaynakSatiri(o.kaynaklar); if (kk) k.appendChild(kk);
      var kc = kaynakca(o.kaynakca); if (kc) k.appendChild(kc);
      return k;
    }
    // görseller kırpılmadan: tek görsel kendi oranında, birden çoksa satırlar oranlara göre paylaşılır; "buyuk" ise ilki tam genişlikte
    function galeri(gs, buyuk) {
      var g = el("div", "ta-galeri" + (gs.length > 1 ? " cok" : "") + (buyuk ? " buyuk" : ""));
      gs.forEach(function (x, i) {
        var f = el("figure", buyuk && i === 0 ? "ilk" : null);
        var b = el("button", "ta-g-dugme"); b.type = "button"; b.setAttribute("aria-label", (EN ? "Enlarge: " : "Büyüt: ") + (x.yazi || ""));
        var im = new Image(); im.src = x.src; im.alt = x.yazi || ""; im.loading = "lazy"; im.decoding = "async";
        im.onload = function () { if (im.naturalWidth) f.style.setProperty("--ar", (im.naturalWidth / im.naturalHeight).toFixed(3)); };
        im.onerror = function () { f.remove(); var kalan = g.querySelectorAll("figure").length; if (!kalan) g.remove(); else if (kalan < 2) g.classList.remove("cok"); };
        b.appendChild(im); b.appendChild(el("span", "ta-g-buyut", "⤢"));
        b.onclick = function () { lb.ac(gs, i); };
        f.appendChild(b);
        var fc = el("figcaption");
        if (x.yazi) fc.appendChild(el("span", null, x.yazi));
        if (x.kredi) { var a = el("a", "ta-g-kredi", (EN ? "Image: " : "Görsel: ") + x.kredi); if (x.sayfa) dis(a, x.sayfa); fc.appendChild(a); }
        f.appendChild(fc);
        if (x.ad) KUL[x.ad] = 1;
        g.appendChild(f);
      });
      return g;
    }
    function alinti(o) {
      var b = el("blockquote", "ta-alinti izle");
      var gs = gorseller(o, null);
      if (gs.length) { var im = new Image(); im.src = gs[0].src; im.alt = ""; im.className = "ta-alinti-yuz"; im.onerror = function () { im.remove(); }; b.appendChild(im); KUL[o.gorsel] = 1; }
      b.appendChild(el("span", "ta-tirnak", "“"));
      var az = D2(o, "alinti");
      if (az) b.appendChild(el("p", "ta-yer dolu" + (az.length > 400 ? " uzun" : ""), az));
      else b.appendChild(el("p", "ta-yer", D2(o, "yer_tutucu")));
      b.appendChild(el("cite", null, D2(o, "kisi") + " · " + D2(o, "eser")));
      if (o.metin) b.appendChild(el("p", "ta-alinti-ozet", D2(o, "metin")));
      return b;
    }
    function biyografi(o) {
      var b = el("article", "ta-bio izle");
      var ust = el("div", "ta-bio-ust");
      var gs = gorseller(o, null);
      if (gs.length) {
        var bd = el("button", "ta-g-dugme ta-bio-foto"); bd.type = "button"; bd.setAttribute("aria-label", EN ? "Enlarge photo" : "Fotoğrafı büyüt");
        var im = new Image(); im.src = gs[0].src; im.alt = o.kisi; im.loading = "lazy"; im.onerror = function () { bd.remove(); };
        bd.appendChild(im); bd.onclick = function () { lb.ac(gs, 0); }; ust.appendChild(bd); KUL[o.gorsel] = 1;
      }
      var b1 = el("div");
      b1.append(el("span", "ta-et", EN ? "Biography" : "Biyografi"), el("h3", null, EN ? o.kisi_en : o.kisi), el("p", "ta-bio-yil", o.yillar), el("p", null, EN ? o.ozet_en : o.ozet));
      ust.appendChild(b1); b.appendChild(ust);
      var ol = el("ol", "ta-bio-serit");
      (EN && o.satirlar_en ? o.satirlar_en : o.satirlar).forEach(function (s, i) { var li = el("li"); li.style.setProperty("--i", i); li.append(el("b", null, s[0]), el("span", null, N(s[1]))); ol.appendChild(li); });
      b.appendChild(ol);
      var kk = kaynakSatiri(o.kaynaklar); if (kk) b.appendChild(kk);
      var kc = kaynakca(o.kaynakca); if (kc) b.appendChild(kc);
      return b;
    }
    function kunyeYaz(kl) {
      var L = K.filter(function (k) { return KUL[k.ad]; });
      if (!L.length) return;
      kl.appendChild(document.createTextNode(EN ? "Images: " : "Görseller: "));
      L.forEach(function (x, i) {
        if (i) kl.appendChild(document.createTextNode(" · "));
        kl.appendChild(dis(el("a", null, (EN ? x.en : x.tr) + ", " + kredi(x.yazar) + ", " + x.lisans), x.sayfa));
      });
    }

    // --- gazete sayfası: solda özgün Arapça sayfa, sağda aynı başlıkların Türkçesi (EN: İngilizcesi) ---
    function gazeteKars(G) {
      var f = el("figure", "ta-kars ta-gz izle");
      var ust = el("div", "ta-kars-ust");
      ust.append(el("span", "ta-kars-et", EN ? "Newspaper · original and translation" : "Gazete · özgün ve çeviri"),
        el("p", "ta-kars-baslik", G.ad + " · " + (EN ? G.tarih_en : G.tarih)));
      f.appendChild(ust);
      // sayfalar alt alta: her sayfa kendi kaydırıcısı ve altında eksiksiz çevirisiyle; üstte sayfaya atlama çubuğu
      var EK = { 1: "’in", 2: "’nin", 3: "’ün", 4: "’ün", 5: "’in", 6: "’nın", 7: "’nin", 8: "’in", 9: "’un", 10: "’un" };
      if (G.sayfalar.length > 2) {
        var git = el("nav", "ta-gz-git"); git.setAttribute("aria-label", EN ? "Jump to page" : "Sayfaya git");
        git.appendChild(el("span", null, EN ? "Pages:" : "Sayfalar:"));
        G.sayfalar.forEach(function (S) {
          var d = el("button", null, String(S.no)); d.type = "button";
          d.onclick = function () { var h = f.querySelector('[data-gz-sayfa="' + S.no + '"]'); if (h) h.scrollIntoView({ behavior: "smooth", block: "start" }); };
          git.appendChild(d);
        });
        f.appendChild(git);
      }
      G.sayfalar.forEach(function (S) {
        var blok = el("section", "ta-gz-sayfa"); blok.dataset.gzSayfa = S.no;
        blok.appendChild(el("h4", "ta-gz-sayfa-no", (EN ? "Page " : "Sayfa ") + S.no));
        var sahne = el("div", "ta-kk-sahne");
        var kutu = el("div", "ta-kk ta-gz-kk");
        var im = new Image(); im.alt = (EN ? "Original page: " : "Özgün sayfa: ") + G.ad + ", " + (EN ? G.tarih_en : G.tarih) + ", " + (EN ? "p. " : "s. ") + S.no;
        im.onload = function () { kutu.style.setProperty("--oran", (im.naturalWidth / im.naturalHeight).toFixed(4)); };
        kutu.style.setProperty("--oran", "0.665");
        im.src = S.gorsel; im.decoding = "async"; im.loading = "lazy";
        var once = el("div", "kk-katman kk-once"); once.appendChild(im);
        var ceviri = el("div", "kk-katman kk-sonra ta-gz-ceviri");
        var bas = el("div", "ta-gz-kunye");
        bas.append(el("span", null, (EN ? G.yer_en : G.yer) + " · " + (EN ? G.tarih_en : G.tarih)), el("b", null, G.ad_ar + " · " + G.ad.toUpperCase()), el("span", null, (EN ? G.sayi_en : G.sayi) + " · " + (EN ? "p. " : "s. ") + S.no));
        ceviri.appendChild(bas);
        S.satirlar.forEach(function (x) { var t = el(x.tip === "manset" ? "h4" : "p", "ta-gz-" + x.tip, EN ? x.en : x.tr); t.lang = EN ? "en" : "tr"; ceviri.appendChild(t); });
        kutu.append(ceviri, once);
        var dg = kaydirici(kutu, EN ? "Original · Arabic" : "Özgün · Arapça", EN ? "English" : "Türkçe", EN ? "Compare original and translation" : "Özgün ve çeviriyi karşılaştır");
        sahne.appendChild(kutu);
        blok.append(sahne, dg);
        if (S.tam && S.tam.length) {
          var ic = el("div", "ta-gz-tam-ic"); ic.lang = EN ? "en" : "tr";
          ic.appendChild(el("p", "ta-gz-tam-et", EN ? "Full translation of page " + S.no : "Sayfa " + S.no + (EK[S.no] || "’in") + " tam çevirisi"));
          S.tam.forEach(function (x) { ic.appendChild(el(x.tip === "baslik" ? "h5" : "p", "ta-gz-t-" + x.tip, EN ? x.en : x.tr)); });
          blok.appendChild(ic);
        }
        f.appendChild(blok);
      });
      var kk = el("p", "ta-kars-kaynak");
      kk.appendChild(dis(el("a", null, (EN ? G.kaynak.ad_en : G.kaynak.ad) + " ↗"), G.kaynak.url));
      kk.appendChild(document.createTextNode(" · " + (EN ? G.lisans_en : G.lisans) + (EN ? " Translated from the Arabic by Alboroto; illegible words are marked." : " Arapçadan Alboroto çevirdi; okunamayan sözcükler belirtildi.")));
      f.appendChild(kk);
      return f;
    }

    // --- önce/sonra haritası ---
    function haritaKars(k) {
      var m1 = A.haritalar[k.once], m2 = A.haritalar[k.sonra];
      var pen = m2.pencere === "genis" ? "genis" : "yakin";
      var vb = HR.kutu(pen, k.kesit);
      var f = el("figure", "ta-kars izle");
      var ust = el("div", "ta-kars-ust");
      ust.append(el("span", "ta-kars-et", EN ? "Map · before and after" : "Harita · önce ve sonra"),
        el("p", "ta-kars-baslik", m1.yil + " → " + m2.yil));
      f.appendChild(ust);
      var kutu = el("div", "ta-kk");
      kutu.style.setProperty("--oran", (vb[2] / vb[3]).toFixed(4));
      kutu.yap = function () {
        kutu.insertBefore(katman(HR.ciz(pen, k.sonra, k.kesit), "kk-sonra"), kutu.firstChild);
        kutu.insertBefore(katman(HR.ciz(pen, k.once, k.kesit), "kk-once"), kutu.children[1]);
      };
      var dg = kaydirici(kutu, m1.yil, m2.yil, (EN ? "Compare " : "Karşılaştır: ") + m1.yil + " / " + m2.yil);
      var sahne = el("div", "ta-kk-sahne"); sahne.appendChild(kutu);
      f.append(sahne, dg);
      var notlar = el("div", "ta-kars-not");
      [m1, m2].forEach(function (m, i) {
        var d = el("div", i ? "sonra" : "once");
        var b = el("p", "ta-kars-ad"); b.append(el("b", null, m.yil), document.createTextNode(" " + D2(m, "ad")));
        d.append(b, el("p", null, D2(m, "not") || ""));
        notlar.appendChild(d);
      });
      f.appendChild(notlar);
      f.appendChild(el("p", "ta-kars-kaynak", pen === "genis"
        ? (EN ? "Relief: AWS Terrain Tiles · coastlines and borders: Natural Earth · zones and fronts schematic" : "Arazi: AWS Terrain Tiles · kıyılar ve sınırlar: Natural Earth · bölgeler ve cepheler şematik")
        : (EN ? "Relief: AWS Terrain Tiles · borders: Natural Earth · 1947 plan and Oslo areas traced from public-domain maps, approximate" : "Arazi: AWS Terrain Tiles · sınırlar: Natural Earth · 1947 planı ve Oslo bölgeleri kamu malı haritalardan izlendi, yaklaşık")));
      tembel(kutu);
      return f;
    }
    function katman(icerik, sinif) { var d = el("div", "kk-katman " + sinif); d.appendChild(icerik); return d; }

    // --- önce/sonra uydu görüntüsü ---
    // bugünkü Gazze (Sentinel-2) ile savaş öncesi; üstte OCHA haritasından çıkarılmış sarı hat ve kısıtlı alan
    function uyduGazze(U, m) {
      var K = "data/gorsel/uydu/", gun = new Date().toISOString().slice(0, 10);
      var t1 = tarihAd(U.once), t2 = tarihAd(U.tarih), S = U.sari;
      var f = el("figure", "ta-kars uydu izle");
      var ust = el("div", "ta-kars-ust");
      ust.append(el("span", "ta-kars-et", EN ? "Satellite · before and today" : "Uydu · önce ve bugün"), el("p", "ta-kars-baslik", yil(U.once) + " → " + yil(U.tarih)));
      f.appendChild(ust);
      var kutu = el("div", "ta-kk"); kutu.style.setProperty("--oran", "0.84");
      var sahne = el("div", "ta-kk-sahne"); sahne.appendChild(kutu);
      var dg = kaydirici(kutu, t1, t2, (EN ? "Compare " : "Karşılaştır: ") + t1 + " / " + t2);
      var ust2 = svg("svg", { viewBox: "0 0 1 1", preserveAspectRatio: "none", "class": "kk-ust", "aria-hidden": "true" });
      var d = function (hs) { return hs.map(function (h) { return "M" + h.map(function (p) { return p[0] + " " + p[1]; }).join("L") + "Z"; }).join(""); };
      var L = S.katmanlar;
      if (L.kisitli) ust2.appendChild(svg("path", { d: d(L.kisitli), "class": "kk-kisitli", "fill-rule": "evenodd" }));
      if (L.turuncu) ust2.appendChild(svg("path", { d: d(L.turuncu).replace(/Z/g, ""), "class": "kk-turuncu" }));
      if (L.sari) ust2.appendChild(svg("path", { d: d(L.sari).replace(/Z/g, ""), "class": "kk-sari" }));
      var gizle = el("button", "kk-gizle", EN ? "Hide lines" : "Çizgileri gizle"); gizle.type = "button";
      gizle.onclick = function () { var g = kutu.classList.toggle("kk-cizgisiz"); gizle.textContent = g ? (EN ? "Show lines" : "Çizgileri göster") : (EN ? "Hide lines" : "Çizgileri gizle"); };
      kutu.yap = function () {
        var y = function (src, alt) { var im = new Image(); im.src = K + src + "?t=" + gun; im.alt = alt; im.decoding = "async"; im.draggable = false; return im; };
        var i2 = y("gazze.jpg", (EN ? "The Gaza Strip from space, " : "Uydudan Gazze Şeridi, ") + t2), i1 = y(U.gazze_once, (EN ? "The Gaza Strip from space, " : "Uydudan Gazze Şeridi, ") + t1);
        i2.onload = function () { if (i2.naturalWidth) kutu.style.setProperty("--oran", (i2.naturalWidth / i2.naturalHeight).toFixed(4)); };
        kutu.insertBefore(katman(i2, "kk-sonra"), kutu.firstChild);
        kutu.insertBefore(katman(i1, "kk-once"), kutu.children[1]);
        kutu.insertBefore(ust2, kutu.children[2]);
      };
      f.append(sahne, dg);
      dg.appendChild(gizle);
      var lej = el("div", "ta-kars-lej");
      [["sari", EN ? "Yellow line, 10 October 2025 agreement" : "Sarı hat, 10 Ekim 2025 anlaşması"],
       ["turuncu", EN ? "Edge of the restricted area, November 2026" : "Kısıtlı alanın sınırı, Kasım 2026"],
       ["kisitli", EN ? "Restricted: about 65% of Gaza" : "Kısıtlı: Gazze’nin yaklaşık %65’i"]].forEach(function (x) { var s = el("span", "lej-" + x[0]); s.appendChild(el("i")); s.appendChild(document.createTextNode(x[1])); lej.appendChild(s); });
      f.appendChild(lej);
      nasilEkle(f, m); f.appendChild(el("p", "ta-kars-not tek", D2(m, "not")));
      f.appendChild(el("p", "ta-kars-kaynak", (EN ? "Images: Copernicus Sentinel-2 (ESA), " : "Görüntüler: Copernicus Sentinel-2 (ESA), ") + t1 + ", " + t2 + (EN ? ". Lines: " : ". Çizgiler: ") + "OCHA oPt, " + tarihAd(S.tarih) + (EN ? ", approximate." : ", yaklaşık.")));
      tembel(kutu);
      return f;
    }

    // eski hava fotoğrafı mozaiği ile uydu: birkaç çift arasında sekmeler; "bugün" günlük uydu karesinden kesilir
    function havaKars(h) {
      var gun = new Date().toISOString().slice(0, 10), K = h.katmanlar;
      var ad = function (k) { return k === "bugun" ? (EN ? "Today" : "Bugün") : K[k].etiket ? D2(K[k], "etiket") : tarihAd(K[k].tarih); };
      var f = el("figure", "ta-kars uydu izle");
      var ust = el("div", "ta-kars-ust"), bas = el("p", "ta-kars-baslik");
      ust.append(el("span", "ta-kars-et", EN ? "Aerial photograph and satellite · before and after" : "Hava fotoğrafı ve uydu · önce ve sonra"), bas);
      f.appendChild(ust);
      var sekme = el("div", "ta-kars-sekme"); sekme.setAttribute("role", "tablist"); f.appendChild(sekme);
      var kutu = el("div", "ta-kk"); kutu.style.setProperty("--oran", (h.oran || 1).toFixed(4));
      var sahne = el("div", "ta-kk-sahne"); sahne.appendChild(kutu);
      var dg = kaydirici(kutu, ad(h.ciftler[0][0]), ad(h.ciftler[0][1]), EN ? "Compare before and after" : "Önce ve sonrayı karşılaştır");
      var secili = 0;
      function resim(k) {
        var L = K[k], im = new Image(); im.decoding = "async"; im.draggable = false;
        im.src = L.src + (L.gunluk ? "?t=" + gun : ""); im.alt = (h.yer ? D2(h, "yer") : (EN ? "Gaza City" : "Gazze kenti")) + ", " + ad(k);
        if (L.gri) im.className = "kk-gri";
        if (L.kesit) {   // kare içinden kesit: [x, y, genişlik, yükseklik] oran olarak
          var c = L.kesit;
          im.style.cssText = "inset:auto;object-fit:fill;width:" + (100 / c[2]).toFixed(3) + "%;height:" + (100 / c[3]).toFixed(3) + "%;left:" + (-100 * c[0] / c[2]).toFixed(3) + "%;top:" + (-100 * c[1] / c[3]).toFixed(3) + "%";
        }
        return im;
      }
      function goster(i) {
        secili = i;
        var c = h.ciftler[i];
        Array.prototype.forEach.call(sekme.children, function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
        Array.prototype.slice.call(kutu.querySelectorAll(".kk-katman")).forEach(function (x) { x.remove(); });
        kutu.insertBefore(katman(resim(c[1]), "kk-sonra"), kutu.firstChild);
        kutu.insertBefore(katman(resim(c[0]), "kk-once"), kutu.children[1]);
        kutu.querySelector(".kk-et.sol").textContent = ad(c[0]); kutu.querySelector(".kk-et.sag").textContent = ad(c[1]);
        dg.children[0].textContent = "◂ " + ad(c[0]); dg.children[1].textContent = ad(c[1]) + " ▸";
        bas.textContent = c.map(function (k) { return k === "bugun" ? String(new Date().getFullYear()) : k; }).join(" → ");
      }
      h.ciftler.forEach(function (c, i) {
        var b = el("button", "ta-kars-sekme-d", c.map(function (k) { return k === "bugun" ? (EN ? "today" : "bugün") : k; }).join(" · ")); b.type = "button"; b.setAttribute("role", "tab");
        b.onclick = function () { goster(i); };
        sekme.appendChild(b);
      });
      kutu.yap = function () { goster(secili); };
      bas.textContent = h.ciftler[0].join(" → ");
      f.append(sahne, dg);
      nasilEkle(f, h); f.appendChild(el("p", "ta-kars-not tek", D2(h, "not")));
      var kay = el("p", "ta-kars-kaynak", D2(h, "kaynak") + " ");
      if (h.sayfa) kay.appendChild(dis(el("a", null, EN ? "Source ↗" : "Kaynak ↗"), h.sayfa));
      f.appendChild(kay);
      Array.prototype.forEach.call(sekme.children, function (b, j) { b.setAttribute("aria-selected", String(j === 0)); });
      tembel(kutu);
      return f;
    }

    // "Neye bakıyorsunuz?": görüntüyü okumayı bilmeyen okur için kısa bir rehber
    function nasilEkle(f, x) {
      var t = D2(x, "nasil"); if (!t) return;
      var k = el("div", "ta-kars-nasil");
      k.append(el("b", "", EN ? "What am I looking at?" : "Neye bakıyorsunuz?"), el("p", "", t));
      f.appendChild(k);
    }
    function uyduKars(u) {
      var f = el("figure", "ta-kars uydu izle");
      var t1 = tarihAd(u.tarih_once), t2 = tarihAd(u.tarih_sonra);
      var ust = el("div", "ta-kars-ust");
      ust.append(el("span", "ta-kars-et", EN ? "Satellite · before and after" : "Uydu · önce ve sonra"), el("p", "ta-kars-baslik", yil(u.tarih_once) + " → " + yil(u.tarih_sonra)));
      f.appendChild(ust);
      var sekme = el("div", "ta-kars-sekme"); sekme.setAttribute("role", "tablist");
      f.appendChild(sekme);
      var kutu = el("div", "ta-kk"); kutu.style.setProperty("--oran", "1.3333");
      var sahne = el("div", "ta-kk-sahne"); sahne.appendChild(kutu);
      var dg = kaydirici(kutu, t1, t2, (EN ? "Compare " : "Karşılaştır: ") + t1 + " / " + t2);
      var secili = 0;
      function goster(i) {
        secili = i;
        Array.prototype.forEach.call(sekme.children, function (b, j) { b.setAttribute("aria-selected", String(i === j)); });
        Array.prototype.slice.call(kutu.querySelectorAll(".kk-katman")).forEach(function (x) { x.remove(); });
        var B = u.bolgeler[i], ad = D2(B, "ad");
        var y = function (s, alt) { var im = new Image(); im.src = "site/tarihce-uydu/" + B.dosya + "-" + s + ".jpg"; im.alt = ad + ", " + alt; im.decoding = "async"; im.draggable = false; return im; };
        var i2 = y("sonra", t2), i1 = y("once", t1);
        i2.onload = function () { if (i2.naturalWidth) kutu.style.setProperty("--oran", (i2.naturalWidth / i2.naturalHeight).toFixed(4)); };
        kutu.insertBefore(katman(i2, "kk-sonra"), kutu.firstChild);
        kutu.insertBefore(katman(i1, "kk-once"), kutu.children[1]);
      }
      u.bolgeler.forEach(function (B, i) {
        var b = el("button", "ta-kars-sekme-d", D2(B, "ad")); b.type = "button"; b.setAttribute("role", "tab");
        b.onclick = function () { goster(i); };
        sekme.appendChild(b);
      });
      kutu.yap = function () { goster(secili); };
      f.append(sahne, dg);
      nasilEkle(f, u); f.appendChild(el("p", "ta-kars-not tek", D2(u, "not")));
      f.appendChild(el("p", "ta-kars-kaynak", D2(u, "kaynak")));
      Array.prototype.forEach.call(sekme.children, function (b, j) { b.setAttribute("aria-selected", String(j === 0)); });
      tembel(kutu);
      return f;
    }

    // görünüme yaklaşınca çiz; ilk kez iyice görününce perdeyi bir kez oynat (nasıl kullanılacağını göstermek için)
    // Not: gözlemci ilk çağrıda kurulur; tembel() akış çizilirken, bu satırlardan önce çağrılıyor
    var tembelIO;
    function gozlemci() { return tembelIO || (tembelIO = "IntersectionObserver" in window ? new IntersectionObserver(function (xs) {
      xs.forEach(function (x) {
        var k = x.target;
        if (x.isIntersecting && !k.yapildi) { k.yapildi = true; k.yap(); }
        if (x.isIntersecting && x.intersectionRatio > 0.55 && !k.oynadi && !AZALT) {
          k.oynadi = true; if (k.gosteri) k.gosteri();
        }
      });
    }, { rootMargin: "700px 0px", threshold: [0, 0.6] }) : false); }
    function tembel(k) { var g = gozlemci(); if (g) g.observe(k); else { k.yapildi = true; k.yap(); } }

    terimKur(A.sozluk || []);
    ilerlemeKur();
  }

  // --- Nekbe ve Nekse: bu olaylar ekranın ortasına geldiğinde sayfa siyaha döner ---
  function karanlikKur(serit) {
    if (!("IntersectionObserver" in window)) return;
    var gorunen = new Set();
    var io = new IntersectionObserver(function (xs) {
      xs.forEach(function (x) { if (x.isIntersecting) gorunen.add(x.target); else gorunen.delete(x.target); });
      var koyu = false; gorunen.forEach(function (e) { if (e.dataset.karanlik) koyu = true; });
      document.body.classList.toggle("ta-karanlik", koyu);
    }, { rootMargin: "-42% 0px -42% 0px" });
    Array.prototype.forEach.call(serit.children, function (e) {
      // karşılaştırma figürleri de bir önceki olayın hâlini alır
      if (!e.dataset.karanlik) { var p = e.previousElementSibling; if (p && p.dataset.karanlik && /ta-kars/.test(e.className)) e.dataset.karanlik = "1"; }
      io.observe(e);
    });
  }

  // --- bilgi notları: sözlükteki örgüt ve kavram adları her kartta ilk geçtiği yerde işaretlenir; dokununca kısa not açılır ---
  function terimKur(S) {
    if (!S.length) return;
    var esle = [];
    S.forEach(function (t) { t.esler.forEach(function (e) { esle.push({ e: e, t: t }); }); });
    esle.sort(function (a, b) { return b.e.length - a.e.length; });
    var re = new RegExp("(" + esle.map(function (x) { return x.e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")");
    var bul = function (s) { for (var i = 0; i < esle.length; i++) if (esle[i].e === s) return esle[i].t; return null; };
    var kutu = el("div", "ta-terim-kutu"); kutu.hidden = true; kutu.setAttribute("role", "dialog");
    var kb = el("b"), kp = el("p"), ke = el("span", "ta-terim-et", EN ? "Note" : "Bilgi notu");
    kutu.append(ke, kb, kp); document.body.appendChild(kutu);
    var acik = null;
    function kapa() { kutu.hidden = true; if (acik) acik.setAttribute("aria-expanded", "false"); acik = null; }
    function ac(d, t) {
      if (acik === d) { kapa(); return; }
      kapa(); acik = d; d.setAttribute("aria-expanded", "true");
      kb.textContent = D2(t, "ad"); kp.textContent = D2(t, "not");
      kutu.hidden = false;
      var r = d.getBoundingClientRect(), w = Math.min(340, innerWidth - 24);
      kutu.style.width = w + "px";
      kutu.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left)) + scrollX + "px";
      kutu.style.top = r.bottom + scrollY + 8 + "px";
    }
    document.addEventListener("click", function (e) { if (acik && !kutu.contains(e.target) && !e.target.closest(".ta-terim")) kapa(); });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && acik) { var d = acik; kapa(); d.focus(); } });
    addEventListener("resize", kapa);
    document.querySelectorAll(".ta-kart, .ta-kupur, .ta-acilis, .ta-alinti, .ta-bio").forEach(function (kart) {
      var gorulen = {};
      var y = document.createTreeWalker(kart, NodeFilter.SHOW_TEXT, { acceptNode: function (n) {
        var u = n.parentNode;
        if (!u || u.closest("a, button, h2, h3, figcaption, .ta-kaynaklar, .ta-kaynakca, .ta-akis-et, .ta-tarih, .ta-manset, time, cite")) return NodeFilter.FILTER_REJECT;
        return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      } });
      var dugumler = []; while (y.nextNode()) dugumler.push(y.currentNode);
      dugumler.forEach(function (n) {
        var parcalar = n.nodeValue.split(re); if (parcalar.length < 2) return;
        var frag = document.createDocumentFragment(), degisti = false;
        parcalar.forEach(function (p, i) {
          var t = i % 2 ? bul(p) : null;
          if (t && !gorulen[t.ad]) {
            gorulen[t.ad] = 1; degisti = true;
            var d = el("button", "ta-terim", p); d.type = "button"; d.setAttribute("aria-expanded", "false");
            d.setAttribute("aria-label", p + (EN ? ": note" : ": bilgi notu"));
            d.onclick = function (e) { e.stopPropagation(); ac(d, t); };
            frag.appendChild(d);
          } else if (p) frag.appendChild(document.createTextNode(p));
        });
        if (degisti) n.parentNode.replaceChild(frag, n);
      });
    });
  }

  // --- önce/sonra perdesi: sürükle, dokun, ok tuşları, iki düğme ---
  function kaydirici(kutu, solAd, sagAd, aria) {
    var cizgi = el("span", "kk-cizgi"); cizgi.appendChild(el("span", "kk-tutamak"));
    kutu.append(cizgi, el("span", "kk-et sol", solAd), el("span", "kk-et sag", sagAd));
    var deger = 50, bas = null;
    var dugmeler = el("div", "ta-kk-dugmeler");
    function ayar(v, yumusak) {
      deger = Math.max(0, Math.min(100, v));
      kutu.classList.toggle("kk-yumusak", !!yumusak);
      kutu.style.setProperty("--uk", deger + "%");
      kutu.setAttribute("aria-valuenow", String(Math.round(deger)));
      kutu.classList.toggle("kk-kenar", deger < 12 || deger > 88);
      Array.prototype.forEach.call(dugmeler.children, function (b) { b.setAttribute("aria-pressed", String((b.dataset.v === "100" && deger > 97) || (b.dataset.v === "0" && deger < 3))); });
    }
    function oran(x) { var r = kutu.getBoundingClientRect(); return ((x - r.left) / Math.max(1, r.width)) * 100; }
    // yalnızca yatay hareket perdeyi taşır; dikey hareket sayfaya kalır (touch-action: pan-y)
    kutu.addEventListener("pointerdown", function (e) { bas = { x: e.clientX, id: e.pointerId, surukle: false }; });
    kutu.addEventListener("pointermove", function (e) {
      if (!bas || e.pointerId !== bas.id) return;
      if (!bas.surukle) { if (Math.abs(e.clientX - bas.x) < 6) return; bas.surukle = true; kutu.classList.add("kk-surukle"); try { kutu.setPointerCapture(e.pointerId); } catch (x) {} }
      e.preventDefault(); ayar(oran(e.clientX));
    });
    function bit(e) { if (bas && !bas.surukle && e && e.type === "pointerup") ayar(oran(e.clientX), true); bas = null; kutu.classList.remove("kk-surukle"); }
    kutu.addEventListener("pointerup", bit); kutu.addEventListener("pointercancel", function () { bas = null; kutu.classList.remove("kk-surukle"); });
    kutu.tabIndex = 0; kutu.setAttribute("role", "slider"); kutu.setAttribute("aria-valuemin", "0"); kutu.setAttribute("aria-valuemax", "100");
    kutu.setAttribute("aria-label", aria);
    kutu.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); ayar(deger + (e.key === "ArrowRight" ? 5 : -5)); }
      else if (e.key === "Home" || e.key === "End") { e.preventDefault(); ayar(e.key === "End" ? 100 : 0, true); }
    });
    [["100", "◂ " + solAd], ["0", sagAd + " ▸"]].forEach(function (x) {
      var b = el("button", null, x[1]); b.type = "button"; b.dataset.v = x[0];
      b.onclick = function () { var v = +x[0]; ayar((v === 100 && deger > 97) || (v === 0 && deger < 3) ? 50 : v, true); };
      dugmeler.appendChild(b);
    });
    // Açılış gösterisi: önce eski harita; yeni harita sağdan gelir, geri çekilir, eski bir an kalır,
    // yeni harita yeniden gelir ve kalır. Kullanıcı dokunursa ya da tuşa basarsa gösteri o an durur.
    var gosteriNo = 0;
    function dur() { gosteriNo++; }
    kutu.addEventListener("pointerdown", dur); kutu.addEventListener("keydown", dur); dugmeler.addEventListener("click", dur);
    kutu.gosteri = function () {
      var no = ++gosteriNo, adimlar = [[100, 100, 700], [100, 0, 1400], [0, 0, 450], [0, 100, 1400], [100, 100, 650], [100, 0, 1400]];
      var i = 0, t0 = null;
      function yumusat(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
      function kare(t) {
        if (no !== gosteriNo) return;
        if (t0 === null) t0 = t;
        var a = adimlar[i], g = Math.min(1, (t - t0) / a[2]);
        ayar(a[0] + (a[1] - a[0]) * yumusat(g));
        if (g >= 1) { i++; t0 = t; if (i >= adimlar.length) return; }
        requestAnimationFrame(kare);
      }
      requestAnimationFrame(kare);
    };
    // gösteri oynayacaksa perde eski haritada başlar; hareket azaltılmışsa ortada durur
    ayar(AZALT || !("IntersectionObserver" in window) ? 50 : 100);
    return dugmeler;
  }

  // --- fotoğraf büyütme: tam ekran, künyeyle; oklar ve Esc ---
  function isikKutusu() {
    var k = el("div", "ta-lb"); k.hidden = true; k.setAttribute("role", "dialog"); k.setAttribute("aria-modal", "true"); k.setAttribute("aria-label", EN ? "Image" : "Görsel");
    var im = new Image(), fc = el("p", "ta-lb-yazi"), say = el("span", "ta-lb-say");
    var kapat = el("button", "ta-lb-kapat", "×"); kapat.type = "button"; kapat.setAttribute("aria-label", EN ? "Close" : "Kapat");
    var geri = el("button", "ta-lb-ok geri", "‹"); geri.type = "button"; geri.setAttribute("aria-label", EN ? "Previous" : "Önceki");
    var ileri = el("button", "ta-lb-ok ileri", "›"); ileri.type = "button"; ileri.setAttribute("aria-label", EN ? "Next" : "Sonraki");
    var sahne = el("div", "ta-lb-sahne"); sahne.appendChild(im);
    k.append(sahne, fc, say, geri, ileri, kapat);
    document.body.appendChild(k);
    var L = [], i = 0, onceki = null;
    function goster() {
      var x = L[i]; im.src = x.src; im.alt = x.yazi || "";
      fc.textContent = "";
      if (x.yazi) fc.appendChild(el("span", null, x.yazi + " "));
      if (x.kredi) { var a = el("a", null, (EN ? "Image: " : "Görsel: ") + x.kredi + " ↗"); if (x.sayfa) dis(a, x.sayfa); fc.appendChild(a); }
      say.textContent = L.length > 1 ? (i + 1) + " / " + L.length : "";
      geri.hidden = ileri.hidden = L.length < 2;
    }
    function kapa() { k.hidden = true; document.documentElement.classList.remove("ta-lb-acik"); if (onceki) onceki.focus(); }
    kapat.onclick = kapa;
    k.addEventListener("click", function (e) { if (e.target === k || e.target === sahne) kapa(); });
    geri.onclick = function () { i = (i - 1 + L.length) % L.length; goster(); };
    ileri.onclick = function () { i = (i + 1) % L.length; goster(); };
    addEventListener("keydown", function (e) {
      if (k.hidden) return;
      if (e.key === "Escape") kapa();
      else if (e.key === "ArrowLeft" && L.length > 1) geri.onclick();
      else if (e.key === "ArrowRight" && L.length > 1) ileri.onclick();
    });
    return { ac: function (liste, n) { L = liste; i = n || 0; onceki = document.activeElement; goster(); k.hidden = false; document.documentElement.classList.add("ta-lb-acik"); kapat.focus(); } };
  }

  // Harfleri ayrı ayrı sarar; her harf rastgele bir yerden gelip yerine oturur (--dx, --dy, --r)
  function harfle(e, metin) {
    e.setAttribute("aria-label", metin);
    var tohum = metin.length * 7;
    function r() { tohum = (tohum * 9301 + 49297) % 233280; return tohum / 233280; }
    metin.split(" ").forEach(function (kelime, ki) {
      if (ki) e.appendChild(document.createTextNode(" "));
      var w = el("span", "ta-kelime"); w.setAttribute("aria-hidden", "true");
      kelime.split("").forEach(function (h) {
        var s = el("span", "ta-harf", h);
        s.style.setProperty("--dx", ((r() - .5) * 220).toFixed(0) + "px");
        s.style.setProperty("--dy", ((r() - .3) * 160).toFixed(0) + "px");
        s.style.setProperty("--r", ((r() - .5) * 70).toFixed(0) + "deg");
        w.appendChild(s);
      });
      e.appendChild(w);
    });
  }
  // Tatriz (Filistin nakışı) şeridi: çarpı işleri sırayla belirir
  function tatriz(n, cls) {
    var s = svg("svg", { "class": cls, viewBox: "0 0 " + n * 12 + " 24", preserveAspectRatio: "xMidYMid meet", "aria-hidden": "true" });
    for (var i = 0; i < n; i++) {
      var g = svg("g", { "class": "ta-dikis", transform: "translate(" + (i * 12 + 6) + " 12)" });
      g.style.setProperty("--i", i / n);
      var b = (i % 6 < 3) ? 4 : 2.6;
      g.appendChild(svg("path", { d: "M-" + b + " -" + b + "L" + b + " " + b + "M" + b + " -" + b + "L-" + b + " " + b }));
      if (i % 6 === 1 || i % 6 === 4) g.appendChild(svg("path", { d: "M0 -9L0 -6M0 6L0 9", "class": "ince" }));
      s.appendChild(g);
    }
    return s;
  }

  // --- haritalar: yakın (tarihî Filistin) ve geniş (Anadolu'dan Hicaz'a) iki çizim. ciz(pencere, hâl, kesit) yeni bir SVG döndürür;
  // her SVG kendi kimlikleriyle (clipPath, desen) çizilir, böylece aynı sayfada çok sayıda harita yan yana durabilir.
  function haritaci(H, H2) {
    var sayac = 0;
    // projeksiyon: iki pencere de doğrusal (enlem-boylam dikdörtgeni)
    function P(M, lon, lat) { var p = M.pencere; return [(lon - p[0]) / (p[1] - p[0]) * M.w, (p[3] - lat) / (p[3] - p[2]) * M.h]; }
    var gk = H.gazze_kutu;
    var KES = {
      misir: H2.kesit && H2.kesit.misir,
      bs: H.bs_kutu,
      gz: [Math.round(((gk[0] + gk[2]) / 2 - 41) * 10) / 10, Math.round(((gk[1] + gk[3]) / 2 - 47) * 10) / 10, 82, 94]
    };
    var SON = ["sinir", "kayip", "ulkeT"];
    var KATLAR = {
      tam: ["osm", "misir", "osmT"],
      manda: ["sinir", "tam", "manda", "ulkeT"],
      plan1947: SON.concat(["plan1947Y", "plan1947", "plan1947K", "planT"]),
      "1949": SON.concat(["bati", "gazze", "bsT", "gzT"]),
      "1967": SON.concat(["bati", "gazze", "isgal", "bsT", "gzT"]),
      osloABC: SON.concat(["osloC", "osloB", "osloA", "osloY", "gazze", "bsT"]),
      oslo: SON.concat(["osloC", "osloB", "osloA", "gazze", "yerlesim", "bsT", "gzT"]),
      cekilme: SON.concat(["osloC", "osloB", "osloA", "gazze", "yerlesimBos", "gzT"]),
      abluka: SON.concat(["osloC", "osloB", "osloA", "gazze", "ablukaH", "gzT"]),
      sari: SON.concat(["osloC", "osloB", "osloA", "gazze", "ablukaH", "sari", "gzT"]),
      osm1914: ["osm1914", "demiryolu", "osmG"],
      sykes: ["sykes", "sykesT"],
      mandalar: ["mandalar", "sinirG", "mandaT"]
    };
    var G49 = ["filK", "psxF", "sinirG", "kanal", "gT", "noktaT"];
    KATLAR.g1949 = G49;
    KATLAR.g1957 = G49.concat(["t57"]);
    KATLAR.g1956 = G49.concat(["sinaI", "gazaI", "t56"]);
    KATLAR.g1967 = G49.concat(["sinaI", "psxI", "golanI"]);
    KATLAR.g1973 = G49.concat(["sinaI", "psxI", "golanI", "kopru73", "cep73", "t73"]);
    KATLAR.g1982 = G49.concat(["psxI", "golanI", "t82"]);

    function kutu(pen, kesit) { var M = pen === "genis" ? H2 : H; return kesit && KES[kesit] ? KES[kesit] : [0, 0, M.w, M.h]; }

    function ciz(pen, durum, kesit) {
      var genis = pen === "genis", M = genis ? H2 : H, u = "th" + (++sayac);
      var vb = kutu(pen, kesit), L = KATLAR[durum] || [];
      var var_ = function (n) { return L.indexOf(n) >= 0; };
      var o = kesit ? Math.max(vb[2] / M.w, vb[3] / M.h) : 1;   // yazı ve işaret ölçeği: kesitte yazılar ekranda aynı boyda kalsın
      var s = svg("svg", { viewBox: vb.join(" "), preserveAspectRatio: "xMidYMid meet", "class": "ta-hsvg " + pen, role: "img",
        "aria-label": (genis ? (EN ? "Map of the region" : "Bölge haritası") : (EN ? "Map of historic Palestine" : "Tarihî Filistin haritası")) });
      s.style.setProperty("--o", o.toFixed(3));
      var defs = svg("defs"); s.appendChild(defs);
      function klip(ad, yollar) { var c = svg("clipPath", { id: u + ad }); yollar.forEach(function (d) { c.appendChild(svg("path", { d: d })); }); defs.appendChild(c); }
      var ds = (genis ? 7 : 6) * o;
      var tar = svg("pattern", { id: u + "tar", width: ds, height: ds, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      tar.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: ds, "class": "tar-cizgi", "stroke-width": (1.6 * o).toFixed(2) })); defs.appendChild(tar);
      var gol = svg("filter", { id: u + "gol", x: "-10%", y: "-10%", width: "120%", height: "120%" });
      gol.appendChild(svg("feDropShadow", { dx: 0, dy: 0, stdDeviation: (2 * o).toFixed(2), "flood-color": "#000", "flood-opacity": .8 })); defs.appendChild(gol);
      // yol grubu: sinif CSS'ten boyanır; desen: üstüne çizgili desen; kirp: clipPath adı
      function yol(yollar, sinif, kirp, desen) {
        var g = svg("g", { "class": "h-kat " + sinif }); if (kirp) g.setAttribute("clip-path", "url(#" + u + kirp + ")");
        yollar.forEach(function (d) { g.appendChild(svg("path", { d: d })); }); s.appendChild(g);
        if (desen) { var g2 = svg("g", { "class": "h-kat desen", fill: "url(#" + u + "tar)" }); if (kirp) g2.setAttribute("clip-path", "url(#" + u + kirp + ")"); yollar.forEach(function (d) { g2.appendChild(svg("path", { d: d })); }); s.appendChild(g2); }
        return g;
      }
      function yazi(ust, x, y, sinif, metin) {
        var t = svg("text", { x: x, y: y, "class": sinif });
        String(metin).split("\n").forEach(function (sat, i) { var ts = svg("tspan", { x: x, dy: i ? "1.1em" : 0 }); ts.textContent = sat; t.appendChild(ts); });
        ust.appendChild(t); return t;
      }
      function kare(ust, x, y, r) { ust.appendChild(svg("rect", { x: x - r * o, y: y - r * o, width: 2 * r * o, height: 2 * r * o, "class": "kare" })); }
      s.appendChild(svg("rect", { x: vb[0], y: vb[1], width: vb[2], height: vb[3], "class": "h-deniz" }));

      if (!genis) {
        klip("fil", H.filistin); klip("gz", H.gazze);
        var g0 = svg("g", { "class": "h-kara" }); H.komsu.concat(H.filistin).forEach(function (d) { g0.appendChild(svg("path", { d: d })); }); s.appendChild(g0);
        var ar = svg("image", { href: "data/gorsel/arazi/tarihce-arazi.jpg", x: 0, y: 0, width: H.w, height: H.h, preserveAspectRatio: "none", "class": "h-arazi" });
        ar.addEventListener("error", function () { ar.remove(); }); s.appendChild(ar);
        if (var_("osm")) yol(H.osmanli.concat(H.filistin), "osmanli");
        if (var_("misir")) yol(H.misir, "misir");
        if (var_("sinir")) yol(H.komsu, "sinir");
        if (var_("kayip")) yol(H.filistin, "kayip");
        if (var_("tam")) yol(H.filistin, "fil");
        if (var_("manda")) yol(H.filistin, "bos-desen", null, true);
        if (var_("plan1947Y") && H.plan1947_yahudi) yol(H.plan1947_yahudi, "plan-yahudi", "fil");
        if (var_("plan1947")) yol(H.plan1947, "fil", "fil");
        if (var_("plan1947K") && H.plan1947_kudus) yol(H.plan1947_kudus, "plan-kudus", "fil");
        if (var_("bati")) yol(H.bati, "fil");
        if (var_("osloC")) yol(H.bati, "oslo-c", null, true);
        if (var_("osloB")) yol(H.oslo_B, "oslo-b");
        if (var_("osloA")) yol(H.oslo_A, "oslo-a");
        if (var_("osloY")) yol(H.oslo_yer, "oslo-y");
        if (var_("gazze")) yol(H.gazze, "fil");
        if (var_("isgal")) yol(H.bati.concat(H.gazze), "bos-desen", null, true);
        if (var_("yerlesim")) yol(H.gazze_yerlesim, "koyu", "gz", true);
        if (var_("yerlesimBos")) yol(H.gazze_yerlesim, "bos", "gz");
        if (var_("ablukaH")) yol(H.gazze, "abluka");
        if (var_("sari")) yol([H.sari_hat], "koyu", "gz", true);
        var nh = svg("g", { "class": "h-nehir" }); H.nehir.forEach(function (d) { nh.appendChild(svg("path", { d: d })); }); s.appendChild(nh);
        var et = svg("g", { "class": "h-etiket", filter: "url(#" + u + "gol)" });
        H.etiket.forEach(function (e) {
          var ulke = ["ÜRDÜN", "SURİYE", "LÜBNAN"].indexOf(e[0]) >= 0;   // modern ülke adları Osmanlı haritasında görünmez
          if (!ulke || var_("ulkeT")) yazi(et, e[2], e[3], "bolge", EN ? e[1] : e[0]);
        });
        if (var_("osmT")) yazi(et, 330, 470, "buyuk", EN ? "OTTOMAN STATE" : "OSMANLI DEVLETİ");
        if (var_("bsT")) { var bp = kesit === "bs" ? P(H, 35.42, 32.47) : [268, 262]; yazi(et, bp[0], bp[1], "orta", EN ? "WEST BANK" : "BATI ŞERİA"); }
        if (var_("gzT")) { var gp = kesit === "gz" ? P(H, 34.30, 31.56) : [118, 372]; yazi(et, gp[0], gp[1], "orta sag", EN ? "GAZA" : "GAZZE"); }
        if (var_("planT") && H.plan1947_etiket) H.plan1947_etiket.forEach(function (e) { yazi(et, e[2], e[3], "plan-et", EN ? e[1] : e[0]); });
        var AD = { "Kudüs": "Jerusalem", "Yafa": "Jaffa", "Hayfa": "Haifa", "Gazze": "Gaza", "El-Halil": "Hebron", "Birüssebi": "Beersheba", "Akka": "Acre", "Cenin": "Jenin",
          "Eriha": "Jericho", "Beytüllahim": "Bethlehem", "Tulkerim": "Tulkarm", "Han Yunus": "Khan Yunis", "Refah": "Rafah", "Deyr el-Belah": "Deir al-Balah" };
        var sehir = H.sehir.slice();
        if (kesit === "bs") sehir = sehir.concat([["Eriha"].concat(P(H, 35.45, 31.86)), ["Beytüllahim"].concat(P(H, 35.20, 31.705)), ["Tulkerim"].concat(P(H, 35.03, 32.31))]);
        if (kesit === "gz") sehir = sehir.concat([["Han Yunus"].concat(P(H, 34.306, 31.346)), ["Refah"].concat(P(H, 34.25, 31.29)), ["Deyr el-Belah"].concat(P(H, 34.35, 31.418))]);
        sehir.forEach(function (c) {
          kare(et, c[1], c[2], 2.6);
          yazi(et, c[1] + 6 * o, c[2] + 3.4 * o, "sehir", EN ? (AD[c[0]] || c[0]) : c[0]);
        });
        s.appendChild(et);
      } else {
        klip("kara", H2.kara);
        var k0 = svg("g", { "class": "h-kara" }); H2.kara.forEach(function (d) { k0.appendChild(svg("path", { d: d })); }); s.appendChild(k0);
        var ar2 = svg("image", { href: "data/gorsel/arazi/tarihce-arazi-genis.jpg", x: 0, y: 0, width: H2.w, height: H2.h, preserveAspectRatio: "none", "class": "h-arazi" });
        ar2.addEventListener("error", function () { ar2.remove(); }); s.appendChild(ar2);
        var gl = svg("g", { "class": "h-gol" }); H2.gol.forEach(function (d) { gl.appendChild(svg("path", { d: d })); }); s.appendChild(gl);
        if (var_("osm1914")) yol(H2.osmanli1914, "osmanli genis", "kara");
        if (var_("sykes")) {
          var sy = svg("g", { "class": "h-kat sykes", "clip-path": "url(#" + u + "kara)" });
          ["b", "a", "kahve", "mavi", "kirmizi"].forEach(function (z) { var g = svg("g", { "class": "z-" + z }); H2.sykes[z].forEach(function (d) { g.appendChild(svg("path", { d: d })); }); sy.appendChild(g); });
          s.appendChild(sy);
        }
        if (var_("mandalar")) {
          var md = svg("g", { "class": "h-kat mandalar", "clip-path": "url(#" + u + "kara)" });
          [["fransa", "z-mavi"], ["ingiltere", "z-kirmizi"]].forEach(function (z) { var g = svg("g", { "class": z[1] }); H2.manda[z[0]].forEach(function (d) { g.appendChild(svg("path", { d: d })); }); md.appendChild(g); });
          s.appendChild(md);
        }
        // Gazze, 1967 öncesi Filistin parçalarının (psx) en batıdakidir
        var bx = function (d) { var m = /M\s*(-?[\d.]+)/.exec(d); return m ? +m[1] : 0; };
        var psx = (H2.psx || []).slice().sort(function (a, b) { return bx(a) - bx(b); });
        if (var_("filK")) yol(H2.filistin, "kayip");
        if (var_("psxF")) yol(psx, "fil");
        if (var_("sinaI")) yol(H2.sina, "isgal", "kara", true);
        if (var_("gazaI")) yol(psx.slice(0, 1), "isgal", null, true);
        if (var_("psxI")) yol(psx, "isgal", null, true);
        if (var_("golanI")) yol(H2.golan, "isgal", "kara", true);
        if (var_("kopru73")) yol(H2.kopru73, "misir-k", "kara");
        if (var_("cep73")) yol(H2.cep73, "cep", "kara", true);
        if (var_("sinirG")) { var sn = []; Object.keys(H2.ulke).forEach(function (k) { sn = sn.concat(H2.ulke[k]); }); yol(sn.concat(H2.filistin), "sinir genis"); }
        if (var_("kanal") && H2.kanal) s.appendChild(svg("path", { d: H2.kanal, "class": "h-kanal" }));
        var nh2 = svg("g", { "class": "h-nehir genis" }); H2.nehir.forEach(function (d) { nh2.appendChild(svg("path", { d: d })); }); s.appendChild(nh2);
        if (var_("demiryolu")) s.appendChild(svg("path", { d: H2.demiryolu, "class": "h-demiryolu" }));
        var et2 = svg("g", { "class": "h-etiket genis", filter: "url(#" + u + "gol)" }), E = H2.etiket;
        if (!kesit) [["akdeniz", "AKDENİZ", "MEDITERRANEAN"], ["kizildeniz", "KIZILDENİZ", "RED SEA"], ["korfez", "BASRA\nKÖRFEZİ", "THE\nGULF"], ["karadeniz", "KARADENİZ", "BLACK SEA"]].forEach(function (x) {
          yazi(et2, E[x[0]][0], E[x[0]][1], "deniz", EN ? x[2] : x[1]);
        });
        if (kesit === "misir") { var ak = P(H2, 32.3, 32.6); yazi(et2, ak[0], ak[1], "deniz", EN ? "MEDITERRANEAN" : "AKDENİZ"); var kz = P(H2, 34.55, 27.85); yazi(et2, kz[0], kz[1], "deniz kucuk", EN ? "RED SEA" : "KIZILDENİZ"); }
        if (var_("osmG")) {
          yazi(et2, E.osmanli[0], E.osmanli[1], "buyuk", EN ? "OTTOMAN STATE" : "OSMANLI DEVLETİ");
          yazi(et2, E.hicaz[0], E.hicaz[1], "orta", EN ? "HEJAZ" : "HİCAZ");
          yazi(et2, H2.demiryolu_et[0], H2.demiryolu_et[1], "kucuk", EN ? "Hejaz Railway" : "Hicaz Demiryolu");
          yazi(et2, E.misir[0], E.misir[1], "orta soluk", EN ? "EGYPT\n(British occupation)" : "MISIR\n(İngiliz işgali)");
          yazi(et2, E.necd[0], E.necd[1], "orta soluk", EN ? "NAJD" : "NECİD");
        }
        if (!kesit) yazi(et2, E.iran[0], E.iran[1], "orta soluk", EN ? "PERSIA" : "İRAN");
        if (var_("sykesT")) [["mavi", "MAVİ BÖLGE\nFransız yönetimi", "BLUE ZONE\nFrench rule"], ["a", "A\nFransız nüfuzu", "A\nFrench influence"], ["b", "B\nİngiliz nüfuzu", "B\nBritish influence"],
          ["kirmizi", "KIRMIZI BÖLGE\nİngiliz yönetimi", "RED ZONE\nBritish rule"], ["kahve", "KAHVERENGİ\nuluslararası", "BROWN\ninternational"]].forEach(function (z) {
          yazi(et2, E[z[0]][0], E[z[0]][1], "bolgeZ", EN ? z[2] : z[1]);
        });
        if (var_("mandaT")) {
          yazi(et2, E.fransa[0], E.fransa[1], "bolgeZ", EN ? "FRENCH MANDATE\nSyria and Lebanon" : "FRANSIZ MANDASI\nSuriye ve Lübnan");
          yazi(et2, E.irak[0], E.irak[1], "bolgeZ", EN ? "BRITISH MANDATE\nIraq" : "İNGİLİZ MANDASI\nIrak");
          yazi(et2, E.urdun[0], E.urdun[1], "orta", EN ? "TRANSJORDAN" : "ÜRDÜN");
          yazi(et2, E.filistin[0], E.filistin[1], "orta sag", EN ? "PALESTINE" : "FİLİSTİN");
          yazi(et2, E.turkiye[0], E.turkiye[1], "orta soluk", EN ? "TURKEY" : "TÜRKİYE");
          yazi(et2, E.hicazK[0], E.hicazK[1], "orta soluk", EN ? "KINGDOM\nOF HEJAZ" : "HİCAZ\nKRALLIĞI");
        }
        if (var_("gT")) {
          var q = function (lon, lat, sinif, tr, en) { var p = P(H2, lon, lat); yazi(et2, p[0], p[1], sinif, EN ? en : tr); };
          q(33.85, 29.55, "orta", "SİNA", "SINAI");
          q(31.25, 29.0, "orta soluk", "MISIR", "EGYPT");
          q(36.15, 32.95, "kucuk sol-bas", "Golan", "Golan");
          q(32.05, 31.02, "kucuk sag", "Süveyş\nKanalı", "Suez\nCanal");
          q(36.55, 31.2, "orta soluk", "ÜRDÜN", "JORDAN");
          q(36.7, 33.45, "orta soluk", "SURİYE", "SYRIA");
          q(35.75, 31.62, "kucuk sol-bas", "Batı Şeria", "West Bank");
          q(34.05, 31.62, "kucuk sag", "Gazze", "Gaza");
        }
        if (var_("noktaT") && H2.nokta) {
          var NAD = { portsait: ["Port Said", "Port Said"], suveys: ["Süveyş", "Suez"], ismailiye: ["İsmailiye", "Ismailia"] };
          Object.keys(NAD).forEach(function (k) { var p = H2.nokta[k]; if (!p) return; kare(et2, p[0], p[1], 2.4); yazi(et2, p[0] - 5 * o, p[1] + 3.4 * o, "sehir sol", EN ? NAD[k][1] : NAD[k][0]); });
        }
        var ek = function (lon, lat, sinif, tr, en) { var p = P(H2, lon, lat); yazi(et2, p[0], p[1], "not " + sinif, EN ? en : tr); };
        if (var_("t56")) { ek(32.45, 31.55, "", "İngiliz-Fransız çıkarması\n5–6 Kasım", "Anglo-French landing\n5–6 November"); ek(33.6, 30.35, "", "İsrail işgali\n29 Ekim – Mart 1957", "Israeli occupation\n29 Oct – Mar 1957"); }
        if (var_("t73")) { ek(33.0, 30.55, "", "Mısır köprübaşı\n6 Ekim", "Egyptian bridgehead\n6 October"); ek(31.55, 30.05, "sag", "İsrail cebi\n16 Ekim sonrası", "Israeli pocket\nafter 16 October"); }
        if (var_("t57")) ek(33.85, 29.2, "", "Mısır’a döndü\nMart 1957", "returned to Egypt\nMarch 1957");
        if (var_("t82")) ek(33.85, 29.2, "", "Mısır’a döndü\nNisan 1982", "returned to Egypt\nApril 1982");
        var AD2 = { "İstanbul": "Istanbul", "Halep": "Aleppo", "Şam": "Damascus", "Beyrut": "Beirut", "Kudüs": "Jerusalem", "Hayfa": "Haifa", "Bağdat": "Baghdad", "Musul": "Mosul", "Kerkük": "Kirkuk", "Kahire": "Cairo", "Medine": "Medina", "Akabe": "Aqaba" };
        H2.sehir.forEach(function (c) {
          if (kesit === "misir" && ["Hayfa", "Beyrut", "Amman"].indexOf(c[0]) >= 0) return;
          kare(et2, c[1], c[2], 2.8);
          var sol = ["Kudüs", "Hayfa", "Beyrut"].indexOf(c[0]) >= 0;   // kalabalık kıyıda ad noktanın soluna
          yazi(et2, c[1] + (sol ? -6.5 : 6.5) * o, c[2] + 3.6 * o, "sehir" + (sol ? " sol" : ""), EN ? (AD2[c[0]] || c[0]) : c[0]);
        });
        s.appendChild(et2);
      }
      return s;
    }
    return { ciz: ciz, kutu: kutu };
  }

  // --- zaman şeridi: solda 1910–2030 cetveli, her akış kendi renginde bir dere; o an okunan yıl ve akış üstte ---
  var NH = {};
  function nehirKur(n, L, git) {
    var Y0 = 1880, Y1 = 2030;
    function yuzde(t) { return ((t - Y0) / (Y1 - Y0) * 100).toFixed(3) + "%"; }
    var ust = el("div", "tn-ust");
    var yilE = el("b", "tn-yil", "1882"), adE = el("span", "tn-ad", ""), noE = el("span", "tn-no", "");
    ust.append(noE, yilE, adE);
    var cetvel = el("div", "tn-cetvel");
    for (var t = Y0; t <= Y1; t += 10) {
      var c = el("i", "tn-tik" + (t % 20 === 0 ? " uzun" : "")); c.style.top = yuzde(t); cetvel.appendChild(c);
      if (t % 20 === 0) { var y = el("span", "tn-etk", String(t)); y.style.top = yuzde(t); cetvel.appendChild(y); }
    }
    var kulvar = [];
    L.forEach(function (a) { var i = 0; while (kulvar[i] != null && kulvar[i] > a.yillar[0]) i++; kulvar[i] = a.yillar[1]; a._k = i; });
    L.forEach(function (a, ai) {
      var b = el("button", "tn-dere"); b.type = "button";
      b.style.top = yuzde(a.yillar[0]); b.style.height = "calc(" + yuzde(Math.max(a.yillar[1], a.yillar[0] + 1.2)) + " - " + yuzde(a.yillar[0]) + ")";
      b.style.setProperty("--k", a._k); b.style.setProperty("--renk", a.renk); b.dataset.akis = a.anahtar;
      b.title = D2(a, "ad") + " · " + a.yillar[0] + "–" + a.yillar[1];
      b.setAttribute("aria-label", String(ai + 1).padStart(2, "0") + " " + b.title);
      b.onclick = function () { git(a.anahtar); };
      cetvel.appendChild(b);
    });
    var imlec = el("i", "tn-imlec"); cetvel.appendChild(imlec);
    // dar ekranda: üstte ince bir şerit; akış parçaları ve yıl
    var mobil = el("div", "tn-mobil");
    var parcalar = el("div", "tn-parca");
    L.forEach(function (a) { var i = el("i"); i.style.background = a.renk; i.dataset.akis = a.anahtar; parcalar.appendChild(i); });
    var myil = el("b", "tn-myil", "1882"), mad = el("span", "tn-mad", "");
    mobil.append(myil, mad, parcalar);
    n.append(ust, cetvel, mobil);
    var simdiYil = null, simdiAkis = null;
    NH.guncelle = function (t, k) {
      if (t && t !== simdiYil) { simdiYil = t; yilE.textContent = myil.textContent = t; imlec.style.top = yuzde(t); }
      if (k && k !== simdiAkis) {
        simdiAkis = k;
        var ai = L.findIndex(function (a) { return a.anahtar === k; }), a = L[ai];
        n.style.setProperty("--su", a.renk);
        noE.textContent = String(ai + 1).padStart(2, "0") + " / " + String(L.length).padStart(2, "0");
        adE.textContent = mad.textContent = D2(a, "ad");
        n.querySelectorAll("[data-akis]").forEach(function (e) { e.classList.toggle("su", e.dataset.akis === k); });
      }
    };
  }

  // --- kaydırma: her izlenen öğeye --p; ekranın ortasındaki öğeye göre zaman şeridi ---
  function ilerlemeKur() {
    var izle = Array.prototype.slice.call(document.querySelectorAll(".izle"));
    var serit = Array.prototype.slice.call(document.querySelectorAll(".ta-serit > [data-akis]"));
    var bekliyor = false;
    function iste() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(guncelle); } }
    function guncelle() {
      bekliyor = false;
      var vh = innerHeight;
      izle.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
        var p = AZALT ? 1 : (e.classList.contains("ta-acilis") || e.classList.contains("ta-giris")) ? (vh - r.top) / (vh * .75) : (vh - r.top) / (vh * .45);
        p = Math.max(0, Math.min(1, p));
        e.style.setProperty("--p", p.toFixed(3));
        if (e.classList.contains("ta-giris")) e.style.setProperty("--c", Math.max(0, Math.min(1, -r.top / (vh * .6))).toFixed(3));
      });
      // ekranın %40'ını geçen son öğe "şu an okunan" öğedir (ikili arama; öğeler sırayla dizili)
      var cizgi = vh * .4, lo = 0, hi = serit.length - 1, en = null;
      while (lo <= hi) { var m = (lo + hi) >> 1; if (serit[m].getBoundingClientRect().top <= cizgi) { en = serit[m]; lo = m + 1; } else hi = m - 1; }
      if (!en && serit.length) en = serit[0];
      if (en) NH.guncelle(+en.dataset.yil || null, en.dataset.akis);
    }
    addEventListener("scroll", iste, { passive: true });
    addEventListener("resize", iste);
    iste();
  }
})();
