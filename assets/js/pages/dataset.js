import { BA, PRICE, ROLES, id } from "../api/demo-data.js";
import { fetchDatasetUsage } from "../api/datasets.js";
import { renderDatasetUsage } from "../ui/dataset-usage.js";
import { esc, nf, date, pill, toast } from "../ui/format.js";
import { createDatasetApi } from "./dataset-api.js";
export function createDatasetPage({ store, view, ds, myReq, go, render, switchRole }) {
  var { apiSection, wireApi } = createDatasetApi({ store, myReq });

  function insight(d) {
    var s = d.summary, h = "";
    if (d.key === "insurance") {
      var seg = [["all", "Все"], ["urban", "Город"], ["rural", "Село"], ["men", "Мужчины"], ["women", "Женщины"], ["age_16_29", "16–29 лет"], ["age_30_44", "30–44 года"], ["age_45_plus", "45+ лет"], ["higher_ed", "С высшим образованием"], ["no_higher_ed", "Без высшего"]];
      h += "<h2>Что видно сразу: кто уже застрахован</h2><p class=\"muted small\" style=\"margin-bottom:12px\">Доля людей с высоким охватом страхованием (индекс ≥ 3,5 из 5) и намерение купить, по сегментам. Это пример отчёта, который CORE делает для страховой компании.</p>" +
        '<div class="tbl-wrap"><table class="t"><tr><th>Сегмент</th><th>Человек</th><th>Высокий охват</th><th></th><th>Намерение купить, 1–5</th></tr>' +
        seg.map(function (x) { var v = s.segments[x[0]]; return "<tr><td>" + x[1] + '</td><td class="n">' + v.n + '</td><td class="n">' + v.high_inclusion_pct + '%</td><td><div class="bar"><i style="width:' + Math.min(100, v.high_inclusion_pct * 2) + '%"></i></div></td><td class="n">' + String(v.intention).replace(".", ",") + "</td></tr>"; }).join("") +
        "</table></div>" +
        '<p class="small" style="margin-top:12px;color:#c3cbd4">С намерением купить сильнее всего связаны: ' + s.drivers_of_intention.slice(0, 3).map(function (x) { return "<b>" + x[2].toLowerCase() + "</b> (r = " + String(x[4]).replace(".", ",") + ")"; }).join(", ") +
        ". Финансовая грамотность связана слабо (r = " + String(s.drivers_of_intention.filter(function (x) { return x[0] === "fin_literacy_score"; })[0][4]).replace(".", ",") + "): продавать надо пользу и доверие, а не обучение. Сельские жители застрахованы реже городских.</p>";
    } else if (d.key === "covid") {
      var order = ["Pre-VOC", "Alpha-dominant", "Delta-dominant"], lbl = { "Pre-VOC": "До новых вариантов (до 31.01.2021)", "Alpha-dominant": "Альфа (02–06.2021)", "Delta-dominant": "Дельта (07–12.2021)" };
      h += "<h2>Что видно сразу: исходы по волнам</h2>" +
        '<div class="tbl-wrap"><table class="t"><tr><th>Период</th><th>Пациентов</th><th>Смертность</th><th></th><th>Смерть или реанимация</th></tr>' +
        order.map(function (k) { var v = s.periods[k]; return "<tr><td>" + lbl[k] + '</td><td class="n">' + nf(v.n) + '</td><td class="n">' + String(v.death_pct).replace(".", ",") + '%</td><td><div class="bar"><i style="width:' + v.death_pct * 12 + '%"></i></div></td><td class="n">' + String(v.severe_pct).replace(".", ",") + "%</td></tr>"; }).join("") +
        "</table></div>" +
        '<p class="small" style="margin-top:12px;color:#c3cbd4">Чаще всего в посевах: ' + s.top_organisms.slice(0, 4).map(function (x) { return "<i>" + esc(x[0]) + "</i> (" + x[1] + ")"; }).join(", ") + ". " + s.coded_variables + " переменных получили стандартные коды (МКБ-10, LOINC, ATC, NCBI) — набор можно объединять с другими клиниками.</p>";
    } else {
      var max = s.categories[0][1];
      h += "<h2>Что видно сразу: о чём учебники</h2>" +
        '<div class="grid2"><div class="tbl-wrap"><table class="t"><tr><th>Категория (320 частых терминов)</th><th>Терминов</th><th></th></tr>' +
        s.categories.map(function (c) { return "<tr><td>" + esc(c[0]) + '</td><td class="n">' + c[1] + '</td><td><div class="bar"><i style="width:' + Math.round(100 * c[1] / max) + '%"></i></div></td></tr>'; }).join("") +
        '</table></div><div class="tbl-wrap"><table class="t"><tr><th>Узбекский</th><th>Русский</th><th>English</th><th>Школа</th><th>Вуз</th></tr>' +
        s.examples.slice(0, 9).map(function (e) { return "<tr><td>" + esc(e.term_uz) + "</td><td>" + esc(e.term_ru) + "</td><td>" + esc(e.term_en) + '</td><td class="n">' + nf(e.freq_school) + '</td><td class="n">' + nf(e.freq_university) + "</td></tr>"; }).join("") +
        "</table></div></div>";
    }
    return h;
  }

  function accessBox(d) {
    var S = store.s;
    var u = S.user, base = "packages/" + d.slug + "/";
    if (u.role !== "buyer") {
      return '<div class="card"><b>Файлы пакета</b><p class="small muted" style="margin-top:6px">Вы смотрите как ' + ROLES[u.role].toLowerCase() + '. Покупателю файлы открываются после одобрения заявки.</p>' + files(d, base) + "</div>";
    }
    var r = myReq(d.slug);
    if (!r || r.status === "declined") {
      return '<div class="card"><b>Получить доступ</b><p class="small muted" style="margin:6px 0 14px">Ориентир цены для коммерческого использования: ' + PRICE[d.slug] + ". Для участников инкубатора — бесплатно.</p>" +
        (r ? '<p class="err">Прошлая заявка отклонена. Можно уточнить задачу и отправить снова.</p>' : "") +
        '<form id="reqf"><label class="f"><span>Для чего нужны данные</span><textarea id="rP" required placeholder="Например, обучаем модель / готовим продукт / исследование"></textarea></label>' +
        '<label class="f"><span>Использование</span><select id="rU"><option value="commercial">Коммерческое</option><option value="research">Некоммерческое исследование</option></select></label>' +
        '<button class="btn btn-teal btn-sm">Запросить доступ</button></form></div>';
    }
    if (r.status === "pending") {
      return '<div class="card"><b>Заявка отправлена</b> ' + pill("pending") + '<p class="small muted" style="margin-top:8px">Заявка ' + r.id + " от " + date(r.created) + ". CORE проверяет, подходит ли цель использования под лицензию и договор с вузом.</p>" +
        '<div class="hint">Демо: переключитесь в роль «Оператор CORE» (меню вверху справа) и одобрите заявку.</div>' +
        '<button class="btn btn-ghost btn-sm" id="asOp">Перейти в роль оператора →</button></div>';
    }
    return '<div class="card"><b>Доступ открыт</b> ' + pill("approved") + '<p class="small muted" style="margin-top:8px">Лицензия CC BY 4.0: указывайте авторов набора и CORE как подготовившего данные.</p>' +
      '<label class="chk"><input type="checkbox" id="lic"> Принимаю условия лицензии</label>' + '<div id="dlBox" hidden>' + files(d, base, true) + "</div>" +
      '<button class="btn btn-ghost btn-sm btn-block" id="toApi" style="margin-top:12px">Ключ API и SQL-запросы ↓</button></div>';
  }

  function files(d, base, live) {
    var f = [[d.zip, "Весь пакет (zip)", d.zip_kb + " КБ"], ["data/" + d.file, "Данные (CSV)", nf(d.rows) + " строк"], ["codebook.csv", "Описание переменных, 3 языка", "CSV"],
      ["DATASHEET.md", "Паспорт набора и отчёт о качестве", "MD"], ["croissant.json", "Метаданные Croissant", "JSON"], ["LICENSE.txt", "Лицензия и как цитировать", "TXT"]];
    return '<div class="dl">' + f.map(function (x) {
      var href = x[0] === d.zip ? "packages/" + d.zip : base + x[0];
      return live ? '<a href="' + href + '" download data-dl>' + x[1] + "<span>" + x[2] + "</span></a>" : '<a aria-disabled="true" style="opacity:.55;pointer-events:none">' + x[1] + "<span>" + x[2] + "</span></a>";
    }).join("") + "</div>";
  }

  function vDataset(slug) {
    var S = store.s;
    var d = ds(slug); if (!d) { go("#catalog"); return; }
    var s = d.summary, p = d.preview, show = Math.min(p[0].length, 9);
    view.innerHTML = '<a class="back" href="#catalog">← Каталог</a><span class="kicker">' + esc(d.field_ru) + " · " + d.country + "</span><h1>" + esc(d.title_ru) + "</h1>" +
      '<p class="lead">' + esc(d.uni_ru) + ". Авторы: " + esc(d.authors.join(", ")) + '. Исходный набор: <a class="mvp-link" href="https://doi.org/' + esc(d.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(d.doi) + "</a></p>" +
      '<div class="facts"><div><b>' + nf(d.rows) + "</b><span>записей</span></div><div><b>" + d.columns + "</b><span>полей</span></div><div><b>" + s.issues.length + "</b><span>находок в отчёте о качестве</span></div><div><b>3</b><span>языка описания</span></div></div>" +
      '<div class="cols"><div>' + apiSection(d) +
      "<h2 style=\"margin-top:0\">Что сделал CORE</h2><ul class=\"added\">" + d.added_ru.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
      "<h2>До и после</h2><div class=\"card\" style=\"padding:8px 20px\">" + (BA[slug] || []).map(function (x) { return '<div class="ba"><div class="b">' + esc(x[0]) + '</div><div class="arr">→</div><div class="a">' + esc(x[1]) + "</div></div>"; }).join("") + "</div>" +
      insight(d) +
      "<h2>Первые строки</h2><div class=\"tbl-wrap\"><table class=\"t mono\"><tr>" + p[0].slice(0, show).map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>" +
      p.slice(1).map(function (r) { return "<tr>" + r.slice(0, show).map(function (c) { return "<td>" + esc(String(c).slice(0, 48)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>" +
      '<p class="small muted" style="margin-top:8px">Показаны ' + show + " из " + d.columns + " полей. Полная таблица — в пакете.</p>" +
      "<h2>Отчёт о качестве</h2><div class=\"tbl-wrap\"><table class=\"t\"><tr><th>Что</th><th>Где</th><th>Что нашли и сделали</th></tr>" +
      s.issues.map(function (i) { return "<tr><td>" + esc({ formula: "формула", naming: "названия", missing: "пропуски", invalid: "ошибка", check: "проверка", normalised: "стандарт", added: "добавлено" }[i.type] || i.type) + "</td><td class=\"mono small\">" + esc(i.column) + "</td><td>" + esc(i.detail) + "</td></tr>"; }).join("") + "</table></div>" +
      '<p class="small muted" style="margin-top:10px">Статус: демонстрация процесса CORE на открытых данных. Договор с вузом по этому набору ещё не подписан; CORE не продаёт исходные данные, только их подготовку. Разметка с пометкой «CORE draft» ждёт проверки экспертом вуза.</p>' +
      '<section class="card" id="demoDatasetUsage"><p class="small muted" role="status">Загружаем сведения об использовании…</p></section>' +
      '</div><aside class="sticky" id="acc">' + (S.user.role === "buyer" ? '<button type="button" class="favorite-button" id="saveDataset" aria-pressed="' + (store.favoriteIds().indexOf(d.slug) >= 0) + '">' + (store.favoriteIds().indexOf(d.slug) >= 0 ? "В избранном" : "В избранное") + '</button>' : "") + accessBox(d) + "</aside></div>";
    const usageBox = document.getElementById("demoDatasetUsage");
    async function loadUsage() {
      try {
        const rows = await fetchDatasetUsage(d.slug);
        if (usageBox.isConnected) usageBox.innerHTML = renderDatasetUsage(rows, "ru");
      } catch (error) {
        if (!usageBox.isConnected) return;
        usageBox.innerHTML = '<p class="err">Не удалось загрузить сведения об использовании.</p><button type="button" class="btn btn-ghost btn-sm">Повторить</button>';
        usageBox.querySelector("button").onclick = loadUsage;
      }
    }
    loadUsage();
    var favorite = document.getElementById("saveDataset");
    if (favorite) favorite.onclick = function () { store.toggleFavorite(d.slug); S = store.s; vDataset(d.slug); };
    wireAccess(d);
  }

  function wireAccess(d) {
    var S = store.s;
    wireApi(d);
    var ta = document.getElementById("toApi");
    if (ta) ta.onclick = function () { document.getElementById("api").scrollIntoView({ behavior: "smooth", block: "start" }); };
    var f = document.getElementById("reqf");
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      S.requests.push({ id: id("R"), ds: d.slug, org: S.user.org, name: S.user.name || "", purpose: document.getElementById("rP").value.trim(), use: document.getElementById("rU").value, status: "pending", created: Date.now() });
      store.save(); toast("Заявка отправлена. CORE ответит в течение рабочего дня."); render();
    };
    var a = document.getElementById("asOp"); if (a) a.onclick = function () { switchRole("operator"); };
    var lic = document.getElementById("lic");
    if (lic) lic.onchange = function () { document.getElementById("dlBox").hidden = !lic.checked; };
    Array.prototype.forEach.call(document.querySelectorAll("[data-dl]"), function (x) {
      x.addEventListener("click", function () { S.downloads++; var r = myReq(d.slug); if (r) r.downloads = (r.downloads || 0) + 1; store.save(); });
    });
  }

  return { vDataset };
}
