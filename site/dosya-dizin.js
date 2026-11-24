/* /d/ dizini: bölge sekmeleri kartları süzer. */
(function () {
  "use strict";
  var sek = document.querySelector(".dsd-sekme"); if (!sek) return;
  sek.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    sek.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    var bolge = b.dataset.bolge;
    document.querySelectorAll(".dsd-kart").forEach(function (k) { k.hidden = !!bolge && k.dataset.bolge !== bolge; });
  });
})();
