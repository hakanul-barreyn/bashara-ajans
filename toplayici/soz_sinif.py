"""Konuşma cümlelerinin sınıflanması: kınama, çağrı, eylem/taahhüt (Türkçe, kural tabanlı; açık ve denetlenebilir).

Bir cümle birden çok sınıfa uyabilir; tek sınıf verilir, öncelik eylem > çağrı > kınama > diğer.
  eylem   : konuşanın (biz / Türkiye) yaptığı, yapmakta olduğu ya da yapacağını söylediği bir iş: birinci çoğul
            kişi fiili ile bir iş adı birlikte. "Somut" alt etiketi: ölçülebilir bir adım (yardım sevkiyatı, ticaretin
            kesilmesi, dava, tedavi, hava sahası / liman kapatma, tanıma). Söyleme fiilleri ("ifade ettik",
            "dile getirdik") tek başına eylem sayılmaz.
  çağrı   : başkalarından bir şey isteme ("-malı / -meli", "gerekir", "çağırıyoruz", "bekliyoruz").
  kınama  : suçlama, adlandırma ("soykırım", "katliam", "barbarlık", "lanetliyoruz").
  diğer   : betimleme, sayı, anma.
"""
import re


def kucult(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


# birinci çoğul kişi fiil sonları (geçmiş, şimdiki, gelecek, geniş, -mekteyiz)
BIZ = re.compile(r"[pçtkfhsş](?:tık|tik|tuk|tük|tığımız|tiğimiz|tuğumuz|tüğümüz)\b|\w(?:dık|dik|duk|dük|ıyoruz|iyoruz|uyoruz|üyoruz|acağız|eceğiz|acağımız|eceğimiz"
                 r"|maktayız|mekteyiz|arız|eriz|ırız|iriz|uruz|ürüz|dığımız|diğimiz|duğumuz|düğümüz)\b"
                 r"|\b(?:türkiye olarak|biz(?:ler)? de\b|ülkemiz\b|hükümetimiz|devletimiz|milletimiz)")
# geçmiş ya da şimdiki zamanda yapılmış iş (çağrı işaretine üstün gelir: "durdurulması için ticareti kestik")
YAPTIK = re.compile(r"[pçtkfhsş](?:tık|tik|tuk|tük)\b|\w(?:dık|dik|duk|dük|ıyoruz|iyoruz|uyoruz|üyoruz|maktayız|mekteyiz)\b")
SOMUT = re.compile(
    r"yardım (?:malzeme|gemi|uça|tır|kamyon|kolisi)|ton(?:luk)? (?:insani )?yardım|insani yardım\w* (?:ulaştır|gönder|sevk)"
    r"|yardım\w* (?:ulaştır|gönder|sevk)|\bgemi(?:si|leri|mizi)?\b.*(?:gönder|yola|ulaştır)|\btır\b|kızılay"
    r"|ticaret\w* (?:durdur|kes|sonlandır|askıya|yasak)|ihracat\w* (?:durdur|kes|yasak|kısıtla)|ticari ilişki\w* kes"
    r"|(?:hava sahası|hava sahamızı|limanlar\w*) (?:kapat|kullandırma)|adalet divanı|soykırım davası|davaya (?:müdahil|katıl|taraf)"
    r"|müdahil ol|tedavi|tahliye|yaralı\w* (?:getir|ülkemize)|hastane\w* (?:kur|inşa|aç)|sahra hastane|çadır kent"
    r"|filistin devleti\w*.{0,30}tanı|büyükelçi\w*.{0,30}(?:geri çağır|çağırdık)|ilişki\w*.{0,20}(?:kestik|dondur|askıya)"
    r"|yaptırım|ambargo|tedbir\w* (?:al|uygula)|garantör|arabulucu|insani koridor|ateşkes\w* (?:müzakere|anlaşma\w* (?:imzala|sağla))")
GENEL = re.compile(
    r"\bçaba|gayret|mücadele|girişim|temas|görüşme|müzakere|diplomasi|seferber|harekete geç|adım at|elimizden gelen"
    r"|yanında ol|yanında dur|desteğ\w*|destek ver|destekle|savun|sahip çık|takipçisi|peşini bırak|hesap sor|yalnız bırakma"
    r"|devam ed|sürdür|kararlıyız|kararlılıkla|taahhüt|üstlen|katkı")
SOYLE = re.compile(r"(?:ifade|beyan|vurgu|dile getir|gündeme getir|gündeminde tut|altını çiz|konuştuk|ele al|söyle|anlat|hatırlat|ilan|haykır|dillendir|izah)\w*\s*(?:et|ed|yap|dı|di|tık|tik)?\w*\b")
CAGRI = re.compile(
    r"\b(?!(?:te|ru|e|a|ke|ha|şe)meli|(?:ha|ka|sa)malı)\w{2,}(?:malı|meli)(?:dır|dir|dırlar|dirler|yız|yiz)?\b|gerek(?:ir|iyor|mektedir|li)\b|gerekmez|lazım\b|şart(?:tır)?\b"
    r"|çağır|çağrı|davet ed|bekliyoruz|beklentimiz|talep ed|istiyoruz|derhal|acilen|bir an önce|zorundayız|zorundadır|sorumluluğu"
    r"|harekete geçmeli|harekete geçmesi")
KINAMA = re.compile(
    r"kına|lanetl|soykırım|katliam|barbar|vahşet|zulm|zulüm|zalim|terör devlet|\bkatil|cani|caniyane|insanlık suçu|savaş suçu"
    r"|insanlığa karşı|kan dök|kan döken|alçak|hayasız|pervasız|haydut|gözü dönmüş|şımarık|nazi|hitler|faşist|siyonis"
    r"|asla kabul|kabul edilemez|affedilmez|utanç|ikiyüzlü|çifte standart|suç ortağı|suç ortaklığı|sessiz kal|sessizliğ|seyirci kal")


def sinif(c):
    """'eylem' / 'cagri' / 'kinama' / 'diger' ve eylem için somut mu (bool)"""
    m = kucult(c)
    biz = BIZ.search(m)
    somut = bool(SOMUT.search(m))
    yaptik = YAPTIK.search(m)
    if CAGRI.search(m) and not yaptik:
        return "cagri", False
    if biz and (somut or GENEL.search(m)):
        # yalnızca bir şey söylediğimizi anlatan cümle ("…gerektiğini ifade ettik") eylem değildir
        soyleme = SOYLE.search(m) and not somut
        if not soyleme:
            return "eylem", somut
    if CAGRI.search(m):
        return "cagri", False
    if KINAMA.search(m):
        return "kinama", False
    return "diger", False


KONU = re.compile(r"gazze|filistin|israil|netanyahu|siyonis|kudüs|\\baksa\\b|mescid-i aksa|refah|batı şeria|ref\\b")


def konulu(c):
    """Cümle gerçekten Filistin / İsrail / Gazze üzerine mi? ("aksaklık" gibi yanlış eşleşmeleri ayıklar)"""
    return bool(KONU.search(kucult(c)))


SIRA = {"eylem": 0, "cagri": 1, "kinama": 2, "diger": 3}
