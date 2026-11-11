// Dr. Hüsam Ebu Safiye sayacı: 27 Aralık 2024'ten (Kemal Advan Hastanesi baskını) bu yana geçen gün.
// [data-sayac="gun"] öğelerine gün sayısını, [data-sayac="ayrinti"] öğelerine yıl/ay/gün dökümünü yazar.
(function () {
  "use strict";
  var EN = window.DIL === "en", BAS = Date.UTC(2024, 11, 27);
  function yaz() {
    var simdi = new Date(), bugun = Date.UTC(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
    var gun = Math.floor((bugun - BAS) / 864e5);
    var yil = 0, ay = 0, d = new Date(BAS), son = new Date(bugun);
    while (true) { var x = new Date(d); x.setUTCFullYear(x.getUTCFullYear() + 1); if (x > son) break; d = x; yil++; }
    while (true) { var y = new Date(d); y.setUTCMonth(y.getUTCMonth() + 1); if (y > son) break; d = y; ay++; }
    var kalan = Math.round((son - d) / 864e5);
    var sayi = gun.toLocaleString(window.YEREL || (EN ? "en-GB" : "tr-TR"));
    document.querySelectorAll('[data-sayac="gun"]').forEach(function (e) { e.textContent = sayi; });
    var t = EN ? (yil ? yil + (yil > 1 ? " years, " : " year, ") : "") + ay + (ay === 1 ? " month, " : " months, ") + kalan + (kalan === 1 ? " day" : " days")
      : (yil ? yil + " yıl " : "") + ay + " ay " + kalan + " gün";
    document.querySelectorAll('[data-sayac="ayrinti"]').forEach(function (e) { e.textContent = t; });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", yaz); else yaz();
  setInterval(yaz, 60000);
})();
// Sayfadaki gün ızgarası: her kare bir gün; ay başlarında etiket
(function () {
  "use strict";
  function ciz() {
    var k = document.getElementById("gunIzgara"); if (!k) return;
    var EN = window.DIL === "en", YER = window.YEREL || (EN ? "en-GB" : "tr-TR");
    var bas = Date.UTC(2024, 11, 27), s = new Date(), bugun = Date.UTC(s.getFullYear(), s.getMonth(), s.getDate());
    k.innerHTML = "";
    for (var t = bas; t <= bugun; t += 864e5) {
      var d = new Date(t), i = document.createElement("i");
      if (d.getUTCDate() === 1) { i.className = "ay"; i.setAttribute("data-ay", d.toLocaleDateString(YER, { month: "short", year: d.getUTCMonth() === 0 ? "numeric" : undefined, timeZone: "UTC" })); }
      i.title = d.toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      k.appendChild(i);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ciz); else ciz();
})();
