"""Tarihçe haritaları: Natural Earth 10m (kamu malı) kara ve ülke poligonlarından tarihî Filistin (Golan hariç),
Batı Şeria ve Gazze; 1947 planı ve Oslo bölgeleri şematik. Çıktı: SVG yol dizeleri (JSON)."""
import json, math, sys
ne = sys.argv[1]; cik = sys.argv[2]
LON0, LON1, LAT0, LAT1 = 33.4, 37.2, 29.3, 33.75
W = 500
K = math.cos(math.radians(31.5))
s = W / ((LON1 - LON0) * K)
H = round((LAT1 - LAT0) * s)
def P(lon, lat): return ((lon - LON0) * K * s, (LAT1 - lat) * s)
def yol(halka):
    pts = [P(*c[:2]) for c in halka]
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"
def kirp_x(halka, xmax):
    # Sutherland–Hodgman: x <= xmax yarı düzlemi
    out = []
    for i in range(len(halka)):
        a, b = halka[i - 1], halka[i]
        ia, ib = a[0] <= xmax, b[0] <= xmax
        if ib:
            if not ia:
                t = (xmax - a[0]) / (b[0] - a[0]); out.append([xmax, a[1] + t * (b[1] - a[1])])
            out.append(b)
        elif ia:
            t = (xmax - a[0]) / (b[0] - a[0]); out.append([xmax, a[1] + t * (b[1] - a[1])])
    return out
d = json.load(open(ne + "/ne_10m_admin_0_countries.geojson"))
U = {}
for f in d["features"]:
    a = f["properties"]["ADM0_A3"]
    if a in ("ISR", "PSX", "EGY", "JOR", "LBN", "SYR", "SAU", "IRQ", "CYP", "TUR", "CYN"):
        g = f["geometry"]; U[a] = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
def ic(lon, lat): return LON0 - .5 < lon < LON1 + .5 and LAT0 - .5 < lat < LAT1 + .5
# tarihî Filistin: İsrail poligonu (Golan kırpılarak) + Batı Şeria + Gazze; aynı renkle doldurulur, iç sınır çizilmez
isr = [kirp_x(pl[0], 35.66) for pl in U["ISR"]]
psx = [pl[0] for pl in U["PSX"]]
gazze = [p for p in psx if max(c[0] for c in p) < 34.7]
bati = [p for p in psx if max(c[0] for c in p) > 34.7]
komsu, osmanli, misir = [], [], []
for a in ("EGY", "JOR", "LBN", "SYR", "SAU", "IRQ", "CYP", "CYN", "TUR"):
    for pl in U.get(a, []):
        if any(ic(*c[:2]) for c in pl[0]):
            komsu.append(yol(pl[0]))
            (misir if a == "EGY" else osmanli if a in ("JOR", "LBN", "SYR", "SAU", "IRQ") else []).append(yol(pl[0]))
golan = [pl[0] for pl in U["ISR"]]
# Golan (Suriye toprağı): İsrail poligonunun x>35.66 kısmı -> komşu gibi boyanır
def kirp_xmin(halka, xmin):
    return [[2 * xmin - x, y] for x, y in kirp_x([[2 * xmin - c[0], c[1]] for c in halka], xmin)]
for pl in golan:
    g = kirp_xmin(pl, 35.66)
    if len(g) > 2: komsu.append(yol(g)); osmanli.append(yol(g))
# göller ve Ürdün nehri
gol, nehir = [], []
L = json.load(open(ne + "/ne_10m_lakes.geojson"))
for f in L["features"]:
    g = f["geometry"]; pl = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for p in pl:
        if any(ic(*c[:2]) for c in p[0]) and f["properties"].get("name") in ("Sea of Galilee", "Dead Sea"): gol.append(yol(p[0]))
R = json.load(open(ne + "/ne_10m_rivers_lake_centerlines.geojson"))
for f in R["features"]:
    if f["properties"].get("name") != "Jordan": continue
    g = f["geometry"]; ls = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
    for l in ls:
        pts = [P(*c[:2]) for c in l]; nehir.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts))
v = {"w": W, "h": H, "pencere": [LON0, LON1, LAT0, LAT1], "osmanli": osmanli, "misir": misir, "gol": gol, "nehir": nehir, "kaynak": "Natural Earth 1:10m (kamu malı); 1947 planı ve Oslo bölgeleri şematik",
     "komsu": komsu, "filistin": [yol(p) for p in isr + psx], "bati": [yol(p) for p in bati], "gazze": [yol(p) for p in gazze]}
def poly(pts): return yol([[a, b] for a, b in pts])
# 1947 BM planında Arap devleti (şematik; kıyıda tarihî Filistin şekliyle kırpılır)
v["plan1947"] = [
    poly([(34.9, 33.2), (35.42, 33.12), (35.5, 32.9), (35.42, 32.74), (35.33, 32.62), (35.2, 32.62), (35.1, 32.74), (34.9, 32.9)]),
    poly([(35.18, 32.58), (35.56, 32.45), (35.6, 32.1), (35.56, 31.75), (35.42, 31.48), (35.2, 31.22), (34.95, 31.18), (34.83, 31.4), (34.86, 31.75), (34.93, 31.95), (34.95, 32.25), (35.04, 32.47)]),
    poly([(34.55, 31.86), (34.8, 31.58), (34.66, 31.25), (34.54, 30.96), (34.44, 30.7), (34.3, 30.8), (34.24, 31.25), (34.0, 31.4), (34.3, 31.75)]),
    poly([(34.73, 32.08), (34.79, 32.07), (34.79, 32.02), (34.73, 32.02)])]
