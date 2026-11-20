// Düzeltme formu ucu: alborotonews.com/api/duzeltme (Cloudflare Worker).
// Formdan gelen bildirimi editöre Telegram botuyla iletir. Hiçbir şey saklamaz; IP adresi ne kaydedilir ne iletilir.
// Sırlar (Cloudflare'de, koda yazılmaz): TELEGRAM_BOT_TOKEN, TELEGRAM_YONETICI. Yayın: .github/workflows/duzeltme-worker.yml
const KOKEN = /^https:\/\/(www\.)?alborotonews\.com$/;
const TUR = { ceviri: "Çeviri / özet", atif: "Yanlış atıf", olcum: "Ölçüm", tarihce: "Tarihçe / kaynak", cevap: "Cevap hakkı", diger: "Diğer" };

function yanit(v, durum = 200) {
  return new Response(JSON.stringify(v), { status: durum, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}
const temiz = (s, n) => String(s || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);

export default {
  async fetch(istek, env) {
    const u = new URL(istek.url);
    if (u.pathname !== "/api/duzeltme") return new Response("Bulunamadı", { status: 404 });
    if (istek.method !== "POST") return yanit({ ok: false, hata: "yontem" }, 405);
    // yalnızca kendi sitemizden gelen gönderimler
    if (!KOKEN.test(istek.headers.get("Origin") || "")) return yanit({ ok: false, hata: "kaynak" }, 403);
    if (Number(istek.headers.get("content-length") || 0) > 16000) return yanit({ ok: false, hata: "buyuk" }, 413);
    let v;
    try { v = await istek.json(); } catch { return yanit({ ok: false, hata: "bicim" }, 400); }
    // tuzak alan: insanlar görmez, botlar doldurur; sessizce kabul et
    if (v.web) return yanit({ ok: true });
    // sayfa açılır açılmaz gönderilen formlar bot işidir
    const t = Number(v.t || 0);
    if (!t || Date.now() - t < 4000) return yanit({ ok: false, hata: "hizli" }, 400);
    const metin = temiz(v.metin, 3000);
    if (metin.length < 10) return yanit({ ok: false, hata: "kisa" }, 400);
    const sayfa = temiz(v.sayfa, 400), iletisim = temiz(v.iletisim, 200), h = temiz(v.h, 40);
    const tur = TUR[v.tur] || "Diğer";
    const ileti = "📝 Düzeltme bildirimi · " + tur + (v.dil === "en" ? " · EN" : "") + (h ? "\nHaber: " + h : "") + (sayfa ? "\nSayfa: " + sayfa : "")
      + "\n\n" + metin + (iletisim ? "\n\nYanıt için: " + iletisim : "\n\n(iletişim bırakılmadı)");
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_YONETICI) return yanit({ ok: false, hata: "ayar" }, 503);
    const r = await fetch("https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_YONETICI, text: ileti.slice(0, 4000), disable_web_page_preview: true })
    }).catch(() => null);
    return r && r.ok ? yanit({ ok: true }) : yanit({ ok: false, hata: "iletilemedi" }, 502);
  }
};
