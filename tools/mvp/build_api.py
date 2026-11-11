"""Static API v1 for the MVP packages: app/api/v1/…

  datasets.json                       list of datasets
  datasets/<slug>/index.json          metadata, links, row and page counts
  datasets/<slug>/fields.json         every field with type and labels (en/ru/uz)
  datasets/<slug>/rows-<n>.json       rows, 500 per page, typed values
  openapi.json                        OpenAPI 3.1 description (for code generators and AI agents)

usage: python3 -I tools/mvp/build_api.py app
"""
import csv
import json
import os
import re
import shutil
import sys

APP = sys.argv[1]
BASE = "https://pavelaleks.github.io/core_landing/app/"
PAGE = 500
NUM = re.compile(r"^-?\d+(\.\d+)?$")
TABLE = {"uzbek-geography-terms": "terms", "insurance-literacy-syrdarya": "insurance", "covid-almaty-cohort": "covid"}


def typed(v, keep_text):
    if v == "":
        return None
    if keep_text or not NUM.match(v):
        return v
    return float(v) if "." in v else int(v)


idx = json.load(open(os.path.join(APP, "packages", "index.json"), encoding="utf-8"))
root = os.path.join(APP, "api", "v1")
shutil.rmtree(root, ignore_errors=True)
os.makedirs(os.path.join(root, "datasets"))
listing = []
for d in idx:
    slug = d["slug"]
    out = os.path.join(root, "datasets", slug)
    os.makedirs(out)
    cb = list(csv.DictReader(open(os.path.join(APP, "packages", slug, "codebook.csv"), encoding="utf-8")))
    text_fields = {c["variable"] for c in cb if c.get("type", "").startswith("string") or c["variable"].endswith("_id") or c["variable"] == "record_id"}
    fields = [{"name": c["variable"], "type": c.get("type") or "string", "code": c.get("standard_code", ""), "values": c.get("values_or_units") or c.get("values", ""),
               "label": {"en": c.get("label_en", ""), "ru": c.get("label_ru", ""), "uz": c.get("label_uz", "")}} for c in cb]
    with open(os.path.join(APP, "packages", slug, "data", d["file"]), encoding="utf-8") as f:
        rows = [{k: typed(v, k in text_fields) for k, v in r.items()} for r in csv.DictReader(f)]
    pages = (len(rows) + PAGE - 1) // PAGE
    for p in range(pages):
        json.dump({"dataset": slug, "page": p + 1, "pages": pages, "rows_total": len(rows), "rows": rows[p * PAGE:(p + 1) * PAGE]},
                  open(os.path.join(out, f"rows-{p + 1}.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"slug": slug, "fields": fields}, open(os.path.join(out, "fields.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    meta = {"slug": slug, "table": TABLE.get(slug, slug.replace("-", "_")), "title": {"en": d["title_en"], "ru": d["title_ru"], "uz": d["title_uz"]},
            "university": d["uni"], "authors": d["authors"], "source": "https://doi.org/" + d["doi"], "license": "CC-BY-4.0",
            "rows": len(rows), "fields": len(fields), "pages": pages, "page_size": PAGE,
            "links": {"fields": "fields.json", "rows": [f"rows-{p + 1}.json" for p in range(pages)], "csv": f"../../../../packages/{slug}/data/{d['file']}",
                      "zip": f"../../../../packages/{d['zip']}", "croissant": f"../../../../packages/{slug}/croissant.json"}}
    json.dump(meta, open(os.path.join(out, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    listing.append({k: meta[k] for k in ("slug", "table", "title", "university", "rows", "fields", "pages", "license")} | {"href": f"datasets/{slug}/index.json"})
json.dump({"api": "CORE static API v1 (MVP)", "auth": "Demo: send your key in the X-Core-Key header. The static demo does not check it; the production API does.",
           "datasets": listing}, open(os.path.join(root, "datasets.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
slugs = [x["slug"] for x in listing]
openapi = {
    "openapi": "3.1.0",
    "info": {"title": "CORE data API (MVP)", "version": "1.0.0",
             "description": "Prepared research datasets from Central Asian universities. Static demo: the key header is accepted but not checked."},
    "servers": [{"url": BASE + "api/v1"}],
    "components": {"securitySchemes": {"coreKey": {"type": "apiKey", "in": "header", "name": "X-Core-Key"}}},
    "security": [{"coreKey": []}],
    "paths": {
        "/datasets.json": {"get": {"operationId": "listDatasets", "summary": "List datasets you can access", "responses": {"200": {"description": "Datasets"}}}},
        "/datasets/{slug}/index.json": {"get": {"operationId": "getDataset", "summary": "Dataset metadata, row count and page links",
                                                 "parameters": [{"name": "slug", "in": "path", "required": True, "schema": {"type": "string", "enum": slugs}}], "responses": {"200": {"description": "Metadata"}}}},
        "/datasets/{slug}/fields.json": {"get": {"operationId": "getFields", "summary": "Fields with types, standard codes and labels in en/ru/uz",
                                                  "parameters": [{"name": "slug", "in": "path", "required": True, "schema": {"type": "string", "enum": slugs}}], "responses": {"200": {"description": "Fields"}}}},
        "/datasets/{slug}/rows-{page}.json": {"get": {"operationId": "getRows", "summary": f"Rows, {PAGE} per page",
                                                       "parameters": [{"name": "slug", "in": "path", "required": True, "schema": {"type": "string", "enum": slugs}},
                                                                      {"name": "page", "in": "path", "required": True, "schema": {"type": "integer", "minimum": 1}}],
                                                       "responses": {"200": {"description": "A page of rows"}}}},
    },
}
json.dump(openapi, open(os.path.join(root, "openapi.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print([(x["slug"], x["rows"], x["pages"]) for x in listing])
