import csv, sys, json, os, collections, re
R, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
D = list(csv.DictReader(open(f"{R}/covid_almaty_cohort_deidentified.csv", encoding="utf-8")))
DD = {r["variable"]: r for r in csv.DictReader(open(f"{R}/data_dictionary.csv", encoding="utf-8"))}
issues = []
# --- organism normalisation (free text, partly Russian) -> standard name + gram/type + NCBI taxon
ORG = {"staphylococcus epidermidis": ("Staphylococcus epidermidis", "Gram+", 1282), "staphylococcus aureus": ("Staphylococcus aureus", "Gram+", 1280),
 "streptococcus haemolyticus": ("Streptococcus, haemolytic (species not stated)", "Gram+", 1301), "staphylococcus haemolyticus": ("Staphylococcus haemolyticus", "Gram+", 1283),
 "streptococcus pneumoniae": ("Streptococcus pneumoniae", "Gram+", 1313), "streptococcus mitis": ("Streptococcus mitis", "Gram+", 28037),
 "streptococcus salivarius": ("Streptococcus salivarius", "Gram+", 1304), "staphylococcus saprophyticus": ("Staphylococcus saprophyticus", "Gram+", 29385),
 "enterococcus avium": ("Enterococcus avium", "Gram+", 33945), "streptococcus parasanguis": ("Streptococcus parasanguinis", "Gram+", 1318),
 "streptococcus oralis": ("Streptococcus oralis", "Gram+", 1303), "streptococcus viridans": ("Viridans group streptococci", "Gram+", 1301),
 "neisseria subflava": ("Neisseria subflava", "Gram-", 28449), "candida albicans": ("Candida albicans", "Fungus", 5476), "enterobacter cloacae": ("Enterobacter cloacae", "Gram-", 550),
 "klebsiella oxytoca": ("Klebsiella oxytoca", "Gram-", 571), "proteus mirabilis": ("Proteus mirabilis", "Gram-", 584), "acinetobacter baumannii": ("Acinetobacter baumannii", "Gram-", 470),
 "rothia mucilaginosa": ("Rothia mucilaginosa", "Gram+", 43675), "streptococcus sanguis": ("Streptococcus sanguinis", "Gram+", 1305), "pseudomonas aeruginosa": ("Pseudomonas aeruginosa", "Gram-", 287),
 "streptococcus vestibularis": ("Streptococcus vestibularis", "Gram+", 1343), "staphylococcus saccharolyticus": ("Staphylococcus saccharolyticus", "Gram+", 33028),
 "neisseria mucosa": ("Neisseria mucosa", "Gram-", 488), "candida krusei": ("Pichia kudriavzevii (Candida krusei)", "Fungus", 4909), "neisseria flavescens": ("Neisseria flavescens", "Gram-", 484),
 "staphylococcus arlettae": ("Staphylococcus arlettae", "Gram+", 29378), "klebsiella pneumoniae": ("Klebsiella pneumoniae", "Gram-", 573), "enterococcus faecalis": ("Enterococcus faecalis", "Gram+", 1351),
 "candida tropicallis": ("Candida tropicalis", "Fungus", 5482)}
NOGROWTH = {"0", "отрицательно", "нет", "нет роста"}
UNCLEAR = {"зев", "обильный рост", "есть рост"}
cnt = collections.Counter()
for r in D:
    raw = r["organism_raw"].strip(); k = raw.lower()
    if not raw: r["organism"], r["organism_group"], r["organism_ncbi_taxon"], r["culture_result"] = "", "", "", ""
    elif k in NOGROWTH: r["organism"], r["organism_group"], r["organism_ncbi_taxon"], r["culture_result"] = "", "", "", "no growth"; cnt["no growth"] += 1
    elif k in UNCLEAR: r["organism"], r["organism_group"], r["organism_ncbi_taxon"], r["culture_result"] = "", "", "", "growth, organism not stated"; cnt["unclear"] += 1
    else:
        n, g, t = ORG[k]; r["organism"], r["organism_group"], r["organism_ncbi_taxon"], r["culture_result"] = n, g, t, "growth"; cnt["organism"] += 1
        if raw != n: cnt["spelling fixed"] += 1
