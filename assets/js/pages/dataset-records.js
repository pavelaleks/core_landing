import { listOwnDatasets, getDataset, saveDataset, setPublicationStatus, datasetFields, fetchDatasetUsage, safeLink } from "../api/datasets.js";
import { databaseMessage } from "../api/query.js";
import { organizationName } from "../api/organizations.js";
import { renderDatasetUsage } from "../ui/dataset-usage.js";
import { esc, nf, toast } from "../ui/format.js";

export function createDatasetRecords({ view, store, go, getProfileState }) {
  let revision = 0;
  const lang = ["en", "ru", "uz"].includes(new URLSearchParams(location.search).get("lang")) ? new URLSearchParams(location.search).get("lang") : "ru";
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  const local = value => value?.[lang] || value?.ru || value?.en || value?.uz || "";
  const statusName = value => ({ draft: "Черновик", published: "Опубликован", unpublished: "Снят с публикации" })[value];
  const detailHash = id => "#dataset/" + encodeURIComponent(id);
  const loading = () => { view.innerHTML = '<p class="lead" role="status">' + tr("Loading data…", "Загружаем данные…", "Maʼlumotlar yuklanmoqda…") + '</p>'; };
  function failed(error, retry) {
    view.innerHTML = '<h1>' + tr("Could not load data", "Не удалось загрузить данные", "Maʼlumotlarni yuklab boʻlmadi") + '</h1><p class="err" role="alert">' + esc(databaseMessage(error)) + '</p><button class="btn btn-primary" id="retryDataset">' + tr("Retry", "Повторить", "Qayta urinish") + '</button>';
    document.getElementById("retryDataset").onclick = retry;
  }

  async function vList() {
    const ticket = ++revision;
    loading();
    try {
      const records = await listOwnDatasets(store.load().user.id);
      if (ticket !== revision) return;
      view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">Личный кабинет</span><h1>Мои датасеты</h1><p class="lead">Черновики и опубликованные карточки вашей организации.</p></div><a class="btn btn-primary" href="#datasets/new">Добавить датасет</a></div>' +
        (!getProfileState().data.is_verified ? '<p class="account-verification-note">Аккаунт ожидает подтверждения CORE. Пока можно готовить черновики.</p>' : '') +
        (records.length ? '<div class="university-list">' + records.map(record => '<article class="card university-dataset"><div><span class="dataset-status">' + statusName(record.publication_status) + '</span><h2>' + esc(local(record.title)) + '</h2><p>' + esc(local(record.description)) + '</p></div><div class="saved-actions"><a class="btn btn-ghost btn-sm" href="' + detailHash(record.id) + '">Открыть</a><a class="btn btn-ghost btn-sm" href="#datasets/edit/' + encodeURIComponent(record.id) + '">Редактировать</a></div></article>').join("") + '</div>' :
          '<section class="card cabinet-empty"><h2>Добавьте первый датасет</h2><p>Сохраните описание, лицензию и ссылки. Черновик будет доступен после повторного входа.</p><a class="btn btn-primary" href="#datasets/new">Создать черновик</a></section>');
    } catch (error) { if (ticket === revision) failed(error, vList); }
  }

  const input = (name, label, value = "", attrs = "") => '<label class="f"><span>' + label + '</span><input name="' + name + '" value="' + esc(value ?? "") + '" ' + attrs + '></label>';
  function linkFields(link = {}) {
    const types = { source: "Источник", publication: "Публикация", code: "Код", documentation: "Документация", license: "Лицензия", terms: "Условия", example: "Пример применения", data: "Данные" };
    return '<div class="dataset-link-row"><select name="linkType" aria-label="Тип ссылки">' + Object.entries(types).map(([id, label]) => '<option value="' + id + '"' + (link.type === id ? ' selected' : '') + '>' + label + '</option>').join("") + '</select>' +
      '<input name="linkTitle" aria-label="Название ссылки" placeholder="Название (необязательно)" value="' + esc(link.title || "") + '"><input name="linkUrl" type="url" aria-label="Адрес ссылки" placeholder="https://…" value="' + esc(link.url || "") + '"><button class="mvp-link remove-link" type="button" aria-label="Удалить ссылку">Убрать</button></div>';
  }

  async function vEditor(id) {
    const editorId = id || "new";
    if (view.querySelector('form[data-editor-id="' + CSS.escape(editorId) + '"]')) return;
    const ticket = ++revision;
    loading();
    try {
      const record = id ? await getDataset(id) : {};
      if (ticket !== revision) return;
      if (!record || (id && record.owner_id !== store.load().user.id)) { view.innerHTML = '<h1>Карточка недоступна</h1><a href="#datasets">Мои датасеты</a>'; return; }
      const translations = { title: { ...(record.title || {}) }, description: { ...(record.description || {}) }, usage_terms: { ...(record.usage_terms || {}) } };
      let language = ["ru", "en", "uz"].find(value => record.title?.[value]) || "ru";
      view.innerHTML = '<a class="back" href="#datasets">Мои датасеты</a><h1>' + (id ? 'Редактировать датасет' : 'Новый датасет') + '</h1>' +
        '<p class="lead">Описание сохраняется в CORE. Файлы пока размещаются по вашим ссылкам.</p>' +
        '<form id="datasetForm" data-editor-id="' + esc(editorId) + '" class="card dataset-editor"><label class="f"><span>Язык описания</span><select name="language">' + [["ru", "Русский"], ["en", "English"], ["uz", "Oʻzbekcha"]].map(([value, label]) => '<option value="' + value + '"' + (value === language ? ' selected' : '') + '>' + label + '</option>').join("") + '</select></label>' +
        input("title", "Название", translations.title[language] || "", 'required maxlength="500"') +
        '<label class="f"><span>Описание: что внутри и для каких задач</span><textarea name="description" required maxlength="20000">' + esc(translations.description[language] || "") + '</textarea></label>' +
        '<div class="dataset-form-grid">' + input("category", "Область", record.category, 'maxlength="120" placeholder="Например, образование"') + input("countries", "Страны", (record.countries || []).join(", "), 'placeholder="UZ, KZ"') + input("languages", "Языки данных", (record.languages || []).join(", "), 'placeholder="uz, ru, en"') + input("record_count", "Количество записей (если известно)", record.record_count, 'type="number" min="0" step="1"') + '</div>' +
        '<h2>Лицензия и условия</h2>' + input("license", "Тип лицензии", record.license, 'list="datasetLicenses" placeholder="Например, CC BY 4.0"') + '<datalist id="datasetLicenses"><option value="CC-BY-4.0"><option value="CC0-1.0"><option value="LicenseRef-ByAgreement"><option value="LicenseRef-MetadataOnly"></datalist>' +
        input("license_url", "Ссылка на текст лицензии", record.license_url, 'type="url" placeholder="https://…"') +
        '<label class="f"><span>Условия использования и ограничения</span><textarea name="usage_terms" maxlength="12000">' + esc(translations.usage_terms[language] || "") + '</textarea></label>' +
        '<p class="small"><a href="' + esc(new URL("../../../ru/documents.html", import.meta.url).href) + '" target="_blank" rel="noopener">Документы и варианты условий публикации</a></p>' +
        '<h2>Ссылки</h2><p class="small muted">Источник, файлы, публикация, код или документ — добавьте то, что есть.</p><div id="datasetLinks">' + (record.links?.length ? record.links : [{}]).map(linkFields).join("") + '</div><button type="button" class="btn btn-ghost btn-sm" id="addDatasetLink">Добавить ссылку</button>' +
        '<details class="token-fields"><summary>Текстовые данные: количество токенов</summary><p class="small muted">Заполняйте, если показатель известен. Укажите, каким способом и для какой версии он получен.</p>' +
        input("token_count", "Количество токенов", record.token_count, 'type="number" min="0" step="1"') + input("tokenizer", "Токенизатор и его версия", record.tokenizer) +
        '<label class="f"><span>Метод</span><select name="token_method"><option value="">Не указан</option>' + [["calculated", "Рассчитано"], ["estimated", "Оценка"], ["declared", "Указано автором"]].map(([value, label]) => '<option value="' + value + '"' + (value === record.token_method ? ' selected' : '') + '>' + label + '</option>').join("") + '</select></label>' +
        input("token_material", "Какой материал посчитан", record.token_material, 'placeholder="Например, текстовое поле корпуса"') + input("data_version", "Версия данных", record.data_version, 'placeholder="Например, 1.0"') + '</details>' +
        '<div class="saved-actions"><button class="btn btn-primary" type="submit">Сохранить ' + (record.publication_status === "published" ? 'изменения' : 'черновик') + '</button><a class="btn btn-ghost" href="' + (id ? detailHash(id) : '#datasets') + '">Отмена</a></div>' +
        (record.publication_status === "published" ? '<p class="small muted">Сохранённые изменения сразу обновят опубликованную карточку.</p>' : '') + '<p id="datasetMessage" class="auth-message" role="status" aria-live="polite"></p></form>';
      const form = document.getElementById("datasetForm");
      const remember = () => { for (const field of ["title", "description", "usage_terms"]) translations[field][language] = form.elements[field].value; };
      form.elements.language.onchange = () => { remember(); language = form.elements.language.value; for (const field of ["title", "description", "usage_terms"]) form.elements[field].value = translations[field][language] || ""; };
      document.getElementById("addDatasetLink").onclick = () => document.getElementById("datasetLinks").insertAdjacentHTML("beforeend", linkFields());
      document.getElementById("datasetLinks").onclick = event => { if (event.target.closest(".remove-link")) event.target.closest(".dataset-link-row").remove(); };
      form.onsubmit = async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        const button = form.querySelector('[type="submit"]'), message = document.getElementById("datasetMessage");
        button.disabled = true; form.setAttribute("aria-busy", "true"); message.textContent = "";
        try {
          remember();
          const values = Object.fromEntries(new FormData(form));
          values.links = [...form.querySelectorAll(".dataset-link-row")].filter(row => row.querySelector('[name="linkUrl"]').value.trim()).map(row => ({ type: row.querySelector('[name="linkType"]').value, title: row.querySelector('[name="linkTitle"]').value.trim(), url: row.querySelector('[name="linkUrl"]').value.trim() }));
          const fields = datasetFields(values, language, translations);
          const saved = await saveDataset(id, fields, store.load().user.id, getProfileState().data.organization_id);
          toast("Карточка сохранена."); go(detailHash(saved.id));
        } catch (error) { message.textContent = error.code ? databaseMessage(error) : error.message; }
        finally { button.disabled = false; form.removeAttribute("aria-busy"); }
      };
    } catch (error) { if (ticket === revision) failed(error, () => vEditor(id)); }
  }

  async function vDetails(id) {
    const ticket = ++revision;
    loading();
    try {
      const record = await getDataset(id);
      if (ticket !== revision) return;
      if (!record) { view.innerHTML = '<h1>' + tr("Dataset not found or unavailable", "Карточка не найдена или недоступна", "Toʻplam topilmadi yoki mavjud emas") + '</h1><a href="' + esc(store.catalogUrl(lang)) + '">' + tr("Catalog", "Каталог", "Katalog") + '</a>'; return; }
      const owner = store.load().user?.id === record.owner_id;
      const profile = getProfileState().data;
      const published = record.publication_status === "published";
      const linkTypes = { source: tr("Source", "Источник", "Manba"), publication: tr("Publication", "Публикация", "Nashr"), code: tr("Code", "Код", "Kod"), documentation: tr("Documentation", "Документация", "Hujjatlar"), license: tr("License", "Лицензия", "Litsenziya"), terms: tr("Terms", "Условия", "Shartlar"), example: tr("Example", "Пример", "Misol"), data: tr("Data", "Данные", "Maʼlumotlar") };
      const links = (record.links || []).filter(link => safeLink(link.url));
      const source = record.source_url ? new URL(record.source_url, new URL("../../../", import.meta.url)).href : "";
      view.innerHTML = '<a class="back" href="' + (owner ? '#datasets' : esc(store.catalogUrl(lang))) + '">' + (owner ? 'Мои датасеты' : tr("Catalog", "Каталог", "Katalog")) + '</a>' +
        '<div class="cabinet-heading"><div><span class="kicker">' + esc(organizationName(record.organization, lang)) + '</span><h1>' + esc(local(record.title)) + '</h1></div>' + (owner ? '<span class="dataset-status">' + statusName(record.publication_status) + '</span>' : '') + '</div>' +
        '<p class="lead dataset-description">' + esc(local(record.description)) + '</p>' +
        '<section class="card auth-profile"><dl><dt>' + tr("Field", "Область", "Soha") + '</dt><dd>' + esc(record.category || '—') + '</dd><dt>' + tr("Countries", "Страны", "Mamlakatlar") + '</dt><dd>' + esc(record.countries.join(", ") || '—') + '</dd><dt>' + tr("Languages", "Языки", "Tillar") + '</dt><dd>' + esc(record.languages.join(", ") || '—') + '</dd><dt>' + tr("Records", "Записи", "Yozuvlar") + '</dt><dd>' + (record.record_count == null ? '—' : nf(record.record_count)) + '</dd><dt>' + tr("License", "Лицензия", "Litsenziya") + '</dt><dd>' + esc(record.license || tr("Not specified", "Не указана", "Koʻrsatilmagan")) + '</dd><dt>' + tr("Tokens", "Токены", "Tokenlar") + '</dt><dd>' + (record.token_count == null ? tr("No data", "Нет данных", "Maʼlumot yoʻq") : nf(record.token_count) + ' · ' + esc(record.tokenizer) + ' · ' + esc(record.token_method) + '<br>' + esc(record.token_material) + ' · v' + esc(record.data_version)) + '</dd></dl>' +
        (local(record.usage_terms) ? '<h2>' + tr("Terms of use", "Условия использования", "Foydalanish shartlari") + '</h2><p class="dataset-description">' + esc(local(record.usage_terms)) + '</p>' : '') +
        (safeLink(record.license_url) ? '<p><a href="' + esc(safeLink(record.license_url)) + '" target="_blank" rel="noopener">' + tr("License text", "Текст лицензии", "Litsenziya matni") + '</a></p>' : '') + '</section>' +
        (links.length || source ? '<section class="card"><h2>' + tr("Links", "Ссылки", "Havolalar") + '</h2><ul class="dataset-links">' + links.map(link => '<li><a href="' + esc(safeLink(link.url)) + '" target="_blank" rel="noopener">' + esc(link.title || linkTypes[link.type] || linkTypes.documentation) + '</a><span class="small muted">' + esc(linkTypes[link.type] || '') + '</span></li>').join("") + (source && !links.some(link => link.url === source) ? '<li><a href="' + esc(source) + '">' + tr("Source page", "Страница источника", "Manba sahifasi") + '</a></li>' : '') + '</ul></section>' : '') +
        '<section class="card" id="recordUsage"><p class="small muted" role="status">' + tr("Loading information about use…", "Загружаем сведения об использовании…", "Foydalanish maʼlumoti yuklanmoqda…") + '</p></section>' +
        (owner ? '<div class="saved-actions"><a class="btn btn-ghost" href="#datasets/edit/' + encodeURIComponent(id) + '">Редактировать</a><button type="button" class="btn btn-primary" id="publishDataset"' + (!profile?.is_verified ? ' disabled' : '') + '>' + (published ? 'Снять с публикации' : 'Опубликовать') + '</button></div><p class="small muted">' + (!profile?.is_verified ? 'Публикация станет доступна после подтверждения CORE.' : published ? 'Публична карточка с описанием и ссылками. Собственные файлы в CORE пока не загружаются.' : 'Карточка пока доступна только вам. Публикация откроет описание и указанные ссылки.') + '</p><p id="publicationMessage" class="auth-message" role="status"></p>' : '');
      if (owner) document.getElementById("publishDataset").onclick = async event => {
        event.currentTarget.disabled = true;
        try { await setPublicationStatus(id, published ? "unpublished" : "published", store.load().user.id); toast(published ? "Карточка снята с публикации." : "Карточка опубликована."); vDetails(id); }
        catch (error) { document.getElementById("publicationMessage").textContent = databaseMessage(error); event.currentTarget.disabled = false; }
      };
      async function loadUsage() {
        try {
          const usage = await fetchDatasetUsage(id);
          if (ticket !== revision) return;
          document.getElementById("recordUsage").innerHTML = renderDatasetUsage(usage, lang);
        } catch (error) {
          if (ticket !== revision) return;
          document.getElementById("recordUsage").innerHTML = '<p class="err">' + tr("Could not load information about use.", "Не удалось загрузить сведения об использовании.", "Foydalanish maʼlumotini yuklab boʻlmadi.") + '</p><button type="button" class="btn btn-ghost btn-sm" id="retryRecordUsage">' + tr("Retry", "Повторить", "Qayta urinish") + '</button>';
          document.getElementById("retryRecordUsage").onclick = loadUsage;
        }
      }
      loadUsage();
    } catch (error) { if (ticket === revision) failed(error, () => vDetails(id)); }
  }
  return { vList, vEditor, vDetails, cancel: () => { revision++; } };
}
