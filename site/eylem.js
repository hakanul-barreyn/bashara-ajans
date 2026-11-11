// liderler.html: söz ve eylem defteri (site/eylem.json). Yalnızca kaynağı doğrulanmış kayıtlar gösterilir.
(function () {
  "use strict";
  var k = document.getElementById("g-eylem"); if (!k) return;
  var EN = window.DIL === "en", YER = window.YEREL || (EN ? "en-GB" : "tr-TR");
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function gun(g) { return new Date(g + "T12:00:00Z").toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }); }
  fetch("site/eylem.json?t=" + Math.floor(Date.now() / 36e5)).then(function (r) { return r.json(); }).then(function (v) {
    var L = v.kayitlar.filter(function (x) { return x.dogrulandi; }).sort(function (a, b) { return a.tarih < b.tarih ? -1 : 1; });
    var sec = "hepsi", sz = document.getElementById("eylemSuzgec");
    [["hepsi", EN ? "All" : "Hepsi"], ["filistin", EN ? "Against Israel / for Palestine" : "İsrail’e karşı / Filistin lehine"], ["israil", EN ? "In Israel’s favour" : "İsrail lehine"]].forEach(function (s) {
      var b = el("button", "rp-cip", s[1]); b.type = "button"; b.setAttribute("aria-pressed", s[0] === sec); if (s[0] === sec) b.classList.add("secili");
      b.onclick = function () { sec = s[0]; [].forEach.call(sz.children, function (c) { c.setAttribute("aria-pressed", c === b); c.classList.toggle("secili", c === b); }); ciz(); }; sz.appendChild(b);
    });
    function ciz() {
      k.textContent = "";
      var ul = el("ol", "ey-liste");
      L.filter(function (x) { return sec === "hepsi" || x.yon === sec; }).forEach(function (x) {
        var li = el("li", "ey-" + x.yon);
        li.append(el("time", null, gun(x.tarih)), el("b", null, x.ulke + " · " + x.aktor)); if (x.celiskili) li.appendChild(el("span", "ey-celiski", EN ? "Contradictory: words vs deeds" : "Çelişkili: söz ve eylem")); li.appendChild(el("p", null, EN ? x.en : x.tr));
        var a = el("a", null, EN ? "Source ↗" : "Kaynak ↗"); a.href = x.kaynak; a.target = "_blank"; a.rel = "noopener"; li.appendChild(a);
        ul.appendChild(li);
      });
      k.appendChild(ul);
      k.appendChild(el("p", "rp-not", EN ? "The ledger keeps growing; entries are added only once their source is verified. Each entry describes a documented act, not a judgement of people." : "Defter büyümeye devam ediyor; kayıtlar ancak kaynağı doğrulandıktan sonra eklenir. Her kayıt belgelenmiş bir eylemi anlatır, kişiler hakkında hüküm değildir."));
    }
    ciz();
  }).catch(function () { /* yok */ });
})();
