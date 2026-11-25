import { getAccountStore, initAuth } from "./js/api/auth.js";
import { getDataset } from "./js/api/datasets.js";
import { getProfile } from "./js/api/profiles.js";
import { createDatasetRecords } from "./js/pages/dataset-records.js";
import { datasetUrl } from "./js/url.js";
import { datasetBackLink } from "./js/ui/navigation.js";
import { esc } from "./js/ui/format.js";
import { mountQuickContacts } from "./js/ui/contact-form.js";

const lang = document.documentElement.dataset.staticLang || "ru";
const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
const store = getAccountStore();
const container = document.getElementById("publicDataset");
const id = container ? container.dataset.datasetId || new URLSearchParams(location.search).get("id") : document.body.dataset.datasetId;
if (container && id) {
  for (const link of document.querySelectorAll(".lang a[data-lang]")) link.href = datasetUrl({ id }, link.dataset.lang);
}
let profile = { userId: null, data: null };
const records = container && createDatasetRecords({
  view: container, store, language: lang, publicView: true,
  go: hash => { location.href = store.cabinetUrl(hash); },
  getProfileState: () => profile,
});

function favoriteControl(target) {
  target.querySelector('[data-favorite-tools]')?.remove();
  const user = store.load().user;
  if (!id || user?.role === "university") return;
  const saved = store.favoriteIds().includes(id);
  const tools = document.createElement("div");
  tools.className = "public-dataset-tools";
  tools.setAttribute("data-favorite-tools", "");
  tools.innerHTML = '<button class="favorite-button" type="button" aria-pressed="' + saved + '">' + (saved ? tr("Saved", "В избранном", "Saralanganlarda") : tr("Save dataset", "В избранное", "Saralanganlarga")) + '</button>';
  target.querySelector(".sheet-actions")?.append(tools);
  const button = tools.querySelector("button");
  button.onclick = () => {
    if (!store.toggleFavorite(id)) { location.href = store.cabinetUrl("#login/favorite/" + encodeURIComponent(id)); return; }
    const active = store.favoriteIds().includes(id);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? tr("Saved", "В избранном", "Saralanganlarda") : tr("Save dataset", "В избранное", "Saralanganlarga");
  };
}

async function render() {
  if (!id) {
    container.innerHTML = '<h1>' + tr("Choose a dataset", "Выберите набор в каталоге", "Katalogdan toʻplamni tanlang") + '</h1>' + datasetBackLink(lang, store.catalogUrl(lang));
    return;
  }
  if (container) {
    await records.vDetails(id);
    favoriteControl(container);
    const title = container.querySelector("h1")?.textContent;
    for (const link of document.querySelectorAll(".lang a[data-lang]")) link.href = datasetUrl({ id }, link.dataset.lang);
    if (title) document.querySelector('meta[name="description"]')?.setAttribute("content", container.querySelector(".sheet-intro")?.textContent || title);
    return;
  }
  const main = document.querySelector("main");
  try {
    const record = await getDataset(id);
    if (!record || record.publication_status !== "published") {
      main.innerHTML = '<section class="sec sec-first"><div class="wrap">' + datasetBackLink(lang, store.catalogUrl(lang)) + '<h1>' + tr("Dataset not found or unavailable", "Карточка не найдена или недоступна", "Toʻplam topilmadi yoki mavjud emas") + '</h1></div></section>';
    } else {
      if (record.license_id) {
        main.innerHTML = '<section class="sec sec-first"><div class="wrap" id="liveDataset"></div></section>';
        const liveView = main.querySelector("#liveDataset");
        await createDatasetRecords({ view: liveView, store, language: lang, publicView: true, go: hash => { location.href = store.cabinetUrl(hash); }, getProfileState: () => profile }).vDetails(id);
        main.hidden = false;
        document.getElementById("datasetLoading")?.remove();
        favoriteControl(liveView);
        return;
      }
      const crumbs = main.querySelector(".crumbs");
      if (crumbs) crumbs.innerHTML = datasetBackLink(lang, store.catalogUrl(lang));
      else main.querySelector(".dataset-sheet")?.insertAdjacentHTML("beforebegin", datasetBackLink(lang, store.catalogUrl(lang)));
      const local = value => value?.[lang] || value?.ru || value?.en || "";
      const title = main.querySelector("h1");
      if (title) title.textContent = local(record.title);
      const intro = main.querySelector(".sheet-intro");
      if (intro && local(record.description)) intro.textContent = local(record.description);
      favoriteControl(main);
      if (!main.querySelector(".dataset-contact")) main.insertAdjacentHTML("beforeend", '<div class="wrap"><section class="dataset-contact sheet-wrap" data-guest-only><details class="quick-contact"><summary class="btn btn-ghost">' + tr("Join CORE", "Подключиться", "Qoʻshilish") + '</summary><div data-quick-contact data-dataset-id="' + esc(id) + '"></div></details></section></div>');
      mountQuickContacts(main, lang);
      document.dispatchEvent(new Event("core:quick-contact"));
    }
    main.hidden = false;
    document.getElementById("datasetLoading")?.remove();
    window.dispatchEvent(new Event("resize"));
  } catch {
    main.hidden = false;
    main.innerHTML = '<section class="sec sec-first"><div class="wrap"><p role="alert">' + tr("Could not check the dataset. Please try again.", "Не удалось загрузить карточку. Попробуйте ещё раз.", "Toʻplamni yuklab boʻlmadi. Qayta urinib koʻring.") + '</p><button type="button" class="btn btn-ghost">' + tr("Retry", "Повторить", "Qayta urinish") + '</button></div></section>';
    main.querySelector("button").onclick = () => location.reload();
    document.getElementById("datasetLoading")?.remove();
  }
}

let userId = store.load().user?.id || null;
window.addEventListener("core:account", () => {
  const current = store.load().user?.id || null;
  if (current === userId) return;
  userId = current;
  profile = { userId, data: null };
  if (userId) getProfile(userId).then(data => { if (userId === current) { profile.data = data; render(); } }).catch(() => render());
  else render();
});
render();
initAuth().catch(() => {});
window.addEventListener("pageshow", event => { if (event.persisted) render(); });
