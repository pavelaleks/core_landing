import json, sys, os, re, time, urllib.request, urllib.parse
rows = json.load(open(sys.argv[1])); out = sys.argv[2]; only = sys.argv[3] if len(sys.argv) > 3 else None
def get(u, data=None):
    req = urllib.request.Request(u, data=data, headers={"User-Agent": "core-dataset-check/1.0", "Content-Type": "application/json", "Accept": "application/json"})
    for i in range(3):
        try: return json.load(urllib.request.urlopen(req, timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404, 410): return {"_err": e.code}
            time.sleep(4)
        except Exception as e: time.sleep(4)
    return {"_err": "fail"}
def files_of(doi):
    p = doi.split("/")[0]
    if p == "10.5281":
        rid = re.search(r"zenodo\.(\d+)", doi).group(1); j = get(f"https://zenodo.org/api/records/{rid}")
        if "_err" in j: return {"repo": "zenodo", "err": j["_err"]}
        return {"repo": "zenodo", "rtype": (j.get("metadata", {}).get("resource_type") or {}).get("type"), "files": [[f["key"], f["size"]] for f in j.get("files", [])], "access": j.get("metadata", {}).get("access_right")}
    if p == "10.15468":
        j = get("https://api.gbif.org/v1/dataset/doi/" + urllib.parse.quote(doi, safe="/"))
        res = j.get("results") or []
        if not res: return {"repo": "gbif", "err": "not found"}
        d = res[0]; key = d["key"]; t = d.get("type")
        if t == "CHECKLIST": n = get(f"https://api.gbif.org/v1/species/search?datasetKey={key}&limit=0").get("count")
        else: n = get(f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&limit=0").get("count")
        return {"repo": "gbif", "gtype": t, "records": n, "title": d.get("title")}
    if p == "10.7910":
        j = get("https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:" + doi)
        if "_err" in j or j.get("status") != "OK": return {"repo": "dataverse", "err": j.get("_err") or j.get("message")}
        fs = j["data"]["latestVersion"].get("files", [])
        return {"repo": "dataverse", "files": [[f["dataFile"].get("filename"), f["dataFile"].get("filesize"), f.get("restricted", False)] for f in fs]}
    if p == "10.6084":
        j = get("https://api.figshare.com/v2/articles/search", json.dumps({"doi": doi}).encode())
        if not isinstance(j, list) or not j: return {"repo": "figshare", "err": "not found"}
        a = get(f"https://api.figshare.com/v2/articles/{j[0]['id']}")
        return {"repo": "figshare", "rtype": a.get("defined_type_name"), "files": [[f["name"], f["size"]] for f in a.get("files", [])]}
    if p == "10.5061":
        j = get("https://datadryad.org/api/v2/datasets/" + urllib.parse.quote("doi:" + doi, safe=""))
        if "_err" in j: return {"repo": "dryad", "err": j["_err"]}
        v = (j.get("_links", {}).get("stash:version") or {}).get("href")
        fl = get("https://datadryad.org" + v + "/files") if v else {}
        fs = (fl.get("_embedded") or {}).get("stash:files", [])
        return {"repo": "dryad", "files": [[f.get("path"), f.get("size")] for f in fs], "size": j.get("storageSize")}
    if p == "10.17632":
        rid = doi.split("/")[1].split(".")[0]
        j = get(f"https://data.mendeley.com/public-api/datasets/{rid}")
        if "_err" in j: return {"repo": "mendeley", "err": j["_err"]}
        return {"repo": "mendeley", "files": [[f.get("filename"), f.get("size") or (f.get("content_details") or {}).get("size")] for f in j.get("files", [])]}
    return None
for i, r in enumerate(rows):
    m = re.search(r"doi\.org/(.+)$", r["url"]); doi = m.group(1) if m else None
    if not doi or (only and not doi.startswith(only)): continue
    fn = f"{out}/{i:03d}.json"
    if os.path.exists(fn): continue
    try: res = files_of(doi)
    except Exception as e: res = {"err": str(e)[:80]}
    if res is None: continue
    json.dump({"i": i, "doi": doi, **res}, open(fn, "w")); time.sleep(0.3)
print("done")
