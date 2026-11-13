"""Media Cloud kapsam denetimi (elle çalıştırılır: .github/workflows/mediacloud.yml).

1) Yayın listemizdeki (kaynaklar.json) her yayını Media Cloud'un kaynak dizininde alan adıyla arar.
2) Bulunan yayınların Ekim 2023'ten bugüne aylık toplam haber sayısını çeker (sorgu "*").
Çıktı: cikti/mc-kapsam.json  (yayın → Media Cloud kaynak no, ad, dil, aylık toplam haber)

Media Cloud'un sınırı dakikada 10 istek; istemci kendi bekler. API anahtarı MEDIACLOUD_API_KEY ortam değişkeninden.
"""
import datetime as dt
import json
import os
import sys
import time
from urllib.parse import urlparse

import mediacloud.api

BAS, SON = dt.date(2023, 10, 1), dt.date.today() - dt.timedelta(days=1)


def alan(url):
    h = urlparse(url).netloc.lower()
    return h[4:] if h.startswith("www.") else h


def main():
    anahtar = os.environ.get("MEDIACLOUD_API_KEY")
    if not anahtar:
        sys.exit("MEDIACLOUD_API_KEY yok")
    D, S = mediacloud.api.DirectoryApi(anahtar), mediacloud.api.SearchApi(anahtar)
    D.user_profile()   # anahtarı sına (hesap bilgisi kayda yazılmaz)
    print("Anahtar geçerli")
    K = json.load(open("kaynaklar.json", encoding="utf-8"))
    os.makedirs("cikti", exist_ok=True)
    yol = "cikti/mc-kapsam.json"
    sonuc = json.load(open(yol)) if os.path.exists(yol) else {}
    for k in K:
        kid = str(k["id"])
        if kid in sonuc and "mc" in sonuc[kid]:
            continue
        a = alan(k.get("url") or "")
        if not a:
            continue
        try:
            r = D.source_list(name=a, platform="online_news", limit=10)
        except Exception as e:   # noqa: BLE001
            print("dizin hatası", a, e)
            time.sleep(10)
            continue
        adaylar = r.get("results") or []
        # alan adı tam eşleşen kaynak, yoksa ilk sonuç
        sec = [s for s in adaylar if (s.get("name") or "").lower().lstrip("w.") in (a, "www." + a) or (s.get("name") or "").lower() == a]
        s = (sec or adaylar or [None])[0]
        sonuc[kid] = {"ad": k["ad"], "alan": a, "dil": k.get("dil"),
                      "mc": ({"id": s["id"], "ad": s.get("name"), "etiket": s.get("label"), "dil": s.get("primary_language"),
                              "ulke": s.get("pub_country"), "adaylar": [x.get("name") for x in adaylar[:5]]} if s else None)}
        print(k["ad"], "→", s and s.get("name"), s and s["id"])
        json.dump(sonuc, open(yol, "w"), ensure_ascii=False, indent=1)
    # aylık toplam haber: kaynakları 25'erli gruplarla
    ids = [v["mc"]["id"] for v in sonuc.values() if v.get("mc")]
    aylik = {}
    for i in range(0, len(ids), 25):
        grup = ids[i:i + 25]
        satirlar = None
        for sorgu, aralik in (("*", "month"), ("*", None), ("the OR a OR في OR של OR ve", "month")):
            try:
                satirlar = S.stories_by_source_over_interval(sorgu, BAS, SON, source_ids=grup, interval=aralik) if aralik else \
                    S.stories_by_source_over_interval(sorgu, BAS, SON, source_ids=grup)
                break
            except Exception as e:   # noqa: BLE001
                print("sayım hatası", sorgu, aralik, str(e)[:300])
        if i == 0:
            print("örnek satır:", (satirlar or [])[:3])
        for x in satirlar or []:
            ad = x.get("media_name") or x.get("name") or x.get("source")
            kova = str(x.get("bucket") or x.get("interval") or x.get("date") or "")[:7]
            aylik.setdefault(ad, {})[kova] = x.get("total_stories", x.get("count"))
        print("sayım", i + len(grup), "/", len(ids))
    for v in sonuc.values():
        if v.get("mc"):
            v["aylik"] = aylik.get(v["mc"]["ad"], {})
    json.dump(sonuc, open(yol, "w"), ensure_ascii=False, indent=1)
    bulunan = sum(1 for v in sonuc.values() if v.get("mc"))
    print(f"Bitti: {bulunan}/{len(sonuc)} yayın Media Cloud'da bulundu")


if __name__ == "__main__":
    main()
