// Alışma raporu: data/bulten/alisma.json — olay kataloğu, tepki endeksi, izleme oranı, kitlesel ölüm günleri.
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var EN = window.DIL === "en";
  function tt(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  var TUR_EN = { hastane: "Attacks on hospitals", cadir: "Tents hit", yardim: "Fire on people waiting for aid and food", keskin: "Sniper fire", bas: "Shot in the head", cocuk: "Children killed", su: "People seeking water shot", guvenli: "Attacks on “safe zones”", okul: "Attacks on schools and shelters", ibadet: "Attacks on mosques and churches", aksa: "Raids on Al-Aqsa", saglik: "Health workers killed", yardimci: "Aid workers killed", iskence: "Torture and rape in prisons", asagilama: "Humiliation", aclik: "Starvation deaths", kitlik: "Famine and hunger", mezar: "Mass graves", bayrak: "Fire on people carrying white flags", katliam: "Attacks called “massacres”", cocuk_keskin: "Children shot by snipers", cocuk_bas: "Children shot in the head", cocuk_su: "Children carrying water shot", yardim_asagilama: "Humiliation for food" };
  var YER_EN = { "Şifa Hastanesi": "Al-Shifa Hospital", "Ehli Baptist Hastanesi": "Al-Ahli Baptist Hospital", "Nasır Hastanesi": "Nasser Hospital", "Kemal Advan Hastanesi": "Kamal Adwan Hospital", "Endonezya Hastanesi": "Indonesian Hospital", "Avde Hastanesi": "Al-Awda Hospital", "Avrupa Hastanesi": "European Gaza Hospital", "Kudüs Hastanesi": "Al-Quds Hospital", "Rantisi Hastanesi": "Al-Rantisi Hospital", "Mevasi": "Al-Mawasi", "Refah": "Rafah", "Han Yunus": "Khan Younis", "Deyr el-Belah": "Deir al-Balah", "Nusayrat": "Nuseirat", "Bureyc": "Bureij", "Mağazi": "Maghazi", "Cibaliye": "Jabalia", "Beyt Lahiya": "Beit Lahia", "Beyt Hanun": "Beit Hanoun", "Şucaiyye": "Shujaiya", "Zeytun": "Zeitoun", "Şati Kampı": "Shati camp", "Tel es-Sultan": "Tal al-Sultan", "Nablusi Kavşağı": "Nabulsi roundabout", "Kuveyt Kavşağı": "Kuwait roundabout", "Ofer Hapishanesi": "Ofer prison", "Cenin": "Jenin", "Tulkerim": "Tulkarm", "El Halil": "Hebron", "Gazze": "Gaza" };
  function turAd(t) { return EN ? (TUR_EN[t.anahtar] || t.ad) : t.ad; }
  var R = { bolge: "#1f7a52", turkiye: "#7a3fa0", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = EN ? { bolge: "Regional press", turkiye: "Turkish press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" } : { bolge: "Bölge basını", turkiye: "Türkiye basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var AYTAM = EN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var LG = EN ? { "Türkiye": "Turkish", "ABD": "US", "Avrupa": "European", "Arap ülkeleri": "Arab", "İran": "Iranian", "Çin": "Chinese", "Rusya": "Russian", "BM": "UN" } : { "Türkiye": "Türkiye", "ABD": "ABD", "Avrupa": "Avrupa", "Arap ülkeleri": "Arap", "İran": "İran", "Çin": "Çin", "Rusya": "Rusya", "BM": "BM" };
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ayAd(g) { return AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function gunNo(g) { return Date.parse(g + "T00:00:00Z") / 864e5; }
  function yerAd(x) { var y = x.yer && x.yer.length ? x.yer[0] : "Gazze"; return EN ? (YER_EN[y] || y) : y; }
  function yz(n, d) { return EN ? sayi(n, d) + "%" : "%" + sayi(n, d); }
  function efsane(gr, kap, ek) {
    var e = el("div", "rp-efsane");
    gr.forEach(function (g) { var s = el("span"); var i = el("i"); i.style.background = R[g]; s.append(i, AD[g]); e.appendChild(s); });
    (ek || []).forEach(function (x) { var s = el("span"); var i = el("i"); i.style.background = x[0]; s.append(i, x[1]); e.appendChild(s); });
    kap.appendChild(e);
  }

  fetch("data/bulten/alisma.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", tt("Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.", "Report data is not ready yet; it will be written on the collector’s next run."))); });

  var V, T = {};
  function ciz(v) {
    if (EN) v.egri.forEach(function (c) { c.donem = c.donem.replace("Ç", "Q"); });
    V = v; v.turler.forEach(function (t) { T[t.anahtar] = t; });
    var h = T.hastane, hs = v.olaylar.filter(function (x) { return x.tur === "hastane"; });
    var son = h && h.son_tepki && h.son_tepki.bati_ana;
    var e = v.egri.filter(function (c) { return c.bati_ana != null; });
    var tamCeyrek = e.filter(function (c) { return c.olay >= 10; });
    var ilk = tamCeyrek[0], sonC = tamCeyrek[tamCeyrek.length - 1];
    var og = v.olum_gunleri, artmayan = og.filter(function (x) { return x.bati_ana.gazze_pay != null && x.bati_ana.once != null && x.bati_ana.gazze_pay <= x.bati_ana.once; });
    var deger = {
      donem: ayAd(v.bas) + " – " + ayAd(v.son),
      guncel: tt("Güncellendi: ", "Updated: ") + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }),
      taslak: v.tarama_bitti ? "" : tt("Tarama sürüyor; sayılar kesinleşmedi", "Backfill in progress; figures are provisional"),
      hastane_ref: h && h.referans ? yerAd(h.referans) + " (" + gunAd(h.referans.gun) + ")" : tt("ilk büyük olay", "the first major event"),
      hastane_metin: hastaneMetin(h, hs),
      egri_metin: egriMetin(e),
      olum_metin: og.length ? tt("Gazze Sağlık Bakanlığı’nın bir günde 300 ya da daha fazla yeni ölüm bildirdiği " + og.length + " gün var. Bu günlerin " + artmayan.length + " tanesinde Batı ana akım basınında Filistin savaşının payı, önceki iki haftaya göre artmadı. Tablo her gün için savaş payını (o gün ve sonraki iki gün) ve önceki iki haftayı, liderlerin adının geçtiği başlıkların kaç kat arttığını gösteriyor.", "There are " + og.length + " days on which the Gaza Ministry of Health reported 300 or more new deaths. On " + artmayan.length + " of them the Palestine war’s share in Western mainstream press did not rise compared with the previous two weeks. For each day the table shows the war share (that day and the next two) against the previous two weeks, and how many times more often leaders’ names appeared in headlines.") : ""
    };
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });
    var k = $("kartlar");
    var kart = function (b, s) { var d = el("div", "rp-kart"); d.append(el("b", null, b), el("span", null, s)); k.appendChild(d); };
    kart(sayi(v.olaylar.length, 0), tt(v.turler.filter(function (t) { return t.olay_sayisi; }).length + " türde, başlıklardan bulunan olay", "events found in the headlines, across " + v.turler.filter(function (t) { return t.olay_sayisi; }).length + " types"));
    if (son) kart(gunAd(son.gun), tt("Batı ana akım basınının bir hastane saldırısına El-Ehli’nin en az yarısı kadar yer ayırdığı son olay (", "the last hospital attack to which Western mainstream press gave at least half the attention it gave Al-Ahli (") + yerAd(son) + ")");
    if (ilk && sonC) kart(yz(ilk.bati_ana * 100, 0) + " → " + yz(sonC.bati_ana * 100, 0), tt("Batı ana akım basınının olaylara, bölge basınına göre ayırdığı yer (", "the space Western mainstream press gave events, relative to the regional press (") + ilk.donem + " → " + sonC.donem + ")");
    if (og.length) kart(artmayan.length + " / " + og.length, tt("300’den fazla ölümün bildirildiği günlerde Batı ana akım basınında savaş payının artmadığı gün", "days with 300+ reported deaths on which the war’s share in Western mainstream press did not rise"));
    [hastaneGrafik, turTablo, kucukler, egriGrafik, olumTablo, katalog, yontem].forEach(function (f) { try { f(v); } catch (er) { if (window.console) console.error("alisma", er); } });
  }

  function egriMetin(e) {
    var t = e.filter(function (c) { return c.olay >= 10; }); if (t.length < 2) return "";
    var ilk = t[0], son = t[t.length - 1], en = t.reduce(function (a, c) { return c.bati_ana < a.bati_ana ? c : a; });
    var p = function (x) { return yz(x * 100, 0); };
    if (EN) return "The regional press is the witness press: we measured an event’s size by how much space it gave the event, and divided each group’s space by that. " +
      "Western mainstream press’s follow rate was " + p(ilk.bati_ana) + " in " + ilk.donem + ", that is, it gave events as much space as the regional press. In " + son.donem + " the rate was " + p(son.bati_ana) + ". The lowest period was " + en.donem + " (" + p(en.bati_ana) + "). " +
      "The Turkish press’s rate in the same periods: " + p(ilk.turkiye) + " and " + p(son.turkiye) + ". The rate does not fall in a straight line: the Western press returns to some events, especially attacks that kill journalists or foreign aid workers. But with ceasefires and other stories, ordinary attacks increasingly stay inside the regional press.";
    return "Bölge basını tanık basındır: bir olayın büyüklüğünü onun o olaya ne kadar yer ayırdığıyla ölçtük ve her grubun ayırdığı yeri buna böldük. " +
      "Batı ana akım basınının izleme oranı " + ilk.donem + " döneminde " + p(ilk.bati_ana) + " idi, yani olaylara bölge basını kadar yer ayırıyordu. " + son.donem + " döneminde oran " + p(son.bati_ana) + ". En düşük dönem " + en.donem + " (" + p(en.bati_ana) + "). " +
      "Türkiye basınının oranı aynı dönemlerde " + p(ilk.turkiye) + " ve " + p(son.turkiye) + ". Oran düz bir çizgide düşmüyor: Batı basını bazı olaylarda, özellikle gazetecilerin ya da yabancı yardım çalışanlarının öldürüldüğü saldırılarda yeniden ilgileniyor. Ama ateşkesler ve başka gündemlerle birlikte sıradan saldırılar giderek bölge basınının içinde kalıyor.";
  }
  function hastaneMetin(h, hs) {
    if (!h || !hs.length) return "";
    var ref = h.referans, b = hs.filter(function (x) { return x.endeks && x.endeks.bati_ana != null; });
    var buyuk = b.filter(function (x) { return x.endeks.bati_ana >= 50 && x.sayi.bati_ana >= 3; });
    var dusuk = b.filter(function (x) { return x.tepe > ref.gun && x.endeks.bati_ana < 25; });
    var geri = b.filter(function (x) { return x.tepe > ref.gun && x.endeks.bati_ana >= 50 && x.sayi.bati_ana >= 3; }).sort(function (p, q) { return q.endeks.bati_ana - p.endeks.bati_ana; }).slice(0, 3);
    if (EN) return "We found " + hs.length + " attacks on hospitals in the headlines. One of those that drew the strongest response was the first: the " + yerAd(ref) + " attack of " + gunAd(ref.gun) + ". We set it at 100. Of the " + (b.length - 1) + " attacks that followed, Western mainstream press responded with at least half that strength to only " + (buyuk.length - 1) + "; to " + dusuk.length + " it did not reach even a quarter." +
      (geri.length ? " Attacks to which the response returned: " + geri.map(function (x) { return yerAd(x) + " (" + ayAd(x.tepe) + ")"; }).join(", ") + "." : "");
    return "Başlıklardan " + hs.length + " hastane saldırısı bulduk. Tepkiyi en çok çekenlerden biri ilki: " + gunAd(ref.gun) + " tarihli " + yerAd(ref) + " saldırısı. Onu 100 saydık. Sonraki " + (b.length - 1) + " saldırıdan yalnızca " + (buyuk.length - 1) + " tanesinde Batı ana akım basını bunun en az yarısı kadar tepki verdi; " + dusuk.length + " tanesinde dörtte birine bile ulaşmadı." +
      (geri.length ? " Tepkinin geri geldiği saldırılar: " + geri.map(function (x) { return yerAd(x) + " (" + ayAd(x.tepe) + ")"; }).join(", ") + "." : "");
  }

  // ---- 1) hastaneler: zaman / tepki endeksi
  function nokta(kap, olaylar, gruplar, etiket) {
    var W = 760, H = 320, P = { l: 44, r: 16, t: 16, b: 28 };
    var t0 = gunNo(V.bas), t1 = gunNo(V.son), x = function (g) { return P.l + (W - P.l - P.r) * (gunNo(g) - t0) / (t1 - t0); };
    var enY = 200, y = function (v) { return P.t + (H - P.t - P.b) * (1 - Math.min(v, enY) / enY); };
    var enB = Math.max.apply(0, olaylar.map(function (o) { return o.bolge_sayi; })) || 1;
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": etiket });
    [0, 50, 100, 150, 200].forEach(function (p) {
      s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(p), y2: y(p), "class": p === 100 ? "rp-izgara rp-yuz" : "rp-izgara" }));
      var t = sv("text", { x: P.l - 6, y: y(p) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = p === 200 ? "200+" : p; s.appendChild(t);
    });
    for (var yl = +V.bas.slice(0, 4) + 1; yl <= +V.son.slice(0, 4); yl++) { var g = yl + "-01-01"; var t = sv("text", { x: x(g), y: H - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = yl; s.appendChild(t); s.appendChild(sv("line", { x1: x(g), x2: x(g), y1: P.t, y2: H - P.b, "class": "rp-izgara" })); }
    gruplar.forEach(function (gr) {
      olaylar.forEach(function (o) {
        var e = o.endeks && o.endeks[gr]; if (e == null) return;
        var r = 2.5 + 9 * Math.sqrt(o.bolge_sayi / enB);
        var m = gunAd(o.tepe) + " · " + yerAd(o) + "\n" + AD[gr] + ": " + sayi(e, 0) + " (" + o.sayi[gr] + tt(" başlık)", " headlines)") + (o.ornek[0] ? "\n“" + o.ornek[0].baslik + "” — " + o.ornek[0].yayin : "");
        s.appendChild(baslik(sv("circle", { cx: x(o.tepe), cy: y(e), r: r.toFixed(1), fill: R[gr], "fill-opacity": 0.55, stroke: R[gr], "stroke-width": 1, "class": "rp-nok" }), m));
      });
    });
    kap.appendChild(s);
  }
  function hastaneGrafik(v) {
    var k = $("g-hastane"); efsane(["bati_ana", "turkiye"], k);
    nokta(k, v.olaylar.filter(function (x) { return x.tur === "hastane"; }), ["turkiye", "bati_ana"], tt("Hastane saldırılarına tepki", "Response to hospital attacks"));
  }

  // ---- 2) tür tür tablo ve küçük grafikler
  function turTablo(v) {
    var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>Event type</th><th>Events</th><th>First major event (=100)</th><th>Western mainstream: last response</th><th>After</th><th>Turkish press: last response</th></tr></thead>" : "<thead><tr><th>Olay türü</th><th>Olay</th><th>İlk büyük olay (=100)</th><th>Batı ana akım: son tepki</th><th>Sonra</th><th>Türkiye basını: son tepki</th></tr></thead>";
    var bd = el("tbody");
    v.turler.filter(function (x) { return x.olay_sayisi >= 3; }).sort(function (a, b) { return b.olay_sayisi - a.olay_sayisi; }).forEach(function (x) {
      var r = el("tr"), st = x.son_tepki || {};
      var hucre = function (s) { return el("td", null, s ? gunAd(s.gun) + " · " + yerAd(s) : tt("yok", "none")); };
      var sonra = st.bati_ana ? (EN ? st.bati_ana.sonraki_olay + " events" + (st.bati_ana.sonraki_buyuk_olay ? ", " + st.bati_ana.sonraki_buyuk_olay + " at least half the size of the first" : "") : st.bati_ana.sonraki_olay + " olay" + (st.bati_ana.sonraki_buyuk_olay ? ", " + st.bati_ana.sonraki_buyuk_olay + " tanesi ilkinin en az yarısı büyüklükte" : "")) : "–";
      r.append(el("td", null, turAd(x)), el("td", "sayi", x.olay_sayisi), el("td", null, x.referans ? gunAd(x.referans.gun) + " · " + yerAd(x.referans) : "–"), hucre(st.bati_ana), el("td", null, sonra), hucre(st.turkiye));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-turler").appendChild(kt);
    $("g-turler").appendChild(el("p", "rp-not", tt("“Son tepki”: grubun tepkisinin ilk büyük olayın en az yarısı olduğu ve en az üç başlık attığı son olay. “Sonra”: ondan sonra aynı türden kaç olay olduğu.", "“Last response”: the last event to which the group responded with at least half the strength of the first major event and at least three headlines. “After”: how many events of the same type followed.")));
  }
  function kucukler(v) {
    var k = $("g-kucukler"); efsane(["bati_ana", "turkiye"], k);
    v.turler.filter(function (x) { return x.olay_sayisi >= 10 && x.yariyil; }).sort(function (a, b) { return b.olay_sayisi - a.olay_sayisi; }).forEach(function (x) {
      var f = el("figure", "rp-kucuk"); f.appendChild(el("figcaption", null, turAd(x) + " · " + x.olay_sayisi + tt(" olay", " events")));
      cizIzleme(f, x.yariyil, ["turkiye", "bati_ana"], 1, 200, x.ad);
      k.appendChild(f);
    });
    k.appendChild(el("p", "rp-not", tt("Küçük grafikler: altı ayda bir, o türden olaylarda grubun izleme oranı (%100 = bölge basını kadar). Gri çubuklar o altı aydaki olay sayısı. Büyütmek için tıklayın.", "Small charts: every six months, the group’s follow rate for events of that type (100% = as much as the regional press). Grey bars: number of events in those six months. Click to enlarge.")));
  }
  // izleme oranı çizgileri; E: [{donem, olay, <grup>: oran}]
  function cizIzleme(kap, E, gruplar, enAz, H0, etiket) {
    var n = E.length, W = 760, H = H0 || 300, P = { l: 44, r: 40, t: 14, b: 26 };
    var x = function (i) { return P.l + (W - P.l - P.r) * (i + 0.5) / n; };
    var enY = 2, y = function (v) { return P.t + (H - P.t - P.b) * (1 - Math.min(v, enY) / enY); };
    var enO = Math.max.apply(0, E.map(function (c) { return c.olay; })) || 1;
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, "class": "rp-svg", role: "img", "aria-label": etiket });
    var bw = (W - P.l - P.r) / n;
    E.forEach(function (c, i) { var hh = (H - P.t - P.b) * 0.3 * c.olay / enO; s.appendChild(baslik(sv("rect", { x: x(i) - bw * 0.35, y: H - P.b - hh, width: bw * 0.7, height: hh, "class": "rp-olu" }), c.donem + ": " + c.olay + tt(" olay", " events"))); });
    [0, 1, 2].forEach(function (p) {
      s.appendChild(sv("line", { x1: P.l, x2: W - P.r, y1: y(p), y2: y(p), "class": p === 1 ? "rp-izgara rp-yuz" : "rp-izgara" }));
      var t = sv("text", { x: P.l - 6, y: y(p) + 4, "text-anchor": "end", "class": "rp-eksen" }); t.textContent = p === 2 ? yz(200, 0) + "+" : yz(p * 100, 0); s.appendChild(t);
    });
    var t1 = sv("text", { x: W - P.r + 4, y: y(1) + 4, "class": "rp-eksen" }); t1.textContent = tt("bölge", "regional"); s.appendChild(t1);
    var yil = ""; E.forEach(function (c, i) { if (c.donem.slice(0, 4) !== yil) { yil = c.donem.slice(0, 4); var t = sv("text", { x: x(i), y: H - 8, "text-anchor": "middle", "class": "rp-eksen" }); t.textContent = yil; s.appendChild(t); } });
    gruplar.forEach(function (g) {
      var d = "", yeni = true;
      E.forEach(function (c, i) { if (c[g] == null || c.olay < enAz) { yeni = true; return; } d += (yeni ? "M" : "L") + x(i).toFixed(1) + "," + y(c[g]).toFixed(1); yeni = false; });
      s.appendChild(sv("path", { d: d, fill: "none", stroke: R[g], "stroke-width": g === "bati_ana" ? 2.6 : 1.8, "stroke-linejoin": "round" }));
      E.forEach(function (c, i) { if (c[g] == null || c.olay < enAz) return; s.appendChild(baslik(sv("circle", { cx: x(i), cy: y(c[g]), r: 3.5, fill: R[g] }), c.donem + " · " + AD[g] + ": " + yz(c[g] * 100, 0) + " (" + c[g + "_sayi"] + tt(" başlık, ", " headlines, ") + c.olay + tt(" olay)", " events)"))); });
    });
    kap.appendChild(s);
  }

  // ---- 3) alışma eğrisi: izleme oranları
  function egriGrafik(v) {
    var k = $("g-egri"); efsane(["turkiye", "bati_ana"], k, [["#d5d8d5", tt("olay sayısı", "number of events")]]);
    cizIzleme(k, v.egri, ["turkiye", "bati_ana"], 5, 300, tt("Çeyrek çeyrek izleme oranı", "Follow rate by quarter"));
    k.appendChild(el("p", "rp-not", tt("Beşten az olaylı çeyrekler çizilmedi. İsrail basını ve Batı’daki muhalif basın, örneklem çok küçük olduğu için gösterilmiyor.", "Quarters with fewer than five events are not drawn. The Israeli press and the Western dissenting press are not shown because the samples are too small.")));
  }

  // ---- 4) kitlesel ölüm günleri
  function olumTablo(v) {
    var t = el("table"), lg = ["Türkiye", "ABD", "Avrupa", "Arap ülkeleri", "BM"];
    t.innerHTML = (EN ? "<thead><tr><th>Day</th><th>Reported deaths</th><th>Western mainstream · war share</th><th>Turkish press · war share</th>" : "<thead><tr><th>Gün</th><th>Bildirilen ölüm</th><th>Batı ana akım · savaş payı</th><th>Türkiye basını · savaş payı</th>") + lg.map(function (g) { return "<th>" + LG[g] + tt(" liderleri", " leaders") + "</th>"; }).join("") + "</tr></thead>";
    var bd = el("tbody");
    v.olum_gunleri.slice().sort(function (a, b) { return b.olu - a.olu; }).forEach(function (x, j) {
      var r = el("tr"); if (j >= 12) { r.hidden = true; r.className = "rp-gizli"; }
      var pay = function (g) { var a = x[g].once, c = x[g].gazze_pay; var td = el("td", "sayi", (a == null ? "–" : yz(a, 0)) + " → " + (c == null ? "–" : yz(c, 0))); if (a != null && c != null && c <= a) td.classList.add("dusus"); return td; };
      r.append(el("td", null, gunAd(x.gun)), el("td", "sayi", sayi(x.olu, 0)), pay("bati_ana"), pay("turkiye"));
      lg.forEach(function (g) { var a = x.lider[g]; var td = el("td", "sayi", a == null ? "–" : sayi(a, 1) + "×"); if (a != null && a <= 1) td.classList.add("dusus"); r.appendChild(td); });
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-olumler").appendChild(kt);
    if (v.olum_gunleri.length > 12) {
      var m = el("button", "rp-daha", tt("Bütün günleri göster (", "Show all days (") + v.olum_gunleri.length + ")"); m.type = "button";
      m.addEventListener("click", function () { bd.querySelectorAll(".rp-gizli").forEach(function (r) { r.hidden = false; }); m.remove(); });
      $("g-olumler").appendChild(m);
    }
    $("g-olumler").appendChild(el("p", "rp-not", tt("Savaş payı: önceki iki hafta → o gün ve sonraki iki gün. Liderler: adlarının geçtiği başlıkların önceki dört haftanın ortalamasına göre kaç kat olduğu. Kırmızı: artış yok. Bakanlığın bir günde açıkladığı sayı geç kayıtları da içerebilir.", "War share: previous two weeks → that day and the next two. Leaders: how many times more often their names appeared than in the previous four weeks on average. Red: no increase. The ministry’s figure for a day may include late registrations.")));
  }

  // ---- 5) katalog
  var secili = "hepsi", gosterilen = 30;
  document.addEventListener("rp-baski", function () { if (V) { gosterilen = 1e9; liste(); } });
  function katalog(v) {
    var z = $("suzgec");
    var turler = v.turler.filter(function (t) { return t.olay_sayisi; }).sort(function (a, b) { return b.olay_sayisi - a.olay_sayisi; });
    [{ anahtar: "hepsi", ad: tt("Hepsi", "All"), olay_sayisi: v.olaylar.length }].concat(turler).forEach(function (t) {
      var b = el("button", "rp-cip" + (t.anahtar === secili ? " secili" : ""), (t.anahtar === "hepsi" ? t.ad : turAd(t)) + " · " + t.olay_sayisi); b.type = "button";
      b.setAttribute("aria-pressed", t.anahtar === secili);
      b.addEventListener("click", function () { secili = t.anahtar; gosterilen = 30; z.querySelectorAll("button").forEach(function (x) { x.classList.toggle("secili", x === b); x.setAttribute("aria-pressed", x === b); }); liste(); });
      z.appendChild(b);
    });
    liste();
  }
  function liste() {
    var k = $("g-katalog"); k.textContent = "";
    var xs = V.olaylar.filter(function (x) { return secili === "hepsi" || x.tur === secili; }).slice().reverse();
    xs.slice(0, gosterilen).forEach(function (x) {
      var d = el("div", "rp-olay-kart");
      var b = el("div", "rp-olay-bas");
      b.append(el("b", null, (T[x.tur] ? turAd(T[x.tur]) : x.tur) + " · " + yerAd(x)), el("span", null, gunAd(x.bas) + (x.son !== x.bas ? " – " + gunAd(x.son) : "")));
      d.appendChild(b);
      var ac = el("a", "rp-olay-ac", tt("Olayın sayfası →", "Event page →")); ac.href = "olay.html#" + x.tur + "-" + x.bas; b.appendChild(ac);
      var o = el("p", "rp-olay-olcu");
      o.textContent = EN ? "Regional press " + x.bolge_sayi + " headlines · Western mainstream " + x.sayi.bati_ana + " · Turkey " + x.sayi.turkiye + (x.olu ? " · deaths reported in Gaza that day: " + sayi(x.olu, 0) : "") : "Bölge basını " + x.bolge_sayi + " başlık · Batı ana akım " + x.sayi.bati_ana + " · Türkiye " + x.sayi.turkiye + (x.olu ? " · Gazze’de o gün bildirilen ölüm: " + sayi(x.olu, 0) : "");
      d.appendChild(o);
      x.ornek.forEach(function (m) {
        var a = el("a", "rp-ornek"); a.href = m.url; a.target = "_blank"; a.rel = "noopener";
        var bb = el("span", "rp-ornek-b", m.baslik); if (/[؀-ۿ]/.test(m.baslik)) { bb.dir = "rtl"; bb.lang = "ar"; }
        a.append(bb, el("small", null, m.yayin + " · " + AD[m.grup] + " · " + gunAd(m.gun))); d.appendChild(a);
      });
      k.appendChild(d);
    });
    if (xs.length > gosterilen) {
      var m = el("button", "rp-daha", tt("Daha fazla göster (" + (xs.length - gosterilen) + " olay daha)", "Show more (" + (xs.length - gosterilen) + " more events)")); m.type = "button";
      m.addEventListener("click", function () { gosterilen += 30; liste(); }); k.appendChild(m);
    }
  }

  function yontem(v) {
    var u = $("g-yontem");
    (EN ? [
      "Source: headlines collected by the backfill (sitemaps, RSS archives, the Wayback Machine). Headlines on Palestine, Lebanon and Israel; attacks on Lebanon are in the catalogue as part of the same war. Events such as Iran’s attacks on Israel are not. No AI was used.",
      "Event types were found with word patterns in eight languages (e.g. hospital = the word hospital plus a verb of attack). Headlines in which a hospital is only the news source (“according to hospital sources”) or where the wounded were taken were removed. Patterns can put a headline in the wrong type or miss it; the figures measure the trend, not individual headlines.",
      "Event day: when a type’s daily share in the regional press (including Turkey) exceeds " + String(v.esik.kat) + " times the median of the previous 28 days. Consecutive days count as one event.",
      "Response index: in the event window (one day before, two after), how many of every thousand headlines in a group were of that type; the type’s first major event (the first to receive at least 40% of the space of the largest event in the regional press) = 100. Groups with fewer than 300 headlines in a window were not measured.",
      "Follow rate: the group’s share in event windows divided by the regional press’s share in the same windows. A measure independent of event size.",
      "Deaths: daily reports of the Gaza Ministry of Health (Tech for Palestine, public domain). A day’s figure may include late registrations.",
      "This page measures the response of the press and of leaders. Street response (protests) and reader interest (Wikipedia page views) will be added as separate layers."
    ] : [
      "Kaynak: geriye dönük taramanın topladığı haber başlıkları (site haritaları, RSS arşivleri, Wayback Machine). Filistin, Lübnan ve İsrail bağlamındaki başlıklar; Lübnan’a yapılan saldırılar aynı savaşın parçası olarak katalogda. İran’ın İsrail’e saldırıları gibi olaylar yok. Yapay zekâ kullanılmadı.",
      "Olay türleri sekiz dilde kelime kalıplarıyla bulundu (ör. hastane = hastane kelimesi ve bir saldırı fiili). Hastanenin yalnızca haber kaynağı olduğu (“hastane kaynaklarına göre”) ya da yaralıların götürüldüğü yer olduğu başlıklar çıkarıldı. Kalıplar bir başlığı yanlış türe koyabilir ya da kaçırabilir; sayılar tek tek başlıkların değil, eğilimin ölçüsüdür.",
      "Olay günü: bir türün bölge basınındaki (Türkiye dahil) günlük payı, önceki 28 günün ortancasının " + String(v.esik.kat).replace(".", ",") + " katını aştığında. Arka arkaya gelen günler tek olay.",
      "Tepki endeksi: olay penceresinde (bir gün önce, iki gün sonra) grubun bin başlığından kaçının o türden olduğu; türün ilk büyük olayı (bölge basınında en büyük olayın en az %40’ı kadar yer bulan ilk olay) 100. Penceresinde 300’den az başlığı olan gruplar ölçülmedi.",
      "İzleme oranı: grubun olay pencerelerindeki payı / bölge basınının aynı pencerelerdeki payı. Olayın büyüklüğünden bağımsız bir ölçü.",
      "Ölümler: Gazze Sağlık Bakanlığı’nın günlük bildirimleri (Tech for Palestine, kamu malı). Bir gündeki sayı o güne ait olmayan geç kayıtları içerebilir.",
      "Bu sayfa basının ve liderlerin tepkisini ölçüyor. Sokak tepkisi (gösteriler) ve okur ilgisi (Vikipedi okunma sayıları) ayrı katmanlar olarak eklenecek."
    ]).forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
