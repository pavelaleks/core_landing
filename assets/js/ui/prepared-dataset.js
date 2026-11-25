import { BA } from "../api/demo-data.js";
import { apiBase } from "../api/datasets.js";
import { esc, nf } from "./format.js";

function chartValue(label, percent) {
  return '<td class="n">' + esc(label) + '<div class="bar" aria-hidden="true"><i style="width:' + Number(percent) + '%"></i></div></td>';
}

function insight(d, lang = "ru") {
  if (lang !== "ru") {
    const uz = lang === "uz", s = d.summary;
    if (d.key === "insurance") return table(
      uz ? ["Guruh", "Ishtirokchilar", "Yuqori sugʻurta qamrovi, %", "Xarid niyati, 1–5"] : ["Group", "Respondents", "High insurance inclusion, %", "Purchase intention, 1–5"],
      [["all", uz ? "Barcha" : "All"], ["urban", uz ? "Shahar" : "Urban"], ["rural", uz ? "Qishloq" : "Rural"], ["men", uz ? "Erkaklar" : "Men"], ["women", uz ? "Ayollar" : "Women"]].map(([key, label]) => [label, s.segments[key].n, s.segments[key].high_inclusion_pct, s.segments[key].intention])
    );
    if (d.key === "covid") return '<p>' + nf(s.analytic) + ' / ' + nf(d.rows) + ' · ' + (uz ? "Tahlilga kiritilgan yozuvlar. Takroriy kasalxonaga yotqizishlar hisobdan chiqarilgan." : "Records included in the analysis. Repeat admissions are excluded.") + '</p>' + table(
      uz ? ["Davr", "Bemorlar", "Oʻlim, %", "Oʻlim yoki reanimatsiya, %"] : ["Period", "Patients", "Deaths, %", "Death or intensive care, %"],
      ["Pre-VOC", "Alpha-dominant", "Delta-dominant"].map(key => [key, s.periods[key].n, s.periods[key].death_pct, s.periods[key].severe_pct])
    );
    return table(uz ? ["Mavzu", "Atamalar"] : ["Topic", "Terms"], s.categories) + table(
      uz ? ["Oʻzbekcha", "Ruscha", "Inglizcha", "Maktab", "Universitet"] : ["Uzbek", "Russian", "English", "School", "University"],
      s.examples.slice(0, 9).map(e => [e.term_uz, e.term_ru, e.term_en, e.freq_school, e.freq_university])
    );
  }
  var s = d.summary, h = "";
  if (d.key === "insurance") {
    var seg = [["all", "Все"], ["urban", "Город"], ["rural", "Село"], ["men", "Мужчины"], ["women", "Женщины"], ["age_16_29", "16–29 лет"], ["age_30_44", "30–44 года"], ["age_45_plus", "45+ лет"], ["higher_ed", "С высшим образованием"], ["no_higher_ed", "Без высшего"]];
    h += "<h2>Страховой охват по группам</h2><p class=\"muted small\" style=\"margin-bottom:12px\">Доля людей с высоким охватом страхованием (индекс ≥ 3,5 из 5) и намерение купить, по сегментам. Это пример отчёта, который CORE делает для страховой компании.</p>" +
      '<div class="tbl-wrap"><table class="t"><tr><th>Сегмент</th><th>Человек</th><th>Высокий охват</th><th>Намерение купить, 1–5</th></tr>' +
      seg.map(function (x) { var v = s.segments[x[0]]; return "<tr><td>" + x[1] + '</td><td class="n">' + v.n + '</td>' + chartValue(v.high_inclusion_pct + "%", v.high_inclusion_pct) + '<td class="n">' + String(v.intention).replace(".", ",") + "</td></tr>"; }).join("") +
      "</table></div>" +
      '<p class="sheet-caption">Связь с намерением купить — ' + s.drivers_of_intention.slice(0, 3).map(function (x) { return "<b>" + x[2].toLowerCase() + "</b> (r = " + String(x[4]).replace(".", ",") + ")"; }).join(", ") +
      ". Финансовая грамотность связана слабо (r = " + String(s.drivers_of_intention.filter(function (x) { return x[0] === "fin_literacy_score"; })[0][4]).replace(".", ",") + "). Показанные связи относятся к участникам этого опроса.</p>";
  } else if (d.key === "covid") {
    var order = ["Pre-VOC", "Alpha-dominant", "Delta-dominant"], lbl = { "Pre-VOC": "До новых вариантов (до 31.01.2021)", "Alpha-dominant": "Альфа (02–06.2021)", "Delta-dominant": "Дельта (07–12.2021)" };
    h += "<h2>Исходы по периодам</h2>" +
      '<p class="sheet-caption">В анализ вошли ' + nf(s.analytic) + ' из ' + nf(d.rows) + ' записей. Повторные госпитализации исключены из расчёта.</p><div class="tbl-wrap"><table class="t"><tr><th>Период</th><th>Пациентов</th><th>Смертность</th><th>Смерть или реанимация</th></tr>' +
      order.map(function (k) { var v = s.periods[k]; return "<tr><td>" + lbl[k] + '</td><td class="n">' + nf(v.n) + '</td>' + chartValue(String(v.death_pct).replace(".", ",") + "%", v.death_pct) + '<td class="n">' + String(v.severe_pct).replace(".", ",") + "%</td></tr>"; }).join("") +
      "</table></div>" +
      '<p class="sheet-caption">Часто встречающиеся микроорганизмы в посевах — ' + s.top_organisms.slice(0, 4).map(function (x) { return "<i>" + esc(x[0]) + "</i> (" + x[1] + ")"; }).join(", ") + ". " + s.coded_variables + " переменных получили стандартные коды (МКБ-10, LOINC, ATC, NCBI).</p>";
  } else {
    var max = s.categories[0][1];
    h += "<h2>Темы и частоты терминов</h2>" +
      '<div class="grid2"><div class="tbl-wrap"><table class="t"><tr><th>Категория (320 частых терминов)</th><th>Терминов</th></tr>' +
      s.categories.map(function (c) { return "<tr><td>" + esc(c[0]) + '</td>' + chartValue(c[1], 100 * c[1] / max) + '</tr>'; }).join("") +
      '</table></div><div class="tbl-wrap"><table class="t"><tr><th>Узбекский</th><th>Русский</th><th>English</th><th>Школа</th><th>Вуз</th></tr>' +
      s.examples.slice(0, 9).map(function (e) { return "<tr><td>" + esc(e.term_uz) + "</td><td>" + esc(e.term_ru) + "</td><td>" + esc(e.term_en) + '</td><td class="n">' + nf(e.freq_school) + '</td><td class="n">' + nf(e.freq_university) + "</td></tr>"; }).join("") +
      "</table></div></div>";
  }
  return h;
}

