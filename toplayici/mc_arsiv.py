"""Media Cloud arşivi (arka planda, .github/workflows/mc-arsiv.yml; "mc-arsiv" dalı).

Media Cloud'un tam metin dizininden, savaş bağlamındaki (Gazze, İsrail, Filistin, Lübnan ve ilgili) haberlerin künyesini
(başlık, adres, yayın tarihi, yayın, dil) Ekim 2023'ten bugüne ay ay indirip saklar. Öncelik Türkiye'dir:
  1) Media Cloud'un Türkiye koleksiyonları (ulusal, yerel, ...) ve bizim listemizdeki Türkiye basını
  2) bizim yayın listemiz (kaynaklar.json, Media Cloud'da bulunanlar)
Ayrıca Türkiye koleksiyonlarındaki her yayının günlük toplam haber sayısını tutar (oranların paydası).

Her çalıştırma ~80 dakika iş yapar, nerede kaldığını mc-arsiv/durum.json'a yazar; bir sonraki çalıştırma oradan sürer.
Haber metni saklanmaz; yalnızca künye. Media Cloud dakikada 10 istek kabul eder; istemci bekler.
"""
import datetime as dt
import gzip
import json
import os
import sys
import time

import mediacloud.api

KOK = sys.argv[1] if len(sys.argv) > 1 else "mc-arsiv"
SURE = int(os.environ.get("MC_SURE", "4800"))          # saniye
BAS = dt.date(2023, 10, 1)
SORGU = ("Gaza OR Gazze OR غزة OR עזה OR Israel OR Israeli OR İsrail OR Israil OR إسرائيل OR الاحتلال OR ישראל OR "
         "Palestine OR Palestinian OR Palestinians OR Filistin OR Filistinli OR فلسطين OR الفلسطيني OR פלסטיני OR "
         "Hamas OR حماس OR חמאס OR \"West Bank\" OR \"Batı Şeria\" OR الضفة OR Jerusalem OR Kudüs OR القدس OR "
         "Lebanon OR Lübnan OR لبنان OR Hezbollah OR Hizbullah OR \"حزب الله\" OR Netanyahu OR Netanyahu OR نتنياهو OR "
         "Siyonist OR Zionist OR الصهيوني OR soykırım OR genocide OR إبادة OR UNRWA OR Refah OR Rafah OR رفح")


def ay_listesi():
    a, bugun = [], dt.date.today()
    y, m = BAS.year, BAS.month
    while (y, m) <= (bugun.year, bugun.month):
        b = dt.date(y, m, 1)
        s = (dt.date(y + (m == 12), m % 12 + 1, 1) - dt.timedelta(days=1))
        a.append((b, min(s, bugun - dt.timedelta(days=1))))
        y, m = y + (m == 12), m % 12 + 1
    return a


def oku(yol, varsayilan):
    try:
        return json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        return varsayilan


