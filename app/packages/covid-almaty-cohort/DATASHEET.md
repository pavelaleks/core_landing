# Hospitalised COVID-19 patients in Almaty, 2020–2021 (n = 2,313), standardised

**Prepared by CORE · MVP demonstration package · 2026-11-11**

| | |
|---|---|
| Source | Data and R code for: Clinical severity and in-hospital outcomes across pre-VOC, Alpha-dominant, and Delta-dominant SARS-CoV-2 periods in Almaty, Kazakhstan: a retrospective cohort study |
| Authors | Nurmatova, Aigerim, Begadilova, Tolkyn, Ramazanova, Bakyt |
| University | Kazakh National Medical University (KZ) |
| Original record | https://doi.org/10.5281/zenodo.23608062 |
| Licence | CC BY 4.0 (original and CORE additions) |
| Rows | 2,395 |
| Who uses it | Pharma and CROs, medical-AI teams, insurers, public-health agencies |

## What CORE added
- Free-text organism names (partly Russian) mapped to standard species names and NCBI taxon IDs
- Mixed susceptibility codes unified to S/I/R; antibiotics coded with ATC
- Diagnoses coded with ICD-10, lab tests with LOINC
- Range and logic checks with flags per record
- Codebook in English, Russian and Uzbek

## Quality report
| Type | Column | What we found and did |
|---|---|---|
| normalised | organism_raw | 134 organism entries mapped to standard species names and NCBI taxon IDs (27 spelling/case fixes); 119 entries like 'нет роста', 'отрицательно', '0' coded as 'no growth'; 5 entries ('зев', 'есть рост') coded as 'growth, organism not stated' |
| normalised | 10 antibiotic columns | mixed codes (1/0/S/R/s/r/I) unified to S/I/R: 453 S, 43 R, 1 I; 6 entries left blank (value '2' ×5, one free-text note listing other antibiotics) |
| check | labs, outcomes | all lab values inside physiological ranges; los_zero: 1 (flagged in qc_flags, not changed) |
| check | duplicate_record | 82 records flagged by the authors as repeat admissions; kept, filter duplicate_record = 0 for the analytic cohort of 2313 |
| missing | vaccination | 155 of 2395 missing (6%) |
| missing | crp | 1696 of 2395 missing (71%) |
| missing | ct_category | 1039 of 2395 missing (43%) |
| missing | pcr_positive | 343 of 2395 missing (14%) |

## Files
- `data/covid_almaty_cohort.csv` — the data, UTF-8 CSV
- `codebook.csv` — every variable with type, values and labels in English, Russian and Uzbek
- `croissant.json` — machine-readable metadata (MLCommons Croissant 1.0)
- `LICENSE.txt` — licence and how to cite

## Status and limits
This is a demonstration of CORE's process on openly licensed data. The university has not yet
signed a CORE agreement for this dataset; CORE does not sell the original data, only its preparation.
Annotations marked "CORE draft" have not yet been reviewed by an expert of the university.

## Cite
Nurmatova, Aigerim; Begadilova, Tolkyn; Ramazanova, Bakyt (2026). Data and R code for: Clinical severity and in-hospital outcomes across pre-VOC, Alpha-dominant, and Delta-dominant SARS-CoV-2 periods in Almaty, Kazakhstan: a retrospective cohort study. Zenodo. https://doi.org/10.5281/zenodo.23608062
Prepared by CORE (core_landing), 2026.
