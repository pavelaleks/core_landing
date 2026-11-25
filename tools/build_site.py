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
import hashlib
import json
import os
import posixpath
import re
import shutil
import sys
import tempfile
from html.parser import HTMLParser
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import public_data
import digests
import dataset_card
import rankings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://coredata.uz/"
LANGS = ["en", "ru", "uz"]
CHECK = "--check" in sys.argv

uz_src = open(os.path.join(ROOT, "assets", "i18n-uz.js"), encoding="utf-8").read()
UZ = json.loads(uz_src[uz_src.index("{"): uz_src.rindex("}") + 1])
CAT = json.load(open(os.path.join(ROOT, "data-src", "catalog.json"), encoding="utf-8"))["datasets"]
RD = json.load(open(os.path.join(ROOT, "data-src", "research_datasets.json"), encoding="utf-8"))

META = {
    "index.html": {
        "title": {
            "en": "CORE — a marketplace for research data",
            "ru": "CORE — маркетплейс научных данных",
            "uz": "CORE — ilmiy maʼlumotlar marketpleysi"
        },
        "desc": {
            "en": "Bring university datasets and repositories together for new research, business services and grant applications. Explore the catalog and discuss collaboration.",
            "ru": "Датасеты и репозитории университетов для новых исследований, сервисов для бизнеса и грантовых заявок. Каталог данных и сотрудничество с CORE.",
            "uz": "Universitetlarning maʼlumotlar toʻplamlari va repozitoriylari — yangi tadqiqotlar, biznes xizmatlari va grant arizalari uchun. Maʼlumotlar katalogi va CORE bilan hamkorlik."
        }
    },
    "developers.html": {
        "title": {"en": "CORE for AI developers — catalog, data format, API, agents", "ru": "CORE для разработчиков ИИ — каталог, формат данных, API, агенты", "uz": "SI ishlab chiquvchilari uchun CORE — katalog, maʼlumotlar formati, API, agentlar"},
        "desc": {"en": "Regional knowledge, research data and text in Central Asian languages from the region's universities, with rights paperwork: live catalog, samples, static API, Croissant metadata and agent access.",
                 "ru": "Знания о регионе, научные данные и тексты на языках Центральной Азии из университетов региона с документами на права: каталог, образцы, API, метаданные Croissant и подключение к агентам.",
                 "uz": "Mintaqa universitetlaridan mintaqa haqidagi bilimlar, ilmiy maʼlumotlar va Markaziy Osiyo tillaridagi matnlar, huquqiy hujjatlari bilan: katalog, namunalar, API, Croissant metamaʼlumotlari va agentlarga ulanish."},
    },
    "catalog.html": {
        "title": {
            "en": "CORE — research data catalog",
            "ru": "CORE — каталог научных данных",
            "uz": "CORE — ilmiy maʼlumotlar katalogi"
        },
        "desc": {
            "en": "Find research datasets by topic, country and university. Explore sources and save suitable datasets to your partner account.",
            "ru": "Находите научные данные по теме, стране и университету. Изучайте источники и сохраняйте подходящие датасеты в избранное.",
            "uz": "Ilmiy maʼlumotlarni mavzu, mamlakat va universitet boʻyicha toping. Manbalarni oʻrganing va mos toʻplamlarni saralanganlarga saqlang."
        }
    },
    "documents.html": {
        "title": {"en": "CORE — documents", "ru": "CORE — документы", "uz": "CORE — hujjatlar"},
        "desc": {
            "en": "Dataset publication terms, a data use agreement template, privacy notice and a personal data consent template.",
            "ru": "Условия публикации датасетов, шаблон соглашения, политика конфиденциальности и типовой проект согласия на обработку персональных данных.",
            "uz": "Maʼlumotlar toʻplamlarini eʼlon qilish shartlari, kelishuv namunasi, maxfiylik siyosati va shaxsga doir maʼlumotlarni qayta ishlashga rozilik namunasi."
        }
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
        "title": {"en": "CORE — university guide", "ru": "CORE — руководство для университета", "uz": "CORE — universitet uchun qoʻllanma"},
        "desc": {"en": "How a university can get started with CORE, describe its research data, choose a license and publish a dataset description.",
                 "ru": "Как университету начать работу с CORE, описать свои научные данные, выбрать лицензию и опубликовать набор в каталоге.",
                 "uz": "Universitetning CORE da ish boshlashi, ilmiy maʼlumotlarini tavsiflashi, litsenziya tanlashi va katalogda eʼlon qilishi uchun qoʻllanma."},
    },
}
META["digests.html"] = {
    "title": {"en": "CORE — research data digests", "ru": "CORE — дайджесты научных данных", "uz": "CORE — ilmiy maʼlumotlar sharhlari"},
    "desc": {"en": "Thematic selections of Central Asian research datasets: languages, water, agriculture and examples of data preparation.", "ru": "Тематические подборки научных данных Центральной Азии: языки, вода, сельское хозяйство и примеры подготовки наборов.", "uz": "Markaziy Osiyo ilmiy maʼlumotlarining mavzuli tanlovlari: tillar, suv, qishloq xoʻjaligi va toʻplamlarni tayyorlash misollari."},
}
META["organization.html"] = {
    "title": {"en": "Organization — CORE", "ru": "Организация — CORE", "uz": "Tashkilot — CORE"},
    "desc": {"en": "An organization and its related research datasets, sources and data preparation.",
             "ru": "Организация и связанные с ней научные датасеты, источники и подготовленные материалы.",
             "uz": "Tashkilot va unga bogʻliq ilmiy toʻplamlar, manbalar hamda tayyorlangan materiallar."},
}
META["rankings.html"] = {
    "title": {"en": "University rankings — CORE", "ru": "Рейтинги вузов — CORE", "uz": "Universitetlar reytinglari — CORE"},
    "desc": {"en": "Find Central Asian universities by the number of open datasets in the CORE catalog and research works in OpenAlex.",
             "ru": "Вузы Центральной Азии по числу открытых наборов в каталоге CORE и научных работ в OpenAlex.",
             "uz": "Markaziy Osiyo universitetlarining CORE katalogidagi ochiq toʻplamlari va OpenAlex tizimidagi ilmiy ishlari soni boʻyicha reytinglar."},
}
META["agents.html"] = {
    "title": {"en": "CORE agents and services", "ru": "Агенты и сервисы CORE", "uz": "CORE agentlari va xizmatlari"},
    "desc": {"en": "Examples of MCP tools, CORE agents and data services. Tasks, connections, outputs and current readiness.",
             "ru": "Примеры MCP-инструментов, агентов CORE и сервисов данных. Задачи, подключение, результаты и текущая готовность.",
             "uz": "MCP vositalari, CORE agentlari va maʼlumotlar xizmatlari misollari. Vazifalar, ulanish, natijalar va joriy tayyorlik."},
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

def base_details(ds, lang):
    def l(en, ru, uz):
        return public_data.tr(lang, en, ru, uz)

    slug = ds["slug"]
    api = "../api/v0/datasets/" + slug
    record = public_data.RECORDS.get(ds["id"], {})
    title = public_data.local(record.get("title"), lang) or T(lang, ds["title_en"], ds["title_ru"])
    description = public_data.local(record.get("description"), lang) or T(lang, ds["description_en"], ds["description_ru"])
    countries = record.get("countries") or ds["countries"]
    volume = record.get("record_count") if record.get("record_count") is not None else ds["records"]
    fmt = lambda number: format(number, ",").replace(",", "," if lang == "en" else "\u202f")
    count = ds["sample"]["rows"]
    full = ds["license"] == "CC0-1.0" and count == ds["records"]
    license_name = record.get("license") or ds["license"]
    license_text = l("CC0 for metadata. Texts follow the license of each work.", "Метаданные — CC0. Для текстов действуют лицензии отдельных работ.", "Metamaʼlumotlar — CC0. Matnlar uchun har bir ish litsenziyasi amal qiladi.") if license_name == "LicenseRef-Mixed" else license_name
    kind = {"reference": l("Registry", "Справочник", "Maʼlumotnoma"), "geo": l("Geodata", "Геоданные", "Geomaʼlumotlar"), "bibliographic": l("Bibliography", "Библиография", "Bibliografiya")}[ds["kind"]]
    units = {"universities": l("universities", "вузов", "universitet"), "uz_medical_facilities": l("facilities", "медучреждения", "muassasa"), "ca_publications": l("works", "публикации", "nashr")}[slug]
    rows = typed_rows(ds)
    columns = [f["name"] for f in ds["fields"]][:6]
    sample_table = dataset_card.table(columns, [[row.get(col) for col in columns] for row in rows[:8]])
    fields = dataset_card.table([l("Field", "Поле", "Maydon"), l("Type", "Тип", "Tur"), l("Description", "Описание", "Tavsif")],
                                [[f["name"], f["type"], f["description"]] for f in ds["fields"]])
    hidden_fields = ""
    if ds["withheld_fields"]:
        hidden_fields = '<p class="sheet-caption">' + l("Fields outside the public sample", "Поля за пределами открытого образца", "Ochiq namunaga kiritilmagan maydonlar") + ' · ' + esc(", ".join(ds["withheld_fields"])) + '</p>'
    scope = l("Full registry", "Весь справочник", "Toʻliq maʼlumotnoma") if full else l("Public sample", "Открытый образец", "Ochiq namuna")
    data = '<p class="sheet-caption">' + scope + ' · ' + fmt(count) + ' / ' + fmt(ds["records"]) + '</p>' + dataset_card.base_preview(slug, rows, lang)
    data += dataset_card.base_charts(slug, lang)
    data += '<details class="sheet-extra"><summary>' + l("First rows of the source table", "Первые строки исходной таблицы", "Asl jadvalning ilk qatorlari") + '</summary>' + sample_table + '</details>'
    data += '<details class="sheet-extra"><summary>' + l("Field dictionary", "Словарь полей", "Maydonlar lugʻati") + ' · ' + str(len(ds["fields"])) + '</summary>' + fields + hidden_fields + '</details>'
    response = {"dataset": ds["id"], "license": ds["license"], "rows": count, "records": [{key: rows[0][key] for key in columns[:3]}] if rows else []}
    endpoint = BASE + "api/v0/datasets/" + slug + "/sample.json"
    api_body = '<p>' + l("Public API v0 · no key required", "Открытый API v0 · без ключа", "Ochiq API v0 · kalitsiz") + '</p><pre class="sheet-code">curl ' + esc(endpoint) + '</pre><p class="sheet-caption">' + l("Response excerpt", "Фрагмент ответа", "Javobdan parcha") + '</p><pre class="sheet-code">' + esc(json.dumps(response, ensure_ascii=False, indent=2)) + '</pre><p><a href="' + api + '/sample.json">' + l("Open JSON response", "Открыть ответ JSON", "JSON javobini ochish") + '</a></p><p><a href="' + api + '.json">' + l("Dataset metadata (JSON)", "Карточка API (JSON)", "Toʻplam metamaʼlumoti (JSON)") + '</a></p>'
    status = l("Ready", "Готов", "Tayyor") if ds["status"] == "ready" else l("In review", "На проверке", "Tekshiruvda")
    pii = l("None", "Нет", "Yoʻq") if ds["pii"] == "none" else l("Author names outside the public sample", "Имена авторов исключены из образца", "Muallif ismlari namunaga kiritilmagan")
    passport = dataset_card.metadata([(l("Dataset ID", "ID набора", "Toʻplam ID"), ds["id"]), (l("Version", "Версия", "Versiya"), ds["version"]), (l("Updated", "Обновлено", "Yangilangan"), ds["updated"]),
        (l("Preparation status", "Статус подготовки", "Tayyorlash holati"), status), (l("Personal data", "Персональные данные", "Shaxsiy maʼlumotlar"), pii), (l("ID prefix", "Префикс ID", "ID prefiksi"), ds["id_prefix"]),
        (l("Data languages", "Языки данных", "Maʼlumot tillari"), ", ".join(ds["languages"]))])
    full_description = T(lang, ds["description_en"], ds["description_ru"])
    if full_description != description:
        passport = '<p>' + esc(full_description) + '</p>' + passport
    passport += '<h3>' + l("What CORE added", "Что добавил CORE", "CORE nima qoʻshdi") + '</h3><ul class="checks">' + "".join('<li>' + esc(T(lang, en, ru)) + '</li>' for en, ru in zip(ds["adds_en"], ds["adds_ru"])) + '</ul>'
    csv = l("Download registry (CSV)", "Скачать справочник (CSV)", "Maʼlumotnomani yuklab olish (CSV)") if full else l("Download sample (CSV)", "Скачать образец (CSV)", "Namunani yuklab olish (CSV)")
    request = l("Discuss updates and integration", "Обсудить обновления и интеграцию", "Yangilash va integratsiyani muhokama qilish") if full else l("Request the full dataset", "Запросить полный набор", "Toʻliq toʻplamni soʻrash")
    request_url = "../index.html?dataset=" + ds["id"] + "#contact"
    primary = f'<a class="sheet-primary" href="{api}/sample.csv" download>{csv}</a>' if full else f'<a class="sheet-primary" href="{request_url}">{request}</a>'
    scope_note = l("The full registry is free to download and use, including commercially. Regular updates and integration are paid services.", "Весь справочник можно бесплатно скачать и использовать, в том числе в коммерческих продуктах. Регулярные обновления и интеграция оплачиваются отдельно.", "Toʻliq maʼlumotnomani bepul yuklab olish va tijorat maqsadida ham ishlatish mumkin. Muntazam yangilanish va integratsiya pullik xizmatlardir.") if full else l("The sample and metadata are free without registration. The full dataset, updates and full API are available under license.", "Образец и метаданные доступны бесплатно без регистрации. Полный набор, обновления и доступ к нему по API предоставляются по лицензии.", "Namuna va metamaʼlumotlar roʻyxatdan oʻtmasdan bepul. Toʻliq toʻplam, yangilanishlar va toʻliq API litsenziya asosida beriladi.")
    access = f'<p id="license">{esc(license_text)}</p><p>{scope_note}</p><p><a href="{api}/sample.csv" download>{csv}</a> · <a href="{api}/croissant.json">Croissant (JSON)</a></p><p><a href="{request_url}">{request}</a></p>'
    return dataset_card.sheet(eyebrow='<p class="sheet-kicker">' + esc(kind + " · " + " · ".join(countries)) + '</p>',
        title=esc(title), description='<p class="sheet-intro">' + esc(description) + '</p>', source=public_data.provenance_html(record, lang),
        facts=dataset_card.facts(fmt(volume) + " " + units, license_text, "v" + ds["version"]),
        actions='<div class="sheet-actions">' + primary + '<a class="sheet-text-action" href="#sheet-api">' + l("Try the API", "Попробовать API", "APIʼni sinash") + '</a></div>',
        data=dataset_card.section("data", lang, data), api=dataset_card.section("api", lang, api_body),
        passport=dataset_card.section("passport", lang, passport), access=dataset_card.section("access", lang, access), usage=public_data.usage_html(ds["id"], lang))


def region_card(match, lang):
    parts = dict(re.findall(r'<template data-region-part="(\w+)">(.*?)</template>', match[1], re.S))
    row = public_data.RECORDS.get("regions", {})
    def l(en, ru, uz):
        return public_data.tr(lang, en, ru, uz)
    organization = row.get("organization") or {}
    org_name = organization.get("name_" + lang) or organization.get("name") or "CORE"
    source = '<p class="sheet-by"><a href="organization.html?id=' + esc(row.get("organization_id") or "ORG-CORE") + '">' + esc(org_name) + '</a></p>'
    return dataset_card.sheet(title=parts["title"], description=parts["description"], source=source,
        eyebrow='<p class="sheet-kicker">' + l("Regional data", "Региональные данные", "Hududiy maʼlumotlar") + ' · ISO 3166-2</p>',
        facts=dataset_card.facts(str(row.get("record_count") or 48) + " " + l("regions", "регионов", "hudud"), l("4 countries", "4 страны", "4 mamlakat"), row.get("license")),
        actions='<div class="sheet-actions"><a class="sheet-primary" href="api/v0/regions.csv" download>' + l("Download the table (CSV)", "Скачать таблицу (CSV)", "Jadvalni yuklab olish (CSV)") + '</a><a class="sheet-text-action" href="#sheet-api">' + l("Try the API", "Попробовать API", "APIʼni sinash") + '</a></div>',
        **{key: dataset_card.section(key, lang, parts[key]) for key in dataset_card.SECTIONS},
        usage=public_data.usage_html("regions", lang))


def dataset_page(ds, nav, footer):
    s = ds["slug"]
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
    chart_data = dataset_card.base_chart_source(s, typed_rows(ds))
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
<link rel="stylesheet" href="../assets/dataset-card.css">
<script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
<script>window.CORE_DATA={chart_data};</script>
</head>
<body data-page="dataset">
{nav}
<main>
<section class="sec sec-first ds-page">
  <div class="wrap">
    <div class="sheet-wrap"><p class="crumbs mono small"><a href="../catalog.html" data-ru="Каталог">Catalog</a> / {esc(ds["id"])}</p>
    <!--CORE_BASE:{esc(s)}--></div>
  </div>
</section>
</main>
{footer}
<script src="../assets/config.js"></script>
<script src="../assets/i18n-uz.js"></script>
<script src="../assets/account-store.js"></script>
<script src="../assets/app.js"></script>
<script src="../assets/vendor/supabase-2.119.2.js"></script>
<script type="module" src="../assets/account-session.js"></script>
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

_VER = {}
def text_asset_hash(path):
    """Use LF bytes for text assets so Windows and Linux generate the same URLs."""
    relative = os.path.relpath(path, ROOT).replace(os.sep, "/")
    if relative in OUT:
        content = OUT[relative].replace(b"\r\n", b"\n")
    else:
        with open(path, "rb") as source:
            content = source.read().replace(b"\r\n", b"\n")
    return hashlib.sha1(content).hexdigest()[:8]

def asset_version(m):
    """Append ?v=<hash of the file> to local assets so a deploy is never hidden by browser cache."""
    attr, url = m.group(1), m.group(2)
    rel = url.split("assets/", 1)[1]
    if rel not in _VER:
        fp = os.path.join(ROOT, "assets", rel)
        _VER[rel] = text_asset_hash(fp) if os.path.exists(fp) else ""
    return '%s="%s%s"' % (attr, url, ("?v=" + _VER[rel]) if _VER[rel] else "")

def version_modules(text, page_dir):
    """Keep native module imports fresh using the existing content-hash mechanism."""
    text = re.sub(r'<script type="importmap" data-core-modules>.*?</script>\n?', "", text, flags=re.S)
    pattern = r'<script type="module" src="([^"]+)"></script>'
    maintained = ("assets/catalog-page.js", "assets/organization-page.js", "assets/account-session.js", "assets/dataset-page.js", "assets/contact-forms.js", "app/app.js")
    def target_of(entry):
        return posixpath.normpath(posixpath.join(page_dir, entry.group(1).split("?", 1)[0]))
    entries = [entry for entry in re.finditer(pattern, text) if target_of(entry) in maintained]
    if not entries:
        return text
    imports = {}
    for directory, _, filenames in os.walk(os.path.join(ROOT, "assets", "js")):
        for filename in sorted(filenames):
            if not filename.endswith(".js"):
                continue
            full = os.path.join(directory, filename)
            relative = os.path.relpath(full, ROOT).replace(os.sep, "/")
            url = posixpath.relpath(relative, page_dir or ".")
            if not url.startswith("."):
                url = "./" + url
            version = text_asset_hash(full)
            imports[url] = url + "?v=" + version
    mapping = '<script type="importmap" data-core-modules>' + json.dumps(
        {"imports": imports}, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ) + "</script>\n"
    def version_entry(entry):
        target = target_of(entry)
        if target not in maintained:
            return entry.group(0)
        src = entry.group(1).split("?", 1)[0]
        version = text_asset_hash(os.path.join(ROOT, target))
        return '<script type="module" src="' + src + "?v=" + version + '"></script>'
    start = entries[0].start()
    text = re.sub(pattern, version_entry, text)
    return text[:start] + mapping + text[start:]


def finalize(text, lang, page_path, meta):
    published_path = page_path if lang == "en" else lang + "/" + page_path
    assets = posixpath.relpath("assets", posixpath.dirname(published_path) or ".") + "/"
    if 'id="leadForm"' in text or 'data-quick-contact' in text or 'id="publicDataset"' in text:
        text = text.replace('</body>', '<script type="module" src="' + assets + 'contact-forms.js"></script>\n</body>')
    if page_path in ("datasets/universities.html", "datasets/uz_medical_facilities.html", "datasets/ca_publications.html", "regions.html"):
        ids = {"datasets/universities.html": "CORE-DS-0001", "datasets/uz_medical_facilities.html": "CORE-DS-0002", "datasets/ca_publications.html": "CORE-DS-0003", "regions.html": "regions"}
        text = text.replace('<body ', '<body data-dataset-id="' + ids[page_path] + '" ', 1)
        text = text.replace('<main>', '<template id="dataset-card-template">' + dataset_card.TEMPLATE + '</template><p class="wrap sec-first" id="datasetLoading" role="status">' + public_data.tr(lang, "Loading data…", "Загружаем данные…", "Maʼlumotlar yuklanmoqda…") + '</p><main hidden>', 1)
        text = text.replace('</body>', '<script type="module" src="' + assets + 'dataset-page.js"></script>\n<script type="module" src="' + assets + 'contact-forms.js"></script>\n</body>')
    text = re.sub(r'\b(src|href)="((?:\.\./)*assets/[^"?#]+\.(?:js|css))"', asset_version, text)
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
        if page_path in ("index.html", "catalog.html", "digests.html", "organization.html", "rankings.html", "agents.html", "universities.html"):
            text = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="%s">' % esc(t), text, count=1)
        text = re.sub(r"<title>.*?</title>", "<title>%s</title>" % esc(t), text, count=1, flags=re.S)
        text = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(d), text, count=1)
        text = re.sub(r'<meta property="og:description" content="[^"]*">', '<meta property="og:description" content="%s">' % esc(d), text, count=1)
    elif lang != "en" and page_path.startswith("datasets/"):
        ds = next(x for x in CAT if "datasets/" + x["slug"] + ".html" == page_path)
        title = T(lang, ds["title_en"], ds["title_ru"])
        text = re.sub(r"<title>.*?</title>", "<title>%s — %s · CORE</title>" % (esc(title), esc(ds["id"])), text, count=1, flags=re.S)
        text = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(T(lang, ds["description_en"], ds["description_ru"])), text, count=1)
    published_path = page_path if lang == "en" else lang + "/" + page_path
    return version_modules(text, posixpath.dirname(published_path))


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

