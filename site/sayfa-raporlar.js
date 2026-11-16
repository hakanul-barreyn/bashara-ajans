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
/* Şerit fotoğraflarının künyesi (Commons; CC BY-SA ve kamu malı) */
(function () {
  "use strict";
  var EN = window.DIL === "en", k = document.getElementById("rkKunye");
  if (!k) return;
  fetch("data/gorsel/kapak/kapak.json").then(function (r) { return r.json(); }).then(function (L) {
    var kul = {};
    document.querySelectorAll(".rk-foto").forEach(function (a) { var m = (a.getAttribute("style") || "").match(/kapak\/([^.]+)\./); if (m) kul[m[1]] = 1; });
    k.appendChild(document.createTextNode(EN ? "Photos (Wikimedia Commons): " : "Fotoğraflar (Wikimedia Commons): "));
    L.filter(function (x) { return kul[x.ad]; }).forEach(function (x, i) {
      if (i) k.appendChild(document.createTextNode(" · "));
      var a = document.createElement("a"); a.href = x.sayfa; a.rel = "noopener"; a.target = "_blank";
      a.textContent = (EN ? x.en : x.tr) + ", " + x.yazar.replace(/^Unknown author.*/, EN ? "unknown photographer" : "fotoğrafçısı bilinmiyor") + ", " + x.lisans;
      k.appendChild(a);
    });
    k.appendChild(document.createTextNode(EN ? " · Satellite: Copernicus Sentinel-2." : " · Uydu: Copernicus Sentinel-2."));
  }).catch(function () {});
})();
