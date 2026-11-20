// Rachel Corrie sayfası: kapak fotoğrafının künyesini (yazar, lisans) gorsel dalındaki kapak.json'dan yazar;
// görsel yüklenmezse figürü gizler.
(function () {
  "use strict";
  var EN = window.DIL === "en", f = document.getElementById("rcFoto"), k = document.getElementById("rcKunye");
  if (!f) return;
  var im = f.querySelector("img");
  im.addEventListener("error", function () { f.hidden = true; });
  if (im.complete && !im.naturalWidth) f.hidden = true;
  fetch("data/gorsel/tarihce/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).then(function (L) {
    var g = (L || []).filter(function (x) { return x.ad === "rachel-corrie-2003"; })[0];
    if (!g || !k) return;
    if (g.dosya) im.src = "data/gorsel/tarihce/" + g.dosya;
    var yazar = (new DOMParser().parseFromString(g.yazar || "", "text/html").body.textContent || "").trim();
    k.textContent = (EN ? g.en : g.tr) + (yazar ? " · " + (EN ? "Photo: " : "Fotoğraf: ") + yazar : "") + " · ";
    var a = document.createElement("a"); a.href = g.sayfa || g.lisans_url || "#"; a.target = "_blank"; a.rel = "noopener";
    a.textContent = (g.lisans || "Wikimedia Commons"); k.appendChild(a);
  }).catch(function () {});
})();
