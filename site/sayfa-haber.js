// Haber sayfası: paylaş düğmeleri, geri tuşu ve sonsuz akış (sayfa sonunda sıradaki haber kendiliğinden yüklenir)
(function () {
  var DIL = window.DIL || "tr";

  function paylasBagla(kok) {
    kok.querySelectorAll("[data-paylas]").forEach(function (b) {
      if (b._bagli) return; b._bagli = true;
      b.addEventListener("click", function () {
        var kap = b.closest("[data-adres]"), url = (kap && kap.dataset.adres) || location.href.split("#")[0];
        if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: document.title, url: url }).catch(function () {}); return; }
        var eski = b.textContent;
        (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
          b.textContent = DIL === "en" ? "Link copied" : "Bağlantı kopyalandı";
        }).catch(function () { window.prompt("", url); });
        setTimeout(function () { b.textContent = eski; }, 2000);
      });
    });
    kok.querySelectorAll("[data-ag]").forEach(function (a) {
      var kap = a.closest("[data-adres]");
      var url = encodeURIComponent(kap ? kap.dataset.adres : location.href.split("#")[0]);
      var bas = encodeURIComponent(((kap && kap.dataset.baslik) || document.title).replace(/ \| .*$/, ""));
      a.href = { whatsapp: "https://wa.me/?text=" + bas + "%20" + url, telegram: "https://t.me/share/url?url=" + url + "&text=" + bas,
                 x: "https://twitter.com/intent/tweet?url=" + url + "&text=" + bas }[a.dataset.ag];
      a.target = "_blank";
    });
  }

  function dilUygula(kok) {
    kok.querySelectorAll("[data-dil]").forEach(function (x) { x.hidden = x.dataset.dil !== DIL; });
  }

  // Harita: kendi bölge altlığımız (site/bolge-harita.json, Natural Earth). Dış harita servisi yok; okurun adresi kimseye
  // gitmez. İsrail adı ve 1948 öncesi Filistin'in içindeki çizgi çizilmez; bölge "FİLİSTİN" diye yazılır.
  // Olayın yeri kırmızı; olay birden çok yeri ilgilendiriyorsa öteki yerler de işaretli ve hepsi görünecek biçimde açılır.
  var altlikSoz = null, NS = "http://www.w3.org/2000/svg";
  function altlik() { return altlikSoz || (altlikSoz = fetch(new URL("../site/bolge-harita.json", location.href)).then(function (r) { return r.json(); })); }
  function sv(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  function haritaKur(d, A) {
    var yerler = [{ ad: d.dataset.ad || "", lat: +d.dataset.lat, lon: +d.dataset.lon, ana: true }];
    try { JSON.parse(d.dataset.yerler || "[]").forEach(function (y) { yerler.push({ ad: y.ad, lat: +y.lat, lon: +y.lon }); }); } catch (e) {}
    var k = Math.cos(yerler[0].lat * Math.PI / 180);
    var px = function (lon) { return lon * k; }, py = function (lat) { return -lat; };
    var xs = yerler.map(function (y) { return px(y.lon); }), ys = yerler.map(function (y) { return py(y.lat); });
    var W = d.clientWidth || 760, H = d.clientHeight || 380, oran = W / H;
    var g = { x: (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, y: (Math.min.apply(0, ys) + Math.max.apply(0, ys)) / 2,
      w: Math.max(2.6, (Math.max.apply(0, xs) - Math.min.apply(0, xs)) * 1.5, (Math.max.apply(0, ys) - Math.min.apply(0, ys)) * 1.6 * oran) };
    d.textContent = "";
    var svg = sv("svg", { "class": "bh-svg", role: "img", "aria-label": d.getAttribute("aria-label") || "Harita" });
    d.appendChild(svg);
    var yol = function (halkalar) { return halkalar.map(function (h) { return "M" + h.map(function (p) { return px(p[0]).toFixed(3) + "," + py(p[1]).toFixed(3); }).join("L") + "Z"; }).join(""); };
    var kara = sv("path", { "class": "bh-kara", d: A.kara.map(yol).join("") });
    var sinir = sv("path", { "class": "bh-sinir", d: A.sinir.map(function (c) { return "M" + c.map(function (p) { return px(p[0]).toFixed(3) + "," + py(p[1]).toFixed(3); }).join("L"); }).join("") });
    var ust = sv("g", {});
    svg.append(sv("rect", { "class": "bh-deniz", x: -400, y: -400, width: 800, height: 800 }), kara, sinir, ust);
    function ciz() {
      var h = g.w / oran, b = g.w / W;   // b: bir ekran pikselinin harita birimi
      svg.setAttribute("viewBox", (g.x - g.w / 2) + " " + (g.y - h / 2) + " " + g.w + " " + h);
      sinir.style.strokeWidth = (1.1 * b) + "";
      ust.textContent = "";
      var yazi = function (x, y, metin, sinif, boy, bas) {
        var t = sv("text", { x: x, y: y, "class": sinif, "font-size": boy * b }); t.textContent = metin;
        if (bas) t.setAttribute("text-anchor", bas); ust.appendChild(t); return t;
      };
      var icinde = function (x, y) { return Math.abs(x - g.x) < g.w / 2 && Math.abs(y - g.y) < h / 2; };
      // yazılar üst üste binmesin: önce olayın yerleri, sonra ülke adları, sonra şehirler; çakışan yazılmaz
      var kutular = [];
      var yer_var = function (x, y, gen, yuk) {
        var k2 = { a: x, b: y - yuk, c: x + gen, d: y + 2 * b };
        if (kutular.some(function (q) { return k2.a < q.c && k2.c > q.a && k2.b < q.d && k2.d > q.b; })) return false;
        kutular.push(k2); return true;
      };
      var genislik = function (metin, boy) { return metin.length * boy * 0.62 * b; };
      yerler.forEach(function (y) {
        var x = px(y.lon), yy = py(y.lat);
        if (y.ana) ust.appendChild(sv("circle", { cx: x, cy: yy, r: 16 * b, "class": "bh-hale", "stroke-width": b }));
        ust.appendChild(sv("circle", { cx: x, cy: yy, r: (y.ana ? 6.5 : 5) * b, "class": y.ana ? "bh-yer" : "bh-yer bh-yer2", "stroke-width": 2 * b }));
        if (y.ad) { var t = yazi(x + 11 * b, yy + 5 * b, y.ad, y.ana ? "bh-yer-ad" : "bh-yer-ad bh-yer-ad2", y.ana ? 14 : 12.5); t.setAttribute("stroke-width", 4 * b);
          yer_var(x - 8 * b, yy + 6 * b, genislik(y.ad, y.ana ? 14 : 12.5) + 20 * b, 16 * b); }
      });
      A.ulke.forEach(function (u) { var x = px(u[2]), y = py(u[1]); var boy = u[0] === "FİLİSTİN" ? 15 : 12, gn = genislik(u[0], boy) * 1.25;
        if (icinde(x, y) && (g.w > 4 || u[0] === "FİLİSTİN") && yer_var(x - gn / 2, y + 2 * b, gn, boy * b)) yazi(x, y, u[0], u[0] === "FİLİSTİN" ? "bh-ulke bh-filistin" : "bh-ulke", boy, "middle"); });
      var onem = g.w > 14 ? 1 : g.w > 5 ? 2 : 3, adlar = yerler.map(function (y) { return y.ad; });
      A.sehir.forEach(function (c) {
        var x = px(c[2]), y = py(c[1]);
        if (c[3] > onem || !icinde(x, y) || adlar.indexOf(c[0]) >= 0 || !yer_var(x - 3 * b, y + 4 * b, genislik(c[0], 11.5) + 8 * b, 13 * b)) return;
        ust.appendChild(sv("circle", { cx: x, cy: y, r: 2.4 * b, "class": "bh-sehir-n" }));
        yazi(x + 5 * b, y + 4 * b, c[0], "bh-sehir", 11.5);
      });
    }
    ciz();
    // yakınlaştırma düğmeleri ve sürükleme
    var dg = document.createElement("div"); dg.className = "bh-dugmeler";
    [["+", 0.6, "Yakınlaştır"], ["−", 1.6, "Uzaklaştır"]].forEach(function (z) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = z[0]; b.setAttribute("aria-label", z[2]);
      b.onclick = function () { g.w = Math.min(90, Math.max(0.8, g.w * z[1])); ciz(); }; dg.appendChild(b);
    });
    d.appendChild(dg);
    var at = document.createElement("span"); at.className = "bh-atif"; at.textContent = "Sınırlar: Natural Earth"; d.appendChild(at);
    var surukle = null;
    svg.addEventListener("pointerdown", function (e) { surukle = { x: e.clientX, y: e.clientY, gx: g.x, gy: g.y }; svg.setPointerCapture(e.pointerId); });
    svg.addEventListener("pointermove", function (e) {
      if (!surukle) return; var b = g.w / (d.clientWidth || W);
      g.x = surukle.gx - (e.clientX - surukle.x) * b; g.y = surukle.gy - (e.clientY - surukle.y) * b; ciz();
    });
    svg.addEventListener("pointerup", function () { surukle = null; });
  }
  var haritaGozcu = "IntersectionObserver" in window ? new IntersectionObserver(function (g) {
    g.forEach(function (x) {
      if (!x.isIntersecting) return;
      haritaGozcu.unobserve(x.target);
      var d = x.target;
      altlik().then(function (A) { haritaKur(d, A); })
        .catch(function () { d.querySelectorAll("noscript").forEach(function (n) { d.innerHTML = n.textContent; }); });
    });
  }, { rootMargin: "200px 0px" }) : null;
  function haritalar(kok) { if (haritaGozcu) kok.querySelectorAll(".mk-osm").forEach(function (d) { haritaGozcu.observe(d); }); }
  haritalar(document);

  var ilk = document.querySelector(".mk-makale");
  if (ilk) { ilk.dataset.adres = location.href.split("#")[0]; }
  paylasBagla(document);

  // Geri tuşu: dışarıdan gelindiyse geçmişe önce ana sayfa yazılır
  try {
    var ic = document.referrer && new URL(document.referrer).origin === location.origin;
    if (!ic && history.pushState) {
      var ana = new URL("../", location.href).href, burasi = location.href;
      history.replaceState({ zbsAna: true }, "", ana);
      history.pushState({ zbsHaber: true }, "", burasi);
      window.addEventListener("popstate", function (e) { if (e.state && e.state.zbsAna) location.replace(ana); });
    }
  } catch (e) { /* eski tarayıcı */ }

  // Sonsuz akış: makalenin sonuna gelince sıradaki haberin makalesi alta eklenir (en çok 5); adres çubuğu okunan habere göre değişir
  var akis = document.getElementById("akis");
  if (!akis || !("IntersectionObserver" in window)) return;
  var yuklenen = 0, gorulen = {}, son = ilk, yukleniyor = false;
  gorulen[location.pathname.split("/").pop()] = true;
  var isaret = document.createElement("div"); isaret.className = "mk-yukleniyor"; akis.after(isaret);

  // Bir haber bitip sıradaki başlamadan önce: "Haberin sonu" çizgisi ve okuma önerileri (sayfanın 'Okumaya devam' kartlarından)
  var sonOneri = Array.prototype.slice.call(document.querySelectorAll(".mk-alt .mk-daha"));
  function oneriBlok(dahalar, haric) {
    var d = dahalar.filter(function (x) { return x.dataset.dil === DIL; })[0] || dahalar[0];
    if (!d) return null;
    var hedef = (haric || "").split("/").pop();
    var kartlar = Array.prototype.slice.call(d.querySelectorAll(".mk-kart")).filter(function (a) { return (a.getAttribute("href") || "").split("/").pop() !== hedef; }).slice(0, 4);
    if (!kartlar.length) return null;
    var b = document.createElement("section"); b.className = "mk-ara";
    var son = document.createElement("p"); son.className = "mk-ara-son"; son.textContent = DIL === "en" ? "End of story" : "Haberin sonu";
    var h = document.createElement("h2"); h.textContent = DIL === "en" ? "Recommended reading" : "Okuma önerileri";
    var k = document.createElement("div"); k.className = "mk-kartlar";
    kartlar.forEach(function (a) { k.appendChild(document.importNode(a, true)); });
    b.append(son, h, k);
    return b;
  }

  function sonrakiYukle() {
    var sonraki = son && son.dataset.sonraki;
    if (yukleniyor || !sonraki || gorulen[sonraki] || yuklenen >= 5) { isaret.textContent = ""; return; }
    yukleniyor = true; gorulen[sonraki] = true;
    isaret.textContent = DIL === "en" ? "Loading the next story…" : "Sıradaki haber yükleniyor…";
    fetch(sonraki).then(function (r) { return r.ok ? r.text() : Promise.reject(); }).then(function (metin) {
      var dok = new DOMParser().parseFromString(metin, "text/html");
      var m = dok.querySelector(".mk-makale");
      if (!m) return;
      var kap = document.createElement("section"); kap.className = "mk-sirada";
      var et = document.createElement("span"); et.className = "mk-sirada-etiket"; et.textContent = DIL === "en" ? "Next story" : "Sıradaki haber";
      kap.appendChild(et);
      m.dataset.adres = new URL(sonraki, location.href).href;
      kap.appendChild(document.importNode(m, true));
      var ob = oneriBlok(sonOneri, sonraki); if (ob) akis.appendChild(ob);
      sonOneri = Array.prototype.slice.call(dok.querySelectorAll(".mk-alt .mk-daha"));
      akis.appendChild(kap);
      son = kap.querySelector(".mk-makale");
      dilUygula(kap); paylasBagla(kap); haritalar(kap); izle(son);
      yuklenen++;
    }).catch(function () {}).finally(function () { yukleniyor = false; isaret.textContent = ""; });
  }
  new IntersectionObserver(function (g) { if (g[0].isIntersecting) sonrakiYukle(); }, { rootMargin: "600px 0px" }).observe(isaret);

  // Okunan makaleye göre adres ve sekme başlığı (geçmişe yeni kayıt eklemeden)
  var okuyan = new IntersectionObserver(function (g) {
    g.forEach(function (x) {
      if (x.isIntersecting && x.target.dataset.adres) {
        try { history.replaceState(history.state, "", x.target.dataset.adres); } catch (e) {}
        if (x.target.dataset.baslik) document.title = x.target.dataset.baslik;
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  function izle(m) { if (m) okuyan.observe(m); }
  izle(ilk);
})();
