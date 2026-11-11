---
license: cc0-1.0
pretty_name: "CORE — Universities of Central Asia"
language: [uz, kk, ky, tg, ru, en]
size_categories: [n<1K]
tags: [central-asia, universities, uzbekistan, kazakhstan, kyrgyzstan, tajikistan, knowledge-graph, entity-linking]
configs:
- config_name: default
  data_files: data/universities.csv
---

# CORE — Universities of Central Asia (CORE-DS-0001)

Registry of higher-education institutions in Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan with persistent CORE IDs, names in national languages, Russian and English, city and coordinates, website, ROR / Wikidata / OpenAlex identifiers and research output. Every other CORE dataset links to these IDs.

- **Records:** 397 higher-education institutions (UZ, KZ, KG, TJ)
- **License:** CC0-1.0 — free for any use, attribution appreciated
- **Version:** 0.1.0, updated 2026-11-07
- **Sources:** Wikidata, ROR, OpenAlex, reconciled and curated by CORE
- **Website:** https://pavelaleks.github.io/core_landing/datasets/universities.html · **API:** https://pavelaleks.github.io/core_landing/api/v0/universities.json

The `id` column (`UNI-UZ-0138` …) is a persistent CORE identifier: every other CORE dataset —
research output, research datasets, university collections — links to it.

## Fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Persistent CORE ID (UNI-…) |
| `country` | string | Country, ISO 3166-1 alpha-2 |
| `name` | string | Primary name |
| `name_national` | string | Name in the national language |
| `name_ru` | string | Name in Russian |
| `name_en` | string | Name in English |
| `acronyms` | string | Acronyms, separated by '; ' |
| `city` | string | City |
| `lat` | number | Latitude, WGS84 |
| `lon` | number | Longitude, WGS84 |
| `website` | string | Official website |
| `founded` | integer | Year founded |
| `ror` | string | ROR ID |
| `wikidata` | string | Wikidata QID |
| `openalex` | string | OpenAlex institution ID |
| `works_count` | integer | Research works in OpenAlex |
| `cited_by_count` | integer | Citations in OpenAlex |
| `h_index` | integer | h-index |

## About CORE

CORE licenses expert-verified, rights-cleared data from Central Asian universities for AI training,
evaluation and RAG. Full datasets, annotation projects and the CORE-CA benchmark: https://pavelaleks.github.io/core_landing/
