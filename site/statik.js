// Önceden çizilmiş (statik) sayfalar için küçük yardımcı. Sayfanın betiklerinden ÖNCE yüklenir.
// 1) <meta name="alb-gorunum" content="#..."> varsa ve adreste # yoksa, sayfanın hangi görünümü çizeceğini adrese yazar
//    (Almanak gibi # ile yönlenen sayfalar bu görünümü yeniden çizer; içerik zaten HTML'de durur).
// 2) <base href="/"> yüzünden "#x" bağlantıları ana sayfaya gitmesin: aynı sayfada kalır.
(function () {
  "use strict";
  var m = document.querySelector('meta[name="alb-gorunum"]');
  if (m && !location.hash) {
    try { history.replaceState(null, "", location.pathname + location.search + m.content); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    var h = a.getAttribute("href");
    if (h === "#") return;
    e.preventDefault();
    if (location.hash === h) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = h;
  }, true);
})();
