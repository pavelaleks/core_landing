"""Regional base layer: one row per first-level region of UZ, KZ, KG, TJ, joining
official demographics with CORE's own registries and research data.

usage: python3 -I tools/build_regions.py <cod-ps dir> <geoboundaries dir>

  <cod-ps dir>        HDX COD-PS admin-1 CSVs (UNFPA / OCHA, CC BY-IGO):
                      uzb_admpop_adm1_v2.csv, kaz_admpop_adm1_2023.csv,
                      kyrgyzstan_population_statistics_2018_adm1_v2.csv, tjk_admpop_adm1_2019.csv
  <geoboundaries dir> geoBoundaries gbOpen ADM1 simplified GeoJSON (UZB, KAZ, KGZ, TJK; ODbL),
                      used only to place universities into regions and to find region centres.

writes data-src/regions.json and assets/regions.js
"""
import csv
import collections
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
COD, GB = sys.argv[1], sys.argv[2]


def num(v):
    v = (v or "").replace(",", "").replace(" ", "").strip()
    return int(float(v)) if v else None


# ------------------------------------------------------------------ regions (ISO 3166-2)
R = {}
def reg(iso, en, ru, uz):
    R[iso] = {"iso": iso, "country": iso[:2], "name": {"en": en, "ru": ru, "uz": uz}}

for iso, en, ru, uz in [
    ("UZ-AN", "Andijan Region", "Андижанская область", "Andijon viloyati"), ("UZ-BU", "Bukhara Region", "Бухарская область", "Buxoro viloyati"),
    ("UZ-JI", "Jizzakh Region", "Джизакская область", "Jizzax viloyati"), ("UZ-QA", "Kashkadarya Region", "Кашкадарьинская область", "Qashqadaryo viloyati"),
    ("UZ-NW", "Navoiy Region", "Навоийская область", "Navoiy viloyati"), ("UZ-NG", "Namangan Region", "Наманганская область", "Namangan viloyati"),
    ("UZ-SA", "Samarkand Region", "Самаркандская область", "Samarqand viloyati"), ("UZ-SU", "Surkhandarya Region", "Сурхандарьинская область", "Surxondaryo viloyati"),
    ("UZ-SI", "Syrdarya Region", "Сырдарьинская область", "Sirdaryo viloyati"), ("UZ-TK", "Tashkent (city)", "Ташкент (город)", "Toshkent shahri"),
    ("UZ-TO", "Tashkent Region", "Ташкентская область", "Toshkent viloyati"), ("UZ-FA", "Fergana Region", "Ферганская область", "Fargʻona viloyati"),
    ("UZ-XO", "Khorezm Region", "Хорезмская область", "Xorazm viloyati"), ("UZ-QR", "Karakalpakstan", "Каракалпакстан", "Qoraqalpogʻiston"),
    ("KZ-10", "Abai Region", "Абайская область", "Abay viloyati"), ("KZ-11", "Akmola Region", "Акмолинская область", "Aqmola viloyati"),
    ("KZ-15", "Aktobe Region", "Актюбинская область", "Aqtoʻbe viloyati"), ("KZ-75", "Almaty (city)", "Алматы (город)", "Olmaota shahri"),
    ("KZ-19", "Almaty Region", "Алматинская область", "Olmaota viloyati"), ("KZ-71", "Astana (city)", "Астана (город)", "Astana shahri"),
    ("KZ-23", "Atyrau Region", "Атырауская область", "Atirau viloyati"), ("KZ-63", "East Kazakhstan Region", "Восточно-Казахстанская область", "Sharqiy Qozogʻiston viloyati"),
    ("KZ-31", "Jambyl Region", "Жамбылская область", "Jambil viloyati"), ("KZ-33", "Jetisu Region", "Жетысуская область", "Yettisuv viloyati"),
    ("KZ-35", "Karaganda Region", "Карагандинская область", "Qaragʻandi viloyati"), ("KZ-39", "Kostanay Region", "Костанайская область", "Qoʻstanay viloyati"),
    ("KZ-43", "Kyzylorda Region", "Кызылординская область", "Qiziloʻrda viloyati"), ("KZ-47", "Mangystau Region", "Мангистауская область", "Mangʻishloq viloyati"),
    ("KZ-59", "North Kazakhstan Region", "Северо-Казахстанская область", "Shimoliy Qozogʻiston viloyati"), ("KZ-55", "Pavlodar Region", "Павлодарская область", "Pavlodar viloyati"),
    ("KZ-79", "Shymkent (city)", "Шымкент (город)", "Chimkent shahri"), ("KZ-61", "Turkistan Region", "Туркестанская область", "Turkiston viloyati"),
    ("KZ-62", "Ulytau Region", "Улытауская область", "Ulitau viloyati"), ("KZ-27", "West Kazakhstan Region", "Западно-Казахстанская область", "Gʻarbiy Qozogʻiston viloyati"),
    ("KG-Y", "Issyk-Kul Region", "Иссык-Кульская область", "Issiqkoʻl viloyati"), ("KG-J", "Jalal-Abad Region", "Джалал-Абадская область", "Jalolobod viloyati"),
    ("KG-N", "Naryn Region", "Нарынская область", "Norin viloyati"), ("KG-B", "Batken Region", "Баткенская область", "Botkent viloyati"),
    ("KG-O", "Osh Region", "Ошская область", "Oʻsh viloyati"), ("KG-T", "Talas Region", "Таласская область", "Talas viloyati"),
    ("KG-C", "Chuy Region", "Чуйская область", "Chuy viloyati"), ("KG-GB", "Bishkek (city)", "Бишкек (город)", "Bishkek shahri"),
    ("KG-GO", "Osh (city)", "Ош (город)", "Oʻsh shahri"),
    ("TJ-GB", "Gorno-Badakhshan", "Горно-Бадахшанская АО", "Togʻli Badaxshon"), ("TJ-SU", "Sughd Region", "Согдийская область", "Sugʻd viloyati"),
    ("TJ-KT", "Khatlon Region", "Хатлонская область", "Xatlon viloyati"), ("TJ-DU", "Dushanbe (city)", "Душанбе (город)", "Dushanbe shahri"),
    ("TJ-RA", "Districts of Republican Subordination", "Районы республиканского подчинения", "Respublikaga boʻysunuvchi tumanlar"),
]:
    reg(iso, en, ru, uz)

