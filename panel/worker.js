// Alboroto dosya paneli: panel.alborotonews.com (Cloudflare Worker).
// Giriş: Cloudflare Access (e-posta ile tek kullanımlık kod). Worker her istekte Access'in imzalı jetonunu ayrıca doğrular;
// Access kurulmamışsa ya da jeton geçersizse hiçbir şey göstermez (kapalı başlar).
// Okuma: veri dalındaki data/dosyalar.json. Yazma: "panel" dalındaki islemler.json'a işlem eklenir; toplayıcı bir sonraki turda uygular.
// Ortam: GH_TOKEN (gizli; yalnızca bu depoya içerik yazma yetkili GitHub anahtarı), ACCESS_TEAM (xxx.cloudflareaccess.com),
//        ACCESS_AUD (Access uygulamasının AUD etiketi), GH_REPO (wrangler.toml).

const TURLER = {
  oneri_onayla: ["oneri", "ad", "ad_en", "kapsam"],
  oneri_reddet: ["oneri"],
  dosya_ekle: ["ad", "ad_en", "kapsam"],
  dosya_duzenle: ["dosya", "ad", "ad_en", "kapsam"],
  dosya_kapat: ["dosya"],
  dosya_ac: ["dosya"],
  dal_duzenle: ["dosya", "dal", "ad", "ad_en"],
  dal_birlestir: ["dosya", "dal", "hedef"],
  dal_ekle: ["dosya", "ad", "ad_en"],
  olay_tasi: ["olay", "dosya", "dal", "yeni_dal", "eski_dosya"],
  olay_cikar: ["olay", "dosya"],
};

export default {
  async fetch(istek, env) {
    const url = new URL(istek.url);
    const kim = await kimlik(istek, env);
    if (!kim) return yanit("Giriş gerekli ya da panel kurulumu eksik.", 403, "text/plain; charset=utf-8");
    try {
      if (url.pathname === "/" && istek.method === "GET") return yanit(SAYFA, 200, "text/html; charset=utf-8");
      if (url.pathname === "/panel.js" && istek.method === "GET") return yanit(BETIK, 200, "text/javascript; charset=utf-8");
      if (url.pathname === "/api/durum" && istek.method === "GET") return json(await durum(env, kim));
      if (url.pathname === "/api/islem" && istek.method === "POST") {
        if (istek.headers.get("Origin") !== url.origin || !(istek.headers.get("Content-Type") || "").startsWith("application/json"))
          return json({ hata: "Geçersiz istek" }, 400);
        const g = await istek.json().catch(() => null);
        const isl = dogrula(g);
        if (!isl) return json({ hata: "İşlem tanınmadı" }, 400);
        isl.id = crypto.randomUUID();
        isl.zaman = new Date().toISOString();   // kim yaptığı (e-posta) kaydedilmez: panel dalı depoda durur
        await ekle(env, isl);
        return json({ tamam: true, islem: isl });
      }
      return yanit("Bulunamadı", 404, "text/plain; charset=utf-8");
    } catch (e) {
      return json({ hata: String(e && e.message || e).slice(0, 300) }, 500);
    }
  },
};

