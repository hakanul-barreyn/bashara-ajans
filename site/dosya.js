/* Dosya sayfası (d/<kimlik>.html): dalları zaman çizgisinde gösteren şerit. Sayfanın içeriği (özet, dallar, olaylar)
   HTML olarak yazılı; bu betik yalnızca şeridi ekler. Veri sayfanın içindeki <script type="application/json" id="dsVeri">. */
(function () {
  "use strict";
  var kutu = document.getElementById("dsSerit"), sec = document.getElementById("dsSecili"), vk = document.getElementById("dsVeri");
  if (!kutu || !vk) return;
  var D; try { D = JSON.parse(vk.textContent); } catch (e) { return; }
  if (!D || !D.dallar || !D.dallar.length) return;
  var AY = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  var NS = "http://www.w3.org/2000/svg";
  function s(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function gun(g) { return Date.parse(g + "T00:00:00Z") / 864e5; }
  function gk(g) { var p = g.split("-"); return +p[2] + " " + AY[+p[1] - 1]; }

  var bugun = Math.floor(Date.now() / 864e5), ilk = gun(D.ilk), son = Math.max(gun(D.son), Math.min(bugun, gun(D.son) + 3));
  if (son - ilk < 6) ilk = son - 6;
  var gunSay = son - ilk + 1, SOL = 200, SAG = 18, UST = 32, SAT = 44, W = 980, H = UST + D.dallar.length * SAT + 12;
  var x = function (g) { return SOL + (gun(g) - ilk + 0.5) * ((W - SOL - SAG) / gunSay); };
  var sv = s("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": D.ad + ": dallar zaman çizgisinde" });
  var adim = Math.max(1, Math.ceil(gunSay / 10));
  for (var i = 0; i < gunSay; i++) {
    var g = new Date((ilk + i) * 864e5).toISOString().slice(0, 10), gx = x(g);
    sv.appendChild(s("line", { x1: gx, x2: gx, y1: UST - 6, y2: H - 8, stroke: "var(--ds-cizgi)", "stroke-width": 1 }));
    if (i % adim === 0) { var t = s("text", { x: gx, y: 17, "text-anchor": "middle", "font-size": 11, fill: "var(--ds-soluk)" }); t.textContent = gk(g); sv.appendChild(t); }
  }
  var RENK = { sicak: "var(--ds-sicak)", suruyor: "var(--ds-surer)", sessiz: "var(--ds-sessiz)" };
  function goster(o, dal) {
    sec.hidden = false; sec.innerHTML = "";
    sec.appendChild(el("time", null, gk(o.g) + " · " + dal.ad + " · " + (o.k || 2) + " yayın"));
    sec.appendChild(el("b", null, o.b));
    if (o.s) { var a = el("a", null, "Kim nasıl yazdı →"); a.href = "../h/" + o.s; sec.appendChild(a); }
    if (o.x && o.x.length) sec.appendChild(el("span", "ds-rozet", "Başka bir dosyada da: " + o.x.join(", ")));
  }
  var enSon = null;
  D.dallar.forEach(function (dal, j) {
    var y = UST + j * SAT + SAT / 2, renk = RENK[dal.durum] || RENK.sessiz;
    var ad = s("a", { href: "#dal-" + dal.id }), t = s("text", { x: 10, y: y + 4, "font-size": 13, "font-weight": 600, fill: "var(--ds-murekkep)" });
    t.textContent = dal.ad.length > 25 ? dal.ad.slice(0, 24) + "…" : dal.ad; ad.appendChild(t); sv.appendChild(ad);
    var ol = dal.olaylar.filter(function (o) { return gun(o.g) >= ilk; });
    if (!ol.length) return;
    sv.appendChild(s("line", { x1: x(ol[0].g), x2: x(ol[ol.length - 1].g), y1: y, y2: y, stroke: renk, "stroke-width": 2, opacity: 0.45 }));
    for (var k = 1; k < ol.length; k++) {
      var f = gun(ol[k].g) - gun(ol[k - 1].g);
      if (f >= 5) {
        sv.appendChild(s("line", { x1: x(ol[k - 1].g), x2: x(ol[k].g), y1: y, y2: y, stroke: "var(--ds-kagit)", "stroke-width": 3, "stroke-dasharray": "2 5" }));
        var bt = s("text", { x: (x(ol[k - 1].g) + x(ol[k].g)) / 2, y: y - 9, "text-anchor": "middle", "font-size": 10, "font-weight": 600, fill: "var(--ds-sicak)" });
        bt.textContent = f + " gün sessiz"; sv.appendChild(bt);
      }
    }
    var ayni = {};
    ol.forEach(function (o) {
      var kat = (ayni[o.g] = (ayni[o.g] || 0) + 1) - 1, r = Math.max(4, Math.min(12, Math.sqrt(o.k || 2) * 3));
      var cx = x(o.g) + (kat % 2 ? 1 : -1) * Math.ceil(kat / 2) * 7;
      var gr = s("g", { class: "ds-nokta", tabindex: 0, role: "button", "aria-label": gk(o.g) + ": " + o.b });
      gr.appendChild(s("circle", { cx: cx, cy: y, r: r, fill: renk, "fill-opacity": 0.82 }));
      if (o.x && o.x.length) gr.appendChild(s("circle", { cx: cx, cy: y, r: r + 3.5, fill: "none", stroke: "var(--ds-murekkep)", "stroke-width": 1.3 }));
      var ti = s("title", {}); ti.textContent = gk(o.g) + " · " + o.b; gr.appendChild(ti);
      gr.addEventListener("click", function () { goster(o, dal); });
      gr.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); goster(o, dal); } });
      sv.appendChild(gr);
      if (!enSon || o.g > enSon[0].g) enSon = [o, dal];
    });
  });
  kutu.appendChild(sv); kutu.hidden = false;
  if (enSon) goster(enSon[0], enSon[1]);
})();
