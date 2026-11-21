/* Dosyalar (haftalarca gündemde kalan hikâyeler): ana sayfadaki dosya şeridi ve kartlardaki "Dosya › dal" satırı.
   Veri: data/dosyalar-site.json (toplayici/dosyalar.py). Kartlar bu dosya gelmeden çizilebilir; satırlar boş
   <a class="dosya-satir" data-d data-dal> olarak eklenir, veri gelince doldurulur (window.DosyaSatir.doldur). */
(function () {
  "use strict";
  var EN = function () { return window.DIL === "en"; };
  var V = null, bekleyen = [];
  var DURUM = { sicak: ["sıcak", "active"], suruyor: ["sürüyor", "ongoing"], sessiz: ["sessiz", "quiet"] };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function ad(o) { return (EN() && o.ad_en) || o.ad; }

  function doldur(kok) {
    if (!V) return;
    (kok || document).querySelectorAll("a.dosya-satir:not([data-dolu])").forEach(function (a) {
      var ds = V.dmap[a.dataset.d], dal = ds && ds.dalmap[a.dataset.dal];
      if (!ds) { a.remove(); return; }
      a.dataset.dolu = "1";
      a.href = "d/" + encodeURIComponent(ds.id) + ".html" + (dal ? "#dal-" + encodeURIComponent(dal.id) : "");
      a.appendChild(el("span", "ds-et", EN() ? "File" : "Dosya"));
      a.appendChild(el("b", null, ad(ds)));
      if (dal) { a.appendChild(el("span", "ds-ok", "›")); a.appendChild(el("span", null, ad(dal))); }
      if (dal && dal.yeniden) a.appendChild(el("em", "ds-geri", EN() ? "back after " + dal.yeniden + " days" : dal.yeniden + " gün sonra yeniden gündemde"));
    });
  }
  // uygulama.js kart çizerken çağırır: haberlerden ilk dosyalıyı bulur
  function satir(haberler) {
    var h = (haberler || []).find(function (x) { return x && x.dosya; });
    if (!h) return null;
    var a = el("a", "dosya-satir"); a.dataset.d = h.dosya[0]; a.dataset.dal = h.dosya[1];
    if (V) setTimeout(function () { doldur(a.parentNode || document); }, 0); else bekleyen.push(a);
    return a;
  }

  var NS = "http://www.w3.org/2000/svg";
  function svg(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var GUN = 864e5;
  // Dalların son 14 günü: her dal bir ince çizgi, her olay bir nokta (dosya sayfasındaki ağacın küçüğü)
  function agac(ds, en, isimli) {
    var dallar = ds.dallar.slice(0, en), bugun = Math.floor(Date.now() / GUN), bas = bugun - 13;
    var kap = el("div", "dsk-agac" + (isimli ? " isimli" : ""));
    dallar.forEach(function (dal) {
      var sat = el("div", "dsk-dal");
      var ad_ = el("span", "dsk-dal-ad"); ad_.appendChild(el("i", "dsk-nokta dsk-" + dal.durum)); ad_.appendChild(el("span", null, ad(dal)));
      if (isimli) sat.appendChild(ad_); else sat.title = ad(dal);
      var s = svg("svg", { viewBox: "0 0 140 12", preserveAspectRatio: "none", "aria-hidden": "true", class: "dsk-cizgi dsk-" + dal.durum });
      var xs = dal.olaylar.map(function (o) { return Math.floor(Date.parse(o.g + "T12:00:00Z") / GUN) - bas; }).filter(function (g) { return g >= 0 && g <= 13; });
      s.appendChild(svg("line", { x1: 0, x2: 140, y1: 6, y2: 6, class: "dsk-zemin" }));
      if (xs.length) s.appendChild(svg("line", { x1: xs[0] * 10 + 5, x2: xs[xs.length - 1] * 10 + 5, y1: 6, y2: 6, class: "dsk-kol" }));
      var gor = {};
      xs.forEach(function (g) { if (gor[g]) return; gor[g] = 1; s.appendChild(svg("circle", { cx: g * 10 + 5, cy: 6, r: 3.2, class: "dsk-olay" })); });
      sat.appendChild(s);
      kap.appendChild(sat);
    });
    return kap;
  }
  function kapak(ds, buyuk) {
    var k = el("div", "dsk-kapak");
    if (ds.gorsel && ds.gorsel.u) {
      var im = document.createElement("img");
      im.src = (window.AKTAR || function (v) { return v; })(ds.gorsel.u, buyuk ? 1200 : 640);
      im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer";
      var kn = ds.gorsel.k ? el("span", "dsk-kunye", ds.gorsel.k) : null;
      im.onerror = function () { im.remove(); if (kn) kn.remove(); k.classList.add("dsk-desen"); };
      k.appendChild(im);
      if (kn) k.appendChild(kn);
    } else k.classList.add("dsk-desen");
    return k;
  }
  function ilkCumleler(t, n) { var p = String(t || "").split(/(?<=[.!?])\s+/); return p.slice(0, n).join(" "); }
  function kart(ds, buyuk) {
    var a = el("a", "dsk" + (buyuk ? " dsk-buyuk" : "")); a.href = "d/" + encodeURIComponent(ds.id) + ".html";
    a.appendChild(kapak(ds, buyuk));
    var ic = el("div", "dsk-ic");
    var ust = el("div", "dsk-ust");
    var r = el("span", "dsk-rozet" + (ds.sicak ? " sicak" : ""));
    r.textContent = ds.sicak ? (EN() ? "New in " + ds.sicak + (ds.sicak > 1 ? " threads" : " thread") : "Son 48 saat · " + ds.sicak + " başlıkta gelişme")
      : (EN() ? "Developing" : "Gelişiyor");
    ust.appendChild(r);
    var geri = ds.dallar.find(function (x) { return x.yeniden; });
    if (geri) ust.appendChild(el("span", "dsk-rozet geri", EN() ? "Back after " + geri.yeniden + " days" : geri.yeniden + " gün aradan sonra gündemde"));
    ic.appendChild(ust);
    ic.appendChild(el("h3", null, ad(ds)));
    var oz = EN() ? ds.ozet_en : ds.ozet;
    if (buyuk && oz) ic.appendChild(el("p", "dsk-oz", ilkCumleler(oz, 2)));
    ic.appendChild(el("p", "dsk-son", (EN() ? "Latest · " : "Son · ") + ((EN() && ds.son_be) || ds.son_b)));
    ic.appendChild(agac(ds, buyuk ? 5 : 3, buyuk));
    ic.appendChild(el("span", "dsk-alt", ds.olay + (EN() ? " events · " : " olay · ") + ds.dallar.length + (EN() ? " threads · last 14 days" : " başlık · son 14 gün")));
    a.appendChild(ic);
    return a;
  }
  var dene = 0;
  function serit() {
    if (!V || !V.dosyalar.length || document.getElementById("dosyaSerit")) return;
    var s = el("section", "dosya-bolum"); s.id = "dosyaSerit"; s.setAttribute("aria-label", EN() ? "Files" : "Dosyalar");
    var ic0 = el("div", "dsb-ic");
    var bas = el("div", "dsb-bas"), sol = el("div", "dsb-sol");
    var et = el("span", "dsb-etiket"); et.appendChild(el("i", "dsb-canli")); et.appendChild(document.createTextNode(EN() ? "Files · updated every 15 minutes" : "Dosyalar · 15 dakikada bir güncellenir"));
    sol.appendChild(et);
    sol.appendChild(el("h2", null, EN() ? "The stories that won’t leave the agenda" : "Gündemden düşmeyenler"));
    sol.appendChild(el("p", null, EN() ? "Weeks-long stories, thread by thread: every development with how each outlet told it, the original links and an archive copy."
      : "Haftalardır konuşulan büyük hikâyeler, başlık başlık: her gelişme, onu veren yayınların nasıl anlattığı, özgün bağlantısı ve arşiv kopyasıyla."));
    bas.appendChild(sol);
    var sag = el("div", "dsb-sag");
    var top = V.dosyalar.reduce(function (t, ds) { return t + ds.olay; }, 0), sicak = V.dosyalar.reduce(function (t, ds) { return t + ds.sicak; }, 0);
    [[V.dosyalar.length, EN() ? "files" : "dosya"], [top, EN() ? "events" : "olay"], [sicak, EN() ? "moving now" : "hareketli başlık"]].forEach(function (x) {
      var k = el("span", "dsb-sayi"); k.appendChild(el("b", null, x[0])); k.appendChild(el("small", null, x[1])); sag.appendChild(k);
    });
    var tum = el("a", "dsb-tum", EN() ? "All files →" : "Tüm dosyalar →"); tum.href = "d/"; sag.appendChild(tum);
    bas.appendChild(sag);
    ic0.appendChild(bas);
    var izgara = el("div", "dsb-izgara");
    V.dosyalar.slice(0, 5).forEach(function (ds, i) { izgara.appendChild(kart(ds, i === 0)); });
    ic0.appendChild(izgara);
    s.appendChild(ic0);
    // sayfanın ortasına doğru: masaüstünde gündem, karşılaştırmalar ve analizlerden sonra; telefonda ilk haber bölümünden sonra
    var tel = window.matchMedia && matchMedia("(max-width:700px)").matches;
    if (tel) {
      var hb = document.querySelector(".hb > .hb-bolum:not(.hb-son)") || document.querySelector(".hb > .hb-manset");
      if (hb) {
        hb.parentNode.insertBefore(s, hb.nextSibling);
        var tk = document.querySelector("main.duzen > .tarihce-kart");   // tarihçe kartı da dosyaların ardından
        if (tk) s.parentNode.insertBefore(tk, s.nextSibling);
        return;
      }
      if (dene < 15) return;
    }
    var hedef = document.getElementById("enine") || document.getElementById("sayacSerit") || document.getElementById("suzgec");
    if (hedef) hedef.parentNode.insertBefore(s, hedef);
  }

  fetch("data/dosyalar-site.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
    if (!v || !Array.isArray(v.dosyalar)) return;
    v.dmap = {};
    v.dosyalar.forEach(function (ds) { ds.dalmap = {}; ds.dallar.forEach(function (x) { ds.dalmap[x.id] = x; }); v.dmap[ds.id] = ds; });
    V = v;
    doldur(); bekleyen = [];
    (function kur() { serit(); if (!document.getElementById("dosyaSerit") && ++dene < 20) setTimeout(kur, 400); })();
  }).catch(function () {});
  window.DosyaSatir = { satir: satir, doldur: doldur };
})();
