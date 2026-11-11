---
license: cc0-1.0
pretty_name: "CORE — Open research datasets by Central Asian scholars"
language: [en]
size_categories: [n<1K]
tags: [central-asia, research-data, data-discovery, openalex, uzbekistan, kazakhstan]
configs:
- config_name: default
  data_files: data/research_datasets.jsonl
---

# CORE — Open research datasets by Central Asian scholars

405 datasets with data files, published since 2023 by researchers of universities in Uzbekistan,
Kazakhstan, Kyrgyzstan and Tajikistan. We selected 548 candidates from 11,523 OpenAlex records typed
"dataset" and opened each one in its repository; field `check` says what we found ('data', or why not:
document only, extract from an article, restricted, link broken, duplicate).

- **By country:** UZ 290, KZ 243, KG 17, TJ 4
- **License of this list:** CC0-1.0 (OpenAlex metadata). Each dataset keeps its own license — see `license`.
- **Authors are omitted** on purpose.
- Field `formats` lists the file types we saw. Field `mentions_central_asia` marks titles that name the region.

Use it to find data for Central Asian NLP, geoscience, agriculture and social-science work.
Browse and filter it on https://pavelaleks.github.io/core_landing/#catalog.
