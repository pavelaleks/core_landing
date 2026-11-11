# Uzbek geography terminology, annotated

**Prepared by CORE · MVP demonstration package · 2026-11-11**

| | |
|---|---|
| Source | Dataset of Uzbek Educational Geography Terminology from School and University Corpora |
| Authors | Matsaidova, Sayyora, Sattarova, Sapura, Ortiqova, Iqbol, Khamraeva, Nargiza, Tajibayeva, Xurshida, Jurayev, Erali, Kurbanazarov, Baxtibek |
| University | Urgench State University (UZ) |
| Original record | https://doi.org/10.5281/zenodo.22892341 |
| Licence | CC BY 4.0 (original and CORE additions) |
| Rows | 1,196 |
| Who uses it | AI developers (Uzbek LLMs, translation, RAG for education), EdTech, publishers of textbooks |

## What CORE added
- Spelling normalised to the standard Uzbek Latin alphabet; duplicates removed
- Frequency in school (grades 5–11) and university textbooks, and the grade where each term first appears
- Context example from the corpus for every term found
- Russian and English equivalents and a subject category for the 320 most frequent terms
- Spelling variants and terms absent from the corpus flagged for the authors

## Quality report
| Type | Column | What we found and did |
|---|---|---|
| normalised | term_uz | three apostrophe variants (' ‘ ’) unified to the standard Uzbek Latin letters oʻ, gʻ and the tutuq belgisi ʼ; 13 duplicate terms removed (1,209 → 1,196) |
| check | term_uz | 4 pairs of spelling variants (e.g. agglomeratsiya / aglomeratsiya) — flagged, not merged; the authors decide |
| check | corpus | 379 of 1,196 terms do not occur in the published corpus in this exact form (inflected forms or a different source) — flagged in level_profile |
| added | term_ru, term_en, category | Russian and English equivalents and a subject category for the 320 most frequent terms (they cover 95% of term occurrences); status: draft awaiting review by a geographer |

## Files
- `data/uzbek_geography_terms.csv` — the data, UTF-8 CSV
- `codebook.csv` — every variable with type, values and labels in English, Russian and Uzbek
- `croissant.json` — machine-readable metadata (MLCommons Croissant 1.0)
- `LICENSE.txt` — licence and how to cite

## Status and limits
This is a demonstration of CORE's process on openly licensed data. The university has not yet
signed a CORE agreement for this dataset; CORE does not sell the original data, only its preparation.
Annotations marked "CORE draft" have not yet been reviewed by an expert of the university.

## Cite
Matsaidova, Sayyora; Sattarova, Sapura; Ortiqova, Iqbol; Khamraeva, Nargiza; Tajibayeva, Xurshida; Jurayev, Erali; Kurbanazarov, Baxtibek (2026). Dataset of Uzbek Educational Geography Terminology from School and University Corpora. Zenodo. https://doi.org/10.5281/zenodo.22892341
Prepared by CORE (core_landing), 2026.
