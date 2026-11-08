"""Haber sayfalarındaki harita için bölge altlığı: site/bolge-harita.json (bir kez üretilir, depoda durur).

Kaynak: Natural Earth 1:50m ülke sınırları (world-atlas, countries-50m.json; kamu malı).
- Kara: bölgedeki bütün ülkeler tek renk; ülke adı yazılmaz, adları biz koyarız.
- Sınırlar: ülkeler arası sınırlar çizilir. İsrail'in tanınmaması için 1948 öncesi Filistin'in içi (İsrail ile Batı
  Şeria / Gazze arasındaki çizgi) çizilmez; bütün bölge "FİLİSTİN" diye adlandırılır. İşgal altındaki Golan'ın
  durumunu belirsizleştirmemek için İsrail ile Suriye arasındaki çizgi de çizilmez.
Kullanım: python toplayici/bolge_haritasi.py <countries-50m.json> site/bolge-harita.json
"""
import json
import sys

BBOX = (-20.0, 5.0, 65.0, 48.0)          # batı, güney, doğu, kuzey
FILISTIN = {"376", "275"}                 # Natural Earth: İsrail, Filistin
SURIYE = "760"
TOLERANS = 0.004                          # derece; yakınlaştırma 9'a kadar yeterli

ULKELER = [  # Türkçe ad, enlem, boylam (etiket yeri)
    ("FİLİSTİN", 31.45, 34.95), ("LÜBNAN", 33.95, 35.85), ("SURİYE", 35.0, 38.5), ("ÜRDÜN", 31.0, 36.6),
    ("MISIR", 26.5, 30.0), ("IRAK", 33.0, 43.5), ("İRAN", 32.5, 54.0), ("SUUDİ ARABİSTAN", 24.0, 45.0),
    ("YEMEN", 15.6, 47.5), ("TÜRKİYE", 39.0, 35.0), ("KIBRIS", 35.05, 33.2), ("LİBYA", 27.0, 17.0),
    ("SUDAN", 16.0, 30.0), ("UMMAN", 21.0, 57.0), ("KUVEYT", 29.3, 47.6), ("KATAR", 25.3, 51.2),
    ("BAE", 23.8, 54.3), ("TUNUS", 34.0, 9.5), ("CEZAYİR", 28.0, 2.5), ("FAS", 31.8, -6.5),
]
SEHIRLER = [  # ad, enlem, boylam, önem (1: her yakınlıkta, 2: yakınlaşınca, 3: iyice yakınlaşınca)
    ("Kudüs", 31.78, 35.22, 1), ("Gazze", 31.50, 34.47, 1), ("Ramallah", 31.90, 35.20, 2), ("Han Yunus", 31.34, 34.30, 2),
    ("Refah", 31.29, 34.25, 3), ("Cibaliya", 31.53, 34.48, 3), ("Deyr el-Belah", 31.42, 34.35, 3), ("Nablus", 32.22, 35.26, 2),
    ("Cenin", 32.46, 35.30, 2), ("El Halil", 31.53, 35.10, 2), ("Beytüllahim", 31.70, 35.20, 3), ("Tulkerim", 32.31, 35.03, 3),
    ("Kalkiliye", 32.19, 34.97, 3), ("Eriha", 31.86, 35.45, 3), ("Yafa", 32.05, 34.76, 2), ("Hayfa", 32.79, 34.99, 2),
    ("Akka", 32.93, 35.08, 3), ("Nasıra", 32.70, 35.30, 3), ("Bi'r es-Sebi", 31.25, 34.79, 3), ("Askalan", 31.67, 34.57, 3),
    ("Safed", 32.96, 35.50, 3), ("Beyrut", 33.89, 35.50, 1), ("Sayda", 33.56, 35.37, 2), ("Sur", 33.27, 35.20, 2),
    ("Nebatiye", 33.38, 35.48, 3), ("Baalbek", 34.01, 36.21, 3), ("Trablusşam", 34.44, 35.83, 2), ("Şam", 33.51, 36.29, 1),
    ("Kuneytra", 33.13, 35.82, 3), ("Dera", 32.62, 36.10, 3), ("Humus", 34.73, 36.71, 2), ("Halep", 36.20, 37.16, 1),
    ("Lazkiye", 35.52, 35.78, 2), ("İdlib", 35.93, 36.63, 3), ("Deyrizor", 35.33, 40.14, 2), ("Rakka", 35.95, 39.01, 3),
    ("Kamışlı", 37.05, 41.23, 3), ("Amman", 31.95, 35.93, 1), ("Akabe", 29.53, 35.01, 3), ("Kahire", 30.04, 31.24, 1),
    ("İskenderiye", 31.20, 29.92, 2), ("El Ariş", 31.13, 33.80, 3), ("Bağdat", 33.31, 44.36, 1), ("Erbil", 36.19, 44.01, 2),
    ("Musul", 36.34, 43.13, 2), ("Sincar", 36.32, 41.86, 3), ("Kerkük", 35.47, 44.39, 3), ("Süleymaniye", 35.56, 45.44, 3),
    ("Basra", 30.51, 47.78, 2), ("Tahran", 35.69, 51.39, 1), ("İsfahan", 32.65, 51.67, 2), ("Tebriz", 38.08, 46.29, 2),
    ("Riyad", 24.71, 46.68, 1), ("Cidde", 21.49, 39.19, 2), ("Mekke", 21.39, 39.86, 2), ("Medine", 24.47, 39.61, 3),
    ("Sana", 15.37, 44.19, 1), ("Aden", 12.80, 45.03, 2), ("Hudeyde", 14.80, 42.95, 2), ("Saada", 16.94, 43.76, 3),
    ("Doha", 25.29, 51.53, 1), ("Dubai", 25.20, 55.27, 2), ("Abu Dabi", 24.45, 54.38, 2), ("Maskat", 23.59, 58.41, 2),
    ("Kuveyt", 29.37, 47.98, 2), ("Manama", 26.23, 50.59, 2), ("Ankara", 39.93, 32.86, 1), ("İstanbul", 41.01, 28.98, 1),
    ("Diyarbakır", 37.91, 40.24, 3), ("Gaziantep", 37.07, 37.38, 3), ("Adana", 37.00, 35.32, 3), ("Lefkoşa", 35.19, 33.36, 2),
    ("Trablus", 32.89, 13.19, 2), ("Bingazi", 32.12, 20.07, 3), ("Tunus", 36.81, 10.18, 1), ("Cezayir", 36.75, 3.06, 1),
    ("Rabat", 34.02, -6.84, 1), ("Hartum", 15.50, 32.56, 1), ("Port Sudan", 19.62, 37.22, 3),
]


