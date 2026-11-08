// 404 sayfası: süresi dolmuş haber sayfası bağlantılarını (…/h/<id>.html) ana sayfadaki "#h-<id>" görünümüne yönlendirir;
// o görünüm haberi akışta, yoksa son 21 günün arşivinde arar.
(function () {
  var m = /^(.*?\/)h\/([0-9a-f]{6,20})(?:\.html)?\/?$/.exec(location.pathname);
  if (m) location.replace(m[1] + "#h-" + m[2]);
})();
