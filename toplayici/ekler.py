"""Toplayıcının ek işleri: olay kümeleme ve çerçeve notu, günlük arşiv, ZBS'nin RSS'i, Wayback'e kaydetme."""
import datetime as dt
import hashlib
import html
import json
import os
import re
import urllib.error
import urllib.request

GEMINI = "https://generativelanguage.googleapis.com/v1beta"
import marka  # noqa: E402
MARKA = marka.oku()
UA = (re.sub(r"[^A-Za-z0-9]+", "-", MARKA["kisa_ad"]).strip("-") or "haber") + "-haber-toplayici/1.0 (+https://github.com)"

ETIKETLER = ["Gazze", "Batı Şeria", "Kudüs", "Lübnan", "Suriye", "Yemen ve Kızıldeniz", "İran", "Irak", "Mısır",
             "Ürdün", "Mağrip", "Türkiye", "Körfez", "Göç", "Diplomasi ve müzakere", "İnsani durum",
             "Esirler ve tutuklular", "Uluslararası hukuk", "Protesto ve dayanışma", "Ekonomi ve boykot",
             "İsrail iç siyaseti", "Avrupa", "ABD"]


def gemini_cagir(anahtar, model, metin, zaman=120):
    """(durum kodu, ayrıştırılmış JSON ya da None)"""
    govde = {
        "contents": [{"role": "user", "parts": [{"text": metin}]}],
        "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
    }
    istek = urllib.request.Request(
        f"{GEMINI}/models/{model}:generateContent",
        data=json.dumps(govde).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA},
    )
    try:
        with urllib.request.urlopen(istek, timeout=zaman) as r:
            yanit = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None
    try:
        t = yanit["candidates"][0]["content"]["parts"][0]["text"]
        t = re.sub(r"^```(?:json)?|```$", "", t.strip()).strip()
        return 200, json.loads(t)
    except Exception:
        return 200, None


# ---------------------------------------------------------------- olaylar
OLAY_TALIMAT = """Aşağıda son 24 saatte farklı yayın organlarından gelen haberler var (Türkçe başlık, kaynak adı ve özgün başlık).
Görevin: AYNI OLAYI anlatan haberleri gruplamak.

Kurallar:
- Bir grup en az İKİ FARKLI kaynaktan haber içermeli. Tek kaynaklı olayları yazma.
- Yalnızca gerçekten aynı olaya (aynı saldırı, aynı açıklama, aynı toplantı, aynı karar) ait haberleri birleştir; yalnızca konusu benzeyenleri birleştirme.
- baslik: olayı anlatan, tarafsız, en fazla 12 kelimelik Türkçe başlık.
- not: 1-3 cümlelik Türkçe çerçeve notu. Kaynakların olayı nasıl farklı anlattığını betimle: hangi kaynak hangi kelimeyi seçti (özgün kelimeyi tırnak içinde, en fazla 4 kelime), kimin açıklamasını öne çıkardı, hangi bilgiyi verdi ya da vermedi. Yalnızca verilen başlıklardan çıkarılabilecekleri yaz. Hüküm verme, hangi kaynağın haklı olduğunu söyleme. Kaynaklar aynı şekilde anlatıyorsa bunu kısaca söyle.
- yorumlar: gruptaki HER haber için o kaynağın olayı nasıl sunduğunu anlatan en fazla 18 kelimelik Türkçe betimleme. Hangi kelimeyi seçtiğini (özgün kelime tırnak içinde, en fazla 4 kelime), kimi kaynak gösterdiğini ya da neyi öne çıkardığını yaz. Hüküm verme, "taraflı" gibi nitelemeler kullanma.
- bakislar: gruptaki HER haber için başlığın olayı kimin çerçevesiyle sunduğunu tek kelimeyle yaz. Ölçeğin başlangıç noktası Filistin bakışıdır; soru, başlığın olayı yaşayan Filistin halkının gözünden ne kadar uzaklaştığıdır. Ölçüt, haberin KONUSU değil, yayının KENDİ dilidir:
  "filistin" = Filistinli/Arap kurbanları ya da direniş kaynaklarını merkeze alıyor; ya da İsrail/ABD eylemini eleştirel dille anlatıyor ("işgal", "katliam", "soykırım", "şehit", "saldırganlık", "abluka", "boğmak", "başarısız" gibi).
  "aktarim" = bir tarafın (ABD, İsrail, İran, Hamas…) açıklamasını tırnak ya da "…dedi/duyurdu" kalıbıyla, kendi yargısını katmadan aktarıyor. Bir ABD ya da İsrail duyurusunu yansız haberleştirmek "aktarim"dır, "israil" değildir.
  "israil" = İsrail ya da ABD çerçevesini yayının kendi sesiyle benimsiyor: onların ifadelerini tırnaksız kullanıyor ("terörist", "terör altyapısı", "operasyon", "İran'ın vekilleri"), eylemi olumluyor ya da Filistinli/Arap kayıpları geri plana itiyor.
  Kararsız kalırsan "aktarim" yaz.
- yer: olayın yaşandığı yer (açıklama ya da toplantıysa yapıldığı şehir). {"ad": "Türkçe yer adı", "lat": enlem, "lon": boylam}; yaklaşık şehir merkezi yeter. Belirsizse null.
- Yalnızca şu biçimde JSON döndür: [{"baslik": "...", "not": "...", "ids": ["...", "..."], "yorumlar": {"id": "betimleme"}, "bakislar": {"id": "filistin|aktarim|israil"}, "yer": {"ad": "...", "lat": 0, "lon": 0}}]
"""


