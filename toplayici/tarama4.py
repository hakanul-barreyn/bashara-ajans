# Tek seferlik: OCHA'nın Gazze erişim haritasını indirir; sayfayı PNG'ye çevirir ve vektör çizimleri (dolgu rengi, yol) JSON'a döker.
import gzip, json, os, urllib.request
import fitz
os.makedirs("tarama", exist_ok=True)
UA = "alboroto-tarama/1.0 (+https://alborotonews.com)"
for ad, url in [("gb-pse-adm1", "https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/PSE/ADM1/geoBoundaries-PSE-ADM1.geojson")]:
    open(f"tarama/{ad}.geojson", "wb").write(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read())
    print(ad, os.path.getsize(f"tarama/{ad}.geojson"))
for ad, url in [] and [("ocha-2026-11-16", "https://www.ochaopt.org/sites/default/files/Gaza_2026_Nov_16_2026.pdf")]:
    veri = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
    open(f"tarama/{ad}.pdf", "wb").write(veri)
    doc = fitz.open(f"tarama/{ad}.pdf")
    for i, s in enumerate(doc):
        s.get_pixmap(dpi=200).save(f"tarama/{ad}-s{i}.png")
        cizim = []; renk = {}
        alan = s.rect.width * s.rect.height
        for d in s.get_drawings():
            anah = str(d.get("fill")) + "|" + str(d.get("color"))
            renk[anah] = renk.get(anah, 0) + 1
            r = d["rect"]
            if r.width * r.height < alan * 0.002:   # küçük işaretler (yıkılmış yapılar vb.) atlanır
                continue
            yollar = []
            for it in d["items"]:
                if it[0] == "l": yollar.append(["l", [round(it[1].x, 2), round(it[1].y, 2), round(it[2].x, 2), round(it[2].y, 2)]])
                elif it[0] == "c": yollar.append(["c", [round(it[1].x, 2), round(it[1].y, 2), round(it[4].x, 2), round(it[4].y, 2)]])
                elif it[0] == "re": r = it[1]; yollar.append(["re", [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)]])
                elif it[0] == "qu": q = it[1]; yollar.append(["qu", [round(q.ul.x, 2), round(q.ul.y, 2), round(q.lr.x, 2), round(q.lr.y, 2)]])
            cizim.append({"fill": d.get("fill"), "color": d.get("color"), "w": d.get("width"), "op": d.get("fill_opacity"), "rect": [round(v, 1) for v in d["rect"]], "y": yollar})
        with gzip.open(f"tarama/{ad}-s{i}.json.gz", "wt") as f:
            json.dump({"boyut": [s.rect.width, s.rect.height], "renk": renk, "cizim": cizim}, f)
        open(f"tarama/{ad}-s{i}.txt", "w").write(s.get_text())
        print(ad, i, len(cizim))
