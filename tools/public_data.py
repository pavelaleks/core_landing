"""Public Supabase snapshot shared by deterministic HTML and catalog builds."""
import html
import json
import os
import re
from urllib.parse import quote, urlparse
from pathlib import Path

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data-src", "public-catalog.json")
SNAPSHOT = json.loads(Path(PATH).read_text(encoding="utf-8")) if os.path.exists(PATH) else {"datasets": [], "usage": []}
RECORDS = {row["id"]: row for row in SNAPSHOT["datasets"]}


def local(value, lang):
    return value.get(lang) or value.get("ru") or value.get("en") or value.get("uz") or "" if isinstance(value, dict) else str(value or "")


def tr(lang, en, ru, uz):
    return {"en": en, "ru": ru, "uz": uz}[lang]


def esc(value):
    return html.escape(str(value if value is not None else ""), quote=True)


def safe_url(value):
    return value if value and urlparse(value).scheme in ("https", "http") else ""


def license_path(row):
    path = (row.get("license_info") or {}).get("document_path") or ""
    return path if re.fullmatch(r"documents/[a-z0-9-]+\.html", path) else ""


def token_method(value, lang):
    return {"calculated": tr(lang, "Counted", "Подсчитано", "Hisoblangan"),
            "estimated": tr(lang, "Estimated", "Оценка", "Taxminiy"),
            "declared": tr(lang, "Reported by the author", "Указано автором", "Muallif koʻrsatgan")}.get(value, "")


def catalog_item(row):
    organization = row.get("organization") or {}
    return {"id": row["id"], "t": row["kind"], "title": row["title"], "desc": row["description"],
            "org": {lang: organization.get("name_" + lang) or organization.get("name") or "" for lang in ("en", "ru", "uz")},
            "organizationId": row["organization_id"], "c": ";".join(row["countries"]), "f": row["category"],
            "lic": row["license"], "license": row.get("license_info"), "st": row["access_type"], "n": row["record_count"], "y": row["publication_year"],
            "href": row["source_url"] or "app/index.html#dataset/" + row["id"], "fm": row["formats"],
            "ca": int(row["mentions_central_asia"]), "tokens": row["token_count"], "tokenizer": row["tokenizer"], "tokenMethod": row["token_method"]}


def catalog_index():
    universities = json.loads(Path(ROOT, "api", "v0", "universities.json").read_text(encoding="utf-8"))["universities"]
    names = {u["id"]: " ".join(str(u.get(key) or "") for key in ("name", "name_national", "name_ru", "name_en", "acronyms")) for u in universities}
    aliases = {}
    items = [catalog_item(row) for row in SNAPSHOT["datasets"]]
    for item in items:
        if item["organizationId"] in names:
            aliases[item["org"]["en"]] = names[item["organizationId"]]
    return "window.CORE_CATALOG=" + json.dumps(items, ensure_ascii=False, separators=(",", ":")) + ";\nwindow.CORE_UNI_ALT=" + json.dumps(aliases, ensure_ascii=False, separators=(",", ":")) + ";"


def catalog_metrics():
    rows = [row for row in SNAPSHOT["datasets"] if row.get("publication_status") == "published"]
    sizes = [row["record_count"] for row in rows if isinstance(row.get("record_count"), int) and row["record_count"] >= 0]
    return {"datasets": len(rows), "organizations": len({row["organization_id"] for row in rows if row.get("organization_id")}),
            "records": sum(sizes), "sized_datasets": len(sizes)}


