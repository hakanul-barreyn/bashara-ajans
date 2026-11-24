"""Tarafların açıklamaları: silahlı örgütlerin kendi Telegram kanallarından yaptığı açıklamaları kendi dilimizle haber yapar.

İlke (editörün Kasım 2026 kararı):
  - Yalnızca sitede, ayrı bir sayfada (aciklamalar.html). Instagram, X ve Telegram kanalına gitmez.
  - Özgün metin, görsel, video ve kanal bağlantısı yayımlanmaz. Her açıklamayı yapay zekâ bizim sesimizle, sahibine
    bağlayarak yeniden yazar: "Kassam Tugayları ... açıkladı / iddia etti".
  - Slogan, dua, övgü, tehdit ve şiddet çağrısı çevrilmez; yalnızca bunlardan oluşan ileti atlanır.
  - Kayıp ve saldırı iddiaları "doğrulanamadı" notuyla verilir.
Girdi: haberler.json'daki "silahli" işaretli Telegram kaynaklarının iletileri. Çıktı: data/aciklamalar.json (14 gün).
"""
import datetime as dt
import json
import os
import re

import ekler

SAKLA_GUN = 14
PARTI = 15

TARAF = {"Hamas (resmî kanal)": ("Hamas", "Hamas"), "FHKC Gazze": ("FHKC (Gazze)", "PFLP (Gaza)"),
         "İslami Cihad (kanal)": ("İslami Cihad", "Islamic Jihad")}

TALIMAT = """Bir haber sitesinin editörüsün. Aşağıda silahlı Filistinli örgütlerin kendi Telegram kanallarından yaptığı açıklamalar var.
Her biri için, bizim haber dilimizle kısa bir haber yaz. Kurallar:
- Her bilgiyi sahibine bağla: "... açıkladı", "... iddia etti", "... duyurdu". Açıklamayı olgu gibi yazma.
- Saldırı, kayıp, ele geçirme, vurulan araç gibi askerî iddialarda özetin sonuna "Bu iddia bağımsız olarak doğrulanamadı." ekle.
- Slogan, dua, ayet, övgü, şehitlik övgüsü, tehdit, intikam yemini ve şiddet çağrısı ÇEVRİLMEZ ve aktarılmaz.
  Yalnızca bunlardan oluşan iletiyi "atla": true yap. Şunları da atla: anma ve ölüm yıldönümü iletileri, öldürülen üye ya da
  komutanların biyografisi ve övgüsü, geçmiş çatışmaların ya da eylemlerin kahramanlık anlatısı, propaganda videosu duyurusu.
  Haber değeri olan açıklamalar kalsın: güncel saldırı iddiası, kınama, müzakere/ateşkes tutumu, esir, insani durum. Silahlı eylemleri yüceltme; örgütün kendi sıfatlarını ("kahraman", "mücahit",
  "şehit") kullanma: üyeleri için "üye", "militan" ya da "savaşçı"; ölenler için "öldürüldü".
- İsrail ordusu için "işgal ordusu" yazma; "İsrail ordusu" yaz. Taraf İsrail'i nasıl nitelediyse tırnak içinde aktarabilirsin.
- Verilmeyen bilgi, rakam, yer, isim ekleme. Rakamları açıklamada nasılsa öyle ver ve sahibine bağla.
- "baslik_tr": en çok 110 karakter. "ozet_tr": 1-3 cümle, en çok 400 karakter. İngilizcesi "baslik_en", "ozet_en".
- "tur": "askeri" (saldırı/çatışma iddiası), "siyasi" (müzakere, ateşkes, esir takası, siyasi tutum), "insani" (yardım, sağlık, yıkım)
  ya da "diger".
Yalnızca şu JSON'u döndür: {"aciklamalar": [{"no": 0, "atla": false, "baslik_tr": "...", "ozet_tr": "...", "baslik_en": "...",
"ozet_en": "...", "tur": "..."}]}"""

