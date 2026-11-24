"""Dataset detail presentation shared with the cabinet's embedded HTML template."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = (ROOT / "src" / "dataset-card.html").read_text(encoding="utf-8").strip()
SECTIONS = {
    "data": ("Data and insights", "Данные и инфографика", "Maʼlumotlar va infografika"),
    "api": ("API and examples", "API и примеры", "API va misollar"),
    "passport": ("Datasheet and quality", "Паспорт и качество", "Toʻplam pasporti va sifat"),
    "access": ("Access and terms", "Доступ и условия", "Kirish va shartlar"),
}


def esc(value):
    return html.escape(str(value if value is not None else ""))


def tr(lang, en, ru, uz):
    return {"en": en, "ru": ru, "uz": uz}[lang]


def sheet(**slots):
    def insert(match):
        value = slots.get(match[2], "")
        return match[1] + value if value else ""
    return re.sub(r"([ \t]*)\{\{(\w+)\}\}", insert, TEMPLATE)


def section(key, lang, body):
    if not body:
        return ""
    opened = " open" if key == "data" else ""
    return f'<details class="sheet-section"{opened}><summary>{tr(lang, *SECTIONS[key])}</summary><div class="sheet-body" id="sheet-{key}">{body}</div></details>'


def facts(*values):
    content = "".join(f"<span>{esc(value)}</span>" for value in values if value is not None and value != "")
    return f'<p class="sheet-facts">{content}</p>' if content else ""


def metadata(rows):
    content = "".join(f"<dt>{esc(label)}</dt><dd>{esc(value)}</dd>" for label, value in rows if value is not None and value != "")
    return f'<dl class="sheet-meta">{content}</dl>' if content else ""


def table(headers, rows):
    head = "".join(f'<th scope="col">{esc(label)}</th>' for label in headers)
    body = "".join("<tr>" + "".join(f'<td>{esc(value) if value is not None else "—"}</td>' for value in row) + "</tr>" for row in rows)
    return f'<div class="tscroll"><table class="sheet-table"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def base_preview(slug, rows, lang):
    def l(en, ru, uz):
        return tr(lang, en, ru, uz)

    if slug == "ca_publications":
        headers = [l("Publication", "Публикация", "Nashr"), l("Year", "Год", "Yil"), l("Language", "Язык", "Til")]
        values = [[r["title"], r["publication_year"], r["language"]] for r in rows[:3]]
    else:
        name_field = {"en": "name_en", "ru": "name_ru", "uz": "name_national"}[lang]
        names = [r.get(name_field) or r.get("name") or r.get("name_latin") for r in rows[:3]]
        if slug == "universities":
            headers = ["ID", l("University", "Вуз", "Universitet"), l("Country", "Страна", "Mamlakat")]
            values = [[r["id"], name, r["country"]] for r, name in zip(rows, names)]
        else:
            headers = [l("Facility", "Учреждение", "Muassasa"), l("Type", "Тип", "Tur"), l("Region", "Регион", "Hudud")]
            values = [[name, r["facility_type"], r["region_code"]] for r, name in zip(rows, names)]
    return table(headers, values)


def base_charts(slug, lang):
    """Mount the existing developer-page charts with their original controls and IDs."""
    def l(en, ru, uz):
        return tr(lang, en, ru, uz)
    if slug == "universities":
        title = l("Universities by country", "Вузы по странам", "Mamlakatlar boʻyicha universitetlar")
        search = l("Search universities", "Поиск по вузам", "Universitetlarni qidirish")
        filters = "".join(f'<button type="button" data-c="{code}"' + (' class="on"' if not code else '') + f'>{code or l("All", "Все", "Barchasi")}</button>' for code in ("", "UZ", "KZ", "KG", "TJ"))
        headers = ["ID", l("University", "Вуз", "Universitet"), l("City", "Город", "Shahar"), l("Works", "Работ", "Ishlar")]
        markup = f'<div class="bars" id="uniBars"></div><div class="table-tools"><input type="search" id="uniSearch" aria-label="{search}" placeholder="{search}"><div class="seg" id="uniCountry">{filters}</div></div>'
        grid_id, table_id = "t-uni", "uniTable"
    elif slug == "uz_medical_facilities":
        title = l("Facilities by type", "Медучреждения по типам", "Tibbiyot muassasalari turlari")
        headers = [l("Type", "Тип", "Tur"), l("Region", "Регион", "Hudud"), l("Specialties", "Направления", "Yoʻnalishlar"), l("Site languages", "Языки сайта", "Sayt tillari")]
        markup = '<div class="bars" id="medBars"></div>'
        grid_id, table_id = "t-med", "medTable"
    else:
        title = l("Research works by year and country", "Публикации по годам и странам", "Yil va mamlakat boʻyicha nashrlar")
        legend = "".join(f'<span><i style="background:var(--{color})"></i>{country}</span>' for country, color in zip(("UZ", "KZ", "KG", "TJ"), ("teal", "violet", "amber", "rose")))
        return f'<details class="sheet-extra"><summary>{title}</summary><div class="tabpanel on" id="t-pub"><div class="legend">{legend}</div><svg id="pubChart" viewBox="0 0 640 260" role="img" aria-label="{title}"></svg><div class="pub-mini"><div>{l("Languages", "Языки работ", "Nashr tillari")}<div class="bars compact" id="langBars"></div></div><div>{l("Co-author countries", "Страны соавторов", "Hammuallif mamlakatlari")}<div class="tagrow" id="partnerList"></div></div></div></div></details>'
    headings = "".join(f'<th scope="col">{label}</th>' for label in headers)
    return f'<details class="sheet-extra"><summary>{title}</summary><div class="tabpanel on" id="{grid_id}">{markup}<div class="tscroll tall"><table class="sheet-table" id="{table_id}"><thead><tr>{headings}</tr></thead><tbody></tbody></table></div></div></details>'


def base_chart_source(slug, rows):
    if slug == "universities":
        countries = {}
        universities = []
        for row in rows:
            country = row["country"]
            countries[country] = countries.get(country, 0) + 1
            universities.append([row["id"], row.get("name_en") or row["name"], country, None, None, row.get("city") or "", row.get("works_count") or 0, None, row.get("name_ru"), row.get("name_national")])
        data = {"uniByCountry": countries, "unis": universities}
    else:
        raw = (ROOT / "assets" / "data.js").read_text(encoding="utf-8")
        original = json.loads(raw.partition("=")[2].strip().rstrip(";"))
        keys = ("medTop", "medTypes") if slug == "uz_medical_facilities" else ("worksByYear", "languages", "partners")
        data = {key: original[key] for key in keys}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
