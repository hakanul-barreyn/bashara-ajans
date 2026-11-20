# Tek seferlik: OCHA'nın Gazze erişim haritasını indirir; sayfayı PNG'ye çevirir ve vektör çizimleri (dolgu rengi, yol) JSON'a döker.
import json, os, urllib.request
import fitz
os.makedirs("tarama", exist_ok=True)
UA = "alboroto-tarama/1.0 (+https://alborotonews.com)"
for ad, url in [("ocha-2026-11-16", "https://www.ochaopt.org/sites/default/files/Gaza_2026_Nov_16_2026.pdf")]:
    veri = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90).read()
    open(f"tarama/{ad}.pdf", "wb").write(veri)
    doc = fitz.open(f"tarama/{ad}.pdf")
    for i, s in enumerate(doc):
        s.get_pixmap(dpi=150).save(f"tarama/{ad}-s{i}.png")
        cizim = []
        for d in s.get_drawings():
            yollar = []
            for it in d["items"]:
                if it[0] == "l": yollar.append(["l", [round(it[1].x, 2), round(it[1].y, 2), round(it[2].x, 2), round(it[2].y, 2)]])
                elif it[0] == "c": yollar.append(["c", [round(it[1].x, 2), round(it[1].y, 2), round(it[4].x, 2), round(it[4].y, 2)]])
                elif it[0] == "re": r = it[1]; yollar.append(["re", [round(r.x0, 2), round(r.y0, 2), round(r.x1, 2), round(r.y1, 2)]])
                elif it[0] == "qu": q = it[1]; yollar.append(["qu", [round(q.ul.x, 2), round(q.ul.y, 2), round(q.lr.x, 2), round(q.lr.y, 2)]])
            cizim.append({"fill": d.get("fill"), "color": d.get("color"), "w": d.get("width"), "op": d.get("fill_opacity"), "rect": [round(v, 1) for v in d["rect"]], "y": yollar})
        json.dump({"boyut": [s.rect.width, s.rect.height], "cizim": cizim}, open(f"tarama/{ad}-s{i}.json", "w"))
        open(f"tarama/{ad}-s{i}.txt", "w").write(s.get_text())
        print(ad, i, len(cizim))
