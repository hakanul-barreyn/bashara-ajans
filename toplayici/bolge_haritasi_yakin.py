"""Haber sayfası haritası için ayrıntılı Filistin / Lübnan altlığı: site/bolge-harita-yakin.json (bir kez üretilir).

Kaynak: Natural Earth 1:10m ülke sınırları (ne_10m_admin_0_countries.geojson; kamu malı). Yakınlaşınca 1:50m
altlığın yerine bu çizilir; Gazze şeridinin kıyısı ve sınırları gerçek biçimine yakın görünür.
- Pencere: Sina'nın kuzeyi, Filistin, Lübnan, Ürdün'ün batısı, Suriye'nin güneybatısı.
- Sınırlar ülkelerin ortak kenarlarından çıkarılır. Bölge haritasındaki ilke burada da geçerli: Filistin'in içi
  (İsrail ile Batı Şeria / Gazze arası) ve İsrail ile Suriye arası (Golan) çizilmez.
- Gazze, Batı Şeria ve Güney Lübnan'daki yerler (mahalleler, kamplar, hastaneler, geçişler): koordinatlar
  yaklaşıktır (yüzlerce metre içinde), harita yönlendirme içindir.
Kullanım: python toplayici/bolge_haritasi_yakin.py <ne_10m_admin_0_countries.geojson> site/bolge-harita-yakin.json
"""
import json
import sys

from bolge_haritasi import _dp

PENCERE = (32.2, 29.0, 37.6, 34.9)       # batı, güney, doğu, kuzey
TOLERANS = 0.0006                       # yaklaşık 60 m
FILISTIN = {"ISR", "PSX", "PSE"}
SURIYE = "SYR"

# (ad, enlem, boylam, tür) — tür: y = yerleşim / kamp, h = hastane, g = geçiş, b = bölge adı
YERLER = [
    # Gazze şeridi, kuzeyden güneye
    ("Beyt Hanun", 31.536, 34.536, "y"), ("Beyt Lahiya", 31.553, 34.498, "y"), ("Cibaliye Kampı", 31.531, 34.483, "y"),
    ("Şati Kampı", 31.531, 34.447, "y"), ("Rimal", 31.522, 34.456, "y"), ("Tel el-Hava", 31.505, 34.432, "y"),
    ("Şucaiyye", 31.497, 34.479, "y"), ("Zeytun", 31.483, 34.455, "y"), ("Nusayrat Kampı", 31.448, 34.393, "y"),
    ("Bureyc Kampı", 31.437, 34.403, "y"), ("Mağazi Kampı", 31.418, 34.385, "y"), ("Zevayde", 31.432, 34.374, "y"),
    ("Beni Süheyla", 31.343, 34.325, "y"), ("Abasan", 31.322, 34.344, "y"), ("Mevasi", 31.360, 34.262, "y"),
    ("Tel es-Sultan", 31.307, 34.238, "y"),
    ("Şifa Hastanesi", 31.524, 34.446, "h"), ("Ehli Baptist Hastanesi", 31.505, 34.463, "h"), ("Kemal Advan Hastanesi", 31.548, 34.494, "h"),
    ("Endonezya Hastanesi", 31.547, 34.500, "h"), ("Aksa Şehitleri Hastanesi", 31.418, 34.354, "h"), ("Nasır Hastanesi", 31.346, 34.302, "h"),
    ("Avrupa Hastanesi", 31.322, 34.320, "h"),
    ("Refah Sınır Kapısı", 31.247, 34.259, "g"), ("Kerem Ebu Salim", 31.226, 34.284, "g"), ("Beyt Hanun (Erez) geçişi", 31.559, 34.565, "g"),
    ("Zikim", 31.607, 34.524, "g"),
    ("GAZZE ŞERİDİ", 31.44, 34.27, "b"),
    # Batı Şeria
    ("Cenin Kampı", 32.461, 35.290, "y"), ("Nur Şems Kampı", 32.317, 35.067, "y"), ("Tulkerim Kampı", 32.312, 35.042, "y"),
    ("Balata Kampı", 32.211, 35.287, "y"), ("Huvara", 32.152, 35.256, "y"), ("Kalandiya", 31.862, 35.217, "y"),
    ("Mesafir Yatta", 31.40, 35.10, "y"), ("Silvan", 31.770, 35.235, "y"), ("Şeyh Cerrah", 31.791, 35.229, "y"),
    ("BATI ŞERİA", 32.00, 35.32, "b"),
    # Güney Lübnan
    ("Dahiye", 33.852, 35.507, "y"), ("Bint Cübeyl", 33.120, 35.433, "y"), ("Hıyam", 33.330, 35.610, "y"),
    ("Nakura", 33.118, 35.139, "y"), ("Mercuyun", 33.360, 35.592, "y"), ("Kana", 33.209, 35.299, "y"),
]


