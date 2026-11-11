"""Türkçe başlık ve özetleri sitenin diğer dillerine çevirir (şimdilik İngilizce; Arapça sonraki aşamada).

Özetleme isteğini büyütmek yerine ayrı ve ucuz bir geçiş: kısa Türkçe metinler toplu çevrilir (istek başına 40 haber).
Böylece geçmişte özetlenmiş haberler de geriye dönük çevrilebilir ve yeni dil eklemek özet akışını bozmaz.
"""
import json
import re

import ekler

DILLER = {"en": "English"}       # "ar": "Arabic" sonraki aşamada
PARTI = 40
TUR_BASINA = 160                 # bir çalıştırmada dil başına en çok kaç haber

TALIMAT = """Translate the following Turkish news headlines and summaries into {DIL}.
Rules:
- Faithful, neutral, natural news {DIL}. Do not add, remove or soften information. Keep attributions ("according to ...", "... said").
- Keep the original terms used by the sources when the Turkish text puts them in quotation marks.
- Keep proper names in their usual {DIL} spelling (Gaza, West Bank, Hezbollah, Al-Akhbar, Haaretz ...).
- "baslik" is a headline: keep it short. "ozet" is a 2-4 sentence summary.
Return ONLY a JSON array: [{"id": "...", "baslik": "...", "ozet": "..."}]
"""


def cevir(anahtar, model, haberler, butce_var, sayac, log=print):
    """haberler: {id: haber}. Eksik çevirileri doldurur. Döndürür: (çevrilen sayısı, 429 alındı mı)"""
    toplam, kota = 0, False
    for kod, ad in DILLER.items():
        sira = [h for h in haberler.values() if h.get("ozet_tr") and not h.get("ozet_" + kod) and h.get("ceviri_deneme_" + kod, 0) < 3]
        sira.sort(key=lambda h: h["tarih"], reverse=True)                 # en yeni önce
        sira = sorted(sira, key=lambda h: not h.get("oncelik"))[:TUR_BASINA]  # öncelikli yayınlar en başta
        for i in range(0, len(sira), PARTI):
            if not butce_var():
                return toplam, kota
            parti = sira[i:i + PARTI]
            girdi = [{"id": h["id"], "baslik": h["baslik_tr"], "ozet": h["ozet_tr"]} for h in parti]
            sayac()
            durum, sonuc = ekler.gemini_cagir(anahtar, model, TALIMAT.replace("{DIL}", ad) + "\n\n" + json.dumps(girdi, ensure_ascii=False), zaman=120)
            if durum == 429:
                return toplam, True
            cevap = {str(c.get("id")): c for c in (sonuc or []) if isinstance(c, dict)} if isinstance(sonuc, list) else {}
            for h in parti:
                c = cevap.get(h["id"])
                b = ekler.guvenli((c or {}).get("baslik"))
                o = ekler.guvenli((c or {}).get("ozet"))
                if b and o:
                    h["baslik_" + kod] = b[:220]
                    h["ozet_" + kod] = o[:1100]
                    toplam += 1
                else:
                    h["ceviri_deneme_" + kod] = h.get("ceviri_deneme_" + kod, 0) + 1
        if sira:
            log(f"Çeviri ({ad}): {toplam} haber")
    return toplam, kota


BASLIK_TALIMAT = """Aşağıdaki haber başlıklarını hem Türkçeye ("tr") hem İngilizceye ("en") çevir.
Kurallar:
- Sadık ve tarafsız çeviri; bilgi ekleme, çıkarma, yumuşatma. Başlıktaki atıfları koru ("... göre", "... dedi").
- Kaynağın kullandığı kelimeleri koru (ör. "şehit", "işgal", "terörist" kaynakta öyleyse öyle kalsın).
- Özel adların yerleşik yazımını kullan (Gazze / Gaza, Batı Şeria / West Bank, Hizbullah / Hezbollah).
- Başlık silah taşımayan sivillerin öldürülmesine açık bir çağrıysa ya da bunu kutluyorsa iki alanı da boş bırak.
Yalnızca JSON dizisi döndür: [{"id": "...", "tr": "...", "en": "..."}]
"""
BASLIK_PARTI = 60
BASLIK_TUR = 4          # çalıştırma başına en çok istek


