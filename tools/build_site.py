"""Build the static site from src/ and data-src/. Standard library only.

Outputs (all committed, served by GitHub Pages):
  index.html, universities.html          English pages
  ru/…, uz/…                             Russian and Uzbek pages with their own URLs (hreflang)
  datasets/<slug>.html (+ ru/, uz/)      one page per dataset, schema.org/Dataset JSON-LD
  api/v0/…                               static JSON API, samples, Croissant metadata
  sitemap.xml

usage: python3 -I tools/build_site.py           build
       python3 -I tools/build_site.py --check   fail if committed output differs (used in CI)
"""
import csv
import html
import io
import json
import os
import posixpath
import re
import shutil
import sys
import tempfile
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://pavelaleks.github.io/core_landing/"
LANGS = ["en", "ru", "uz"]
CHECK = "--check" in sys.argv

uz_src = open(os.path.join(ROOT, "assets", "i18n-uz.js"), encoding="utf-8").read()
UZ = json.loads(uz_src[uz_src.index("{"): uz_src.rindex("}") + 1])
CAT = json.load(open(os.path.join(ROOT, "data-src", "catalog.json"), encoding="utf-8"))["datasets"]
RD = json.load(open(os.path.join(ROOT, "data-src", "research_datasets.json"), encoding="utf-8"))

META = {
    "index.html": {
        "title": {"en": "CORE — trusted data on Central Asia from the region's universities", "ru": "CORE — данные о Центральной Азии, которым можно доверять, из вузов региона", "uz": "CORE — mintaqa universitetlaridan Markaziy Osiyo haqidagi ishonchli maʼlumotlar"},
        "desc": {"en": "Research data from Central Asian universities — cleaned, documented and with the rights to use it. For AI developers, companies and public programmes. Universities join for free and keep up to 70% of the revenue.",
                 "ru": "Научные данные вузов Центральной Азии — очищенные, описанные и с правами на использование. Для разработчиков ИИ, компаний и госпрограмм. Вузы участвуют бесплатно и получают до 70% дохода.",
                 "uz": "Markaziy Osiyo universitetlarining ilmiy maʼlumotlari — tozalangan, tavsiflangan va foydalanish huquqi bilan. SI ishlab chiquvchilari, kompaniyalar va davlat dasturlari uchun. Universitetlar bepul ishtirok etadi va daromadning 70% gachasini oladi."},
    },
    "developers.html": {
        "title": {"en": "CORE for AI developers — catalog, data format, API, agents", "ru": "CORE для разработчиков ИИ — каталог, формат данных, API, агенты", "uz": "SI ishlab chiquvchilari uchun CORE — katalog, maʼlumotlar formati, API, agentlar"},
        "desc": {"en": "Regional knowledge, research data and text in Central Asian languages from the region's universities, with rights paperwork: live catalog, samples, static API, Croissant metadata and agent access.",
                 "ru": "Знания о регионе, научные данные и тексты на языках Центральной Азии из университетов региона с документами на права: каталог, образцы, API, метаданные Croissant и подключение к агентам.",
                 "uz": "Mintaqa universitetlaridan mintaqa haqidagi bilimlar, ilmiy maʼlumotlar va Markaziy Osiyo tillaridagi matnlar, huquqiy hujjatlari bilan: katalog, namunalar, API, Croissant metamaʼlumotlari va agentlarga ulanish."},
    },
    "catalog.html": {
        "title": {"en": "CORE — Central Asia data catalog", "ru": "CORE — каталог данных Центральной Азии", "uz": "CORE — Markaziy Osiyo maʼlumotlari katalogi"},
        "desc": {"en": "Search CORE databases, datasets prepared by CORE, the 48-region layer and 405 checked open datasets by Central Asian scholars.",
                 "ru": "Поиск по базам CORE, наборам, подготовленным CORE, слою 48 регионов и 405 проверенным открытым наборам учёных Центральной Азии.",
                 "uz": "CORE bazalari, CORE tayyorlagan toʻplamlar, 48 hudud qatlami va Markaziy Osiyo olimlarining 405 ta tekshirilgan ochiq toʻplami boʻyicha qidiruv."},
    },
    "how.html": {
        "title": {"en": "How CORE works — from a university archive to an API", "ru": "Как работает CORE — от архива вуза до API", "uz": "CORE qanday ishlaydi — universitet arxividan API gacha"},
        "desc": {"en": "The data path in five stages, three ways CORE works (marketplace, provider, processor of open scholar data) and updates — for universities, AI companies, government and business.",
                 "ru": "Путь данных в пять этапов, три модели работы CORE (маркетплейс, поставщик, обработчик открытых данных учёных) и обновления — для вузов, ИИ-компаний, госорганов и бизнеса.",
                 "uz": "Besh bosqichdagi maʼlumotlar yoʻli, CORE ning uchta ish modeli (marketpleys, yetkazib beruvchi, olimlarning ochiq maʼlumotlarini qayta ishlovchi) va yangilanishlar — universitetlar, SI kompaniyalari, davlat idoralari va biznes uchun."},
    },
    "pricing.html": {
        "title": {"en": "CORE — pricing by kind of data", "ru": "CORE — цены по видам данных", "uz": "CORE — maʼlumot turlari boʻyicha narxlar"},
        "desc": {"en": "Starting prices for registries, analytics, research data, texts, speech, model checks, a fixed-price pilot and custom data. Universities join for free.",
                 "ru": "Ориентиры цен на справочники, аналитику, научные данные, тексты, речь, проверку моделей, пилот с фиксированной ценой и данные под заказ. Для вузов участие бесплатное.",
                 "uz": "Maʼlumotnomalar, tahlil, ilmiy maʼlumotlar, matnlar, nutq, modellarni tekshirish, qatʼiy narxli pilot va buyurtma maʼlumotlari uchun boshlangʻich narxlar. Universitetlar uchun ishtirok bepul."},
    },
    "regions.html": {
        "title": {"en": "CORE — regional data for Central Asia", "ru": "CORE — данные по регионам Центральной Азии", "uz": "CORE — Markaziy Osiyo hududlari boʻyicha maʼlumotlar"},
        "desc": {"en": "48 regions of Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan in one table: official demographics, universities, research, clinics and survey results, joined by ISO 3166-2 code.",
                 "ru": "48 регионов Узбекистана, Казахстана, Кыргызстана и Таджикистана в одной таблице: официальная демография, вузы, наука, клиники и результаты опросов, связанные кодом ISO 3166-2.",
                 "uz": "Oʻzbekiston, Qozogʻiston, Qirgʻiziston va Tojikistonning 48 hududi bitta jadvalda: rasmiy demografiya, universitetlar, ilm-fan, klinikalar va soʻrov natijalari, ISO 3166-2 kodi bilan bogʻlangan."},
    },
    "universities.html": {
        "title": {"en": "CORE for universities — put your data to work", "ru": "CORE для университетов — данные работают на вуз", "uz": "Universitetlar uchun CORE — maʼlumotlaringiz universitet uchun ishlaydi"},
        "desc": {"en": "How Central Asian universities license their research data through CORE: closed by default, rights audit, revenue share, no cost to the university.",
                 "ru": "Как университеты Центральной Азии лицензируют свои научные данные через CORE: закрыто по умолчанию, аудит прав, раздел дохода, без затрат для вуза.",
                 "uz": "Markaziy Osiyo universitetlari ilmiy maʼlumotlarini CORE orqali qanday litsenziyalaydi: sukut boʻyicha yopiq, huquqlar auditi, daromad taqsimoti, universitet uchun xarajatsiz."},
    },
}
LICENSE_URL = {"CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/", "ODbL-1.0": "https://opendatacommons.org/licenses/odbl/1-0/"}
COUNTRY_EN = {"UZ": "Uzbekistan", "KZ": "Kazakhstan", "KG": "Kyrgyzstan", "TJ": "Tajikistan"}

