/* Masaüstü ana sayfa: logo kirişinin altındaki bölge sekmeleri.
   Telefondaki .hb-bolgeler ile aynı liste; tıklanınca #fKonu süzgecindeki konu çipine basar,
   çiplerin aria-pressed durumunu izleyerek seçili sekmeyi eşler. */
(function () {
  "use strict";
  var SEKMELER = [["", "Gündem", "Top stories"], ["Gazze", "Gazze", "Gaza"], ["Batı Şeria", "Batı Şeria", "West Bank"],
    ["Kudüs", "Kudüs", "Jerusalem"], ["Lübnan", "Lübnan", "Lebanon"], ["Yemen ve Kızıldeniz", "Yemen", "Yemen"],
    ["İran", "İran", "Iran"], ["Suriye", "Suriye", "Syria"]];
  var ust = document.querySelector("header.ust");
  if (!ust || ust.querySelector(".ust-bolgeler")) return;
  var en = window.DIL === "en";
  var kus = document.createElement("div"); kus.className = "ust-bolgeler-kus";
  var nav = document.createElement("nav"); nav.className = "ust-bolgeler";
  nav.setAttribute("aria-label", en ? "Regions" : "Bölgeler");
  SEKMELER.forEach(function (s) {
    var b = document.createElement("button"); b.type = "button"; b.dataset.k = s[0];
    b.textContent = en ? s[2] : s[1]; b.setAttribute("aria-pressed", s[0] === "" ? "true" : "false");
    b.onclick = function () {
      var cip = null;
      document.querySelectorAll("#fKonu .cip").forEach(function (c) { if (c.dataset.k === s[0]) cip = c; });
      if (cip) cip.click();
      eslestir(s[0]);
      // seçilen bölgenin haberleri görünsün: Gündem en üste, bölge süzgeç ve akışın başına
      var hedef = s[0] ? document.getElementById("suzgec") : null, dur = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      if (!hedef) { scrollTo({ top: 0, behavior: dur }); return; }
      scrollTo({ top: Math.max(0, hedef.getBoundingClientRect().top + scrollY - ust.getBoundingClientRect().height - 10), behavior: dur });
    };
    nav.appendChild(b);
  });
  kus.appendChild(nav);
  var ic = ust.querySelector(".ust-ic");
  ic.parentNode.insertBefore(kus, ic.nextSibling);

  function eslestir(k) {
    nav.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === k)); });
  }
  function cipten() {
    var secili = document.querySelector('#fKonu .cip[aria-pressed="true"]');
    if (secili) eslestir(secili.dataset.k);
  }
  var kutu = document.getElementById("fKonu");
  if (kutu && "MutationObserver" in window) {
    new MutationObserver(cipten).observe(kutu, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed"] });
  }
})();
