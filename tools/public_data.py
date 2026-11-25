"""Public Supabase snapshot shared by deterministic HTML and catalog builds."""
import html
import json
import os
import re
from urllib.parse import quote, urlparse
from pathlib import Path

import dataset_card

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


def dataset_path(row):
    pages = {"CORE-DS-0001": "datasets/universities.html", "CORE-DS-0002": "datasets/uz_medical_facilities.html", "CORE-DS-0003": "datasets/ca_publications.html", "regions": "regions.html"}
    return pages.get(row["id"], "dataset.html?id=" + quote(row["id"], safe=""))


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
    label = tr(lang, "Organization", "Организация", "Tashkilot")
    link = '<a href="../organization.html?id=%s">%s</a>' % (quote(organization_id, safe=""), esc(name))
    prepared = '<span>%s <a href="../organization.html?id=ORG-CORE">CORE</a></span>' % tr(lang, "Prepared by", "Подготовлено", "Tayyorlagan") if row["kind"] == "prep" else ""
    return '<div class="dataset-provenance"><span>%s · %s</span>%s</div>' % (label, link, prepared)


def usage_html(dataset_id, lang):
    groups = {}
    for row in SNAPSHOT["usage"]:
        if row["dataset_id"] == dataset_id and row.get("consumer"):
            groups.setdefault(row["consumer_id"], []).append(row)
    title = tr(lang, "Where the data is used", "Где используется", "Qayerda ishlatiladi")
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
        return ""
    return '<details class="sheet-section dataset-usage"><summary>%s</summary><div class="sheet-body"><ul class="usage-list">%s</ul></div></details>' % (title, body)


def record_html(row, lang, before_relink=False):
    def l(en, ru, uz):
        return tr(lang, en, ru, uz)
    license = row.get("license_info") or {}
    name = local(license.get("name"), lang) or row.get("license") or l("License unspecified", "Лицензия не указана", "Litsenziya koʻrsatilmagan")
    terms = local(license.get("description"), lang) or local(row.get("usage_terms"), lang)
    document = license_path(row)
    license_url = (("../" if lang == "en" or before_relink else "../../") + document) if document else safe_url(row.get("license_url"))
    restricted = row.get("license_id") in ("metadata-only", "by-agreement")
    links = [link for link in row.get("links", []) if safe_url(link.get("url")) and (not restricted or link.get("type") != "data")]
    link_labels = {"source": l("Source", "Источник", "Manba"), "data": l("Data files", "Файлы данных", "Maʼlumot fayllari"),
                   "code": l("Code", "Код", "Kod"), "publication": l("Publication", "Публикация", "Nashr"), "documentation": l("Documentation", "Документация", "Hujjatlar"),
                   "example": l("Example", "Пример", "Misol"), "license": l("License", "Лицензия", "Litsenziya"), "terms": l("Terms", "Условия", "Shartlar")}
    def link_list(items):
        content = "".join('<li><a href="%s" target="_blank" rel="noopener">%s</a></li>' % (esc(link["url"]), esc(link.get("title") or link_labels.get(link.get("type")) or link["url"])) for link in items)
        return '<ul class="dataset-links">' + content + '</ul>' if content else ""
    file = next((link["url"] for link in links if link.get("type") == "data"), "")
    source = safe_url(row.get("source_url")) or next((link["url"] for link in links if link.get("type") == "source"), "")
    target = file or source or "#sheet-access"
    action = l("Open data files", "Открыть файлы", "Fayllarni ochish") if file else l("Open source", "Открыть источник", "Manbani ochish") if source else l("Access and terms", "Доступ и условия", "Kirish va shartlar")
    token = row.get("token_count")
    token_label = l("Token count", "Количество токенов", "Tokenlar soni")
    data = link_list(link for link in links if link.get("type") == "example")
    if token is not None:
        data += dataset_card.metadata([(token_label, token), (l("Tokenizer", "Токенизатор", "Tokenizator"), row.get("tokenizer")),
            (l("Counting method", "Метод подсчёта", "Hisoblash usuli"), token_method(row.get("token_method"), lang)),
            (l("Material counted", "Посчитанный материал", "Hisoblangan material"), row.get("token_material")),
            (l("Data version", "Версия данных", "Maʼlumotlar versiyasi"), row.get("data_version"))])
    countries = ", ".join(row.get("countries") or [])
    passport = dataset_card.metadata([(l("Topic", "Тематика", "Mavzu"), row.get("category")), (l("Countries", "Страны данных", "Mamlakatlar"), countries),
        (l("Data languages", "Языки данных", "Maʼlumotlar tillari"), ", ".join(row.get("languages") or [])), (l("Version", "Версия", "Versiya"), row.get("data_version")),
        (l("Formats", "Форматы", "Formatlar"), row.get("formats")), (l("Publication year", "Год публикации", "Nashr yili"), row.get("publication_year"))])
    passport += link_list(link for link in links if link.get("type") not in ("example", "data", "license", "terms"))
    if source and not any(link["url"] == source for link in links):
        passport += '<p><a href="%s">%s</a></p>' % (esc(source), l("Source page", "Страница источника", "Manba sahifasi"))
    access = '<b>' + esc(name) + '</b>' + ('<p class="dataset-description">' + esc(terms) + '</p>' if terms else '')
    if license_url:
        access += '<p><a href="%s">%s</a></p>' % (esc(license_url), l("Read the license", "Посмотреть выбранную лицензию", "Tanlangan litsenziyani koʻrish"))
    access += link_list(link for link in links if link.get("type") in ("data", "license", "terms"))
    count = row.get("record_count")
    volume = (l("Records", "Записи", "Yozuvlar") + " · " + str(count)) if count is not None else None
    description = local(row.get("description"), lang)
    return dataset_card.sheet(eyebrow=f'<p class="sheet-kicker">{esc(countries)}</p>' if countries else "",
        title=esc(local(row.get("title"), lang)), description=f'<p class="sheet-intro">{esc(description)}</p>' if description else "",
        source=provenance_html(row, lang), facts=dataset_card.facts(volume, name), actions=f'<div class="sheet-actions"><a class="sheet-primary" href="{esc(target)}">{action}</a></div>',
        data=dataset_card.section("data", lang, data), passport=dataset_card.section("passport", lang, passport),
        access=dataset_card.section("access", lang, access), usage=usage_html(row["id"], lang))


def new_dataset_page(row, nav, footer, base_url):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", row["id"]):
        raise ValueError("Invalid public dataset ID")
    # Only the ID is built into this shell. Content and visibility are read live.
    page = Path(ROOT, "src", "dataset.html").read_text(encoding="utf-8")
    page = page.replace('id="publicDataset"', 'id="publicDataset" data-dataset-id="' + esc(row["id"]) + '"')
    page = re.sub(r'(src|href)="assets/', r'\1="../assets/', page)
    return page.replace("<!--CORE_SITE_NAV-->", nav).replace("<!--CORE_SITE_FOOTER-->", footer)


def inject(text, lang):
    text = re.sub(r"<!--CORE_USAGE:([^>]+)-->", lambda match: usage_html(match[1], lang), text)
    text = re.sub(r"<!--CORE_PROVENANCE:([^>]+)-->", lambda match: provenance_html(RECORDS.get(match[1]), lang), text)
    text = text.replace("<!--CORE_CATALOG_METRICS-->", metrics_html(lang))
    return re.sub(r"<!--CORE_RECORD:([^>]+)-->", lambda match: record_html(RECORDS[match[1]], lang, before_relink=True), text)
