import json, glob, os, sys, re, collections, datetime
rows = json.load(open(sys.argv[1])); base = sys.argv[2]; out = sys.argv[3]
DOC = {"pdf", "doc", "docx", "odt", "rtf", "ppt", "pptx", "epub", "md", "html", "htm"}
CODE = {"py", "r", "ipynb", "m", "js", "ts", "java", "c", "cpp", "h", "sh", "do", "jl", "rmd", "qmd", "cff", "yml", "yaml", "toml", "license", "gitignore", "lock"}
IMG = {"png", "jpg", "jpeg", "gif", "svg"}
def ext(n):
    n = (n or "").lower()
    for e in (".tar.gz", ".csv.gz", ".json.gz"):
        if n.endswith(e): return e[1:]
    return n.rsplit(".", 1)[-1] if "." in n else ""
def load(d, i):
    p = f"{base}/{d}/{i:03d}.json"
    return json.load(open(p)) if os.path.exists(p) else None
res = []; why = collections.Counter(); seen = {}
for i, r in enumerate(rows):
    rp, dc = load("repo", i), load("dc", i)
    a = ((dc or {}).get("dc") or {}).get("data", {}) or {}; a = a.get("attributes") or {}
    rtg = (a.get("types") or {}).get("resourceTypeGeneral")
    pub = a.get("publisher"); pub = pub.get("name") if isinstance(pub, dict) else pub
    kind, note, nfiles, fmts = None, "", None, []
    doi = ((dc or {}).get("doi") or "")
    if doi.startswith("10.48580/"):
        kind, note = "article_extract", f"ChecklistBank ({pub}): species list extracted automatically from a published article"
    elif rp and rp.get("repo") == "gbif":
        n = rp.get("records")
        if rp.get("err"): kind, note = "unavailable", "GBIF: dataset not found"
        elif n: kind, note = "data", f"GBIF {str(rp.get('gtype')).lower()}: {n:,} records"
        else: kind, note = "empty", "GBIF: 0 records"
    elif rp and "files" in rp:
        fs = rp["files"]; nfiles = len(fs)
        es = [ext(f[0]) for f in fs]
        zp = load("zip", i)
        if zp and any(e == "zip" for e in es):
            inner = [ext(n.rsplit("/", 1)[-1]) for n in zp["names"] if not n.startswith("__")]
            if inner and not any(n.startswith("__error__") for n in zp["names"]):
                es = [e for e in es if e != "zip"] + inner
        fmts = sorted({e for e in es if e})
        restricted = rp["repo"] == "dataverse" and fs and all(f[2] for f in fs)
        if not fs: kind, note = "no_files", f"{rp['repo']}: record has no files" + (f" (access: {rp.get('access')})" if rp.get("access") not in (None, "open") else "")
        elif restricted: kind, note = "restricted", "Dataverse: all files restricted"
        elif sum(1 for e in es if e in IMG) >= 5 and all(e in DOC or e in IMG for e in es): kind, note = "data", f"images: {sum(1 for e in es if e in IMG)} files, " + ", ".join(fmts)
        elif all(e in DOC or e in IMG for e in es): kind, note = "article", "only documents: " + ", ".join(fmts)
        elif all(e in DOC or e in IMG or e in CODE for e in es): kind, note = "code", "only code and documents: " + ", ".join(fmts)
        else: kind, note = "data", ", ".join(fmts)
    elif rp and rp.get("err"):
        kind, note = "unavailable", f"{rp.get('repo')}: {rp.get('err')}"
    else:
        # repositories without a file API: rely on DataCite
        if dc is None or "_err" in (dc.get("dc") or {}): kind, note = "unavailable", "DOI does not resolve in DataCite"
        elif rtg in ("Dataset", "PhysicalObject", "Image", "Sound", "Audiovisual", "Collection"): kind, note = "data", f"{pub}: {rtg} (repository for data; files not listed by API)"
        elif rtg in ("Text", "JournalArticle", "Preprint", "Report"): kind, note = "article", f"{pub}: {rtg}"
        elif rtg == "Software": kind, note = "code", f"{pub}: Software"
        else: kind, note = "data", f"{pub}: {rtg}"
    key = (re.sub(r"\W+", " ", r["title"].lower()).strip(), r["university"])
    if key in seen and kind in ("data",):
        kind, note = "duplicate", "another version of " + seen[key]
    elif kind == "data": seen[key] = r["openalex"]
    why[kind] += 1
    res.append({"openalex": r["openalex"], "kind": kind, "note": note, "files": nfiles, "formats": fmts[:12]})
json.dump({"checked": datetime.date.today().isoformat(), "method": "Each record opened through its repository API (Zenodo, GBIF, Mendeley Data, Harvard Dataverse, Figshare, Dryad); other repositories through DataCite metadata. 'data' = at least one data file (table, archive, images, sequences, GIS …) or a GBIF dataset with records; 'article' = only PDF/Word/slides; 'code' = only code and documents.",
           "counts": dict(why), "records": res}, open(out, "w"), ensure_ascii=False, indent=0)
print(why)
