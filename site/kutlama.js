// Kutlama süsü: açılış, Ramazan Bayramı, Kurban Bayramı. Ana sayfaya girince bayrak zincirleri ve kefiye desenli bir pano çıkar;
// okur tekerleği çevirene, tıklayana ya da tuşa basana kadar açık kalır (ilk 3 saniye hiçbir hareketle kapanmaz). Her ziyaretçiye her kutlamada bir kez gösterilir.
// Açıp kapatmak: site/kutlama.json  {"tur": "acilis|ramazan|kurban", "bitis": "YYYY-MM-DD"}  (tur boşsa kapalı).
// Önizleme: ?kutlama=acilis|ramazan|kurban (her seferinde gösterir).
(function () {
  "use strict";
  var METIN = {
    acilis: {
      tr: { ust: "ZBS yayında", bas: "Açıldık!", alt: "Bölgenin, İsrail'in ve Batı'nın basını tek sayfada: aynı olay, kim nasıl yazdı." },
      en: { ust: "ZBS is live", bas: "We're open!", alt: "Regional, Israeli and Western press on one page: the same event, and who told it how." }
    },
    yukleme: {
      tr: { ust: "ZBS", bas: "Hoş geldiniz", alt: "Mağrip’ten Körfez’e, İsrail’den Batı’ya yüzlerce yayının son haberleri derleniyor…" },
      en: { ust: "ZBS", bas: "Welcome", alt: "Gathering the latest from hundreds of outlets, from the Maghreb to the Gulf, Israel and the West…" }
    },
    ramazan: {
      ar: "عيد فطر مبارك",
      tr: { ust: "Ramazan Bayramı", bas: "Bayramınız mübarek olsun", alt: "Bayramı abluka altında, çadırlarda karşılayan Gazze'yi unutmadan." },
      en: { ust: "Eid al-Fitr", bas: "Eid Mubarak", alt: "Remembering Gaza, greeting Eid under siege and in tents." }
    },
    kurban: {
      ar: "عيد أضحى مبارك",
      tr: { ust: "Kurban Bayramı", bas: "Bayramınız mübarek olsun", alt: "Bayramı abluka altında, çadırlarda karşılayan Gazze'yi unutmadan." },
      en: { ust: "Eid al-Adha", bas: "Eid Mubarak", alt: "Remembering Gaza, greeting Eid under siege and in tents." }
    }
  };
  var YESIL = "#149954", KIRMIZI = "#e4312b", SIYAH = "#111", BEYAZ = "#fff";


  // Bir bayrak: zincirden sarkan dikey bayrak (yeşil-beyaz-siyah şerit, üstte kırmızı üçgen)
  // Asılma noktası dış grubun (0,0) noktası: sallanma ve savrulma hep ipteki noktanın çevresinde döner
  function bayrak(x, y, aci, s) {
    var w = 34 * s, h = 52 * s, x0 = -w / 2;
    return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (aci * 0.3).toFixed(1) + ')">' +
      '<g class="kt-bayrak" style="animation-delay:' + (-Math.random() * 3).toFixed(2) + 's">' +
      '<rect x="' + x0 + '" y="0" width="' + (w / 3) + '" height="' + h + '" fill="' + YESIL + '"/>' +
      '<rect x="' + (x0 + w / 3) + '" y="0" width="' + (w / 3) + '" height="' + h + '" fill="' + BEYAZ + '"/>' +
      '<rect x="' + (x0 + 2 * w / 3) + '" y="0" width="' + (w / 3) + '" height="' + h + '" fill="' + SIYAH + '"/>' +
      '<path d="M' + x0 + ' 0H' + (w / 2) + 'L0 ' + (h * 0.42) + 'Z" fill="' + KIRMIZI + '"/></g></g>';
  }
  // Bir zincir: iki uç arasında sarkan ip (ikinci dereceden eğri) ve üzerindeki bayraklar
  function zincir(W, y1, y2, sark, adet, s) {
    var cx = W / 2, cy = (y1 + y2) / 2 + sark;
    var g = '<path d="M-20 ' + y1 + ' Q' + cx + ' ' + (2 * cy - (y1 + y2) / 2) + ' ' + (W + 20) + ' ' + y2 + '" fill="none" stroke="' + SIYAH + '" stroke-width="1.6"/>';
    for (var i = 0; i < adet; i++) {
      var t = (i + 0.5) / adet, x0 = -20, x2 = W + 20, ky = 2 * cy - (y1 + y2) / 2;
      var x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x2;
      var y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * ky + t * t * y2;
      var egim = Math.atan2(2 * (1 - t) * (ky - y1) + 2 * t * (y2 - ky), 2 * (1 - t) * (cx - x0) + 2 * t * (x2 - cx)) * 180 / Math.PI;
      g += bayrak(x, y, egim, s);
    }
    return g;
  }
  // Kefiye: ağ deseni (çapraz çizgiler, düğümlerde benekler), zeytin yaprağı şeridi ve ince damalı şerit
  var DESEN =
    '<defs>' +
    '<pattern id="kt-ag" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<rect width="28" height="28" fill="' + BEYAZ + '"/><path d="M0 14H28M14 0V28" stroke="' + SIYAH + '" stroke-width="1.8" stroke-dasharray="2.4 1.2"/>' +
    '<rect x="9.5" y="9.5" width="9" height="9" rx="2.5" fill="' + SIYAH + '"/></pattern>' +
    '<pattern id="kt-yaprak" width="22" height="30" patternUnits="userSpaceOnUse">' +
    '<rect width="22" height="30" fill="' + BEYAZ + '"/><path d="M3 27C3 16 9 7 20 3C21 14 14 23 3 27Z" fill="' + SIYAH + '"/><path d="M5 25L17 7" stroke="' + BEYAZ + '" stroke-width="1"/></pattern>' +
    '<pattern id="kt-dama" width="6" height="6" patternUnits="userSpaceOnUse">' +
    '<rect width="6" height="6" fill="' + BEYAZ + '"/><rect width="3" height="3" fill="' + SIYAH + '"/><rect x="3" y="3" width="3" height="3" fill="' + SIYAH + '"/></pattern>' +
    '</defs>';

  function baslat(tur, onizleme) {
    var dil = window.DIL === "en" ? "en" : "tr", m = METIN[tur][dil], ar = METIN[tur].ar;
    var css =
      '#kutlama{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:16px;' +
      'padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));' +
      'background:rgba(12,14,12,.58);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:kt-gir .5s ease both;overflow:hidden}' +
      '#kutlama svg.kt-zincir{position:absolute;left:0;width:100%;height:auto;pointer-events:none}' +
      '#kutlama .kt-z1{top:-6px}#kutlama .kt-z2{top:-6px}' +
      '.kt-bayrak{transform-box:view-box;transform-origin:0 0;animation:kt-salla 2.8s ease-in-out infinite alternate;pointer-events:auto}' +
      '.kt-bayrak.kt-carp{animation:kt-carp 1.5s cubic-bezier(.25,.6,.35,1)}' +
      '@keyframes kt-carp{0%{transform:rotate(0)}15%{transform:rotate(calc(var(--yon)*24deg*var(--guc)))}35%{transform:rotate(calc(var(--yon)*-15deg*var(--guc)))}' +
      '55%{transform:rotate(calc(var(--yon)*9deg*var(--guc)))}75%{transform:rotate(calc(var(--yon)*-4deg*var(--guc)))}100%{transform:rotate(0)}}' +
      '#kutlama .kt-pano{position:relative;z-index:2;width:min(560px,100%);background:' + BEYAZ + ';color:' + SIYAH + ';border-radius:6px;overflow:hidden;' +
      'box-shadow:0 30px 80px rgba(0,0,0,.45);animation:kt-pano .7s cubic-bezier(.2,.9,.3,1.2) .15s both;text-align:center}' +
      '#kutlama .kt-pano svg{display:block;width:100%;height:auto}' +
      '#kutlama .kt-ic{padding:26px 28px 22px;display:flex;flex-direction:column;gap:10px;align-items:center}' +
      '#kutlama .kt-ust{font:700 .78rem/1 "Plus Jakarta Sans",system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:' + YESIL + '}' +
      '#kutlama .kt-ar{font:700 1.7rem/1.3 "Noto Naskh Arabic","Amiri",serif;color:' + KIRMIZI + '}' +
      '#kutlama h2{margin:0;font:800 clamp(2rem,7vw,3.2rem)/1.05 "Source Serif 4",Georgia,serif;text-wrap:balance}' +
      '#kutlama p{margin:0;max-width:40ch;font:400 1rem/1.5 "Plus Jakarta Sans",system-ui,sans-serif;color:#3a3d3a;text-wrap:balance}' +
      '#kutlama .kt-ipucu{margin-top:6px;font:500 .74rem/1 "Plus Jakarta Sans",system-ui,sans-serif;color:#7a7f7a}' +
      '#kutlama .kt-kapat{position:absolute;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:0;background:rgba(255,255,255,.92);' +
      'color:' + SIYAH + ';font:700 18px/34px system-ui;cursor:pointer;z-index:2}' +
      '#kutlama .kt-konfeti{position:absolute;top:-20px;width:9px;height:14px;border-radius:2px;animation:kt-dus linear infinite;pointer-events:none;z-index:1}' +
      '#kutlama.kt-git{animation:kt-cik .7s ease forwards}' +
      '#kutlama.kt-git .kt-pano{animation:kt-pano-cik .6s ease forwards}' +
      '#kutlama.kt-git svg.kt-zincir{transition:transform .6s cubic-bezier(.5,0,.8,.4);transform:translateY(-110%)}' +
      '@keyframes kt-gir{from{opacity:0}}@keyframes kt-cik{to{opacity:0;visibility:hidden}}' +
      '@keyframes kt-pano{from{opacity:0;transform:translateY(24px) scale(.94)}}' +
      '@keyframes kt-pano-cik{to{opacity:0;transform:translateY(-40px) scale(.96)}}' +
      '@keyframes kt-salla{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}' +
      '@keyframes kt-dus{to{transform:translateY(110vh) rotate(720deg)}}' +
      '#kutlama .kt-cubuk{width:min(240px,70%);height:4px;border-radius:4px;background:#e4e2db;overflow:hidden;margin-top:8px}' +
      '#kutlama .kt-cubuk i{display:block;height:100%;width:40%;background:' + YESIL + ';border-radius:4px;animation:kt-cubuk 1.3s ease-in-out infinite}' +
      '#kutlama.kt-hata .kt-cubuk{display:none}#kutlama.kt-hata p{color:' + KIRMIZI + '}' +
      '@keyframes kt-cubuk{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}' +
      '@media (prefers-reduced-motion:reduce){#kutlama *,#kutlama{animation:none!important}#kutlama .kt-konfeti{display:none}}';
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

    var W = 1200, kok = document.createElement("div");
    kok.id = "kutlama"; kok.setAttribute("role", "dialog"); kok.setAttribute("aria-label", m.bas);
    var dar = innerWidth < 640, s = dar ? 1.5 : 1;
    kok.innerHTML =
      '<svg class="kt-zincir kt-z1" viewBox="0 0 ' + W + ' 260" aria-hidden="true">' + zincir(W, 10, 30, 70, dar ? 9 : 16, s) + '</svg>' +
      '<svg class="kt-zincir kt-z2" viewBox="0 0 ' + W + ' 260" aria-hidden="true">' + zincir(W, 60, 0, 120, dar ? 8 : 14, s * 0.9) + '</svg>' +
      '<div class="kt-pano">' +
      '<button class="kt-kapat" type="button" aria-label="' + (dil === "en" ? "Close" : "Kapat") + '">×</button>' +
      '<svg viewBox="0 0 560 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + DESEN +
      '<rect width="560" height="78" fill="url(#kt-ag)"/><rect y="80" width="560" height="10" fill="url(#kt-dama)"/>' +
      '<rect y="92" width="560" height="28" fill="url(#kt-yaprak)"/><rect y="78" width="560" height="2" fill="' + SIYAH + '"/>' +
      '<rect y="90" width="560" height="2" fill="' + SIYAH + '"/></svg>' +
      '<div class="kt-ic">' + (ar ? '<div class="kt-ar" lang="ar" dir="rtl">' + ar + '</div>' : "") +
      '<div class="kt-ust">' + m.ust + '</div><h2>' + m.bas + '</h2><p>' + m.alt + '</p>' +
      (tur === "yukleme" ? '<div class="kt-cubuk" aria-hidden="true"><i></i></div>'
        : '<div class="kt-ipucu">' + (dil === "en" ? "Scroll to continue" : "Devam etmek için kaydırın") + '</div>') + '</div>' +
      '<svg viewBox="0 0 560 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<rect y="0" width="560" height="2" fill="' + SIYAH + '"/><rect y="4" width="560" height="8" fill="url(#kt-dama)"/>' +
      '<rect y="14" width="560" height="4" fill="' + YESIL + '"/><rect y="18" width="560" height="4" fill="' + BEYAZ + '"/>' +
      '<rect y="22" width="560" height="4" fill="' + SIYAH + '"/><rect y="26" width="560" height="14" fill="' + KIRMIZI + '"/></svg>' +
      '</div>';
    var renk = [YESIL, KIRMIZI, SIYAH, BEYAZ];
    for (var i = 0; i < (tur === "yukleme" ? 0 : dar ? 22 : 40); i++) {
      var c = document.createElement("i"); c.className = "kt-konfeti";
      c.style.left = (Math.random() * 100).toFixed(1) + "%";
      c.style.background = renk[i % 4];
      c.style.animationDuration = (4 + Math.random() * 5).toFixed(1) + "s";
      c.style.animationDelay = (-Math.random() * 8).toFixed(1) + "s";
      kok.appendChild(c);
    }
    document.body.appendChild(kok);

    // İmleç bayrakların üzerinden geçince bayrak (ve iki yanındakiler daha az) imlecin gittiği yöne savrulur
    var sonX = null, hiz = 1;
    kok.addEventListener("pointermove", function (e) { if (sonX != null) hiz = e.clientX - sonX; sonX = e.clientX; });
    kok.querySelectorAll("svg.kt-zincir").forEach(function (z) {
      var bayraklar = Array.prototype.slice.call(z.querySelectorAll(".kt-bayrak"));
      bayraklar.forEach(function (b, i) {
        b.addEventListener("pointerenter", function () {
          var yon = hiz < 0 ? -1 : 1;
          [[i, 1], [i - 1, .45], [i + 1, .45]].forEach(function (c) {
            var f = bayraklar[c[0]]; if (!f) return;
            f.style.setProperty("--yon", yon); f.style.setProperty("--guc", c[1] * Math.min(1.6, .7 + Math.abs(hiz) / 25));
            f.classList.remove("kt-carp"); void f.getBoundingClientRect(); f.classList.add("kt-carp");
          });
        });
        b.addEventListener("animationend", function (e) { if (e.animationName === "kt-carp") b.classList.remove("kt-carp"); });
      });
    });

    // Yalnızca okurun kendi hareketi kapatır: tekerlek, tıklama, dokunup kaydırma, tuş. İmleç gezdirmek ve sayfanın
    // kendiliğinden kayması (tarayıcının kaydırma konumunu geri yüklemesi gibi) kapatmaz.
    var gitti = false, olaylar = ["wheel", "pointerdown", "touchmove", "keydown"];
    function git() {
      if (gitti) return; gitti = true;
      olaylar.forEach(function (o) { removeEventListener(o, git, true); });
      kok.classList.add("kt-git");
      setTimeout(function () { kok.remove(); st.remove(); }, 750);
    }
    kok.querySelector(".kt-kapat").addEventListener("click", git);
    if (tur === "yukleme") {
      // haberler gelince hemen kapanır; gelmezse uyarı
      var acildi = Date.now();
      var hazir = function () { git(); };
      if (window.ZBS_HAZIR) hazir(); else addEventListener("zbs-hazir", hazir, { once: true });
      addEventListener("zbs-hata", function () { kok.classList.add("kt-hata"); kok.querySelector("p").textContent = dil === "en" ? "The news could not be loaded. Please refresh the page." : "Haberler yüklenemedi. Sayfayı yenileyin."; }, { once: true });
      setTimeout(git, 20000);
      return;
    }
    // Açıldıktan sonraki ilk 3 saniyede gelen hareketler yok sayılır: süs görülmeden kapanmasın
    setTimeout(function () { olaylar.forEach(function (o) { addEventListener(o, git, { capture: true, passive: true }); }); }, 3000);
  }
  var q = null;
  try { q = new URLSearchParams(location.search).get("kutlama"); } catch (e) {}
  if (q && METIN[q]) { baslat(q, true); return; }
  // ana sayfanın ilk açılışında, haberler gelene kadar karşılama ekranı
  if (document.getElementById("akis") && !window.ZBS_HAZIR) {
    // haberler çeyrek saniyede geldiyse karşılama hiç gösterilmez (göz kırpması olmasın)
    setTimeout(function () { if (!window.ZBS_HAZIR && document.body) baslat("yukleme", false); }, 250);
    // bayram süsü varsa karşılamadan sonra gösterilsin
    var sonra = function (f) { if (window.ZBS_HAZIR) setTimeout(f, 1200); else addEventListener("zbs-hazir", function () { setTimeout(f, 1200); }, { once: true }); };
    fetch("site/kutlama.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (k) {
      if (!k || !METIN[k.tur] || k.tur === "acilis" || k.tur === "yukleme") return;
      if (k.bitis && new Date().toISOString().slice(0, 10) > k.bitis) return;
      var anahtar = "zbs-kutlama-" + k.tur + "-" + (k.bitis || "");
      try { if (localStorage.getItem(anahtar)) return; localStorage.setItem(anahtar, "1"); } catch (e) {}
      sonra(function () { baslat(k.tur, false); });
    }).catch(function () {});
    return;
  }
  fetch("site/kutlama.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (k) {
    if (!k || !METIN[k.tur]) return;
    if (k.bitis && new Date().toISOString().slice(0, 10) > k.bitis) return;
    var anahtar = "zbs-kutlama-" + k.tur + "-" + (k.bitis || "");
    try { if (localStorage.getItem(anahtar)) return; localStorage.setItem(anahtar, "1"); } catch (e) {}
    baslat(k.tur, false);
  }).catch(function () {});
})();
