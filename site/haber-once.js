/* Telefon ana sayfası: önce haber (manşet, canlı gelişmeler, gündem, bağlam), sonra "haberin haberi" kayan akışı.
   uygulama.js desteCiz() içinden çağrılır: ALBHaberOnce.ciz(r, c) → <section id="haberOnce">.
   Hikâyeler istemcide kümelenen desteden gelir (site/deste.js), böylece Gemini durduğunda da güncel kalır.
   Bir hikâyenin kendi metnimiz varsa (data/yazi/dizin.json) bağlantı o metne, yoksa kaynak derlemesine gider. */
(function () {
  "use strict";
  const H = () => window.ZBSHesap;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const EN = () => window.DIL === "en";
  const tt = (tr, en) => (EN() ? en : tr);
  const BOLGE_ANAHTAR = [
    ["Gazze", "Gaza", /Gazze|Han Yunus|Refah|Cebaliye|Deyr el-Belah|Nuseyrat|Beyt Lahiya|Mevasi|Bureyc|Mağazi|Gaza|Khan Yunis|Rafah|Jabalia/i],
    ["Kudüs", "Jerusalem", /Kudüs|Aksa|Jerusalem/i],
    ["Batı Şeria", "West Bank", /Batı Şeria|Cenin|Nablus|Ramallah|El-Halil|Tulkerim|Tubas|Beytüllahim|Kalkilya|Selfit|Eriha|Silvad|Mugayyir|yerleşimci|West Bank|Jenin|Hebron/i],
    ["Lübnan", "Lebanon", /Lübnan|Hizbullah|Beyrut|Nebatiye|Bekaa|Sur |Lebanon|Hezbollah|Beirut/i],
    ["Yemen", "Yemen", /Yemen|Husi|Ensarullah|Sana|Lahic|Marib|Taiz|Hudeyde|Babülmendep|Houthi/i],
    ["İran", "Iran", /İran|Tahran|Hürmüz|Devrim Muhafızları|Arakçi|Iran|Tehran|Hormuz/i],
    ["Suriye", "Syria", /Suriye|Şam|Halep|Dera|Kuneytra|Humus|Syria|Damascus/i],
    ["Irak", "Iraq", /Irak|Bağdat|Iraq|Baghdad/i],
    ["İsrail", "Israel", /Netanyahu|Eizenkot|Knesset|Tel Aviv|Israel(?!i strike)/i],
  ];
  const SEKMELER = [["", "Gündem", "Top stories"], ["Gazze", "Gazze", "Gaza"], ["Batı Şeria", "Batı Şeria", "West Bank"], ["Kudüs", "Kudüs", "Jerusalem"],
    ["Lübnan", "Lübnan", "Lebanon"], ["Yemen", "Yemen", "Yemen"], ["İran", "İran", "Iran"], ["Suriye", "Suriye", "Syria"]];
  let dizin = null;
  fetch("data/yazi/dizin.json?t=" + Math.floor(Date.now() / 3e5)).then((r) => (r.ok ? r.json() : {})).then((d) => { dizin = d || {}; }).catch(() => { dizin = {}; });

  function bolgeBul(b, c) {
    const yer = b.olay && b.olay.yer_ad;
    const metin = (yer || "") + " " + b.haberler.slice(0, 6).map((h) => c.baslikSec(h) + " " + (h.baslik_tr || "")).join(" ");
    const v = BOLGE_ANAHTAR.find((x) => x[2].test(metin));
    return v ? { anahtar: v[0], ad: EN() ? v[1] : v[0] } : (yer ? { anahtar: "", ad: yer } : null);
  }
  function kampSay(b, c) {
    const say = {};
    new Set(b.haberler.map((h) => h.kaynak)).forEach((kid) => { const k = c.kaynaklar[kid]; if (k) { const a = H().kampAd(k); say[a] = (say[a] || 0) + 1; } });
    return say;
  }
  function kampAd(a) { return EN() ? ({ "Filistin": "Palestine", "Arap dünyası": "Arab world", "İran": "Iran", "Türkiye": "Türkiye", "İsrail": "Israel", "Batı": "West", "Yemen": "Yemen", "Diğer": "Other", "İsrail’de muhalif basın": "Israeli dissident press" }[a] || a) : a; }
  function serit(say) {
    const s = el("div", "hb-serit"); s.setAttribute("aria-hidden", "true");
    Object.keys(say).sort((a, b) => say[b] - say[a]).forEach((a) => { const i = el("i"); i.style.flex = say[a]; i.style.background = H().KAMP_RENK[a] || "#6b746f"; s.appendChild(i); });
    return s;
  }
  function baglanti(b) {
    const ids = [...new Set(b.haberler.map((h) => h.id))].slice(0, 40);
    const o = (dizin && ids.map((i) => dizin[i]).find(Boolean)) || (b.olay && b.olay.id);
    return "haber.html?" + (o ? "o=" + encodeURIComponent(o) + "&" : "") + "h=" + ids.join(",");
  }
  function baslik(b, c) {
    if (b.olay) return c.OB(b.olay);
    const t = b.haberler.find((h) => c.BT(h)); return c.baslikSec(t || b.haberler[0]);
  }
  function spot(b, c) {
    const xs = b.haberler.filter((h) => (EN() ? h.ozet_en : h.ozet_tr));
    const kamp = (h) => H().kampAd(c.kaynaklar[h.kaynak] || {});
    xs.sort((a, z) => (["Filistin", "Arap dünyası"].includes(kamp(z)) - ["Filistin", "Arap dünyası"].includes(kamp(a))));
    const t = xs[0] && (EN() ? xs[0].ozet_en : xs[0].ozet_tr);
    return t ? t.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ") : "";
  }
  // yayın adı + bayrak (İsrail, BAE, Suudi Arabistan…)
  function adB(k, son) {
    const b = el("b", null, ((k || {}).ad || "") + (son || "")); const f = k && H().bayrak ? H().bayrak(k) : ""; if (f) b.insertAdjacentHTML("afterbegin", f); return b;
  }
  // hikâyenin kendi metnimiz varsa spotu (data/yazi/<no>.json); yoksa geri çağrılmaz
  const yaziOnbellek = {};
  function yaziSpot(b, f) {
    const o = dizin && [...new Set(b.haberler.map((h) => h.id))].map((i) => dizin[i]).find(Boolean);
    if (!o || EN()) return;
    (yaziOnbellek[o] = yaziOnbellek[o] || fetch("data/yazi/" + encodeURIComponent(o) + ".json").then((r) => (r.ok ? r.json() : null)).catch(() => null))
      .then((y) => { if (y && y.spot) f(y.spot); });
  }
  function onizleme(b, c) {
    return b.haberler.find((h) => h.gorsel && h.gorsel_ok === true && !(c.kaynaklar[h.kaynak] || {}).gorsel_yok);
  }

  function ciz(r, c) {
    const kok = el("section", "hb"); kok.id = "haberOnce"; kok.setAttribute("aria-label", tt("Haberler", "News"));
    const hik = r.deste.filter((x) => x.tur === "hikaye" && x.yayinSayisi >= 2);
    // manşet: ilk 10 hikâyeden en çok yayının yazdığı, Filistin'deki olaylar öne
    const puan = (b) => b.yayinSayisi + (["Gazze", "Batı Şeria", "Kudüs"].includes((bolgeBul(b, c) || {}).anahtar) ? 4 : 0);
    const manset = hik.slice(0, 10).sort((a, b) => puan(b) - puan(a))[0];
    const digerleri = hik.filter((b) => b !== manset);

    // üst çubuk
    const ust = el("header", "hb-ust");
    const mb = el("button", "hb-dugme"); mb.type = "button"; mb.setAttribute("aria-label", tt("Menü", "Menu")); mb.setAttribute("aria-haspopup", "dialog");
    mb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    const marka = el("a", "hb-marka"); marka.href = "./"; const lg = document.createElement("img"); lg.src = "site/logo.svg"; lg.alt = ""; lg.width = 28; lg.height = 28;
    marka.append(lg, el("span", null, (window.MARKA && window.MARKA.ad) || "Alboroto"));
    const dil = el("a", "hb-dil", EN() ? "TR" : "EN"); dil.href = "?lang=" + (EN() ? "tr" : "en"); dil.lang = EN() ? "tr" : "en";
    dil.onclick = () => { try { localStorage.setItem("zbs-dil", EN() ? "tr" : "en"); } catch (e) { /* özel pencere */ } };
    const ara = el("button", "hb-dugme"); ara.type = "button"; ara.setAttribute("aria-label", tt("Ara", "Search"));
    ara.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
    ara.onclick = () => { const s = document.getElementById("suzgecAc"); if (s) s.click(); };
    ust.append(mb, marka, el("span", "hb-bosluk"), dil, ara);
    kok.appendChild(ust);

    // bölge sekmeleri (gündem listesini süzer)
    const nav = el("nav", "hb-bolgeler"); nav.setAttribute("aria-label", tt("Bölgeler", "Regions"));
    kok.appendChild(nav);

    // son dakika: son 90 dakikada bölge ajanslarının "Son dakika" başlığı
    const simdi = Date.now();
    const sd = c.gor.filter((h) => simdi - Date.parse(h.tarih) < 90 * 6e4 && /^son dakika\s*[|:]/i.test(h.baslik_tr || "")
      && ["Filistin", "Arap dünyası"].includes(H().kampAd(c.kaynaklar[h.kaynak] || {})))
      .sort((a, b) => Date.parse(b.tarih) - Date.parse(a.tarih))[0];
    if (sd && !EN()) {
      const a = el("a", "hb-sd"); a.href = sd.url; a.target = "_blank"; a.rel = "noopener";
      a.append(el("b", null, "SON DAKİKA"), el("span", null, sd.baslik_tr.replace(/^son dakika\s*[|:]\s*/i, "") + " · " + ((c.kaynaklar[sd.kaynak] || {}).ad || "")));
      kok.appendChild(a);
    }

    // manşet
    if (manset) {
      const art = el("article", "hb-manset");
      const og = manset.olay && manset.olay.gorsel ? manset.olay : null;   // açık lisanslı gündem görseli (tam boy)
      const bl = bolgeBul(manset, c);
      if (og) {
        const f = el("figure", "hb-gorsel"); const im = document.createElement("img"); im.src = c.AK(og.gorsel, 900); im.alt = ""; im.referrerPolicy = "no-referrer";
        if (og.odak) im.style.objectPosition = og.odak; im.onerror = () => f.remove(); f.appendChild(im);
        if (bl) f.appendChild(el("span", "hb-yer", bl.ad.toLocaleUpperCase(EN() ? "en" : "tr")));
        if (og.gorsel_atif) f.appendChild(el("figcaption", null, og.gorsel_atif));
        art.appendChild(f);
      }
      const ic = el("div", "hb-ic");
      const a = el("a"); a.href = baglanti(manset);
      if (!og && bl) a.appendChild(el("span", "hb-ust-et", bl.ad)).style.display = "block";
      a.appendChild(el("h2", "hb-mb", baslik(manset, c)));
      const s = spot(manset, c); if (s) a.appendChild(el("p", "hb-spot", s));
      const vy = dizin && manset.haberler.some((h) => dizin[h.id]);
      a.appendChild(el("p", "hb-meta", "Alboroto · " + manset.yayinSayisi + tt(" yayından", " outlets") + (vy ? tt(" · haber metni", " · full story") : tt(" · kaynakların anlatımı", " · as reported"))));
      ic.appendChild(a);
      const hh = el("a", "hb-hh"); hh.href = "#";
      hh.onclick = (e) => { e.preventDefault(); c.hikayeyeGit(manset); };
      const say = kampSay(manset, c);
      hh.append(el("span", "hb-et", tt("Haberin haberi", "The news about the news")), serit(say));
      const yok = !say["İsrail"] && !say["Batı"];
      hh.appendChild(el("span", "hb-hh-m", Object.keys(say).sort((x, y) => say[y] - say[x]).map((k) => kampAd(k) + " " + say[k]).join(" · ") +
        (yok ? tt(" · İzlediğimiz İsrail ve Batı yayınlarında yok", " · Not in the Israeli and Western outlets we read") : "")));
      hh.appendChild(el("span", "hb-hh-a", tt("Kim nasıl yazdı →", "Who wrote what →")));
      ic.appendChild(hh);
      // canlı gelişmeler: manşet hikâyesinin en yeni haberleri
      const canli = manset.haberler.slice().sort((x, y) => Date.parse(y.tarih) - Date.parse(x.tarih)).slice(0, 4);
      if (canli.length >= 2) {
        const cs = el("section", "hb-canli"); cs.setAttribute("aria-label", tt("Gelişmeler", "Latest"));
        cs.appendChild(el("h2", null, tt("GELİŞMELER", "LATEST")));
        canli.forEach((h) => {
          const l = el("a"); l.href = h.url; l.target = "_blank"; l.rel = "noopener";
          const t = el("time", null, new Date(h.tarih).toLocaleTimeString(EN() ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" })); t.dateTime = h.tarih;
          const sp = el("span"); sp.appendChild(adB(c.kaynaklar[h.kaynak], ": ")); sp.appendChild(document.createTextNode(c.baslikSec(h)));
          l.append(t, sp); cs.appendChild(l);
        });
        const tum = el("a", null, tt("Haberin tamamı →", "Full story →")); tum.href = baglanti(manset); tum.style.cssText = "display:block;padding:10px 0;font-size:.82rem;font-weight:700;color:#1f6e4b";
        cs.appendChild(tum);
        ic.appendChild(cs);
      }
      art.appendChild(ic);
      kok.appendChild(art);
    }

    // gündem listesi
    const gb = el("section", "hb-bolum"); gb.setAttribute("aria-label", tt("Gündem", "Top stories"));
    const gbBas = el("h2", null, tt("GÜNDEM", "TOP STORIES")); gb.appendChild(gbBas);
    const liste = el("div"); gb.appendChild(liste);
    let secili = "";
    const listeCiz = () => {
      liste.textContent = "";
      const xs = digerleri.filter((b) => !secili || (bolgeBul(b, c) || {}).anahtar === secili).slice(0, secili ? 20 : 15);
      if (!xs.length) { liste.appendChild(el("p", "hb-ic hb-oge-s", tt("Bu bölgeden şu an birden çok yayının yazdığı hikâye yok.", "No multi-outlet stories from this region right now."))); return; }
      xs.forEach((b) => {
        const a = el("a", "hb-oge"); a.href = baglanti(b);
        const m = el("span", "hb-oge-m");
        const bl = bolgeBul(b, c); if (bl) m.appendChild(el("span", "hb-ust-et", bl.ad));
        m.appendChild(el("span", "hb-oge-b", baslik(b, c)));
        const sp = spot(b, c); const spEl = el("span", "hb-oge-spot", sp); if (!sp) spEl.hidden = true; m.appendChild(spEl);
        yaziSpot(b, (t) => { spEl.textContent = t; spEl.hidden = false; });
        const say = kampSay(b, c);
        m.appendChild(el("span", "hb-oge-s", b.yayinSayisi + tt(" yayın · ", " outlets · ") + Object.keys(say).sort((x, y) => say[y] - say[x]).slice(0, 2).map((k) => kampAd(k) + " " + say[k]).join(" · ")));
        a.appendChild(m);
        const g = onizleme(b, c);
        if (g) { const k = el("span", "hb-kucuk"); const im = document.createElement("img"); im.src = c.AK(g.gorsel, 220); im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer"; im.onerror = () => { k.remove(); a.classList.add("gorselsiz"); }; k.appendChild(im); a.appendChild(k); }
        else a.classList.add("gorselsiz");
        liste.appendChild(a);
      });
    };
    SEKMELER.forEach(([k, tr, en]) => {
      if (k && !digerleri.some((b) => (bolgeBul(b, c) || {}).anahtar === k)) return;
      const bt = el("button", null, EN() ? en : tr); bt.type = "button"; bt.setAttribute("aria-pressed", String(k === secili));
      bt.onclick = () => { secili = k; nav.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === bt))); gbBas.textContent = k ? (EN() ? en : tr).toLocaleUpperCase(EN() ? "en" : "tr") : tt("GÜNDEM", "TOP STORIES"); listeCiz(); gb.scrollIntoView({ block: "start" }); };
      nav.appendChild(bt);
    });
    listeCiz();
    kok.appendChild(gb);

    // son haberler: bölge basınının en yeni Türkçe başlıkları ve özetleri (gündem hikâyelerinde olmayanlar)
    const gundemde = new Set(hik.slice(0, 16).flatMap((b) => b.haberler.map((h) => h.id)));
    const BOLGE = ["Filistin", "Arap dünyası", "Yemen", "İran", "Türkiye"];
    const goruldu = new Set(), yayinSay = {};
    const son = c.gor.filter((h) => !gundemde.has(h.id) && (EN() ? h.baslik_en : h.baslik_tr) && BOLGE.includes(H().kampAd(c.kaynaklar[h.kaynak] || {})))
      .sort((a, b) => Date.parse(b.tarih) - Date.parse(a.tarih))
      .filter((h) => BOLGE_ANAHTAR.some((x) => x[2].test(EN() ? h.baslik_en : h.baslik_tr)) || /Filistin|Palestin/i.test(EN() ? h.baslik_en : h.baslik_tr))
      .filter((h) => { const a = (EN() ? h.baslik_en : h.baslik_tr).toLocaleLowerCase("tr").slice(0, 60); if (goruldu.has(a)) return false; goruldu.add(a); return true; })
      .filter((h) => { yayinSay[h.kaynak] = (yayinSay[h.kaynak] || 0) + 1; return yayinSay[h.kaynak] <= 2; })
      .slice(0, 12);
    if (son.length) {
      const sb = el("section", "hb-bolum hb-son"); sb.setAttribute("aria-label", tt("Son haberler", "Latest news"));
      sb.appendChild(el("h2", null, tt("SON HABERLER", "LATEST NEWS")));
      son.forEach((h) => {
        const k = c.kaynaklar[h.kaynak] || {};
        const a = el("a", "hb-oge gorselsiz"); a.href = "haber.html?h=" + encodeURIComponent(h.id);
        const m = el("span", "hb-oge-m");
        const u = el("span", "hb-ust-et"); u.appendChild(adB(k)); u.appendChild(document.createTextNode(" · " + new Date(h.tarih).toLocaleTimeString(EN() ? "en-GB" : "tr-TR", { hour: "2-digit", minute: "2-digit" })));
        m.appendChild(u);
        m.appendChild(el("span", "hb-oge-b", EN() ? h.baslik_en : h.baslik_tr.replace(/^son dakika\s*[|:]\s*/i, "")));
        const oz = EN() ? h.ozet_en : h.ozet_tr;
        if (oz) m.appendChild(el("span", "hb-oge-spot", oz.split(/(?<=[.!?])\s+/).slice(0, 2).join(" ")));
        a.appendChild(m); sb.appendChild(a);
      });
      kok.appendChild(sb);
    }

    // bağlam ve ölçüm
    const bg = el("section", "hb-baglam hb-ic"); bg.setAttribute("aria-label", tt("Bağlam ve ölçüm", "Context and measurement"));
    bg.appendChild(el("h2", null, tt("BAĞLAM VE ÖLÇÜM", "CONTEXT AND MEASUREMENT")));
    const olcumKutu = el("a", "hb-kutu"); olcumKutu.href = "yontem.html"; olcumKutu.hidden = true; bg.appendChild(olcumKutu);
    c.olcum((f) => {
      if (!f) return;
      olcumKutu.textContent = "";
      const o = el("span", "hb-olcum"); o.append(el("b", null, f[0]), el("span", null, f[1]));
      olcumKutu.append(el("span", "hb-ust-et", tt("Günün ölçümü", "Measure of the day")), o);
      olcumKutu.hidden = false;
    });
    [["tarihce.html", tt("Tarihçe", "History"), tt("Nekbe'den bugüne dönüm noktaları", "Turning points from the Nakba to today")],
      ["kimin.html", tt("Rapor", "Report"), tt("Kimin ölümü haber oldu?", "Whose death made the news?")],
      ["almanak.html", tt("Almanak", "Almanac"), tt("Haftanın sessizlikleri ve ölçümleri", "The week’s silences and measures")]].forEach(([h, e, t]) => {
      const a = el("a", "hb-kutu"); a.href = h; a.append(el("span", "hb-ust-et", e), el("span", "hb-kutu-b", t)); bg.appendChild(a);
    });
    kok.appendChild(bg);

    // akışa geçiş
    const gc = el("section", "hb-gecis"); gc.setAttribute("aria-label", tt("Haberin haberi", "The news about the news"));
    gc.append(el("span", "hb-et", tt("Haberin haberi", "The news about the news")), el("h2", null, tt("Aynı haberi kim nasıl verdi?", "Who told the same story, and how?")),
      el("p", null, tt("Buradan sonrası kayan akış: her hikâyede yayınların başlıkları yan yana; yana kaydırınca karşılaştırma ve olay örgüsü.",
        "From here on, a swipe feed: outlets’ headlines side by side for each story; swipe sideways for comparison and timeline.")));
    const kb = el("button", null, tt("Kaydırmaya başla ↓", "Start swiping ↓")); kb.type = "button"; kb.onclick = () => c.akisaGec();
    gc.appendChild(kb);
    kok.appendChild(gc);

    // menü
    menuKur(mb, c, (k) => { const bt = [...nav.querySelectorAll("button")].find((x) => x.textContent === (SEKMELER.find((s) => s[0] === k) || [])[EN() ? 2 : 1]); if (bt) bt.click(); });
    return kok;
  }

  function menuKur(dugme, c, bolgeSec) {
    let m = document.getElementById("hbMenu");
    if (m) m.remove();
    m = el("div", "hb hb-menu"); m.id = "hbMenu"; m.hidden = true; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", tt("Menü", "Menu"));
    const ust = el("header", "hb-ust");
    const kapat = el("button", "hb-dugme"); kapat.type = "button"; kapat.setAttribute("aria-label", tt("Menüyü kapat", "Close menu"));
    kapat.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    const ds = el("span", "hb-dilsec");
    [["tr", "TR"], ["en", "EN"]].forEach(([k, t]) => { const a = el("a", null, t); a.href = "?lang=" + k; a.lang = k; if ((EN() ? "en" : "tr") === k) a.setAttribute("aria-current", "true"); a.onclick = () => { try { localStorage.setItem("zbs-dil", k); } catch (e) { /* özel pencere */ } }; ds.appendChild(a); });
    ust.append(kapat, el("span", "hb-marka", (window.MARKA && window.MARKA.ad) || "Alboroto"), el("span", "hb-bosluk"), ds);
    m.appendChild(ust);
    const nav = el("nav");
    const kapa = () => { m.hidden = true; document.documentElement.style.overflow = ""; dugme.focus(); };
    nav.appendChild(el("span", null, tt("HABERLER", "NEWS")));
    SEKMELER.forEach(([k, tr, en]) => { const b = el("button", null, EN() ? en : tr); b.type = "button"; b.onclick = () => { kapa(); bolgeSec(k); }; nav.appendChild(b); });
    nav.appendChild(el("span", null, tt("HABERİN HABERİ", "THE NEWS ABOUT THE NEWS")));
    const ak = el("button", "hb-m2", tt("Akış: kim nasıl verdi", "Feed: who told it how")); ak.type = "button"; ak.onclick = () => { kapa(); c.akisaGec(); }; nav.appendChild(ak);
    [["raporlar.html", tt("Raporlar", "Reports")], ["almanak.html", tt("Almanak", "Almanac")], ["kaynaklar.html", tt("Hesaplar ve kaynaklar", "Accounts and sources")], ["tarihce.html", tt("Tarihçe", "History")]]
      .forEach(([h, t]) => { const a = el("a", "hb-m2", t); a.href = h; nav.appendChild(a); });
    const alt = el("div", "hb-alt");
    [["yontem.html", tt("Yöntem", "Method")], ["hakkimizda.html", tt("Hakkımızda", "About")], ["duzeltmeler.html", tt("Düzeltmeler", "Corrections")], ["hakkimizda.html#iletisim", tt("İletişim", "Contact")]]
      .forEach(([h, t]) => { const a = el("a", null, t); a.href = h; alt.appendChild(a); });
    nav.appendChild(alt);
    m.appendChild(nav);
    kapat.onclick = kapa;
    m.addEventListener("keydown", (e) => { if (e.key === "Escape") kapa(); });
    dugme.onclick = () => { m.hidden = false; document.documentElement.style.overflow = "hidden"; kapat.focus(); };
    document.body.appendChild(m);
  }

  // haber bölümündeyken kayan akışın kilidi (scroll-snap) ve üst katmanı kapalı
  let bagli = false;
  function izle() {
    if (bagli) return; bagli = true;
    let bekliyor = false;
    const bak = () => {
      bekliyor = false;
      const ho = document.getElementById("haberOnce");
      const ic = !!ho && ho.isConnected && window.scrollY < ho.offsetTop + ho.offsetHeight - 8;
      document.documentElement.classList.toggle("haber-modu", ic);
    };
    window.addEventListener("scroll", () => { if (!bekliyor) { bekliyor = true; requestAnimationFrame(bak); } }, { passive: true });
    window.addEventListener("resize", bak, { passive: true });
    bak();
    window.ALBHaberOnce.bak = bak;
  }
  window.ALBHaberOnce = { ciz, izle, bak: () => {} };
})();
