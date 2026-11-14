/* Okurun bulunduğu ülkeye göre gösterim (kısıtlı mod).
   Hamas, İslami Cihad, FHKC, Hizbullah'ın yayın organları ve benzerleri bazı ülkelerde yasaklı ya da yaptırım listesinde.
   Bu ülkelerden gelen okura: (1) bu grupların resmî kanalları gösterilmez, (2) tarihçede "şehit" yerine "öldürüldü" yazılır.
   Ülke iki yoldan bulunur: site Cloudflare arkasındaysa /cdn-cgi/trace (gerçek ülke), değilse tarayıcının saat dilimi (yaklaşık).
   Bu tarayıcıda yapılan bir gösterim ayarıdır; veriler herkese açık kalır, VPN ile aşılabilir. Hukuki koruma değil, özen önlemidir. */
(function () {
  "use strict";
  var KISITLI = ("US CA GB IE AU NZ JP IL CH LI NO AT BE BG HR CY CZ DK EE FI FR DE GR HU IT LV LT LU MT NL PL PT RO SK SI ES SE " +
    "AR PY CO GT HN").split(" ");
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* eski tarayıcı */ }
  var AVRUPA_DISI = ["Istanbul", "Moscow", "Kiev", "Kyiv", "Minsk", "Belgrade", "Sarajevo", "Skopje", "Podgorica", "Tirane", "Chisinau", "Simferopol",
    "Volgograd", "Kirov", "Samara", "Ulyanovsk", "Saratov", "Astrakhan", "Kaliningrad"];
  var KUZEY_AMERIKA = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Menominee|Metlakatla|Yakutat|Indiana\/|Kentucky\/|North_Dakota\/|Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Whitehorse|Yellowknife|Iqaluit|Glace_Bay|Goose_Bay|Swift_Current|Dawson_Creek|Fort_Nelson|Cambridge_Bay|Rankin_Inlet|Resolute|Inuvik|Dawson|Creston|Atikokan|Blanc-Sablon|Nipigon|Thunder_Bay|Rainy_River|Pangnirtung|Montreal|Argentina\/|Buenos_Aires|Asuncion|Bogota|Guatemala|Tegucigalpa)|US\/|Canada\/|Pacific\/Honolulu)/;
  function tzKisitli(z) {
    if (/^Europe\//.test(z)) return AVRUPA_DISI.indexOf(z.split("/")[1]) < 0;
    if (/^Atlantic\/(Canary|Madeira|Azores|Faroe)$/.test(z)) return true;
    if (/^(Australia\/|Pacific\/(Auckland|Chatham)|Asia\/(Tokyo|Jerusalem|Tel_Aviv)|Antarctica\/)/.test(z)) return true;
    return KUZEY_AMERIKA.test(z);
  }
  // elle seçim (deneme ve itiraz için): ?bolge=kisitli / ?bolge=acik ; tarayıcıda hatırlanır
  var elle = null;
  try {
    var q = new URLSearchParams(location.search).get("bolge");
    if (q === "kisitli" || q === "acik") localStorage.setItem("zbs-bolge", q);
    if (q === "oto") localStorage.removeItem("zbs-bolge");
    elle = localStorage.getItem("zbs-bolge");
  } catch (e) { /* özel pencere */ }
  var B = window.ALB_BOLGE = { tz: tz, ulke: null, kisitli: elle ? elle === "kisitli" : tzKisitli(tz), kaynak: elle ? "elle" : "saat dilimi" };
  // Cloudflare arkasındaysa gerçek ülke (aynı alan adı; dışarıya istek yok)
  B.hazir = elle ? Promise.resolve(B) : Promise.race([
    fetch("/cdn-cgi/trace", { cache: "no-store" }).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var m = /(?:^|\n)loc=([A-Z]{2})/.exec(t || "");
      if (m) { B.ulke = m[1]; B.kisitli = KISITLI.indexOf(m[1]) >= 0; B.kaynak = "ağ"; }
      return B;
    }).catch(function () { return B; }),
    new Promise(function (ok) { setTimeout(function () { ok(B); }, 700); })
  ]);
  // kısıtlı modda gösterilmeyen yayınlar: kaynaklar.json'da "silahli": true
  B.gizli = function (k) { return !!(B.kisitli && k && k.silahli); };
  // tarihçe metinleri: "şehit" sözcüğü olgusal karşılığıyla
  var TR = [[/şehit edilişini/g, "öldürülüşünü"], [/şehit edilmesinin/g, "öldürülmesinin"], [/şehit edilince/g, "öldürülünce"], [/şehit edildi/g, "öldürüldü"],
    [/şehit düştüğü/g, "öldürüldüğü"], [/şehit düştü/g, "öldürüldü"], [/şehit eden/g, "öldüren"], [/şehit etti/g, "öldürdü"], [/şehit oldu/g, "hayatını kaybetti"],
    [/(\d[\d.]*\s*(?:bin\s*)?)şehit verdi/g, "$1kayıp verdi"], [/şehitlik mezarlığı/g, "şehitlik mezarlığı"], [/Şehitler Günü/g, "Şehitler Günü"]];
  var EN = [[/martyring/g, "killing"], [/was martyred/g, "was killed"], [/were martyred/g, "were killed"], [/is martyred/g, "is killed"], [/martyred/g, "killed"]];
  B.notr = function (s, dil) {
    if (!B.kisitli || !s) return s;
    (dil === "en" ? EN : TR).forEach(function (r) { s = s.replace(r[0], r[1]); });
    return s;
  };
})();
