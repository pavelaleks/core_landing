"""One searchable index of everything in CORE's catalog -> assets/catalog-index.js

  base   CORE's own databases (data-src/catalog.json)
  prep   datasets prepared by CORE, in the cabinet (app/packages/index.json)
  layer  the regional base layer (data-src/regions.json)
  open   scholars' open datasets confirmed to hold data (assets/data.js, kind == data)

usage: python3 -I tools/build_catalog.py
"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def jsvar(path):
    s = open(os.path.join(ROOT, path), encoding="utf-8").read()
    return json.loads(s[s.index("=") + 1:].rstrip().rstrip(";"))


items = []
CAT = json.load(open(os.path.join(ROOT, "data-src", "catalog.json"), encoding="utf-8"))["datasets"]
BASE = {
    "universities": ("UZ;KZ;KG;TJ", "Education", "buy", "Universities registry: persistent IDs, names in 7 languages, links to ROR, Wikidata and OpenAlex.", "Справочник вузов: постоянные ID, названия на 7 языках, связи с ROR, Wikidata и OpenAlex.", "Universitetlar maʼlumotnomasi: doimiy ID, 7 tildagi nomlar, ROR, Wikidata va OpenAlex bilan bogʻlanish."),
    "uz_medical_facilities": ("UZ", "Medicine", "buy", "Hospitals, clinics, dental and labs in all 14 regions, with specialties, coordinates and website checks.", "Больницы, клиники, стоматологии и лаборатории всех 14 регионов: направления, координаты, проверка сайтов.", "Barcha 14 hududdagi shifoxonalar, klinikalar, stomatologiyalar va laboratoriyalar: yoʻnalishlar, koordinatalar, saytlar tekshiruvi."),
    "ca_publications": ("UZ;KZ;KG;TJ", "Research", "buy", "482,572 research works by the region's universities, linked to CORE university IDs.", "482 572 научные работы вузов региона, связанные с ID вузов CORE.", "Mintaqa universitetlarining 482 572 ta ilmiy ishi, CORE universitet ID lari bilan bogʻlangan."),
}
for d in CAT:
    c, f, st, en, ru, uz = BASE[d["slug"]]
    TUZ = {"universities": "Markaziy Osiyo universitetlari", "uz_medical_facilities": "Oʻzbekiston tibbiyot muassasalari", "ca_publications": "Markaziy Osiyo universitetlari nashrlari (OpenAlex)"}
    items.append({"t": "base", "id": d["id"], "title": {"en": d["title_en"], "ru": d["title_ru"], "uz": TUZ[d["slug"]]}, "desc": {"en": en, "ru": ru, "uz": uz},
                  "org": {"en": "CORE", "ru": "CORE"}, "c": c, "f": f, "lic": d["license"], "st": st, "n": d["records"], "href": "datasets/" + d["slug"] + ".html"})

for p in json.load(open(os.path.join(ROOT, "app", "packages", "index.json"), encoding="utf-8")):
    items.append({"t": "prep", "id": p["slug"], "title": {"en": p["title_en"], "ru": p["title_ru"], "uz": p["title_uz"]},
                  "desc": {"en": "; ".join(p["added_en"][:2]) + ".", "ru": "; ".join(p["added_ru"][:2]) + ".", "uz": "; ".join(p["added_ru"][:2]) + "."},
                  "org": {"en": p["uni"], "ru": p["uni_ru"]}, "c": p["country"], "f": p["field_en"], "lic": "CC-BY-4.0", "st": "demo", "n": p["rows"], "y": int(p["year"]),
                  "href": "app/index.html#demo/" + p["slug"]})

RG = json.load(open(os.path.join(ROOT, "data-src", "regions.json"), encoding="utf-8"))
items.append({"t": "layer", "id": "regions", "title": {"en": "Central Asia's 48 regions: demographics, institutions, surveys", "ru": "48 регионов Центральной Азии: демография, учреждения, опросы", "uz": "Markaziy Osiyoning 48 hududi: demografiya, muassasalar, soʻrovlar"},
              "desc": {"en": "Official population structure joined with universities, research, clinics and survey results by ISO region code.", "ru": "Официальная структура населения, связанная с вузами, наукой, клиниками и опросами по коду региона ISO.", "uz": "Rasmiy aholi tarkibi universitetlar, ilm-fan, klinikalar va soʻrovlar bilan ISO hudud kodi orqali bogʻlangan."},
              "org": {"en": "CORE", "ru": "CORE"}, "c": "UZ;KZ;KG;TJ", "f": "Demography", "lic": "CC-BY-IGO + CORE", "st": "buy", "n": len(RG["regions"]), "href": "regions.html"})

D = jsvar("assets/data.js")
for r in D["researchDatasets"]:
    if r.get("k") != "data":
        continue
    items.append({"t": "open", "id": r["w"], "title": {"en": r["t"]}, "org": {"en": r["u"]}, "c": r["c"], "f": r["f"], "lic": r["lic"] or "", "st": "open",
                  "y": r["y"], "fm": r.get("fm", ""), "href": r["doi"], "ca": 1 if r.get("ca") else 0})

out = "window.CORE_CATALOG=" + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";"
open(os.path.join(ROOT, "assets", "catalog-index.js"), "w", encoding="utf-8").write(out)
from collections import Counter
print(len(items), Counter(i["t"] for i in items), round(len(out) / 1024), "KB")