# ------------------------------------------------------------------ demographics (COD-PS)
def age_shares(row, prefix_fn):
    """prefix_fn(lo, hi) -> population in [lo, hi] years; returns shares 0–14, 15–64, 65+."""
    a = prefix_fn(0, 14); b = prefix_fn(15, 64); c = prefix_fn(65, 200)
    t = (a or 0) + (b or 0) + (c or 0)
    return {"age_0_14": round(a / t, 3), "age_15_64": round(b / t, 3), "age_65_plus": round(c / t, 3)} if t else {}

def band_sum(row, keys):
    def f(lo, hi):
        s = 0
        for k, (a, b) in keys.items():
            if a >= lo and b <= hi:
                s += num(row.get(k)) or 0
        return s
    return f

DEMO = {}
UZ = {"UZ03": "UZ-AN", "UZ06": "UZ-BU", "UZ08": "UZ-JI", "UZ10": "UZ-QA", "UZ12": "UZ-NW", "UZ14": "UZ-NG", "UZ18": "UZ-SA", "UZ22": "UZ-SU",
      "UZ24": "UZ-SI", "UZ26": "UZ-TK", "UZ27": "UZ-TO", "UZ30": "UZ-FA", "UZ33": "UZ-XO", "UZ35": "UZ-QR"}
for r in csv.DictReader(open(os.path.join(COD, "uzb_admpop_adm1_v2.csv"), encoding="utf-8-sig")):
    if r["ADM1_PCODE"] in UZ:
        t = num(r["T_TL"])
        DEMO[UZ[r["ADM1_PCODE"]]] = {"population": t, "year": 2018, "urban_share": round(num(r["U_TL"]) / t, 3), "female_share": round(num(r["F_TL"]) / t, 3),
                                     "source": "Uzbek government via OCHA COD-PS (HDX), CC BY-IGO"}
