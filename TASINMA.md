# Taşınma ve kaçış planı

GitHub bir gün hesabı kapatırsa ya da başka bir yere geçmek gerekirse bu belge yeter. Anahtar değerleri burada yoktur, olmamalıdır.

## Ne nerede yedekli

| Ne | Nerede | Sıklık |
|---|---|---|
| Kod (`main`, tüm geçmiş) | Codeberg aynası (`CODEBERG_REPO`) | her gece, `yedek.yml` |
| Veri dalları (`veri`, `tarama`, `mediacloud`, `metin-sayim`, `konusma`, `gorsel`, `gorsel-bilgi`) | gizli Hugging Face veri seti, `yedek/<tarih>/` | haftada bir (pazar), son 4 hafta |
| Media Cloud arşivi, metin ölçümleri | aynı gizli veri seti (`gunluk/`, `metin/`) | zaten orada |
| Alan adı, DNS, e-posta yönlendirme | Cloudflare | GitHub'dan bağımsız |
| Anahtarlar | yalnızca GitHub Secrets | **yedeklenemez**, aşağıdan yeniden alınır |

## Kurulum (bir kez)

1. **Codeberg aynası.** codeberg.org'da hesap aç (kurumsal bir e-posta kullan, kişisel değil). Boş, gizli bir depo oluştur (ör. `alboroto`).
   Ayarlar > Uygulamalar > Erişim jetonu oluştur: yetki `write:repository`. GitHub deposunda:
   - Settings > Secrets and variables > Actions > **Secrets**: `CODEBERG_TOKEN` = jeton
   - aynı yerde **Variables**: `CODEBERG_REPO` = `kullanıcıadı/alboroto`
   Sonra Actions > Yedek > Run workflow. Codeberg'de kod görünmeli.
2. **İlk veri yedeği.** Actions > Yedek > Run workflow, "Veri dallarını da şimdi yedekle" işaretli.

## Anahtarlar: adı, ne işe yaradığı, nereden yeniden alınır

| Ad | Tür | Ne için | Nereden |
|---|---|---|---|
| `GEMINI_API_KEY` | secret | çeviri, özet, görsel denetimi | aistudio.google.com > Get API key |
| `GEMINI_MODEL`, `OZET_SINIRI` | variable | model adı, günlük özet sınırı | mevcut değeri not al |
| `TELEGRAM_BOT_TOKEN` | secret | kanala gönderim | Telegram'da @BotFather > /mybots > API Token (gerekirse Revoke ile yenile) |
| `TELEGRAM_KANAL` | variable | kanal adı (@...) | kanalın kendisi |
| `TELEGRAM_YONETICI` | secret | uyarıların gittiği sohbet kimliği | kendi Telegram kimliğin (@userinfobot) |
| `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` | secret | Telegram kanallarını okumak | my.telegram.org > API development tools |
| `TELEGRAM_OTURUM` | secret | okuyucu hesabın oturumu | `python toplayici/tg_oturum_uret.py` (kendi bilgisayarında) |
| `INSTAGRAM_TOKEN`, `INSTAGRAM_HESAP`, `IG_GUNLUK` | secret / variable | Instagram gönderimi | developers.facebook.com > uygulama > uzun ömürlü jeton |
| `IA_ERISIM`, `IA_GIZLI` | secret | kanıtları Internet Archive'a arşivleme | archive.org/account/s3.php |
| `MEDIACLOUD_API_KEY` | secret | Media Cloud sorguları | search.mediacloud.org > profil |
| `HF_TOKEN` | secret | gizli veri seti | huggingface.co/settings/tokens (yazma yetkili) |
| `HF_REPO` | variable | gizli veri setinin adı | `zbs-ajans/zbs-mc-arsiv` |
| `CODEBERG_TOKEN`, `CODEBERG_REPO` | secret / variable | kod aynası | yukarıda, adım 1 |

Eski bir anahtar sızdıysa ya da emin değilsen, yenisini alırken eskisini iptal et.

## GitHub kapanırsa: geri dönüş sırası

1. **Site ayakta kalsın.** Cloudflare > Workers & Pages > Pages > Codeberg ya da yerel kopyadan yükle. Yayımlanacak klasör: depo kökü (`index.html`, `site/`, `data/`).
   `data/` için en son veri yedeğini (`yedek/<tarih>/veri.tar.gz`) Hugging Face'ten indirip aç. Cloudflare'de alan adını bu Pages projesine bağla.
2. **Toplama işleri.** İki yol:
   - Codeberg/Forgejo Actions: `.github/workflows/*.yml` dosyaları büyük ölçüde aynen çalışır. Anahtarları yeni platformun gizli değişkenlerine gir.
   - Küçük bir sunucu (ayda 5-20 avro): Python 3.12 kur, depoyu çek, anahtarları `/etc/alboroto.env` dosyasına yaz (izin 600),
     her iş için bir systemd zamanlayıcısı kur (`topla` 15 dk, `metin_olcum` 3 sa, `mc_arsiv` günlük...). Zamanlamalar workflow dosyalarındaki `cron` satırlarında.
3. **Telegram oturumu.** Yeni bir IP'den bağlanınca Telegram oturumu düşürebilir: `tg_oturum_uret.py` ile yenisini üret.
4. **Kontrol.** Site açılıyor mu, `data/haberler.json` güncelleniyor mu, Telegram kanalına gönderi düşüyor mu.

## Sunucu yeri

Ayrıntı: proje belgesi `claude/hukuki-riskler.md`. Kısaca: yayıncının yaşadığı ülkenin hukuku sunucunun yerinden bağımsız uygulanır.
Taşınmak gerekirse AB ve İsviçre önerilmez (AB terör içeriği tüzüğünde bir saatte kaldırma emri; İsviçre'de 2025'ten beri Hamas yasağı).
İzlanda en uygun seçenek.
