// almanak.html sayfasının kodu (güvenlik politikası satır içi kodu yasakladığı için ayrı dosyada)
(function(){
  const $=(i)=>document.getElementById(i);
  const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;};
  const TUR={haftalik:"Haftalık",aylik:"Aylık",yillik:"Yıllık"};
  const KR={"Filistin":"#2b8a5e","Arap dünyası":"#6fae92","İran ve Yemen":"#c39a35","Türkiye":"#c9544e","İsrail":"#4a72c4","İsrail’de muhalif basın":"#8a7bc0","Batı":"#8d969e","Diğer":"#6b746f",
    "Antiemperyalist / dekolonyal":"#2b8a5e","Ara / ana akım":"#8d969e","İşbirlikçi kompradorlar ve emperyalistler":"#c9544e"};
  const BK={filistin:"Filistin bakışı",aktarim:"Aktarım",israil:"İsrail / ABD bakışı"},BR={filistin:"#2b8a5e",aktarim:"#8f979c",israil:"#4a72c4"};
  const sayi=(n,d)=>Number(n).toLocaleString("tr-TR",{maximumFractionDigits:d==null?1:d});
  let dizin=[],tur="haftalik",secili=null;

  function eksen(baslik,liste){
    const k=el("div","eksen");if(baslik)k.appendChild(el("div","alt-baslik",baslik));
    liste.filter(x=>x.uzaklik!=null).forEach(x=>{
      const s=el("div","e-satir");const a=el("span","e-ad",x.ad);a.title=x.ad;a.appendChild(el("small",null,x.n+" haber"));s.appendChild(a);
      const c=el("div","e-cizgi");const n=el("i","e-nokta");n.style.left=(50*x.uzaklik)+"%";n.style.background=KR[x.ad]||"#6b746f";
      n.title=x.ad+": "+x.filistin+" Filistin bakışı, "+x.aktarim+" aktarım, "+x.israil+" İsrail / ABD bakışı";c.appendChild(n);s.appendChild(c);
      const d=el("span","e-deger",sayi(x.uzaklik,2));d.style.color=x.uzaklik<0.5?BR.filistin:x.uzaklik>=1.5?BR.israil:"";s.appendChild(d);k.appendChild(s);});
    const o=el("div","e-olcek");o.appendChild(el("span"));const ic=el("div");[["0"," · Filistin bakışı"],["1"," · aktarım"],["2"," · İsrail / ABD"]].forEach(([n,t])=>{const x=el("span",null,n);x.appendChild(el("span","uzun",t));ic.appendChild(x);});o.appendChild(ic);o.appendChild(el("span"));k.appendChild(o);
    return k;
  }
  function kamplar(o){const f=el("span");Object.entries(o.kamplar).forEach(([a,n])=>{const c=el("span","kc",a+" "+n);c.style.background=KR[a]||"#6b746f";f.appendChild(c);f.append(" ");});return f;}

  // ---- yardımcılar
  const SVGNS="http://www.w3.org/2000/svg";
  const sv=(t,at)=>{const e=document.createElementNS(SVGNS,t);for(const k in at)e.setAttribute(k,at[k]);return e;};
  let KOD={};
  // metindeki [E3] gibi kodları tıklanabilir kanıt düğmesine çevirir
  function kodluMetin(etiket,metin,sinif){
    const p=el(etiket,sinif||null);String(metin||"").split(/(\[E\d+\](?:\s*\[E\d+\])*)/).forEach(par=>{
      const kodlar=par.match(/E\d+/g);
      if(kodlar&&/^\[E\d+\]/.test(par)){kodlar.forEach(kd=>{if(KOD[kd])p.appendChild(kodDugme(kd));});}
      else p.append(par);});
    return p;
  }
  function kodDugme(kd){const b=el("button","kod",kd.replace("E",""));b.type="button";b.title="Kanıt: "+(KOD[kd]||{}).baslik;b.setAttribute("aria-label","Kanıtı göster: "+(KOD[kd]||{}).baslik);b.onclick=(e)=>{e.stopPropagation();kanitAc(kd);};return b;}
  function kanitAc(kd){
    const v=KOD[kd];if(!v)return;const pn=$("kanitPanel");pn.innerHTML="";
    const ust=el("div","kp-ust");ust.appendChild(el("b",null,v.baslik));const kp=el("button","kp-kapat","✕");kp.type="button";kp.setAttribute("aria-label","Kapat");kp.onclick=()=>pn.hidden=true;ust.appendChild(kp);pn.appendChild(ust);
    pn.appendChild(el("div","kp-alt",v.tarih+(v.yer?" · "+v.yer:"")+" · "+v.haberler.length+" haber"));
    v.haberler.forEach(h=>{const r=el("div","orn");const y=el("span","y",h.yayin+" · "+h.kamp);if(h.bakis){const c=el("span","bakis-cip",BK[h.bakis]);c.style.background=BR[h.bakis];y.appendChild(c);}r.appendChild(y);
      const t=el("span","b",h.baslik||"");t.dir="auto";r.appendChild(t);if(h.tr&&h.tr!==h.baslik)r.appendChild(el("span","c",h.tr));
      if(h.url){const a=el("a",null,"Habere git ↗");a.href=h.url;a.target="_blank";a.rel="noopener";r.appendChild(a);}pn.appendChild(r);});
    pn.hidden=false;pn.focus();
  }
  function degisim(simdi,once,ters){ // ters: azalması iyi değilse
    if(simdi==null||once==null)return null;const d=simdi-once;if(Math.abs(d)<0.05)return el("span","dg es","=");
    const s=el("span","dg "+(d>0?"art":"azl"),(d>0?"↑":"↓")+sayi(Math.abs(d),1));s.title="Önceki döneme göre";return s;
  }
  // çizgi grafik: günlük uzaklık, bölge basını ve İsrail-Batı basını
  function egilim(gunluk){
    const g=gunluk.filter(x=>x.ic_uzaklik!=null||x.dis_uzaklik!=null);if(g.length<2)return el("p","bekliyor","Eğilim çizgisi için en az iki günlük ölçüm gerekiyor; veri biriktikçe çizilecek.");
    const W=640,H=180,P=34,n=gunluk.length,x=i=>P+(W-2*P)*(n<2?0:i/(n-1)),y=v=>18+(H-46)*(v/2);
    const s=sv("svg",{viewBox:`0 0 ${W} ${H}`,class:"egri",role:"img","aria-label":"Günlük uzaklık eğilimi"});
    [0,1,2].forEach(v=>{s.appendChild(sv("line",{x1:P,x2:W-P,y1:y(v),y2:y(v),class:"egri-izgara"}));const t=sv("text",{x:P-8,y:y(v)+4,"text-anchor":"end",class:"egri-yazi"});t.textContent=v;s.appendChild(t);});
    [["ic_uzaklik","#2b8a5e","Bölge basını"],["dis_uzaklik","#4a72c4","İsrail ve Batı basını"]].forEach(([a,r])=>{
      let d="";gunluk.forEach((v,i)=>{if(v[a]==null)return;d+=(d?"L":"M")+x(i).toFixed(1)+","+y(v[a]).toFixed(1);});
      if(d)s.appendChild(sv("path",{d,fill:"none",stroke:r,"stroke-width":2.5,"stroke-linejoin":"round","stroke-linecap":"round"}));
      gunluk.forEach((v,i)=>{if(v[a]==null)return;const c=sv("circle",{cx:x(i),cy:y(v[a]),r:3.5,fill:r});const t=sv("title");t.textContent=v.gun+": "+sayi(v[a],2);c.appendChild(t);s.appendChild(c);});});
    [0,n-1].forEach(i=>{const t=sv("text",{x:x(i),y:H-6,"text-anchor":i?"end":"start",class:"egri-yazi"});t.textContent=new Date(gunluk[i].gun+"T12:00:00Z").toLocaleDateString("tr-TR",{day:"numeric",month:"short"});s.appendChild(t);});
    const k=el("div","egri-kutu");k.appendChild(s);const ef=el("div","dagilim-efsane");[["#2b8a5e","Bölge basını"],["#4a72c4","İsrail ve Batı basını"]].forEach(([r,l])=>{const e=el("span");const i=el("i");i.style.background=r;e.appendChild(i);e.append(l);ef.appendChild(e);});k.appendChild(ef);return k;
  }
  // takvim: her gün bir kare; renk o günün Gazze haberlerinin o grubun haberleri içindeki payı
  function takvim(gunluk){
    const k=el("div","takvim");
    [["ic","Bölge basını","#2b8a5e"],["dis","İsrail ve Batı basını","#4a72c4"]].forEach(([y,l,r])=>{
      const sat=el("div","tk-satir");sat.appendChild(el("span","tk-ad",l));const iz=el("div","tk-izgara");
      const ilk=new Date(gunluk[0].gun+"T12:00:00Z").getUTCDay();for(let i=0;i<(ilk+6)%7;i++)iz.appendChild(el("i","tk-bos"));
      const paylar=gunluk.map(g=>g[y]?g[y+"_gazze"]/g[y]:null);const en=Math.max(0.05,...paylar.filter(v=>v!=null));
      gunluk.forEach((g,i)=>{const c=el("i","tk-gun");const p=paylar[i];
        if(p==null)c.classList.add("tk-yok");else{c.style.background=r;c.style.opacity=(0.15+0.85*p/en).toFixed(2);}
        c.title=new Date(g.gun+"T12:00:00Z").toLocaleDateString("tr-TR",{day:"numeric",month:"long"})+": "+(p==null?"veri yok":"Gazze %"+sayi(100*p,1)+" ("+g[y+"_gazze"]+"/"+g[y]+")");iz.appendChild(c);});
      sat.appendChild(iz);k.appendChild(sat);});
    k.appendChild(el("p","bekliyor","Koyu kare: o gün grubun haberleri içinde Gazze’nin payı yüksek. Gri: o gün veri yok."));
    return k;
  }
  // sessizlik haritası
  let DUNYA_P=null;
  function harita(yerler){
    const k=el("div","sessiz-harita");const W=1000,H=560,B={bat:-20,dogu:80,kuzey:58,guney:2};
    const px=lon=>(lon-B.bat)/(B.dogu-B.bat)*W,py=lat=>(B.kuzey-lat)/(B.kuzey-B.guney)*H;
    const s=sv("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Olayların yaşandığı yerler"});const kara=sv("path",{class:"sh-kara"});s.appendChild(kara);
    if(!DUNYA_P&&window.topojson)DUNYA_P=fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json").then(r=>r.json()).catch(()=>null);
    if(DUNYA_P)DUNYA_P.then(t=>{if(!t)return;let d="";topojson.feature(t,t.objects.countries).features.forEach(f=>{const g=f.geometry;if(!g)return;(g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[]).forEach(p=>p.forEach(h=>{const xs=h.map(q=>q[0]);if(Math.max(...xs)<B.bat-5||Math.min(...xs)>B.dogu+5)return;d+="M"+h.map(q=>px(q[0]).toFixed(1)+","+py(q[1]).toFixed(1)).join("L")+"Z";}));});kara.setAttribute("d",d);});
    yerler.forEach(y=>{if(y.lon<B.bat||y.lon>B.dogu||y.lat<B.guney||y.lat>B.kuzey)return;const g=sv("g",{class:"sh-yer"+(y.gorulmeyen?" sessiz":""),tabindex:0});
      const r=6+Math.sqrt(y.olay)*4;if(y.gorulmeyen)g.appendChild(sv("circle",{cx:px(y.lon),cy:py(y.lat),r:r+8,class:"sh-hale"}));
      g.appendChild(sv("circle",{cx:px(y.lon),cy:py(y.lat),r}));const t=sv("title");t.textContent=y.ad+": "+y.olay+" olay"+(y.gorulmeyen?", "+y.gorulmeyen+" tanesini İsrail ve Batı basını hiç yazmadı":"");g.appendChild(t);
      if(y.gorulmeyen&&y.kodlar.length){g.style.cursor="pointer";g.onclick=()=>kanitAc(y.kodlar[0]);}
      if(y.gorulmeyen){const l=sv("text",{x:px(y.lon)+r+6,y:py(y.lat)+5,class:"sh-ad"});l.textContent=y.ad;g.appendChild(l);}s.appendChild(g);});
    k.appendChild(s);const ef=el("div","dagilim-efsane");[["#c9544e","İsrail ve Batı basınının görmediği olay"],["#9aa3ab","iki tarafın da yazdığı olay"]].forEach(([r,l])=>{const e=el("span");const i=el("i");i.style.background=r;i.style.borderRadius="50%";e.appendChild(i);e.append(l);ef.appendChild(e);});k.appendChild(ef);return k;
  }

  function ciz(b){
    const k=$("icerik");k.innerHTML="";const s=b.istatistik,a=b.anlati||{},on=s.onceki||null;KOD=s.kodlar||{};
    // başlık
    const ust=el("article","kart2");const bu=el("div","bas-ust");bu.append(TUR[b.tur]+" · "+b.ad);if(b.taslak)bu.appendChild(el("span","taslak","taslak · "+new Date(b.uretildi).toLocaleString("tr-TR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})+" itibarıyla"));
    bu.append(" · "+sayi(s.haber_sayisi,0)+" haber · "+s.olay_sayisi+" olay");ust.appendChild(bu);
    ust.appendChild(el("h2","bulten-baslik",a.baslik||b.ad));
    (a.ozet||[]).forEach(p=>ust.appendChild(kodluMetin("p",p)));
    if(!b.anlati)ust.appendChild(el("p","bekliyor","Yorum metni henüz yazılmadı; yapay zekâ kotası açılınca eklenecek. Aşağıdaki sayılar hazır."));
    if(Object.keys(KOD).length)ust.appendChild(el("p","bekliyor","Metindeki numaralı düğmeler kanıttır: dokununca o olayı yazan yayınları ve özgün başlıkları görürsün."));
    const ind=el("div","indirler");const kok="data/bulten/"+b.tur+"/";const ix=b.indir||{};
    [["Metin (.md)",kok+b.anahtar+".md"],ix.zip&&["Veri (CSV, .zip)",ix.zip],ix.png&&["Paylaşım görseli (.png)",ix.png]].filter(Boolean).forEach(([l,h])=>{const x=el("a","indir",l+" ↓");x.href=h;x.setAttribute("download","");ind.appendChild(x);});
    ust.appendChild(ind);
    if(ix.png){const f=el("a","kart-onizle");f.href=ix.png;f.target="_blank";f.rel="noopener";const im=document.createElement("img");im.src=ix.png+"?t="+Date.parse(b.uretildi);im.alt="Bültenin paylaşım görseli";im.loading="lazy";f.appendChild(im);ust.appendChild(f);}
    k.appendChild(ust);
    // uzaklık ve eğilim
    const u=el("article","kart2");u.appendChild(el("h2",null,"Kim, Filistin bakışından ne kadar uzak anlattı"));
    u.appendChild(el("p",null,"Olay karşılaştırmalarına giren başlıkların ortalaması. 0 Filistin bakışı, 1 aktarım, 2 İsrail / ABD bakışı."+(on?" Oklar "+on.ad+" ile karşılaştırma.":"")));
    const ek=eksen("Bölgeye göre",s.kamp_bakis);if(on)[...ek.querySelectorAll(".e-satir")].forEach((r,i)=>{const x=s.kamp_bakis.filter(z=>z.uzaklik!=null)[i];const d=x&&degisim(x.uzaklik,on.kamp_bakis[x.ad]);if(d)r.querySelector(".e-deger").appendChild(d);});
    u.appendChild(ek);if(s.cizgi_bakis.length)u.appendChild(eksen("Yayın çizgisine göre",s.cizgi_bakis));
    if(s.gunluk&&s.gunluk.length>1){u.appendChild(el("div","alt-baslik","Gün gün"));u.appendChild(egilim(s.gunluk));}
    k.appendChild(u);
    // görülmeyenler ve sessizlik haritası
    const g=el("article","kart2");const gb=el("h2",null,"İsrail ve Batı basınının görmedikleri");if(on){const d=degisim(s.gormeyen_israil_bati.length,on.gormeyen);if(d){d.title=on.ad+": "+on.gormeyen;gb.appendChild(d);}}g.appendChild(gb);
    if(a.gorulmeyenler)g.appendChild(kodluMetin("p",a.gorulmeyenler));
    if((s.yerler||[]).length)g.appendChild(harita(s.yerler));
    g.appendChild(el("p","bekliyor","Bölge basınında en az üç yayının yazdığı, İsrail ve Batı basınında hiç yer bulmayan olaylar:"));
    const liste=(arr)=>{const ul=el("ul","olay-liste");arr.forEach(o=>{const li=el("li");li.appendChild(el("span","t",o.tarih));li.appendChild(el("b",null,o.baslik));li.appendChild(kamplar(o));if(o.kod)li.appendChild(kodDugme(o.kod));ul.appendChild(li);});return ul;};
    const ul=liste(s.gormeyen_israil_bati);if(!s.gormeyen_israil_bati.length)ul.appendChild(el("li",null,"Bu dönemde böyle bir olay yok."));g.appendChild(ul);
    if(s.gormeyen_bolge.length){g.appendChild(el("div","alt-baslik","Tersi: yalnızca İsrail ve Batı basınının yazdıkları"));g.appendChild(liste(s.gormeyen_bolge));}
    k.appendChild(g);
    // gecikme
    const gc=s.gecikme;if(gc&&gc.olay){const c=el("article","kart2");c.appendChild(el("h2",null,"Kim önce yazdı, kim geç kaldı"));
      c.appendChild(el("p",null,"İki tarafın da yazdığı "+gc.olay+" olayda, İsrail ve Batı basınının ilk haberi bölge basınının ilk haberinden ne kadar sonra geldi."));
      const r=el("div","rakamlar");[[gc.medyan_saat==null?"–":(gc.medyan_saat>0?"+":"")+sayi(gc.medyan_saat,1)+" sa","ortanca gecikme",on&&degisim(gc.medyan_saat,on.gecikme_medyan)],[gc.bolge_once,"olayda bölge basını önce yazdı"],[gc.bati_once,"olayda İsrail ve Batı basını önce yazdı"]].forEach(([b2,l,d])=>{const x=el("div","rakam");const bb=el("b",null,String(b2));if(d)bb.appendChild(d);x.appendChild(bb);x.appendChild(el("span",null,l));r.appendChild(x);});c.appendChild(r);
      if(gc.en_gec.length){c.appendChild(el("div","alt-baslik","En geç yazılanlar"));const enb=Math.max(...gc.en_gec.map(x=>x.saat));const ul2=el("ul","olay-liste");
        gc.en_gec.forEach(o=>{const li=el("li");li.appendChild(el("b",null,o.baslik));const bar=el("span","gec-cubuk");const i=el("i");i.style.width=Math.max(4,100*o.saat/enb)+"%";bar.appendChild(i);li.appendChild(bar);li.appendChild(el("span","t","+"+sayi(o.saat,1)+" sa"));if(o.kod)li.appendChild(kodDugme(o.kod));ul2.appendChild(li);});c.appendChild(ul2);}
      k.appendChild(c);}
    // dil sayacı
    const dl=s.dil;if(dl&&(dl.baslik_ic||dl.baslik_dis)){const c=el("article","kart2");c.appendChild(el("h2",null,"Dil sayacı: kim hangi kelimeyi kullandı"));
      c.appendChild(el("p",null,"Özgün başlıklarda (9 dilde) kelimenin bin başlıkta kaç kez geçtiği. Ölçülen başlık: bölge basını "+dl.baslik_ic+", İsrail ve Batı basını "+dl.baslik_dis+". Üzerine gelince örnek başlıkları görürsün."));
      if(dl.baslik_dis<30)c.appendChild(el("p","bekliyor","İsrail ve Batı basınından ölçülen başlık az; oranlar veri biriktikçe sağlamlaşacak."));
      const tb=el("div","dil-tablo");const h=el("div","dil-satir dil-bas");["","Bölge basını","","İsrail ve Batı basını"].forEach(t=>h.appendChild(el("span",null,t)));tb.appendChild(h);
      const en=Math.max(1,...dl.terimler.map(t=>Math.max(t.ic_binde||0,t.dis_binde||0)));
      dl.terimler.forEach(t=>{const r=el("div","dil-satir"+(t.yan==="israil"?" dil-is":""));
        const sol=el("span","dil-sol");const ib=el("i");ib.style.width=(100*(t.ic_binde||0)/en)+"%";sol.appendChild(el("em",null,sayi(t.ic_binde||0,0)));sol.appendChild(ib);sol.title=t.ornek_ic.map(o=>o.yayin+": "+o.baslik).join("\n")||"örnek yok";
        const ad=el("span","dil-ad","“"+t.ad+"”");
        const sag=el("span","dil-sag");const db=el("i");db.style.width=(100*(t.dis_binde||0)/en)+"%";sag.appendChild(db);sag.appendChild(el("em",null,sayi(t.dis_binde||0,0)));sag.title=t.ornek_dis.map(o=>o.yayin+": "+o.baslik).join("\n")||"örnek yok";
        r.append(sol,ad,el("span"),sag);tb.appendChild(r);});
      c.appendChild(tb);c.appendChild(el("p","bekliyor","Yeşil adlar Filistin anlatısının, mavi adlar İsrail anlatısının kelimeleri. “Operasyon” bazen direniş eylemleri için de kullanılır."));k.appendChild(c);}
    // ölü başına haber
    const ol=s.olum;if(ol){const c=el("article","kart2");c.appendChild(el("h2",null,"Ölü başına haber"));
      if(!ol.olu.filistinli&&!ol.olu.israilli)c.appendChild(el("p","bekliyor","Bu dönemde haberlerden ölü sayısı henüz çıkarılmadı. Özetleyici ölü sayılarını kaydetmeye başladı; veri biriktikçe burada her ölümün kaç haberde anıldığı görünecek."));
      else{c.appendChild(el("p",null,"Olay kümelerinde bildirilen ölüler: "+sayi(ol.olu.filistinli,0)+" Filistinli, "+sayi(ol.olu.israilli,0)+" İsrailli. Her grup bu ölümleri kaç haberde andı?"));
        const kt=el("div","tablo-kutu");const tb=el("table");tb.innerHTML="<thead><tr><th>Grup</th><th>Filistinli ölü başına haber</th><th>İsrailli ölü başına haber</th><th>Kat</th></tr></thead>";const bd=el("tbody");
        ol.gruplar.forEach(x=>{const r=el("tr");r.appendChild(el("td",null,x.ad));r.appendChild(el("td","sayi",x.filistinli_olu_basina==null?"–":sayi(x.filistinli_olu_basina,2)+" ("+x.filistinli_haber+")"));r.appendChild(el("td","sayi",x.israilli_olu_basina==null?"–":sayi(x.israilli_olu_basina,2)+" ("+x.israilli_haber+")"));r.appendChild(el("td","sayi",x.kat==null?"–":sayi(x.kat,1)+"×"));bd.appendChild(r);});
        tb.appendChild(bd);kt.appendChild(tb);c.appendChild(kt);c.appendChild(el("p","bekliyor","Kat: İsrailli bir ölümün, Filistinli bir ölüme göre kaç kat daha çok haberde anıldığı. 1’in üstü, İsrailli ölümlerin daha görünür olduğunu gösterir. Ölü sayıları yapay zekânın haber metinlerinden çıkardığı tahminlerdir."));}
      k.appendChild(c);}
    // konular
    if(s.konular.length){const t=el("article","kart2");t.appendChild(el("h2",null,"Kim hangi konuya ne kadar yer verdi"));
      t.appendChild(el("p",null,"Her grubun kendi haberleri içinde o konuya ayırdığı pay. Oran 1’in altındaysa İsrail ve Batı basını konuyu bölge basınından daha az işlemiş demektir."));
      const kt=el("div","tablo-kutu");const tb=el("table");tb.innerHTML="<thead><tr><th>Konu</th><th>Bölge basını</th><th>İsrail ve Batı</th><th>Oran</th></tr></thead>";const bd=el("tbody");
      const enb=Math.max(1,...s.konular.map(x=>x.oran||0));
      s.konular.forEach(x=>{const r=el("tr");r.appendChild(el("td",null,x.konu));r.appendChild(el("td","sayi","%"+sayi(x.bolge_ici_pay)+" · "+x.bolge_ici));r.appendChild(el("td","sayi","%"+sayi(x.israil_bati_pay)+" · "+x.israil_bati));
        const oc=el("td");const ob=el("div","oran");const i=el("i");i.style.width=Math.max(2,60*(x.oran||0)/enb)+"px";i.style.background=(x.oran||0)<1?"#c9544e":"#4a72c4";ob.appendChild(i);ob.appendChild(el("span",null,x.oran==null?"–":sayi(x.oran,2)+"×"));oc.appendChild(ob);r.appendChild(oc);bd.appendChild(r);});
      tb.appendChild(bd);kt.appendChild(tb);t.appendChild(kt);k.appendChild(t);}
    // takvim
    if(s.gunluk&&s.gunluk.length){const t=el("article","kart2");t.appendChild(el("h2",null,"Takvim: Gazze hangi gün ne kadar yer buldu"));t.appendChild(takvim(s.gunluk));k.appendChild(t);}
    // nasıl anlatıldı
    const n=el("article","kart2");n.appendChild(el("h2",null,"Nasıl anlatıldı"));
    (a.nasil_anlatildi||[]).forEach(x=>{const d=el("div","anlat");d.appendChild(el("h3",null,x.konu));d.appendChild(kodluMetin("p",x.metin));n.appendChild(d);});
    n.appendChild(el("div","alt-baslik","En çok yazılan olaylardan başlık örnekleri"));
    s.buyuk_olaylar.filter(o=>o.ornekler.bolge_ici.length||o.ornekler.israil_bati.length).slice(0,6).forEach(o=>{
      const d=el("div","anlat");const h3=el("h3",null,o.baslik);if(o.kod)h3.appendChild(kodDugme(o.kod));d.appendChild(h3);const iki=el("div","iki");
      [["bolge_ici","Bölge basını"],["israil_bati","İsrail ve Batı basını"]].forEach(([y,l])=>{const c=el("div");c.appendChild(el("h4",null,l));
        if(!o.ornekler[y].length)c.appendChild(el("div","orn c","Bu olayı yazmadı."));
        o.ornekler[y].forEach(e=>{const r=el("div","orn");const yy=el("span","y",e.yayin);if(e.bakis){const cp=el("span","bakis-cip",BK[e.bakis]);cp.style.background=BR[e.bakis];yy.appendChild(cp);}r.appendChild(yy);
          const bb=el("span","b",e.baslik);bb.dir="auto";r.appendChild(bb);if(e.cerceve)r.appendChild(el("span","c",e.cerceve));c.appendChild(r);});iki.appendChild(c);});
      d.appendChild(iki);n.appendChild(d);});
    k.appendChild(n);
    // yayınlar
    if(s.yayin_yakin.length){const y=el("article","kart2");y.appendChild(el("h2",null,"Yayınlar"));y.appendChild(el("p",null,"En az dört başlığı ölçülen yayınlar arasında Filistin bakışına en yakın ve en uzak olanlar."));
      y.appendChild(eksen("En yakın",s.yayin_yakin));y.appendChild(eksen("En uzak",s.yayin_uzak));k.appendChild(y);}
    // veri dosyaları
    if(ix.csv){const v=el("article","kart2");v.appendChild(el("h2",null,"Veriyi indir"));v.appendChild(el("p",null,"Bu bültenin bütün sayıları CSV olarak. Excel, LibreOffice ya da Google E-Tablolar’da açılır."));
      const ul3=el("ul","csv-liste");[["kamp_bakis","Bölgeye göre uzaklık"],["cizgi_bakis","Çizgiye göre uzaklık"],["yayinlar","Yayın yayın uzaklık"],["konular","Konu payları"],["gorulmeyen_olaylar","Görülmeyen olaylar"],["gecikme","Gecikme"],["dil_sayaci","Dil sayacı"],["olu_basina_haber","Ölü başına haber"],["gunluk","Günlük seri"],["kanitlar","Kanıtlar: olay olay bütün başlıklar ve bağlantılar"]].forEach(([d,l])=>{const li=el("li");const x=el("a",null,l+" ↓");x.href=ix.csv+"/"+d+".csv";x.setAttribute("download","");li.appendChild(x);ul3.appendChild(li);});
      v.appendChild(ul3);k.appendChild(v);}
    if(a.veri_notu)k.appendChild(el("p","bekliyor",a.veri_notu));
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape")$("kanitPanel").hidden=true;});
  document.addEventListener("click",e=>{const p=$("kanitPanel");if(!p.hidden&&!p.contains(e.target)&&!e.target.closest(".kod,.sh-yer"))p.hidden=true;});
  async function ac(x){secili=x;history.replaceState(null,"","#"+x.tur+"-"+x.anahtar);listele();
    $("icerik").innerHTML='<p class="bos2">Yükleniyor…</p>';
    try{ciz(await fetch("data/bulten/"+x.tur+"/"+x.anahtar+".json?t="+Date.now()).then(r=>r.json()));}catch(e){$("icerik").innerHTML='<p class="bos2">Bülten okunamadı.</p>';}}
  function listele(){
    const sk=$("sekmeler");sk.innerHTML="";Object.entries(TUR).forEach(([t,l])=>{const b=el("button",null,l);b.type="button";b.setAttribute("aria-pressed",t===tur);b.onclick=()=>{tur=t;const ilk=dizin.find(x=>x.tur===t);if(ilk)ac(ilk);else listele();};sk.appendChild(b);});
    const d=$("donemler");d.innerHTML="";const l=dizin.filter(x=>x.tur===tur);
    if(!l.length)d.appendChild(el("p","bos2","Bu türde henüz bülten yok."));
    l.forEach(x=>{const b=el("button");b.type="button";b.setAttribute("aria-pressed",secili===x);b.appendChild(el("span",null,x.ad));b.appendChild(el("small",null,(x.taslak?"taslak · ":"")+x.haber+" haber"));b.onclick=()=>ac(x);d.appendChild(b);});
  }
  fetch("data/bulten/dizin.json?t="+Date.now()).then(r=>r.json()).then(d=>{dizin=d;
    if(!d.length){listele();$("icerik").innerHTML='<p class="bos2">İlk bülten toplayıcının bir sonraki çalışmasında yazılacak.</p>';return;}
    const m=/^#(haftalik|aylik|yillik)-(.+)$/.exec(location.hash);const x=(m&&d.find(y=>y.tur===m[1]&&y.anahtar===m[2]))||d.find(y=>y.tur==="haftalik")||d[0];tur=x.tur;ac(x);
  }).catch(()=>{listele();$("icerik").innerHTML='<p class="bos2">İlk bülten toplayıcının bir sonraki çalışmasında yazılacak.</p>';});
})();
