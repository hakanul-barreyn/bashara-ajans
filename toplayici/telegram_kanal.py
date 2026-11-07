"""Sitenin Telegram kanalına otomatik gönderi.

Ne gönderilir (her çalıştırmada en çok GONDERI_SINIRI ileti):
  1) Gündem: en az 3 yayının yazdığı yeni olaylar; başlık, çerçeve notu, bakış dengesi ve sitedeki "kim nasıl yazdı" bağlantısı
  2) Analiz: öncelikli yayınların (Al-Akhbar, Haaretz…) Türkçe özeti yazılmış analizleri
  3) Almanak: kesinleşen haftalık / aylık / yıllık bülten

Gerekenler (GitHub ayarlarından):
  Secret   TELEGRAM_BOT_TOKEN   @BotFather'dan alınan bot anahtarı
  Variable TELEGRAM_KANAL       kanalın kullanıcı adı (@zbshaber gibi) ya da sayısal kimliği
Bot kanala "ileti gönderebilen yönetici" olarak eklenmiş olmalı.
Hiç gönderi yapılmamışsa ilk çalıştırma mevcut içeriği "gönderildi" sayar, eski haberleri kanala yığmaz.
"""
import datetime as dt
import html
import json
import os
import urllib.error
import urllib.request

import marka

GONDERI_SINIRI = 6
OLAY_EN_AZ_KAYNAK = 3
BAKIS = {"filistin": "Filistin bakışı", "aktarim": "aktarım", "israil": "İsrail / ABD bakışı"}


def site_adresi():
    depo = os.environ.get("GITHUB_REPOSITORY", "")
    return f"https://{depo.split('/')[0]}.github.io/{depo.split('/')[1]}/" if "/" in depo else "./"


def gonder(token, kanal, metin):
    """Döndürür: (başarılı mı, kota/geçici hata mı)"""
    govde = json.dumps({"chat_id": kanal, "text": metin, "parse_mode": "HTML",
                        "link_preview_options": {"is_disabled": False, "prefer_small_media": True}}).encode()
    istek = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=govde,
                                   headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(istek, timeout=20) as r:
            return json.loads(r.read()).get("ok", False), False
    except urllib.error.HTTPError as e:
        return False, e.code == 429
    except Exception:
        return False, True


def _e(s):
    return html.escape(str(s or ""), quote=False)


def olay_metni(o, haberler, kaynaklar, site):
    ks = {}
    sayi = {"filistin": 0, "aktarim": 0, "israil": 0}
    for i in o["haberler"]:
        h = haberler.get(i)
        if h:
            ks[h["kaynak"]] = kaynaklar.get(h["kaynak"], {}).get("ad", "")
        v = (o.get("bakislar") or {}).get(i)
        if v in sayi:
            sayi[v] += 1
    adlar = [a for a in ks.values() if a][:6]
    denge = " · ".join(f"{BAKIS[v]} {n}" for v, n in sayi.items() if n)
    ilk = o["haberler"][0]
    satir = [f"🟢 <b>Gündem</b> · {len(ks)} yayın", "", f"<b>{_e(o['baslik'])}</b>"]
    if o.get("not"):
        satir += ["", _e(o["not"][:420] + ("…" if len(o["not"]) > 420 else ""))]
    if denge:
        satir += ["", f"⚖️ {denge}"]
    satir += [f"🗞 {_e(', '.join(adlar))}{' …' if len(ks) > len(adlar) else ''}",
              "", f'<a href="{site}#o-{ilk}">Kim nasıl yazdı →</a>']
    return "\n".join(satir)


def analiz_metni(h, k, site):
    satir = [f"📝 <b>Analiz · {_e(k.get('ad'))}</b>", "", f"<b>{_e(h['baslik_tr'])}</b>", "", _e(h.get("ozet_tr")),
             "", f'<a href="{_e(h["url"])}">Yazıyı oku ↗</a> · <a href="{site}#h-{h["id"]}">{_e(marka.oku()["ad"])}’de</a>']
    return "\n".join(satir)


