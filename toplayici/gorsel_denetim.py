"""Ana sayfa Gündem görselleri için denetim (data/gundem.json üzerinde, her görsel bir kez; data/gorsel-denetim.json önbellek).

Gemini'ye görselin kendisi gösterilir ve iki şey sorulur:
- Görsel bir yazı grafiği mi? (son dakika bandı, haber kartı, afiş, alıntı kartı, infografik: yazının ana öğe olduğu,
  tasarlanmış görseller). Öyleyse kullanılmaz; sıradaki aday görsele geçilir, hiçbiri uygun değilse görselsiz kalır.
  Fotoğrafta tabela, pankart, bayrak üzerindeki yazı sorun değildir.
- İnsanlar varsa kafalarının (yüzlerinin) görseldeki yeri: ekran kırpması kafaları kesmesin diye görsel o noktaya hizalanır.
Lisans: büyük Gündem görselleri yalnızca açık lisanslı olur. Kaynakların kendi fotoğrafları lisanssız olduğu için
Gündem'de kullanılmaz (akışta küçük önizleme olarak kalır). Gündem görseli Wikimedia Commons'tan gelir: olayın konumunun
10 km çevresinde coğrafi etiketli dosyalar, yoksa yer adı ve "Gaza" aramasıyla; yalnızca kamu malı, CC0, CC BY ve
CC BY-SA lisanslılar; altında fotoğrafçı ve lisans yazılır. Ölü ya da yaralı gösteren görseller de elenir.
Kullanım: topla.py her çalıştırmada denetle(kok, anahtar, model, log) çağırır; çalıştırma başına en çok 12 yeni görsel.
"""
import base64
import json
import os
import urllib.request

GEMINI = "https://generativelanguage.googleapis.com/v1beta"
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
EN_COK = 24
TALIMAT = ("Bu görsel bir haber sitesinde şu haberin başında kullanılacak: «{baslik}». Yalnızca JSON döndür: "
           "{{\"yazi_grafik\": true|false, \"siddet\": true|false, \"mustehcen\": true|false, \"portre\": true|false, \"ilgili\": true|false, "
           "\"saygisiz\": true|false, \"insan\": true|false, \"odak_x\": 0-100, \"odak_y\": 0-100}}. "
           "yazi_grafik: yazının ana öğe olduğu TASARLANMIŞ grafik mi (son dakika bandı, haber kartı, afiş, alıntı kartı, infografik, logo, harita)? "
           "Gerçek bir fotoğraftaki tabela ya da pankart bunu true yapmaz. "
           "siddet: ölü beden, kan, yaralı, silah doğrultulmuş insan, patlama anı ya da yıkım altında insan var mı? "
           "mustehcen: çıplaklık, cinsel ya da müstehcen herhangi bir öğe var mı? "
           "portre: görselin ana konusu tanınabilir bir ya da iki kişi mi? "
           "ilgili: görsel bu haberin yerini (şehir, bölge, sınır kapısı, bina, sokak, manzara) ya da konusunu makul biçimde gösteriyor mu? "
           "Haberle ilgisi olmayan doğa yakın çekimleri (mantar, çiçek, böcek, hayvan), yemek, eşya, spor ya da eğlence görselleri false. "
           "saygisiz: bu görsel bu haberle yan yana konunca haberdeki kişileri, şehitleri ya da halkı küçümseyen, alay eden ya da "
           "hakaret gibi okunabilecek bir eşleşme olur mu (hayvan, çöp, komik ya da alakasız nesne)? Şüphedeysen true. "
           "insan: görselde tanınabilir ya da belirgin bir insan var mı (uzaktaki küçük kalabalık siluetleri hariç)? "
           "odak_x, odak_y: insan varsa kafalarının ortalama yeri (yüzde, sol üst 0,0); yoksa ana konunun yeri.")
SORGU = ("Bir haber için Wikimedia Commons'ta açık lisanslı fotoğraf arayacağız. Haber: «{baslik}» — {not_}. Yer: {yer}. "
         "Öncelik sırasıyla en çok 4 İngilizce Commons arama ifadesi yaz: önce olayın tam yeri (ör. \"Rafah Border Crossing\"), "
         "sonra şehir ya da bölge (ör. \"Rafah\", \"Gaza Strip street\"), sonra konuyla ilgili genel bir yer görüntüsü. "
         "KİŞİ ADI YAZMA: yalnızca yerler, binalar, sokaklar, manzaralar. Yalnızca JSON: {{\"sorgular\": [\"...\"]}}")


def _indir(url, sinir=3_000_000):
    istek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(istek, timeout=20) as r:
        tur = (r.headers.get("Content-Type") or "image/jpeg").split(";")[0]
        veri = r.read(sinir + 1)
    if len(veri) > sinir or not tur.startswith("image/") or tur == "image/svg+xml":
        return None, None
    return veri, tur


