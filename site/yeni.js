/* yeni.html: ana sayfa tasarım önizlemesi. Veri: gundem, haberler-ilk (+ akis), analizler, dosyalar-site, kaynaklar. */
(function () {
  "use strict";
  var EN = /[?&]dil=en/.test(location.search);
  try { if (!/[?&]dil=/.test(location.search) && localStorage.getItem("yeni-dil") === "en") EN = true; } catch (e) {}
  var t = function (tr, en) { return EN ? en : tr; };
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function al(u) { return fetch(u, { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }

  // dil
  document.documentElement.lang = EN ? "en" : "tr";
  document.querySelectorAll("[data-tr]").forEach(function (n) { n.textContent = EN ? n.getAttribute("data-en") : n.getAttribute("data-tr"); });
  $("ara").placeholder = t("Haber ya da yayın ara", "Search stories or outlets");
  document.querySelectorAll(".dil button").forEach(function (b) {
    b.setAttribute("aria-pressed", String((b.dataset.dil === "en") === EN));
    b.onclick = function () { try { localStorage.setItem("yeni-dil", b.dataset.dil); } catch (e) {} location.search = b.dataset.dil === "en" ? "?dil=en" : ""; };
  });

  var KAMP = { "Filistin": "Filistin", "Meşrik": "Arap dünyası", "Körfez": "Arap dünyası", "Mısır": "Arap dünyası", "Mağrip": "Arap dünyası",
    "İran": "İran", "Yemen": "Yemen", "Anadolu-Türkiye": "Türkiye", "İsrail": "İsrail", "ABD": "Batı", "İngiltere": "Batı",
    "İspanya": "Batı", "İtalya": "Batı", "Almanya": "Batı", "Fransa": "Batı", "Asya ve diğer": "Diğer" };
  var RENK = { "Filistin": "#2b8a5e", "Arap dünyası": "#8cc2a8", "İran": "#c39a35", "Yemen": "#8f6a2a", "Türkiye": "#c9544e", "İsrail": "#4a72c4",
    "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#9aa3ab", "Diğer": "#6b746f" };
  var KAMP_EN = { "Filistin": "Palestine", "Arap dünyası": "Arab world", "İran": "Iran", "Yemen": "Yemen", "Türkiye": "Türkiye", "İsrail": "Israel",
    "İsrail’de muhalif basın": "Israeli dissident press", "Batı": "West", "Diğer": "Other" };
  var BOLGE = [
    ["Gazze", "Gaza", /Gazze|Han Yunus|Refah|Cebaliye|Deyr el-Belah|Nuseyrat|Beyt Lahiya|Gaza|Khan Yunis|Rafah|Jabalia/i],
    ["Kudüs", "Jerusalem", /Kudüs|Aksa|Jerusalem/i],
    ["Batı Şeria", "West Bank", /Batı Şeria|Cenin|Nablus|Ramallah|El-Halil|Tulkerim|Tubas|yerleşimci|West Bank|Jenin|Hebron|settler/i],
    ["Lübnan", "Lebanon", /Lübnan|Hizbullah|Beyrut|Lebanon|Hezbollah|Beirut/i],
    ["Yemen", "Yemen", /Yemen|Husi|Ensarullah|Hudeyde|Houthi|Hodeidah/i],
    ["İran", "Iran", /İran|Tahran|Hürmüz|Devrim Muhafızları|Iran|Tehran|Hormuz/i],
    ["Suriye", "Syria", /Suriye|Şam|Halep|Syria|Damascus|Aleppo/i],
    ["Irak", "Iraq", /Irak|Bağdat|Iraq|Baghdad|Kürdistan|Kurdistan/i],
    ["İsrail", "Israel", /Netanyahu|Eizenkot|Knesset|Tel Aviv|İsrail|Israel/i]];
  function bolgeBul(s) { for (var i = 0; i < BOLGE.length; i++) if (BOLGE[i][2].test(s || "")) return BOLGE[i]; return null; }

  var K = {};
  function kampAd(k) { return (k && (k.kamp || KAMP[k.bolge])) || "Diğer"; }
  function kampYaz(a) { return EN ? KAMP_EN[a] || a : a; }
  function kampSay(ids) {
    var s = {};
    (ids || []).forEach(function (id) { var k = K[id]; if (!k || k.silahli || k.dusunce) return; var a = kampAd(k); s[a] = (s[a] || 0) + 1; });
    return s;
  }
  function serit(s) {
    var d = el("div", "serit"); d.setAttribute("aria-hidden", "true");
    Object.keys(s).sort(function (a, b) { return s[b] - s[a]; }).forEach(function (a) { var i = el("i"); i.style.flex = s[a]; i.style.background = RENK[a] || "#6b746f"; d.appendChild(i); });
    return d;
  }
  function saySatir(s) { return Object.keys(s).sort(function (a, b) { return s[b] - s[a]; }).map(function (a) { return kampYaz(a) + " " + s[a]; }).join(" · "); }

  // Telegram başlıklarındaki emoji ve "Son dakika |" kalıpları
  var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{203C}\u{2049}\u{200D}]/gu;
  var SONDK = /^\s*(son dakika|breaking|urgent|acil|عاجل)\s*[|:\-–]\s*/i;
  function temiz(s) { return String(s || "").replace(EMOJI, "").replace(/\s{2,}/g, " ").trim(); }
  function sonDakikaMi(s) { return SONDK.test(temiz(s)); }
  function baslik(h) { var b = EN ? (h.baslik_en || h.baslik_orj || h.baslik_tr) : (h.baslik_tr || h.baslik_orj); return temiz(b).replace(SONDK, ""); }
  function ozet(h) { return temiz(EN ? h.ozet_en : h.ozet_tr); }
  function saat(s) {
    var d = new Date(s); if (isNaN(d)) return "";
    var x = new Date(d.getTime() + 3 * 36e5), h = ("0" + x.getUTCHours()).slice(-2), m = ("0" + x.getUTCMinutes()).slice(-2);
    return EN ? h + ":" + m : h + "." + m;
  }
  function once(s) {
    var dk = Math.round((Date.now() - new Date(s)) / 6e4);
    if (isNaN(dk)) return "";
    if (dk < 60) return Math.max(dk, 1) + t(" dk önce", " min ago");
    if (dk < 1440) return Math.round(dk / 60) + t(" sa önce", " h ago");
    var g = Math.round(dk / 1440); return g === 1 ? t("dün", "yesterday") : g + t(" gün önce", " d ago");
  }
  function vekil(u, w) { return "https://wsrv.nl/?url=" + encodeURIComponent(u) + "&w=" + w + "&we&output=webp&q=78"; }
  function kartLink(href, cls) { var a = el("a", cls); a.href = href; if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; } return a; }

  // ---- manşet ve gündem
  function gundemCiz(g) {
    var ol = (g && g.olaylar || []).slice().filter(function (o) { return o.kaynaklar && o.kaynaklar.length >= 2; });
    ol.sort(function (a, b) { return String(b.son).localeCompare(String(a.son)); });
    if (!ol.length) { $("manset").innerHTML = ""; $("manset").appendChild(el("p", "bekle", t("Gündem şu an boş.", "No top stories right now."))); return; }
    // Manşet: en çok yayın değil, en çeşitli basın (farklı kamplar) ve bölgeyle ilgili olay
    function puan(o) { var k = Object.keys(kampSay(o.kaynaklar)).length; return k * 4 + Math.min(o.kaynaklar.length, 12) + (bolgeBul(o.baslik + " " + (o.not || "")) ? 6 : 0); }
    var aday = ol.slice(0, 10), ana = aday.reduce(function (m, o) { return puan(o) > puan(m) ? o : m; }, aday[0]);
    var m = $("manset"); m.textContent = "";
    if (ana.gorsel) {
      var f = el("figure", "gorsel"), im = el("img"); im.src = vekil(ana.gorsel, 1200); im.alt = ""; im.loading = "eager";
      im.onerror = function () { f.remove(); };
      f.style.margin = "0"; f.appendChild(im);
      if (ana.gorsel_kaynak) f.appendChild(el("figcaption", null, t("Fotoğraf: ", "Photo: ") + ana.gorsel_kaynak));
      m.appendChild(f);
    }
    var ic = el("div", "manset-ic"), b = bolgeBul(ana.baslik + " " + (ana.not || ""));
    var et = el("div", "etiket", b ? (EN ? b[1] : b[0]) : t("Gündem", "Top story")); et.appendChild(el("span", null, ana.kaynaklar.length + t(" yayın · ", " outlets · ") + once(ana.son)));
    var h = el("h1"), a = el("a", null, temiz(EN ? ana.baslik_en || ana.baslik : ana.baslik)); a.href = ana.sayfa || "#"; h.appendChild(a);
    ic.append(et, h);
    var not = EN ? ana.not_en : ana.not; if (not) ic.appendChild(el("p", "not", not));
    var s = kampSay(ana.kaynaklar), hh = el("div", "hh");
    hh.append(el("span", "hh-b", t("Haberin haberi", "The news about the news")), serit(s), el("span", "hh-say", saySatir(s)));
    var kim = el("a", null, t("Kim nasıl yazdı →", "Who wrote what →")); kim.href = ana.sayfa || "#"; hh.appendChild(kim);
    ic.appendChild(hh);
    // manşetin altında üç olay daha: sütun boş kalmaz, ana hikâyeden sonra en önemliler hemen görünür
    var kalan = ol.filter(function (o) { return o !== ana; });
    var ek = el("ol", "ayrica");
    kalan.slice(0, ana.gorsel ? 2 : 4).forEach(function (o) {
      var li = el("li"), a2 = el("a"); a2.href = o.sayfa || "#";
      var bb = bolgeBul(o.baslik), e = el("span", "etiket", bb ? (EN ? bb[1] : bb[0]) : t("Gündem", "Top story"));
      e.appendChild(el("span", null, o.kaynaklar.length + t(" yayın", " outlets")));
      a2.append(e, el("b", null, temiz(EN ? o.baslik_en || o.baslik : o.baslik)), serit(kampSay(o.kaynaklar)));
      li.appendChild(a2); ek.appendChild(li);
    });
    ic.appendChild(ek); m.appendChild(ic);

    var kap = $("gundem"); kap.textContent = "";
    kalan.slice(ana.gorsel ? 2 : 4, (ana.gorsel ? 2 : 4) + 6).forEach(function (o) {
      var k = kartLink(o.sayfa || "#", "kart"), bb = bolgeBul(o.baslik);
      var e = el("div", "etiket", bb ? (EN ? bb[1] : bb[0]) : t("Gündem", "Top story")); e.appendChild(el("span", null, once(o.son)));
      var s2 = kampSay(o.kaynaklar), alt = el("div", "alt-s");
      var sy = el("div", "kart-sayi"); sy.append(el("b", null, String(o.kaynaklar.length)), el("span", null, t("yayın", "outlets")));
      alt.append(serit(s2), el("span", null, saySatir(s2)));
      k.append(sy, e, el("h3", null, temiz(EN ? o.baslik_en || o.baslik : o.baslik)), alt);
      kap.appendChild(k);
    });
  }

  // ---- son dakika ve akış
  var TUM = [], goster = 30, tamYuklendi = false, sorgu = "", bolgeSec = "";
  function uygun(h) { var k = K[h.kaynak]; return h.ilgili !== false && !(k && k.silahli) && (h.baslik_tr || h.baslik_orj); }
  function sonCiz() {
    var ol = $("son"); ol.textContent = ""; var gor = {};
    TUM.filter(function (h) { return !h.nitelik; }).some(function (h) {
      var b = baslik(h), anahtar = b.slice(0, 40); if (gor[anahtar]) return false; gor[anahtar] = 1;
      var li = el("li"), a = kartLink(h.url), k = K[h.kaynak];
      a.append(el("b", null, (k ? k.ad : h.kaynak_ad || "") + ": "), document.createTextNode(b));
      li.append(el("time", null, saat(h.tarih)), a); ol.appendChild(li);
      return ol.children.length >= 8;
    });
  }
  function suzulmus() {
    var an = $("sAnaliz").checked, tg = $("sTg").checked, oz = $("sOzet").checked;
    return TUM.filter(function (h) {
      if (an && h.nitelik !== "analiz") return false;
      if (tg && h.telegram) return false;
      if (oz && !ozet(h)) return false;
      if (bolgeSec) { var b = bolgeBul(baslik(h) + " " + (h.baslik_orj || "")); if (!b || b[0] !== bolgeSec) return false; }
      if (sorgu) { var k = K[h.kaynak]; if ((baslik(h) + " " + (h.baslik_orj || "") + " " + (k ? k.ad : "")).toLocaleLowerCase("tr").indexOf(sorgu) < 0) return false; }
      return true;
    });
  }
  function akisCiz() {
    var g = suzulmus(), ol = $("akisL"); ol.textContent = "";
    $("akisSay").textContent = g.length + t(" haber", " stories") + (tamYuklendi ? "" : t(" · son saatler", " · recent hours"));
    if (!g.length) { ol.appendChild(el("li", "bos", t("Eşleşen haber yok.", "Nothing matches."))); }
    g.slice(0, goster).forEach(function (h) {
      var li = el("li"), k = K[h.kaynak], ust = el("div", "ust-s");
      ust.append(el("b", null, k ? k.ad : h.kaynak_ad || ""), el("span", null, saat(h.tarih)));
      if (h.nitelik === "analiz") ust.appendChild(el("span", "rozet a", t("Analiz", "Analysis")));
      else if (sonDakikaMi(h.baslik_orj) || sonDakikaMi(h.baslik_tr)) ust.appendChild(el("span", "rozet", t("Son dakika", "Breaking")));
      else if (h.telegram) ust.appendChild(el("span", "rozet", "Telegram"));
      var a = kartLink(h.url, "b"); a.textContent = baslik(h);
      li.append(ust, a);
      var o = ozet(h); if (o && o.slice(0, 50) !== baslik(h).slice(0, 50)) li.appendChild(el("p", null, o));
      ol.appendChild(li);
    });
    $("daha").hidden = g.length <= goster && tamYuklendi;
  }
  $("daha").onclick = function () {
    goster += 30;
    if (suzulmus().length < goster && !tamYuklendi) {
      $("daha").textContent = t("Yükleniyor…", "Loading…");
      al("data/haberler-akis.json").then(function (d) {
        tamYuklendi = true; $("daha").textContent = t("Daha fazla", "Show more");
        if (d && d.haberler) { var var_ = {}; TUM.forEach(function (h) { var_[h.id] = 1; }); TUM = TUM.concat(d.haberler.filter(function (h) { return !var_[h.id] && uygun(h); })); TUM.sort(function (a, b) { return String(b.tarih).localeCompare(String(a.tarih)); }); }
        akisCiz();
      });
    } else akisCiz();
  };
  var bek; $("ara").oninput = function () { clearTimeout(bek); bek = setTimeout(function () { sorgu = $("ara").value.trim().toLocaleLowerCase("tr"); goster = 30; akisCiz(); }, 200); };
  var bs = $("bolge"); bs.appendChild(new Option(t("Bütün bölgeler", "All regions"), ""));
  BOLGE.forEach(function (b) { bs.appendChild(new Option(EN ? b[1] : b[0], b[0])); });
  bs.onchange = function () { bolgeSec = bs.value; goster = 30; akisCiz(); };
  $("dahaSuz").onclick = function () { var e = $("suzEk"); e.hidden = !e.hidden; this.setAttribute("aria-expanded", String(!e.hidden)); };
  ["sAnaliz", "sTg", "sOzet"].forEach(function (id) { $(id).onchange = function () { goster = 30; akisCiz(); }; });

  // ---- arka plan
  function analizCiz(d) {
    var kap = $("analiz"); kap.textContent = "";
    var sinir = Date.now() - 4 * 864e5, gor = {}, L = (d && d.analizler || []).filter(function (a) { return ozet(a) && new Date(a.tarih) > sinir; });
    L.sort(function (a, b) { return (b.dusunce ? 1 : 0) - (a.dusunce ? 1 : 0) || String(b.tarih).localeCompare(String(a.tarih)); });
    L.filter(function (a) { if (gor[a.kaynak]) return false; gor[a.kaynak] = 1; return true; }).slice(0, 3).forEach(function (a) {
      var k = kartLink(a.url, "kart"), ku = el("span", "kurum", a.kurum);
      if (a.dusunce) ku.appendChild(el("em", null, t("düşünce kuruluşu", "think tank")));
      k.append(ku, el("h3", null, baslik(a)), el("p", null, ozet(a)), el("span", "alt-s", once(a.tarih)));
      kap.appendChild(k);
    });
    if (!kap.children.length) kap.appendChild(el("p", "bolum-a", t("Son günlerde özetlenmiş analiz yok.", "No summarized analysis in recent days.")));
  }

  // ---- dosyalar
  function dosyaCiz(d) {
    var kap = $("dosya"); kap.textContent = "";
    var L = (d && d.dosyalar || []).slice().sort(function (a, b) { return String(b.son || "").localeCompare(String(a.son || "")); });
    L.slice(0, 6).forEach(function (x) {
      var li = el("li"), a = el("a"); a.href = "d/" + x.id + ".html";
      var e = el("span", "etiket", EN ? x.bolge_en || x.bolge || "" : x.bolge || ""); e.appendChild(el("span", null, x.son ? once(x.son + "T12:00:00Z") : ""));
      a.append(e, el("b", null, EN ? x.ad_en || x.ad : x.ad));
      var sb = EN ? x.son_be || x.son_b : x.son_b; if (sb) a.appendChild(el("span", "son-h", t("Son: ", "Latest: ") + sb));
      li.appendChild(a); kap.appendChild(li);
    });
  }

  // ---- yükle
  al("kaynaklar.json").then(function (k) {
    (Array.isArray(k) ? k : (k && k.kaynaklar) || []).forEach(function (x) { K[x.id] = x; });
    al("data/gundem.json").then(gundemCiz);
    al("data/haberler-ilk.json").then(function (d) {
      TUM = (d && d.haberler || []).filter(uygun).sort(function (a, b) { return String(b.tarih).localeCompare(String(a.tarih)); });
      if (d && d.guncellendi) $("guncel").textContent = t("Güncellendi · ", "Updated · ") + once(d.guncellendi);
      sonCiz(); akisCiz();
    });
    al("data/dosyalar-site.json").then(dosyaCiz);
    al("data/analizler.json").then(analizCiz);
  });
})();
