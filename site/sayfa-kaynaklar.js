// kaynaklar.html sayfasının kodu (güvenlik politikası satır içi kodu yasakladığı için ayrı dosyada)
(function(){
  const REG=["Filistin","Meşrik","Körfez","Mısır","İran","Yemen","Mağrip","Anadolu-Türkiye","İsrail","İsrail’de muhalif basın","ABD","İngiltere","İspanya","İtalya","Almanya","Fransa","Asya ve diğer"];
  const TUR={resmi:"devlet",grup:"bağlı",bagimsiz:"bağımsız",koop:"kooperatif",ozel:"özel",izle:""};
  const DIL={ar:"Arapça",en:"İngilizce",fr:"Fransızca",tr:"Türkçe",he:"İbranice",es:"İspanyolca",ca:"Katalanca",it:"İtalyanca",de:"Almanca"};
  const CIZ={ad:"Antiemperyalist / dekolonyal",ara:"Ara / ana akım",ik:"İşbirlikçi kompradorlar ve emperyalistler"};
  const YOL={harita:"haber site haritası",besleme:"RSS / Atom",wp:"WordPress",gnews:"Google Haberler araması (son çare)"};
  const DURUM={iyi:"Çalışıyor",sessiz:"Sessiz (6 saatten uzun)",kopuk:"Okunamıyor",yok:"Henüz denenmedi"};
  const BAYRAK_AE='<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="BAE yayını"><title>BAE yayını</title><rect width="22" height="16" rx="1.5" fill="#fff"/><path d="M6 0h14.5A1.5 1.5 0 0 1 22 1.5v3.8H6z" fill="#00732f"/><path d="M6 10.7h16v3.8a1.5 1.5 0 0 1-1.5 1.5H6z" fill="#000"/><path d="M1.5 0H6v16H1.5A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0z" fill="#c8102e"/><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="none" stroke="#c9d1cc" stroke-width=".5"/></svg>';
  const bayrakHTML=k=>k.bayrak==="ae"?BAYRAK_AE:(k.bolge==="İsrail"&&!k.bayraksiz?BAYRAK:"");
  const BAYRAK='<svg viewBox="0 0 22 16" class="bayrak" role="img" aria-label="İsrail merkezli yayın"><title>İsrail merkezli yayın</title><rect x=".25" y=".25" width="21.5" height="15.5" rx="1.5" fill="#fff" stroke="#c9d1cc" stroke-width=".5"/><rect y="2" width="22" height="2.2" fill="#0038b8"/><rect y="11.8" width="22" height="2.2" fill="#0038b8"/><path d="M11 5.1l2.7 4.6H8.3zM11 10.9 8.3 6.3h5.4z" fill="none" stroke="#0038b8" stroke-width=".8"/></svg>';
  const $=(i)=>document.getElementById(i);
  const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
  const bas=(ad)=>{const k=ad.replace(/^(The|Al|El|La|Le|Il|L’|Der|Die)[\s-]+/i,"").replace(/[^\p{L}\p{N} ]/gu," ").trim().split(/\s+/);return((k[0]||"")[0]+((k[1]||"")[0]||(k[0]||"")[1]||"")).toUpperCase();};
  let K=[],D={},N={},KN={},bolge="Tümü",ara="",sDurum=null;
  const BK={filistin:"Filistin bakışı",aktarim:"Aktarım",israil:"İsrail / ABD bakışı"},BR={filistin:"#2b8a5e",aktarim:"#a7aeb3",israil:"#4a72c4"};
  const KTUR={belge:"İç belge",araştırma:"Araştırma",sahiplik:"Sahiplik",personel:"Kadro",tanıklık:"Çalışan tanıklığı",söylem:"Söylem",devlet:"Yasal çerçeve",karşı:"Karşı kanıt"};
  function belgeler(k){
    const L=k.kanitlar||[];if(!L.length&&k.cizgi!=="ik"&&!k.cizgi_tartismali)return null;
    const kutu=el("div","belgeler");kutu.appendChild(el("b",null,"Belgelenmiş kanıtlar"));
    if(!L.length){kutu.appendChild(el("span","kanit-yok","Henüz bağlantılı belge eklenmedi. Bu değerlendirme şimdilik sahiplik bilgisine ve aşağıdaki ölçülmüş söyleme dayanıyor."));return kutu;}
    const ul=el("ul");L.forEach(x=>{const li=el("li",x.tur==="karşı"?"karsi":null);li.appendChild(el("span","b-tur",KTUR[x.tur]||x.tur));li.append(" "+x.metin+" ");
      const a=el("a",null,x.kaynak+(x.tarih?", "+x.tarih.slice(0,7):"")+" ↗");a.href=x.url;a.target="_blank";a.rel="noopener";li.appendChild(a);ul.appendChild(li);});
    kutu.appendChild(ul);return kutu;
  }
  let LG={};fetch("data/logolar.json?t="+Math.floor(Date.now()/36e5)).then(r=>r.json()).then(d=>{LG=d||{};document.querySelectorAll(".avatar[data-k]").forEach(a=>logoTak(a,K.find(x=>String(x.id)===a.dataset.k)));}).catch(()=>{});
  function logoTak(a,k){if(!k||a.querySelector("img"))return;let host="";try{host=new URL(k.url).hostname;}catch(e){}
    const AK=window.AKTAR||(u=>u),dd=host&&"https://icons.duckduckgo.com/ip3/"+host+".ico";const L=[(LG[k.id]||{}).url&&AK((LG[k.id]||{}).url,96),dd&&AK(dd,96),k.bolge!=="İsrail"&&dd].filter(Boolean);if(!L.length)return;
    const img=document.createElement("img");img.alt="";img.loading="lazy";img.referrerPolicy="no-referrer";let i=0;img.src=L[0];
    img.onerror=()=>{i++;if(i<L.length)img.src=L[i];else img.remove();};img.onload=()=>{if(img.naturalWidth<8)img.onerror();else a.classList.add("logolu");};a.appendChild(img);}
  function avatarK(k){const a=el("div","avatar "+k.tur,bas(k.ad));a.dataset.k=k.id;logoTak(a,k);return a;}
  function kanit(k){
    const d=KN[String(k.id)],kutu=el("div","kanit");
    if(!d||!d.olcum.length){kutu.appendChild(el("span","kanit-yok","Henüz ölçüm yok: bu yayının başlıkları bir olay karşılaştırmasına girdikçe burada birikecek."));return kutu;}
    const n=d.olcum.length,c={filistin:0,aktarim:0,israil:0};d.olcum.forEach(x=>c[x[2]]++);
    const egri=(()=>{const U={filistin:0,aktarim:1,israil:2},H={};d.olcum.forEach(([,t,v])=>{const g=new Date(t+"T12:00:00Z");const p=new Date(g);p.setUTCDate(g.getUTCDate()-((g.getUTCDay()+6)%7));const k=p.toISOString().slice(0,10);(H[k]=H[k]||[]).push(U[v]);});
      const ks=Object.keys(H).sort().filter(k=>H[k].length>=3);if(ks.length<2)return null;const W=160,Hh=34,x=i=>4+(W-8)*i/(ks.length-1),y=v=>4+(Hh-8)*v/2;
      const d2=ks.map((k,i)=>(i?"L":"M")+x(i).toFixed(1)+","+y(H[k].reduce((a,b)=>a+b,0)/H[k].length).toFixed(1)).join("");
      const sp=document.createElement("span");sp.className="egri-kucuk";sp.title="Haftalık ortalama uzaklık (üst 0 = Filistin bakışı, alt 2 = İsrail / ABD bakışı): "+ks.map(k=>k+" "+(H[k].reduce((a,b)=>a+b,0)/H[k].length).toFixed(2)).join(", ");
      sp.innerHTML='<svg viewBox="0 0 '+W+' '+Hh+'" width="'+W+'" height="'+Hh+'"><line x1="4" x2="'+(W-4)+'" y1="'+y(1)+'" y2="'+y(1)+'" stroke="#e0dfd8"/><path d="'+d2+'" fill="none" stroke="#1d2421" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';return sp;})();
    const ust=el("div","kanit-ust");ust.appendChild(el("b",null,"Ölçülmüş söylem"));ust.append(" · "+((window.MARKA&&MARKA.ad)||"ZBS")+"’nin karşılaştırdığı "+n+" başlık");if(egri)ust.appendChild(egri);kutu.appendChild(ust);
    const bar=el("div","kanit-cubuk");Object.keys(c).forEach(v=>{if(!c[v])return;const i=el("i");i.style.width=(100*c[v]/n)+"%";i.style.background=BR[v];i.title=BK[v]+": "+c[v];bar.appendChild(i);});kutu.appendChild(bar);
    const ef=el("div","kanit-efsane");Object.keys(c).forEach(v=>{if(!c[v])return;const x=el("span");const nk=el("i");nk.style.background=BR[v];x.appendChild(nk);x.append(BK[v]+" "+Math.round(100*c[v]/n)+"%");ef.appendChild(x);});kutu.appendChild(ef);
    if(n>=5){const fi=c.filistin/n,is=c.israil/n;
      if((k.cizgi==="ik"&&fi>=0.6)||(k.cizgi==="ad"&&is>=0.6))kutu.appendChild(el("span","uyusmaz","Ölçüm bu yayının çizgi değerlendirmesiyle uyuşmuyor; değerlendirme gözden geçirilecek."));}
    const det=document.createElement("details");det.appendChild(el("summary",null,"Örnek başlıklar ("+d.ornek.length+")"));
    d.ornek.forEach(o=>{const r=el("div","ornek");const cp=el("span","bakis-cip",BK[o.bakis]);cp.style.background=BR[o.bakis];r.appendChild(cp);
      r.appendChild(el("span","ornek-tarih",new Date(o.tarih).toLocaleDateString("tr-TR",{day:"numeric",month:"short"})+" · "+o.olay));
      const oz=el("div","ornek-ozgun",o.baslik_orj);oz.dir="auto";r.appendChild(oz);
      if(o.baslik_tr)r.appendChild(el("div","ornek-tr",o.baslik_tr));if(o.yorum)r.appendChild(el("div","ornek-yorum",o.yorum));
      const a=el("a",null,"Habere git ↗");a.href=o.url;a.target="_blank";a.rel="noopener";r.appendChild(a);det.appendChild(r);});
    kutu.appendChild(det);return kutu;
  }
  function saglik(k){const d=D[String(k.id)]||{};if(!d.kesif)return"yok";if(!d.son_basari)return"kopuk";const s=(Date.now()-new Date(d.son_basari))/36e5;return s<6?"iyi":s<48?"sessiz":"kopuk";}
  function once(iso){const d=(Date.now()-new Date(iso))/6e4;if(d<60)return Math.max(1,Math.round(d))+" dk önce";if(d<1440)return Math.round(d/60)+" sa önce";return Math.round(d/1440)+" gün önce";}
  function ust(){
    const s=$("saglik");s.innerHTML="";
    Object.keys(DURUM).forEach(k=>{const b=el("button");b.type="button";b.setAttribute("aria-pressed",sDurum===k);
      b.appendChild(el("b",null,K.filter(x=>saglik(x)===k).length));const sp=el("span");const n=el("i","nokta d-"+k);sp.appendChild(n);sp.append(DURUM[k]);b.appendChild(sp);
      b.onclick=()=>{sDurum=sDurum===k?null:k;ciz();};s.appendChild(b);});
  }
  function ciz(){
    ust();
    document.querySelectorAll("#bolgeler .cip").forEach(b=>b.setAttribute("aria-pressed",b.dataset.k===bolge));
    const L=$("liste");L.innerHTML="";
    const ok=k=>(bolge==="Tümü"||(k.kamp||k.bolge)===bolge||("cz-"+(k.cizgi||"ara"))===bolge)&&(!sDurum||saglik(k)===sDurum)&&(!ara||[k.ad,k.sehir,k.ulke,k.profil,k.url].join(" ").toLocaleLowerCase("tr").includes(ara));
    let n=0;
    REG.forEach(r=>{const ks=K.filter(k=>(k.kamp||k.bolge)===r&&ok(k));if(!ks.length)return;n+=ks.length;
      const g=el("section","grup");g.appendChild(el("h2",null,r+" · "+ks.length));const iz=el("div","izgara");
      ks.forEach(k=>{const c=el("article","kk"),u=el("div","kk-ust");
        u.appendChild(avatarK(k));const w=el("div");const ad=el("div","kk-ad");if(bayrakHTML(k))ad.insertAdjacentHTML("afterbegin",bayrakHTML(k));
        const a=el("a",null,k.ad);a.href=k.url;a.target="_blank";a.rel="noopener";ad.appendChild(a);w.appendChild(ad);
        w.appendChild(el("div","kk-yer",k.sehir+", "+k.ulke+" · "+(DIL[k.dil]||k.dil)));u.appendChild(w);
        const rz=el("div","rozetler");if(TUR[k.tur])rz.appendChild(el("span","rozet "+k.tur,TUR[k.tur]));u.appendChild(rz);c.appendChild(u);
        const cz=el("div");cz.appendChild(el("span","cz cz-"+(k.cizgi||"ara"),CIZ[k.cizgi||"ara"]));if(k.cizgi_tartismali)cz.appendChild(el("span","cz-t","tartışmalı"));c.appendChild(cz);
        c.appendChild(el("p",null,k.profil));
        const d=D[String(k.id)]||{},sd=saglik(k);const iz2=el("div","izleme");iz2.appendChild(el("i","nokta d-"+sd));
        const yol=[];if(d.yontem&&YOL[d.yontem.tip])yol.push(YOL[d.yontem.tip]);if(d.telegram)yol.push("Telegram @"+d.telegram);if(d.gdelt&&!yol.length)yol.push("GDELT haber veritabanı");
        const NEDEN={403:"site sunucumuzu engelliyor",429:"site istek sınırı koydu",0:"siteye bağlanılamadı",[-1]:"robots.txt izin vermiyor",404:"adres bulunamadı",503:"site geçici olarak kapalı"};
        const neden=(sd==="kopuk"&&!yol.length&&d.ana_kod!=null&&d.ana_kod!==200)?" ("+(NEDEN[d.ana_kod]||"HTTP "+d.ana_kod)+")":"";
        iz2.append(DURUM[sd]+" · "+(yol.length?yol.join(" + "):"yol bulunamadı"+neden)+(d.son_basari?" · son okuma "+once(d.son_basari):"")+" · son 2 günde "+(N[k.id]||0)+" haber");
        c.appendChild(iz2);if(k.notu)c.appendChild(el("div","not",k.notu));
        {const b=belgeler(k);if(b)c.appendChild(b);}{const dk=dogKayit(k);if(dk)c.appendChild(dk);}c.appendChild(kanit(k));iz.appendChild(c);});
      g.appendChild(iz);L.appendChild(g);});
    if(!n)L.appendChild(el("p","bos","Bu süzgeçle eşleşen kaynak yok."));
  }
  // Elle onaylı doğrulama kaydı: bu yayının aktardığı ve sonradan yanlış çıkan ya da çelişkili bulunan iddialar
  let DG={};
  function dogKayit(k){
    const e=Object.values(DG).filter(x=>x.kaynak===k.id&&(x.tur==="yanlis"||x.tur==="celiskili"));if(!e.length)return null;
    const y=e.filter(x=>x.tur==="yanlis").length,c=e.length-y;
    const d=document.createElement("details");d.className="dog-kayit";
    d.appendChild(el("summary",null,(y?"❌ "+y+" iddia yanlış çıktı":"")+(y&&c?" · ":"")+(c?"⚠️ "+c+" çelişkili iddia":"")));
    e.sort((a,b)=>(a.tarih<b.tarih?1:-1)).slice(0,8).forEach(x=>{const p=el("p");p.appendChild(el("b",null,x.tur==="yanlis"?"Yanlış çıktı: ":"Çelişkili: "));p.append((x.baslik||"")+" — "+(x.aciklama||""));
      (x.kanit||[]).forEach(u=>{if(!/^https?:\/\//.test(u))return;const a=el("a",null," Kanıt ↗");a.href=u;a.target="_blank";a.rel="noopener nofollow";p.appendChild(a);});d.appendChild(p);});
    return d;
  }
  fetch("data/dogrulama.json?t="+Date.now()).then(r=>r.json()).then(d=>{DG=(d&&d.etiketler)||{};if(K.length)ciz();}).catch(()=>{});
  Promise.all([fetch("kaynaklar.json?t="+Date.now()).then(r=>r.json()),fetch("data/durum.json?t="+Date.now()).then(r=>r.json()).catch(()=>({})),fetch("data/haberler.json?t="+Date.now()).then(r=>r.json()).catch(()=>({haberler:[]})),fetch("data/kanit.json?t="+Date.now()).then(r=>r.json()).catch(()=>({}))])
  .then(([k,d,h,kn])=>{K=k;D=d;KN=kn||{};(h.haberler||[]).forEach(x=>N[x.kaynak]=(N[x.kaynak]||0)+1);
    ["Tümü",...REG].forEach(r=>{const b=el("button","cip",r);b.type="button";b.dataset.k=r;b.onclick=()=>{bolge=r;ciz();};$("bolgeler").appendChild(b);});
    Object.entries(CIZ).forEach(([k,l])=>{const b=el("button","cip",l);b.type="button";b.dataset.k="cz-"+k;b.onclick=()=>{bolge="cz-"+k;ciz();};$("bolgeler").appendChild(b);});ciz();})
  .catch(()=>{$("liste").textContent="Kaynak listesi okunamadı.";});
  let t;$("ara").addEventListener("input",e=>{clearTimeout(t);t=setTimeout(()=>{ara=e.target.value.trim().toLocaleLowerCase("tr");ciz();},150);});
})();
