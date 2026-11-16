/* Haber sayfası (haber.html): Alboroto'nun metni, altında "haberin haberi".
   haber.html?o=<olay no>  → gündem olayı; data/yazi/<olay no>.json varsa kendi metnimiz
   haber.html?h=<no,no,…>  → telefon akışındaki bir hikâye; metin yoksa kaynak özetlerinden derleme */
(function () {
  "use strict";
  const H = window.ZBSHesap, EN = window.DIL === "en", YR = EN ? "en-GB" : "tr-TR";
  const tt = (tr, en) => (EN ? en : tr);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const kok = document.getElementById("yazi");
  const q = new URLSearchParams(location.search);
  const j = (u, v) => fetch(u, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : v)).catch(() => v);
  const BT = (h) => (EN ? h.baslik_en : h.baslik_tr) || h.baslik_en || h.baslik_orj;
  const OZ = (h) => (EN ? h.ozet_en : h.ozet_tr) || "";
  const saat = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString(YR, { hour: "2-digit", minute: "2-digit" }); };
  const tarih = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString(YR, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }); };
  const AK = window.AKTAR || ((u) => u);
  const pd = document.getElementById("paylas");
  if (pd) pd.onclick = () => { const u = location.href; if (navigator.share) navigator.share({ title: document.title, url: u }).catch(() => {}); else if (navigator.clipboard) navigator.clipboard.writeText(u).catch(() => {}); };

  Promise.all([window.ALB_BOLGE ? window.ALB_BOLGE.hazir : null]).then(() => Promise.all([
    j("kaynaklar.json", []), j("data/haberler-akis.json", null), j("data/gundem.json", { olaylar: [] }),
    q.get("o") ? j("data/yazi/" + encodeURIComponent(q.get("o")) + ".json", null) : null,
  ])).then(async ([K, akis, gundem, yazi]) => {
    const kmap = {}; K.forEach((k) => { kmap[k.id] = k; });
    const olay = q.get("o") ? (gundem.olaylar || []).find((o) => o.id === q.get("o")) : null;
    let ids = (yazi && yazi.haberler) || (olay && olay.haberler) || (q.get("h") || "").split(",").filter(Boolean);
    ids = ids.slice(0, 40);
    let hab = (akis && akis.haberler) || [];
    let bul = () => ids.map((i) => hab.find((h) => h.id === i)).filter(Boolean);
    let xs = bul();
    if (xs.length < ids.length) { const tam = await j("data/haberler.json", null); if (tam && tam.haberler) { hab = tam.haberler; xs = bul(); } }
    xs = xs.filter((h) => kmap[h.kaynak] && !(window.ALB_BOLGE && window.ALB_BOLGE.gizli(kmap[h.kaynak])));
    if (!xs.length) { kok.textContent = ""; kok.appendChild(el("p", "hb-bos", tt("Bu haber artık listede değil. Ana sayfaya dönebilirsin.", "This story is no longer listed."))); return; }
    xs.sort((a, b) => Date.parse(a.tarih) - Date.parse(b.tarih));
    const yayinlar = [...new Set(xs.map((h) => h.kaynak))];
    const bolgeMi = (k) => ["Filistin", "Arap dünyası", "İran", "Yemen", "Türkiye"].includes(H.kampAd(k));
    // derlemede öne: bölge basını, sonra ötekiler; her yayından bir haber (en dolu özeti olan)
    const tekil = [];
    yayinlar.forEach((kid) => { const ys = xs.filter((h) => h.kaynak === kid); tekil.push(ys.sort((a, b) => OZ(b).length - OZ(a).length)[0]); });
    tekil.sort((a, b) => (bolgeMi(kmap[b.kaynak]) - bolgeMi(kmap[a.kaynak])) || (Date.parse(a.tarih) - Date.parse(b.tarih)));
    const ilk = xs[0], son = xs[xs.length - 1];
    const baslik = (yazi && !EN && yazi.baslik) || (olay && ((EN && olay.baslik_en) || olay.baslik)) || BT(tekil[0]);
    document.title = baslik + " · " + ((window.MARKA && window.MARKA.ad) || "Alboroto");
    kok.textContent = "";
    const mak = el("article", "hb-makale");
    const bas = el("div", "hb-bas");
    const yer = (yazi && yazi.yer_ad) || (olay && olay.yer_ad);
    bas.appendChild(el("span", "hb-et", (yer ? yer + " · " : "") + tt("Haber", "Story"))).style.color = "#2b8a5e";
    bas.appendChild(el("h1", null, baslik));
    const spot = (yazi && !EN && yazi.spot) || (olay && ((EN && olay.not_en) || (!EN && olay.not))) || "";
    if (spot) bas.appendChild(el("p", "hb-spot", spot));
    const yazili = !!(yazi && yazi.baslik && !EN);
    const meta = el("p", "hb-meta");
    meta.textContent = tarih((yazi && yazi.yazildi) || son.tarih) + ((yazi && yazi.surum > 1) ? " · " + tt("güncellendi ", "updated ") + saat(yazi.guncellendi) : "");
    meta.appendChild(document.createElement("br"));
    meta.appendChild(document.createTextNode(yayinlar.length + tt(" yayından derlendi · ", " outlets · ") +
      (yazili ? tt("yapay zekâyla yazıldı", "written with AI") : tt("kaynakların özetleri, yapay zekâ çevirisi", "outlets’ summaries, AI-translated"))));
    bas.appendChild(meta);
    mak.appendChild(bas);
    // görsel: açık lisanslı (gündem görseli) tam; yoksa yayının küçük önizlemesi
    const gor = (yazi && yazi.gorsel) || (olay && olay.gorsel);
    if (gor) {
      const f = el("figure", "hb-gorsel"); const im = document.createElement("img"); im.src = AK(gor, 960); im.alt = ""; im.referrerPolicy = "no-referrer"; im.onerror = () => f.remove();
      f.appendChild(im); const at = (yazi && yazi.gorsel_atif) || (olay && olay.gorsel_atif); if (at) f.appendChild(el("figcaption", null, at)); mak.appendChild(f);
    }
    const gv = el("div", "hb-govde");
    const atifCiz = (liste) => {
      const a = el("p", "hb-atif"); a.appendChild(document.createTextNode(tt("Kaynak: ", "Source: ")));
      liste.forEach((x) => { const k = kmap[x.k]; if (!k || (window.ALB_BOLGE && window.ALB_BOLGE.gizli(k))) return; const l = el("a", null, k.ad); l.href = x.u; l.target = "_blank"; l.rel = "noopener"; a.appendChild(l); });
      return a;
    };
    if (yazili) {
      yazi.paragraflar.forEach((p) => { gv.appendChild(el("p", null, p.metin)); gv.appendChild(atifCiz(p.kaynaklar)); });
      if (yazi.baglam) { gv.appendChild(el("h2", null, tt("Bağlam", "Context"))); gv.appendChild(el("p", null, yazi.baglam.metin)); gv.appendChild(atifCiz(yazi.baglam.kaynaklar)); }
    } else {
      gv.appendChild(el("h2", null, tt("Kaynaklar ne diyor", "What the outlets report")));
      tekil.slice(0, 8).forEach((h) => {
        const k = kmap[h.kaynak]; const d = el("div", "hb-derleme");
        const u = el("span", "hb-derleme-u"); { const bb = el("b", null, k.ad); const f = H.bayrak ? H.bayrak(k) : ""; if (f) bb.insertAdjacentHTML("afterbegin", f); u.appendChild(bb); } u.appendChild(document.createTextNode(" · " + H.kampYaz(k) + " · " + saat(h.tarih))); d.appendChild(u);
        d.appendChild(el("p", null, OZ(h) || BT(h)));
        const l = el("a", null, tt("Habere git ↗", "Open story ↗")); l.href = h.url; l.target = "_blank"; l.rel = "noopener"; l.className = "hb-derleme-u"; l.style.color = "#1f6e4b";
        d.appendChild(l); gv.appendChild(d);
      });
    }
    mak.appendChild(gv);
    const nas = el("div", "hb-nasil");
    nas.appendChild(el("b", "hb-et", tt("Bu haber nasıl yazıldı", "How this story was written"))).style.color = "#5d6560";
    nas.appendChild(el("span", null, yazili
      ? tt("Alboroto bu metni aşağıdaki " + yayinlar.length + " yayının haberlerinden yapay zekâ yardımıyla derledi. Her bilgi kaynağıyla birlikte verilir; kaynaklarda olmayan bilgi eklenmez. Hata görürsen bildir, düzeltip düzeltmeyi kayda geçiriyoruz.",
        "Alboroto compiled this text with AI from the " + yayinlar.length + " outlets below. Every fact comes with its source.")
      : tt("Bu hikâye için henüz kendi metnimiz yok. Yukarıda her yayının haberinin yapay zekâyla çevrilmiş özetini, yayının adıyla veriyoruz; özetler yayınların kendi anlatımıdır.",
        "We have not written our own text for this story yet. Above are AI-translated summaries of each outlet’s report, in their own framing.")));
    const bg = el("span", "hb-baglar");
    const hb = el("a", null, tt("Hata bildir", "Report an error")); hb.href = H.hataBildir(tekil[0], kmap[tekil[0].kaynak].ad); bg.appendChild(hb);
    const ym = el("a", null, tt("Yöntem", "Method")); ym.href = "yontem.html"; bg.appendChild(ym);
    const dz = el("a", null, tt("Düzeltmeler", "Corrections")); dz.href = "duzeltmeler.html"; bg.appendChild(dz);
    nas.appendChild(bg); mak.appendChild(nas);
    kok.appendChild(mak);
    // haberin haberi
    const kb = el("section", "hb-koyu"); kb.setAttribute("aria-label", tt("Haberin haberi", "The news about the news"));
    const ic = el("div", "hb-koyu-ic"); kb.appendChild(ic);
    ic.appendChild(el("span", "hb-et", tt("Haberin haberi", "The news about the news")));
    ic.appendChild(el("h2", null, tt("Bu haberi kim nasıl verdi?", "Who reported this, and how?")));
    const say = {}; yayinlar.forEach((kid) => { const a = H.kampAd(kmap[kid]); say[a] = (say[a] || 0) + 1; });
    const sira = Object.keys(say).sort((a, b) => say[b] - say[a]);
    const ser = el("div", "hb-serit"); ser.setAttribute("aria-hidden", "true");
    sira.forEach((a) => { const i = el("i"); i.style.flex = say[a]; i.style.background = H.KAMP_RENK[a] || "#6b746f"; ser.appendChild(i); });
    ic.appendChild(ser);
    const dag = el("div", "hb-dag");
    sira.forEach((a) => { const s = el("span"); const i = el("i"); i.style.background = H.KAMP_RENK[a] || "#6b746f"; s.append(i, document.createTextNode((EN ? ({ "Filistin": "Palestine", "Arap dünyası": "Arab world", "İran": "Iran", "Türkiye": "Türkiye", "İsrail": "Israel", "Batı": "West", "Yemen": "Yemen", "Diğer": "Other" }[a] || a) : a) + " " + say[a])); dag.appendChild(s); });
    if (!say["İsrail"] && !say["Batı"]) dag.appendChild(el("span", "yok", tt("İzlediğimiz İsrail ve Batı yayınlarında yok", "Not in the Israeli and Western outlets we can read")));
    ic.appendChild(dag);
    const sy = el("div", "hb-sayilar");
    const fark = (Date.parse(son.tarih) - Date.parse(ilk.tarih)) / 36e5;
    [[String(yayinlar.length), tt("Hesap", "Accounts")], [String(sira.length), tt("Kamp", "Camps")],
      [(fark < 1 ? Math.round(fark * 60) + tt(" dk", " min") : fark.toLocaleString(YR, { maximumFractionDigits: 1 }) + tt(" sa", " h")), tt("İlkten sona", "First to last")]]
      .forEach(([b, s]) => { const d = el("div"); d.append(el("b", null, b), el("span", null, s)); sy.appendChild(d); });
    ic.appendChild(sy);
    const ul = el("ul", "hb-liste");
    tekil.slice().sort((a, b) => Date.parse(a.tarih) - Date.parse(b.tarih)).forEach((h) => {
      const k = kmap[h.kaynak]; const li = el("li"); const a = el("a"); a.href = h.url; a.target = "_blank"; a.rel = "noopener";
      const u = el("span", "hb-l-u"); { const bb = el("b", null, k.ad); const f = H.bayrak ? H.bayrak(k) : ""; if (f) bb.insertAdjacentHTML("afterbegin", f); u.appendChild(bb); } u.appendChild(document.createTextNode(" · " + H.kampYaz(k) + " · " + saat(h.tarih)));
      a.append(u, el("span", "hb-l-b", BT(h))); li.appendChild(a); ul.appendChild(li);
    });
    ic.appendChild(ul);
    const git = el("a", "hb-git", tt("Akışta karşılaştır →", "Compare in the feed →")); git.href = "./#h-" + encodeURIComponent(tekil[0].id);
    ic.appendChild(git);
    document.body.appendChild(kb);
  });
})();
