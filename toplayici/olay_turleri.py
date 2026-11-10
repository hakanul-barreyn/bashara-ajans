"""Olay türleri, yer sözlüğü ve liderler: başlık düzeyinde, 8 dilde kalıplarla tespit.

Bir başlık bir türe, o türün bütün kalıp gruplarından birer eşleşme verirse girer (ör. hastane = hastane kelimesi VE
saldırı kelimesi). Kalıplar küçük harfle yazılır; harf işaretsiz (adresten türetilmiş) başlıklar için gecmis.katla
ile sadeleştirilmiş kopyaları da denenir. Yalnızca Filistin / İsrail / Gazze bağlamındaki başlıklarda çalıştırılır.

Eşleştirme sadeleştirilmiş başlıkta yapılır (küçük harf, harf işaretsiz: "öldü" ile "oldu" ayrılamaz, bu yüzden
"öldü" yalnızca "kişi öldü" gibi tamlamalarda aranır). Kalıplar bilerek dar tutuldu: başka dillerde sık geçen kısa kelimeler (İspanyolca "su", Fransızca "un", Arapça
"رئيسي", "الأهلي", "لولا" gibi) ya çıkarıldı ya da bir tamlama içinde arandı.
"""

SALDIRI = (r"saldır|bombal|bombard|hedef al|ateş aç|ateş edil|baskın düzen|basıldı|kuşat|yakıldı|yaktı|ateşe ver|yıkıldı|yerle bir|"
           r"vurdu|vuruldu|vurulan|vuruyor|vurması|vurdu[ğk]|"
           r"strike|struck|attack|bomb|shell(?:ed|ing|s)\b|raid|stormed|storming|\bhits?\b|fire[sd]? on|opens? fire|opened fire|torched|burn(?:s|ed|ing|t)\b|besieg|siege|destroy|"
           r"frappe|attaqu|tir[ée]s? sur|assaut|incendi|ataque|atacan|atacó|bombarde|asalt|asedi|"
           r"attacc|colpit|assedi|angriff|angegriffen|beschoss|bombardier|gestürmt|stürm|"
           r"قصف|استهداف|استهدف|غارة|غارات|اقتحام|اقتحم|حصار|محاصرة|إحراق|حرق|تدمير|נתקף|תקיפ|הפצצ|פשיטה")
OLDURME = (r"öldür|(?:kişi|filistinli|çocuk|sivil|insan|kadın|gazeteci|bebek|asker|doktor|hasta|kişi daha) öldü\b|katled|katliam|can verdi|hayatını kaybet|şehit|ölü\b|ölüler|ölü sayı|yaralı|"
           r"kill|dead\b|died|death|wounded|injur|martyr|slain|"
           r"\btu[ée]s?\b|\bmorts?\b|blessés?\b|muert|mueren|herid|uccis|\bmort[ie]\b|feriti\b|getötet|\btote\b|verletzt|"
           r"قتل|شهيد|شهداء|استشهاد|ضحايا|مصاب|جرحى|נהרג|הרוג|פצוע")
ATES = (r"ateş|kurşun|vuruldu|vurulan|öldürül|katliam|shot\b|shoot|gunfire|fire[sd]? on|open(?:ed|s)? fire|killed|massacre|"
        r"tirs?\b|abattu|tués?\b|disparo|disparan|dispararon|matan|masacre|spar[ai]|uccis|strage|schüsse|erschossen|getötet|massaker|"
        r"إطلاق النار|اطلاق النار|إطلاق نار|رصاص|مجزرة|قتل|استشهاد|שירי|ירי")
COCUK = (r"çocuk|bebek|\bchild|children|\bkids?\b|\bbab(?:y|ies)\b|infant|toddler|\benfants?\b|bébé|\bniñ[oa]s?\b|\bbebés?\b|"
         r"bambin|neonat|\bkinder\b|säugling|طفل|أطفال|اطفال|رضيع|رضع|ילד|תינוק")
SALDIRI_OLUM = SALDIRI + "|" + OLDURME
# Faili silahlı Filistin grupları olan haberler (ör. "Kassam keskin nişancısı İsrail askerini vurdu") olay türüne girmesin
DIRENIS = (r"qassam|kassam|القسام|سرايا القدس|المقاومة|resistance|direniş|hamas|حماس|hezbollah|hizbullah|حزب الله|"
           r"soldiers? (?:was |were )?killed|soldiers? (?:was |were )?(?:shot|wounded)|asker (?:öldü|hayatını|yaralan)|جندي|جنود إسرائيليين|جنديا")
AKSA_HARIC = r"aksa|al-aqsa|al aqsa|الأقصى|الاقصى"

