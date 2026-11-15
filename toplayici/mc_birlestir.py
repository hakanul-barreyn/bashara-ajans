"""Media Cloud arşivindeki künyeleri (gizli HF veri seti, arsiv/<grup>/<ay>/p*.jsonl.gz) yayın listemizdeki yayınlara dağıtır.

    python toplayici/mc_birlestir.py <mc-arsiv klasörü> <çıktı klasörü>

Çıktı: <çıktı>/<yayın no>.jsonl.gz, satır başına {"u","b","t","m":"mc"} (taramanın kayıt biçimi). Geçici bir klasöre yazılır,
hiçbir depoya konmaz: başlık ve adresler üçüncü tarafların içeriğidir. gecmis.ozetle() bunları yalnızca sayımlara katar,
örnek başlık olarak göstermez.

Eşleme alan adı ve yol önekiyle yapılır (bbc.com/turkce → BBC Türkçe, bbc.com/arabic → BBC Arabic, bbc.com/news → BBC News).
Aynı haber birden çok grupta inmiş olabilir: adres bazında tekilleştirilir.
"""
import gzip
import json
import os
import sys
from urllib.parse import urlparse


def _host(u):
    h = (urlparse(u).netloc or "").lower().split(":")[0]
    return h[4:] if h.startswith("www.") else h


def eslemeler(kaynaklar, kapsam):
    """[(host, yol_öneki, yayın_no)] en özgülden en genele"""
    a = []
    for k in kaynaklar:
        if k.get("sadece_telegram") or not k.get("url"):
            continue
        p = urlparse(k["url"])
        h, yol = _host(k["url"]), (p.path or "/").rstrip("/")
        if not h or h == "t.me":
            continue
        a.append((h, yol if len(yol) > 1 else "", str(k["id"])))
        v = (kapsam.get(str(k["id"])) or {}).get("mc") or {}
        for ek in v.get("adaylar") or []:
            ek = ek.lower().removeprefix("www.")
            if ek and ek != h:
                a.append((ek, yol if len(yol) > 1 else "", str(k["id"])))
    a.sort(key=lambda x: (-len(x[1]), -len(x[0])))
    return a


def yayin_bul(u, esl):
    h = _host(u)
    yol = urlparse(u).path or "/"
    for eh, ey, kid in esl:
        if (h == eh or h.endswith("." + eh)) and (not ey or yol.startswith(ey + "/") or yol == ey):
            return kid
    # yol öneki tutmadıysa (bbc.co.uk/news gibi) yalnız alan adına bak; birden çok yayın paylaşıyorsa atla
    adaylar = {kid for eh, ey, kid in esl if h == eh or h.endswith("." + eh)}
    return adaylar.pop() if len(adaylar) == 1 else None


def main(kok, cikti):
    ana = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ks = json.load(open(os.path.join(ana, "kaynaklar.json"), encoding="utf-8"))
    ks = ks["kaynaklar"] if isinstance(ks, dict) else ks
    try:
        kapsam = json.load(open(os.path.join(kok, "mc-kapsam.json"), encoding="utf-8"))
    except (OSError, ValueError):
        kapsam = {}
    esl = eslemeler(ks, kapsam)
    gorulen, kayit, eslesmeyen, toplam = set(), {}, 0, 0
    ak = os.path.join(kok, "arsiv")
    for kl, _, dosyalar in os.walk(ak):
        for ad in sorted(dosyalar):
            if not ad.endswith(".jsonl.gz"):
                continue
            try:
                with gzip.open(os.path.join(kl, ad), "rt", encoding="utf-8") as f:
                    for satir in f:
                        try:
                            r = json.loads(satir)
                        except ValueError:
                            continue
                        u, b, t = r.get("u"), r.get("b"), r.get("t")
                        if not (u and b and t) or u in gorulen:
                            continue
                        gorulen.add(u)
                        toplam += 1
                        kid = yayin_bul(u, esl)
                        if not kid:
                            eslesmeyen += 1
                            continue
                        kayit.setdefault(kid, []).append({"u": u, "b": b, "t": t, "m": "mc"})
            except (OSError, EOFError) as e:
                print("okunamadı:", ad, e)
    os.makedirs(cikti, exist_ok=True)
    for kid, xs in kayit.items():
        with gzip.open(os.path.join(cikti, kid + ".jsonl.gz"), "wt", encoding="utf-8") as f:
            for r in xs:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Media Cloud: {toplam} tekil künye, {toplam - eslesmeyen} tanesi {len(kayit)} yayına eşlendi; {eslesmeyen} eşleşmedi "
          "(listemiz dışındaki Türkiye koleksiyonu yayınları)")
    # yayın başına sayılar (yalnızca sayı; açıkça yazılabilir)
    return {kid: len(xs) for kid, xs in kayit.items()}


if __name__ == "__main__":
    sayim = main(sys.argv[1], sys.argv[2])
    if len(sys.argv) > 3:
        json.dump(sayim, open(sys.argv[3], "w"), ensure_ascii=False, indent=0, sort_keys=True)
