"""Doğal Türkçe: turkish-anti-ai-skill (Yüce Zerey, MIT) kurallarının haber diline uyarlanmış özü.

USLUP, Gemini'ye giden Türkçe yazım talimatlarına eklenir. olc() bir metni tr_dedektor.py ile tarar (kurumsal register:
haber diline en yakın ayar) ve kısa bir özet döndürür. Dedektör metnin yazarını tespit etmez; yalnızca düzeltilebilir
kalıpları (klişe, -mAktAdIr yoğunluğu, uzun çizgi, tekdüze cümle uzunluğu) sayar.
"""
import tr_dedektor

USLUP = """
Türkçe yazım (doğal haber dili; çeviri kokusu olmasın):
- Kelimeleri değil cümle iskeletini Türkçe kur: niteleyiciyi ismin önüne al ("Han Yunus'taki çadırları vuran saldırı"), yan cümleyi "ki" ile sona takma. Bir adın önüne ikiden fazla yan cümle yığma, gerekirse cümleyi böl.
- Sıralı eylemleri "ve" ile değil ulaçla bağla ("çadırları basıp yaktı", "açıklayarak", "dönünce"). Özneler farklıysa ulaç kullanma.
- "-mAktAdIr" kullanma: "artmaktadır" değil "artıyor" ya da "arttı"; "belirtmektedir" değil "belirtti". Sıralı yüklemlerde eki yalnızca sonuncuya getir.
- Kof fiil zinciri kurma: "gerçekleştirildi, sağlandı, söz konusu oldu, katkı sağladı" yerine fiilin kendisini yaz ("saldırı düzenlendi" değil "saldırdı", eyleyen biliniyorsa).
- Şu kalıpları hiç kullanma: âdeta, yadsınamaz, kritik bir rol oynamak, geniş bir yelpaze, dönüm noktası, çığır açan, derinlemesine, bununla birlikte, öte yandan, söz konusu, bu bağlamda, bu doğrultuda, belirtmek gerekir ki, sonuç olarak, "sadece X değil aynı zamanda Y", "bu bir A değil B'dir".
- Sahneleme girişi ve ders veren kapanış yazma: doğrudan olayla başla, son cümle bilgi versin, yorum ya da özet kuyruğu olmasın.
- Cümle uzunluklarını çeşitlendir: kısa ve uzun cümleler karışsın; her cümle aynı ekle bitmesin.
- Uzun çizgi (—) kullanma; ara söz için virgül kullan ya da cümleyi böl. "ve", "veya" bağlacından önce virgül koyma. Sayı aralığında kısa çizgi (2024-2026), saatte nokta (14.30), ondalıkta virgül (%12,5).
- Kaynakta olmayan hiçbir sayı, ad, tarih, sıfat ya da neden-sonuç bağı ekleme; kesinlik derecesini değiştirme ("iddia etti" ile "açıkladı" aynı değildir).
"""


def olc(metin):
    """Metni tarar: {"bayrak": sinyal sayısı, "mektedir": 100 kelimede, "cov": cümle uzunluğu değişkenliği, "bulgular": [...]}"""
    if not metin or len(metin.split()) < 8:
        return None
    try:
        r = tr_dedektor.analyze_text(metin, register="kurumsal", markdown=False)
    except Exception:   # noqa: BLE001
        return None
    return {"bayrak": r["total_flags"], "mektedir": r["mektedir_per_100_words"], "cov": r["sentence_length_cov"],
            "bulgular": [f.get("rule", "") for f in r["findings"] if f.get("severity") != "bilgi"][:6]}
