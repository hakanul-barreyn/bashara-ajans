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
  // Son 14 günün gelişme sayısı (gün gün çubuk) ve öne çıkan başlıklar: ne kadar hareketli, nerede hareketli
  function gunFark(g) { return Math.floor(Date.now() / GUN) - Math.floor(Date.parse(g + "T12:00:00Z") / GUN); }
  function oncesi(g) { var f = gunFark(g); return f <= 0 ? (EN() ? "today" : "bugün") : f === 1 ? (EN() ? "yesterday" : "dün") : f + (EN() ? " days ago" : " gün önce"); }
  var AYK = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  function agac(ds, en) {
    var kap = el("div", "dsk-grafik");
    var say = []; for (var i = 0; i < 14; i++) say.push(0);
    ds.dallar.forEach(function (dal) { dal.olaylar.forEach(function (o) { var f = gunFark(o.g); if (f >= 0 && f < 14) say[13 - f]++; }); });
    var tepe = Math.max.apply(null, say.concat([1])), toplam = say.reduce(function (a, b) { return a + b; }, 0);
    kap.appendChild(el("span", "dsk-g-et", (EN() ? "Developments per day, last 14 days · " : "Son 14 gün, günlük gelişme · ") + toplam));
    var cubuklar = el("div", "dsk-cubuklar"); cubuklar.setAttribute("role", "img");
    cubuklar.setAttribute("aria-label", (EN() ? "Developments per day over the last 14 days: " : "Son 14 günde günlük gelişme sayısı: ") + say.join(", "));
    say.forEach(function (n, j) {
      var gun = new Date((Math.floor(Date.now() / GUN) - (13 - j)) * GUN);
      var c = el("i", n ? null : "sifir"); c.style.height = (n ? Math.max(12, Math.round(n / tepe * 100)) : 4) + "%";
      c.title = gun.getUTCDate() + " " + AYK[gun.getUTCMonth()] + ": " + n + (EN() ? " developments" : " gelişme");
      cubuklar.appendChild(c);
    });
    kap.appendChild(cubuklar);
    var eks = el("div", "dsk-eksen"); eks.appendChild(el("span", null, EN() ? "14 days ago" : "14 gün önce")); eks.appendChild(el("span", null, EN() ? "today" : "bugün")); kap.appendChild(eks);
    var liste = el("ul", "dsk-basliklar");
    ds.dallar.map(function (dal) { var son = dal.olaylar.reduce(function (m, o) { return o.g > m ? o.g : m; }, ""); return [dal, son]; })
      .sort(function (x, y) { return x[1] < y[1] ? 1 : -1; }).slice(0, en).forEach(function (x) {
        var li = el("li", "dsk-" + x[0].durum);
        li.appendChild(el("b", null, ad(x[0])));
        li.appendChild(el("small", null, x[0].olaylar.length + (EN() ? " events · latest " : " olay · son: ") + (x[1] ? oncesi(x[1]) : "–")));
        liste.appendChild(li);
      });
    kap.appendChild(liste);
    return kap;
  }
  // Sabit kapak: dosyanın yerinin uydu görüntüsü (gorsel dalı, uydu/dosya). Yoksa haberden gelen görsel.
  var KAPAK = null;
  function kapak(ds, buyuk) {
    var k = el("div", "dsk-kapak");
    var u = KAPAK && KAPAK[ds.id], src = null, kunye = null;
    if (u && u.dosya) { src = "data/gorsel/uydu/dosya/" + u.dosya; kunye = ((EN() && u.yer_en) || u.yer) + " · Copernicus Sentinel-2 (ESA)"; k.classList.add("dsk-uydu"); }
    else if (ds.gorsel && ds.gorsel.u) { src = (window.AKTAR || function (v) { return v; })(ds.gorsel.u, buyuk ? 1200 : 640); kunye = ds.gorsel.k; }
    if (src) {
      var im = document.createElement("img");
      im.src = src; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer";
      var kn = kunye ? el("span", "dsk-kunye", kunye) : null;
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
    ic.appendChild(agac(ds, buyuk ? 4 : 2));
    ic.appendChild(el("span", "dsk-alt", ds.olay + (EN() ? " events in total · " : " olay · ") + ds.dallar.length + (EN() ? " threads" : " başlık")));
    a.appendChild(ic);
    return a;
  }
  var dene = 0;
  function serit() {
    if (!V || !V.dosyalar.length || document.getElementById("dosyaSerit")) return;
    var s = el("section", "dosya-bolum"); s.id = "dosyaSerit"; s.setAttribute("aria-label", EN() ? "Files" : "Dosyalar");
    var ic0 = el("div", "dsb-ic");
    var bas = el("div", "dsb-bas"), sol = el("div", "dsb-sol");
    var et = el("span", "dsb-etiket"); et.appendChild(el("i", "dsb-canli")); et.appendChild(document.createTextNode(EN() ? "Ongoing developments · updated every 15 minutes" : "Süregelen gelişmeler · 15 dakikada bir güncellenir"));
    sol.appendChild(et);
    sol.appendChild(el("h2", null, EN() ? "Files we follow" : "Takip edilen dosyalar"));
    sol.appendChild(el("p", null, EN() ? "Stories that have been running for weeks, followed thread by thread: every development, how each outlet reported it, the original link and an archive copy."
      : "Haftalardır süren konular, başlık başlık: her gelişme, onu veren yayınların nasıl anlattığı, özgün bağlantısı ve arşiv kopyasıyla."));
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

  var kapakSoz = fetch("data/gorsel/uydu/dosya/dosya.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  fetch("data/dosyalar-site.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) { return kapakSoz.then(function (kp) { KAPAK = kp; return v; }); }).then(function (v) {
    if (!v || !Array.isArray(v.dosyalar)) return;
    v.dmap = {};
    v.dosyalar.forEach(function (ds) { ds.dalmap = {}; ds.dallar.forEach(function (x) { ds.dalmap[x.id] = x; }); v.dmap[ds.id] = ds; });
    V = v;
    doldur(); bekleyen = [];
    (function kur() { serit(); if (!document.getElementById("dosyaSerit") && ++dene < 20) setTimeout(kur, 400); })();
  }).catch(function () {});
  window.DosyaSatir = { satir: satir, doldur: doldur };
})();
