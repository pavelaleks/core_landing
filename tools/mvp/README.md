# MVP packages

Three open datasets by university researchers (CC BY 4.0, Zenodo), prepared by CORE and served in
the partner cabinet `app/`. Raw files are not stored in the repo — download them first.

```bash
R=raw; for id in 21704211 21217676 23608061; do mkdir -p $R/$id
  curl -sL https://zenodo.org/api/records/$id -o $R/$id/record.json
  python3 -c "import json;[print(f['links']['self'],f['key']) for f in json.load(open('$R/$id/record.json'))['files']]" |
  while read u k; do curl -sL "$u" -o "$R/$id/$k"; done; done
(cd $R/21704211 && for z in *.zip; do mkdir -p "x_${z%.zip}" && unzip -oq "$z" -d "x_${z%.zip}"; done)

python3 -I tools/mvp/terms_stage1.py $R/21704211 out/terms_stage1.json          # frequencies, levels, variants
python3 -I tools/mvp/terms_build.py out/terms_stage1.json data-src/mvp/terms_gloss.tsv out/terms
python3 -I tools/mvp/insurance.py $R/21217676/Smart_data_Cleaned2.xlsx out/insurance
python3 -I tools/mvp/covid.py $R/23608061 out/covid
python3 -I tools/mvp/package.py out $R app/packages                              # zip + datasheet + Croissant
python3 -I tools/mvp/build_api.py app                                            # static API v1 + OpenAPI
```

`data-src/mvp/terms_gloss.tsv` — Russian/English equivalents and categories for the 320 most frequent
terms (CORE draft, awaiting review by a geographer).

The cabinet (`app/`) keeps requests and uploads in the browser (localStorage); `store` in
`app/app.js` is the single place to switch to a shared backend. Invite code: see `INVITE` in `app/app.js`.

Buyers with an approved request see an API key, curl/Python/JS examples, a live request and a SQL console
(DuckDB-WASM 1.29.0 from jsDelivr, runs in the browser). The static demo does not check the key.
