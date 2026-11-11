"""Map positions for universities, shared by build_data.py, build_graph.py and sync_from_core_hub.py.

data-src/uni_geo.json has two parts:
  fixes  — corrections to the CORE registry (also applied to the public CC0 registry);
  campus — campus positions from OpenStreetMap (ODbL), used only to draw the map and graph.
Everything else is a city-centre position; display() spreads such points around the city
so they don't stack, and returns precision 1 (campus) or 0 (city).
"""
import json
import math
import os

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data-src", "uni_geo.json")


def load():
    with open(PATH, encoding="utf-8") as f:
        return json.load(f)


def fix(uid, lat, lon, city, geo=None):
    """Registry correction only (safe for the CC0 registry)."""
    f = (geo or load())["fixes"].get(uid)
    if not f:
        return lat, lon, city
    return f.get("lat", lat), f.get("lon", lon), f.get("city", city)


def display(rows, geo=None):
    """rows: list of (id, lat, lon). Returns {id: (lat, lon, precision)} for drawing."""
    geo = geo or load()
    out, groups, seen = {}, {}, {}
    for uid, lat, lon in sorted(rows):
        if uid in geo["campus"]:
            la, lo, _ = geo["campus"][uid]
            n = seen[(la, lo)] = seen.get((la, lo), -1) + 1  # renamed institutions share one campus
            out[uid] = (round(la + 0.004 * n, 4), round(lo + 0.004 * n, 4), 1)
            continue
        f = geo["fixes"].get(uid)
        if f:
            lat, lon = f["lat"], f["lon"]
        groups.setdefault((round(lat, 2), round(lon, 2)), []).append((uid, lat, lon))
    golden = math.pi * (3 - math.sqrt(5))
    for (glat, glon), us in groups.items():
        if len(us) == 1:
            uid, lat, lon = us[0]
            out[uid] = (round(lat, 4), round(lon, 4), 0)
            continue
        k = math.cos(math.radians(glat))
        for i, (uid, lat, lon) in enumerate(sorted(us)):
            r = 0.022 * math.sqrt(i + 0.5)  # degrees; ~2.5 km steps, a sunflower around the city point
            a = i * golden
            out[uid] = (round(glat + r * math.sin(a), 4), round(glon + r * math.cos(a) / k, 4), 0)
    return out
