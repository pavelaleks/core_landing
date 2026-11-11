import json, glob, os, sys, time, io, zipfile, urllib.request, urllib.parse
base = sys.argv[1]
def get(u):
    for i in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "core-dataset-check/1.0"}), timeout=60))
        except urllib.error.HTTPError as e:
            if e.code in (403, 404, 410): return {"_err": e.code}
            time.sleep(3)
        except Exception: time.sleep(3)
    return {"_err": "fail"}
# 1. Mendeley: files with version, root + subfolders
for f in sorted(glob.glob(f"{base}/repo/*.json")):
    j = json.load(open(f))
    if j.get("repo") != "mendeley": continue
    rid = j["doi"].split("/")[1].split(".")[0]
    meta = get(f"https://data.mendeley.com/public-api/datasets/{rid}")
    ver = meta.get("version") or (j["doi"].split(".")[-1] if j["doi"].count(".") >= 2 else 1)
    files = []; folders = get(f"https://data.mendeley.com/public-api/datasets/{rid}/folders/{ver}")
    fids = ["root"] + ([x["id"] for x in folders] if isinstance(folders, list) else [])
    for fid in fids:
        fl = get(f"https://data.mendeley.com/public-api/datasets/{rid}/files?folder_id={fid}&version={ver}")
        if isinstance(fl, list): files += [[x["filename"], (x.get("content_details") or {}).get("size")] for x in fl]
        time.sleep(0.2)
    j["files"] = files; j.pop("err", None); json.dump(j, open(f, "w"))
print("mendeley ok")
# 2. Zenodo zips: use the record's own file links
class Remote(io.RawIOBase):
    def __init__(s, url, size): s.url, s.size, s.pos = url, size, 0
    def seekable(s): return True
    def readable(s): return True
    def tell(s): return s.pos
    def seek(s, off, wh=0):
        s.pos = off if wh == 0 else s.pos + off if wh == 1 else s.size + off; return s.pos
    def readinto(s, b):
        n = len(b)
        if n == 0 or s.pos >= s.size: return 0
        end = min(s.size, s.pos + n) - 1
        d = urllib.request.urlopen(urllib.request.Request(s.url, headers={"Range": f"bytes={s.pos}-{end}", "User-Agent": "core-dataset-check/1.0"}), timeout=60).read()[:n]
        b[:len(d)] = d; s.pos += len(d); return len(d)
for f in sorted(glob.glob(f"{base}/repo/*.json")):
    j = json.load(open(f)); out = f"{base}/zip/{os.path.basename(f)}"
    if j.get("repo") != "zenodo" or not any(x[0].lower().endswith(".zip") for x in j.get("files") or []): continue
    rid = j["doi"].split("zenodo.")[1]; rec = get(f"https://zenodo.org/api/records/{rid}")
    names = []
    for fo in (rec.get("files") or []):
        if not fo["key"].lower().endswith(".zip"): continue
        try:
            u = urllib.request.urlopen(urllib.request.Request(fo["links"]["self"], method="HEAD", headers={"User-Agent": "core-dataset-check/1.0"}), timeout=60).geturl()
            z = zipfile.ZipFile(io.BufferedReader(Remote(u, fo["size"]), buffer_size=65536))
            names += [n for n in z.namelist() if not n.endswith("/")][:4000]
        except Exception as e: names.append(f"__error__ {str(e)[:60]}")
        time.sleep(0.3)
    json.dump({"names": names}, open(out, "w"))
print("zip ok")
