/* Existing demo fixtures and labels, kept unchanged during modularization. */
export var INVITE = "CORE-MVP";
export var STEPS = ["Получен", "Проверка прав", "Проверка персональных данных", "Разметка и описание", "В каталоге"];
export var DS_UNI = { "uzbek-geography-terms": "UNI-UZ-0180", "insurance-literacy-syrdarya": "UNI-UZ-0017", "covid-almaty-cohort": "UNI-KZ-0094" };
export var PRICE = {
  "uzbek-geography-terms": "от $3 000 за корпус в год",
  "insurance-literacy-syrdarya": "от $1 500 за отчёт · от $3 000 за набор в год",
  "covid-almaty-cohort": "от $3 000 за набор в год",
};
export var BA = {
  "uzbek-geography-terms": [
    ["oʻrmon / o'rmon / o‘rmon — три написания", "oʻrmon — одно стандартное"],
    ["aglomeratsiya и agglomeratsiya — два разных термина", "помечены как варианты одного термина"],
    ["aholi — только слово в списке", "aholi · население · population · категория «население, экономика» · в школьных учебниках 405 раз, в вузовских 175 · с 5 класса"],
    ["нет примеров употребления", "контекст из учебника для 817 терминов"],
  ],
  "insurance-literacy-syrdarya": [
    ["Financial_knowledge = «=AM2+AL2+AK2+…» (формула Excel)", "fin_knowledge_score = 6 (число)"],
    ["marrital_status", "marital_status"],
    ["age = 0", "age = пусто (опрос 16+), отмечено в отчёте"],
    ["Trust1 … Trust13 без описания", "«Доверие к страховщикам, вопрос 1» на трёх языках + индекс trust_idx"],
  ],
  "covid-almaty-cohort": [
    ["«нет роста», «отрицательно», «0»", "culture_result = no growth"],
    ["candida albicans / Candida albicans", "Candida albicans · Fungus · NCBI 5476"],
    ["azithromycin: 1, S, s", "azithromycin_sir = S · ATC J01FA10"],
    ["com_dm = 1 (диабет без кода)", "com_dm · МКБ-10 E10–E14; анализы с кодами LOINC"],
  ],
};


export var ROLES = { buyer: "Покупатель", university: "Вуз", operator: "Оператор CORE" };

export var TABLE = { "uzbek-geography-terms": "terms", "insurance-literacy-syrdarya": "insurance", "covid-almaty-cohort": "covid" };
export var EXAMPLES = {
  "covid-almaty-cohort": [
    ["Смертность по волнам", "SELECT period, count(*) AS patients,\n       round(100 * avg(death), 1) AS death_pct,\n       round(100 * avg(severe_outcome), 1) AS death_or_icu_pct\nFROM covid\nWHERE duplicate_record = 0\nGROUP BY period\nORDER BY death_pct DESC"],
    ["Микробы в посевах", "SELECT organism, organism_group, count(*) AS n\nFROM covid\nWHERE organism IS NOT NULL\nGROUP BY ALL\nORDER BY n DESC\nLIMIT 10"],
    ["Диабет и исход", "SELECT com_dm AS diabetes, count(*) AS patients,\n       round(100 * avg(severe_outcome), 1) AS death_or_icu_pct\nFROM covid WHERE duplicate_record = 0\nGROUP BY com_dm"],
  ],
  "insurance-literacy-syrdarya": [
    ["Город и село", "SELECT settlement, count(*) AS people,\n       round(avg(ins_inclusion_idx), 2) AS inclusion,\n       round(avg(intention_idx), 2) AS intention_to_buy\nFROM insurance\nGROUP BY settlement"],
    ["Доверие по образованию", "SELECT education, count(*) AS people,\n       round(avg(trust_idx), 2) AS trust\nFROM insurance\nGROUP BY education\nORDER BY trust DESC"],
    ["Кто готов купить", "SELECT gender, (age >= 30) AS age_30_plus, count(*) AS people,\n       round(100 * avg(CASE WHEN intention_idx >= 3.5 THEN 1 ELSE 0 END)) AS ready_pct\nFROM insurance WHERE age IS NOT NULL\nGROUP BY ALL ORDER BY ready_pct DESC"],
  ],
  "uzbek-geography-terms": [
    ["Термины по темам", "SELECT category_ru, count(*) AS terms\nFROM terms\nWHERE category IS NOT NULL\nGROUP BY category_ru\nORDER BY terms DESC"],
    ["Первые термины 5 класса", "SELECT term_uz, term_ru, term_en, freq_school, freq_university\nFROM terms\nWHERE first_level = '5' AND term_ru IS NOT NULL\nORDER BY freq_school DESC\nLIMIT 15"],
    ["Только в вузе", "SELECT term_uz, term_ru, freq_university\nFROM terms\nWHERE level_profile = 'university only'\nORDER BY freq_university DESC\nLIMIT 15"],
  ],
};

export function seed() {
  var t = Date.now() - 864e5;
  return {
    user: null,
    requests: [{ id: "R-1001", ds: "insurance-literacy-syrdarya", org: "Demo Insurance LLC", name: "Отдел продуктов", purpose: "Понять, кому в регионах продавать страхование жизни и через какие каналы", use: "commercial", status: "pending", created: t }],
    submissions: [{
      id: "S-2001", uni: "UNI-UZ-0180", uniName: "Ургенчский государственный университет", title: "Наблюдения за засолением почв, Хорезм, 2019–2024",
      field: "Агро, вода и экология", desc: "Пробы почв с 40 участков, 6 лет", model: "process", status: 1, created: t,
      file: { name: "soil_salinity_khorezm.csv", size: 182044, rows: 1440, cols: 12, empty: 0.03, pii: [] },
      rights: { own: true, authors: true, personal: true, funder: true }, signer: "Проректор по науке", log: [{ t: t, s: 0 }, { t: t + 3600e3, s: 1 }],
    }],
    downloads: 0,
  };
}

export function id(p) { return p + "-" + Math.floor(1000 + Math.random() * 9000); }