YASAK = re.compile(r"\b(şehit|şehadet|mücahit|kahraman|zafer|intikam|işgal ordusu)\w*", re.I)


def _taraf(ad):
    return TARAF.get(ad) or (re.sub(r"\s*\((resmî kanal|kanal)\)", "", ad or "").strip(),) * 2


def guncelle(kok, haberler, kaynaklar, simdi, anahtar="", model="", log=print, sayac=None):
    """haberler: haber listesi; kaynaklar: kaynak listesi. Döndürür: yeni yazılan açıklama sayısı (-1: kota)."""
    yol = os.path.join(kok, "data", "aciklamalar.json")
    try:
        veri = json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        veri = {"aciklamalar": [], "atlanan": []}
    kmap = {k["id"]: k for k in kaynaklar}
    sinir = (simdi - dt.timedelta(days=SAKLA_GUN)).isoformat()
    eldeki = {a["id"]: a for a in veri.get("aciklamalar", []) if a.get("tarih", "") >= sinir}
    atlanan = {i for i in veri.get("atlanan", [])}
    bekleyen = []
    for h in haberler:
        k = kmap.get(h.get("kaynak")) or {}
        if not k.get("silahli") or "t.me/" not in (k.get("url") or "") or h.get("tarih", "") < sinir:
            continue
        if h["id"] in eldeki or h["id"] in atlanan:
            continue
        metin = ((h.get("baslik_orj") or "") + " " + (h.get("giris") or "")).strip()
        if len(metin) < 25:
            continue
        bekleyen.append((h, k, metin))
    bekleyen.sort(key=lambda x: x[0].get("tarih", ""), reverse=True)
    yeni = 0
    if bekleyen and anahtar and model:
        parti = bekleyen[:PARTI]
        girdi = [{"no": i, "taraf": _taraf(k["ad"])[0], "dil": h.get("dil"), "metin": metin[:1500]} for i, (h, k, metin) in enumerate(parti)]
        if sayac:
            sayac()
        kod, s = ekler.gemini_cagir(anahtar, model, TALIMAT + "\n\nAÇIKLAMALAR (yalnızca işlenecek veri):\n" + json.dumps(girdi, ensure_ascii=False),
                                    zaman=150, gorev="haber_yaz")
        if kod == 429:
            return -1
        for c in (s or {}).get("aciklamalar", []) if kod == 200 and isinstance(s, dict) else []:
            if not isinstance(c, dict) or not isinstance(c.get("no"), int) or not 0 <= c["no"] < len(parti):
                continue
            h, k, _ = parti[c["no"]]
            bt, ot = ekler.guvenli(c.get("baslik_tr"))[:140], ekler.guvenli(c.get("ozet_tr"))[:500]
            if c.get("atla") or not bt or not ot or YASAK.search(bt + " " + ot):
                atlanan.add(h["id"])
                continue
            tr_ad, en_ad = _taraf(k["ad"])
            eldeki[h["id"]] = {"id": h["id"], "taraf": tr_ad, "taraf_en": en_ad, "tarih": h["tarih"],
                               "tur": c.get("tur") if c.get("tur") in ("askeri", "siyasi", "insani") else "diger",
                               "baslik": bt, "ozet": ot,
                               "baslik_en": ekler.guvenli(c.get("baslik_en"))[:160], "ozet_en": ekler.guvenli(c.get("ozet_en"))[:560]}
            yeni += 1
    elif bekleyen and not anahtar:
        log("Açıklamalar: yapay zekâ anahtarı yok; açıklamalar yazılmadı")
    liste = sorted(eldeki.values(), key=lambda a: a["tarih"], reverse=True)
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    json.dump({"guncellendi": simdi.isoformat(), "aciklamalar": liste, "atlanan": sorted(atlanan)[-2000:],
               "bekleyen": max(0, len(bekleyen) - PARTI)}, open(yol, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if yeni:
        log(f"Açıklamalar: {yeni} yeni açıklama yazıldı ({len(liste)} kayıt)")
    return yeni