def T(lang, en, ru):
    if lang == "en":
        return en
    if lang == "uz":
        return UZ.get(ru, ru)
    return ru

# ------------------------------------------------------------------ output collection
OUT = {}  # relative path -> bytes

def emit(path, data):
    OUT[path] = data.encode("utf-8") if isinstance(data, str) else data

def jdump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=1) + "\n"

# ================================================================== API v0
def typed_rows(ds):
    types = {f["name"]: f["type"] for f in ds["fields"]}
    rows = []
    with open(os.path.join(ROOT, "data-src", ds["sample"]["file"]), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            o = {}
            for k, v in r.items():
                t = types.get(k, "string")
                if v in ("", None):
                    o[k] = None
                elif t == "integer":
                    try: o[k] = int(float(v))
                    except ValueError: o[k] = v
                elif t == "number":
                    try: o[k] = float(v)
                    except ValueError: o[k] = v
                else:
                    o[k] = v
            rows.append(o)
    return rows

def api_card(ds, full=True):
    s = ds["slug"]
    c = {k: ds[k] for k in ("id", "slug", "title_en", "title_ru", "version", "status", "kind", "countries", "languages", "records", "license", "commercial_use", "pii", "updated", "description_en", "description_ru")}
    c["page"] = BASE + "datasets/" + s + ".html"
    c["links"] = {
        "card": BASE + "api/v0/datasets/" + s + ".json",
        "sample_json": BASE + "api/v0/datasets/" + s + "/sample.json",
        "sample_csv": BASE + "api/v0/datasets/" + s + "/sample.csv",
        "croissant": BASE + "api/v0/datasets/" + s + "/croissant.json",
    }
    if full:
        c["what_core_adds_en"], c["what_core_adds_ru"] = ds["adds_en"], ds["adds_ru"]
        c["fields"] = ds["fields"]
        c["withheld_fields"] = ds["withheld_fields"]
        c["sample"] = {"rows": ds["sample"]["rows"], "sha256": ds["sample"]["sha256"]}
    return c

CROISSANT_CONTEXT = {
    "@language": "en", "@vocab": "https://schema.org/", "citeAs": "cr:citeAs", "column": "cr:column", "conformsTo": "dct:conformsTo",
    "cr": "http://mlcommons.org/croissant/", "rai": "http://mlcommons.org/croissant/RAI/", "data": {"@id": "cr:data", "@type": "@json"},
    "dataType": {"@id": "cr:dataType", "@type": "@vocab"}, "dct": "http://purl.org/dc/terms/", "examples": {"@id": "cr:examples", "@type": "@json"},
    "extract": "cr:extract", "field": "cr:field", "fileProperty": "cr:fileProperty", "fileObject": "cr:fileObject", "fileSet": "cr:fileSet",
    "format": "cr:format", "includes": "cr:includes", "isLiveDataset": "cr:isLiveDataset", "jsonPath": "cr:jsonPath", "key": "cr:key",
    "md5": "cr:md5", "parentField": "cr:parentField", "path": "cr:path", "recordSet": "cr:recordSet", "references": "cr:references",
    "regex": "cr:regex", "repeated": "cr:repeated", "replace": "cr:replace", "sc": "https://schema.org/", "separator": "cr:separator",
    "source": "cr:source", "subField": "cr:subField", "transform": "cr:transform",
}
CR_TYPE = {"string": "sc:Text", "integer": "sc:Integer", "number": "sc:Float"}

def croissant(ds):
    s = ds["slug"]
    lic = LICENSE_URL.get(ds["license"], BASE + "datasets/" + s + ".html#license")
    return {
        "@context": CROISSANT_CONTEXT, "@type": "sc:Dataset", "conformsTo": "http://mlcommons.org/croissant/1.0",
        "name": "CORE " + ds["id"] + " — " + ds["title_en"] + " (public sample)",
        "description": ds["description_en"] + " This Croissant file describes the public sample; the full dataset is available from CORE.",
        "url": BASE + "datasets/" + s + ".html", "license": lic, "version": ds["version"], "dateModified": ds["updated"],
        "creator": {"@type": "sc:Organization", "name": "CORE", "url": BASE},
        "keywords": ["Central Asia", "university data"] + [COUNTRY_EN.get(c, c) for c in ds["countries"]],
        "distribution": [{"@type": "cr:FileObject", "@id": "sample-csv", "name": "sample-csv",
                          "contentUrl": BASE + "api/v0/datasets/" + s + "/sample.csv", "encodingFormat": "text/csv", "sha256": ds["sample"]["sha256"]}],
        "recordSet": [{"@type": "cr:RecordSet", "@id": s, "name": s, "field": [
            {"@type": "cr:Field", "@id": s + "/" + f["name"], "name": f["name"], "description": f["description"] or f["name"],
             "dataType": CR_TYPE.get(f["type"], "sc:Text"), "source": {"fileObject": {"@id": "sample-csv"}, "extract": {"column": f["name"]}}}
            for f in ds["fields"]]}],
    }

def build_api():
    emit("api/v0/index.json", jdump({
        "name": "CORE API v0 (static, read-only)", "version": "0.1",
        "about": "Public metadata and samples from the CORE catalog. Full datasets, updates and the MCP server are available under license.",
        "contact": BASE + "#contact",
        "endpoints": {
            "catalog": BASE + "api/v0/catalog.json",
            "dataset": BASE + "api/v0/datasets/{slug}.json",
            "sample_json": BASE + "api/v0/datasets/{slug}/sample.json",
            "sample_csv": BASE + "api/v0/datasets/{slug}/sample.csv",
            "croissant": BASE + "api/v0/datasets/{slug}/croissant.json",
            "universities": BASE + "api/v0/universities.json",
            "research_datasets": BASE + "api/v0/research-datasets.json",
            "regions": BASE + "api/v0/regions.json",
        },
        "licenses": "Each record set carries its own license: CC0-1.0 (universities, publication metadata), ODbL-1.0 (medical facilities, © OpenStreetMap contributors).",
    }))
    emit("api/v0/catalog.json", jdump({"datasets": [api_card(d, full=False) for d in CAT]}))
    for d in CAT:
        s = d["slug"]
        emit("api/v0/datasets/" + s + ".json", jdump(api_card(d)))
        rows = typed_rows(d)
        emit("api/v0/datasets/" + s + "/sample.json", jdump({"dataset": d["id"], "license": d["license"], "rows": len(rows), "records": rows}))
        emit("api/v0/datasets/" + s + "/sample.csv", open(os.path.join(ROOT, "data-src", d["sample"]["file"]), "rb").read())
        emit("api/v0/datasets/" + s + "/croissant.json", jdump(croissant(d)))
        if s == "universities":
            emit("api/v0/universities.json", jdump({"dataset": d["id"], "license": "CC0-1.0", "count": len(rows), "universities": rows}))
    RG = json.load(open(os.path.join(ROOT, "data-src", "regions.json"), encoding="utf-8"))
    emit("api/v0/regions.json", jdump({**RG["meta"], "count": len(RG["regions"]), "regions": RG["regions"]}))
    cols = ["iso", "country", "name_en", "name_ru", "population", "population_year", "urban_share", "female_share", "age_0_14", "age_15_64", "age_65_plus",
            "universities", "research_works", "scholar_datasets", "medical_facilities_uz", "behaviour_surveys", "demographics_source"]
    lines = [",".join(cols)]
    for g in RG["regions"]:
        d, c = g["demographics"], g["core"]
        vals = [g["iso"], g["country"], g["name"]["en"], g["name"]["ru"], d.get("population"), d.get("year"), d.get("urban_share"), d.get("female_share"), d.get("age_0_14"),
                d.get("age_15_64"), d.get("age_65_plus"), c["universities"], c["works"], c["open_datasets"], c["clinics"] if g["country"] == "UZ" else "", len(g["behaviour"]), d.get("source", "")]
        lines.append(",".join('"%s"' % str(v).replace('"', '""') if isinstance(v, str) and ("," in v or '"' in v) else ("" if v is None else str(v)) for v in vals))
    emit("api/v0/regions.csv", "\n".join(lines) + "\n")
    emit("api/v0/research-datasets.json", jdump({"about": "Open research datasets by Central Asian university scholars since 2023, from OpenAlex (CC0 metadata). Authors omitted. "
                                                  "Every record was opened in its repository; field `check` says what we found ('data' = data files present).",
                                                  "count": len(RD), "count_with_data": sum(1 for d in RD if d.get("check") == "data"), "datasets": RD}))

# ================================================================== dataset pages (EN source with data-ru)
def esc(s):
    return html.escape(str(s if s is not None else ""), quote=True)

def dataset_page(ds, nav, footer):
    s = ds["slug"]
    rows = typed_rows(ds)[:8]
    cols = [f["name"] for f in ds["fields"]][:6]
    status_ru = {"ready": "готов", "review": "на проверке"}.get(ds["status"], ds["status"])
    kind_en = {"reference": "reference", "geo": "geodata", "bibliographic": "bibliography"}.get(ds["kind"], ds["kind"])
    kind_ru = {"reference": "справочник", "geo": "геоданные", "bibliographic": "библиография"}.get(ds["kind"], ds["kind"])
    pii_en = {"none": "none", "public_bibliographic": "author names (not published)"}.get(ds["pii"], ds["pii"])
    pii_ru = {"none": "нет", "public_bibliographic": "имена авторов (не публикуются)"}.get(ds["pii"], ds["pii"])
    lic_en = ds["license"] if ds["license"] != "LicenseRef-Mixed" else "Mixed: metadata CC0, texts per work"
    lic_ru = ds["license"] if ds["license"] != "LicenseRef-Mixed" else "Смешанная: метаданные CC0, тексты — по лицензии работы"
    jsonld = {
        "@context": "https://schema.org", "@type": "Dataset", "name": ds["title_en"], "alternateName": ds["title_ru"],
        "description": ds["description_en"], "url": BASE + "datasets/" + s + ".html", "identifier": ds["id"], "version": ds["version"],
        "dateModified": ds["updated"], "license": LICENSE_URL.get(ds["license"], BASE + "datasets/" + s + ".html#license"),
        "isAccessibleForFree": ds["license"] == "CC0-1.0",
        "creator": {"@type": "Organization", "name": "CORE", "url": BASE},
        "keywords": ["Central Asia", "AI training data"] + [COUNTRY_EN.get(c, c) for c in ds["countries"]],
        "spatialCoverage": [COUNTRY_EN.get(c, c) for c in ds["countries"]],
        "variableMeasured": [f["name"] for f in ds["fields"]],
        "distribution": [{"@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": BASE + "api/v0/datasets/" + s + "/sample.csv"},
                         {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": BASE + "api/v0/datasets/" + s + "/sample.json"}],
    }
    adds = "".join('<li data-ru="%s">%s</li>' % (esc(r), esc(e)) for e, r in zip(ds["adds_en"], ds["adds_ru"]))
    fields = "".join("<tr><td class='mono small'>%s</td><td class='muted small'>%s</td><td class='small'>%s</td></tr>" % (esc(f["name"]), esc(f["type"]), esc(f["description"])) for f in ds["fields"])
    withheld = ""
    if ds["withheld_fields"]:
        withheld = '<p class="note"><span data-ru="Не входят в открытый образец, доступны по лицензии:">Not in the public sample, available under license:</span> <span class="mono">%s</span></p>' % esc(", ".join(ds["withheld_fields"]))
    head_row = "".join("<th>%s</th>" % esc(c) for c in cols)
    body_rows = "".join("<tr>%s</tr>" % "".join("<td>%s</td>" % esc((str(r.get(c)) if r.get(c) is not None else "—")[:60]) for c in cols) for r in rows)
    api = "../api/v0/datasets/" + s
    is_open = ds["license"] == "CC0-1.0"
    if is_open:
        get_lead = '<p class="small muted" data-ru="Весь справочник открыт по лицензии CC0: скачивайте и используйте бесплатно, в том числе в коммерческих продуктах. Платно — только регулярные обновления и интеграция.">The whole registry is open under CC0: download and use it for free, commercial products included. Only regular updates and integration are paid.</p>'
        csv_label = '<b data-ru="Весь справочник CSV">Full registry CSV</b>'
        cta = '<a href="../index.html#contact" class="btn btn-primary btn-block" data-ru="Обсудить обновления и интеграцию">Discuss updates and integration</a>'
    else:
        get_lead = '<p class="small muted" data-ru="Открытый образец и метаданные — бесплатно, без регистрации. Полный датасет, обновления и API — по лицензии.">Open sample and metadata — free, no sign-up. Full dataset, updates and API — under license.</p>'
        csv_label = '<b data-ru="Образец CSV">Sample CSV</b>'
        cta = '<a href="../index.html#contact" class="btn btn-primary btn-block" data-ru="Запросить полный датасет">Request the full dataset</a>'
    page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(ds["title_en"])} — {esc(ds["id"])} · CORE</title>
<meta name="description" content="{esc(ds["description_en"])}">
<meta property="og:title" content="{esc(ds["title_en"])} — CORE">
<meta property="og:description" content="{esc(ds["description_en"])}">
<meta property="og:type" content="website">
<meta property="og:image" content="{BASE}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#07090c">
<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../assets/styles.css">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
</head>
<body data-page="dataset">
{nav}
<main>
<section class="sec sec-first ds-page">
  <div class="wrap">
    <p class="crumbs mono small"><a href="../developers.html#catalog" data-ru="Каталог">Catalog</a> / {esc(ds["id"])}</p>
    <h1 class="h1-page" data-ru="{esc(ds["title_ru"])}">{esc(ds["title_en"])}</h1>
    <div class="tagrow ds-tags">
      <span class="tag t-teal"><span data-ru="{esc(status_ru)}">{esc(ds["status"])}</span></span>
      <span class="tag"><span data-ru="{esc(kind_ru)}">{esc(kind_en)}</span></span>
      <span class="tag">{esc(ds["license"])}</span>
      <span class="tag">v{esc(ds["version"])}</span>
    </div>
    <p class="sub" data-ru="{esc(ds["description_ru"])}">{esc(ds["description_en"])}</p>

    <div class="ds-cols">
      <div class="card">
        <h3 data-ru="Что добавляет CORE">What CORE adds</h3>
        <ul class="checks">{adds}</ul>
        <dl class="kv">
          <div><dt data-ru="Записей">Records</dt><dd>{ds["records"]:,}</dd></div>
          <div><dt data-ru="Страны">Countries</dt><dd>{esc(" · ".join(ds["countries"]))}</dd></div>
          <div id="license"><dt data-ru="Лицензия">License</dt><dd data-ru="{esc(lic_ru)}">{esc(lic_en)}</dd></div>
          <div><dt data-ru="Перс. данные">PII</dt><dd data-ru="{esc(pii_ru)}">{esc(pii_en)}</dd></div>
          <div><dt data-ru="Обновлено">Updated</dt><dd>{esc(ds["updated"])}</dd></div>
          <div><dt data-ru="Префикс ID">ID prefix</dt><dd class="mono">{esc(ds["id_prefix"])}-…</dd></div>
        </dl>
      </div>
      <div class="card ds-get">
        <h3 data-ru="Получить данные">Get the data</h3>
        {get_lead}
        <div class="dl-list">
          <a class="dl" href="{api}/sample.csv" download>{csv_label}<span class="mono small">{ds["sample"]["rows"]} rows</span></a>
          <a class="dl" href="{api}/sample.json"><b data-ru="Образец JSON">Sample JSON</b><span class="mono small">api/v0</span></a>
          <a class="dl" href="{api}/croissant.json"><b>Croissant</b><span class="mono small">MLCommons 1.0</span></a>
          <a class="dl" href="{api}.json"><b data-ru="Карточка API">API card</b><span class="mono small">JSON</span></a>
        </div>
        {cta}
      </div>
    </div>

    <div class="card ds-table">
      <div class="table-tools"><b data-ru="Образец записей">Sample records</b><span class="small muted" data-ru="первые 8 строк открытого образца">first 8 rows of the open sample</span></div>
      <div class="tscroll"><table><thead><tr>{head_row}</tr></thead><tbody>{body_rows}</tbody></table></div>
    </div>

    <div class="card ds-table">
      <div class="table-tools"><b data-ru="Поля">Fields</b><span class="small muted">{len(ds["fields"])}</span></div>
      <div class="tscroll tall"><table><thead><tr><th data-ru="Поле">Field</th><th data-ru="Тип">Type</th><th data-ru="Описание">Description</th></tr></thead><tbody>{fields}</tbody></table></div>
      <div class="table-foot">{withheld}</div>
    </div>
  </div>
</section>
</main>
{footer}
<script src="../assets/config.js"></script>
<script src="../assets/i18n-uz.js"></script>
<script src="../assets/app.js"></script>
</body>
</html>
'''
    return page

# ================================================================== i18n rendering
class DataRuScanner(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text
        self.lines = [0]
        for m in re.finditer("\n", text):
            self.lines.append(m.end())
        self.hits = []
    def char_pos(self):
        ln, col = self.getpos()
        return self.lines[ln - 1] + col
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "data-ru" in a or "data-ru-ph" in a:
            start = self.char_pos()
            raw = self.get_starttag_text()
            self.hits.append((tag, a, start, start + len(raw), raw))

def end_of_element(text, tag, pos):
    depth = 1
    pat = re.compile(r"<(/?)%s\b[^>]*>" % re.escape(tag), re.I)
    for m in pat.finditer(text, pos):
        if m.group(0).endswith("/>"):
            continue
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return m.start(), m.end()
    raise ValueError("unclosed <%s> at %d" % (tag, pos))

def localize(text, lang):
    if lang == "en":
        return text
    sc = DataRuScanner(text)
    sc.feed(text)
    edits = []
    for tag, a, s, e, raw in sc.hits:
        if "data-ru-ph" in a:
            ph = T(lang, a.get("placeholder", ""), a["data-ru-ph"])
            new_raw = re.sub(r'placeholder="[^"]*"', 'placeholder="%s"' % esc(ph), raw)
            edits.append((s, e, new_raw))
        if "data-ru" in a:
            inner_s = e
            close_s, _ = end_of_element(text, tag, e)
            edits.append((inner_s, close_s, T(lang, None, a["data-ru"])))
    edits.sort(key=lambda x: x[0])
    for (s1, e1, _), (s2, e2, _) in zip(edits, edits[1:]):
        assert e1 <= s2, "nested data-ru elements are not supported (offset %d)" % s2
    edits.reverse()
    out = text
    for s, e, rep in edits:
        out = out[:s] + rep + out[e:]
    return out

LOCAL_PAGES = None  # filled in main

def relink(text, page_dir, depth_extra):
    """Rewrite relative URLs for a page moved `depth_extra` folders deeper (ru/, uz/)."""
    if depth_extra == 0:
        return text
    pre = "../" * depth_extra
    def fix(m):
        attr, q, url = m.group(1), m.group(2), m.group(3)
        if re.match(r"^(?:[a-z]+:|#|//|data:|mailto:)", url):
            return m.group(0)
        path = url.split("#")[0].split("?")[0]
        target = posixpath.normpath(posixpath.join(page_dir, path)) if path else None
        if target and target in LOCAL_PAGES:
            return m.group(0)
        return '%s=%s%s%s%s' % (attr, q, pre, url, q)
    text = re.sub(r'\b(href|src)=(["\'])([^"\']+)\2', fix, text)
    # import map URLs are absolute; module script src handled above
    return text

def lang_switch(page_path):
    """Language links for a page at page_path (EN-tree path, e.g. 'datasets/x.html')."""
    def make(cur_lang):
        cur_file = page_path if cur_lang == "en" else cur_lang + "/" + page_path
        cur_dir = posixpath.dirname(cur_file) or "."
        links = []
        for l in LANGS:
            target = page_path if l == "en" else l + "/" + page_path
            href = posixpath.relpath(target, cur_dir)
            links.append('<a data-lang="%s" href="%s" hreflang="%s"%s>%s</a>' % (l, href, l, ' aria-current="true"' if l == cur_lang else "", l.upper()))
        return '<div class="lang" role="group" aria-label="Language">' + "".join(links) + "</div>"
    return make

def page_url(lang, page_path):
    p = page_path if lang == "en" else lang + "/" + page_path
    if p.endswith("index.html"):
        p = p[: -len("index.html")]
    return BASE + p

def finalize(text, lang, page_path, meta):
    sw = lang_switch(page_path)(lang)
    text = re.sub(r'<div class="lang" role="group" aria-label="Language">.*?</div>', lambda m: sw, text, count=1, flags=re.S)
    text = re.sub(r'<html lang="[a-z]+">', '<html lang="%s" data-static-lang="%s">' % (lang, lang), text, count=1)
    alt = "".join('<link rel="alternate" hreflang="%s" href="%s">\n' % (l, page_url(l, page_path)) for l in LANGS)
    alt += '<link rel="alternate" hreflang="x-default" href="%s">\n' % page_url("en", page_path)
    text = re.sub(r'<link rel="canonical" href="[^"]*">\n?', "", text)
    text = text.replace("</head>", '<link rel="canonical" href="%s">\n%s</head>' % (page_url(lang, page_path), alt), 1)
    text = re.sub(r'<meta property="og:url" content="[^"]*">', '<meta property="og:url" content="%s">' % page_url(lang, page_path), text)
    if meta:
        t, d = meta["title"][lang], meta["desc"][lang]
        text = re.sub(r"<title>.*?</title>", "<title>%s</title>" % esc(t), text, count=1, flags=re.S)
        text = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(d), text, count=1)
        text = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % esc(d), text, count=1)
    elif lang != "en" and page_path.startswith("datasets/"):
        ds = next(x for x in CAT if "datasets/" + x["slug"] + ".html" == page_path)
        title = T(lang, ds["title_en"], ds["title_ru"])
        text = re.sub(r"<title>.*?</title>", "<title>%s — %s · CORE</title>" % (esc(title), esc(ds["id"])), text, count=1, flags=re.S)
        text = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(T(lang, ds["description_en"], ds["description_ru"])), text, count=1)
    return text


# ================================================================== Hugging Face packages
def build_hf():
    uni = next(d for d in CAT if d["slug"] == "universities")
    rows = "\n".join("| `%s` | %s | %s |" % (f["name"], f["type"], f["description"]) for f in uni["fields"])
    emit("hf/core-ca-universities/README.md", f"""---
license: cc0-1.0
pretty_name: "CORE — Universities of Central Asia"
language: [uz, kk, ky, tg, ru, en]
size_categories: [n<1K]
tags: [central-asia, universities, uzbekistan, kazakhstan, kyrgyzstan, tajikistan, knowledge-graph, entity-linking]
configs:
- config_name: default
  data_files: data/universities.csv
---

# CORE — Universities of Central Asia ({uni["id"]})

{uni["description_en"]}

- **Records:** {uni["sample"]["rows"]} higher-education institutions (UZ, KZ, KG, TJ)
- **License:** CC0-1.0 — free for any use, attribution appreciated
- **Version:** {uni["version"]}, updated {uni["updated"]}
- **Sources:** Wikidata, ROR, OpenAlex, reconciled and curated by CORE
- **Website:** {BASE}datasets/universities.html · **API:** {BASE}api/v0/universities.json

The `id` column (`UNI-UZ-0138` …) is a persistent CORE identifier: every other CORE dataset —
research output, research datasets, university collections — links to it.

## Fields

| Field | Type | Description |
|---|---|---|
{rows}

## About CORE

CORE licenses expert-verified, rights-cleared data from Central Asian universities for AI training,
evaluation and RAG. Full datasets, annotation projects and the CORE-CA benchmark: {BASE}
""")
    emit("hf/core-ca-universities/data/universities.csv", open(os.path.join(ROOT, "data-src", uni["sample"]["file"]), "rb").read())
    by_country = {}
    for d in RD:
        for c in (d["countries"] or "").split("; "):
            if c:
                by_country[c] = by_country.get(c, 0) + 1
    emit("hf/core-ca-research-datasets/README.md", f"""---
license: cc0-1.0
pretty_name: "CORE — Open research datasets by Central Asian scholars"
language: [en]
size_categories: [n<1K]
tags: [central-asia, research-data, data-discovery, openalex, uzbekistan, kazakhstan]
configs:
- config_name: default
  data_files: data/research_datasets.jsonl
---

# CORE — Open research datasets by Central Asian scholars

{sum(1 for d in RD if d.get("check") == "data")} datasets with data files, published since 2023 by researchers of universities in Uzbekistan,
Kazakhstan, Kyrgyzstan and Tajikistan. We selected {len(RD)} candidates from 11,523 OpenAlex records typed
"dataset" and opened each one in its repository; field `check` says what we found ('data', or why not:
document only, extract from an article, restricted, link broken, duplicate).

- **By country:** {", ".join("%s %d" % (k, v) for k, v in sorted(by_country.items(), key=lambda x: -x[1]))}
- **License of this list:** CC0-1.0 (OpenAlex metadata). Each dataset keeps its own license — see `license`.
- **Authors are omitted** on purpose.
- Field `formats` lists the file types we saw. Field `mentions_central_asia` marks titles that name the region.

Use it to find data for Central Asian NLP, geoscience, agriculture and social-science work.
Browse and filter it on {BASE}#catalog.
""")
    emit("hf/core-ca-research-datasets/data/research_datasets.jsonl", "".join(json.dumps(d, ensure_ascii=False) + "\n" for d in RD))

# ================================================================== main
def build():
    global LOCAL_PAGES
    OUT.clear()
    build_api()
    build_hf()
    src_index = open(os.path.join(ROOT, "src", "index.html"), encoding="utf-8").read()
    nav = re.search(r"<!-- ============ NAV ============ -->.*?</header>", src_index, re.S).group(0)
    footer = re.search(r'<footer class="foot">.*?</footer>', src_index, re.S).group(0)
    def up(h):
        h = re.sub(r'href="#', 'href="../index.html#', h)
        h = h.replace('href="index.html"', 'href="../index.html"')
        h = h.replace('href="universities.html', 'href="../universities.html').replace('href="privacy.html', 'href="../privacy.html').replace('href="developers.html', 'href="../developers.html').replace('href="regions.html', 'href="../regions.html').replace('href="pricing.html', 'href="../pricing.html').replace('href="how.html', 'href="../how.html').replace('href="catalog.html', 'href="../catalog.html')
        return h
    pages = {"index.html": src_index,
             "universities.html": open(os.path.join(ROOT, "src", "universities.html"), encoding="utf-8").read(),
             "developers.html": open(os.path.join(ROOT, "src", "developers.html"), encoding="utf-8").read(),
             "regions.html": open(os.path.join(ROOT, "src", "regions.html"), encoding="utf-8").read(),
             "pricing.html": open(os.path.join(ROOT, "src", "pricing.html"), encoding="utf-8").read(),
             "how.html": open(os.path.join(ROOT, "src", "how.html"), encoding="utf-8").read(),
             "catalog.html": open(os.path.join(ROOT, "src", "catalog.html"), encoding="utf-8").read()}
    for d in CAT:
        pages["datasets/" + d["slug"] + ".html"] = dataset_page(d, up(nav), up(footer))
    LOCAL_PAGES = set(pages.keys()) | {"."}
    for path, text in pages.items():
        page_dir = posixpath.dirname(path)
        for lang in LANGS:
            t = localize(text, lang)
            t = relink(t, page_dir, 0 if lang == "en" else 1)
            t = finalize(t, lang, path, META.get(path))
            emit(path if lang == "en" else lang + "/" + path, t)
    urls = [page_url(l, p) for p in pages for l in LANGS]
    emit("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
         + "".join("  <url><loc>%s</loc></url>\n" % u for u in urls + [BASE + "privacy.html"]) + "</urlset>\n")

def main():
    build()
    generated_dirs = ["api", "ru", "uz", "datasets", "hf"]
    if CHECK:
        stale = []
        for path, data in OUT.items():
            full = os.path.join(ROOT, path)
            if not os.path.exists(full) or open(full, "rb").read() != data:
                stale.append(path)
        for d in generated_dirs:
            for dp, _, files in os.walk(os.path.join(ROOT, d)):
                for f in files:
                    rel = os.path.relpath(os.path.join(dp, f), ROOT).replace(os.sep, "/")
                    if rel not in OUT:
                        stale.append(rel + " (orphan)")
        if stale:
            print("Generated files are out of date. Run: python3 -I tools/build_site.py\n  " + "\n  ".join(sorted(stale)[:40]))
            sys.exit(1)
        print("ok: %d generated files are up to date" % len(OUT))
        return
    for d in generated_dirs:
        shutil.rmtree(os.path.join(ROOT, d), ignore_errors=True)
    for path, data in OUT.items():
        full = os.path.join(ROOT, path)
        os.makedirs(os.path.dirname(full) or ROOT, exist_ok=True)
        open(full, "wb").write(data)
    print("built %d files" % len(OUT))

if __name__ == "__main__":
    main()
