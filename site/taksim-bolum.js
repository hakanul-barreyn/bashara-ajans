// Raporların sonundaki "Yeni taksime göre" bölümü: data/bulten/taksim.json'dan (toplayici/taksim_rapor.py).
// Eski grafikler yerinde kalır; bu bölüm aynı ölçüyü ülke ve siyasi çizgi gruplarına göre gösterir.
// Kullanım: <div class="tk-bolum" data-olcu="fail,susma"></div>  (olcu: susma | fail | agirlik)
(function () {
  "use strict";
  var kutular = document.querySelectorAll(".tk-bolum[data-olcu]");
  if (!kutular.length) return;
  var EN = window.DIL === "en";
  function T(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sayi(n, d) { return Number(n).toLocaleString(YER, { maximumFractionDigits: d }); }
  var GRUP_EN = { "Türkiye": "Turkey", "İsrail": "Israel", "ABD": "US", "İspanya": "Spain", "İran": "Iran", "İngiltere": "Britain", "Fransa": "France", "İtalya": "Italy", "Almanya": "Germany", "BAE": "UAE", "Yemen": "Yemen", "Filistin": "Palestine", "Arap dünyası": "Arab world", "Diğer": "Other" };
  var CIZGI_EN = { "sol": "left", "merkez": "centre", "sağ": "right", "ulusalcı": "nationalist", "İslami düşünce": "Islamic thought", "devlet / kamu": "state / public", "parti / hareket": "party / movement" };
  var OLCU = {
    susma: { ad: T("Büyük olaylarda susma", "Silence on major events"), alan: "susma_fark", n: "susma_n",
      acik: T("Olay günlerinde o olay türünden başlık atmama oranının, aynı dildeki tanık basından farkı (puan). Artı: daha sık sustu.",
        "Difference from witness press in the same language in the rate of running no headline of that kind on event days (points). Plus: silent more often.") },
    fail: { ad: T("Faili gizleme", "Hiding the killer"), alan: "fail_fark", n: "fail_n",
      acik: T("Filistinlilerin öldüğü başlıklarda failin yazılmama oranının tanık basından farkı (puan). Artı: faili daha sık gizledi. Yalnızca İngilizce, Arapça ve Türkçe yayınlar.",
        "Difference from witness press in the rate of not naming the killer in headlines on Palestinian deaths (points). Plus: hid the killer more often. English, Arabic and Turkish outlets only.") },
    agirlik: { ad: T("İsrailli ölüye ayrılan ağırlık", "Weight given to Israeli deaths"), alan: "agirlik_kat", n: "agirlik_n", kat: true,
      acik: T("İsrailli ölü başına ayrılan başlığın, Filistinli ölü başına ayrılana oranı; tanık basının kaç katı olduğu (1 = tanık basınla aynı).",
        "Headlines per Israeli death relative to headlines per Palestinian death, as a multiple of witness press (1 = same as witness press).") }
  };

  fetch("data/bulten/taksim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    kutular.forEach(function (k) { ciz(k, v); });
  }).catch(function () {
    kutular.forEach(function (k) { k.appendChild(el("p", "rp-not", T("Yeni taksime göre ölçüm henüz hazır değil.", "The measurement by the new classification is not ready yet."))); });
  });

  function ciz(kutu, v) {
    kutu.dataset.olcu.split(",").forEach(function (ad) {
      var o = OLCU[ad.trim()]; if (!o) return;
      var satir = (v.hucreler || []).filter(function (h) { return h.cizgi && h.grup !== "Hepsi" && h.grup !== "Diğer" && h[o.n] >= 2 && h[o.alan] != null; });
      var yetersiz = (v.hucreler || []).filter(function (h) { return h.cizgi && h.grup !== "Hepsi" && h.grup !== "Diğer" && h[o.n] < 2; }).length;
      satir.sort(function (a, b) { return b[o.alan] - a[o.alan]; });
      var b = el("div", "tk-olcu");
      b.appendChild(el("h3", null, o.ad));
      b.appendChild(el("p", "rp-not", o.acik));
      var enCok = Math.max.apply(null, satir.map(function (h) { return Math.abs(o.kat ? Math.log(h[o.alan]) : h[o.alan]); }).concat([o.kat ? Math.log(2) : 10]));
      var ul = el("ul", "tk-cubuk");
      satir.forEach(function (h) {
        var x = h[o.alan], d = o.kat ? Math.log(x) : x, li = el("li");
        li.appendChild(el("span", "tk-ad", (EN ? (GRUP_EN[h.grup] || h.grup) : h.grup) + " · " + (EN ? (CIZGI_EN[h.cizgi] || h.cizgi) : h.cizgi)));
        var iz = el("span", "tk-iz"), c = el("i", d >= 0 ? "art" : "eks");
        c.style.width = (50 * Math.min(1, Math.abs(d) / enCok)).toFixed(1) + "%";
        iz.appendChild(c); li.appendChild(iz);
        li.appendChild(el("span", "tk-deger", (o.kat ? sayi(x, 1) + "×" : (x > 0 ? "+" : "") + sayi(x, 0)) + " · " + h[o.n] + T(" yayın", " outlets")));
        li.title = (h.yayinlar || []).join(", ");
        ul.appendChild(li);
      });
      b.appendChild(ul);
      var cum = (v.cumleler || []).filter(function (c) { return c.olcu === ad.trim(); });
      if (cum.length) {
        var cl = el("ul", "tk-cumleler");
        cum.forEach(function (c) { cl.appendChild(el("li", c.fark < 0 ? "az" : null, EN ? c.en : c.tr)); });
        b.appendChild(cl);
      }
      if (yetersiz) b.appendChild(el("p", "rp-not", T(yetersiz + " grup bir yayınla temsil edildiği için gösterilmedi (ölçüm yetersiz). Bütün gruplar: ", yetersiz + " groups are represented by a single outlet and are not shown (insufficient measurement). All groups: ")));
      var a = el("a", null, T("siyasi çizgiye göre rapor →", "report by political line →")); a.href = "taksim.html";
      (b.lastChild.tagName === "P" ? b.lastChild : b.appendChild(el("p", "rp-not"))).appendChild(a);
      kutu.appendChild(b);
    });
  }
})();