v["kudus"] = list(P(35.225, 31.775))

# 1947 BM planı: izlenmiş sınırlar (toplayici/plan1947.json); Yahudi devleti tarihî Filistin'in kalanı, Kudüs ve Beytüllahim BM yönetiminde
import os
_pj = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan1947.json")
if os.path.exists(_pj):
    _p = json.load(open(_pj))
    v["plan1947"] = [poly(q) for q in _p["arap"]]
    v["plan1947_kudus"] = [poly(q) for q in _p["kudus"]]
    v["plan1947_yahudi"] = v["filistin"]
    v["plan1947_etiket"] = [[a, b, *map(lambda q: round(q, 1), P(c, d_))] for a, b, c, d_ in [
        ("ARAP\nDEVLETİ", "ARAB\nSTATE", 35.27, 32.36), ("YAHUDİ\nDEVLETİ", "JEWISH\nSTATE", 34.98, 30.55), ("BM", "UN", 35.25, 31.66)]]
# Oslo II: A ve B bölgeleri (şematik)
def elips(lon, lat, rx, ry):
    return poly([(lon + rx * math.cos(t / 14 * 2 * math.pi), lat + ry * math.sin(t / 14 * 2 * math.pi)) for t in range(14)])
v["oslo_ab"] = [elips(*e) for e in [(35.3, 32.44, .1, .07), (35.36, 32.3, .07, .06), (35.06, 32.31, .05, .05), (35.24, 32.22, .1, .07),
                                    (34.98, 32.18, .03, .03), (35.17, 32.08, .07, .05), (35.21, 31.92, .09, .06), (35.45, 31.86, .04, .04),
                                    (35.2, 31.69, .06, .05), (35.08, 31.53, .08, .07), (35.06, 31.42, .05, .04)]]
# Ekim 2025: sarı hattın doğusu (şematik)
v["sari_hat"] = poly([(34.5, 31.65), (34.65, 31.65), (34.65, 31.15), (34.15, 31.15), (34.15, 31.33), (34.25, 31.34), (34.31, 31.34),
                      (34.37, 31.37), (34.42, 31.43), (34.465, 31.5), (34.49, 31.57)])
v["etiket"] = [[a, b, *map(lambda q: round(q, 1), P(c, d_))] for a, b, c, d_ in [
    ("AKDENİZ", "MEDITERRANEAN", 33.95, 32.6), ("SİNA", "SINAI", 33.9, 30.0), ("ÜRDÜN", "JORDAN", 36.5, 31.0), ("SURİYE", "SYRIA", 36.55, 33.25),
    ("LÜBNAN", "LEBANON", 35.62, 33.62)]]
# Gazze'deki yerleşimler (2005'te boşaltıldı; şematik): Guş Katif bloğu, kuzeyde Eley Sinai–Dugit–Nisanit, Netzarim, Kfar Darom
v["gazze_yerlesim"] = [
    poly([(34.228, 31.318), (34.262, 31.300), (34.300, 31.335), (34.318, 31.362), (34.305, 31.385), (34.282, 31.392), (34.262, 31.372), (34.240, 31.345)]),
    poly([(34.480, 31.585), (34.505, 31.570), (34.540, 31.578), (34.548, 31.600), (34.510, 31.605)]),
    elips(34.425, 31.468, .012, .008), elips(34.358, 31.405, .007, .006), elips(34.335, 31.360, .006, .005)]
v["gazze_kutu"] = [round(q, 1) for q in (*P(34.17, 31.62), *P(34.62, 31.19))]
_poz = {"AKDENİZ": (122, 272), "SİNA": (112, 560), "ÜRDÜN": (372, 430), "SURİYE": (378, 80), "LÜBNAN": (292, 22)}
for e in v["etiket"]:
    if e[0] in _poz: e[2], e[3] = _poz[e[0]]
sehir = [("Kudüs", 35.225, 31.775), ("Yafa", 34.75, 32.05), ("Hayfa", 34.99, 32.8), ("Gazze", 34.46, 31.5), ("Nablus", 35.26, 32.22),
         ("El-Halil", 35.1, 31.53), ("Birüssebi", 34.79, 31.25), ("Akka", 35.07, 32.93), ("Safed", 35.5, 32.97), ("Ramallah", 35.2, 31.9), ("Cenin", 35.3, 32.46)]
v["sehir"] = [[a, *map(lambda q: round(q, 1), P(b, c))] for a, b, c in sehir]
json.dump(v, open(cik, "w"), ensure_ascii=False, separators=(",", ":"))
print("ok", len(json.dumps(v)) // 1024, "KB")
