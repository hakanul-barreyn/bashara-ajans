// Kimin ölümü haber oldu: data/bulten/kimin.json
(function () {
  "use strict";
  var EN = window.DIL === "en";
  function tt(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var AYTAM = EN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  function yz(n, d) { return n == null ? "–" : EN ? sayi(n, d) + "%" : "%" + sayi(n, d); }
  function gunAd(g) { return EN ? +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4) : +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ayAd(m) { return AYTAM[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  var AD = EN ? { bolge: "Regional press", turkiye: "Turkish press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" }
    : { bolge: "Bölge basını", turkiye: "Türkiye basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var R = { bolge: "#1f7a52", turkiye: "#7a3fa0", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var ISR = "#2f5bb7", FIL = "#1f7a52", REH = "#c39a35";
  function efsane(kap, xs) { var e = el("div", "rp-efsane"); xs.forEach(function (x) { var s = el("span"); var i = el("i"); i.style.background = x[0]; s.append(i, x[1]); e.appendChild(s); }); kap.appendChild(e); }

  fetch("data/bulten/kimin.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-kunye"); if (m) m.after(el("p", "bekliyor", tt("Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.", "Report data is not ready yet; it will be written on the collector’s next run."))); });

  var V;
  function ciz(v) {
    V = v;
    var b = v.oran.bati_ana, t = v.oran.turkiye, bo = v.oran.bolge;
    var ek = v.ateskes[v.ateskes.length - 1], once = ek.once, sir = ek.sirasinda;
    var deger = {
      donem: gunAd(v.donem[0]) + " – " + gunAd(v.donem[1]),
      guncel: tt("Güncellendi: ", "Updated: ") + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }),
      taslak: v.tarama_bitti ? "" : tt("Tarama sürüyor; sayılar kesinleşmedi", "Backfill in progress; figures are provisional"),
      manset: "",
      oran_metin: EN
        ? "Between 7 October 2023 and the October 2025 ceasefire, at least " + sayi(v.israil_olu, 0) + " Israelis and " + sayi(v.filistin_olu, 0) + " Palestinians in Gaza were killed. Western mainstream press ran " + sayi(b.israilli_baslik, 0) + " headlines about Israeli deaths and " + sayi(b.filistinli_baslik, 0) + " about Palestinian deaths. Per person killed, that is " + sayi(100 * b.israilli_olu_basina, 1) + " headlines for every hundred Israelis and " + sayi(100 * b.filistinli_olu_basina, 1) + " for every hundred Palestinians: an Israeli death was worth " + sayi(b.kat, 1) + " Palestinian deaths. The regional press, too, wrote more per Israeli death (" + sayi(bo.kat, 1) + " times); in the Turkish press the gap is " + sayi(t.kat, 1) + " times, largely because of the many short reports of Israeli soldiers killed."
        : "7 Ekim 2023 ile Ekim 2025 ateşkesi arasında en az " + sayi(v.israil_olu, 0) + " İsrailli ve Gazze’de " + sayi(v.filistin_olu, 0) + " Filistinli öldürüldü. Batı ana akım basını İsraillilerin ölümünü " + sayi(b.israilli_baslik, 0) + ", Filistinlilerin ölümünü " + sayi(b.filistinli_baslik, 0) + " başlıkla verdi. Öldürülen kişi başına bakınca: her yüz İsrailli için " + sayi(100 * b.israilli_olu_basina, 1) + ", her yüz Filistinli için " + sayi(100 * b.filistinli_olu_basina, 1) + " başlık. Yani bir İsraillinin ölümü " + sayi(b.kat, 1) + " Filistinlinin ölümü kadar haber oldu. Bölge basını da İsrailli ölüme kişi başına daha çok başlık attı (" + sayi(bo.kat, 1) + " kat); Türkiye basınında fark " + sayi(t.kat, 1) + " kat, çünkü “X İsrail askeri öldü” türünden kısa haberler çok.",
      oran_alt: tt("Her yüz ölüm için atılan başlık: mavi İsrailli ölümler, yeşil Filistinli ölümler. İsrail basını (örneklem çok küçük) yalnızca tabloda; Batı’daki muhalif basında İsrailli ölüm başlığı ölçülemeyecek kadar az.", "Headlines per hundred deaths: blue for Israeli deaths, green for Palestinian deaths. The Israeli press (very small sample) is only in the table; the Western dissenting press ran too few Israeli-death headlines to measure."),
      rehine_metin: EN
        ? "On 7 October 251 people were taken hostage. Between then and the October 2025 ceasefire, Western mainstream press ran " + sayi(b.rehine_baslik, 0) + " headlines about hostages and " + sayi(b.filistinli_baslik, 0) + " about the deaths of " + sayi(v.filistin_olu, 0) + " Palestinians: almost as many headlines for 251 people as for tens of thousands of dead. The hostages had names; the Palestinian dead mostly appeared as numbers."
        : "7 Ekim’de 251 kişi rehin alındı. O günden Ekim 2025 ateşkesine kadar Batı ana akım basını rehineler için " + sayi(b.rehine_baslik, 0) + ", " + sayi(v.filistin_olu, 0) + " Filistinlinin ölümü için " + sayi(b.filistinli_baslik, 0) + " başlık attı: 251 kişi için neredeyse on binlerce ölü kadar başlık. Rehinelerin adları vardı; Filistinli ölüler çoğunlukla bir sayı olarak geçti.",
      rehine_alt: tt("Batı ana akım basını, ay ay: rehine başlıkları (sarı) ve Filistinlilerin ölümünü anlatan başlıklar (yeşil). ", "Western mainstream press, month by month: hostage headlines (yellow) and headlines about Palestinian deaths (green)."),
      bebek_metin: bebekMetin(v),
      ateskes_metin: EN
        ? "After the ceasefire of 10 October 2025 the Gaza Ministry of Health still reported an average of " + sayi(sir.olu_hafta, 0) + " deaths a week (before it: " + sayi(once.olu_hafta, 0) + "; the figure includes bodies recovered from the rubble). The war’s share of Western mainstream headlines fell from " + yz(once.gruplar.bati_ana.savas_pay, 0) + " to " + yz(sir.gruplar.bati_ana.savas_pay, 0) + "; in the Turkish press from " + yz(once.gruplar.turkiye.savas_pay, 0) + " to " + yz(sir.gruplar.turkiye.savas_pay, 0) + ". The word “ceasefire” did not stop the dying; it stopped the headlines."
        : "10 Ekim 2025 ateşkesinden sonra Gazze Sağlık Bakanlığı haftada ortalama " + sayi(sir.olu_hafta, 0) + " ölüm bildirmeye devam etti (öncesinde " + sayi(once.olu_hafta, 0) + "; sayıya enkaz altından çıkarılan cesetler de dahil). Savaşın Batı ana akım başlıklarındaki payı " + yz(once.gruplar.bati_ana.savas_pay, 0) + " düzeyinden " + yz(sir.gruplar.bati_ana.savas_pay, 0) + " düzeyine, Türkiye basınında " + yz(once.gruplar.turkiye.savas_pay, 0) + " düzeyinden " + yz(sir.gruplar.turkiye.savas_pay, 0) + " düzeyine indi. “Ateşkes” kelimesi ölümleri durdurmadı; başlıkları durdurdu.",
      ateskes_alt: tt("2025 başından bu yana hafta hafta savaşın başlıklardaki payı . Kesikli çizgiler ateşkeslerin başladığı günler.", "Weekly share of the war in headlines since the start of 2025 . Dashed lines: the days the ceasefires began.")
    };
    deger.manset = EN
      ? "In Western mainstream press, one Israeli death was worth " + sayi(b.kat, 1) + " Palestinian deaths. 251 hostages got almost as many headlines as " + sayi(v.filistin_olu, 0) + " Palestinians killed."
      : "Batı ana akım basınında bir İsraillinin ölümü " + sayi(b.kat, 1) + " Filistinlinin ölümü kadar haber oldu. 251 rehine, öldürülen " + sayi(v.filistin_olu, 0) + " Filistinliyle neredeyse aynı sayıda başlık buldu.";
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });
    var k = $("kartlar");
    var kart = function (bb, s) { var d = el("div", "rp-kart"); d.append(el("b", null, bb), el("span", null, s)); k.appendChild(d); };
    kart(sayi(b.kat, 1) + "×", tt("Batı ana akım basınında bir İsraillinin ölümü, kaç Filistinlinin ölümü kadar başlık buldu", "how many Palestinian deaths one Israeli death was worth in Western mainstream headlines"));
    kart(sayi(b.rehine_baslik, 0) + " / " + sayi(b.filistinli_baslik, 0), tt("Batı ana akımında 251 rehine için başlık / " + sayi(v.filistin_olu, 0) + " Filistinli ölü için başlık", "Western mainstream headlines on 251 hostages / on " + sayi(v.filistin_olu, 0) + " Palestinian dead"));
    kart(yz(once.gruplar.bati_ana.savas_pay, 0) + " → " + yz(sir.gruplar.bati_ana.savas_pay, 0), tt("Ekim 2025 ateşkesinden önce ve sonra Batı ana akım başlıklarında savaşın payı", "share of the war in Western mainstream headlines before and after the October 2025 ceasefire"));
    kart(sayi(sir.olu_hafta, 0), tt("ateşkesten sonra Gazze’de haftada bildirilen ortalama ölüm", "average deaths reported in Gaza per week after the ceasefire"));
    [oranGrafik, oranTablo, rehineGrafik, adTablo, isimCubugu, ateskesGrafik, ateskesTablo, yontem].forEach(function (f) { try { f(v); } catch (er) { if (window.console) console.error("kimin", er); } });
  }

  function bebekMetin(v) {
    var kf = (v.rehineler.filter(function (r) { return r.anahtar === "kfir"; })[0] || {}).gruplar, bb = (v.rehineler.filter(function (r) { return r.anahtar === "bibas"; })[0] || {}).gruplar;
    if (!v.bebek || !bb) return "";
    return EN
      ? "The Bibas family (Shiri and her children Ariel and Kfir, who was nine months old when taken) appeared by name in " + sayi(bb.bati_ana, 0) + " Western mainstream headlines. The Gaza Ministry of Health’s list of identified dead includes " + sayi(v.bebek, 0) + " babies who were killed before their first birthday and " + sayi(v.cocuk, 0) + " children. Their names are on our Names page."
      : "Bibas ailesi (Shiri ve rehin alındığında dokuz aylık olan Kfir ile Ariel) Batı ana akım basınında " + sayi(bb.bati_ana, 0) + " başlıkta adıyla geçti. Gazze Sağlık Bakanlığı’nın kimliği belirlenmiş ölüler listesinde bir yaşını doldurmadan öldürülen " + sayi(v.bebek, 0) + " bebek ve toplam " + sayi(v.cocuk, 0) + " çocuk var. Onların adları İsimler sayfamızda.";
  }

  function oranGrafik(v) {
    var k = $("g-oran"); efsane(k, [[ISR, tt("İsrailli ölüm", "Israeli deaths")], [FIL, tt("Filistinli ölüm", "Palestinian deaths")]]);
    var gs = ["bati_ana", "turkiye", "bolge"].filter(function (g) { return v.oran[g] && v.oran[g].kat != null; });
    var en = Math.max.apply(0, gs.map(function (g) { return Math.max(v.oran[g].israilli_olu_basina, v.oran[g].filistinli_olu_basina); })) * 100 || 1;
    gs.forEach(function (g) {
      var o = v.oran[g], r = el("div", "rp-hedef-satir"); r.appendChild(el("span", "rp-yigin-ad", AD[g] + " · " + sayi(o.kat, 1) + "×"));
      var c = el("div", "rp-terim-cubuklar");
      [[o.israilli_olu_basina, ISR, tt("İsrailli", "Israeli")], [o.filistinli_olu_basina, FIL, tt("Filistinli", "Palestinian")]].forEach(function (x) {
        var d = el("div", "rp-cubuk"), i = el("i"), w = el("div"); i.style.width = Math.max(0.6, 100 * 100 * x[0] / en) + "%"; i.style.background = x[1];
        i.title = x[2] + ": " + sayi(100 * x[0], 1) + tt(" başlık / 100 ölüm", " headlines / 100 deaths");
        w.appendChild(i); d.append(w, el("span", null, sayi(100 * x[0], 1))); c.appendChild(d);
      });
      r.appendChild(c); k.appendChild(r);
    });
  }
  function oranTablo(v) {
    var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>Group</th><th>Israeli-death headlines</th><th>per 100 Israelis killed</th><th>Palestinian-death headlines</th><th>per 100 Palestinians killed</th><th>Ratio</th><th>Hostage headlines</th></tr></thead>"
      : "<thead><tr><th>Grup</th><th>İsrailli ölüm başlığı</th><th>100 İsrailli ölüm başına</th><th>Filistinli ölüm başlığı</th><th>100 Filistinli ölüm başına</th><th>Oran</th><th>Rehine başlığı</th></tr></thead>";
    var bd = el("tbody");
    ["bati_ana", "bati_muhalif", "bolge", "turkiye", "israil"].forEach(function (g) {
      var o = v.oran[g]; if (!o) return; var r = el("tr");
      r.append(el("td", null, AD[g]), el("td", "sayi", sayi(o.israilli_baslik, 0)), el("td", "sayi", sayi(100 * o.israilli_olu_basina, 1)), el("td", "sayi", sayi(o.filistinli_baslik, 0)), el("td", "sayi", sayi(100 * o.filistinli_olu_basina, 1)), el("td", "sayi", o.kat == null ? "–" : sayi(o.kat, 1) + "×"), el("td", "sayi", sayi(o.rehine_baslik, 0)));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-oran-tablo").appendChild(kt);
  }

  // basit çizgi + çubuk grafik
  function cizgi(kap, et, seriler, cubuk, isaret, etiket) {
    var W = 760, H = 280, P = { l: 40, r: 12, t: 12, b: 26 }, n = et.length;
    var x = function (i) { return P.l + (W - P.l - P.r) * (i + 0.5) / n; };
    var enY = Math.max.apply(0, seriler.map(function (s) { return Math.max.apply(0, s.v.map(function (z) { return z || 0; })); })) || 1;
    var y = function (z) { return P.t + (H - P.t - P.b) * (1 - z / enY); };
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": etiket });
    if (cubuk) { var enC = Math.max.apply(0, cubuk) || 1, bw = (W - P.l - P.r) / n; cubuk.forEach(function (c, i) { if (!c) return; var hh = (H - P.t - P.b) * 0.9 * c / enC; s.appendChild(baslik(sv("rect", { x: x(i) - bw * 0.4, y: H - P.b - hh, width: bw * 0.8, height: hh, "class": "rp-olu" }), et[i] + ": " + sayi(c, 0) + tt(" ölüm", " deaths"))); }); }
    [0, 0.5, 1].forEach(function (f) { s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(enY * f), y2: y(enY * f), "class": "rp-izgara" })); var t = sv("text", { x: P.l - 5, y: y(enY * f) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = sayi(enY * f, 0); s.appendChild(t); });
    var yil = ""; et.forEach(function (m, i) { if (m.slice(0, 4) !== yil) { yil = m.slice(0, 4); var t = sv("text", { x: x(i), y: H - 7, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = yil; s.appendChild(t); } });
    (isaret || []).forEach(function (o) { var i = et.findIndex(function (m) { return m >= o.gun.slice(0, m.length); }); if (i < 0) return; s.appendChild(baslik(sv("line", { x1: x(i), x2: x(i), y1: P.t, y2: H - P.b, stroke: "#c9302c", "stroke-dasharray": "4 3", "stroke-width": 1.4 }), o.ad)); });
    seriler.forEach(function (sr) {
      var d = "", yeni = true; sr.v.forEach(function (z, i) { if (z == null) { yeni = true; return; } d += (yeni ? "M" : "L") + x(i).toFixed(1) + "," + y(z).toFixed(1); yeni = false; });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: sr.renk, "stroke-width": sr.kalin || 2, "stroke-linejoin": "round" }));
      sr.v.forEach(function (z, i) { if (z != null) s.appendChild(baslik(sv("circle", { cx: x(i), cy: y(z), r: 5, fill: "transparent" }), et[i] + " · " + sr.ad + ": " + sayi(z, 1))); });
    });
    kap.appendChild(s);
  }
  function rehineGrafik(v) {
    var k = $("g-rehine"), A = v.aylik.filter(function (a) { return a.ay <= v.donem[1].slice(0, 7); });
    efsane(k, [[REH, tt("rehine başlıkları", "hostage headlines")], [FIL, tt("Filistinli ölüm başlıkları", "Palestinian-death headlines")]]);
    cizgi(k, A.map(function (a) { return a.ay; }), [{ v: A.map(function (a) { return a.bati_ana.r; }), renk: REH, ad: tt("rehine", "hostages"), kalin: 2.4 }, { v: A.map(function (a) { return a.bati_ana.fo; }), renk: FIL, ad: tt("Filistinli ölüm", "Palestinian deaths"), kalin: 2.4 }], null, null, tt("Rehine ve Filistinli ölüm başlıkları", "Hostage and Palestinian-death headlines"));
  }
  function adTablo(v) {
    var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>Hostage</th><th>All headlines</th><th>Western mainstream</th><th>Regional</th><th>Turkish</th><th>Israeli</th></tr></thead>"
      : "<thead><tr><th>Rehine</th><th>Bütün başlıklar</th><th>Batı ana akım</th><th>Bölge</th><th>Türkiye</th><th>İsrail</th></tr></thead>";
    var bd = el("tbody");
    v.rehineler.filter(function (r) { return r.anahtar !== "kfir"; }).slice(0, 15).forEach(function (r) {
      var tr = el("tr"); var ad = EN ? r.ad.replace(" ailesi", " family").replace(/ ve /g, " and ") : r.ad;
      tr.append(el("td", null, ad), el("td", "sayi", sayi(r.toplam, 0)), el("td", "sayi", sayi(r.gruplar.bati_ana, 0)), el("td", "sayi", sayi(r.gruplar.bolge, 0)), el("td", "sayi", sayi(r.gruplar.turkiye, 0)), el("td", "sayi", sayi(r.gruplar.israil, 0)));
      bd.appendChild(tr);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-adlar").appendChild(kt);
    $("g-adlar").appendChild(el("p", "rp-not", tt("Adlar Latin harfleriyle ve bazıları Arapça yazılışlarıyla arandı; Arapça ve İbranice yayınlardaki sayılar bu yüzden eksik olabilir. Filistinli ölülerin adlarını aynı yöntemle sayan bölüm ayrıca eklenecek.", "Names were searched in Latin script and some in Arabic; counts for Arabic- and Hebrew-language outlets may therefore be low. A section counting the names of Palestinian dead the same way will be added separately.")));
  }
  // ölüm sayıları istatistik olarak değil, isimlerden oluşan çubuklar olarak
  function isimCubugu() {
    var kap = $("g-isim-cubuk");
    fetch("data/isimler/dizin.json").then(function (r) { return r.json(); }).then(function (d) {
      var G = [[0, 0, tt("Bir yaşını doldurmadan", "Under one year old")], [1, 4, tt("1–4 yaş", "Aged 1–4")], [5, 9, tt("5–9 yaş", "Aged 5–9")], [10, 14, tt("10–14 yaş", "Aged 10–14")], [15, 17, tt("15–17 yaş", "Aged 15–17")],
        [18, 29, tt("18–29 yaş", "Aged 18–29")], [30, 44, tt("30–44 yaş", "Aged 30–44")], [45, 59, tt("45–59 yaş", "Aged 45–59")], [60, 200, tt("60 yaş ve üstü", "Aged 60 and over")]];
      var ys = {}; d.yaslar.forEach(function (y) { ys[y.yas] = y; });
      var gs = G.map(function (g) { var n = 0, yaslar = []; for (var y = g[0]; y <= g[1]; y++) if (ys[y]) { n += ys[y].n; yaslar.push(y); } return { ad: g[2], n: n, yaslar: yaslar, bas: g[0] }; }).filter(function (g) { return g.n; });
      var en = Math.max.apply(0, gs.map(function (g) { return g.n; }));
      var ozet = el("p", "rp-not", tt("Toplam " + sayi(d.toplam, 0) + " kişi, " + sayi(d.cocuk, 0) + " çocuk.", "In all " + sayi(d.toplam, 0) + " people, " + sayi(d.cocuk, 0) + " children."));
      gs.forEach(function (g) {
        var s = el("div", "isim-satir");
        var b = el("div", "isim-bas"); b.append(el("b", null, g.ad), el("span", null, sayi(g.n, 0) + tt(" kişi", " people"))); s.appendChild(b);
        var c = el("a", "isim-cubuk" + (g.bas < 18 ? " cocuk" : "")); c.href = "isimler.html#yas-" + g.yaslar[0]; c.style.width = Math.max(3, 100 * g.n / en) + "%";
        c.title = g.ad + ": " + sayi(g.n, 0) + tt(" kişi. Tam liste için tıklayın.", " people. Click for the full list.");
        s.appendChild(c); kap.appendChild(s);
        // kutuyu dolduracak kadar isim: yaşları sırayla yükle, ~600 isimde dur
        var adet = 0, sira = g.yaslar.slice();
        (function sonraki() {
          if (!sira.length || adet > 600) return;
          fetch("data/isimler/yas-" + sira.shift() + ".json").then(function (r) { return r.json(); }).then(function (l) {
            var parca = document.createDocumentFragment();
            // liste ada göre sıralı geliyor; karıştır ki çubuk tek bir adla dolmasın (her açılışta aynı sıra)
            var t = 7 + l.length; l = l.slice().sort(function () { t = (t * 9301 + 49297) % 233280; return t / 233280 - 0.5; });
            l.slice(0, 600 - adet).forEach(function (k) { var a = k[0] || k[1]; if (!a) return; parca.appendChild(el("span", null, a)); adet++; });
            c.appendChild(parca); sonraki();
          }).catch(function () {});
        })();
      });
      kap.appendChild(ozet);
    }).catch(function () { kap.appendChild(el("p", "rp-not", tt("İsim listesi henüz yüklenmedi.", "The list of names is not loaded yet."))); });
  }
  function ateskesGrafik(v) {
    var k = $("g-ateskes"), H = v.haftalik;
    efsane(k, [[R.bati_ana, AD.bati_ana], [R.turkiye, AD.turkiye], [R.bolge, AD.bolge]]);
    cizgi(k, H.map(function (h) { return h.hafta; }), ["bati_ana", "turkiye", "bolge"].map(function (g) { return { v: H.map(function (h) { return h[g].savas_pay; }), renk: R[g], ad: AD[g] + tt(" · savaş payı %", " · war share %"), kalin: g === "bati_ana" ? 2.6 : 1.6 }; }),
      null, v.ateskes.map(function (a) { return { gun: a.sirasinda.bas, ad: (EN ? a.ad.replace("Ocak 2025 ateşkesi", "January 2025 ceasefire").replace("Ekim 2025 ateşkesi", "October 2025 ceasefire") : a.ad) }; }), tt("Ateşkesler ve savaş payı", "Ceasefires and the war share"));
  }
  function ateskesTablo(v) {
    var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>Ceasefire</th><th>Deaths per week<br><small>8 weeks before → during</small></th><th>Western mainstream · war share</th><th>Turkish press · war share</th><th>Regional press · war share</th></tr></thead>"
      : "<thead><tr><th>Ateşkes</th><th>Haftalık ölüm<br><small>önceki 8 hafta → sırasında</small></th><th>Batı ana akım · savaş payı</th><th>Türkiye basını · savaş payı</th><th>Bölge basını · savaş payı</th></tr></thead>";
    var bd = el("tbody");
    v.ateskes.forEach(function (a) {
      var r = el("tr"), ad = EN ? a.ad.replace("Ocak 2025 ateşkesi", "January 2025").replace("Ekim 2025 ateşkesi", "October 2025") : a.ad;
      r.append(el("td", null, ad + " (" + gunAd(a.sirasinda.bas) + (a.sirasinda.son && a.ad.indexOf("Ocak") === 0 ? " – " + gunAd(a.sirasinda.son) : "") + ")"), el("td", "sayi", sayi(a.once.olu_hafta, 0) + " → " + sayi(a.sirasinda.olu_hafta, 0)));
      ["bati_ana", "turkiye", "bolge"].forEach(function (g) { var td = el("td", "sayi", yz(a.once.gruplar[g].savas_pay, 0) + " → " + yz(a.sirasinda.gruplar[g].savas_pay, 0)); if (a.sirasinda.gruplar[g].savas_pay < a.once.gruplar[g].savas_pay * 0.75) td.classList.add("dusus"); r.appendChild(td); });
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-ateskes-tablo").appendChild(kt);
  }
  function yontem(v) {
    var u = $("g-yontem");
    (EN ? [
      "Headlines: collected by the backfill (sitemaps, RSS archives, the Internet Archive); only those mentioning Palestine, Israel, Gaza or Lebanon. No AI was used.",
      "Israeli-death headline: a verb of killing or dying with an Israeli as the victim (“Israeli soldier killed”, “Hamas killed Israelis”, “X İsrail askeri öldü”). The order of words decides: “Israeli soldiers killed three Palestinians” counts as a Palestinian death. Palestinian-death headline: a death in Gaza or Palestine that is not an Israeli death, including the language of martyrdom. Hostage headline: the word hostage in any of nine languages.",
      "Deaths: Palestinians from the Gaza Ministry of Health’s daily figures (Tech for Palestine, public domain), Gaza only; headlines about the West Bank are included, so the Palestinian side is slightly overstated. Israelis: at least " + sayi(v.israil_olu, 0) + " (1,152 security personnel, Israeli Defence Ministry, October 2025; 822 civilians, National Insurance Institute, May 2024). The true figure is somewhat higher; at 2,100 Israeli deaths the Western mainstream ratio would be " + sayi(v.oran.bati_ana.kat * v.israil_olu / 2100, 1) + "×.",
      "Ceasefire: the October 2025 period runs to today. The Ministry’s figures after the ceasefire include bodies recovered from the rubble, so they mix new killings with older deaths.",
      "Patterns can misread single headlines; across hundreds of thousands they show the trend. Sources: " + v.israil_kaynak.map(function (k) { return k.url; }).join(" · ")
    ] : [
      "Başlıklar: geriye dönük taramanın topladıkları (site haritaları, RSS arşivleri, İnternet Arşivi); yalnızca Filistin, İsrail, Gazze ya da Lübnan geçenler. Yapay zekâ kullanılmadı.",
      "İsrailli ölüm başlığı: ölen kişinin İsrailli olduğu bir öldürme ya da ölme fiili (“İsrail askeri öldü”, “Hamas İsraillileri öldürdü”). Kelime sırası belirleyicidir: “İsrail askerleri üç Filistinliyi öldürdü” Filistinli ölüm sayılır. Filistinli ölüm başlığı: Gazze’de ya da Filistin’de, İsrailli ölüm olmayan her ölüm başlığı, şehadet dili dahil. Rehine başlığı: dokuz dilde rehine kelimesi.",
      "Ölümler: Filistinliler Gazze Sağlık Bakanlığı’nın günlük verisinden (Tech for Palestine, kamu malı), yalnızca Gazze; Batı Şeria başlıkları dahil olduğu için Filistin tarafı biraz fazla görünür. İsrailliler: en az " + sayi(v.israil_olu, 0) + " (1.152 güvenlik personeli, İsrail Savunma Bakanlığı, Ekim 2025; 822 sivil, Ulusal Sigorta Kurumu, Mayıs 2024). Gerçek sayı biraz daha yüksek; 2.100 İsrailli ölü alınsa Batı ana akım oranı " + sayi(v.oran.bati_ana.kat * v.israil_olu / 2100, 1) + " kat olur.",
      "Ateşkes: Ekim 2025 dönemi bugüne kadar sürüyor. Bakanlığın ateşkes sonrası sayılarına enkaz altından çıkarılan cesetler de dahil; yani yeni öldürülenlerle eski ölümler karışık.",
      "Kalıplar tek tek başlıkları yanlış okuyabilir; yüz binlerce başlıkta eğilimi gösterir. Kaynaklar: " + v.israil_kaynak.map(function (k) { return k.url; }).join(" · ")
    ]).forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
