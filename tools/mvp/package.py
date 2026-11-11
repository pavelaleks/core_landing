"""Turn the processed folders into download packages: data + codebook + datasheet + licence + Croissant + zip."""
import json, os, sys, zipfile, hashlib, csv, shutil, datetime
SRC, RAW, OUT = sys.argv[1:4]
BASE = "https://pavelaleks.github.io/core_landing/"
META = {
 "terms": dict(slug="uzbek-geography-terms", file="uzbek_geography_terms.csv", zenodo="21704211",
   title_en="Uzbek geography terminology, annotated", title_ru="Терминология географии на узбекском, размеченная", title_uz="Oʻzbek tilidagi geografiya terminologiyasi, belgilangan",
   uni="Urgench State University", uni_ru="Ургенчский государственный университет", country="UZ", field_ru="Язык и знания", field_en="Language and knowledge",
   buyers_en="AI developers (Uzbek LLMs, translation, RAG for education), EdTech, publishers of textbooks", buyers_ru="Разработчики ИИ (узбекские языковые модели, перевод, поиск по учебникам), EdTech, издательства учебников",
   added_en=["Spelling normalised to the standard Uzbek Latin alphabet; duplicates removed", "Frequency in school (grades 5–11) and university textbooks, and the grade where each term first appears", "Context example from the corpus for every term found", "Russian and English equivalents and a subject category for the 320 most frequent terms", "Spelling variants and terms absent from the corpus flagged for the authors"],
   added_ru=["Написание приведено к стандартной узбекской латинице, убраны дубли", "Частота в школьных (5–11 кл.) и вузовских учебниках и класс, где термин появляется впервые", "Пример употребления из корпуса для каждого найденного термина", "Русские и английские эквиваленты и тематическая категория для 320 самых частых терминов", "Варианты написания и термины, которых нет в корпусе, помечены для авторов"]),
 "insurance": dict(slug="insurance-literacy-syrdarya", file="insurance_survey_syrdarya.csv", zenodo="21217676",
   title_en="Insurance literacy and inclusion survey, Syrdarya region (n = 353)", title_ru="Опрос о страховой грамотности и охвате, Сырдарьинская область (353 человека)", title_uz="Sugʻurta savodxonligi va qamrovi soʻrovi, Sirdaryo viloyati (353 kishi)",
   uni="Gulistan State University", uni_ru="Гулистанский государственный университет", country="UZ", field_ru="Социология и финансы", field_en="Sociology and finance",
   buyers_en="Insurers, banks, microfinance, financial-literacy programmes, development agencies", buyers_ru="Страховые компании, банки, микрофинансы, программы финансовой грамотности, международные программы развития",
   added_en=["Composite scores stored as Excel formulas evaluated into values", "Columns renamed to readable names; a respondent ID added", "Invalid values (age 0) cleared; blank language answers coded", "Codebook in English, Russian and Uzbek", "8 construct indices (trust, benefit, intention to buy …) and a segment summary for business"],
   added_ru=["Итоговые баллы, хранившиеся формулами Excel, пересчитаны в значения", "Колонки переименованы понятно, добавлен ID респондента", "Недопустимые значения (возраст 0) очищены, пустые ответы о языках закодированы", "Описание переменных на английском, русском и узбекском", "8 индексов (доверие, польза, намерение купить …) и сводка по сегментам для бизнеса"]),
 "covid": dict(slug="covid-almaty-cohort", file="covid_almaty_cohort.csv", zenodo="23608061",
   title_en="Hospitalised COVID-19 patients in Almaty, 2020–2021 (n = 2,313), standardised", title_ru="Госпитализированные пациенты с COVID-19, Алматы, 2020–2021 (2 313 человек), стандартизировано", title_uz="COVID-19 bilan yotqizilgan bemorlar, Almati, 2020–2021 (2 313 kishi), standartlashtirilgan",
   uni="Kazakh National Medical University", uni_ru="Казахский национальный медицинский университет", country="KZ", field_ru="Медицина", field_en="Medicine",
   buyers_en="Pharma and CROs, medical-AI teams, insurers, public-health agencies", buyers_ru="Фарма и контрактные исследования, разработчики медицинского ИИ, страховые, органы здравоохранения",
   added_en=["Free-text organism names (partly Russian) mapped to standard species names and NCBI taxon IDs", "Mixed susceptibility codes unified to S/I/R; antibiotics coded with ATC", "Diagnoses coded with ICD-10, lab tests with LOINC", "Range and logic checks with flags per record", "Codebook in English, Russian and Uzbek"],
   added_ru=["Названия микроорганизмов из свободного текста (частично на русском) приведены к стандарту и кодам таксономии NCBI", "Разнобой в кодах чувствительности сведён к S/I/R, антибиотики закодированы по ATC", "Диагнозы закодированы по МКБ-10, анализы — по LOINC", "Проверки диапазонов и логики с флагами по каждой записи", "Описание переменных на английском, русском и узбекском"]),
}
index = []
for key, m in META.items():
    rec = json.load(open(f"{RAW}/{m['zenodo']}/record.json")); md = rec["metadata"]
    authors = [c["name"] for c in md["creators"]]; doi = md.get("doi") or rec.get("doi"); year = md["publication_date"][:4]
    summ = json.load(open(f"{SRC}/{key}/summary.json"))
    d = f"{OUT}/{m['slug']}"; shutil.rmtree(d, ignore_errors=True); os.makedirs(f"{d}/data")
    shutil.copy(f"{SRC}/{key}/{m['file']}", f"{d}/data/{m['file']}"); shutil.copy(f"{SRC}/{key}/codebook.csv", f"{d}/codebook.csv")
    nrows = sum(1 for _ in open(f"{d}/data/{m['file']}", encoding="utf-8")) - 1
    cite = f"{'; '.join(authors)} ({year}). {md['title']}. Zenodo. https://doi.org/{doi}"
    open(f"{d}/LICENSE.txt", "w").write(f"""This package is a derivative work of:
  {cite}
  Licence: Creative Commons Attribution 4.0 International (CC BY 4.0) — https://creativecommons.org/licenses/by/4.0/

Changes made by CORE are listed in DATASHEET.md. CORE's additions (annotations, codes, translations,
indices) are released under the same licence. When you use this package, cite the original authors
(above) and mention CORE as the preparer.
""")
    qtab = "\n".join(f"| {i['type']} | {i['column']} | {i['detail']} |" for i in summ["issues"])
    open(f"{d}/DATASHEET.md", "w").write(f"""# {m['title_en']}

**Prepared by CORE · MVP demonstration package · {datetime.date.today().isoformat()}**

| | |
|---|---|
| Source | {md['title']} |
| Authors | {', '.join(authors)} |
| University | {m['uni']} ({m['country']}) |
| Original record | https://doi.org/{doi} |
| Licence | CC BY 4.0 (original and CORE additions) |
| Rows | {nrows:,} |
| Who uses it | {m['buyers_en']} |

## What CORE added
{chr(10).join('- ' + a for a in m['added_en'])}

## Quality report
| Type | Column | What we found and did |
|---|---|---|
{qtab}

## Files
- `data/{m['file']}` — the data, UTF-8 CSV
- `codebook.csv` — every variable with type, values and labels in English, Russian and Uzbek
- `croissant.json` — machine-readable metadata (MLCommons Croissant 1.0)
- `LICENSE.txt` — licence and how to cite

## Status and limits
This is a demonstration of CORE's process on openly licensed data. The university has not yet
signed a CORE agreement for this dataset; CORE does not sell the original data, only its preparation.
Annotations marked "CORE draft" have not yet been reviewed by an expert of the university.

## Cite
{cite}
Prepared by CORE (core_landing), {year}.
""")
    with open(f"{d}/data/{m['file']}", encoding="utf-8") as f: hdr = next(csv.reader(f))
    cbrows = {r["variable"]: r for r in csv.DictReader(open(f"{d}/codebook.csv", encoding="utf-8"))}
    sha = hashlib.sha256(open(f"{d}/data/{m['file']}", "rb").read()).hexdigest()
    croissant = {"@context": {"@language": "en", "@vocab": "https://schema.org/", "cr": "http://mlcommons.org/croissant/", "sc": "https://schema.org/", "dct": "http://purl.org/dc/terms/",
                 "field": "cr:field", "recordSet": "cr:recordSet", "fileObject": "cr:fileObject", "source": "cr:source", "extract": "cr:extract", "column": "cr:column", "dataType": {"@id": "cr:dataType", "@type": "@vocab"}, "conformsTo": "dct:conformsTo"},
                 "@type": "sc:Dataset", "conformsTo": "http://mlcommons.org/croissant/1.0", "name": m["slug"], "description": m["title_en"] + ". " + " ".join(m["added_en"]),
                 "license": "https://creativecommons.org/licenses/by/4.0/", "url": BASE + "app/", "citeAs": cite, "isBasedOn": f"https://doi.org/{doi}",
                 "creator": [{"@type": "Person", "name": a} for a in authors] + [{"@type": "Organization", "name": "CORE"}],
                 "distribution": [{"@type": "cr:FileObject", "@id": "data", "name": m["file"], "contentUrl": f"data/{m['file']}", "encodingFormat": "text/csv", "sha256": sha}],
                 "recordSet": [{"@type": "cr:RecordSet", "@id": "rows", "name": "rows", "field": [{"@type": "cr:Field", "@id": f"rows/{h}", "name": h, "description": (cbrows.get(h) or {}).get("label_en", h),
                     "dataType": "sc:Text", "source": {"fileObject": {"@id": "data"}, "extract": {"column": h}}} for h in hdr]}]}
    json.dump(croissant, open(f"{d}/croissant.json", "w"), ensure_ascii=False, indent=1)
    zp = f"{OUT}/{m['slug']}.zip"
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(d):
            for fn in files: z.write(os.path.join(root, fn), os.path.join(m["slug"], os.path.relpath(os.path.join(root, fn), d)))
    # preview rows for the app (first 8 rows, all columns)
    with open(f"{d}/data/{m['file']}", encoding="utf-8") as f: prev = [r for _, r in zip(range(9), csv.reader(f))]
    index.append({k: v for k, v in m.items() if k not in ("zenodo",)} | {"key": key, "authors": authors, "doi": doi, "year": year, "rows": nrows, "columns": len(hdr), "zip": f"{m['slug']}.zip",
                 "zip_kb": round(os.path.getsize(zp) / 1024), "summary": summ, "preview": prev, "orig_title": md["title"]})
json.dump(index, open(f"{OUT}/index.json", "w"), ensure_ascii=False, indent=1)
print([(i["slug"], i["rows"], i["columns"], i["zip_kb"]) for i in index])
