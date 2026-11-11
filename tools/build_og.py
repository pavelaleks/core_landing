"""Render assets/og.png (1200x630) — the social preview card — from geo.js and data.js.

usage: python3 -I tools/build_og.py assets/geo.js assets/data.js assets/og.png
"""
import json
import math
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

GEO, DATA, OUT = sys.argv[1:4]
geo = json.loads(open(GEO, encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
data = json.loads(open(DATA, encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))

W, H, SS = 1200, 630, 2  # supersample for smooth dots
img = Image.new("RGB", (W * SS, H * SS), (7, 9, 12))
d = ImageDraw.Draw(img, "RGBA")

# map viewport on the right
lon0, lon1, lat0, lat1 = 46.0, 88.0, 35.0, 55.8
k = math.cos(math.radians(45))
mx0, my0, mw, mh = 520 * SS, 60 * SS, 660 * SS, 520 * SS
s = min(mw / ((lon1 - lon0) * k), mh / (lat1 - lat0))
P = lambda lon, lat: (mx0 + (lon - lon0) * k * s, my0 + (lat1 - lat) * s)

def inside(lon, lat, ring):
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i]; x2, y2 = ring[i - 1]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            c = not c
    return c

# glow
glow = Image.new("RGB", img.size, (0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([mx0 + 60 * SS, my0 + 120 * SS, mx0 + mw - 40 * SS, my0 + mh], fill=(14, 60, 54))
glow = glow.filter(ImageFilter.GaussianBlur(120 * SS))
img = Image.blend(img, glow, 0.55)
d = ImageDraw.Draw(img, "RGBA")

# dot-matrix land + outlines
step = 0.45
lat = lat0
while lat < lat1:
    lon = lon0
    while lon < lon1:
        for c, rings in geo.items():
            if any(inside(lon, lat, r) for r in rings):
                x, y = P(lon, lat); r = 1.6 * SS
                d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 34))
                break
        lon += step / k
    lat += step
for c, rings in geo.items():
    for ring in rings:
        d.line([P(*p) for p in ring] + [P(*ring[0])], fill=(61, 219, 193, 90) if c != "TM" else (140, 150, 160, 50), width=2 * SS)

# clinics and universities
for m in data["med"]:
    x, y = P(m[1], m[0]); r = (2.6 if m[3] >= 45 else 1.6) * SS
    d.ellipse([x - r, y - r, x + r, y + r], fill=(245, 165, 36, 210 if m[3] >= 45 else 120))
for u in data["unis"]:
    x, y = P(u[4], u[3]); r = (3 + min(6, math.sqrt(u[6] or 0) / 16)) * SS
    d.ellipse([x - r * 2.4, y - r * 2.4, x + r * 2.4, y + r * 2.4], fill=(61, 219, 193, 26))
    d.ellipse([x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7], fill=(61, 219, 193, 255))

# text
def font(path, size, idx=0):
    try:
        return ImageFont.truetype(path, size * SS, index=idx)
    except Exception:
        return ImageFont.load_default()
F = "/System/Library/Fonts/HelveticaNeue.ttc"
bold, reg, mono = font(F, 58, 1), font(F, 25, 0), font("/System/Library/Fonts/SFNSMono.ttf", 18)
x0 = 64 * SS
# logo rings
cx, cy = x0 + 18 * SS, 78 * SS
for rr, a in ((17, 90), (10, 180)):
    d.ellipse([cx - rr * SS, cy - rr * SS, cx + rr * SS, cy + rr * SS], outline=(233, 237, 241, a), width=3 * SS)
d.ellipse([cx - 4 * SS, cy - 4 * SS, cx + 4 * SS, cy + 4 * SS], fill=(61, 219, 193))
d.text((x0 + 48 * SS, 62 * SS), "CORE", font=font(F, 30, 1), fill=(233, 237, 241))
y = 200 * SS
for line in ("Central Asia's", "knowledge,", "licensed for AI"):
    d.text((x0, y), line, font=bold, fill=(61, 219, 193) if line.startswith("licensed") else (233, 237, 241))
    y += 68 * SS
d.text((x0, y + 18 * SS), "Expert-verified, rights-cleared data", font=reg, fill=(160, 170, 182))
d.text((x0, y + 52 * SS), "from universities of UZ · KZ · KG · TJ", font=reg, fill=(160, 170, 182))
d.text((x0, 560 * SS), "397 universities · 482K works · 548 datasets", font=mono, fill=(110, 120, 132))

img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, optimize=True)
print("saved", OUT, img.size)
