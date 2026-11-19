// Tarihçe: bir yüzyılın akışları (taslak). Veri: site/tarihce-akis.json (akışlar), site/donum.json (olay metinleri),
// site/tarihce-harita.json (Natural Earth'ten üretilmiş harita yolları). Kaydırdıkça parçalar yerine oturur: her öğe
// görünüme girdikçe 0'dan 1'e giden bir --p değeri alır; CSS geri kalanını yapar.
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

  Promise.all([
    fetch("site/tarihce-akis.json?v=1").then(function (r) { return r.json(); }),
    fetch("site/donum.json?v=20").then(function (r) { return r.json(); }),
    fetch("site/tarihce-harita.json?v=1").then(function (r) { return r.json(); }),
    fetch("data/gorsel/tarihce/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    fetch("data/gorsel/kapak/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }),
    BG ? BG.hazir : null
  ]).then(function (x) { kur(x[0], x[1], x[2], (x[3] || []).concat(x[4] || [])); })
    .catch(function (e) { kok.textContent = "Tarihçe yüklenemedi."; console.error(e); });

  function kur(A, D, H, K) {
    kok.textContent = "";
    var kunye = {}; K.forEach(function (k) { kunye[k.ad] = k; });
    function gorselYol(o) {
      if (!o.gorsel) return null;
      var k = kunye[o.gorsel];
      return "data/gorsel/" + (o.gorsel_klasor || "tarihce") + "/" + (k && k.dosya ? k.dosya : o.gorsel + ".jpg");
    }
    // donum.json dizini: "tarih" ve "tarih|kelime"
    function bul(ref) {
      var p = String(ref).split("|");
      return D.olaylar.find(function (o) { return o.tarih === p[0] && (!p[1] || o.baslik.indexOf(p[1]) >= 0); });
    }

    // --- giriş ---
    var giris = el("section", "ta-giris izle");
    var ic = el("div", "ta-giris-ic");
    ic.appendChild(tatriz(46, "ta-tatriz ust"));
    var h = el("h1", "ta-baslik");
    harfle(h, "Bir yüzyılın akışları");
    ic.append(el("p", "ta-ust", "Filistin · 1914–2026"), h, el("p", "ta-ar", "تيارات قرن"),
      el("p", "ta-dek", "Osmanlı yıkıldı, toprak parsellendi. Ardından her kuşak kendi akışıyla sahneye çıktı: Kassam’ın köylüleri, Baas’ın ve Nasır’ın milliyetçiliği, fedailer ve sol, sonra İslami hareketler. Aşağı kaydırdıkça akışlar birer birer kurulur; harita her değiştiğinde yanda yeniden çizilir."));
    ic.appendChild(tatriz(46, "ta-tatriz alt"));
    var ipucu = el("p", "ta-ipucu", "Kaydır ↓"); ic.appendChild(ipucu);
    giris.appendChild(ic);
    kok.appendChild(giris);

    // --- sahne: nehir + harita + akışlar ---
    var sahne = el("div", "ta-sahne");
    var nehir = el("nav", "ta-nehir"); nehir.setAttribute("aria-label", "Akışlar");
    var hk = el("aside", "ta-harita"); hk.setAttribute("aria-label", "Harita");
    var akis = el("div", "ta-akis");
    sahne.append(nehir, hk, akis);
    kok.appendChild(sahne);

    haritaKur(hk, H, A.haritalar);
    nehirKur(nehir, A.akislar);

    A.akislar.forEach(function (a, ai) {
      var s = el("section", "ta-bolum"); s.id = "akis-" + a.anahtar; s.dataset.akis = a.anahtar; s.dataset.harita = a.harita || "";
      s.style.setProperty("--renk", a.renk);
      // açılış: yıllar ve ad parça parça yerine oturur
      var ac = el("header", "ta-acilis izle"); ac.dataset.harita = a.harita || ""; ac.dataset.yil = a.yillar[0];
      var no = el("p", "ta-no", String(ai + 1).padStart(2, "0") + " / " + String(A.akislar.length).padStart(2, "0"));
      var yy = el("p", "ta-yillar"); harfle(yy, a.yillar[0] + "–" + (a.yillar[1] >= 2026 ? "" : a.yillar[1]));
      var ad = el("h2", "ta-ad"); harfle(ad, a.ad);
      ac.append(no, yy, ad);
      if (a.alt) ac.appendChild(el("p", "ta-alt", a.alt));
      ac.appendChild(el("p", "ta-ar", a.ar));
      var tz = el("p", "ta-tez", a.tez);
      if (a.tez_kaynak) { var tk = el("a", "ta-kaynak", " " + a.tez_kaynak.ad + " ↗"); tk.href = a.tez_kaynak.url; tk.target = "_blank"; tk.rel = "noopener"; tz.appendChild(tk); }
      ac.appendChild(tz);
      ac.appendChild(tatriz(24, "ta-tatriz kucuk"));
      s.appendChild(ac);

      // öğeler: ana olaylar verilen sırada, yan olaylar tarihine göre araya
      var ana = a.olaylar.filter(function (o) { return !o.yan; }), yan = a.olaylar.filter(function (o) { return o.yan; });
      var liste = el("div", "ta-liste");
      var sonTarih = "";
      ana.forEach(function (o) {
        var t = o.ref ? (bul(o.ref) || {}).tarih : o.tarih;
        yan = yan.filter(function (y) {
          var yt = y.ref ? (bul(y.ref) || {}).tarih : y.tarih;
          if (t && yt && yt < t) { liste.appendChild(kart(y, true)); return false; }
          return true;
        });
        liste.appendChild(kart(o, false));
        if (t) sonTarih = t;
      });
      yan.forEach(function (y) { liste.appendChild(kart(y, true)); });
      s.appendChild(liste);

      if (a.gecis) {
        var g = el("div", "ta-gecis izle");
        g.appendChild(el("span", "ta-gecis-ok", "→"));
        g.appendChild(el("p", null, a.gecis));
        s.appendChild(g);
      }
      akis.appendChild(s);
    });

    var son = el("footer", "ta-son");
    son.appendChild(el("p", null, "Taslak. Haritalar Natural Earth (kamu malı) verisinden çizildi; 1947 planı, Oslo bölgeleri ve 2025 hattı şematiktir. Görseller Wikimedia Commons’tan, açık lisanslı ya da kamu malı."));
    var kl = el("p", "ta-kunyeler"); kl.id = "taKunye"; son.appendChild(kl);
    kok.appendChild(son);
    kunyeYaz(kl);

    function kart(o, yanMi) {
      if (o.tur === "alinti") return alinti(o);
      if (o.tur === "biyografi") return biyografi(o);
      var v = o.ref ? bul(o.ref) : o;
      if (!v) { console.warn("yok", o.ref); return document.createComment("yok " + o.ref); }
      var k = el("article", "ta-kart izle" + (yanMi ? " yan" : ""));
      k.dataset.yil = yil(v.tarih); if (o.harita) k.dataset.harita = o.harita;
      var gy = gorselYol(o);
      if (gy && !yanMi) {
        var f = el("figure", "ta-gorsel");
        var im = new Image(); im.src = gy; im.alt = ""; im.loading = "lazy"; im.decoding = "async";
        im.onerror = function () { f.remove(); };
        f.appendChild(im);
        var ku = kunye[o.gorsel]; if (ku) f.appendChild(el("figcaption", null, ku.tr));
        k.appendChild(f);
      }
      if (yanMi) k.appendChild(el("span", "ta-yan-et", "Yan olay"));
      k.appendChild(el("time", "ta-tarih", tarihAd(v.tarih)));
      k.appendChild(el("h3", null, N(EN && v.baslik_en ? v.baslik_en : v.baslik)));
      k.appendChild(el("p", null, N(EN && v.metin_en ? v.metin_en : v.metin)));
      var ks = (v.kaynaklar || []).filter(function (x) { return x && x.url; });
      if (ks.length) {
        var kk = el("p", "ta-kaynaklar");
        ks.slice(0, 3).forEach(function (x, i) { if (i) kk.append(" · "); var a = el("a", null, (x.ad || "kaynak") + " ↗"); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; kk.appendChild(a); });
        k.appendChild(kk);
      }
      return k;
    }
    function alinti(o) {
      var b = el("blockquote", "ta-alinti izle");
      var gy = gorselYol(o);
      if (gy) { var im = new Image(); im.src = gy; im.alt = ""; im.className = "ta-alinti-yuz"; im.onerror = function () { im.remove(); }; b.appendChild(im); }
      b.appendChild(el("span", "ta-tirnak", "“"));
      b.appendChild(el("p", "ta-yer", o.yer_tutucu));
      b.appendChild(el("p", "ta-alinti-ozet", o.metin));
      b.appendChild(el("cite", null, o.kisi + " · " + o.eser));
      return b;
    }
    function biyografi(o) {
      var b = el("article", "ta-bio izle");
      var ust = el("div", "ta-bio-ust");
      var gy = gorselYol(o);
      if (gy) { var im = new Image(); im.src = gy; im.alt = o.kisi; im.loading = "lazy"; im.onerror = function () { im.remove(); }; ust.appendChild(im); }
      var b1 = el("div");
      b1.append(el("span", "ta-yan-et", "Biyografi"), el("h3", null, o.kisi), el("p", "ta-bio-yil", o.yillar), el("p", null, o.ozet));
      ust.appendChild(b1); b.appendChild(ust);
      var ol = el("ol", "ta-bio-serit");
      o.satirlar.forEach(function (s, i) { var li = el("li"); li.style.setProperty("--i", i); li.append(el("b", null, s[0]), el("span", null, N(s[1]))); ol.appendChild(li); });
      b.appendChild(ol);
      (o.kaynaklar || []).forEach(function (x) { var p = el("p", "ta-kaynaklar"); var a = el("a", null, x.ad + " ↗"); a.href = x.url; a.target = "_blank"; a.rel = "noopener"; p.appendChild(a); b.appendChild(p); });
      return b;
    }
    function kunyeYaz(kl) {
      var kul = {};
      document.querySelectorAll(".ta-gorsel img, .ta-alinti-yuz, .ta-bio-ust img").forEach(function (im) { var m = (im.getAttribute("src") || "").match(/\/([^/]+)\.(jpg|png|webp)$/); if (m) kul[m[1]] = 1; });
      var L = K.filter(function (k) { return kul[k.ad]; });
      if (!L.length) return;
      kl.appendChild(document.createTextNode("Görseller: "));
      L.forEach(function (x, i) {
        if (i) kl.appendChild(document.createTextNode(" · "));
        var a = el("a", null, x.tr + ", " + String(x.yazar || "").replace(/^Unknown author.*/, "fotoğrafçısı bilinmiyor") + ", " + x.lisans);
        a.href = x.sayfa; a.target = "_blank"; a.rel = "noopener"; kl.appendChild(a);
      });
    }

    ilerlemeKur(A);
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

  // --- harita ---
  var HR = {};
  function haritaKur(hk, H, M) {
    var s = svg("svg", { viewBox: "0 0 " + H.w + " " + H.h, "class": "ta-hsvg", role: "img", "aria-label": EN ? "Map of historic Palestine" : "Tarihî Filistin haritası" });
    var defs = svg("defs");
    var cl = svg("clipPath", { id: "taFil" }); H.filistin.forEach(function (d) { cl.appendChild(svg("path", { d: d })); }); defs.appendChild(cl);
    var clg = svg("clipPath", { id: "taGz" }); H.gazze.forEach(function (d) { clg.appendChild(svg("path", { d: d })); }); defs.appendChild(clg);
    var tar = svg("pattern", { id: "taTarali", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    tar.appendChild(svg("line", { x1: 0, y1: 0, x2: 0, y2: 6, "class": "tar-cizgi" }));
    defs.appendChild(tar);
    var sg_ = svg("filter", { id: "taGolge", x: "-10%", y: "-10%", width: "120%", height: "120%" });
    sg_.appendChild(svg("feDropShadow", { dx: 0, dy: 0, stdDeviation: 2.2, "flood-color": "#000", "flood-opacity": .85 })); defs.appendChild(sg_);
    s.appendChild(defs);
    // zemin: deniz ve kara (vektör, arazi görseli yüklenemezse görünür), üstünde gölgeli arazi
    s.appendChild(svg("rect", { width: H.w, height: H.h, "class": "h-deniz" }));
    var g0 = svg("g", { "class": "h-kara" }); H.komsu.concat(H.filistin).forEach(function (d) { g0.appendChild(svg("path", { d: d })); }); s.appendChild(g0);
    var ar = svg("image", { href: "data/gorsel/arazi/tarihce-arazi.jpg", x: 0, y: 0, width: H.w, height: H.h, preserveAspectRatio: "none", "class": "h-arazi" });
    ar.addEventListener("error", function () { ar.remove(); });
    s.appendChild(ar);
    function kat(ad, yollar, sinif, kirp) {
      var g = svg("g", { "class": "h-kat " + sinif, "data-kat": ad }); if (kirp) g.setAttribute("clip-path", "url(#" + kirp + ")");
      yollar.forEach(function (d) { g.appendChild(svg("path", { d: d })); }); s.appendChild(g); return g;
    }
    // Osmanlı: kuzeyde, doğuda ve güneydoğuda sınır yok; Filistin, Suriye, Lübnan, Ürdün ve Hicaz tek renk
    kat("osm", H.osmanli.concat(H.filistin), "osmanli");
    kat("misir", H.misir, "misir");
    // mandadan sonra çizilen sınırlar: komşuların ve tarihî Filistin'in dış çizgisi (iç ateşkes hattı çizilmez)
    kat("sinir", H.komsu, "sinir");
    kat("kayip", H.filistin, "kayip");
    kat("tam", H.filistin, "fil");
    kat("manda", H.filistin, "tarali");
    kat("plan1947", H.plan1947, "fil", "taFil");
    kat("bati", H.bati, "fil");
    kat("gazze", H.gazze, "fil");
    kat("isgal", H.bati.concat(H.gazze), "tarali");
    kat("isgalB", H.bati, "tarali");
    kat("oslo", H.oslo_ab, "fil parlak", "taFil");
    kat("ablukaH", H.gazze, "abluka");
    var sh = kat("sari", [H.sari_hat], "tarali koyu", "taGz");
    var nh = svg("g", { "class": "h-nehir" }); H.nehir.forEach(function (d) { nh.appendChild(svg("path", { d: d })); }); s.appendChild(nh);
    var kd = svg("circle", { cx: H.kudus[0], cy: H.kudus[1], r: 10, "class": "h-kat kudus", "data-kat": "kudus" }); s.appendChild(kd);
    // etiketler: bölge adları (Al Jazeera haritalarındaki gibi büyük, beyaz, gölgeli), şehirler kare imle
    var et = svg("g", { "class": "h-etiket", filter: "url(#taGolge)" });
    H.etiket.forEach(function (e, i) {
      // modern ülke adları (Ürdün, Suriye, Lübnan) Osmanlı haritasında görünmez
      var ulke = ["ÜRDÜN", "SURİYE", "LÜBNAN"].indexOf(e[0]) >= 0;
      var t = svg("text", { x: e[2], y: e[3], "class": "bolge" + (ulke ? " h-kat" : "") }); if (ulke) t.setAttribute("data-kat", "ulkeT");
      t.textContent = EN ? e[1] : e[0]; et.appendChild(t);
    });
    var osmT = svg("text", { x: 404, y: 150, "class": "h-kat buyuk", "data-kat": "osmT" }); osmT.textContent = EN ? "OTTOMAN STATE" : "OSMANLI DEVLETİ"; et.appendChild(osmT);
    var bs = svg("text", { x: 268, y: 262, "class": "h-kat orta", "data-kat": "bsT" }); bs.textContent = EN ? "WEST BANK" : "BATI ŞERİA"; et.appendChild(bs);
    var gzT = svg("text", { x: 118, y: 372, "class": "h-kat orta sag", "data-kat": "gzT" }); gzT.textContent = EN ? "GAZA" : "GAZZE"; et.appendChild(gzT);
    H.sehir.forEach(function (c) {
      et.appendChild(svg("rect", { x: c[1] - 2.6, y: c[2] - 2.6, width: 5.2, height: 5.2, "class": "kare" }));
      var t = svg("text", { x: c[1] + 6, y: c[2] + 3.4, "class": "sehir" }); t.textContent = EN ? ({ "Kudüs": "Jerusalem", "Yafa": "Jaffa", "Hayfa": "Haifa", "Gazze": "Gaza", "El-Halil": "Hebron", "Birüssebi": "Beersheba", "Akka": "Acre", "Cenin": "Jenin" }[c[0]] || c[0]) : c[0];
      et.appendChild(t);
    });
    s.appendChild(et);
    var bas = el("div", "ta-h-bas"); var hy = el("b", "ta-h-yil"); var ha = el("span", "ta-h-ad"); bas.append(hy, ha);
    var hn = el("p", "ta-h-not");
    var B1 = EN ? "Enlarge map" : "Haritayı büyüt", B2 = EN ? "Close" : "Kapat";
    var buyut = el("button", "ta-h-buyut", B1); buyut.type = "button";
    buyut.onclick = function () { document.documentElement.classList.toggle("ta-h-acik"); buyut.textContent = document.documentElement.classList.contains("ta-h-acik") ? B2 : B1; };
    hk.append(bas, s, hn, buyut, el("p", "ta-h-kaynak", EN ? "Relief: AWS Terrain Tiles · borders: Natural Earth · some areas schematic" : "Arazi: AWS Terrain Tiles · sınırlar: Natural Earth · bazı bölümler şematik"));
    var SON = ["sinir", "kayip", "ulkeT"];
    var KATLAR = {
      tam: ["osm", "misir", "osmT"], manda: ["sinir", "tam", "manda", "ulkeT"], plan1947: SON.concat(["plan1947", "kudus"]), "1949": SON.concat(["bati", "gazze", "bsT", "gzT"]),
      "1967": SON.concat(["bati", "gazze", "isgal", "bsT", "gzT"]), oslo: SON.concat(["bati", "gazze", "isgalB", "oslo", "bsT", "gzT"]),
      abluka: SON.concat(["bati", "gazze", "isgalB", "oslo", "ablukaH", "bsT", "gzT"]), sari: SON.concat(["bati", "gazze", "isgalB", "oslo", "ablukaH", "sari", "bsT", "gzT"])
    };
    HR.goster = function (ad) {
      if (!ad || HR.su === ad || !KATLAR[ad]) return;
      HR.su = ad;
      s.querySelectorAll(".h-kat").forEach(function (g) { g.classList.toggle("acik", KATLAR[ad].indexOf(g.getAttribute("data-kat")) >= 0); });
      var m = M[ad] || {};
      hk.classList.remove("degisti"); void hk.offsetWidth; hk.classList.add("degisti");
      hy.textContent = m.yil || ""; ha.textContent = (EN && m.ad_en) || m.ad || ""; hn.textContent = (EN && m.not_en) || m.not || "";
    };
  }

  // --- akış nehri: her akış bir dere; yan yana akabilir ---
  var NH = {};
  function nehirKur(n, L) {
    var Y0 = 1914, Y1 = 2026, W = 92, HH = 1000;
    var s = svg("svg", { viewBox: "0 0 " + W + " " + HH, preserveAspectRatio: "none", "class": "ta-nsvg", "aria-hidden": "true" });
    var serit = [];   // şerit atama: çakışmayan akış aynı şeride
    var y = function (t) { return 20 + (t - Y0) / (Y1 - Y0) * (HH - 40); };
    L.forEach(function (a) {
      var i = 0; while (serit[i] != null && serit[i] > a.yillar[0]) i++;
      serit[i] = a.yillar[1]; a._s = i;
    });
    L.forEach(function (a) {
      var x = 14 + a._s * 22;
      var r = svg("rect", { x: x, y: y(a.yillar[0]), width: 12, height: Math.max(8, y(a.yillar[1]) - y(a.yillar[0])), rx: 6, fill: a.renk, "class": "ta-dere", "data-akis": a.anahtar });
      s.appendChild(r);
    });
    [1914, 1948, 1967, 1987, 2023].forEach(function (t) { var tx = svg("text", { x: W - 2, y: y(t) + 4, "class": "ta-n-yil" }); tx.textContent = t; s.appendChild(tx); });
    var cz = svg("line", { x1: 4, x2: W - 30, y1: 0, y2: 0, "class": "ta-n-simdi" }); s.appendChild(cz);
    n.appendChild(s);
    var ol = el("ol", "ta-n-liste");
    L.forEach(function (a, i) {
      var li = el("li"); var b = el("a", null, a.ad); b.href = "#akis-" + a.anahtar; b.style.setProperty("--renk", a.renk); b.dataset.akis = a.anahtar;
      li.appendChild(b); ol.appendChild(li);
    });
    n.appendChild(ol);
    var cubuk = el("div", "ta-n-cubuk"); L.forEach(function (a) { var i = el("i"); i.style.background = a.renk; i.dataset.akis = a.anahtar; cubuk.appendChild(i); }); n.appendChild(cubuk);
    NH.yil = function (t) { var yy = y(t); cz.setAttribute("y1", yy); cz.setAttribute("y2", yy); };
    NH.akis = function (k) {
      n.querySelectorAll("[data-akis]").forEach(function (e) { e.classList.toggle("su", e.dataset.akis === k); });
    };
  }

  // --- kaydırma: her izlenen öğeye --p; ortadaki öğeye göre harita, nehir ---
  function ilerlemeKur() {
    var izle = Array.prototype.slice.call(document.querySelectorAll(".izle"));
    // Görünürlüğü her karede doğrudan ölçüyoruz: kayan (yandan gelen) öğeler dönüşüm yüzünden ekran dışında sayılmasın.
    var gorunen = { forEach: function (f) { izle.forEach(function (e) { var r = e.getBoundingClientRect(); if (r.bottom > -innerHeight * .3 && r.top < innerHeight * 1.3) f(e); }); } };
    var bekliyor = false;
    function iste() { if (!bekliyor) { bekliyor = true; requestAnimationFrame(guncelle); } }
    function guncelle() {
      bekliyor = false;
      var vh = innerHeight, orta = vh * .45, en = null, enUzak = 1e9;
      gorunen.forEach(function (e) {
        var r = e.getBoundingClientRect();
        var p;
        if (AZALT) p = 1;
        else if (e.classList.contains("ta-acilis") || e.classList.contains("ta-giris")) p = (vh - r.top) / (vh * .75);
        else p = (vh - r.top) / (vh * .45);
        p = Math.max(0, Math.min(1, p));
        e.style.setProperty("--p", p.toFixed(3));
        if (e.classList.contains("ta-giris")) e.style.setProperty("--c", Math.max(0, Math.min(1, -r.top / (vh * .6))).toFixed(3));
        var m = Math.abs(r.top + Math.min(r.height, vh * .5) / 2 - orta);
        if (r.top < vh * .8 && r.bottom > vh * .15 && m < enUzak && e.closest(".ta-bolum")) { en = e; enUzak = m; }
      });
      if (en) {
        var b = en.closest(".ta-bolum");
        if (b) { NH.akis(b.dataset.akis); document.documentElement.style.setProperty("--su", getComputedStyle(b).getPropertyValue("--renk")); }
        // yıl: bu öğenin ya da bölümde ondan önceki son yıl
        var yl = en.dataset.yil;
        if (!yl && b) b.querySelectorAll("[data-yil]").forEach(function (x) { if (x.compareDocumentPosition(en) & Node.DOCUMENT_POSITION_FOLLOWING) yl = x.dataset.yil; });
        if (yl) NH.yil(+yl);
        // harita: bu öğenin ya da bölümde ondan önceki son harita değişikliği
        var h = en.dataset.harita;
        if (!h && b) {
          h = b.dataset.harita;
          var onceki = b.querySelectorAll("[data-harita]:not([data-harita=''])");
          for (var i = 0; i < onceki.length; i++) {
            if (!(onceki[i].compareDocumentPosition(en) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
            if (onceki[i].dataset.harita) h = onceki[i].dataset.harita;
          }
        }
        HR.goster(h);
      }
    }
    addEventListener("scroll", iste, { passive: true });
    addEventListener("resize", iste);
    HR.goster("tam");
    iste();
  }
})();