KZ = {"KAZ001": "KZ-10", "KAZ002": "KZ-11", "KAZ003": "KZ-15", "KAZ004": "KZ-75", "KAZ005": "KZ-19", "KAZ006": "KZ-71", "KAZ007": "KZ-23", "KAZ008": "KZ-63",
      "KAZ009": "KZ-31", "KAZ010": "KZ-33", "KAZ011": "KZ-35", "KAZ012": "KZ-39", "KAZ013": "KZ-43", "KAZ014": "KZ-47", "KAZ015": "KZ-59", "KAZ016": "KZ-55",
      "KAZ017": "KZ-79", "KAZ018": "KZ-61", "KAZ019": "KZ-62", "KAZ020": "KZ-27"}
for r in csv.DictReader(open(os.path.join(COD, "kaz_admpop_adm1_2023.csv"), encoding="utf-8-sig")):
    if r["ADM1_PCODE"] in KZ:
        t = num(r["T_TL"])
        keys = {}
        for k in r:
            m = re.fullmatch(r"T_(\d\d)_(\d\d)", k) or re.fullmatch(r"T_(\d\d)(Plus)", k)
            if m: keys[k] = (int(m.group(1)), 200 if m.group(2) == "Plus" else int(m.group(2)))
        DEMO[KZ[r["ADM1_PCODE"]]] = {"population": t, "year": 2023, "female_share": round(num(r["F_TL"]) / t, 3),
                                     **age_shares(r, band_sum(r, keys)), "source": "National Statistics Office of Kazakhstan via UNFPA COD-PS (HDX), CC BY-IGO"}
KG = {"Issyk-Kul": "KG-Y", "Jalal-Abad": "KG-J", "Naryn": "KG-N", "Batken": "KG-B", "Osh": "KG-O", "Talas": "KG-T", "Chui": "KG-C", "Bishkek (city)": "KG-GB", "Osh (city)": "KG-GO"}
for r in csv.DictReader(open(os.path.join(COD, "kyrgyzstan_population_statistics_2018_adm1_v2.csv"), encoding="cp1251")):
    n = (r.get("admin1Name_en") or "").strip()
    if n in KG:
        t = num(r["T_TL"])
        keys = {}
        for k in r:
            m = re.search(r"from_(\d+)to(\d+)", k) or re.search(r"_(100)and_above", k)
            if m and "male" in k and "female" not in k or (m and "female" in k):
                lo = int(m.group(1)); hi = int(m.group(2)) if m.lastindex == 2 else 200
                keys[k] = (lo, hi)
        DEMO[KG[n]] = {"population": t, "year": 2018, "urban_share": round(num(r["Urban_pop"]) / t, 3), "female_share": round(num(r["F_TL"]) / t, 3),
                       **age_shares(r, band_sum(r, keys)), "source": "National Statistical Committee of the Kyrgyz Republic via OCHA COD-PS (HDX), CC BY-IGO"}
TJ = {"GBAO": "TJ-GB", "SUGHD REGION": "TJ-SU", "KHATLON REGION": "TJ-KT", "DUSHANBE": "TJ-DU", "DISTRICT SUBORDINATION OF THE REPUBLIC": "TJ-RA"}
for r in csv.DictReader(open(os.path.join(COD, "tjk_admpop_adm1_2019.csv"), encoding="utf-8-sig")):
    n = r["ADM1_EN"].strip()
    if n in TJ:
        t = num(r["T_TL"])
        keys = {}
        for k in r:
            m = re.fullmatch(r"T_(\d\d)_(\d\d)", k) or re.fullmatch(r"T_(\d+)(Plus)", k)
            if m: keys[k] = (int(m.group(1)), 200 if m.group(2) == "Plus" else int(m.group(2)))
        DEMO[TJ[n]] = {"population": t, "year": 2019, "female_share": round(num(r["F_TL"]) / t, 3),
                       **age_shares(r, band_sum(r, keys)), "source": "Statistics Agency of Tajikistan and UNFPA via COD-PS (HDX), CC BY-IGO"}