def metrics_html(lang):
    metrics = catalog_metrics()
    def number(value):
        return format(value, ",").replace(",", "\u202f" if lang != "en" else ",")
    scope = tr(lang, "Reported volume in {known} of {total} datasets", "Объём указан для {known} из {total} наборов", "Hajm {total} toʻplamdan {known} tasida koʻrsatilgan").format(known=number(metrics["sized_datasets"]), total=number(metrics["datasets"]))
    values = [(metrics["datasets"], tr(lang, "Datasets", "Датасеты", "Toʻplamlar"),
               tr(lang, "CORE materials and researchers’ open datasets", "Материалы CORE и открытые наборы исследователей", "CORE materiallari va tadqiqotchilarning ochiq toʻplamlari")),
              (metrics["organizations"], tr(lang, "Organizations", "Организации", "Tashkilotlar"),
               tr(lang, "Universities and companies in the catalog", "Университеты и компании в каталоге", "Katalogdagi universitetlar va kompaniyalar")),
              (metrics["records"] if metrics["sized_datasets"] else "—", tr(lang, "Data records", "Записи в наборах", "Toʻplamlardagi yozuvlar"), scope)]
    items = []
    for value, label, note in values:
        formatted = number(value) if isinstance(value, int) else value
        items.append(f'''<div class="catalog-scale-item">
          <dt>{esc(label)}</dt>
          <dd class="catalog-scale-value">{formatted}</dd>
          <dd class="catalog-scale-note">{esc(note)}</dd>
        </div>''')
    title = tr(lang, "Inside the catalog", "Масштаб каталога", "Katalog koʻlami")
    action = tr(lang, "Explore the datasets", "Посмотреть датасеты", "Toʻplamlarni koʻrish")
    return f'''<section class="catalog-scale" aria-labelledby="catalog-scale-title">
      <div class="wrap">
        <div class="catalog-scale-heading">
          <h2 id="catalog-scale-title">{title}</h2>
          <a class="campus-text-link" href="catalog.html">{action} ↗</a>
        </div>
        <dl class="catalog-scale-grid">{"".join(items)}</dl>
      </div>
    </section>'''


def provenance_html(row, lang):
    if not row:
        return ""
    organization = row.get("organization") or {}
    organization_id = row.get("organization_id")
    if not organization_id:
        return ""
    name = organization.get("name_" + lang) or organization.get("name") or organization_id
    label = tr(lang, "Source", "Источник", "Manba") if row["kind"] in ("open", "prep") else tr(lang, "Organization", "Организация", "Tashkilot")
    link = '<a href="../organization.html?id=%s">%s</a>' % (quote(organization_id, safe=""), esc(name))
    prepared = '<span>%s <a href="../organization.html?id=ORG-CORE">CORE</a></span>' % tr(lang, "Prepared by", "Подготовлено", "Tayyorlagan") if row["kind"] == "prep" else ""
    return '<div class="dataset-provenance"><span>%s · %s</span>%s</div>' % (label, link, prepared)


def usage_html(dataset_id, lang):
    groups = {}
    for row in SNAPSHOT["usage"]:
        if row["dataset_id"] == dataset_id and row.get("consumer"):
            groups.setdefault(row["consumer_id"], []).append(row)
    title = tr(lang, "Where the data is used", "Где используются данные", "Maʼlumotlar qayerda ishlatiladi")
    body = ""
    for rows in groups.values():
        consumer = rows[0]["consumer"]
        name = esc(local(consumer["name"], lang))
        url = safe_url(consumer.get("url"))
        if url:
            name = '<a href="%s" target="_blank" rel="noopener">%s</a>' % (esc(url), name)
        demo = any(row["is_demo"] for row in rows) or consumer["is_demo"]
        scopes = sorted({tr(lang, "Data", "Содержимое", "Maʼlumotlar") if row["usage_scope"] == "data" else tr(lang, "Metadata", "Метаданные", "Metamaʼlumotlar") for row in rows})
        purposes = list(dict.fromkeys(local(row["purpose"], lang) for row in rows))
        result_links = list(dict.fromkeys(safe_url(row.get("result_url")) for row in rows))
        body += '<li><div class="usage-title"><b>%s</b>%s</div><p class="small muted">%s</p>%s%s</li>' % (
            name, '<span class="usage-demo">%s</span>' % tr(lang, "Demo", "Демо", "Namoyish") if demo else "",
            esc(" + ".join(scopes)), "".join('<p class="small">%s</p>' % esc(purpose) for purpose in purposes if purpose),
            "".join('<a class="small" href="%s" target="_blank" rel="noopener">%s</a>' % (esc(url), tr(lang, "Result", "Результат", "Natija")) for url in result_links if url))
    if not body:
        body = '<p class="small muted">%s</p>' % tr(lang, "Information about use has not been added yet.", "Сведения об использовании пока не добавлены.", "Foydalanish haqida maʼlumot hali qoʻshilmagan.")
    else:
        body = '<p class="small muted">%s: %d</p><ul class="usage-list">%s</ul>' % (tr(lang, "Who uses the data", "Кто использует данные", "Maʼlumotlardan kim foydalanadi"), len(groups), body)
    return '<section class="card dataset-usage"><h2>%s</h2>%s</section>' % (title, body)


