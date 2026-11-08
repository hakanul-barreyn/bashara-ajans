// ZBS hizmet çalışanı: sayfa iskeletini önbellekte tutar, haber verisini her zaman ağdan ister.
// Ağ yoksa son görülen veriyi gösterir.
const SURUM = "zbs-202611080659";
const ISKELET = ["./", "index.html", "kaynaklar.html", "arsiv.html", "hakkimizda.html", "almanak.html", "site/dil.js", "manifest.webmanifest", "site/logo.svg", "site/simge-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SURUM).then((c) => c.addAll(ISKELET)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  if (/\/h\/[0-9a-f]+\.html$/.test(u.pathname)) return;   // haber sayfaları önbelleğe alınmaz
  // Veri ve sayfalar: önce ağ, olmazsa önbellek
  e.respondWith(
    fetch(e.request).then((r) => {
      if (r.ok) { const kopya = r.clone(); caches.open(SURUM).then((c) => c.put(e.request.url.split("?")[0], kopya)); }
      return r;
    }).catch(() => caches.match(e.request.url.split("?")[0]).then((r) => r || caches.match("index.html")))
  );
});
