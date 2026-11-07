// SİTENİN ADI VE TANITIM YAZILARI: yalnızca bu dosyayı değiştir.
// Sayfalar, sekme başlıkları, uygulama simgesi adı (manifest) ve RSS başlığı buradan okunur.
// Toplayıcı (toplayici/marka.py) aşağıdaki süslü parantezler arasındaki JSON'u okur; JSON biçimini bozma.
window.MARKA = {
  "ad": "ZBS",
  "kisa_ad": "ZBS",
  "slogan": "Mağrip’ten Körfez’e basının Türkçe takibi",
  "aciklama": "Mağrip'ten Körfez'e, Meşrik'ten Anadolu'ya basının Türkçe takibi.",
  "goatcounter": ""
};

// Sayfadaki data-marka="ad|kisa_ad|slogan|aciklama" öğelerini ve {ad} geçen başlıkları doldurur.
(function () {
  var M = window.MARKA;
  var yaz = function (s) { return String(s).replace(/\{(\w+)\}/g, function (_, k) { return M[k] != null ? M[k] : ""; }); };
  var t = document.querySelector("title[data-marka-sablon]");
  if (t) document.title = yaz(t.getAttribute("data-marka-sablon"));
  var doldur = function () {
    document.querySelectorAll("[data-marka]").forEach(function (e) { e.textContent = M[e.getAttribute("data-marka")] || ""; });
    document.querySelectorAll("[data-marka-sablon]:not(title)").forEach(function (e) {
      var a = e.getAttribute("data-marka-oznitelik");
      if (a) e.setAttribute(a, yaz(e.getAttribute("data-marka-sablon"))); else e.textContent = yaz(e.getAttribute("data-marka-sablon"));
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", doldur); else doldur();
  // Ziyaret sayacı (GoatCounter): çerez kullanmaz; yalnızca "goatcounter" alanı doluysa yüklenir
  if (M.goatcounter && /^[a-z0-9-]+$/.test(M.goatcounter)) {
    var g = document.createElement("script");
    g.async = true; g.src = "https://gc.zgo.at/count.js";
    g.setAttribute("data-goatcounter", "https://" + M.goatcounter + ".goatcounter.com/count");
    document.head.appendChild(g);
  }
})();
