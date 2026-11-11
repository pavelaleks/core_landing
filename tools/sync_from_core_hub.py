"""Refresh data-src/ — the public snapshot the site is built from — out of a local core-hub checkout.

Only public fields leave core-hub: no storage paths, owners, internal notes, author names,
contacts of individuals or paid enrichment fields. Run it, then `python3 tools/build_site.py`.

usage: python3 -I tools/sync_from_core_hub.py <path-to-core-hub>
"""
import csv
import hashlib
import json
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import uni_geo  # noqa: E402

HUB = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data-src")
os.makedirs(OUT, exist_ok=True)
DS = os.path.join(HUB, "db", "datasets")

# ------------------------------------------------------------------ editorial layer (EN/RU text the site shows)
EDITORIAL = {
    "universities": {
        "description_en": "Registry of higher-education institutions in Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan with persistent CORE IDs, names in national languages, Russian and English, city and coordinates, website, ROR / Wikidata / OpenAlex identifiers and research output. Every other CORE dataset links to these IDs.",
        "description_ru": "Справочник вузов Узбекистана, Казахстана, Кыргызстана и Таджикистана с постоянными ID CORE, названиями на национальных языках, русском и английском, городом и координатами, сайтом, идентификаторами ROR / Wikidata / OpenAlex и научной продуктивностью. Все остальные датасеты CORE ссылаются на эти ID.",
        "adds_en": ["Persistent CORE IDs that never change", "Names reconciled across seven languages and scripts", "One record per institution merged from Wikidata, ROR and OpenAlex", "Links to every publication and dataset in the CORE graph"],
        "adds_ru": ["Постоянные ID CORE, которые не меняются", "Названия, сведённые на семи языках и письменностях", "Одна запись на вуз, собранная из Wikidata, ROR и OpenAlex", "Связи со всеми публикациями и датасетами графа CORE"],
        "public_sample": "free and complete (CC0)",
        "withheld": [],
    },
    "uz_medical_facilities": {
        "description_en": "2,982 medical facilities in Uzbekistan (excluding pharmacies) across all 14 regions: type, ownership, ISO 3166-2 region, coordinates, specialties, website languages and a 0–100 medical-tourism readiness index.",
        "description_ru": "2 982 медучреждения Узбекистана (без аптек) во всех 14 регионах: тип, форма собственности, регион ISO 3166-2, координаты, специализации, языки сайта и индекс готовности к медтуризму 0–100.",
        "adds_en": ["Deduplicated and normalized OpenStreetMap records", "Website checks: languages, international-patient signals, accreditation", "Medical-tourism readiness index 0–100 (licensed)", "Regular refresh under subscription"],
        "adds_ru": ["Записи OpenStreetMap без дублей и в едином формате", "Проверка сайтов: языки, работа с иностранцами, аккредитация", "Индекс готовности к медтуризму 0–100 (по лицензии)", "Регулярные обновления по подписке"],
        "withheld": ["readiness_score", "phones", "website", "email", "telegram", "whatsapp", "instagram", "facebook", "services_site", "intl_signals", "accreditation", "prices_on_site", "site_ok", "site_note", "website_final", "site_phones", "beds", "emergency", "opening_hours", "wheelchair", "license_no", "inn"],
    },
    "ca_publications": {
        "description_en": "482,572 research works involving 299 universities in UZ, KZ, KG and TJ from OpenAlex: metadata, topics, venues, open-access status, funders and co-authoring countries. Every work is linked to CORE university IDs.",
        "description_ru": "482 572 научные работы с участием 299 вузов UZ, KZ, KG и TJ из OpenAlex: метаданные, темы, журналы, открытый доступ, фонды и страны соавторов. Каждая работа связана с ID вузов CORE.",
        "adds_en": ["Every work linked to CORE university IDs, fixing name variants", "Topic, field and SDG classification in one table", "Co-authorship links between universities and countries", "Abstracts and full text only where the work's license allows"],
        "adds_ru": ["Каждая работа связана с ID вузов CORE, варианты названий сведены", "Темы, области и цели устойчивого развития в одной таблице", "Связи соавторства между вузами и странами", "Аннотации и тексты — только если это разрешает лицензия работы"],
        "withheld": ["abstracts", "author names", "ORCID"],
    },
}

