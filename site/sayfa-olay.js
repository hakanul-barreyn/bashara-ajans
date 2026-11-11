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
    function liste() {
      var b = el("header", "rp-bas"); b.append(el("h1", null, tt("Olay kataloğu", "Event catalogue")), el("p", "rp-dek", tt("Başlıklardan bulunan " + v.olaylar.length + " olay. Birini seçin.", v.olaylar.length + " events found in the headlines. Pick one.")));
      k.appendChild(b);
      var ul = el("ul", "ic-olay");
      v.olaylar.slice().reverse().forEach(function (o) { var li = el("li"); var a = el("a", null, gunAd(o.bas) + " · " + turAd(o.tur) + ((o.yer || []).length ? " · " + o.yer.join(", ") : "")); a.href = "#" + kim(o); li.appendChild(a); ul.appendChild(li); });
      k.appendChild(ul);
    }
    window.addEventListener("hashchange", ciz); ciz();
  }).catch(function () { k.textContent = tt("Olay verisi okunamadı.", "Could not load the event data."); });
})();
