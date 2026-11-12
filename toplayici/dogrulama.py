"""Doğrulama etiketleri: tamamen elle onaylı.

Hiçbir etiket otomatik konmaz. Sistem yalnızca ÖNERİ hazırlar ve yöneticiye (sana) Telegram'dan özel mesajla gönderir;
yönetici düğmeyle onaylamadıkça ya da kendisi komutla eklemedikçe sitede hiçbir şey görünmez.

Etiketler (haber başına):
  yanlis          ❌ Yanlış çıktı      yalnızca yönetici komutuyla ve en az bir kanıt bağlantısıyla
  celiskili       ⚠️ Çelişkili iddia   olay kümesindeki çelişki önerisini yönetici onaylarsa ya da komutla
  dogrulanmamis   🔍 Doğrulanmamış     yönetici komutuyla

Yönetici komutları (bota özel mesaj; yalnızca TELEGRAM_YONETICI kimliğinden gelenler işlenir):
  /yanlis <haber bağlantısı ya da kimliği> <kanıt bağlantısı> [kanıt2 …] <açıklama>
  /celiskili <haber> <açıklama>
  /dogrulanmamis <haber> <açıklama>
  /kaldir <haber>
  /liste
Bot her 15 dakikalık çalıştırmada mesajları okur; yanıt o zaman gelir.

Gerekenler: Secret TELEGRAM_BOT_TOKEN (kanal botu) ve Secret TELEGRAM_YONETICI (senin Telegram kullanıcı kimliğin, sayı).
Veri: data/dogrulama.json (sitede gösterilir). Öneri kuyruğu durum.json içinde.
"""
import datetime as dt
import hashlib
import html
import json
import os
import re
import urllib.request

ETIKET = {"yanlis": "❌ Yanlış çıktı", "celiskili": "⚠️ Çelişkili iddia", "dogrulanmamis": "🔍 Doğrulanmamış"}
ONERI_SINIRI = 5          # bir çalıştırmada en çok kaç öneri gönderilir
SON_HATA = ""


def _api(token, yontem, veri=None, zaman=25):
    global SON_HATA
    istek = urllib.request.Request(f"https://api.telegram.org/bot{token}/{yontem}",
                                   data=json.dumps(veri or {}).encode(), headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(istek, timeout=zaman) as r:
            y = json.loads(r.read())
            return y.get("result") if y.get("ok") else None
    except Exception as e:
        SON_HATA = type(e).__name__
        return None


def yonetici_album(token, yonetici, yollar, aciklama, dugmeler):
    """Kartları albüm olarak (sendMediaGroup, en çok 10) ve ardından düğmeli bir mesaj olarak yöneticiye gönderir.
    Döndürür: başarılı mı"""
    global SON_HATA
    sinir = "----zbs" + os.urandom(8).hex()
    medya, parca = [], []
    for n, y in enumerate(yollar[:10]):
        medya.append({"type": "photo", "media": f"attach://k{n}"})
        parca.append(f'--{sinir}\r\nContent-Disposition: form-data; name="k{n}"; filename="k{n}.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode()
                     + open(y, "rb").read() + b"\r\n")
    for ad, deger in (("chat_id", yonetici), ("media", json.dumps(medya))):
        parca.insert(0, f'--{sinir}\r\nContent-Disposition: form-data; name="{ad}"\r\n\r\n{deger}\r\n'.encode())
    parca.append(f"--{sinir}--\r\n".encode())
    istek = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMediaGroup", data=b"".join(parca),
                                   headers={"Content-Type": f"multipart/form-data; boundary={sinir}"})
    try:
        with urllib.request.urlopen(istek, timeout=60) as r:
            if not json.loads(r.read()).get("ok"):
                return False
    except Exception as e:
        SON_HATA = type(e).__name__
        return False
    return _api(token, "sendMessage", {"chat_id": yonetici, "text": aciklama[:4000], "link_preview_options": {"is_disabled": True},
                                       "reply_markup": {"inline_keyboard": [dugmeler]}}) is not None


def _e(s):
    return html.escape(str(s or ""), quote=False)


def _oku(kok):
    try:
        return json.load(open(os.path.join(kok, "data", "dogrulama.json"), encoding="utf-8"))
    except Exception:
        return {"etiketler": {}}


