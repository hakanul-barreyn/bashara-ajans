// Ebu Safiye sayfası: bağlantıyı kopyala
(function () {
  "use strict";
  var b = document.getElementById("hkKopya"); if (!b) return;
  b.addEventListener("click", function () {
    var u = location.href.split("#")[0], ok = function () { b.firstElementChild && (b.dataset.eski = b.innerHTML); b.textContent = window.DIL === "en" ? "Copied" : "Kopyalandı"; };
    if (navigator.clipboard) navigator.clipboard.writeText(u).then(ok, function () { prompt("", u); }); else prompt("", u);
  });
})();
