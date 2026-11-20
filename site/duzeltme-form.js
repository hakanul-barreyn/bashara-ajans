// Düzeltme formu: /api/duzeltme adresindeki Cloudflare Worker'a gönderir (worker/duzeltme.js); Worker bildirimi editöre
// Telegram'dan iletir. Worker'a ulaşılamazsa okur aynı bilgilerle doldurulmuş e-postaya yönlendirilir; bildirim kaybolmaz.
// "Hata bildir" bağlantıları buraya ?sayfa=...&h=...&k=... ile gelir; alanlar doldurulur.
(function () {
  "use strict";
  var EN = window.DIL === "en";
  function T(a, b) { return EN ? b : a; }
  var q = new URLSearchParams(location.search);
  var acilis = Date.now();
  var adr = (window.MARKA && window.MARKA.iletisim) || "iletisim@alborotonews.com";
  document.querySelectorAll(".dz-form").forEach(function (f) {
    var sayfa = q.get("sayfa"), h = q.get("h"), k = q.get("k");
    if (sayfa) f.sayfa.value = sayfa;
    if (h || k) f.metin.placeholder = (k ? k + " · " : "") + (h ? h + " · " : "") + f.metin.placeholder;
    var durum = f.querySelector(".dz-durum"), dugme = f.querySelector("button[type=submit]");
    function yaz(m, sinif) { durum.textContent = m; durum.className = "dz-durum" + (sinif ? " " + sinif : ""); }
    function epostaYedek() {
      var govde = T("Tür: ", "Type: ") + f.tur.value + "\n" + T("Sayfa: ", "Page: ") + f.sayfa.value + "\n\n" + f.metin.value;
      var a = document.createElement("a");
      a.href = "mailto:" + adr + "?subject=" + encodeURIComponent(T("Düzeltme talebi", "Correction request") + (h ? " · " + h : "")) + "&body=" + encodeURIComponent(govde);
      a.textContent = adr;
      yaz(T("Form şu an gönderilemedi. Aynı bilgilerle e-posta gönderebilirsiniz: ", "The form could not be sent right now. You can send the same details by email: "), "hata");
      durum.appendChild(a);
    }
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var metin = f.metin.value.trim();
      if (metin.length < 10) { yaz(T("Lütfen neyin yanlış olduğunu birkaç kelimeyle yazın.", "Please describe what is wrong in a few words."), "hata"); f.metin.focus(); return; }
      dugme.disabled = true; yaz(T("Gönderiliyor…", "Sending…"));
      fetch("/api/duzeltme", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tur: f.tur.value, sayfa: f.sayfa.value.trim(), metin: metin, iletisim: f.iletisim.value.trim(), web: f.web.value, t: acilis, dil: EN ? "en" : "tr", h: h || "" })
      }).then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (v) { return { r: r, v: v }; }); })
        .then(function (x) {
          dugme.disabled = false;
          if (x.r.ok && x.v.ok) { f.reset(); yaz(T("Teşekkürler, bildiriminiz editöre ulaştı.", "Thank you, your report has reached the editor."), "tamam"); return; }
          if (x.v.hata === "hizli") { yaz(T("Çok hızlı gönderildi; birkaç saniye sonra yeniden deneyin.", "Sent too quickly; please try again in a few seconds."), "hata"); return; }
          if (x.r.status === 429) { yaz(T("Kısa sürede çok bildirim geldi; biraz sonra yeniden deneyin.", "Too many reports in a short time; please try again later."), "hata"); return; }
          epostaYedek();
        })
        .catch(function () { dugme.disabled = false; epostaYedek(); });
    });
  });
  if (q.get("sayfa") || q.get("h")) {
    var hedef = document.getElementById(EN ? "form-en" : "form");
    if (hedef) setTimeout(function () { hedef.scrollIntoView({ block: "start" }); }, 50);
  }
})();
