// 7 Ekim raporu: data/bulten/rapor-7-ekim.json'dan sayıları metne yerleştirir, grafikleri çizer.
// Bölümler çerçeveyi izler: dikkat, adlandırma, faillik, "soykırım", gazeteciler, yayın yayın.
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var EN = window.DIL === "en";
  function T(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  var R = { bolge: "#1f7a52", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = EN ? { bolge: "Regional press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" } : { bolge: "Bölge basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var TERIM_EN = { soykirim: "genocide", etnik: "ethnic cleansing", katliam: "massacre", isgal: "occupation", sehit: "martyr", apartheid: "apartheid", teror: "terror / terrorist", catisma: "clashes / conflict", operasyon: "operation", misilleme: "retaliation", kalkan: "human shield", saldiri: "attack / bombardment", savas: "war", direnis: "resistance", militan: "militant", esir: "prisoner / detainee", rehine: "hostage", cocuk: "child", sivil: "civilian", aclik: "hunger / famine", yerlesimci: "settler / colonist", insani: "“humanitarian crisis”", etkisiz: "neutralised" };
  var CIFT_EN = { "Şiddetin adı": "The name of the violence", "Olayın adı": "The name of the event", "Silahlı grupların adı": "The name of the armed groups", "Tutulan insanların adı": "The name of people held", "Ölümün adı": "The name of death", "Toprağın durumu": "The status of the land" };
  var OLAY_EN = { "İlk ateşkes ve takas": "First truce and exchange", "Lahey'de soykırım davası": "Genocide case at The Hague", "Un kuyruğu katliamı": "Flour massacre", "Refah saldırısı başladı": "Rafah offensive begins", "Avrupa Futbol Şampiyonası": "European Football Championship", "Paris Olimpiyatları": "Paris Olympics", "Lübnan’a saldırılar: çağrı cihazları, Nasrallah, kara harekâtı": "Attacks on Lebanon: pagers, Nasrallah, ground invasion", "ABD seçimi": "US election", "UCM tutuklama kararları": "ICC arrest warrants", "Suriye'de rejimin çöküşü": "Fall of the Syrian government", "Ateşkes": "Ceasefire", "İsrail–İran savaşı": "Israel–Iran war", "Gazze'de kıtlık ilanı": "Famine declared in Gaza", "BM komisyonu: soykırım": "UN commission: genocide", "Dünya Kupası": "World Cup" };
  function tAd(t) { return EN ? (TERIM_EN[t.anahtar] || t.ad) : t.ad; }
  function oAd(o) { return EN ? (OLAY_EN[o.ad] || o.ad) : o.ad; }
  var GR = ["bolge", "israil", "bati_ana", "bati_muhalif"];
  var AYTAM = EN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  function yuzde(n) { return n == null ? "–" : EN ? sayi(n, 0) + "%" : "%" + sayi(n, 0); }
  function yz(n, d) { return EN ? sayi(n, d) + "%" : "%" + sayi(n, d); }
  function ayAd(m) { return AYTAM[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ekle(d, gun) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + gun); return x.toISOString().slice(0, 10); }

  fetch("data/bulten/rapor-7-ekim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", T("Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.", "Report data is not ready yet; it will be written on the collector’s next run."))); });

  // bir olayın önce / sırasında ortalama Gazze payı ve haftalık ölüm
  function olayEtki(v, o) {
    var bit = o.bit || o.bas, H = v.haftalik;
    var ort = function (b, e, g) { var x = H.filter(function (h) { return h.hafta >= b && h.hafta <= e && h[g].savas_pay != null; }); return x.length ? x.reduce(function (t, h) { return t + h[g].savas_pay; }, 0) / x.length : null; };
    var olu = function (b, e) { var x = H.filter(function (h) { return h.hafta >= b && h.hafta <= e; }); return x.length ? x.reduce(function (t, h) { return t + (h.olu || 0); }, 0) / x.length : null; };
    var ob = ekle(o.bas, -35), oe = ekle(o.bas, -7), sb = ekle(o.bas, -6), se = bit;
    return { bati_once: ort(ob, oe, "bati_ana"), bati_sirasinda: ort(sb, se, "bati_ana"), bolge_once: ort(ob, oe, "bolge"), bolge_sirasinda: ort(sb, se, "bolge"),
      olu_once: olu(ob, oe), olu_sirasinda: olu(sb, se) };
  }

  function ciz(v) {
    if (!v.haftalik || !v.olaylar) {   // eski biçimdeki veri: yeni ölçümler toplayıcının sonraki çalışmasında gelir
      var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", T("Rapor yeni ölçümlerle yeniden hesaplanıyor; birkaç saat içinde burada olacak.", "The report is being recalculated with new measures; it will be here within a few hours.")));
      return;
    }
    var G = {}; v.gruplar.forEach(function (g) { G[g.anahtar] = g; });
    var b = function (g, t) { return G[g].binde[t]; };
    var iran = v.olaylar.filter(function (o) { return /İran savaşı/.test(o.ad); })[0], lub = v.olaylar.filter(function (o) { return /Lübnan/.test(o.ad); })[0];
    var ei = iran ? olayEtki(v, iran) : {}, el2 = lub ? olayEtki(v, lub) : {};
    var gzt = v.dis.gazeteci || 0;
    var deger = {
      donem: ayAd(v.bas) + " – " + ayAd(v.son), baslik: sayi(v.baslik, 0),
      guncel: T("Güncellendi: ", "Updated: ") + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }),
      taslak: v.tarama_bitti ? "" : T("Tarama sürüyor; sayılar kesinleşmedi", "Backfill in progress; figures are provisional"),
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
      ["aktif", "failli", "failsiz", "oldu", "sehadet"].forEach(function (f) { deger["g." + g + ".fp." + f] = yuzde(G[g].faillik_pay[f]); }); deger["g." + g + ".fp.gizli"] = yuzde((G[g].faillik_pay.failsiz || 0) + (G[g].faillik_pay.oldu || 0));
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
    var k = $("g-dikkat"); efsane(["bolge", "bati_ana", "bati_muhalif"], k);
    var H = v.haftalik, W = 760, Hh = 300, P = { l: 40, r: 46, t: 28, b: 26 }, n = H.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * i / (n - 1); };
    var enP = 100, enO = Math.max.apply(0, H.map(function (h) { return h.olu || 0; })) || 1;
    var y = function (p) { return P.t + (Hh - P.t - P.b) * (1 - Math.min(p, enP) / enP); };
    var yo = function (o) { return Hh - P.b - (Hh - P.t - P.b) * o / enO; };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + Hh, "class": "rp-svg", role: "img", "aria-label": T("Hafta hafta savaş payı ve ölümler", "Weekly war share and deaths") });
    var idx = function (g) { for (var i = 0; i < n; i++) if (H[i].hafta >= g) return i; return n - 1; };
    var bw = (W - P.l - P.r) / n;
    v.olaylar.forEach(function (o, j) {
      var a = idx(ekle(o.bas, -6)), c = idx(o.bit || o.bas);
      s.appendChild(baslik(sv("rect", { x: x(a) - bw / 2, y: P.t, width: Math.max(bw, x(c) - x(a) + bw), height: Hh - P.t - P.b, "class": "rp-olay rp-olay-" + o.tur }),
        (j + 1) + " · " + oAd(o) + " · " + gunAd(o.bas) + (o.bit ? " – " + gunAd(o.bit) : "")));
      var t = sv("text", { x: x(a), y: 11 + (j % 2) * 11, "text-anchor": "middle", "class": "rp-olay-no" }); t.textContent = j + 1; s.appendChild(t);
    });
    [0, 25, 50, 75, 100].forEach(function (p) { s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(p), y2: y(p), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 6, y: y(p) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = yz(p, 0); s.appendChild(t); });
    H.forEach(function (h, i) { if (h.hafta.slice(5, 7) === "01" && +h.hafta.slice(8) <= 7) { var t = sv("text", { x: x(i), y: Hh - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = h.hafta.slice(0, 4); s.appendChild(t); } });
    ["bati_muhalif", "bolge", "bati_ana"].forEach(function (g) {
      var d = "", yeni = true;
      H.forEach(function (h, i) { var p = h[g].savas_pay; if (p == null) { yeni = true; return; } d += (yeni ? "M" : "L") + x(i).toFixed(1) + "," + y(p).toFixed(1); yeni = false; });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: R[g], "stroke-width": g === "bati_muhalif" ? 1.2 : 2.2, "stroke-opacity": g === "bati_muhalif" ? 0.55 : 1, "stroke-linejoin": "round" }));
    });
    k.appendChild(s);
  }
  function olayTablo(v) {
    var k = $("g-olaylar"); var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>#</th><th>Event</th><th>Date</th><th>Western mainstream · war share<br><small>before → during</small></th><th>Regional press · war share<br><small>before → during</small></th><th>Deaths in Gaza / week<br><small>before → during</small></th></tr></thead>" : "<thead><tr><th>#</th><th>Olay</th><th>Tarih</th><th>Batı ana akım · savaş payı<br><small>önce → sırasında</small></th><th>Bölge basını · savaş payı<br><small>önce → sırasında</small></th><th>Gazze’de ölüm / hafta<br><small>önce → sırasında</small></th></tr></thead>";
    var bd = el("tbody");
    v.olaylar.forEach(function (o, j) {
      var e = olayEtki(v, o), r = el("tr");
      var fark = function (a, c) { var td = el("td", "sayi", yuzde(a) + " → " + yuzde(c)); if (a != null && c != null && c < a * 0.75) td.classList.add("dusus"); return td; };
      r.append(el("td", "sayi", j + 1), el("td", null, oAd(o)), el("td", null, gunAd(o.bas) + (o.bit ? " – " + gunAd(o.bit) : "")),
        fark(e.bati_once, e.bati_sirasinda), fark(e.bolge_once, e.bolge_sirasinda), el("td", "sayi", sayi(e.olu_once, 0) + " → " + sayi(e.olu_sirasinda, 0)));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); k.appendChild(kt);
    k.appendChild(el("p", "rp-not", T("Nasıl okunur: her satırda, olaydan önceki dört haftada ve olay sürerken, o grubun başlıklarının yüzde kaçının Filistin savaşıyla (Gazze, Batı Şeria, Kudüs, Lübnan) ilgili olduğu. Kırmızı: savaş payı dörtte birden fazla düştü, yani o olay sırasında savaş gündemden çıktı. Sağdaki sütun aynı dönemlerde Gazze’de haftada bildirilen ölümler: ölümler sürerken pay düşüyorsa, ilgi başka yere kaymıştır.", "How to read it: each row shows what share of the group’s headlines were about the Palestine war (Gaza, the West Bank, Jerusalem, Lebanon) in the four weeks before the event and while it lasted. Red: the war share fell by more than a quarter, meaning the war dropped off the agenda during that event. The right-hand column is the weekly deaths reported in Gaza in the same periods: if the share falls while the deaths go on, attention has moved elsewhere.")));
  }
  // takvim: yıl yıl haftalık kareler
  function takvim(v) {
    var k = $("g-takvim"), H = v.haftalik;
    var renk = function (p, g) { if (p == null) return "#ebe9e3"; var a = Math.min(1, p / 80); return (g === "bolge" ? "rgba(31,122,82," : "rgba(138,109,59,") + (0.08 + 0.92 * a).toFixed(2) + ")"; };
    var yillar = {}; H.forEach(function (h) { var yl = h.hafta.slice(0, 4); (yillar[yl] = yillar[yl] || []).push(h); });
    Object.keys(yillar).sort().forEach(function (yil) {
      var blok = el("div", "rp-takvim-yil"); blok.appendChild(el("b", null, yil));
      ["bati_ana", "bolge"].forEach(function (g) {
        var sat = el("div", "rp-takvim-satir"); sat.appendChild(el("span", "rp-takvim-ad", AD[g]));
        var kareler = el("div", "rp-kareler");
        var bos = Math.floor((new Date(yillar[yil][0].hafta + "T12:00:00Z") - new Date(yil + "-01-01T12:00:00Z")) / (7 * 864e5));
        for (var i = 0; i < bos; i++) kareler.appendChild(el("i", "rp-bos"));
        yillar[yil].forEach(function (h) { var c = el("i"); c.style.background = renk(h[g].savas_pay, g); c.title = T(gunAd(h.hafta) + " haftası · " + AD[g] + ": savaş payı " + yuzde(h[g].savas_pay) + " · " + sayi(h.olu, 0) + " ölüm", "Week of " + gunAd(h.hafta) + " · " + AD[g] + ": war share " + yuzde(h[g].savas_pay) + " · " + sayi(h.olu, 0) + " deaths"); kareler.appendChild(c); });
        sat.appendChild(kareler); blok.appendChild(sat);
      });
      k.appendChild(blok);
    });
    var ay = el("div", "rp-takvim-olcek"); ay.append(el("span", null, T("az", "low")), el("i"), el("span", null, T("savaş payı %80 ve üstü", "war share 80% and above"))); k.appendChild(ay);
  }

  // ---- 2) adlandırma: karşıt çiftler
  function ciftler(v, G) {
    var k = $("g-ciftler");
    var ad = {}; v.terimler.forEach(function (t) { ad[t.anahtar] = tAd(t).replace(/[“”]/g, ""); });
    v.ciftler.forEach(function (c) {
      var en = Math.max.apply(0, GR.map(function (g) { return Math.max(G[g].binde[c.a] || 0, G[g].binde[c.b] || 0); })) || 1;
      var blok = el("div", "rp-cift"); blok.appendChild(el("div", "rp-cift-bas", EN ? (CIFT_EN[c.ad] || c.ad) : c.ad));
      var bas = el("div", "rp-cift-satir rp-cift-etiket"); bas.append(el("span", "sol", "“" + ad[c.a] + "”"), el("span"), el("span", "sag", "“" + ad[c.b] + "”")); blok.appendChild(bas);
      GR.forEach(function (g) {
        var a = G[g].binde[c.a] || 0, z = G[g].binde[c.b] || 0, s = el("div", "rp-cift-satir");
        var sol = el("div", "sol"); var i1 = el("i"); i1.style.width = (100 * a / en) + "%"; i1.style.background = R[g]; sol.append(el("em", null, sayi(a)), i1);
        var sag = el("div", "sag"); var i2 = el("i"); i2.style.width = (100 * z / en) + "%"; i2.style.background = R[g]; i2.style.opacity = 0.55; sag.append(i2, el("em", null, sayi(z)));
        s.append(sol, el("span", "rp-cift-grup", AD[g]), sag); s.title = AD[g] + ": “" + ad[c.a] + "” " + T("binde ", "per thousand: ") + sayi(a) + ", “" + ad[c.b] + "” " + T("binde ", "per thousand: ") + sayi(z);
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
      var a = el("div", "rp-terim-ad", "“" + tAd(tr).replace(/[“”]/g, "") + "”"); s.appendChild(a);
      var cs = el("div", "rp-terim-cubuklar");
      GR.forEach(function (g) { var d = G[g].binde[tr.anahtar] || 0, c = el("div", "rp-cubuk"); var i = el("i"); i.style.width = Math.max(0.5, 100 * d / en) + "%"; i.style.background = R[g]; c.appendChild(i); c.appendChild(el("span", null, sayi(d))); c.title = AD[g] + T(": binde ", ": per thousand ") + sayi(d); cs.appendChild(c); });
      s.appendChild(cs); t.appendChild(s);
    });
    k.appendChild(t);
  }

  // ---- 3) faillik
  var FK = [["aktif", T("Fail yazılı: “İsrail öldürdü”", "Killer named: “Israel killed”"), "#262a28"], ["failli", T("Fail yazılı: “İsrail tarafından / İsrail saldırısında öldürüldü”", "Killer named: “killed by Israel / in an Israeli strike”"), "#5b6360"], ["failsiz", T("Fail yazılmamış: “öldürüldü”", "Killer not named: “were killed”"), "#e0702b"], ["oldu", T("Öldürme bile yok: “öldü”, “ölü sayısı”", "Not even a killing: “died”, “death toll”"), "#f2b13a"], ["sehadet", T("Şehadet dili: “şehit oldu”", "Martyrdom: “martyred”"), "#1f7a52"]];
  function faillik(v, G) {
    var k = $("g-faillik"); efsane([], k, FK.map(function (f) { return [f[2], f[1]]; }));
    GR.forEach(function (g) {
      var p = G[g].faillik_pay, s = el("div", "rp-yigin-satir");
      s.appendChild(el("span", "rp-yigin-ad", AD[g] + " · " + sayi(G[g].olum_haberi, 0) + T(" başlık", " headlines") + (G[g].olum_haberi < 300 ? T(" (küçük örneklem)", " (small sample)") : "")));
      var c = el("div", "rp-yigin");
      FK.forEach(function (f) { var d = p[f[0]] || 0; if (!d) return; var i = el("i"); i.style.width = d + "%"; i.style.background = f[2]; i.title = f[1] + ": " + yz(d); if (d >= 8) i.textContent = yz(d, 0); c.appendChild(i); });
      s.appendChild(c); k.appendChild(s);
    });
    // güven aralığı, yayın ağırlıklı ortalama ve şehadet duyarlılığı (D3, E3)
    if (!G.bolge.fail_yazilan || !G.bolge.fail_yazilan.filistinli_ga) return;
    var kt = el("div", "tablo-kutu"), tb = el("table", "rp-ga"), th = el("thead"), tr0 = el("tr");
    [T("Grup", "Group"), T("Faili yazılan (başlık ağırlıklı)", "Killer named (headline-weighted)"), T("%95 güven aralığı", "95% confidence interval"), T("Yayın ağırlıklı ortalama", "Outlet-weighted mean"), T("Şehadet paydaya katılsa", "If martyrdom headlines were counted")].forEach(function (x) { tr0.appendChild(el("th", null, x)); });
    th.appendChild(tr0); tb.appendChild(th); var bd = el("tbody");
    GR.forEach(function (g) {
      var f = G[g].fail_yazilan, r = el("tr"), ya = f.yayin_agirlikli || {};
      r.appendChild(el("td", null, AD[g] + " · " + sayi(f.filistinli_n, 0) + T(" başlık", " headlines")));
      r.appendChild(el("td", "sayi", yz(f.filistinli)));
      r.appendChild(el("td", "sayi", f.filistinli_ga ? yz(f.filistinli_ga[0]) + "–" + sayi(f.filistinli_ga[1]) : "–"));
      r.appendChild(el("td", "sayi", ya.yayin >= 3 ? yz(ya.ortalama) + " (" + ya.yayin + T(" yayın)", " outlets)") : T("yetersiz yayın", "too few outlets")));
      r.appendChild(el("td", "sayi", yz(f.filistinli_sehadet_dahil)));
      bd.appendChild(r);
    });
    tb.appendChild(bd); kt.appendChild(tb); k.appendChild(kt);
    k.appendChild(el("p", "rp-not", T("Başlık ağırlıklı oran bütün başlıkları birlikte sayar; çok yazan yayınlar ağır basar. Yayın ağırlıklı ortalamada her yayın bir oy (en az 30 Filistinli ölüm başlığı olan yayınlar). Son sütun, şehadet diyen başlıklar “fail yazılmamış” sayılsaydı oranın ne olacağını gösterir: bölge basınının oranı bu tercihe bağlıdır, Batı basınınınki değildir.",
      "The headline-weighted rate counts all headlines together, so prolific outlets weigh more. In the outlet-weighted mean each outlet gets one vote (outlets with at least 30 headlines on Palestinian deaths). The last column shows the rate if martyrdom headlines were counted as “killer not named”: the regional press figure depends on this choice, the Western figure does not.")));
  }
  function kiminOlumu(v, G) {
    var k = $("g-kimin"); efsane([], k, [["#262a28", T("Filistinlilerin ölümü: fail yazılmış", "Palestinian deaths: killer named")], ["#c9544e", T("İsraillilerin ölümü: fail yazılmış", "Israeli deaths: killer named")]]);
    ["bolge", "bati_ana", "israil"].forEach(function (g) {
      var f = G[g].fail_yazilan; if (f.israilli == null || f.israilli_n < 100) return;   // küçük örneklemi gösterme
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
      var c = el("div", "rp-zirve-kart"); var h = el("div", "rp-zirve-bas"); h.appendChild(el("b", null, ayAd(z.ay))); h.appendChild(el("span", null, T("Batı ana akım basınında binde ", "Western mainstream, per thousand: ") + sayi(z.binde))); c.appendChild(h);
      z.ornek.forEach(function (o) { var a = el("a", "rp-ornek"); a.href = o.url; a.target = "_blank"; a.rel = "noopener"; var bb = el("span", "rp-ornek-b", o.baslik); bb.dir = "auto"; a.appendChild(bb); a.appendChild(el("small", null, o.yayin + " · " + o.gun + " ↗")); c.appendChild(a); });
      k.appendChild(c);
    });
  }

  // ---- 5) gazeteciler
  function gazeteci(v) {
    var k = $("g-gazeteci"); efsane(["bolge", "bati_ana"], k);
    var A = v.aylik, W = 760, H = 260, P = { l: 40, r: 50, t: 18, b: 26 }, n = A.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * (i + 0.5) / n; };
    var enO = Math.max.apply(0, A.map(function (s) { return s.gazeteci_olu || 0; })) || 1;
    var enB = Math.max.apply(0, A.map(function (s) { return s.bolge.gazeteci_haber; })) || 1;
    var yo = function (d) { return H - P.b - (H - P.t - P.b) * d / enO; };
    var yb = function (d) { return H - P.b - (H - P.t - P.b) * Math.min(d, enB) / enB; };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": T("Öldürülen gazeteciler ve haberleri", "Journalists killed and their coverage") });
    var bw = (W - P.l - P.r) / n * 0.7;
    ["bolge", "bati_ana"].forEach(function (g) { s.appendChild(sv("path", { d: A.map(function (a, i) { return (i ? "L" : "M") + x(i).toFixed(1) + "," + yb(a[g].gazeteci_haber).toFixed(1); }).join(""), fill: "none", stroke: R[g], "stroke-width": 2.2 })); });
    [0.5, 1].forEach(function (f) {
      var t2 = sv("text", { x: W - P.r + 6, y: yb(enB * f) + 4, "class": "rp-eksen" }); t2.textContent = sayi(enB * f, 0); s.appendChild(t2);
    });
    var t3 = sv("text", { x: W - P.r + 6, y: P.t - 6, "class": "rp-eksen rp-eksen-ad" }); t3.textContent = T("başlık", "headlines"); s.appendChild(t3);
    A.forEach(function (a, i) { if (a.ay.slice(5) === "01") { var t = sv("text", { x: x(i), y: H - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = a.ay.slice(0, 4); s.appendChild(t); } });
    k.appendChild(s);
  }

  // ---- 6) yayın dağılımı: x = işgal (karekök), y = Filistinlilerin ölümünde faili yazma
  // Yayın yayın: iki şerit grafik. Her satır bir grup, her nokta bir yayın; dikey çizgi grubun ortancası.
  // 1) faili saklama: Filistinlilerin ölümünü anlatan başlıklardan öldürenin yazılmadığı pay ("öldü", "hayatını kaybetti");
  //    "şehit / şehadet" diyen başlıklar ayrı bir anlatım olduğu için paydaya katılmaz. 2) "işgal" kelimesi bin başlıkta.
  function gizli(f) { var t = (f.aktif || 0) + (f.failli || 0) + (f.failsiz || 0) + (f.oldu || 0); return t >= 20 ? 100 * ((f.failsiz || 0) + (f.oldu || 0)) / t : null; }
  function ortanca(xs) { if (!xs.length) return null; var a = xs.slice().sort(function (p, q) { return p - q; }), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function serit(k, Y, deger, olcek, eksen, eksenAd, bicim) {
    var gr = GR.filter(function (g) { return Y.some(function (o) { return o.grup === g && deger(o) != null; }); });
    var W = 760, satir = 112, P = { l: 150, r: 24, t: 30, b: 34 }, H = P.t + P.b + satir * gr.length;
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": eksenAd });
    var x = function (d) { return P.l + (W - P.l - P.r) * olcek(d); };
    eksen.forEach(function (d) { s.appendChild(sv("line", { x1: x(d), x2: x(d), y1: P.t - 6, y2: H - P.b, "class": "rp-izgara" })); var t = sv("text", { x: x(d), y: H - P.b + 18, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = bicim(d); s.appendChild(t); });
    var ty = sv("text", { x: W - P.r, y: H - 4, "text-anchor": "end", "class": "rp-eksen rp-eksen-ad" }); ty.textContent = eksenAd + " →"; s.appendChild(ty);
    var en = Math.max.apply(0, Y.map(function (o) { return o.olum_haberi; })) || 1;
    gr.forEach(function (g, i) {
      var yo = P.t + satir * i + satir / 2, xs = Y.filter(function (o) { return o.grup === g && deger(o) != null; }).sort(function (p, q) { return deger(p) - deger(q); });
      if (i) s.appendChild(sv("line", { x1: 0, x2: W, y1: P.t + satir * i, y2: P.t + satir * i, stroke: "#ebe9e3" }));
      var ad = sv("text", { x: 0, y: yo - 4, "class": "rp-serit-ad" }); ad.textContent = AD[g]; s.appendChild(ad);
      var n = sv("text", { x: 0, y: yo + 13, "class": "rp-eksen" }); n.textContent = xs.length + T(" yayın", " outlets"); s.appendChild(n);
      var m = ortanca(xs.map(deger));
      s.appendChild(sv("line", { x1: x(m), x2: x(m), y1: yo - 26, y2: yo + 26, stroke: R[g], "stroke-width": 3 }));
      var mt = sv("text", { x: x(m), y: yo - 30, "text-anchor": "middle", "class": "rp-serit-orta", fill: R[g] }); mt.textContent = T("ortanca ", "median ") + bicim(m); s.appendChild(mt);
      xs.forEach(function (o, j) {
        var r = 3.5 + 7 * Math.sqrt(o.olum_haberi / en), cy = yo + ((j % 3) - 1) * 7;
        s.appendChild(baslik(sv("circle", { cx: x(deger(o)), cy: cy, r: r, fill: R[g], "fill-opacity": 0.5, stroke: R[g], "stroke-width": 1 }), o.ad + " · " + bicim(deger(o)) + " · " + sayi(o.olum_haberi, 0) + T(" ölüm başlığı", " death headlines")));
      });
      // uçlardaki yayınların adları: en düşük ve en yüksek; yazılar çakışırsa ikincisi bir alt satıra iner
      if (xs.length >= 2) {
        var lo = xs[0], hi = xs[xs.length - 1], gen = function (o) { return (o.ad.length + 5) * 6.6; };
        var lx = Math.max(x(deger(lo)) - 6, P.l), hx = Math.min(x(deger(hi)) + 6, W - 2);
        var ust = lx + gen(lo) + 12 > hx - gen(hi);
        [[lo, lx, "start", yo + 36], [hi, hx, "end", ust ? yo + 50 : yo + 36]].forEach(function (u) {
          var t = sv("text", { x: u[1], y: u[3], "text-anchor": u[2], "class": "rp-nokta-ad" }); t.textContent = u[0].ad + " " + bicim(deger(u[0])); s.appendChild(t);
        });
      }
    });
    k.appendChild(s);
    return gr.map(function (g) { return [g, ortanca(Y.filter(function (o) { return o.grup === g && deger(o) != null; }).map(deger))]; });
  }
  function dagilim(v) {
    var k = $("g-dagilim");
    var Y = v.yayinlar.filter(function (o) { return o.olum_haberi >= 30 && o.faillik; });
    var ort = serit(k, Y, function (o) { return gizli(o.faillik); }, function (d) { return d / 100; }, [0, 25, 50, 75, 100], T("Filistinlilerin ölümünü anlatırken faili yazmayan başlıklar", "Headlines on Palestinian deaths that do not name the killer"), function (d) { return yz(d, 0); });
    var O = {}; ort.forEach(function (x) { O[x[0]] = x[1]; });
    var m = $("dagilim-ozet");
    if (m && O.bati_ana != null && O.bolge != null) m.textContent = T("Batı ana akım yayınlarının yarısı, Filistinlilerin öldüğünü yazan başlıklarının en az " + inde(O.bati_ana) + " öldüreni yazmıyor (“öldü”, “hayatını kaybetti”). Bölge basınında ortanca " + yz(O.bolge, 0) + ". “Şehit” diyen başlıklar bu hesaba katılmadı: faili yazmasalar da ölümü bir saldırının sonucu olarak anlatıyorlar.",
      "Half of Western mainstream outlets leave out who did the killing in at least " + yz(O.bati_ana, 0) + " of their headlines on Palestinian deaths (“died”, “lost their lives”). The regional press median is " + yz(O.bolge, 0) + ". Headlines saying “martyred” are left out of this count: even without naming the killer, they present the death as the result of an attack.");
    var k3 = $("g-sehadet");
    if (k3) serit(k3, Y, function (o) { var f = o.faillik, t = (f.aktif || 0) + (f.failli || 0) + (f.failsiz || 0) + (f.oldu || 0) + (f.sehadet || 0); return t >= 20 ? 100 * (f.sehadet || 0) / t : null; },
      function (d) { return d / 100; }, [0, 25, 50, 75, 100], T("Filistinlilerin ölümünü “şehit” diye yazan başlıklar", "Headlines calling Palestinian dead “martyrs”"), function (d) { return yz(d, 0); });
    var k2 = $("g-isgal"); if (!k2) return;
    var ex = Math.sqrt(Math.max.apply(0, Y.map(function (o) { return o.binde.isgal || 0; })) || 1);
    serit(k2, v.yayinlar.filter(function (o) { return o.baglamli >= 150; }), function (o) { return o.binde.isgal || 0; }, function (d) { return Math.sqrt(d) / ex; }, [0, 10, 50, 100, 200, 300].filter(function (d) { return Math.sqrt(d) <= ex; }), T("“işgal” kelimesi, bin başlıkta", "“occupation”, per thousand headlines"), function (d) { return sayi(d, 0); });
  }
  function inde(n) {
    var s = sayi(n, 0); if (EN) return s + "%";
    var b = { 1: "inde", 2: "sinde", 3: "ünde", 4: "ünde", 5: "inde", 6: "sında", 7: "sinde", 8: "inde", 9: "unda" }, o = { 0: "ında", 1: "unda", 2: "sinde", 3: "unda", 4: "ında", 5: "sinde", 6: "ında", 7: "inde", 8: "inde", 9: "ında" };
    var x = Math.round(n), e = x % 100 === 0 && x ? "ünde" : x % 10 ? b[x % 10] : o[(x / 10) % 10];
    return "%" + s + "’" + e;
  }
  function yayinTablo(v) {
    var k = $("g-yayinlar");
    var S = EN ? [["ad", "Outlet"], ["grup", "Group"], ["baglamli", "Headlines"], ["fail", "Killer named %"], ["isgal", "occupation"], ["catisma", "conflict"], ["rehine", "hostage"], ["esir", "prisoner"], ["teror", "terror"], ["soykirim", "genocide"], ["gazze", "War %"]] : [["ad", "Yayın"], ["grup", "Grup"], ["baglamli", "Başlık"], ["fail", "Fail yazılan %"], ["isgal", "işgal"], ["catisma", "çatışma"], ["rehine", "rehine"], ["esir", "esir"], ["teror", "terör"], ["soykirim", "soykırım"], ["gazze", "Savaş %"]];
    var sr = { k: "baglamli", y: -1 };
    var d = el("details"); d.appendChild(el("summary", null, T("Bütün yayınların tablosu (", "Table of all outlets (") + v.yayinlar.length + ")"));
    var kt = el("div", "tablo-kutu"); var t = el("table", "rp-yt"); kt.appendChild(t); d.appendChild(kt); k.appendChild(d);
    var val = function (o, a) { return a === "ad" ? o.ad : a === "grup" ? AD[o.grup] : a === "baglamli" ? o.baglamli : a === "gazze" ? o.savas_pay : a === "fail" ? (o.olum_haberi >= 30 ? o.fail_yazilan.filistinli : null) : o.binde[a]; };
    function ciz() {
      t.innerHTML = ""; var h = el("tr");
      S.forEach(function (c) { var th = el("th", null, c[1] + (sr.k === c[0] ? (sr.y > 0 ? " ▲" : " ▼") : "")); th.onclick = function () { sr = { k: c[0], y: sr.k === c[0] ? -sr.y : -1 }; ciz(); }; h.appendChild(th); });
      var th = el("thead"); th.appendChild(h); t.appendChild(th); var bd = el("tbody");
      v.yayinlar.slice().sort(function (a, c) { var x = val(a, sr.k), y = val(c, sr.k); if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y, EN ? "en" : "tr") : x - y) * sr.y; }).forEach(function (o) {
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
    (EN ? [
      "Framework: agenda-setting (McCombs and Shaw) and the issue-attention cycle (Downs); framing (Entman) and the Glasgow Media Group; passivisation and agency in critical discourse analysis (Fowler, Trew); Hall’s primary definers and Herman and Chomsky’s worthy and unworthy victims.",
      "Data: " + sayi(v.baslik, 0) + " headlines collected retrospectively, for the period before the collector started, from outlets’ sitemaps, WordPress archives, Telegram channels and the Internet Archive. No AI was used; figures are direct counts of words and patterns in headlines.",
      "Words and death patterns are searched in 9 languages; counts cover only headlines mentioning Palestine, Israel or Gaza. Agency: if Israel (or Hamas, Hezbollah, an armed Palestinian) appears before the verb of killing, the sentence is active; if it appears after the verb with a cue such as “in an Israeli strike” or “بقصف إسرائيلي”, it is passive with an agent; with no agent, agentless; with no verb of killing, “died / death toll”; martyrdom is counted separately. Patterns can be wrong on single headlines; over thousands they show the trend.",
      "A headline count does not distinguish whether a word is in the outlet’s own voice or reports a quote or an accusation. The examples in the “genocide” section were chosen to show this difference.",
      "Deaths and journalists killed: Tech for Palestine’s public-domain datasets (data.techforpalestine.org), based on the Gaza Ministry of Health and the Gaza Government Media Office. Total " + sayi(v.dis.olu, 0) + " deaths, " + sayi(v.dis.gazeteci, 0) + " journalists. Event dates from public records.",
      "Groups: regional press (" + G.bolge.olculen_yayin + " outlets; e.g. " + ad("bolge") + "); Israeli press (" + G.israil.olculen_yayin + " outlets; e.g. " + ad("israil") + "); Western mainstream press (" + G.bati_ana.olculen_yayin + " outlets; e.g. " + ad("bati_ana") + "); Western dissenting press (" + G.bati_muhalif.olculen_yayin + " outlets; e.g. " + ad("bati_muhalif") + ").",
      "The Internet Archive date is when a page was archived, so only archived records with a date in their URL were counted; " + sayi(v.tarihsiz, 0) + " records were left out. Most of the Israeli press could not be measured (The Jerusalem Post and Ynet records could not be dated; The Times of Israel and i24NEWS sitemaps were unreachable); this group largely reflects Israel Hayom.",
      "Days on which sitemaps marked thousands of old articles as “updated” on the same day were removed. For outlets outside the region only region-related headlines were collected; the “war share” is the share of these headlines mentioning Gaza, the West Bank, Jerusalem, Lebanon or Israel (excluding those only about Iran). Attacks on Lebanon are counted as part of the same war.",
      "Silence (events the regional press covered and the Israeli and Western press did not cover at all) needs event-by-event comparison: for this period in a second stage, for the live period in the silence index on the Reports page.",
      v.tarama_bitti ? "Backfill complete." : "Backfill in progress; figures are updated daily and may change slightly."
    ] : [
      "Çerçeve: gündem kuramı (McCombs ve Shaw) ve sorun-dikkat döngüsü (Downs); çerçeveleme (Entman) ve Glasgow Medya Grubu’nun çalışmaları; eleştirel söylem çözümlemesinde edilgenlik ve faillik (Fowler, Trew); Hall’un birincil tanımlayıcılar ve Herman ile Chomsky’nin değerli ve değersiz kurbanlar kavramları.",
      "Veri: toplayıcı çalışmaya başlamadan önceki dönem için yayınların site haritalarından, WordPress arşivlerinden, Telegram kanallarından ve İnternet Arşivi’nden geriye dönük toplanan " + sayi(v.baslik, 0) + " başlık. Yapay zekâ kullanılmadı; sayılar başlıklardaki kelimelerin ve kalıpların doğrudan sayımı.",
      "Kelimeler ve ölüm kalıpları 9 dilde aranır; sayım yalnızca Filistin, İsrail ya da Gazze geçen başlıklarda yapılır. Faillik: öldürme fiilinden önce İsrail (ya da Hamas, Hizbullah, silahlı bir Filistinli) geçiyorsa etken; fiilden sonra “in an Israeli strike”, “İsrail’in saldırısında”, “بقصف إسرائيلي” gibi bir ipucuyla geçiyorsa edilgen ama failli; fail yoksa failsiz; öldürme fiili yoksa “öldü / ölü sayısı”; şehit ve istişhad ayrı sayılır. Kalıplar tek tek başlıklarda yanılabilir; binlerce başlıkta eğilimi gösterir.",
      "Başlık sayımı bir kelimenin yayının kendi sesiyle mi, bir alıntı ya da suçlamanın aktarımı olarak mı geçtiğini ayırmaz. “Soykırım” bölümündeki örnekler bu farkı göstermek için seçildi.",
      "Ölümler ve öldürülen gazeteciler: Tech for Palestine’in kamu malı veri setleri (data.techforpalestine.org); kaynakları Gazze Sağlık Bakanlığı ve Gazze Hükümet Medya Ofisi. Toplam " + sayi(v.dis.olu, 0) + " ölüm, " + sayi(v.dis.gazeteci, 0) + " gazeteci. Olay tarihleri kamuya açık kayıtlardan.",
      "Gruplar: Bölge basını (" + G.bolge.olculen_yayin + " yayın; ör. " + ad("bolge") + "); İsrail basını (" + G.israil.olculen_yayin + " yayın; ör. " + ad("israil") + "); Batı ana akım basını (" + G.bati_ana.olculen_yayin + " yayın; ör. " + ad("bati_ana") + "); Batı’da muhalif basın (" + G.bati_muhalif.olculen_yayin + " yayın; ör. " + ad("bati_muhalif") + ").",
      "İnternet Arşivi’ndeki tarih sayfanın arşive alındığı andır; bu yüzden arşiv kayıtlarından yalnızca adresinde tarih yazanlar sayıldı; " + sayi(v.tarihsiz, 0) + " kayıt dışarıda kaldı. İsrail basınının büyük bölümü ölçülemedi (The Jerusalem Post ve Ynet’in kayıtları tarihlenemedi, The Times of Israel ile i24NEWS’in site haritalarına ulaşılamadı); bu grup büyük ölçüde Israel Hayom’u yansıtıyor.",
      "Site haritalarında binlerce eski yazının aynı güne “güncellendi” diye işaretlendiği günler ayıklandı. Bölge dışı yayınlar için yalnızca bölgeyle ilgili başlıklar toplandı; “Savaş payı” bu başlıklar içinde Gazze, Batı Şeria, Kudüs, Lübnan ya da İsrail geçenlerin payıdır (yalnızca İran’la ilgili olanlar hariç). Lübnan’a yapılan saldırılar aynı savaşın parçası olarak sayıldı.",
      "Sessizlik (bölge basınının yazıp İsrail ve Batı basınının hiç yazmadığı olaylar) olay olay karşılaştırma ister: bu dönem için ikinci aşamada, canlı dönem için Raporlar sayfasındaki sessizlik endeksinde.",
      v.tarama_bitti ? "Tarama tamamlandı." : "Tarama sürüyor; sayılar her gün güncelleniyor ve küçük ölçüde değişebilir."    ]).forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