# ================================================================== documents
LEGAL_DOCUMENTS = {
    "metadata-only": "dataset-licenses/01_METADATA_ONLY.md",
    "by-agreement": "dataset-licenses/02_BY_AGREEMENT.md",
    "open-cc-by-4-0": "dataset-licenses/03_OPEN_CC_BY_4_0.md",
    "data-use-agreement": "dataset-licenses/05_DATA_USE_AGREEMENT_TEMPLATE.md",
    "personal-data-consent": "personal-data-consent.md",
}

def document_inline(text):
    """Render the inline syntax used by the supplied documents, escaping all HTML."""
    tokens = re.split(r'(\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*|`[^`\n]+`|https?://[^\s<>]+)', text)
    result = []
    for token in tokens:
        link = re.fullmatch(r'\[([^\]]+)\]\(([^\s)]+)\)', token)
        if link:
            label, url = link.groups()
            if not re.match(r'^(?:https?://|mailto:)', url):
                raise ValueError("Unsupported document link: " + url)
            result.append('<a href="%s">%s</a>' % (esc(url), esc(label)))
        elif token.startswith("**") and token.endswith("**"):
            result.append("<strong>%s</strong>" % esc(token[2:-2]))
        elif token.startswith("`") and token.endswith("`"):
            result.append("<code>%s</code>" % esc(token[1:-1]))
        elif token.startswith(("https://", "http://")):
            url = token.rstrip(".,;:!?")
            result.append('<a href="%s">%s</a>%s' % (esc(url), esc(url), esc(token[len(url):])))
        else:
            result.append(esc(token))
    return "".join(result)

