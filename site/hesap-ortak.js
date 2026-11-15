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
  // "Hata bildir": haberin bilgileriyle doldurulmuş e-posta (adres site/marka.js "iletisim")
  function hataBildir(h, kad) {
    const adr = (window.MARKA && window.MARKA.iletisim) || "iletisim@alborotonews.com";
    const sayfa = location.origin + location.pathname.replace(/[^/]*$/, "") + "#h-" + h.id;
    const konu = (EN() ? "Correction request: " : "Düzeltme talebi: ") + (kad || "") + " · " + h.id;
    const govde = (EN() ? "Story: " : "Haber: ") + ((EN() ? h.baslik_en : h.baslik_tr) || h.baslik_orj || "") + "\n" + (EN() ? "Source link: " : "Kaynak bağlantısı: ") + (h.url || "") +
      "\n" + (EN() ? "Alboroto page: " : "Alboroto sayfası: ") + sayfa + "\n\n" + (EN() ? "What is wrong, and how do you know? (a link or document helps)\n" : "Yanlış olan ne ve nereden biliyorsunuz? (bağlantı ya da belge eklemek işi hızlandırır)\n");
    return "mailto:" + adr + "?subject=" + encodeURIComponent(konu) + "&body=" + encodeURIComponent(govde);
  }
  window.ZBSHesap = { KAMP, KAMP_RENK, kampAd, kampYaz, dilYaz, turYaz, kulAd, renk, avatar, takipler, takipte, takipDegis, takipDugme, profil, hataBildir };
})();
