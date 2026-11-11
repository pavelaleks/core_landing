"""Build assets/graph.js — the CORE knowledge graph for the 3D scene.

Nodes and links come from the full capubs SQLite (OpenAlex works of CA universities),
the core-hub universities registry and the research-datasets spreadsheet. No author
names or other personal data are exported.

usage: python3 -I tools/build_graph.py <ca_publications.sqlite> <universities.jsonl> <datasets.xlsx> <out.js>
"""
import collections
import itertools
import json
import sqlite3
import sys

DB, UNI_JSONL, XLSX, OUT = sys.argv[1:5]
CA = {"UZ", "KZ", "KG", "TJ", "TM"}

# --- universities (CORE registry is the source of truth for IDs and coordinates)
unis = {}
for line in open(UNI_JSONL, encoding="utf-8"):
    u = json.loads(line)
    loc = u.get("location") or {}
    if not u.get("is_higher_ed") or loc.get("lat") is None:
        continue
    unis[u["id"]] = {
        "id": u["id"], "name": u.get("name_en") or u["name"], "c": u["country"],
        "lat": loc["lat"], "lon": loc["lon"], "city": u.get("city") or "",
    }

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
inst2core = {}
for iid, core in con.execute("select id, core_id from institutions where core_id is not null and core_id != ''"):
    first = core.split(";")[0].strip()
    if first in unis:
        inst2core[iid] = first

# --- one pass over (institution, work)
works_by_uni = collections.Counter()
sub_by_uni = collections.defaultdict(collections.Counter)
sub_total = collections.Counter()
sub_field = {}
country_by_uni = collections.defaultdict(collections.Counter)
work_unis = collections.defaultdict(set)
q = """select wi.institution_id, w.id, w.subfield, w.field, w.domain, w.countries
       from work_institutions wi join works w on w.id = wi.work_id"""
for iid, wid, sub, field, dom, countries in con.execute(q):
    core = inst2core.get(iid)
    if not core:
        continue
    work_unis[wid].add(core)
    works_by_uni[core] += 1
    if sub:
        sub_by_uni[core][sub] += 1
        sub_total[sub] += 1
        sub_field[sub] = (field, dom)
    for cc in (countries or "").split("; "):
        if cc and cc not in CA:
            country_by_uni[core][cc] += 1

# --- co-authorship between CA universities
pairs = collections.Counter()
for us in work_unis.values():
    if 1 < len(us) <= 12:
        for a, b in itertools.combinations(sorted(us), 2):
            pairs[(a, b)] += 1

# --- choose what to draw (keep the scene readable and the file small)
active = [u for u, n in works_by_uni.items() if n >= 20]
top_subs = [s for s, _ in sub_total.most_common(48)]
top_set = set(top_subs)
uni_topic = []
for u in active:
    for s, n in sub_by_uni[u].most_common(12):
        if s in top_set and n >= 15:
            uni_topic.append([u, s, n])
    # keep at most 4 strongest topic links per university
uni_topic.sort(key=lambda r: -r[2])
per = collections.Counter()
ut = []
for u, s, n in uni_topic:
    if per[u] < 4:
        ut.append([u, s, n]); per[u] += 1

co = [[a, b, n] for (a, b), n in pairs.most_common(400) if n >= 8 and a in unis and b in unis]
world = collections.Counter()
uw = []
for u in sorted(active, key=lambda x: -works_by_uni[x])[:60]:
    for cc, n in country_by_uni[u].most_common(3):
        if n >= 25:
            uw.append([u, cc, n]); world[cc] += n

# --- research datasets → their university
import openpyxl
ds = []
ws = openpyxl.load_workbook(XLSX, read_only=True)["Настоящие данные"]
hdr = None
for row in ws.iter_rows(values_only=True):
    if hdr is None:
        hdr = row; continue
    d = dict(zip(hdr, row))
    ids = [x.strip() for x in str(d.get("ID вузов CORE") or "").split(";") if x.strip() in unis]
    if ids and d.get("Название"):
        ds.append([ids[0], str(d["Название"])[:140], d.get("Область") or "", d.get("Год") or ""])

nodes_u = {u: dict(unis[u], w=works_by_uni.get(u, 0)) for u in unis}
out = {
    "unis": [[v["id"], v["name"], v["c"], round(v["lat"], 3), round(v["lon"], 3), v["city"], v["w"]] for v in nodes_u.values()],
    "topics": [[s, sub_total[s], sub_field[s][0], sub_field[s][1]] for s in top_subs],
    "uniTopic": ut,
    "co": co,
    "world": [[cc, n] for cc, n in world.most_common(14)],
    "uniWorld": uw,
    "datasets": ds,
    "stats": {"works": len(work_unis), "pairs": sum(1 for v in pairs.values() if v >= 1)},
}
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.CORE_GRAPH=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
print({k: len(v) if isinstance(v, list) else v for k, v in out.items()})
