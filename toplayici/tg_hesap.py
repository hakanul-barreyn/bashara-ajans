"""Web önizlemesi kapalı Telegram kanallarını (t.me/s/… açılmayan) Telegram'ın resmî API'siyle (MTProto) okur.

Bir Telegram hesabıyla bağlanılır; hesabın uygulamada açabildiği her herkese açık kanal okunabilir. Yalnızca okur, hiçbir şey göndermez.
Gerekenler (GitHub Secrets):
  TELEGRAM_API_ID, TELEGRAM_API_HASH   my.telegram.org → API development tools
  TELEGRAM_OTURUM                     bir kerelik girişle üretilen oturum dizesi (hesaba tam erişim verir: yalnızca Secrets'ta durur)
Telethon kütüphanesi iş akışında kurulur. Bilgiler yoksa ya da bağlanılamazsa sessizce boş döner; web önizlemesi yolu sürer.
"""
import asyncio
import os
import re

SON_HATA = ""


def hazir():
    return all(os.environ.get(a, "").strip() for a in ("TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_OTURUM"))


def _temiz(s):
    return re.sub(r"\s+", " ", s or "").strip()


def topla(kanallar, sinir=4000, adet=40, log=print):
    """kanallar: kullanıcı adları. Döndürür: {kanal: [öge, …]} (cek_telegram ile aynı biçim)."""
    global SON_HATA
    if not kanallar or not hazir():
        return {}
    try:
        from telethon import TelegramClient
        from telethon.sessions import StringSession
    except ImportError:
        SON_HATA = "telethon kurulu değil"
        log("Telegram hesabı: telethon kurulu değil")
        return {}

    async def is_():
        sonuc = {}
        istemci = TelegramClient(StringSession(os.environ["TELEGRAM_OTURUM"].strip()), int(os.environ["TELEGRAM_API_ID"]),
                                 os.environ["TELEGRAM_API_HASH"].strip(), device_model="ZBS toplayici", app_version="1.0")
        await istemci.connect()
        try:
            if not await istemci.is_user_authorized():
                raise RuntimeError("oturum geçersiz ya da süresi dolmuş")
            for kanal in kanallar:
                try:
                    mesajlar = await istemci.get_messages(kanal, limit=adet)
                except Exception as e:
                    log(f"Telegram hesabı: @{kanal} okunamadı ({type(e).__name__})")
                    continue
                og = []
                for m in mesajlar:
                    metin = _temiz(getattr(m, "message", "") or "")[:sinir]
                    if len(metin) < 15:
                        continue
                    # mesajdaki bağlantılar (metin içi, gizli bağlantı, önizleme): yayının sitesindeki habere işaret edebilir
                    bag = re.findall(r"https?://[^\s)\]>\"']+", getattr(m, "message", "") or "")
                    for e in getattr(m, "entities", None) or []:
                        if getattr(e, "url", None):
                            bag.append(e.url)
                    wp = getattr(getattr(m, "media", None), "webpage", None)
                    if getattr(wp, "url", None):
                        bag.append(wp.url)
                    og.append({"url": f"https://t.me/{kanal}/{m.id}", "baslik": metin[:140] + ("…" if len(metin) > 140 else ""),
                               "tarih": m.date, "giris": metin, "telegram": True, "gorsel": None,
                               "baglantilar": [b for b in bag if "t.me/" not in b][:6]})
                sonuc[kanal] = og
        finally:
            await istemci.disconnect()
        return sonuc

    try:
        return asyncio.run(asyncio.wait_for(is_(), timeout=150))
    except Exception as e:
        SON_HATA = f"{type(e).__name__}: {str(e)[:120]}"
        log(f"Telegram hesabı: bağlanılamadı ({SON_HATA})")
        return {}