def bulten_metni(b, site):
    a = b.get("anlati") or {}
    ozet = (a.get("ozet") or [""])[0]
    satir = [f"📚 <b>Almanak · {_e(b['ad'])}</b>", "", f"<b>{_e(a.get('baslik') or b['ad'])}</b>"]
    if ozet:
        satir += ["", _e(ozet[:600] + ("…" if len(ozet) > 600 else ""))]
    satir += ["", f'<a href="{site}almanak.html#{b["tur"]}-{b["anahtar"]}">Bülteni oku →</a>']
    return "\n".join(satir)


def calistir(kok, durum, olaylar, haberler, kaynaklar_liste, simdi, log=print):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    kanal = os.environ.get("TELEGRAM_KANAL", "").strip()
    if not token or not kanal:
        return 0
    if kanal and not kanal.startswith(("@", "-")) and not kanal.lstrip("-").isdigit():
        kanal = "@" + kanal
    site = site_adresi()
    kaynaklar = {k["id"]: k for k in kaynaklar_liste}
    kay = durum.setdefault("_telegram", {"olay": [], "haber": {}, "bulten": {}})
    ilk_kez = not kay.get("basladi")

    # Aday iletiler, eskiden yeniye
    adaylar = []
    for o in olaylar:
        ids = set(o["haberler"])
        yayin = {haberler[i]["kaynak"] for i in ids if i in haberler}
        if len(yayin) < OLAY_EN_AZ_KAYNAK:
            continue
        if any(len(ids & set(g)) >= 0.5 * min(len(ids), len(g)) for _, g in kay["olay"]):
            continue
        adaylar.append(("olay", o.get("son") or "", o, None))
    for h in haberler.values():
        k = kaynaklar.get(h["kaynak"])
        if (k and k.get("oncelik") and h.get("nitelik") == "analiz" and h.get("ozet_tr") and h.get("ilgili")
                and h["id"] not in kay["haber"]):
            adaylar.append(("analiz", h["tarih"], h, k))
    klasor = os.path.join(kok, "data", "bulten")
    for tur in ("haftalik", "aylik", "yillik"):
        d = os.path.join(klasor, tur)
        if os.path.isdir(d):
            for ad in sorted(os.listdir(d)):
                if ad.endswith(".json") and f"{tur}/{ad}" not in kay["bulten"]:
                    try:
                        b = json.load(open(os.path.join(d, ad), encoding="utf-8"))
                    except Exception:
                        continue
                    if not b.get("taslak") and b.get("anlati"):
                        adaylar.append(("bulten", b["uretildi"], b, f"{tur}/{ad}"))
    adaylar.sort(key=lambda x: x[1])

    def isaretle(tur, nesne, ek):
        if tur == "olay":
            kay["olay"].append([simdi.isoformat(), list(nesne["haberler"])])
        elif tur == "analiz":
            kay["haber"][nesne["id"]] = simdi.isoformat()
        else:
            kay["bulten"][ek] = simdi.isoformat()

    gonderilen = 0
    if ilk_kez:
        for tur, _, nesne, ek in adaylar:
            isaretle(tur, nesne, ek)
        kay["basladi"] = simdi.isoformat()
        log(f"Telegram: kanal bağlandı; mevcut {len(adaylar)} içerik gönderilmiş sayıldı, bundan sonrakiler gönderilecek")
    else:
        for tur, _, nesne, ek in adaylar[-GONDERI_SINIRI:]:
            metin = (olay_metni(nesne, haberler, kaynaklar, site) if tur == "olay"
                     else analiz_metni(nesne, ek, site) if tur == "analiz" else bulten_metni(nesne, site))
            ok, gecici = gonder(token, kanal, metin)
            if ok:
                isaretle(tur, nesne, ek)
                gonderilen += 1
            elif gecici:
                break
            else:
                isaretle(tur, nesne, ek)   # kalıcı hata: aynı iletiyi tekrar tekrar deneme
                log(f"Telegram: bir ileti gönderilemedi ({tur})")
        # Sınırı aşan eski adaylar beklemesin
        for tur, _, nesne, ek in adaylar[:-GONDERI_SINIRI]:
            isaretle(tur, nesne, ek)
        log(f"Telegram: {gonderilen} ileti gönderildi")

    # Bir haftadan eski kayıtları at
    sinir = (simdi - dt.timedelta(days=7)).isoformat()
    kay["olay"] = [x for x in kay["olay"] if x[0] >= sinir]
    kay["haber"] = {i: t for i, t in kay["haber"].items() if t >= sinir}
    return gonderilen
