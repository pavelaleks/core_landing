import { BA } from "../api/demo-data.js";
import { apiBase } from "../api/datasets.js";
import { esc, nf } from "./format.js";

function chartValue(label, percent) {
  return '<td class="n">' + esc(label) + '<div class="bar" aria-hidden="true"><i style="width:' + Number(percent) + '%"></i></div></td>';
}

function insight(d) {
  var s = d.summary, h = "";
  if (d.key === "insurance") {
    var seg = [["all", "Все"], ["urban", "Город"], ["rural", "Село"], ["men", "Мужчины"], ["women", "Женщины"], ["age_16_29", "16–29 лет"], ["age_30_44", "30–44 года"], ["age_45_plus", "45+ лет"], ["higher_ed", "С высшим образованием"], ["no_higher_ed", "Без высшего"]];
    h += "<h2>Страховой охват по группам</h2><p class=\"muted small\" style=\"margin-bottom:12px\">Доля людей с высоким охватом страхованием (индекс ≥ 3,5 из 5) и намерение купить, по сегментам. Это пример отчёта, который CORE делает для страховой компании.</p>" +
      '<div class="tbl-wrap"><table class="t"><tr><th>Сегмент</th><th>Человек</th><th>Высокий охват</th><th>Намерение купить, 1–5</th></tr>' +
      seg.map(function (x) { var v = s.segments[x[0]]; return "<tr><td>" + x[1] + '</td><td class="n">' + v.n + '</td>' + chartValue(v.high_inclusion_pct + "%", v.high_inclusion_pct) + '<td class="n">' + String(v.intention).replace(".", ",") + "</td></tr>"; }).join("") +
      "</table></div>" +
      '<p class="sheet-caption">С намерением купить сильнее всего связаны: ' + s.drivers_of_intention.slice(0, 3).map(function (x) { return "<b>" + x[2].toLowerCase() + "</b> (r = " + String(x[4]).replace(".", ",") + ")"; }).join(", ") +
      ". Финансовая грамотность связана слабо (r = " + String(s.drivers_of_intention.filter(function (x) { return x[0] === "fin_literacy_score"; })[0][4]).replace(".", ",") + "): продавать надо пользу и доверие, а не обучение. Сельские жители застрахованы реже городских.</p>";
  } else if (d.key === "covid") {
    var order = ["Pre-VOC", "Alpha-dominant", "Delta-dominant"], lbl = { "Pre-VOC": "До новых вариантов (до 31.01.2021)", "Alpha-dominant": "Альфа (02–06.2021)", "Delta-dominant": "Дельта (07–12.2021)" };
    h += "<h2>Исходы по периодам</h2>" +
      '<p class="sheet-caption">В анализ вошли ' + nf(s.analytic) + ' из ' + nf(d.rows) + ' записей. Повторные госпитализации исключены из расчёта.</p><div class="tbl-wrap"><table class="t"><tr><th>Период</th><th>Пациентов</th><th>Смертность</th><th>Смерть или реанимация</th></tr>' +
      order.map(function (k) { var v = s.periods[k]; return "<tr><td>" + lbl[k] + '</td><td class="n">' + nf(v.n) + '</td>' + chartValue(String(v.death_pct).replace(".", ",") + "%", v.death_pct) + '<td class="n">' + String(v.severe_pct).replace(".", ",") + "%</td></tr>"; }).join("") +
      "</table></div>" +
      '<p class="sheet-caption">Чаще всего в посевах: ' + s.top_organisms.slice(0, 4).map(function (x) { return "<i>" + esc(x[0]) + "</i> (" + x[1] + ")"; }).join(", ") + ". " + s.coded_variables + " переменных получили стандартные коды (МКБ-10, LOINC, ATC, NCBI) — набор можно объединять с другими клиниками.</p>";
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

export function preparedData(d) {
  const [header, ...rows] = d.preview;
  const fields = previewFields[d.key];
  const firstRows = rows.slice(0, 3).map(row => fields.map(([key]) => row[header.indexOf(key)]));
  const graphTitle = {terms: "Темы и частоты в учебниках", insurance: "Страховой охват и намерение купить", covid: "Исходы по периодам госпитализации"}[d.key];
  const note = d.key === "terms" ? '<p class="sheet-caption">Переводы и тематические категории добавлены для ' + nf(d.summary.glossed) + ' самых частых терминов. Разметка ожидает проверки географом.</p>' : '';
  return table(fields.map(([, label]) => label), firstRows) + note +
    '<details class="sheet-extra"><summary>' + graphTitle + '</summary><div class="sheet-chart">' + insight(d) + '</div></details>' +
    '<details class="sheet-extra"><summary>Первые строки исходной таблицы</summary>' + table(header.slice(0, 9), rows.map(row => row.slice(0, 9))) +
    '<p class="sheet-caption">Показаны ' + Math.min(9, header.length) + ' из ' + d.columns + ' полей пакета.</p></details>';
}

export function preparedPassport(d) {
  const types = {formula: "Формула", naming: "Названия", missing: "Пропуски", invalid: "Ошибка", check: "Проверка", normalised: "Стандартизация", added: "Добавлено"};
  return '<p>Авторы · ' + esc(d.authors.join(", ")) + '</p><p>Исходный набор · <a href="https://doi.org/' + esc(d.doi) + '" target="_blank" rel="noopener">' + esc(d.doi) + '</a></p>' +
    '<p>Словарь полей доступен на русском, узбекском и английском языках.</p>' +
    '<h3>Что сделал CORE</h3><ul class="added">' + d.added_ru.map(value => '<li>' + esc(value) + '</li>').join("") + '</ul>' +
    '<details class="sheet-extra"><summary>До и после</summary>' + (BA[d.slug] || []).map(([before, after]) =>
      '<div class="ba"><div class="b">' + esc(before) + '</div><div class="arr">→</div><div class="a">' + esc(after) + '</div></div>').join("") + '</details>' +
    '<details class="sheet-extra"><summary>Отчёт о качестве · ' + d.summary.issues.length + '</summary>' +
    table(["Что", "Где", "Что нашли и сделали"], d.summary.issues.map(i => [types[i.type] || i.type, i.column, i.detail])) + '</details>' +
    '<p class="sheet-caption">Демонстрация подготовки CORE на открытых данных. Договор с вузом по этому набору ещё не подписан. CORE предлагает подготовку данных. Разметка «CORE draft» ожидает проверки экспертом вуза.</p>';
}