def olaylari_kumele(anahtar, model, haberler, simdi):
    son = [h for h in haberler if h.get("baslik_tr")
           and (simdi - dt.datetime.fromisoformat(h["tarih"])).total_seconds() < 86400]
    son.sort(key=lambda h: h["tarih"], reverse=True)
    son = son[:260]
    if len(son) < 4:
        return None
    girdi = [{"id": h["id"], "kaynak": h["kaynak_ad"], "baslik": h["baslik_tr"], "ozgun": h["baslik_orj"][:160]} for h in son]
    kod, sonuc = gemini_cagir(anahtar, model, OLAY_TALIMAT + "\n\n" + json.dumps(girdi, ensure_ascii=False), zaman=180)
    if kod != 200 or not isinstance(sonuc, list):
        return kod
    var = {h["id"]: h for h in son}
    olaylar = []
    for g in sonuc:
        if not isinstance(g, dict):
            continue
        ids = [i for i in dict.fromkeys(map(str, g.get("ids") or [])) if i in var]
        kaynaklar = {var[i]["kaynak"] for i in ids}
        if len(kaynaklar) < 2:
            continue
        ids.sort(key=lambda i: var[i]["tarih"], reverse=True)
        oid = "o" + hashlib.sha1(",".join(sorted(ids)).encode()).hexdigest()[:10]
        yor = g.get("yorumlar") if isinstance(g.get("yorumlar"), dict) else {}
        yer = None
        y = g.get("yer")
        try:
            if isinstance(y, dict) and -90 <= float(y.get("lat")) <= 90 and -180 <= float(y.get("lon")) <= 180:
                yer = {"ad": str(y.get("ad") or "")[:60], "lat": round(float(y["lat"]), 2), "lon": round(float(y["lon"]), 2)}
        except (TypeError, ValueError):
            yer = None
        olaylar.append({
            "yer": yer,
            "id": oid, "baslik": str(g.get("baslik") or "")[:160], "not": str(g.get("not") or "")[:700],
            "haberler": ids, "kaynak_sayisi": len(kaynaklar), "son": var[ids[0]]["tarih"],
            "ilk": var[ids[-1]]["tarih"],
            "yorumlar": {i: str(yor.get(i))[:220] for i in ids if yor.get(i)},
            "bakislar": {i: v for i, v in ((i, str((g.get("bakislar") or {}).get(i, "")).strip().lower()) for i in ids)
                         if v in ("filistin", "aktarim", "israil")} if isinstance(g.get("bakislar"), dict) else {},
        })
    olaylar.sort(key=lambda o: (o["kaynak_sayisi"], o["son"]), reverse=True)
    return olaylar


# ---------------------------------------------------------------- arşiv
ARSIV_ALANLAR = ("id", "kaynak", "kaynak_ad", "url", "tarih", "baslik_tr", "ozet_tr", "etiket", "gorsel", "arsiv", "telegram",
                 "nitelik", "baslik_orj", "dil", "kayip")


