// Tarihçe: 1914'ten bugüne dönüm noktaları (site/donum.json, elle derlendi, her satır kaynağıyla)
(function () {
  "use strict";
  var KISI_SIRA = 0;
  var EN = window.DIL === "en", YER = EN ? "en-GB" : "tr-TR";
  function tt(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function tarihAd(t) {
    if (t.length === 4) return t;
    if (t.length === 7) return new Date(t + "-15T12:00:00Z").toLocaleDateString(YER, { month: "long", year: "numeric" });
    return new Date(t + "T12:00:00Z").toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" });
  }
  var k = document.getElementById("tarihce");
  fetch("site/donum.json?v=17").then(function (r) { return r.json(); }).then(function (v) {
    function ciz() {
      k.textContent = "";
      var YENI = false; try { YENI = localStorage.getItem("zbs-tarihce-sira") === "yeni"; } catch (e) {}
      var b = el("header", "rp-bas");
      b.append(el("h1", null, tt("1914’ten bugüne", "From 1914 to today")),
        el("p", "rp-dek", tt("Osmanlı’nın Birinci Dünya Savaşı’na girişinden Gazze soykırımına Filistin’in dönüm noktaları. Her satırın kaynağı bağlantılı; 7 Ekim 2023’ten sonrası için olay kataloğu başlıklardan gün gün bulunan olayları da gösteriyor.",
          "Palestine’s turning points from the Ottoman entry into the First World War to the Gaza genocide. Each entry links to its source; for the period since 7 October 2023 the event catalogue also shows the events found day by day in the headlines.")));
      var sr = el("div", "kt-sira");
      [[false, tt("1914’ten bugüne", "From 1914 onwards")], [true, tt("Bugünden geriye", "Newest first")]].forEach(function (x) {
        var d = el("button", null, x[1]); d.type = "button"; d.setAttribute("aria-pressed", String(YENI === x[0]));
        d.onclick = function () { try { localStorage.setItem("zbs-tarihce-sira", x[0] ? "yeni" : "eski"); } catch (e) {} ciz(); };
        sr.appendChild(d);
      });
      var nav = el("nav", "th-donemler"); nav.setAttribute("aria-label", tt("Dönemler", "Periods"));
      b.append(sr, nav); k.appendChild(b);
      var D = v.donemler.slice(); if (YENI) D.reverse();
      D.forEach(function (d) {
        var xs = v.olaylar.filter(function (o) { return o.donem === d.anahtar; }).sort(function (a, c) { return a.tarih < c.tarih ? -1 : 1; });
        if (YENI) xs.reverse();
        if (!xs.length) return;
        var a = el("a", null, EN ? d.ad_en : d.ad); a.href = "#" + d.anahtar; nav.appendChild(a);
        var s = el("section", "th-donem"); s.id = d.anahtar;
        s.appendChild(el("h2", null, EN ? d.ad_en : d.ad));
        var ol = el("ol", "th-liste");
        xs.forEach(function (o) {
          var li = el("li");
          li.appendChild(el("time", null, tarihAd(o.tarih)));
          var ic = el("div"); ic.appendChild(el("b", null, EN ? o.baslik_en : o.baslik)); ic.appendChild(el("p", null, EN ? o.metin_en : o.metin));
          var hepsi = (o.gorseller || (o.gorsel ? [o.gorsel] : [])).filter(function (g) { return g && g.url; });
          // "yan": görsel geniş ekranda sol kanatta durur; telefonda kanat gizli olduğundan metnin içinde de gösterilir
          var gs = hepsi.filter(function (g) { return !g.yan; }), yanG = hepsi.filter(function (g) { return g.yan; });
          var figur = function (g, sinif) {
              var f = el("figure", "th-gorsel" + (g.genis ? " genis" : "") + (g.ust ? " ust" : "") + (sinif ? " " + sinif : "")), im = el("img"); im.src = g.url; im.alt = (EN ? g.aciklama_en : g.aciklama) || (EN ? o.baslik_en : o.baslik); im.loading = "lazy"; im.decoding = "async";
              im.onerror = function () { f.remove(); };
              var fc = el("figcaption"); var ac = EN ? g.aciklama_en : g.aciklama; if (ac) fc.appendChild(el("span", null, ac + " "));
              var fa = el("a", null, (EN ? "Photo: " : "Görsel: ") + (g.atif || "")); if (g.sayfa) { fa.href = g.sayfa; fa.target = "_blank"; fa.rel = "noopener"; }
              fc.appendChild(fa); f.append(im, fc); return f;
          };
          if (gs.length || yanG.length) {
            var gk = el("div", "th-gorseller" + (gs.length > 1 ? " cok" : ""));
            gs.forEach(function (g) { gk.appendChild(figur(g)); });
            yanG.forEach(function (g) { gk.appendChild(figur(g, "yan-kopya")); });
            ic.appendChild(gk);
          }
          var ks = el("span", "th-kaynak", tt("Kaynak: ", "Sources: ")); (o.kaynaklar || []).forEach(function (q, i) { var ka = el("a", null, q.ad + " ↗"); ka.href = q.url; ka.target = "_blank"; ka.rel = "noopener"; if (i) ks.append(" · "); ks.appendChild(ka); }); ic.appendChild(ks);
          if (o.tarih >= "2023-10-07" && o.tarih.length === 10) { var oa = el("a", "th-kat", tt("O ayın olayları →", "Events that month →")); oa.href = "olay.html#ay-" + o.tarih.slice(0, 7); ic.appendChild(oa); }
          // kısa biyografiler: metnin altında, kapalı gelir (dokununca açılır); her genişlikte aynı akışta, üst üste binmez
          var kis = o.kisiler || [];
          if (kis.length) {
            var kd = el("div", "th-kisiler"); kd.setAttribute("aria-label", tt("Kişiler", "People"));
            kis.forEach(function (q) {
              var kk = el("details", "th-kisi");
              var sm = el("summary"); sm.append(el("span", "th-kisi-et", tt("Biyografi", "Biography")), el("b", null, EN ? (q.ad_en || q.ad) : q.ad), el("span", "th-kisi-yil", q.yillar || ""));
              kk.append(sm, el("p", null, EN ? q.metin_en : q.metin));
              if (q.kaynak) { var ka = el("a", null, (EN ? "Source: " : "Kaynak: ") + q.kaynak.ad + " ↗"); ka.href = q.kaynak.url; ka.target = "_blank"; ka.rel = "noopener"; kk.appendChild(ka); }
              kd.appendChild(kk);
            });
            ic.appendChild(kd);
          }
          li.appendChild(ic);
          // yan sütun: yan görseller (geniş ekranda zaman çizgisinin solunda)
          if (yanG.length) {
            li.className = "kisili";
            KISI_SIRA++;
            var yan = el("aside", "th-yan");
            yanG.forEach(function (g) { yan.appendChild(figur(g, "th-yan-gorsel")); });
            li.appendChild(yan);
          }
          ol.appendChild(li);
        });
        s.appendChild(ol); k.appendChild(s);
      });
      k.appendChild(el("p", "rp-not", tt("Tarihçe elle derlendi. 2006 öncesi maddeler ağırlıkla hakemli dergilere (Belleten, Atatürk Yolu, Vakanüvis, Journal of Palestine Studies, IJMES), TDV İslâm Ansiklopedisi’ne ve Filistin Araştırmaları Enstitüsü’nün ansiklopedisine; antlaşma ve kararlar BM ve Uluslararası Adalet Divanı belgelerine dayanır. Son yıllardaki olaylarda BM raporlarının yanında haber kaynakları da kullanıldı. Eksik ya da yanlış gördüğünüz bir satırı bize bildirin.", "The history is compiled by hand. Entries before 2006 rely mainly on peer-reviewed journals (Belleten, Atatürk Yolu, Vakanüvis, Journal of Palestine Studies, IJMES), the TDV Encyclopedia of Islam and the Institute for Palestine Studies’ encyclopedia; treaties and resolutions are sourced to UN and International Court of Justice documents. For recent events, news sources are used alongside UN reports. Tell us about any entry you think is missing or wrong.")));
      var h = location.hash.slice(1); if (h) { var y = document.getElementById(h); if (y) y.scrollIntoView(); }
    }
    ciz();
  }).catch(function () { k.textContent = tt("Tarihçe okunamadı.", "Could not load the history."); });
})();
