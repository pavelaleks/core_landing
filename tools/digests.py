"""Editorial editions from public records, without an extra database or scheduler."""
import json
import os
from pathlib import Path
from public_data import ROOT, RECORDS, local, tr, esc, safe_url, dataset_path

SOURCE = json.loads(Path(ROOT, "data-src", "digests.json").read_text(encoding="utf-8"))


def render(lang, preview=False):
    parts = []
    for edition in SOURCE["editions"]:
        heading = esc(local(edition["title"], lang))
        summary = esc(local(edition["summary"], lang))
        if preview:
            parts.append('<article class="card digest-preview"><p class="small muted">%s</p><h3>%s</h3><p>%s</p><a class="btn btn-ghost btn-sm" href="digests.html#%s">%s</a></article>' % (esc(edition["date"]), heading, summary, esc(edition["id"]), tr(lang, "Read the selection", "Открыть подборку", "Tanlovni oʻqish")))
            continue
        rows = []
        for dataset_id in edition["datasets"]:
            record = RECORDS.get(dataset_id)
            if record is None:
                continue  # Unpublished records do not enter the next static edition.
            source = dataset_path(record)
            if source.startswith(("http:", "https:")) and not safe_url(source):
                continue
            organization = record.get("organization") or {}
            org = organization.get("name_" + lang) or organization.get("name") or ""
            rows.append('<li><a href="%s"%s>%s</a><p class="small muted">%s · %s</p></li>' % (
                esc(source), ' target="_blank" rel="noopener"' if safe_url(source) else "", esc(local(record["title"], lang)), esc(org), esc(record["license"] or tr(lang, "License not specified", "Лицензия не указана", "Litsenziya koʻrsatilmagan"))))
        parts.append('<article class="card digest-edition" id="%s"><p class="small muted">%s · %s: %s</p><h2>%s</h2><p class="lead">%s</p><ul class="digest-records">%s</ul><p class="note">%s</p></article>' % (
            esc(edition["id"]), esc(edition["date"]), tr(lang, "Source snapshot", "Срез источников", "Manbalar holati"), esc(SOURCE["source_checked"]), heading, summary, "".join(rows), esc(local(edition["note"], lang))))
    return ('<div class="digest-previews">' + "".join(parts) + '</div>') if preview else "".join(parts)
