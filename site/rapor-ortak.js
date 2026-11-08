// Raporların ortak araçları: açılır kapanır lejant, baskı görünümü ve yazdır.
(function () {
  "use strict";
  var EN = window.DIL === "en";
  function T(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var GRUP = [
    ["#1f7a52", T("Bölge basını", "Regional press"), T("Arap dünyası, İran, Türkiye ve bölgedeki diğer yayınlar (İsrail yanlısı çizgidekiler hariç). Alışma raporunda Türkiye ayrı gösterilir.", "Outlets in the Arab world, Iran, Turkey and the rest of the region (excluding pro-Israel ones). Turkey is shown separately in the habituation report.")],
    ["#7a3fa0", T("Türkiye basını", "Turkish press"), T("Türkiye’deki yayınlar (yalnızca alışma ve liderler raporlarında ayrı).", "Outlets in Turkey (separate only in the habituation and leaders reports).")],
    ["#2f5bb7", T("İsrail basını", "Israeli press"), T("İsrail’de yayımlanan gazeteler; örneklem küçük.", "Newspapers published in Israel; small sample.")],
    ["#8a6d3b", T("Batı ana akım basını", "Western mainstream press"), T("ABD ve Avrupa’nın büyük gazeteleri, yayın kuruluşları ve ajansları.", "Major newspapers, broadcasters and agencies in the US and Europe.")],
    ["#c9544e", T("Batı’da muhalif basın", "Western dissenting press"), T("Batı’da ana akımın dışında, eleştirel çizgideki yayınlar.", "Critical outlets in the West outside the mainstream.")]
  ];
  var TERIM = [
    [T("Savaş payı", "War share"), T("Bir grubun bütün başlıkları içinde Gazze, Batı Şeria, Kudüs, Lübnan ya da İsrail geçenlerin yüzdesi (yalnızca İran’la ilgili olanlar hariç).", "Share of a group’s headlines that mention Gaza, the West Bank, Jerusalem, Lebanon or Israel (excluding those only about Iran).")],
    [T("Binde", "Per thousand"), T("Bin başlıkta kaç kez geçtiği.", "Uses per thousand headlines.")],
    [T("Tepki endeksi", "Response index"), T("Bir olayın penceresinde (bir gün önce, iki gün sonra) grubun o türden başlık payı; türün ilk büyük olayı 100.", "A group’s share of headlines of that type in an event’s window (one day before, two after); the type’s first major event = 100.")],
    [T("İzleme oranı", "Follow rate"), T("Bir grubun olaylara ayırdığı payın bölge basınının ayırdığı paya oranı. %100 = bölge basını kadar.", "The share a group gives events divided by the regional press’s share. 100% = as much as the regional press.")],
    [T("Gri çubuklar", "Grey bars"), T("Gazze Sağlık Bakanlığı’nın bildirdiği ölümler.", "Deaths reported by the Gaza Ministry of Health.")],
    [T("Kırmızı rakam", "Red figures"), T("Belirgin düşüş ya da artış olmaması.", "A clear drop, or no increase.")],
    [T("Kesikli çizgi", "Dashed line"), T("Önemli bir tarih (seçim, karar) ya da 100 / %100 düzeyi.", "A key date (election, ruling) or the 100 / 100% level.")]
  ];
  var bas = document.querySelector(".rp-bas");
  if (!bas) return;
  // lejant
  var d = el("details", "rp-lejant"), s = el("summary");
  s.append(el("b", null, T("Lejant", "Legend")), el("span", null, T("renkler ve terimler", "colours and terms")));
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
  var gorunum = el("button", "rp-arac", T("Baskı görünümü", "Print view")); gorunum.type = "button";
  var yazdir = el("button", "rp-arac rp-arac-koyu", T("Yazdır / PDF", "Print / PDF")); yazdir.type = "button";
  arac.append(gorunum, yazdir);
  (kunye || bas).appendChild(arac);
  var acikDetay = [];
  function baskiAc() {
    document.body.classList.add("baski");
    gorunum.textContent = T("Ekran görünümü", "Screen view");
    acikDetay = [].filter.call(document.querySelectorAll("details"), function (x) { return !x.open; });
    acikDetay.forEach(function (x) { x.open = true; });
    document.querySelectorAll(".rp-gizli").forEach(function (r) { r.hidden = false; });
    document.dispatchEvent(new Event("rp-baski"));
  }
  function baskiKapa() {
    document.body.classList.remove("baski");
    gorunum.textContent = T("Baskı görünümü", "Print view");
    acikDetay.forEach(function (x) { x.open = false; }); acikDetay = [];
  }
  var elle = false;
  gorunum.addEventListener("click", function () { if (document.body.classList.contains("baski")) { elle = false; baskiKapa(); } else { elle = true; baskiAc(); window.scrollTo(0, 0); } });
  yazdir.addEventListener("click", function () { window.print(); });
  // küçük grafikler: tıklayınca büyüt
  var perde = null;
  function kapat() { if (perde) { perde.remove(); perde = null; document.body.style.overflow = ""; } }
  document.addEventListener("click", function (e) {
    var f = e.target.closest && e.target.closest(".rp-kucuk");
    if (!f || perde || document.body.classList.contains("baski")) return;
    perde = el("div", "rp-buyut"); perde.setAttribute("role", "dialog"); perde.setAttribute("aria-modal", "true");
    var kutu = el("div", "rp-buyut-kutu"), x = el("button", "rp-buyut-kapat", "×"); x.type = "button"; x.setAttribute("aria-label", T("Kapat", "Close"));
    var kopya = f.cloneNode(true); kopya.classList.remove("rp-kucuk"); kopya.classList.add("rp-buyuk");
    kutu.append(x, kopya); perde.appendChild(kutu); document.body.appendChild(perde); document.body.style.overflow = "hidden";
    perde.addEventListener("click", function (ev) { if (ev.target === perde || ev.target === x) kapat(); });
    x.focus();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") kapat(); });
  window.addEventListener("beforeprint", function () { if (!document.body.classList.contains("baski")) baskiAc(); });
  window.addEventListener("afterprint", function () { if (!elle) baskiKapa(); });
})();
