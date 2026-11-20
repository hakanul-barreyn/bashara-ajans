// Tarihçe: bir yüzyılın akışları. Veri: site/tarihce-akis.json (akışlar), site/donum.json (olay metinleri ve eski görseller),
// site/tarihce-harita.json ve site/tarihce-harita-genis.json (Natural Earth'ten üretilmiş harita yolları).
// Sayfa yazı ve görsel odaklı: harita yalnızca toprak değiştiğinde öne çıkar ("harita anı"), sonra köşeye küçülür ve bir süre
// sonra tamamen çekilir. Her .izle öğesi görünüme girdikçe 0'dan 1'e giden bir --p değeri alır; CSS geri kalanını yapar.
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

  Promise.all([
    fetch("site/tarihce-akis.json?v=3").then(function (r) { return r.json(); }),
    fetch("site/donum.json?v=21").then(function (r) { return r.json(); }),
    fetch("site/tarihce-harita.json?v=2").then(function (r) { return r.json(); }),
    fetch("site/tarihce-harita-genis.json?v=1").then(function (r) { return r.json(); }),
    fetch("data/gorsel/tarihce/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("data/gorsel/kapak/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    BG ? BG.hazir : null
  ]).then(function (x) { kur(x[0], x[1], x[2], x[3], (x[4] || []).concat(x[5] || [])); })
    .catch(function (e) { kok.textContent = "Tarihçe yüklenemedi."; console.error(e); });

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

  function kur(A, D, H, H2, K) {
    kok.textContent = "";
    var kunye = {}; K.forEach(function (k) { kunye[k.ad] = k; });
    var KUL = {};   // sayfada kullanılan künyeler (sonda listelenir)
    // donum.json dizini: "tarih" ve "tarih|kelime"
    function bul(ref) {
      var p = String(ref).split("|");
      return D.olaylar.find(function (o) { return o.tarih === p[0] && (!p[1] || o.baslik.indexOf(p[1]) >= 0); });
    }
    function kredi(yazar) { return String(yazar || "").replace(/^Unknown author.*/, EN ? "unknown photographer" : "fotoğrafçısı bilinmiyor").replace(/\s+/g, " ").trim(); }
    // bir öğenin bütün görselleri: kendi görselleri (tarihce/ ya da kapak/ klasörü) + donum.json'daki eski görseller
    function gorseller(o, v) {
      var L = [];
      function ekle(ad, klasor) {
        if (!ad) return;
        var k = kunye[ad];
        L.push({ src: "data/gorsel/" + (klasor || "tarihce") + "/" + (k && k.dosya ? k.dosya : ad + ".jpg"), ad: ad,
          yazi: k ? (EN ? k.en : k.tr) : "", kredi: k ? kredi(k.yazar) + (k.lisans ? ", " + k.lisans : "") : "", sayfa: k && k.sayfa });
      }
      if (o.gorsel) ekle(o.gorsel, o.gorsel_klasor);
      (o.gorseller || []).forEach(function (g) { ekle(g, "tarihce"); });
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
    ic.append(el("p", "ta-ust", EN ? "Palestine · 1914–2026" : "Filistin · 1914–2026"), h, el("p", "ta-ar", "تيارات قرن"),
      el("p", "ta-dek", EN
        ? "The Ottoman era was over. The empire’s Arab lands were divided between the colonial powers, and through Balfour’s promise Palestine became the target of the Zionist settlement project. From then on each generation carried the resistance a step further: Qassam’s peasants took to the hills, the nationalism of Nasser and the Ba’ath mobilised armies, the fedayeen and the left carried the struggle into the camps, and the Islamic movements spread it from Gaza across the region. Scroll down and the currents assemble one by one; whenever the land changes hands, the map steps forward."
        : "Osmanlı artık geride kalmıştı. İmparatorluğun Arap toprakları sömürgeci güçler arasında paylaşıldı; Filistin ise Balfour’un verdiği sözle Siyonist yerleşim planının hedefi oldu. O günden sonra her kuşak direnişi bir adım ileri taşıdı: Kassam’ın köylüleri dağa çıktı, Nasır’ın ve Baas’ın milliyetçiliği orduları seferber etti, fedailer ve sol mücadeleyi kamplara taşıdı, İslami hareketler onu Gazze’den bütün bölgeye yaydı. Aşağı kaydırdıkça akışlar birer birer kurulur; toprak her el değiştirdiğinde harita öne çıkar."));
    ic.appendChild(tatriz(46, "ta-tatriz son"));
    ic.appendChild(el("p", "ta-ipucu", EN ? "Scroll ↓" : "Kaydır ↓"));
    giris.appendChild(ic);
    kok.appendChild(giris);

    // --- sahne: nehir + akışlar; harita sabit bir panel ---
    var sahne = el("div", "ta-sahne");
    var nehir = el("nav", "ta-nehir"); nehir.setAttribute("aria-label", EN ? "Currents" : "Akışlar");
    var akis = el("div", "ta-akis");
    sahne.append(nehir, akis);
    kok.appendChild(sahne);
    var hk = el("aside", "ta-harita m-gizli"); hk.setAttribute("aria-label", EN ? "Map" : "Harita");
    kok.appendChild(hk);
    haritaKur(hk, H, H2, A.haritalar);
    nehirKur(nehir, A.akislar);
    var lb = isikKutusu();

    var sonDurum = null;
    function an(durum, yilD) {   // harita anı: toprak değiştiğinde haritanın büyüdüğü boşluk
      if (!durum || durum === sonDurum || !A.haritalar[durum]) return null;
      sonDurum = durum;
      var a = el("div", "ta-an"); a.dataset.an = durum; a.setAttribute("aria-hidden", "true");
      if (yilD) a.dataset.yil = yilD;
      return a;
    }

    A.akislar.forEach(function (a, ai) {
      var s = el("section", "ta-bolum"); s.id = "akis-" + a.anahtar; s.dataset.akis = a.anahtar;
      s.style.setProperty("--renk", a.renk);
      var ac = el("header", "ta-acilis izle"); ac.dataset.yil = a.yillar[0];
      var no = el("p", "ta-no", String(ai + 1).padStart(2, "0") + " / " + String(A.akislar.length).padStart(2, "0"));
      var yy = el("p", "ta-yillar"); harfle(yy, a.yillar[0] + "–" + (a.yillar[1] >= 2026 ? "" : a.yillar[1]));
      var ad = el("h2", "ta-ad"); harfle(ad, EN && a.ad_en ? a.ad_en : a.ad);
      ac.append(no, yy, ad);
      if (a.alt) ac.appendChild(el("p", "ta-alt", EN && a.alt_en ? a.alt_en : a.alt));
      ac.appendChild(el("p", "ta-ar", a.ar));
      var tz = el("p", "ta-tez", EN && a.tez_en ? a.tez_en : a.tez);
      if (a.tez_kaynak) tz.appendChild(dis(el("a", "ta-kaynak", " " + a.tez_kaynak.ad + " ↗"), a.tez_kaynak.url));
      ac.appendChild(tz);
      ac.appendChild(tatriz(24, "ta-tatriz kucuk"));
      s.appendChild(ac);
      var a0 = an(a.harita, a.yillar[0]); if (a0) s.appendChild(a0);

      // öğeler tarih sırasıyla; tarihsiz öğeler (alıntı, biyografi) kendinden önceki öğenin hemen ardında kalır
      var son = "", sira = a.olaylar.map(function (o, i) {
        var t = o.tur === "alinti" || o.tur === "biyografi" ? null : (o.ref ? (bul(o.ref) || {}).tarih : o.tarih);
        if (t) son = String(t); return { o: o, t: t ? String(t) : son + "~", i: i };
      });
      sira.sort(function (x, y) { return x.t < y.t ? -1 : x.t > y.t ? 1 : x.i - y.i; });
      var liste = el("div", "ta-liste");
      sira.forEach(function (x) {
        liste.appendChild(oge(x.o));
        var m = an(x.o.harita, x.t && yil(x.t)); if (m) liste.appendChild(m);
      });
      s.appendChild(liste);

      if (a.gecis) {
        var g = el("div", "ta-gecis izle");
        g.appendChild(el("span", "ta-gecis-ok", "→"));
        g.appendChild(el("p", null, EN && a.gecis_en ? a.gecis_en : a.gecis));
        s.appendChild(g);
      }
      akis.appendChild(s);
    });

    var sonu = el("footer", "ta-son");
    sonu.appendChild(el("p", null, EN ? "Relief from AWS Terrain Tiles, coastlines and borders from Natural Earth (public domain); the Sykes–Picot zones, the 1947 plan, the Oslo areas and the 2025 line are schematic. Images from Wikimedia Commons, openly licensed or public domain. Older list view: " : "Arazi AWS Terrain Tiles’tan, kıyılar ve sınırlar Natural Earth’ten (kamu malı); Sykes–Picot bölgeleri, 1947 planı, Oslo bölgeleri ve 2025 hattı şematiktir. Görseller Wikimedia Commons’tan, açık lisanslı ya da kamu malı. Eski liste görünümü: "));
    sonu.lastChild.appendChild(Object.assign(el("a", null, EN ? "all entries by date" : "bütün olaylar tarih sırasıyla"), { href: "tarihce-liste.html" }));
    var kl = el("p", "ta-kunyeler"); kl.id = "taKunye"; sonu.appendChild(kl);
    kok.appendChild(sonu);
    kunyeYaz(kl);

    function oge(o) {
      if (o.tur === "alinti") return alinti(o);
      if (o.tur === "biyografi") return biyografi(o);
      if (o.tur === "gazete") return kupur(o);
      return kart(o);
    }
    function kaynakSatiri(ks) {
      ks = (ks || []).filter(function (x) { return x && x.url; });
      if (!ks.length) return null;
      var kk = el("p", "ta-kaynaklar");
      ks.slice(0, 3).forEach(function (x, i) { if (i) kk.append(" · "); kk.appendChild(dis(el("a", null, (x.ad || "kaynak") + " ↗"), x.url)); });
      return kk;
    }
    function kart(o) {
      var v = o.ref ? bul(o.ref) : o;
      if (!v) { console.warn("yok", o.ref); return document.createComment("yok " + o.ref); }
      var gz = o.gazete;
      var k = el("article", "ta-kart izle" + (o.yan ? " sag" : "") + (gz ? " gazete" : ""));
      k.dataset.yil = yil(v.tarih);
      if (typeof gz === "string") k.appendChild(el("p", "ta-manset", EN && o.gazete_en ? o.gazete_en : gz));
      k.appendChild(el("time", "ta-tarih", tarihAd(v.tarih)));
      k.appendChild(vurgula(el("h3"), N(EN && v.baslik_en ? v.baslik_en : v.baslik), EN ? o.vurgu_en : o.vurgu));
      var gs = gorseller(o, o.ref ? v : null);
      var metin = N(EN && v.metin_en ? v.metin_en : v.metin) || "";
      var p = vurgula(el("p", "ta-metin" + (gz && metin.length > 420 ? " iki" : "")), metin, EN ? o.vurgu_en : o.vurgu);
      if (gs.length) k.appendChild(galeri(gs));
      k.appendChild(p);
      var kk = kaynakSatiri(v.kaynaklar); if (kk) k.appendChild(kk);
      return k;
    }
    // gazete kupürü: künye, başlık, büyük alıntı, açıklama
    function kupur(o) {
      var Q = function (x) { return EN && o[x + "_en"] ? o[x + "_en"] : o[x]; };
      var k = el("article", "ta-kupur izle"); k.dataset.yil = yil(o.tarih);
      k.appendChild(el("p", "ta-manset", Q("kunye")));
      k.appendChild(el("h3", null, Q("baslik")));
      var gs = gorseller(o, null);
      var gov = el("div", "ta-kupur-gov");
      if (gs.length) gov.appendChild(galeri(gs));
      var bq = el("blockquote", "ta-kupur-soz"); bq.textContent = "“" + Q("alinti") + "”"; gov.appendChild(bq);
      k.appendChild(gov);
      k.appendChild(el("p", "ta-metin", Q("metin")));
      var kk = kaynakSatiri(o.kaynaklar); if (kk) k.appendChild(kk);
      return k;
    }
    // görseller kırpılmadan: tek görsel kendi oranında, birden çoksa satırlar oranlara göre paylaşılır (yüzler ve odak kesilmez)
    function galeri(gs) {
      var g = el("div", "ta-galeri" + (gs.length > 1 ? " cok" : ""));
      gs.forEach(function (x, i) {
        var f = el("figure");
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
      var Q = function (k) { return EN && o[k + "_en"] ? o[k + "_en"] : o[k]; };
      if (o.alinti) b.appendChild(el("p", "ta-yer dolu", o.alinti)); else b.appendChild(el("p", "ta-yer", Q("yer_tutucu")));
      b.appendChild(el("p", "ta-alinti-ozet", Q("metin")));
      b.appendChild(el("cite", null, Q("kisi") + " · " + Q("eser")));
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

    ilerlemeKur();
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

  // --- harita: yakın (tarihî Filistin) ve geniş (Anadolu'dan Hicaz'a) iki çizim, tek panel ---
  var HR = {};
  function haritaKur(hk, H, H2, M) {
    var KATLAR = {}, SVG = {};
    function katci(s) {
      return function (ad, yollar, sinif, kirp, ana) {
        var g = svg("g", { "class": "h-kat " + sinif, "data-kat": ad }); if (kirp) g.setAttribute("clip-path", "url(#" + kirp + ")");
        yollar.forEach(function (d) { g.appendChild(svg("path", { d: d })); }); (ana || s).appendChild(g); return g;
      };
    }
    function yazi(ust, x, y, sinif, metin, kat) {
      var t = svg("text", { x: x, y: y, "class": sinif + (kat ? " h-kat" : "") }); if (kat) t.setAttribute("data-kat", kat);
      String(metin).split("\n").forEach(function (sat, i) { var ts = svg("tspan", { x: x, dy: i ? "1.1em" : 0 }); ts.textContent = sat; t.appendChild(ts); });
      ust.appendChild(t); return t;
    }

    // çizim yalnızca viewBox içinde görünsün (büyük hâlde harita "meet" ile ortalanır, kenarda vektör taşmasın)
    function cerceveKirp(s, defs, w, h, id) {
      var c = svg("clipPath", { id: id }); c.appendChild(svg("rect", { width: w, height: h })); defs.appendChild(c);
      var g = svg("g", { "clip-path": "url(#" + id + ")" });
      Array.prototype.slice.call(s.childNodes).forEach(function (n) { if (n !== defs) g.appendChild(n); });
      s.appendChild(g);
    }
    // yakın harita
    (function () {
      var s = svg("svg", { viewBox: "0 0 " + H.w + " " + H.h, preserveAspectRatio: "xMidYMid meet", "class": "ta-hsvg yakin", role: "img", "aria-label": EN ? "Map of historic Palestine" : "Tarihî Filistin haritası" });
      var defs = svg("defs");
      var cl = svg("clipPath", { id: "taFil" }); H.filistin.forEach(function (d) { cl.appendChild(svg("path", { d: d })); }); defs.appendChild(cl);
      var clg = svg("clipPath", { id: "taGz" }); H.gazze.forEach(function (d) { clg.appendChild(svg("path", { d: d })); }); defs.appendChild(clg);
      var tar = svg("pattern", { id: "taTarali", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      tar.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, "class": "tar-cizgi" })); defs.appendChild(tar);
      var sg_ = svg("filter", { id: "taGolge", x: "-10%", y: "-10%", width: "120%", height: "120%" });
      sg_.appendChild(svg("feDropShadow", { dx: 0, dy: 0, stdDeviation: 2.2, "flood-color": "#000", "flood-opacity": .85 })); defs.appendChild(sg_);
      s.appendChild(defs);
      s.appendChild(svg("rect", { width: H.w, height: H.h, "class": "h-deniz" }));
      var g0 = svg("g", { "class": "h-kara" }); H.komsu.concat(H.filistin).forEach(function (d) { g0.appendChild(svg("path", { d: d })); }); s.appendChild(g0);
      var ar = svg("image", { href: "data/gorsel/arazi/tarihce-arazi.jpg", x: 0, y: 0, width: H.w, height: H.h, preserveAspectRatio: "none", "class": "h-arazi" });
      ar.addEventListener("error", function () { ar.remove(); }); s.appendChild(ar);
      var kat = katci(s);
      kat("osm", H.osmanli.concat(H.filistin), "osmanli");
      kat("misir", H.misir, "misir");
      kat("sinir", H.komsu, "sinir");
      kat("kayip", H.filistin, "kayip");
      kat("tam", H.filistin, "fil");
      kat("manda", H.filistin, "tarali");
      if (H.plan1947_yahudi) kat("plan1947Y", H.plan1947_yahudi, "plan-yahudi", "taFil");
      kat("plan1947", H.plan1947, "fil", "taFil");
      if (H.plan1947_kudus) kat("plan1947K", H.plan1947_kudus, "plan-kudus", "taFil");
      kat("bati", H.bati, "fil");
      kat("gazze", H.gazze, "fil");
      kat("isgal", H.bati.concat(H.gazze), "tarali");
      kat("isgalB", H.bati, "tarali");
      kat("oslo", H.oslo_ab, "fil parlak", "taFil");
      kat("yerlesim", H.gazze_yerlesim, "tarali koyu", "taGz");
      kat("yerlesimBos", H.gazze_yerlesim, "bos", "taGz");
      kat("ablukaH", H.gazze, "abluka");
      kat("sari", [H.sari_hat], "tarali koyu", "taGz");
      var nh = svg("g", { "class": "h-nehir" }); H.nehir.forEach(function (d) { nh.appendChild(svg("path", { d: d })); }); s.appendChild(nh);
      s.appendChild(svg("circle", { cx: H.kudus[0], cy: H.kudus[1], r: 10, "class": "h-kat kudus", "data-kat": "kudus" }));
      var et = svg("g", { "class": "h-etiket", filter: "url(#taGolge)" });
      H.etiket.forEach(function (e) {
        var ulke = ["ÜRDÜN", "SURİYE", "LÜBNAN"].indexOf(e[0]) >= 0;   // modern ülke adları Osmanlı haritasında görünmez
        yazi(et, e[2], e[3], "bolge", EN ? e[1] : e[0], ulke ? "ulkeT" : null);
      });
      yazi(et, 330, 470, "buyuk", EN ? "OTTOMAN STATE" : "OSMANLI DEVLETİ", "osmT");
      yazi(et, 268, 262, "orta", EN ? "WEST BANK" : "BATI ŞERİA", "bsT");
      yazi(et, 118, 372, "orta sag", EN ? "GAZA" : "GAZZE", "gzT");
      if (H.plan1947_etiket) H.plan1947_etiket.forEach(function (e) { yazi(et, e[2], e[3], "plan-et", EN ? e[1] : e[0], "planT"); });
      H.sehir.forEach(function (c) {
        et.appendChild(svg("rect", { x: c[1] - 2.6, y: c[2] - 2.6, width: 5.2, height: 5.2, "class": "kare" }));
        yazi(et, c[1] + 6, c[2] + 3.4, "sehir", EN ? ({ "Kudüs": "Jerusalem", "Yafa": "Jaffa", "Hayfa": "Haifa", "Gazze": "Gaza", "El-Halil": "Hebron", "Birüssebi": "Beersheba", "Akka": "Acre", "Cenin": "Jenin" }[c[0]] || c[0]) : c[0]);
      });
      s.appendChild(et);
      // Gazze yakın planı: yerleşimler, çekilme, abluka ve sarı hat ana haritada çok küçük kaldığı için
      var gk = H.gazze_kutu, IX = 68, IY = 50, IW = 150, IH = Math.round(150 * (gk[3] - gk[1]) / (gk[2] - gk[0]));
      var ins = svg("g", { "class": "h-kat h-yakin", "data-kat": "yakin" });
      ins.appendChild(svg("line", { x1: IX + IW, y1: IY + IH, x2: gk[0] + 4, y2: gk[1] + 6, "class": "h-yakin-cizgi" }));
      var sk = IW / (gk[2] - gk[0]);
      var kc = svg("clipPath", { id: "taYakin" }); kc.appendChild(svg("rect", { x: gk[0], y: gk[1], width: gk[2] - gk[0], height: gk[3] - gk[1] })); defs.appendChild(kc);
      var iv = svg("g", { transform: "translate(" + IX + " " + IY + ") scale(" + sk.toFixed(4) + ") translate(" + (-gk[0]) + " " + (-gk[1]) + ")", "clip-path": "url(#taYakin)", "class": "h-yakin-ic" });
      iv.appendChild(svg("rect", { x: gk[0], y: gk[1], width: gk[2] - gk[0], height: gk[3] - gk[1], "class": "h-deniz" }));
      iv.appendChild(svg("image", { href: "data/gorsel/arazi/tarihce-arazi.jpg", x: 0, y: 0, width: H.w, height: H.h, preserveAspectRatio: "none" }));
      var ikat = function (ad, yollar, sinif, kirp) { return kat(ad, yollar, sinif, kirp, iv); };
      ikat("gazze", H.gazze, "fil"); ikat("yerlesim", H.gazze_yerlesim, "tarali koyu", "taGz"); ikat("yerlesimBos", H.gazze_yerlesim, "bos", "taGz");
      ikat("ablukaH", H.gazze, "abluka"); ikat("sari", [H.sari_hat], "tarali koyu", "taGz");
      ins.appendChild(iv);
      ins.appendChild(svg("rect", { x: IX, y: IY, width: IW, height: IH, "class": "h-yakin-cerceve" }));
      var yt = svg("text", { x: IX + 6, y: IY + 14, "class": "h-yakin-ad" }); yt.textContent = EN ? "GAZA · CLOSE-UP" : "GAZZE · YAKIN PLAN"; ins.appendChild(yt);
      s.insertBefore(ins, et);
      cerceveKirp(s, defs, H.w, H.h, "taVbY");
      SVG.yakin = s;
      var SON = ["sinir", "kayip", "ulkeT"];
      var P47 = H.plan1947_yahudi ? ["plan1947Y", "plan1947K", "planT"] : [];
      Object.assign(KATLAR, {
        tam: ["osm", "misir", "osmT"], manda: ["sinir", "tam", "manda", "ulkeT"], plan1947: SON.concat(["plan1947"], P47.length ? P47 : ["kudus"]), "1949": SON.concat(["bati", "gazze", "bsT", "gzT"]),
        "1967": SON.concat(["bati", "gazze", "isgal", "bsT", "gzT"]), oslo: SON.concat(["bati", "gazze", "isgalB", "oslo", "yerlesim", "yakin", "bsT", "gzT"]),
        cekilme: SON.concat(["bati", "gazze", "isgalB", "oslo", "yerlesimBos", "yakin", "bsT", "gzT"]),
        abluka: SON.concat(["bati", "gazze", "isgalB", "oslo", "ablukaH", "yakin", "bsT", "gzT"]), sari: SON.concat(["bati", "gazze", "isgalB", "oslo", "ablukaH", "sari", "yakin", "bsT", "gzT"])
      });
    })();

    // geniş harita: 1914 Osmanlı, Sykes–Picot, mandalar
    (function () {
      var s = svg("svg", { viewBox: "0 0 " + H2.w + " " + H2.h, preserveAspectRatio: "xMidYMid meet", "class": "ta-hsvg genis", role: "img", "aria-label": EN ? "Map of the region from Anatolia to the Hejaz" : "Anadolu’dan Hicaz’a bölge haritası" });
      var defs = svg("defs");
      var cl = svg("clipPath", { id: "taGKara" }); H2.kara.forEach(function (d) { cl.appendChild(svg("path", { d: d })); }); defs.appendChild(cl);
      var tar = svg("pattern", { id: "taGTarali", width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
      tar.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 7, "class": "tar-cizgi" })); defs.appendChild(tar);
      var sg_ = svg("filter", { id: "taGGolge", x: "-10%", y: "-10%", width: "120%", height: "120%" });
      sg_.appendChild(svg("feDropShadow", { dx: 0, dy: 0, stdDeviation: 2, "flood-color": "#000", "flood-opacity": .8 })); defs.appendChild(sg_);
      s.appendChild(defs);
      s.appendChild(svg("rect", { width: H2.w, height: H2.h, "class": "h-deniz" }));
      var g0 = svg("g", { "class": "h-kara" }); H2.kara.forEach(function (d) { g0.appendChild(svg("path", { d: d })); }); s.appendChild(g0);
      var ar = svg("image", { href: "data/gorsel/arazi/tarihce-arazi-genis.jpg", x: 0, y: 0, width: H2.w, height: H2.h, preserveAspectRatio: "none", "class": "h-arazi" });
      ar.addEventListener("error", function () { ar.remove(); }); s.appendChild(ar);
      var gl = svg("g", { "class": "h-gol" }); H2.gol.forEach(function (d) { gl.appendChild(svg("path", { d: d })); }); s.appendChild(gl);
      var kat = katci(s);
      kat("osm1914", H2.osmanli1914, "osmanli genis", "taGKara");
      var sy = svg("g", { "class": "h-kat sykes", "data-kat": "sykes", "clip-path": "url(#taGKara)" });
      ["b", "a", "kahve", "mavi", "kirmizi"].forEach(function (z) { var g = svg("g", { "class": "z-" + z }); H2.sykes[z].forEach(function (d) { g.appendChild(svg("path", { d: d })); }); sy.appendChild(g); });
      s.appendChild(sy);
      var md = svg("g", { "class": "h-kat mandalar", "data-kat": "mandalar", "clip-path": "url(#taGKara)" });
      [["fransa", "z-mavi"], ["ingiltere", "z-kirmizi"]].forEach(function (z) { var g = svg("g", { "class": z[1] }); H2.manda[z[0]].forEach(function (d) { g.appendChild(svg("path", { d: d })); }); md.appendChild(g); });
      s.appendChild(md);
      var sn = []; Object.keys(H2.ulke).forEach(function (k) { sn = sn.concat(H2.ulke[k]); });
      kat("sinirG", sn.concat(H2.filistin), "sinir genis");
      var nh = svg("g", { "class": "h-nehir genis" }); H2.nehir.forEach(function (d) { nh.appendChild(svg("path", { d: d })); }); s.appendChild(nh);
      var dy = svg("path", { d: H2.demiryolu, "class": "h-kat h-demiryolu", "data-kat": "demiryolu" }); s.appendChild(dy);
      var et = svg("g", { "class": "h-etiket genis", filter: "url(#taGGolge)" }), E = H2.etiket;
      [["akdeniz", "AKDENİZ", "MEDITERRANEAN"], ["kizildeniz", "KIZILDENİZ", "RED SEA"], ["korfez", "BASRA\nKÖRFEZİ", "THE\nGULF"], ["karadeniz", "KARADENİZ", "BLACK SEA"]].forEach(function (x) {
        yazi(et, E[x[0]][0], E[x[0]][1], "deniz", EN ? x[2] : x[1]);
      });
      yazi(et, E.osmanli[0], E.osmanli[1], "buyuk", EN ? "OTTOMAN STATE" : "OSMANLI DEVLETİ", "osmG");
      yazi(et, E.hicaz[0], E.hicaz[1], "orta", EN ? "HEJAZ" : "HİCAZ", "osmG");
      yazi(et, H2.demiryolu_et[0], H2.demiryolu_et[1], "kucuk", EN ? "Hejaz Railway" : "Hicaz Demiryolu", "osmG");
      yazi(et, E.misir[0], E.misir[1], "orta soluk", EN ? "EGYPT\n(British occupation)" : "MISIR\n(İngiliz işgali)", "osmG");
      yazi(et, E.iran[0], E.iran[1], "orta soluk", EN ? "PERSIA" : "İRAN");
      yazi(et, E.necd[0], E.necd[1], "orta soluk", EN ? "NAJD" : "NECİD", "osmG");
      [["mavi", "MAVİ BÖLGE\nFransız yönetimi", "BLUE ZONE\nFrench rule"], ["a", "A\nFransız nüfuzu", "A\nFrench influence"], ["b", "B\nİngiliz nüfuzu", "B\nBritish influence"],
        ["kirmizi", "KIRMIZI BÖLGE\nİngiliz yönetimi", "RED ZONE\nBritish rule"], ["kahve", "KAHVERENGİ\nuluslararası", "BROWN\ninternational"]].forEach(function (z) {
        yazi(et, E[z[0]][0], E[z[0]][1], "bolgeZ", EN ? z[2] : z[1], "sykesT");
      });
      yazi(et, E.fransa[0], E.fransa[1], "bolgeZ", EN ? "FRENCH MANDATE\nSyria and Lebanon" : "FRANSIZ MANDASI\nSuriye ve Lübnan", "mandaT");
      yazi(et, E.irak[0], E.irak[1], "bolgeZ", EN ? "BRITISH MANDATE\nIraq" : "İNGİLİZ MANDASI\nIrak", "mandaT");
      yazi(et, E.urdun[0], E.urdun[1], "orta", EN ? "TRANSJORDAN" : "ÜRDÜN", "mandaT");
      yazi(et, E.filistin[0], E.filistin[1], "orta sag", EN ? "PALESTINE" : "FİLİSTİN", "mandaT");
      yazi(et, E.turkiye[0], E.turkiye[1], "orta soluk", EN ? "TURKEY" : "TÜRKİYE", "mandaT");
      yazi(et, E.hicazK[0], E.hicazK[1], "orta soluk", EN ? "KINGDOM\nOF HEJAZ" : "HİCAZ\nKRALLIĞI", "mandaT");
      var AD = { "İstanbul": "Istanbul", "Halep": "Aleppo", "Şam": "Damascus", "Beyrut": "Beirut", "Kudüs": "Jerusalem", "Hayfa": "Haifa", "Bağdat": "Baghdad", "Musul": "Mosul", "Kerkük": "Kirkuk", "Kahire": "Cairo", "Medine": "Medina", "Akabe": "Aqaba" };
      H2.sehir.forEach(function (c) {
        et.appendChild(svg("rect", { x: c[1] - 2.8, y: c[2] - 2.8, width: 5.6, height: 5.6, "class": "kare" }));
        var sol = ["Kudüs", "Hayfa", "Beyrut"].indexOf(c[0]) >= 0;   // kalabalık kıyıda ad noktanın soluna
        yazi(et, c[1] + (sol ? -6.5 : 6.5), c[2] + 3.6, "sehir" + (sol ? " sol" : ""), EN ? (AD[c[0]] || c[0]) : c[0]);
      });
      s.appendChild(et);
      cerceveKirp(s, defs, H2.w, H2.h, "taVbG");
      SVG.genis = s;
      Object.assign(KATLAR, { osm1914: ["osm1914", "demiryolu", "osmG"], sykes: ["sykes", "sykesT"], mandalar: ["mandalar", "sinirG", "mandaT"] });
    })();

    var cerceve = el("div", "ta-h-cerceve"); cerceve.append(SVG.yakin, SVG.genis);
    var bilgi = el("div", "ta-h-bilgi");
    var hy = el("b", "ta-h-yil"), ha = el("p", "ta-h-ad"), hn = el("p", "ta-h-not"), hkay = el("p", "ta-h-kaynak");
    var kapat = el("button", "ta-h-kapat", EN ? "Close ×" : "Kapat ×"); kapat.type = "button";
    bilgi.append(hy, ha, hn, hkay, kapat);
    var mini = el("button", "ta-h-mini"); mini.type = "button"; mini.setAttribute("aria-label", EN ? "Enlarge map" : "Haritayı büyüt");
    var miniYil = el("span", "ta-h-mini-yil"); mini.appendChild(miniYil);
    hk.append(cerceve, bilgi, mini);
    var dugme = el("button", "ta-h-dugme"); dugme.type = "button";
    document.body.appendChild(dugme);

    var mod = "", elle = false;
    HR.elle = function (v, sessiz) { elle = v; if (!sessiz && HR.iste) { mod = ""; HR.iste(); } };
    mini.onclick = function () { HR.elle(true); };
    dugme.onclick = function () { HR.elle(true); };
    kapat.onclick = function () { HR.elle(false); };
    addEventListener("keydown", function (e) { if (e.key === "Escape" && elle) HR.elle(false); });
    HR.mod = function (m) {
      if (elle) m = "acik";
      if (m === mod) return;
      mod = m;
      hk.className = "ta-harita m-" + m + (hk.classList.contains("degisti") ? " degisti" : "");
      var kucuk = m !== "buyuk" && m !== "acik";
      [SVG.yakin, SVG.genis].forEach(function (s) { s.setAttribute("preserveAspectRatio", kucuk ? "xMidYMid slice" : "xMidYMid meet"); });
      dugme.classList.toggle("gorunur", m === "gizli");
      document.documentElement.classList.toggle("ta-h-acik", m === "acik");
    };
    window.__taHarita = function (ad, m) { HR.su = null; HR.goster(ad); if (m) { elle = m === "acik"; mod = ""; HR.mod(m); } };   // deneme ve paylaşım görüntüsü için
    HR.goster = function (ad) {
      if (!ad || HR.su === ad || !KATLAR[ad]) return;
      HR.su = ad;
      var m = M[ad] || {}, pen = m.pencere === "genis" ? "genis" : "yakin";
      hk.dataset.pencere = pen;
      SVG[pen].querySelectorAll(".h-kat").forEach(function (g) { g.classList.toggle("acik", KATLAR[ad].indexOf(g.getAttribute("data-kat")) >= 0); });
      hk.classList.remove("degisti"); void hk.offsetWidth; hk.classList.add("degisti");
      hy.textContent = m.yil || ""; miniYil.textContent = m.yil || "";
      ha.textContent = (EN && m.ad_en) || m.ad || ""; hn.textContent = (EN && m.not_en) || m.not || "";
      hkay.textContent = pen === "genis"
        ? (EN ? "Relief: AWS Terrain Tiles · coastlines and borders: Natural Earth · zones schematic" : "Arazi: AWS Terrain Tiles · kıyılar ve sınırlar: Natural Earth · bölgeler şematik")
        : (EN ? "Relief: AWS Terrain Tiles · borders: Natural Earth · some areas schematic" : "Arazi: AWS Terrain Tiles · sınırlar: Natural Earth · bazı bölümler şematik");
      dugme.textContent = (EN ? "Map" : "Harita") + (m.yil ? " · " + m.yil : "");
    };
  }

  // --- akış nehri: her akış bir dere; yan yana akabilir ---
  var NH = {};
  function nehirKur(n, L) {
    var Y0 = 1914, Y1 = 2026, W = 92, HH = 1000;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + HH, preserveAspectRatio: "none", "class": "ta-nsvg", "aria-hidden": "true" });
    var serit = [];
    var y = function (t) { return 20 + (t - Y0) / (Y1 - Y0) * (HH - 40); };
    L.forEach(function (a) { var i = 0; while (serit[i] != null && serit[i] > a.yillar[0]) i++; serit[i] = a.yillar[1]; a._s = i; });
    L.forEach(function (a) {
      s.appendChild(svg("rect", { x: 14 + a._s * 22, y: y(a.yillar[0]), width: 12, height: Math.max(8, y(a.yillar[1]) - y(a.yillar[0])), rx: 6, fill: a.renk, "class": "ta-dere", "data-akis": a.anahtar }));
    });
    [1914, 1948, 1967, 1987, 2023].forEach(function (t) { var tx = svg("text", { x: W - 2, y: y(t) + 4, "class": "ta-n-yil" }); tx.textContent = t; s.appendChild(tx); });
    var cz = svg("line", { x1: 4, x2: W - 30, y1: 0, y2: 0, "class": "ta-n-simdi" }); s.appendChild(cz);
    n.appendChild(s);
    var cubuk = el("div", "ta-n-cubuk"); L.forEach(function (a) { var i = el("i"); i.style.background = a.renk; i.dataset.akis = a.anahtar; cubuk.appendChild(i); }); n.appendChild(cubuk);
    NH.yil = function (t) { var yy = y(t); cz.setAttribute("y1", yy); cz.setAttribute("y2", yy); };
    NH.akis = function (k) { n.querySelectorAll("[data-akis]").forEach(function (e) { e.classList.toggle("su", e.dataset.akis === k); }); };
  }

  // --- kaydırma: her izlenen öğeye --p; ortadaki öğeye göre nehir; harita anlarına göre haritanın hâli ---
  function ilerlemeKur() {
    var izle = Array.prototype.slice.call(document.querySelectorAll(".izle"));
    var anlar = Array.prototype.slice.call(document.querySelectorAll(".ta-an"));
    var bekliyor = false;
    function iste() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(guncelle); } }
    HR.iste = iste;
    function guncelle() {
      bekliyor = false;
      var vh = innerHeight, orta = vh * .45, en = null, enUzak = 1e9;
      izle.forEach(function (e) {
        var r = e.getBoundingClientRect();
        if (r.bottom < -vh * .3 || r.top > vh * 1.3) return;
        var p = AZALT ? 1 : (e.classList.contains("ta-acilis") || e.classList.contains("ta-giris")) ? (vh - r.top) / (vh * .75) : (vh - r.top) / (vh * .45);
        p = Math.max(0, Math.min(1, p));
        e.style.setProperty("--p", p.toFixed(3));
        if (e.classList.contains("ta-giris")) e.style.setProperty("--c", Math.max(0, Math.min(1, -r.top / (vh * .6))).toFixed(3));
        var m = Math.abs(r.top + Math.min(r.height, vh * .5) / 2 - orta);
        if (r.top < vh * .8 && r.bottom > vh * .15 && m < enUzak && e.closest(".ta-bolum")) { en = e; enUzak = m; }
      });
      if (en) {
        var b = en.closest(".ta-bolum");
        if (b) { NH.akis(b.dataset.akis); document.documentElement.style.setProperty("--su", getComputedStyle(b).getPropertyValue("--renk")); }
        var yl = en.dataset.yil;
        if (!yl && b) b.querySelectorAll("[data-yil]").forEach(function (x) { if (x.compareDocumentPosition(en) & Node.DOCUMENT_POSITION_FOLLOWING) yl = x.dataset.yil; });
        if (yl) NH.yil(+yl);
      }
      // harita: ekrandaki harita anında büyük; anı geçince köşede küçük; epey ilerleyince tamamen çekilir
      var aktif = null, onceki = null, gecen = 0;
      for (var i = 0; i < anlar.length; i++) {
        var r = anlar[i].getBoundingClientRect();
        if (r.top < vh * .62 && r.bottom > vh * .38) { aktif = anlar[i]; break; }
        if (r.bottom <= vh * .38) { onceki = anlar[i]; gecen = vh * .38 - r.bottom; }
        else break;
      }
      if (aktif) { HR.elle(false, true); HR.goster(aktif.dataset.an); HR.mod("buyuk"); }
      else if (onceki) { HR.goster(onceki.dataset.an); HR.mod(gecen < vh * 1.3 ? "kucuk" : "gizli"); }
      else HR.mod("yok");   // ilk harita anından önce harita da düğmesi de görünmez
    }
    addEventListener("scroll", iste, { passive: true });
    addEventListener("resize", iste);
    HR.goster("osm1914");
    iste();
  }
})();
