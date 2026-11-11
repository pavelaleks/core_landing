import openpyxl, re, sys, json, csv, statistics as st, collections, os
SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
ws = openpyxl.load_workbook(SRC, read_only=True).active
rows = list(ws.iter_rows(values_only=True)); H = list(rows[0]); D = [list(r) for r in rows[1:] if any(v is not None for v in r)]
def col(letter):
    n = 0
    for ch in letter: n = n * 26 + ord(ch) - 64
    return n - 1
issues = []
# 1. evaluate Excel formulas stored as text
formula_cols = {}
for i, h in enumerate(H):
    f = D[0][i]
    if isinstance(f, str) and f.startswith("="):
        refs = re.findall(r"([A-Z]+)\d+", f); formula_cols[h] = [H[col(x)] for x in refs]
        for r in D:
            r[i] = sum((r[col(x)] or 0) for x in re.findall(r"([A-Z]+)\d+", r[i]))
for h, parts in formula_cols.items():
    issues.append({"type": "formula", "column": h, "detail": f"stored as an Excel formula; evaluated as the sum of {', '.join(parts)}"})
# 2. rename
ren = {"marrital_status": "marital_status", "average_month_expe": "avg_monthly_expenses_uzs", "Rus_lang": "lang_russian", "Eng_lang": "lang_english",
       "Turkish_lang": "lang_turkish", "Other_lang": "lang_other", "Multilanguage": "languages_count", "place": "settlement",
       "Financial_knowledge": "fin_knowledge_score", "Financial_behavior": "fin_behavior_score", "Financial_attitude": "fin_attitude_score", "FL": "fin_literacy_score"}
issues.append({"type": "naming", "column": "marrital_status", "detail": "typo in column name, renamed to marital_status; 11 columns given readable names"})
H2 = [ren.get(h, h) for h in H]
# 3. language blanks = not ticked
for h in ("Rus_lang", "Eng_lang", "Turkish_lang", "Other_lang"):
    i = H.index(h); n = sum(1 for r in D if r[i] is None)
    for r in D:
        if r[i] is None: r[i] = 0
    issues.append({"type": "missing", "column": ren[h], "detail": f"{n} blanks treated as 'language not ticked' (0)"})
ia = H.index("age"); bad_age = [k for k, r in enumerate(D) if not r[ia] or r[ia] < 16]
for k in bad_age: D[k][ia] = None
issues.append({"type": "invalid", "column": "age", "detail": f"{len(bad_age)} record(s) with age 0 (the survey is 16+), set to missing"})
ie = H.index("average_month_expe"); zero = sum(1 for r in D if r[ie] == 0)
issues.append({"type": "check", "column": "avg_monthly_expenses_uzs", "detail": f"{zero} respondents report 0 UZS monthly expenses; kept, flagged for the authors"})
for h in H:
    i = H.index(h); miss = sum(1 for r in D if r[i] is None)
    if miss and h not in ("age",): issues.append({"type": "missing", "column": ren.get(h, h), "detail": f"{miss} missing value(s), left blank"})
CONS = [("DL", "dig_literacy_idx", "Digital literacy", "Цифровая грамотность", "Raqamli savodxonlik"),
        ("ILit", "ins_literacy_idx", "Insurance literacy", "Страховая грамотность", "Sugʻurta savodxonligi"),
        ("Incl", "ins_inclusion_idx", "Insurance inclusion", "Охват страхованием", "Sugʻurta bilan qamrov"),
        ("Trust", "trust_idx", "Trust in insurers", "Доверие к страховщикам", "Sugʻurtachilarga ishonch"),
        ("ExBen", "benefit_idx", "Expected benefit", "Ожидаемая польза", "Kutilayotgan foyda"),
        ("AttBuy", "intention_idx", "Intention to buy", "Намерение купить", "Sotib olish niyati"),
        ("Risk", "risk_idx", "Perceived risk", "Восприятие риска", "Xavfni idrok etish"),
        ("PosAtt", "attitude_idx", "Attitude to insurance", "Отношение к страхованию", "Sugʻurtaga munosabat")]
def items(p): return [i for i, h in enumerate(H) if re.fullmatch(p + r"\d+", h)]
for p, name, *_ in CONS:
    ix = items(p); H2.append(name)
    for r in D:
        v = [r[i] for i in ix if r[i] is not None]
        r.append(round(st.mean(v), 3) if v else None)
