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
