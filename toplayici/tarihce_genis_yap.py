"""Tarihçe geniş harita: Anadolu'dan Hicaz'a, Mısır'dan İran sınırına. Natural Earth 1:10m (kamu malı) kara, ülke, göl ve nehir
verisinden pencereye kırpılmış, sadeleştirilmiş SVG yolları; 1914 Osmanlı toprakları, Sykes–Picot bölgeleri (1916) ve mandalar (1922).
Sykes–Picot bölgeleri ve Hicaz sınırı şematiktir (antlaşma haritasından elle, yaklaşık).
Kullanım: python3 toplayici/tarihce_genis_yap.py <natural-earth-geojson-dizini> site/tarihce-harita-genis.json"""
import json, math, sys

ne, cik = sys.argv[1], sys.argv[2]
LON0, LON1, LAT0, LAT1 = 25.5, 50.5, 22.5, 41.6
W = 900
K = math.cos(math.radians(32))
s = W / ((LON1 - LON0) * K)
H = round((LAT1 - LAT0) * s)
PAY = 0.6   # pencere dışına taşma payı (derece): kırpma kenarı görünmesin


def P(lon, lat):
    return ((lon - LON0) * K * s, (LAT1 - lat) * s)


def kirp(halka, kenar, deger, buyuk):
    """Sutherland–Hodgman: tek kenar (0: boylam, 1: enlem); buyuk=True ise >= deger tarafı kalır."""
    out = []
    ici = (lambda c: c[kenar] >= deger) if buyuk else (lambda c: c[kenar] <= deger)
    for i in range(len(halka)):
        a, b = halka[i - 1], halka[i]
        if ici(b):
            if not ici(a):
                t = (deger - a[kenar]) / (b[kenar] - a[kenar]); out.append([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
            out.append(b)
        elif ici(a):
            t = (deger - a[kenar]) / (b[kenar] - a[kenar]); out.append([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    return out


def pencere(halka):
    h = [c[:2] for c in halka]
    for kenar, deger, buyuk in ((0, LON0 - PAY, True), (0, LON1 + PAY, False), (1, LAT0 - PAY, True), (1, LAT1 + PAY, False)):
        h = kirp(h, kenar, deger, buyuk)
        if len(h) < 3:
            return []
    return h


def yol(halka, kapali=True, tol=1.4):
    pts, son = [], None
    for c in halka:
        x, y = P(*c[:2])
        if son is None or abs(x - son[0]) + abs(y - son[1]) >= tol:
            pts.append((x, y)); son = (x, y)
    if len(pts) < (3 if kapali else 2):
        return None
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + ("Z" if kapali else "")


def poligonlar(g):
    return g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]


def alan(h):
    a = 0
    for i in range(len(h)):
        (x1, y1), (x2, y2) = P(*h[i - 1][:2]), P(*h[i][:2]); a += x1 * y2 - x2 * y1
    return abs(a) / 2


def yollar(halkalar, en_az=6):
    out = []
    for h in halkalar:
        h = pencere(h)
        if h and alan(h) < en_az:
            continue
        d = yol(h) if h else None
        if d:
            out.append(d)
    return out


v = {"w": W, "h": H, "pencere": [LON0, LON1, LAT0, LAT1], "kaynak": "Natural Earth 1:10m (kamu malı); Sykes–Picot bölgeleri ve Hicaz şematik"}

# kara
land = json.load(open(ne + "/ne_10m_land.geojson"))
kara = []
for f in land["features"]:
    for pl in poligonlar(f["geometry"]):
        kara += yollar([pl[0]])
v["kara"] = kara

# ülkeler
d = json.load(open(ne + "/ne_10m_admin_0_countries.geojson"))
U = {}
for f in d["features"]:
    U.setdefault(f["properties"]["ADM0_A3"], []).extend(poligonlar(f["geometry"]))
def ulke(*kodlar):
    out = []
    for k in kodlar:
        for pl in U.get(k, []):
            out += yollar([pl[0]])
    return out

v["ulke"] = {k: ulke(k) for k in ("TUR", "SYR", "LBN", "JOR", "IRQ", "SAU", "EGY", "IRN", "KWT")}
# tarihî Filistin (iç sınır çizilmez) ve Golan Suriye'ye
v["filistin"] = ulke("ISR", "PSX")

# 1914 Osmanlı: Anadolu, Suriye, Lübnan, Filistin, Ürdün, Irak ve Hicaz (şematik iç sınır); Kuveyt ve Necd dışarıda
def poly(pts):
    return yol([list(p) for p in pts])
hicaz = [(34.95, 29.52), (35.3, 29.9), (36.6, 29.9), (37.6, 29.2), (38.3, 28.0), (39.2, 26.9), (40.0, 25.6), (40.6, 24.3), (41.2, 22.0), (38.9, 21.4), (37.6, 24.0), (36.2, 26.4), (35.0, 28.2), (34.85, 29.0)]
v["hicaz"] = [poly(hicaz)]
v["osmanli1914"] = ulke("TUR", "SYR", "LBN", "JOR", "IRQ", "ISR", "PSX") + v["hicaz"]
# Hicaz Demiryolu (Şam–Medine, 1908)
v["demiryolu"] = yol([(36.29, 33.51), (36.10, 32.62), (35.93, 31.95), (35.95, 31.2), (35.73, 30.19), (36.0, 29.4), (36.57, 28.38),
                      (37.3, 27.6), (37.92, 26.62), (38.6, 25.6), (39.61, 24.47)], kapali=False, tol=0.1)

# Sykes–Picot (1916): şematik; kara ile kırpılır (SVG'de)
A_B = [(35.62, 32.70), (35.9, 32.66), (36.3, 32.5), (37.0, 32.4), (38.0, 32.6), (39.0, 33.2), (40.2, 33.9), (41.5, 34.6), (43.0, 35.3), (44.0, 35.8), (45.7, 35.9)]
MAVI_DOGU = [(35.95, 33.65), (36.2, 34.3), (36.35, 34.9), (36.45, 35.5), (36.65, 36.05), (37.0, 36.5), (37.6, 36.8), (38.6, 37.1), (39.6, 37.3), (40.6, 37.6), (41.1, 38.1)]
v["sykes"] = {
    "mavi": [poly([(34.4, 33.05), (35.2, 33.08), (35.6, 33.3)] + MAVI_DOGU + [(40.9, 38.9), (40.0, 39.5), (38.8, 39.9), (37.4, 39.9), (36.3, 39.5), (35.2, 38.9), (34.3, 38.0), (33.4, 36.9), (32.4, 36.0), (33.8, 35.0), (34.6, 34.2)])],
    "a": [poly([(35.6, 33.3)] + MAVI_DOGU + [(42.5, 37.6), (43.6, 37.4), (44.7, 37.2), (45.1, 36.6), (45.7, 35.9)] + A_B[::-1][1:])],
    "kirmizi": [poly([(45.6, 34.25), (44.1, 34.05), (43.55, 33.45), (43.8, 32.5), (44.5, 31.6), (45.6, 30.6), (47.0, 29.7), (48.6, 29.5), (49.2, 30.0), (48.6, 30.6), (47.8, 31.2), (47.4, 32.2), (46.3, 33.0)]),
                poly([(34.95, 32.97), (35.12, 32.97), (35.12, 32.76), (34.95, 32.76)])],
    "b": [poly([(34.2, 31.31), (34.9, 31.36), (35.4, 31.55), (35.55, 31.8), (35.6, 32.65)] + A_B[1:] + [(46.0, 35.2), (45.9, 34.7), (45.6, 34.25), (44.1, 34.05), (43.55, 33.45), (43.8, 32.5),
                (44.5, 31.6), (45.6, 30.6), (47.0, 29.7), (47.6, 29.1), (46.5, 29.1), (44.0, 29.4), (41.0, 29.9), (38.2, 29.9), (36.6, 29.9), (35.0, 29.45), (34.9, 29.5)])],
    "kahve": [poly([(34.0, 31.35), (34.2, 31.31), (34.9, 31.36), (35.4, 31.55), (35.55, 31.8), (35.6, 32.65), (35.62, 32.88), (35.45, 33.0), (35.1, 33.06), (34.6, 33.1)])],
}
# Mandalar (1922)
v["manda"] = {"fransa": ulke("SYR", "LBN"), "ingiltere": ulke("IRQ", "JOR", "ISR", "PSX")}

# göller ve nehirler
gol = []
for f in json.load(open(ne + "/ne_10m_lakes.geojson"))["features"]:
    for pl in poligonlar(f["geometry"]):
        gol += yollar([pl[0]])
v["gol"] = gol
nehir = []
for f in json.load(open(ne + "/ne_10m_rivers_lake_centerlines.geojson"))["features"]:
    if f["properties"].get("name") not in ("Euphrates", "Tigris", "Nile", "Jordan", "Orontes", "Kizilirmak", "Seyhan", "Ceyhan", "Shatt al Arab", "Damietta Branch", "Rosetta Branch", "Karun", "Sakarya"):
        continue
    g = f["geometry"]
    for l in (g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]):
        l = [c for c in l if LON0 - PAY < c[0] < LON1 + PAY and LAT0 - PAY < c[1] < LAT1 + PAY]
        dd = yol(l, kapali=False, tol=1.0) if len(l) > 1 else None
        if dd:
            nehir.append(dd)
v["nehir"] = nehir

def nokta(lon, lat):
    x, y = P(lon, lat); return [round(x, 1), round(y, 1)]
v["sehir"] = [[ad, *nokta(lo, la)] for ad, lo, la in [
    ("İstanbul", 28.97, 41.01), ("Ankara", 32.85, 39.93), ("Adana", 35.32, 37.0), ("Halep", 37.16, 36.2), ("Şam", 36.29, 33.51), ("Beyrut", 35.5, 33.89),
    ("Kudüs", 35.22, 31.78), ("Hayfa", 34.99, 32.82), ("Amman", 35.93, 31.95), ("Bağdat", 44.36, 33.31), ("Musul", 43.13, 36.34), ("Kerkük", 44.39, 35.47),
    ("Basra", 47.78, 30.51), ("Kahire", 31.24, 30.04), ("Medine", 39.61, 24.47), ("Akabe", 35.0, 29.53)]]
v["etiket"] = {k: nokta(*ll) for k, ll in {
    "akdeniz": (30.2, 34.0), "kizildeniz": (37.4, 23.2), "korfez": (49.6, 27.4), "karadeniz": (33.5, 41.35),
    "osmanli": (38.6, 35.2), "anadolu": (33.5, 38.8), "misir": (29.2, 27.6), "iran": (48.2, 34.6), "hicaz": (38.6, 26.2), "necd": (44.0, 25.4),
    "mavi": (36.0, 38.6), "a": (40.5, 36.2), "b": (40.0, 31.4), "kirmizi": (45.9, 31.9), "kahve": (33.3, 31.95),
    "fransa": (38.4, 35.4), "irak": (43.6, 33.0), "urdun": (37.4, 30.9), "filistin": (33.4, 31.75), "turkiye": (35.0, 39.1), "hicazK": (38.6, 26.2)}.items()}
v["demiryolu_et"] = nokta(37.55, 27.95)
json.dump(v, open(cik, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("genis:", W, H, "kara", len(kara), "göl", len(gol), "nehir", len(nehir), "bayt", len(json.dumps(v)))
