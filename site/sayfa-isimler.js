// İsimleri vardı: data/isimler/ dizininden yaş yaş isimleri yükler (görününce), arama bütün listeyi yükleyip süzer.
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var sayi = function (n) { return Number(n).toLocaleString("tr-TR"); };
  var yuklu = {}, D = null;
  function yasAd(y) { return y === 0 ? "Bir yaşını doldurmadan" : y + " yaşında"; }
  function getir(y) { return yuklu[y] || (yuklu[y] = fetch("data/isimler/yas-" + y + ".json").then(function (r) { return r.json(); })); }
  function doldur(bolum, liste, ara) {
    var cocuk = +bolum.dataset.yas < 18;
    var iz = bolum.querySelector(".isim-izgara"); iz.textContent = "";
    var parca = document.createDocumentFragment();
    liste.forEach(function (k) {
      var d = el("div", "kisi" + (ara ? " vurgu" : "")); var a = el("b", null, k[1]); a.dir = "rtl"; a.lang = "ar";
      d.append(a, el("span", null, k[0] + (k[2] === "f" ? (cocuk ? " · kız" : " · kadın") : k[2] === "m" ? " · erkek" : ""))); parca.appendChild(d);
    });
    iz.appendChild(parca);
  }
  fetch("data/isimler/dizin.json").then(function (r) { return r.json(); }).then(function (d) {
    D = d;
    $("toplam").textContent = sayi(d.toplam); $("cocuk").textContent = sayi(d.cocuk);
    $("guncel").textContent = "Liste " + new Date(d.indirildi).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) + " tarihinde güncellendi.";
    var nav = $("yaslar"), kap = $("liste");
    var gozcu = new IntersectionObserver(function (g) {
      g.forEach(function (x) { if (!x.isIntersecting) return; gozcu.unobserve(x.target); var y = +x.target.dataset.yas; getir(y).then(function (l) { doldur(x.target, l); }); });
    }, { rootMargin: "800px 0px" });
    d.yaslar.forEach(function (a) {
      var l = el("a", a.yas < 18 ? "cocuk" : null, String(a.yas)); l.href = "#yas-" + a.yas; l.title = yasAd(a.yas) + ": " + sayi(a.n) + " kişi"; nav.appendChild(l);
      var b = el("section", "yas-bolum"); b.id = "yas-" + a.yas; b.dataset.yas = a.yas;
      var h = el("div", "yas-bas"); h.append(el("h2", null, yasAd(a.yas)), el("span", null, sayi(a.n) + " kişi · " + sayi(a.kadin) + (a.yas < 18 ? " kız, " : " kadın, ") + sayi(a.erkek) + " erkek"));
      b.append(h, el("div", "isim-izgara")); kap.appendChild(b); gozcu.observe(b);
    });
    // doğrudan bir yaşa gelindiyse
    if (/^#yas-\d+$/.test(location.hash)) { var t = document.querySelector(location.hash); if (t) setTimeout(function () { t.scrollIntoView(); }, 50); }
  }).catch(function () { $("liste").appendChild(el("p", "yas-bos", "Liste henüz hazır değil; toplayıcının bir sonraki çalışmasında yüklenecek.")); });

  // arama: ilk aramada bütün yaşlar yüklenir, eşleşmeyen yaşlar gizlenir
  var zaman = null;
  $("ara").addEventListener("input", function () {
    clearTimeout(zaman); var q = this.value.trim().toLocaleLowerCase("tr");
    zaman = setTimeout(function () {
      if (!D) return;
      if (q.length < 2) { $("araSonuc").textContent = ""; D.yaslar.forEach(function (a) { var b = $("yas-" + a.yas); b.hidden = false; if (yuklu[a.yas]) yuklu[a.yas].then(function (l) { doldur(b, l); }); }); return; }
      $("araSonuc").textContent = "Aranıyor…";
      Promise.all(D.yaslar.map(function (a) { return getir(a.yas); })).then(function (hepsi) {
        var n = 0;
        D.yaslar.forEach(function (a, i) {
          var b = $("yas-" + a.yas), es = hepsi[i].filter(function (k) { return k[0].toLocaleLowerCase("tr").indexOf(q) >= 0 || k[1].indexOf(q) >= 0; });
          b.hidden = !es.length; if (es.length) doldur(b, es, true); n += es.length;
        });
        $("araSonuc").textContent = sayi(n) + " sonuç";
      });
    }, 300);
  });
})();
