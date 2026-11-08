"""Instagram kartları için karanlık bölge haritası: olayın yeri parlayan (ya da yas tonunda sönük kırmızı) bir noktayla.

Sınırlar Natural Earth (kamu malı) verisinden, world-atlas paketinin TopoJSON biçiminden. Dosya ilk kullanımda indirilir ve
data/harita/ altında saklanır (veri dalında kalır, her çalıştırmada yeniden indirilmez).
"""
import json
import math
import os
import urllib.request

ADRES = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json"
_cokgen = None


def _indir(kok):
    yol = os.path.join(kok, "data", "harita", "ulkeler-50m.json")
    if not os.path.isfile(yol):
        os.makedirs(os.path.dirname(yol), exist_ok=True)
        try:
            with urllib.request.urlopen(urllib.request.Request(ADRES, headers={"User-Agent": "zbs-toplayici"}), timeout=60) as r:
                veri = r.read()
            json.loads(veri)
            with open(yol, "wb") as f:
                f.write(veri)
        except Exception:
            return None
    try:
        return json.load(open(yol, encoding="utf-8"))
    except Exception:
        return None


def _coz(topo):
    """TopoJSON -> [(halka [(lon, lat), ...]), ...] (dış ve iç halkalar ayrımı yapılmaz; evenodd dolgu yeter)."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    yaylar = []
    for yay in topo["arcs"]:
        x = y = 0
        nok = []
        for dx, dy in yay:
            x += dx
            y += dy
            nok.append((x * sx + tx, y * sy + ty))
        yaylar.append(nok)

    def halka(dizin):
        h = []
        for i in dizin:
            parca = yaylar[i] if i >= 0 else list(reversed(yaylar[~i]))
            h.extend(parca[1:] if h else parca)
        return h

    cikti = []
    for g in topo["objects"]["countries"]["geometries"]:
        if g.get("type") == "Polygon":
            cikti += [halka(r) for r in g["arcs"]]
        elif g.get("type") == "MultiPolygon":
            for p in g["arcs"]:
                cikti += [halka(r) for r in p]
    return cikti


def halkalar(kok):
    global _cokgen
    if _cokgen is None:
        topo = _indir(kok)
        _cokgen = _coz(topo) if topo else []
    return _cokgen


def harita(kok, lat, lon, ad, ton, kutu, yaricap=6.0, kimlik="hr"):
    """kutu: (x, y, w, h) kart üzerinde haritanın kaplayacağı alan. yaricap: merkezden kenara derece (yatay).
    Döndürür: SVG parçası (veri yoksa boş)."""
    cokgenler = halkalar(kok)
    if not cokgenler:
        return ""
    x0, y0, w, h = kutu
    kx = w / (2 * yaricap)                                 # boylam derecesi başına piksel
    ky = kx / math.cos(math.radians(lat))                  # enlem derecesi bu enlemde daha uzun görünür
    lon_ol = lambda lo: x0 + w / 2 + (lo - lon) * kx
    lat_ol = lambda la: y0 + h / 2 - (la - lat) * ky
    bat, dogu = lon - yaricap * 1.6, lon + yaricap * 1.6
    guney, kuzey = lat - yaricap * 1.6, lat + yaricap * 1.6
    yollar = []
    for r in cokgenler:
        if not r or all(p[0] < bat or p[0] > dogu or p[1] < guney or p[1] > kuzey for p in r[::max(1, len(r) // 40)]):
            continue
        d = "M" + "L".join(f"{lon_ol(a):.1f} {lat_ol(b):.1f}" for a, b in r) + "Z"
        yollar.append(d)
    if not yollar:
        return ""
    kara, sinir = ("#15191d", "#2b3137") if ton == "yas" else ("#0f1a16", "#1f3a30")
    nokta = "#c7303d" if ton == "yas" else "#19e68c"
    px, py = lon_ol(lon), lat_ol(lat)
    halka_ = "".join(f'<circle cx="{px:.0f}" cy="{py:.0f}" r="{r_}" fill="none" stroke="{nokta}" stroke-width="2" opacity="{o}"/>'
                     for r_, o in ((26, .55), (52, .3), (88, .14)))
    parla = "" if ton == "yas" else ' filter="url(#hafif)"'
    return (f'<defs><clipPath id="{kimlik}k"><rect x="{x0}" y="{y0}" width="{w}" height="{h}"/></clipPath>'
            f'<radialGradient id="{kimlik}m" cx=".5" cy=".5" r=".5"><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>'
            f'<mask id="{kimlik}s"><rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="url(#{kimlik}m)"/></mask></defs>'
            f'<g clip-path="url(#{kimlik}k)" mask="url(#{kimlik}s)">'
            f'<path d="{"".join(yollar)}" fill="{kara}" stroke="{sinir}" stroke-width="1.6" fill-rule="evenodd"/>'
            f'{halka_}<circle cx="{px:.0f}" cy="{py:.0f}" r="10" fill="{nokta}"{parla}/></g>'
            f'<text x="{px + 22:.0f}" y="{py - 18:.0f}" font-family="Inter Display, Inter, sans-serif" font-weight="800" font-size="26" '
            f'letter-spacing="2" fill="{nokta}" opacity=".9">{_buyuk(ad)}</text>')


def _buyuk(s):
    import html
    return html.escape(str(s or "").replace("i", "İ").replace("ı", "I").upper())
