// OpenFreeMap (OpenStreetMap) üzerine ZBS haritası: ülke etiketleri ve sınırlar kaldırılır,
// 1948 toprakları dahil bütün bölge "Kuşatma altındaki Filistin" diye adlandırılır, Gazze çevresi kuşatma hattı.
(function () {
  "use strict";
  var GAZZE = [[34.4812, 31.5831], [34.5201, 31.5583], [34.556, 31.5398], [34.5283, 31.5201], [34.4957, 31.4944], [34.4955, 31.4944], [34.4804, 31.4856], [34.3673, 31.3928], [34.3458, 31.3577], [34.3455, 31.3407], [34.3538, 31.3064], [34.3509, 31.2893], [34.3159, 31.2569], [34.2644, 31.2242], [34.2484, 31.2114], [34.2304, 31.2592], [34.2246, 31.2757], [34.2003, 31.3143], [34.2227, 31.3266], [34.2367, 31.3424], [34.2814, 31.3767], [34.3016, 31.4077], [34.3484, 31.4376], [34.3682, 31.4682], [34.4434, 31.5346], [34.4788, 31.5783], [34.4812, 31.5831]];
  var harita = new maplibregl.Map({ container: "harita", style: "https://tiles.openfreemap.org/styles/liberty", center: [34.45, 31.45], zoom: 11, attributionControl: { compact: true } });
  harita.addControl(new maplibregl.NavigationControl(), "top-right");
  harita.on("load", function () {
    harita.getStyle().layers.forEach(function (l) {
      var sl = l["source-layer"];
      // sınırlar ve ülke / bölge etiketleri: haritada İsrail adı ve Filistin içine çizgi olmasın
      if (sl === "boundary" || /boundary/.test(l.id)) harita.removeLayer(l.id);
      else if (sl === "place" && /country|state/.test(l.id)) harita.removeLayer(l.id);
    });
    harita.addSource("zbs", { type: "geojson", data: { type: "FeatureCollection", features: [
      { type: "Feature", properties: { t: "hat" }, geometry: { type: "LineString", coordinates: GAZZE } },
      { type: "Feature", properties: { t: "ad", ad: "KUŞATMA ALTINDAKİ FİLİSTİN", b: 1 }, geometry: { type: "Point", coordinates: [34.95, 31.6] } },
      { type: "Feature", properties: { t: "ad", ad: "GAZZE ŞERİDİ", b: 0 }, geometry: { type: "Point", coordinates: [34.38, 31.42] } },
      { type: "Feature", properties: { t: "ad", ad: "BATI ŞERİA", b: 0 }, geometry: { type: "Point", coordinates: [35.3, 32.0] } }
    ] } });
    harita.addLayer({ id: "zbs-hat", type: "line", source: "zbs", filter: ["==", ["get", "t"], "hat"], paint: { "line-color": "#c9302c", "line-width": 2.5, "line-dasharray": [3, 2] } });
    harita.addLayer({ id: "zbs-ad", type: "symbol", source: "zbs", filter: ["==", ["get", "t"], "ad"],
      layout: { "text-field": ["get", "ad"], "text-font": ["Noto Sans Bold"], "text-size": ["case", ["==", ["get", "b"], 1], 20, 15], "text-letter-spacing": 0.12, "text-allow-overlap": true },
      paint: { "text-color": "#1f5c43", "text-halo-color": "#fffdf8", "text-halo-width": 2 } });
  });
})();