def document_markdown(text):
    """The source set uses headings, paragraphs, lists, quotations and simple tables."""
    lines = text.splitlines()
    result, index = [], 0
    while index < len(lines):
        line = lines[index].strip()
        index += 1
        if not line:
            continue
        heading = re.fullmatch(r'(#{1,3})\s+(.+)', line)
        if heading:
            level, label = len(heading[1]), heading[2]
            result.append('<h%d>%s</h%d>' % (level, document_inline(label), level))
        elif line.startswith("|") and index < len(lines) and re.fullmatch(r'\|[\s:|\-]+\|', lines[index].strip()):
            cells = lambda row: row.strip().strip("|").split("|")
            header = ''.join('<th scope="col">%s</th>' % document_inline(cell.strip()) for cell in cells(line))
            index += 1
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append('<tr>' + ''.join('<td>%s</td>' % document_inline(cell.strip()) for cell in cells(lines[index])) + '</tr>')
                index += 1
            result.append('<div class="document-table"><table><thead><tr>' + header + '</tr></thead><tbody>' + ''.join(rows) + '</tbody></table></div>')
        elif line.startswith("> "):
            quote = [line[2:]]
            while index < len(lines) and lines[index].strip().startswith("> "):
                quote.append(lines[index].strip()[2:])
                index += 1
            result.append('<blockquote><p>%s</p></blockquote>' % document_inline(" ".join(quote)))
        elif re.match(r'^-\s', line):
            items = [line[2:]]
            while index < len(lines) and re.match(r'^-\s', lines[index].strip()):
                items.append(lines[index].strip()[2:])
                index += 1
            result.append('<ul>' + ''.join('<li>%s</li>' % document_inline(item) for item in items) + '</ul>')
        else:
            paragraph = [line]
            while index < len(lines) and lines[index].strip():
                paragraph.append(lines[index].strip())
                index += 1
            result.append('<p>%s</p>' % document_inline(" ".join(paragraph)))
    return "\n".join(result)