FIELD_EN = {
    # universities (curated public fields)
    "id": "Persistent CORE ID (UNI-…)", "country": "Country, ISO 3166-1 alpha-2", "name": "Primary name",
    "name_national": "Name in the national language", "name_ru": "Name in Russian", "name_en": "Name in English",
    "acronyms": "Acronyms, separated by '; '", "city": "City", "lat": "Latitude, WGS84", "lon": "Longitude, WGS84",
    "website": "Official website", "founded": "Year founded", "ror": "ROR ID", "wikidata": "Wikidata QID",
    "openalex": "OpenAlex institution ID", "works_count": "Research works in OpenAlex", "cited_by_count": "Citations in OpenAlex", "h_index": "h-index",
    # medical
    "uid": "Persistent CORE ID (UZM-…)", "name_latin": "Name, Latin script", "facility_type": "Facility type (OSM)",
    "ownership": "Ownership", "region_code": "Region, ISO 3166-2", "district": "District", "specialties": "Specialties, separated by ';'",
    "site_languages": "Languages of the facility website", "readiness_score": "Medical-tourism readiness index, 0–100",
    "source_url": "Link to the OpenStreetMap object", "osm_edited": "Last OSM edit date",
    # works
    "doi": "DOI", "title": "Title", "publication_year": "Publication year", "type": "Work type", "language": "Language",
    "source_name": "Journal or repository", "is_oa": "Open access (1/0)", "oa_status": "Open-access status", "license": "License of the work",
    "cited_by_count_w": "Citations", "primary_topic": "Primary topic", "subfield": "Subfield", "field": "Field", "domain": "Domain",
    "keywords": "Keywords", "sdgs": "UN Sustainable Development Goals", "n_authors": "Number of authors",
    "countries": "Co-author countries", "is_international": "Has co-authors outside Central Asia (1/0)", "core_ids": "CORE university IDs",
}

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        h.update(f.read())
    return h.hexdigest()

def write_csv(path, fields, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)

catalog = json.load(open(os.path.join(HUB, "db", "catalog.json"), encoding="utf-8"))
public = []
for d in catalog["datasets"]:
    slug = d["slug"]
    if slug not in EDITORIAL:
        continue
    e = EDITORIAL[slug]
    public.append({
        "id": d["id"], "slug": slug, "title_en": d["title_en"], "title_ru": d["title"], "version": d["version"],
        "status": d["status"], "kind": d["kind"], "countries": d["countries"], "languages": d["languages"],
        "records": d["records"], "license": d["license"], "commercial_use": d["commercial_use"], "pii": d["pii"],
        "updated": d["updated"], "id_prefix": d["id_prefix"],
        "description_en": e["description_en"], "description_ru": e["description_ru"],
        "adds_en": e["adds_en"], "adds_ru": e["adds_ru"], "withheld_fields": e["withheld"],
    })

# ------------------------------------------------------------------ samples
os.makedirs(os.path.join(OUT, "samples"), exist_ok=True)

# universities: full registry, curated fields (CC0)
uf = ["id", "country", "name", "name_national", "name_ru", "name_en", "acronyms", "city", "lat", "lon", "website", "founded", "ror", "wikidata", "openalex", "works_count", "cited_by_count", "h_index"]
urows = []
for line in open(os.path.join(DS, "universities", "processed", "universities.jsonl"), encoding="utf-8"):
    u = json.loads(line)
    if not u.get("is_higher_ed"):
        continue
    loc, ids, r = u.get("location") or {}, u.get("identifiers") or {}, u.get("research") or {}
    lat, lon, city = uni_geo.fix(u["id"], loc.get("lat"), loc.get("lon"), u.get("city"))  # registry corrections only, no OSM data
    urows.append({"id": u["id"], "country": u["country"], "name": u.get("name"), "name_national": u.get("name_national"),
                  "name_ru": u.get("name_ru"), "name_en": u.get("name_en"), "acronyms": "; ".join(u.get("acronyms") or []),
                  "city": city, "lat": lat, "lon": lon, "website": u.get("website"),
                  "founded": u.get("founded"), "ror": ids.get("ror"), "wikidata": ids.get("wikidata"), "openalex": ids.get("openalex"),
                  "works_count": r.get("works_count"), "cited_by_count": r.get("cited_by_count"), "h_index": r.get("h_index")})
