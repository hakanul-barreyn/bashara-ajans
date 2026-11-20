/* Hesaplar: her yayın bir hesap. Akış (uygulama.js) ve profil sayfası (sayfa-profil.js) ortak kullanır.
   Takip listesi yalnızca okurun cihazında (localStorage) durur; sunucuya hiçbir şey gitmez. */
(function () {
  "use strict";
  const KAMP = { "Filistin": "Filistin", "Meşrik": "Arap dünyası", "Körfez": "Arap dünyası", "Mısır": "Arap dünyası", "Mağrip": "Arap dünyası",
    "İran": "İran", "Yemen": "Yemen", "Anadolu-Türkiye": "Türkiye", "İsrail": "İsrail", "ABD": "Batı", "İngiltere": "Batı",
    "İspanya": "Batı", "İtalya": "Batı", "Almanya": "Batı", "Fransa": "Batı", "Asya ve diğer": "Diğer" };
  const KAMP_RENK = { "Filistin": "#2b8a5e", "Arap dünyası": "#8cc2a8", "İran": "#c39a35", "Yemen": "#8f6a2a", "Türkiye": "#c9544e", "İsrail": "#4a72c4",
    "İsrail’de muhalif basın": "#8a7bc0", "Batı": "#9aa3ab", "Diğer": "#6b746f" };
  const KAMP_EN = { "Filistin": "Palestine", "Arap dünyası": "Arab world", "İran": "Iran", "Yemen": "Yemen", "Türkiye": "Türkiye", "İsrail": "Israel",
    "İsrail’de muhalif basın": "Israeli dissident press", "Batı": "West", "Diğer": "Other" };
  const DIL_AD = { ar: ["Arapça", "Arabic"], en: ["İngilizce", "English"], tr: ["Türkçe", "Turkish"], he: ["İbranice", "Hebrew"], fa: ["Farsça", "Persian"],
    fr: ["Fransızca", "French"], es: ["İspanyolca", "Spanish"], it: ["İtalyanca", "Italian"], de: ["Almanca", "German"], ru: ["Rusça", "Russian"],
    ur: ["Urduca", "Urdu"], zh: ["Çince", "Chinese"], ms: ["Malayca", "Malay"], id: ["Endonezce", "Indonesian"], pt: ["Portekizce", "Portuguese"] };
  const TUR = { resmi: ["Devlet yayını", "State media"], grup: ["Bir harekete bağlı", "Movement-affiliated"], bagimsiz: ["Bağımsız", "Independent"],
    koop: ["Bağımsız (kooperatif)", "Independent (co-op)"], ozel: ["Özel", "Private"], izle: ["Özel", "Private"] };
  const EN = () => window.DIL === "en";
  // Bayraklar: İsrail merkezli yayınlar (muhalif basın, bayraksiz:true, hariç) ve kaynaklar.json'da bayrak alanı olanlar ("ae", "sa", "gb" ya da liste)
  const BAYRAK_SVG = { il: '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>', ae: '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="BAE yayını"><title>BAE yayını</title><rect width="22" height="16" rx="1.5" fill="#fff"/><path d="M6 0h14.5A1.5 1.5 0 0 1 22 1.5v3.8H6z" fill="#00732f"/><path d="M6 10.7h16v3.8a1.5 1.5 0 0 1-1.5 1.5H6z" fill="#000"/><path d="M1.5 0H6v16H1.5A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0z" fill="#c8102e"/><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="none" stroke="#c9d1cc" stroke-width=".5"/></svg>', gb: '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="Londra merkezli yayın"><title>Londra merkezli yayın (Birleşik Krallık)</title><rect width="22" height="16" rx="1.5" fill="#012169"/><path d="M0 0l22 16M22 0L0 16" stroke="#fff" stroke-width="3.2"/><path d="M0 0l22 16M22 0L0 16" stroke="#c8102e" stroke-width="1.3"/><path d="M11 0v16M0 8h22" stroke="#fff" stroke-width="5"/><path d="M11 0v16M0 8h22" stroke="#c8102e" stroke-width="3"/><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="none" stroke="#c9d1cc" stroke-width=".5"/></svg>', sa: '<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="Suudi Arabistan yayını"><title>Suudi Arabistan yayını</title><rect width="22" height="16" rx="1.5" fill="#006c35"/><path d="M5 6.2c1.2-.9 2.1.6 3.2-.2s2 .7 3.2-.1 2.1.6 3.3-.2 1.6.4 2.3.1" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round"/><path d="M5.5 10.6h10.5l1.4-.6" fill="none" stroke="#fff" stroke-width=".9" stroke-linecap="round"/><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="none" stroke="#c9d1cc" stroke-width=".5"/></svg>' };
  const bayrak = (k) => {
    if (!k) return "";
    const b = k.bayrak ? [].concat(k.bayrak) : (k.bolge === "İsrail" && !k.bayraksiz ? ["il"] : []);
    return b.map((x) => BAYRAK_SVG[x] || "").join("");
  };
  const kampAd = (k) => (k && (k.kamp || KAMP[k.bolge])) || "Diğer";
  const kampYaz = (k) => (EN() ? KAMP_EN[kampAd(k)] || kampAd(k) : kampAd(k));
  const dilYaz = (d) => (DIL_AD[d] || [d || "", d || ""])[EN() ? 1 : 0];
  const turYaz = (k) => (TUR[k.tur] || ["", ""])[EN() ? 1 : 0];
  // hesap adı: alan adından (aljazeera.net → @aljazeera)
  function kulAd(k) {
    try {
      const h = new URL(k.url).hostname.replace(/^www\./, "").replace(/^(english|arabic|en|ar|tr)\./, "");
      return "@" + h.split(".")[0];
    } catch (e) { return "@" + String(k.id); }
  }
  // hesabın rengi: kampın rengi, yayının kendi tonuyla biraz kaydırılmış (aynı kamptaki hesaplar ayırt edilsin)
  function renk(k) {
    const r = KAMP_RENK[kampAd(k)] || "#6b746f";
    const n = parseInt(String(k.id).replace(/\D/g, "") || "0", 10);
    return { ana: r, ton: (n * 47) % 360 };
  }
  function bas(ad) {
    const p = String(ad || "").replace(/^(The|Al|El|La|Le|Il|L’|Der|Die)[\s-]+/i, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/);
    return ((p[0] || "")[0] + ((p[1] || "")[0] || (p[0] || "")[1] || "")).toUpperCase();
  }
  function avatar(k, logolar, ek) {
    const a = document.createElement("div"); a.className = "avatar " + (k.tur || "") + (ek ? " " + ek : ""); a.textContent = bas(k.ad);
    const host = (() => { try { return new URL(k.url).hostname; } catch (e) { return ""; } })();
    const ddg = host && "https://icons.duckduckgo.com/ip3/" + host + ".ico";
    const AK = window.AKTAR || ((u) => u);
    const L = ((logolar || {})[k.id] || {}).url;
    const src = [L && AK(L, 96), ddg && AK(ddg, 96), k.bolge !== "İsrail" && ddg].filter(Boolean);
    if (src.length) {
      const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.referrerPolicy = "no-referrer"; img.decoding = "async";
      let i = 0; img.src = src[0];
      img.onerror = () => { i++; if (i < src.length) img.src = src[i]; else img.remove(); };
      img.onload = () => { if (img.naturalWidth < 8) img.onerror(); else a.classList.add("logolu"); };
      a.appendChild(img);
    }
    return a;
  }
  // takip (cihazda)
  const ANAHTAR = "zbs-takip";
  function takipler() { try { return JSON.parse(localStorage.getItem(ANAHTAR) || "[]").map(String); } catch (e) { return []; } }
  function takipte(id) { return takipler().includes(String(id)); }
  function takipDegis(id) {
    const t = takipler(), s = String(id), i = t.indexOf(s);
    if (i >= 0) t.splice(i, 1); else t.push(s);
    try { localStorage.setItem(ANAHTAR, JSON.stringify(t)); } catch (e) { /* özel pencere: bu oturumluk */ }
    document.dispatchEvent(new CustomEvent("zbs-takip", { detail: { id: s, takip: i < 0 } }));
    return i < 0;
  }
  function takipDugme(id, sinif) {
    const b = document.createElement("button"); b.type = "button"; b.className = "takip-dugme" + (sinif ? " " + sinif : "");
    const yaz = () => { const t = takipte(id); b.textContent = t ? (EN() ? "Following" : "Takipte") : (EN() ? "Follow" : "Takip et"); b.classList.toggle("takipte", t); b.setAttribute("aria-pressed", t); };
    b.onclick = (e) => { e.stopPropagation(); takipDegis(id); yaz(); };
    document.addEventListener("zbs-takip", (e) => { if (e.detail.id === String(id)) yaz(); });
    yaz(); return b;
  }
  const profil = (id) => "profil.html?k=" + encodeURIComponent(id);
  // "Hata bildir": düzeltme formu, haberin bağlantısıyla doldurulmuş (duzeltmeler.html; form gönderilemezse e-postaya yönlendirir)
  function hataBildir(h, kad) {
    const sayfa = location.origin + location.pathname.replace(/[^/]*$/, "") + "#h-" + h.id;
    return "duzeltmeler.html?" + new URLSearchParams({ sayfa: h.url ? sayfa + " · " + h.url : sayfa, h: h.id, k: kad || "" }).toString() + (EN() ? "#form-en" : "#form");
  }
  // Yeni taksim: grup, siyasi çizgi ve Filistin tutumu; her biri ⓘ ile kısa açıklamalı (site/taksim.json)
  let TX = null;
  const txHazir = fetch("site/taksim.json?v=1").then((r) => r.json()).then((d) => { TX = d; return d; }).catch(() => ({}));
  function taksimCip(k) {
    const kok = document.createElement("div"); kok.className = "tx-cipler";
    txHazir.then(() => {
      const L = EN() ? "en" : "tr", t = TX || {};
      const cip = (ad, acik, sinif) => {
        const c = document.createElement("span"); c.className = "tx-cip" + (sinif ? " " + sinif : ""); c.textContent = ad;
        if (acik) { const d = document.createElement("details"); d.className = "tx-bilgi"; const sm = document.createElement("summary"); sm.textContent = "i"; sm.setAttribute("aria-label", EN() ? "Info" : "Bilgi"); const sp = document.createElement("span"); sp.textContent = acik; d.append(sm, sp); c.appendChild(d); }
        kok.appendChild(c);
      };
      if (k.grup) cip(k.grup, ((t.grup || {})[k.grup] || {})[L]);
      if (k.siyasi && k.siyasi !== "belirsiz") cip(k.siyasi, ((t.siyasi || {})[k.siyasi] || {})[L]);
      if (k.tutum) {
        const ad = ((t.tutum_ad || {})[k.tutum] || {})[L] || k.tutum;
        const acik = [((t.tutum || {})[k.tutum] || {})[L], ((t.tutum || {})["_" + (k.tutum_dayanak || "editoryal")] || {})[L], L === "tr" ? k.tutum_not : ""].filter(Boolean).join(" ");
        cip(ad, acik, "tutum-" + k.tutum);
      } else if (k.tutum_dayanak === "bekliyor") cip(EN() ? "stance pending" : "tutum ölçülüyor", ((t.tutum || {})._bekliyor || {})[L]);
    });
    return kok;
  }
  window.ZBSHesap = { taksimCip, bayrak, KAMP, KAMP_RENK, kampAd, kampYaz, dilYaz, turYaz, kulAd, renk, avatar, takipler, takipte, takipDegis, takipDugme, profil, hataBildir };
})();