const previewFields = {
  terms: [["term_uz", "Узбекский"], ["term_ru", "Русский"], ["term_en", "Английский"]],
  insurance: [["respondent_id", "Код респондента"], ["settlement", "Тип поселения"], ["age", "Возраст"]],
  covid: [["record_id", "Запись"], ["admission_month", "Месяц госпитализации"], ["period", "Период"]],
};

function table(headers, rows) {
  return '<div class="tbl-wrap"><table class="sheet-table"><thead><tr>' +
    headers.map(label => '<th scope="col">' + esc(label) + '</th>').join("") + '</tr></thead><tbody>' +
    rows.map(row => '<tr>' + row.map(value => '<td>' + esc(value ?? "—") + '</td>').join("") + '</tr>').join("") + '</tbody></table></div>';
}

export function preparedApiExample(d, lang = "ru") {
  const endpoint = new URL("datasets/" + encodeURIComponent(d.slug) + "/index.json", apiBase());
  const caption = { en: "Response excerpt", ru: "Фрагмент ответа", uz: "Javobdan parcha" }[lang];
  const excerpt = { slug: d.slug, rows: d.rows, fields: d.columns };
  return '<pre class="sheet-code">GET ' + esc(endpoint.pathname) + '</pre><p class="sheet-caption">' + caption +
    '</p><pre class="sheet-code">' + esc(JSON.stringify(excerpt, null, 2)) + '</pre>';
}

export function preparedData(d, lang = "ru") {
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  const [header, ...rows] = d.preview;
  const fields = previewFields[d.key];
  const firstRows = rows.slice(0, 3).map(row => fields.map(([key]) => {
    const value = row[header.indexOf(key)];
    if (key === "settlement") return value === "Urban" ? tr("Urban", "Город", "Shahar") : value === "Rural" ? tr("Rural", "Село", "Qishloq") : value;
    return value;
  }));
  const labels = {
    terms: [tr("Uzbek", "Узбекский", "Oʻzbekcha"), tr("Russian", "Русский", "Ruscha"), tr("English", "Английский", "Inglizcha")],
    insurance: [tr("Respondent ID", "Код респондента", "Ishtirokchi kodi"), tr("Settlement", "Тип поселения", "Aholi punkti"), tr("Age", "Возраст", "Yosh")],
    covid: [tr("Record", "Запись", "Yozuv"), tr("Admission month", "Месяц госпитализации", "Kasalxonaga yotqizilgan oy"), tr("Period", "Период", "Davr")],
  };
  const graphTitle = {
    terms: tr("Topics and textbook frequencies", "Темы и частоты в учебниках", "Mavzular va darsliklardagi chastota"),
    insurance: tr("Insurance inclusion and purchase intention", "Страховой охват и намерение купить", "Sugʻurta qamrovi va xarid niyati"),
    covid: tr("Outcomes by admission period", "Исходы по периодам госпитализации", "Kasalxonaga yotqizilgan davrlar boʻyicha natijalar"),
  }[d.key];
  const note = d.key === "terms" ? '<p class="sheet-caption">' + nf(d.summary.glossed) + ' · ' + tr("Frequent terms with draft translations and topic labels, awaiting expert review.", "Частые термины с переводами и тематической разметкой. Ожидают проверки географом.", "Tarjima va mavzu belgilari qoʻshilgan keng tarqalgan atamalar. Ekspert tekshiruvi kutilmoqda.") + '</p>' : '';
  return table(labels[d.key], firstRows) + note +
    '<details class="sheet-extra"><summary>' + graphTitle + '</summary><div class="sheet-chart">' + insight(d, lang) + '</div></details>' +
    '<details class="sheet-extra"><summary>' + tr("First rows of the source table", "Первые строки исходной таблицы", "Asl jadvalning birinchi qatorlari") + '</summary>' + table(header.slice(0, 9), rows.map(row => row.slice(0, 9))) +
    '<p class="sheet-caption">' + tr("Fields shown", "Показано полей", "Koʻrsatilgan maydonlar") + ' · ' + Math.min(9, header.length) + ' / ' + d.columns + '</p></details>';
}

