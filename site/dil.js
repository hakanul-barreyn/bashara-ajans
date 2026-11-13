// Sitenin dili: TR · EN (AR sonraki aşamada). Bütün sayfalarda, marka.js'ten ÖNCE yüklenir.
// Seçim sırası: ?lang= bağlantısı > daha önce seçilen dil > tarayıcının dili (Türkçe değilse İngilizce).
// Arayüz metinleri sayfa çizildikçe sözlükten çevrilir (tam eşleşme + kalıplar). Haber içeriği çevrilmez:
// başlık, özet ve olay notları toplayıcının yazdığı İngilizce alanlardan okunur (uygulama.js).
(function () {
  "use strict";
  var DILLER = { tr: { kisa: "TR", ad: "Türkçe", yon: "ltr", yerel: "tr-TR" }, en: { kisa: "EN", ad: "English", yon: "ltr", yerel: "en-GB" } };
  var dil = null;
  try { var q = new URLSearchParams(location.search).get("lang"); if (q && DILLER[q]) dil = q; } catch (e) {}
  if (!dil) { try { var s = localStorage.getItem("zbs-dil"); if (s && DILLER[s]) dil = s; } catch (e) {} }
  if (!dil) { var n = (navigator.language || "tr").toLowerCase(); dil = n.indexOf("tr") === 0 ? "tr" : "en"; }
  try { localStorage.setItem("zbs-dil", dil); } catch (e) {}
  window.DIL = dil; window.YEREL = DILLER[dil].yerel;
  // Görsel aktarıcı: haber görselleri ve logolar kaynak siteden değil wsrv.nl üzerinden yüklenir;
  // böylece kaynak siteler (İsrail yayınları dahil) okurun IP adresini görmez. Görseller küçültülüp sıkıştırılır.
  window.AKTAR = function (url, w) {
    if (!url || !/^https?:\/\//.test(url)) return url;
    return "https://wsrv.nl/?url=" + encodeURIComponent(url) + "&w=" + (w || 900) + "&we&output=webp&q=78";
  };
  document.documentElement.lang = dil; document.documentElement.dir = DILLER[dil].yon;

  // ---------------------------------------------------------------- İngilizce sözlük
  var EN = {
    // menü ve genel
    "Akış": "Feed", "Arşiv": "Archive", "Almanak": "Almanac", "Raporlar": "Reports", "Rapor": "Report", "Raporlar · Özel rapor": "Reports · Special report", "ZBS veri masası": "ZBS data desk", "İsimler": "Names", "Kaynaklar": "Sources", "Hakkımızda": "About",
    "Canlı": "Live", "Yükleniyor": "Loading", "Yükleniyor…": "Loading…", "Son dakika": "Breaking", "Son haberler": "Latest news", "SON DAKİKA": "BREAKING", "YENİ": "NEW",
    "Veri okunamadı": "Could not load data", "Gündem": "Top stories", "Analizler": "Analysis", "Analiz": "Analysis",
    " · birden fazla kaynağın yazdığı olaylar": " · events covered by several outlets", " · olayların ötesine bakan yazılar": " · writing that looks beyond the events",
    "Tümünü gör →": "See all →", "Kim nasıl yazdı →": "Who reported it how →", "Önceki olay": "Previous event", "Sonraki olay": "Next event",
    "slayt gösterisi": "slideshow",
    // süzgeçler
    "Haberlerde ya da kaynaklarda ara": "Search stories or sources", "Ara": "Search", "Şehir": "City", "Tüm şehirler": "All cities",
    "Bölge": "Region", "Konu": "Topic", "Tümü": "All", "Tüm konular": "All topics",
    "Bölgeyle ilgili": "Region-related", "Yalnızca analizler": "Analysis only", "Türkçe özetli": "Summarized", "Görselleri bulanıklaştır": "Blur images",
    " haber · ": " stories · ", " Türkçe · ": " summarized · ", " son saatte": " in the last hour",
    // bölgeler
    "Filistin": "Palestine", "Meşrik": "Mashriq", "Körfez": "Gulf", "Mısır": "Egypt", "İran": "Iran", "Yemen": "Yemen", "Mağrip": "Maghreb",
    "Anadolu-Türkiye": "Anatolia-Türkiye", "İsrail": "Israel", "ABD": "USA", "İngiltere": "UK", "İspanya": "Spain", "İtalya": "Italy",
    "Almanya": "Germany", "Fransa": "France", "Asya ve diğer": "Asia & other", "İsrail’de muhalif basın": "Israeli dissident press",
    "Arap dünyası": "Arab world", "İran ve Yemen": "Iran & Yemen", "İran": "Iran", "Yemen": "Yemen", "Türkiye": "Türkiye", "Batı": "West", "Diğer": "Other",
    // konular
    "Gazze": "Gaza", "Batı Şeria": "West Bank", "Kudüs": "Jerusalem", "Lübnan": "Lebanon", "Suriye": "Syria", "Yemen ve Kızıldeniz": "Yemen & Red Sea",
    "Irak": "Iraq", "Ürdün": "Jordan", "Göç": "Migration", "Diplomasi ve müzakere": "Diplomacy & negotiations", "İnsani durum": "Humanitarian situation",
    "Esirler ve tutuklular": "Captives & detainees", "Uluslararası hukuk": "International law", "Protesto ve dayanışma": "Protest & solidarity",
    "Ekonomi ve boykot": "Economy & boycott", "İsrail iç siyaseti": "Israeli domestic politics", "Avrupa": "Europe",
    // diller
    "Arapça": "Arabic", "İngilizce": "English", "Fransızca": "French", "Türkçe": "Turkish", "İbranice": "Hebrew", "İspanyolca": "Spanish",
    "Katalanca": "Catalan", "İtalyanca": "Italian", "Almanca": "German",
    // yayın türü, çizgi, bakış
    "devlet": "state", "bağlı": "affiliated", "bağımsız": "independent", "kooperatif": "cooperative", "özel": "private",
    "Devlet": "State", "Bağlı": "Affiliated", "Bağımsız": "Independent", "Özel": "Private",
    "Antiemperyalist / dekolonyal": "Anti-imperialist / decolonial", "Ara / ana akım": "Middle / mainstream",
    "İşbirlikçi kompradorlar ve emperyalistler": "Comprador collaborators and imperialists", "tartışmalı": "contested",
    "Filistin bakışı": "Palestinian perspective", "Aktarım": "Relay", "İsrail / ABD bakışı": "Israeli / US perspective",
    "Filistin / Arap bakışı": "Palestinian / Arab perspective",
    "İsrail merkezli yayın": "Israel-based outlet", "BAE yayını": "UAE outlet",
    // kart
    "Kaynağa git ↗": "Go to source ↗", "Kaynağa git": "Go to source", "Telegram’da aç ↗": "Open on Telegram ↗",
    "Kaynağa git (Google Haberler üzerinden) ↗": "Go to source (via Google News) ↗",
    "Wayback’e kaydet": "Save to Wayback", "Arşivlendi ✓": "Archived ✓", "Paylaş": "Share", "Bağlantıyı kopyala": "Copy link", "Kopyalandı": "Copied",
    "Bağlantı": "Link", "Görseli göstermek için dokun": "Tap to show image", "Sahadan görsel; ağır olabilir. Göstermek için dokun": "Image from the field; may be distressing. Tap to show",
    "Yazıyı oku ↗": "Read the article ↗", "Türkçe özet sırada": "English summary pending", "Paylaşılan haber": "Shared story", "❌ Yanlış çıktı": "❌ Proven false", "⚠️ Çelişkili iddia": "⚠️ Disputed claim", "🔍 Doğrulanmamış": "🔍 Unverified", "Kanıt ↗": "Evidence ↗", "← Tüm haberler": "← All stories", "Paylaşılan haber arşivde aranıyor…": "Looking for the shared story in the archive…", "Paylaşılan haber bulunamadı.": "The shared story could not be found.",
    "Açıklamanın tam çevirisi": "Full translation of the statement",
    // olay sayfası
    "Akışa dön ✕": "Back to feed ✕", "Denge: kim, kimin gözünden anlattı": "Balance: who told it from whose perspective",
    "Filistin bakışından uzaklık (0–2)": "Distance from the Palestinian perspective (0–2)",
    "Her kare bir haber; üzerine gelince yayını ve başlığı görürsün.": "Each square is one story; hover to see the outlet and headline.",
    "Ölçeğin başlangıç noktası Filistin bakışıdır; aktarım bir adım, İsrail / ABD bakışı en uzak basamaktır. ": "The scale starts from the Palestinian perspective; relay is one step away, the Israeli / US perspective is the farthest. ",
    "Bakış ölçeği nasıl işliyor": "How the perspective scale works",
    "Kaynakların çizgisi": "Editorial line of the sources", "Kaynakların bölgesi": "Region of the sources", "Kaynakların sahipliği": "Ownership of the sources",
    "Kaynaklar nasıl anlattı: ": "How the sources told it: ",
    "Bölge ve sahiplik dağılımı kaynak listemizden hesaplanır. Çerçeve notu ve kaynak betimlemeleri başlıklar karşılaştırılarak yapay zekâyla yazılır; haberlerin tamamı için kaynaklara git.": "Region and ownership shares come from our source list. The framing note and source descriptions are written by AI by comparing headlines; go to the sources for the full stories.",
    "Denge çubuğu ": "The balance bar is based on ", "Hakkımızda ": "About ", " sayfasında.": " page.",
    "Filistin bakışından ortalama uzaklık: 0 başlangıç noktası, 1 aktarım, 2 İsrail / ABD bakışı": "Average distance from the Palestinian perspective: 0 starting point, 1 relay, 2 Israeli / US perspective",
    "⏱ İsrail ve Batı basını bu olayı henüz yazmadı.": "⏱ Israeli and Western press have not reported this yet.",
    "⏱ İki taraf da aynı saatlerde yazdı.": "⏱ Both sides reported it at about the same time.",
    "Kör nokta: Batı ve İsrail basını bu olayı yazmadı.": "Blind spot: Western and Israeli press did not report this.",
    "Kör nokta: Filistin ve Arap basını bu olayı yazmadı.": "Blind spot: Palestinian and Arab press did not report this.",
    "Çevrilmedi: sivillere şiddet çağrısı içeriyor": "Not translated: contains a call for violence against civilians",
    " · özgün metni görmek için dokun": " · tap to see the original text",
    // boş durumlar
    "Bu süzgeçle eşleşen haber yok. Süzgeçleri gevşetmeyi dene.": "No stories match these filters. Try loosening them.",
    "Henüz haber yok. Toplayıcı ilk kez çalıştığında haberler burada görünecek.": "No stories yet. They will appear here after the collector's first run.",
    "Paylaşılan haber artık akışta değil (akış son iki günü gösteriyor). ": "The shared story is no longer in the feed (the feed shows the last two days). ",
    "Arşivde ara": "Search the archive", "Hepsi bu kadar. Yayınların kim olduğunu ": "That's all. You can see who the outlets are on the ",
    " sayfasında bulabilirsin.": " page.",
    // alt not (index)
    " haberleri kaynaklardan otomatik toplar, Türkçe özetini yapay zekâyla yazar. Özetler kaynağın yerine geçmez; her haberde orijinaline bağlantı var. Yayınların kim olduğunu ": " collects stories from the sources automatically and writes summaries with AI. Summaries do not replace the source; every story links to the original. You can see who the outlets are on the ",
    " sayfasında bulabilirsin. Türkçe özetleri ": " page. Follow the summaries via ",
    " ile de takip edebilirsin. Sınırlar: ": ". Borders: ",
    // diğer sayfalarda başlıklar
    "Arşiv ": "Archive ", "Bu günün haberlerinde ara": "Search this day's stories", "Haftalık": "Weekly", "Aylık": "Monthly", "Yıllık": "Yearly",
    "Ad, şehir ya da profil ara": "Search name, city or profile", "Çalışıyor": "Working", "Sessiz (6 saatten uzun)": "Quiet (over 6 hours)",
    "Okunamıyor": "Unreachable", "Henüz denenmedi": "Not tried yet", "Belgelenmiş kanıtlar": "Documented evidence", "Ölçülmüş söylem": "Measured discourse",
    "Çizgi değerlendirmesi nasıl yapıldı": "How the editorial-line assessment works",
    "{ad} Arşiv": "{ad} Archive", "{ad} Kaynakları": "{ad} Sources", "{ad} Hakkında": "About {ad}", "{ad} Almanak": "{ad} Almanac", "{ad} ana sayfa": "{ad} home",
    "Bu sayfanın tamamı henüz İngilizceye çevrilmedi; başlıklar ve düğmeler çevrili, açıklamalar Türkçe.": "This page is not fully translated yet: headings and buttons are in English, descriptions are still in Turkish."
  };
  // şehir adları (kartlarda ve şehir seçicide)
  var SEHIR = { "Kudüs": "Jerusalem", "Gazze": "Gaza", "Beyrut": "Beirut", "Şam": "Damascus", "Kahire": "Cairo", "Bağdat": "Baghdad", "Tahran": "Tehran",
    "Sana": "Sanaa", "Riyad": "Riyadh", "Abu Dabi": "Abu Dhabi", "Londra": "London", "Roma": "Rome", "Barselona": "Barcelona", "Hayfa": "Haifa",
    "İstanbul": "Istanbul", "Cezayir": "Algiers", "Tunus": "Tunis", "Kazablanka": "Casablanca", "Trablus": "Tripoli", "Bingazi": "Benghazi",
    "Süleymaniye": "Sulaymaniyah", "Beytüllahim": "Bethlehem", "Cenin": "Jenin", "Halep": "Aleppo", "Brüksel": "Brussels", "Cenevre": "Geneva",
    "Moskova": "Moscow", "Pekin": "Beijing", "Münih": "Munich", "Viyana": "Vienna", "Milano": "Milan", "Ramallah": "Ramallah", "Tel Aviv-Yafa": "Tel Aviv",
    "Lefkoşa": "Nicosia", "Atina": "Athens", "Kuveyt": "Kuwait City", "Maskat": "Muscat", "Manama": "Manama", "Nuakşot": "Nouakchott", "Hartum": "Khartoum",
    "İskenderiye": "Alexandria", "Napoli": "Naples", "Floransa": "Florence", "Lizbon": "Lisbon", "Varşova": "Warsaw", "Prag": "Prague", "Kopenhag": "Copenhagen",
    "Washington D.C.": "Washington, D.C.", "Kamışlı": "Qamishli", "Karaçi": "Karachi", "Nasıra": "Nazareth", "Trablusgarp": "Tripoli",
    "Diyarbakır": "Diyarbakır", "Beytüllahim": "Bethlehem" };

  var KALIP = [
    [/^az önce$/, function () { return "just now"; }],
    [/^(\d+) dk önce$/, function (m) { return m[1] + " min ago"; }],
    [/^(\d+) sa önce$/, function (m) { return m[1] + " h ago"; }],
    [/^(\d+) gün önce$/, function (m) { return m[1] + " d ago"; }],
    [/^Güncellendi · (.+)$/, function (m) { return "Updated · " + cevir(m[1]); }],
    [/^(\d+) \/ (\d+) · (\d+) kaynak · son (.+)$/, function (m) { return m[1] + " / " + m[2] + " · " + m[3] + " sources · latest " + cevir(m[4]); }],
    [/^(\d+) kaynak · son (.+)$/, function (m) { return m[1] + " sources · latest " + cevir(m[2]); }],
    [/^(\d+) kaynak · (\d+) haber$/, function (m) { return m[1] + " sources · " + m[2] + " stories"; }],
    [/^(\d+) haber$/, function (m) { return m[1] + (m[1] === "1" ? " story" : " stories"); }],
    [/^İlk yazan: (.+?) · (.+)$/, function (m) { return "First reported by: " + m[1] + " · " + m[2]; }],
    [/^⏱ İsrail ve Batı basını ([\d.,]+) (dakika|saat) sonra yazdı\.$/, function (m) { return "⏱ Israeli and Western press reported it " + m[1] + (m[2] === "dakika" ? " minutes" : " hours") + " later."; }],
    [/^⏱ İsrail ve Batı basını bölge basınından ([\d.,]+) (dakika|saat) önce yazdı\.$/, function (m) { return "⏱ Israeli and Western press reported it " + m[1] + (m[2] === "dakika" ? " minutes" : " hours") + " before the regional press."; }],
    [/^Kör nokta: kaynakların %(\d+)’i (.+) basınından\.$/, function (m) { return "Blind spot: " + m[1] + "% of the sources are " + cevir(m[2]) + " press."; }],
    [/^Kör nokta: bu olayı ağırlıkla işbirlikçi ve emperyalist çizgideki yayınlar yazdı \(%(\d+)\)\.$/, function (m) { return "Blind spot: mostly covered by collaborator and imperialist outlets (" + m[1] + "%)."; }],
    [/^Kör nokta: bu olayı ağırlıkla antiemperyalist çizgideki yayınlar yazdı; ana akım ve işbirlikçi çizgideki yayınlar az yazdı \(%(\d+)\)\.$/, function (m) { return "Blind spot: mostly covered by anti-imperialist outlets; mainstream and collaborator outlets wrote little (" + m[1] + "%)."; }],
    [/^Bu olayı (\d+) kaynak yazdı · nasıl anlattıklarını gör →$/, function (m) { return m[1] + " sources covered this · see how they told it →"; }],
    [/^([\d.,]+) · (başlangıçta|bir adım uzak|en uzak)$/, function (m) { return m[1] + " · " + { "başlangıçta": "at the start", "bir adım uzak": "one step away", "en uzak": "farthest" }[m[2]]; }],
    [/^(.+) · Türkçe özet (sırada|yazılmadı)$/, function (m) { return cevir(m[1]) + " · English summary " + (m[2] === "sırada" ? "pending" : "not written"); }],
    [/^Görsel: (.+)$/, function (m) { return "Image: " + m[1]; }],
    [/^#(.+)$/, function (m) { return "#" + cevir(m[1]); }],
    [/^(.+) · (\d+)$/, function (m) { return (SEHIR[m[1]] || m[1]) + " · " + m[2]; }],
    [/^(.+) · $/, function (m) { return (SEHIR[m[1]] || cevir(m[1])) + " · "; }],
    [/^(\d+) olayı İsrail ve Batı$/, function (m) { return m[1] + " events Israeli and Western"; }],
    [/^(\d+)\. olay: (.+)$/, function (m) { return "Event " + m[1] + ": " + m[2]; }],
    [/^([^,:]+ \d+)(, [^,:]+ \d+)+$/, function (m) { return m[0].split(", ").map(function (x) { var q = /^(.+) (\d+)$/.exec(x); return q ? cevir(q[1]) + " " + q[2] : x; }).join(", "); }],
    [/^(\d) · (.+)$/, function (m) { return m[1] + " · " + cevir(m[2]); }],
    [/^(.+) (\d+)%$/, function (m) { var y = cevir(m[1]); return y === m[1] ? null : y + " " + m[2] + "%"; }],
    [/^Denge çubuğu (.+)’nin her yayına verdiği editoryal çizgi değerlendirmesine dayanır; ölçütleri $/, function (m) { return "The balance bar is based on the editorial-line assessment " + m[1] + " gives each outlet; the criteria are on the "; }],
    [/^(.+): (\d+ [^,]+(, \d+ [^,]+)*)$/, function (m) { var a = cevir(m[1]); var b = m[2].split(", ").map(function (x) { var q = /^(\d+) (.+)$/.exec(x); return q ? q[1] + " " + cevir(q[2]) : x; }).join(", "); return a + ": " + b; }]
  ];
  var ROZET = [[/^(.+) açıklaması$/, function (m) { return m[1] + " statement"; }]];

  function cevir(t) {
    if (dil === "tr" || t == null) return t;
    var s = String(t);
    if (Object.prototype.hasOwnProperty.call(EN, s)) return EN[s];
    if (SEHIR[s]) return SEHIR[s];
    for (var i = 0; i < KALIP.length; i++) { var m = KALIP[i][0].exec(s); if (m) { var y = KALIP[i][1](m); if (y != null) return y; } }
    if (s.indexOf(" · ") > 0) {
      var p = s.split(" · "), deg = false;
      p = p.map(function (x) { var y = parcaCevir(x); if (y !== x) deg = true; return y; });
      if (deg) return p.join(" · ");
    }
    return s;
  }
  function parcaCevir(x) {
    if (Object.prototype.hasOwnProperty.call(EN, x)) return EN[x];
    if (SEHIR[x]) return SEHIR[x];
    for (var i = 0; i < KALIP.length; i++) { var m = KALIP[i][0].exec(x); if (m && KALIP[i][0].source.indexOf(" · ") < 0) { var y = KALIP[i][1](m); if (y != null) return y; } }
    return x;
  }
  window.T = cevir;
  window.SEHIR_AD = function (s) { return dil === "tr" ? s : (SEHIR[s] || s); };

  // ---------------------------------------------------------------- sayfadaki metinleri çevir
  var ATLA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function dugum(n) {
    if (n.nodeType === 3) {
      var p = n.parentNode; if (!p || ATLA[p.nodeName] || (p.closest && p.closest("[data-cevirme]"))) return;
      var ham = n.nodeValue; if (!ham || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(ham)) return;
      var y = cevir(ham);
      if (y === ham && p.classList && p.classList.contains("rozet")) {
        for (var i = 0; i < ROZET.length; i++) { var m = ROZET[i][0].exec(ham); if (m) { y = ROZET[i][1](m); break; } }
      }
      if (y === ham) { var kirp = ham.trim(); if (kirp !== ham) { var y2 = cevir(kirp); if (y2 !== kirp) y = ham.replace(kirp, y2); } }
      if (y !== ham) n.nodeValue = y;
      return;
    }
    if (n.nodeType !== 1 || ATLA[n.nodeName] || n.hasAttribute("data-cevirme")) return;
    ["placeholder", "title", "aria-label"].forEach(function (a) { var v = n.getAttribute(a); if (v) { var y = cevir(v); if (y !== v) n.setAttribute(a, y); } });
    for (var c = n.firstChild; c; c = c.nextSibling) dugum(c);
  }
  // Bir dilde ayrı yazılmış bloklar: <div data-dil="tr">…</div><div data-dil="en">…</div>
  function bloklar() {
    var var_ = {}; document.querySelectorAll("[data-dil]").forEach(function (e) { var_[e.getAttribute("data-dil")] = 1; });
    var goster = var_[dil] ? dil : "tr";
    document.querySelectorAll("[data-dil]").forEach(function (e) { e.hidden = e.getAttribute("data-dil") !== goster; });
  }
  // Dil seçici: üst çubukta TR · EN
  function secici() {
    var ust = document.querySelector(".ust-ic"); if (!ust || ust.querySelector(".dil-sec")) return;
    var k = document.createElement("div"); k.className = "dil-sec"; k.setAttribute("role", "group"); k.setAttribute("aria-label", "Dil / Language");
    Object.keys(DILLER).forEach(function (d) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = DILLER[d].kisa; b.title = DILLER[d].ad;
      b.setAttribute("aria-pressed", d === dil ? "true" : "false"); b.lang = d;
      b.onclick = function () {
        try { localStorage.setItem("zbs-dil", d); } catch (e) {}
        var u = new URL(location.href); u.searchParams.set("lang", d); location.href = u.toString();
      };
      k.appendChild(b);
    });
    var menu = ust.querySelector(".menu"); ust.insertBefore(k, menu || null);
  }
  function basla() {
    secici(); bloklar();
    if (dil === "tr") return;
    dugum(document.body);
    document.title = cevir(document.title);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) {
        if (m.type === "characterData") dugum(m.target);
        else m.addedNodes.forEach(dugum);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", basla); else basla();
})();
