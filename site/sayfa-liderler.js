// Liderler raporu: data/bulten/liderler.json ve alisma.json (kitlesel ölüm günleri).
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var AYTAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: d == null ? 1 : d }); }
  function yuzde(a, b) { return b ? "%" + sayi(100 * a / b, 0) : "–"; }
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ayAd(m) { return AYTAM[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  var RENK = { toplam: "#cfd3cf", gazze: "#1f7a52", soykirim: "#c9302c", netanyahu: "#2f5bb7", siyonist: "#8a6d3b", israil: "#6f7772", ateskes: "#7a3fa0", hamas: "#c39a35", katliam: "#e07b39" };

  var zaman = Math.floor(Date.now() / 6e5);
  Promise.all([fetch("data/bulten/liderler.json?t=" + zaman).then(function (r) { return r.json(); }),
    fetch("data/bulten/alisma.json?t=" + zaman).then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch("data/konusma/erdogan.json?t=" + zaman).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (x) { KON = x[2]; ciz(x[0], x[1]); })
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", "Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.")); });

  var L = {}, KON = null;
  function ciz(v, a) {
    v.liderler.forEach(function (x) { L[x.anahtar] = x; });
    var e = L.erdogan, tr = v.tr_olaylar;
    var em = konusmaOzet();
    var og = a ? a.olum_gunleri : [];
    var deger = {
      donem: ayAd(v.aylar[0]) + " – " + ayAd(v.aylar[v.aylar.length - 1]),
      guncel: "Güncellendi: " + new Date(v.guncellendi).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
      taslak: a && !a.tarama_bitti ? "Tarama sürüyor; sayılar kesinleşmedi" : "",
      erdogan_metin: em ? em.metin : "Konuşmalar Cumhurbaşkanlığı sitesinden toplanıyor; ilk sonuçlar birkaç saat içinde burada olacak.",
      erdogan_alt: "Üstte: her ay yapılan konuşmalar (gri) ve bunların içinde Gazze ya da Filistin’den söz edenlerin yüzdesi (yeşil). Altta: on bin kelimede kaç kez “Gazze” ya da “Filistin” (yeşil) ve “soykırım” (kırmızı) dendiği. Kaynak: tccb.gov.tr.",
      olum_metin: og.length ? "Gazze Sağlık Bakanlığı’nın bir günde 300 ya da daha fazla yeni ölüm bildirdiği " + og.length + " gün için, her lider grubunun adının o gün ve sonraki iki gün kaç kat daha sık geçtiğini hesapladık. 1,5 kattan az artış, o liderlerin haber olacak bir şey söylemediğine işaret ediyor." : ""
    };
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });
    var k = $("kartlar");
    var kart = function (b, s) { var d = el("div", "rp-kart"); d.append(el("b", null, b), el("span", null, s)); k.appendChild(d); };
    kart(sayi(v.liderler.length, 0), "lider, bakan ve BM yetkilisinin adı Filistin bağlamındaki başlıklarda izlendi");
    if (e) kart(yuzde(e.kelime.soykirim, e.toplam), "Erdoğan’ın adının geçtiği Filistin başlıklarında “soykırım” da geçiyor");
    if (em) kart(em.kartB, em.kartS);
    var ol = olumOzet(og);
    var abd = ol.filter(function (x) { return x.grup === "ABD"; })[0];
    if (abd) kart(abd.sessiz + " / " + abd.n, "kitlesel ölüm gününde ABD liderlerinin adı 1,5 kat bile artmadı");
    [gruplar, erdoganGrafik, hedef, kelimeler, tetik, function () { olumTablo(ol); }, ornekler, yontem].forEach(function (f) { try { f(v); } catch (er) { if (window.console) console.error("liderler", er); } });
  }

  // ---- Erdoğan'ın resmî konuşmaları (tccb.gov.tr)
  var IMLER = [{ gun: "2023-10-07", ad: "7 Ekim" }, { gun: "2024-03-31", ad: "Türkiye’de yerel seçim" }, { gun: "2024-11-05", ad: "ABD seçimi" },
    { gun: "2025-01-20", ad: "Trump göreve başladı" }, { gun: "2025-10-10", ad: "Gazze’de ateşkes" }];
  function kv(k, a) { return (k.sayi && k.sayi[a]) || 0; }
  function aylik() {
    var A = {}; KON.konusmalar.forEach(function (k) {
      var m = k.tarih.slice(0, 7), x = A[m] = A[m] || { ay: m, n: 0, nf: 0, kelime: 0, gf: 0, soy: 0, isr: 0 };
      x.n++; x.kelime += k.kelime; var gf = kv(k, "gazze") + kv(k, "filistin"); x.gf += gf; if (gf) x.nf++; x.soy += kv(k, "soykirim"); x.isr += kv(k, "israil");
    });
    return Object.keys(A).sort().map(function (m) { return A[m]; });
  }
  function donem(b, e) {
    var xs = KON.konusmalar.filter(function (k) { return k.tarih >= b && k.tarih < e; });
    var t = function (a) { return xs.reduce(function (s, k) { return s + (typeof a === "function" ? a(k) : kv(k, a)); }, 0); };
    var kel = t(function (k) { return k.kelime; }) || 1, nf = xs.filter(function (k) { return kv(k, "gazze") + kv(k, "filistin"); }).length;
    var on = function (x) { return 1e4 * x / kel; };
    return { n: xs.length, nf: nf, pay: xs.length ? 100 * nf / xs.length : null, gf: on(t("gazze") + t("filistin")), soy: on(t("soykirim")), net: on(t("netanyahu")), abd: on(t("abd") + t("trump") + t("biden")), gun: Math.max(1, (Date.parse(e) - Date.parse(b)) / 864e5) };
  }
  function ekleGun(g, n) { var d = new Date(g + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function konusmaOzet() {
    if (!KON || !KON.konusmalar || KON.konusmalar.length < 20) return null;
    var yo = donem(ekleGun("2024-03-31", -90), "2024-03-31"), ys = donem("2024-03-31", ekleGun("2024-03-31", 90));
    var ao = donem(ekleGun("2024-11-05", -90), "2024-11-05"), as = donem("2024-11-05", "2025-01-20"), tr = donem("2025-01-20", ekleGun("2025-01-20", 90));
    var A = aylik().filter(function (x) { return x.ay >= "2023-10"; }), tepe = A.reduce(function (a, x) { return x.kelime > 2000 && 1e4 * x.gf / x.kelime > 1e4 * a.gf / Math.max(1, a.kelime) ? x : a; }, A[0]);
    var on = function (x) { return sayi(x, 1); };
    var metin = "Toplanan " + KON.konusmalar.length + " konuşmaya göre: Türkiye’deki yerel seçimden önceki üç ayda Erdoğan konuşmalarının yüzde " + sayi(yo.pay, 0) + " kadarında Gazze ya da Filistin’den söz etti, on bin kelimede " + on(yo.gf) + " kez; seçimden sonraki üç ayda yüzde " + sayi(ys.pay, 0) + ", on bin kelimede " + on(ys.gf) + ". " +
      "ABD seçiminden önceki üç ayda on bin kelimede " + on(ao.gf) + " kez Gazze ya da Filistin dedi; ABD seçimi ile Trump’ın göreve başlaması arasında " + on(as.gf) + ", Trump’ın ilk üç ayında " + on(tr.gf) + ". “Soykırım” kelimesi aynı üç dönemde on bin kelimede " + on(ao.soy) + ", " + on(as.soy) + " ve " + on(tr.soy) + " kez geçti. " +
      "Filistin’e en çok yer verdiği ay " + ayAd(tepe.ay) + " (on bin kelimede " + on(1e4 * tepe.gf / tepe.kelime) + ").";
    return { metin: metin, kartB: on(ao.gf) + " → " + on(tr.gf), kartS: "Erdoğan’ın konuşmalarında on bin kelimede “Gazze / Filistin”: ABD seçiminden önceki üç ay → Trump’ın ilk üç ayı" };
  }
  function erdoganGrafik(v) {
    var k = $("g-erdogan");
    if (!KON || !KON.konusmalar || KON.konusmalar.length < 20) { k.appendChild(el("p", "bekliyor", "Konuşmalar toplanıyor.")); return; }
    var A = aylik(), et = A.map(function (x) { return x.ay; });
    efsane(k, [["#d5d8d5", "konuşma sayısı"], [RENK.gazze, "Gazze / Filistin geçen konuşmaların yüzdesi"]]);
    cizgi(k, et, [{ v: A.map(function (x) { return Math.round(100 * x.nf / x.n); }), renk: RENK.gazze, ad: "Gazze / Filistin geçen konuşma %", kalin: 2.4 }], A.map(function (x) { return x.n; }), IMLER, "Konuşmalarda Filistin payı", 230);
    efsane(k, [[RENK.gazze, "on bin kelimede Gazze / Filistin"], [RENK.soykirim, "on bin kelimede soykırım"], [RENK.netanyahu, "on bin kelimede Netanyahu"]]);
    var on = function (f) { return A.map(function (x) { return x.kelime ? Math.round(1e5 * f(x) / x.kelime) / 10 : 0; }); };
    var net = {}; KON.konusmalar.forEach(function (c) { var m = c.tarih.slice(0, 7); net[m] = (net[m] || 0) + kv(c, "netanyahu"); });
    cizgi(k, et, [{ v: on(function (x) { return x.gf; }), renk: RENK.gazze, ad: "Gazze / Filistin", kalin: 2.4 }, { v: on(function (x) { return x.soy; }), renk: RENK.soykirim, ad: "soykırım" }, { v: on(function (x) { return net[x.ay] || 0; }), renk: RENK.netanyahu, ad: "Netanyahu" }], null, IMLER, "On bin kelimede", 230);
    // dönem tablosu
    var D = [["7 Ekim’den önce (Ocak–Eylül 2023)", "2023-01-01", "2023-10-07"], ["7 Ekim – Türkiye yerel seçimi", "2023-10-07", "2024-03-31"], ["Yerel seçim – ABD seçimi", "2024-03-31", "2024-11-05"],
      ["ABD seçimi – Trump’ın göreve başlaması", "2024-11-05", "2025-01-20"], ["Trump’ın göreve başlaması – ateşkes", "2025-01-20", "2025-10-10"], ["Ateşkesten bu yana", "2025-10-10", "2099-01-01"]];
    var t = el("table"); t.innerHTML = "<thead><tr><th>Dönem</th><th>Konuşma</th><th>Gazze / Filistin geçen</th><th>On bin kelimede Gazze / Filistin</th><th>soykırım</th><th>Netanyahu</th><th>ABD / Trump / Biden</th></tr></thead>";
    var bd = el("tbody");
    D.forEach(function (d) { var x = donem(d[1], d[2]); if (!x.n) return; var r = el("tr"); r.append(el("td", null, d[0]), el("td", "sayi", x.n), el("td", "sayi", "%" + sayi(x.pay, 0)), el("td", "sayi", sayi(x.gf, 1)), el("td", "sayi", sayi(x.soy, 1)), el("td", "sayi", sayi(x.net, 1)), el("td", "sayi", sayi(x.abd, 1))); bd.appendChild(r); });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-donemler").appendChild(kt);
    konusmaListe();
  }
  function hedef() {
    var k = $("g-hedef"); if (!KON || !KON.konusmalar || KON.konusmalar.length < 20) return;
    var H = [["israil", "İsrail", "#6f7772"], ["israil_yonetimi", "İsrail / Netanyahu yönetimi, hükümeti", "#c39a35"], ["netanyahu", "Netanyahu", RENK.netanyahu], ["siyonist", "Siyonist", RENK.siyonist]];
    efsane(k, H.map(function (h) { return [h[2], h[1]]; }));
    var C = {}; KON.konusmalar.forEach(function (c) { if (c.tarih < "2023-10-01") return; var q = c.tarih.slice(0, 4) + " Ç" + (Math.floor((+c.tarih.slice(5, 7) - 1) / 3) + 1); var x = C[q] = C[q] || { israil: 0, israil_yonetimi: 0, netanyahu: 0, siyonist: 0 }; H.forEach(function (h) { x[h[0]] += kv(c, h[0]); }); x.israil -= kv(c, "israil_yonetimi"); });
    Object.keys(C).sort().forEach(function (q) {
      var x = C[q], top = H.reduce(function (s, h) { return s + Math.max(0, x[h[0]]); }, 0); if (!top) return;
      var r = el("div", "rp-yigin-satir"); r.appendChild(el("span", "rp-yigin-ad", q + " · " + top + " kez"));
      var y = el("div", "rp-yigin");
      H.forEach(function (h) { var n = Math.max(0, x[h[0]]); if (!n) return; var i = el("i", null, n / top >= 0.08 ? "%" + sayi(100 * n / top, 0) : ""); i.style.width = (100 * n / top) + "%"; i.style.background = h[2]; i.title = h[1] + ": " + n; y.appendChild(i); });
      r.appendChild(y); k.appendChild(r);
    });
  }
  function konusmaListe() {
    var k = $("g-konusmalar");
    KON.konusmalar.filter(function (c) { return c.kelime >= 400 && c.tarih >= "2023-10-07"; }).map(function (c) { return { c: c, o: 1e4 * (kv(c, "gazze") + kv(c, "filistin")) / c.kelime }; })
      .sort(function (a, b) { return b.o - a.o; }).slice(0, 8).forEach(function (x) {
        var c = x.c, d = el("div", "rp-zirve-kart"), b = el("div", "rp-zirve-bas");
        var a = el("a", null, c.baslik); a.href = c.url; a.target = "_blank"; a.rel = "noopener";
        var bb = el("b"); bb.appendChild(a); b.append(bb, el("span", null, gunAd(c.tarih) + " · " + sayi(c.kelime, 0) + " kelime")); d.appendChild(b);
        d.appendChild(el("p", "rp-olay-olcu", "On bin kelimede Gazze / Filistin: " + sayi(x.o, 0) + " · soykırım: " + kv(c, "soykirim") + " · Netanyahu: " + kv(c, "netanyahu") + " · Siyonist: " + kv(c, "siyonist")));
        (c.cumle || []).slice(0, 3).forEach(function (s) { d.appendChild(el("p", "rp-alinti", "“" + s + "”")); });
        k.appendChild(d);
      });
  }
  function cizgi(kap, etiketler, seriler, cubuk, isaretler, etiket, H0) {
    var W = 760, H = H0 || 240, P = { l: 36, r: 12, t: 12, b: 24 }, n = etiketler.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * (i + 0.5) / n; };
    var enY = Math.max.apply(0, seriler.map(function (s) { return Math.max.apply(0, s.v); })) || 1;
    var y = function (v) { return P.t + (H - P.t - P.b) * (1 - v / enY); };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": etiket });
    if (cubuk) { var enC = Math.max.apply(0, cubuk) || 1, bw = (W - P.l - P.r) / n; cubuk.forEach(function (c, i) { if (!c) return; var hh = (H - P.t - P.b) * 0.9 * c / enC; s.appendChild(baslik(sv("rect", { x: x(i) - bw * 0.4, y: H - P.b - hh, width: bw * 0.8, height: hh, "class": "rp-olu" }), etiketler[i] + ": " + sayi(c, 0) + " ölüm")); }); }
    [0, 0.5, 1].forEach(function (f) { s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(enY * f), y2: y(enY * f), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 5, y: y(enY * f) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = sayi(enY * f, 0); s.appendChild(t); });
    etiketler.forEach(function (m, i) { if (m.slice(5, 7) === "01" && (m.length === 7 || +m.slice(8) <= 7)) { var t = sv("text", { x: x(i), y: H - 6, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = m.slice(0, 4); s.appendChild(t); } });
    (isaretler || []).forEach(function (o) {
      var i = etiketler.findIndex(function (m) { return m >= o.gun.slice(0, m.length); }); if (i < 0) return;
      s.appendChild(baslik(sv("line", { x1: x(i), x2: x(i), y1: P.t, y2: H - P.b, stroke: "#c9302c", "stroke-dasharray": "4 3", "stroke-width": 1.2 }), o.ad + " · " + gunAd(o.gun)));
    });
    seriler.forEach(function (sr) {
      if (sr.cubuk) { var bw2 = (W - P.l - P.r) / n; sr.v.forEach(function (c, i) { if (!c) return; s.appendChild(baslik(sv("rect", { x: x(i) - bw2 * 0.42, y: y(c), width: bw2 * 0.84, height: H - P.b - y(c), fill: sr.renk }), etiketler[i] + " · " + sr.ad + ": " + c)); }); return; }
      var d = ""; sr.v.forEach(function (c, i) { d += (i ? "L" : "M") + x(i).toFixed(1) + "," + y(c).toFixed(1); });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: sr.renk, "stroke-width": sr.kalin || 1.8, "stroke-linejoin": "round" }));
      sr.v.forEach(function (c, i) { if (c) s.appendChild(baslik(sv("circle", { cx: x(i), cy: y(c), r: 6, fill: "transparent" }), etiketler[i] + " · " + sr.ad + ": " + c)); });
    });
    kap.appendChild(s);
  }
  function efsane(kap, xs) { var e = el("div", "rp-efsane"); xs.forEach(function (x) { var s = el("span"); var i = el("i"); i.style.background = x[0]; s.append(i, x[1]); e.appendChild(s); }); kap.appendChild(e); }

  function gruplar(v) {
    var k = $("g-gruplar"); efsane(k, [["#1f7a52", "adı geçen başlık"], ["#d5d8d5", "o ay bildirilen ölüm"]]);
    v.lider_gruplari.filter(function (g) { return g !== "İsrail"; }).forEach(function (g) {
      var s = v.grup_aylik[g]; if (!s || !s.some(Boolean)) return;
      var adlar = v.liderler.filter(function (x) { return x.grup === g; }).slice(0, 4).map(function (x) { return x.ad.replace(/ \(.*\)/, ""); });
      var f = el("figure", "rp-kucuk"); f.appendChild(el("figcaption", null, g));
      cizgi(f, v.aylar, [{ v: s, renk: "#1f7a52", ad: "başlık", kalin: 2 }], v.olu_ay, null, g, 200);
      f.appendChild(el("p", "rp-not", adlar.join(", ")));
      k.appendChild(f);
    });
  }
  function erdoganGrafik(v) {
    var e = L.erdogan; if (!e || !e.haftalik_tr) return;
    var k = $("g-erdogan"), s = e.haftalik_tr;
    efsane(k, [[RENK.toplam, "Erdoğan · Filistin başlığı"], [RENK.soykirim, "+ soykırım"], [RENK.netanyahu, "+ Netanyahu"], [RENK.siyonist, "+ Siyonist"]]);
    cizgi(k, v.haftalar, [{ v: s.toplam, renk: RENK.toplam, ad: "Erdoğan", cubuk: true }, { v: s.soykirim, renk: RENK.soykirim, ad: "soykırım" }, { v: s.netanyahu, renk: RENK.netanyahu, ad: "Netanyahu" }, { v: s.siyonist, renk: RENK.siyonist, ad: "Siyonist" }],
      null, v.tr_olaylar, "Erdoğan haftalık", 280);
  }
  function kelimeler(v) {
    var kk = [["soykirim", "soykırım"], ["katliam", "katliam"], ["ateskes", "ateşkes"], ["hamas", "Hamas"], ["netanyahu", "Netanyahu"], ["siyonist", "Siyonist"]];
    var xs = v.liderler.filter(function (x) { return x.toplam >= 40; });
    var sira = { a: "toplam", yon: -1 };
    var kap = $("g-kelimeler"), kt = el("div", "tablo-kutu"); kap.appendChild(kt);
    function yap() {
      kt.textContent = "";
      var t = el("table"), th = el("thead"), tr = el("tr");
      [["ad", "Lider"], ["grup", "Grup"], ["toplam", "Başlık"]].concat(kk).forEach(function (c) {
        var h = el("th", null, c[1] + (sira.a === c[0] ? (sira.yon < 0 ? " ↓" : " ↑") : "")); h.addEventListener("click", function () { sira = { a: c[0], yon: sira.a === c[0] ? -sira.yon : -1 }; yap(); }); tr.appendChild(h);
      });
      th.appendChild(tr); t.appendChild(th);
      var deg = function (x, a) { return a === "ad" || a === "grup" ? x[a] : a === "toplam" ? x.toplam : (x.kelime[a] || 0) / x.toplam; };
      var bd = el("tbody");
      xs.slice().sort(function (p, q) { var a = deg(p, sira.a), b = deg(q, sira.a); return (a > b ? 1 : a < b ? -1 : 0) * sira.yon; }).forEach(function (x) {
        var r = el("tr"); r.append(el("td", null, x.ad), el("td", null, x.grup), el("td", "sayi", sayi(x.toplam, 0)));
        kk.forEach(function (c) { r.appendChild(el("td", "sayi", yuzde(x.kelime[c[0]] || 0, x.toplam))); }); bd.appendChild(r);
      });
      t.appendChild(bd); kt.appendChild(t);
    }
    yap();
    kap.appendChild(el("p", "rp-not", "En az 40 Filistin başlığında adı geçenler. Sütun başlığına tıklayarak sırala."));
  }
  function tetik(v) {
    var t = el("table"); t.innerHTML = "<thead><tr><th>Lider grubu</th><th>En çok tetikleyen olay türleri (ortanca artış)</th><th>En az tetikleyenler</th></tr></thead>";
    var bd = el("tbody");
    v.lider_gruplari.filter(function (g) { return g !== "İsrail" && v.tetikleyici[g] && v.tetikleyici[g].length; }).forEach(function (g) {
      var xs = v.tetikleyici[g], r = el("tr");
      var yaz = function (ys) { return ys.map(function (y) { return y.ad + " " + sayi(y.ortanca_artis, 1) + "×"; }).join(" · "); };
      r.append(el("td", null, g), el("td", null, yaz(xs.slice(0, 3))), el("td", null, yaz(xs.slice(-3).reverse())));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-tetik").appendChild(kt);
    $("g-tetik").appendChild(el("p", "rp-not", "Yalnızca en az üç olayı olan türler. Artış: olay penceresinde lider grubunun adının geçtiği günlük başlık / önceki dört haftanın günlük ortalaması."));
  }
  function olumOzet(og) {
    var gr = ["Türkiye", "ABD", "Avrupa", "Arap ülkeleri", "İran", "Çin", "Rusya", "BM"];
    return gr.map(function (g) {
      var xs = og.map(function (x) { return x.lider[g]; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
      return { grup: g, n: xs.length, sessiz: xs.filter(function (x) { return x < 1.5; }).length, ortanca: xs.length ? xs[Math.floor(xs.length / 2)] : null };
    }).filter(function (x) { return x.n; });
  }
  function olumTablo(ol) {
    var t = el("table"); t.innerHTML = "<thead><tr><th>Lider grubu</th><th>Ölçülen gün</th><th>1,5 kat bile artmayan gün</th><th>Ortanca artış</th></tr></thead>";
    var bd = el("tbody");
    ol.forEach(function (x) { var r = el("tr"); r.append(el("td", null, x.grup), el("td", "sayi", x.n), el("td", "sayi", x.sessiz + " (" + yuzde(x.sessiz, x.n) + ")"), el("td", "sayi", sayi(x.ortanca, 1) + "×")); bd.appendChild(r); });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-olum").appendChild(kt);
    $("g-olum").appendChild(el("p", "rp-not", "Gün gün ayrıntı: Alışma raporundaki “Tek günde yüzlerce ölüm” tablosu."));
  }
  function ornekler(v) {
    var s = $("lider-sec"), k = $("g-ornekler");
    v.liderler.forEach(function (x) { var o = el("option", null, x.ad + " (" + x.toplam + ")"); o.value = x.anahtar; s.appendChild(o); });
    function goster() {
      k.textContent = ""; var x = L[s.value]; if (!x) return;
      Object.keys(x.ornek).sort().reverse().forEach(function (m) {
        var d = el("div", "rp-zirve-kart"); var b = el("div", "rp-zirve-bas"); b.append(el("b", null, ayAd(m)), el("span", null, (x.aylik[v.aylar.indexOf(m)] || 0) + " başlık")); d.appendChild(b);
        x.ornek[m].forEach(function (o) { var a = el("a", "rp-ornek"); a.href = o.url; a.target = "_blank"; a.rel = "noopener"; var bb = el("span", "rp-ornek-b", o.baslik); if (/[؀-ۿ]/.test(o.baslik)) { bb.dir = "rtl"; bb.lang = "ar"; } a.append(bb, el("small", null, o.yayin + " · " + gunAd(o.gun))); d.appendChild(a); });
        k.appendChild(d);
      });
    }
    k.className = "rp-zirve"; s.addEventListener("change", goster); goster();
  }
  function yontem() {
    var u = $("g-yontem");
    [
      "Kaynak: geriye dönük taramanın topladığı haber başlıkları; yalnızca Filistin, İsrail ya da Gazze geçenler. Bir liderin adı başlıkta geçiyorsa sayıldı (adlar Türkçe, İngilizce, Arapça ve diğer dillerdeki yazılışlarıyla).",
      "Bu bir konuşma sayımı değil, basının liderleri Filistin bağlamında ne zaman haber yaptığının sayımı. Bir başlıkta “soykırım” ve liderin adı birlikte geçiyorsa, kelime liderin ağzından çıkmış olmayabilir (ör. liderin eleştirildiği bir haber).",
      "Resmî konuşma metinleri (Cumhurbaşkanlığı, BM, Beyaz Saray, Kremlin, Çin Dışişleri) ayrı bir katman olarak eklenecek; o zaman kelime sayımı doğrudan konuşmalardan yapılacak.",
      "Tetikleyici ve kitlesel ölüm günü ölçüleri: lider grubunun adının geçtiği günlük başlıkların, önceki dört haftanın günlük ortalamasına oranı. Ortalaması günde yarım başlığın altındaki gruplar için hesaplanmadı.",
      "İsrailli liderler (Netanyahu, Gallant, Katz, Ben-Gvir, Smotrich) karşılaştırma için sayıldı; grafiklerde gösterilmiyor."
    ].forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
