import json, csv, sys, os, collections
S1, GL, OUT = sys.argv[1:4]; os.makedirs(OUT, exist_ok=True)
rows = json.load(open(S1)); gl = {}
for line in open(GL, encoding="utf-8"):
    t, ru, en, c = line.rstrip("\n").split("\t"); gl[t] = (ru, en, c)
CAT = {"P": ("place name", "топоним", "joy nomi"), "F": ("landforms", "рельеф", "relyef"), "C": ("climate and atmosphere", "климат и атмосфера", "iqlim va atmosfera"),
       "W": ("water", "воды", "suvlar"), "G": ("geology and minerals", "геология и полезные ископаемые", "geologiya va foydali qazilmalar"), "B": ("soils, plants, animals, natural zones", "почвы, растения, животные, природные зоны", "tuproq, oʻsimlik, hayvonot, tabiat zonalari"),
       "H": ("population, economy, politics", "население, экономика, политика", "aholi, iqtisodiyot, siyosat"), "M": ("maps, methods, discipline", "карты, методы, дисциплина", "xaritalar, usullar, fan"), "E": ("ecology and conservation", "экология и охрана природы", "ekologiya va tabiatni muhofaza qilish")}
missing = set(gl) - {r["term"] for r in rows}
assert not missing, missing
out = []
for i, r in enumerate(sorted(rows, key=lambda r: -(r["freq_school"] + r["freq_university"]))):
    g = gl.get(r["term"])
    out.append({"term_id": f"UGT-{i+1:04d}", "term_uz": r["term"], "words": r["words"], "category": CAT[g[2]][0] if g else "", "category_ru": CAT[g[2]][1] if g else "",
                "term_ru": g[0] if g else "", "term_en": g[1] if g else "", "freq_school": r["freq_school"], "freq_university": r["freq_university"], "first_level": r["first_level"],
                "level_profile": ("school and university" if r["freq_school"] and r["freq_university"] else "school only" if r["freq_school"] else "university only" if r["freq_university"] else "not found in corpus"),
                "spelling_variant_of": r["variant_of"], "example_uz": r["example"], "example_level": r["example_level"],
                "review_status": "CORE draft — awaiting expert review" if g else "automatic fields only"})
cols = list(out[0])
with open(f"{OUT}/uzbek_geography_terms.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, cols); w.writeheader(); w.writerows(out)
cb = [["variable", "type", "label_en", "label_ru", "label_uz", "added_by"],
 ["term_id", "string", "Term ID", "ID термина", "Termin ID", "CORE"], ["term_uz", "string", "Term in Uzbek (Latin), normalised oʻ/gʻ/ʼ", "Термин на узбекском (латиница), нормализованы oʻ/gʻ/ʼ", "Termin oʻzbek tilida (lotin), oʻ/gʻ/ʼ bir xillashtirilgan", "authors + CORE"],
 ["words", "integer", "Number of words", "Число слов", "Soʻzlar soni", "CORE"], ["category", "string", "Subject category (9 classes)", "Тематическая категория (9 классов)", "Mavzu toifasi (9 sinf)", "CORE"],
 ["category_ru", "string", "Category, Russian", "Категория по-русски", "Toifa, rus tilida", "CORE"], ["term_ru", "string", "Russian equivalent", "Русский эквивалент", "Ruscha muqobili", "CORE"],
 ["term_en", "string", "English equivalent", "Английский эквивалент", "Inglizcha muqobili", "CORE"], ["freq_school", "integer", "Occurrences in school textbooks (grades 5–11)", "Употреблений в школьных учебниках (5–11 кл.)", "Maktab darsliklarida uchrashi (5–11-sinf)", "CORE"],
 ["freq_university", "integer", "Occurrences in university textbooks", "Употреблений в вузовских учебниках", "Oliy taʼlim darsliklarida uchrashi", "CORE"], ["first_level", "string", "First grade where the term appears (5…10-11, uni)", "Класс, где термин впервые встречается", "Termin birinchi uchraydigan sinf", "CORE"],
 ["level_profile", "string", "School / university / both / not found", "Школа / вуз / оба / не найден", "Maktab / OTM / ikkalasi / topilmadi", "CORE"], ["spelling_variant_of", "string", "Other spelling of the same term found in the list", "Другое написание того же термина в списке", "Roʻyxatdagi shu terminning boshqa yozilishi", "CORE"],
 ["example_uz", "string", "Context from the corpus (±70 characters)", "Контекст из корпуса (±70 знаков)", "Korpusdan kontekst (±70 belgi)", "CORE"], ["example_level", "string", "Level of the example text", "Уровень текста примера", "Misol matni darajasi", "CORE"],
 ["review_status", "string", "Review status", "Статус проверки", "Tekshiruv holati", "CORE"]]
with open(f"{OUT}/codebook.csv", "w", newline="", encoding="utf-8") as f: csv.writer(f).writerows(cb)
c = collections.Counter(o["category"] for o in out if o["category"]); lp = collections.Counter(o["level_profile"] for o in out)
issues = [{"type": "normalised", "column": "term_uz", "detail": "three apostrophe variants (' ‘ ’) unified to the standard Uzbek Latin letters oʻ, gʻ and the tutuq belgisi ʼ; 13 duplicate terms removed (1,209 → 1,196)"},
          {"type": "check", "column": "term_uz", "detail": f"{sum(1 for o in out if o['spelling_variant_of'])//2} pairs of spelling variants (e.g. agglomeratsiya / aglomeratsiya) — flagged, not merged; the authors decide"},
          {"type": "check", "column": "corpus", "detail": f"{lp['not found in corpus']} of 1,196 terms do not occur in the published corpus in this exact form (inflected forms or a different source) — flagged in level_profile"},
          {"type": "added", "column": "term_ru, term_en, category", "detail": f"Russian and English equivalents and a subject category for the 320 most frequent terms (they cover {round(100*sum(o['freq_school']+o['freq_university'] for o in out[:320])/max(1,sum(o['freq_school']+o['freq_university'] for o in out)))}% of term occurrences); status: draft awaiting review by a geographer"}]
json.dump({"n": len(out), "glossed": len(gl), "categories": c.most_common(), "level_profile": lp.most_common(), "issues": issues,
           "examples": [{k: o[k] for k in ("term_uz", "term_ru", "term_en", "category", "freq_school", "freq_university", "first_level")} for o in out[:12]]}, open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
print(len(out), c.most_common(), lp.most_common(), issues[-1]["detail"])
