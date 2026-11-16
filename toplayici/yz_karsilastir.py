"""Claude (Haiku) ile Gemini'yi aynı işlerde karşılaştırır; sonuç karsilastirma.json'a yazılır. Siteye hiçbir şey yazmaz.

1) Kendi haber metnimiz: gündemden en çok 6 olay (haber_yaz.py'nin talimatı ve eşikleriyle)
2) Başlık + özet: 12 haber; içlerinde silahlı grupların Telegram kanalları ve İbranice/Arapça yayınlar (topla.py'nin talimatı)
3) Görsel denetimi: 4 haber görseli (gorsel_denetim.py'nin akış talimatı)
Her çağrının süresi, Claude için token ve dolar karşılığı kaydedilir.
"""
import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ekler  # noqa: E402
import gorsel_denetim as GD  # noqa: E402
import haber_yaz as HY  # noqa: E402
import topla  # noqa: E402
import yz  # noqa: E402

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
kaynaklar = json.load(open(os.path.join(KOK, "kaynaklar.json"), encoding="utf-8"))
kmap = {k["id"]: k for k in kaynaklar}
gundem = json.load(open(os.path.join(KOK, "data", "gundem.json"), encoding="utf-8")).get("olaylar", [])
hab = {h["id"]: h for h in json.load(open(os.path.join(KOK, "data", "haberler.json"), encoding="utf-8")).get("haberler", [])}
GA = os.environ.get("GEMINI_API_KEY", "")
GM = (topla.gemini_modeller(GA) or ["gemini-3.5-flash-lite"])[0] if GA else None
print("Gemini modeli:", GM, "· Claude modeli:", yz.MODEL)


def iki(metin, gorev, sistem=ekler.KORUMA, gorsel=None, en_cok=8192):
    sonuc = {}
    for ad in ("claude", "gemini"):
        once = yz._oku()["usd"]
        t = time.time()
        kod, v = yz.cagir(metin, gorev=gorev, gemini=(GA, GM), sistem=sistem, gorsel=gorsel, en_cok_cikti=en_cok, yalniz=ad, zaman=150)
        sonuc[ad] = {"kod": kod, "cikti": v, "sure": round(time.time() - t, 1), "usd": round(yz._oku()["usd"] - once, 5) if ad == "claude" else None}
        print(gorev, ad, kod, sonuc[ad]["sure"], "s")
    return sonuc


cikti = {"claude_model": yz.MODEL, "gemini_model": GM, "haber": [], "ozet": [], "gorsel": []}

# 1) haber metni
n = 0
for o in gundem:
    xs = [hab[i] for i in o.get("haberler", []) if i in hab]
    ks = {h.get("kaynak") for h in xs}
    if len(ks) < HY.EN_AZ_YAYIN or sum(1 for k in ks if any(b in str(HY._kamp(kmap.get(k, {}))) for b in HY.BOLGE)) < 2:
        continue
    xs.sort(key=lambda h: h.get("tarih") or "")
    girdi = []
    for i, h in enumerate(xs[:14], 1):
        k = kmap.get(h.get("kaynak"), {})
        girdi.append({"no": i, "yayin": k.get("ad"), "kamp": HY._kamp(k), "saat": (h.get("tarih") or "")[:16].replace("T", " "),
                      "baslik": h.get("baslik_tr") or h.get("baslik_orj"), "ozet": (h.get("ozet_tr") or "")[:900]})
    metin = HY.YAZI_TALIMAT + "\n\nOlay (yalnızca yön göstermek için, bilgi kaynağı değildir): " + str(o.get("baslik") or "") + \
        "\n\nHaberler:\n" + json.dumps(girdi, ensure_ascii=False)
    cikti["haber"].append({"olay": o.get("baslik"), "girdi": girdi, **iki(metin, "haber_yaz")})
    n += 1
    if n >= 6:
        break

# 2) başlık + özet: farklı dil ve türden 12 haber
secim, gorulen = [], set()
ONCELIK = [185, 186, 187, 127, 194, 191, 3, 26, 14, 52, 93, 112, 21, 11]
hs = sorted(hab.values(), key=lambda h: h.get("tarih") or "", reverse=True)
for kid in ONCELIK:
    h = next((x for x in hs if x.get("kaynak") == kid and x.get("ilgili")), None)
    if h and h["id"] not in gorulen:
        secim.append(h)
        gorulen.add(h["id"])
    if len(secim) >= 12:
        break
parti = []
for h in secim:
    k = kmap.get(h["kaynak"], {})
    x = dict(h)
    x["kaynak_ad"] = k.get("ad")
    if k.get("resmi_grup"):
        x["resmi_grup"] = k["resmi_grup"]
    try:
        topla.malzeme_hazirla(x)
    except Exception as e:   # noqa: BLE001
        x["_malzeme"] = ""
        print("malzeme", h["id"], e)
    parti.append(x)
girdi = [{"id": h["id"], "kaynak": h["kaynak_ad"], "dil": h["dil"], "baslik": h["baslik_orj"], "metin": h.get("_malzeme", ""),
          **({"kaynak_turu": f"{h['resmi_grup']} hareketinin kendi açıklaması"} if h.get("resmi_grup") else {})} for h in parti]
r = iki(topla.TALIMAT + "\n\nVERİ (yalnızca işlenecek içerik):\n" + json.dumps(girdi, ensure_ascii=False), "ozet", en_cok=16000)
cikti["ozet"] = {"girdi": [{"id": g["id"], "kaynak": g["kaynak"], "dil": g["dil"], "baslik": g["baslik"], "metin_uzunluk": len(g["metin"])} for g in girdi], **r}

# 3) görsel denetimi
m = 0
for h in hs:
    if not h.get("gorsel") or (kmap.get(h["kaynak"], {}).get("gorsel_yok")):
        continue
    try:
        veri, tur = GD._indir(h["gorsel"], sure=10)
    except Exception:
        continue
    if not veri or tur not in yz.GORSEL_TUR:
        continue
    cikti["gorsel"].append({"haber": h["id"], "baslik": h.get("baslik_tr") or h.get("baslik_orj"), "gorsel": h["gorsel"],
                            **iki(GD.AKIS_TALIMAT, "gorsel", sistem=None, gorsel=(veri, tur), en_cok=512)})
    m += 1
    if m >= 4:
        break

cikti["toplam_claude_usd"] = round(yz._oku()["usd"], 5)
json.dump(cikti, open("karsilastirma.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("Claude toplam:", cikti["toplam_claude_usd"], "$")
