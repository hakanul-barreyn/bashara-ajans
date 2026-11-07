// arsiv.html sayfasının kodu (güvenlik politikası satır içi kodu yasakladığı için ayrı dosyada)
(function(){
  const $=(i)=>document.getElementById(i);
  const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
  let gun=null, kayitlar=[], ara="", konu="";
  const gunAd=(g)=>new Date(g+"T12:00:00Z").toLocaleDateString("tr-TR",{day:"numeric",month:"long",weekday:"short"});
  function ciz(){
    const k=$("kayitlar"); k.innerHTML="";
    const liste=kayitlar.filter(x=>(!konu||(x.etiket||[]).includes(konu))&&(!ara||[x.baslik_tr,x.ozet_tr,x.kaynak_ad].join(" ").toLocaleLowerCase("tr").includes(ara)));
    $("durum").textContent=gunAd(gun)+" · "+liste.length+" haber";
    liste.forEach(x=>{
      const r=el("article","kayit"); r.id="h-"+x.id;
      r.appendChild(el("div","saat",new Date(x.tarih).toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"})));
      const ic=el("div","ic");
      ic.appendChild(el("span","kaynak",x.kaynak_ad+((x.etiket||[]).length?" · #"+x.etiket.join(" #"):"")));
      ic.appendChild(el("h2",null,x.baslik_tr)); ic.appendChild(el("p",null,x.ozet_tr));
      const e=el("div","eylemler");
      const a=el("a","eylem ana","Kaynağa git ↗");a.href=x.url;a.target="_blank";a.rel="noopener";e.appendChild(a);
      const w=el("a","eylem"+(x.arsiv?" arsivli":""),x.arsiv?"Arşivlendi ✓":"Wayback’te ara");w.href=x.arsiv||("https://web.archive.org/web/*/"+x.url);w.target="_blank";w.rel="noopener";e.appendChild(w);
      ic.appendChild(e); r.appendChild(ic); k.appendChild(r);
    });
    if(!liste.length) k.appendChild(el("p","bos","Bu günde eşleşen haber yok."));
  }
  async function gunAc(g){
    gun=g; history.replaceState(null,"","#gun-"+g);
    document.querySelectorAll("#gunler button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.g===g));
    $("durum").textContent="Yükleniyor…";
    try{ kayitlar=await fetch("data/arsiv/"+g+".json?t="+Date.now()).then(r=>r.json()); }catch(e){ kayitlar=[]; }
    const konular=new Set(); kayitlar.forEach(x=>(x.etiket||[]).forEach(t=>konular.add(t)));
    const s=$("konu"); const onceki=s.value; s.innerHTML='<option value="">Tüm konular</option>';
    [...konular].sort((a,b)=>a.localeCompare(b,"tr")).forEach(t=>{const o=el("option",null,t);o.value=t;s.appendChild(o);});
    s.value=konular.has(onceki)?onceki:""; konu=s.value; ciz();
  }
  fetch("data/arsiv/dizin.json?t="+Date.now()).then(r=>r.json()).then(d=>{
    const n=$("gunler");
    if(!d.length){$("durum").textContent="Arşiv henüz boş. İlk özetler yazıldıkça burada birikecek.";return;}
    d.forEach(x=>{const b=el("button");b.type="button";b.dataset.g=x.gun;b.appendChild(el("span",null,gunAd(x.gun)));b.appendChild(el("span","n",x.sayi));b.onclick=()=>gunAc(x.gun);n.appendChild(b);});
    const m=/^#gun-(\d{4}-\d{2}-\d{2})$/.exec(location.hash);
    gunAc(m&&d.some(x=>x.gun===m[1])?m[1]:d[0].gun);
  }).catch(()=>{$("durum").textContent="Arşiv henüz boş. İlk özetler yazıldıkça burada birikecek.";});
  let t; $("ara").addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>{ara=e.target.value.trim().toLocaleLowerCase("tr");ciz();},150);});
  $("konu").onchange=e=>{konu=e.target.value;ciz();};
})();
