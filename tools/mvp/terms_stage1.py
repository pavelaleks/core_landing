import os, re, sys, json, collections
R = sys.argv[1]; OUT = sys.argv[2]
def canon(s):
    s = s.strip().lower()
    s = re.sub(r"(?<=[og])['‘’ʻ`]", "ʻ", s)          # oʻ, gʻ
    s = re.sub(r"['‘’ʼ`]", "ʼ", s)                     # tutuq belgisi
    return re.sub(r"\s+", " ", s)
terms = []
for line in open(f"{R}/x_02_UGTD/02_UGTD/terminology_grade5_11.txt", encoding="utf-8"):
    t = canon(line)
    if t and t not in terms: terms.append(t)
# university-level terms not in the school list
uni_extra = set()
for fn in os.listdir(f"{R}/x_04_Extracted_Terminology/04_Extracted_Terminology"):
    if fn.startswith("university"):
        for line in open(f"{R}/x_04_Extracted_Terminology/04_Extracted_Terminology/{fn}", encoding="utf-8"):
            t = canon(line)
            if t and t not in terms: uni_extra.add(t)
LEVELS = [("grade5", "5"), ("grade6", "6"), ("grade7", "7"), ("grade8", "8"), ("grade9", "9"), ("grade10_11", "10-11"),
          ("university_geo_corpus_1", "uni"), ("university_geo_corpus_2", "uni"), ("university_geo_corpus_3", "uni")]
corp = {}
for fn in sorted(os.listdir(f"{R}/x_01_UEGC/01_UEGC")):
    corp[fn.replace("_geo_corpus.txt", "").replace(".txt", "")] = " " + canon(open(f"{R}/x_01_UEGC/01_UEGC/{fn}", encoding="utf-8").read()) + " "
print({k: len(v.split()) for k, v in corp.items()})
allterms = terms + sorted(uni_extra)
rows = []
for t in allterms:
    pat = re.compile(r"(?<![\wʻʼ])" + re.escape(t) + r"(?![\wʻʼ])")
    freq = collections.Counter(); ex = None
    for name, txt in corp.items():
        lvl = next(l for k, l in LEVELS if name.startswith(k))
        hits = pat.findall(txt); freq[lvl] += len(hits)
        if hits and ex is None:
            m = pat.search(txt); a = max(0, txt.rfind(" ", 0, max(0, m.start() - 70))); b = txt.find(" ", m.end() + 70)
            ex = (txt[a:b].strip(), lvl)
    school = sum(v for k, v in freq.items() if k != "uni")
    first = next((l for l in ["5", "6", "7", "8", "9", "10-11", "uni"] if freq[l]), "")
    rows.append(dict(term=t, source_list="school (UGTD)" if t in terms else "university", freq_school=school, freq_university=freq["uni"], first_level=first,
                     words=len(t.split()), example=ex[0] if ex else "", example_level=ex[1] if ex else ""))
# spelling variants: same term after removing doubled letters / hyphens
key = lambda t: re.sub(r"(.)\1", r"\1", t.replace("-", " "))
groups = collections.defaultdict(list)
for r in rows: groups[key(r["term"])].append(r["term"])
for r in rows:
    g = [x for x in groups[key(r["term"])] if x != r["term"]]
    r["variant_of"] = "; ".join(g)
json.dump(rows, open(OUT, "w"), ensure_ascii=False, indent=0)
print(len(rows), "school", len(terms), "uni extra", len(uni_extra), "with variants", sum(1 for r in rows if r["variant_of"]), "not found in corpus", sum(1 for r in rows if not r["first_level"]))
top = sorted(rows, key=lambda r: -(r["freq_school"] + r["freq_university"]))[:320]
open(OUT.replace(".json", "_top.txt"), "w").write("\n".join(r["term"] for r in top))
