// Alışma raporunun yeni ilk bölümleri: "Gerçekte ne oldu, ne kadarı haber oldu" (basından bağımsız kayıtlar, her nokta
// bir yapı ya da olay) ve "Basın yazdı, toplum ne yaptı" (Vikipedi okunmaları). Veri: data/bulten/alisma.json (gercek, toplum).
(function () {
  "use strict";
  var EN = window.DIL === "en", YER = window.YEREL || (EN ? "en-GB" : "tr-TR"), NS = "http://www.w3.org/2000/svg";
  function $(i) { return document.getElementById(i); }
  function tt(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 0 : d }); }
  var AYTAM = EN ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] : ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  var R = { bolge: "#1f7a52", turkiye: "#7a3fa0", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = EN ? { bolge: "Regional press", turkiye: "Turkish press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" }
    : { bolge: "Bölge basını", turkiye: "Türkiye basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var GERCEK_EN = { ibadet: ["Mosques and churches destroyed or damaged", "buildings", "Gaza Government Media Office"], okul: ["School and university buildings destroyed or damaged", "buildings", "Gaza Government Media Office"],
    katliam: ["Massacres recorded by the Gaza Ministry of Health (attacks killing several members of one family)", "events", "Gaza Ministry of Health"] };
  var BASIN_AD = EN ? { ibadet: "attacks on mosques and churches", okul: "attacks on schools and shelters", katliam: "attacks called “massacres”" }
    : { ibadet: "camilere ve kiliselere saldırı", okul: "okullara ve sığınaklara saldırı", katliam: "“katliam” denen saldırı" };
  var DIL_AD = EN ? { en: "English", ar: "Arabic", tr: "Turkish", de: "German", fr: "French", es: "Spanish" } : { en: "İngilizce", ar: "Arapça", tr: "Türkçe", de: "Almanca", fr: "Fransızca", es: "İspanyolca" };
  var DIL_R = { en: "#1f2421", ar: "#1f7a52", tr: "#c9544e", de: "#8a6d3b", fr: "#2f5bb7", es: "#c39a35" };
  var TUR_AD = EN ? { hastane: "hospital", yardim: "aid", yardimci: "aid workers", cadir: "tents", katliam: "massacre", okul: "school", saglik: "health workers", kitlik: "famine" }
    : { hastane: "hastane", yardim: "yardım", yardimci: "yardım çalışanları", cadir: "çadır", katliam: "katliam", okul: "okul", saglik: "sağlık çalışanları", kitlik: "kıtlık" };

  function olayAd(o) { return EN ? ((o.baslik && o.baslik.en) || o.ad) : o.ad; }

  fetch("data/bulten/alisma.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    try { gercek(v); } catch (e) { if (window.console) console.error("gercek", e); }
    try { cezaevi(v); } catch (e) { if (window.console) console.error("cezaevi", e); }
    try { toplum(v); } catch (e) { if (window.console) console.error("toplum", e); }
  }).catch(function () { /* rapor-olaylar.js zaten uyarı yazıyor */ });

  // ---------------------------------------------------------------- gerçekte ne oldu
  function noktaSeridi(haftalar, g, b, renk, k) {
    // her nokta k birim; hafta hafta, o haftanın kayıtları kadar nokta; ilk min(g, b) tanesi dolu
    var kutu = el("div", "gk-serit"), yil = null, kalan = 0, dolu = 0, bos = 0;
    haftalar.forEach(function (h, i) {
      var n = g[i]; if (!n) return;
      if (h.slice(0, 4) !== yil) { yil = h.slice(0, 4); kutu.appendChild(el("span", "gk-yil", yil)); }
      var gor = Math.min(n, b[i]);
      // birimleri noktaya çevir (k birim = 1 nokta); artanı sonraki haftaya taşı
      var nk = Math.floor((n + kalan) / k); kalan = (n + kalan) - nk * k;
      var dk = Math.round(nk * gor / n);
      for (var j = 0; j < nk; j++) {
        var d = el("i", j < dk ? null : "sus"); if (j < dk) { d.style.background = renk; dolu++; } else bos++;
        kutu.appendChild(d);
      }
    });
    kutu.style.color = renk;
    return { kutu: kutu, dolu: dolu, bos: bos };
  }
  function gercek(v) {
    var k = $("g-gercek"); if (!k) return;
    var liste = v.gercek || [];
    if (!liste.length) { k.appendChild(el("p", "bekliyor", tt("Basından bağımsız kayıtlar toplayıcının bir sonraki çalışmasında indirilecek.", "The records independent of the press will be downloaded on the collector’s next run."))); return; }
    var haftalar = v.haftalar;
    liste.forEach(function (t) {
      var ad = EN ? GERCEK_EN[t.anahtar][0] : t.ad, kaynak = EN ? GERCEK_EN[t.anahtar][2] : t.kaynak;
      var f = el("figure", "gk-tur");
      f.appendChild(el("h3", "rp-ara", ad));
      var k1 = Math.max(1, Math.ceil(t.toplam / 700));
      var bb = t.baslik_toplam;
      f.appendChild(el("p", null, tt(
        kaynak + "’ne göre 7 Ekim 2023’ten bu yana " + sayi(t.toplam) + " kayıt. Aynı dönemde Batı ana akım basınında " + BASIN_AD[t.anahtar] + " başlığı: " + sayi(bb.bati_ana) + "; bölge basınında " + sayi(bb.bolge) + "; İsrail basınında " + sayi(bb.israil) + ".",
        "According to the " + kaynak + ", " + sayi(t.toplam) + " records since 7 October 2023. Over the same period, headlines about " + BASIN_AD[t.anahtar] + " in the Western mainstream press: " + sayi(bb.bati_ana) + "; regional press: " + sayi(bb.bolge) + "; Israeli press: " + sayi(bb.israil) + ".")));
      ["bati_ana", "bolge"].forEach(function (g) {
        var s = noktaSeridi(haftalar, t.gercek, t.baslik[g], R[g], k1);
        var sat = el("div", "gk-satir");
        var bas = el("div", "gk-bas"); bas.append(el("b", null, AD[g]), el("span", null, tt(
          s.bos + " / " + (s.dolu + s.bos) + " nokta hiç başlık bulmadı", s.bos + " of " + (s.dolu + s.bos) + " dots found no headline")));
        sat.append(bas, s.kutu); f.appendChild(sat);
      });
      f.appendChild(el("figcaption", null, tt(
        "Her nokta " + (k1 > 1 ? k1 + " kayıt" : "bir kayıt") + " (" + t.birim + "), tarih sırasıyla. Dolu nokta: o hafta grubun bu türden başlık sayısı kadar kayıt “görüldü” sayıldı (bir başlık = bir kayıt). Boş nokta: o hafta kayıt var, başlık yok. Bu, basın lehine cömert bir eşleştirmedir: bir başlık birden çok yapıdan da söz edebilir, ama tek bir kayıt karşılığı sayılır.",
        "Each dot is " + (k1 > 1 ? k1 + " records" : "one record") + " (" + GERCEK_EN[t.anahtar][1] + "), in date order. Filled dot: that week, as many records as the group’s headlines of this kind counted as “seen” (one headline = one record). Hollow dot: records that week with no headline. The matching is generous to the press: one headline may cover several buildings, but counts for one record.")));
      k.appendChild(f);
    });
  }
  function cezaevi(v) {
    var k = $("g-cezaevi"); if (!k) return;
    var t = (v.turler || []).filter(function (x) { return x.anahtar === "iskence"; })[0];
    var b = t ? t.toplam : null;
    k.appendChild(el("p", null, tt(
      "Gözaltında işkence ve cinsel şiddetin tek tek kaydı yok; olaylar kapalı kapılar ardında, her gün yaşanıyor ve ancak tanıklıklar ve otopsilerle ortaya çıkıyor. Bilinen ölçek: İsrailli insan hakları örgütü B’Tselem, Ekim 2023’ten bu yana İsrail gözaltısında ölen 84 Filistinliyi tek tek doğruladı ve gözaltı tesislerini “işkence kampları” diye tanımladı (Ocak 2026). İsrail İnsan Hakları için Hekimler (PHRI) en az 94 ölüm belgeledi; ölüm nedenlerinin başında fiziksel şiddet geliyor (Kasım 2025). Ocak 2026’da yaklaşık 9.200 Filistinli hâlâ gözaltındaydı.",
      "There is no case-by-case record of torture and sexual violence in detention: it happens daily behind closed doors and surfaces only through testimony and autopsies. The known scale: the Israeli human rights group B’Tselem verified, one by one, 84 Palestinians who died in Israeli custody since October 2023 and described the detention facilities as “torture camps” (January 2026). Physicians for Human Rights Israel (PHRI) documented at least 94 deaths, with physical violence a leading cause (November 2025). In January 2026 about 9,200 Palestinians were still detained.")));
    if (b) {
      var r = el("div", "rp-kartlar gk-kartlar");
      ["bati_ana", "bolge", "israil", "turkiye"].forEach(function (g) { var d = el("div", "rp-kart"); d.append(el("b", null, sayi(b[g])), el("span", null, tt(AD[g] + ": üç yılda işkence ve tecavüz başlığı", AD[g] + ": headlines on torture and rape in three years"))); r.appendChild(d); });
      k.appendChild(r);
    }
    var ul = el("ul", "rp-kaynakca");
    [["B’Tselem, “Living Hell” (20 Jan 2026)", "https://www.btselem.org/press_releases/20260120_living_hell"], ["Al Jazeera, PHRI report (17 Nov 2025)", "https://www.aljazeera.com/news/2025/11/17/palestinian-deaths-in-israeli-jails-surge-amid-gaza-war-report"]].forEach(function (x) {
      var li = el("li"); var a = el("a", null, x[0]); a.href = x[1]; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a); ul.appendChild(li);
    });
    k.appendChild(ul);
  }

  // ---------------------------------------------------------------- toplum ne yaptı
  function toplum(v) {
    var k = $("g-toplum"); if (!k) return;
    var t = v.toplum;
    if (!t || !t.olaylar || !t.olaylar.length) { k.appendChild(el("p", "bekliyor", tt("Vikipedi okunma verisi toplayıcının bir sonraki çalışmasında indirilecek.", "Wikipedia readership data will be downloaded on the collector’s next run."))); return; }
    var ol = t.olaylar.filter(function (o) { return o.okunma7 && o.basin7; }).sort(function (a, b) { return a.gun < b.gun ? -1 : 1; });
    if (!ol.length) return;
    // endeks: ilk olay = 100; okur (bütün dillerin toplamı) ve Batı ana akım basın (bin başlıkta)
    function okur(o) { var s = 0; for (var d in o.okunma7) s += o.okunma7[d]; return s; }
    function basin(o, g) { var n = o.basin7_toplam[g]; return n >= 100 ? 1000 * o.basin7[g] / n : null; }
    var r0 = okur(ol[0]) || 1, b0 = basin(ol[0], "bati_ana") || null, g0 = basin(ol[0], "bolge") || null;
    var W = 760, H = 300, P = { s: 44, sg: 16, u: 16, a: 34 };
    var t0 = Date.parse(ol[0].gun), t1 = Date.parse(ol[ol.length - 1].gun) + 20 * 864e5;
    var seri = [["okur", "#1f2421", tt("Okur ilgisi: olay maddesinin ilk hafta okunması (6 dil)", "Reader interest: first-week reads of the event’s article (6 languages)"), function (o) { return 100 * okur(o) / r0; }],
      ["bati_ana", R.bati_ana, tt("Batı ana akım basının tepkisi (bin başlıkta)", "Western mainstream press response (per thousand headlines)"), function (o) { var x = basin(o, "bati_ana"); return x == null || !b0 ? null : 100 * x / b0; }],
      ["bolge", R.bolge, tt("Bölge basınının tepkisi", "Regional press response"), function (o) { var x = basin(o, "bolge"); return x == null || !g0 ? null : 100 * x / g0; }]];
    var hepsi = []; ol.forEach(function (o) { seri.forEach(function (s) { var y = s[3](o); if (y != null) hepsi.push(y); }); });
    var ust = Math.max(150, Math.min(400, Math.ceil(Math.max.apply(null, hepsi) / 50) * 50));
    var X = function (g) { return P.s + (W - P.s - P.sg) * (Date.parse(g) - t0) / (t1 - t0); }, Y = function (y) { return P.u + (H - P.u - P.a) * (1 - Math.min(y, ust) / ust); };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "rp-svg", role: "img", "aria-label": tt("Okur ilgisi ve basın tepkisi, olay olay", "Reader interest and press response, event by event") });
    [0, 50, 100, 150, 200, 300, 400].filter(function (y) { return y <= ust; }).forEach(function (y) {
      s.appendChild(sv("line", { x1: P.s, x2: W - P.sg, y1: Y(y), y2: Y(y), stroke: y === 100 ? "#7f857f" : "#e3dfd3", "stroke-dasharray": y === 100 ? "4 4" : "" }));
      var x = sv("text", { x: P.s - 6, y: Y(y) + 4, "text-anchor": "end", "font-size": 10, fill: "#7f857f" }); x.textContent = y; s.appendChild(x);
    });
    for (var yil = +ol[0].gun.slice(0, 4) + 1; yil <= +ol[ol.length - 1].gun.slice(0, 4); yil++) { var xx = X(yil + "-01-01"); s.appendChild(sv("line", { x1: xx, x2: xx, y1: P.u, y2: H - P.a, stroke: "#e3dfd3" })); var yt = sv("text", { x: xx + 4, y: H - P.a + 16, "font-size": 10, fill: "#7f857f" }); yt.textContent = yil; s.appendChild(yt); }
    seri.forEach(function (sr) {
      var d = ""; ol.forEach(function (o) { var y = sr[3](o); if (y == null) return; d += (d ? "L" : "M") + X(o.gun).toFixed(1) + "," + Y(y).toFixed(1); });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: sr[1], "stroke-width": sr[0] === "okur" ? 3 : 2.2, "stroke-dasharray": sr[0] === "bolge" ? "5 4" : "" }));
      ol.forEach(function (o) {
        var y = sr[3](o); if (y == null) return;
        var c = sv("circle", { cx: X(o.gun), cy: Y(y), r: 4.5, fill: sr[1] });
        var ti = sv("title"); ti.textContent = gunAd(o.gun) + " · " + olayAd(o) + " — " + sr[2] + ": " + sayi(y) + (y > ust ? " (" + tt("ölçek dışı", "off scale") + ")" : ""); c.appendChild(ti); s.appendChild(c);
      });
    });
    var f = el("figure", "rp-sekil"); f.appendChild(s);
    var ef = el("div", "rp-efsane"); seri.forEach(function (sr) { var x = el("span"); var i = el("i"); i.style.background = sr[1]; x.append(i, sr[2]); ef.appendChild(x); }); f.appendChild(ef);
    f.appendChild(el("figcaption", null, tt("İlk olay (" + olayAd(ol[0]) + ") = 100. Okur ilgisi: olay maddesinin olaydan sonraki yedi günde Vikipedi’de kaç kez okunduğu (insan okurlar; İngilizce, Arapça, Türkçe, Almanca, Fransızca, İspanyolca toplamı). Basın tepkisi: aynı yedi günde grubun bin başlığından kaçının bu türden olduğu.",
      "First event (" + olayAd(ol[0]) + ") = 100. Reader interest: how many times the event’s Wikipedia article was read in the seven days after the event (human readers; English, Arabic, Turkish, German, French and Spanish combined). Press response: how many of every thousand headlines in the group were about this kind of event in the same seven days.")));
    k.appendChild(f);
    // tablo
    var kt = el("div", "rp-tablo"); var tb = el("table"); var th = el("thead"); var tr0 = el("tr");
    [tt("Olay", "Event"), tt("Tarih", "Date")].concat(["en", "ar", "tr"].map(function (d) { return DIL_AD[d]; })).concat([AD.bati_ana, AD.bolge]).forEach(function (x) { tr0.appendChild(el("th", null, x)); });
    th.appendChild(tr0); tb.appendChild(th); var bd = el("tbody");
    ol.forEach(function (o) {
      var r = el("tr"); var a = el("td"); a.appendChild(el("b", null, olayAd(o))); a.appendChild(el("small", null, " · " + (TUR_AD[o.tur] || o.tur))); r.appendChild(a); r.appendChild(el("td", "sayi", gunAd(o.gun)));
      ["en", "ar", "tr"].forEach(function (d) { r.appendChild(el("td", "sayi", o.okunma7[d] == null ? "–" : sayi(o.okunma7[d]))); });
      ["bati_ana", "bolge"].forEach(function (g) { var x = basin(o, g); r.appendChild(el("td", "sayi", x == null ? "–" : sayi(x, 1) + "‰")); });
      bd.appendChild(r);
    });
    tb.appendChild(bd); kt.appendChild(tb); k.appendChild(kt);
    k.appendChild(el("p", "rp-not", tt("Dil sütunları: ilk yedi günde okunma. Basın sütunları: bin başlıkta bu türden başlık. Okunma, ilginin bir ölçüsüdür, eylemin değil: sokağa çıkanları, boykotu ya da bağışı ölçmez. Protesto sayıları için ayrı bir veri kaynağı (ACLED) eklenecek.",
      "Language columns: reads in the first seven days. Press columns: headlines of this kind per thousand. Readership measures interest, not action: it does not count people in the streets, boycotts or donations. A separate source for protest counts (ACLED) will be added.")));
    // ay ay: savaşın maddeleri ve basının savaş payı
    var gn = t.genel || [];
    if (gn.length && t.aylar && t.aylar.length > 3) {
      var aylar = t.aylar, toplamDil = {};
      ["en", "ar", "tr"].forEach(function (d) { toplamDil[d] = aylar.map(function (_, i) { return gn.reduce(function (a, m) { return a + ((m.aylik[d] || [])[i] || 0); }, 0); }); });
      var W2 = 760, H2 = 240;
      var s2 = sv("svg", { viewBox: "0 0 " + W2 + " " + H2, class: "rp-svg", role: "img" });
      var X2 = function (i) { return P.s + (W2 - P.s - P.sg) * i / (aylar.length - 1); }, Y2 = function (y) { return P.u + (H2 - P.u - P.a) * (1 - Math.min(y, 100) / 100); };
      [0, 50, 100].forEach(function (y) { s2.appendChild(sv("line", { x1: P.s, x2: W2 - P.sg, y1: Y2(y), y2: Y2(y), stroke: "#e3dfd3" })); var x = sv("text", { x: P.s - 6, y: Y2(y) + 4, "text-anchor": "end", "font-size": 10, fill: "#7f857f" }); x.textContent = y; s2.appendChild(x); });
      var cizgi = function (dizi, renk, kalin, kesik) {
        var en = Math.max.apply(null, dizi.filter(function (x) { return x != null; })) || 1, d = "";
        dizi.forEach(function (x, i) { if (x == null) return; d += (d ? "L" : "M") + X2(i).toFixed(1) + "," + Y2(100 * x / en).toFixed(1); });
        s2.appendChild(sv("path", { d: d, fill: "none", stroke: renk, "stroke-width": kalin, "stroke-dasharray": kesik ? "5 4" : "" }));
      };
      ["en", "ar", "tr"].forEach(function (d) { cizgi(toplamDil[d], DIL_R[d], 2.2); });
      cizgi(t.savas_payi.bati_ana, R.bati_ana, 3, true);
      aylar.forEach(function (a, i) { if (a.slice(5) === "01" || i === 0) { var x = sv("text", { x: X2(i), y: H2 - P.a + 16, "font-size": 10, fill: "#7f857f" }); x.textContent = a.slice(0, 4); s2.appendChild(x); } });
      var f2 = el("figure", "rp-sekil"); f2.appendChild(s2);
      var ef2 = el("div", "rp-efsane");
      ["en", "ar", "tr"].forEach(function (d) { var x = el("span"); var i = el("i"); i.style.background = DIL_R[d]; x.append(i, tt("Vikipedi okunması · ", "Wikipedia reads · ") + DIL_AD[d]); ef2.appendChild(x); });
      var x3 = el("span"); var i3 = el("i"); i3.style.background = R.bati_ana; x3.append(i3, tt("Batı ana akımda savaş payı", "War share in the Western mainstream")); ef2.appendChild(x3);
      f2.appendChild(ef2);
      f2.appendChild(el("figcaption", null, tt("Ay ay, her çizgi kendi en yüksek ayına göre (en yüksek ay = 100). Okunma: savaşı, soykırımı ve insani krizi anlatan maddelerin toplamı.", "Month by month, each line relative to its own highest month (= 100). Reads: the articles on the war, the genocide and the humanitarian crisis combined.")));
      k.appendChild(el("h3", "rp-ara", tt("Ay ay: okurlar ve basın birlikte mi uzaklaştı?", "Month by month: did readers and the press drift away together?")));
      k.appendChild(f2);
    }
  }
})();
