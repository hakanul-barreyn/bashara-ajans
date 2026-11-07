"""Konu filtresi: yalnızca bu kelimelerden birini içeren haberler Türkçe özetlenir.
Diğer haberler sitede orijinal başlıklarıyla listelenir. Kelime eklemek için ilgili dile yazman yeterli.
Hepsi küçük harfle yazılır; eşleşme başlık ve giriş metninde aranır."""

KELIMELER = {
    "tr": ["filistin", "gazze", "batı şeria", "kudüs", "israil", "hamas", "hizbullah", "lübnan", "suriye", "yemen",
           "husi", "ensarullah", "işgal", "soykırım", "ateşkes", "mülteci", "göç", "cenin", "nablus",
           "el-aksa", "mescid-i aksa", "netanyahu", "siyonist", "direniş", "iran", "irak", "ürdün", "mısırlı", "kahire", "sina yarımadası",
           "cezayir", "fas", "tunus", "libya", "ceuta", "melilla", "batı sahra", "kızıldeniz", "golan"],
    "en": ["palestin", "gaza", "west bank", "jerusalem", "israel", "hamas", "hezbollah", "lebanon", "syria", "yemen",
           "houthi", "ansarallah", "occupation", "genocide", "ceasefire", "refugee", "migrant", "rafah", "jenin",
           "nablus", "al-aqsa", "netanyahu", "zionis", "resistance", "iran", "iraq", "jordan", "egypt", "sinai",
           "algeria", "morocco", "tunisia", "libya", "ceuta", "melilla", "western sahara", "red sea", "golan",
           "unrwa", "idf", "settler"],
    "fr": ["palestin", "gaza", "cisjordanie", "jérusalem", "israël", "israel", "hamas", "hezbollah", "liban", "syrie",
           "yémen", "houthi", "occupation", "génocide", "cessez-le-feu", "réfugié", "migrant", "al-aqsa", "netanyahou",
           "sioniste", "résistance", "iran", "irak", "jordanie", "égypte", "algérie", "maroc", "tunisie", "libye",
           "ceuta", "melilla", "sahara occidental", "mer rouge", "colon"],
    "es": ["palestin", "gaza", "cisjordania", "jerusalén", "israel", "hamás", "hamas", "hezbolá", "líbano", "siria",
           "yemen", "hutí", "ocupación", "genocidio", "alto el fuego", "refugiado", "migrante", "netanyahu",
           "sionista", "irán", "irak", "jordania", "egipto", "argelia", "marruecos", "túnez", "libia", "ceuta",
           "melilla", "sáhara", "colono", "flotilla"],
    "ca": ["palestin", "gaza", "cisjordània", "jerusalem", "israel", "hamas", "líban", "síria", "ocupació",
           "genocidi", "alto el foc", "refugiat", "migrant", "marroc", "algèria", "ceuta", "melilla", "colon"],
    "it": ["palestin", "gaza", "cisgiordania", "gerusalemme", "israele", "hamas", "hezbollah", "libano", "siria",
           "yemen", "houthi", "occupazione", "genocidio", "cessate il fuoco", "rifugiat", "migranti", "netanyahu",
           "sionist", "iran", "iraq", "giordania", "egitto", "algeria", "marocco", "tunisia", "libia", "flotilla",
           "coloni"],
    "de": ["palästin", "gaza", "westjordanland", "jerusalem", "israel", "hamas", "hisbollah", "libanon", "syrien",
           "jemen", "huthi", "besatzung", "völkermord", "genozid", "waffenruhe", "flüchtling", "migrant", "netanjahu",
           "zionis", "iran", "irak", "jordanien", "ägypten", "algerien", "marokko", "tunesien", "libyen", "siedler"],
    "ar": ["فلسطين", "غزة", "الضفة", "القدس", "إسرائيل", "الاحتلال", "حماس", "حزب الله", "لبنان", "سوريا", "سورية",
           "اليمن", "الحوثي", "أنصار الله", "إبادة", "وقف إطلاق النار", "لاجئ", "مهاجر", "رفح", "جنين", "نابلس",
           "الأقصى", "نتنياهو", "صهيون", "المقاومة", "إيران", "العراق", "الأردن", "مصر", "سيناء", "الجزائر",
           "المغرب", "تونس", "ليبيا", "سبتة", "مليلية", "الصحراء الغربية", "البحر الأحمر", "الجولان", "مستوطن"],
    "he": ["עזה", "פלסטינ", "חמאס", "חיזבאללה", "לבנון", "סוריה", "תימן", "יהודה ושומרון", "ירושלים", "הפסקת אש",
           "איראן", "מתנחל"],
}

# Bu bölgelerdeki kaynakların bütün haberleri ilgili sayılır.
HER_ZAMAN_ILGILI_BOLGELER = {"Filistin"}


def ilgili_mi(metin: str, dil: str, bolge: str) -> bool:
    if bolge in HER_ZAMAN_ILGILI_BOLGELER:
        return True
    m = (metin or "").lower()
    if not m:
        return False
    kelimeler = set(KELIMELER.get(dil, [])) | set(KELIMELER["en"])
    return any(k in m for k in kelimeler)
