// yontem.html: yöntem notu, eşikler, doğrulama durumu ve yayın yayın kapsama (data/bulten/rapor-7-ekim.json → kapsama)
(function () {
  "use strict";
  var EN = window.DIL === "en";
  function tt(tr, en) { return EN ? en : tr; }
  var YER = EN ? "en-GB" : "tr-TR";
  var $ = function (i) { return document.getElementById(i); };
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function sayi(n, d) { return n == null || isNaN(n) ? "–" : Number(n).toLocaleString(YER, { maximumFractionDigits: d == null ? 1 : d }); }
  var AD = EN ? { bolge: "Regional press", israil: "Israeli press", bati_ana: "Western mainstream", bati_muhalif: "Western dissenting" }
    : { bolge: "Bölge basını", israil: "İsrail basını", bati_ana: "Batı ana akım", bati_muhalif: "Batı’da muhalif" };
  var YONTEM = EN ? { rss: "own dates (feed, sitemap)", adres: "date in the address", kismi: "partly dated", yok: "no date method" }
    : { rss: "kendi tarihi (akış, site haritası)", adres: "adresteki tarih", kismi: "kısmen tarihli", yok: "tarih yöntemi yok" };

  function liste(kap, xs) { var d = el("dl", "yt-liste"); xs.forEach(function (x) { d.append(el("dt", null, x[0]), el("dd", null, x[1])); }); kap.appendChild(d); }
  function paragraflar(kap, xs) { xs.forEach(function (t) { kap.appendChild(el("p", null, t)); }); }

  liste($("g-tanimlar"), [
    [tt("Savaş bağlamı", "War context"), tt("Başlıkta Gazze, Filistin, İsrail, Batı Şeria, Kudüs, Lübnan ya da ilgili adlardan biri geçiyorsa başlık savaş bağlamındadır. Kelime ve faillik ölçüleri yalnızca bu başlıklarda yapılır; böylece örneğin Ruanda soykırımı haberleri “soykırım” sayısını şişirmez.", "A headline is in the war context if it mentions Gaza, Palestine, Israel, the West Bank, Jerusalem, Lebanon or related names. Word and agency measures are made only on these headlines, so that, for instance, stories on the Rwandan genocide do not inflate the “genocide” count.")],
    [tt("Ölüm başlığı ve faillik", "Death headline and agency"), tt("Bir ölümü anlatan başlık beş sınıftan birine girer: fail yazılı etken (“İsrail öldürdü”), fail yazılı edilgen (“İsrail’in saldırısında öldürüldü”), fail yazılmamış (“öldürüldü”), öldürme fiili yok (“öldü”, “ölü sayısı”) ve şehadet dili (“şehit oldu”). Ölen İsrailliyse ya da fail olarak Hamas veya başka bir silahlı grup yazılmışsa ayrı sayılır. Soğuk, sel ve kaza gibi ölümler ile açlık ölümleri ayrı sınıflardır.", "A headline reporting a death falls into one of five classes: killer named, active (“Israel killed”), killer named, passive (“killed in an Israeli strike”), killer not named (“were killed”), no verb of killing (“died”, “death toll”) and martyrdom language (“martyred”). Israeli deaths and deaths attributed to Hamas or another armed group are counted separately. Deaths from cold, floods or accidents and deaths from hunger are separate classes.")],
    [tt("Faili yazılan oran", "Killer-named rate"), tt("Filistinlilerin ölümünü anlatan başlıklarda fail yazılı olanların payı. Şehadet diyen başlıklar paydaya girmez: faili adıyla yazmasa da ölümü bir saldırının sonucu olarak anlatır. Rapor sayfasında bu tercihin sonucu nasıl değiştirdiği ayrıca gösterilir.", "The share of headlines on Palestinian deaths that name the killer. Martyrdom headlines are left out of the denominator: even without naming the killer, they present the death as the result of an attack. The report page shows separately how much this choice changes the result.")],
    [tt("Alıntı, hayvan, yerleşimci, Telegram (sürüm 14)", "Quotes, animals, settlers, Telegram (version 14)"), tt("Ölüm yalnızca tırnak içindeki bir sözde geçiyorsa başlık ölüm başlığı sayılmaz. Ölenler hayvansa sayılmaz. Yerleşimciler İsrailli fail sayılır. Telegram gönderilerinde yalnızca ilk cümle (en çok 200 harf) başlık sayılır. Tırnak içinde geçen kelimeler, başlığın kendi sesindeki kullanımlardan ayrı tutulur.", "A headline is not a death headline if the death appears only in a quotation. Animal deaths are not counted. Settlers count as Israeli perpetrators. For Telegram posts only the first sentence (up to 200 characters) counts as the headline. Words inside quotation marks are kept apart from the headline’s own usage.")],
    [tt("Kelime oranı", "Word rate"), tt("Bir kelimenin bin savaş başlığında kaç kez geçtiği. 9 dilde karşılıklarıyla, harf işaretleri sadeleştirilerek sayılır.", "How many times a word appears per thousand war-context headlines, counted with its equivalents in 9 languages and with diacritics folded.")],
    [tt("Ölü başına başlık", "Headlines per death"), tt("İsraillilerin ve Filistinlilerin ölümünü anlatan başlıkların, resmî ölü sayısına bölünmesi (7 Ekim 2023 – Ekim 2025 ateşkesi). Ölü sayılarının kaynakları Kimin ölümü haber oldu? sayfasında.", "Headlines on Israeli and Palestinian deaths divided by the official death count (7 October 2023 to the October 2025 ceasefire). Sources for the death counts are on the Whose death made the news? page.")],
    [tt("Güven aralığı", "Confidence interval"), tt("Yüzdelerin yanında %95 Wilson güven aralığı verilir. Grup oranları başlık ağırlıklıdır; yanında her yayının bir oy olduğu yayın ağırlıklı ortalama da verilir (en az 30 ölüm başlığı olan yayınlar).", "Percentages come with a 95% Wilson confidence interval. Group rates are headline-weighted; an outlet-weighted mean in which each outlet gets one vote is also given (outlets with at least 30 death headlines).")]
  ]);

  liste($("g-esikler"), [
    [tt("Boş başlık", "Empty headline"), tt("3 kelimeden kısa ya da aynı yayında 20’den çok tekrarlanan başlıklar (menü, bölüm adı) atılır.", "Headlines shorter than 3 words or repeated more than 20 times by the same outlet (menus, section names) are dropped.")],
    [tt("Toplu güncelleme günü", "Bulk update day"), tt("Bir yayının bir günü olağan günlük sayısının 6 katını (en az 200) aşıyorsa o gün site haritasının toplu güncellemesi sayılır ve dışarıda bırakılır.", "If an outlet’s count on a day exceeds six times its usual daily count (at least 200), the day is treated as a bulk sitemap update and dropped.")],
    [tt("Yayında olma", "Being active"), tt("Bir yayın bir olay penceresinde (bir gün önce, iki gün sonra) kendi olağan günlük başlık sayısının yarısı kadar, en az 4 başlık yayımlamışsa “yayındaydı” sayılır; kaydı eksik günler “yazmadı” sayılmaz.", "An outlet counts as active in an event window (one day before, two days after) if it published at least half its usual daily headline count, and at least 4 headlines; days with missing records are not counted as “did not cover”.")],
    [tt("Olay", "Event"), tt("Bir olay türü başlıklarda son 28 günün tabanının 2,5 katına çıktığında o gün olay sayılır.", "A day counts as an event when one kind of event rises to 2.5 times its 28-day baseline in the headlines.")],
    [tt("Öne çıkarılan ölçüm", "Highlighted measurement"), tt("Bir yayının ölçümü üç koşulla öne çıkarılır: yeterli ölçüm (en az 20 olay ya da 30 başlık), yüksek oran (başlık atmama %80, faili yazmama %60, ölü başına 3 kat) ve aynı dildeki tanık basından belirgin fark (en az 15 puan ya da 2 kat).", "An outlet’s measurement is highlighted only with enough measurements (at least 20 events or 30 headlines), a high rate (no headline 80%, killer not named 60%, 3 times per death) and a clear gap from witness press in the same language (at least 15 points or twice as much).")],
    [tt("Yetersiz örneklem", "Sample too small"), tt("100 başlıktan az veriye dayanan oranlar gösterilmez.", "Rates based on fewer than 100 headlines are not shown.")]
  ]);

  paragraflar($("g-dogrulama"), [
    tt("Sınıflandırma kural tabanlıdır; yapay zekâ kullanılmaz. İsabet oranını ölçmek için savaş başlıklarından, basın grubu ve otomatik sınıf katmanlarında rastgele seçilen 255 başlıklık bir örneklem hazırlandı. Örneklem, otomatik sınıflar gizlenerek elle kodlanıyor. Sonuçlar (sınıf başına isabet ve kapsama) bu bölümde yayımlanacak; o zamana kadar raporlardaki sayılar doğrulanmamış otomatik ölçümdür.",
      "Classification is rule-based; no AI is used. To measure accuracy, a random sample of 255 war-context headlines, stratified by press group and automatic class, was drawn. It is being hand-coded with the automatic classes hidden. The results (precision and recall per class) will be published here; until then the figures in the reports are unvalidated automatic measurements.")
  ]);

  // E3: olay eşiği duyarlılığı (alisma.json → duyarlilik)
  fetch("data/bulten/alisma.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (a) {
    var d = a.duyarlilik; if (!d || !d.length) return;
    var k = $("g-esikler"), kt = el("div", "tablo-kutu"), tb = el("table"), th = el("thead"), tr0 = el("tr");
    var G = ["bolge", "israil", "bati_ana", "bati_muhalif"];
    [tt("Olay eşiği", "Event threshold"), tt("Olay", "Events")].concat(G.map(function (g) { return AD[g]; })).forEach(function (x) { tr0.appendChild(el("th", null, x)); });
    th.appendChild(tr0); tb.appendChild(th); var bd = el("tbody");
    d.forEach(function (x) { var r = el("tr"); r.append(el("td", null, sayi(x.kat) + tt(" kat", "×")), el("td", "sayi", sayi(x.olay, 0))); G.forEach(function (g) { var v = x.sessiz_pay[g]; r.appendChild(el("td", "sayi", v == null ? "–" : (EN ? sayi(v) + "%" : "%" + sayi(v)))); }); bd.appendChild(r); });
    tb.appendChild(bd);
    k.appendChild(el("h3", null, tt("Duyarlılık: olay eşiği değişirse", "Sensitivity: if the event threshold changes")));
    k.appendChild(el("p", null, tt("Olay eşiği 2, 2,5 ve 3 kat alındığında olay sayısı ve grup grup “o olay türünden başlık atmayan yayınların payı”. Payların eşikten neredeyse hiç etkilenmemesi, sonucun bu tercihe bağlı olmadığını gösterir.", "Number of events and, group by group, the share of active outlets that ran no headline of that kind, with the event threshold at 2, 2.5 and 3 times. That the shares barely move shows the result does not hinge on this choice.")));
    kt.appendChild(tb); k.appendChild(kt);
  }).catch(function () {});

  fetch("data/bulten/rapor-7-ekim.json?t=" + Math.floor(Date.now() / 6e5)).then(function (r) { return r.json(); }).then(function (v) {
    var s = v.surumler || {};
    document.querySelectorAll('[data-v="surum"]').forEach(function (x) { x.textContent = tt("Ölçüm sürümü ", "Measurement version ") + (s.ozet || "–") + " · " + tt("rapor sürümü ", "report version ") + (s.rapor || v.surum) + " · " + new Date(v.guncellendi).toLocaleDateString(YER, { day: "numeric", month: "long", year: "numeric" }); });
    var vb = document.querySelector('[data-v="veri"]');
    paragraflar(vb, [
      tt("Başlıklar iki yoldan geliyor. Ekim 2023’ten canlı toplayıcının başladığı güne kadar: yayınların kendi arşivlerinden, site haritalarından ve İnternet Arşivi’nden geriye dönük toplanan özgün başlıklar. Sonrası: toplayıcının 15 dakikada bir okuduğu akışlar. Haber metni saklanmaz; yalnızca başlık, adres ve tarih.",
        "Headlines come from two routes. From October 2023 until the live collector started: original headlines gathered retrospectively from outlets’ own archives, sitemaps and the Internet Archive. After that: the feeds the collector reads every 15 minutes. Article text is not stored; only headline, address and date."),
      tt("Ölçülen: " + sayi(v.baslik, 0) + " tarihli başlık, " + (v.kapsama || []).length + " yayın, " + v.bas + " – " + v.son + ". Ayrıca tarihi belirlenemeyen " + sayi(v.tarihsiz, 0) + " adres var; bunlar ölçüme girmez. Adresinde tarih olan ya da akışı tarih veren yayınlar bu yüzden daha iyi temsil edilir (aşağıdaki kapsama tablosu).",
        "Measured: " + sayi(v.baslik, 0) + " dated headlines, " + (v.kapsama || []).length + " outlets, " + v.bas + " – " + v.son + ". There are also " + sayi(v.tarihsiz, 0) + " addresses that could not be dated; they are not measured. Outlets whose addresses or feeds carry dates are therefore better represented (coverage table below)."),
    ]);
    if (v.dis && v.dis.kaynak) vb.appendChild(el("p", null, tt("Ölü sayıları: ", "Death counts: ") + v.dis.kaynak + "."));
    paragraflar($("g-sinirlar"), [
      tt("Seçim yanlılığı: Geriye dönük arşivde tarihli başlıktan çok tarihsiz adres var. Tarihlenebilen yayınlar fazla, arşivi kapalı yayınlar az temsil edilir. Reuters, BBC ve bazı büyük yayınlar şu an eksik; Media Cloud verisi tamamlanınca eklenecek.", "Selection bias: the backfill holds more undated addresses than dated headlines. Outlets that can be dated are over-represented and those with closed archives under-represented. Reuters, the BBC and some major outlets are currently missing; they will be added once the Media Cloud data is complete."),
      tt("Adresten türetilen başlıklar: Bazı yayınların başlıkları yalnızca adresteki kelimelerden (harf işaretsiz) çıkarılabildi. Bu başlıklarda kelime ve faillik ölçümü daha kabadır.", "Headlines derived from addresses: for some outlets, headlines could only be reconstructed from the words in the address (without diacritics). Word and agency measures are coarser for these."),
      tt("İsrail basını: İbranice yayınların geriye dönük arşivi büyük ölçüde boş kayıt çıktı ve atıldı; İsrail basını ölçümü ağırlıkla İngilizce yayınlara dayanır ve örneklemi küçüktür.", "Israeli press: the backfill of Hebrew outlets turned out to be mostly empty records and was dropped; the Israeli press measurement rests mainly on English-language outlets and the sample is small."),
      tt("Kelime sayımı çerçeveyi değil geçişi sayar: Tırnak içi kullanımlar ayrılır, ama haber konusu olarak geçen kelime (“X’i soykırımla suçladı”) yine sayılır.", "Word counts measure occurrence, not framing: quoted uses are set apart, but a word reported as a subject (“accused X of genocide”) is still counted."),
      tt("Olaylar başlıklardan bulunur: Sessizlik ölçüsündeki olaylar basının kendisinden çıkarıldığı için, basının hiç yazmadığı olaylar görünmez. Basından bağımsız olay listeleriyle (Insecurity Insight, WHO, CPJ) karşılaştırma hazırlanıyor.", "Events are found in the headlines: because the events in the silence measure come from the press itself, events the press never covered are invisible. A comparison with event lists independent of the press (Insecurity Insight, WHO, CPJ) is in preparation."),
      tt("Başlık atmama payı yayının hacmine bağlıdır: az başlık atan yayınlar bir olay türünü daha sık hiç yazmaz. Bu yüzden bu pay gruplar arasında doğrudan karşılaştırılmaz; her yayın aynı dildeki tanık basınla karşılaştırılır.", "The no-headline share depends on an outlet’s volume: outlets that run few headlines more often run nothing on a given kind of event. So this share is not compared directly between groups; each outlet is compared with witness press in the same language."),
      tt("Yapay zekâ metinleri: Almanak’taki yorum metinleri yapay zekâya yazdırılır ve öyle etiketlenir. Ölçümün parçası değildir.", "AI texts: the commentary in the Almanac is written by AI and labelled as such. It is not part of the measurement.")
    ]);
    kapsama(v.kapsama || []);
  }).catch(function () { var m = document.querySelector(".rp-kunye"); if (m) m.after(el("p", "bekliyor", tt("Veri henüz hazır değil.", "Data not ready yet."))); });

  function kapsama(xs) {
    var k = $("g-kapsama");
    k.appendChild(el("p", null, tt("Her yayının ölçüme giren tarihli başlık sayısı, kayıtlı gün sayısı, tarihleme yöntemi ve dışarıda kalan tarihsiz adresleri. Bir yayının sayıları ancak kendi kapsaması kadar güvenilirdir.", "Each outlet’s dated headlines in the measurement, recorded days, dating method and undated addresses left out. An outlet’s figures are only as reliable as its coverage.")));
    var dg = el("button", "b-indir", tt("Tabloyu CSV olarak indir", "Download the table as CSV")); dg.type = "button";
    dg.onclick = function () {
      var sat = [["id", "yayin", "grup", "dil", "tarihli_baslik", "savas_baslik", "olum_baslik", "kayitli_gun", "ilk", "son", "tarih_yontemi", "tarihsiz_adres", "bos_kayit", "toplu_gun"]];
      xs.forEach(function (x) { sat.push([x.id, x.ad, x.grup, x.dil, x.tarihli, x.baglamli, x.olum, x.gun, x.ilk, x.son, x.yontem, x.tarihsiz, x.bos, x.toplu_gun]); });
      var csv = sat.map(function (r) { return r.map(function (c) { c = c == null ? "" : String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(","); }).join("\n");
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "zbs-kapsama.csv"; document.body.appendChild(a); a.click(); a.remove();
    };
    k.appendChild(dg);
    var kt = el("div", "tablo-kutu"), tb = el("table", "yt-kapsama"), th = el("thead"), tr0 = el("tr");
    [tt("Yayın", "Outlet"), tt("Grup", "Group"), tt("Dil", "Lang."), tt("Tarihli başlık", "Dated headlines"), tt("Savaş başlığı", "War headlines"), tt("Ölüm başlığı", "Death headlines"), tt("Kayıtlı gün", "Days recorded"), tt("Tarihleme", "Dating"), tt("Tarihsiz adres", "Undated addresses")].forEach(function (x) { tr0.appendChild(el("th", null, x)); });
    th.appendChild(tr0); tb.appendChild(th); var bd = el("tbody");
    xs.forEach(function (x) {
      var r = el("tr");
      r.append(el("td", null, x.ad), el("td", null, AD[x.grup] || x.grup || ""), el("td", null, x.dil || ""), el("td", "sayi", sayi(x.tarihli, 0)), el("td", "sayi", sayi(x.baglamli, 0)), el("td", "sayi", sayi(x.olum, 0)), el("td", "sayi", sayi(x.gun, 0)), el("td", null, YONTEM[x.yontem] || x.yontem), el("td", "sayi", x.tarihsiz ? sayi(x.tarihsiz, 0) : "–"));
      bd.appendChild(r);
    });
    tb.appendChild(bd); kt.appendChild(tb); k.appendChild(kt);
  }
})();
