"""Build mcp/supabase/functions/core-mcp/names.json: extra public names for university search.

The site's api/v0/universities.json has one national, Russian and English name per university.
core-hub keeps more: names in up to 7 languages, historical/alternative names, domains,
relationships (predecessor, parent, branch) and student counts. Only those public, non-personal
fields are copied, and only for universities that are published in api/v0/universities.json.

usage: python3 -I mcp/tools/build_names.py <core-hub universities.jsonl>
  e.g. python3 -I mcp/tools/build_names.py ../capubs/db/universities/processed/universities.jsonl
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, "mcp", "supabase", "functions", "core-mcp", "names.json")

src = sys.argv[1]
public = {u["id"] for u in json.load(open(os.path.join(ROOT, "api", "v0", "universities.json"), encoding="utf-8"))["universities"]}

out = {}
for line in open(src, encoding="utf-8"):
    u = json.loads(line)
    if u["id"] not in public:
        continue
    rec = {}
    names = {k: v for k, v in (u.get("names") or {}).items() if v}
    if names:
        rec["names"] = names
    for key in ("aliases", "acronyms", "domains"):
        vals = [v for v in (u.get(key) or []) if v]
        if vals:
            rec[key] = vals
    rels = [{k: r[k] for k in ("type", "label", "ror") if r.get(k)} for r in (u.get("relationships") or [])]
    if rels:
        rec["relationships"] = rels
    if u.get("students"):
        rec["students"] = u["students"]
    if u.get("is_branch"):
        rec["is_branch"] = True
    i10 = (u.get("research") or {}).get("i10_index")
    if i10 is not None:
        rec["i10_index"] = i10
    if rec:
        out[u["id"]] = rec

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
print(f"{len(out)} universities -> {os.path.relpath(OUT, ROOT)} ({os.path.getsize(OUT) // 1024} KB)")
