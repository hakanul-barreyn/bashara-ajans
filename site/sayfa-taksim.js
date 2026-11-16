// Siyasi çizgiye göre rapor: data/bulten/taksim.json (toplayici/taksim_rapor.py).
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var EN = window.DIL === "en";
  function T(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  function sayi(n, d) { return n == null ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  function puan(n) { return n == null ? "–" : (n > 0 ? "+" : "") + sayi(n, 0); }
  var GRUP_EN = { "Türkiye": "Turkey", "İsrail": "Israel", "ABD": "US", "İspanya": "Spain", "İran": "Iran", "İngiltere": "Britain", "Fransa": "France", "İtalya": "Italy", "Almanya": "Germany", "BAE": "UAE", "Yemen": "Yemen", "Filistin": "Palestine", "Arap dünyası": "Arab world", "Diğer": "Other", "Hepsi": "All countries" };
  var CIZGI_EN = { "sol": "left", "merkez": "centre", "sağ": "right", "ulusalcı": "nationalist", "İslami düşünce": "Islamic thought", "devlet / kamu": "state / public", "parti / hareket": "party / movement" };
  function gAd(g) { return EN ? (GRUP_EN[g] || g) : g; }
  function cAd(c) { return EN ? (CIZGI_EN[c] || c) : c; }
  var OLCU = { susma: T("susma", "silence"), fail: T("fail", "killer"), agirlik: T("ağırlık", "weight") };

  fetch("data/bulten/taksim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(ciz)
    .catch(function () { var m = document.querySelector(".rp-dek"); if (m) m.after(el("p", "bekliyor", T("Rapor verisi henüz hazır değil; toplayıcının bir sonraki çalışmasında yazılacak.", "Report data is not ready yet; it will be written on the collector’s next run."))); });

  function ciz(v) {
    document.querySelectorAll('[data-v="esik"]').forEach(function (e) { e.textContent = v.esik_puan; });
    document.querySelectorAll('[data-v="guncel"]').forEach(function (e) { e.textContent = T("Güncelleme: ", "Updated: ") + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }); });
    var ul = $("g-cumleler");
    (v.cumleler || []).forEach(function (c) {
      var li = el("li", c.fark < 0 ? "az" : null, EN ? c.en : c.tr);
      li.appendChild(el("small", null, gAd(c.grup) + " · " + cAd(c.cizgi) + " · " + OLCU[c.olcu]));
      ul.appendChild(li);
    });
    if (!(v.cumleler || []).length) ul.appendChild(el("li", null, T("Eşiği aşan grup yok.", "No group passes the threshold.")));
    var t = el("table");
    t.innerHTML = EN ? "<thead><tr><th>Country / line</th><th>Outlets</th><th>Silence</th><th>Killer</th><th>Weight</th><th>Organisations</th></tr></thead>"
      : "<thead><tr><th>Ülke / çizgi</th><th>Yayın</th><th>Susma</th><th>Fail</th><th>Ağırlık</th><th>Kurumlar</th></tr></thead>";
    var tb = el("tbody");
    (v.hucreler || []).forEach(function (h) {
      var tr = el("tr");
      var ad = h.cizgi ? (h.grup === "Hepsi" ? T("Bütün ülkeler", "All countries") + " · " : gAd(h.grup) + " · ") + cAd(h.cizgi) : gAd(h.grup);
      tr.appendChild(el("td", h.cizgi ? null : "tk-ust", ad));
      tr.appendChild(el("td", "sayi", h.yayin));
      tr.appendChild(el("td", "sayi", h.susma_n ? puan(h.susma_fark) + " (" + h.susma_n + ")" : "–"));
      tr.appendChild(el("td", "sayi", h.fail_n ? puan(h.fail_fark) + " (" + h.fail_n + ")" : "–"));
      tr.appendChild(el("td", "sayi", h.agirlik_n ? sayi(h.agirlik_kat, 1) + "× (" + h.agirlik_n + ")" : "–"));
      tr.appendChild(el("td", "rp-kelimeler", (h.yayinlar || []).join(", ")));
      tb.appendChild(tr);
    });
    t.appendChild(tb); var k = el("div", "tablo-kutu"); k.appendChild(t); $("g-tablo").appendChild(k);
  }
})();
