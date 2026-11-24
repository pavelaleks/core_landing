"""Build both university rankings from the public catalog and the current registry."""
from collections import Counter, defaultdict
import json
from pathlib import Path
from string import Template

from public_data import ROOT, esc, tr


PANEL = Template(Path(ROOT, "src", "rankings-panel.html").read_text(encoding="utf-8"))
TOPICS = Path(ROOT, "assets", "i18n-topics.js").read_text(encoding="utf-8")
TOPIC_RU = json.loads(TOPICS[TOPICS.index("{"):TOPICS.rindex("}") + 1])
FIELD_NAMES = {
    "Computer Science": ("Информатика", "Informatika"),
    "Biochemistry, Genetics and Molecular Biology": ("Биохимия, генетика и молекулярная биология", "Biokimyo, genetika va molekulyar biologiya"),
    "Dentistry": ("Стоматология", "Stomatologiya"),
    "Immunology and Microbiology": ("Иммунология и микробиология", "Immunologiya va mikrobiologiya"),
    "Pharmacology, Toxicology and Pharmaceutics": ("Фармакология, токсикология и фармацевтика", "Farmakologiya, toksikologiya va farmatsevtika"),
}
COUNTRIES = {
    "KZ": ("Kazakhstan", "Казахстан", "Qozogʻiston"), "KG": ("Kyrgyzstan", "Кыргызстан", "Qirgʻiziston"),
    "TJ": ("Tajikistan", "Таджикистан", "Tojikiston"), "UZ": ("Uzbekistan", "Узбекистан", "Oʻzbekiston"),
}
SHORT_NAMES = {"UNI-KZ-0098": "КазНУ", "UNI-KZ-0070": "ЕНУ", "UNI-UZ-0132": "НУУз", "UNI-UZ-0180": "УрГУ"}


def ranked(counts):
    rows = []
    previous = None
    for index, (uid, value) in enumerate(sorted(counts.items(), key=lambda pair: (-pair[1], pair[0])), 1):
        if value != previous:
            place = index
            previous = value
        rows.append({"id": uid, "value": value, "place": place})
    return rows


def collect(universities, records, works_date):
    registry = {u["id"]: u for u in universities}
    by_field = defaultdict(Counter)
    total = Counter()
    last_update = ""
    for row in {r["id"]: r for r in records}.values():
        uid = row.get("organization_id")
        if uid not in registry or row.get("publication_status") != "published" or row.get("kind") != "open":
            continue
        total[uid] += 1
        if row.get("category"):
            by_field[row["category"]][uid] += 1
        last_update = max(last_update, (row.get("updated_at") or "")[:10])
    works = {uid: u["works_count"] for uid, u in registry.items() if type(u.get("works_count")) is int and u["works_count"] >= 0}
    return {"registry": registry, "open": {"": ranked(total), **{f: ranked(v) for f, v in by_field.items()}},
            "works": ranked(works), "open_date": last_update, "works_date": works_date}


def field_label(key, lang, uz):
    if key in FIELD_NAMES:
        return tr(lang, key, *FIELD_NAMES[key])
    ru = TOPIC_RU.get(key, key)
    return tr(lang, key, ru, uz.get(ru, ru))


def university_label(row, lang, full):
    local = row.get("name_national") if lang == "uz" and row["country"] == "UZ" else row.get("name_" + lang)
    name = local or row.get("name_en" if lang == "uz" else "name") or row.get("name") or row["id"]
    code = row["country"]
    result = {"name": name, "country": tr(lang, *COUNTRIES[code]) if code in COUNTRIES else code}
    if full:
        aliases = [row.get(k) for k in ("name", "name_ru", "name_en", "name_national", "acronyms")] + [SHORT_NAMES.get(row["id"])]
        result["aliases"] = " ".join(dict.fromkeys(s for s in aliases if s and s != name))
    return result