function yanit(govde, kod, tur) {
  return new Response(govde, {
    status: kod,
    headers: {
      "Content-Type": tur, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
const json = (v, kod = 200) => yanit(JSON.stringify(v), kod, "application/json; charset=utf-8");

// ---------------------------------------------------------------- Cloudflare Access jetonu
let ANAHTARLAR = null, ANAHTAR_ZAMAN = 0;
function b64url(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
async function kimlik(istek, env) {
  if (!env.ACCESS_TEAM || !env.ACCESS_AUD) return null;
  let jeton = istek.headers.get("Cf-Access-Jwt-Assertion");
  if (!jeton) { const m = (istek.headers.get("Cookie") || "").match(/(?:^|;\s*)CF_Authorization=([^;]+)/); jeton = m && m[1]; }
  if (!jeton) return null;
  const p = jeton.split(".");
  if (p.length !== 3) return null;
  let bas, yuk;
  try { bas = JSON.parse(new TextDecoder().decode(b64url(p[0]))); yuk = JSON.parse(new TextDecoder().decode(b64url(p[1]))); } catch (e) { return null; }
  if (bas.alg !== "RS256") return null;
  const takim = String(env.ACCESS_TEAM).replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (yuk.iss !== "https://" + takim) return null;
  const aud = Array.isArray(yuk.aud) ? yuk.aud : [yuk.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  const simdi = Date.now() / 1000;
  if (!yuk.exp || yuk.exp < simdi || (yuk.nbf && yuk.nbf > simdi + 60)) return null;
  if (!ANAHTARLAR || Date.now() - ANAHTAR_ZAMAN > 3600e3) {
    const r = await fetch("https://" + takim + "/cdn-cgi/access/certs");
    if (!r.ok) return null;
    ANAHTARLAR = (await r.json()).keys || []; ANAHTAR_ZAMAN = Date.now();
  }
  const jwk = ANAHTARLAR.find((k) => k.kid === bas.kid);
  if (!jwk) return null;
  const anahtar = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const tamam = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", anahtar, b64url(p[2]), new TextEncoder().encode(p[0] + "." + p[1]));
  return tamam ? (yuk.email || yuk.sub || "editör") : null;
}

// ---------------------------------------------------------------- GitHub
function gh(env, yol, secenek = {}) {
  return fetch("https://api.github.com/repos/" + env.GH_REPO + yol, {
    ...secenek,
    headers: { Authorization: "Bearer " + env.GH_TOKEN, "User-Agent": "alboroto-panel", "X-GitHub-Api-Version": "2022-11-28",
      Accept: secenek.ham ? "application/vnd.github.raw+json" : "application/vnd.github+json", ...(secenek.headers || {}) },
  });
}
async function hamOku(env, yol, dal) {
  const r = await gh(env, "/contents/" + yol + "?ref=" + dal, { ham: true });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub okuma hatası " + r.status);
  return JSON.parse(await r.text());
}
function b64(s) {
  const b = new TextEncoder().encode(s); let t = "";
  for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(t);
}
async function ekle(env, isl) {
  for (let deneme = 0; deneme < 3; deneme++) {
    const r = await gh(env, "/contents/islemler.json?ref=panel");
    let liste = [], sha;
    if (r.ok) {
      const v = await r.json(); sha = v.sha;
      liste = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(v.content.replace(/\n/g, "")), (c) => c.charCodeAt(0))));
    } else if (r.status !== 404) throw new Error("GitHub okuma hatası " + r.status);
    liste.push(isl);
    liste = liste.slice(-500);
    const p = await gh(env, "/contents/islemler.json", {
      method: "PUT",
      body: JSON.stringify({ message: "Panel: " + isl.tur, content: b64(JSON.stringify(liste, null, 1)), branch: "panel", ...(sha ? { sha } : {}),
        committer: { name: "alboroto-panel", email: "panel@users.noreply.github.com" } }),
    });
    if (p.ok) return;
    if (p.status !== 409 && p.status !== 422) throw new Error("GitHub yazma hatası " + p.status);
  }
  throw new Error("Aynı anda başka bir değişiklik yazıldı; yeniden deneyin.");
}

// ---------------------------------------------------------------- veri
async function durum(env, kim) {
  const [d, isl] = await Promise.all([hamOku(env, "data/dosyalar.json", "veri"), hamOku(env, "islemler.json", "panel").catch(() => [])]);
  if (!d) return { kim, dosyalar: [], oneriler: [], olaylar: {}, bekleyen: [] };
  const islenen = new Set(d.islenen || []);
  const esik = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  const olaylar = {};
  for (const [k, o] of Object.entries(d.olaylar || {})) {
    if ((o.yer && o.yer.length) || o.oneride) { if ((o.g || "") >= esik || o.oneride) olaylar[k] = { b: o.b, g: o.g, k: o.k, yer: o.yer || [], gerekce: o.gerekce, elle: !!o.elle }; }
  }
  return {
    kim, dosyalar: d.dosyalar.map((x) => ({ id: x.id, ad: x.ad, ad_en: x.ad_en, kapsam: x.kapsam, durum: x.durum, dallar: x.dallar.map((y) => ({ id: y.id, ad: y.ad, ad_en: y.ad_en })) })),
    oneriler: (d.oneriler || []).filter((p) => p.durum === "bekliyor"), olaylar,
    bekleyen: (isl || []).filter((i) => !islenen.has(i.id)).slice(-50),
  };
}

function dogrula(g) {
  if (!g || typeof g !== "object" || !TURLER[g.tur]) return null;
  const isl = { tur: g.tur };
  for (const a of TURLER[g.tur]) {
    if (g[a] == null || g[a] === "") continue;
    if (typeof g[a] !== "string" || g[a].length > (a === "kapsam" ? 400 : 120)) return null;
    isl[a] = g[a].replace(/[\u0000-\u001f​-‏‪-‮]/g, " ").trim();
  }
  const zorunlu = { oneri_onayla: ["oneri"], oneri_reddet: ["oneri"], dosya_ekle: ["ad", "kapsam"], dosya_duzenle: ["dosya"], dosya_kapat: ["dosya"],
    dosya_ac: ["dosya"], dal_duzenle: ["dosya", "dal"], dal_birlestir: ["dosya", "dal", "hedef"], dal_ekle: ["dosya", "ad"], olay_tasi: ["olay", "dosya"], olay_cikar: ["olay", "dosya"] }[g.tur];
  return zorunlu.every((a) => isl[a]) ? isl : null;
}

// ---------------------------------------------------------------- arayüz
const SAYFA = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><title>Alboroto · Dosya paneli</title><style>
:root{--z:#faf8f4;--k:#fff;--m:#141816;--i2:#2f3532;--s:#5d6560;--c:#e3dfd6;--y:#1f6e4b;--r:#b3261e;--yz:#f1eee7;color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--z);color:var(--m);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--z);border-bottom:1px solid var(--c);padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left));display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header b{font-weight:800;letter-spacing:.05em;text-transform:uppercase}header span{color:var(--s);font-size:.85rem}header .kim{margin-left:auto}
main{max-width:900px;margin:0 auto;padding:18px max(16px,env(safe-area-inset-right)) 80px max(16px,env(safe-area-inset-left));display:grid;gap:26px}
h2{margin:0 0 10px;font-size:1.15rem}h3{margin:0;font-size:1rem}
.kart{background:var(--k);border:1px solid var(--c);border-radius:10px;padding:14px;display:grid;gap:10px}
.not{color:var(--s);font-size:.85rem;margin:0}
label{display:grid;gap:4px;font-size:.8rem;color:var(--s)}
input,textarea,select{font:inherit;color:var(--m);background:var(--z);border:1px solid var(--c);border-radius:8px;padding:8px 10px;width:100%}
textarea{min-height:64px;resize:vertical}
button{font:600 .88rem system-ui,sans-serif;border:1px solid var(--m);background:var(--m);color:#fff;border-radius:999px;padding:8px 14px;cursor:pointer}
button.ikincil{background:transparent;color:var(--m)}button.tehlike{border-color:var(--r);background:transparent;color:var(--r)}
button:disabled{opacity:.5;cursor:wait}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--y);outline-offset:2px}
.sira{display:flex;flex-wrap:wrap;gap:8px;align-items:end}.sira>label{flex:1 1 200px}
details{background:var(--k);border:1px solid var(--c);border-radius:10px}summary{cursor:pointer;padding:12px 14px;font-weight:700;display:flex;justify-content:space-between;gap:10px}
summary small{color:var(--s);font-weight:500}details>div{padding:0 14px 14px;display:grid;gap:14px}
.dal{border-top:1px solid var(--c);padding-top:12px;display:grid;gap:8px}
.olay{display:grid;grid-template-columns:70px 1fr;gap:4px 10px;font-size:.88rem;padding:6px 0;border-bottom:1px dashed var(--c)}
.olay time{color:var(--s);font-size:.78rem}.olay .ey{grid-column:2;display:flex;flex-wrap:wrap;gap:6px}
.olay .ey button{padding:4px 10px;font-size:.78rem}
.bilgi{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:var(--m);color:#fff;padding:10px 16px;border-radius:999px;font-size:.88rem;max-width:90vw}
.bekleyen li{font-size:.85rem;color:var(--i2)}
</style></head><body><header><b>Alboroto</b><span>Dosya paneli</span><span class="kim" id="kim"></span></header>
<main id="ana"><p class="not">Yükleniyor…</p></main><div class="bilgi" id="bilgi" hidden></div><script src="/panel.js"></script></body></html>`;

const BETIK = `(function(){"use strict";
var D=null,ana=document.getElementById("ana");
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function bilgi(m){var b=document.getElementById("bilgi");b.textContent=m;b.hidden=false;clearTimeout(bilgi.t);bilgi.t=setTimeout(function(){b.hidden=true},4000)}
function alan(etiket,deger,cok){var l=el("label",null,etiket),i=el(cok?"textarea":"input");i.value=deger||"";l.appendChild(i);l.girdi=i;return l}
function dugme(ad,sinif,f){var b=el("button",sinif||null,ad);b.type="button";b.onclick=function(){b.disabled=true;Promise.resolve(f()).finally(function(){b.disabled=false})};return b}
function gonder(isl){return fetch("/api/islem",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(isl)}).then(function(r){return r.json().then(function(v){if(!r.ok)throw new Error(v.hata||r.status);return v})}).then(function(){bilgi("Kaydedildi. Bir sonraki turda (en geç 15 dakika) siteye yansır.");return yukle()}).catch(function(e){bilgi("Kaydedilemedi: "+e.message)})}
function gk(g){var A=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"],p=(g||"").split("-");return p.length===3?+p[2]+" "+A[+p[1]-1]:g}
function dalSec(secili){var s=el("select");D.dosyalar.forEach(function(ds){if(ds.durum!=="acik")return;var og=el("optgroup");og.label=ds.ad;ds.dallar.forEach(function(d){var o=el("option",null,d.ad);o.value=ds.id+"|"+d.id;if(secili===o.value)o.selected=true;og.appendChild(o)});var y=el("option",null,"+ yeni dal…");y.value=ds.id+"|";og.appendChild(y);s.appendChild(og)});return s}
function olaySatir(k,o,ds){var r=el("div","olay");r.appendChild(el("time",null,gk(o.g)+" · "+(o.k||2)+" yayın"));r.appendChild(el("span",null,o.b+(o.elle?" (elle)":"")));
 var ey=el("div","ey"),sec=null;ey.appendChild(dugme("Taşı","ikincil",function(){if(!sec){sec=dalSec(ds.id+"|"+((o.yer.find(function(y){return y[0]===ds.id})||[])[1]||""));ey.insertBefore(sec,ey.firstChild);bilgi("Hedef dalı seç, yeniden Taşı'ya bas.");return}var v=sec.value.split("|"),yeni="";if(!v[1]){yeni=(prompt("Yeni dalın adı")||"").trim();if(!yeni)return}
   return gonder({tur:"olay_tasi",olay:k,dosya:v[0],dal:v[1]||"",yeni_dal:yeni||"",eski_dosya:ds.id})}));
 ey.appendChild(dugme("Dosyadan çıkar","tehlike",function(){return gonder({tur:"olay_cikar",olay:k,dosya:ds.id})}));r.appendChild(ey);return r}
function ciz(){ana.innerHTML="";document.getElementById("kim").textContent=D.kim||"";
 // öneriler
 var s1=el("section");s1.appendChild(el("h2",null,"Dosya önerileri ("+D.oneriler.length+")"));
 if(!D.oneriler.length)s1.appendChild(el("p","not","Bekleyen öneri yok. Motor, hiçbir dosyaya girmeyen ama aynı hikâyeye ait en az üç olay görünce öneri yapar."));
 D.oneriler.forEach(function(p){var k=el("div","kart"),a=alan("Ad",p.ad),ae=alan("İngilizce ad",""),kp=alan("Kapsam (motor bu cümleye bakarak olay yerleştirir)",p.kapsam,true);
  k.append(a,ae,kp);if(p.gerekce)k.appendChild(el("p","not","Gerekçe: "+p.gerekce));var ul=el("ul");(p.olaylar||[]).forEach(function(x){var o=D.olaylar[x];if(o)ul.appendChild(el("li",null,gk(o.g)+" · "+o.b))});k.appendChild(ul);
  var sr=el("div","sira");sr.append(dugme("Onayla",null,function(){return gonder({tur:"oneri_onayla",oneri:p.id,ad:a.girdi.value,ad_en:ae.girdi.value,kapsam:kp.girdi.value})}),dugme("Reddet","tehlike",function(){return gonder({tur:"oneri_reddet",oneri:p.id})}));k.appendChild(sr);s1.appendChild(k)});
 ana.appendChild(s1);
 // dosyalar
 var s2=el("section");s2.appendChild(el("h2",null,"Dosyalar"));
 D.dosyalar.forEach(function(ds){var d=el("details"),sm=el("summary");sm.append(el("span",null,ds.ad),el("small",null,(ds.durum==="acik"?"":"kapalı · ")+ds.dallar.length+" dal"));d.appendChild(sm);var ic=el("div");
  var a=alan("Ad",ds.ad),ae=alan("İngilizce ad",ds.ad_en),kp=alan("Kapsam",ds.kapsam,true);ic.append(a,ae,kp);
  var sr=el("div","sira");sr.append(dugme("Kaydet",null,function(){return gonder({tur:"dosya_duzenle",dosya:ds.id,ad:a.girdi.value,ad_en:ae.girdi.value,kapsam:kp.girdi.value})}),
   ds.durum==="acik"?dugme("Dosyayı kapat","tehlike",function(){return gonder({tur:"dosya_kapat",dosya:ds.id})}):dugme("Yeniden aç","ikincil",function(){return gonder({tur:"dosya_ac",dosya:ds.id})}));ic.appendChild(sr);
  ic.appendChild(el("p","not","Adres değişmez: d/"+ds.id+".html"));
  ds.dallar.forEach(function(dl){var b=el("div","dal"),da=alan("Dal adı",dl.ad),dae=alan("İngilizce",dl.ad_en),r=el("div","sira");r.append(da,dae,dugme("Kaydet",null,function(){return gonder({tur:"dal_duzenle",dosya:ds.id,dal:dl.id,ad:da.girdi.value,ad_en:dae.girdi.value})}));b.appendChild(r);
   var hedef=el("select");ds.dallar.forEach(function(x){if(x.id!==dl.id){var o=el("option",null,x.ad);o.value=x.id;hedef.appendChild(o)}});
   if(hedef.options.length){var bl=el("label",null,"Bu dalı şununla birleştir");bl.appendChild(hedef);var r2=el("div","sira");r2.append(bl,dugme("Birleştir","ikincil",function(){return gonder({tur:"dal_birlestir",dosya:ds.id,dal:dl.id,hedef:hedef.value})}));b.appendChild(r2)}
   var ol=Object.keys(D.olaylar).filter(function(k){return D.olaylar[k].yer.some(function(y){return y[0]===ds.id&&y[1]===dl.id})}).sort(function(x,y){return(D.olaylar[y].g||"").localeCompare(D.olaylar[x].g||"")});
   ol.slice(0,15).forEach(function(k){b.appendChild(olaySatir(k,D.olaylar[k],ds))});if(ol.length>15)b.appendChild(el("p","not","+"+(ol.length-15)+" eski olay"));ic.appendChild(b)});
  var yd=alan("Yeni dal adı","");var r3=el("div","sira");r3.append(yd,dugme("Dal ekle","ikincil",function(){return gonder({tur:"dal_ekle",dosya:ds.id,ad:yd.girdi.value})}));ic.appendChild(r3);
  d.appendChild(ic);s2.appendChild(d)});
 ana.appendChild(s2);
 // yeni dosya
 var s3=el("section"),k=el("div","kart"),ya=alan("Ad",""),yae=alan("İngilizce ad",""),yk=alan("Kapsam",""," ");k.append(ya,yae,yk,dugme("Dosya aç",null,function(){if(!ya.girdi.value||!yk.girdi.value){bilgi("Ad ve kapsam gerekli.");return}return gonder({tur:"dosya_ekle",ad:ya.girdi.value,ad_en:yae.girdi.value,kapsam:yk.girdi.value})}));
 s3.append(el("h2",null,"Elle yeni dosya"),k);ana.appendChild(s3);
 // bekleyen
 var s4=el("section");s4.appendChild(el("h2",null,"Sırada bekleyen değişiklikler ("+D.bekleyen.length+")"));var ul=el("ul","bekleyen");D.bekleyen.forEach(function(i){ul.appendChild(el("li",null,new Date(i.zaman).toLocaleString("tr-TR")+" · "+i.tur+" · "+(i.ad||i.dal||i.olay||i.oneri||i.dosya||"")))});s4.appendChild(ul);s4.appendChild(el("p","not","Toplayıcı her turda (yaklaşık 15 dakikada bir) bu listeyi uygular."));ana.appendChild(s4)}
function yukle(){return fetch("/api/durum").then(function(r){if(!r.ok)throw new Error(r.status);return r.json()}).then(function(v){D=v;ciz()}).catch(function(e){ana.innerHTML="";ana.appendChild(el("p","not","Veri alınamadı: "+e.message))})}
yukle()})();`;
