"""Tek seferlik: bir bbox için en yeni bulutsuz Sentinel-2 görüntüsünü enlem/boylam ızgarasına (EPSG:4326) çevirip keser.
Tarihçedeki önce/sonra karşılaştırmaları için. Ayrıca Palestine Grid (EPSG:28191) noktalarını enlem/boylama çevirir.
Kullanım: python uydu_kes.py cikti/ ad batı,güney,doğu,kuzey [genişlik] ;  PG noktaları: PG="126,114;127,115" ortam değişkeni"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gunluk_gorsel as G

cik, ad, bbox = sys.argv[1], sys.argv[2], [float(x) for x in sys.argv[3].split(",")]
en = int(sys.argv[4]) if len(sys.argv) > 4 else 1600
os.makedirs(cik, exist_ok=True)

pg = os.environ.get("PG")
if pg:
    from pyproj import Transformer
    t = Transformer.from_crs("EPSG:28191", "EPSG:4326", always_xy=True)
    sonuc = []
    for p in pg.split(";"):
        e, n = [float(x) for x in p.split(",")]
        lon, lat = t.transform(e * 1000, n * 1000)
        sonuc.append({"pg": [e, n], "lon": round(lon, 6), "lat": round(lat, 6)})
        print("PG", e, n, "→", round(lat, 6), round(lon, 6))
    json.dump(sonuc, open(os.path.join(cik, "pg.json"), "w"), indent=1)

import numpy as np
import rasterio
from rasterio.warp import reproject, Resampling
from rasterio.transform import from_bounds
fs = G._stac(gun=120, bulut=3, bbox=bbox)
gunler = {}
for f in fs:
    gunler.setdefault(f["properties"]["datetime"][:10], []).append(f)
yuk = round(en * (bbox[3] - bbox[1]) / ((bbox[2] - bbox[0]) * np.cos(np.radians((bbox[1] + bbox[3]) / 2))))
for gun in sorted(gunler, reverse=True):
    hedef = np.zeros((3, yuk, en), dtype="uint8")
    tr = from_bounds(*bbox, en, yuk)
    for f in gunler[gun]:
        with rasterio.open(f["assets"]["visual"]["href"]) as k:
            for b in range(3):
                kat = np.zeros((yuk, en), dtype="uint8")
                reproject(rasterio.band(k, b + 1), kat, dst_transform=tr, dst_crs="EPSG:4326", resampling=Resampling.bilinear, src_nodata=0, dst_nodata=0)
                hedef[b] = np.where(hedef[b] == 0, kat, hedef[b])
    bos = float((hedef.sum(axis=0) == 0).mean())
    print(gun, "boş oran", round(bos, 4))
    if bos < 0.01:
        G._kaydet(np.moveaxis(hedef, 0, -1), os.path.join(cik, ad + ".jpg"), en=en)
        json.dump({"ad": ad, "bbox": bbox, "tarih": gun, "boyut": [en, yuk], "atif": f"Copernicus Sentinel-2 ({gun[:4]}), ESA"},
                  open(os.path.join(cik, ad + ".json"), "w"), indent=1)
        print("kaydedildi", gun); break
