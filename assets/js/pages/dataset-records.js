import { listOwnDatasets, getDataset, saveDataset, setPublicationStatus, datasetFields, fetchDatasetUsage, safeLink } from "../api/datasets.js";
import { databaseMessage } from "../api/query.js";
import { organizationName, organizationUrl } from "../api/organizations.js";
import { getProfile } from "../api/profiles.js";
import { renderDatasetUsage } from "../ui/dataset-usage.js";
import { datasetSheet, sheetFacts, sheetMeta, sheetSection, wireSheetActions } from "../ui/dataset-sheet.js";
import { preparedApiExample, preparedData, preparedPassport } from "../ui/prepared-dataset.js";
import { listLicenses, licenseName, licenseDescription, licenseUrl, publicationLicenseMessage } from "../api/licenses.js";
import { COUNTRY_CODES, countryName, languageName, tokenMethodName, datasetTopicName, recordUnit } from "../ui/data-labels.js";
import { esc, nf, toast } from "../ui/format.js";
import { datasetUrl, sourceLabel } from "../url.js";
import { datasetBackLink } from "../ui/navigation.js";
import { quickContactForm, bindContactForms } from "../ui/contact-form.js";

export function createDatasetRecords({ view, store, go, getProfileState, language, publicView = false }) {
  let revision = 0;
  const requestedLanguage = language || new URLSearchParams(location.search).get("lang");
  const lang = ["en", "ru", "uz"].includes(requestedLanguage) ? requestedLanguage : "ru";
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  const local = value => value?.[lang] || value?.ru || value?.en || value?.uz || "";
  const statusName = value => ({
    draft: tr("Draft", "Черновик", "Qoralama"),
    published: tr("Published", "Опубликован", "Eʼlon qilingan"),
    unpublished: tr("Unpublished", "Снят с публикации", "Nashrdan olingan")
  })[value];
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
      view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">' + tr("Account", "Личный кабинет", "Shaxsiy kabinet") + '</span><h1>' + tr("My datasets", "Мои датасеты", "Mening toʻplamlarim") + '</h1><p class="lead">' + tr("Your drafts and published datasets.", "Ваши черновики и опубликованные датасеты.", "Qoralamalaringiz va eʼlon qilingan toʻplamlaringiz.") + '</p></div><a class="btn btn-primary" href="#datasets/new">' + tr("Add dataset", "Добавить датасет", "Toʻplam qoʻshish") + '</a></div>' +
        (!getProfileState().data.is_verified ? '<p class="account-verification-note">' + tr("CORE is reviewing your account. You can prepare drafts.", "Аккаунт ожидает подтверждения CORE. Пока можно готовить черновики.", "CORE hisobingizni tasdiqlamoqda. Hozircha qoralamalar tayyorlashingiz mumkin.") + '</p>' : '') +
        (records.length ? '<div class="university-list">' + records.map(record => '<article class="card university-dataset"><div><span class="dataset-status">' + statusName(record.publication_status) + '</span><h2>' + esc(local(record.title)) + '</h2><p>' + esc(local(record.description)) + '</p></div><div class="saved-actions"><a class="btn btn-ghost btn-sm" href="' + detailHash(record.id) + '">' + tr("Open", "Открыть", "Ochish") + '</a><a class="btn btn-ghost btn-sm" href="#datasets/edit/' + encodeURIComponent(record.id) + '">' + tr("Edit", "Редактировать", "Tahrirlash") + '</a></div></article>').join("") + '</div>' :
          '<section class="card cabinet-empty"><h2>' + tr("Add your first dataset", "Добавьте первый датасет", "Birinchi toʻplamingizni qoʻshing") + '</h2><p>' + tr("A title and description are enough to save a draft.", "Для сохранения черновика достаточно названия и описания.", "Qoralamani saqlash uchun nom va tavsif yetarli.") + '</p><a class="btn btn-primary" href="#datasets/new">' + tr("Create draft", "Создать черновик", "Qoralama yaratish") + '</a></section>');
    } catch (error) { if (ticket === revision) failed(error, vList); }
  }

  const input = (name, label, value = "", attrs = "") => '<label class="f"><span>' + label + '</span><input name="' + name + '" value="' + esc(value ?? "") + '" ' + attrs + '></label>';
  function linkFields(link = {}) {
    const types = {
      source: tr("Source", "Источник", "Manba"), publication: tr("Publication", "Статья или публикация", "Maqola yoki nashr"),
      code: tr("Code", "Код", "Kod"), documentation: tr("Documentation", "Документация", "Hujjatlar"),
      example: tr("Example", "Пример применения", "Qoʻllash misoli"), data: tr("Data files", "Файлы данных", "Maʼlumot fayllari")
    };
    const options = Object.entries(types);
    if (link.type && !Object.hasOwn(types, link.type)) options.push([link.type, link.type]);
    return '<div class="dataset-link-row"><select name="linkType" aria-label="' + tr("Link type", "Тип ссылки", "Havola turi") + '">' + options.map(([id, label]) => '<option value="' + esc(id) + '"' + (link.type === id ? ' selected' : '') + '>' + esc(label) + '</option>').join("") + '</select>' +
      '<input name="linkTitle" aria-label="' + tr("Link title", "Название ссылки", "Havola nomi") + '" placeholder="' + tr("Title (optional)", "Название (необязательно)", "Nomi (ixtiyoriy)") + '" value="' + esc(link.title || "") + '"><input name="linkUrl" type="url" aria-label="' + tr("Link address", "Адрес ссылки", "Havola manzili") + '" placeholder="https://…" value="' + esc(link.url || "") + '"><button class="mvp-link remove-link" type="button" aria-label="' + tr("Remove link", "Удалить ссылку", "Havolani olib tashlash") + '">' + tr("Remove", "Убрать", "Olib tashlash") + '</button></div>';
  }

  async function vEditor(id, section = "") {
    const editorId = id || "new";
    if (view.querySelector('form[data-editor-id="' + CSS.escape(editorId) + '"]')) return;
    const ticket = ++revision;
    loading();
    try {
      const [record, licenses] = await Promise.all([id ? getDataset(id) : {}, listLicenses()]);
      if (ticket !== revision) return;
      if (!record || (id && record.owner_id !== store.load().user.id)) { view.innerHTML = '<h1>' + tr("Dataset unavailable", "Карточка недоступна", "Toʻplam mavjud emas") + '</h1><a href="#datasets">' + tr("My datasets", "Мои датасеты", "Mening toʻplamlarim") + '</a>'; return; }
      const translations = { title: { ...(record.title || {}) }, description: { ...(record.description || {}) } };
      let language = record.title?.[lang] ? lang : ["ru", "en", "uz"].find(value => record.title?.[value]) || lang;
      const published = record.publication_status === "published";
      const countries = [...new Set([...COUNTRY_CODES, ...(record.countries || [])])].sort((a, b) => countryName(a, lang).localeCompare(countryName(b, lang), lang));
      view.innerHTML = `
        <a class="back" href="#datasets">${tr("My datasets", "Мои датасеты", "Mening toʻplamlarim")}</a>
        <h1>${id ? tr("Edit dataset", "Редактировать датасет", "Toʻplamni tahrirlash") : tr("New dataset", "Новый датасет", "Yangi toʻplam")}</h1>
        <p class="lead">${published ? tr("Update the description or add more information about the data.", "Обновите описание или добавьте сведения о данных.", "Tavsifni yangilang yoki maʼlumotlar haqida qoʻshimcha axborot kiriting.") : tr("A title and description are enough to save a draft.", "Для сохранения черновика достаточно названия и описания.", "Qoralamani saqlash uchun nom va tavsif yetarli.")}</p>
        <form id="datasetForm" data-editor-id="${esc(editorId)}" class="card dataset-editor">
          ${input("title", tr("Title", "Название", "Nomi"), translations.title[language] || "", 'required maxlength="500"')}
          <label class="f"><span>${tr("Description", "Описание", "Tavsif")}</span>
            <textarea name="description" required maxlength="20000" aria-describedby="descriptionHint">${esc(translations.description[language] || "")}</textarea>
            <small id="descriptionHint">${tr("What do the data contain, and what tasks can they help with?", "Что содержится в данных и для каких задач они подходят.", "Maʼlumotlar nimani oʻz ichiga oladi va qaysi vazifalarga mos keladi.")}</small>
          </label>
          <div class="dataset-editor-tools">
            <button type="button" class="mvp-link" id="openDatasetLinks" aria-controls="datasetMaterials">${tr("Add a link", "Добавить ссылку", "Havola qoʻshish")}</button>
            <button type="button" class="mvp-link" id="showDatasetTranslations" aria-controls="datasetTranslations" aria-expanded="false">${tr("Add a translation", "Добавить перевод", "Tarjima qoʻshish")}</button>
          </div>
          <label class="f" id="datasetTranslations" hidden><span>${tr("Description language", "Язык описания", "Tavsif tili")}</span>
            <select name="language">${[["ru", "Русский"], ["en", "English"], ["uz", "Oʻzbekcha"]].map(([value, label]) => '<option value="' + value + '"' + (value === language ? ' selected' : '') + '>' + label + '</option>').join("")}</select>
          </label>
          <details class="dataset-editor-section" id="datasetInformation">
            <summary>${tr("About the data · optional", "Сведения о данных · необязательно", "Maʼlumotlar haqida · ixtiyoriy")}</summary>
            <div class="dataset-form-grid">
              ${input("category", tr("Topic", "Тематика", "Mavzu"), record.category, 'maxlength="120"')}
              <label class="f"><span>${tr("Countries covered", "Страны данных", "Maʼlumotlar mamlakatlari")}</span>
                <select name="countries" multiple size="5" aria-describedby="countriesHint">${countries.map(code => '<option value="' + esc(code) + '"' + (record.countries?.includes(code) ? ' selected' : '') + '>' + esc(countryName(code, lang)) + '</option>').join("")}</select>
                <small id="countriesHint"></small>
              </label>
              ${input("languages", tr("Data languages", "Языки данных", "Maʼlumotlar tillari"), (record.languages || []).join(", "), 'placeholder="uz, ru, en"')}
              ${input("record_count", tr("Record count, if known", "Количество записей, если известно", "Yozuvlar soni, agar maʼlum boʻlsa"), record.record_count, 'type="number" min="0" step="1"')}
              ${input("data_version", tr("Data version", "Версия данных", "Maʼlumotlar versiyasi"), record.data_version)}
            </div>
          </details>
          <details class="dataset-editor-section" id="datasetMaterials">
            <summary>${tr("Links and materials · optional", "Ссылки и материалы · необязательно", "Havolalar va materiallar · ixtiyoriy")}</summary>
            <p class="small muted">${tr("Add links to the source, publications, code or data files.", "Добавьте ссылки на источник, публикации, код или файлы данных.", "Manba, nashrlar, kod yoki maʼlumot fayllariga havolalar qoʻshing.")}</p>
            <div id="datasetLinks">${(record.links || []).map(linkFields).join("")}</div>
            <button type="button" class="btn btn-ghost btn-sm" id="addDatasetLink">${tr("Add a link", "Добавить ссылку", "Havola qoʻshish")}</button>
          </details>
          <details class="dataset-editor-section" id="datasetPublication"${section === "publication" ? " open" : ""}>
            <summary>${tr("Publication terms", "Условия публикации", "Eʼlon qilish shartlari")}</summary>
            <p class="small muted">${tr("Choose a license before publishing.", "Лицензия понадобится перед публикацией.", "Eʼlon qilishdan oldin litsenziyani tanlang.")}</p>
            <label class="f"><span>${tr("License", "Лицензия", "Litsenziya")}</span>
              <select name="license_id"${published ? " required" : ""} aria-describedby="licenseDescription">
                <option value="">${tr("Choose a license", "Выберите лицензию", "Litsenziyani tanlang")}</option>
                ${licenses.map(license => '<option value="' + esc(license.id) + '"' + (license.id === record.license_id ? ' selected' : '') + '>' + esc(licenseName(license, lang)) + '</option>').join("")}
              </select>
            </label>
            <p class="small muted" id="licenseDescription" role="status"></p>
            <p class="small"><a id="selectedLicenseDocument" target="_blank" rel="noopener" hidden>${tr("Read the license", "Посмотреть выбранную лицензию", "Tanlangan litsenziyani koʻrish")}</a></p>
          </details>
          <div class="saved-actions">
            <button class="btn btn-primary" type="submit">${published ? tr("Save changes", "Сохранить изменения", "Oʻzgarishlarni saqlash") : tr("Save draft", "Сохранить черновик", "Qoralamani saqlash")}</button>
            ${!published ? '<button class="btn btn-primary" type="submit" name="action" value="publish"' + (!getProfileState().data.is_verified ? ' disabled' : '') + '>' + tr("Publish", "Опубликовать", "Eʼlon qilish") + '</button>' : ''}
            <a class="btn btn-ghost" href="${id ? detailHash(id) : '#datasets'}">${tr("Cancel", "Отмена", "Bekor qilish")}</a>
          </div>
          ${published ? '<p class="small muted">' + tr("Saved changes update the published dataset.", "Сохранённые изменения сразу обновят опубликованную карточку.", "Saqlangan oʻzgarishlar eʼlon qilingan toʻplamni yangilaydi.") + '</p>' : ""}
          ${!published && !getProfileState().data.is_verified ? '<p class="small muted">' + tr("You can save a draft. Publishing becomes available after CORE verifies your account.", "Пока можно сохранить черновик. Публикация станет доступна после подтверждения аккаунта CORE.", "Qoralamani saqlashingiz mumkin. CORE hisobingizni tasdiqlagandan keyin eʼlon qilish mumkin boʻladi.") + '</p>' : ''}
          <p id="datasetMessage" class="auth-message" role="status" aria-live="polite"></p>
        </form>`;
      const form = document.getElementById("datasetForm");
      const remember = () => { for (const field of ["title", "description"]) translations[field][language] = form.elements[field].value; };
      form.elements.language.onchange = () => { remember(); language = form.elements.language.value; for (const field of ["title", "description"]) form.elements[field].value = translations[field][language] || ""; };
      document.getElementById("showDatasetTranslations").onclick = event => {
        const panel = document.getElementById("datasetTranslations");
        panel.hidden = !panel.hidden;
        event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
        if (!panel.hidden) form.elements.language.focus();
      };
      form.elements.license_id.onchange = () => {
        const selected = licenses.find(license => license.id === form.elements.license_id.value);
        document.getElementById("licenseDescription").textContent = licenseDescription(selected, lang);
        const link = document.getElementById("selectedLicenseDocument"), url = licenseUrl(selected);
        link.hidden = !url;
        if (url) link.href = url; else link.removeAttribute("href");
      };
      form.elements.license_id.onchange();
      form.elements.countries.onchange = () => {
        const selected = [...form.elements.countries.selectedOptions].map(option => option.textContent);
        document.getElementById("countriesHint").textContent = selected.length ? tr("Selected", "Выбрано", "Tanlangan") + " · " + selected.join(", ") : tr("You can select several countries.", "Можно выбрать несколько стран.", "Bir nechta mamlakatni tanlash mumkin.");
      };
      form.elements.countries.onchange();
      document.getElementById("addDatasetLink").onclick = () => {
        document.getElementById("datasetLinks").insertAdjacentHTML("beforeend", linkFields());
        form.querySelector('.dataset-link-row:last-child [name="linkUrl"]').focus();
      };
      document.getElementById("openDatasetLinks").onclick = () => {
        document.getElementById("datasetMaterials").open = true;
        document.getElementById("addDatasetLink").click();
      };
      document.getElementById("datasetLinks").onclick = event => { if (event.target.closest(".remove-link")) event.target.closest(".dataset-link-row").remove(); };
      form.addEventListener("invalid", event => {
        const details = event.target.closest("details");
        if (details) details.open = true;
      }, true);
      if (section === "publication") form.elements.license_id.focus();
      form.onsubmit = async event => {
        event.preventDefault();
        if (form.getAttribute("aria-busy") === "true" || !form.reportValidity()) return;
        const publish = event.submitter?.value === "publish";
        let editorHash = location.hash;
        const buttons = [...form.querySelectorAll('[type="submit"]')].map(button => [button, button.disabled]);
        const message = document.getElementById("datasetMessage");
        buttons.forEach(([button]) => { button.disabled = true; });
        form.setAttribute("aria-busy", "true"); message.textContent = "";
        let savedDraft = false;
        try {
          remember();
          const values = Object.fromEntries(new FormData(form));
          values.countries = [...form.elements.countries.selectedOptions].map(option => option.value).join(",");
          values.links = [...form.querySelectorAll(".dataset-link-row")].filter(row => row.querySelector('[name="linkUrl"]').value.trim()).map(row => ({ type: row.querySelector('[name="linkType"]').value, title: row.querySelector('[name="linkTitle"]').value.trim(), url: row.querySelector('[name="linkUrl"]').value.trim() }));
          const fields = datasetFields(values, language, { ...record, ...translations });
          if (published || publish) {
            const problem = publicationLicenseMessage(fields, lang);
            if (problem) {
              document.getElementById("datasetPublication").open = true;
              throw new Error(problem);
            }
          }
          const saved = await saveDataset(id, fields, store.load().user.id, getProfileState().data.organization_id);
          if (!form.isConnected || location.hash !== editorHash) return;
          id = saved.id;
          form.dataset.editorId = id;
          savedDraft = !published;
          history.replaceState(null, "", location.pathname + location.search + "#datasets/edit/" + encodeURIComponent(id));
          editorHash = location.hash;
          if (publish) await setPublicationStatus(id, "published", store.load().user.id);
          if (!form.isConnected || location.hash !== editorHash) return;
          toast(publish ? tr("Dataset published.", "Карточка опубликована.", "Toʻplam eʼlon qilindi.") : tr("Dataset saved.", "Карточка сохранена.", "Toʻplam saqlandi."));
          go(detailHash(id));
        } catch (error) {
          if (!form.isConnected || location.hash !== editorHash) return;
          message.textContent = (savedDraft ? tr("Draft saved. ", "Черновик сохранён. ", "Qoralama saqlandi. ") : "") + (error.code ? databaseMessage(error) : error.message);
          if (publish) document.getElementById("datasetPublication").open = true;
        } finally {
          buttons.forEach(([button, disabled]) => { button.disabled = disabled; });
          form.removeAttribute("aria-busy");
        }
      };
    } catch (error) { if (ticket === revision) failed(error, () => vEditor(id)); }
  }

  async function vDetails(id) {
    const ticket = ++revision;
    if (publicView) document.getElementById("dataset-schema")?.remove();
    loading();
    try {
      const record = await getDataset(id);
      if (ticket !== revision) return;
      if (!record) {
        if (publicView) document.title = tr("Dataset unavailable — CORE", "Карточка недоступна — CORE", "Toʻplam mavjud emas — CORE");
        view.innerHTML = datasetBackLink(lang, store.catalogUrl(lang)) + '<h1>' + tr("Dataset not found or unavailable", "Карточка не найдена или недоступна", "Toʻplam topilmadi yoki mavjud emas") + '</h1>';
        return;
      }
      const userId = store.load().user?.id;
      const owner = Boolean(userId && userId === record.owner_id);
      let profile = getProfileState().data;
      const published = record.publication_status === "published";
      const canonicalUrl = datasetUrl(record, lang);
      if (published && (!publicView || new URL(canonicalUrl).pathname !== location.pathname)) {
        location.replace(canonicalUrl);
        return;
      }
      if (owner && !profile) {
        profile = await getProfile(userId);
        if (ticket !== revision) return;
      }
      const selectedLicense = record.license_info;
      const documentUrl = licenseUrl(selectedLicense) || safeLink(record.license_url);
      const root = new URL("../../../", import.meta.url);
      const restricted = ["metadata-only", "by-agreement"].includes(record.license_id);
      const uniqueLinks = [...new Map((record.links || []).filter(link => safeLink(link.url)).map(link => [safeLink(link.url), link])).values()];
      const materials = uniqueLinks.filter(link => !restricted || link.type !== "data");
      const dataLink = materials.find(link => link.type === "data");
      let packages = [];
      if (["prep", "open"].includes(record.kind)) {
        try {
          const response = await fetch(new URL("app/packages/index.json", root));
          if (!response.ok) throw new Error("Prepared materials unavailable");
          packages = await response.json();
        } catch (error) {
          if (record.kind === "prep") throw error;
        }
        if (ticket !== revision) return;
      }
      const prepared = !restricted && record.kind === "prep" ? packages.find(item => item.slug === record.id) : null;
      const related = record.kind === "open" ? packages.filter(item => item.orig_title === record.title.en || "https://doi.org/" + item.doi === record.source_url) : [];
      const original = prepared ? "https://doi.org/" + prepared.doi : safeLink(record.source_url) || safeLink(materials.find(link => link.type === "source")?.url);
      const org = organizationName(record.organization, lang);
      const orgLink = org && record.organization_id ? '<a href="' + esc(organizationUrl(record.organization_id, lang)) + '">' + esc(org) + '</a>' : esc(org);
      const license = licenseName(selectedLicense, lang) || record.license || tr("License unspecified", "Лицензия не указана", "Litsenziya koʻrsatilmagan");
      const countries = (record.countries || []).map(code => countryName(code, lang)).join(", ");
      const languages = (record.languages || []).map(code => languageName(code, lang)).join(", ");
      const topic = datasetTopicName(record.category, lang);
      const linkTypes = {
        publication: tr("Publication", "Публикация", "Nashr"), code: tr("Code", "Код", "Kod"),
        documentation: tr("Documentation", "Документация", "Hujjatlar"), license: tr("License", "Лицензия", "Litsenziya"),
        terms: tr("Terms", "Условия", "Shartlar"), example: tr("Example of use", "Пример применения", "Qoʻllash misoli"), data: tr("Data files", "Файлы данных", "Maʼlumot fayllari"),
      };
      const list = items => items.length ? '<ul class="dataset-links">' + items.map(link => '<li><a href="' + esc(safeLink(link.url)) + '" target="_blank" rel="noopener">' + esc(link.title && link.title !== "Source" ? link.title : linkTypes[link.type] || sourceLabel(link.url, lang)) + '</a></li>').join("") + '</ul>' : '';
      const request = record.license_id === "by-agreement" || !dataLink && !prepared && !original && record.license_id !== "metadata-only";
      const primary = prepared ? '<a class="sheet-primary" href="' + esc(new URL("app/packages/" + prepared.zip, root).href) + '" download>' + tr("Download package (ZIP)", "Скачать пакет (ZIP)", "Paketni yuklab olish (ZIP)") + '</a>' :
        dataLink ? '<a class="sheet-primary" href="' + esc(safeLink(dataLink.url)) + '" target="_blank" rel="noopener">' + tr("Open data files", "Открыть файлы данных", "Maʼlumot fayllarini ochish") + '</a>' :
        original && record.license_id !== "metadata-only" && record.license_id !== "by-agreement" ? '<a class="sheet-primary" href="' + esc(original) + '" target="_blank" rel="noopener">' + esc(sourceLabel(original, lang)) + ' ↗</a>' :
        '<button type="button" class="sheet-primary" data-sheet-open="access">' + (request ? tr("Request access", "Запросить доступ", "Kirish soʻrovi") : tr("Usage terms", "Условия использования", "Foydalanish shartlari")) + '</button>';
      const sourceInPrimary = original && !dataLink && !prepared && !restricted;
      const sourceLink = original && !sourceInPrimary ? '<p class="sheet-by"><a href="' + esc(original) + '" target="_blank" rel="noopener">' + esc(sourceLabel(original, lang)) + ' ↗</a></p>' : '';
      const info = [
        [tr("Topic", "Тематика", "Mavzu"), topic], [tr("Countries", "Страны данных", "Mamlakatlar"), countries],
        [tr("Data languages", "Языки данных", "Maʼlumotlar tillari"), languages],
        [tr("Version", "Версия данных", "Maʼlumotlar versiyasi"), record.data_version],
        [tr("Formats", "Форматы", "Formatlar"), record.formats],
        [tr("Publication year", "Год публикации", "Nashr yili"), record.publication_year],
      ];
      const passport = sheetMeta(info) + list(materials.filter(link => !["data", "license", "terms", "example"].includes(link.type) && (link.type !== "source" || safeLink(link.url) !== original))) +
        (prepared ? preparedPassport(prepared, lang, false) : '') +
        related.map(item => '<p><a href="' + esc(datasetUrl({ id: item.slug }, lang)) + '">' + tr("Version prepared by CORE", "Версия, подготовленная CORE", "CORE tayyorlagan versiya") + '</a></p>').join("");
      let access = '<p><b>' + esc(license) + '</b></p>' +
        (selectedLicense || local(record.usage_terms) ? '<p class="dataset-description">' + esc(licenseDescription(selectedLicense, lang) || local(record.usage_terms)) + '</p>' : '') +
        (documentUrl ? '<p><a href="' + esc(documentUrl) + '" target="_blank" rel="noopener">' + tr("Read the license", "Полный текст лицензии", "Litsenziyaning toʻliq matni") + '</a></p>' : '') +
        list(materials.filter(link => ["license", "terms"].includes(link.type)));
      if (request) access += '<p>' + tr("Describe your request. The CORE team will contact you about the terms.", "Оставьте обращение. Команда CORE свяжется с вами, чтобы обсудить условия.", "Murojaat qoldiring. CORE jamoasi shartlarni muhokama qilish uchun siz bilan bogʻlanadi.") + '</p>' + quickContactForm(lang, id, "buyer");
      if (prepared) {
        access += '<ul class="dataset-links">' + [
          ["data/" + prepared.file, tr("Data (CSV)", "Данные (CSV)", "Maʼlumotlar (CSV)")],
          ["codebook.csv", tr("Field descriptions (CSV)", "Описание полей (CSV)", "Maydonlar tavsifi (CSV)")],
          ["DATASHEET.md", tr("Datasheet and preparation notes", "Описание набора и подготовки", "Toʻplam va tayyorlash tavsifi")],
          ["LICENSE.txt", tr("License and citation", "Лицензия и цитирование", "Litsenziya va iqtibos")],
        ].map(([path, label]) => '<li><a href="' + esc(new URL("app/packages/" + prepared.slug + "/" + path, root).href) + '" download>' + label + '</a></li>').join("") + '</ul>';
      }
      const tokens = record.token_count == null ? '' : sheetMeta([
        [tr("Token count", "Количество токенов", "Tokenlar soni"), nf(record.token_count)],
        [tr("Tokenizer", "Токенизатор", "Tokenizator"), record.tokenizer],
        [tr("Counting method", "Метод подсчёта", "Hisoblash usuli"), tokenMethodName(record.token_method, lang)],
        [tr("Material counted", "Посчитанный материал", "Hisoblangan material"), record.token_material],
      ]);
      const data = (prepared ? preparedData(prepared, lang) : '') + tokens + list(materials.filter(link => link.type === "example"));
      const api = prepared ? preparedApiExample(prepared, lang) + '<p><a href="' + esc(new URL("app/index.html#demo/" + id, root).href) + '">' + tr("Try API and SQL in the demo", "Попробовать API и SQL в демо", "Namoyishda API va SQLʼni sinash") + '</a></p>' : '';
      const kicker = [prepared && tr("Preparation example", "Пример подготовки", "Tayyorlash misoli"), topic, countries, owner && statusName(record.publication_status)].filter(Boolean).map(esc).join(" · ");
      const editUrl = store.cabinetUrl("#datasets/edit/" + encodeURIComponent(id));
      const back = publicView ? datasetBackLink(lang, store.catalogUrl(lang)) : '<a class="back" href="#datasets">' + tr("My datasets", "Мои датасеты", "Mening toʻplamlarim") + '</a>';
      view.innerHTML = '<div class="sheet-wrap">' + back + datasetSheet({
        eyebrow: kicker ? '<p class="sheet-kicker">' + kicker + '</p>' : '',
        title: esc(local(record.title)),
        description: local(record.description) ? '<p class="sheet-intro">' + esc(local(record.description)) + '</p>' : '',
        source: (orgLink ? '<p class="sheet-by">' + orgLink + (prepared ? ' · ' + tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan") : '') + '</p>' : '') + sourceLink,
        facts: sheetFacts([record.record_count == null ? null : nf(record.record_count) + " " + recordUnit(record.record_count, lang), record.formats, license]),
        actions: '<div class="sheet-actions">' + primary + '</div>',
        data: sheetSection("data", data, lang),
        passport: sheetSection("passport", passport, lang),
        access: sheetSection("access", access, lang),
        api: sheetSection("api", api, lang),
        usage: '<div id="recordUsage" aria-live="polite"></div>',
      }) +
        (owner ? '<div class="public-dataset-tools"><a class="btn btn-ghost" href="' + esc(editUrl) + '">' + tr("Edit", "Редактировать", "Tahrirlash") + '</a><button type="button" class="btn btn-primary" id="publishDataset"' + (!published && !profile?.is_verified ? ' disabled' : '') + '>' + (published ? tr("Unpublish", "Снять с публикации", "Nashrdan olish") : tr("Publish", "Опубликовать", "Eʼlon qilish")) + '</button></div><p id="publicationMessage" class="auth-message" role="status"></p>' : '') +
        '<section class="dataset-contact" data-guest-only' + (userId ? ' hidden' : '') + '><details class="quick-contact"><summary class="btn btn-ghost">' + tr("Join CORE", "Подключиться", "Qoʻshilish") + '</summary>' + quickContactForm(lang, id) + '</details></section></div>';
      if (publicView) {
        document.title = local(record.title) + " — CORE";
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = datasetUrl(record, lang);
        if (published) {
          const schema = document.createElement("script");
          schema.id = "dataset-schema";
          schema.type = "application/ld+json";
          schema.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Dataset", identifier: id, name: local(record.title), description: local(record.description), url: datasetUrl(record, lang), ...(documentUrl ? { license: documentUrl } : {}) });
          document.head.append(schema);
        }
      }
      wireSheetActions(view);
      bindContactForms(view, lang);
      if (owner) document.getElementById("publishDataset").onclick = async event => {
        const problem = !published && publicationLicenseMessage(record, lang);
        if (problem) {
          document.getElementById("publicationMessage").innerHTML = esc(problem) + ' <a href="' + esc(editUrl + "/publication") + '">' + tr("Edit publication terms", "Изменить условия публикации", "Nashr shartlarini oʻzgartirish") + '</a>';
          return;
        }
        event.currentTarget.disabled = true;
        try {
          await setPublicationStatus(id, published ? "unpublished" : "published", store.load().user.id);
          toast(published ? tr("Dataset unpublished.", "Карточка снята с публикации.", "Toʻplam nashrdan olindi.") : tr("Dataset published.", "Карточка опубликована.", "Toʻplam eʼlon qilindi."));
          vDetails(id);
        } catch (error) {
          document.getElementById("publicationMessage").textContent = databaseMessage(error);
          event.currentTarget.disabled = false;
        }
      };
      const usageBox = document.getElementById("recordUsage");
      async function loadUsage() {
        try {
          const usage = await fetchDatasetUsage(id);
          if (ticket !== revision || !usageBox.isConnected) return;
          usageBox.innerHTML = renderDatasetUsage(usage, lang);
        } catch {
          if (ticket !== revision || !usageBox.isConnected) return;
          usageBox.innerHTML = '<button type="button" class="btn btn-ghost btn-sm">' + tr("Retry loading examples of use", "Повторить загрузку примеров использования", "Foydalanish misollarini qayta yuklash") + '</button>';
          usageBox.querySelector("button").onclick = loadUsage;
        }
      }
      loadUsage();
    } catch (error) { if (ticket === revision) failed(error, () => vDetails(id)); }
  }
  return { vList, vEditor, vDetails, cancel: () => { revision++; } };
}