def _sor(anahtar, model, veri, tur, baslik=""):
    govde = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}}, {"text": TALIMAT.format(baslik=baslik or "")}]}],
             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        v = json.loads(r.read())
    metin = v["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(metin)


def _sorgular(anahtar, model, o):
    """Gemini'den habere özgü Commons arama ifadeleri (kişi adı içermez)"""
    govde = {"contents": [{"role": "user", "parts": [{"text": SORGU.format(baslik=o.get("baslik_en") or o.get("baslik", ""),
                                                                       not_=(o.get("not_en") or o.get("not") or "")[:300], yer=o.get("yer_ad") or "-")}]}],
             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        v = json.loads(r.read())
    x = json.loads(v["candidates"][0]["content"]["parts"][0]["text"])
    return [str(q)[:80] for q in (x.get("sorgular") or []) if str(q).strip()][:4]


COMMONS = "https://commons.wikimedia.org/w/api.php"
LISANS_TAMAM = ("cc0", "public domain", "pd", "cc by ", "cc by-sa", "cc-by", "cc-by-sa")
import html as _html
import re as _re
import urllib.parse as _up


def _commons(params):
    q = {"action": "query", "format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": 1400, **params}
    istek = urllib.request.Request(COMMONS + "?" + _up.urlencode(q), headers={"User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=30) as r:
        v = json.loads(r.read())
    cikti = []
    for p in (v.get("query", {}).get("pages", {}) or {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        md = ii.get("extmetadata") or {}
        lis = _html.unescape((md.get("LicenseShortName") or {}).get("value", "")).strip()
        if not lis or not any(lis.lower().startswith(x) or x in lis.lower() for x in LISANS_TAMAM) or "nc" in lis.lower().split("-") or "nd" in lis.lower().split("-"):
            continue
        if (ii.get("width") or 0) < 900:
            continue
        sanatci = _re.sub(r"<[^>]+>", "", _html.unescape((md.get("Artist") or {}).get("value", ""))).strip()[:80] or "Wikimedia Commons"
        kat = _html.unescape((md.get("Categories") or {}).get("value", ""))
        yil = _re.search(r"(19|20)\d{2}", _html.unescape((md.get("DateTimeOriginal") or md.get("DateTime") or {}).get("value", "")))
        w, h = ii.get("width") or 0, ii.get("height") or 1
        # sıralama puanı: topluluğun "kaliteli / öne çıkan" dediği, 2023 sonrası çekilmiş, yatay fotoğraflar önce
        puan = (3 if _re.search(r"Quality images|Featured pictures|Valued images", kat) else 0) \
            + (2 if yil and int(yil.group(0)) >= 2023 else 1 if yil and int(yil.group(0)) >= 2015 else 0) \
            + (1 if w / h >= 1.3 else -2 if w / h < 1 else 0)
        cikti.append({"url": ii.get("thumburl") or ii.get("url"), "sayfa": ii.get("descriptionurl"), "atif": f"{sanatci} · {lis} · Wikimedia Commons",
                      "puan": puan})
    return cikti


YEDEK = ["Gaza City", "Gaza Strip", "Khan Yunis", "Rafah", "Deir al-Balah", "Jabalia", "Gaza beach", "Gaza port", "Nablus", "Jerusalem Old City"]


def commons_ara(konum, yer_ad, sorgular=None):
    """Habere uygun olabilecek açık lisanslı fotoğraflar (aday listesi): önce habere özgü ifadelerin Commons kategorileri
    (ör. Category:Rafah Border Crossing), sonra aynı ifadelerle arama, sonra olayın konumunun 10 km çevresi, en sonda genel
    bir Gazze / Filistin havuzu. Her grup kendi içinde puana göre (kaliteli, yeni, yatay) sıralanır; hepsi sonra görsel
    denetiminden geçer."""
    a, gorulen = [], set()
    def ekle(xs):
        for x in sorted(xs, key=lambda x: -x.get("puan", 0)):
            if x["url"] not in gorulen:
                gorulen.add(x["url"]); a.append(x)
    for q in (sorgular or []):
        try:
            ekle(_commons({"generator": "categorymembers", "gcmtitle": "Category:" + q, "gcmtype": "file", "gcmlimit": 20}))
        except Exception:
            pass
        try:
            ekle(_commons({"generator": "search", "gsrsearch": "filetype:bitmap " + q, "gsrnamespace": 6, "gsrlimit": 10}))
        except Exception:
            pass
    if konum:
        try:
            ekle(_commons({"generator": "geosearch", "ggscoord": f"{konum[0]}|{konum[1]}", "ggsradius": 10000, "ggslimit": 15, "ggsnamespace": 6}))
        except Exception:
            pass
    if len(a) < 6:
        for q in ([yer_ad] if yer_ad else []) + YEDEK[:4]:
            try:
                ekle(_commons({"generator": "categorymembers", "gcmtitle": "Category:" + q, "gcmtype": "file", "gcmlimit": 20}))
            except Exception:
                pass
            if len(a) >= 15:
                break
    return a


def denetle(kok, anahtar, model, log=print, sayac=None):
    yol_g = os.path.join(kok, "data", "gundem.json")
    yol_o = os.path.join(kok, "data", "gorsel-denetim.json")
    try:
        g = json.load(open(yol_g, encoding="utf-8"))
    except (OSError, ValueError):
        return
    try:
        onb = json.load(open(yol_o, encoding="utf-8"))
    except (OSError, ValueError):
        onb = {}
    yeni = 0
    import datetime as _dt
    bugun = _dt.date.today().isoformat()
    # aynı fotoğraf iki habere konmaz: şu anki Gündem'de ve son 30 günde başka bir haberde kullanılanlar atlanır
    kullan = onb.get("_kullanilan") or {}
    sinir = (_dt.date.today() - _dt.timedelta(days=30)).isoformat()
    kullan = {u: x for u, x in kullan.items() if x[1] >= sinir}
    simdi_kullan = set()
    # yöneticinin seçtiği kişi fotoğrafları (dogrulama.py /foto): başlıkta adı geçen kişinin fotoğrafı önce denenir
    try:
        KF = json.load(open(os.path.join(kok, "data", "kisi-foto.json"), encoding="utf-8")).get("kisiler", [])
    except (OSError, ValueError):
        KF = []
    kf_son = onb.get("_kisi_son") or {}
    for o in g.get("olaylar", []):
        bas = ((o.get("baslik") or "") + " " + (o.get("baslik_en") or "")).lower()
        kisi = [f for k in KF if any(a.lower() in bas for a in k["adlar"]) for f in k["fotolar"]]
        kisi.sort(key=lambda f: kf_son.get(f["url"], ""))      # en uzun süredir kullanılmayan önce
        kisi_secilen = None
        for c in kisi:
            if c["url"] in simdi_kullan:
                continue
            kk = c["url"] + "|" + o["id"]
            k = onb.get(kk)
            if k is None and anahtar and model and yeni < EN_COK:
                try:
                    veri, tur = _indir(c["url"])
                    if veri:
                        if sayac:
                            sayac()
                        k = _sor(anahtar, model, veri, tur, o.get("baslik", ""))
                        yeni += 1
                        onb[kk] = k
                except Exception as e:
                    log(f"Kişi fotoğrafı denetimi: {e}")
            # yönetici seçtiği için portre ve ilgililik aranmaz; şiddet, müstehcenlik, yazı grafiği ve saygısızlık yine eler
            if k and not any(k.get(a) for a in ("yazi_grafik", "siddet", "mustehcen", "saygisiz")):
                kisi_secilen = (c, k)
                break
        if kisi_secilen:
            c, k = kisi_secilen
            o["gorsel"], o["gorsel_atif"], o["gorsel_sayfa"], o["gorsel_kaynak"] = c["url"], c["atif"], c.get("sayfa"), None
            simdi_kullan.add(c["url"])
            kf_son[c["url"]] = bugun + "|" + o["id"] if kf_son.get(c["url"], "").split("|")[-1] != o["id"] else kf_son[c["url"]]
            try:
                o["odak"] = f'{max(0, min(100, int(k.get("odak_x", 50))))}% {max(0, min(100, int(k.get("odak_y", 30))))}%'
            except (TypeError, ValueError):
                o["odak"] = "50% 30%"
            continue
        anah = "commons3:" + o["id"]
        if anah not in onb:
            sorg = []
            if anahtar and model:
                try:
                    if sayac:
                        sayac()
                    sorg = _sorgular(anahtar, model, o)
                except Exception as e:
                    log(f"Görsel arama ifadeleri: {e}")
            try:
                onb[anah] = commons_ara(o.get("konum"), o.get("yer_ad"), sorg)[:20]
            except Exception as e:
                log(f"Commons araması: {e}")
                onb[anah] = []
        adaylar = onb.get(anah) or []
        secilen = None
        for c in adaylar:
            url = c["url"]
            u = kullan.get(url)
            if url in simdi_kullan or (u and u[0] != o["id"]):
                continue
            kk = url + "|" + o["id"]          # uygunluk habere göre değişir
            k = onb.get(kk)
            if k is None and anahtar and model and yeni < EN_COK:
                try:
                    veri, tur = _indir(url)
                    if veri:
                        if sayac:
                            sayac()
                        k = _sor(anahtar, model, veri, tur, o.get("baslik", ""))
                        yeni += 1
                    else:
                        k = {"yazi_grafik": True, "indirilemedi": True}
                except Exception as e:
                    log(f"Görsel denetimi: {url[:80]}: {e}")
                    k = None
                if k is not None:
                    onb[kk] = k
            if k is None:
                continue                    # denetlenmeden kullanılmaz
            temiz = not any(k.get(a) for a in ("yazi_grafik", "siddet", "mustehcen", "portre", "saygisiz"))
            if temiz and k.get("ilgili") is True and not k.get("insan"):
                secilen = (c, k)
                break
        o["gorsel"], o["gorsel_kaynak"], o["gorsel_atif"], o["gorsel_sayfa"] = None, None, None, None
        if secilen:
            c, k = secilen
            o["gorsel"], o["gorsel_atif"], o["gorsel_sayfa"] = c["url"], c["atif"], c.get("sayfa")
            simdi_kullan.add(c["url"])
            kullan[c["url"]] = [o["id"], bugun]
            try:
                o["odak"] = f'{max(0, min(100, int(k.get("odak_x", 50))))}% {max(0, min(100, int(k.get("odak_y", 35))))}%'
            except (TypeError, ValueError):
                o["odak"] = "50% 35%"
    onb["_kullanilan"] = kullan
    onb["_kisi_son"] = kf_son
    if len(onb) > 4000:
        k_, s_ = onb.pop("_kullanilan", {}), onb.pop("_kisi_son", {})
        onb = dict(list(onb.items())[-3000:])
        onb["_kullanilan"], onb["_kisi_son"] = k_, s_
    with open(yol_o, "w", encoding="utf-8") as f:
        json.dump(onb, f, ensure_ascii=False, separators=(",", ":"))
    with open(yol_g, "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))
    if yeni:
        log(f"Görsel denetimi: {yeni} yeni görsel")


AKIS_TALIMAT = ("Bu bir haber sitesinin akışında küçük önizleme olarak gösterilecek görsel. Yalnızca JSON döndür: "
                "{\"siddet\": true|false, \"mustehcen\": true|false}. siddet: ölü beden, kan, ağır yaralı, parçalanmış beden ya da "
                "işkence görüntüsü var mı? mustehcen: çıplaklık, cinsel ya da müstehcen öğe var mı? Şüphedeysen true.")
AKIS_EN_COK = 60


def akis_denetle(kok, anahtar, model, log=print, sayac=None):
    """Akıştaki haber görselleri (kaynakların kendi fotoğrafları) da gösterilmeden önce denetlenir: şiddet ya da
    müstehcenlik varsa gösterilmez. Denetlenmemiş görsel de gösterilmez (h["gorsel_ok"] yalnızca denetimden geçince true)."""
    yol_h = os.path.join(kok, "data", "haberler.json")
    yol_o = os.path.join(kok, "data", "gorsel-akis.json")
    try:
        v = json.load(open(yol_h, encoding="utf-8"))
    except (OSError, ValueError):
        return
    try:
        onb = json.load(open(yol_o, encoding="utf-8"))
    except (OSError, ValueError):
        onb = {}
    H = v.get("haberler", [])
    yeni = 0
    for h in sorted(H, key=lambda h: h.get("tarih") or "", reverse=True):
        u = h.get("gorsel")
        if not u:
            continue
        k = onb.get(u)
        if k is None and anahtar and model and yeni < AKIS_EN_COK and (h.get("ilgili") or h.get("ozet_tr")):
            try:
                veri, tur = _indir(u)
                if veri:
                    if sayac:
                        sayac()
                    govde = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}}, {"text": AKIS_TALIMAT}]}],
                             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
                    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
                    with urllib.request.urlopen(istek, timeout=60) as r:
                        x = json.loads(json.loads(r.read())["candidates"][0]["content"]["parts"][0]["text"])
                    k = {"ok": not (x.get("siddet") or x.get("mustehcen")), "s": bool(x.get("siddet")), "m": bool(x.get("mustehcen"))}
                    yeni += 1
                else:
                    k = {"ok": False, "indirilemedi": True}
                onb[u] = k
            except Exception as e:
                log(f"Akış görsel denetimi: {u[:70]}: {e}")
        h["gorsel_ok"] = bool(k and k.get("ok"))
    if len(onb) > 20000:
        onb = dict(list(onb.items())[-15000:])
    with open(yol_o, "w", encoding="utf-8") as f:
        json.dump(onb, f, ensure_ascii=False, separators=(",", ":"))
    with open(yol_h, "w", encoding="utf-8") as f:
        json.dump(v, f, ensure_ascii=False, separators=(",", ":"))
    if yeni:
        log(f"Akış görsel denetimi: {yeni} görsel, {sum(1 for x in onb.values() if not x.get('ok'))} elenmiş (toplam)")
