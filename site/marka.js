// SİTENİN ADI VE TANITIM YAZILARI: yalnızca bu dosyayı değiştir.
// Sayfalar, sekme başlıkları, uygulama simgesi adı (manifest) ve RSS başlığı buradan okunur.
// Toplayıcı (toplayici/marka.py) aşağıdaki süslü parantezler arasındaki JSON'u okur; JSON biçimini bozma.
window.MARKA = {
  "ad": "Alboroto",
  "kisa_ad": "Alboroto",
  "slogan": "Haberin haberi",
  "aciklama": "Mağrip'ten Körfez'e, Meşrik'ten Anadolu'ya basının Türkçe takibi.",
  "slogan_en": "The news about the news",
  "aciklama_en": "Following the press of the Maghreb, the Gulf, the Mashriq and Anatolia, with summaries and a balance of who told the story how.",
  "goatcounter": "zbshaber",
  "adres": "https://alborotonews.com/"
};

// Sayfadaki data-marka="ad|kisa_ad|slogan|aciklama" öğelerini ve {ad} geçen başlıkları doldurur.
(function () {
  var M = window.MARKA;
  var D = window.DIL || "tr", T = window.T || function (x) { return x; };
  var al = function (k) { return (D !== "tr" && M[k + "_" + D] != null) ? M[k + "_" + D] : M[k]; };
  var yaz = function (s) { return String(T(s)).replace(/\{(\w+)\}/g, function (_, k) { var v = al(k); return v != null ? v : ""; }); };
  var t = document.querySelector("title[data-marka-sablon]");
  if (t) document.title = yaz(t.getAttribute("data-marka-sablon"));
  var doldur = function () {
    document.querySelectorAll("[data-marka]").forEach(function (e) { e.textContent = al(e.getAttribute("data-marka")) || ""; });
    document.querySelectorAll("[data-marka-sablon]:not(title)").forEach(function (e) {
      var a = e.getAttribute("data-marka-oznitelik");
      if (a) e.setAttribute(a, yaz(e.getAttribute("data-marka-sablon"))); else e.textContent = yaz(e.getAttribute("data-marka-sablon"));
    });
  };
  // Slogan, marka adıyla aynı taban çizgisine oturur: iki yazının taban çizgisi ölçülür, slogan farkı kadar kaydırılır
  // (yazı tipleri farklı olduğu için dikeyde ortalamak taban çizgilerini hizalamıyor)
  var taban = function (e) {
    var i = document.createElement("i"); i.style.cssText = "display:inline-block;width:0;height:0;vertical-align:baseline";
    e.appendChild(i); var y = i.getBoundingClientRect().top; i.remove(); return y;
  };
  var hizala = function () {
    var ad = document.querySelector(".ust .marka-ad");
    var sl = [].filter.call(document.querySelectorAll(".ust .slogan"), function (x) { return x.offsetParent && !x.hidden; })[0];
    if (!ad || !sl) return;
    sl.style.transform = "";
    var d = taban(ad) - taban(sl);
    if (Math.abs(d) < 12) sl.style.transform = "translateY(" + d.toFixed(1) + "px)";
  };
  var hazir = function () {
    doldur(); hizala();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hizala);
    addEventListener("resize", hizala);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hazir); else hazir();
  // Ziyaret sayacı (GoatCounter): çerez kullanmaz; yalnızca "goatcounter" alanı doluysa yüklenir
  if (M.goatcounter && /^[a-z0-9-]+$/.test(M.goatcounter)) {
    var g = document.createElement("script");
    g.async = true; g.src = "https://gc.zgo.at/count.js";
    g.setAttribute("data-goatcounter", "https://" + M.goatcounter + ".goatcounter.com/count");
    document.head.appendChild(g);
  }
})();