write_csv(os.path.join(OUT, "samples", "universities.csv"), uf, urows)

# medical: 50 records, public fields only, no records flagged with a personal name
mf = ["uid", "name", "name_ru", "name_en", "name_latin", "facility_type", "ownership", "region_code", "district", "city", "lat", "lon", "specialties", "site_languages", "source_url", "osm_edited"]
mrows = []
with open(os.path.join(DS, "uz_medical_facilities", "processed", "uz_medical_facilities.csv"), encoding="utf-8-sig") as f:
    rows = [r for r in csv.DictReader(f) if r.get("personal_name_flag") != "True"]
rows.sort(key=lambda r: r["uid"])
mrows = rows[:50]  # neutral slice by ID — not ranked by the (licensed) readiness index
write_csv(os.path.join(OUT, "samples", "uz_medical_facilities.csv"), mf, mrows)

# publications: 200 works, CC0 metadata only
wf = ["id", "doi", "title", "publication_year", "type", "language", "source_name", "is_oa", "oa_status", "license", "cited_by_count", "primary_topic", "subfield", "field", "domain", "keywords", "sdgs", "n_authors", "countries", "is_international", "core_ids"]
with open(os.path.join(DS, "ca_publications", "sample", "works_sample_1000.csv"), encoding="utf-8-sig") as f:
    wrows = [r for r in csv.DictReader(f) if (r.get("publication_year") or "0") <= "2026"][:200]
write_csv(os.path.join(OUT, "samples", "ca_publications.csv"), wf, wrows)

fields = {
    "universities": uf,
    "uz_medical_facilities": mf,
    "ca_publications": wf,
}
types = {}
for slug, fl in fields.items():
    types[slug] = {}
for fn in ("lat", "lon"):
    types["universities"][fn] = "number"; types["uz_medical_facilities"][fn] = "number"
for fn in ("founded", "works_count", "cited_by_count", "h_index"):
    types["universities"][fn] = "integer"
for fn in ("publication_year", "is_oa", "cited_by_count", "n_authors", "is_international"):
    types["ca_publications"][fn] = "integer"

for p in public:
    slug = p["slug"]
    path = os.path.join(OUT, "samples", slug + ".csv")
    p["sample"] = {"file": "samples/" + slug + ".csv", "rows": sum(1 for _ in open(path, encoding="utf-8")) - 1, "sha256": sha(path)}
    p["fields"] = [{"name": f, "type": types[slug].get(f, "string"),
                    "description": FIELD_EN.get("cited_by_count_w" if (slug == "ca_publications" and f == "cited_by_count") else f, "")} for f in fields[slug]]

json.dump({"source": "core-hub", "datasets": public}, open(os.path.join(OUT, "catalog.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# research datasets list (already public on the site; authors never included)
data = json.loads(open(os.path.join(ROOT, "assets", "data.js"), encoding="utf-8").read().split("=", 1)[1].rstrip().rstrip(";"))
rd = [{"openalex": d["w"], "title": d["t"], "year": d["y"], "repository_type": d["r"], "license": d["lic"], "university": d["u"],
       "countries": d["c"], "field": d["f"], "url": d["doi"], "mentions_central_asia": d["ca"],
       "check": d.get("k", "unchecked"), "formats": d.get("fm", "")} for d in data["researchDatasets"]]
json.dump(rd, open(os.path.join(OUT, "research_datasets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
print("datasets:", [p["slug"] for p in public], "| universities:", len(urows), "| med sample:", len(mrows), "| works sample:", len(wrows), "| research datasets:", len(rd))
