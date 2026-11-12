// Her grafiğe "Paylaş" düğmesi: grafik tarayıcının içinde PNG görsele çevrilir (kare, story, yatay).
// Hiçbir dış hizmet kullanılmaz, izleme yok: görsel okurun cihazında üretilir; indirilir ya da cihazın paylaş menüsüyle gönderilir.
(function () {
  "use strict";
  var EN = window.DIL === "en";
  function T(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  var BICIM = [
    { ad: T("Kare (Instagram, X)", "Square (Instagram, X)"), w: 1080, h: 1080, k: "kare" },
    { ad: T("Story (dikey)", "Story (vertical)"), w: 1080, h: 1920, k: "story" },
    { ad: T("Yatay (X, Facebook)", "Landscape (X, Facebook)"), w: 1600, h: 900, k: "yatay" }
  ];
  var OZ = ["color", "background-color", "background-image", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing",
    "text-transform", "text-align", "text-decoration-line", "white-space", "word-break", "overflow-wrap", "display", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink",
    "flex-basis", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "column-gap", "row-gap", "align-items", "align-self", "justify-content",
    "width", "height", "min-width", "max-width", "min-height", "padding-top", "padding-right", "padding-bottom", "padding-left", "margin-top", "margin-right",
    "margin-bottom", "margin-left", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "box-sizing", "overflow", "opacity",
    "position", "top", "right", "bottom", "left", "vertical-align", "border-collapse", "border-spacing", "table-layout", "list-style-type", "visibility",
    "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "text-anchor", "dominant-baseline", "font-variant-numeric", "paint-order"];

  function kopya(kaynak) {
    var c = kaynak.cloneNode(true);
    var a = [kaynak].concat([].slice.call(kaynak.querySelectorAll("*"))), b = [c].concat([].slice.call(c.querySelectorAll("*")));
    for (var i = 0; i < a.length; i++) {
      var s = getComputedStyle(a[i]), d = "";
      for (var j = 0; j < OZ.length; j++) { var v = s.getPropertyValue(OZ[j]); if (v) d += OZ[j] + ":" + v + ";"; }
      b[i].setAttribute("style", d);
      b[i].removeAttribute("class");
    }
    // dış kaynak gerektiren ve paylaşımda anlamsız öğeler
    [].forEach.call(c.querySelectorAll("img,button,.gp-dugme,script,input,select"), function (x) { x.remove(); });
    [].forEach.call(c.querySelectorAll("details"), function (x) { x.setAttribute("open", ""); });
    c.style.width = kaynak.getBoundingClientRect().width + "px";
    c.style.margin = "0";
    return c;
  }

  function resim(kaynak) {
    var r = kaynak.getBoundingClientRect(), w = Math.ceil(r.width), h = Math.ceil(kaynak.scrollHeight || r.height);
    var c = kopya(kaynak);
    var kap = document.createElement("div"); kap.setAttribute("xmlns", "http://www.w3.org/1999/xhtml"); kap.appendChild(c);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject x="0" y="0" width="100%" height="100%">' +
      new XMLSerializer().serializeToString(kap) + "</foreignObject></svg>";
    return new Promise(function (ok, hata) {
      var im = new Image();
      im.onload = function () { ok({ im: im, w: w, h: h }); };
      im.onerror = function () { hata(new Error("görsel üretilemedi")); };
      im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
    });
  }

  function satirla(ctx, metin, enfazla) {
    var kel = String(metin || "").split(/\s+/), satir = [], s = "";
    kel.forEach(function (k) { var d = s ? s + " " + k : k; if (ctx.measureText(d).width > enfazla && s) { satir.push(s); s = k; } else s = d; });
    if (s) satir.push(s);
    return satir;
  }

  function baslikBul(kap) {
    var gor = function (x) { return x && x.offsetParent !== null && x.textContent.trim(); };
    // figür ya da grafik kutusundan önceki en yakın görünür başlık (h3 varsa o, yoksa bölümün h2'si)
    var n = kap, h = null;
    while (n && !h) {
      var p = n.previousElementSibling;
      while (p && !h) { if (/^H[23]$/.test(p.tagName) && gor(p)) h = p; p = p.previousElementSibling; }
      n = n.parentElement; if (n && n.tagName === "ARTICLE") { if (!h) h = [].filter.call(n.querySelectorAll("h2"), gor)[0]; break; }
    }
    var b = h ? h.textContent.trim() : document.title;
    var bol = kap.closest("article"), ust = bol ? [].filter.call(bol.querySelectorAll("h2"), gor)[0] : null;
    if (ust && h && ust !== h) b = ust.textContent.trim() + " · " + b;
    return b;
  }
  function altyaziBul(kap) {
    var f = kap.tagName === "FIGURE" ? kap : kap.closest("figure");
    var c = f ? [].filter.call(f.querySelectorAll("figcaption"), function (x) { return x.offsetParent !== null; })[0] : null;
    return c ? c.textContent.trim() : "";
  }
  function vurguBul(kap) {
    var f = kap.tagName === "FIGURE" ? kap : kap.closest("figure") || kap, p = f.previousElementSibling;
    for (var i = 0; p && i < 6; i++, p = p.previousElementSibling) { if (p.classList.contains("rp-vurgu") && p.textContent.trim()) return p.textContent.trim(); if (p.tagName === "FIGURE" || /^H[23]$/.test(p.tagName)) break; }
    return "";
  }
  function grafikKismi(kap) {
    if (kap.tagName !== "FIGURE") return kap;
    return [].filter.call(kap.children, function (x) { return x.tagName !== "FIGCAPTION" && !x.classList.contains("gp-dugme"); })[0] || kap;
  }
  function adres(kap) {
    var id = kap.id || (kap.querySelector("[id]") || {}).id || "";
    return location.origin + location.pathname + (id ? "#" + id : "");
  }

  function uret(kap, b) {
    return resim(grafikKismi(kap)).then(function (g) {
      var cv = document.createElement("canvas"); cv.width = b.w; cv.height = b.h;
      var ctx = cv.getContext("2d"), M = b.k === "story" ? 80 : 64, ic = b.w - 2 * M;
      ctx.fillStyle = "#fbfaf7"; ctx.fillRect(0, 0, b.w, b.h);
      ctx.fillStyle = "#0c0e0d"; ctx.fillRect(0, 0, b.w, b.k === "story" ? 150 : 96);
      var marka = (window.MARKA && MARKA.ad) || "ZBS";
      ctx.fillStyle = "#fff"; ctx.font = "800 " + (b.k === "story" ? 48 : 36) + "px 'Plus Jakarta Sans', system-ui, sans-serif"; ctx.textBaseline = "middle";
      ctx.fillText(marka, M, b.k === "story" ? 75 : 48);
      ctx.font = "500 " + (b.k === "story" ? 26 : 22) + "px 'Plus Jakarta Sans', system-ui, sans-serif"; ctx.fillStyle = "#cfd3cf"; ctx.textAlign = "right";
      ctx.fillText(T("veri masası", "data desk"), b.w - M, b.k === "story" ? 75 : 48); ctx.textAlign = "left";
      var y = (b.k === "story" ? 150 : 96) + (b.k === "story" ? 70 : 44);
      var bs = b.k === "story" ? 58 : b.k === "kare" ? 46 : 44;
      ctx.fillStyle = "#1d2421"; ctx.textBaseline = "top"; ctx.font = "800 " + bs + "px 'Source Serif 4', Georgia, serif";
      satirla(ctx, baslikBul(kap), ic).slice(0, 4).forEach(function (s) { ctx.fillText(s, M, y); y += bs * 1.18; });
      var vu = vurguBul(kap), vs = b.k === "story" ? 34 : 26;
      if (vu) { ctx.font = "600 " + vs + "px 'Source Serif 4', Georgia, serif"; ctx.fillStyle = "#1f7a52"; ctx.fillRect(M, y + 4, 6, 1); var vL = satirla(ctx, vu, ic - 24).slice(0, b.k === "story" ? 8 : b.k === "kare" ? 4 : 3); ctx.fillRect(M, y, 6, vL.length * vs * 1.35); ctx.fillStyle = "#1d2421"; vL.forEach(function (s2) { ctx.fillText(s2, M + 22, y); y += vs * 1.35; }); }
      y += 18;
      var alt = altyaziBul(kap), as = b.k === "story" ? 30 : 24;
      ctx.font = "400 " + as + "px 'Plus Jakarta Sans', system-ui, sans-serif";
      var altS = alt ? satirla(ctx, alt, ic).slice(0, b.k === "story" ? 7 : 3) : [];
      var dip = b.k === "story" ? 150 : 96, kutuH = b.h - y - dip - altS.length * as * 1.4 - 24;
      var o = Math.min(ic / g.w, kutuH / g.h, 3), gw = g.w * o, gh = g.h * o;
      if (b.k === "story" && kutuH - gh > 120) y += (kutuH - gh) / 2;
      ctx.fillStyle = "#fff"; ctx.fillRect(M - 16, y - 16, ic + 32, gh + 32);
      ctx.drawImage(g.im, M + (ic - gw) / 2, y, gw, gh); y += gh + 36;
      ctx.fillStyle = "#5d6461"; altS.forEach(function (s) { ctx.fillText(s, M, y); y += as * 1.4; });
      ctx.fillStyle = "#1f7a52"; ctx.fillRect(0, b.h - (b.k === "story" ? 110 : 70), b.w, 4);
      ctx.fillStyle = "#1d2421"; ctx.font = "600 " + (b.k === "story" ? 28 : 22) + "px 'Plus Jakarta Sans', system-ui, sans-serif"; ctx.textBaseline = "middle";
      var u = adres(kap).replace(/^https?:\/\//, "").replace(/#.*$/, "");
      ctx.fillText(T("Kaynak: ", "Source: ") + marka + " · " + u, M, b.h - (b.k === "story" ? 55 : 34));
      return cv;
    });
  }

  var perde = null;
  function kapat() { if (perde) { perde.remove(); perde = null; document.body.style.overflow = ""; } }
  function ac(kap) {
    perde = el("div", "rp-buyut gp-perde"); perde.setAttribute("role", "dialog"); perde.setAttribute("aria-modal", "true");
    var kutu = el("div", "rp-buyut-kutu gp-kutu"), x = el("button", "rp-buyut-kapat", "×"); x.type = "button"; x.setAttribute("aria-label", T("Kapat", "Close"));
    kutu.append(x, el("h3", null, T("Bu grafiği paylaş", "Share this chart")));
    var secim = el("div", "kt-sira gp-bicim"), on = el("div", "gp-onizleme"), dug = el("div", "gp-dugmeler"), not = el("p", "gp-not");
    not.textContent = T("Görsel bu cihazda üretilir; hiçbir veri bir sunucuya gönderilmez.", "The image is made on this device; no data is sent to any server.");
    var b0 = BICIM[0], cv = null;
    function yap() {
      on.textContent = T("Hazırlanıyor…", "Preparing…"); cv = null;
      uret(kap, b0).then(function (c) { cv = c; on.textContent = ""; var im = new Image(); im.src = c.toDataURL("image/png"); im.alt = baslikBul(kap); on.appendChild(im); })
        .catch(function () { on.textContent = T("Bu tarayıcı bu grafiğin görselini üretemedi. Ekran görüntüsü alabilir ya da bağlantıyı paylaşabilirsiniz.", "This browser could not make an image of this chart. You can take a screenshot or share the link."); });
    }
    BICIM.forEach(function (b) {
      var d = el("button", null, b.ad); d.type = "button"; d.setAttribute("aria-pressed", String(b === b0));
      d.onclick = function () { b0 = b; [].forEach.call(secim.children, function (z) { z.setAttribute("aria-pressed", String(z === d)); }); yap(); };
      secim.appendChild(d);
    });
    var dosyaAd = function () { return ((window.MARKA && MARKA.ad) || "zbs").toLowerCase() + "-" + (kap.id || (kap.querySelector("[id]") || {}).id || "grafik") + "-" + b0.k + ".png"; };
    var indir = el("button", "rp-arac rp-arac-koyu", T("Görseli indir", "Download image")); indir.type = "button";
    indir.onclick = function () { if (!cv) return; cv.toBlob(function (bl) { var a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = dosyaAd(); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }, "image/png"); };
    var paylas = el("button", "rp-arac", T("Paylaş…", "Share…")); paylas.type = "button";
    paylas.onclick = function () {
      if (!cv) return;
      cv.toBlob(function (bl) {
        var f = new File([bl], dosyaAd(), { type: "image/png" }), v = { files: [f], title: baslikBul(kap), text: baslikBul(kap) + " " + adres(kap) };
        if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share(v).catch(function () {});
        else indir.click();
      }, "image/png");
    };
    var bag = el("button", "rp-arac", T("Bağlantıyı kopyala", "Copy link")); bag.type = "button";
    bag.onclick = function () { var u = adres(kap); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { bag.textContent = T("Kopyalandı ✓", "Copied ✓"); }).catch(function () { prompt("", u); }); };
    dug.append(indir, paylas, bag);
    kutu.append(secim, on, dug, not); perde.appendChild(kutu); document.body.appendChild(perde); document.body.style.overflow = "hidden";
    perde.addEventListener("click", function (e) { if (e.target === perde || e.target === x) kapat(); });
    yap(); x.focus();
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") kapat(); });

  // grafik kutuları: rapor figürleri ve bölümlerdeki g-* kutuları (figür içindekiler figürle birlikte)
  function tara() {
    var adaylar = [].slice.call(document.querySelectorAll("figure.rp-sekil, .rp-kucuk, article [id^='g-']"));
    adaylar.forEach(function (k) {
      if (k.dataset.gp || k.closest(".rp-buyut")) return;
      if (k.id && k.closest("figure.rp-sekil") || (k.id && k.closest(".rp-kucuk"))) return;
      if (!k.querySelector("svg, .rp-yigin, table, .rp-cubuk, .rp-kart, .rp-takvim, i")) return;
      k.dataset.gp = "1";
      var d = el("button", "gp-dugme", T("Paylaş", "Share")); d.type = "button"; d.title = T("Bu grafiği görsel olarak paylaş", "Share this chart as an image");
      d.addEventListener("click", function (e) { e.stopPropagation(); e.preventDefault(); ac(k); });
      if (getComputedStyle(k).position === "static") k.style.position = "relative";
      k.appendChild(d);
    });
  }
  var n = 0, zam = setInterval(function () { tara(); if (++n > 20) clearInterval(zam); }, 1000);
  document.addEventListener("rp-ciz", tara);
})();
