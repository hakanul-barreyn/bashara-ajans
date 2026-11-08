// Haber sayfası: paylaş düğmesi (telefonda sistemin paylaşım menüsü, masaüstünde bağlantıyı kopyalar)
(function () {
  document.querySelectorAll("[data-paylas]").forEach(function (b) {
    b.addEventListener("click", function () {
      var url = location.href.split("#")[0], baslik = document.title;
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { navigator.share({ title: baslik, url: url }).catch(function () {}); return; }
      var eski = b.textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () {
        b.textContent = (window.DIL === "en") ? "Link copied" : "Bağlantı kopyalandı";
      }).catch(function () { window.prompt("", url); });
      setTimeout(function () { b.textContent = eski; }, 2000);
    });
  });
})();

// Haber sayfasına dışarıdan (paylaşılan bağlantı, arama motoru) gelindiyse geçmişe önce sitenin ana sayfası yazılır:
// tarayıcının geri tuşu siteden çıkmaz, ana sayfaya döner.
(function () {
  try {
    var ic = document.referrer && new URL(document.referrer).origin === location.origin;
    if (ic || !history.pushState) return;
    var ana = new URL("../", location.href).href, burasi = location.href;
    history.replaceState({ zbsAna: true }, "", ana);
    history.pushState({ zbsHaber: true }, "", burasi);
    window.addEventListener("popstate", function (e) { if (e.state && e.state.zbsAna) location.replace(ana); });
  } catch (e) { /* eski tarayıcı: dokunma */ }
})();
