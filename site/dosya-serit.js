/* Dosyalar (haftalarca gündemde kalan hikâyeler): ana sayfadaki dosya şeridi ve kartlardaki "Dosya › dal" satırı.
   Veri: data/dosyalar-site.json (toplayici/dosyalar.py). Kartlar bu dosya gelmeden çizilebilir; satırlar boş
   <a class="dosya-satir" data-d data-dal> olarak eklenir, veri gelince doldurulur (window.DosyaSatir.doldur). */
(function () {
  "use strict";
  var EN = function () { return window.DIL === "en"; };
  var V = null, bekleyen = [];
  var DURUM = { sicak: ["sıcak", "active"], suruyor: ["sürüyor", "ongoing"], sessiz: ["sessiz", "quiet"] };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function ad(o) { return (EN() && o.ad_en) || o.ad; }

  function doldur(kok) {
    if (!V) return;
    (kok || document).querySelectorAll("a.dosya-satir:not([data-dolu])").forEach(function (a) {
      var ds = V.dmap[a.dataset.d], dal = ds && ds.dalmap[a.dataset.dal];
      if (!ds) { a.remove(); return; }
      a.dataset.dolu = "1";
      a.href = "d/" + encodeURIComponent(ds.id) + ".html" + (dal ? "#dal-" + encodeURIComponent(dal.id) : "");
      a.appendChild(el("span", "ds-et", EN() ? "File" : "Dosya"));
      a.appendChild(el("b", null, ad(ds)));
      if (dal) { a.appendChild(el("span", "ds-ok", "›")); a.appendChild(el("span", null, ad(dal))); }
      if (dal && dal.yeniden) a.appendChild(el("em", "ds-geri", EN() ? "back after " + dal.yeniden + " days" : dal.yeniden + " gün sonra yeniden gündemde"));
    });
  }
  // uygulama.js kart çizerken çağırır: haberlerden ilk dosyalıyı bulur
  function satir(haberler) {
    var h = (haberler || []).find(function (x) { return x && x.dosya; });
    if (!h) return null;
    var a = el("a", "dosya-satir"); a.dataset.d = h.dosya[0]; a.dataset.dal = h.dosya[1];
    if (V) setTimeout(function () { doldur(a.parentNode || document); }, 0); else bekleyen.push(a);
    return a;
  }

  var NS = "http://www.w3.org/2000/svg";
  function svg(t, a) { var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var GUN = 864e5;
  // Takip edilen dosyalar: açık zeminli, gazete düzeni. Solda bir büyük dosya, sağda kompakt satırlar.
  // Fotoğraflar: her dosyaya sabit bir Commons fotoğrafı (toplayici/dosya_foto.json → gorsel dalı dosya-foto/); yoksa haberin görseli.
  var FOTO = {};
  function gunFark(g) { return Math.floor(Date.now() / 864e5) - Math.floor(Date.parse(g + "T12:00:00Z") / 864e5); }
  function oncesi(g) { var f = gunFark(g); return f <= 0 ? (EN() ? "today" : "bugün") : f === 1 ? (EN() ? "yesterday" : "dün") : f + (EN() ? " days ago" : " gün önce"); }
  function kisaKredi(y) { y = String(y || "").replace(/<[^>]+>/g, ""); if (y.indexOf("@") >= 0) y = y.split(/[.,;(]\s|\s\S+@/)[0]; return y.replace(/\s+/g, " ").trim().slice(0, 60); }
  function foto(ds, genis) {
    var f = el("figure", "dsg-foto");
    var k = FOTO[ds.id], src = null, yazi = "", kredi = "";
    if (k && k.dosya) { src = "data/gorsel/dosya-foto/" + k.dosya; yazi = EN() ? k.en : k.tr; kredi = kisaKredi(k.yazar) + (k.lisans ? " · " + k.lisans : ""); }
    else if (ds.gorsel && ds.gorsel.u) { src = (window.AKTAR || function (v) { return v; })(ds.gorsel.u, genis ? 1200 : 480); kredi = ds.gorsel.k || ""; }
    var kutu = el("div", "dsg-cerceve");
    if (src) {
      var im = document.createElement("img"); im.src = src; im.alt = yazi; im.loading = "lazy"; im.decoding = "async"; im.referrerPolicy = "no-referrer";
      im.onerror = function () { im.remove(); kutu.classList.add("bos"); };
      kutu.appendChild(im);
    } else kutu.classList.add("bos");
    f.appendChild(kutu);
    if (genis && (yazi || kredi)) {
      var fc = el("figcaption");
      if (yazi) fc.appendChild(el("span", null, yazi));
      if (kredi) fc.appendChild(el("small", null, (EN() ? "Photo: " : "Fotoğraf: ") + kredi));
      f.appendChild(fc);
    }
    return f;
  }
  function ust(ds) {
    var p = el("p", "dsg-ust");
    var b = (EN() && ds.bolge_en) || ds.bolge; if (b) p.appendChild(el("span", "dsg-bolge", b));
    if (ds.sicak) p.appendChild(el("span", "dsg-taze", EN() ? "Updated " + oncesi(ds.son) : "Güncellendi: " + oncesi(ds.son)));
    else p.appendChild(el("span", null, (EN() ? "Latest: " : "Son gelişme: ") + oncesi(ds.son)));
    var geri = ds.dallar.find(function (x) { return x.yeniden; });
    if (geri) p.appendChild(el("span", "dsg-geri", EN() ? "back after " + geri.yeniden + " days" : geri.yeniden + " gün aradan sonra yeniden gündemde"));
    return p;
  }
  function ilkCumleler(t, n) { var p = String(t || "").split(/(?<=[.!?])\s+/); return p.slice(0, n).join(" "); }
  function buyukKart(ds) {
    var a = el("a", "dsg-buyuk"); a.href = "d/" + encodeURIComponent(ds.id) + ".html";
    a.appendChild(foto(ds, true));
    var ic = el("div", "dsg-metin");
    ic.appendChild(ust(ds));
    ic.appendChild(el("h3", null, ad(ds)));
    var oz = EN() ? ds.ozet_en : ds.ozet; if (oz) ic.appendChild(el("p", "dsg-oz", ilkCumleler(oz, 2)));
    var son = el("p", "dsg-son"); son.appendChild(el("b", null, EN() ? "Latest" : "Son gelişme")); son.appendChild(document.createTextNode(" " + ((EN() && ds.son_be) || ds.son_b))); ic.appendChild(son);
    var ul = el("ul", "dsg-basliklar");
    ds.dallar.map(function (d) { return [d, d.olaylar.reduce(function (m, o) { return o.g > m ? o.g : m; }, "")]; })
      .sort(function (x, y) { return x[1] < y[1] ? 1 : -1; }).slice(0, 3)
      .forEach(function (x) { var li = el("li"); li.appendChild(el("span", null, ad(x[0]))); li.appendChild(el("time", null, oncesi(x[1]))); ul.appendChild(li); });
    ic.appendChild(ul);
    a.appendChild(ic);
    return a;
  }
  function satirKart(ds) {
    var a = el("a", "dsg-satir"); a.href = "d/" + encodeURIComponent(ds.id) + ".html";
    a.appendChild(foto(ds, false));
    var ic = el("div", "dsg-metin");
    ic.appendChild(ust(ds));
    ic.appendChild(el("h3", null, ad(ds)));
    ic.appendChild(el("p", "dsg-son", (EN() && ds.son_be) || ds.son_b));
    a.appendChild(ic);
    return a;
  }
  var dene = 0;
  function serit() {
    if (!V || !V.dosyalar.length || document.getElementById("dosyaSerit")) return;
    var s = el("section", "dosya-bolum dsg"); s.id = "dosyaSerit"; s.setAttribute("aria-label", EN() ? "Files we follow" : "Takip edilen dosyalar");
    var bas = el("div", "dsg-bas");
    var sol = el("div");
    sol.appendChild(el("p", "dsg-etiket", EN() ? "Ongoing developments" : "Süregelen gelişmeler"));
    sol.appendChild(el("h2", null, EN() ? "Files we follow" : "Takip edilen dosyalar"));
    bas.appendChild(sol);
    var tum = el("a", "dsg-tum", EN() ? "All files →" : "Tüm dosyalar →"); tum.href = "d/"; bas.appendChild(tum);
    s.appendChild(bas);
    var izgara = el("div", "dsg-izgara");
    izgara.appendChild(buyukKart(V.dosyalar[0]));
    var yan = el("div", "dsg-yan");
    V.dosyalar.slice(1, 5).forEach(function (ds) { yan.appendChild(satirKart(ds)); });
    izgara.appendChild(yan);
    s.appendChild(izgara);
    // masaüstünde karşılaştırmalardan önce; telefonda ilk haber bölümünden sonra
    var tel = window.matchMedia && matchMedia("(max-width:700px)").matches;
    if (tel) {
      var hb = document.querySelector(".hb > .hb-bolum:not(.hb-son)") || document.querySelector(".hb > .hb-manset");
      if (hb) {
        hb.parentNode.insertBefore(s, hb.nextSibling);
        var tk = document.querySelector("main.duzen > .tarihce-kart");
        if (tk) s.parentNode.insertBefore(tk, s.nextSibling);
        return;
      }
      if (dene < 15) return;
    }
    var hedef = document.getElementById("enine") || document.getElementById("sayacSerit") || document.getElementById("suzgec");
    if (hedef) hedef.parentNode.insertBefore(s, hedef);
  }

  var kapakSoz = fetch("data/gorsel/dosya-foto/kapak.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  fetch("data/dosyalar-site.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) { return kapakSoz.then(function (kp) { (kp || []).forEach(function (k) { FOTO[k.ad] = k; }); return v; }); }).then(function (v) {
    if (!v || !Array.isArray(v.dosyalar)) return;
    v.dmap = {};
    v.dosyalar.forEach(function (ds) { ds.dalmap = {}; ds.dallar.forEach(function (x) { ds.dalmap[x.id] = x; }); v.dmap[ds.id] = ds; });
    V = v;
    doldur(); bekleyen = [];
    (function kur() { serit(); if (!document.getElementById("dosyaSerit") && ++dene < 20) setTimeout(kur, 400); })();
  }).catch(function () {});
  window.DosyaSatir = { satir: satir, doldur: doldur };
})();