# (anahtar, ad, [kalıp grupları], isteğe bağlı hariç kalıbı)
TURLER = [
    ("hastane", "Hastanelere saldırı", [
        r"hastane|hospital|hôpital|ospedal|krankenhaus|klinik|\bclinic|clinique|مستشفى|مستشفيات|مجمع الشفاء|בית חולים|בתי חולים",
        SALDIRI],
        # hastanenin yalnızca haber kaynağı ya da yaralıların götürüldüğü yer olduğu başlıklar
        r"مصدر في مستشفى|مصادر في مستشفى|مصادر طبية|إلى مستشفى|الى مستشفى|يصلون|يصل إلى|نقل|وصول|خارج مستشفى|taken to|rushed to|arrive|transported|"
        r"transferred|to (?:a |the )?hospital|hospital (?:says|said|sources?|officials?|director)|according to (?:the )?hospital|hastaneye|tıbbi kaynak|"
        r"selon l'hôpital|à l'hôpital|al hospital|all'ospedale|ins krankenhaus"),
    ("cadir", "Çadırların vurulması", [
        r"çadır|\btents?\b|\btentes?\b|tiendas? de campaña|\btend[ae]\b|zelte?\b|خيمة|خيم النازحين|خيام النازحين|خيام نازحين|خيام للنازحين|خيام اللاجئين|مخيم النازحين|אוהל",
        SALDIRI_OLUM], r"fırtına|yağmur|\bsel\b|storm|rain|flood|tempête|pluie|lluvia|tormenta|pioggia|maltempo|unwetter|المنخفض|منخفض جوي|الأمطار|أمطار|غرق"),
    ("yardim", "Yardım ve yemek bekleyenlere ateş", [
        r"yardım bekle|yardım almak|yardım almaya|yardım kuyru|yardım dağıtım|yardım noktası|yardım merkez|gıda yardımı|ekmek kuyru|"
        r"un kuyru|un almak|un almaya|un çuval|un dağıt|un bekle|yiyecek bekle|yiyecek almak|yiyecek arayan|yardım tır|yardım konvoy|"
        r"aid[- ]seekers|seeking aid|waiting for (?:aid|food|flour)|aid distribution|aid sites?\b|aid points?\b|aid queue|aid line|"
        r"food distribution|food lines?\b|food queue|seeking food|search(?:ing)? (?:of|for) food|for food\b|flour|bread lines?\b|bakery|"
        r"\bghf\b|gaza humanitarian foundation|aid trucks?\b|aid convoy|aid cent(?:er|re)s?|aid hubs?\b|distribution (?:cent|points?|sites?|hubs?)|"
        r"distribution d'aide|distribution alimentaire|en quête de nourriture|chercher de la nourriture|attente de l'aide|aide alimentaire|farine|"
        r"buscaban comida|en busca de comida|esperaban (?:ayuda|comida)|reparto de (?:ayuda|comida)|distribución de ayuda|harina|"
        r"in cerca di cibo|distribuzione (?:degli aiuti|di cibo)|attesa degli aiuti|farina|"
        r"hilfsgüterverteil|essensausgabe|lebensmittelverteil|auf hilfe wart|\bmehl\b|"
        r"منتظري المساعدات|طالبي المساعدات|منتظري الطحين|مراكز توزيع|نقطة توزيع|مركز توزيع|توزيع المساعدات|الطحين|المجوعين|الجياع|"
        r"شاحنات المساعدات|مصائد الموت|مؤسسة غزة الإنسانية|חלוקת סיוע|מרכזי חלוקה",
        ATES + r"|kill|katlet|öldür|مقتل|شهداء"]),
    ("keskin", "Keskin nişancı ateşi", [
        r"keskin nişancı|snipers?\b|sniper fire|tireurs? d'élite|francotirador|cecchin|scharfschütze|قناص|قناصة|القناصة|צלף"],
        DIRENIS),
    ("bas", "Başından vurulanlar", [
        r"başından vur|kafasından vur|başına isabet|kafasına isabet|shot in the head|head wounds?|headshot|gunshot wounds? to the head|"
        r"balle dans la tête|dans la tête|tiro en la cabeza|disparo en la cabeza|colpo alla testa|alla testa|kopfschuss|in den kopf|"
        r"في الرأس|برصاصة في رأسه|בראש"]),
    ("cocuk", "Çocukların öldürülmesi", [COCUK, SALDIRI_OLUM]),
    ("su", "Su arayanların vurulması", [
        r"\bsu (?:almak|almaya|taşı|kuyru|dağıt|arayan|doldur|bekle|bidon|deposu|kuyusu|istasyon|noktası|tankı|tankeri)|arıtma tesis|susuz|"
        r"water (?:points?|queues?|lines?|distribution|collection|tanks?|trucks?|stations?|wells?|plants?|carriers?|containers?|jerry ?cans?|jugs?)\b|"
        r"(?:fetch(?:ing)?|collect(?:ing)?|queu\w* for|carry(?:ing)?|carried|seeking|search(?:ing)? for|waiting for|getting|gathering) water|desalination|"
        r"point d'eau|chercher de l'eau|distribution d'eau|dessalement|buscar agua|buscaban agua|punto de agua|recoger agua|desaladora|"
        r"prendere (?:l')?acqua|punto d'acqua|distribuzione d'acqua|wasser holen|wasserstelle|wasserausgabe|wasserverteil|entsalzung|"
        r"نقطة مياه|نقطة توزيع مياه|تعبئة المياه|تعبئة مياه|طابور المياه|منتظري المياه|خزان مياه|بئر مياه|محطة تحلية|جلب المياه|جلب الماء|يحمل الماء|غالونات",
        SALDIRI_OLUM]),
    ("guvenli", "“Güvenli bölge”lere saldırı", [
        r"güvenli bölge|insani bölge|tahliye bölge|safe zone|humanitarian zone|evacuation zone|zone humanitaire|zone sûre|"
        r"zona segura|zona humanitaria|zona umanitaria|zona sicura|schutzzone|sichere zone|humanitäre zone|mevasi|mawasi|mawassi|"
        r"المواصي|المنطقة الآمنة|المنطقة الإنسانية|منطقة إنسانية|מוואסי|אזור הומניטרי",
        SALDIRI_OLUM]),
    ("okul", "Okul ve sığınaklara saldırı", [
        r"okul|sığınak|barınma merkez|unrwa (?:okul|school|facility|facilities|tesis|building|bina|shelter|sığınak|depo|warehouse|headquarters|merkez|école|escuela|scuola)|\bschools?\b|shelters?\b|\bécoles?\b|escuela|refugio|scuol|rifugio|\bschule|unterkunft|"
        r"مدرسة|مدارس|مركز إيواء|مراكز الإيواء|مركز للإيواء|الأونروا|בית ספר",
        SALDIRI_OLUM]),
    ("ibadet", "Cami ve kiliselere saldırı", [
        r"\bcami\b|camii|camiye|camisi|mescid|kilise|mosques?\b|church|mosquée|église|mezquita|\biglesia\b|iglesias (?:de|del|en)|moschea|chiesa|moschee|kirche|مسجد|مساجد|كنيسة|כנסייה|מסגד",
        SALDIRI], AKSA_HARIC),
    ("aksa", "Mescid-i Aksa baskınları", [
        r"aksa|al-aqsa|al aqsa|el-aksa|الأقصى|الاقصى|temple mount|tapınak dağı|esplanade des mosquées|explanada de las mezquitas|tempelberg|הר הבית",
        r"baskın|basıldı|bastı|storm|raid|incursion|intrusion|irrupción|irruzione|erstürm|اقتحام|اقتحم|اقتحامات|يقتحم|يقتحمون|עלייה"],
        r"şehitleri|şehidleri|martyrs|شهداء الأقصى|طوفان الأقصى|aqsa flood|aksa tufan|déluge d'al-aqsa|al-aqsa hospital"),
    ("saglik", "Sağlık çalışanlarının öldürülmesi", [
        r"doktor|hekim|hemşire|sağlık çalışan|sağlıkçı|paramedik|ambulans|sivil savunma (?:ekip|personel|mensub|çalışan|görevli)|\bdoctors?\b|nurses?\b|\bmedics?\b|paramedic|"
        r"health ?(?:care)? workers?|ambulance|civil defen[cs]e (?:workers?|members?|crews?|personnel|teams?|volunteers?)|médecins?\b|infirmi|secouristes?|ambulanc|médicos?\b|enfermer|"
        r"sanitari\b|medici\b|ambulanz|sanitäter|ärzt|طبيب|أطباء|ممرض|مسعف|طواقم طبية|الطواقم الطبية|طواقم الدفاع المدني|عناصر الدفاع المدني|أفراد الدفاع المدني|من الدفاع المدني|طواقم الإسعاف|سيارة إسعاف|سيارات الإسعاف|مسعفين|רופא|חובש",
        SALDIRI_OLUM], r"frontières|frontiere|borders|fronteras|grenzen|sınır tanımayan|بلا حدود|7 ottobre|7 octobre|7 october|7 ekim|kibbutz|magen david|نجمة داوود|الإسعاف الإسرائيلي|israeli ambulance|israeli paramedic"),
    ("yardimci", "Yardım çalışanlarının öldürülmesi", [
        r"yardım çalışan|yardım görevli|insani yardım çalışan|unrwa (?:çalışan|personel|staff|employee)|aid workers?|humanitarian workers?|"
        r"world central kitchen|\bwck\b|travailleurs humanitaires|humanitaires tués|cooperantes|trabajadores humanitarios|operatori umanitari|"
        r"humanitäre helfer|hilfskräfte|helfer getötet|عمال الإغاثة|موظفي الأونروا|المطبخ المركزي العالمي|عاملي الإغاثة",
        OLDURME]),
    ("iskence", "Hapishanede işkence ve tecavüz", [
        r"işkence|tecavüz|cinsel istismar|cinsel şiddet|torture|tortur|\brape|sexual abuse|sexual violence|sodomi|abus sexuel|\bviol\b|"
        r"violences sexuelles|tortura|violación|violencia sexual|stupr|abusi sessuali|folter|vergewaltig|sexuelle gewalt|"
        r"تعذيب|اغتصاب|اعتداء جنسي|عنف جنسي|עינוי|אונס|התעללות מינית|sde teiman|sde teyman|سدي تيمان|שדה תימן",
        r"esir|tutuklu|gözaltı|hapis|cezaev|kamp|prisoner|detainee|detention|prison|jail|custody|\bcamp\b|détenu|prisonnier|détention|"
        r"\bpres[oa]s\b|detenid|prisión|cárcel|detenut|prigion|carcer|häftling|gefangen|\bhaft\b|gefängnis|أسير|أسرى|الأسرى|معتقل|سجن|سجون|"
        r"المعتقلين|אסיר|עציר|כלא|sde teiman|sde teyman|سدي تيمان|שדה תימן"]),
    ("asagilama", "İnsanların aşağılanması", [
        r"aşağıla|onur kır|soyundur|çırılçıplak|iç çamaşırı|gözleri bağlı|humiliat|strip(?:ped)? (?:naked|to their underwear|of (?:their )?clothes)|stripped and|forced to strip|\bnaked|undress|underwear|"
        r"blindfold|humilié|humilia|déshabill|\bnus\b|desnud|humill|umili|spogliat|demütig|nackt|entkleid|"
        r"إذلال|اذلال|تعرية|عراة|عاريا|معصوب|ملابسهم الداخلية|השפלה|עירום"]),
    ("aclik", "Açlıktan ölümler", [
        r"açlıktan|açlık nedeniyle|yetersiz beslen|starv|malnutrition|malnourish|mort de faim|morts de faim|de faim|de hambre|desnutri|"
        r"di fame|malnutri|verhunger|unterernähr|جوعا|جوعاً|سوء التغذية|بسبب الجوع|التجويع|ברעב",
        OLDURME], r"\bshot\b|shoot|gunfire|open(?:ed|s)? fire|fire[sd]? on|ateş|kurşun|vurul|strike|bomb|قصف|رصاص|إطلاق النار|غارة"),
    ("kitlik", "Kıtlık ve açlık", [
        r"kıtlık|açlık|starv|famine|hunger|malnutrition|faim|hambre|hambruna|carestia|fame\b|hungersnot|مجاعة|الجوع|تجويع|רעב"],
        r"açlık grev|hunger[- ]strik|grève de la faim|huelga de hambre|sciopero della fame|hungerstreik|إضراب عن الطعام|الإضراب عن الطعام|معركة الأمعاء"),
    ("mezar", "Toplu mezarlar", [
        r"toplu mezar|mass graves?|fosses? communes?|charnier|fosas? comunes?|fossa comune|fosse comuni|massengrab|مقبرة جماعية|مقابر جماعية|קבר אחים"]),
    ("bayrak", "Beyaz bayrak taşıyanlara ateş", [
        r"beyaz bayrak|white flags?|drapeau blanc|bandera blanca|bandiera bianca|weiße fahne|weisse fahne|راية بيضاء|الراية البيضاء|דגל לבן"]),
    ("katliam", "“Katliam” olarak anılan saldırılar", [
        r"katliam|massacre|masacre|massaker|strage|carnage|bloodbath|مجزرة|مجازر|טבח"],
        r"hamas|حماس|7 ekim|7 october|7 oktober|7 octobre|7 ottobre|7 de octubre|kibbutz|nova festival|bologna|1956|1948|deir yassin|sabra|tantura"),
]
# İki türün kesişimi: ayrı bir tür olarak sayılır
TUREV = [
    ("cocuk_keskin", "Çocuklara keskin nişancı ateşi", ["cocuk", "keskin"]),
    ("cocuk_bas", "Başından vurulan çocuklar", ["cocuk", "bas"]),
    ("cocuk_su", "Su taşıyan çocukların vurulması", ["cocuk", "su"]),
    ("yardim_asagilama", "Yemek için aşağılanma", ["yardim", "asagilama"]),
]
# (a, b): başlık a türüne girdiyse b türünden çıkar (yardım bekleyen açlar vurulduysa bu "açlıktan ölüm" değildir)
BASTIR = [("yardim", "aclik")]
AD = {t[0]: t[1] for t in TURLER}
AD.update({a: ad for a, ad, _ in TUREV})

