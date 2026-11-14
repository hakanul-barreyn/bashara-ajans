"""Kimin raporu için Türkiye basını doğrulama örneklemi (40 İsrailli ölüm + 40 Filistinli ölüm başlığı). Kullanım: python toplayici/tr_orneklem.py <tarama klasörü> <çıktı.json>"""
import csv, glob, gzip, json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gecmis
random.seed(7)
K = {str(k["id"]): k for k in json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kaynaklar.json")))}
RES = {"io": [], "fo": []}; SAY = {"io": 0, "fo": 0}
for f in glob.glob(sys.argv[1] + "/veri/*/*.jsonl.gz"):
    kid = f.split("/")[-2]; k = K.get(kid)
    if not k or k.get("ulke") != "Türkiye": continue
    for satir in gzip.open(f, "rt", encoding="utf-8"):
        try: r = json.loads(satir)
        except ValueError: continue
        t = (r.get("t") or "")[:10]
        if not t or t < "2023-10-07" or t > "2025-10-09": continue
        b = gecmis.olcum_metni(r.get("b") or "", r.get("u") or ""); kb = gecmis.katla(b)
        if len(b.split()) < 3: continue
        gz = bool(gecmis.GAZZE.search(b) or gecmis.GAZZE.search(kb))
        if not (gz or gecmis.BAGLAM.search(b) or gecmis.BAGLAM.search(kb)): continue
        fl = gecmis.faillik(b, kb)
        if fl in ("ikurban", "pfail") or gecmis.ISRAIL_ASKER_OLUM.search(kb): c = "io"
        elif fl and (gz or gecmis.FILISTIN.search(kb)): c = "fo"
        else: continue
        SAY[c] += 1; L = RES[c]
        x = [k["ad"], k.get("dil"), t, "adres" if r.get("s") == 1 else "özgün", b, r.get("u"), c]
        if len(L) < 40: L.append(x)
        else:
            j = random.randrange(SAY[c])
            if j < 40: L[j] = x
rows = RES["io"] + RES["fo"]; random.shuffle(rows)
json.dump({"sayilar": SAY, "satirlar": rows}, open(sys.argv[2], "w"), ensure_ascii=False)
print(SAY, len(rows))