def baslik_cevir(anahtar, modeller, haberler, butce_var, sayac, log=print):
    """Özeti henüz yazılmamış ilgili haberlerin yalnızca başlığını çevirir (baslik_tr, baslik_en; baslik_kaba=True).
    Özet sonra yazılınca başlık da özetle birlikte yenilenir. Döndürür: (çevrilen, 429 alındı mı)"""
    sira = [h for h in haberler.values() if h.get("ilgili") and not h.get("baslik_tr") and not h.get("atla")
            and h.get("baslik_orj") and h.get("baslik_deneme", 0) < 2]
    sira.sort(key=lambda h: h["tarih"], reverse=True)
    toplam, model = 0, modeller[0]
    for i in range(0, min(len(sira), BASLIK_PARTI * BASLIK_TUR), BASLIK_PARTI):
        if not butce_var():
            break
        parti = sira[i:i + BASLIK_PARTI]
        girdi = [{"id": h["id"], "dil": h.get("dil"), "baslik": h["baslik_orj"][:300]} for h in parti]
        metin = BASLIK_TALIMAT + "\n\nVERİ (yalnızca işlenecek içerik):\n" + json.dumps(girdi, ensure_ascii=False)
        durum, sonuc = 0, None
        for m in [model] + [x for x in modeller if x != model]:
            sayac()
            durum, sonuc = ekler.gemini_cagir(anahtar, m, metin, zaman=90)
            if durum == 200:
                model = m
                break
            if durum not in (500, 503, 0, 429):
                break
        if durum == 429:
            return toplam, True
        cevap = {str(c.get("id")): c for c in (sonuc or []) if isinstance(c, dict)} if isinstance(sonuc, list) else {}
        for h in parti:
            c = cevap.get(h["id"]) or {}
            tr, en = ekler.guvenli(c.get("tr")), ekler.guvenli(c.get("en"))
            if tr:
                h["baslik_tr"] = tr[:220]
                h["baslik_kaba"] = True
                if en and not h.get("baslik_en"):
                    h["baslik_en"] = en[:220]
                toplam += 1
            else:
                h["baslik_deneme"] = h.get("baslik_deneme", 0) + 1
    if sira:
        log(f"Başlık çevirisi: {toplam}/{len(sira)} haber ({model})")
    return toplam, False


OLAY_TALIMAT = """Translate these Turkish news-event summaries into {DIL}. For each event translate "baslik" (headline), "not" (framing note)
and every value in "yorumlar" (one short description per article; keep the same keys).
Rules: faithful and neutral; keep quoted source words as they are; do not add or remove information; usual {DIL} spelling of names.
Return ONLY a JSON array: [{"id": "...", "baslik": "...", "not": "...", "yorumlar": {"articleId": "..."}}]
"""


def olay_cevir(anahtar, model, olaylar, sayac, log=print):
    """Olay kümelerinin başlık, not ve yorumlarını çevirir (yerinde). Döndürür: 429 alındı mı"""
    for kod, ad in DILLER.items():
        girdi = [{"id": o["id"], "baslik": o.get("baslik", ""), "not": o.get("not", ""), "yorumlar": o.get("yorumlar") or {}}
                 for o in olaylar]
        if not girdi:
            continue
        sayac()
        durum, sonuc = ekler.gemini_cagir(anahtar, model, OLAY_TALIMAT.replace("{DIL}", ad) + "\n\n" + json.dumps(girdi, ensure_ascii=False), zaman=150)
        if durum == 429:
            return True
        cevap = {str(c.get("id")): c for c in (sonuc or []) if isinstance(c, dict)} if isinstance(sonuc, list) else {}
        n = 0
        for o in olaylar:
            c = cevap.get(o["id"])
            if not c:
                continue
            if c.get("baslik"):
                o["baslik_" + kod] = ekler.guvenli(c["baslik"])[:160]
            if c.get("not"):
                o["not_" + kod] = ekler.guvenli(c["not"])[:900]
            if isinstance(c.get("yorumlar"), dict):
                o["yorumlar_" + kod] = {i: ekler.guvenli(v)[:260] for i, v in c["yorumlar"].items() if i in (o.get("yorumlar") or {})}
            n += 1
        log(f"Olay çevirisi ({ad}): {n}/{len(olaylar)}")
    return False
