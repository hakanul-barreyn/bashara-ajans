// Liderler raporu: data/bulten/liderler.json ve alisma.json (kitlesel ölüm günleri).
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  var NS = "http://www.w3.org/2000/svg";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function baslik(e, m) { var t = sv("title"); t.textContent = m; e.appendChild(t); return e; }
  var AYTAM = EN ? ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] : ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  function yuzde(a, b) { return b ? (EN ? sayi(100 * a / b, 0) + "%" : "%" + sayi(100 * a / b, 0)) : "–"; }
  function yz(n, d) { return EN ? sayi(n, d) + "%" : "%" + sayi(n, d); }
  function gunAd(g) { return +g.slice(8, 10) + " " + AYTAM[+g.slice(5, 7) - 1] + " " + g.slice(0, 4); }
  function ayAd(m) { return AYTAM[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  var EN = window.DIL === "en";
  function tt(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  var GRUP_EN = { "Türkiye": "Turkey", "ABD": "United States", "Avrupa": "Europe", "Arap ülkeleri": "Arab states", "İran": "Iran", "Asya ve diğer": "Asia and others", "Çin": "China", "Rusya": "Russia", "BM": "UN", "İsrail": "Israel" };
  function gAd(g) { return EN ? (GRUP_EN[g] || g) : g; }
  var ROL = [["(Dışişleri)", "(Foreign Minister)"], ["Dışişleri sözcüsü", "foreign ministry spokesperson"], ["Dışişleri sözcüleri", "foreign ministry spokespeople"], ["(BM Genel Sekreteri)", "(UN Secretary-General)"], ["(BM Özel Raportörü)", "(UN Special Rapporteur)"], ["(BM İnsan Hakları)", "(UN Human Rights)"], ["(DSÖ)", "(WHO)"], ["(AB Komisyonu)", "(European Commission)"], ["(AB Dış Politika)", "(EU foreign policy chief)"], ["(özel temsilci)", "(special envoy)"], ["(Mısır)", "(Egypt)"], ["(Suudi Arabistan)", "(Saudi Arabia)"], ["(BAE)", "(UAE)"], ["(Katar)", "(Qatar)"], ["(Ürdün)", "(Jordan)"], ["(Filistin Yönetimi)", "(Palestinian Authority)"], ["(Katar Başbakanı)", "(Qatari Prime Minister)"], ["(Suudi Dışişleri)", "(Saudi Foreign Minister)"], ["(Ürdün Dışişleri)", "(Jordanian Foreign Minister)"], ["(Mısır Dışişleri)", "(Egyptian Foreign Minister)"], ["(Arap Birliği)", "(Arab League)"], ["(Malezya)", "(Malaysia)"], ["(Endonezya)", "(Indonesia)"], ["(Güney Afrika)", "(South Africa)"], ["(Brezilya)", "(Brazil)"], ["(Kolombiya)", "(Colombia)"], ["(Hindistan)", "(India)"], ["(Çin)", "(China)"], ["(Çin Dışişleri)", "(Chinese Foreign Minister)"], ["Çin Dışişleri sözcüleri", "Chinese foreign ministry spokespeople"], ["(Rusya)", "(Russia)"], ["(Rusya BM)", "(Russia at the UN)"], ["Şi Cinping", "Xi Jinping"], ["Vang Yi", "Wang Yi"], ["Mariya Zaharova", "Maria Zakharova"], ["Vasiliy Nebenzya", "Vassily Nebenzia"], ["Sergey Lavrov", "Sergei Lavrov"], ["Ali Hamaney", "Ali Khamenei"], ["İbrahim Reisi", "Ebrahim Raisi"], ["Mesud Pezeşkiyan", "Masoud Pezeshkian"], ["Hüseyin Emir Abdullahiyan", "Hossein Amir-Abdollahian"], ["Abbas Arakçi", "Abbas Araghchi"], ["Abdulfettah es-Sisi", "Abdel Fattah el-Sisi"], ["Muhammed bin Selman", "Mohammed bin Salman"], ["Muhammed bin Zayed", "Mohamed bin Zayed"], ["Temim bin Hamed", "Tamim bin Hamad"], ["Kral II. Abdullah", "King Abdullah II"], ["Mahmud Abbas", "Mahmoud Abbas"], ["Muhammed bin Abdurrahman Al Sani", "Mohammed bin Abdulrahman Al Thani"], ["Faysal bin Ferhan", "Faisal bin Farhan"], ["Eymen Safedi", "Ayman Safadi"], ["Sameh Şukri", "Sameh Shoukry"], ["Bedr Abdulati", "Badr Abdelatty"], ["Ahmed Ebul Gayt", "Ahmed Aboul Gheit"], ["Enver İbrahim", "Anwar Ibrahim"], ["Şahbaz Şerif", "Shehbaz Sharif"], ["Binyamin Netanyahu", "Benjamin Netanyahu"], ["İsrail Katz", "Israel Katz"]];
  function lAd(a) { if (!EN) return a; ROL.forEach(function (r) { a = a.split(r[0]).join(r[1]); }); return a; }
  var TUR_EN = { hastane: "attacks on hospitals", cadir: "tents hit", yardim: "fire on aid seekers", keskin: "sniper fire", bas: "shot in the head", cocuk: "children killed", su: "water seekers shot", guvenli: "attacks on “safe zones”", okul: "attacks on schools and shelters", ibadet: "attacks on mosques and churches", aksa: "raids on Al-Aqsa", saglik: "health workers killed", yardimci: "aid workers killed", iskence: "torture in prisons", asagilama: "humiliation", aclik: "starvation deaths", mezar: "mass graves", bayrak: "fire on white flags" };
  var RENK = { toplam: "#cfd3cf", gazze: "#1f7a52", soykirim: "#c9302c", netanyahu: "#2f5bb7", siyonist: "#8a6d3b", israil: "#6f7772", ateskes: "#7a3fa0", hamas: "#c39a35", katliam: "#e07b39" };

  var zaman = Math.floor(Date.now() / 6e5);
  Promise.all([fetch("data/bulten/liderler.json?t=" + zaman).then(function (r) { return r.json(); }),
    fetch("data/bulten/alisma.json?t=" + zaman).then(function (r) { return r.json(); }).catch(function () { return null; }),
    fetch("data/konusma/erdogan.json?t=" + zaman).then(function (r) { return r.json(); }).catch(function () { return null; })]).then(function (x) { KON = x[2]; ciz(x[0], x[1]); })
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", tt("Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.", "Report data is not ready yet; it will be written on the collector’s next run."))); });

  var L = {}, KON = null;
  function ciz(v, a) {
    v.liderler.forEach(function (x) { L[x.anahtar] = x; });
    var e = L.erdogan, tr = v.tr_olaylar;
    var em = konusmaOzet();
    var og = a ? a.olum_gunleri : [];
    var deger = {
      donem: ayAd(v.aylar[0]) + " – " + ayAd(v.aylar[v.aylar.length - 1]),
      guncel: tt("Güncellendi: ", "Updated: ") + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }),
      taslak: a && !a.tarama_bitti ? tt("Tarama sürüyor; sayılar kesinleşmedi", "Backfill in progress; figures are provisional") : "",
      erdogan_metin: em ? em.metin : tt("Konuşmalar Cumhurbaşkanlığı sitesinden toplanıyor; ilk sonuçlar birkaç saat içinde burada olacak.", "Speeches are being collected from the Presidency’s website; the first results will be here within a few hours."),
      erdogan_alt: tt("Üstte: her ay yapılan konuşmalar (gri) ve bunların içinde Gazze ya da Filistin’den söz edenlerin yüzdesi (yeşil). Altta: on bin kelimede kaç kez “Gazze” ya da “Filistin” (yeşil), “soykırım” (kırmızı) ve “Netanyahu” (mavi) dendiği. Kaynak: tccb.gov.tr.", "Top: speeches given each month (grey) and the percentage of them mentioning Gaza or Palestine (green). Bottom: how many times per ten thousand words he said “Gaza” or “Palestine” (green), “genocide” (red) and “Netanyahu” (blue). Source: tccb.gov.tr."),
      olum_metin: og.length && EN ? "For the " + og.length + " days on which the Gaza Ministry of Health reported 300 or more new deaths, we calculated how many times more often each group of leaders appeared that day and the next two. A rise below 1.5 times suggests those leaders said nothing that made the news." : og.length ? "Gazze Sağlık Bakanlığı’nın bir günde 300 ya da daha fazla yeni ölüm bildirdiği " + og.length + " gün için, her lider grubunun adının o gün ve sonraki iki gün kaç kat daha sık geçtiğini hesapladık. 1,5 kattan az artış, o liderlerin haber olacak bir şey söylemediğine işaret ediyor." : ""
    };
    document.querySelectorAll("[data-v]").forEach(function (x) { var d = deger[x.dataset.v]; x.textContent = d == null ? "–" : d; if (x.dataset.v === "taslak" && !d) x.hidden = true; });
    var k = $("kartlar");
    var kart = function (b, s) { var d = el("div", "rp-kart"); d.append(el("b", null, b), el("span", null, s)); k.appendChild(d); };
    kart(sayi(v.liderler.length, 0), tt("lider, bakan ve BM yetkilisinin adı Filistin bağlamındaki başlıklarda izlendi", "leaders, ministers and UN officials tracked in headlines about Palestine"));
    if (e) kart(yuzde(e.kelime.soykirim, e.toplam), tt("Erdoğan’ın adının geçtiği Filistin başlıklarında “soykırım” da geçiyor", "of Palestine headlines naming Erdoğan also contain “genocide”"));
    if (em && em.kartB) kart(em.kartB, em.kartS);
    var ol = olumOzet(og);
    var abd = ol.filter(function (x) { return x.grup === "ABD"; })[0];
    if (abd) kart(abd.sessiz + " / " + abd.n, tt("kitlesel ölüm gününde ABD liderlerinin adı 1,5 kat bile artmadı", "mass-death days on which US leaders’ names did not rise even 1.5 times"));
    [gruplar, erdoganGrafik, hedef, kelimeler, tetik, ornekler, yontem].forEach(function (f) { try { f(v); } catch (er) { if (window.console) console.error("liderler", er); } });
  }

  // ---- Erdoğan'ın resmî konuşmaları (tccb.gov.tr)
  var IMLER = [{ gun: "2023-10-07", ad: tt("7 Ekim", "7 October") }, { gun: "2024-03-31", ad: tt("Türkiye’de yerel seçim", "Local elections in Turkey") }, { gun: "2024-11-05", ad: tt("ABD seçimi", "US election") },
    { gun: "2025-01-20", ad: tt("Trump göreve başladı", "Trump inaugurated") }, { gun: "2025-10-10", ad: tt("Gazze’de ateşkes", "Gaza ceasefire") }];
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
    var enaz = Math.min(yo.n, ys.n, ao.n, as.n, tr.n);
    if (enaz < 8) return { kartB: null, metin: tt("Karşılaştırma için henüz yeterli konuşma toplanmadı: her dönem için en az 8 konuşma gerekiyor. Şu an yerel seçim öncesi " + yo.n + ", sonrası " + ys.n + "; ABD seçimi öncesi " + ao.n + ", seçimle Trump’ın göreve başlaması arası " + as.n + ", Trump’ın ilk üç ayı " + tr.n + " konuşma. Toplayıcı Cumhurbaşkanlığı arşivinde geriye doğru ilerliyor; sayılar yeterli olunca karşılaştırma burada çıkacak.",
      "Not enough speeches collected yet for a comparison: each period needs at least 8. Currently: before the local elections " + yo.n + ", after " + ys.n + "; before the US election " + ao.n + ", between the election and Trump’s inauguration " + as.n + ", Trump’s first three months " + tr.n + ". The collector is working back through the Presidency’s archive.") };
    var metin = "Toplanan " + KON.konusmalar.length + " konuşmaya göre: Türkiye’deki yerel seçimden önceki üç ayda Erdoğan konuşmalarının yüzde " + sayi(yo.pay, 0) + " kadarında Gazze ya da Filistin’den söz etti, on bin kelimede " + on(yo.gf) + " kez; seçimden sonraki üç ayda yüzde " + sayi(ys.pay, 0) + ", on bin kelimede " + on(ys.gf) + ". " +
      "ABD seçiminden önceki üç ayda on bin kelimede " + on(ao.gf) + " kez Gazze ya da Filistin dedi; ABD seçimi ile Trump’ın göreve başlaması arasında " + on(as.gf) + ", Trump’ın ilk üç ayında " + on(tr.gf) + ". “Soykırım” kelimesi aynı üç dönemde on bin kelimede " + on(ao.soy) + ", " + on(as.soy) + " ve " + on(tr.soy) + " kez geçti. " +
      "Filistin’e en çok yer verdiği ay " + ayAd(tepe.ay) + " (on bin kelimede " + on(1e4 * tepe.gf / tepe.kelime) + ").";
    if (EN) metin = "Across the " + KON.konusmalar.length + " speeches collected: in the three months before Turkey’s local elections, Erdoğan mentioned Gaza or Palestine in " + sayi(yo.pay, 0) + "% of his speeches, " + on(yo.gf) + " times per ten thousand words; in the three months after, " + sayi(ys.pay, 0) + "%, " + on(ys.gf) + " times. " +
      "In the three months before the US election he said Gaza or Palestine " + on(ao.gf) + " times per ten thousand words; between the US election and Trump’s inauguration, " + on(as.gf) + "; in Trump’s first three months, " + on(tr.gf) + ". The word “genocide” appeared " + on(ao.soy) + ", " + on(as.soy) + " and " + on(tr.soy) + " times per ten thousand words in the same three periods. " +
      "The month in which he gave Palestine the most space was " + ayAd(tepe.ay) + " (" + on(1e4 * tepe.gf / tepe.kelime) + " per ten thousand words).";
    return { metin: metin, kartB: on(ao.gf) + " → " + on(tr.gf), kartS: tt("Erdoğan’ın konuşmalarında on bin kelimede “Gazze / Filistin”: ABD seçiminden önceki üç ay → Trump’ın ilk üç ayı", "“Gaza / Palestine” per ten thousand words in Erdoğan’s speeches: three months before the US election → Trump’s first three months") };
  }
  function erdoganGrafik(v) {
    var k = $("g-erdogan");
    if (!KON || !KON.konusmalar || KON.konusmalar.length < 20) { k.appendChild(el("p", "bekliyor", tt("Konuşmalar toplanıyor.", "Speeches are being collected."))); return; }
    var A = aylik(), et = A.map(function (x) { return x.ay; });
    efsane(k, [["#d5d8d5", tt("konuşma sayısı", "number of speeches")], [RENK.gazze, tt("Gazze / Filistin geçen konuşmaların yüzdesi", "% of speeches mentioning Gaza / Palestine")]]);
    cizgi(k, et, [{ v: A.map(function (x) { return Math.round(100 * x.nf / x.n); }), renk: RENK.gazze, ad: tt("Gazze / Filistin geçen konuşma %", "speeches mentioning Gaza / Palestine %"), kalin: 2.4 }], A.map(function (x) { return x.n; }), IMLER, tt("Konuşmalarda Filistin payı", "Palestine in speeches"), 230);
    efsane(k, [[RENK.gazze, tt("on bin kelimede Gazze / Filistin", "Gaza / Palestine per 10,000 words")], [RENK.soykirim, tt("on bin kelimede soykırım", "genocide per 10,000 words")], [RENK.netanyahu, tt("on bin kelimede Netanyahu", "Netanyahu per 10,000 words")]]);
    var on = function (f) { return A.map(function (x) { return x.kelime ? Math.round(1e5 * f(x) / x.kelime) / 10 : 0; }); };
    var net = {}; KON.konusmalar.forEach(function (c) { var m = c.tarih.slice(0, 7); net[m] = (net[m] || 0) + kv(c, "netanyahu"); });
    cizgi(k, et, [{ v: on(function (x) { return x.gf; }), renk: RENK.gazze, ad: tt("Gazze / Filistin", "Gaza / Palestine"), kalin: 2.4 }, { v: on(function (x) { return x.soy; }), renk: RENK.soykirim, ad: tt("soykırım", "genocide") }, { v: on(function (x) { return net[x.ay] || 0; }), renk: RENK.netanyahu, ad: "Netanyahu" }], null, IMLER, tt("On bin kelimede", "Per ten thousand words"), 230);
    // dönem tablosu
    var D = [[tt("7 Ekim’den önce (Ocak–Eylül 2023)", "Before 7 October (Jan–Sep 2023)"), "2023-01-01", "2023-10-07"], [tt("7 Ekim – Türkiye yerel seçimi", "7 October – Turkish local elections"), "2023-10-07", "2024-03-31"], [tt("Yerel seçim – ABD seçimi", "Local elections – US election"), "2024-03-31", "2024-11-05"],
      [tt("ABD seçimi – Trump’ın göreve başlaması", "US election – Trump’s inauguration"), "2024-11-05", "2025-01-20"], [tt("Trump’ın göreve başlaması – ateşkes", "Trump’s inauguration – ceasefire"), "2025-01-20", "2025-10-10"], [tt("Ateşkesten bu yana", "Since the ceasefire"), "2025-10-10", "2099-01-01"]];
    var t = el("table"); t.innerHTML = EN ? "<thead><tr><th>Period</th><th>Speeches</th><th>Mentioning Gaza / Palestine</th><th>Gaza / Palestine per 10,000 words</th><th>genocide</th><th>Netanyahu</th><th>US / Trump / Biden</th></tr></thead>" : "<thead><tr><th>Dönem</th><th>Konuşma</th><th>Gazze / Filistin geçen</th><th>On bin kelimede Gazze / Filistin</th><th>soykırım</th><th>Netanyahu</th><th>ABD / Trump / Biden</th></tr></thead>";
    var bd = el("tbody");
    D.forEach(function (d) { var x = donem(d[1], d[2]); if (!x.n) return; var r = el("tr"); r.append(el("td", null, d[0]), el("td", "sayi", x.n), el("td", "sayi", yz(x.pay, 0)), el("td", "sayi", sayi(x.gf, 1)), el("td", "sayi", sayi(x.soy, 1)), el("td", "sayi", sayi(x.net, 1)), el("td", "sayi", sayi(x.abd, 1))); bd.appendChild(r); });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-donemler").appendChild(kt);
    konusmaListe();
  }
  function hedef() {
    var k = $("g-hedef"); if (!KON || !KON.konusmalar || KON.konusmalar.length < 20) return;
    var H = [["israil", tt("İsrail", "Israel"), "#6f7772"], ["israil_yonetimi", tt("İsrail / Netanyahu yönetimi, hükümeti", "Israeli / Netanyahu administration, government"), "#c39a35"], ["netanyahu", "Netanyahu", RENK.netanyahu], ["siyonist", tt("Siyonist", "Zionist"), RENK.siyonist]];
    efsane(k, H.map(function (h) { return [h[2], h[1]]; }));
    var C = {}; KON.konusmalar.forEach(function (c) { if (c.tarih < "2023-10-01") return; var q = c.tarih.slice(0, 4) + tt(" Ç", " Q") + (Math.floor((+c.tarih.slice(5, 7) - 1) / 3) + 1); var x = C[q] = C[q] || { israil: 0, israil_yonetimi: 0, netanyahu: 0, siyonist: 0 }; H.forEach(function (h) { x[h[0]] += kv(c, h[0]); }); x.israil -= kv(c, "israil_yonetimi"); });
    Object.keys(C).sort().forEach(function (q) {
      var x = C[q], top = H.reduce(function (s, h) { return s + Math.max(0, x[h[0]]); }, 0); if (!top) return;
      var r = el("div", "rp-yigin-satir"); r.appendChild(el("span", "rp-yigin-ad", q + " · " + top + tt(" kez", " times")));
      var y = el("div", "rp-yigin");
      H.forEach(function (h) { var n = Math.max(0, x[h[0]]); if (!n) return; var i = el("i", null, n / top >= 0.08 ? yz(100 * n / top, 0) : ""); i.style.width = (100 * n / top) + "%"; i.style.background = h[2]; i.title = h[1] + ": " + n; y.appendChild(i); });
      r.appendChild(y); k.appendChild(r);
    });
  }
  function konusmaListe() {
    var k = $("g-konusmalar");
    KON.konusmalar.filter(function (c) { return c.kelime >= 400 && c.tarih >= "2023-10-07"; }).map(function (c) { return { c: c, o: 1e4 * (kv(c, "gazze") + kv(c, "filistin")) / c.kelime }; })
      .sort(function (a, b) { return b.o - a.o; }).slice(0, 8).forEach(function (x) {
        var c = x.c, d = el("div", "rp-zirve-kart"), b = el("div", "rp-zirve-bas");
        var a = el("a", null, c.baslik); a.href = c.url; a.target = "_blank"; a.rel = "noopener";
        var bb = el("b"); bb.appendChild(a); b.append(bb, el("span", null, gunAd(c.tarih) + " · " + sayi(c.kelime, 0) + tt(" kelime", " words"))); d.appendChild(b);
        d.appendChild(el("p", "rp-olay-olcu", tt("On bin kelimede Gazze / Filistin: ", "Gaza / Palestine per 10,000 words: ") + sayi(x.o, 0) + tt(" · soykırım: ", " · genocide: ") + kv(c, "soykirim") + " · Netanyahu: " + kv(c, "netanyahu") + tt(" · Siyonist: ", " · Zionist: ") + kv(c, "siyonist")));
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
    if (cubuk) { var enC = Math.max.apply(0, cubuk) || 1, bw = (W - P.l - P.r) / n; cubuk.forEach(function (c, i) { if (!c) return; var hh = (H - P.t - P.b) * 0.9 * c / enC; s.appendChild(baslik(sv("rect", { x: x(i) - bw * 0.4, y: H - P.b - hh, width: bw * 0.8, height: hh, "class": "rp-olu" }), etiketler[i] + ": " + sayi(c, 0) + tt(" ölüm", " deaths"))); }); }
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
    var k = $("g-gruplar"); efsane(k, [["#1f7a52", tt("adı geçen başlık", "headlines naming them")]]);
    v.lider_gruplari.filter(function (g) { return g !== "İsrail"; }).forEach(function (g) {
      var s = v.grup_aylik[g]; if (!s || !s.some(Boolean)) return;
      var adlar = v.liderler.filter(function (x) { return x.grup === g; }).slice(0, 4).map(function (x) { return lAd(x.ad).replace(/ \(.*\)/, ""); });
      var f = el("figure", "rp-kucuk"); f.appendChild(el("figcaption", null, gAd(g)));
      cizgi(f, v.aylar, [{ v: s, renk: "#1f7a52", ad: tt("başlık", "headlines"), kalin: 2 }], null, null, g, 200);
      f.appendChild(el("p", "rp-not", adlar.join(", ")));
      k.appendChild(f);
    });
  }
  function kelimeler(v) {
    var kk = EN ? [["soykirim", "genocide"], ["katliam", "massacre"], ["ateskes", "ceasefire"], ["hamas", "Hamas"], ["netanyahu", "Netanyahu"], ["siyonist", "Zionist"]] : [["soykirim", "soykırım"], ["katliam", "katliam"], ["ateskes", "ateşkes"], ["hamas", "Hamas"], ["netanyahu", "Netanyahu"], ["siyonist", "Siyonist"]];
    var xs = v.liderler.filter(function (x) { return x.toplam >= 40; });
    var sira = { a: "toplam", yon: -1 };
    var kap = $("g-kelimeler"), kt = el("div", "tablo-kutu"); kap.appendChild(kt);
    function yap() {
      kt.textContent = "";
      var t = el("table"), th = el("thead"), tr = el("tr");
      (EN ? [["ad", "Leader"], ["grup", "Group"], ["toplam", "Headlines"]] : [["ad", "Lider"], ["grup", "Grup"], ["toplam", "Başlık"]]).concat(kk).forEach(function (c) {
        var h = el("th", null, c[1] + (sira.a === c[0] ? (sira.yon < 0 ? " ↓" : " ↑") : "")); h.addEventListener("click", function () { sira = { a: c[0], yon: sira.a === c[0] ? -sira.yon : -1 }; yap(); }); tr.appendChild(h);
      });
      th.appendChild(tr); t.appendChild(th);
      var deg = function (x, a) { return a === "ad" || a === "grup" ? x[a] : a === "toplam" ? x.toplam : (x.kelime[a] || 0) / x.toplam; };
      var bd = el("tbody");
      xs.slice().sort(function (p, q) { var a = deg(p, sira.a), b = deg(q, sira.a); return (a > b ? 1 : a < b ? -1 : 0) * sira.yon; }).forEach(function (x) {
        var r = el("tr"); r.append(el("td", null, lAd(x.ad)), el("td", null, gAd(x.grup)), el("td", "sayi", sayi(x.toplam, 0)));
        kk.forEach(function (c) { r.appendChild(el("td", "sayi", yuzde(x.kelime[c[0]] || 0, x.toplam))); }); bd.appendChild(r);
      });
      t.appendChild(bd); kt.appendChild(t);
    }
    yap();
    kap.appendChild(el("p", "rp-not", tt("En az 40 Filistin başlığında adı geçenler. Sütun başlığına tıklayarak sırala.", "People named in at least 40 Palestine headlines. Click a column heading to sort.")));
  }
  function tetik(v) {
    var t = el("table"); t.innerHTML = EN ? "<thead><tr><th>Leaders</th><th>Event types that triggered them most (median increase)</th><th>Least</th></tr></thead>" : "<thead><tr><th>Lider grubu</th><th>En çok tetikleyen olay türleri (ortanca artış)</th><th>En az tetikleyenler</th></tr></thead>";
    var bd = el("tbody");
    v.lider_gruplari.filter(function (g) { return g !== "İsrail" && v.tetikleyici[g] && v.tetikleyici[g].length; }).forEach(function (g) {
      var xs = v.tetikleyici[g], r = el("tr");
      var yaz = function (ys) { return ys.map(function (y) { return (EN ? (TUR_EN[y.tur] || y.ad) : y.ad) + " " + sayi(y.ortanca_artis, 1) + "×"; }).join(" · "); };
      r.append(el("td", null, gAd(g)), el("td", null, yaz(xs.slice(0, 3))), el("td", null, yaz(xs.slice(-3).reverse())));
      bd.appendChild(r);
    });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-tetik").appendChild(kt);
    $("g-tetik").appendChild(el("p", "rp-not", tt("Yalnızca en az üç olayı olan türler. Artış: olay penceresinde lider grubunun adının geçtiği günlük başlık / önceki dört haftanın günlük ortalaması.", "Only types with at least three events. Increase: daily headlines naming the group’s leaders in the event window / daily average of the previous four weeks.")));
  }
  function olumOzet(og) {
    var gr = ["Türkiye", "ABD", "Avrupa", "Arap ülkeleri", "İran", "Çin", "Rusya", "BM"];
    return gr.map(function (g) {
      var xs = og.map(function (x) { return x.lider[g]; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
      return { grup: g, n: xs.length, sessiz: xs.filter(function (x) { return x < 1.5; }).length, ortanca: xs.length ? xs[Math.floor(xs.length / 2)] : null };
    }).filter(function (x) { return x.n; });
  }
  function olumTablo(ol) {
    var t = el("table"); t.innerHTML = EN ? "<thead><tr><th>Leaders</th><th>Days measured</th><th>Days without even a 1.5× rise</th><th>Median increase</th></tr></thead>" : "<thead><tr><th>Lider grubu</th><th>Ölçülen gün</th><th>1,5 kat bile artmayan gün</th><th>Ortanca artış</th></tr></thead>";
    var bd = el("tbody");
    ol.forEach(function (x) { var r = el("tr"); r.append(el("td", null, gAd(x.grup)), el("td", "sayi", x.n), el("td", "sayi", x.sessiz + " (" + yuzde(x.sessiz, x.n) + ")"), el("td", "sayi", sayi(x.ortanca, 1) + "×")); bd.appendChild(r); });
    t.appendChild(bd); var kt = el("div", "tablo-kutu"); kt.appendChild(t); $("g-olum").appendChild(kt);
    $("g-olum").appendChild(el("p", "rp-not", tt("Gün gün ayrıntı: Alışma raporundaki “Tek günde yüzlerce ölüm” tablosu.", "Day-by-day detail: the “Hundreds killed in a single day” table in the habituation report.")));
  }
  function ornekler(v) {
    var s = $("lider-sec"), k = $("g-ornekler");
    v.liderler.forEach(function (x) { var o = el("option", null, lAd(x.ad) + " (" + x.toplam + ")"); o.value = x.anahtar; s.appendChild(o); });
    function goster() {
      k.textContent = ""; var x = L[s.value]; if (!x) return;
      Object.keys(x.ornek).sort().reverse().forEach(function (m) {
        var d = el("div", "rp-zirve-kart"); var b = el("div", "rp-zirve-bas"); b.append(el("b", null, ayAd(m)), el("span", null, (x.aylik[v.aylar.indexOf(m)] || 0) + tt(" başlık", " headlines"))); d.appendChild(b);
        x.ornek[m].forEach(function (o) { var a = el("a", "rp-ornek"); a.href = o.url; a.target = "_blank"; a.rel = "noopener"; var bb = el("span", "rp-ornek-b", o.baslik); if (/[؀-ۿ]/.test(o.baslik)) { bb.dir = "rtl"; bb.lang = "ar"; } a.append(bb, el("small", null, o.yayin + " · " + gunAd(o.gun))); d.appendChild(a); });
        k.appendChild(d);
      });
    }
    k.className = "rp-zirve"; s.addEventListener("change", goster); goster();
  }
  function yontem() {
    var u = $("g-yontem");
    (EN ? [
      "Source: headlines collected by the backfill; only those mentioning Palestine, Israel or Gaza. A leader is counted when their name appears in a headline (in Turkish, English, Arabic and other spellings).",
      "This is not a count of speeches but of when the press reported on leaders in the context of Palestine. When “genocide” and a leader’s name appear in the same headline, the word may not be the leader’s (e.g. a story criticising the leader).",
      "The Erdoğan section is counted directly from the official speech texts on the Turkish Presidency’s website. Official texts of other leaders (UN, White House, Kremlin, Chinese foreign ministry) will be added as a separate layer.",
      "Trigger and mass-death-day measures: daily headlines naming a group’s leaders divided by the daily average of the previous four weeks. Not calculated for groups averaging under half a headline a day.",
      "Israeli leaders (Netanyahu, Gallant, Katz, Ben-Gvir, Smotrich) were counted for comparison; they are not shown in the charts."
    ] : [
      "Kaynak: geriye dönük taramanın topladığı haber başlıkları; yalnızca Filistin, İsrail ya da Gazze geçenler. Bir liderin adı başlıkta geçiyorsa sayıldı (adlar Türkçe, İngilizce, Arapça ve diğer dillerdeki yazılışlarıyla).",
      "Bu bir konuşma sayımı değil, basının liderleri Filistin bağlamında ne zaman haber yaptığının sayımı. Bir başlıkta “soykırım” ve liderin adı birlikte geçiyorsa, kelime liderin ağzından çıkmış olmayabilir (ör. liderin eleştirildiği bir haber).",
      "Erdoğan bölümü doğrudan Cumhurbaşkanlığı sitesindeki resmî konuşma metinlerinden sayıldı. Diğer liderlerin resmî metinleri (BM, Beyaz Saray, Kremlin, Çin Dışişleri) ayrı bir katman olarak eklenecek.",
      "Tetikleyici ve kitlesel ölüm günü ölçüleri: lider grubunun adının geçtiği günlük başlıkların, önceki dört haftanın günlük ortalamasına oranı. Ortalaması günde yarım başlığın altındaki gruplar için hesaplanmadı.",
      "İsrailli liderler (Netanyahu, Gallant, Katz, Ben-Gvir, Smotrich) karşılaştırma için sayıldı; grafiklerde gösterilmiyor."
    ]).forEach(function (x) { u.appendChild(el("li", null, x)); });
  }
})();