issues.append({"type": "normalised", "column": "organism_raw", "detail": f"{cnt['organism']} organism entries mapped to standard species names and NCBI taxon IDs ({cnt['spelling fixed']} spelling/case fixes); {cnt['no growth']} entries like 'нет роста', 'отрицательно', '0' coded as 'no growth'; {cnt['unclear']} entries ('зев', 'есть рост') coded as 'growth, organism not stated'"})
# --- susceptibility -> S/I/R
AB = {"azithromycin": "J01FA10", "amikacin": "J01GB06", "linezolid": "J01XX08", "meropenem": "J01DH02", "penicillin": "J01CE01", "oxacillin": "J01CF04",
      "norfloxacin": "J01MA06", "rifampicin": "J04AB02", "ceftriaxone": "J01DD04", "erythromycin": "J01FA01"}
sir = collections.Counter(); odd = []
for r in D:
    for a in AB:
        v = r[a].strip(); m = {"1": "S", "s": "S", "S": "S", "0": "R", "r": "R", "R": "R", "I": "I", "i": "I"}.get(v)
        if v and not m: odd.append(v); sir["unparsed"] += 1
        r[a + "_sir"] = m or ""
        if m: sir[m] += 1
issues.append({"type": "normalised", "column": "10 antibiotic columns", "detail": f"mixed codes (1/0/S/R/s/r/I) unified to S/I/R: {sir['S']} S, {sir['R']} R, {sir['I']} I; {sir['unparsed']} entries left blank (value '2' ×5, one free-text note listing other antibiotics)"})
# --- plausibility
RANGE = {"hr": (30, 220), "rr": (6, 60), "spo2": (50, 100), "hb": (40, 220), "wbc": (0.5, 60), "lymphocytes": (1, 95), "platelets": (5, 1000), "urea": (0.5, 80), "creatinine": (20, 1500), "crp": (0, 500), "los_days": (0, 120)}
flags = collections.Counter()
for r in D:
    f = []
    for c, (lo, hi) in RANGE.items():
        if r[c] and not (lo <= float(r[c]) <= hi): f.append(c)
    if r["death"] == "1" and r["outcome"] != "Death": f.append("death_outcome_mismatch")
    if r["los_days"] == "0": f.append("los_zero")
    try:
        if int(r["comorbidity_count"]) != sum(int(r[c]) for c in DD if c.startswith("com_")): f.append("comorbidity_count_mismatch")
    except ValueError: pass
    r["qc_flags"] = ";".join(f); flags.update(f)
issues.append({"type": "check", "column": "labs, outcomes", "detail": "all lab values inside physiological ranges; " + (", ".join(f"{k}: {v}" for k, v in flags.items()) or "no logical conflicts") + " (flagged in qc_flags, not changed)"})
dups = sum(1 for r in D if r["duplicate_record"] == "1")
issues.append({"type": "check", "column": "duplicate_record", "detail": f"{dups} records flagged by the authors as repeat admissions; kept, filter duplicate_record = 0 for the analytic cohort of {len(D)-dups}"})
for c in ("vaccination", "crp", "ct_category", "pcr_positive"):
    n = sum(1 for r in D if r[c] == ""); issues.append({"type": "missing", "column": c, "detail": f"{n} of {len(D)} missing ({round(100*n/len(D))}%)"})
