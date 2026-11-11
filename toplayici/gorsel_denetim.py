"""Ana sayfa Gündem görselleri için denetim (data/gundem.json üzerinde, her görsel bir kez; data/gorsel-denetim.json önbellek).

Gemini'ye görselin kendisi gösterilir ve iki şey sorulur:
- Görsel bir yazı grafiği mi? (son dakika bandı, haber kartı, afiş, alıntı kartı, infografik: yazının ana öğe olduğu,
  tasarlanmış görseller). Öyleyse kullanılmaz; sıradaki aday görsele geçilir, hiçbiri uygun değilse görselsiz kalır.
  Fotoğrafta tabela, pankart, bayrak üzerindeki yazı sorun değildir.
- İnsanlar varsa kafalarının (yüzlerinin) görseldeki yeri: ekran kırpması kafaları kesmesin diye görsel o noktaya hizalanır.
Kullanım: topla.py her çalıştırmada denetle(kok, anahtar, model, log) çağırır; çalıştırma başına en çok 12 yeni görsel.
"""
import base64
import json
import os
import urllib.request

GEMINI = "https://generativelanguage.googleapis.com/v1beta"
UA = "zbs-toplayici (+https://hakanul-barreyn.github.io/bashara-ajans/)"
EN_COK = 12
TALIMAT = ("Bu bir haber görseli. Yalnızca JSON döndür: {\"yazi_grafik\": true|false, \"insan\": true|false, \"odak_x\": 0-100, \"odak_y\": 0-100}. "
           "yazi_grafik: yazının görselin ana öğesi olduğu TASARLANMIŞ bir grafik mi (son dakika / breaking bandı, haber kartı, afiş, "
           "alıntı kartı, infografik, logo ekranı)? Gerçek bir fotoğraftaki tabela, pankart ya da yazı bunu true yapmaz. "
           "odak_x, odak_y: insan varsa kafalarının (yüzlerinin) ortalama yeri, yüzde olarak (sol üst 0,0); insan yoksa görselin ana konusunun yeri.")


def _indir(url, sinir=3_000_000):
    istek = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(istek, timeout=20) as r:
        tur = (r.headers.get("Content-Type") or "image/jpeg").split(";")[0]
        veri = r.read(sinir + 1)
    if len(veri) > sinir or not tur.startswith("image/") or tur == "image/svg+xml":
        return None, None
    return veri, tur


def _sor(anahtar, model, veri, tur):
    govde = {"contents": [{"role": "user", "parts": [{"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}}, {"text": TALIMAT}]}],
             "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode(),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    with urllib.request.urlopen(istek, timeout=60) as r:
        v = json.loads(r.read())
    metin = v["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(metin)


def denetle(kok, anahtar, model, log=print, sayac=None):
    yol_g = os.path.join(kok, "data", "gundem.json")
    yol_o = os.path.join(kok, "data", "gorsel-denetim.json")
    try:
        g = json.load(open(yol_g, encoding="utf-8"))
    except (OSError, ValueError):
        return
    try:
        onb = json.load(open(yol_o, encoding="utf-8"))
    except (OSError, ValueError):
        onb = {}
    yeni = 0
    for o in g.get("olaylar", []):
        adaylar = o.get("adaylar") or ([[o["gorsel"], o.get("gorsel_kaynak")]] if o.get("gorsel") else [])
        secilen, yedek = None, None
        for url, kaynak in adaylar:
            k = onb.get(url)
            if k is None and anahtar and model and yeni < EN_COK:
                try:
                    veri, tur = _indir(url)
                    if veri:
                        if sayac:
                            sayac()
                        k = _sor(anahtar, model, veri, tur)
                        yeni += 1
                    else:
                        k = {"yazi_grafik": False, "indirilemedi": True}
                except Exception as e:
                    log(f"Görsel denetimi: {url[:80]}: {e}")
                    k = None
                if k is not None:
                    onb[url] = k
            if k is None:
                yedek = yedek or (url, kaynak, {"odak_x": 50, "odak_y": 25})   # henüz denetlenmedi: geçici olarak kullanılabilir
                continue
            if not k.get("yazi_grafik"):
                secilen = (url, kaynak, k)
                break
        secilen = secilen or yedek
        if secilen:
            o["gorsel"], o["gorsel_kaynak"] = secilen[0], secilen[1]
            try:
                o["odak"] = f'{max(0, min(100, int(secilen[2].get("odak_x", 50))))}% {max(0, min(100, int(secilen[2].get("odak_y", 35))))}%'
            except (TypeError, ValueError):
                o["odak"] = "50% 35%"
        elif adaylar:
            o["gorsel"], o["gorsel_kaynak"] = None, None     # bütün adaylar yazı grafiği ya da henüz denetlenmedi
    if len(onb) > 3000:
        onb = dict(list(onb.items())[-2000:])
    with open(yol_o, "w", encoding="utf-8") as f:
        json.dump(onb, f, ensure_ascii=False, separators=(",", ":"))
    with open(yol_g, "w", encoding="utf-8") as f:
        json.dump(g, f, ensure_ascii=False, separators=(",", ":"))
    if yeni:
        log(f"Görsel denetimi: {yeni} yeni görsel")