def _yaz(kok, veri):
    veri["guncellendi"] = dt.datetime.now(dt.timezone.utc).isoformat()
    json.dump(veri, open(os.path.join(kok, "data", "dogrulama.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)


_KIMLIK = re.compile(r"(?:/h/|#h-|#o-)?\b([0-9a-f]{12})\b")
_URL = re.compile(r"https?://\S+")


def _haber_kimligi(metin, haberler):
    for m in _KIMLIK.finditer(metin or ""):
        if m.group(1) in haberler:
            return m.group(1)
    return None


def _haber_satiri(h, kaynaklar):
    k = kaynaklar.get(h.get("kaynak"), {})
    return f"• <b>{_e(k.get('ad'))}</b>: {_e(h.get('baslik_tr') or h.get('baslik_orj'))} <code>{h['id']}</code>"


def _foto_komut(komut, geri, kok, simdi):
    """Kişi fotoğrafı listesi (data/kisi-foto.json): fotoğrafları yönetici seçer; sistem yalnızca Commons'taki lisansı okur."""
    import gorsel_denetim as GD
    yol = os.path.join(kok, "data", "kisi-foto.json")
    try:
        L = json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        L = {"kisiler": []}
    def kaydet():
        with open(yol, "w", encoding="utf-8") as f:
            json.dump(L, f, ensure_ascii=False, indent=1)
    if komut == "/fotolar":
        if not L["kisiler"]:
            return "Liste boş. Eklemek için: /foto Lewis Hamilton = https://commons.wikimedia.org/wiki/File:..."
        return "\n".join(f"<b>{_e(k['adlar'][0])}</b> ({_e(', '.join(k['adlar'][1:]) or '-')}): {len(k['fotolar'])} fotoğraf" for k in L["kisiler"])
    if komut == "/fotosil":
        m = re.match(r"(.+?)\s+(\d+)$", geri.strip())
        ad, sira = (m.group(1), int(m.group(2))) if m else (geri.strip(), None)
        k = next((x for x in L["kisiler"] if ad.lower() in [a.lower() for a in x["adlar"]]), None)
        if not k:
            return "Bu adla kayıt yok. /fotolar ile listeye bak."
        if sira and 1 <= sira <= len(k["fotolar"]):
            k["fotolar"].pop(sira - 1)
        else:
            L["kisiler"].remove(k)
        L["kisiler"] = [x for x in L["kisiler"] if x["fotolar"]]
        kaydet()
        return "Silindi."
    if "=" not in geri:
        return "Biçim: /foto Ad, diğer yazılış = https://commons.wikimedia.org/wiki/File:..."
    adlar_, bag = geri.split("=", 1)
    adlar = [a.strip() for a in adlar_.split(",") if len(a.strip()) >= 3]
    m = re.search(r"commons\.wikimedia\.org/wiki/(File:[^\s?#]+)", bag)
    if not adlar or not m:
        return "Ad ve bir Wikimedia Commons dosya bağlantısı (commons.wikimedia.org/wiki/File:...) gerekli."
    import urllib.parse as up
    baslik = up.unquote(m.group(1)).replace("_", " ")
    try:
        bulunan = GD._commons({"titles": baslik})
    except Exception as e:
        return f"Commons'a ulaşılamadı: {_e(str(e))[:100]}"
    if not bulunan:
        return "Bu dosya kullanılamıyor: açık lisanslı değil (yalnızca kamu malı, CC0, CC BY, CC BY-SA) ya da 900 pikselden dar."
    f = bulunan[0]
    k = next((x for x in L["kisiler"] if any(a.lower() in [b.lower() for b in x["adlar"]] for a in adlar)), None)
    if not k:
        k = {"adlar": adlar, "fotolar": []}
        L["kisiler"].append(k)
    else:
        k["adlar"] += [a for a in adlar if a.lower() not in [b.lower() for b in k["adlar"]]]
    if any(x["url"] == f["url"] for x in k["fotolar"]):
        return "Bu fotoğraf zaten listede."
    k["fotolar"].append({"url": f["url"], "sayfa": f["sayfa"], "atif": f["atif"], "eklendi": simdi.isoformat()})
    kaydet()
    return (f"✅ <b>{_e(k['adlar'][0])}</b> için fotoğraf eklendi ({len(k['fotolar'])}. fotoğraf).\n{_e(f['atif'])}\n"
            "Başlığında bu ad geçen Gündem haberlerinde kullanılacak; şiddet ve müstehcenlik denetimi yine yapılır.")


def _komut(metin, kim, kok, veri, haberler, kaynaklar, simdi, site):
    """Yönetici komutunu uygular. Döndürür: yanıt metni"""
    parca = metin.strip().split(maxsplit=1)
    komut, geri = parca[0].split("@")[0].lower(), (parca[1] if len(parca) > 1 else "")
    if komut in ("/start", "/yardim", "/help"):
        return ("Doğrulama komutları:\n/yanlis &lt;haber&gt; &lt;kanıt bağlantısı&gt; &lt;açıklama&gt;\n/celiskili &lt;haber&gt; &lt;açıklama&gt;\n"
                "/dogrulanmamis &lt;haber&gt; &lt;açıklama&gt;\n/kaldir &lt;haber&gt;\n/liste\n"
                "&lt;haber&gt;: sitedeki haber bağlantısı ya da 12 haneli kimlik.\n\n"
                "Kişi fotoğrafları (Gündem görselleri için):\n/foto Ad, diğer yazılış = &lt;Commons dosya bağlantısı&gt;\n"
                "/fotolar: listeyi göster\n/fotosil Ad: o kişinin bütün fotoğraflarını sil (ya da /fotosil Ad 2: yalnızca ikincisini)")
    if komut in ("/foto", "/fotolar", "/fotosil"):
        return _foto_komut(komut, geri, kok, simdi)
    if komut == "/liste":
        e = sorted(veri["etiketler"].items(), key=lambda x: x[1].get("tarih", ""), reverse=True)[:15]
        if not e:
            return "Henüz etiket yok."
        return "\n".join(f"{ETIKET.get(v['tur'], v['tur'])} <code>{i}</code> {_e(v.get('aciklama', ''))[:80]}" for i, v in e)
    hid = _haber_kimligi(geri, haberler)
    if not hid:
        return "Haber bulunamadı. Sitedeki haber bağlantısını ya da 12 haneli kimliği yaz (haber son iki gün içinde olmalı)."
    if komut == "/kaldir":
        if veri["etiketler"].pop(hid, None):
            return f"Etiket kaldırıldı: <code>{hid}</code>"
        return "Bu haberde etiket yok."
    tur = {"/yanlis": "yanlis", "/celiskili": "celiskili", "/dogrulanmamis": "dogrulanmamis"}.get(komut)
    if not tur:
        return "Bilinmeyen komut. /yardim yaz."
    kanit = [u.rstrip(").,;") for u in _URL.findall(geri) if hid not in u]
    aciklama = re.sub(r"\s+", " ", _URL.sub("", _KIMLIK.sub("", geri, count=1))).strip()
    if tur == "yanlis" and not kanit:
        return "❌ Yanlış çıktı etiketi için en az bir kanıt bağlantısı gerekli (düzeltme notu, doğrulama raporu, soruşturma)."
    if not aciklama:
        return "Kısa bir açıklama ekle: neyin yanlış/çelişkili/doğrulanmamış olduğu."
    h = haberler[hid]
    veri["etiketler"][hid] = {"tur": tur, "aciklama": aciklama[:400], "kanit": kanit[:5], "kaynak": h.get("kaynak"),
                              "baslik": h.get("baslik_tr") or h.get("baslik_orj"), "tarih": simdi.isoformat(), "kim": "yonetici"}
    return f"{ETIKET[tur]} eklendi:\n{_haber_satiri(h, kaynaklar)}\n{_e(aciklama)}\nSitede bir sonraki güncellemede görünür."


def calistir(kok, durum, olaylar, haberler, kaynaklar_liste, simdi, log=print):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    m = re.search(r"\d{6,12}:[A-Za-z0-9_-]{30,}", token)
    token = m.group(0) if m else ""
    yonetici = re.sub(r"\D", "", os.environ.get("TELEGRAM_YONETICI", ""))
    veri = _oku(kok)
    veri.setdefault("etiketler", {})
    kay = durum.setdefault("_dogrulama", {"offset": 0, "oneriler": {}})
    kaynaklar = {k["id"]: k for k in kaynaklar_liste}
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    site = f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else ""
    degisti = False
    if token and yonetici:
        # 1) Yöneticiden gelen düğme yanıtları ve komutlar
        guncel = _api(token, "getUpdates", {"offset": kay.get("offset", 0), "timeout": 0,
                                            "allowed_updates": ["message", "callback_query"]}) or []
        for u in guncel:
            kay["offset"] = u["update_id"] + 1
            if "callback_query" in u:
                c = u["callback_query"]
                if str(c.get("from", {}).get("id")) != yonetici:
                    continue
                parca = (c.get("data") or "").split(":")
                if parca[0] == "i" and len(parca) == 3:
                    # Instagram gönderi onayı: i:yay:<öge> / i:atla:<öge>
                    q = next((x for x in durum.get("_instagram", {}).get("kuyruk", []) if x["id"] == parca[2]), None)
                    if q and q.get("onay") == "bekliyor":
                        q["onay"] = "onaylandi" if parca[1] == "yay" else "reddedildi"
                        sonuc = ("✅ Onaylandı: bir sonraki çalıştırmada (15 dk içinde) Instagram'a gönderilecek."
                                 if parca[1] == "yay" else "Atlandı; bu gönderi yayımlanmayacak.")
                    else:
                        sonuc = "Bu gönderi artık kuyrukta değil."
                    _api(token, "answerCallbackQuery", {"callback_query_id": c["id"], "text": sonuc[:180]})
                    msg = c.get("message") or {}
                    if msg.get("message_id"):
                        _api(token, "editMessageReplyMarkup", {"chat_id": msg["chat"]["id"], "message_id": msg["message_id"],
                                                               "reply_markup": {"inline_keyboard": []}})
                        _api(token, "sendMessage", {"chat_id": yonetici, "text": sonuc, "reply_to_message_id": msg["message_id"]})
                    continue
                oneri = kay["oneriler"].get(parca[2]) if len(parca) == 3 else None
                sonuc = "Bu öneri artık geçerli değil."
                if oneri and oneri.get("durum") == "bekliyor":
                    if parca[1] == "onay":
                        for i in oneri["ids"]:
                            if i in haberler and veri["etiketler"].get(i, {}).get("tur") != "yanlis":
                                h = haberler[i]
                                veri["etiketler"][i] = {"tur": oneri.get("tur", "celiskili"), "aciklama": oneri["aciklama"], "kanit": [],
                                                        "kaynak": h.get("kaynak"), "baslik": h.get("baslik_tr") or h.get("baslik_orj"),
                                                        "tarih": simdi.isoformat(), "kim": "yonetici"}
                        oneri["durum"], sonuc = "onaylandi", ETIKET.get(oneri.get("tur", "celiskili")) + " etiketi eklendi."
                        degisti = True
                    else:
                        oneri["durum"], sonuc = "reddedildi", "Öneri reddedildi; etiket eklenmedi."
                _api(token, "answerCallbackQuery", {"callback_query_id": c["id"], "text": sonuc[:180]})
                msg = c.get("message") or {}
                if msg.get("message_id"):
                    _api(token, "editMessageReplyMarkup", {"chat_id": msg["chat"]["id"], "message_id": msg["message_id"],
                                                           "reply_markup": {"inline_keyboard": []}})
                    _api(token, "sendMessage", {"chat_id": yonetici, "text": sonuc, "reply_to_message_id": msg["message_id"]})
            elif "message" in u:
                mm = u["message"]
                if str(mm.get("chat", {}).get("id")) != yonetici or str(mm.get("from", {}).get("id")) != yonetici:
                    continue
                metin = mm.get("text") or ""
                if metin.startswith("/"):
                    yanit = _komut(metin, yonetici, kok, veri, haberler, kaynaklar, simdi, site)
                    degisti = True
                    _api(token, "sendMessage", {"chat_id": yonetici, "text": yanit, "parse_mode": "HTML",
                                                "link_preview_options": {"is_disabled": True}})
        # 2) Yeni çelişki önerileri
        gonderilen = 0
        for o, c, tur in [(o, o.get("celiski"), "celiskili") for o in olaylar] + [(o, o.get("dogrulanmamis"), "dogrulanmamis") for o in olaylar]:
            if not c or gonderilen >= ONERI_SINIRI:
                continue
            sid = hashlib.sha1((tur + ",".join(sorted(c["ids"]))).encode()).hexdigest()[:10]
            if sid in kay["oneriler"]:
                continue
            satirlar = [_haber_satiri(haberler[i], kaynaklar) for i in c["ids"] if i in haberler]
            baslik_ = "⚠️ <b>Çelişki önerisi</b>" if tur == "celiskili" else "🔍 <b>Doğrulanmamış iddia önerisi</b>"
            metin = (baslik_ + "\n\n<b>" + _e(o.get("baslik")) + "</b>\n\n" + _e(c["aciklama"]) + "\n\n"
                     + "\n".join(satirlar) + (f'\n\n<a href="{site}#o-{o["haberler"][0]}">Kim nasıl yazdı →</a>' if site else "")
                     + "\n\nOnaylarsan bu haberlere " + ETIKET[tur] + " etiketi konur.")
            r = _api(token, "sendMessage", {"chat_id": yonetici, "text": metin[:4000], "parse_mode": "HTML",
                                            "link_preview_options": {"is_disabled": True},
                                            "reply_markup": {"inline_keyboard": [[
                                                {"text": "⚠️ Onayla", "callback_data": f"d:onay:{sid}"},
                                                {"text": "Reddet", "callback_data": f"d:red:{sid}"}]]}})
            if r is None:
                log(f"Doğrulama: öneri gönderilemedi ({SON_HATA}); bota özel mesajla /start yazılmış olmalı")
                break
            kay["oneriler"][sid] = {"ids": c["ids"], "aciklama": c["aciklama"], "tur": tur, "durum": "bekliyor", "t": simdi.isoformat()}
            gonderilen += 1
        if gonderilen:
            log(f"Doğrulama: {gonderilen} çelişki önerisi yöneticiye gönderildi")
    # Bir haftadan eski önerileri at
    sinir = (simdi - dt.timedelta(days=7)).isoformat()
    kay["oneriler"] = {i: v for i, v in kay["oneriler"].items() if v.get("t", "") >= sinir}
    if degisti or not os.path.isfile(os.path.join(kok, "data", "dogrulama.json")):
        _yaz(kok, veri)
    return veri
