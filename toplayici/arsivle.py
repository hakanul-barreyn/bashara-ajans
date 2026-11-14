"""İnternet Arşivi'ne (Wayback Machine, Save Page Now 2) otomatik kayıt.

Sıra (önce kanıtlar):
  1. Raporlarda ve olay sayfalarında kanıt olarak gösterilen haberler (data/bulten/alisma.json → olay örnekleri,
     lider örnekleri), Gündem karşılaştırmalarındaki haberler (data/gundem.json → haberler.json'daki adresler).
  2. Kendi sayfalarımız: ana sayfa, raporlar, Almanak, Ebu Safiye sayfası (günde bir), yeni haber sayfaları (data/h/).
Kayıt durumu data/arsiv-kayit.json'da; bir adres bir kez gönderilir (kendi sayfalarımız günde bir kez).
Hız: İnternet Arşivi kâr amacı gütmeyen bir kuruluş; çalıştırma başına en çok 15, günde en çok 400 istek, 5 sn arayla.
Anahtarlar yalnızca GitHub Secrets'ta: IA_ERISIM (access key), IA_GIZLI (secret key). Yoksa hiçbir şey yapılmaz.
Okurlar için arşiv bağlantısı: https://web.archive.org/web/<adres> (en son kopyaya gider).
"""
import datetime as dt
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

SITE = "https://hakanul-barreyn.github.io/bashara-ajans/"
KENDI = ["", "raporlar.html", "almanak.html", "olaylar.html", "kimin.html", "liderler.html", "rapor.html", "ebu-safiye.html", "isimler.html"]
CALISMA_BASINA, GUNLUK = 12, 1000
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
ATLA = ("news.google.com", "t.me/", "telegram.", "facebook.com", "x.com/", "twitter.com/")


def _oku(yol, vars_):
    try:
        return json.load(open(yol, encoding="utf-8"))
    except (OSError, ValueError):
        return vars_


