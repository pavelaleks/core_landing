import { PRICE, ROLES, id } from "../api/demo-data.js";
import { fetchDatasetUsage, getCatalog } from "../api/datasets.js";
import { organizationUrl } from "../api/organizations.js";
import { recordUnit } from "../ui/data-labels.js";
import { datasetUrl } from "../url.js";
import { renderDatasetUsage } from "../ui/dataset-usage.js";
import { datasetSheet, openSheetSection, sheetFacts, sheetSection, wireSheetActions } from "../ui/dataset-sheet.js";
import { preparedApiExample, preparedData, preparedPassport } from "../ui/prepared-dataset.js";
import { esc, nf, date, pill, toast } from "../ui/format.js";
import { createDatasetApi } from "./dataset-api.js";

export function createDatasetPage({ store, view, ds, myReq, go, render, switchRole }) {
  var { apiSection, wireApi } = createDatasetApi({ store, myReq });

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
    const entry = (getCatalog() || []).find(item => item.id === slug);
    const organization = entry?.organizationId ? '<a href="' + esc(organizationUrl(entry.organizationId, "ru")) + '">' + esc(d.uni_ru) + '</a>' : esc(d.uni_ru);
    const descriptions = {
      terms: "Словарь узбекских географических терминов из школьных и вузовских учебников с переводами и частотами употребления.",
      insurance: "Ответы жителей Сырдарьинской области о страховании, доверии к страховщикам и намерении купить полис.",
      covid: "Данные о госпитализациях в Алматы за 2020–2021 годы. Можно сравнивать клинические исходы по календарным периодам.",
    };
    const api = apiSection(d);
    const buyer = S.user.role === "buyer", request = buyer && myReq(slug);
    const accessLabel = !buyer ? "Состав пакета" : request?.status === "approved" ? "Файлы и условия" : request?.status === "pending" ? "Статус заявки" : "Запросить доступ";
    const saved = store.favoriteIds().includes(slug);
    const actions = '<button class="sheet-primary" type="button" data-sheet-open="access">' + accessLabel + '</button>' +
      '<button class="sheet-text-action" type="button" data-sheet-open="api">' + (api ? 'Попробовать API · демо' : 'Пример API · демо') + '</button>' +
      (buyer ? '<button type="button" class="favorite-button" id="saveDataset" aria-pressed="' + saved + '">' + (saved ? "В избранном" : "В избранное") + '</button>' : '');
    const volume = d.key === "terms" ? nf(d.rows) + " терминов" : d.key === "insurance" ? nf(d.rows) + " респондента" : nf(d.rows) + " " + recordUnit(d.rows, "ru");
    view.innerHTML = '<div class="sheet-wrap"><a class="back" data-dataset-back href="' + esc(datasetUrl({ id: slug }, "ru")) + '">← К набору данных</a>' + datasetSheet({
      eyebrow: '<p class="sheet-kicker">Демонстрационный пример · ' + esc(d.field_ru) + ' · ' + esc(d.country) + '</p>',
      title: esc(d.title_ru), description: '<p class="sheet-intro">' + esc(descriptions[d.key]) + '</p>',
      source: '<p class="sheet-by">' + organization + ' · Подготовлено CORE</p>',
      facts: sheetFacts([volume, d.columns + " полей", "CC BY 4.0"]),
      actions: '<div class="sheet-actions">' + actions + '</div>',
      data: sheetSection("data", preparedData(d)),
      api: sheetSection("api", api || '<p>Пример запроса к описанию набора. В демо-кабинете покупателя после одобрения заявки появляются демонстрационный ключ, запрос строк и примеры SQL.</p>' + preparedApiExample(d)),
      passport: sheetSection("passport", preparedPassport(d)),
      access: sheetSection("access", accessBox(d)),
      usage: '<div id="demoDatasetUsage" aria-live="polite"></div>',
    }) + '</div>';
    wireSheetActions(view);
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
    if (favorite) favorite.onclick = function () {
      if (!store.toggleFavorite(d.slug)) return;
      const active = store.favoriteIds().includes(d.slug);
      favorite.setAttribute("aria-pressed", String(active));
      favorite.textContent = active ? "В избранном" : "В избранное";
    };
    wireAccess(d);
  }

  function wireAccess(d) {
    var S = store.s;
    wireApi(d);
    const toApi = document.getElementById("toApi");
    if (toApi) toApi.onclick = () => view.querySelector('[data-sheet-open="api"]').click();
    var f = document.getElementById("reqf");
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      S.requests.push({ id: id("R"), ds: d.slug, org: S.user.org, name: S.user.name || "", purpose: document.getElementById("rP").value.trim(), use: document.getElementById("rU").value, status: "pending", created: Date.now() });
      store.save(); toast("Заявка отправлена. CORE ответит в течение рабочего дня."); render();
      openSheetSection(view, "access");
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