export function preparedPassport(d, lang = "ru", includeSource = true) {
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  const addedUz = {
    terms: ["Imlo standart oʻzbek lotin yozuviga keltirildi va takrorlar olib tashlandi", "Maktab va universitet darsliklaridagi chastota hamda atama ilk uchragan sinf koʻrsatildi", "Korpusda topilgan har bir atama uchun qoʻllanish misoli berildi", "Eng koʻp uchraydigan 320 atamaga ruscha va inglizcha muqobillar hamda mavzu toifasi qoʻshildi", "Imlo variantlari va korpusda uchramagan atamalar mualliflar uchun belgilandi"],
    insurance: ["Excel formulalaridagi yakuniy ballar qiymatlarga aylantirildi", "Ustunlar tushunarli nomlandi va ishtirokchi kodi qoʻshildi", "Notoʻgʻri yosh qiymatlari tozalandi va tilga oid boʻsh javoblar kodlandi", "Maydonlar ingliz, rus va oʻzbek tillarida tavsiflandi", "Sakkizta indeks va guruhlar boʻyicha jamlanma qoʻshildi"],
    covid: ["Mikroorganizmlar nomlari standartlashtirilib, NCBI taksonomiya kodlariga bogʻlandi", "Sezgirlik kodlari S/I/R shakliga keltirildi va antibiotiklarga ATC kodlari qoʻshildi", "Tashxislarga ICD-10 va laboratoriya tahlillariga LOINC kodlari berildi", "Har bir yozuv uchun qiymat va mantiq tekshiruvlari belgilandi", "Maydonlar ingliz, rus va oʻzbek tillarida tavsiflandi"],
  };
  const types = {formula: "Формула", naming: "Названия", missing: "Пропуски", invalid: "Ошибка", check: "Проверка", normalised: "Стандартизация", added: "Добавлено"};
  return '<p>' + tr("Authors", "Авторы", "Mualliflar") + ' · ' + esc(d.authors.join(", ")) + '</p>' +
    (includeSource ? '<p><a href="https://doi.org/' + esc(d.doi) + '" target="_blank" rel="noopener">' + tr("Original publication on Zenodo", "Исходная публикация на Zenodo", "Asl nashr · Zenodo") + '</a></p>' : '') +
    '<p>' + tr("Field descriptions are available in Russian, Uzbek and English.", "Словарь полей доступен на русском, узбекском и английском языках.", "Maydonlar tavsifi rus, oʻzbek va ingliz tillarida mavjud.") + '</p>' +
    '<h3>' + tr("What CORE added", "Что сделал CORE", "CORE nima qoʻshdi") + '</h3><ul class="added">' + (lang === "uz" ? addedUz[d.key] : d["added_" + lang]).map(value => '<li>' + esc(value) + '</li>').join("") + '</ul>' +
    '<details class="sheet-extra"><summary>' + tr("Before and after · Russian notes", "До и после", "Oldin va keyin · ruscha izohlar") + '</summary><div lang="ru">' + (BA[d.slug] || []).map(([before, after]) =>
      '<div class="ba"><div class="b">' + esc(before) + '</div><div class="arr">→</div><div class="a">' + esc(after) + '</div></div>').join("") + '</div></details>' +
    '<details class="sheet-extra"><summary>' + tr("Quality report · source notes in English", "Отчёт о качестве · исходные заметки на английском", "Sifat hisoboti · inglizcha asl izohlar") + ' · ' + d.summary.issues.length + '</summary><div lang="en">' +
    table(["Что", "Где", "Что нашли и сделали"], d.summary.issues.map(i => [types[i.type] || i.type, i.column, i.detail])) + '</div></details>' +
    '<p class="sheet-caption">' + tr("CORE preparation demonstration using open research data. Draft annotations await expert review.", "Пример подготовки CORE на открытых данных исследователей. Черновая разметка ожидает экспертной проверки.", "Tadqiqotchilarning ochiq maʼlumotlari asosida CORE tayyorlash misoli. Qoralama belgilar ekspert tekshiruvini kutmoqda.") + '</p>';
}