# Gazze, Batı Şeria ve hapishanelerde başlıklarda en sık geçen yerler (olayın yerini başlıktan okumak için)
YERLER = [
    ("Şifa Hastanesi", r"şifa hastane|eş-şifa|\bal-shifa|\bshifa\b|\bchifa\b|al-chifa|مجمع الشفاء|مستشفى الشفاء"),
    ("Ehli Baptist Hastanesi", r"ehli baptist|el-ehli|ehli hastane|al-ahli|ahli arab|ahli hospital|baptist hospital|المعمداني|المستشفى الأهلي"),
    ("Nasır Hastanesi", r"nas[sı]e?r (?:hospital|medical|hastane|tıp)|nasır hastane|hôpital nasser|hospital nasser|ospedale nasser|nasser-krankenhaus|مجمع ناصر|مستشفى ناصر"),
    ("Kemal Advan Hastanesi", r"kemal adv|kamal adw|كمال عدوان"),
    ("Endonezya Hastanesi", r"endonezya hastane|indonesian hospital|hôpital indonésien|المستشفى الإندونيسي"),
    ("Avde Hastanesi", r"avde hastane|al-awda hospital|awda hospital|مستشفى العودة"),
    ("Avrupa Hastanesi", r"avrupa hastane|european hospital|gaza european|المستشفى الأوروبي|مستشفى غزة الأوروبي"),
    ("Kudüs Hastanesi", r"kudüs hastane|al-quds hospital|مستشفى القدس"),
    ("Rantisi Hastanesi", r"rantisi|الرنتيسي"),
    ("Mevasi", r"mevasi|mawasi|mawassi|المواصي"),
    ("Refah", r"(?<!yeniden )\brefah\b(?! parti| seviye| devlet| pay)|\brafah|رفح"),
    ("Han Yunus", r"han yunus|khan yun|khan you|khan-yun|خان يونس"),
    ("Deyr el-Belah", r"deyr el|deir al|deir el|دير البلح"),
    ("Nusayrat", r"nusayrat|nuseirat|nusseirat|النصيرات"),
    ("Bureyc", r"bureyc|bureij|البريج"), ("Mağazi", r"mağazi|maghazi|المغازي"),
    ("Cibaliye", r"cibali|jabali|jabaliya|جباليا"), ("Beyt Lahiya", r"beyt lahiy|beit lahi|بيت لاهيا"),
    ("Beyt Hanun", r"beyt hanun|beit hanoun|beit hanun|بيت حانون"),
    ("Şucaiyye", r"şucaiy|şucei|shujai|shejaiya|الشجاعية"), ("Zeytun", r"zeytun mahalle|zeitoun|zaytoun|حي الزيتون"),
    ("Şati Kampı", r"şati kamp|şati mülteci|shati|beach camp|مخيم الشاطئ"),
    ("Tel es-Sultan", r"tel es-sultan|tal al-sultan|tel al-sultan|تل السلطان"),
    ("Nablusi Kavşağı", r"nablusi|nabulsi|النابلسي"), ("Kuveyt Kavşağı", r"kuveyt kavşağ|kuwait roundabout|دوار الكويت"),
    ("Netzarim", r"netzarim|netsarim|نتساريم"), ("Zikim", r"zikim|زيكيم"),
    ("Sde Teiman", r"sde teiman|sde teyman|سدي تيمان|שדה תימן"), ("Ofer Hapishanesi", r"\bofer\b|عوفر"),
    ("Negev / Ketziot", r"ketziot|kziot|سجن النقب"),
    ("Cenin", r"cenin(?:'|’| kamp| mülteci| şehr)|jenin|جنين"), ("Tulkerim", r"tulkerim|tulkarm|tulkarem|طولكرم"),
    ("Nablus", r"\bnablus|نابلس"), ("El Halil", r"el halil|hebron|الخليل"),
]

