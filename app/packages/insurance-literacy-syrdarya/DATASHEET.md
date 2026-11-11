# Insurance literacy and inclusion survey, Syrdarya region (n = 353)

**Prepared by CORE · MVP demonstration package · 2026-11-11**

| | |
|---|---|
| Source | Determinants of Insurance Inclusion in an Emerging Market — Survey Data from the Syrdarya Region, Uzbekistan (n = 353) |
| Authors | Eshpulatov, Dostonbek, Xaydarova, Durdona, Ismoilova, Muyassar, Berdiyev, Gayrat, Sherbekova, Kamola |
| University | Gulistan State University (UZ) |
| Original record | https://doi.org/10.5281/zenodo.21217677 |
| Licence | CC BY 4.0 (original and CORE additions) |
| Rows | 353 |
| Who uses it | Insurers, banks, microfinance, financial-literacy programmes, development agencies |

## What CORE added
- Composite scores stored as Excel formulas evaluated into values
- Columns renamed to readable names; a respondent ID added
- Invalid values (age 0) cleared; blank language answers coded
- Codebook in English, Russian and Uzbek
- 8 construct indices (trust, benefit, intention to buy …) and a segment summary for business

## Quality report
| Type | Column | What we found and did |
|---|---|---|
| formula | Multilanguage | stored as an Excel formula; evaluated as the sum of Rus_lang, Eng_lang, Turkish_lang, Other_lang |
| formula | Financial_knowledge | stored as an Excel formula; evaluated as the sum of FL7, FL6, FL5, FL4, FL3, FL2, FL1 |
| formula | Financial_behavior | stored as an Excel formula; evaluated as the sum of FL13, FL12, FL11, FL10, FL9, FL8 |
| formula | Financial_attitude | stored as an Excel formula; evaluated as the sum of FL14, FL15 |
| formula | FL | stored as an Excel formula; evaluated as the sum of Financial_attitude, Financial_behavior, Financial_knowledge |
| naming | marrital_status | typo in column name, renamed to marital_status; 11 columns given readable names |
| missing | lang_russian | 90 blanks treated as 'language not ticked' (0) |
| missing | lang_english | 137 blanks treated as 'language not ticked' (0) |
| missing | lang_turkish | 229 blanks treated as 'language not ticked' (0) |
| missing | lang_other | 259 blanks treated as 'language not ticked' (0) |
| invalid | age | 1 record(s) with age 0 (the survey is 16+), set to missing |
| check | avg_monthly_expenses_uzs | 14 respondents report 0 UZS monthly expenses; kept, flagged for the authors |
| missing | DL6 | 1 missing value(s), left blank |
| missing | ILit11 | 15 missing value(s), left blank |
| missing | ILit12 | 15 missing value(s), left blank |
| missing | ILit13 | 15 missing value(s), left blank |
| missing | Incl4 | 1 missing value(s), left blank |

## Files
- `data/insurance_survey_syrdarya.csv` — the data, UTF-8 CSV
- `codebook.csv` — every variable with type, values and labels in English, Russian and Uzbek
- `croissant.json` — machine-readable metadata (MLCommons Croissant 1.0)
- `LICENSE.txt` — licence and how to cite

## Status and limits
This is a demonstration of CORE's process on openly licensed data. The university has not yet
signed a CORE agreement for this dataset; CORE does not sell the original data, only its preparation.
Annotations marked "CORE draft" have not yet been reviewed by an expert of the university.

## Cite
Eshpulatov, Dostonbek; Xaydarova, Durdona; Ismoilova, Muyassar; Berdiyev, Gayrat; Sherbekova, Kamola (2026). Determinants of Insurance Inclusion in an Emerging Market — Survey Data from the Syrdarya Region, Uzbekistan (n = 353). Zenodo. https://doi.org/10.5281/zenodo.21217677
Prepared by CORE (core_landing), 2026.
