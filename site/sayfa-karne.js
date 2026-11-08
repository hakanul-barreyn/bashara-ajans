// Yayın karnesi (Kaynaklar sayfası) ve sessizlik endeksi (Almanak sayfası): data/karne.json'dan
(function () {
  var karneKutu = document.getElementById("karne"), sesKutu = document.getElementById("sessizlikEndeksi");
  if (!karneKutu && !sesKutu) return;
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  fetch("data/karne.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    if (karneKutu) karne(v.karne || []);
    if (sesKutu) sessizlik(v.sessizlik || []);
  }).catch(function () {});

  function karne(liste) {
    if (!liste.length) { karneKutu.appendChild(el("p", "bos2", "Karne için yeterli veri birikmedi.")); return; }
    var SUT = [
      ["ad", "Yayın"], ["kamp", "Kamp"], ["haber", "Haber"],
      ["edilgen", "Edilgen dil %", "Fail verilmesi gereken haberlerde faili gizleyen edilgen dil kullanımı"],
      ["ordu", "İsrail ordusuna dayanma %", "Haberin dayanağı İsrail ordusunun açıklaması olan haberlerin payı"],
      ["baglam", "Bağlam verme %", "İşgal, abluka ya da öncesi gibi bir bağlam veren haberlerin payı"],
      ["gecikme", "Gecikme (sa)", "Yalnızca İsrail ve Batı basını: olayın bölge basınındaki ilk haberinden sonra geçen süre (ortanca)"]];
    var sira = { k: "edilgen", y: -1 }, kamp = "";
    var arac = el("div", "karne-arac");
    var sec = el("select"); sec.setAttribute("aria-label", "Kamp");
    [["", "Bütün kamplar"]].concat(Array.from(new Set(liste.map(function (r) { return r.kamp; }))).map(function (k) { return [k, k]; }))
      .forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; sec.appendChild(op); });
    sec.onchange = function () { kamp = sec.value; ciz(); };
    arac.appendChild(sec); karneKutu.appendChild(arac);
    var sar = el("div", "karne-sar"); var tab = el("table", "karne"); sar.appendChild(tab); karneKutu.appendChild(sar);
    function ciz() {
      tab.textContent = "";
      var th = el("tr");
      SUT.forEach(function (s) {
        var h = el("th", null, s[1] + (sira.k === s[0] ? (sira.y > 0 ? " ▲" : " ▼") : "")); if (s[2]) h.title = s[2];
        h.onclick = function () { sira = { k: s[0], y: sira.k === s[0] ? -sira.y : -1 }; ciz(); };
        th.appendChild(h);
      });
      var thead = el("thead"); thead.appendChild(th); tab.appendChild(thead);
      var tb = el("tbody");
      liste.filter(function (r) { return !kamp || r.kamp === kamp; }).slice().sort(function (a, b) {
        var x = a[sira.k], y = b[sira.k];
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y, "tr") : x - y) * sira.y;
      }).forEach(function (r) {
        var tr = el("tr");
        SUT.forEach(function (s) {
          var v = r[s[0]], td = el("td");
          if (["edilgen", "ordu", "baglam"].indexOf(s[0]) >= 0 && v != null) {
            var c = el("span", "karne-cubuk"); var i = el("i"); i.style.width = v + "%";
            i.style.background = s[0] === "baglam" ? "#1f7a52" : "#c9302c"; c.appendChild(i); td.appendChild(c); td.appendChild(el("b", null, v));
          } else td.textContent = v == null ? "–" : v;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      tab.appendChild(tb);
    }
    ciz();
  }

  function sessizlik(h) {
    if (h.length < 2) { sesKutu.appendChild(el("p", "bos2", "Endeks için en az iki haftalık veri gerekiyor.")); return; }
    var W = 640, H = 160, en = 100, ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg"); svg.setAttribute("viewBox", "-10 -8 " + (W + 20) + " " + (H + 32)); svg.setAttribute("class", "ses-svg");
    var nok = h.map(function (x, i) { return (i * W / (h.length - 1)).toFixed(1) + "," + (H - H * (x.oran || 0) / en).toFixed(1); }).join(" ");
    [0, 50, 100].forEach(function (y) {
      var l = document.createElementNS(ns, "line"); l.setAttribute("x1", 0); l.setAttribute("x2", W); l.setAttribute("y1", H - H * y / 100); l.setAttribute("y2", H - H * y / 100);
      l.setAttribute("stroke", "currentColor"); l.setAttribute("stroke-opacity", ".15"); svg.appendChild(l);
      var t = document.createElementNS(ns, "text"); t.setAttribute("x", 2); t.setAttribute("y", H - H * y / 100 - 3); t.setAttribute("font-size", "10"); t.setAttribute("fill", "currentColor"); t.setAttribute("opacity", ".6"); t.textContent = "%" + y; svg.appendChild(t);
    });
    var p = document.createElementNS(ns, "polyline"); p.setAttribute("points", nok); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#c9302c"); p.setAttribute("stroke-width", "2.5"); svg.appendChild(p);
    h.forEach(function (x, i) {
      var c = document.createElementNS(ns, "circle"); c.setAttribute("cx", i * W / (h.length - 1)); c.setAttribute("cy", H - H * (x.oran || 0) / en); c.setAttribute("r", 3.5); c.setAttribute("fill", "#c9302c");
      var t = document.createElementNS(ns, "title"); t.textContent = x.hafta + " haftası: " + x.buyuk + " büyük olaydan " + x.sessiz + " tanesini İsrail ve Batı basını yazmadı (%" + x.oran + ")"; c.appendChild(t); svg.appendChild(c);
    });
    [0, h.length - 1].forEach(function (i, j) {
      var t = document.createElementNS(ns, "text"); t.setAttribute("x", i * W / (h.length - 1)); t.setAttribute("y", H + 18); t.setAttribute("font-size", "11"); t.setAttribute("fill", "currentColor"); t.setAttribute("opacity", ".7");
      t.setAttribute("text-anchor", j ? "end" : "start"); t.textContent = h[i].hafta; svg.appendChild(t);
    });
    sesKutu.appendChild(svg);
    var son = h[h.length - 1];
    sesKutu.appendChild(el("p", "ses-not", "Son hafta (" + son.hafta + "): bölge basınında en az 4 yayının yazdığı " + son.buyuk + " olaydan " + son.sessiz + " tanesi (%" + son.oran + ") İsrail ve Batı basınında hiç yer almadı."));
  }
})();
