"""Fail if any built page links to a local file that does not exist.

usage: python3 -I tools/check_links.py      (run from the repository root, after build_site.py)
"""
import glob
import os
import posixpath
import re
import sys

bad = {}
files = [f for f in glob.glob("**/*.html", recursive=True) if not f.startswith(("src/", "hf/", ".github/"))]
for f in files:
    text = open(f, encoding="utf-8", errors="ignore").read()
    base = posixpath.dirname(f)
    for url in re.findall(r'\b(?:href|src)="([^"]+)"', text):
        if re.match(r"^(?:[a-z]+:|#|//|data:|mailto:)", url) or "{" in url:
            continue
        path = url.split("#")[0].split("?")[0]
        if not path:
            continue
        target = posixpath.normpath(posixpath.join(base, path))
        if not os.path.exists(target):
            bad.setdefault(url, set()).add(f)
if bad:
    for url, pages in sorted(bad.items()):
        print("broken:", url, "<-", ", ".join(sorted(pages)[:5]))
    sys.exit(1)
print("ok: %d pages, all local links resolve" % len(files))
