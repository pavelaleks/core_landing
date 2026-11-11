# Checking the scholar datasets

`data-src/research_datasets_check.json` says, for each of the 548 candidate records, what we found when we
opened it in its repository. Re-run (network, ~40 min):

```bash
W=work; mkdir -p $W/dc $W/repo $W/zip
python3 -I tools/dscheck/fetch_dc.py data-src/research_datasets.json $W/dc        # DataCite metadata
python3 -I tools/dscheck/fetch_repo.py data-src/research_datasets.json $W/repo    # Zenodo, GBIF, Dataverse, Figshare, Dryad, Mendeley
python3 -I tools/dscheck/fix_mendeley_zip.py $W                                   # Mendeley files by version; contents of Zenodo zips (range requests)
python3 -I tools/dscheck/classify.py data-src/research_datasets.json $W data-src/research_datasets_check.json
```

Then rebuild `assets/data.js` (build_data.py), `data-src/research_datasets.json` (sync_from_core_hub.py) and the site.
Kinds: data · article (only PDF/Word) · article_extract (ChecklistBank species lists extracted from articles) ·
no_files (restricted) · unavailable (deleted / broken DOI) · duplicate · empty · code.