def _dp(noktalar, tol):
    """Douglas-Peucker sadeleştirme."""
    if len(noktalar) < 3:
        return noktalar
    (x1, y1), (x2, y2) = noktalar[0], noktalar[-1]
    dx, dy = x2 - x1, y2 - y1
    uz = (dx * dx + dy * dy) ** 0.5 or 1e-12
    en, ei = 0, 0
    for i in range(1, len(noktalar) - 1):
        x, y = noktalar[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / uz
        if d > en:
            en, ei = d, i
    if en <= tol:
        return [noktalar[0], noktalar[-1]]
    return _dp(noktalar[:ei + 1], tol)[:-1] + _dp(noktalar[ei:], tol)


def uret(topo):
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0
        nk = []
        for p in a:
            x += p[0]
            y += p[1]
            nk.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(nk)
    sade = [_dp(a, TOLERANS) for a in arcs]

    def yay(i):
        return sade[i] if i >= 0 else sade[~i][::-1]

    def halka(r):
        nk = []
        for i in r:
            p = yay(i)
            nk += p[1:] if nk else p
        return nk

    def icinde(h):
        xs = [p[0] for p in h]
        ys = [p[1] for p in h]
        return not (max(xs) < BBOX[0] or min(xs) > BBOX[2] or max(ys) < BBOX[1] or min(ys) > BBOX[3])

    kara, kullanan = [], {}
    for g in topo["objects"]["countries"]["geometries"]:
        gid = str(g.get("id", g.get("properties", {}).get("name")))
        poli = [g["arcs"]] if g["type"] == "Polygon" else g["arcs"] if g["type"] == "MultiPolygon" else []
        for p in poli:
            dis = halka(p[0])
            if not icinde(dis):
                continue
            kara.append([[[round(x, 3), round(y, 3)] for x, y in halka(r)] for r in p])
            for r in p:
                for i in r:
                    kullanan.setdefault(i if i >= 0 else ~i, set()).add(gid)
    sinir = []
    for i, ulkeler in kullanan.items():
        if len(ulkeler) < 2:
            continue                                   # kıyı çizgisi: dolgu yeterli
        ic = ulkeler & FILISTIN
        if len(ic) == 2:
            continue                                   # Filistin'in içi
        if ic and SURIYE in ulkeler:
            continue                                   # Golan
        sinir.append([[round(x, 3), round(y, 3)] for x, y in sade[i]])
    return {"kaynak": "Natural Earth 1:50m (kamu malı)", "kara": kara, "sinir": sinir,
            "ulke": [list(u) for u in ULKELER], "sehir": [list(s) for s in SEHIRLER]}


if __name__ == "__main__":
    veri = uret(json.load(open(sys.argv[1], encoding="utf-8")))
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    print(len(veri["kara"]), "kara parçası,", len(veri["sinir"]), "sınır çizgisi")