# ------------------------------------------------------------------ polygons for placing points (geoBoundaries 2017, ODbL)
GBMAP = {"Andijan Region": "UZ-AN", "Namangan Region": "UZ-NG", "Fergana Region": "UZ-FA", "Republic of Karakalpakstan": "UZ-QR", "Xorazm Region": "UZ-XO",
         "Navoiy Region": "UZ-NW", "Surxondaryo Region": "UZ-SU", "Samarqand Region": "UZ-SA", "Tashkent Region": "UZ-TO", "Sirdaryo Region": "UZ-SI",
         "Jizzakh Region": "UZ-JI", "Bukhara Region": "UZ-BU", "Qashqadaryo Region": "UZ-QA", "Tashkent": "UZ-TK",
         "Pavlodar Region": "KZ-55", "Jambyl Region": "KZ-31", "Kostanay Region": "KZ-39", "Mangystau Region": "KZ-47", "Karaganda Region": "KZ-35",
         "Kyzylorda Region": "KZ-43", "East Kazakhstan Region": "KZ-63", "Aktobe Region": "KZ-15", "Atyrau Region": "KZ-23", "South Kazakhstan Region": "KZ-61",
         "Akmola Region": "KZ-11", "Almaty Region": "KZ-19", "North Kazakhstan Region": "KZ-59", "Almaty": "KZ-75", "West Kazakhstan Region": "KZ-27", "Astana": "KZ-71",
         "Batken Region": "KG-B", "Osh Region": "KG-O", "Talas Region": "KG-T", "Jalal-Abad Region": "KG-J", "Issyk-Kul Region": "KG-Y", "Chuy Region": "KG-C", "Naryn Region": "KG-N",
         "Sughd Region": "TJ-SU", "Gorno-Badakhshan Autonomous Region": "TJ-GB", "Districts of Republican Subordination": "TJ-RA", "Khatlon Region": "TJ-KT", "Dushanbe": "TJ-DU"}
POLY = []
for c in ("UZB", "KAZ", "KGZ", "TJK"):
    for f in json.load(open(os.path.join(GB, c + ".geojson")))["features"]:
        g = f["geometry"]; iso = GBMAP[f["properties"]["shapeName"]]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        POLY.append((iso, polys))

def inside(lon, lat, ring):
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i][:2]; x2, y2 = ring[i - 1][:2]
        if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
            c = not c
    return c

def region_at(lon, lat):
    for iso, polys in POLY:
        for p in polys:
            if inside(lon, lat, p[0]) and not any(inside(lon, lat, h) for h in p[1:]):
                return iso
    return None

# regions created after 2017 or cities inside an older polygon: decided by city name
CITY = {r"semey|semipalatinsk|семей|ayagoz|аягоз|kurchatov|курчатов": "KZ-10", r"taldyk|талдык|zharkent|жаркент|tekeli|текели": "KZ-33",
        r"zhezkazgan|жезказган|satpayev|satbayev|сатпаев|ulytau": "KZ-62", r"shymkent|шымкент|чимкент": "KZ-79",
        r"^bishkek|^бишкек": "KG-GB", r"^osh$|^ош$": "KG-GO"}

def centroid(polys):
    ring = max((p[0] for p in polys), key=len)
    return round(sum(p[1] for p in ring) / len(ring), 3), round(sum(p[0] for p in ring) / len(ring), 3)

CENTER = {}
for iso, polys in POLY:
    CENTER.setdefault(iso, centroid(polys))
CENTER.update({"KZ-10": (50.41, 80.23), "KZ-33": (45.02, 78.37), "KZ-62": (47.79, 67.71), "KZ-79": (42.32, 69.59), "KZ-61": (43.30, 68.25),
               "KG-GB": (42.87, 74.59), "KG-GO": (40.53, 72.80), "UZ-TK": (41.31, 69.28), "KZ-75": (43.24, 76.89), "KZ-71": (51.13, 71.43), "TJ-DU": (38.56, 68.78)})

# ------------------------------------------------------------------ CORE layers
def js(path, var):
    s = open(os.path.join(ROOT, path), encoding="utf-8").read()
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))