# Liderler, dışişleri bakanları, sözcüler, BM yetkilileri. (anahtar, görünen ad, grup, kalıp)
LIDERLER = [
    ("erdogan", "Recep Tayyip Erdoğan", "Türkiye", r"erdoğan|erdogan|أردوغان|اردوغان|ארדואן"),
    ("fidan", "Hakan Fidan (Dışişleri)", "Türkiye", r"hakan fidan|bakan fidan|\bfidan'|فيدان"),
    ("biden", "Joe Biden", "ABD", r"\bbiden|بايدن|ביידן"), ("trump", "Donald Trump", "ABD", r"\btrump|ترامب|טראמפ"),
    ("blinken", "Antony Blinken (Dışişleri)", "ABD", r"blinken|بلينكن|בלינקן"), ("rubio", "Marco Rubio (Dışişleri)", "ABD", r"\brubio|روبيو"),
    ("harris", "Kamala Harris", "ABD", r"kamala|هاريس"), ("witkoff", "Steve Witkoff (özel temsilci)", "ABD", r"witkoff|ويتكوف"),
    ("macron", "Emmanuel Macron", "Avrupa", r"macron|ماكرون|מקרון"), ("scholz", "Olaf Scholz", "Avrupa", r"\bscholz|شولتس"),
    ("merz", "Friedrich Merz", "Avrupa", r"\bmerz\b|ميرتس"), ("meloni", "Giorgia Meloni", "Avrupa", r"meloni|ميلوني"),
    ("sanchez", "Pedro Sánchez", "Avrupa", r"pedro s[áa]nchez|\bs[áa]nchez\b|سانشيز"), ("sunak", "Rishi Sunak", "Avrupa", r"\bsunak|سوناك"),
    ("starmer", "Keir Starmer", "Avrupa", r"starmer|ستارمر"), ("vonderleyen", "Ursula von der Leyen (AB Komisyonu)", "Avrupa", r"von der leyen|فون دير لاين"),
    ("borrell", "Josep Borrell (AB Dış Politika)", "Avrupa", r"borrell|بوريل"), ("kallas", "Kaja Kallas (AB Dış Politika)", "Avrupa", r"\bkallas|كالاس"),
    ("baerbock", "Annalena Baerbock (Dışişleri)", "Avrupa", r"baerbock|بيربوك"), ("lammy", "David Lammy (Dışişleri)", "Avrupa", r"\blammy\b"),
    ("barrot", "Jean-Noël Barrot (Dışişleri)", "Avrupa", r"\bbarrot\b"), ("albares", "José Manuel Albares (Dışişleri)", "Avrupa", r"albares|ألباريس"),
    ("guterres", "António Guterres (BM Genel Sekreteri)", "BM", r"guterres|غوتيريش|غوتيريس|גוטרש"),
    ("albanese", "Francesca Albanese (BM Özel Raportörü)", "BM", r"albanese|ألبانيزي"),
    ("lazzarini", "Philippe Lazzarini (UNRWA)", "BM", r"lazzarini|لازاريني"),
    ("tedros", "Tedros Ghebreyesus (DSÖ)", "BM", r"tedros|تيدروس"), ("fletcher", "Tom Fletcher (OCHA)", "BM", r"tom fletcher|فليتشر"),
    ("griffiths", "Martin Griffiths (OCHA)", "BM", r"martin griffiths|غريفيث"), ("turk", "Volker Türk (BM İnsan Hakları)", "BM", r"volker t[üu]rk|فولكر"),
    ("hamaney", "Ali Hamaney", "İran", r"hamaney|khamenei|jamenei|chamenei|خامنئي|חמינאי"),
    ("reisi", "İbrahim Reisi", "İran", r"ibrahim reisi|ebrahim ra[ií]si|\bra[ií]si\b|إبراهيم رئيسي"),
    ("pezeskiyan", "Mesud Pezeşkiyan", "İran", r"pezeşkiyan|pezeshkian|بزشكيان"),
    ("abdullahiyan", "Hüseyin Emir Abdullahiyan (Dışişleri)", "İran", r"abdullahiyan|abdollahian|عبد اللهيان"),
    ("arakci", "Abbas Arakçi (Dışişleri)", "İran", r"arakçi|araghchi|araqchi|عراقجي"),
    ("sisi", "Abdulfettah es-Sisi (Mısır)", "Arap ülkeleri", r"\bsisi\b|السيسي"),
    ("selman", "Muhammed bin Selman (Suudi Arabistan)", "Arap ülkeleri", r"bin selman|bin salman|\bmbs\b|محمد بن سلمان"),
    ("bin_zayed", "Muhammed bin Zayed (BAE)", "Arap ülkeleri", r"bin zayed|محمد بن زايد"),
    ("temim", "Temim bin Hamed (Katar)", "Arap ülkeleri", r"temim bin|tamim bin|emir tamim|الشيخ تميم|تميم بن حمد"),
    ("abdullah2", "Kral II. Abdullah (Ürdün)", "Arap ülkeleri", r"kral abdullah|king abdullah|roi abdallah|الملك عبدالله|الملك عبد الله"),
    ("abbas", "Mahmud Abbas (Filistin Yönetimi)", "Arap ülkeleri", r"mahmud abbas|mahmoud abbas|abu mazen|ebu mazen|محمود عباس|أبو مازن"),
    ("al_thani", "Muhammed bin Abdurrahman Al Sani (Katar Başbakanı)", "Arap ülkeleri", r"abdurrahman al sani|abdulrahman al thani|bin abdulrahman|محمد بن عبدالرحمن"),
    ("faysal", "Faysal bin Ferhan (Suudi Dışişleri)", "Arap ülkeleri", r"faysal bin ferhan|faisal bin farhan|فيصل بن فرحان"),
    ("safadi", "Eymen Safedi (Ürdün Dışişleri)", "Arap ülkeleri", r"safedi|ayman safadi|\bsafadi|أيمن الصفدي"),
    ("sukri", "Sameh Şukri (Mısır Dışişleri)", "Arap ülkeleri", r"sameh şukri|şukri|shoukry|سامح شكري"),
    ("abdulati", "Bedr Abdulati (Mısır Dışişleri)", "Arap ülkeleri", r"abdulati|abdelatty|abdel aty|عبد العاطي"),
    ("aboul_gheit", "Ahmed Ebul Gayt (Arap Birliği)", "Arap ülkeleri", r"ebul gayt|aboul gheit|أبو الغيط"),
    ("enver", "Enver İbrahim (Malezya)", "Asya ve diğer", r"enver ibrahim|anwar ibrahim|أنور إبراهيم"),
    ("prabowo", "Prabowo Subianto (Endonezya)", "Asya ve diğer", r"prabowo"),
    ("jokowi", "Joko Widodo (Endonezya)", "Asya ve diğer", r"jokowi|joko widodo"),
    ("serif", "Şahbaz Şerif (Pakistan)", "Asya ve diğer", r"şahbaz şerif|shehbaz sharif|shahbaz sharif|شهباز شريف"),
    ("ramaphosa", "Cyril Ramaphosa (Güney Afrika)", "Asya ve diğer", r"ramaphosa|رامافوزا"),
    ("lula", "Lula da Silva (Brezilya)", "Asya ve diğer", r"\blula\b"),
    ("petro", "Gustavo Petro (Kolombiya)", "Asya ve diğer", r"gustavo petro|\bpetro\b"),
    ("modi", "Narendra Modi (Hindistan)", "Asya ve diğer", r"\bmodi\b"),
    ("xi", "Şi Cinping (Çin)", "Çin", r"şi cinping|xi jinping|\bxi\b|شي جين بينغ"),
    ("wang_yi", "Vang Yi (Çin Dışişleri)", "Çin", r"wang yi|vang yi|وانغ يي"),
    ("cin_sozcu", "Çin Dışişleri sözcüleri", "Çin", r"mao ning|wang wenbin|lin jian|guo jiakun|ماو نينغ"),
    ("putin", "Vladimir Putin (Rusya)", "Rusya", r"\bputin|بوتين|פוטין"), ("lavrov", "Sergey Lavrov (Dışişleri)", "Rusya", r"lavrov|لافروف"),
    ("zaharova", "Mariya Zaharova (Dışişleri sözcüsü)", "Rusya", r"zaharova|zakharova|زاخاروفا"),
    ("nebenzya", "Vasiliy Nebenzya (Rusya BM)", "Rusya", r"nebenz|نيبينزيا"),
    ("netanyahu", "Binyamin Netanyahu", "İsrail", r"netanyahu|nétanyahou|netanjahu|نتنياهو|נתניהו"),
    ("gallant", "Yoav Gallant", "İsrail", r"gallant|غالانت|גלנט"),
    ("katz", "İsrail Katz", "İsrail", r"israel katz|israil katz|bakan katz|minister katz|katz says|katz:|يسرائيل كاتس|كاتس"),
    ("ben_gvir", "Itamar Ben-Gvir", "İsrail", r"ben[- ]gvir|بن غفير|בן גביר"), ("smotrich", "Bezalel Smotrich", "İsrail", r"smotrich|سموتريتش|סמוטריץ"),
]
LIDER_GRUP = ["Türkiye", "ABD", "Avrupa", "Arap ülkeleri", "İran", "Asya ve diğer", "Çin", "Rusya", "BM", "İsrail"]
# Liderin başlıkta birlikte geçtiği kelimeler. "Suçlama kime": İsrail mi, Netanyahu (hükümet) mi, Siyonizm mi
LIDER_KELIME = [
    ("soykirim", "soykırım", r"soykırım|genocid|génocid|völkermord|genozid|إبادة|רצח עם"),
    ("netanyahu", "Netanyahu", r"netanyahu|nétanyahou|netanjahu|نتنياهو|נתניהו"),
    ("israil", "İsrail", r"israil|israel|israël|إسرائيل|اسرائيل|الاحتلال|ישראל"),
    ("siyonist", "Siyonist", r"siyon|zionis|sionis|الصهيون|ציונ"),
    ("hamas", "Hamas", r"hamas|حماس|חמאס"),
    ("ateskes", "ateşkes", r"ateşkes|ceasefire|cease-fire|truce|cessez-le-feu|alto el fuego|tregua|cessate il fuoco|waffenruhe|waffenstillstand|وقف إطلاق النار|هدنة|הפסקת אש"),
    ("katliam", "katliam", r"katliam|massacr|masacre|massaker|strage|مجزرة|טבח"),
    ("gazze", "Gazze", r"\bgazze|\bgaza|غزة|עזה"),
]

