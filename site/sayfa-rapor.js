// 7 Ekim raporu: data/bulten/rapor-7-ekim.json'dan sayıları metne yerleştirir, grafikleri çizer.
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var R = { bolge: "#1f7a52", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = { bolge: "Bölge basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var GR = ["bolge", "israil", "bati_ana", "bati_muhalif"];
  var AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var AYTAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null ? "–" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: 0 }); }
  function ayAd(m) { return AYTAM[+m.slice(5) - 1] + " " + m.slice(0, 4); }

  fetch("data/bulten/rapor-7-ekim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", "Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.")); });

  function ciz(v) {
    var G = {}; v.gruplar.forEach(function (g) { G[g.anahtar] = g; });
    var b = function (g, t) { return G[g].binde[t]; };
    var kat = function (a, c) { return a && c ? sayi(a / c, a / c >= 10 ? 0 : 1) : "–"; };
    var C = v.ceyrek, ilk = C[0], son = C[C.length - 1];
    var M = {}; v.aylik.forEach(function (s) { M[s.ay] = s; });
    var deger = {
      donem: ayAd(v.bas) + " – " + ayAd(v.son), baslik: sayi(v.baslik, 0),
      guncel: "Güncellendi: " + new Date(v.guncellendi).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
      taslak: v.tarama_bitti ? "" : "Tarama sürüyor; sayılar kesinleşmedi",
      "k.isgal": kat(b("bolge", "isgal"), b("bati_ana", "isgal")), "k.sehit": kat(b("bolge", "sehit"), b("bati_ana", "sehit")),
      "k.catisma": kat(b("bati_ana", "catisma"), b("bolge", "catisma")), "k.teror": kat(b("israil", "teror"), b("bolge", "teror")),
      "c.ilk.bati_ana": "%" + sayi(ilk.bati_ana), "c.ilk.bolge": "%" + sayi(ilk.bolge), "c.ilk.israil": "%" + sayi(ilk.israil),
      "c.son.bati_ana": "%" + sayi(son.bati_ana), "c.son.bolge": "%" + sayi(son.bolge), "c.son.israil": "%" + sayi(son.israil),
      "m.2026-03.bati_ana.iran": M["2026-03"] ? "%" + sayi(M["2026-03"].bati_ana.iran_pay) : "–",
      "m.2026-03.bati_ana.gazze": M["2026-03"] ? "%" + sayi(M["2026-03"].bati_ana.gazze_pay) : "–",
      "min.bolge.isgal": sayi(Math.floor(Math.min.apply(0, v.aylik.map(function (s) { return s.bolge.binde.isgal || 0; }))), 0)
    };
    GR.forEach(function (g) { v.terimler.forEach(function (t) { deger["g." + g + "." + t.anahtar] = sayi(b(g, t.anahtar)); }); });
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });

    terimGrafik(v, G);
    zirve(v);
    gazzeGrafik(v);
    ceyrekTablo(v);
    seyir(v);
    dagilim(v);
    yayinTablo(v);
    yontem(v, G);
  }

  function efsane(gruplar, kap) {
    var e = el("div", "rp-efsane");
    gruplar.forEach(function (g) { var s = el("span"); var i = el("i"); i.style.background = R[g]; s.append(i, AD[g]); e.appendChild(s); });
    kap.appendChild(e);
  }

  // 1) kelimeler: her terim bir satır, dört grup çubuğu; satır kendi en büyüğüne göre ölçeklenir
  function terimGrafik(v, G) {
    var k = $("g-terimler"); efsane(GR, k);
    var t = el("div", "rp-terim");
    v.terimler.forEach(function (tr) {
      var en = Math.max.apply(0, GR.map(function (g) { return G[g].binde[tr.anahtar] || 0; })) || 1;
      var s = el("div", "rp-terim-satir");
      var a = el("div", "rp-terim-ad", "“" + tr.ad + "”"); a.classList.add(tr.yan === "filistin" ? "yesil" : "mavi"); s.appendChild(a);
      var cs = el("div", "rp-terim-cubuklar");
      GR.forEach(function (g) {
        var d = G[g].binde[tr.anahtar] || 0, c = el("div", "rp-cubuk");
        var i = el("i"); i.style.width = Math.max(0.5, 100 * d / en) + "%"; i.style.background = R[g]; c.appendChild(i);
        c.appendChild(el("span", null, sayi(d))); c.title = AD[g] + ": binde " + sayi(d); cs.appendChild(c);
      });
      s.appendChild(cs); t.appendChild(s);
    });
    k.appendChild(t);
  }

  // 2) soykırım zirveleri
  function zirve(v) {
    var k = $("g-zirve");
    v.soykirim_zirve.forEach(function (z) {
      if (!z.ornek.length) return;
      var c = el("div", "rp-zirve-kart");
      var h = el("div", "rp-zirve-bas"); h.appendChild(el("b", null, ayAd(z.ay))); h.appendChild(el("span", null, "Batı ana akım basınında binde " + sayi(z.binde))); c.appendChild(h);
      z.ornek.forEach(function (o) {
        var a = el("a", "rp-ornek"); a.href = o.url; a.target = "_blank"; a.rel = "noopener";
        var bb = el("span", "rp-ornek-b", o.baslik); bb.dir = "auto"; a.appendChild(bb); a.appendChild(el("small", null, o.yayin + " · " + o.gun + " ↗")); c.appendChild(a);
      });
      k.appendChild(c);
    });
  }

  // çizgi grafik yardımcısı
  function cizgi(seriler, opt) {
    var W = opt.W || 720, H = opt.H || 260, P = { l: 40, r: 12, t: 12, b: 28 };
    var n = opt.aylar.length, en = opt.en || Math.max.apply(0, seriler.map(function (s) { return Math.max.apply(0, s.d.map(function (x) { return x || 0; })); })) || 1;
    var x = function (i) { return P.l + (W - P.l - P.r) * i / Math.max(1, n - 1); }, y = function (d) { return P.t + (H - P.t - P.b) * (1 - d / en); };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": opt.ad || "" });
    [0, 0.5, 1].forEach(function (f) {
      s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(en * f), y2: y(en * f), "class": "rp-izgara" }));
      var t = sv("text", { x: P.l - 6, y: y(en * f) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = (opt.yuzde ? "%" : "") + sayi(en * f, 0); s.appendChild(t);
    });
    // x ekseni: yalnızca yıl başları (ilk yıl başı başlangıca çok yakınsa başlangıç yazılmaz)
    opt.aylar.forEach(function (m, i) {
      if (m.slice(5) !== "01") return;
      var t = sv("text", { x: x(i), y: H - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = m.slice(0, 4); s.appendChild(t);
      s.appendChild(sv("line", { x1: x(i), x2: x(i), y1: P.t, y2: H - P.b, "class": "rp-izgara" }));
    });
    seriler.forEach(function (sr) {
      var d = "";
      sr.d.forEach(function (v, i) { if (v == null) { d += " "; return; } d += (d && d.slice(-1) !== " " ? "L" : "M") + x(i).toFixed(1) + "," + y(Math.min(v, en)).toFixed(1); });
      s.appendChild(sv("path", { d: d.replace(/ /g, ""), fill: "none", stroke: R[sr.g], "stroke-width": sr.ince ? 1.6 : 2.4, "stroke-dasharray": sr.kesik ? "4 4" : "none", "stroke-linejoin": "round" }));
      sr.d.forEach(function (v, i) {
        if (v == null) return; var c = sv("circle", { cx: x(i), cy: y(Math.min(v, en)), r: 6, fill: "transparent" });
        var tt = sv("title"); tt.textContent = AD[sr.g] + " · " + ayAd(opt.aylar[i]) + ": " + (opt.yuzde ? "%" : "binde ") + sayi(v); c.appendChild(tt); s.appendChild(c);
      });
    });
    return s;
  }

  // 3) Gazze payı
  function gazzeGrafik(v) {
    var k = $("g-gazze"); efsane(GR, k);
    var aylar = v.aylik.map(function (s) { return s.ay; });
    k.appendChild(cizgi(GR.map(function (g) {
      return { g: g, kesik: g === "israil", d: v.aylik.map(function (s) { return s[g].n >= 150 ? s[g].gazze_pay : null; }) };
    }), { aylar: aylar, yuzde: true, ad: "Gazze payı" }));
  }
  function ceyrekTablo(v) {
    var k = $("g-ceyrek"); var t = el("table");
    var h = el("tr"); ["Çeyrek"].concat(GR.map(function (g) { return AD[g]; })).forEach(function (x) { h.appendChild(el("th", null, x)); });
    var th = el("thead"); th.appendChild(h); t.appendChild(th); var bd = el("tbody");
    v.ceyrek.forEach(function (c) {
      var r = el("tr"); r.appendChild(el("td", null, c.ceyrek.replace("-", " · ")));
      GR.forEach(function (g) { var td = el("td", "sayi", c[g] == null ? "–" : "%" + sayi(c[g])); r.appendChild(td); }); bd.appendChild(r);
    });
    t.appendChild(bd); var d = el("details"); d.appendChild(el("summary", null, "Çeyrek çeyrek Gazze payı")); var kt = el("div", "tablo-kutu"); kt.appendChild(t); d.appendChild(kt); k.appendChild(d);
  }

  // 4) küçük grafikler: beş kelimenin ay ay seyri
  function seyir(v) {
    var k = $("g-seyir"); efsane(["bolge", "bati_ana", "bati_muhalif"], k);
    var aylar = v.aylik.map(function (s) { return s.ay; });
    [["isgal", "işgal"], ["sehit", "şehit"], ["catisma", "çatışma"], ["teror", "terör"], ["soykirim", "soykırım"], ["operasyon", "operasyon"]].forEach(function (p) {
      var f = el("figure", "rp-kucuk"); f.appendChild(el("figcaption", null, "“" + p[1] + "” · binde"));
      f.appendChild(cizgi(["bolge", "bati_ana", "bati_muhalif"].map(function (g) {
        return { g: g, ince: true, d: v.aylik.map(function (s) { return s[g].baglamli >= 100 ? s[g].binde[p[0]] : null; }) };
      }), { aylar: aylar, W: 360, H: 180, ad: p[1] }));
      k.appendChild(f);
    });
  }

  // 5) yayın dağılımı: x = işgal, y = çatışma (karekök ölçek)
  function dagilim(v) {
    var k = $("g-dagilim"); efsane(GR, k);
    var Y = v.yayinlar, W = 720, H = 420, P = { l: 44, r: 16, t: 14, b: 40 };
    var ex = Math.sqrt(Math.max.apply(0, Y.map(function (y) { return y.binde.isgal || 0; })) || 1);
    var ey = Math.sqrt(Math.max.apply(0, Y.map(function (y) { return y.binde.catisma || 0; })) || 1);
    var x = function (d) { return P.l + (W - P.l - P.r) * Math.sqrt(d || 0) / ex; }, y = function (d) { return H - P.b - (H - P.t - P.b) * Math.sqrt(d || 0) / ey; };
    var en = Math.max.apply(0, Y.map(function (y) { return y.baglamli; }));
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": "Yayınların işgal ve çatışma kelimelerini kullanma sıklığı" });
    [0, 10, 50, 100, 200].forEach(function (d) { if (Math.sqrt(d) > ex) return; s.appendChild(sv("line", { x1: x(d), x2: x(d), y1: P.t, y2: H - P.b, "class": "rp-izgara" })); var t = sv("text", { x: x(d), y: H - P.b + 16, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = d; s.appendChild(t); });
    [0, 5, 20, 50, 100].forEach(function (d) { if (Math.sqrt(d) > ey) return; s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(d), y2: y(d), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 6, y: y(d) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = d; s.appendChild(t); });
    var tx = sv("text", { x: W - P.r, y: H - 6, "text-anchor": "end", "class": "rp-eksen rp-eksen-ad" }); tx.textContent = "“işgal” · binde →"; s.appendChild(tx);
    var ty = sv("text", { x: P.l, y: P.t + 10, "class": "rp-eksen rp-eksen-ad" }); ty.textContent = "↑ “çatışma” · binde"; s.appendChild(ty);
    Y.slice().sort(function (a, b) { return b.baglamli - a.baglamli; }).forEach(function (o) {
      var c = sv("circle", { cx: x(o.binde.isgal), cy: y(o.binde.catisma), r: 3 + 11 * Math.sqrt(o.baglamli / en), fill: R[o.grup], "fill-opacity": 0.55, stroke: R[o.grup], "stroke-width": 1 });
      var t = sv("title"); t.textContent = o.ad + " (" + AD[o.grup] + ") · işgal binde " + sayi(o.binde.isgal) + ", çatışma binde " + sayi(o.binde.catisma) + " · " + sayi(o.baglamli, 0) + " başlık"; c.appendChild(t); s.appendChild(c);
    });
    // en uçtaki birkaç yayının adı
    var uc = Y.filter(function (o) { return o.baglamli > 1500; }).sort(function (a, b) { return (b.binde.catisma - b.binde.isgal / 6) - (a.binde.catisma - a.binde.isgal / 6); });
    uc.slice(0, 3).concat(uc.slice(-3)).forEach(function (o) {
      var px = x(o.binde.isgal), sag = px > W * 0.7;
      var t = sv("text", { x: px + (sag ? -10 : 10), y: y(o.binde.catisma) - 8, "text-anchor": sag ? "end" : "start", "class": "rp-nokta-ad" }); t.textContent = o.ad; s.appendChild(t);
    });
    k.appendChild(s);
  }

  // 6) yayın tablosu
  function yayinTablo(v) {
    var k = $("g-yayinlar");
    var S = [["ad", "Yayın"], ["grup", "Grup"], ["baglamli", "Başlık"], ["isgal", "işgal"], ["sehit", "şehit"], ["soykirim", "soykırım"], ["catisma", "çatışma"], ["teror", "terör"], ["operasyon", "operasyon"], ["gazze", "Gazze %"]];
    var sr = { k: "baglamli", y: -1 };
    var d = el("details"); d.appendChild(el("summary", null, "Bütün yayınların tablosu (" + v.yayinlar.length + ")"));
    var kt = el("div", "tablo-kutu"); var t = el("table", "rp-yt"); kt.appendChild(t); d.appendChild(kt); k.appendChild(d);
    var val = function (o, a) { return a === "ad" ? o.ad : a === "grup" ? AD[o.grup] : a === "baglamli" ? o.baglamli : a === "gazze" ? o.gazze_pay : o.binde[a]; };
    function ciz() {
      t.innerHTML = ""; var h = el("tr");
      S.forEach(function (c) { var th = el("th", null, c[1] + (sr.k === c[0] ? (sr.y > 0 ? " ▲" : " ▼") : "")); th.onclick = function () { sr = { k: c[0], y: sr.k === c[0] ? -sr.y : -1 }; ciz(); }; h.appendChild(th); });
      var th = el("thead"); th.appendChild(h); t.appendChild(th); var bd = el("tbody");
      v.yayinlar.slice().sort(function (a, b) { var x = val(a, sr.k), y = val(b, sr.k); return (typeof x === "string" ? x.localeCompare(y, "tr") : (x || 0) - (y || 0)) * sr.y; }).forEach(function (o) {
        var r = el("tr");
        S.forEach(function (c) { var x = val(o, c[0]); var td = el("td", typeof x === "number" ? "sayi" : null, typeof x === "number" ? sayi(x, c[0] === "baglamli" ? 0 : 1) : x); if (c[0] === "grup") { td.style.color = R[o.grup]; td.style.fontWeight = 700; } r.appendChild(td); });
        bd.appendChild(r);
      });
      t.appendChild(bd);
    }
    ciz();
  }

  // 7) yöntem
  function yontem(v, G) {
    var u = $("g-yontem");
    var ad = function (g) { return v.yayinlar.filter(function (o) { return o.grup === g; }).slice(0, 8).map(function (o) { return o.ad; }).join(", "); };
    [
      "Veri: toplayıcı çalışmaya başlamadan önceki dönem için yayınların kendi site haritalarından, WordPress arşivlerinden, Telegram kanallarından ve İnternet Arşivi’nden (Wayback Machine) geriye dönük toplanan " + sayi(v.baslik, 0) + " başlık. Yapay zekâ kullanılmadı; sayılar başlıklardaki kelimelerin doğrudan sayımıdır.",
      "Kelimeler 9 dilde aranır (Türkçe, Arapça, İbranice, İngilizce, Fransızca, İspanyolca, İtalyanca, Almanca, Katalanca kalıplarıyla). Sıklıklar yalnızca Filistin, İsrail ya da Gazze geçen başlıklarda, bin başlık başına verilir.",
      "Başlık sayımı bir kelimenin yayının kendi sesiyle mi, bir alıntı ya da suçlamanın aktarımı olarak mı geçtiğini ayırmaz. “Soykırım” bölümündeki örnekler bu farkı göstermek için seçildi.",
      "Gruplar: Bölge basını (" + G.bolge.olculen_yayin + " yayın; ör. " + ad("bolge") + "); İsrail basını (" + G.israil.olculen_yayin + " yayın; ör. " + ad("israil") + "); Batı ana akım basını (" + G.bati_ana.olculen_yayin + " yayın; ör. " + ad("bati_ana") + "); Batı’da muhalif basın (" + G.bati_muhalif.olculen_yayin + " yayın; ör. " + ad("bati_muhalif") + "). Gruplar yayınların Kaynaklar sayfasındaki bölgesine ve çizgisine göre.",
      "İnternet Arşivi’ndeki tarih, sayfanın arşive alındığı andır; yayın tarihi değildir. Bu yüzden arşiv kayıtlarından yalnızca adresinde tarih yazanlar sayıldı; " + sayi(v.tarihsiz, 0) + " kayıt tarihlenemediği için dışarıda kaldı. İsrail basınının büyük bölümü ölçülemedi: The Jerusalem Post ve Ynet’in arşiv kayıtları tarihlenemedi, The Times of Israel ile i24NEWS’in site haritalarına ulaşılamadı. Bu grup büyük ölçüde Israel Hayom’u yansıtıyor.",
      "Site haritalarında binlerce eski yazının aynı güne “güncellendi” diye işaretlendiği günler (ör. bir sitenin arşivini yenilemesi) ayıklandı.",
      "Bölge basını için yalnızca bölgeyle ilgili başlıklar toplandı (Filistin yayınlarında hepsi). “Gazze payı” bu bölge başlıkları içindeki paydır.",
      v.tarama_bitti ? "Tarama tamamlandı." : "Tarama sürüyor; sayılar her gün güncelleniyor ve küçük ölçüde değişebilir."
    ].forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
