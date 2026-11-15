"""Telegram oturum dizesini (TELEGRAM_OTURUM) yeniden üretir. Taşınmada ya da oturum düştüğünde bir kez, KENDİ bilgisayarında çalıştır:

    pip install telethon
    python toplayici/tg_oturum_uret.py

API kimliği ve hash'i my.telegram.org > API development tools'tan alınır. Telefon numarası ve Telegram'ın gönderdiği kod sorulur.
Çıkan uzun dize hesaba tam erişim verir: yalnızca Secrets'a (ya da yeni sunucudaki .env dosyasına) yapıştır, hiçbir yere kaydetme ya da gönderme.
"""
import getpass

from telethon.sessions import StringSession
from telethon.sync import TelegramClient

api_id = int(input("API ID: ").strip())
api_hash = getpass.getpass("API hash (ekranda görünmez): ").strip()
with TelegramClient(StringSession(), api_id, api_hash) as istemci:
    print("\nTELEGRAM_OTURUM değeri (tek satır, tamamını kopyala):\n")
    print(istemci.session.save())
    print("\nBu pencereyi kapatınca dize ekrandan gider. Telegram > Ayarlar > Cihazlar'da yeni oturumu görebilirsin.")