def render(snapshot, lang, uz, *, full):
    def t(en, ru, uz_text):
        return tr(lang, en, ru, uz_text)

    limit = 5 if full else 3
    open_lists = {key: rows if full else rows[:limit] for key, rows in snapshot["open"].items()}
    works = snapshot["works"] if full else snapshot["works"][:limit]
    ids = sorted({row["id"] for group in [*open_lists.values(), works] for row in group})
    labels = {uid: university_label(snapshot["registry"][uid], lang, full) for uid in ids}
    payload = json.dumps({"universities": labels, "open": open_lists, "works": works},
                         ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    options = sorted(((field_label(f, lang, uz), f) for f in open_lists if f), key=lambda p: p[0].casefold())
    fields = "".join(f'<option value="{esc(key)}">{esc(label)}</option>' for label, key in options)
    first = open_lists[""][:limit]
    rows = []
    for row in first:
        label = labels[row["id"]]
        value = format(row["value"], ",").replace(",", "," if lang == "en" else "\u202f")
        rows.append(f'<tr><td>{row["place"]}</td><td><strong>{esc(label["name"])}</strong>'
                    f'<small>{esc(label["country"])}</small></td><td>{value}</td></tr>')
    empty = t("No universities found.", "Вузы не найдены.", "Universitetlar topilmadi.")
    search = ""
    if full:
        search = (f'<label class="rank-search">{t("Find a university", "Поиск вуза", "Universitetni qidirish")}'
                  f'<input type="search" placeholder="{t("Name or abbreviation", "Название или сокращение", "Nomi yoki qisqartmasi")}" autocomplete="off"></label>')
        actions = (f'<div class="rank-pager"><span data-range aria-live="polite"></span>'
                   f'<button type="button" data-step="-1" aria-label="{t("Previous page", "Предыдущая страница", "Oldingi sahifa")}" disabled>←</button>'
                   f'<button type="button" data-step="1" aria-label="{t("Next page", "Следующая страница", "Keyingi sahifa")}">→</button></div>')
    else:
        actions = (f'<a class="btn btn-primary btn-sm" data-full-list href="rankings.html">'
                   f'{t("Find your university", "Найти свой вуз", "Universitetingizni toping")} →</a>')

    def source(label, date):
        return esc(label) + (f' · <time datetime="{esc(date)}">{esc(date)}</time>' if date else "")

    back = (f'<a data-back class="rank-back" href="index.html#rankings">← {t("Home", "На главную", "Bosh sahifaga")}</a>' if full else "")
    return PANEL.substitute(
        mode="full" if full else "preview", limit=limit, back=back, heading="h1" if full else "h2",
        title=t("University rankings", "Рейтинги вузов", "Universitetlar reytinglari"),
        scope=t("Kazakhstan, Kyrgyzstan, Tajikistan and Uzbekistan", "Казахстан, Кыргызстан, Таджикистан и Узбекистан", "Qozogʻiston, Qirgʻiziston, Tojikiston va Oʻzbekiston"),
        open_tab=t("Open data", "Открытые данные", "Ochiq maʼlumotlar"), works_tab=t("Research works", "Научные работы", "Ilmiy ishlar"),
        search=search, field_label=t("Research field", "Область данных", "Ilmiy soha"), all_fields=t("All fields", "Все области", "Barcha sohalar"), fields=fields,
        rank=t("Rank", "Место", "Oʻrin"), university=t("University", "Вуз", "Universitet"),
        datasets=t("Datasets", "Наборы", "Toʻplamlar"), works=t("Works", "Работы", "Ishlar"), empty=empty,
        rows="".join(rows) or f'<tr><td colspan="3">{empty}</td></tr>',
        open_source=source(t("Source — CORE catalog", "Источник — каталог CORE", "Manba — CORE katalogi"), snapshot["open_date"]),
        works_source=source(t("Source — OpenAlex", "Источник — OpenAlex", "Manba — OpenAlex"), snapshot["works_date"]),
        actions=actions, of=t("of", "из", "/"), payload=payload,
    )
