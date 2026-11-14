"""Elle kodlama örneklemi: savaş bağlamındaki başlıklardan, basın grubu x otomatik sınıf katmanlarında rastgele seçim.
Çıktı: CSV (kodlayıcı sütunları boş) + otomatik sınıfları ayrı dosyada (kör kodlama için)."""
import csv, glob, gzip, json, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gecmis, rapor
random.seed(20261114)
KOK = sys.argv[1]
K = {str(k["id"]): k for k in json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kaynaklar.json")))}
def grp(k):
    if k.get("ulke") == "Türkiye": return "turkiye"
    return rapor.grup(k)
RES = {}   # (grup, sinif) -> reservoir
SAY = {}
BOY = {"aktif": 6, "failli": 6, "failsiz": 6, "oldu": 6, "sehadet": 6, "ikurban": 6, "pfail": 3, "abluka": 3, "dogal": 3, "yok": 6}
for f in glob.glob(KOK + "/veri/*/*.jsonl.gz"):
    kid = f.split("/")[-2]; k = K.get(kid)
    if not k: continue
    g = grp(k)
    if not g: continue
    for satir in gzip.open(f, "rt", encoding="utf-8"):
        try: r = json.loads(satir)
        except ValueError: continue
        t = (r.get("t") or "")[:10]
        if not t or t < "2023-10-07": continue       # yalnız tarihli başlıklar (adresten türetilenler dahil; ölçülen de onlar)
        b = gecmis.olcum_metni(r.get("b") or "", r.get("u") or ""); kb = gecmis.katla(b)
        if len(b.split()) < 3: continue
        if not (gecmis.GAZZE.search(b) or gecmis.GAZZE.search(kb) or gecmis.BAGLAM.search(b) or gecmis.BAGLAM.search(kb)): continue
        c = gecmis.faillik(b, kb) or "yok"
        anahtar = (g, c); SAY[anahtar] = SAY.get(anahtar, 0) + 1
        n = BOY.get(c, 3)
        L = RES.setdefault(anahtar, [])
        x = {"grup": g, "yayin": k["ad"], "dil": k.get("dil"), "tarih": t, "baslik": b, "url": r.get("u"), "otomatik": c, "tur": "adres" if r.get("s") == 1 else "özgün"}
        if len(L) < n: L.append(x)
        else:
            j = random.randrange(SAY[anahtar])
            if j < n: L[j] = x
rows = [x for L in RES.values() for x in L]
random.shuffle(rows)
for i, x in enumerate(rows, 1): x["no"] = i
os.makedirs(sys.argv[2], exist_ok=True)
with open(sys.argv[2] + "/kodlama.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["no", "yayin", "dil", "tarih", "baslik_turu", "baslik", "url", "olum_var_mi (E/H)", "olen (Filistinli/İsrailli/diğer)", "fail_yazili_mi (E/H/şehadet)", "not"])
    for x in rows: w.writerow([x["no"], x["yayin"], x["dil"], x["tarih"], x["tur"], x["baslik"], x["url"], "", "", "", ""])
with open(sys.argv[2] + "/otomatik.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["no", "grup", "otomatik"])
    for x in rows: w.writerow([x["no"], x["grup"], x["otomatik"]])
json.dump({f"{a}|{b}": n for (a, b), n in sorted(SAY.items())}, open(sys.argv[2] + "/katman_sayilari.json", "w"), ensure_ascii=False, indent=1)
print(len(rows), "satır");
import collections; print(collections.Counter(x["otomatik"] for x in rows)); print(collections.Counter(x["dil"] for x in rows))
