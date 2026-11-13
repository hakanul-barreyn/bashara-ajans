/* ZBS telefon destesi: akışı tam ekran "birimlere" böler ve sıralar. Hem sitede (window.ZBSDeste) hem simülasyonda
   (node: require) aynı kod çalışır.

   Birimler (her biri tam bir ekran; dikey kaydırma bir sonraki konu, yatay kaydırma aynı konunun içi):
     kapak   : günün özeti (tarih, ana konular, sayılar, kullanım ipucu)
     hikaye  : gündemdeki bir olay; farklı yayınların aynı haberi. Sayfalar: özet → yayın yayın anlatım → kim yazdı
     seri    : aynı yayının aynı saatte en az 3 haberi; sayfalar
     tek     : tekil haber
     bolum   : bölüm başlığı (gösterilmeyen haberler, daha eski önemli haberler, analizler)
     analiz  : 6 saatlik dilimdeki analiz ve görüş yazıları; sayfalar
     bilgi   : harita, tutuklu hekim sayacı, Gazze fotoğrafları, uydu (yer tutucu; site doldurur)
     mola    : her 12 birimde bir; son 12 birimin ana başlıkları ve oturum özeti
     son     : destenin sonu; arşiv ve raporlara geçiş
   Tuzak karşıtı ilkeler: günün dosyası 40 kartta durur, devamı okur isterse gelir; mola kartları doğal durak verir, sıra "ilgi çekme"
   ölçüsüyle değil olay önemi + güncellik + çeşitlilikle kurulur.
*/
(function (kok) {
  "use strict";
  var AYAR = { pencereSaat: 24, seriEnAz: 3, analizSaat: 6, molaAralik: 12, yariOmurSaat: 4, kumeSaat: 6, kumeEsik: 0.34, birlesEsik: 0.45 };

  var CEKIRDEK = { "Gazze": 1, "İnsani durum": 1, "Batı Şeria": 1, "Kudüs": 1, "Esirler ve tutuklular": 1, "Uluslararası hukuk": 1, "Lübnan": 1, "Yemen ve Kızıldeniz": 1, "Protesto ve dayanışma": 1 };
  function saat(t) { return Date.parse(t); }
  function kampOf(K, h) { var k = K[h.kaynak] || {}; return k.kamp || k.bolge || ""; }

  function hikayeYap(havuz, gundem, K, simdi, A, kullanilan, enAzYayin, enAzKamp) {
    var idx = {}; havuz.forEach(function (h) { idx[h.id] = h; });
    var yap = function (xs, o) {
      var kamplar = {}, yayin = {};
      xs.forEach(function (h) { kamplar[kampOf(K, h)] = (kamplar[kampOf(K, h)] || 0) + 1; yayin[h.kaynak] = 1; });
      if (Object.keys(yayin).length < enAzYayin || Object.keys(kamplar).length < (enAzKamp || 1)) return null;
      xs.forEach(function (h) { kullanilan[h.id] = 1; });
      var son = Math.max.apply(null, xs.map(function (h) { return saat(h.tarih); }));
      var onem = Math.log2(1 + Object.keys(yayin).length) * 2 + Object.keys(kamplar).length;
      var tazelik = Math.pow(0.5, (simdi - son) / (A.yariOmurSaat * 36e5));
      return { tur: "hikaye", olay: o, haberler: xs, kamplar: kamplar, yayinSayisi: Object.keys(yayin).length, son: son, puan: onem * (0.35 + tazelik) };
    };
    // gündem olayları, sonra İngilizce başlık benzerliğiyle bulunan ortak haberler
    var out = (gundem || []).map(function (o) {
      var xs = (o.haberler || []).map(function (id) { return idx[id]; }).filter(function (h) { return h && !kullanilan[h.id]; });
      return xs.length >= 2 ? yap(xs, o) : null;
    }).filter(Boolean);
    // önce İngilizce başlıklar, sonra kalanlar Türkçe çevirileriyle
    benzerKume(havuz, kullanilan, A).forEach(function (xs) { var x = yap(xs, null); if (x) out.push(x); });
    benzerKume(havuz, kullanilan, A, true).forEach(function (xs) { var x = yap(xs, null); if (x) out.push(x); });
    return out.sort(function (a, b) { return b.puan - a.puan; });
  }

  // Deste dört bölümden oluşur ve eski görünüme hiç dönmez:
  //   1) son 24 saatin dosyası (hikâyeler, yayın serileri, görselli/özetli tekil haberler, bilgi kartları)
  //   2) dosyada gösterilmeyen son 24 saat haberleri (görselsiz ve özetsiz tekil başlıklar), en yeniden
  //   3) daha eski önemli haberler: en az 3 yayının yazdığı hikâyeler
  //   4) en sonda analiz ve görüş yazıları (6 saatlik dilimler)
  // Her bölüm bir başlık kartıyla açılır; her 12 konuda bir durak kartı gelir.
  function kur(haberler, gundem, K, simdi, ayar) {
    var A = Object.assign({}, AYAR, ayar || {});
    simdi = simdi || Date.now();
    var sinir = simdi - A.pencereSaat * 36e5;
    var hepsi = haberler.filter(function (h) { return !h.atla && K[h.kaynak]; })
      .sort(function (a, b) { return saat(b.tarih) - saat(a.tarih); });
    var havuz = hepsi.filter(function (h) { return saat(h.tarih) >= sinir; });
    var eski = hepsi.filter(function (h) { return saat(h.tarih) < sinir; });
    var kullanilan = {};
    // analizler her iki pencereden ayrılır, en sona kalır
    var analizKova = {}, analizler = [];
    hepsi.forEach(function (h) {
      if (h.nitelik !== "analiz") return;
      var k = Math.floor(saat(h.tarih) / (A.analizSaat * 36e5));
      if (!analizKova[k]) { analizKova[k] = { tur: "analiz", haberler: [], son: saat(h.tarih) }; analizler.push(analizKova[k]); }
      analizKova[k].haberler.push(h); kullanilan[h.id] = 1;
    });

    var hikayeler = hikayeYap(havuz, gundem, K, simdi, A, kullanilan, 2);

    // kalan 24 saat haberleri: aynı yayının saatlik serisi (en az 3), görselli/özetli tekil haber; geri kalanı 2. bölüme
    var kova = {};
    havuz.forEach(function (h) {
      if (kullanilan[h.id]) return;
      var k = h.kaynak + ":" + Math.floor(saat(h.tarih) / 36e5);
      (kova[k] = kova[k] || []).push(h);
    });
    // aynı yayının saatlik serileri kaldırıldı: gruplama yalnızca aynı haberin farklı yayınları için (hikâye)
    var akis = [], ciplak = [];
    Object.keys(kova).forEach(function (k) {
      var xs = kova[k];
      xs.forEach(function (h) {
        if ((h.gorsel && h.gorsel_ok === true) || h.ozet_tr) akis.push({ tur: "tek", haberler: [h], son: saat(h.tarih) });
        else ciplak.push({ tur: "tek", haberler: [h], son: saat(h.tarih) });
      });
    });
    // 1) Günün dosyası (ilk ~40 kart): 24 saatin en önemli hikâyeleri ve en dolu tekil haberleri, önem sırasıyla.
    //    Tekil haber ve seri için önem: Türkçe özet, denetimden geçmiş görsel, seri büyüklüğü; 8 saatlik yarı ömürle güncellik.
    var akisPuan = function (b) {
      var h = b.haberler[0], p = b.tur === "seri" ? 1.5 + Math.log2(b.haberler.length) : 0;
      if (b.haberler.some(function (x) { return x.ozet_tr; })) p += 2;
      if (b.haberler.some(function (x) { return x.gorsel && x.gorsel_ok === true; })) p += 1;
      if (h.olay) p += 1;
      if (h.oncelik) p += 1;
      // konu etiketi: savaşın çekirdek konuları öne; özeti olup hiç etiketi olmayan (konu dışı) haber geriye
      var et = {}; b.haberler.forEach(function (x) { (x.etiket || []).forEach(function (t) { et[t] = 1; }); });
      var ets = Object.keys(et);
      if (ets.some(function (t) { return CEKIRDEK[t]; })) p += 1.5; else if (ets.length) p += 0.5;
      else if (b.haberler.some(function (x) { return x.ozet_tr; })) p -= 2.5;
      return Math.max(0, p) * (0.4 + Math.pow(0.5, (simdi - b.son) / (8 * 36e5)));
    };
    var DOSYA_HIKAYE = 20, DOSYA_AKIS = 20, YAYIN_TAVAN = 2;
    var dosyaH = hikayeler.slice(0, DOSYA_HIKAYE);
    // seri ve tekil haber yarı yarıya; aynı yayından en çok iki kart
    var adaylar = akis.slice().sort(function (a, b) { return akisPuan(b) - akisPuan(a); }), dosyaA = [], yayinSay = {}, turSay = {};
    [DOSYA_AKIS / 2, DOSYA_AKIS].forEach(function (turTavan) {
      adaylar.forEach(function (b) {
        var k = b.haberler[0].kaynak;
        if (dosyaA.length >= DOSYA_AKIS || dosyaA.indexOf(b) >= 0 || (yayinSay[k] || 0) >= YAYIN_TAVAN || (turSay[b.tur] || 0) >= turTavan) return;
        yayinSay[k] = (yayinSay[k] || 0) + 1; turSay[b.tur] = (turSay[b.tur] || 0) + 1; dosyaA.push(b);
      });
    });
    dosyaA.sort(function (a, b) { return akisPuan(b) - akisPuan(a); });
    var dosyada = new Set(dosyaA);
    dosyaA = cesitle(dosyaA, K);
    // 2) Sonra kalanlar saat sırasıyla (en yeniden eskiye); hikâyeler yine her üç karttan biri
    var kalanH = hikayeler.slice(DOSYA_HIKAYE).sort(function (a, b) { return b.son - a.son; });
    var kalanA = cesitle(akis.filter(function (b) { return !dosyada.has(b); }).sort(function (a, b) { return b.son - a.son; }), K);
    ciplak = cesitle(ciplak.sort(function (a, b) { return b.son - a.son; }), K);
    var eskiHikaye = hikayeYap(eski, gundem, K, simdi, A, kullanilan, 3, 2);

    var deste = [{ tur: "kapak", hikayeler: hikayeler.slice(0, 3), sayi: havuz.length }];
    var sayac = 0, molaSon = [];
    var ekle = function (b) {
      if (sayac > 0 && sayac % A.molaAralik === 0 && molaSon.length) { deste.push({ tur: "mola", ozet: molaSon.slice(), sira: sayac }); molaSon = []; }
      deste.push(b); sayac++; molaSon.push(b); if (molaSon.length > A.molaAralik) molaSon.shift();
    };
    var bilgi = { 4: "harita", 9: "sayac", 15: "foto", 22: "uydu" };
    var or = function (hs, as, adim) {
      var hi = 0, ki = 0, n0 = sayac;
      while (hi < hs.length || ki < as.length) {
        if (bilgi[deste.length]) { deste.push({ tur: "bilgi", tip: bilgi[deste.length] }); continue; }
        if (((sayac - n0) % adim === 0 || ki >= as.length) && hi < hs.length) ekle(hs[hi++]); else ekle(as[ki++]);
      }
    };
    or(dosyaH, dosyaA, 2);
    var dosyaSon = deste.length;
    or(kalanH, kalanA, 3);
    var bolum = function (tip, n) { if (n) deste.push({ tur: "bolum", tip: tip, sayi: n }); };
    bolum("gosterilmeyen", ciplak.length); ciplak.forEach(ekle);
    bolum("eski", eskiHikaye.length); eskiHikaye.forEach(ekle);
    bolum("analiz", analizler.length); analizler.forEach(ekle);
    deste.push({ tur: "son" });
    return { deste: deste, dosyaSon: dosyaSon, istatistik: { haber: havuz.length, hikaye: hikayeler.length, akis: akis.length, gosterilmeyen: ciplak.length, eskiHikaye: eskiHikaye.length, analiz: analizler.length } };
  }

  var DUR = {"the":1,"and":1,"for":1,"with":1,"from":1,"that":1,"this":1,"after":1,"over":1,"into":1,"amid":1,"says":1,"said":1,"will":1,"have":1,"has":1,"was":1,"were":1,"are":1,"its":1,"his":1,"their":1,"they":1,"been":1,"more":1,"than":1,"about":1,"against":1,"news":1,"report":1,"live":1,"video":1,"israel":1,"israeli":1,"gaza":1,"palestinian":1,"palestinians":1};
  // Türkçe başlıklar için: küçük harf, 4+ harfli kelimelerin ilk 5 harfi (ekleri kabaca atar)
  var DUR_TR = {"gazze":1,"israi":1,"filis":1,"için":1,"sonra":1,"olara":1,"kadar":1,"karşı":1,"bunu":1,"daha":1,"olan":1,"oldu":1,"ediyo":1,"etti":1,"ettiğ":1,"dedi":1,"açıkl":1,"yaptı":1,"büyük":1,"yeni":1,"haber":1,"canlı":1,"video":1,"bugü":1,"arası":1,"ilgil":1,"üzeri":1,"yönel":1,"birli":1,"başka":1,"verdi":1,"ilişk":1,"bakan":1,"devam":1};
  function belirtecTr(h) {
    var b = (h.baslik_tr || (h.dil === "tr" ? h.baslik_orj : "") || "").toLocaleLowerCase("tr");
    var t = {}; (b.match(/[a-zçğıöşüâîû0-9]{4,}/g) || []).forEach(function (w) { var k = w.slice(0, 5); if (!DUR_TR[k]) t[k] = 1; });
    return Object.keys(t);
  }
  function belirtec(h, tr) {
    if (tr) return belirtecTr(h);
    var b = (h.baslik_en || (h.dil === "en" ? h.baslik_orj : "") || "").toLowerCase().replace(/[’']s\b/g, "");
    var t = {}; (b.match(/[a-z0-9]{3,}/g) || []).forEach(function (w) { if (!DUR[w]) t[w] = 1; });
    return Object.keys(t);
  }
  // Tek bağlantılı değil, tohum çevresinde kümeleme: tohumla Jaccard >= 0,34 ve en az 2 ortak anlamlı kelime
  function benzerKume(havuz, kullanilan, A, tr) {
    var xs = havuz.filter(function (h) { return !kullanilan[h.id] && h.nitelik !== "analiz"; });
    var bt = xs.map(function (h) { return belirtec(h, tr); }), ters = {};
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
    var bk = out.map(function (xs) { return xs.map(function (h) { return belirtec(h, tr); }); });
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