def record_html(row, lang):
    organization = row.get("organization") or {}
    license = row.get("license_info") or {}
    labels = [(tr(lang, "Organization", "Организация", "Tashkilot"), organization.get("name_" + lang) or organization.get("name") or ""),
              (tr(lang, "License", "Лицензия", "Litsenziya"), local(license.get("name"), lang) or row["license"] or "—"),
              (tr(lang, "Countries covered", "Страны данных", "Maʼlumotlar mamlakatlari"), ", ".join(row["countries"])),
              (tr(lang, "Data languages", "Языки данных", "Maʼlumotlar tillari"), ", ".join(row["languages"])),
              (tr(lang, "Records", "Количество записей", "Yozuvlar soni"), row["record_count"] if row["record_count"] is not None else "—"),
              (tr(lang, "Token count", "Количество токенов", "Tokenlar soni"), row["token_count"] if row["token_count"] is not None else tr(lang, "No data", "Нет данных", "Maʼlumot yoʻq"))]
    if row["token_count"] is not None:
        labels.append((tr(lang, "How the token count was obtained", "Как получено количество токенов", "Tokenlar soni qanday olingan"), " · ".join([row.get("tokenizer") or "", token_method(row["token_method"], lang), row.get("token_material") or "", row.get("data_version") or ""])))
    terms = local(license.get("description"), lang) if license else local(row["usage_terms"], lang)
    links = list(row["links"])
    document = license_path(row)
    if not license and row["license_url"]:
        links.append({"title": tr(lang, "License text", "Текст лицензии", "Litsenziya matni"), "url": row["license_url"]})
    link_html = "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>' % (esc(link["url"]), esc(link.get("title") or link.get("type") or link["url"])) for link in links if safe_url(link.get("url")))
    if document:
        link_html += '<li><a href="%s">%s</a></li>' % (("../../" if lang != "en" else "../") + document, tr(lang, "Read the license", "Посмотреть выбранную лицензию", "Tanlangan litsenziyani koʻrish"))
    return '<h1 class="h1-page">%s</h1>%s<p class="sub dataset-description">%s</p><section class="card"><dl class="kv">%s</dl>%s%s</section>%s' % (
        esc(local(row["title"], lang)), provenance_html(row, lang), esc(local(row["description"], lang)), "".join('<div><dt>%s</dt><dd>%s</dd></div>' % (esc(label), esc(value)) for label, value in labels),
        '<p class="dataset-description">%s</p>' % esc(terms) if terms else "",
        '<ul class="dataset-links">%s</ul>' % link_html if link_html else "", usage_html(row["id"], lang))


def new_dataset_page(row, nav, footer, base_url):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", row["id"]):
        raise ValueError("Invalid public dataset ID")
    schema = {"@context": "https://schema.org", "@type": "Dataset", "identifier": row["id"], "name": local(row["title"], "en"),
              "description": local(row["description"], "en"), "dateModified": row["updated_at"], "url": base_url + "datasets/" + row["id"] + ".html"}
    if license_path(row):
        schema["license"] = base_url + license_path(row)
    elif safe_url(row["license_url"]):
        schema["license"] = row["license_url"]
    encoded = json.dumps(schema, ensure_ascii=False).replace("<", "\\u003c")
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>%s — CORE</title><link rel="stylesheet" href="../assets/styles.css"><script type="application/ld+json">%s</script></head><body data-page="dataset">%s<main><section class="sec sec-first ds-page"><div class="wrap"><!--CORE_RECORD:%s--></div></section></main>%s<script src="../assets/config.js"></script><script src="../assets/account-store.js"></script><script src="../assets/vendor/supabase-2.119.2.js"></script><script src="../assets/app.js"></script><script type="module" src="../assets/account-session.js"></script></body></html>' % (esc(local(row["title"], "en")), encoded, nav, row["id"], footer)


def inject(text, lang):
    text = re.sub(r"<!--CORE_USAGE:([^>]+)-->", lambda match: usage_html(match[1], lang), text)
    text = re.sub(r"<!--CORE_PROVENANCE:([^>]+)-->", lambda match: provenance_html(RECORDS.get(match[1]), lang), text)
    text = text.replace("<!--CORE_CATALOG_METRICS-->", metrics_html(lang))
    return re.sub(r"<!--CORE_RECORD:([^>]+)-->", lambda match: record_html(RECORDS[match[1]], lang), text)
