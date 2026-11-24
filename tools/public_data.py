"""Public Supabase snapshot shared by deterministic HTML and catalog builds."""
import html
import json
import os
import re
from urllib.parse import urlparse
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


def catalog_item(row):
    organization = row.get("organization") or {}
    return {"id": row["id"], "t": row["kind"], "title": row["title"], "desc": row["description"],
            "org": {lang: organization.get("name_" + lang) or organization.get("name") or "" for lang in ("en", "ru", "uz")},
            "organizationId": row["organization_id"], "c": ";".join(row["countries"]), "f": row["category"],
            "lic": row["license"], "st": row["access_type"], "n": row["record_count"], "y": row["publication_year"],
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
        body = '<p class="small muted">%s: %d</p><ul class="usage-list">%s</ul>' % (tr(lang, "Consumers", "Потребители", "Foydalanuvchilar"), len(groups), body)
    return '<section class="card dataset-usage"><h2>%s</h2>%s</section>' % (title, body)


def record_html(row, lang):
    organization = row.get("organization") or {}
    labels = [(tr(lang, "Organization", "Организация", "Tashkilot"), organization.get("name_" + lang) or organization.get("name") or ""),
              (tr(lang, "License", "Лицензия", "Litsenziya"), row["license"] or "—"),
              (tr(lang, "Countries", "Страны", "Mamlakatlar"), ", ".join(row["countries"])),
              (tr(lang, "Languages", "Языки", "Tillar"), ", ".join(row["languages"])),
              (tr(lang, "Records", "Записи", "Yozuvlar"), row["record_count"] if row["record_count"] is not None else "—"),
              (tr(lang, "Tokens", "Токены", "Tokenlar"), row["token_count"] if row["token_count"] is not None else tr(lang, "No data", "Нет данных", "Maʼlumot yoʻq"))]
    if row["token_count"] is not None:
        labels.append((tr(lang, "Counting method", "Метод подсчёта", "Hisoblash usuli"), " · ".join(str(row.get(key) or "") for key in ("tokenizer", "token_method", "token_material", "data_version"))))
    terms = local(row["usage_terms"], lang)
    links = list(row["links"])
    if row["license_url"]:
        links.append({"title": tr(lang, "License text", "Текст лицензии", "Litsenziya matni"), "url": row["license_url"]})
    link_html = "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>' % (esc(link["url"]), esc(link.get("title") or link.get("type") or link["url"])) for link in links if safe_url(link.get("url")))
    return '<h1 class="h1-page">%s</h1><p class="sub dataset-description">%s</p><section class="card"><dl class="kv">%s</dl>%s%s</section>%s' % (
        esc(local(row["title"], lang)), esc(local(row["description"], lang)), "".join('<div><dt>%s</dt><dd>%s</dd></div>' % (esc(label), esc(value)) for label, value in labels),
        '<h2>%s</h2><p class="dataset-description">%s</p>' % (tr(lang, "Terms of use", "Условия использования", "Foydalanish shartlari"), esc(terms)) if terms else "",
        '<ul class="dataset-links">%s</ul>' % link_html if link_html else "", usage_html(row["id"], lang))


def new_dataset_page(row, nav, footer, base_url):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", row["id"]):
        raise ValueError("Invalid public dataset ID")
    schema = {"@context": "https://schema.org", "@type": "Dataset", "identifier": row["id"], "name": local(row["title"], "en"),
              "description": local(row["description"], "en"), "dateModified": row["updated_at"], "url": base_url + "datasets/" + row["id"] + ".html"}
    if safe_url(row["license_url"]):
        schema["license"] = row["license_url"]
    encoded = json.dumps(schema, ensure_ascii=False).replace("<", "\\u003c")
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>%s — CORE</title><link rel="stylesheet" href="../assets/styles.css"><script type="application/ld+json">%s</script></head><body data-page="dataset">%s<main><section class="sec sec-first ds-page"><div class="wrap"><!--CORE_RECORD:%s--></div></section></main>%s<script src="../assets/config.js"></script><script src="../assets/account-store.js"></script><script src="../assets/vendor/supabase-2.119.2.js"></script><script src="../assets/app.js"></script><script type="module" src="../assets/account-session.js"></script></body></html>' % (esc(local(row["title"], "en")), encoded, nav, row["id"], footer)


def inject(text, lang):
    text = re.sub(r"<!--CORE_USAGE:([^>]+)-->", lambda match: usage_html(match[1], lang), text)
    return re.sub(r"<!--CORE_RECORD:([^>]+)-->", lambda match: record_html(RECORDS[match[1]], lang), text)