def _gonder(url, erisim, gizli):
    veri = urllib.parse.urlencode({"url": url, "skip_first_archive": "1", "if_not_archived_within": "30d"}).encode()
    istek = urllib.request.Request("https://web.archive.org/save", data=veri, method="POST",
                                   headers={"Authorization": f"LOW {erisim}:{gizli}", "Accept": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=40) as r:
        return json.loads(r.read() or b"{}")


# kanıt dosyaları, öncelik sırasıyla: raporlar ve karneler, olay örnekleri, liderlerin sözleri ve konuşmaları, gündem,
# sonra Almanak bültenleri (yıllık, aylık, haftalık; yeniden eskiye). Dosyalardaki bütün haber adresleri toplanır.
KANIT = [("data/bulten/rapor-*.json", 0), ("data/bulten/kimin.json", 0), ("data/karne.json", 0), ("data/kanit.json", 0),
         ("data/bulten/alisma.json", 1), ("data/bulten/liderler.json", 2), ("data/konusma/*.json", 2),
         ("data/bulten/yillik/*.json", 4), ("data/bulten/aylik/*.json", 5), ("data/bulten/haftalik/*.json", 6)]
GORSEL = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg")
ALAN_DISI = ("wikimedia.org", "wikipedia.org", "archive.org", "githubusercontent.com", "hakanul-barreyn.github.io", "huggingface.co")


def _adresler(x, out):
    """JSON içindeki haber adreslerini sırasıyla toplar (görseller ve başvuru siteleri hariç)."""
    if isinstance(x, dict):
        for v in x.values():
            _adresler(v, out)
    elif isinstance(x, list):
        for v in x:
            _adresler(v, out)
    elif isinstance(x, str) and x.startswith(("http://", "https://")) and " " not in x:
        yol = urllib.parse.urlsplit(x).path.lower()
        if not yol.endswith(GORSEL) and not any(a in x for a in ALAN_DISI):
            out.append(x)


def adaylar(kok, simdi):
    import glob
    a = []
    # olay örnekleri yeni olaylar önce (alisma.json eskisi gibi)
    al = _oku(os.path.join(kok, "data", "bulten", "alisma.json"), {})
    for o in reversed(al.get("olaylar", [])):
        a += [m.get("url") for m in o.get("ornek", []) if m.get("url")]
    hab = {h["id"]: h for h in _oku(os.path.join(kok, "data", "haberler.json"), {}).get("haberler", [])}
    gundem = []
    for o in _oku(os.path.join(kok, "data", "gundem.json"), {}).get("olaylar", []):
        gundem += [hab[i].get("url") for i in o.get("haberler", []) if i in hab and hab[i].get("url")]
        if (o.get("sayfa") or "").startswith(("data/h/", "h/")):
            gundem.append(SITE + o["sayfa"].replace("data/h/", "h/", 1))
    kat = {}
    for desen, oncelik in KANIT:
        for f in sorted(glob.glob(os.path.join(kok, desen)), reverse=True):     # yeni dosya önce
            out = []
            _adresler(_oku(f, {}), out)
            kat.setdefault(oncelik, []).extend(out)
    sira = kat.get(0, []) + a + kat.get(1, []) + kat.get(2, []) + gundem
    for k in sorted(x for x in kat if x > 2):
        sira += kat[k]
    bugun = simdi.date().isoformat()
    kendi = [(SITE + k, bugun) for k in KENDI]
    return [u for u in sira if u and u.startswith("http") and not any(x in u for x in ATLA)], kendi


def durum_sor(d, erisim, gizli, en_cok=20, log=print):
    """Gönderilmiş işlerin sonucunu sorar; başarılıysa kopyanın zaman damgasını yazar (kalıcı, alıntılanabilir bağlantı için)."""
    bak = [(u, v) for u, v in d["adres"].items() if v.get("job") and not v.get("ts") and not v.get("son")][:en_cok]
    n = 0
    for u, v in bak:
        try:
            istek = urllib.request.Request("https://web.archive.org/save/status/" + v["job"],
                                           headers={"Authorization": f"LOW {erisim}:{gizli}", "Accept": "application/json", "User-Agent": UA})
            with urllib.request.urlopen(istek, timeout=20) as r:
                c = json.load(r)
        except Exception:   # noqa: BLE001
            continue
        if c.get("status") == "success" and c.get("timestamp"):
            v["ts"] = c["timestamp"]; n += 1
        elif c.get("status") == "error":
            v["son"] = (c.get("status_ext") or "error")[:40]
        time.sleep(1)
    if bak:
        log(f"İnternet Arşivi: {len(bak)} işin durumu soruldu, {n} kopya doğrulandı")


def calistir(kok, simdi, log=print):
    erisim, gizli = os.environ.get("IA_ERISIM", "").strip(), os.environ.get("IA_GIZLI", "").strip()
    if not (erisim and gizli):
        log("İnternet Arşivi: IA_ERISIM / IA_GIZLI yok; arşivleme atlandı")
        return
    yol = os.path.join(kok, "data", "arsiv-kayit.json")
    d = _oku(yol, {"adres": {}, "gun": {}})
    bugun = simdi.date().isoformat()
    sayac = d["gun"].get(bugun, 0)
    kanit, kendi = adaylar(kok, simdi)
    sira = [(u, "k") for u in dict.fromkeys(kanit) if u not in d["adres"]]
    sira = [(u, "s") for u, g in kendi if (d["adres"].get(u) or {}).get("g") != g] + sira   # kendi sayfalarımız günde bir, önde
    durum_sor(d, erisim, gizli, log=log)
    gonderilen = hata = ust_uste = 0
    bitis = time.time() + 120        # arşiv yavaşken çalıştırmayı uzatmasın: en çok iki dakika
    for u, tur in sira:
        if gonderilen >= CALISMA_BASINA or sayac >= GUNLUK or time.time() > bitis:
            break
        try:
            c = _gonder(u, erisim, gizli)
            d["adres"][u] = {"t": simdi.isoformat()[:16], "g": bugun, "job": c.get("job_id"), "tur": tur}
            gonderilen += 1
            sayac += 1
            ust_uste = 0
        except urllib.error.HTTPError as e:
            hata += 1
            if e.code in (401, 403):
                log(f"İnternet Arşivi: yetki hatası ({e.code}); anahtarları kontrol edin")
                break
            if e.code == 429:
                log("İnternet Arşivi: hız sınırı; bu çalıştırma bitti")
                break
            d["adres"][u] = {"t": simdi.isoformat()[:16], "g": bugun, "hata": e.code, "tur": tur}
        except Exception as e:  # ağ hatası (arşiv bağlantıyı reddediyor): yavaşla, üst üste 3'te bu çalıştırmayı bitir
            hata += 1
            ust_uste += 1
            if ust_uste >= 3:
                log(f"İnternet Arşivi: bağlantı reddedildi ({e}); bu çalıştırmada duruldu, sonra devam edilecek")
                break
            time.sleep(8)
        time.sleep(4)
    d["gun"] = {g: n for g, n in d["gun"].items() if g >= (simdi.date() - dt.timedelta(days=7)).isoformat()}
    d["gun"][bugun] = sayac
    if len(d["adres"]) > 50000:
        d["adres"] = dict(list(d["adres"].items())[-40000:])
    with open(yol, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
    log(f"İnternet Arşivi: {gonderilen} sayfa gönderildi, {hata} hata, sırada {max(0, len(sira) - gonderilen)}; bugün {sayac}/{GUNLUK}")
