// olay.html#<tür>-<gün>: alışma kataloğundaki tek bir olayın analiz sayfası (data/bulten/alisma.json).
// Unutulmuş olsa bile: ne oldu, hangi gruplar yazdı (her nokta bir yayın), ilk başlıklar, okurların ilgisi, aynı türden önceki ve sonraki olaylar.
(function () {
  "use strict";
  var EN = window.DIL === "en", YER = window.YEREL || (EN ? "en-GB" : "tr-TR");
  function tt(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 0 : d }); }
  function gunAd(g) { return new Date(g + "T12:00:00Z").toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }); }
  var R = { bolge: "#1f7a52", turkiye: "#7a3fa0", israil: "#2f5bb7", bati_ana: "#8a6d3b", bati_muhalif: "#c9544e" };
  var AD = EN ? { bolge: "Regional press", turkiye: "Turkish press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" }
    : { bolge: "Bölge basını", turkiye: "Türkiye basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var TUR_EN = { hastane: "Attack on hospitals", cadir: "Tents hit", yardim: "Fire on people waiting for aid", keskin: "Sniper fire", bas: "Shot in the head", cocuk: "Children killed", su: "People seeking water shot", guvenli: "Attack on a “safe zone”", okul: "Attack on schools and shelters", ibadet: "Attack on mosques and churches", aksa: "Raid on Al-Aqsa", saglik: "Health workers killed", yardimci: "Aid workers killed", iskence: "Torture and rape in prisons", asagilama: "Humiliation", aclik: "Starvation deaths", mezar: "Mass graves", bayrak: "Fire on people carrying white flags", cocuk_keskin: "Children shot by snipers", cocuk_bas: "Children shot in the head", cocuk_su: "Children carrying water shot", yardim_asagilama: "Humiliation for food" };
  var kim = function (x) { return x.tur + "-" + x.bas; };
  var k = document.getElementById("olay");

  fetch("data/bulten/alisma.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    var TA = {}; v.turler.forEach(function (t) { TA[t.anahtar] = t.ad; });
    var turAd = function (t) { return EN ? (TUR_EN[t] || TA[t] || t) : (TA[t] || t); };
    function ciz() {
      var id = decodeURIComponent(location.hash.slice(1)), x = v.olaylar.filter(function (o) { return kim(o) === id; })[0];
      if (!x && /^ay-/.test(id) && k.querySelector(".kt-duzen")) { var y1 = document.getElementById(id); if (y1) y1.scrollIntoView(); return; }
      k.textContent = "";
      if (!x) { liste(); return; }
      var yer = (x.yer || []).join(", ");
      document.title = turAd(x.tur) + (yer ? " · " + yer : "") + " · " + gunAd(x.bas) + " | ZBS";
      var bas = el("header", "rp-bas");
      bas.appendChild(el("p", "rp-ust", tt("Olay kataloğu · ", "Event catalogue · ") + turAd(x.tur)));
      bas.appendChild(el("h1", null, turAd(x.tur) + (yer ? ": " + yer : "")));
      bas.appendChild(el("p", "rp-dek", gunAd(x.bas) + (x.son !== x.bas ? " – " + gunAd(x.son) : "") + tt(". Bölge basınında bu türden " + sayi(x.bolge_sayi) + " başlık çıktı; olay türünün olağan düzeyinin iki buçuk katından fazlası.", ". The regional press ran " + sayi(x.bolge_sayi) + " headlines of this kind, more than two and a half times the usual level.")));
      if (x.olu) bas.appendChild(el("p", "rp-not", tt("O gün ve ertesi gün Gazze Sağlık Bakanlığı " + sayi(x.olu) + " yeni ölüm bildirdi (bütün Gazze için; yalnızca bu olay değil). Ölenlerin adları: ", "On that day and the next, the Gaza Ministry of Health reported " + sayi(x.olu) + " new deaths (for all of Gaza, not only this event). Their names: ")));
      if (x.olu) { var a0 = el("a", null, tt("İsimleri vardı →", "They had names →")); a0.href = "isimler.html"; bas.lastChild.appendChild(a0); }
      k.appendChild(bas);
      // kim yazdı: her nokta bir yayın
      var s1 = el("article", "rp-metin");
      s1.appendChild(el("h2", null, tt("Kim yazdı, kim sustu?", "Who covered it, who stayed silent?")));
      s1.appendChild(el("p", null, tt("Olayın günlerinde (bir gün önce, iki gün sonra) en az 15 başlık yayımlayan her yayın bir nokta. Dolu: bu türden en az bir başlık attı. Boş: yayındaydı, tek başlık atmadı.", "Each outlet that published at least 15 headlines in the event’s window (one day before, two after) is a dot. Filled: ran at least one headline of this kind. Hollow: was publishing, ran none.")));
      ["bolge", "turkiye", "israil", "bati_ana", "bati_muhalif"].forEach(function (g) {
        var s = x.sessiz && x.sessiz[g]; if (!s || !s[1]) return;
        var r = el("div", "gk-satir"); var b = el("div", "gk-bas"); b.append(el("b", null, AD[g]), el("span", null, tt((s[1] - s[0]) + " yazdı · " + s[0] + " sustu", (s[1] - s[0]) + " covered · " + s[0] + " silent")));
        var n = el("div", "gk-serit"); n.style.color = R[g];
        for (var i = 0; i < s[1]; i++) { var d = el("i", i < s[1] - s[0] ? null : "sus"); if (i < s[1] - s[0]) d.style.background = R[g]; n.appendChild(d); }
        r.append(b, n); s1.appendChild(r);
      });
      var tb = el("div", "rp-tablo"); var t = el("table"); var th = el("thead"); var tr0 = el("tr");
      [tt("Grup", "Group"), tt("Bu türden başlık", "Headlines of this kind"), tt("Bütün başlıkları", "All its headlines"), tt("Binde", "Per thousand")].forEach(function (h) { tr0.appendChild(el("th", null, h)); });
      th.appendChild(tr0); t.appendChild(th); var bd = el("tbody");
      ["bolge", "turkiye", "israil", "bati_ana", "bati_muhalif"].forEach(function (g) { var r = el("tr"); r.appendChild(el("td", null, AD[g])); r.appendChild(el("td", "sayi", sayi(x.sayi[g]))); r.appendChild(el("td", "sayi", sayi(x.pencere_baslik[g]))); r.appendChild(el("td", "sayi", x.tepki[g] == null ? "–" : sayi(x.tepki[g], 1) + "‰")); bd.appendChild(r); });
      t.appendChild(bd); tb.appendChild(t); s1.appendChild(tb);
      k.appendChild(s1);
      // başlıklar
      if ((x.ornek || []).length) {
        var s2 = el("article", "rp-metin"); s2.appendChild(el("h2", null, tt("O günlerin başlıkları", "Headlines from those days")));
        x.ornek.forEach(function (m) {
          var a = el("a", "rp-ornek"); a.href = m.url; a.target = "_blank"; a.rel = "noopener";
          var bb = el("span", "rp-ornek-b", m.baslik); bb.dir = "auto"; a.append(bb, el("small", null, m.yayin + " · " + (AD[m.grup] || "") + " · " + gunAd(m.gun))); s2.appendChild(a);
        });
        k.appendChild(s2);
      }
      // okurlar
      var tp = ((v.toplum && v.toplum.olaylar) || []).filter(function (o) { return o.tur === x.tur && o.gun >= x.bas && o.gun <= x.son; })[0];
      if (tp && tp.okunma7) {
        var s3 = el("article", "rp-metin"); s3.appendChild(el("h2", null, tt("Okurlar ne kadar baktı?", "How much did readers look?")));
        var top = 0; for (var d2 in tp.okunma7) top += tp.okunma7[d2];
        s3.appendChild(el("p", null, tt("Olayın Vikipedi maddesi ilk hafta altı dilde toplam " + sayi(top) + " kez okundu; ilk ayda " + sayi(Object.keys(tp.okunma30).reduce(function (a, d) { return a + tp.okunma30[d]; }, 0)) + ".", "The event’s Wikipedia article was read " + sayi(top) + " times in its first week across six languages, and " + sayi(Object.keys(tp.okunma30).reduce(function (a, d) { return a + tp.okunma30[d]; }, 0)) + " times in its first month.")));
        var a3 = el("a", null, tt("Basın yazdı, toplum ne yaptı? →", "The press wrote it. What did readers do? →")); a3.href = "olaylar.html#toplum"; s3.appendChild(a3);
        k.appendChild(s3);
      }
      // önceki / sonraki aynı tür
      var ayni = v.olaylar.filter(function (o) { return o.tur === x.tur; }), i0 = ayni.indexOf(x);
      var nav = el("p", "rp-geri");
      if (ayni[i0 - 1]) { var p = el("a", null, "← " + tt("Önceki ", "Previous: ") + turAd(x.tur).toLocaleLowerCase(YER) + " · " + gunAd(ayni[i0 - 1].bas)); p.href = "#" + kim(ayni[i0 - 1]); nav.append(p, " · "); }
      var kt = el("a", null, tt("Bütün olaylar", "All events")); kt.href = "olaylar.html#katalog"; nav.appendChild(kt);
      if (ayni[i0 + 1]) { var n2 = el("a", null, tt("Sonraki ", "Next: ") + turAd(x.tur).toLocaleLowerCase(YER) + " · " + gunAd(ayni[i0 + 1].bas) + " →"); n2.href = "#" + kim(ayni[i0 + 1]); nav.append(" · ", n2); }
      k.appendChild(nav);
      window.scrollTo(0, 0);
    }
    // Katalog: gün gün; solda yıl ve ay menüsü; bir güne tıklayınca o günün olayları ve yazan kaynaklar açılır
    function liste() {
      var b = el("header", "rp-bas"); b.append(el("h1", null, tt("Olay kataloğu", "Event catalogue")),
        el("p", "rp-dek", tt("Başlıklardan bulunan " + v.olaylar.length + " olay, gün gün. Bir güne tıklayınca o günün olayları ve onları yazan kaynaklar açılır.", v.olaylar.length + " events found in the headlines, day by day. Click a day to see its events and the outlets that covered them.")));
      k.appendChild(b);
      var gunler = {};
      v.olaylar.forEach(function (o) { (gunler[o.bas] = gunler[o.bas] || []).push(o); });
      var sira = Object.keys(gunler).sort().reverse();
      var duzen = el("div", "kt-duzen"), menu = el("nav", "kt-menu"), ana = el("div", "kt-ana");
      menu.setAttribute("aria-label", tt("Yıl ve ay", "Year and month"));
      var aylar = {};
      sira.forEach(function (g) { var a = g.slice(0, 7); aylar[a] = (aylar[a] || 0) + gunler[g].length; });
      var yil = null, ul = null;
      Object.keys(aylar).sort().reverse().forEach(function (a) {
        if (a.slice(0, 4) !== yil) { yil = a.slice(0, 4); menu.appendChild(el("h3", null, yil)); ul = el("ul"); menu.appendChild(ul); }
        var li = el("li"), x = el("a"); x.href = "#ay-" + a;
        x.append(new Date(a + "-15T12:00:00Z").toLocaleDateString(YER, { month: "long" }), el("small", null, String(aylar[a])));
        li.appendChild(x); ul.appendChild(li);
      });
      var ay = null;
      sira.forEach(function (g) {
        if (g.slice(0, 7) !== ay) { ay = g.slice(0, 7); var h = el("h2", "kt-ay", new Date(ay + "-15T12:00:00Z").toLocaleDateString(YER, { month: "long", year: "numeric" })); h.id = "ay-" + ay; ana.appendChild(h); }
        var d = el("details", "kt-gun"), sm = el("summary");
        sm.append(el("time", null, gunAd(g)));
        var cip = el("span", "kt-cipler"); gunler[g].forEach(function (o) { cip.appendChild(el("span", "kt-cip", turAd(o.tur) + ((o.yer || []).length ? " · " + o.yer[0] : ""))); });
        sm.appendChild(cip); d.appendChild(sm);
        d.addEventListener("toggle", function () {
          if (!d.open || d.dataset.dolu) return; d.dataset.dolu = "1";
          gunler[g].forEach(function (o) {
            var ol = el("div", "kt-olay");
            var bas = el("a", "kt-olay-bas", turAd(o.tur) + ((o.yer || []).length ? ": " + o.yer.join(", ") : "")); bas.href = "#" + kim(o); ol.appendChild(bas);
            var yazan = 0, yayinda = 0; for (var gr in (o.sessiz || {})) { yazan += o.sessiz[gr][1] - o.sessiz[gr][0]; yayinda += o.sessiz[gr][1]; }
            ol.appendChild(el("small", null, tt("Bölge basınında " + sayi(o.bolge_sayi) + " başlık" + (yayinda ? " · o günlerde yayında olan " + yayinda + " yayından " + yazan + " tanesi yazdı" : ""),
              sayi(o.bolge_sayi) + " regional headlines" + (yayinda ? " · " + yazan + " of " + yayinda + " outlets publishing at the time covered it" : ""))));
            var ul2 = el("ul", "kt-kaynak");
            (o.ornek || []).forEach(function (m) {
              var li = el("li"); li.appendChild(el("b", null, m.yayin)); li.appendChild(el("span", "kt-grup", AD[m.grup] || ""));
              var a = el("a", null, m.baslik); a.href = m.url; a.target = "_blank"; a.rel = "noopener"; a.dir = "auto"; li.appendChild(a);
              var ar = el("a", "kt-arsiv", tt("arşiv", "archive")); ar.href = "https://web.archive.org/web/" + m.url; ar.target = "_blank"; ar.rel = "noopener"; li.appendChild(ar);
              ul2.appendChild(li);
            });
            if (!(o.ornek || []).length) ul2.appendChild(el("li", null, tt("Örnek başlık yok.", "No sample headline.")));
            ol.appendChild(ul2);
            var t = el("a", "kt-tam", tt("Olayın sayfası: kim yazdı, kim sustu →", "Event page: who covered it, who stayed silent →")); t.href = "#" + kim(o); ol.appendChild(t);
            d.appendChild(ol);
          });
        });
        ana.appendChild(d);
      });
      duzen.append(menu, ana); k.appendChild(duzen);
      var h0 = location.hash.slice(1); if (/^ay-/.test(h0)) { var y0 = document.getElementById(h0); if (y0) y0.scrollIntoView(); }
    }
    window.addEventListener("hashchange", ciz); ciz();
  }).catch(function () { k.textContent = tt("Olay verisi okunamadı.", "Could not load the event data."); });
})();
