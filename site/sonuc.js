// Raporların "Sonuç" bölümü: yayın yayın ölçülmüş üç davranış (data/bulten/alisma.json → hukum).
// Hüküm yalnızca örneklem yeterliyse ve yayın, aynı dildeki tanık basından (bölge ve Batı'daki muhalif yayınlar)
// belirgin biçimde ayrılıyorsa verilir. #g-sonuc öğesine yazar.
(function () {
  "use strict";
  var k = document.getElementById("g-sonuc"); if (!k) return;
  var EN = window.DIL === "en", YER = window.YEREL || (EN ? "en-GB" : "tr-TR");
  function tt(tr, en) { return EN ? en : tr; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function yz(x) { return x == null ? "–" : (EN ? Math.round(100 * x) + "%" : "%" + Math.round(100 * x)); }
  // Türkçe "%73’ünde": sayının okunuşuna göre iyelik + bulunma eki
  function inde(x) {
    var n = Math.round(100 * x), b = n % 10, o = Math.floor(n / 10) % 10;
    var BIR = ["", "inde", "sinde", "ünde", "ünde", "inde", "sında", "sinde", "inde", "unda"], ON = ["", "unda", "sinde", "unda", "ında", "sinde", "ında", "inde", "inde", "ında"];
    return n === 0 ? "ında" : n === 100 ? "ünde" : b ? BIR[b] : ON[o];
  }
  function kat(x) { return x == null ? "–" : Number(x).toLocaleString(YER, { maximumFractionDigits: 1 }) + "×"; }
  var GAD = EN ? { israil: "Israeli press", bati_ana: "Western mainstream", ik: "Collaborationist line (region)" } : { israil: "İsrail basını", bati_ana: "Batı ana akım", ik: "Bölgede işbirlikçi çizgi" };
  var HAD = EN ? { sustu: "No headline for most events", fail: "Mostly did not name the killer", tarti: "Gave Israeli deaths more space per death" } : { sustu: "Olayların çoğunda başlık atmadı", fail: "Faili çoğunlukla yazmadı", tarti: "İsrailli ölümlere ölü başına daha çok yer verdi" };
  fetch("data/bulten/alisma.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    var h = v.hukum || [];
    if (!h.length) { k.appendChild(el("p", "bekliyor", tt("Sonuç bölümü toplayıcının bir sonraki çalışmasında yazılacak.", "The conclusion will be written on the collector’s next run."))); return; }
    var hukumlu = h.filter(function (r) { return r.hukum.length; });
    var ozet = {}; hukumlu.forEach(function (r) { r.hukum.forEach(function (x) { (ozet[x] = ozet[x] || []).push(r.ad); }); });
    var ul = el("ul", "sn-ozet");
    ["sustu", "fail", "tarti"].forEach(function (x) {
      if (!ozet[x]) return;
      var li = el("li"); li.appendChild(el("b", null, HAD[x] + ": ")); li.append(ozet[x].join(", ") + ".");
      ul.appendChild(li);
    });
    k.appendChild(ul);
    hukumlu.forEach(function (r) {
      var d = el("article", "sn-kart");
      var b = el("div", "sn-bas"); b.append(el("b", null, r.ad), el("span", null, GAD[r.grup] + (r.ulke ? " · " + r.ulke : "")));
      var c = el("div", "sn-cipler"); r.hukum.forEach(function (x) { c.appendChild(el("span", "sn-cip sn-" + x, HAD[x])); }); b.appendChild(c);
      d.appendChild(b);
      var t = r.taban || {};
      var cumle = [];
      if (r.hukum.indexOf("sustu") >= 0) cumle.push(tt("Yayında olduğu " + r.olay + " olayın " + yz(r.sessiz_oran) + "’" + inde(r.sessiz_oran) + " bu olay türünden tek başlık atmadı. Aynı dildeki tanık basında bu oran " + yz(t.sessiz_oran) + ".",
        "During " + r.olay + " events while it was publishing, it ran not a single headline of that kind in " + yz(r.sessiz_oran) + " of them. Witness press in the same language: " + yz(t.sessiz_oran) + "."));
      if (r.hukum.indexOf("fail") >= 0) cumle.push(tt("Filistinlilerin ölümünü anlatan " + r.fo + " başlığın " + yz(r.gizli_oran) + "’" + inde(r.gizli_oran) + " öldüreni yazmadı (“öldü”, “hayatını kaybetti”, faili belirsiz “öldürüldü”). Tanık basında " + yz(t.gizli_oran) + ".",
        "In " + yz(r.gizli_oran) + " of its " + r.fo + " headlines about Palestinian deaths it did not name the killer (“died”, “lost their lives”, an agentless “were killed”). Witness press: " + yz(t.gizli_oran) + "."));
      if (r.hukum.indexOf("tarti") >= 0) cumle.push(tt("Ölü başına bakıldığında bir İsraillinin ölümüne bir Filistinlinin ölümünden " + kat(r.kat) + " fazla başlık ayırdı (7 Ekim 2023 – ateşkes). Tanık basında " + kat(t.kat) + ".",
        "Per death, it gave an Israeli death " + kat(r.kat) + " as many headlines as a Palestinian death (7 October 2023 to the ceasefire). Witness press: " + kat(t.kat) + "."));
      cumle.forEach(function (x) { d.appendChild(el("p", null, x)); });
      k.appendChild(d);
    });
    // geri kalanlar
    var kalan = h.filter(function (r) { return !r.hukum.length; });
    if (kalan.length) {
      var det = el("details", "sn-kalan"); det.appendChild(el("summary", null, tt("Öne çıkarılmayan yayınlar (" + kalan.length + ") ve nedeni", "Outlets not highlighted (" + kalan.length + ") and why")));
      var tb = el("div", "rp-tablo"); var tbl = el("table"); var th = el("thead"); var tr0 = el("tr");
      [tt("Yayın", "Outlet"), tt("Başlık atmama", "No headline"), tt("Faili yazmama", "Killer not named"), tt("Ölü başına kat", "Per-death ratio"), tt("Tanık basın (aynı dil)", "Witness press (same language)")].forEach(function (x) { tr0.appendChild(el("th", null, x)); });
      th.appendChild(tr0); tbl.appendChild(th); var bd = el("tbody");
      kalan.forEach(function (r) {
        var t = r.taban || {}; var tr = el("tr");
        tr.appendChild(el("td", null, r.ad)); tr.appendChild(el("td", "sayi", yz(r.sessiz_oran))); tr.appendChild(el("td", "sayi", yz(r.gizli_oran))); tr.appendChild(el("td", "sayi", kat(r.kat)));
        tr.appendChild(el("td", "sayi", t.sessiz_oran == null && t.gizli_oran == null ? tt("bu dilde tanık basın yok", "no witness press in this language") : yz(t.sessiz_oran) + " · " + yz(t.gizli_oran) + " · " + kat(t.kat)));
        bd.appendChild(tr);
      });
      tbl.appendChild(bd); tb.appendChild(tbl); det.appendChild(tb); k.appendChild(det);
    }
    k.appendChild(el("p", "rp-not", tt(
      "Bir ölçüm üç koşulla öne çıkarılır: yeterli ölçüm (en az 20 olay, 30 başlık), yüksek oran (başlık atmama %80, faili yazmama %60, ölü başına 3 kat) ve aynı dildeki tanık basından belirgin fark (en az 15 puan ya da 2 kat). Böylece bir dilde ölçüm aracımız zayıfsa ya da bir yayının arşivi seyrekse öne çıkarılmaz. Bunlar ölçümdür, yayının niyeti hakkında yargı değildir. “Başlık atmadı”: o olay türünden tek başlık yok; aynı günlerde aynı türden başka bir olayı yazmak da “yazdı” sayılır. Sayımlar geriye dönük taramanın özgün başlıklarından, yapay zekâ kullanılmadan.",
      "A measurement is highlighted only with three things: enough measurements (at least 20 events, 30 headlines), a high rate (no headline 80%, killer not named 60%, a per-death ratio of 3) and a clear gap from witness press in the same language (at least 15 points or twice as much). So if our measurement is weak in a language, or an outlet’s archive is sparse, nothing is highlighted. These are measurements, not judgements about intent. “No headline”: no headline of that kind at all; covering another event of the same kind in those days counts as covering it. Counts come from original headlines in the backfill, without AI.")));
  }).catch(function () { /* veri yok */ });
})();
