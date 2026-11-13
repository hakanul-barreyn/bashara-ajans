/* ZBS telefon destesi: akışı tam ekran "birimlere" böler ve sıralar. Hem sitede (window.ZBSDeste) hem simülasyonda
   (node: require) aynı kod çalışır.

   Birimler (her biri tam bir ekran; dikey kaydırma bir sonraki konu, yatay kaydırma aynı konunun içi):
     kapak   : günün özeti (tarih, ana konular, sayılar, kullanım ipucu)
     hikaye  : gündemdeki bir olay; farklı yayınların aynı haberi. Sayfalar: özet → yayın yayın anlatım → kim yazdı
     seri    : aynı yayının aynı saatte en az 3 haberi; sayfalar
     kisa    : aynı saatte farklı yayınlardan tek tük haberler; 5 başlıklık liste kartı
     tek     : görseli ya da Türkçe özeti olan tekil haber
     analiz  : 6 saatlik dilimdeki analiz ve görüş yazıları; sayfalar
     bilgi   : harita, tutuklu hekim sayacı, Gazze fotoğrafları, uydu (yer tutucu; site doldurur)
     mola    : her 12 birimde bir; son 12 birimin ana başlıkları ve oturum özeti
     son     : destenin sonu; daha eskiye ya da raporlara geçiş
   Tuzak karşıtı ilkeler: deste sonludur (son 24 saat), mola kartları doğal durak verir, sıra "ilgi çekme"
   ölçüsüyle değil olay önemi + güncellik + çeşitlilikle kurulur.
*/
(function (kok) {
  "use strict";
  var AYAR = { pencereSaat: 24, seriEnAz: 3, kisaBoy: 5, analizSaat: 6, molaAralik: 12, enCokBirim: 72, yariOmurSaat: 4, kumeSaat: 6, kumeEsik: 0.34, birlesEsik: 0.45 };

  function saat(t) { return Date.parse(t); }
  function kampOf(K, h) { var k = K[h.kaynak] || {}; return k.kamp || k.bolge || ""; }

  function kur(haberler, gundem, K, simdi, ayar) {
    var A = Object.assign({}, AYAR, ayar || {});
    simdi = simdi || Date.now();
    var sinir = simdi - A.pencereSaat * 36e5;
    var havuz = haberler.filter(function (h) { return !h.atla && K[h.kaynak] && saat(h.tarih) >= sinir; })
      .sort(function (a, b) { return saat(b.tarih) - saat(a.tarih); });
    var idx = {}; havuz.forEach(function (h) { idx[h.id] = h; });
    var kullanilan = {};

    // 1) Hikâyeler: gündem olayları (farklı yayınların aynı haberi)
    var hikayeler = (gundem || []).map(function (o) {
      var xs = (o.haberler || []).map(function (id) { return idx[id]; }).filter(Boolean);
      if (xs.length < 2) return null;
      var kamplar = {}; xs.forEach(function (h) { kamplar[kampOf(K, h)] = (kamplar[kampOf(K, h)] || 0) + 1; });
      var yayin = {}; xs.forEach(function (h) { yayin[h.kaynak] = 1; });
      var son = Math.max.apply(null, xs.map(function (h) { return saat(h.tarih); }));
      var onem = Math.log2(1 + Object.keys(yayin).length) * 2 + Object.keys(kamplar).length;
      var tazelik = Math.pow(0.5, (simdi - son) / (A.yariOmurSaat * 36e5));
      xs.forEach(function (h) { kullanilan[h.id] = 1; });
      return { tur: "hikaye", olay: o, haberler: xs, kamplar: kamplar, yayinSayisi: Object.keys(yayin).length, son: son, puan: onem * (0.35 + tazelik) };
    }).filter(Boolean).sort(function (a, b) { return b.puan - a.puan; });

    // 1b) Gündemde olmayan ortak haberler: İngilizce başlıklarda kelime benzerliği (6 saat içinde, en az 2 yayın)
    benzerKume(havuz, kullanilan, A).forEach(function (xs) {
      var kamplar = {}, yayin = {};
      xs.forEach(function (h) { kamplar[kampOf(K, h)] = (kamplar[kampOf(K, h)] || 0) + 1; yayin[h.kaynak] = 1; kullanilan[h.id] = 1; });
      var son = Math.max.apply(null, xs.map(function (h) { return saat(h.tarih); }));
      var onem = Math.log2(1 + Object.keys(yayin).length) * 2 + Object.keys(kamplar).length;
      var tazelik = Math.pow(0.5, (simdi - son) / (A.yariOmurSaat * 36e5));
      hikayeler.push({ tur: "hikaye", olay: null, haberler: xs, kamplar: kamplar, yayinSayisi: Object.keys(yayin).length, son: son, puan: onem * (0.35 + tazelik) });
    });
    hikayeler.sort(function (a, b) { return b.puan - a.puan; });

    // 2) Analizler: 6 saatlik dilimler
    var analizKova = {}, analizler = [];
    havuz.forEach(function (h) {
      if (kullanilan[h.id] || h.nitelik !== "analiz") return;
      var k = Math.floor(saat(h.tarih) / (A.analizSaat * 36e5));
      if (!analizKova[k]) { analizKova[k] = { tur: "analiz", haberler: [], son: saat(h.tarih) }; analizler.push(analizKova[k]); }
      analizKova[k].haberler.push(h); kullanilan[h.id] = 1;
    });

    // 3) Kalan haberler: aynı yayının saatlik serisi (en az 3), görseli/özeti olan tekil haber, geri kalanı "kısa kısa"
    var kova = {};
    havuz.forEach(function (h) {
      if (kullanilan[h.id]) return;
      var k = h.kaynak + ":" + Math.floor(saat(h.tarih) / 36e5);
      (kova[k] = kova[k] || []).push(h);
    });
    var akis = [], kisaHavuz = [];
    Object.keys(kova).forEach(function (k) {
      var xs = kova[k];
      if (xs.length >= A.seriEnAz) akis.push({ tur: "seri", haberler: xs, son: saat(xs[0].tarih) });
      else xs.forEach(function (h) {
        var dolu = (h.gorsel && h.gorsel_ok === true) || h.ozet_tr;
        if (dolu) akis.push({ tur: "tek", haberler: [h], son: saat(h.tarih) }); else kisaHavuz.push(h);
      });
    });
    // kısa kısa: saat dilimi içinde farklı yayınlardan beşerli
    var kisaKova = {};
    kisaHavuz.forEach(function (h) { var k = Math.floor(saat(h.tarih) / 36e5); (kisaKova[k] = kisaKova[k] || []).push(h); });
    Object.keys(kisaKova).forEach(function (k) {
      var xs = kisaKova[k].sort(function (a, b) { return saat(b.tarih) - saat(a.tarih); });
      // aynı yayından en çok iki başlık bir kartta
      var parca = [], say = {};
      xs.forEach(function (h) {
        if ((say[h.kaynak] || 0) >= 2) return;
        say[h.kaynak] = (say[h.kaynak] || 0) + 1; parca.push(h);
        if (parca.length === A.kisaBoy) { akis.push({ tur: "kisa", haberler: parca, son: saat(parca[0].tarih) }); parca = []; say = {}; }
      });
      if (parca.length >= 3) akis.push({ tur: "kisa", haberler: parca, son: saat(parca[0].tarih) });
      else parca.forEach(function (h) { akis.push({ tur: "tek", haberler: [h], son: saat(h.tarih) }); });
    });
    akis.sort(function (a, b) { return b.son - a.son; });
    // akış birimlerinde çeşitlilik: aynı yayın 5 birimde bir, aynı kamp en çok 2 ardışık
    akis = cesitle(akis, K);

    // 4) Örgü: kapak, sonra hikâye / akış / akış ... arasına analiz ve bilgi kartları, her 12 birimde mola
    var deste = [{ tur: "kapak", hikayeler: hikayeler.slice(0, 3), sayi: havuz.length, yayin: Object.keys(havuz.reduce(function (m, h) { m[h.kaynak] = 1; return m; }, {})).length }];
    var bilgi = { 4: "harita", 9: "sayac", 15: "foto", 22: "uydu" };
    var hi = 0, ai = 0, ki = 0, sayac = 0, molaSon = [];
    while (deste.length < A.enCokBirim && (hi < hikayeler.length || ki < akis.length || ai < analizler.length)) {
      var n = deste.length;
      var b;
      if (bilgi[n]) b = { tur: "bilgi", tip: bilgi[n] };
      else if (sayac > 0 && sayac % A.molaAralik === 0 && molaSon.length) { b = { tur: "mola", ozet: molaSon.slice(), sira: sayac }; molaSon = []; deste.push(b); sayac++; continue; }
      else if (sayac % 7 === 5 && ai < analizler.length) b = analizler[ai++];
      else if ((sayac % 3 === 0 || ki >= akis.length) && hi < hikayeler.length) b = hikayeler[hi++];
      else if (ki < akis.length) b = akis[ki++];
      else if (hi < hikayeler.length) b = hikayeler[hi++];
      else b = analizler[ai++];
      deste.push(b);
      if (b.tur !== "bilgi") { sayac++; molaSon.push(b); if (molaSon.length > A.molaAralik) molaSon.shift(); }
    }
    var kalan = (hikayeler.length - hi) + (akis.length - ki) + (analizler.length - ai);
    deste.push({ tur: "son", kalan: kalan, toplam: havuz.length });
    return { deste: deste, istatistik: { haber: havuz.length, hikaye: hikayeler.length, akis: akis.length, analiz: analizler.length, kalan: kalan } };
  }

  var DUR = {"the":1,"and":1,"for":1,"with":1,"from":1,"that":1,"this":1,"after":1,"over":1,"into":1,"amid":1,"says":1,"said":1,"will":1,"have":1,"has":1,"was":1,"were":1,"are":1,"its":1,"his":1,"their":1,"they":1,"been":1,"more":1,"than":1,"about":1,"against":1,"news":1,"report":1,"live":1,"video":1,"israel":1,"israeli":1,"gaza":1,"palestinian":1,"palestinians":1};
  function belirtec(h) {
    var b = (h.baslik_en || (h.dil === "en" ? h.baslik_orj : "") || "").toLowerCase().replace(/[’']s\b/g, "");
    var t = {}; (b.match(/[a-z0-9]{3,}/g) || []).forEach(function (w) { if (!DUR[w]) t[w] = 1; });
    return Object.keys(t);
  }
  // Tek bağlantılı değil, tohum çevresinde kümeleme: tohumla Jaccard >= 0,34 ve en az 2 ortak anlamlı kelime
  function benzerKume(havuz, kullanilan, A) {
    var xs = havuz.filter(function (h) { return !kullanilan[h.id] && h.nitelik !== "analiz"; });
    var bt = xs.map(belirtec), ters = {};
    bt.forEach(function (ts, i) { ts.forEach(function (w) { (ters[w] = ters[w] || []).push(i); }); });
    var alindi = {}, out = [];
    for (var i = 0; i < xs.length; i++) {
      if (alindi[i] || bt[i].length < 3) continue;
      var ortak = {};
      bt[i].forEach(function (w) { if (ters[w].length < 60) ters[w].forEach(function (j) { if (j !== i) ortak[j] = (ortak[j] || 0) + 1; }); });
      var kume = [i], yayin = {}; yayin[xs[i].kaynak] = 1;
      Object.keys(ortak).forEach(function (j) {
        j = +j; if (alindi[j] || ortak[j] < 2) return;
        if (Math.abs(saat(xs[j].tarih) - saat(xs[i].tarih)) > A.kumeSaat * 36e5) return;
        var jac = ortak[j] / (bt[i].length + bt[j].length - ortak[j]);
        if (jac >= A.kumeEsik) { kume.push(j); yayin[xs[j].kaynak] = 1; }
      });
      if (Object.keys(yayin).length >= 2) {
        // aynı yayından en çok 2 haber
        var say = {}, sec = [];
        kume.forEach(function (j) { var k = xs[j].kaynak; if ((say[k] || 0) < 2) { say[k] = (say[k] || 0) + 1; sec.push(j); } });
        sec.forEach(function (j) { alindi[j] = 1; });
        out.push(sec.map(function (j) { return xs[j]; }).sort(function (a, b) { return saat(b.tarih) - saat(a.tarih); }));
      }
    }
    // birleştirme: iki kümenin herhangi iki haberi tohum eşiğini geçiyorsa tek hikâye
    var bk = out.map(function (xs) { return xs.map(belirtec); });
    function jac(a, b) { var o = 0, m = {}; a.forEach(function (w) { m[w] = 1; }); b.forEach(function (w) { if (m[w]) o++; }); return o < 2 ? 0 : o / (a.length + b.length - o); }
    for (var a = 0; a < out.length; a++) {
      if (!out[a]) continue;
      for (var b = a + 1; b < out.length; b++) {
        if (!out[b]) continue;
        var es = false;
        for (var x = 0; x < bk[a].length && !es; x++) for (var y = 0; y < bk[b].length && !es; y++)
          if (jac(bk[a][x], bk[b][y]) >= A.birlesEsik && Math.abs(saat(out[a][x].tarih) - saat(out[b][y].tarih)) <= A.kumeSaat * 36e5) es = true;
        if (es) { out[a] = out[a].concat(out[b]); bk[a] = bk[a].concat(bk[b]); out[b] = null; b = a; }
      }
    }
    return out.filter(Boolean).map(function (xs) { return xs.sort(function (p, q) { return saat(q.tarih) - saat(p.tarih); }); });
  }

  function cesitle(xs, K) {
    var kalan = xs.slice(), out = [];
    var anahtar = function (b) { return b.haberler[0].kaynak; };
    var kamp = function (b) { return b.tur === "kisa" ? "karma" : kampOf(K, b.haberler[0]); };
    while (kalan.length) {
      var sonY = out.slice(-4).map(anahtar), sonK = out.slice(-2).map(kamp);
      var dolu = sonK.length === 2 && sonK[0] === sonK[1];
      var sec = 0;
      for (var i = 0; i < Math.min(kalan.length, 25); i++) {
        var b = kalan[i];
        if (sonY.indexOf(anahtar(b)) >= 0) continue;
        if (dolu && kamp(b) === sonK[0]) continue;
        sec = i; break;
      }
      out.push(kalan.splice(sec, 1)[0]);
    }
    return out;
  }

  var api = { kur: kur, AYAR: AYAR };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else kok.ZBSDeste = api;
})(typeof window !== "undefined" ? window : this);