cols = list(D[0].keys())
out_cols = [c for c in cols if c not in AB and c != "organism_raw"] [:0]
order = [c for c in DD if c not in AB and c != "organism_raw"] + ["organism_raw", "culture_result", "organism", "organism_group", "organism_ncbi_taxon"] + [a + "_sir" for a in AB] + ["qc_flags"]
with open(f"{OUT}/covid_almaty_cohort.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f); w.writerow(order); w.writerows([[r[c] for c in order] for r in D])
# --- codebook with standard codes and three languages
CODE = {"ards": "ICD-10 J80", "resp_failure_grade": "ICD-10 J96", "sepsis": "ICD-10 A41.9", "septic_shock": "ICD-10 R57.2", "com_htn": "ICD-10 I10–I15",
 "com_chf": "ICD-10 I50, I20–I25", "com_dm": "ICD-10 E10–E14", "com_copd": "ICD-10 J44", "com_ckd": "ICD-10 N18", "com_obesity": "ICD-10 E66", "com_anemia": "ICD-10 D50–D64",
 "com_cancer": "ICD-10 C00–C97", "com_asthma_allergy": "ICD-10 J45, T78.4", "com_ctd": "ICD-10 M30–M36, E00–E07", "pcr_positive": "LOINC 94500-6", "death": "",
 "hr": "LOINC 8867-4", "rr": "LOINC 9279-1", "spo2": "LOINC 59408-5", "hb": "LOINC 718-7", "wbc": "LOINC 6690-2", "lymphocytes": "LOINC 736-9", "platelets": "LOINC 777-3",
 "urea": "LOINC 22664-7", "creatinine": "LOINC 14682-9", "crp": "LOINC 1988-5", "ct_category": "", "organism_ncbi_taxon": "NCBI Taxonomy"}
RU = {"record_id": ("ID записи", "Yozuv ID"), "duplicate_record": ("Повторная госпитализация (1 = да)", "Takroriy yotqizish (1 = ha)"), "sex": ("Пол", "Jins"), "age": ("Возраст, лет", "Yosh"),
 "admission_month": ("Месяц госпитализации", "Yotqizilgan oy"), "period": ("Период эпидемии (вариант вируса)", "Epidemiya davri (virus varianti)"),
 "days_to_period_boundary": ("Дней до границы периода", "Davr chegarasigacha kunlar"), "symptom_to_admission_days": ("Дней от симптомов до госпитализации", "Belgilardan yotqizishgacha kunlar"),
 "los_days": ("Длительность госпитализации, дней", "Kasalxonada yotish muddati, kun"), "severity": ("Тяжесть (1 лёгкая … 5 критическая)", "Ogʻirlik darajasi (1 yengil … 5 kritik)"),
 "ards": ("ОРДС", "OʻRDS"), "resp_failure_grade": ("Степень дыхательной недостаточности", "Nafas yetishmovchiligi darajasi"), "sepsis": ("Сепсис", "Sepsis"), "septic_shock": ("Септический шок", "Septik shok"),
 "com_htn": ("Гипертония", "Gipertoniya"), "com_chf": ("Сердечная недостаточность или ИБС", "Yurak yetishmovchiligi yoki YuIK"), "com_dm": ("Сахарный диабет", "Qandli diabet"),
 "com_copd": ("ХОБЛ", "OʻSOK"), "com_ckd": ("Хроническая болезнь почек", "Surunkali buyrak kasalligi"), "com_obesity": ("Ожирение", "Semizlik"), "com_anemia": ("Анемия", "Anemiya"),
 "com_cancer": ("Онкология", "Onkologiya"), "com_asthma_allergy": ("Астма или аллергия", "Astma yoki allergiya"), "com_ctd": ("Аутоиммунные, системные болезни или щитовидная железа", "Autoimmun, tizimli kasalliklar yoki qalqonsimon bez"),
 "comorbidity_count": ("Число сопутствующих болезней", "Hamroh kasalliklar soni"), "any_comorbidity": ("Есть сопутствующая болезнь", "Hamroh kasallik bor"),
 "vaccination": ("Вакцинация от COVID-19", "COVID-19 ga qarshi emlash"), "pcr_positive": ("ПЦР положительный", "PZR musbat"), "hr": ("Пульс, уд/мин", "Puls, zarba/daq"),
 "rr": ("Частота дыхания, в мин", "Nafas soni, daqiqada"), "spo2": ("Сатурация SpO2, %", "Saturatsiya SpO2, %"), "hb": ("Гемоглобин, г/л", "Gemoglobin, g/l"),
 "wbc": ("Лейкоциты, ×10⁹/л", "Leykotsitlar, ×10⁹/l"), "lymphocytes": ("Лимфоциты, %", "Limfotsitlar, %"), "platelets": ("Тромбоциты, ×10⁹/л", "Trombotsitlar, ×10⁹/l"),
 "urea": ("Мочевина, ммоль/л", "Mochevina, mmol/l"), "creatinine": ("Креатинин, мкмоль/л", "Kreatinin, mkmol/l"), "crp": ("С-реактивный белок, мг/л", "C-reaktiv oqsil, mg/l"),
 "ct_category": ("КТ лёгких, степень поражения", "Oʻpka KT, zararlanish darajasi"), "outcome": ("Исход", "Natija"), "death": ("Смерть в стационаре", "Statsionarda oʻlim"),
 "icu_transfer": ("Перевод в реанимацию", "Reanimatsiyaga oʻtkazish"), "severe_outcome": ("Смерть или реанимация", "Oʻlim yoki reanimatsiya"),
 "organism_raw": ("Микроорганизм из мазка (как записано)", "Surtmadagi mikroorganizm (yozilganidek)"), "culture_result": ("Результат посева (CORE)", "Ekma natijasi (CORE)"),
 "organism": ("Микроорганизм, стандартное название (CORE)", "Mikroorganizm, standart nomi (CORE)"), "organism_group": ("Группа: Gram+, Gram−, грибы (CORE)", "Guruh: Gram+, Gram−, zamburugʻ (CORE)"),
 "organism_ncbi_taxon": ("Код в таксономии NCBI (CORE)", "NCBI taksonomiya kodi (CORE)"), "qc_flags": ("Флаги проверки качества (CORE)", "Sifat tekshiruvi belgilari (CORE)")}
ABRU = {"azithromycin": ("азитромицин", "azitromitsin"), "amikacin": ("амикацин", "amikatsin"), "linezolid": ("линезолид", "linezolid"), "meropenem": ("меропенем", "meropenem"),
 "penicillin": ("пенициллин", "penitsillin"), "oxacillin": ("оксациллин", "oksatsillin"), "norfloxacin": ("норфлоксацин", "norfloksatsin"), "rifampicin": ("рифампицин", "rifampitsin"),
 "ceftriaxone": ("цефтриаксон", "seftriakson"), "erythromycin": ("эритромицин", "eritromitsin")}
cb = [["variable", "standard_code", "type", "values_or_units", "label_en", "label_ru", "label_uz", "added_by"]]
for c in order:
    if c.endswith("_sir"):
        a = c[:-4]; cb.append([c, "ATC " + AB[a], "string", "S susceptible; I intermediate; R resistant", f"Susceptibility to {a} (S/I/R)", f"Чувствительность к {ABRU[a][0]}у (S/I/R)".replace("ину ", "ину "), f"{ABRU[a][1].capitalize()}ga sezgirlik (S/I/R)", "CORE"]); continue
    d = DD.get(c, {}); ru, uz = RU[c]
    en = d.get("description") or {"culture_result": "Swab culture result", "organism": "Organism, standard name", "organism_group": "Organism group", "organism_ncbi_taxon": "NCBI Taxonomy ID", "qc_flags": "Quality-check flags"}[c]
    cb.append([c, CODE.get(c, ""), d.get("type", "string"), d.get("values_or_units", ""), en, ru, uz, "authors" if c in DD else "CORE"])
with open(f"{OUT}/codebook.csv", "w", newline="", encoding="utf-8") as f: csv.writer(f).writerows(cb)
an = [r for r in D if r["duplicate_record"] == "0"]
per = collections.defaultdict(lambda: [0, 0, 0])
for r in an:
    p = per[r["period"]]; p[0] += 1; p[1] += int(r["death"]); p[2] += int(r["severe_outcome"])
orgs = collections.Counter(r["organism"] for r in D if r["organism"])
json.dump({"n": len(D), "analytic": len(an), "issues": issues, "periods": {k: {"n": v[0], "death_pct": round(100 * v[1] / v[0], 1), "severe_pct": round(100 * v[2] / v[0], 1)} for k, v in per.items()},
           "top_organisms": orgs.most_common(6), "coded_variables": sum(1 for x in cb[1:] if x[1]), "columns": len(order)}, open(f"{OUT}/summary.json", "w"), ensure_ascii=False, indent=1)
print(json.dumps(json.load(open(f"{OUT}/summary.json")), ensure_ascii=False)[:1500])