def arsive_yaz(kok, haberler):
    """Türkçe özeti yazılmış haberleri günlük dosyalara ekler (data/arsiv/YYYY-AA-GG.json)."""
    klasor = os.path.join(kok, "data", "arsiv")
    os.makedirs(klasor, exist_ok=True)
    gunler = {}
    for h in haberler:
        if h.get("ozet_tr"):
            gunler.setdefault(h["tarih"][:10], []).append({k: h[k] for k in ARSIV_ALANLAR if h.get(k) is not None})
    for gun, liste in gunler.items():
        yol = os.path.join(klasor, gun + ".json")
        try:
            with open(yol, encoding="utf-8") as f:
                var = {x["id"]: x for x in json.load(f)}
        except Exception:
            var = {}
        for x in liste:
            var[x["id"]] = {**var.get(x["id"], {}), **x}
        veri = sorted(var.values(), key=lambda x: x["tarih"], reverse=True)
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    dizin = []
    for ad in sorted(os.listdir(klasor), reverse=True):
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}\.json", ad):
            try:
                with open(os.path.join(klasor, ad), encoding="utf-8") as f:
                    dizin.append({"gun": ad[:10], "sayi": len(json.load(f))})
            except Exception:
                pass
    with open(os.path.join(klasor, "dizin.json"), "w", encoding="utf-8") as f:
        json.dump(dizin, f, ensure_ascii=False)
    return len(gunler)


# ---------------------------------------------------------------- RSS
def rss_yaz(kok, haberler, simdi):
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    site = f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else "./"
    ozetli = [h for h in haberler if h.get("ozet_tr")][:100]
    e = lambda s: html.escape(s or "", quote=True)
    ogeler = []
    for h in ozetli:
        t = dt.datetime.fromisoformat(h["tarih"]).strftime("%a, %d %b %Y %H:%M:%S +0000")
        aciklama = f"{h['ozet_tr']}\n\nKaynak: {h['kaynak_ad']}"
        ogeler.append(
            f"<item><title>{e(h['baslik_tr'])}</title><link>{e(h['url'])}</link>"
            f"<guid isPermaLink=\"false\">{e(h['id'])}</guid><pubDate>{t}</pubDate>"
            f"<source url=\"{e(site)}data/rss.xml\">{e(h['kaynak_ad'])}</source>"
            f"<description>{e(aciklama)}</description></item>")
    xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>'
           f"<title>{e(MARKA['ad'])}</title><link>{e(site)}</link><language>tr</language>"
           "<description>Mağrip’ten Körfez’e basının Türkçe takibi</description>"
           f"<lastBuildDate>{simdi.strftime('%a, %d %b %Y %H:%M:%S +0000')}</lastBuildDate>"
           + "".join(ogeler) + "</channel></rss>\n")
    with open(os.path.join(kok, "data", "rss.xml"), "w", encoding="utf-8") as f:
        f.write(xml)


# ---------------------------------------------------------------- Wayback
def wayback_kaydet(url, zaman=60):
    """Wayback Machine'e kaydettirir. Başarılıysa arşiv adresini, kota doluysa 'KOTA' döndürür."""
    istek = urllib.request.Request("https://web.archive.org/save/" + url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(istek, timeout=zaman) as r:
            yer = r.headers.get("Content-Location") or ""
            son = r.geturl()
            if yer.startswith("/web/"):
                return "https://web.archive.org" + yer
            if "/web/" in son:
                return son
            return "https://web.archive.org/web/" + url
    except urllib.error.HTTPError as e:
        if e.code == 429:
            return "KOTA"
        return None
    except Exception:
        return None


# ---------------------------------------------------------------- kanıt defteri
def kanit_guncelle(kok, olaylar, haberler):
    """Her olay karşılaştırmasında her yayının başlığına verilen bakış etiketini yayının defterine işler.
    Defter, kaynaklar sayfasında 'bu yayın neden bu çizgide' sorusunun ölçülmüş kanıtı olarak gösterilir."""
    yol = os.path.join(kok, "data", "kanit.json")
    try:
        with open(yol, encoding="utf-8") as f:
            defter = json.load(f)
    except Exception:
        defter = {}
    eklenen = 0
    for o in olaylar:
        for hid, bakis in (o.get("bakislar") or {}).items():
            h = haberler.get(hid)
            if not h:
                continue
            d = defter.setdefault(str(h["kaynak"]), {"olcum": [], "ornek": []})
            if any(x[0] == hid for x in d["olcum"]):
                continue  # aynı haber bir kez sayılır
            d["olcum"].append([hid, h["tarih"][:10], bakis])
            d["olcum"] = d["olcum"][-400:]
            d["ornek"].insert(0, {"id": hid, "tarih": h["tarih"], "bakis": bakis, "url": h["url"],
                                  "baslik_orj": h.get("baslik_orj", "")[:240], "baslik_tr": h.get("baslik_tr", ""),
                                  "yorum": (o.get("yorumlar") or {}).get(hid, ""), "olay": o.get("baslik", "")})
            d["ornek"] = d["ornek"][:12]
            eklenen += 1
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(defter, f, ensure_ascii=False, separators=(",", ":"))
    return eklenen
