"""Tarihçe haritasının gölgeli arazi zemini. AWS Terrain Tiles (Terrarium; SRTM, GMTED, ETOPO1 gibi açık kaynaklardan derlenmiş)
karolarını indirir, site/tarihce-harita.json'daki pencereye ve izdüşüme göre yeniden örnekler, tepe gölgesi ve yükseltiye göre
renk verir. Kara ve göller aynı dosyadaki SVG yollarından maskelenir. Çıktı: JPEG (ilk argüman)."""
import io, json, math, os, re, sys, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

H_ = json.load(open("site/tarihce-harita.json"))
LON0, LON1, LAT0, LAT1 = H_["pencere"]
W, H = H_["w"], H_["h"]
OLC = 3                      # çıktı = SVG ölçeğinin 3 katı
OW, OH = W * OLC, H * OLC
K = math.cos(math.radians(31.5))
s = W / ((LON1 - LON0) * K)
Z = 10


def mx(lon):
    return (lon + 180) / 360 * (2 ** Z) * 256


def my(lat):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * (2 ** Z) * 256


x0, x1 = int(mx(LON0) // 256), int(mx(LON1) // 256)
y0, y1 = int(my(LAT1) // 256), int(my(LAT0) // 256)
mos = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), dtype=np.float32)
for ty in range(y0, y1 + 1):
    for tx in range(x0, x1 + 1):
        u = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx}/{ty}.png"
        b = None
        for d in range(0 if os.environ.get("ARAZI_DENEME") else 4):
            try:
                b = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "alboroto-harita/1.0"}), timeout=60).read()
                break
            except Exception:
                time.sleep(2 + d * 3)
        if b is None:
            continue
        a = np.asarray(Image.open(io.BytesIO(b)).convert("RGB"), dtype=np.float32)
        mos[(ty - y0) * 256:(ty - y0 + 1) * 256, (tx - x0) * 256:(tx - x0 + 1) * 256] = a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

# çıktı ızgarası: x -> boylam, y -> enlem (eşdikdörtgen, cos(31.5) ölçekli; SVG ile aynı izdüşüm)
xs = np.arange(OW) / OLC
ys = np.arange(OH) / OLC
lon = LON0 + xs / (K * s)
lat = LAT1 - ys / s
px = np.array([mx(v) for v in lon]) - x0 * 256
py = np.array([my(v) for v in lat]) - y0 * 256
E = mos[np.clip(py.astype(int), 0, mos.shape[0] - 1)[:, None], np.clip(px.astype(int), 0, mos.shape[1] - 1)[None, :]]
def yumusat(a):
    p = np.pad(a, 1, mode="edge")
    return sum(p[1 + dy:1 + dy + a.shape[0], 1 + dx:1 + dx + a.shape[1]] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9


E = yumusat(E.astype(np.float32))

# tepe gölgesi
m_px = (LON1 - LON0) * K * 111320 / OW
gy, gx = np.gradient(E * 2.2, m_px)
az, alt = math.radians(315), math.radians(42)
egim = np.arctan(np.hypot(gx, gy))
yon = np.arctan2(-gx, gy)
gol = np.clip(np.sin(alt) * np.cos(egim) + np.cos(alt) * np.sin(egim) * np.cos(az - yon), 0, 1)


def maske(yollar):
    im = Image.new("L", (OW, OH), 0)
    dr = ImageDraw.Draw(im)
    for d in yollar:
        for parca in re.findall(r"M[^M]+", d):
            pts = [(float(a) * OLC, float(b) * OLC) for a, b in re.findall(r"(-?[\d.]+),(-?[\d.]+)", parca)]
            if len(pts) > 2:
                dr.polygon(pts, fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255


kara = maske(H_["komsu"] + H_["filistin"])
gl = maske(H_["gol"])
# renk: kuzeybatı (Celile, kıyı ovası, Lübnan) zeytin yeşili; güney ve doğu (Nakab, Sina, Ürdün çölü) kum ve altın tonları
dur = np.array([-450, 0, 300, 700, 1100, 1600, 2400], dtype=np.float32)
yesil = np.array([[60, 70, 50], [66, 78, 54], [80, 90, 60], [104, 108, 76], [132, 128, 94], [160, 150, 116], [190, 182, 150]], dtype=np.float32)
kum = np.array([[150, 126, 88], [204, 178, 128], [214, 190, 138], [204, 176, 124], [188, 160, 114], [176, 152, 114], [210, 200, 178]], dtype=np.float32)
ry = np.stack([np.interp(E, dur, yesil[:, i]) for i in range(3)], -1)
rk = np.stack([np.interp(E, dur, kum[:, i]) for i in range(3)], -1)
LO, LA = np.meshgrid(lon, lat)
nem = (np.clip((LA - 31.35) / 0.9, 0, 1) * np.clip((35.85 - LO) / 0.45, 0, 1)) ** 0.8   # 1: nemli kuzeybatı, 0: çöl
r = rk * (1 - nem[..., None]) + ry * nem[..., None]
kr = np.clip(r * (0.5 + 0.72 * gol)[..., None], 0, 255)
# deniz: kıyıya yakın açık, derinde koyu mavi
der = np.clip(-E / 2200, 0, 1)[..., None]
deniz = np.array([86, 150, 200]) * (1 - der) + np.array([22, 60, 104]) * der
golr = np.array([150, 205, 225], dtype=np.float32)
img = deniz * (1 - kara[..., None]) + kr * kara[..., None]
img = img * (1 - gl[..., None]) + golr * gl[..., None]
# kenarlarda karartma
yy, xx = np.mgrid[0:OH, 0:OW]
v = 1 - 0.55 * np.clip((((xx - OW / 2) / (OW / 2)) ** 2 + ((yy - OH / 2) / (OH / 2)) ** 2) - 0.35, 0, 1)
img = np.clip(img * v[..., None], 0, 255).astype(np.uint8)
Image.fromarray(img).save(sys.argv[1], quality=84, optimize=True, progressive=True)
print("arazi:", OW, OH, "karo:", (x1 - x0 + 1) * (y1 - y0 + 1))