def _kirp(halka, p):
    """Sutherland–Hodgman: halkayı dikdörtgen pencereye kırpar."""
    b, g, d, k = p
    kenarlar = [(lambda q: q[0] >= b, lambda a, c: (b, a[1] + (c[1] - a[1]) * (b - a[0]) / (c[0] - a[0]))),
                (lambda q: q[0] <= d, lambda a, c: (d, a[1] + (c[1] - a[1]) * (d - a[0]) / (c[0] - a[0]))),
                (lambda q: q[1] >= g, lambda a, c: (a[0] + (c[0] - a[0]) * (g - a[1]) / (c[1] - a[1]), g)),
                (lambda q: q[1] <= k, lambda a, c: (a[0] + (c[0] - a[0]) * (k - a[1]) / (c[1] - a[1]), k))]
    cikti = list(halka)
    for ic, kes in kenarlar:
        girdi, cikti = cikti, []
        if not girdi:
            break
        onceki = girdi[-1]
        for q in girdi:
            if ic(q):
                if not ic(onceki):
                    cikti.append(kes(onceki, q))
                cikti.append(q)
            elif ic(onceki):
                cikti.append(kes(onceki, q))
            onceki = q
    return cikti


def uret(gj):
    ulkeler = []
    for f in gj["features"]:
        p = f["properties"]
        kod = p.get("ADM0_A3") or p.get("ISO_A3")
        geo = f["geometry"]
        poli = [geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"]
        halkalar = []
        for pl in poli:
            for h in pl:
                xs = [q[0] for q in h]
                ys = [q[1] for q in h]
                if max(xs) < PENCERE[0] or min(xs) > PENCERE[2] or max(ys) < PENCERE[1] or min(ys) > PENCERE[3]:
                    continue
                halkalar.append([(round(q[0], 6), round(q[1], 6)) for q in h])
        if halkalar:
            ulkeler.append((kod, halkalar))
    # ortak kenarlar: iki ülkenin ikisinde de bulunan ardışık nokta çiftleri
    nokta_ulke = {}
    for kod, hs in ulkeler:
        for h in hs:
            for q in h:
                nokta_ulke.setdefault(q, set()).add(kod)
    parcalar = []
    for kod, hs in ulkeler:
        for h in hs:
            hat = []
            for a, c in zip(h, h[1:]):
                ortak = (nokta_ulke[a] & nokta_ulke[c]) - {kod}
                if not ortak or kod > min(ortak):            # her ortak kenarı bir kez al
                    if len(hat) > 1:
                        parcalar.append((kod, hat))
                    hat = []
                    continue
                o = min(ortak)
                ikisi = {kod, o}
                if ikisi <= FILISTIN or (ikisi & FILISTIN and SURIYE in ikisi):
                    if len(hat) > 1:
                        parcalar.append((kod, hat))
                    hat = []
                    continue
                if not hat:
                    hat = [a]
                hat.append(c)
            if len(hat) > 1:
                parcalar.append((kod, hat))
    icinde = lambda q: PENCERE[0] <= q[0] <= PENCERE[2] and PENCERE[1] <= q[1] <= PENCERE[3]  # noqa: E731
    sinir = []
    for _, hat in parcalar:
        hat = [q for q in hat if icinde(q)]
        if len(hat) > 1:
            sinir.append([[round(x, 4), round(y, 4)] for x, y in _dp(hat, TOLERANS)])
    kara = []
    for _, hs in ulkeler:
        for h in hs:
            k = _kirp(h, PENCERE)
            if len(k) >= 3:
                # kapalı halka iki yarıda sadeleştirilir (uçları aynı nokta olan bir çizgi tek parça sadeleşmez)
                m = len(k) // 2
                sade = _dp(k[:m + 1], TOLERANS)[:-1] + _dp(k[m:] + [k[0]], TOLERANS)
                kara.append([[round(x, 4), round(y, 4)] for x, y in sade])
    return {"kaynak": "Natural Earth 1:10m (kamu malı)", "pencere": PENCERE, "kara": kara, "sinir": sinir,
            "yer": [list(y) for y in YERLER]}


if __name__ == "__main__":
    veri = uret(json.load(open(sys.argv[1], encoding="utf-8")))
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(veri, f, ensure_ascii=False, separators=(",", ":"))
    print(len(veri["kara"]), "kara parçası,", len(veri["sinir"]), "sınır çizgisi,", len(veri["yer"]), "yer")
