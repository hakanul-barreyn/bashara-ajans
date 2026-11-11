// almanak.html: ZBS Almanak, sürekli yeni bölüm eklenen çevrimiçi kitap.
// Kitabın yapısı data/bulten/dizin.json'dan kurulur: her yıl bir cilt; ciltte önce yıl bülteni, sonra ay ay
// aylık bülten ve o ayın haftaları. Bütün bültenler okuma sırasıyla numaralanır (Bölüm 1, 2, ...).
// Yeni hafta geldikçe kitabın sonuna yeni bir bölüm eklenir. Ön sayfalar: kapak, bu kitap, içindekiler, sessizlik endeksi.
// Olay ve sessizlik verisi data/bulten/alisma.json'dan (geriye dönük taramanın özeti).
(function () {
  "use strict";
  const EN = window.DIL === "en", YEREL = window.YEREL || (EN ? "en-GB" : "tr-TR");
  const T = (tr, en) => (EN ? en : tr);
  const $ = (i) => document.getElementById(i);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const SVGNS = "http://www.w3.org/2000/svg";
  const sv = (t, at) => { const e = document.createElementNS(SVGNS, t); for (const k in at) e.setAttribute(k, at[k]); return e; };
  const sayi = (n, d) => Number(n).toLocaleString(YEREL, { maximumFractionDigits: d == null ? 1 : d });
  const ROMA = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  const KR = { "Filistin": "#2b8a5e", "Arap dünyası": "#6fae92", "İran ve Yemen": "#c39a35", "Türkiye": "#c9544e", "İsrail": "#4a72c4", "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#8d969e", "Diğer": "#6b746f",
    "Antiemperyalist / dekolonyal": "#2b8a5e", "Ara / ana akım": "#8d969e", "İşbirlikçi kompradorlar ve emperyalistler": "#c9544e" };
  const BK = { filistin: T("Filistin bakışı", "Palestinian perspective"), aktarim: T("Aktarım", "Relay"), israil: T("İsrail / ABD bakışı", "Israeli / US perspective") };
  const BR = { filistin: "#2b8a5e", aktarim: "#8f979c", israil: "#4a72c4" };
  // gruplar (raporlarla aynı renkler)
  const GR = [["bolge", T("Bölge basını", "Regional press"), "#1f7a52"], ["turkiye", T("Türkiye basını", "Turkish press"), "#7a3fa0"],
    ["israil", T("İsrail basını", "Israeli press"), "#2f5bb7"], ["bati_ana", T("Batı ana akım", "Western mainstream"), "#8a6d3b"],
    ["bati_muhalif", T("Batı’da muhalif", "Western dissenting"), "#c9544e"]];
  const GRK = Object.fromEntries(GR.map((g) => [g[0], g]));
  const TUR_AD = { haftalik: T("Haftalık bölüm", "Weekly chapter"), aylik: T("Aylık bölüm", "Monthly chapter"), yillik: T("Yıl bölümü", "Year chapter") };
  const RAPORLAR = [
    ["isimler.html", T("Anma", "Memorial"), T("İsimleri vardı", "They had names"), T("Gazze’de hayatını kaybeden ve kimliği belirlenen her insanın adı, sıfır yaşından başlayarak.", "The name of every identified person killed in Gaza, starting from age zero.")],
    ["rapor.html", T("Özel rapor", "Special report"), T("7 Ekim’den bu yana: aynı savaş, üç ayrı dil", "Since 7 October: one war, three languages"), T("Bir milyondan fazla başlığın sayımıyla: kim işgal dedi, kim çatışma dedi, Gazze’yi kim ne zaman unuttu.", "Counting more than a million headlines: who said occupation, who said conflict, who forgot Gaza and when.")],
    ["kimin.html", T("Özel rapor", "Special report"), T("Kimin ölümü haber oldu?", "Whose death made the news?"), T("Batı basınında bir İsraillinin ölümü kaç Filistinlinin ölümüne denk geldi; ateşkesten sonra susan haber.", "In the Western press, how many Palestinian deaths one Israeli death was worth; the news that fell silent after the ceasefire.")],
    ["olaylar.html", T("Özel rapor", "Special report"), T("Alışma: aynı olay tekrarlandıkça", "Habituation: when the same thing keeps happening"), T("Hastaneler, çadırlar, yardım bekleyenler, çocuklar: hangi olay ne zaman tetiklemeyi bıraktı?", "Hospitals, tents, people waiting for aid, children: which kind of event stopped triggering a response, and when?")],
    ["liderler.html", T("Özel rapor", "Special report"), T("Liderler ne dedi?", "What did leaders say?"), T("Erdoğan’dan Biden’a, Körfez’den Pekin’e: kim ne zaman konuştu, kimi suçladı, onları ne tetikledi.", "From Erdoğan to Biden, from the Gulf to Beijing: who spoke when, whom they blamed, what triggered them.")]
  ];

  let dizin = [], SIRA = [], CILT = [], ALISMA = null, KARNE = null, KOD = {}, TUR_ADLARI = {};
  const masa = $("masa"), yan = $("kitapYan");

  // ---------------------------------------------------------------- adlar ve tarihler
  const tarih = (g, o) => new Date(g + "T12:00:00Z").toLocaleDateString(YEREL, o || { day: "numeric", month: "long", year: "numeric" });
  function aralik(b, s) { // "9–15 Kasım 2026"
    const B = new Date(b + "T12:00:00Z"), S = new Date(s + "T12:00:00Z");
    if (B.getUTCMonth() === S.getUTCMonth()) return B.getUTCDate() + "–" + tarih(s);
    return tarih(b, { day: "numeric", month: "long" }) + " – " + tarih(s);
  }
  const gunEkle = (g, n) => new Date(Date.parse(g + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10);
  function ad(x) {
    if (x.tur === "yillik") return x.anahtar;
    if (x.tur === "aylik") { const a = tarih(x.bas, { month: "long", year: "numeric" }); return a.charAt(0).toLocaleUpperCase(YEREL) + a.slice(1); }
    const n = +(x.anahtar.split("W")[1] || 0);
    return (EN ? "Week " + n : n + ". hafta") + " · " + aralik(x.bas, gunEkle(x.bas, 6));
  }
  const kisaAd = (x) => (x.tur === "haftalik" ? ad(x).split(" · ")[1] : ad(x));
  const baslik = (x) => x.baslik || ad(x);
  const hashOf = (x) => "#" + x.tur + "-" + x.anahtar;

  // ---------------------------------------------------------------- kitabı kur
  function kur(d) {
    const yil = {};
    d.forEach((x) => {
      const y = x.bas.slice(0, 4), m = x.bas.slice(0, 7);
      const Y = yil[y] || (yil[y] = { yillik: null, aylar: {} });
      if (x.tur === "yillik") { Y.yillik = x; return; }
      const M = Y.aylar[m] || (Y.aylar[m] = { aylik: null, haftalar: [] });
      if (x.tur === "aylik") M.aylik = x; else M.haftalar.push(x);
    });
    SIRA = []; CILT = [];
    Object.keys(yil).sort().forEach((y, ci) => {
      const Y = yil[y], c = { yil: y, roma: ROMA[ci] || String(ci + 1), yillik: Y.yillik, aylar: [] };
      if (Y.yillik) SIRA.push(Y.yillik);
      Object.keys(Y.aylar).sort().forEach((m) => {
        const M = Y.aylar[m];
        M.haftalar.sort((a, b) => (a.bas < b.bas ? -1 : 1));
        if (M.aylik) SIRA.push(M.aylik);
        M.haftalar.forEach((h) => SIRA.push(h));
        c.aylar.push({ ay: m, aylik: M.aylik, haftalar: M.haftalar });
      });
      c.ilk = SIRA.length; CILT.push(c);
    });
    SIRA.forEach((x, i) => { x.no = i + 1; x.ay = x.bas.slice(0, 7); });
    CILT.forEach((c) => { [c.yillik, ...c.aylar.flatMap((a) => [a.aylik, ...a.haftalar])].filter(Boolean).forEach((x) => { x.cilt = c; }); });
  }

  // ---------------------------------------------------------------- içindekiler (yan)
  function yanCiz(aktif) {
    yan.innerHTML = "";
    const b = el("a", "ky-baslik"); b.href = "#kapak"; b.append(el("b", null, "ZBS Almanak"), el("small", null, T("Sürekli yazılan kitap · ", "A book that keeps being written · ") + SIRA.length + T(" bölüm", " chapters")));
    yan.appendChild(b);
    const arac = el("div", "ky-arac");
    const son = SIRA[SIRA.length - 1];
    if (son) { const a = el("a", null, T("Son bölüm →", "Latest chapter →")); a.href = hashOf(son); arac.appendChild(a); }
    yan.appendChild(arac);
    const on = el("div", "ky-grup"); on.appendChild(el("h3", null, T("Ön sayfalar", "Front matter")));
    [["#kapak", "", T("Kapak", "Cover")], ["#bu-kitap", "", T("Bu kitap ve özel raporlar", "About this book, special reports")], ["#icindekiler", "", T("İçindekiler", "Contents")], ["#sessizlik", "", T("Sessizlik endeksi", "The silence index")]].forEach(([h, n, a]) => {
      const s = el("a", "ky-satir"); s.href = h; s.append(el("span", "no", n), el("span", "ad", a), el("span", "ek")); if (aktif === h) s.setAttribute("aria-current", "page"); on.appendChild(s);
    });
    yan.appendChild(on);
    CILT.slice().reverse().forEach((c) => {
      const d = el("details", "ky-cilt"); const sm = el("summary"); sm.append(T("Cilt ", "Volume ") + c.roma + " · " + c.yil, el("small", null, "")); d.appendChild(sm);
      const ic = el("div", "ky-grup");
      const satir = (x, sinif, metin) => {
        const s = el("a", "ky-satir " + sinif); s.href = hashOf(x);
        s.append(el("span", "no", String(x.no)), el("span", "ad", metin), el("span", "ek" + (x.taslak ? " taslak" : ""), x.taslak ? T("taslak", "draft") : ""));
        if (hashOf(x) === aktif) { s.setAttribute("aria-current", "page"); d.open = true; }
        ic.appendChild(s);
      };
      if (c.yillik) satir(c.yillik, "yil", T(c.yil + " yılı", "The year " + c.yil));
      c.aylar.forEach((a) => {
        if (a.aylik) satir(a.aylik, "ay", ad(a.aylik));
        else ic.appendChild(el("div", "ky-satir ay", tarih(a.ay + "-15", { month: "long", year: "numeric" })));
        a.haftalar.forEach((h) => satir(h, "hafta", kisaAd(h)));
      });
      d.appendChild(ic); yan.appendChild(d);
    });
    if (!yan.querySelector("details[open]") && yan.querySelector("details")) yan.querySelector("details").open = true;
    const cur = yan.querySelector('[aria-current="page"]'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  }
  const kyAc = $("kyAc");
  kyAc.textContent = T("☰ İçindekiler", "☰ Contents");
  kyAc.onclick = () => { const a = yan.classList.toggle("acik"); kyAc.setAttribute("aria-expanded", a); };
  yan.addEventListener("click", (e) => { if (e.target.closest("a")) { yan.classList.remove("acik"); kyAc.setAttribute("aria-expanded", "false"); } });

  // ---------------------------------------------------------------- sayfa iskeleti
  function sayfa(sinif, sol, sag, no) {
    const s = el("article", "sayfa-k" + (sinif ? " " + sinif : ""));
    if (sol != null) { const k = el("div", "kunye-ust"); k.append(el("span", null, sol), el("span", null, sag || "")); s.appendChild(k); }
    if (no != null) s.appendChild(el("div", "sayfa-no", "— " + no + " —"));
    return s;
  }
  function kisim(baslikMetni) { const k = el("section", "kisim"); k.appendChild(el("h2", null, baslikMetni)); return k; }

  // ---------------------------------------------------------------- ipucu (grafik noktaları)
  const ip = $("ipucu");
  function ipucu(hedef, html) {
    hedef.addEventListener("mouseenter", (e) => { ip.innerHTML = ""; html().forEach((n) => ip.appendChild(n)); ip.hidden = false; konum(e); });
    hedef.addEventListener("mousemove", konum);
    hedef.addEventListener("mouseleave", () => { ip.hidden = true; });
  }
  function konum(e) { const w = ip.offsetWidth || 240; ip.style.left = Math.min(innerWidth - w - 12, e.clientX + 14) + "px"; ip.style.top = (e.clientY + 16) + "px"; }

  // ---------------------------------------------------------------- sessizlik verisi
  const TUR_EN = { hastane: "Attacks on hospitals", cadir: "Tents hit", yardim: "Fire on people waiting for aid", keskin: "Sniper fire", bas: "Shot in the head", cocuk: "Children killed", su: "People seeking water shot", guvenli: "Attacks on “safe zones”", okul: "Attacks on schools and shelters", ibadet: "Attacks on mosques and churches", aksa: "Raids on Al-Aqsa", saglik: "Health workers killed", yardimci: "Aid workers killed", iskence: "Torture and rape in prisons", asagilama: "Humiliation", aclik: "Starvation deaths", kitlik: "Famine and hunger", mezar: "Mass graves", bayrak: "Fire on people carrying white flags", katliam: "Attacks called “massacres”", cocuk_keskin: "Children shot by snipers", cocuk_bas: "Children shot in the head", cocuk_su: "Children carrying water shot", yardim_asagilama: "Humiliation for food" };
  const turAd = (t) => (EN ? TUR_EN[t] : TUR_ADLARI[t]) || TUR_ADLARI[t] || t;
  function olaylarArasi(b, s) { return ((ALISMA && ALISMA.olaylar) || []).filter((o) => o.bas >= b && o.bas < s && o.sessiz); }
  function oran(o, g) { const x = o.sessiz && o.sessiz[g]; return x && x[1] >= 3 ? 100 * x[0] / x[1] : null; }
  function topluOran(olaylar, g) { let a = 0, b = 0; olaylar.forEach((o) => { const x = o.sessiz && o.sessiz[g]; if (x) { a += x[0]; b += x[1]; } }); return b >= 5 ? Math.round(100 * a / b) : null; }

  // olay olay nokta bulutu: her nokta bir yayın; dolu = yazdı, boş = o günlerde yayındaydı ama tek başlık atmadı
  function noktaBulutu(olaylar, enCok) {
    const k = el("div", "olay-nokta");
    const lj = el("div", "sk-lejant");
    const a = el("span"); const i1 = el("i", "nokta"); i1.style.background = "#1f2421"; a.append(i1, T("yazdı", "covered it")); lj.appendChild(a);
    const b = el("span"); const i2 = el("i", "sus"); b.append(i2, T("o günlerde yayındaydı, yazmadı", "was publishing, did not cover it")); lj.appendChild(b);
    k.appendChild(lj);
    olaylar.slice(0, enCok || 40).forEach((o) => {
      const r = el("div", "on-satir");
      const sol = el("div", "on-olay"); sol.append(el("small", null, tarih(o.bas, { day: "numeric", month: "short", year: "numeric" })), el("b", null, turAd(o.tur)));
      if ((o.yer || []).length) sol.appendChild(el("span", null, o.yer.join(", ")));
      r.appendChild(sol);
      const sag = el("div", "on-gruplar");
      GR.forEach(([g, gad, renk]) => {
        const x = o.sessiz[g]; if (!x || !x[1]) return;
        const s = el("div", "on-grup"); s.appendChild(el("span", null, gad));
        const nk = el("div", "on-noktalar"); nk.style.color = renk;
        for (let j = 0; j < x[1]; j++) { const d = el("i", j < x[1] - x[0] ? null : "sus"); if (j < x[1] - x[0]) d.style.background = renk; nk.appendChild(d); }
        s.appendChild(nk); s.appendChild(el("span", "n", (x[1] - x[0]) + "/" + x[1]));
        s.title = gad + ": " + T(`o günlerde yayında olan ${x[1]} yayından ${x[1] - x[0]} tanesi yazdı, ${x[0]} tanesi tek başlık atmadı`, `${x[1] - x[0]} of the ${x[1]} outlets publishing at the time covered it; ${x[0]} ran no headline`);
        sag.appendChild(s);
      });
      r.appendChild(sag); k.appendChild(r);
    });
    if (olaylar.length > (enCok || 40)) k.appendChild(el("p", "bekliyor", T(`İlk ${enCok || 40} olay gösteriliyor; toplam ${olaylar.length}.`, `Showing the first ${enCok || 40} of ${olaylar.length} events.`)));
    return k;
  }
  function olaySessizlikKismi(x, b) {
    const ol = olaylarArasi(b.bas, b.bit || gunEkle(b.bas, x.tur === "haftalik" ? 7 : 31));
    if (!ol.length) return null;
    const k = kisim(T("Olaylar ve sessizlik", "Events and silence"));
    const ba = topluOran(ol, "bati_ana"), bo = topluOran(ol, "bolge"), is = topluOran(ol, "israil");
    k.appendChild(el("p", null, T(
      `Geriye dönük taramada bu dönem için başlıklardan ${ol.length} olay bulundu (bölge basınında bir olay türünün olağan düzeyinin iki buçuk katına çıktığı günler). Her olayın günlerinde yayında olan yayınlardan kaçının o olay türünden tek başlık bile atmadığını saydık.`,
      `In the backfill, ${ol.length} events were found in the headlines for this period (days when one type of event rose to two and a half times its usual level in the regional press). For each event we counted how many of the outlets publishing at the time ran not a single headline about that kind of event.`)));
    const r = el("div", "sk-rakam");
    [[ba, T("Batı ana akımda susan yayınların payı", "share of Western mainstream outlets that stayed silent")], [bo, T("bölge basınında susanların payı", "share of regional outlets that stayed silent")], [is, T("İsrail basınında", "Israeli press")]].forEach(([v, l]) => { if (v == null) return; const d = el("div"); d.append(el("b", null, "%" + v), el("span", null, l)); r.appendChild(d); });
    k.appendChild(r);
    k.appendChild(noktaBulutu(ol, x.tur === "yillik" ? 25 : 40));
    k.appendChild(el("p", "dipnot", T("Sayım tür düzeyindedir: bir yayın o günlerde aynı türden başka bir olayı yazdıysa “yazdı” sayılır. Bu yüzden gerçek sessizlik burada görünenden büyüktür. Yayında sayılmak için pencerede (bir gün önce, iki gün sonra) en az " + ((ALISMA && ALISMA.aktif_en_az) || 15) + " başlık gerekir.",
      "Counting is by type: an outlet that covered another event of the same type in those days counts as having covered it, so the real silence is larger than shown. To count as publishing, an outlet needs at least " + ((ALISMA && ALISMA.aktif_en_az) || 15) + " headlines in the window (one day before, two after).")));
    return k;
  }

  // ---------------------------------------------------------------- grafikler: sessizlik endeksi
  function sessizlikGrafik() {
    const ay = (ALISMA && ALISMA.sessizlik) || [], ol = ((ALISMA && ALISMA.olaylar) || []).filter((o) => o.sessiz);
    if (ay.length < 3) return el("p", "bekliyor", T("Endeks için yeterli veri yok.", "Not enough data for the index yet."));
    const W = 720, H = 300, P = { s: 38, sg: 12, u: 14, a: 30 };
    const t0 = Date.parse(ay[0].donem + "-01T00:00:00Z"), t1 = Date.parse(gunEkle(ay[ay.length - 1].donem + "-28", 4) + "T00:00:00Z");
    const X = (t) => P.s + (W - P.s - P.sg) * (t - t0) / (t1 - t0), Y = (v) => P.u + (H - P.u - P.a) * (1 - v / 100);
    const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "sk-cizim", role: "img", "aria-label": T("Sessizlik endeksi, ay ay", "Silence index, month by month") });
    [0, 25, 50, 75, 100].forEach((v) => { s.appendChild(sv("line", { x1: P.s, x2: W - P.sg, y1: Y(v), y2: Y(v), class: "izgara" })); const t = sv("text", { x: P.s - 6, y: Y(v) + 3, "text-anchor": "end", class: "eksen-y" }); t.textContent = "%" + v; s.appendChild(t); });
    // yıl çizgileri
    for (let y = +ay[0].donem.slice(0, 4) + 1; y <= +ay[ay.length - 1].donem.slice(0, 4); y++) {
      const x = X(Date.parse(y + "-01-01T00:00:00Z")); s.appendChild(sv("line", { x1: x, x2: x, y1: P.u, y2: H - P.a, class: "izgara", "stroke-dasharray": "3 4" }));
      const t = sv("text", { x: x + 4, y: H - P.a + 16, class: "eksen-y" }); t.textContent = y; s.appendChild(t);
    }
    const ilk = sv("text", { x: P.s, y: H - P.a + 16, class: "eksen-y" }); ilk.textContent = tarih(ay[0].donem + "-15", { month: "short", year: "numeric" }); s.appendChild(ilk);
    // noktalar: her olay, iki grup
    [["bolge", "#1f7a52"], ["bati_ana", "#8a6d3b"]].forEach(([g, renk]) => {
      ol.forEach((o) => {
        const v = oran(o, g); if (v == null) return;
        const c = sv("circle", { cx: X(Date.parse(o.bas + "T12:00:00Z")).toFixed(1), cy: Y(v).toFixed(1), r: 3.2, fill: renk, "fill-opacity": g === "bati_ana" ? 0.5 : 0.32 });
        const x = o.sessiz[g];
        const tt = sv("title"); tt.textContent = tarih(o.bas) + " · " + turAd(o.tur) + (o.yer && o.yer.length ? " · " + o.yer.join(", ") : "") + " — " + GRK[g][1] + ": " + T(`${x[1]} yayından ${x[0]} tanesi yazmadı`, `${x[0]} of ${x[1]} outlets ran nothing`);
        c.appendChild(tt);
        ipucu(c, () => { const b = el("b", null, turAd(o.tur) + " · " + tarih(o.bas)); const p = el("span", null, (o.yer || []).join(", ")); const q = el("div", null, GRK[g][1] + ": " + T(`${x[1]} yayından ${x[0]} tanesi tek başlık atmadı`, `${x[0]} of ${x[1]} outlets ran no headline`)); return [b, p, q]; });
        s.appendChild(c);
      });
    });
    // aylık çizgiler
    [["bolge", "#1f7a52"], ["turkiye", "#7a3fa0"], ["bati_ana", "#8a6d3b"]].forEach(([g, renk]) => {
      let d = "";
      ay.forEach((m) => { if (m[g] == null) { d += " "; return; } const x = X(Date.parse(m.donem + "-15T00:00:00Z")).toFixed(1), y = Y(m[g]).toFixed(1); d += (d && !/ $/.test(d) ? "L" : "M") + x + "," + y; });
      s.appendChild(sv("path", { d: d.replace(/ /g, ""), class: "cizgi", stroke: renk, "stroke-width": g === "bati_ana" ? 3 : 2.2 }));
    });
    const k = el("figure", "kisim-sekil"); k.style.margin = "0"; k.appendChild(s);
    const lj = el("div", "sk-lejant");
    [["#8a6d3b", T("Batı ana akım (ay ortalaması)", "Western mainstream (monthly)")], ["#1f7a52", T("Bölge basını", "Regional press")], ["#7a3fa0", T("Türkiye basını", "Turkish press")]].forEach(([r, l]) => { const e = el("span"); const i = el("i"); i.style.background = r; e.append(i, l); lj.appendChild(e); });
    const e = el("span"); const i = el("i", "nokta"); i.style.background = "#8a6d3b"; i.style.opacity = ".55"; e.append(i, T("her nokta bir olay", "each dot is one event")); lj.appendChild(e);
    k.appendChild(lj);
    return k;
  }
  function canliGrafik() {
    const h = (KARNE && KARNE.sessizlik) || [];
    if (!h.length) return null;
    const k = el("div", "sk-rakam");
    h.slice(-6).forEach((x) => { const d = el("div"); d.append(el("b", null, "%" + x.oran), el("span", null, T(`${tarih(x.hafta, { day: "numeric", month: "short" })} haftası: bölgede en az 4 yayının yazdığı ${x.buyuk} olaydan ${x.sessiz} tanesi İsrail ve Batı basınında hiç yer almadı`, `Week of ${tarih(x.hafta, { day: "numeric", month: "short" })}: ${x.sessiz} of ${x.buyuk} events covered by at least 4 regional outlets never appeared in the Israeli and Western press`))); k.appendChild(d); });
    return k;
  }

  // ---------------------------------------------------------------- ön sayfalar
  function kapak() {
    const s = sayfa("kapak");
    s.appendChild(el("div", "kapak-ust", T("ZBS · Almanak", "ZBS · Almanac")));
    const h = el("h1", null, T("Almanak", "Almanac")); h.appendChild(el("em", null, T("7 Ekim’den bu yana basın neyi yazdı, neyi görmedi", "What the press wrote and did not see since 7 October"))); s.appendChild(h);
    // kapak sanatı: Batı ana akımın ve bölge basınının sustuğu pay, ay ay
    const ay = (ALISMA && ALISMA.sessizlik) || [];
    if (ay.length > 3) {
      const W = 600, H = 150, sanat = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "kapak-sanat", role: "img", "aria-label": T("Batı ana akımın sustuğu pay, ay ay", "Share of Western mainstream outlets that stayed silent, month by month") });
      const lo = Math.max(0, Math.min(...ay.flatMap((m) => [m.bolge, m.bati_ana]).filter((v) => v != null)) - 5);
      const X = (i) => 4 + (W - 8) * i / (ay.length - 1), Y = (v) => 8 + (H - 16) * (1 - (v - lo) / (100 - lo));
      [["bolge", "rgba(244,236,216,.35)", 1.6], ["bati_ana", "#f4ecd8", 3]].forEach(([g, r, w]) => {
        let d = ""; ay.forEach((m, i) => { if (m[g] == null) return; d += (d ? "L" : "M") + X(i).toFixed(1) + "," + Y(m[g]).toFixed(1); });
        sanat.appendChild(sv("path", { d, stroke: r, "stroke-width": w }));
      });
      s.appendChild(sanat);
      const ilk = ay.slice(0, 3).map((m) => m.bati_ana).filter((v) => v != null), son = ay.slice(-7, -1).map((m) => m.bati_ana).filter((v) => v != null);
      const ort = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
      if (ilk.length && son.length) s.appendChild(el("p", "kapak-not", T(`Kalın çizgi: başlıklardan bulunan her olayda, o günlerde yayında olan Batı ana akım yayınlarından kaçının tek başlık atmadığı. Savaşın ilk üç ayında %${ort(ilk)}; son altı ayda %${ort(son)}. İnce çizgi bölge basını.`,
        `Thick line: for every event found in the headlines, the share of Western mainstream outlets publishing at the time that ran not a single headline about it. First three months of the war: ${ort(ilk)}%; last six months: ${ort(son)}%. Thin line: regional press.`)));
    }
    const alt = el("div", "kapak-alt");
    const dl = el("dl");
    const baslikSay = SIRA.filter((x) => x.tur === "haftalik").reduce((a, x) => a + (x.haber || 0), 0);
    [[sayi(SIRA.length, 0), T("bölüm", "chapters")], [sayi(baslikSay, 0), T("başlık ve haber", "headlines")], [sayi(((ALISMA && ALISMA.olaylar) || []).length, 0), T("olay", "events")]].forEach(([a, b]) => { const d = el("div"); d.append(el("dt", null, a), el("dd", null, b)); dl.appendChild(d); });
    alt.appendChild(dl);
    const dg = el("div", "kapak-dugme");
    const son = SIRA[SIRA.length - 1];
    const a1 = el("a", null, T("Son bölümü oku →", "Read the latest chapter →")); if (son) a1.href = hashOf(son); dg.appendChild(a1);
    const a2 = el("a", "ikinci", T("İçindekiler", "Contents")); a2.href = "#icindekiler"; dg.appendChild(a2);
    alt.appendChild(dg);
    s.appendChild(alt);
    s.appendChild(el("div", "kapak-ust", T("Bu baskı: ", "This edition: ") + tarih(new Date().toISOString().slice(0, 10)) + T(" · her hafta yeni bölüm", " · a new chapter every week")));
    return s;
  }
  function buKitap() {
    const s = sayfa(null, "ZBS Almanak", T("Bu kitap", "About this book"), "i");
    const b = el("div", "acilis-blok"); b.append(el("div", "bolum-ust", T("Ön söz", "Preface")), el("h1", "bolum-baslik", T("Bu kitap nasıl okunur", "How to read this book"))); s.appendChild(b);
    [T("Bu kitap kendi kendine yazılıyor. Toplayıcımız her gün Filistin’den, Arap dünyasından, İran’dan, Türkiye’den, İsrail’den ve Batı’dan yüzlerce yayının haberini okuyor; her hafta sonunda bu haftanın bölümü, her ay sonunda ayın bölümü kitaba ekleniyor. Süren dönemin bölümü taslaktır ve günde bir yenilenir.",
      "This book writes itself. Every day our collector reads the news of hundreds of outlets from Palestine, the Arab world, Iran, Turkey, Israel and the West; at the end of every week a new chapter for that week is added, and at the end of every month a chapter for the month. The chapter for the current period is a draft and is refreshed daily."),
     T("Her yıl bir cilt. Ciltte önce yılın bölümü, sonra ay ay aylık bölüm ve o ayın haftaları gelir. Bölümler okuma sırasıyla numaralıdır; her bölümün kısımları da (162.1, 162.2 …) numaralıdır, böylece bir sayıya, bir grafiğe kesin olarak atıf yapabilirsiniz.",
      "Each year is a volume. In each volume the year’s chapter comes first, then month by month the monthly chapter and that month’s weeks. Chapters are numbered in reading order, and so are the parts of each chapter (162.1, 162.2 …), so you can cite a figure or a chart precisely."),
     T("Toplayıcı çalışmaya başlamadan önceki dönemler (Ekim 2023’ten bu yana) yayınların kendi arşivlerinden ve İnternet Arşivi’nden geriye dönük toplanan başlıklardan yazıldı: orada yorum metni yerine sayılar ve olay olay sessizlik var. Sayılar ölçümdür; yorum metnini yapay zekâ bu sayılara bakarak yazar.",
      "Periods before the collector started (since October 2023) were written from headlines gathered retrospectively from the outlets’ own archives and the Internet Archive: there you will find figures and event-by-event silence instead of commentary. The figures are measurements; the commentary is written by AI from those figures."),
     T("Her bölüm ayrı yazdırılabilir; bir ay ya da bütün bir cilt tek seferde de yazdırılabilir (A4, sayfa numaralı). Yazdır penceresinde “PDF olarak kaydet” seçerek kitabın kendi kopyasını alabilirsiniz.",
      "Every chapter can be printed on its own; a whole month or a whole volume can also be printed at once (A4, with page numbers). Choose “Save as PDF” in the print dialog to keep your own copy of the book.")].forEach((t, i) => s.appendChild(el("p", "metin" + (i ? "" : " acilis"), t)));
    const k = kisim(T("Özel raporlar", "Special reports")); k.style.setProperty("--no", '"Ek"');
    k.appendChild(el("p", null, T("Kitabın ekleri: üç yılı tek soruyla okuyan uzun raporlar.", "The book’s appendices: long reports that read three years through a single question.")));
    const ul = el("ul", "ic-liste");
    RAPORLAR.forEach(([h, ust, b2, a]) => { const li = el("li"); const x = el("a"); x.href = h; x.append(el("b", null, b2), el("i", null, ust), el("small", null, a)); li.appendChild(x); ul.appendChild(li); });
    k.appendChild(ul); const ks = el("div", "kisimlar"); ks.appendChild(k); s.appendChild(ks);
    return s;
  }
  function icindekiler() {
    const s = sayfa(null, "ZBS Almanak", T("İçindekiler", "Contents"), "ii");
    s.id = "icindekiler-sayfa";
    const b = el("div", "acilis-blok"); b.append(el("div", "bolum-ust", T("İçindekiler", "Contents")), el("h1", "bolum-baslik", T(`${CILT.length} cilt, ${SIRA.length} bölüm`, `${CILT.length} volumes, ${SIRA.length} chapters`))); s.appendChild(b);
    const ul0 = el("ul", "ic-liste");
    [["#sessizlik", T("Sessizlik endeksi", "The silence index"), T("7 Ekim’den bugüne, olay olay: kim yazdı, kim sustu.", "Event by event since 7 October: who covered it, who stayed silent."), T("ön bölüm", "front")]].forEach(([h, a, c, n]) => { const li = el("li"); const x = el("a"); x.href = h; x.append(el("b", null, a), el("i", null, n), el("small", null, c)); li.appendChild(x); ul0.appendChild(li); });
    s.appendChild(ul0);
    CILT.forEach((c) => {
      s.appendChild(el("h2", "bolum-baslik", T("Cilt ", "Volume ") + c.roma + " · " + c.yil)).style.fontSize = "1.3rem";
      const ul = el("ul", "ic-liste");
      const ekle = (x, metin, alt) => { const li = el("li"); const a = el("a"); a.href = hashOf(x); a.append(el("b", null, metin), el("i", null, T("Bölüm ", "Ch. ") + x.no + (x.taslak ? T(" · taslak", " · draft") : "")), el("small", null, alt)); li.appendChild(a); ul.appendChild(li); };
      if (c.yillik) ekle(c.yillik, T(c.yil + " yılı", "The year " + c.yil), c.yillik.baslik || T(sayi(c.yillik.haber, 0) + " başlık", sayi(c.yillik.haber, 0) + " headlines"));
      c.aylar.forEach((a) => {
        const ilk = a.aylik || a.haftalar[0]; if (!ilk) return;
        const alt = (a.aylik && a.aylik.baslik ? a.aylik.baslik + " · " : "") + a.haftalar.length + T(" hafta", " weeks");
        ekle(ilk, a.aylik ? ad(a.aylik) : tarih(a.ay + "-15", { month: "long", year: "numeric" }), alt);
      });
      s.appendChild(ul);
    });
    return s;
  }
  function sessizlikSayfa() {
    const s = sayfa(null, "ZBS Almanak", T("Ön bölüm · Sessizlik endeksi", "Front chapter · The silence index"), "iii");
    s.style.setProperty("--no", '"S"');
    const b = el("div", "acilis-blok"); b.append(el("div", "bolum-ust", T("Ön bölüm", "Front chapter")), el("h1", "bolum-baslik", T("Sessizlik endeksi", "The silence index")),
      el("div", "bolum-tarih", T("7 Ekim 2023’ten bugüne", "From 7 October 2023 to today"))); s.appendChild(b);
    const ay = (ALISMA && ALISMA.sessizlik) || [];
    const ort = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);
    const sec = (g, a, z) => ort(ay.slice(a, z).map((m) => m[g]).filter((v) => v != null));
    const bi = sec("bati_ana", 0, 3), bs = sec("bati_ana", -7, -1), oi = sec("bolge", 0, 3), os = sec("bolge", -7, -1);
    s.appendChild(el("p", "metin acilis", T(
      `Bir olay basına yansımış olabilir; ama kim yansıttı? Başlıklardan bulduğumuz her olay için, o günlerde yayında olan her yayının o türden tek bir başlık atıp atmadığına baktık. Savaşın ilk üç ayında Batı ana akım yayınlarının ortalama %${bi}’si bir olayı hiç başlığa taşımıyordu; son altı ayda bu oran %${bs}. Bölge basınında aynı ölçü %${oi} ve %${os}.`,
      `An event may have reached the press, but who carried it? For every event we found in the headlines, we checked whether each outlet publishing at the time ran a single headline of that kind. In the first three months of the war, on average ${bi}% of Western mainstream outlets carried no headline at all about an event; over the last six months, ${bs}%. In the regional press the same measure was ${oi}% and ${os}%.`)));
    const ks = el("div", "kisimlar");
    const k1 = kisim(T("Ay ay sessizlik ve her olay bir nokta", "Silence month by month, each event a dot"));
    k1.appendChild(el("p", null, T("Dikey eksen: o olayın günlerinde yayında olup o türden hiç başlık atmayan yayınların payı. Çizgi ayın ortalaması; noktalar tek tek olaylar. Noktaya gelince olay çıkar.", "Vertical axis: the share of outlets publishing during the event that ran no headline of that kind. The lines are monthly averages; the dots are individual events. Hover a dot to see the event.")));
    k1.appendChild(sessizlikGrafik());
    ks.appendChild(k1);
    const son = olaylarArasi(gunEkle(new Date().toISOString().slice(0, 10), -120), "9999").reverse();
    if (son.length) {
      const k2 = kisim(T("Son dört ayın olayları, yayın yayın", "The last four months’ events, outlet by outlet"));
      k2.appendChild(el("p", null, T("Her nokta bir yayın. Dolu nokta o olayı (ya da o günlerde aynı türden bir olayı) başlığa taşıdı; boş nokta o günlerde yayındaydı ama tek başlık atmadı.", "Each dot is one outlet. A filled dot carried the event (or another event of the same kind in those days) in a headline; a hollow dot was publishing at the time but ran no headline.")));
      k2.appendChild(noktaBulutu(son, 30));
      ks.appendChild(k2);
    }
    const cg = canliGrafik();
    if (cg) {
      const k3 = kisim(T("Canlı ölçüm: olay olay", "Live measurement: event by event"));
      k3.appendChild(el("p", null, T("Toplayıcının canlı izlediği haftalarda ölçü daha keskin: aynı olayı anlatan haberler tek tek eşleştiriliyor. Bölge basınında en az dört yayının yazdığı olaylardan, İsrail ve Batı basınında tek bir haber bile çıkmayanların payı:", "In the weeks the collector monitors live the measure is sharper: stories about the same event are matched one by one. The share of events covered by at least four regional outlets that never appeared in a single Israeli or Western story:")));
      k3.appendChild(cg); ks.appendChild(k3);
    }
    const k4 = kisim(T("Yöntem ve sınırlar", "Method and limits"));
    [T("Olaylar basından bulunur: bir olay türünün (hastane, çadır, yardım bekleyenler, cami, okul …) bölge basınındaki payı önceki dört haftanın ortancasının iki buçuk katına çıktığı günler bir olaydır. Bu yüzden bu endeks yalnızca basına zaten yansımış olayları sayar; hiç haber olmamış saldırıları (örneğin her gün süren gözaltı işkencesini) görmez. Gerçek olay kayıtlarıyla (BM, Sağlık Bakanlığı, insan hakları örgütleri) yapılacak karşılaştırma ayrı bir bölüm olarak eklenecek.",
      "Events are found from the press: an event is a day on which one type of event (hospital, tent, people waiting for aid, mosque, school …) rises to two and a half times the median of the previous four weeks in the regional press. The index therefore counts only events that already reached the press; it does not see attacks that never became news (such as daily torture in detention). A comparison with real-world incident records (UN, the Ministry of Health, human rights groups) will be added as a separate chapter."),
     T("Sayım tür düzeyindedir: o günlerde aynı türden başka bir olayı yazan yayın “yazdı” sayılır. Yani gerçek sessizlik burada görünenden büyüktür.", "Counting is by type: an outlet that wrote about another event of the same type in those days counts as having covered it. The real silence is larger than shown."),
     T("Geriye dönük taramada yayınların arşivlerinin ne kadarına ulaşılabildiği yayından yayına değişir; o yüzden yalnızca o günlerde en az 15 başlığı bulunan yayınlar sayılır. İsrail basınında örneklem küçüktür.", "How much of each outlet’s archive could be reached in the backfill varies; only outlets with at least 15 headlines in the window count. The Israeli press sample is small.")].forEach((t) => k4.appendChild(el("p", null, t)));
    ks.appendChild(k4);
    s.appendChild(ks);
    return s;
  }

  // ---------------------------------------------------------------- bölüm içeriği (bülten)
  function eksen(baslikMetni, liste) {
    const k = el("div", "eksen"); if (baslikMetni) k.appendChild(el("div", "alt-baslik", baslikMetni));
    liste.filter((x) => x.uzaklik != null).forEach((x) => {
      const s = el("div", "e-satir"); const a = el("span", "e-ad", x.ad); a.title = x.ad; a.appendChild(el("small", null, x.n + T(" haber", " stories"))); s.appendChild(a);
      const c = el("div", "e-cizgi"); const n = el("i", "e-nokta"); n.style.left = (50 * x.uzaklik) + "%"; n.style.background = KR[x.ad] || "#6b746f";
      n.title = x.ad + ": " + x.filistin + " / " + x.aktarim + " / " + x.israil; c.appendChild(n); s.appendChild(c);
      const d = el("span", "e-deger", sayi(x.uzaklik, 2)); d.style.color = x.uzaklik < 0.5 ? BR.filistin : x.uzaklik >= 1.5 ? BR.israil : ""; s.appendChild(d); k.appendChild(s);
    });
    const o = el("div", "e-olcek"); o.appendChild(el("span")); const ic = el("div");
    [["0", " · " + BK.filistin], ["1", " · " + BK.aktarim.toLocaleLowerCase(YEREL)], ["2", " · " + BK.israil]].forEach(([n, t]) => { const x = el("span", null, n); x.appendChild(el("span", "uzun", t)); ic.appendChild(x); });
    o.appendChild(ic); o.appendChild(el("span")); k.appendChild(o);
    return k;
  }
  function kamplar(o) { const f = el("span"); Object.entries(o.kamplar).forEach(([a, n]) => { const c = el("span", "kc", a + " " + n); c.style.background = KR[a] || "#6b746f"; f.appendChild(c); f.append(" "); }); return f; }
  function kodluMetin(etiket, metin, sinif) {
    const p = el(etiket, sinif || null);
    String(metin || "").split(/(\[E\d+\](?:\s*\[E\d+\])*)/).forEach((par) => {
      const kodlar = par.match(/E\d+/g);
      if (kodlar && /^\[E\d+\]/.test(par)) kodlar.forEach((kd) => { if (KOD[kd]) p.appendChild(kodDugme(kd)); });
      else p.append(par);
    });
    return p;
  }
  function kodDugme(kd) { const b = el("button", "kod", kd.replace("E", "")); b.type = "button"; b.title = T("Kanıt: ", "Evidence: ") + (KOD[kd] || {}).baslik; b.setAttribute("aria-label", b.title); b.onclick = (e) => { e.stopPropagation(); kanitAc(kd); }; return b; }
  function kanitAc(kd) {
    const v = KOD[kd]; if (!v) return; const pn = $("kanitPanel"); pn.innerHTML = "";
    const ust = el("div", "kp-ust"); ust.appendChild(el("b", null, v.baslik)); const kp = el("button", "kp-kapat", "✕"); kp.type = "button"; kp.setAttribute("aria-label", T("Kapat", "Close")); kp.onclick = () => { pn.hidden = true; }; ust.appendChild(kp); pn.appendChild(ust);
    pn.appendChild(el("div", "kp-alt", v.tarih + (v.yer ? " · " + v.yer : "") + " · " + v.haberler.length + T(" haber", " stories")));
    v.haberler.forEach((h) => {
      const r = el("div", "orn"); const y = el("span", "y", h.yayin + " · " + h.kamp); if (h.bakis) { const c = el("span", "bakis-cip", BK[h.bakis]); c.style.background = BR[h.bakis]; y.appendChild(c); } r.appendChild(y);
      const t = el("span", "b", h.baslik || ""); t.dir = "auto"; r.appendChild(t); if (h.tr && h.tr !== h.baslik) r.appendChild(el("span", "c", h.tr));
      if (h.url) { const a = el("a", null, T("Habere git ↗", "Go to story ↗")); a.href = h.url; a.target = "_blank"; a.rel = "noopener"; r.appendChild(a); } pn.appendChild(r);
    });
    pn.hidden = false; pn.focus();
  }
  function degisim(simdi, once) {
    if (simdi == null || once == null) return null; const d = simdi - once; if (Math.abs(d) < 0.05) return el("span", "dg es", "=");
    const s = el("span", "dg " + (d > 0 ? "art" : "azl"), (d > 0 ? "↑" : "↓") + sayi(Math.abs(d), 1)); s.title = T("Önceki döneme göre", "Compared with the previous period"); return s;
  }
  function egilim(gunluk) {
    const g = gunluk.filter((x) => x.ic_uzaklik != null || x.dis_uzaklik != null); if (g.length < 2) return null;
    const W = 640, H = 180, P = 34, n = gunluk.length, x = (i) => P + (W - 2 * P) * (n < 2 ? 0 : i / (n - 1)), y = (v) => 18 + (H - 46) * (v / 2);
    const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, class: "egri", role: "img" });
    [0, 1, 2].forEach((v) => { s.appendChild(sv("line", { x1: P, x2: W - P, y1: y(v), y2: y(v), class: "egri-izgara" })); const t = sv("text", { x: P - 8, y: y(v) + 4, "text-anchor": "end", class: "egri-yazi" }); t.textContent = v; s.appendChild(t); });
    [["ic_uzaklik", "#2b8a5e"], ["dis_uzaklik", "#4a72c4"]].forEach(([a, r]) => {
      let d = ""; gunluk.forEach((v, i) => { if (v[a] == null) return; d += (d ? "L" : "M") + x(i).toFixed(1) + "," + y(v[a]).toFixed(1); });
      if (d) s.appendChild(sv("path", { d, fill: "none", stroke: r, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
      gunluk.forEach((v, i) => { if (v[a] == null) return; const c = sv("circle", { cx: x(i), cy: y(v[a]), r: 3.5, fill: r }); const t = sv("title"); t.textContent = v.gun + ": " + sayi(v[a], 2); c.appendChild(t); s.appendChild(c); });
    });
    [0, n - 1].forEach((i) => { const t = sv("text", { x: x(i), y: H - 6, "text-anchor": i ? "end" : "start", class: "egri-yazi" }); t.textContent = tarih(gunluk[i].gun, { day: "numeric", month: "short" }); s.appendChild(t); });
    const k = el("div", "egri-kutu"); k.appendChild(s); const ef = el("div", "dagilim-efsane");
    [["#2b8a5e", T("Bölge basını", "Regional press")], ["#4a72c4", T("İsrail ve Batı basını", "Israeli and Western press")]].forEach(([r, l]) => { const e = el("span"); const i = el("i"); i.style.background = r; e.appendChild(i); e.append(l); ef.appendChild(e); });
    k.appendChild(ef); return k;
  }
  function takvim(gunluk) {
    const k = el("div", "takvim");
    [["ic", T("Bölge basını", "Regional press"), "#2b8a5e"], ["dis", T("İsrail ve Batı basını", "Israeli and Western press"), "#4a72c4"]].forEach(([y, l, r]) => {
      const sat = el("div", "tk-satir"); sat.appendChild(el("span", "tk-ad", l)); const iz = el("div", "tk-izgara");
      const ilk = new Date(gunluk[0].gun + "T12:00:00Z").getUTCDay(); for (let i = 0; i < (ilk + 6) % 7; i++) iz.appendChild(el("i", "tk-bos"));
      const paylar = gunluk.map((g) => (g[y] ? g[y + "_gazze"] / g[y] : null)); const en = Math.max(0.05, ...paylar.filter((v) => v != null));
      gunluk.forEach((g, i) => {
        const c = el("i", "tk-gun"); const p = paylar[i];
        if (p == null) c.classList.add("tk-yok"); else { c.style.background = r; c.style.opacity = (0.15 + 0.85 * p / en).toFixed(2); }
        c.title = tarih(g.gun, { day: "numeric", month: "long" }) + ": " + (p == null ? T("veri yok", "no data") : T("Gazze %", "Gaza ") + sayi(100 * p, 1) + (EN ? "%" : "") + " (" + g[y + "_gazze"] + "/" + g[y] + ")"); iz.appendChild(c);
      });
      sat.appendChild(iz); k.appendChild(sat);
    });
    k.appendChild(el("p", "bekliyor", T("Koyu kare: o gün grubun haberleri içinde Gazze’nin payı yüksek. Gri: o gün veri yok.", "Dark square: Gaza’s share of the group’s stories was high that day. Grey: no data.")));
    return k;
  }
  let DUNYA_P = null;
  function harita(yerler) {
    const k = el("div", "sessiz-harita"); const W = 1000, H = 560, B = { bat: -20, dogu: 80, kuzey: 58, guney: 2 };
    const px = (lon) => (lon - B.bat) / (B.dogu - B.bat) * W, py = (lat) => (B.kuzey - lat) / (B.kuzey - B.guney) * H;
    const s = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": T("Olayların yaşandığı yerler", "Where the events happened") }); const kara = sv("path", { class: "sh-kara" }); s.appendChild(kara);
    if (!DUNYA_P && window.topojson) DUNYA_P = fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then((r) => r.json()).catch(() => null);
    if (DUNYA_P) DUNYA_P.then((t) => {
      if (!t) return; let d = "";
      topojson.feature(t, t.objects.countries).features.forEach((f) => { const g = f.geometry; if (!g) return; (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []).forEach((p) => p.forEach((h) => { const xs = h.map((q) => q[0]); if (Math.max(...xs) < B.bat - 5 || Math.min(...xs) > B.dogu + 5) return; d += "M" + h.map((q) => px(q[0]).toFixed(1) + "," + py(q[1]).toFixed(1)).join("L") + "Z"; })); });
      kara.setAttribute("d", d);
    });
    yerler.forEach((y) => {
      if (y.lon < B.bat || y.lon > B.dogu || y.lat < B.guney || y.lat > B.kuzey) return; const g = sv("g", { class: "sh-yer" + (y.gorulmeyen ? " sessiz" : ""), tabindex: 0 });
      const r = 6 + Math.sqrt(y.olay) * 4; if (y.gorulmeyen) g.appendChild(sv("circle", { cx: px(y.lon), cy: py(y.lat), r: r + 8, class: "sh-hale" }));
      g.appendChild(sv("circle", { cx: px(y.lon), cy: py(y.lat), r })); const t = sv("title"); t.textContent = y.ad + ": " + y.olay + T(" olay", " events") + (y.gorulmeyen ? ", " + y.gorulmeyen + T(" tanesini İsrail ve Batı basını hiç yazmadı", " never covered by the Israeli and Western press") : ""); g.appendChild(t);
      if (y.gorulmeyen && y.kodlar.length) { g.style.cursor = "pointer"; g.onclick = () => kanitAc(y.kodlar[0]); }
      if (y.gorulmeyen) { const l = sv("text", { x: px(y.lon) + r + 6, y: py(y.lat) + 5, class: "sh-ad" }); l.textContent = y.ad; g.appendChild(l); } s.appendChild(g);
    });
    k.appendChild(s); return k;
  }

  function bolumCiz(x, b) {
    const s0 = b.istatistik, a = b.anlati || {}, on = s0.onceki || null; KOD = s0.kodlar || {};
    const TRM = s0.kaynak === "tarama";
    const c = x.cilt || { roma: "", yil: "" };
    const s = sayfa("kb-bolum", "ZBS Almanak · " + T("Cilt ", "Vol. ") + c.roma + " · " + c.yil, T("Bölüm ", "Chapter ") + x.no + " · " + kisaAd(x), x.no);
    s.style.setProperty("--no", '"' + x.no + '"');
    const ac = el("div", "acilis-blok");
    ac.append(el("div", "bolum-ust", TUR_AD[x.tur]), el("div", "bolum-no", String(x.no)), el("h1", "bolum-baslik", a.baslik || ad(x)));
    if (a.baslik) ac.appendChild(el("div", "bolum-tarih", ad(x)));
    const kn = el("div", "bolum-kunye");
    kn.appendChild(el("span", null, TRM ? sayi(s0.haber_sayisi, 0) + T(" başlık · geriye dönük tarama", " headlines · backfill") : sayi(s0.haber_sayisi, 0) + T(" haber · ", " stories · ") + s0.olay_sayisi + T(" olay", " events")));
    if (b.taslak) kn.appendChild(el("span", "taslak", T("taslak · ", "draft · ") + new Date(b.uretildi).toLocaleString(YEREL, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + T(" itibarıyla", "")));
    ac.appendChild(kn);
    s.appendChild(ac);
    (a.ozet || []).forEach((p, i) => s.appendChild(kodluMetin("p", p, "metin" + (i ? "" : " acilis"))));
    if (TRM) s.appendChild(el("p", "bolum-not", T("Bu dönem toplayıcı çalışmaya başlamadan önceye ait. Sayılar, yayınların kendi arşivlerinden ve İnternet Arşivi’nden geriye dönük toplanan özgün başlıklardan çıkarıldı: kim ne kadar yazdı, Gazze ne kadar yer buldu, hangi kelimeler kullanıldı, başlıklardan bulunan olaylarda kim sustu.",
      "This period predates the collector. The figures come from original headlines gathered retrospectively from the outlets’ own archives and the Internet Archive: who wrote how much, how much space Gaza got, which words were used, and who stayed silent in the events found in the headlines.")));
    else if (!b.anlati) s.appendChild(el("p", "bolum-not", T("Yorum metni henüz yazılmadı; yapay zekâ kotası açılınca eklenecek. Aşağıdaki sayılar hazır.", "The commentary has not been written yet; it will be added when the AI quota allows. The figures below are ready.")));
    if (Object.keys(KOD).length) s.appendChild(el("p", "bekliyor", T("Metindeki numaralı düğmeler kanıttır: dokununca o olayı yazan yayınları ve özgün başlıkları görürsün.", "The numbered buttons in the text are evidence: tap one to see the outlets that covered the event and their original headlines.")));
    const ks = el("div", "kisimlar");
    const ekle = (k) => { if (k) ks.appendChild(k); };
    // olaylar ve sessizlik (geriye dönük taramadan; her bölümde)
    ekle(olaySessizlikKismi(x, b));
    if (TRM) {
      const k = kisim(T("Kim ne kadar yazdı", "Who wrote how much"));
      k.appendChild(el("p", null, T("Bu dönemde geriye dönük toplanan başlıkların gruplara dağılımı. Sayılar yayınların arşivlerinin ne kadarına ulaşılabildiğine de bağlıdır; mutlak sayıdan çok oranlara bakın.", "How the headlines gathered for this period are spread across groups. The numbers also depend on how much of each archive could be reached; look at shares rather than absolute numbers.")));
      const en = Math.max(1, ...s0.hacim.map((v) => v.n)); const ul = el("div", "hacim-liste");
      s0.hacim.forEach((v) => { const r = el("div", "hacim-satir"); r.appendChild(el("span", "h-ad", v.ad)); const bar = el("span", "h-cubuk"); const i = el("i"); i.style.width = (100 * v.n / en) + "%"; i.style.background = KR[v.ad] || "#6b746f"; bar.appendChild(i); r.appendChild(bar); r.appendChild(el("span", "h-sayi", sayi(v.n, 0))); ul.appendChild(r); });
      k.appendChild(ul); ekle(k);
      const gz = s0.gazze;
      if (gz && (gz.ic_pay != null || gz.dis_pay != null)) {
        const g = kisim(T("Gazze başlıkların ne kadarında", "How many headlines mentioned Gaza"));
        const r = el("div", "sk-rakam");
        [[gz.ic_pay, T("bölge basını · ", "regional press · ") + sayi(gz.ic, 0) + T(" başlık", " headlines")], [gz.dis_pay, T("İsrail ve Batı basını · ", "Israeli and Western press · ") + sayi(gz.dis, 0) + T(" başlık", " headlines")]].forEach(([v, l]) => { const d = el("div"); d.append(el("b", null, v == null ? "–" : "%" + sayi(v, 1)), el("span", null, l)); r.appendChild(d); });
        g.appendChild(r); ekle(g);
      }
    } else {
      const u = kisim(T("Kim, Filistin bakışından ne kadar uzak anlattı", "How far from the Palestinian perspective each group told it"));
      u.appendChild(el("p", null, T("Olay karşılaştırmalarına giren başlıkların ortalaması. 0 Filistin bakışı, 1 aktarım, 2 İsrail / ABD bakışı.", "Average of the headlines in the event comparisons. 0 Palestinian perspective, 1 relay, 2 Israeli / US perspective.") + (on ? T(" Oklar " + on.ad + " ile karşılaştırma.", " Arrows compare with " + on.ad + ".") : "")));
      const ek = eksen(T("Bölgeye göre", "By region"), s0.kamp_bakis);
      if (on) [...ek.querySelectorAll(".e-satir")].forEach((r, i) => { const v = s0.kamp_bakis.filter((z) => z.uzaklik != null)[i]; const d = v && on.kamp_bakis && degisim(v.uzaklik, on.kamp_bakis[v.ad]); if (d) r.querySelector(".e-deger").appendChild(d); });
      u.appendChild(ek); if (s0.cizgi_bakis.length) u.appendChild(eksen(T("Yayın çizgisine göre", "By editorial line"), s0.cizgi_bakis));
      if (s0.gunluk && s0.gunluk.length > 1) { const e = egilim(s0.gunluk); if (e) { u.appendChild(el("div", "alt-baslik", T("Gün gün", "Day by day"))); u.appendChild(e); } }
      ekle(u);
      const g = kisim(T("İsrail ve Batı basınının görmedikleri", "What the Israeli and Western press did not see"));
      if (on) { const d = degisim(s0.gormeyen_israil_bati.length, on.gormeyen); if (d) { d.title = on.ad + ": " + on.gormeyen; g.querySelector("h2").appendChild(d); } }
      if (a.gorulmeyenler) g.appendChild(kodluMetin("p", a.gorulmeyenler, "metin"));
      if ((s0.yerler || []).length) g.appendChild(harita(s0.yerler));
      g.appendChild(el("p", "bekliyor", T("Bölge basınında en az üç yayının yazdığı, İsrail ve Batı basınında hiç yer bulmayan olaylar:", "Events covered by at least three regional outlets that found no place at all in the Israeli and Western press:")));
      const liste = (arr) => { const ul = el("ul", "olay-liste"); arr.forEach((o) => { const li = el("li"); li.appendChild(el("span", "t", o.tarih)); li.appendChild(el("b", null, o.baslik)); li.appendChild(kamplar(o)); if (o.kod) li.appendChild(kodDugme(o.kod)); ul.appendChild(li); }); return ul; };
      const ul = liste(s0.gormeyen_israil_bati); if (!s0.gormeyen_israil_bati.length) ul.appendChild(el("li", null, T("Bu dönemde böyle bir olay yok.", "No such event in this period."))); g.appendChild(ul);
      if (s0.gormeyen_bolge.length) { g.appendChild(el("div", "alt-baslik", T("Tersi: yalnızca İsrail ve Batı basınının yazdıkları", "The reverse: covered only by the Israeli and Western press"))); g.appendChild(liste(s0.gormeyen_bolge)); }
      ekle(g);
      const gc = s0.gecikme;
      if (gc && gc.olay) {
        const c2 = kisim(T("Kim önce yazdı, kim geç kaldı", "Who wrote first, who was late"));
        c2.appendChild(el("p", null, T("İki tarafın da yazdığı " + gc.olay + " olayda, İsrail ve Batı basınının ilk haberi bölge basınının ilk haberinden ne kadar sonra geldi.", "In the " + gc.olay + " events both sides covered, how long after the regional press’s first story the first Israeli or Western story came.")));
        const r = el("div", "sk-rakam");
        [[gc.medyan_saat == null ? "–" : (gc.medyan_saat > 0 ? "+" : "") + sayi(gc.medyan_saat, 1) + T(" sa", " h"), T("ortanca gecikme", "median delay")], [gc.bolge_once, T("olayda bölge basını önce yazdı", "events where the regional press was first")], [gc.bati_once, T("olayda İsrail ve Batı basını önce yazdı", "events where the Israeli and Western press was first")]].forEach(([v, l]) => { const d = el("div"); d.append(el("b", null, String(v)), el("span", null, l)); r.appendChild(d); });
        c2.appendChild(r);
        if (gc.en_gec.length) {
          c2.appendChild(el("div", "alt-baslik", T("En geç yazılanlar", "Covered latest"))); const enb = Math.max(...gc.en_gec.map((v) => v.saat)); const ul2 = el("ul", "olay-liste");
          gc.en_gec.forEach((o) => { const li = el("li"); li.appendChild(el("b", null, o.baslik)); const bar = el("span", "gec-cubuk"); const i = el("i"); i.style.width = Math.max(4, 100 * o.saat / enb) + "%"; bar.appendChild(i); li.appendChild(bar); li.appendChild(el("span", "t", "+" + sayi(o.saat, 1) + T(" sa", " h"))); if (o.kod) li.appendChild(kodDugme(o.kod)); ul2.appendChild(li); });
          c2.appendChild(ul2);
        }
        ekle(c2);
      }
    }
    // dil sayacı (iki türde de)
    const dl = s0.dil;
    if (dl && (dl.baslik_ic || dl.baslik_dis)) {
      const c3 = kisim(T("Dil sayacı: kim hangi kelimeyi kullandı", "Word counter: who used which word"));
      c3.appendChild(el("p", null, T("Özgün başlıklarda (9 dilde) kelimenin bin başlıkta kaç kez geçtiği. Ölçülen başlık: bölge basını " + sayi(dl.baslik_ic, 0) + ", İsrail ve Batı basını " + sayi(dl.baslik_dis, 0) + ". Üzerine gelince örnek başlıkları görürsün.", "Uses per thousand original headlines (in 9 languages). Headlines measured: regional press " + sayi(dl.baslik_ic, 0) + ", Israeli and Western press " + sayi(dl.baslik_dis, 0) + ". Hover to see sample headlines.")));
      const tb = el("div", "dil-tablo"); const h = el("div", "dil-satir dil-bas"); ["", T("Bölge basını", "Regional press"), "", T("İsrail ve Batı basını", "Israeli and Western press")].forEach((t) => h.appendChild(el("span", null, t))); tb.appendChild(h);
      const en = Math.max(1, ...dl.terimler.map((t) => Math.max(t.ic_binde || 0, t.dis_binde || 0)));
      dl.terimler.forEach((t) => {
        const r = el("div", "dil-satir" + (t.yan === "israil" ? " dil-is" : ""));
        const sol = el("span", "dil-sol"); const ib = el("i"); ib.style.width = (100 * (t.ic_binde || 0) / en) + "%"; sol.appendChild(el("em", null, sayi(t.ic_binde || 0, 0))); sol.appendChild(ib); sol.title = t.ornek_ic.map((o) => o.yayin + ": " + o.baslik).join("\n") || T("örnek yok", "no sample");
        const ad2 = el("span", "dil-ad", "“" + t.ad + "”");
        const sag = el("span", "dil-sag"); const db = el("i"); db.style.width = (100 * (t.dis_binde || 0) / en) + "%"; sag.appendChild(db); sag.appendChild(el("em", null, sayi(t.dis_binde || 0, 0))); sag.title = t.ornek_dis.map((o) => o.yayin + ": " + o.baslik).join("\n") || T("örnek yok", "no sample");
        r.append(sol, ad2, el("span"), sag); tb.appendChild(r);
      });
      c3.appendChild(tb); c3.appendChild(el("p", "bekliyor", T("Yeşil kelimeler Filistin anlatısının, mavi kelimeler İsrail anlatısının kelimeleri. “Operasyon” bazen direniş eylemleri için de kullanılır.", "Green words belong to the Palestinian narrative, blue words to the Israeli narrative. “Operation” is sometimes also used for resistance actions.")));
      ekle(c3);
    }
    if (!TRM) {
      const ol = s0.olum;
      if (ol && (ol.olu.filistinli || ol.olu.israilli)) {
        const c4 = kisim(T("Ölü başına haber", "Stories per death"));
        c4.appendChild(el("p", null, T("Olay kümelerinde bildirilen ölüler: " + sayi(ol.olu.filistinli, 0) + " Filistinli, " + sayi(ol.olu.israilli, 0) + " İsrailli. Her grup bu ölümleri kaç haberde andı?", "Deaths reported in the event clusters: " + sayi(ol.olu.filistinli, 0) + " Palestinian, " + sayi(ol.olu.israilli, 0) + " Israeli. In how many stories did each group mention them?")));
        const kt = el("div", "tablo-kutu"); const tb = el("table");
        const th = el("thead"); const tr0 = el("tr"); [T("Grup", "Group"), T("Filistinli ölü başına haber", "Stories per Palestinian death"), T("İsrailli ölü başına haber", "Stories per Israeli death"), T("Kat", "Ratio")].forEach((t) => tr0.appendChild(el("th", null, t))); th.appendChild(tr0); tb.appendChild(th);
        const bd = el("tbody");
        ol.gruplar.forEach((v) => { const r = el("tr"); r.appendChild(el("td", null, v.ad)); r.appendChild(el("td", "sayi", v.filistinli_olu_basina == null ? "–" : sayi(v.filistinli_olu_basina, 2) + " (" + v.filistinli_haber + ")")); r.appendChild(el("td", "sayi", v.israilli_olu_basina == null ? "–" : sayi(v.israilli_olu_basina, 2) + " (" + v.israilli_haber + ")")); r.appendChild(el("td", "sayi", v.kat == null ? "–" : sayi(v.kat, 1) + "×")); bd.appendChild(r); });
        tb.appendChild(bd); kt.appendChild(tb); c4.appendChild(kt);
        c4.appendChild(el("p", "dipnot", T("Kat: İsrailli bir ölümün, Filistinli bir ölüme göre kaç kat daha çok haberde anıldığı. Ölü sayıları yapay zekânın haber metinlerinden çıkardığı tahminlerdir.", "Ratio: how many times more stories mentioned an Israeli death than a Palestinian one. Death figures are AI estimates extracted from the stories.")));
        ekle(c4);
      }
      if (s0.konular.length) {
        const t = kisim(T("Kim hangi konuya ne kadar yer verdi", "Who gave how much space to which topic"));
        t.appendChild(el("p", null, T("Her grubun kendi haberleri içinde o konuya ayırdığı pay. Oran 1’in altındaysa İsrail ve Batı basını konuyu bölge basınından daha az işlemiş demektir.", "The share of each group’s own stories given to the topic. A ratio below 1 means the Israeli and Western press covered it less than the regional press.")));
        const kt = el("div", "tablo-kutu"); const tb = el("table"); const th = el("thead"); const tr0 = el("tr"); [T("Konu", "Topic"), T("Bölge basını", "Regional press"), T("İsrail ve Batı", "Israel and West"), T("Oran", "Ratio")].forEach((v) => tr0.appendChild(el("th", null, v))); th.appendChild(tr0); tb.appendChild(th);
        const bd = el("tbody"); const enb = Math.max(1, ...s0.konular.map((v) => v.oran || 0));
        s0.konular.forEach((v) => { const r = el("tr"); r.appendChild(el("td", null, v.konu)); r.appendChild(el("td", "sayi", "%" + sayi(v.bolge_ici_pay) + " · " + v.bolge_ici)); r.appendChild(el("td", "sayi", "%" + sayi(v.israil_bati_pay) + " · " + v.israil_bati));
          const oc = el("td"); const ob = el("div", "oran"); const i = el("i"); i.style.width = Math.max(2, 60 * (v.oran || 0) / enb) + "px"; i.style.background = (v.oran || 0) < 1 ? "#c9544e" : "#4a72c4"; ob.appendChild(i); ob.appendChild(el("span", null, v.oran == null ? "–" : sayi(v.oran, 2) + "×")); oc.appendChild(ob); r.appendChild(oc); bd.appendChild(r); });
        tb.appendChild(bd); kt.appendChild(tb); t.appendChild(kt); ekle(t);
      }
    }
    if (s0.gunluk && s0.gunluk.length && x.tur !== "yillik") { const t = kisim(T("Takvim: Gazze hangi gün ne kadar yer buldu", "Calendar: how much space Gaza got each day")); t.appendChild(takvim(s0.gunluk)); ekle(t); }
    if (!TRM && ((a.nasil_anlatildi || []).length || s0.buyuk_olaylar.length)) {
      const n = kisim(T("Nasıl anlatıldı", "How it was told"));
      (a.nasil_anlatildi || []).forEach((v) => { const d = el("div", "anlat"); d.appendChild(el("h3", null, v.konu)); d.appendChild(kodluMetin("p", v.metin, "metin")); n.appendChild(d); });
      n.appendChild(el("div", "alt-baslik", T("En çok yazılan olaylardan başlık örnekleri", "Sample headlines from the most covered events")));
      s0.buyuk_olaylar.filter((o) => o.ornekler.bolge_ici.length || o.ornekler.israil_bati.length).slice(0, 6).forEach((o) => {
        const d = el("div", "anlat"); const h3 = el("h3", null, o.baslik); if (o.kod) h3.appendChild(kodDugme(o.kod)); d.appendChild(h3); const iki = el("div", "iki");
        [["bolge_ici", T("Bölge basını", "Regional press")], ["israil_bati", T("İsrail ve Batı basını", "Israeli and Western press")]].forEach(([y, l]) => {
          const c5 = el("div"); c5.appendChild(el("h4", null, l));
          if (!o.ornekler[y].length) c5.appendChild(el("div", "orn c", T("Bu olayı yazmadı.", "Did not cover this event.")));
          o.ornekler[y].forEach((e) => { const r = el("div", "orn"); const yy = el("span", "y", e.yayin); if (e.bakis) { const cp = el("span", "bakis-cip", BK[e.bakis]); cp.style.background = BR[e.bakis]; yy.appendChild(cp); } r.appendChild(yy); const bb = el("span", "b", e.baslik); bb.dir = "auto"; r.appendChild(bb); if (e.cerceve) r.appendChild(el("span", "c", e.cerceve)); c5.appendChild(r); });
          iki.appendChild(c5);
        });
        d.appendChild(iki); n.appendChild(d);
      });
      ekle(n);
    }
    if (!TRM && s0.yayin_yakin.length) { const y = kisim(T("Yayınlar", "Outlets")); y.appendChild(el("p", null, T("En az dört başlığı ölçülen yayınlar arasında Filistin bakışına en yakın ve en uzak olanlar.", "Among outlets with at least four measured headlines, those closest to and furthest from the Palestinian perspective."))); y.appendChild(eksen(T("En yakın", "Closest"), s0.yayin_yakin)); y.appendChild(eksen(T("En uzak", "Furthest"), s0.yayin_uzak)); ekle(y); }
    s.appendChild(ks);
    if (a.veri_notu) s.appendChild(el("p", "dipnot", a.veri_notu));
    // araçlar
    const ar = el("div", "bolum-araclar");
    const yb = el("button", null, T("Bu bölümü yazdır", "Print this chapter")); yb.type = "button"; yb.onclick = () => window.print(); ar.appendChild(yb);
    if (x.tur !== "yillik") { const ab = el("button", null, T("Bütün ayı yazdır", "Print the whole month")); ab.type = "button"; ab.onclick = () => topluYazdir(SIRA.filter((z) => z.ay === x.ay && z.tur !== "yillik")); ar.appendChild(ab); }
    if (x.cilt) { const cb = el("button", null, T("Cildi yazdır (yıl ve aylar)", "Print the volume (year and months)")); cb.type = "button"; cb.onclick = () => topluYazdir(SIRA.filter((z) => z.cilt === x.cilt && z.tur !== "haftalik")); ar.appendChild(cb); }
    const ix = b.indir || {}; const kok = "data/bulten/" + b.tur + "/";
    if (!TRM) [[T("Metin (.md)", "Text (.md)"), kok + b.anahtar + ".md"], ix.zip && [T("Veri (CSV, .zip)", "Data (CSV, .zip)"), ix.zip], ix.png && [T("Paylaşım görseli (.png)", "Share image (.png)"), ix.png]].filter(Boolean).forEach(([l, h]) => { const v = el("a", null, l + " ↓"); v.href = h; v.setAttribute("download", ""); ar.appendChild(v); });
    s.appendChild(ar);
    // önceki / sonraki
    const sn = el("nav", "bolum-son"); sn.setAttribute("aria-label", T("Bölümler arası", "Between chapters"));
    const i = SIRA.indexOf(x);
    if (i > 0) { const p = SIRA[i - 1]; const l = el("a", "onceki"); l.href = hashOf(p); l.append(el("small", null, "← " + T("Bölüm ", "Chapter ") + p.no), el("b", null, baslik(p))); sn.appendChild(l); }
    if (i < SIRA.length - 1) { const nx = SIRA[i + 1]; const l = el("a", "sonraki"); l.href = hashOf(nx); l.append(el("small", null, T("Bölüm ", "Chapter ") + nx.no + " →"), el("b", null, baslik(nx))); sn.appendChild(l); }
    s.appendChild(sn);
    return s;
  }
  const getir = (x) => fetch("data/bulten/" + x.tur + "/" + x.anahtar + ".json?t=" + Date.parse(x.uretildi || 0)).then((r) => r.json());

  // ---------------------------------------------------------------- toplu yazdırma
  let yazdiriliyor = false;
  async function topluYazdir(liste) {
    if (yazdiriliyor || !liste.length) return; yazdiriliyor = true;
    masa.innerHTML = ""; masa.appendChild(el("p", "bos2", T(`${liste.length} bölüm hazırlanıyor…`, `Preparing ${liste.length} chapters…`)));
    try {
      const veriler = await Promise.all(liste.map(getir));
      masa.innerHTML = "";
      liste.forEach((x, j) => masa.appendChild(bolumCiz(x, veriler[j])));
      await new Promise((r) => setTimeout(r, 300));
      window.print();
    } catch (e) { masa.innerHTML = ""; masa.appendChild(el("p", "bos2", T("Bölümler okunamadı.", "Could not load the chapters."))); }
    yazdiriliyor = false;
    setTimeout(git, 400);
  }

  // ---------------------------------------------------------------- yönlendirme
  async function git() {
    if (yazdiriliyor) return;
    const h = location.hash || "#kapak";
    masa.innerHTML = "";
    if (h === "#kapak" || h === "#bu-kitap" || h === "#icindekiler") {
      yanCiz(h);
      masa.append(kapak(), buKitap(), icindekiler());
      if (h !== "#kapak") { const hedef = h === "#bu-kitap" ? masa.children[1] : masa.children[2]; hedef.scrollIntoView(); } else window.scrollTo(0, 0);
      return;
    }
    if (h === "#sessizlik") { yanCiz(h); masa.appendChild(sessizlikSayfa()); window.scrollTo(0, 0); return; }
    const m = /^#(haftalik|aylik|yillik)-(.+)$/.exec(h);
    const x = m && SIRA.find((y) => y.tur === m[1] && y.anahtar === m[2]);
    if (!x) { location.hash = "#kapak"; return; }
    yanCiz(h);
    masa.appendChild(el("p", "bos2", T("Yükleniyor…", "Loading…")));
    try { const b = await getir(x); if (location.hash !== h) return; masa.innerHTML = ""; masa.appendChild(bolumCiz(x, b)); window.scrollTo(0, 0); document.title = "ZBS Almanak · " + T("Bölüm ", "Chapter ") + x.no; }
    catch (e) { masa.innerHTML = ""; masa.appendChild(el("p", "bos2", T("Bölüm okunamadı.", "Could not load the chapter."))); }
  }
  window.addEventListener("hashchange", git);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { $("kanitPanel").hidden = true; yan.classList.remove("acik"); }
    if (e.target.closest && e.target.closest("input,textarea,select")) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const m = /^#(haftalik|aylik|yillik)-(.+)$/.exec(location.hash); const x = m && SIRA.find((y) => y.tur === m[1] && y.anahtar === m[2]); if (!x) return;
    const i = SIRA.indexOf(x) + (e.key === "ArrowRight" ? 1 : -1); if (SIRA[i]) location.hash = hashOf(SIRA[i]);
  });
  document.addEventListener("click", (e) => { const p = $("kanitPanel"); if (!p.hidden && !p.contains(e.target) && !e.target.closest(".kod,.sh-yer")) p.hidden = true; });

  const al = (u) => fetch(u + "?t=" + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  Promise.all([al("data/bulten/dizin.json"), al("data/bulten/alisma.json"), al("data/karne.json")]).then(([d, a, k]) => {
    dizin = d || []; ALISMA = a; KARNE = k;
    ((a && a.turler) || []).forEach((t) => { TUR_ADLARI[t.anahtar] = t.ad; });
    kur(dizin);
    if (!dizin.length) { masa.innerHTML = ""; masa.appendChild(el("p", "bos2", T("İlk bölüm toplayıcının bir sonraki çalışmasında yazılacak.", "The first chapter will be written on the collector’s next run."))); return; }
    git();
  });
})();
