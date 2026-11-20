/* Dosyalar (süren olaylar): ana sayfadaki dosya şeridi ve kartlardaki "Dosya › dal" satırı.
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

  function nabiz(sayilar) {
    var NS = "http://www.w3.org/2000/svg", w = 84, h = 24, m = Math.max.apply(null, sayilar) || 1, bw = w / sayilar.length;
    var sv = document.createElementNS(NS, "svg"); sv.setAttribute("viewBox", "0 0 " + w + " " + h); sv.setAttribute("width", w); sv.setAttribute("height", h); sv.setAttribute("aria-hidden", "true");
    sayilar.forEach(function (c, i) {
      var r = document.createElementNS(NS, "rect"), bh = c ? Math.max(2, c / m * (h - 2)) : 1;
      r.setAttribute("x", (i * bw + 1).toFixed(1)); r.setAttribute("y", (h - bh).toFixed(1)); r.setAttribute("width", (bw - 2).toFixed(1)); r.setAttribute("height", bh.toFixed(1));
      r.setAttribute("class", c ? "ds-nb" : "ds-nb0"); sv.appendChild(r);
    });
    return sv;
  }
  var dene = 0;
  function serit() {
    if (!V || !V.dosyalar.length || document.getElementById("dosyaSerit")) return;
    var s = el("section", "dosya-serit"); s.id = "dosyaSerit"; s.setAttribute("aria-label", EN() ? "Ongoing files" : "Süren dosyalar");
    var bas = el("div", "dsr-bas");
    bas.appendChild(el("h2", null, EN() ? "Ongoing files" : "Süren dosyalar"));
    var tum = el("a", null, EN() ? "All files →" : "Tüm dosyalar →"); tum.href = "d/"; bas.appendChild(tum);
    s.appendChild(bas);
    var kap = el("div", "dsr-kartlar");
    V.dosyalar.slice(0, 8).forEach(function (ds) {
      var a = el("a", "dsr-kart"); a.href = "d/" + encodeURIComponent(ds.id) + ".html";
      var r = el("span", "ds-rozet ds-" + (ds.sicak ? "sicak" : "suruyor"));
      r.textContent = ds.sicak ? (EN() ? ds.sicak + " active" : ds.sicak + " dal sıcak") : (EN() ? "ongoing" : "sürüyor");
      var geri = ds.dallar.find(function (x) { return x.yeniden; });
      a.appendChild(r);
      a.appendChild(el("b", null, ad(ds)));
      a.appendChild(el("span", "dsr-son", (EN() ? "Latest: " : "Son: ") + ((EN() && ds.son_be) || ds.son_b)));
      if (geri) a.appendChild(el("em", "ds-geri", (EN() ? "Back: " : "Yeniden gündemde: ") + ad(geri)));
      var alt = el("span", "dsr-alt"); alt.appendChild(el("span", null, ds.olay + (EN() ? " events · " : " olay · ") + ds.dallar.length + (EN() ? " threads" : " dal")));
      alt.appendChild(nabiz(ds.nabiz)); a.appendChild(alt);
      kap.appendChild(a);
    });
    s.appendChild(kap);
    // telefonda (deste) bölge sekmelerinin altı; masaüstünde gündemin üstü
    var sekme = document.querySelector(".hb-bolgeler"), tel = window.matchMedia && matchMedia("(max-width:700px)").matches;
    if (tel && sekme) sekme.parentNode.insertBefore(s, sekme.nextSibling);
    else if (tel && dene < 15) return;   // telefonda bölge sekmeleri henüz çizilmedi
    else { var g = document.getElementById("gundem"); if (g) g.parentNode.insertBefore(s, g); else return; }
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
