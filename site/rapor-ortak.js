// Raporların ortak araçları: açılır kapanır lejant, baskı görünümü ve yazdır.
(function () {
  "use strict";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var GRUP = [
    ["#1f7a52", "Bölge basını", "Arap dünyası, İran, Türkiye ve bölgedeki diğer yayınlar (İsrail yanlısı çizgidekiler hariç). Alışma raporunda Türkiye ayrı gösterilir."],
    ["#7a3fa0", "Türkiye basını", "Türkiye’deki yayınlar (yalnızca alışma ve liderler raporlarında ayrı)."],
    ["#2f5bb7", "İsrail basını", "İsrail’de yayımlanan gazeteler; örneklem küçük."],
    ["#8a6d3b", "Batı ana akım basını", "ABD ve Avrupa’nın büyük gazeteleri, yayın kuruluşları ve ajansları."],
    ["#c9544e", "Batı’da muhalif basın", "Batı’da ana akımın dışında, eleştirel çizgideki yayınlar."]
  ];
  var TERIM = [
    ["Savaş payı", "Bir grubun bütün başlıkları içinde Gazze, Batı Şeria, Kudüs, Lübnan ya da İsrail geçenlerin yüzdesi (yalnızca İran’la ilgili olanlar hariç)."],
    ["Binde", "Bin başlıkta kaç kez geçtiği."],
    ["Tepki endeksi", "Bir olayın penceresinde (bir gün önce, iki gün sonra) grubun o türden başlık payı; türün ilk büyük olayı 100."],
    ["İzleme oranı", "Bir grubun olaylara ayırdığı payın bölge basınının ayırdığı paya oranı. %100 = bölge basını kadar."],
    ["Gri çubuklar", "Gazze Sağlık Bakanlığı’nın bildirdiği ölümler."],
    ["Kırmızı rakam", "Belirgin düşüş ya da artış olmaması."],
    ["Kesikli çizgi", "Önemli bir tarih (seçim, karar) ya da 100 / %100 düzeyi."]
  ];
  var bas = document.querySelector(".rp-bas");
  if (!bas) return;
  // lejant
  var d = el("details", "rp-lejant"), s = el("summary");
  s.append(el("b", null, "Lejant"), el("span", null, "renkler ve terimler"));
  d.appendChild(s);
  var ic = el("div", "rp-lejant-ic");
  var g = el("div", "rp-lejant-grup");
  GRUP.forEach(function (x) { var r = el("div", "rp-lejant-satir"); var i = el("i"); i.style.background = x[0]; var m = el("div"); m.append(el("b", null, x[1]), el("span", null, x[2])); r.append(i, m); g.appendChild(r); });
  var t = el("dl", "rp-lejant-terim");
  TERIM.forEach(function (x) { t.append(el("dt", null, x[0]), el("dd", null, x[1])); });
  ic.append(g, t); d.appendChild(ic);
  try { d.open = localStorage.getItem("rp-lejant") === "acik"; } catch (e) { /* yok */ }
  d.addEventListener("toggle", function () { try { localStorage.setItem("rp-lejant", d.open ? "acik" : "kapali"); } catch (e) { /* yok */ } });
  bas.after(d);
  // baskı araçları
  var kunye = bas.querySelector(".rp-kunye");
  var arac = el("span", "rp-araclar");
  var gorunum = el("button", "rp-arac", "Baskı görünümü"); gorunum.type = "button";
  var yazdir = el("button", "rp-arac rp-arac-koyu", "Yazdır / PDF"); yazdir.type = "button";
  arac.append(gorunum, yazdir);
  (kunye || bas).appendChild(arac);
  var acikDetay = [];
  function baskiAc() {
    document.body.classList.add("baski");
    gorunum.textContent = "Ekran görünümü";
    acikDetay = [].filter.call(document.querySelectorAll("details"), function (x) { return !x.open; });
    acikDetay.forEach(function (x) { x.open = true; });
    document.querySelectorAll(".rp-gizli").forEach(function (r) { r.hidden = false; });
    document.dispatchEvent(new Event("rp-baski"));
  }
  function baskiKapa() {
    document.body.classList.remove("baski");
    gorunum.textContent = "Baskı görünümü";
    acikDetay.forEach(function (x) { x.open = false; }); acikDetay = [];
  }
  var elle = false;
  gorunum.addEventListener("click", function () { if (document.body.classList.contains("baski")) { elle = false; baskiKapa(); } else { elle = true; baskiAc(); window.scrollTo(0, 0); } });
  yazdir.addEventListener("click", function () { window.print(); });
  window.addEventListener("beforeprint", function () { if (!document.body.classList.contains("baski")) baskiAc(); });
  window.addEventListener("afterprint", function () { if (!elle) baskiKapa(); });
})();
