"""Yapay zekâ ara katmanı: bütün model çağrıları buradan geçer.

Sağlayıcı sırası: YZ_SAGLAYICI=anthropic ve ANTHROPIC_API_KEY varsa önce Claude (YZ_MODEL, öntanımlı claude-haiku-5-5),
o hata verirse ya da bütçe dolarsa Gemini (çağıranın verdiği anahtar ve model; ücretsiz katman). YZ_SAGLAYICI boşsa
eskisi gibi yalnızca Gemini kullanılır.

Harcama defteri: data/yz-harcama.json. Her Claude çağrısının gerçek token sayısı (API'nin bildirdiği) ve dolar karşılığı
gün gün (UTC) tutulur. Günlük tavan YZ_GUNLUK_USD (öntanımlı 0.66, ayda ~20 $). Tavan dolmaya yaklaştıkça işler öncelik
sırasıyla durur: önce görsel denetimi, en son kendi haber metnimiz (PAY tablosu).

Dönüş biçimi Gemini yardımcılarıyla aynıdır: (durum kodu, ayrıştırılmış JSON ya da None). 429 = bütçe ya da kota doldu.
"""
import base64
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.request

ANTHROPIC = "https://api.anthropic.com/v1/messages"
GEMINI = "https://generativelanguage.googleapis.com/v1beta"
KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFTER = os.environ.get("YZ_DEFTER") or os.path.join(KOK, "data", "yz-harcama.json")
MODEL = os.environ.get("YZ_MODEL") or "claude-haiku-5-5"
GUNLUK_USD = float(os.environ.get("YZ_GUNLUK_USD") or 0.66)
# Milyon token başına dolar: (girdi, çıktı); 100 bin token'ı aşan isteklerde Haiku 5.5 beş kat fiyatlanır
FIYAT = {"claude-haiku-5-5": ((0.10, 0.50), (0.50, 2.50))}
UZUN_ISTEK = 100_000
# Görevin günlük tavanın en fazla ne kadarını kullanabileceği: tavan dolarken önce görsel, en son haber metni durur
PAY = {"haber_yaz": 1.0, "ozet": 0.9, "ceviri": 0.9, "olay": 0.8, "almanak": 0.7, "diger": 0.7, "gorsel": 0.6}
GORSEL_TUR = {"image/jpeg", "image/png", "image/gif", "image/webp"}
UA = "alboroto-yz/1.0"

_defter = None


def etkin():
    return os.environ.get("YZ_SAGLAYICI", "").lower() == "anthropic" and bool(os.environ.get("ANTHROPIC_API_KEY"))


def _bugun():
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def _oku():
    global _defter
    if _defter is None:
        try:
            with open(DEFTER, encoding="utf-8") as f:
                _defter = json.load(f)
        except Exception:
            _defter = {}
        _defter.setdefault("gunler", {})
    g = _defter["gunler"].setdefault(_bugun(), {"usd": 0.0, "girdi": 0, "cikti": 0, "istek": 0, "gorev": {}, "yedek": 0, "hata": 0})
    return g


def kaydet():
    """Defteri diske yazar (son 60 gün)."""
    if _defter is None:
        return
    gunler = dict(sorted(_defter["gunler"].items())[-60:])
    _defter["gunler"] = gunler
    _defter["guncellendi"] = dt.datetime.now(dt.timezone.utc).isoformat()
    _defter["model"] = MODEL
    _defter["tavan_usd"] = GUNLUK_USD
    try:
        os.makedirs(os.path.dirname(DEFTER), exist_ok=True)
        with open(DEFTER, "w", encoding="utf-8") as f:
            json.dump(_defter, f, ensure_ascii=False, indent=1)
    except Exception:
        pass


def harcanan():
    return _oku()["usd"]


def butce_var(gorev="diger"):
    return _oku()["usd"] < GUNLUK_USD * PAY.get(gorev, PAY["diger"])


def _maliyet(model, girdi, cikti):
    kisa, uzun = FIYAT.get(model, FIYAT["claude-haiku-5-5"])
    f = uzun if girdi > UZUN_ISTEK else kisa
    return girdi / 1e6 * f[0] + cikti / 1e6 * f[1]


def json_coz(t):
    """Model çıktısından JSON: kod bloğu işaretlerini atar, gerekirse ilk { ya da [ bloğunu ayıklar."""
    t = re.sub(r"^```(?:json)?|```$", "", (t or "").strip()).strip()
    try:
        return json.loads(t)
    except Exception:
        pass
    for ac, kp in (("{", "}"), ("[", "]")):
        i, j = t.find(ac), t.rfind(kp)
        if 0 <= i < j:
            try:
                return json.loads(t[i:j + 1])
            except Exception:
                continue
    return None


