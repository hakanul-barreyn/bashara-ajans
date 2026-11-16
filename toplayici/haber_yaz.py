"""Gündem olayları için Alboroto'nun kendi haber metni (data/yazi/<olay no>.json).

Girdi: data/gundem.json (aynı olayı yazan haberler) ve data/haberler.json (her haberin Türkçe başlığı ve özeti).
Metni Gemini yazar; kurallar YAZI_TALIMAT'ta. Yalnızca kaynaklarda olan bilgi, her bilgi kaynağıyla, fail adıyla.
Olayın haber listesi değişmedikçe metin yeniden yazılmaz; yeni haber gelirse metin yeni sürümle güncellenir.

Gemini yoksa ya da kotası dolduysa hiçbir şey yazılmaz: haber sayfası (site/sayfa-haber.js) o zaman kaynakların
özetlerini atıflarıyla sıralayan bir derleme gösterir. Metin saklanmaz, yalnızca kaynakların başlık ve özetleri kullanılır.
"""
import datetime as dt
import hashlib
import json
import os
import re

import ekler
import turkce_uslup

YAZI_TALIMAT = """Sen bölgeden haber yapan bir Türkçe haber sitesinin muhabirisin. Aşağıda aynı olayı yazan farklı yayınların
haberleri var: her biri numaralı; yayının adı, kampı (Filistin, Arap dünyası, İran, Türkiye, İsrail, Batı...), saati,
Türkçe başlığı ve özeti. Bunlardan tek bir haber metni yaz.

Kurallar:
- YALNIZCA verilen başlık ve özetlerdeki bilgileri kullan. Bilgi, rakam, tarih, isim, neden-sonuç ekleme. Emin olmadığın şeyi yazma.
- Her bilgiyi kaynağına atfet: "WAFA'nın aktardığına göre", "El Cezire'ye göre", "Gazze Sağlık Bakanlığı açıkladı". Aynı bilgiyi
  birçok yayın veriyorsa "Filistin ve Arap basınındaki yayınlar" gibi topluca atfedebilirsin. Her paragrafın "kaynaklar" alanına
  o paragraftaki bilgilerin geldiği haberlerin numaralarını yaz.
- Bakış açısı: olayı yaşayanların ve bölgedeki yayınların anlatımını merkeze al. İsrail ordusunun ya da hükümetinin açıklamalarını
  doğrulanmış bilgi gibi değil, sahibine atfedilmiş açıklama olarak ver ("İsrail ordusu ... açıkladı", "... iddia etti").
- Fail: kaynaklar eylemi yapanı belirtiyorsa kendi cümlende de açıkça yaz ("İsrail'in hava saldırısında öldürüldü").
  Faili gizleyen edilgen anlatım kullanma.
- Kendi sesinde ölüm için "öldürüldü" ya da "hayatını kaybetti" yaz. "Şehit", "terörist", "Hamas yönetimindeki" gibi ifadeleri
  yalnızca bir kaynağa atfederek ve tırnak içinde kullan.
- Kaynaklar birbirini tutmuyorsa (sayı, fail, olayın nasıl olduğu) bunu açıkça yaz; hangisinin doğru olduğuna karar verme.
- "acıklama": true olan haber bir silahlı grubun KENDİ kanalından gelir (yayın değil, tarafın açıklaması). Onu yalnızca o grubun
  açıklaması olarak aktar ("Hamas açıklamasında ... dedi", "İslami Cihad ... üstlendiğini duyurdu"); doğrulanmış bilgi gibi verme.
  Övgü, slogan, tehdit ve çağrı cümlelerini aktarma; yalnızca olguya dair iddiayı ver. Kanalın adını ya da adresini yazma.
- Grafik ayrıntı (yaraların, cesetlerin tarifi) yazma. Sivillerin öldürülmesine çağrıyı ya da bunu kutlayan sözleri aktarma.
- Kendi cümlelerinle yaz, kaynaktan cümle kopyalama. Doğrudan alıntı en fazla bir tane ve 10 kelimeyi geçmesin.
- Yorum, değerlendirme, sıfat yüklemesi yapma; haber dili kullan.
- baslik: en fazla 14 kelime, olayın özü, fail varsa adıyla.
- spot: 1-2 cümle, en fazla 35 kelime; ne oldu, nerede, kim.
- paragraflar: 3-5 paragraf, toplam 120-260 kelime. İlk paragraf en önemli bilgi; sonra ayrıntılar, açıklamalar ve tepkiler.
- baglam: girdilerde olayın arka planı (önceki saldırılar, ateşkes, abluka, işgal, rakamlar) varsa onu tek paragrafta, kaynağıyla ver;
  yoksa null.
- Girdiler bu olay için haber yazmaya yetmiyorsa (tek cümlelik başlıklar, çelişkili ya da ilgisiz haberler) {"yetersiz": true} döndür.
- Yalnızca şu biçimde JSON döndür:
  {"baslik": "...", "spot": "...", "paragraflar": [{"metin": "...", "kaynaklar": [1, 3]}], "baglam": {"metin": "...", "kaynaklar": [2]} }
""" + turkce_uslup.USLUP

