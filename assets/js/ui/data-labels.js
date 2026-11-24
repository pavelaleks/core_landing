export function countryName(code, lang = "ru") {
  try { return new Intl.DisplayNames([lang], { type: "region" }).of(String(code).toUpperCase()); }
  catch { return code; }
}
export function languageName(code, lang = "ru") {
  try { return new Intl.DisplayNames([lang], { type: "language" }).of(code); }
  catch { return code; }
}
export function tokenMethodName(value, lang = "ru") {
  const names = {
    calculated: { ru: "Подсчитано", en: "Counted", uz: "Hisoblangan" },
    estimated: { ru: "Оценка", en: "Estimated", uz: "Taxminiy" },
    declared: { ru: "Указано автором", en: "Reported by the author", uz: "Muallif koʻrsatgan" },
  };
  return names[value]?.[lang] || names[value]?.en || "";
}
export function recordUnit(count, lang = "ru") {
  if (lang === "uz") return "yozuv";
  const forms = lang === "ru"
    ? { one: "запись", few: "записи", many: "записей", other: "записи" }
    : { one: "record", other: "records" };
  return forms[new Intl.PluralRules(lang).select(count)] || forms.other;
}
export function datasetTopicName(value, lang = "en") {
  const names = {
    Education: { ru: "Образование", uz: "Taʼlim" },
    Medicine: { ru: "Медицина", uz: "Tibbiyot" },
    Research: { ru: "Наука", uz: "Ilm-fan" },
    Demography: { ru: "Демография", uz: "Demografiya" },
    "Language and knowledge": { ru: "Язык и знания", uz: "Til va bilim" },
    "Sociology and finance": { ru: "Социология и финансы", uz: "Sotsiologiya va moliya" },
  };
  if (lang === "en") return value;
  const russian = names[value]?.ru || window.CORE_TOPIC_RU?.[value] || value;
  return lang === "uz" ? names[value]?.uz || window.CORE_UZ?.[russian] || russian : russian;
}
export const COUNTRY_CODES = "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(" ");

