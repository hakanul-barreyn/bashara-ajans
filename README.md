# ZBS

Mağrip’ten Körfez’e, Meşrik’ten Anadolu’ya ve Avrupa ile ABD’ye uzanan basını izleyen, haberleri Türkçe özetleyip harita üzerinde gösteren otomatik haber takip sitesi.

## Nasıl çalışır

| Parça | Ne yapar | Nerede |
|---|---|---|
| Kaynak listesi | 125 yayın organı: şehir, dil, sahiplik ve çizgi profili | `kaynaklar.json` |
| Toplayıcı | Her kaynağın haber site haritasını, RSS’ini ya da WordPress API’sini bulur; varsa Telegram kanalını da okur; ilgili haberleri Gemini’ye Türkçe özetletir | `toplayici/topla.py` |
| Konu filtresi | Hangi haberlerin özetleneceğini belirleyen kelime listesi (9 dil) | `toplayici/konular.py` |
| Zamanlayıcı | Toplayıcıyı 15 dakikada bir çalıştırıp sonucu depoya kaydeder | `.github/workflows/topla.yml` |
| Site | Harita, haber akışı, süzgeçler, arşiv tuşları ve kaynak profilleri | `index.html`, `kaynaklar.html`, `site/` |
| Veri | Son üç günün haberleri ve her kaynağın izleme durumu | `data/haberler.json`, `data/durum.json` |

Toplayıcı yalnızca Python’un standart kütüphanesini kullanır, `robots.txt` kurallarına uyar ve özet yazılan haberlerin ham metnini saklamaz. Sitede yalnızca Türkçe başlık, kendi cümlelerimizle yazılmış özet ve orijinal habere bağlantı yer alır.

## Kurulum

1. **Anahtar:** Settings → Secrets and variables → Actions → New repository secret. Ad: `GEMINI_API_KEY`, değer: Google AI Studio’dan aldığın anahtar.
2. **Site:** Settings → Pages → Source: “Deploy from a branch”, Branch: `main`, klasör: `/ (root)` → Save. Birkaç dakika sonra site `https://KULLANICIADI.github.io/DEPOADI/` adresinde açılır.
3. **İlk çalıştırma:** Actions sekmesi → “Haberleri topla” → Run workflow. Sonrasında kendiliğinden 15 dakikada bir çalışır.

## Ayarlar (isteğe bağlı)

Settings → Secrets and variables → Actions → **Variables** sekmesinden:

- `GEMINI_MODEL`: Kullanılacak modeli elle belirlemek için (örneğin bir Flash-Lite modeli). Boş bırakılırsa toplayıcı anahtarın erişebildiği en uygun Flash-Lite modelini kendisi seçer.
- `OZET_SINIRI`: Bir çalıştırmada yazılacak en fazla özet sayısı (varsayılan 45). Ücretsiz kota yetmezse düşür.

## Kaynak eklemek

`kaynaklar.json` dosyasına aynı biçimde bir kayıt ekle (`id` benzersiz olmalı). Toplayıcı bir sonraki çalıştırmada izleme yolunu kendisi arar. Telegram kanalını elle belirtmek için `"telegram": "kanaladi"` yaz.

## Sorun giderme

- **Bir kaynaktan haber gelmiyor:** Kaynaklar sayfasında o kaynağın “İzleme” satırına bak. “Yol bulunamadı” yazıyorsa site otomatik yolları kapatmış ya da bot engeli kullanıyor; Telegram kanalı eklemek çoğu zaman çözer.
- **Özetler gelmiyor:** Actions’taki son çalıştırmanın kaydında “Gemini kotası doldu” ya da “Gemini hatası” satırlarını ara. Kota dolduysa toplayıcı bir saat bekleyip kendisi yeniden dener.
