// 7 Ekim raporu: data/bulten/rapor-7-ekim.json'dan sayıları metne yerleştirir, grafikleri çizer.
// Bölümler çerçeveyi izler: dikkat, adlandırma, faillik, "soykırım", gazeteciler, yayın yayın.
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var R = { bolge: "#1f7a52", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = { bolge: "Bölge basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var GR = ["bolge", "israil", "bati_ana", "bati_muhalif"];
  var AYTAM = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString("tr-TR", { maximumFractionDigits: d == null ? 1 : d }); }
  function yuzde(n) { return n == null ? "–" : "%" + sayi(n, 0); }
  function ayAd(m) { return AYTAM[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ekle(d, gun) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + gun); return x.toISOString().slice(0, 10); }

  fetch("data/bulten/rapor-7-ekim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", "Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.")); });

  // bir olayın önce / sırasında ortalama Gazze payı ve haftalık ölüm
  function olayEtki(v, o) {
    var bit = o.bit || o.bas, H = v.haftalik;
    var ort = function (b, e, g) { var x = H.filter(function (h) { return h.hafta >= b && h.hafta <= e && h[g].gazze_pay != null; }); return x.length ? x.reduce(function (t, h) { return t + h[g].gazze_pay; }, 0) / x.length : null; };
    var olu = function (b, e) { var x = H.filter(function (h) { return h.hafta >= b && h.hafta <= e; }); return x.length ? x.reduce(function (t, h) { return t + (h.olu || 0); }, 0) / x.length : null; };
    var ob = ekle(o.bas, -35), oe = ekle(o.bas, -7), sb = ekle(o.bas, -6), se = bit;
    return { bati_once: ort(ob, oe, "bati_ana"), bati_sirasinda: ort(sb, se, "bati_ana"), bolge_once: ort(ob, oe, "bolge"), bolge_sirasinda: ort(sb, se, "bolge"),
      olu_once: olu(ob, oe), olu_sirasinda: olu(sb, se) };
  }

  function ciz(v) {
    if (!v.haftalik || !v.olaylar) {   // eski biçimdeki veri: yeni ölçümler toplayıcının sonraki çalışmasında gelir
      var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", "Rapor yeni ölçümlerle yeniden hesaplanıyor; birkaç saat içinde burada olacak."));
      return;
    }
    var G = {}; v.gruplar.forEach(function (g) { G[g.anahtar] = g; });
    var b = function (g, t) { return G[g].binde[t]; };
    var iran = v.olaylar.filter(function (o) { return /İran savaşı/.test(o.ad); })[0], lub = v.olaylar.filter(function (o) { return /Lübnan/.test(o.ad); })[0];
    var ei = iran ? olayEtki(v, iran) : {}, el2 = lub ? olayEtki(v, lub) : {};
    var gzt = v.dis.gazeteci || 0;
    var deger = {
      donem: ayAd(v.bas) + " – " + ayAd(v.son), baslik: sayi(v.baslik, 0),
      guncel: "Güncellendi: " + new Date(v.guncellendi).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }),
      taslak: v.tarama_bitti ? "" : "Tarama sürüyor; sayılar kesinleşmedi",
      "k.fail_f": yuzde(G.bati_ana.fail_yazilan.filistinli), "k.fail_i": yuzde(G.bati_ana.fail_yazilan.israilli),
      "k.rehine": sayi(b("bati_ana", "rehine") / b("bati_ana", "esir"), 1) + "×",
      "k.iran": yuzde(ei.bati_sirasinda), "k.iran_once": yuzde(ei.bati_once),
      "k.gzt": sayi(gzt, 0), "k.gzt_bati": gzt ? sayi(G.bati_ana.gazeteci_haber / gzt, 1) : "–", "k.gzt_bolge": gzt ? sayi(G.bolge.gazeteci_haber / gzt, 1) : "–",
      "e.iran.olu_once": sayi(ei.olu_once, 0), "e.iran.olu_sirasinda": sayi(ei.olu_sirasinda, 0),
      "e.iran.bati_once": yuzde(ei.bati_once), "e.iran.bati_sirasinda": yuzde(ei.bati_sirasinda),
      "e.lubnan.bati_once": yuzde(el2.bati_once), "e.lubnan.bati_sirasinda": yuzde(el2.bati_sirasinda),
      terim_sayisi: v.terimler.length
    };
    GR.forEach(function (g) {
      v.terimler.forEach(function (t) { deger["g." + g + "." + t.anahtar] = sayi(b(g, t.anahtar)); });
      ["aktif", "failli", "failsiz", "oldu", "sehadet"].forEach(function (f) { deger["g." + g + ".fp." + f] = yuzde(G[g].faillik_pay[f]); });
    });
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });
    [dikkat, olayTablo, takvim, ciftler, terimGrafik, faillik, kiminOlumu, zirve, gazeteci, dagilim, yayinTablo, yontem].forEach(function (f) {
      try { f(v, G); } catch (e) { if (window.console) console.error("rapor", e); }
    });
  }

  function efsane(gruplar, kap, ek) {
    var e = el("div", "rp-efsane");
    gruplar.forEach(function (g) { var s = el("span"); var i = el("i"); i.style.background = R[g]; s.append(i, AD[g]); e.appendChild(s); });
    (ek || []).forEach(function (x) { var s = el("span"); var i = el("i"); i.style.background = x[0]; s.append(i, x[1]); e.appendChild(s); });
    kap.appendChild(e);
  }

  // ---- 1) dikkat: haftalık Gazze payı + ölüm çubukları + olay şeritleri
  function dikkat(v) {
    var k = $("g-dikkat"); efsane(["bolge", "bati_ana", "bati_muhalif"], k, [["#d5d8d5", "haftalık ölüm (sağ eksen)"]]);
    var H = v.haftalik, W = 760, Hh = 300, P = { l: 40, r: 46, t: 28, b: 26 }, n = H.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * i / (n - 1); };
    var enP = 60, enO = Math.max.apply(0, H.map(function (h) { return h.olu || 0; })) || 1;
    var y = function (p) { return P.t + (Hh - P.t - P.b) * (1 - Math.min(p, enP) / enP); };
    var yo = function (o) { return Hh - P.b - (Hh - P.t - P.b) * o / enO; };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + Hh, "class": "rp-svg", role: "img", "aria-label": "Hafta hafta Gazze payı ve ölümler" });
    var idx = function (g) { for (var i = 0; i < n; i++) if (H[i].hafta >= g) return i; return n - 1; };
    var bw = (W - P.l - P.r) / n;
    H.forEach(function (h, i) { if (!h.olu) return; s.appendChild(baslik(sv("rect", { x: x(i) - bw * 0.4, y: yo(h.olu), width: bw * 0.8, height: Hh - P.b - yo(h.olu), "class": "rp-olu" }), gunAd(h.hafta) + " haftası: " + sayi(h.olu, 0) + " ölüm")); });
    v.olaylar.forEach(function (o, j) {
      var a = idx(ekle(o.bas, -6)), c = idx(o.bit || o.bas);
      s.appendChild(baslik(sv("rect", { x: x(a) - bw / 2, y: P.t, width: Math.max(bw, x(c) - x(a) + bw), height: Hh - P.t - P.b, "class": "rp-olay rp-olay-" + o.tur }),
        (j + 1) + " · " + o.ad + " · " + gunAd(o.bas) + (o.bit ? " – " + gunAd(o.bit) : "")));
      var t = sv("text", { x: x(a), y: 11 + (j % 2) * 11, "text-anchor": "middle", "class": "rp-olay-no" }); t.textContent = j + 1; s.appendChild(t);
    });
    [0, 20, 40, 60].forEach(function (p) { s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(p), y2: y(p), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 6, y: y(p) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = "%" + p; s.appendChild(t); });
    [0.5, 1].forEach(function (f) { var t = sv("text", { x: W - P.r + 6, y: yo(enO * f) + 4, "class": "rp-eksen" }); t.textContent = sayi(enO * f, 0); s.appendChild(t); });
    H.forEach(function (h, i) { if (h.hafta.slice(5, 7) === "01" && +h.hafta.slice(8) <= 7) { var t = sv("text", { x: x(i), y: Hh - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = h.hafta.slice(0, 4); s.appendChild(t); } });
    ["bati_muhalif", "bolge", "bati_ana"].forEach(function (g) {
      var d = "", yeni = true;
      H.forEach(function (h, i) { var p = h[g].gazze_pay; if (p == null) { yeni = true; return; } d += (yeni ? "M" : "L") + x(i).toFixed(1) + "," + y(p).toFixed(1); yeni = false; });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: R[g], "stroke-width": g === "bati_muhalif" ? 1.2 : 2.2, "stroke-opacity": g === "bati_muhalif" ? 0.55 : 1, "stroke-linejoin": "round" }));
    });
    k.appendChild(s);
  }
  function olayTablo(v) {
    var k = $("g-olaylar"); var t = el("table");
    t.innerHTML = "<thead><tr><th>#</th><th>Olay</th><th>Tarih</th><th>Batı ana akım · Gazze payı</th><th>Bölge basını · Gazze payı</th><th>Ölüm / hafta</th></tr></thead>";
    var bd = el("tbody");
    v.olaylar.forEach(function (o, j) {
      var e = olayEtki(v, o), r = el("tr");
      var fark = function (a, c) { var td = el("td", "sayi", yuzde(a) + " → " + yuzde(c)); if (a != null && c != null && c < a * 0.75) td.classList.add("dusus"); return td; };
      r.append(el("td", "sayi", j + 1), el("td", null, o.ad), el("td", null, gunAd(o.bas) + (o.bit ? " – " + gunAd(o.bit) : "")),
        fark(e.bati_once, e.bati_sirasinda), fark(e.bolge_once, e.bolge_sirasinda), el("td", "sayi", sayi(e.olu_once, 0) + " → " + sayi(e.olu_sirasinda, 0)));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); k.appendChild(kt);
    k.appendChild(el("p", "rp-not", "Önce: olaydan önceki dört hafta; sırasında: olay boyunca. Kırmızı: Gazze payı dörtte birden fazla düştü."));
  }
  // takvim: yıl yıl haftalık kareler
  function takvim(v) {
    var k = $("g-takvim"), H = v.haftalik;
    var renk = function (p, g) { if (p == null) return "#ebe9e3"; var a = Math.min(1, p / 50); return (g === "bolge" ? "rgba(31,122,82," : "rgba(138,109,59,") + (0.08 + 0.92 * a).toFixed(2) + ")"; };
    var yillar = {}; H.forEach(function (h) { var yl = h.hafta.slice(0, 4); (yillar[yl] = yillar[yl] || []).push(h); });
    Object.keys(yillar).sort().forEach(function (yil) {
      var blok = el("div", "rp-takvim-yil"); blok.appendChild(el("b", null, yil));
      ["bati_ana", "bolge"].forEach(function (g) {
        var sat = el("div", "rp-takvim-satir"); sat.appendChild(el("span", "rp-takvim-ad", AD[g]));
        var kareler = el("div", "rp-kareler");
        var bos = Math.floor((new Date(yillar[yil][0].hafta + "T12:00:00Z") - new Date(yil + "-01-01T12:00:00Z")) / (7 * 864e5));
        for (var i = 0; i < bos; i++) kareler.appendChild(el("i", "rp-bos"));
        yillar[yil].forEach(function (h) { var c = el("i"); c.style.background = renk(h[g].gazze_pay, g); c.title = gunAd(h.hafta) + " haftası · " + AD[g] + ": Gazze payı " + yuzde(h[g].gazze_pay) + " · " + sayi(h.olu, 0) + " ölüm"; kareler.appendChild(c); });
        sat.appendChild(kareler); blok.appendChild(sat);
      });
      k.appendChild(blok);
    });
    var ay = el("div", "rp-takvim-olcek"); ay.append(el("span", null, "az"), el("i"), el("span", null, "Gazze payı %50 ve üstü")); k.appendChild(ay);
  }

  // ---- 2) adlandırma: karşıt çiftler
  function ciftler(v, G) {
    var k = $("g-ciftler");
    var ad = {}; v.terimler.forEach(function (t) { ad[t.anahtar] = t.ad.replace(/[“”]/g, ""); });
    v.ciftler.forEach(function (c) {
      var en = Math.max.apply(0, GR.map(function (g) { return Math.max(G[g].binde[c.a] || 0, G[g].binde[c.b] || 0); })) || 1;
      var blok = el("div", "rp-cift"); blok.appendChild(el("div", "rp-cift-bas", c.ad));
      var bas = el("div", "rp-cift-satir rp-cift-etiket"); bas.append(el("span", "sol", "“" + ad[c.a] + "”"), el("span"), el("span", "sag", "“" + ad[c.b] + "”")); blok.appendChild(bas);
      GR.forEach(function (g) {
        var a = G[g].binde[c.a] || 0, z = G[g].binde[c.b] || 0, s = el("div", "rp-cift-satir");
        var sol = el("div", "sol"); var i1 = el("i"); i1.style.width = (100 * a / en) + "%"; i1.style.background = R[g]; sol.append(el("em", null, sayi(a)), i1);
        var sag = el("div", "sag"); var i2 = el("i"); i2.style.width = (100 * z / en) + "%"; i2.style.background = R[g]; i2.style.opacity = 0.55; sag.append(i2, el("em", null, sayi(z)));
        s.append(sol, el("span", "rp-cift-grup", AD[g]), sag); s.title = AD[g] + ": “" + ad[c.a] + "” binde " + sayi(a) + ", “" + ad[c.b] + "” binde " + sayi(z);
        blok.appendChild(s);
      });
      k.appendChild(blok);
    });
  }
  function terimGrafik(v, G) {
    var k = $("g-terimler"); efsane(GR, k);
    var t = el("div", "rp-terim");
    v.terimler.forEach(function (tr) {
      var en = Math.max.apply(0, GR.map(function (g) { return G[g].binde[tr.anahtar] || 0; })) || 1;
      var s = el("div", "rp-terim-satir");
      var a = el("div", "rp-terim-ad", "“" + tr.ad.replace(/[“”]/g, "") + "”"); a.classList.add(tr.yan === "filistin" ? "yesil" : "mavi"); s.appendChild(a);
      var cs = el("div", "rp-terim-cubuklar");
      GR.forEach(function (g) { var d = G[g].binde[tr.anahtar] || 0, c = el("div", "rp-cubuk"); var i = el("i"); i.style.width = Math.max(0.5, 100 * d / en) + "%"; i.style.background = R[g]; c.appendChild(i); c.appendChild(el("span", null, sayi(d))); c.title = AD[g] + ": binde " + sayi(d); cs.appendChild(c); });
      s.appendChild(cs); t.appendChild(s);
    });
    k.appendChild(t);
  }

  // ---- 3) faillik
  var FK = [["aktif", "İsrail öldürdü", "#262a28"], ["failli", "İsrail’in saldırısında öldürüldü", "#7d8380"], ["failsiz", "öldürüldü (fail yok)", "#d9a21b"], ["oldu", "öldü / ölü sayısı", "#e0702b"], ["sehadet", "şehit oldu", "#1f7a52"]];
  function faillik(v, G) {
    var k = $("g-faillik"); efsane([], k, FK.map(function (f) { return [f[2], f[1]]; }));
    GR.forEach(function (g) {
      var p = G[g].faillik_pay, s = el("div", "rp-yigin-satir");
      s.appendChild(el("span", "rp-yigin-ad", AD[g] + " · " + sayi(G[g].olum_haberi, 0) + " başlık" + (G[g].olum_haberi < 300 ? " (küçük örneklem)" : "")));
      var c = el("div", "rp-yigin");
      FK.forEach(function (f) { var d = p[f[0]] || 0; if (!d) return; var i = el("i"); i.style.width = d + "%"; i.style.background = f[2]; i.title = f[1] + ": %" + sayi(d); if (d >= 8) i.textContent = "%" + sayi(d, 0); c.appendChild(i); });
      s.appendChild(c); k.appendChild(s);
    });
  }
  function kiminOlumu(v, G) {
    var k = $("g-kimin"); efsane([], k, [["#262a28", "Filistinlilerin ölümü: fail yazılmış"], ["#c9544e", "İsraillilerin ölümü: fail yazılmış"]]);
    ["bolge", "bati_ana", "israil"].forEach(function (g) {
      var f = G[g].fail_yazilan; if (f.israilli == null || f.israilli_n < 60) return;   // küçük örneklemi gösterme
      var s = el("div", "rp-kimin"); s.appendChild(el("span", "rp-yigin-ad", AD[g]));
      [[f.filistinli, "#262a28"], [f.israilli, "#c9544e"]].forEach(function (x) { var c = el("div", "rp-kimin-cubuk"); var i = el("i"); i.style.width = x[0] + "%"; i.style.background = x[1]; c.append(i, el("em", null, yuzde(x[0]))); s.appendChild(c); });
      k.appendChild(s);
    });
  }

  // ---- 4) soykırım zirveleri
  function zirve(v) {
    var k = $("g-zirve");
    v.soykirim_zirve.forEach(function (z) {
      if (!z.ornek.length) return;
      var c = el("div", "rp-zirve-kart"); var h = el("div", "rp-zirve-bas"); h.appendChild(el("b", null, ayAd(z.ay))); h.appendChild(el("span", null, "Batı ana akım basınında binde " + sayi(z.binde))); c.appendChild(h);
      z.ornek.forEach(function (o) { var a = el("a", "rp-ornek"); a.href = o.url; a.target = "_blank"; a.rel = "noopener"; var bb = el("span", "rp-ornek-b", o.baslik); bb.dir = "auto"; a.appendChild(bb); a.appendChild(el("small", null, o.yayin + " · " + o.gun + " ↗")); c.appendChild(a); });
      k.appendChild(c);
    });
  }

  // ---- 5) gazeteciler
  function gazeteci(v) {
    var k = $("g-gazeteci"); efsane(["bolge", "bati_ana"], k, [["#d5d8d5", "öldürülen gazeteci (sol eksen)"]]);
    var A = v.aylik, W = 760, H = 260, P = { l: 40, r: 50, t: 18, b: 26 }, n = A.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * (i + 0.5) / n; };
    var enO = Math.max.apply(0, A.map(function (s) { return s.gazeteci_olu || 0; })) || 1;
    var enB = Math.max.apply(0, A.map(function (s) { return s.bolge.gazeteci_haber; })) || 1;
    var yo = function (d) { return H - P.b - (H - P.t - P.b) * d / enO; };
    var yb = function (d) { return H - P.b - (H - P.t - P.b) * Math.min(d, enB) / enB; };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": "Öldürülen gazeteciler ve haberleri" });
    var bw = (W - P.l - P.r) / n * 0.7;
    A.forEach(function (a, i) { if (a.gazeteci_olu) s.appendChild(baslik(sv("rect", { x: x(i) - bw / 2, y: yo(a.gazeteci_olu), width: bw, height: H - P.b - yo(a.gazeteci_olu), "class": "rp-olu" }), ayAd(a.ay) + ": " + a.gazeteci_olu + " gazeteci öldürüldü · bölge basını " + a.bolge.gazeteci_haber + ", Batı ana akım " + a.bati_ana.gazeteci_haber + " başlık")); });
    ["bolge", "bati_ana"].forEach(function (g) { s.appendChild(sv("path", { d: A.map(function (a, i) { return (i ? "L" : "M") + x(i).toFixed(1) + "," + yb(a[g].gazeteci_haber).toFixed(1); }).join(""), fill: "none", stroke: R[g], "stroke-width": 2.2 })); });
    [0.5, 1].forEach(function (f) {
      var t = sv("text", { x: P.l - 6, y: yo(enO * f) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = sayi(enO * f, 0); s.appendChild(t);
      var t2 = sv("text", { x: W - P.r + 6, y: yb(enB * f) + 4, "class": "rp-eksen" }); t2.textContent = sayi(enB * f, 0); s.appendChild(t2);
    });
    var t3 = sv("text", { x: W - P.r + 6, y: P.t - 6, "class": "rp-eksen rp-eksen-ad" }); t3.textContent = "başlık"; s.appendChild(t3);
    A.forEach(function (a, i) { if (a.ay.slice(5) === "01") { var t = sv("text", { x: x(i), y: H - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = a.ay.slice(0, 4); s.appendChild(t); } });
    k.appendChild(s);
  }

  // ---- 6) yayın dağılımı: x = işgal (karekök), y = Filistinlilerin ölümünde faili yazma
  function dagilim(v) {
    var k = $("g-dagilim"); efsane(GR, k);
    var Y = v.yayinlar.filter(function (o) { return o.olum_haberi >= 30; }), W = 720, H = 420, P = { l: 48, r: 16, t: 22, b: 40 };
    var ex = Math.sqrt(Math.max.apply(0, Y.map(function (o) { return o.binde.isgal || 0; })) || 1);
    var fy = function (o) { return o.fail_yazilan.filistinli || 0; };
    var x = function (d) { return P.l + (W - P.l - P.r) * Math.sqrt(d || 0) / ex; }, y = function (p) { return H - P.b - (H - P.t - P.b) * Math.min(p, 70) / 70; };
    var en = Math.max.apply(0, Y.map(function (o) { return o.baglamli; }));
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": "Yayınlar: işgal kelimesi ve faili yazma" });
    [0, 10, 50, 100, 200].forEach(function (d) { if (Math.sqrt(d) > ex) return; s.appendChild(sv("line", { x1: x(d), x2: x(d), y1: P.t, y2: H - P.b, "class": "rp-izgara" })); var t = sv("text", { x: x(d), y: H - P.b + 16, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = d; s.appendChild(t); });
    [0, 20, 40, 60].forEach(function (p) { s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(p), y2: y(p), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 6, y: y(p) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = "%" + p; s.appendChild(t); });
    var tx = sv("text", { x: W - P.r, y: H - 6, "text-anchor": "end", "class": "rp-eksen rp-eksen-ad" }); tx.textContent = "“işgal” · binde →"; s.appendChild(tx);
    var ty = sv("text", { x: P.l, y: P.t - 8, "class": "rp-eksen rp-eksen-ad" }); ty.textContent = "↑ Filistinlilerin ölümünde fail yazılan pay"; s.appendChild(ty);
    Y.slice().sort(function (a, c) { return c.baglamli - a.baglamli; }).forEach(function (o) {
      s.appendChild(baslik(sv("circle", { cx: x(o.binde.isgal), cy: y(fy(o)), r: 3 + 11 * Math.sqrt(o.baglamli / en), fill: R[o.grup], "fill-opacity": 0.55, stroke: R[o.grup], "stroke-width": 1 }),
        o.ad + " (" + AD[o.grup] + ") · işgal binde " + sayi(o.binde.isgal) + " · ölümlerde fail yazılan %" + sayi(fy(o), 0) + " · " + sayi(o.olum_haberi, 0) + " ölüm başlığı"));
    });
    var bati = Y.filter(function (o) { return o.grup !== "bolge" && o.olum_haberi >= 80; }).sort(function (a, c) { return fy(c) - fy(a); });
    bati.slice(0, 3).concat(bati.slice(-3)).forEach(function (o) {
      var px = x(o.binde.isgal), sag = px > W * 0.7;
      var t = sv("text", { x: px + (sag ? -10 : 10), y: y(fy(o)) - 8, "text-anchor": sag ? "end" : "start", "class": "rp-nokta-ad" }); t.textContent = o.ad; s.appendChild(t);
    });
    k.appendChild(s);
  }
  function yayinTablo(v) {
    var k = $("g-yayinlar");
    var S = [["ad", "Yayın"], ["grup", "Grup"], ["baglamli", "Başlık"], ["fail", "Fail yazılan %"], ["isgal", "işgal"], ["catisma", "çatışma"], ["rehine", "rehine"], ["esir", "esir"], ["teror", "terör"], ["soykirim", "soykırım"], ["gazze", "Gazze %"]];
    var sr = { k: "baglamli", y: -1 };
    var d = el("details"); d.appendChild(el("summary", null, "Bütün yayınların tablosu (" + v.yayinlar.length + ")"));
    var kt = el("div", "tablo-kutu"); var t = el("table", "rp-yt"); kt.appendChild(t); d.appendChild(kt); k.appendChild(d);
    var val = function (o, a) { return a === "ad" ? o.ad : a === "grup" ? AD[o.grup] : a === "baglamli" ? o.baglamli : a === "gazze" ? o.gazze_pay : a === "fail" ? (o.olum_haberi >= 30 ? o.fail_yazilan.filistinli : null) : o.binde[a]; };
    function ciz() {
      t.innerHTML = ""; var h = el("tr");
      S.forEach(function (c) { var th = el("th", null, c[1] + (sr.k === c[0] ? (sr.y > 0 ? " ▲" : " ▼") : "")); th.onclick = function () { sr = { k: c[0], y: sr.k === c[0] ? -sr.y : -1 }; ciz(); }; h.appendChild(th); });
      var th = el("thead"); th.appendChild(h); t.appendChild(th); var bd = el("tbody");
      v.yayinlar.slice().sort(function (a, c) { var x = val(a, sr.k), y = val(c, sr.k); if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y, "tr") : x - y) * sr.y; }).forEach(function (o) {
        var r = el("tr"); S.forEach(function (c) { var x = val(o, c[0]); var td = el("td", typeof x === "number" ? "sayi" : null, typeof x === "number" ? sayi(x, c[0] === "baglamli" ? 0 : 1) : (x == null ? "–" : x)); if (c[0] === "grup") { td.style.color = R[o.grup]; td.style.fontWeight = 700; } r.appendChild(td); }); bd.appendChild(r);
      });
      t.appendChild(bd);
    }
    ciz();
  }

  // ---- yöntem
  function yontem(v, G) {
    var u = $("g-yontem");
    var ad = function (g) { return v.yayinlar.filter(function (o) { return o.grup === g; }).slice(0, 8).map(function (o) { return o.ad; }).join(", "); };
    [
      "Çerçeve: gündem kuramı (McCombs ve Shaw) ve sorun-dikkat döngüsü (Downs); çerçeveleme (Entman) ve Glasgow Medya Grubu’nun çalışmaları; eleştirel söylem çözümlemesinde edilgenlik ve faillik (Fowler, Trew); Hall’un birincil tanımlayıcılar ve Herman ile Chomsky’nin değerli ve değersiz kurbanlar kavramları.",
      "Veri: toplayıcı çalışmaya başlamadan önceki dönem için yayınların site haritalarından, WordPress arşivlerinden, Telegram kanallarından ve İnternet Arşivi’nden geriye dönük toplanan " + sayi(v.baslik, 0) + " başlık. Yapay zekâ kullanılmadı; sayılar başlıklardaki kelimelerin ve kalıpların doğrudan sayımı.",
      "Kelimeler ve ölüm kalıpları 9 dilde aranır; sayım yalnızca Filistin, İsrail ya da Gazze geçen başlıklarda yapılır. Faillik: öldürme fiilinden önce İsrail (ya da Hamas, Hizbullah, silahlı bir Filistinli) geçiyorsa etken; fiilden sonra “in an Israeli strike”, “İsrail’in saldırısında”, “بقصف إسرائيلي” gibi bir ipucuyla geçiyorsa edilgen ama failli; fail yoksa failsiz; öldürme fiili yoksa “öldü / ölü sayısı”; şehit ve istişhad ayrı sayılır. Kalıplar tek tek başlıklarda yanılabilir; binlerce başlıkta eğilimi gösterir.",
      "Başlık sayımı bir kelimenin yayının kendi sesiyle mi, bir alıntı ya da suçlamanın aktarımı olarak mı geçtiğini ayırmaz. “Soykırım” bölümündeki örnekler bu farkı göstermek için seçildi.",
      "Ölümler ve öldürülen gazeteciler: Tech for Palestine’in kamu malı veri setleri (data.techforpalestine.org); kaynakları Gazze Sağlık Bakanlığı ve Gazze Hükümet Medya Ofisi. Toplam " + sayi(v.dis.olu, 0) + " ölüm, " + sayi(v.dis.gazeteci, 0) + " gazeteci. Olay tarihleri kamuya açık kayıtlardan.",
      "Gruplar: Bölge basını (" + G.bolge.olculen_yayin + " yayın; ör. " + ad("bolge") + "); İsrail basını (" + G.israil.olculen_yayin + " yayın; ör. " + ad("israil") + "); Batı ana akım basını (" + G.bati_ana.olculen_yayin + " yayın; ör. " + ad("bati_ana") + "); Batı’da muhalif basın (" + G.bati_muhalif.olculen_yayin + " yayın; ör. " + ad("bati_muhalif") + ").",
      "İnternet Arşivi’ndeki tarih sayfanın arşive alındığı andır; bu yüzden arşiv kayıtlarından yalnızca adresinde tarih yazanlar sayıldı; " + sayi(v.tarihsiz, 0) + " kayıt dışarıda kaldı. İsrail basınının büyük bölümü ölçülemedi (The Jerusalem Post ve Ynet’in kayıtları tarihlenemedi, The Times of Israel ile i24NEWS’in site haritalarına ulaşılamadı); bu grup büyük ölçüde Israel Hayom’u yansıtıyor.",
      "Site haritalarında binlerce eski yazının aynı güne “güncellendi” diye işaretlendiği günler ayıklandı. Bölge dışı yayınlar için yalnızca bölgeyle ilgili başlıklar toplandı; “Gazze payı” bu başlıklar içindeki paydır.",
      "Sessizlik (bölge basınının yazıp İsrail ve Batı basınının hiç yazmadığı olaylar) olay olay karşılaştırma ister: bu dönem için ikinci aşamada, canlı dönem için Almanak’taki sessizlik endeksinde.",
      v.tarama_bitti ? "Tarama tamamlandı." : "Tarama sürüyor; sayılar her gün güncelleniyor ve küçük ölçüde değişebilir."
    ].forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
