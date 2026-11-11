import json, sys, os, re, time, urllib.request, urllib.parse
rows = json.load(open(sys.argv[1])); out = sys.argv[2]
def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "core-dataset-check/1.0"})
    for i in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=40))
        except urllib.error.HTTPError as e:
            if e.code in (404, 410): return {"_err": e.code}
            time.sleep(3)
        except Exception: time.sleep(3)
    return {"_err": "fail"}
for i, r in enumerate(rows):
    m = re.search(r"doi\.org/(.+)$", r["url"]); doi = m.group(1) if m else None
    fn = f"{out}/{i:03d}.json"
    if os.path.exists(fn) or not doi: continue
    d = get("https://api.datacite.org/dois/" + urllib.parse.quote(doi, safe=""))
    json.dump({"i": i, "doi": doi, "dc": d}, open(fn, "w"))
    time.sleep(0.15)
print("done")