def _claude(metin, sistem, gorsel, sicaklik, zaman, en_cok_cikti, gorev):
    icerik = []
    if gorsel:
        veri, tur = gorsel
        icerik.append({"type": "image", "source": {"type": "base64", "media_type": tur, "data": base64.b64encode(veri).decode()}})
    icerik.append({"type": "text", "text": metin + "\n\nYanıt olarak yalnızca geçerli JSON döndür; önüne ya da arkasına açıklama yazma."})
    govde = {"model": MODEL, "max_tokens": en_cok_cikti, "messages": [{"role": "user", "content": icerik}]}   # Haiku 5.5 temperature kabul etmiyor
    if sistem:
        govde["system"] = sistem
    istek = urllib.request.Request(ANTHROPIC, data=json.dumps(govde).encode("utf-8"), headers={
        "Content-Type": "application/json", "x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "User-Agent": UA})
    try:
        with urllib.request.urlopen(istek, timeout=zaman) as r:
            yanit = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            _oku()["son_hata"] = f"{e.code} " + e.read().decode("utf-8", "replace")[:300]
        except Exception:
            pass
        return e.code, None
    except Exception as e:
        _oku()["son_hata"] = f"0 {e}"[:300]
        return 0, None
    u = yanit.get("usage") or {}
    girdi = (u.get("input_tokens") or 0) + (u.get("cache_creation_input_tokens") or 0) + (u.get("cache_read_input_tokens") or 0)
    cikti = u.get("output_tokens") or 0
    g = _oku()
    usd = _maliyet(MODEL, girdi, cikti)
    g["usd"] = round(g["usd"] + usd, 6)
    g["girdi"] += girdi
    g["cikti"] += cikti
    g["istek"] += 1
    gg = g["gorev"].setdefault(gorev, {"istek": 0, "usd": 0.0})
    gg["istek"] += 1
    gg["usd"] = round(gg["usd"] + usd, 6)
    t = "".join(p.get("text", "") for p in yanit.get("content") or [] if p.get("type") == "text")
    if yanit.get("stop_reason") == "refusal":
        return 200, None
    return 200, json_coz(t)


def _gemini(anahtar, model, metin, sistem, gorsel, sicaklik, zaman, en_cok_cikti):
    parca = []
    if gorsel:
        veri, tur = gorsel
        parca.append({"inline_data": {"mime_type": tur, "data": base64.b64encode(veri).decode()}})
    parca.append({"text": metin})
    govde = {"contents": [{"role": "user", "parts": parca}],
             "generationConfig": {"temperature": sicaklik, "responseMimeType": "application/json", "maxOutputTokens": en_cok_cikti}}
    if sistem:
        govde["systemInstruction"] = {"parts": [{"text": sistem}]}
    istek = urllib.request.Request(f"{GEMINI}/models/{model}:generateContent", data=json.dumps(govde).encode("utf-8"),
                                   headers={"Content-Type": "application/json", "x-goog-api-key": anahtar, "User-Agent": UA})
    try:
        with urllib.request.urlopen(istek, timeout=zaman) as r:
            yanit = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, None
    except Exception:
        return 0, None
    try:
        return 200, json_coz(yanit["candidates"][0]["content"]["parts"][0]["text"])
    except Exception:
        return 200, None


def cagir(metin, gorev="diger", gemini=None, sistem=None, gorsel=None, sicaklik=0.2, zaman=120, en_cok_cikti=8192, yalniz=None):
    """Bir görev çağrısı. gemini=(anahtar, model) yedek sağlayıcıdır. gorsel=(bayt, mime türü).
    yalniz="claude" ya da "gemini" yalnızca o sağlayıcıyı dener (karşılaştırma denemesi için)."""
    g = _oku()
    claude_olur = (etkin() or yalniz == "claude") and os.environ.get("ANTHROPIC_API_KEY") and yalniz != "gemini" \
        and (not gorsel or gorsel[1] in GORSEL_TUR) and (not g.get("anahtar_hata") or yalniz == "claude")
    kod = None
    if claude_olur:
        if butce_var(gorev) or yalniz == "claude":
            kod, v = _claude(metin, sistem, gorsel, sicaklik, zaman, en_cok_cikti, gorev)
            if kod == 200:
                return 200, v
            g["hata"] += 1
            if kod in (401, 403):
                g["anahtar_hata"] = kod     # topla.py bunu görüp yöneticiye haber verir
            if yalniz == "claude":
                return kod, None
        else:
            kod = 429
    if gemini and gemini[0] and gemini[1] and yalniz != "claude":
        k2, v2 = _gemini(gemini[0], gemini[1], metin, sistem, gorsel, sicaklik, zaman, en_cok_cikti)
        if claude_olur:
            g["yedek"] += 1
        return k2, v2
    return (kod or 0), None