H2.insert(0, "respondent_id")
for k, r in enumerate(D): r.insert(0, f"SYR-{k+1:03d}")
with open(f"{OUT}/insurance_survey_syrdarya.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(H2); w.writerows([[("" if v is None else (int(v) if isinstance(v, float) and v.is_integer() else v)) for v in r] for r in D])
# codebook
cb = [["variable", "group", "type", "values", "label_en", "label_ru", "label_uz"]]
demo = {"respondent_id": ("ID", "string", "", "Respondent ID assigned by CORE", "ID респондента (присвоен CORE)", "Respondent ID (CORE tomonidan)"),
        "region": ("Demographics", "string", "Sirdaryo viloyati", "Region", "Регион", "Viloyat"),
        "gender": ("Demographics", "string", "Male; Female", "Gender", "Пол", "Jins"),
        "age": ("Demographics", "integer", "16–76", "Age, years", "Возраст, лет", "Yosh"),
        "marital_status": ("Demographics", "string", "Single; Married", "Marital status", "Семейное положение", "Oilaviy holat"),
        "education": ("Demographics", "string", "Secondary school; Diploma/tech; Bachelor; Master; PhD", "Education", "Образование", "Maʼlumot"),
        "avg_monthly_expenses_uzs": ("Demographics", "number", "UZS", "Average monthly expenses, UZS", "Средние расходы в месяц, сум", "Oʻrtacha oylik xarajat, soʻm"),
        "lang_russian": ("Languages", "0/1", "1 = speaks", "Speaks Russian", "Владеет русским", "Rus tilini biladi"),
        "lang_english": ("Languages", "0/1", "1 = speaks", "Speaks English", "Владеет английским", "Ingliz tilini biladi"),
        "lang_turkish": ("Languages", "0/1", "1 = speaks", "Speaks Turkish", "Владеет турецким", "Turk tilini biladi"),
        "lang_other": ("Languages", "0/1", "1 = speaks", "Speaks another language", "Владеет другим языком", "Boshqa tilni biladi"),
        "languages_count": ("Languages", "integer", "0–4", "Number of foreign languages", "Число иностранных языков", "Chet tillari soni"),
        "settlement": ("Demographics", "string", "Urban; Rural", "Urban or rural", "Город или село", "Shahar yoki qishloq"),
        "fin_knowledge_score": ("Financial literacy", "integer", "sum of FL1–FL7", "Financial knowledge score", "Балл финансовых знаний", "Moliyaviy bilim bali"),
        "fin_behavior_score": ("Financial literacy", "integer", "sum of FL8–FL13", "Financial behaviour score", "Балл финансового поведения", "Moliyaviy xulq bali"),
        "fin_attitude_score": ("Financial literacy", "integer", "sum of FL14–FL15", "Financial attitude score", "Балл финансовых установок", "Moliyaviy munosabat bali"),
        "fin_literacy_score": ("Financial literacy", "integer", "knowledge + behaviour + attitude", "Financial literacy, total", "Финансовая грамотность, итог", "Moliyaviy savodxonlik, jami")}
for h in H2:
    if h in demo: g, t, v, en, ru, uz = demo[h]; cb.append([h, g, t, v, en, ru, uz]); continue
    m = re.fullmatch(r"([A-Za-z]+?)(\d+)", h)
    if m and m.group(1) == "FL":
        cb.append([h, "Financial literacy", "0/1", "1 = correct / desirable answer", f"Financial literacy item {m.group(2)}", f"Финансовая грамотность, вопрос {m.group(2)}", f"Moliyaviy savodxonlik, savol {m.group(2)}"]); continue
    c = next((c for c in CONS if m and m.group(1) == c[0]), None)
    if c:
        cb.append([h, c[2], "integer", "1 = strongly disagree … 5 = strongly agree", f"{c[2]}, item {m.group(2)}", f"{c[3]}, вопрос {m.group(2)}", f"{c[4]}, savol {m.group(2)}"]); continue
    c = next((c for c in CONS if c[1] == h), None)
    if c:
        cb.append([h, "CORE index", "number", "1–5, mean of items", f"{c[2]} — index (CORE)", f"{c[3]} — индекс (CORE)", f"{c[4]} — indeks (CORE)"]); continue
    cb.append([h, "?", "", "", h, h, h])
with open(f"{OUT}/codebook.csv", "w", newline="", encoding="utf-8") as f: csv.writer(f).writerows(cb)
# business summary
idx = {h: i for i, h in enumerate(H2)}
def mean(rs, h): v = [r[idx[h]] for r in rs if r[idx[h]] not in (None, "")]; return round(st.mean(v), 2) if v else None
def share_hi(rs, h, thr=3.5): v = [r[idx[h]] for r in rs if r[idx[h]] is not None]; return round(100 * sum(1 for x in v if x >= thr) / len(v)) if v else None
segs = {"all": D, "urban": [r for r in D if r[idx["settlement"]] == "Urban"], "rural": [r for r in D if r[idx["settlement"]] == "Rural"],
        "men": [r for r in D if r[idx["gender"]] == "Male"], "women": [r for r in D if r[idx["gender"]] == "Female"],
        "age_16_29": [r for r in D if r[idx["age"]] and r[idx["age"]] < 30], "age_30_44": [r for r in D if r[idx["age"]] and 30 <= r[idx["age"]] < 45], "age_45_plus": [r for r in D if r[idx["age"]] and r[idx["age"]] >= 45],
        "higher_ed": [r for r in D if r[idx["education"]] in ("Bachelor", "Master", "PhD")], "no_higher_ed": [r for r in D if r[idx["education"]] not in ("Bachelor", "Master", "PhD")]}
seg_out = {k: {"n": len(v), "inclusion": mean(v, "ins_inclusion_idx"), "intention": mean(v, "intention_idx"), "trust": mean(v, "trust_idx"),
               "literacy": mean(v, "ins_literacy_idx"), "high_inclusion_pct": share_hi(v, "ins_inclusion_idx")} for k, v in segs.items()}
def corr(a, b):
    p = [(r[idx[a]], r[idx[b]]) for r in D if r[idx[a]] is not None and r[idx[b]] is not None]
    x, y = zip(*p); mx, my = st.mean(x), st.mean(y)
    return round(sum((i - mx) * (j - my) for i, j in p) / (len(p) * st.pstdev(x) * st.pstdev(y)), 2)
drivers = sorted([(c[1], c[2], c[3], c[4], corr(c[1], "intention_idx")) for c in CONS if c[1] != "intention_idx"] + [("fin_literacy_score", "Financial literacy", "Финансовая грамотность", "Moliyaviy savodxonlik", corr("fin_literacy_score", "intention_idx"))], key=lambda x: -abs(x[4]))
json.dump({"n": len(D), "segments": seg_out, "drivers_of_intention": drivers, "issues": issues, "columns": len(H2), "constructs": [c[1:] for c in CONS]},
          open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
print(len(D), len(H2)); print(json.dumps(seg_out, ensure_ascii=False)[:900]); print(drivers); print(len(issues))