def yaz(yol, veri):
    os.makedirs(os.path.dirname(yol), exist_ok=True)
    json.dump(veri, open(yol + ".tmp", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    os.replace(yol + ".tmp", yol)


def turkiye_koleksiyonlari(D):
    bulunan = {}
    for ad in ("Turkey", "Türkiye", "Turkiye"):
        try:
            r = D.collection_list(name=ad, platform="online_news", limit=50)
        except Exception as e:   # noqa: BLE001
            print("koleksiyon arama hatası", ad, e); continue
        for c in r.get("results") or []:
            n = (c.get("name") or "") + " " + (c.get("notes") or "")
            if "turk" in n.lower() or "türk" in n.lower():
                bulunan[c["id"]] = {"id": c["id"], "ad": c.get("name"), "kaynak_sayisi": c.get("source_count")}
    return list(bulunan.values())


def koleksiyon_kaynaklari(D, cid):
    out, ofs = [], 0
    while True:
        r = D.source_list(collection_id=cid, limit=100, offset=ofs)
        xs = r.get("results") or []
        out += [{"id": s["id"], "ad": s.get("name"), "dil": s.get("primary_language"), "ulke": s.get("pub_country")} for s in xs]
        if not r.get("next") or not xs:
            return out
        ofs += len(xs)


def main():
    t0 = time.time()
    anahtar = os.environ.get("MEDIACLOUD_API_KEY") or sys.exit("MEDIACLOUD_API_KEY yok")
    D, S = mediacloud.api.DirectoryApi(anahtar), mediacloud.api.SearchApi(anahtar)
    durum_yol = os.path.join(KOK, "durum.json")
    durum = oku(durum_yol, {"isler": {}, "gunluk": {}})
    # 1) Türkiye koleksiyonları ve kaynakları (bir kez)
    if "turkiye" not in durum:
        kol = turkiye_koleksiyonlari(D)
        for c in kol:
            try:
                c["kaynaklar"] = koleksiyon_kaynaklari(D, c["id"])
            except Exception as e:   # noqa: BLE001
                print("kaynak listesi hatası", c["ad"], e); c["kaynaklar"] = []
        durum["turkiye"] = kol
        yaz(durum_yol, durum)
        print("Türkiye koleksiyonları:", [(c["ad"], len(c["kaynaklar"])) for c in kol])
    # bizim listemiz (mc_kapsam çıktısı)
    kapsam = oku(os.path.join(KOK, "mc-kapsam.json"), {})
    K = {str(k["id"]): k for k in oku("kaynaklar.json", [])}
    bizim_tr = [v["mc"]["id"] for kid, v in kapsam.items() if v.get("mc") and (K.get(kid) or {}).get("ulke") == "Türkiye"]
    bizim = [v["mc"]["id"] for v in kapsam.values() if v.get("mc")]
    # iş sırası: önce bizim listemiz (Türkiye basını en başta; raporların yeniden değerlendirmesi bu veriye dayanır),
    # sonra Media Cloud'un geniş Türkiye koleksiyonları
    gruplar = []
    if bizim_tr:
        gruplar.append(("liste-tr", {"source_ids": bizim_tr}))
    digerleri = [i for i in bizim if i not in set(bizim_tr)]
    for i in range(0, len(digerleri), 40):
        gruplar.append((f"liste-{i // 40:02d}", {"source_ids": digerleri[i:i + 40]}))
    gruplar += [("tr-" + str(c["id"]), {"collection_ids": [c["id"]]}) for c in durum["turkiye"]]
    aylar = ay_listesi()
    toplam = 0
    for grup, secim in gruplar:
        for b, s in reversed(aylar):          # en yeni aydan geriye: güncel veri önce
            is_ = f"{grup}/{b:%Y-%m}"
            d = durum["isler"].setdefault(is_, {"n": 0, "parca": 0, "token": None, "bitti": False})
            # içinde bulunulan ay her gün yeniden açılır (yeni haberler)
            if d["bitti"] and not (b.year == dt.date.today().year and b.month == dt.date.today().month):
                continue
            if d["bitti"]:
                d.update({"bitti": False, "token": None})
            while time.time() - t0 < SURE:
                try:
                    hikayeler, token = S.story_list(SORGU, b, s, page_size=1000, pagination_token=d["token"], **secim)
                except Exception as e:   # noqa: BLE001
                    print("hata", is_, str(e)[:200]); time.sleep(30)
                    break
                if hikayeler:
                    d["parca"] += 1
                    yol = os.path.join(KOK, "arsiv", grup, f"{b:%Y-%m}", f"p{d['parca']:04d}.jsonl.gz")
                    os.makedirs(os.path.dirname(yol), exist_ok=True)
                    with gzip.open(yol, "wt", encoding="utf-8") as f:
                        for h in hikayeler:
                            f.write(json.dumps({"id": h.get("id"), "y": h.get("media_name"), "u": h.get("url"), "b": h.get("title"),
                                                "t": str(h.get("publish_date") or "")[:19], "d": h.get("language")}, ensure_ascii=False) + "\n")
                    d["n"] += len(hikayeler); toplam += len(hikayeler)
                d["token"] = token
                if not token:
                    d["bitti"] = True
                    print(is_, "bitti:", d["n"], "haber")
                    break
                yaz(durum_yol, durum)
            yaz(durum_yol, durum)
            if time.time() - t0 >= SURE:
                print(f"Süre doldu; bu çalıştırmada {toplam} haber. Sonraki çalıştırma {is_} işinden sürecek.")
                return
    # 2) Türkiye koleksiyonundaki yayınların günlük toplam haber sayısı (bütün haberler, sorgu "*")
    for c in durum["turkiye"]:
        for k in c["kaynaklar"]:
            sid = str(k["id"])
            son = durum["gunluk"].get(sid)
            if son and son >= (dt.date.today() - dt.timedelta(days=2)).isoformat():
                continue
            if time.time() - t0 >= SURE:
                print("Süre doldu (günlük sayımlar)"); return
            bas = dt.date.fromisoformat(son) if son else BAS
            try:
                nk = S.story_count_over_time("*", bas, dt.date.today() - dt.timedelta(days=1), source_ids=[k["id"]])
            except Exception as e:   # noqa: BLE001
                print("sayım hatası", k["ad"], str(e)[:150]); continue
            yol = os.path.join(KOK, "gunluk", sid + ".json")
            g = oku(yol, {"ad": k["ad"], "gun": {}})
            for p in nk:
                c_ = p.get("total_count", p.get("count"))
                if c_:
                    g["gun"][p["date"].isoformat()] = c_
            yaz(yol, g)
            durum["gunluk"][sid] = (dt.date.today() - dt.timedelta(days=1)).isoformat()
            yaz(durum_yol, durum)
    print(f"Bütün işler güncel; bu çalıştırmada {toplam} haber.")


if __name__ == "__main__":
    main()