D = js("assets/data.js", "CORE_DATA"); G = js("assets/graph.js", "CORE_GRAPH")
uni_region, unplaced = {}, []
for u in D["unis"]:
    uid, lat, lon, city, works = u[0], u[3], u[4], (u[5] or "").strip().lower(), u[6]
    iso = next((v for k, v in CITY.items() if re.search(k, city)), None) or region_at(lon, lat)
    if iso == "KZ-61" and re.search(r"shymkent|шымкент", city): iso = "KZ-79"
    if iso and iso[:2] == u[2]:
        uni_region[uid] = iso
    else:
        unplaced.append((uid, city, iso))
L = collections.defaultdict(lambda: {"universities": 0, "works": 0, "open_datasets": 0, "clinics": 0, "clinic_hospitals": 0})
for u in D["unis"]:
    iso = uni_region.get(u[0])
    if iso: L[iso]["universities"] += 1; L[iso]["works"] += u[6] or 0
for d in G["datasets"]:
    iso = uni_region.get(d[0])
    if iso: L[iso]["open_datasets"] += 1
for m in D["med"]:
    if m[4] in R:
        L[m[4]]["clinics"] += 1
        if m[2] == "hospital": L[m[4]]["clinic_hospitals"] += 1

# behaviour: surveys prepared by CORE, tied to their region
BEHAV = {}
ins = os.path.join(ROOT, "app", "packages", "index.json")
if os.path.exists(ins):
    for p in json.load(open(ins, encoding="utf-8")):
        if p["slug"] == "insurance-literacy-syrdarya":
            s = p["summary"]["segments"]
            BEHAV["UZ-SI"] = [{"survey": p["title_en"], "survey_ru": p["title_ru"], "survey_uz": p["title_uz"],"university": p["uni"], "year": 2026, "n": s["all"]["n"],
                               "indicators": {"insurance_high_inclusion_pct": s["all"]["high_inclusion_pct"], "insurance_high_inclusion_pct_urban": s["urban"]["high_inclusion_pct"],
                                              "insurance_high_inclusion_pct_rural": s["rural"]["high_inclusion_pct"], "intention_to_buy_1_5": s["all"]["intention"],
                                              "trust_in_insurers_1_5": s["all"]["trust"]},
                               "link": "app/index.html#ds/insurance-literacy-syrdarya"}]

out = []
for iso, r in R.items():
    d = DEMO.get(iso, {}); l = L[iso]; pop = d.get("population")
    row = {**r, "center": CENTER.get(iso), "demographics": d,
           "core": {**l, "clinics_per_100k": round(l["clinics"] / pop * 1e5, 1) if pop and r["country"] == "UZ" else None,
                    "universities_per_million": round(l["universities"] / pop * 1e6, 2) if pop else None},
           "behaviour": BEHAV.get(iso, [])}
    out.append(row)
meta = {"about": "CORE regional base layer: first-level regions of Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan with official demographics and CORE registries, joined by ISO 3166-2 code.",
        "sources": {"demographics": "OCHA / UNFPA Common Operational Datasets — Population Statistics (HDX), from national statistics offices; CC BY-IGO",
                    "region_placement": "geoBoundaries gbOpen ADM1 (OpenStreetMap; ODbL), used only to place universities into regions; post-2017 regions decided by city",
                    "core": "CORE registries: universities (CC0), Uzbekistan medical facilities (ODbL), research works (OpenAlex, CC0), checked scholar datasets",
                    "behaviour": "Surveys prepared by CORE from university datasets (CC BY 4.0)"},
        "years": {"UZ": 2018, "KZ": 2023, "KG": 2018, "TJ": 2019}, "unplaced_universities": len(unplaced)}
json.dump({"meta": meta, "regions": out}, open(os.path.join(ROOT, "data-src", "regions.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
open(os.path.join(ROOT, "assets", "regions.js"), "w", encoding="utf-8").write("window.CORE_REGIONS=" + json.dumps({"meta": meta, "regions": out}, ensure_ascii=False, separators=(",", ":")) + ";")
print(len(out), "regions;", "with demographics", sum(1 for o in out if o["demographics"]), "; unis placed", len(uni_region), "of", len(D["unis"]), "; unplaced", unplaced[:12])
