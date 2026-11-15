// Düzeltmeler sayfası: kayıt site/duzeltmeler.json'dan ([{tarih, sayfa, metin, metin_en}]), iletişim adresi marka.js'ten
(function () {
  "use strict";
  var EN = window.DIL === "en", adr = (window.MARKA && window.MARKA.iletisim) || "";
  if (adr) document.querySelectorAll("[data-iletisim]").forEach(function (e) { e.textContent = adr; });
  fetch("site/duzeltmeler.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (L) {
    if (!L || !L.length) return;
    var ol = document.getElementById(EN ? "dzKayitEn" : "dzKayit"); ol.textContent = "";
    L.slice().sort(function (a, b) { return a.tarih < b.tarih ? 1 : -1; }).forEach(function (x) {
      var li = document.createElement("li"), t = document.createElement("time"); t.textContent = x.tarih; li.appendChild(t);
      var p = document.createElement("p"); p.textContent = (EN && x.metin_en) || x.metin; li.appendChild(p);
      if (x.sayfa) { var a = document.createElement("a"); a.href = x.sayfa; a.textContent = EN ? "Page →" : "Sayfa →"; li.appendChild(a); }
      ol.appendChild(li);
    });
  }).catch(function () {});
})();