def build_legal_documents():
    with open(os.path.join(ROOT, "src", "document.html"), encoding="utf-8") as source:
        template = source.read()
    source_root = os.path.join(ROOT, "data-src", "documents")
    for slug, source_path in LEGAL_DOCUMENTS.items():
        with open(os.path.join(source_root, source_path), "rb") as source:
            raw = source.read()
        text = raw.decode("utf-8")
        title = text.splitlines()[0].removeprefix("# ")
        page = template.replace("{{TITLE}}", esc(title)).replace("{{CONTENT}}", document_markdown(text))
        page = page.replace("{{SOURCE_URL}}", "files/" + source_path)
        page = page.replace("{{CANONICAL}}", BASE + "documents/" + slug + ".html")
        page = re.sub(r'\b(src|href)="((?:\.\./)*assets/[^"?#]+\.(?:js|css))"', asset_version, page)
        emit("documents/" + slug + ".html", page)
        emit("documents/files/" + source_path, raw)

# ================================================================== main
def build():
    global LOCAL_PAGES
    OUT.clear()
    _VER.clear()
    if os.path.exists(public_data.PATH):
        emit("assets/catalog-index.js", public_data.catalog_index())
        emit("api/v0/public-catalog.json", jdump(public_data.SNAPSHOT))
    build_api()
    build_hf()
    registry = json.loads(OUT["api/v0/universities.json"])["universities"]
    registry_date = next(ds["updated"] for ds in CAT if ds["slug"] == "universities")
    ranking_data = rankings.collect(registry, public_data.SNAPSHOT["datasets"], registry_date)
    src_index = open(os.path.join(ROOT, "src", "index.html"), encoding="utf-8").read()
    with open(os.path.join(ROOT, "src", "join-core.html"), encoding="utf-8") as source:
        join_cta = source.read()
    src_index = src_index.replace("<!--CORE_START_REPEAT-->", join_cta)
    nav = re.search(r"<!-- ============ NAV ============ -->.*?</header>", src_index, re.S).group(0)
    footer = re.search(r'<footer class="foot">.*?</footer>', src_index, re.S).group(0)
    def up(h):
        """Nav and footer for pages one folder deep (datasets/): every relative link goes one level up."""
        h = re.sub(r'href="#', 'href="../index.html#', h)
        h = re.sub(r'href="(?![a-z]+:|#|\.\./|/)([^"]+)"', r'href="../\1"', h)
        return h
    pages = {"index.html": src_index,
             "rankings.html": open(os.path.join(ROOT, "src", "rankings.html"), encoding="utf-8").read(),
             "agents.html": open(os.path.join(ROOT, "src", "agents.html"), encoding="utf-8").read(),
             "digests.html": open(os.path.join(ROOT, "src", "digests.html"), encoding="utf-8").read(),
             "universities.html": open(os.path.join(ROOT, "src", "universities.html"), encoding="utf-8").read(),
             "developers.html": open(os.path.join(ROOT, "src", "developers.html"), encoding="utf-8").read(),
             "regions.html": open(os.path.join(ROOT, "src", "regions.html"), encoding="utf-8").read(),
             "pricing.html": open(os.path.join(ROOT, "src", "pricing.html"), encoding="utf-8").read(),
             "how.html": open(os.path.join(ROOT, "src", "how.html"), encoding="utf-8").read(),
             "catalog.html": open(os.path.join(ROOT, "src", "catalog.html"), encoding="utf-8").read(),
             "dataset.html": open(os.path.join(ROOT, "src", "dataset.html"), encoding="utf-8").read(),
             "organization.html": open(os.path.join(ROOT, "src", "organization.html"), encoding="utf-8").read(),
             "documents.html": open(os.path.join(ROOT, "src", "documents.html"), encoding="utf-8").read()}
    for d in CAT:
        pages["datasets/" + d["slug"] + ".html"] = dataset_page(d, up(nav), up(footer))
    for row in public_data.SNAPSHOT["datasets"]:
        if row["kind"] == "dataset":
            page_path = "datasets/" + row["id"] + ".html"
            pages[page_path] = public_data.new_dataset_page(row, up(nav), up(footer), BASE)
            META[page_path] = {"title": {lang: public_data.tr(lang, "Dataset — CORE", "Набор данных — CORE", "Maʼlumotlar toʻplami — CORE") for lang in LANGS}, "desc": {lang: public_data.tr(lang, "Research data and access terms.", "Научные данные и условия доступа.", "Ilmiy maʼlumotlar va kirish shartlari.") for lang in LANGS}}
    LOCAL_PAGES = set(pages.keys()) | {"."}
    for path, text in pages.items():
        page_dir = posixpath.dirname(path)
        nav_target = {"digests.html": "index.html#digests"}.get(path, path)
        page_nav = nav.replace('href="%s"' % nav_target, 'href="%s" aria-current="page"' % nav_target, 1)
        text = text.replace("<!--CORE_SITE_NAV-->", page_nav).replace("<!--CORE_SITE_FOOTER-->", footer)
        text = text.replace("<!--CORE_JOIN_CTA-->", join_cta)
        text = text.replace("<!--CORE_DATASET_TEMPLATE-->", '<template id="dataset-card-template">' + dataset_card.TEMPLATE + '</template>')
        for lang in LANGS:
            t = localize(text, lang)
            if "<!--CORE_BASE:" in t:
                ds = next(item for item in CAT if path == "datasets/" + item["slug"] + ".html")
                t = t.replace("<!--CORE_BASE:" + ds["slug"] + "-->", base_details(ds, lang))
            if path == "regions.html":
                t = re.sub(r"<!--CORE_REGION_CARD-->(.*?)<!--/CORE_REGION_CARD-->", lambda m: region_card(m, lang), t, flags=re.S)
            t = public_data.inject(t, lang)
            if path in ("index.html", "rankings.html"):
                full = path == "rankings.html"
                marker = "<!--CORE_RANKINGS-->" if full else "<!--CORE_RANKINGS_PREVIEW-->"
                t = t.replace(marker, rankings.render(ranking_data, lang, UZ, full=full))
            t = t.replace("<!--CORE_DIGEST_PREVIEW-->", digests.render(lang, preview=True)).replace("<!--CORE_DIGESTS-->", digests.render(lang))
            t = relink(t, page_dir, 0 if lang == "en" else 1)
            t = finalize(t, lang, path, META.get(path))
            emit(path if lang == "en" else lang + "/" + path, t)
    build_legal_documents()
    for l in LANGS[1:]:
        emit(l + "/app/index.html", '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">'
             '<title>CORE</title><script>location.replace("../../app/index.html" + location.hash)</script>'
             '<a href="../../app/index.html">CORE</a>')
    with open(os.path.join(ROOT, "app", "index.html"), encoding="utf-8") as source:
        app_index = source.read()
    app_index = re.sub(r'<template id="dataset-card-template">.*?</template>', lambda _: '<template id="dataset-card-template">' + dataset_card.TEMPLATE + '</template>', app_index, flags=re.S)
    app_index = re.sub(r'\b(src|href)="((?:\.\./)*assets/[^"?#]+\.(?:js|css))(?:\?[^\"]*)?"', asset_version, app_index)
    css_version = text_asset_hash(os.path.join(ROOT, "app", "app.css"))
    app_index = re.sub(r'href="app\.css(?:\?[^\"]*)?"', 'href="app.css?v=' + css_version + '"', app_index)
    emit("app/index.html", version_modules(app_index, "app"))
    urls = [page_url(l, p) for p in pages for l in LANGS]
    emit("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
         + "".join("  <url><loc>%s</loc></url>\n" % u for u in urls + [BASE + "privacy.html"] + [BASE + "documents/" + slug + ".html" for slug in LEGAL_DOCUMENTS]) + "</urlset>\n")

def main():
    build()
    generated_dirs = ["api", "ru", "uz", "datasets", "hf", "documents"]
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
