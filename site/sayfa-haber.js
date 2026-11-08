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
      akis.appendChild(kap);
      son = kap.querySelector(".mk-makale");
      dilUygula(kap); paylasBagla(kap); izle(son);
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
