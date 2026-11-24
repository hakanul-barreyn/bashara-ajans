/* aciklamalar.html: data/aciklamalar.json'dan tarafların açıklamaları; tarafa ve türe göre süzgeç. */
(function () {
  "use strict";
  var EN = document.documentElement.lang === "en" || /[?&]dil=en/.test(location.search) || (window.DIL && window.DIL === "en");
  var TUR = { askeri: ["Askerî iddia", "Military claim"], siyasi: ["Siyasi", "Political"], insani: ["İnsani", "Humanitarian"], diger: ["Diğer", "Other"] };
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function el(t, c, m) { var e = document.createElement(t); if (c) e.className = c; if (m != null) e.textContent = m; return e; }
  function zaman(s) {
    var d = new Date(s); if (isNaN(d)) return "";
    var t = new Date(d.getTime() + 3 * 3600e3), hh = String(t.getUTCHours()).padStart(2, "0") + "." + String(t.getUTCMinutes()).padStart(2, "0");
    return EN ? t.getUTCDate() + " " + AY_EN[t.getUTCMonth()] + " · " + hh : t.getUTCDate() + " " + AY[t.getUTCMonth()] + " · " + hh;
  }
  var liste = document.querySelector(".ac-liste"), suz = document.querySelector(".ac-suz"), V = [], secili = "";
  function ciz() {
    liste.textContent = "";
    var g = V.filter(function (a) { return !secili || a.taraf === secili; });
    if (!g.length) { liste.appendChild(el("li", "ac-bos", EN ? "No statements in the last 14 days." : "Son 14 günde açıklama yok.")); return; }
    g.forEach(function (a) {
      var li = el("li", "ac-oge"), ust = el("div", "ac-ust");
      ust.append(el("span", "ac-taraf", EN ? a.taraf_en : a.taraf), el("time", null, zaman(a.tarih)), el("span", "ac-tur", (TUR[a.tur] || TUR.diger)[EN ? 1 : 0]));
      li.append(ust, el("h2", null, EN && a.baslik_en ? a.baslik_en : a.baslik), el("p", null, EN && a.ozet_en ? a.ozet_en : a.ozet));
      liste.appendChild(li);
    });
  }
  fetch("data/aciklamalar.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { aciklamalar: [] }; })
    .catch(function () { return { aciklamalar: [] }; })
    .then(function (d) {
      V = d.aciklamalar || [];
      var taraflar = []; V.forEach(function (a) { if (taraflar.indexOf(a.taraf) < 0) taraflar.push(a.taraf); });
      if (taraflar.length > 1) {
        [""].concat(taraflar).forEach(function (t) {
          var b = el("button", null, t ? (EN ? (V.find(function (a) { return a.taraf === t; }) || {}).taraf_en || t : t) : (EN ? "All" : "Tümü"));
          b.type = "button"; b.setAttribute("aria-pressed", String(t === secili));
          b.onclick = function () { secili = t; suz.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); ciz(); };
          suz.appendChild(b);
        });
      }
      ciz();
    });
})();
