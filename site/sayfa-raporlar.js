/* Raporlar girişi: "İsimleri vardı" şeridine sıfır yaşında öldürülen çocukların adları, Ebu Safiye şeridine gün sayacı */
(function () {
  "use strict";
  var EN = window.DIL === "en";
  var ad = document.getElementById("rkAdlar");
  if (ad) fetch("data/isimler/yas-0.json").then(function (r) { return r.json(); }).then(function (L) {
    ad.textContent = L.slice(0, 160).map(function (x) { return x[1] || x[0]; }).join(" · ");
  }).catch(function () {});
  var g = document.getElementById("rkGun");
  if (g) {
    var gun = Math.floor((Date.now() - Date.parse("2024-12-27T00:00:00Z")) / 864e5);
    g.textContent = EN ? "day " + gun.toLocaleString("en-GB") + " in detention" : "tutukluluğunun " + gun.toLocaleString("tr-TR") + ". günü";
  }
})();
