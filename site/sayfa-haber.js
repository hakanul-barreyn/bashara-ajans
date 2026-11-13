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
  function altlik() {
    return altlikSoz || (altlikSoz = Promise.all([
      fetch(new URL("../site/bolge-harita.json", location.href)).then(function (r) { return r.json(); }),
      fetch(new URL("../site/bolge-harita-yakin.json", location.href)).then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (x) { x[0].yakin = x[1]; return x[0]; }));
  }
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
    var Y = A.yakin, P0 = Y && Y.pencere;
    // Gazze şeridindeki olaylarda şerit ayrıntılı görünsün diye yakından başla
    var gazzede = function (y) { return y.lat > 31.2 && y.lat < 31.62 && y.lon > 34.19 && y.lon < 34.58; };
    if (Y && yerler.every(gazzede)) g.w = Math.max(0.62, g.w * 0.3);
    var yakinlar = []; try { yakinlar = JSON.parse(d.dataset.yakin || "[]"); } catch (e) {}
    d.textContent = "";
    var svg = sv("svg", { "class": "bh-svg", role: "img", "aria-label": d.getAttribute("aria-label") || "Harita" });
    d.appendChild(svg);
    var yol = function (halkalar) { return halkalar.map(function (h) { return "M" + h.map(function (p) { return px(p[0]).toFixed(3) + "," + py(p[1]).toFixed(3); }).join("L") + "Z"; }).join(""); };
    var kara = sv("path", { "class": "bh-kara", d: A.kara.map(yol).join("") });
    var sinir = sv("path", { "class": "bh-sinir", d: A.sinir.map(function (c) { return "M" + c.map(function (p) { return px(p[0]).toFixed(3) + "," + py(p[1]).toFixed(3); }).join("L"); }).join("") });
    var ust = sv("g", {});
    svg.append(sv("rect", { "class": "bh-deniz", x: -400, y: -400, width: 800, height: 800 }), kara, sinir);
    if (Y) {
      // ayrıntılı katman (Natural Earth 1:10m): pencerenin içinde kaba altlığın yerine geçer
      var ic = function (p) { return p[0] > P0[0] && p[0] < P0[2] && p[1] > P0[1] && p[1] < P0[3]; };
      sinir.setAttribute("d", A.sinir.filter(function (c) { return !ic(c[Math.floor(c.length / 2)]); }).map(function (c) { return "M" + c.map(function (p) { return px(p[0]).toFixed(3) + "," + py(p[1]).toFixed(3); }).join("L"); }).join(""));
      svg.append(sv("rect", { "class": "bh-deniz", x: px(P0[0]), y: py(P0[3]), width: px(P0[2]) - px(P0[0]), height: py(P0[1]) - py(P0[3]) }),
        sv("path", { "class": "bh-kara", d: Y.kara.map(function (h) { return "M" + h.map(function (p) { return px(p[0]).toFixed(4) + "," + py(p[1]).toFixed(4); }).join("L") + "Z"; }).join("") }));
      var sinir2 = sv("path", { "class": "bh-sinir", d: Y.sinir.map(function (c) { return "M" + c.map(function (p) { return px(p[0]).toFixed(4) + "," + py(p[1]).toFixed(4); }).join("L"); }).join("") });
      svg.appendChild(sinir2);
    }
    svg.appendChild(ust);
    function ciz() {
      var h = g.w / oran, b = g.w / W;   // b: bir ekran pikselinin harita birimi
      svg.setAttribute("viewBox", (g.x - g.w / 2) + " " + (g.y - h / 2) + " " + g.w + " " + h);
      sinir.style.strokeWidth = (1.1 * b) + "";
      if (Y) svg.querySelectorAll(".bh-sinir").forEach(function (x) { x.style.strokeWidth = (1.1 * b) + ""; });
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
      var adlar0 = yerler.map(function (y) { return y.ad; });
      yerler.forEach(function (y) {
        var x = px(y.lon), yy = py(y.lat);
        if (y.ana) ust.appendChild(sv("circle", { cx: x, cy: yy, r: 16 * b, "class": "bh-hale", "stroke-width": b }));
        ust.appendChild(sv("circle", { cx: x, cy: yy, r: (y.ana ? 6.5 : 5) * b, "class": y.ana ? "bh-yer" : "bh-yer bh-yer2", "stroke-width": 2 * b }));
        if (y.ad) { var t = yazi(x + 11 * b, yy + 5 * b, y.ad, y.ana ? "bh-yer-ad" : "bh-yer-ad bh-yer-ad2", y.ana ? 14 : 12.5); t.setAttribute("stroke-width", 4 * b);
          yer_var(x - 8 * b, yy + 6 * b, genislik(y.ad, y.ana ? 14 : 12.5) + 20 * b, 16 * b); }
      });
      // son 30 günde bu çevrede yazılan öteki olaylar: gri noktalar (üzerine gelince başlık; sayfası varsa tıklanır)
      // aynı noktadaki olaylar tek nokta: büyüklüğü ve içindeki sayı olay sayısı
      var kume = {};
      yakinlar.forEach(function (o) { var k2 = o[0].toFixed(2) + "," + o[1].toFixed(2); (kume[k2] = kume[k2] || []).push(o); });
      Object.keys(kume).forEach(function (k2) {
        var os = kume[k2], o = os[0], x = px(o[1]), y = py(o[0]); if (!icinde(x, y)) return;
        var r = (4.2 + 2.4 * Math.sqrt(os.length - 1)) * b;
        var gr = sv("g", { "class": "bh-yakin-g" });
        gr.appendChild(sv("circle", { cx: x, cy: y, r: r, "class": "bh-yakin", "stroke-width": 1.2 * b }));
        if (os.length > 1) { var tx = sv("text", { x: x, y: y + 3.4 * b, "text-anchor": "middle", "class": "bh-yakin-n", "font-size": 9.5 * b }); tx.textContent = os.length; gr.appendChild(tx); }
        var t = sv("title"); t.textContent = os.slice(0, 6).map(function (q) { return q[3] + " · " + q[2]; }).join("\n") + (os.length > 6 ? "\n…" : ""); gr.appendChild(t);
        var hedef = os.find(function (q) { return q[4]; });
        if (hedef) { var a2 = sv("a", { href: hedef[4] }); a2.appendChild(gr); ust.appendChild(a2); } else ust.appendChild(gr);
      });
      // ayrıntılı yerler: Gazze'nin mahalleleri, kampları, hastaneleri, geçişleri; Batı Şeria ve Güney Lübnan
      if (Y && g.w < 2.2) Y.yer.forEach(function (c) {
        var x = px(c[2]), y = py(c[1]); if (!icinde(x, y) || adlar0.indexOf(c[0]) >= 0) return;
        if (c[3] === "b") { var bn = genislik(c[0], 10.5) * 1.3; if (yer_var(x - bn / 2, y + 2 * b, bn, 11 * b)) yazi(x, y, c[0], "bh-bolge", 10.5, "middle"); return; }
        if (g.w > 1.3 && c[3] === "y") return;
        if (!yer_var(x - 3 * b, y + 4 * b, genislik(c[0], 10.5) + 10 * b, 12 * b)) return;
        if (c[3] === "h") { ust.appendChild(sv("path", { d: "M" + (x - 3.2 * b) + "," + y + "h" + 6.4 * b + "M" + x + "," + (y - 3.2 * b) + "v" + 6.4 * b, "class": "bh-hastane", "stroke-width": 2 * b })); }
        else if (c[3] === "g") ust.appendChild(sv("rect", { x: x - 2.6 * b, y: y - 2.6 * b, width: 5.2 * b, height: 5.2 * b, "class": "bh-gecis" }));
        else ust.appendChild(sv("circle", { cx: x, cy: y, r: 2.1 * b, "class": "bh-sehir-n" }));
        yazi(x + 5 * b, y + 3.6 * b, c[0], "bh-sehir bh-ince" + (c[3] === "h" ? " bh-h" : ""), 10.5);
      });
      A.ulke.forEach(function (u) { var x = px(u[2]), y = py(u[1]); var boy = u[0] === "FİLİSTİN" ? 15 : 12, gn = genislik(u[0], boy) * 1.25;
        if (icinde(x, y) && (g.w > 4 || u[0] === "FİLİSTİN") && yer_var(x - gn / 2, y + 2 * b, gn, boy * b)) yazi(x, y, u[0], u[0] === "FİLİSTİN" ? "bh-ulke bh-filistin" : "bh-ulke", boy, "middle"); });
      var onem = g.w > 14 ? 1 : g.w > 5 ? 2 : 3, adlar = adlar0;
      A.sehir.forEach(function (c) {
        var x = px(c[2]), y = py(c[1]);
        if (c[3] > onem || !icinde(x, y) || adlar.indexOf(c[0]) >= 0 || !yer_var(x - 3 * b, y + 4 * b, genislik(c[0], 11.5) + 8 * b, 13 * b)) return;
        ust.appendChild(sv("circle", { cx: x, cy: y, r: 2.4 * b, "class": "bh-sehir-n" }));
        yazi(x + 5 * b, y + 4 * b, c[0], "bh-sehir", 11.5);
      });
    }
    var olcek = document.createElement("div"); olcek.className = "bh-olcek"; d.appendChild(olcek);
    var konum = document.createElementNS(NS, "svg"); konum.setAttribute("class", "bh-konum"); konum.setAttribute("aria-hidden", "true"); d.appendChild(konum);
    var KB = [31.5, 26.0, 40.5, 37.5];   // konum haritası: batı, güney, doğu, kuzey
    konum.setAttribute("viewBox", px(KB[0]) + " " + py(KB[3]) + " " + (px(KB[2]) - px(KB[0])) + " " + (py(KB[1]) - py(KB[3])));
    konum.append(sv("rect", { "class": "bh-deniz", x: px(KB[0]), y: py(KB[3]), width: px(KB[2]) - px(KB[0]), height: py(KB[1]) - py(KB[3]) }), sv("path", { "class": "bh-kara", d: A.kara.map(yol).join("") }));
    var cerceve = sv("rect", { "class": "bh-konum-c" }); konum.appendChild(cerceve);
    var ciz0 = ciz;
    ciz = function () {
      ciz0();
      var h = g.w / oran, km = g.w * 111.32, hedef = km / 5, adim = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].reduce(function (a, c) { return c <= hedef ? c : a; }, 1);
      olcek.style.width = (100 * adim / km) + "%"; olcek.textContent = adim + " km";
      cerceve.setAttribute("x", g.x - g.w / 2); cerceve.setAttribute("y", g.y - h / 2); cerceve.setAttribute("width", g.w); cerceve.setAttribute("height", h);
      cerceve.setAttribute("stroke-width", (px(KB[2]) - px(KB[0])) / 60);
      konum.style.display = g.w > 6 ? "none" : "";
    };
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
  // Sokak düzeyinde harita: OpenStreetMap verisi (OpenFreeMap vektör karoları) + MapLibre. Ülke etiketleri ve sınır çizgileri
  // kaldırılır; bölgenin adı "Kuşatma altındaki Filistin", Gazze çevresi kesikli kuşatma hattı. Yüklenemezse eski SVG altlık.
  var EN = window.DIL === "en";
  var GAZZE_HAT = [[34.4812, 31.5831], [34.5201, 31.5583], [34.556, 31.5398], [34.5283, 31.5201], [34.4957, 31.4944], [34.4955, 31.4944], [34.4804, 31.4856], [34.3673, 31.3928], [34.3458, 31.3577], [34.3455, 31.3407], [34.3538, 31.3064], [34.3509, 31.2893], [34.3159, 31.2569], [34.2644, 31.2242], [34.2484, 31.2114], [34.2304, 31.2592], [34.2246, 31.2757], [34.2003, 31.3143], [34.2227, 31.3266], [34.2367, 31.3424], [34.2814, 31.3767], [34.3016, 31.4077], [34.3484, 31.4376], [34.3682, 31.4682], [34.4434, 31.5346], [34.4788, 31.5783], [34.4812, 31.5831]];
  var mlSoz = null;
  function maplibre() {
    if (window.maplibregl) return Promise.resolve(window.maplibregl);
    return mlSoz || (mlSoz = new Promise(function (ok, red) {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css"; document.head.appendChild(l);
      var sc = document.createElement("script"); sc.src = "https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      sc.onload = function () { window.maplibregl ? ok(window.maplibregl) : red(); }; sc.onerror = red; document.head.appendChild(sc);
      setTimeout(red, 15000);
    }));
  }
  function osmKur(d) {
    var lat = +d.dataset.lat, lon = +d.dataset.lon; if (!isFinite(lat) || !isFinite(lon)) return Promise.reject();
    return maplibre().then(function (ml) {
      return new Promise(function (ok, red) {
        var kap = document.createElement("div"); kap.className = "mk-ml"; d.textContent = ""; d.appendChild(kap);
        var gazze = lon > 34.2 && lon < 34.6 && lat > 31.2 && lat < 31.6;
        // boğaz, körfez, deniz, kanal: iki kıyı birden görünsün diye daha uzaktan
        var genis = /boğaz|bogaz|körfez|korfez|deniz|kanal|strait|gulf|sea\b|canal|bab[ -]?el|hürmüz|hormuz|mendeb|mandeb/i.test(d.dataset.ad || "");
        var yakinlik = gazze ? 12.5 : genis ? 7.4 : 10;
        var m = new ml.Map({ container: kap, style: "https://tiles.openfreemap.org/styles/liberty", center: [lon, lat], zoom: yakinlik, attributionControl: { compact: true }, cooperativeGestures: true });
        m.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        var bitti = false; setTimeout(function () { if (!bitti) red(); }, 20000);
        m.on("error", function () { if (!bitti) { bitti = true; red(); } });
        m.on("load", function () {
          bitti = true;
          m.getStyle().layers.forEach(function (l) {
            var sl = l["source-layer"];
            if (sl === "boundary" || /boundary/.test(l.id) || (sl === "place" && /country|state/.test(l.id))) m.removeLayer(l.id);
          });
          var yakin = []; try { yakin = JSON.parse(d.dataset.yakin || "[]"); } catch (e) { /* yok */ }
          var f = [{ type: "Feature", properties: { t: "hat" }, geometry: { type: "LineString", coordinates: GAZZE_HAT } },
            { type: "Feature", properties: { t: "ad", ad: EN ? "BESIEGED PALESTINE" : "KUŞATMA ALTINDAKİ FİLİSTİN", b: 1 }, geometry: { type: "Point", coordinates: [34.95, 31.6] } },
            { type: "Feature", properties: { t: "ad", ad: EN ? "GAZA STRIP" : "GAZZE ŞERİDİ", b: 0 }, geometry: { type: "Point", coordinates: [34.36, 31.43] } },
            { type: "Feature", properties: { t: "ad", ad: EN ? "WEST BANK" : "BATI ŞERİA", b: 0 }, geometry: { type: "Point", coordinates: [35.3, 32.0] } }];
          yakin.forEach(function (y) { f.push({ type: "Feature", properties: { t: "yakin", b: y[2], g: y[3], s: y[4] }, geometry: { type: "Point", coordinates: [y[1], y[0]] } }); });
          f.push({ type: "Feature", properties: { t: "olay", ad: d.dataset.ad || "" }, geometry: { type: "Point", coordinates: [lon, lat] } });
          // haberde adı geçen öteki yerler (ör. Riyad'daki havalimanı ile Yanbu'daki petrol tesisi): kırmızı noktalar, adlarıyla
          var ek = []; try { ek = JSON.parse(d.dataset.yerler || "[]"); } catch (e) { /* yok */ }
          ek.forEach(function (y) { if (isFinite(+y.lat) && isFinite(+y.lon)) f.push({ type: "Feature", properties: { t: "olay2", ad: y.ad || "" }, geometry: { type: "Point", coordinates: [+y.lon, +y.lat] } }); });
          if (ek.length) {
            var b = new ml.LngLatBounds([lon, lat], [lon, lat]); ek.forEach(function (y) { if (isFinite(+y.lat) && isFinite(+y.lon)) b.extend([+y.lon, +y.lat]); });
            m.fitBounds(b, { padding: 70, maxZoom: gazze ? 12.5 : genis ? 7.4 : 9, duration: 0 });
          }
          m.addSource("zbs", { type: "geojson", data: { type: "FeatureCollection", features: f } });
          m.addLayer({ id: "zbs-hat", type: "line", source: "zbs", filter: ["==", ["get", "t"], "hat"], paint: { "line-color": "#c9302c", "line-width": 2.5, "line-dasharray": [3, 2] } });
          m.addLayer({ id: "zbs-yakin", type: "circle", source: "zbs", filter: ["==", ["get", "t"], "yakin"], paint: { "circle-radius": 6, "circle-color": "#6b746f", "circle-opacity": 0.75, "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
          m.addLayer({ id: "zbs-olay", type: "circle", source: "zbs", filter: ["in", ["get", "t"], ["literal", ["olay", "olay2"]]], paint: { "circle-radius": ["case", ["==", ["get", "t"], "olay"], 9, 7], "circle-color": "#c9302c", "circle-stroke-color": "#fff", "circle-stroke-width": 3 } });
          m.addLayer({ id: "zbs-olay-ad", type: "symbol", source: "zbs", filter: ["all", ["in", ["get", "t"], ["literal", ["olay", "olay2"]]], ["!=", ["get", "ad"], ""]],
            layout: { "text-field": ["get", "ad"], "text-font": ["Noto Sans Bold"], "text-size": 13, "text-offset": [0, 1.3], "text-anchor": "top", "text-max-width": 12 },
            paint: { "text-color": "#8f1f1b", "text-halo-color": "#fffdf8", "text-halo-width": 2 } });
          // "Kuşatma altındaki Filistin" her ölçekte, normal boyda; Gazze Şeridi ve Batı Şeria yazıları yalnızca yakınlaşınca (üst üste binmesin)
          m.addLayer({ id: "zbs-ad", type: "symbol", source: "zbs", filter: ["all", ["==", ["get", "t"], "ad"], ["==", ["get", "b"], 1]],
            layout: { "text-field": ["get", "ad"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-letter-spacing": 0.08, "text-max-width": 9 },
            paint: { "text-color": "#1f5c43", "text-halo-color": "#fffdf8", "text-halo-width": 2 } });
          m.addLayer({ id: "zbs-ad-ic", type: "symbol", source: "zbs", minzoom: 7.5, filter: ["all", ["==", ["get", "t"], "ad"], ["==", ["get", "b"], 0]],
            layout: { "text-field": ["get", "ad"], "text-font": ["Noto Sans Bold"], "text-size": 12, "text-letter-spacing": 0.08 },
            paint: { "text-color": "#1f5c43", "text-halo-color": "#fffdf8", "text-halo-width": 2 } });
          m.on("click", "zbs-yakin", function (e) {
            var p = e.features[0].properties, ic = document.createElement("div"); ic.className = "mk-ml-acik";
            var b = document.createElement(p.s ? "a" : "span"); b.textContent = p.b; if (p.s) b.href = (/^https?:|^\.\.\//.test(p.s) ? p.s : "../" + p.s);
            var t = document.createElement("small"); t.textContent = p.g; ic.append(b, t);
            new ml.Popup({ closeButton: true, maxWidth: "260px" }).setLngLat(e.lngLat).setDOMContent(ic).addTo(m);
          });
          m.on("mouseenter", "zbs-yakin", function () { m.getCanvas().style.cursor = "pointer"; });
          m.on("mouseleave", "zbs-yakin", function () { m.getCanvas().style.cursor = ""; });
          ok();
        });
      });
    });
  }
  var haritaGozcu = "IntersectionObserver" in window ? new IntersectionObserver(function (g) {
    g.forEach(function (x) {
      if (!x.isIntersecting) return;
      haritaGozcu.unobserve(x.target);
      var d = x.target;
      var eski = function () { altlik().then(function (A) { haritaKur(d, A); })
        .catch(function () { d.querySelectorAll("noscript").forEach(function (n) { d.innerHTML = n.textContent; }); }); };
      osmKur(d).catch(eski);
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
