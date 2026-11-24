/* analizler.html: data/analizler.json'dan analiz arşivi; tür, kurum ve arama süzgeci, sayfa sayfa yükleme. */
(function () {
  "use strict";
  var EN = document.documentElement.lang === "en" || /[?&]dil=en/.test(location.search) || (window.DIL && window.DIL === "en");
  var AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
  var AY_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var DIL = { tr: "Türkçe", en: "İngilizce", ar: "Arapça", he: "İbranice", fr: "Fransızca", de: "Almanca", es: "İspanyolca", it: "İtalyanca", fa: "Farsça", ca: "Katalanca" };
  var DIL_EN = { tr: "Turkish", en: "English", ar: "Arabic", he: "Hebrew", fr: "French", de: "German", es: "Spanish", it: "Italian", fa: "Persian", ca: "Catalan" };
  var SAYFA = 40;
  function el(t, c, m) { var e = document.createElement(t); if (c) e.className = c; if (m != null) e.textContent = m; return e; }
  function tarih(s) {
    var d = new Date(s); if (isNaN(d)) return "";
    var t = new Date(d.getTime() + 3 * 3600e3);
    return t.getUTCDate() + " " + (EN ? AY_EN : AY)[t.getUTCMonth()] + " " + t.getUTCFullYear();
  }
  function kucuk(s) { return String(s || "").toLocaleLowerCase("tr"); }
  var liste = document.querySelector(".ac-liste"), suz = document.querySelector(".ac-suz"),
      kurumSec = document.querySelector(".an-kurum"), ara = document.querySelector(".an-ara"),
      sayi = document.querySelector(".an-sayi"), daha = document.querySelector(".an-daha");
  var V = [], tur = "dusunce", kurum = "", sorgu = "", goster = SAYFA;
  if (EN) { ara.placeholder = "Search: title, institution, topic"; daha.textContent = "Show more"; }

  function baslik(a) { return EN ? (a.baslik_en || a.baslik_orj || a.baslik_tr) : (a.baslik_tr || a.baslik_orj); }
  function ozet(a) { return EN ? (a.ozet_en || "") : (a.ozet_tr || ""); }
  function suzulmus() {
    return V.filter(function (a) {
      if (tur === "dusunce" && !a.dusunce) return false;
      if (tur === "basin" && a.dusunce) return false;
      if (kurum && String(a.kaynak) !== kurum) return false;
      if (sorgu && kucuk([a.baslik_tr, a.baslik_orj, a.baslik_en, a.ozet_tr, a.kurum].join(" ")).indexOf(sorgu) < 0) return false;
      return true;
    });
  }
  function ciz() {
    liste.textContent = "";
    var g = suzulmus();
    sayi.textContent = g.length + (EN ? " pieces" : " yazı");
    if (!g.length) {
      liste.appendChild(el("li", "ac-bos", tur === "dusunce" && !kurum && !sorgu
        ? (EN ? "No think-tank analysis yet. New sources are being added; check back soon." : "Henüz düşünce kuruluşu analizi yok. Yeni kaynaklar ekleniyor; birkaç gün içinde dolacak.")
        : (EN ? "Nothing matches." : "Eşleşen yazı yok.")));
      daha.hidden = true; return;
    }
    g.slice(0, goster).forEach(function (a) {
      var li = el("li", "ac-oge"), ust = el("div", "ac-ust");
      var ku = el("a", "ac-taraf", a.kurum); if (a.ulke !== "Türkiye") ku.lang = "en"; ku.href = "profil.html?k=" + encodeURIComponent(a.kaynak);
      ust.append(ku);
      if (a.dusunce) ust.append(el("span", "an-dus", EN ? "Think tank" : "Düşünce kuruluşu"));
      ust.append(el("time", null, tarih(a.tarih)));
      var h = el("h2"), l = el("a", null, baslik(a)); l.href = a.url; l.target = "_blank"; l.rel = "noopener"; h.appendChild(l);
      li.append(ust, h);
      var o = ozet(a); if (o) li.appendChild(el("p", null, o));
      var git = el("a", "an-git", (EN ? "Read the original" : "Orijinalini oku") + (a.dil ? " (" + ((EN ? DIL_EN : DIL)[a.dil] || a.dil) + ")" : "") + " →");
      git.href = a.url; git.target = "_blank"; git.rel = "noopener";
      li.appendChild(git);
      liste.appendChild(li);
    });
    daha.hidden = g.length <= goster;
  }
  function kurumlar() {
    var sayac = {};
    V.forEach(function (a) {
      if ((tur === "dusunce" && !a.dusunce) || (tur === "basin" && a.dusunce)) return;
      var k = String(a.kaynak); sayac[k] = sayac[k] || { ad: a.kurum, n: 0 }; sayac[k].n++;
    });
    kurumSec.textContent = "";
    var hep = el("option", null, EN ? "All institutions" : "Bütün kurumlar"); hep.value = ""; kurumSec.appendChild(hep);
    Object.keys(sayac).sort(function (x, y) { return sayac[x].ad.localeCompare(sayac[y].ad, "tr"); }).forEach(function (k) {
      var o = el("option", null, sayac[k].ad + " (" + sayac[k].n + ")"); o.value = k; kurumSec.appendChild(o);
    });
    if (kurum && !sayac[kurum]) kurum = "";
    kurumSec.value = kurum;
  }
  [["dusunce", "Düşünce kuruluşları", "Think tanks"], ["basin", "Gazete analizleri", "Newspaper analysis"], ["", "Hepsi", "All"]].forEach(function (t) {
    var b = el("button", null, EN ? t[2] : t[1]); b.type = "button"; b.setAttribute("aria-pressed", String(t[0] === tur));
    b.onclick = function () {
      tur = t[0]; goster = SAYFA;
      suz.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      kurumlar(); ciz();
    };
    suz.appendChild(b);
  });
  kurumSec.onchange = function () { kurum = kurumSec.value; goster = SAYFA; ciz(); };
  var bekle; ara.oninput = function () { clearTimeout(bekle); bekle = setTimeout(function () { sorgu = kucuk(ara.value.trim()); goster = SAYFA; ciz(); }, 200); };
  daha.onclick = function () { goster += SAYFA; ciz(); };

  fetch("data/analizler.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : { analizler: [] }; })
    .catch(function () { return { analizler: [] }; })
    .then(function (d) {
      V = d.analizler || [];
      if (!V.some(function (a) { return a.dusunce; })) {   // düşünce kuruluşu yazısı yoksa hepsini göster
        tur = ""; suz.querySelectorAll("button").forEach(function (x, i) { x.setAttribute("aria-pressed", String(i === 2)); });
      }
      kurumlar(); ciz();
    });
})();