# Kimin ölümü haber oldu: İsrailli rehinelerin adları (Filistinli isimler kullanıcının onayıyla sonra eklenecek).
# (anahtar, görünen ad, kalıp) — sadeleştirilmiş (küçük harf, işaretsiz) başlıkta aranır
REHINELER = [
    ("bibas", "Bibas ailesi (Shiri, Ariel, Kfir, Yarden)", r"bibas|بيباس|ביבס"),
    ("kfir", "Kfir Bibas", r"\bkfir\b|كفير"),
    ("argamani", "Noa Argamani", r"argamani|أرغاماني|ارغماني"),
    ("goldberg_polin", "Hersh Goldberg-Polin", r"goldberg[- ]?polin|غولدبرغ|جولدبرج"),
    ("edan_alexander", "Edan Alexander", r"edan alexander|idan alexander|عيدان ألكسندر|عيدان الكسندر"),
    ("sharabi", "Eli Sharabi", r"sharabi|شرعبي"),
    ("shem_tov", "Omer Shem Tov", r"shem[- ]tov"),
    ("gonen", "Romi Gonen", r"romi gonen"),
    ("damari", "Emily Damari", r"damari"),
    ("steinbrecher", "Doron Steinbrecher", r"steinbrecher"),
    ("berger", "Agam Berger", r"agam berger"),
    ("albag", "Liri Albag", r"albag"),
    ("naama_levy", "Naama Levy", r"na'?ama levy"),
    ("daniela_gilboa", "Daniela Gilboa", r"daniela gilboa"),
    ("ariev", "Karina Ariev", r"ariev"),
    ("yehud", "Arbel Yehud", r"arbel yehou?d"),
    ("gadi_moses", "Gadi Moses", r"gadi mo[sz]es"),
    ("siegel", "Keith Siegel", r"keith siegel"),
    ("kalderon", "Ofer Kalderon", r"kalderon|ofer calderon"),
    ("dekel_chen", "Sagui Dekel-Chen", r"dekel[- ]chen"),
    ("horn", "Iair ve Eitan Horn", r"(?:iair|yair|eitan) horn"),
    ("troufanov", "Alexander Troufanov", r"tr[ou]fanov"),
    ("shoham", "Tal Shoham", r"tal shoham"),
    ("wenkert", "Omer Wenkert", r"wenkert"),
    ("mengistu", "Avera Mengistu", r"mengistu"),
    ("evyatar", "Evyatar David", r"evyatar"),
    ("braslavski", "Rom Braslavski", r"braslavsk"),
    ("zangauker", "Matan Zangauker", r"zangauker|zengauker"),
    ("ohel", "Alon Ohel", r"alon ohel"),
    ("miran", "Omri Miran", r"omri miran"),
    ("gvili", "Ran Gvili", r"gvili"),
    ("schem", "Mia Schem", r"mia schem"),
    ("meir_jan", "Almog Meir Jan", r"almog meir"),
    ("kozlov", "Andrey Kozlov", r"andre[yi] kozlov"),
    ("ziv", "Shlomi Ziv", r"shlomi ziv"),
    ("har_marman", "Louis Har ve Fernando Marman", r"louis har\b|marman"),
    ("megidish", "Ori Megidish", r"megidish"),
    ("gat", "Carmel Gat", r"carmel gat"),
    ("yerushalmi", "Eden Yerushalmi", r"yerushalmi"),
    ("angrest", "Matan Angrest", r"angrest"),
    ("kupershtein", "Bar Kupershtein", r"kupershtein"),
    ("kalfon", "Segev Kalfon", r"kalfon"),
    ("gilboa_dalal", "Guy Gilboa-Dalal", r"gilboa[- ]dalal"),
    ("berman", "Gali ve Ziv Berman", r"(?:gali|ziv) berman"),
    ("cunio", "Ariel ve David Cunio", r"cunio"),
]