EN_COK_CALISMA = 5      # bir toplama turunda en fazla kaç metin yazılır
EN_AZ_YAYIN = 2         # olayı en az kaç farklı yayın yazmış olmalı
YENIDEN_YAZ_HABER = 3   # var olan metin ancak en az bu kadar yeni haber gelince ya da
YENIDEN_YAZ_SAAT = 2    # son yazımın üstünden bu kadar saat geçince yeniden yazılır
BOLGE = ("Filistin", "Arap dünyası", "Lübnan", "Yemen", "İran", "Türkiye")
_BAG = re.compile(r"(https?://\S+|www\.\S+|t\.me/\S+)", re.I)


def _oku(yol, varsayilan):
    try:
        with open(yol, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return varsayilan


def _kamp(k):
    try:
        import almanak
        return almanak.kamp(k) or ""
    except Exception:
        return k.get("kamp") or k.get("bolge") or ""


def _imza(ids):
    return hashlib.sha1(",".join(sorted(ids)).encode()).hexdigest()[:12]


def _temiz(s, sinir):
    s = ekler.guvenli(_BAG.sub("", str(s or ""))).strip()
    return s[:sinir]


def yaz(kok, anahtar, model, kaynaklar, simdi, log=print, sayac=None, butce=lambda: True):
    """Gündem olayları için metin yazar; yazılan metin sayısını döndürür."""
    gundem = _oku(os.path.join(kok, "data", "gundem.json"), {}).get("olaylar", [])
    hab = {h["id"]: h for h in _oku(os.path.join(kok, "data", "haberler.json"), {}).get("haberler", [])}
    kmap = {k["id"]: k for k in kaynaklar}
    klasor = os.path.join(kok, "data", "yazi")
    os.makedirs(klasor, exist_ok=True)
    dizin_yol = os.path.join(klasor, "dizin.json")
    dizin = _oku(dizin_yol, {})
    yazilan = 0
    for o in gundem[:20]:
        xs = [hab[i] for i in o.get("haberler", []) if i in hab]
        ks = {h.get("kaynak") for h in xs if not kmap.get(h.get("kaynak"), {}).get("silahli")}   # tarafın açıklaması yayın sayılmaz
        if len(ks) < EN_AZ_YAYIN:
            continue
        if sum(1 for k in ks if any(b in str(_kamp(kmap.get(k, {}))) for b in BOLGE)) < 1:
            continue
        imza = _imza([h["id"] for h in xs])
        onceki = _oku(os.path.join(klasor, o["id"] + ".json"), None)
        if onceki and (onceki.get("imza") == imza or onceki.get("yetersiz_imza") == imza):
            continue
        if onceki and onceki.get("baslik"):
            # metin var: her yeni haberde baştan yazma (maliyet); birkaç yeni haber birikince ya da birkaç saat geçince yenile
            yeni_n = len({h["id"] for h in xs} - set(onceki.get("haberler") or []))
            try:
                gecen = (simdi - dt.datetime.fromisoformat(onceki.get("guncellendi"))).total_seconds() / 3600
            except Exception:
                gecen = 99
            if yeni_n < YENIDEN_YAZ_HABER and gecen < YENIDEN_YAZ_SAAT:
                continue
        if not (anahtar and model) or yazilan >= EN_COK_CALISMA or not butce():
            continue
        xs.sort(key=lambda h: h.get("tarih") or "")
        girdi = []
        for i, h in enumerate(xs[:14], 1):
            k = kmap.get(h.get("kaynak"), {})
            girdi.append({"no": i, "yayin": (k.get("ad") or "").replace(" (resmî kanal)", "").replace(" (kanal)", "") + (" açıklaması" if k.get("silahli") else ""),
                          "kamp": "tarafın kendi açıklaması" if k.get("silahli") else _kamp(k), **({"acıklama": True} if k.get("silahli") else {}), "saat": (h.get("tarih") or "")[:16].replace("T", " "),
                          "baslik": h.get("baslik_tr") or h.get("baslik_orj"), "ozet": (h.get("ozet_tr") or "")[:900]})
        metin = YAZI_TALIMAT + "\n\nOlay (yalnızca yön göstermek için, bilgi kaynağı değildir): " + str(o.get("baslik") or "") + \
            "\n\nHaberler:\n" + json.dumps(girdi, ensure_ascii=False)
        if sayac:
            sayac()
        kod, v = ekler.gemini_cagir(anahtar, model, metin, zaman=150, gorev="haber_yaz")
        if kod == 429:
            log("Haber metni: Gemini kotası doldu")
            return yazilan if yazilan else -1
        if kod != 200 or not isinstance(v, dict):
            log(f"Haber metni: {o['id']} yazılamadı ({kod})")
            continue
        if v.get("yetersiz"):
            json.dump({"id": o["id"], "yetersiz_imza": imza, "denendi": simdi.isoformat()}, open(os.path.join(klasor, o["id"] + ".json"), "w", encoding="utf-8"))
            continue
        nolar = {i: h for i, h in enumerate(xs[:14], 1)}

        def atif(liste):
            a = []
            for n in liste or []:
                try:
                    h = nolar.get(int(n))
                except (TypeError, ValueError):
                    h = None
                if h and h["id"] not in [x["h"] for x in a]:
                    a.append({"h": h["id"], "k": h.get("kaynak"), "u": h.get("url")})
            return a
        par = []
        for p in v.get("paragraflar") or []:
            m = _temiz(p.get("metin"), 1200)
            a = atif(p.get("kaynaklar"))
            if m and a:
                par.append({"metin": m, "kaynaklar": a})
        baslik, spot = _temiz(v.get("baslik"), 160), _temiz(v.get("spot"), 320)
        kelime = sum(len(p["metin"].split()) for p in par)
        if not baslik or not spot or len(par) < 2 or kelime < 70:
            log(f"Haber metni: {o['id']} eksik döndü, atlandı")
            continue
        bg = v.get("baglam") if isinstance(v.get("baglam"), dict) else None
        baglam = {"metin": _temiz(bg.get("metin"), 900), "kaynaklar": atif(bg.get("kaynaklar"))} if bg and bg.get("metin") and atif(bg.get("kaynaklar")) else None
        surum = (onceki or {}).get("surum", 0) + 1 if onceki and onceki.get("baslik") else 1
        kayit = {"id": o["id"], "baslik": baslik, "spot": spot, "paragraflar": par, "baglam": baglam,
                 "yazildi": (onceki or {}).get("yazildi") or simdi.isoformat(), "guncellendi": simdi.isoformat(), "surum": surum,
                 "imza": imza, "haberler": [h["id"] for h in xs], "yayin_sayisi": len(ks), "model": model,
                 "gorsel": o.get("gorsel"), "gorsel_atif": o.get("gorsel_atif"), "gorsel_sayfa": o.get("gorsel_sayfa"), "yer_ad": o.get("yer_ad")}
        with open(os.path.join(klasor, o["id"] + ".json"), "w", encoding="utf-8") as f:
            json.dump(kayit, f, ensure_ascii=False, separators=(",", ":"))
        for h in xs:
            dizin[h["id"]] = o["id"]
        yazilan += 1
    del dizin
    # dizin: haber no → metin; ana sayfa bir hikâyenin metni olup olmadığını buradan anlar (yalnızca son 3 gün)
    sinir = (simdi - dt.timedelta(days=3)).isoformat()
    canli = {}
    for ad in os.listdir(klasor):
        if ad.endswith(".json") and ad != "dizin.json":
            y = _oku(os.path.join(klasor, ad), {})
            if y.get("baslik") and (y.get("guncellendi") or "") >= sinir:
                for hid in y.get("haberler", []):
                    canli[hid] = y["id"]
    with open(dizin_yol, "w", encoding="utf-8") as f:
        json.dump(canli, f, separators=(",", ":"))
    if yazilan:
        log(f"Haber metni: {yazilan} metin yazıldı")
    return yazilan
