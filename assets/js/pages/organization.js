import { getOrganization, organizationName, organizationUrl } from "../api/organizations.js";
import { fetchCatalog, safeLink } from "../api/datasets.js";
import { createCatalogCard } from "../ui/catalog-card.js";
import { countryName, datasetTopicName } from "../ui/data-labels.js";
import { esc } from "../ui/format.js";

export async function initOrganization({ symbolsUrl }) {
  const root = document.getElementById("organization");
  if (!root) return;
  const lang = document.documentElement.dataset.staticLang || "en";
  const tr = (en, ru, uz) => lang === "ru" ? ru : lang === "uz" ? uz : en;
  const local = value => value?.[lang] || value?.ru || value?.en || value?.uz || "";
  const nf = value => Number(value).toLocaleString(lang === "en" ? "en-US" : lang === "uz" ? "uz-UZ" : "ru-RU");
  const id = new URLSearchParams(location.search).get("id");
  for (const link of document.querySelectorAll(".lang a[data-lang]")) {
    const url = new URL(link.href);
    if (id) url.searchParams.set("id", id);
    link.href = url.href;
  }
  const back = '<a class="campus-text-link" href="catalog.html">' + tr("All datasets", "Все датасеты", "Barcha toʻplamlar") + '</a>';
  if (!id) {
    root.innerHTML = '<h1>' + tr("Choose an organization in the catalog", "Выберите организацию в каталоге", "Katalogdan tashkilotni tanlang") + '</h1>' + back;
    return;
  }
  root.innerHTML = '<p class="lead" role="status">' + tr("Loading the organization…", "Загружаем организацию…", "Tashkilot yuklanmoqda…") + '</p>';
  try {
    const [organization, catalog] = await Promise.all([getOrganization(id), fetchCatalog()]);
    if (!organization) {
      root.innerHTML = '<h1>' + tr("Organization not found", "Организация не найдена", "Tashkilot topilmadi") + '</h1>' + back;
      return;
    }
    const own = catalog.filter(item => item.organizationId === id);
    const prepared = id === "ORG-CORE" ? catalog.filter(item => item.t === "prep" && item.organizationId !== id) : [];
    const rows = own.concat(prepared);
    const name = organizationName(organization, lang);
    const website = safeLink(organization.website);
    const fieldName = value => datasetTopicName(value, lang);
    const card = createCatalogCard({ lang, L: local, tr, esc, nf, fieldName, account: null, symbolsUrl });
    const groups = [
      [id === "ORG-CORE" ? tr("CORE datasets", "Датасеты CORE", "CORE toʻplamlari") : tr("Published datasets", "Опубликованные датасеты", "Eʼlon qilingan toʻplamlar"), own.filter(item => item.t !== "open" && item.t !== "prep")],
      [tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan"), own.filter(item => item.t === "prep").concat(prepared)],
      [tr("Found in external sources", "Найдено во внешних источниках", "Tashqi manbalardan topilgan"), own.filter(item => item.t === "open")]
    ];
    document.title = name + " — CORE";
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = organizationUrl(id, lang);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", document.title);
    document.querySelector('meta[property="og:url"]')?.setAttribute("content", organizationUrl(id, lang));
    root.innerHTML = back + '<header class="organization-heading"><div><p class="campus-label">' +
      tr(organization.type === "university" ? "University" : "Company", organization.type === "university" ? "Университет" : "Компания", organization.type === "university" ? "Universitet" : "Kompaniya") +
      '</p><h1>' + esc(name) + '</h1><div class="organization-meta">' +
      (organization.country ? '<span>' + esc(countryName(organization.country, lang)) + '</span>' : '') +
      (website ? '<a href="' + esc(website) + '" target="_blank" rel="noopener">' + tr("Website", "Сайт", "Sayt") + ' ↗</a>' : '') +
      '</div></div><div class="organization-total"><b>' + nf(rows.length) + '</b><span>' + tr("Datasets", "Датасеты", "Toʻplamlar") + '</span></div></header>' +
      (rows.length ? groups.filter(([, items]) => items.length).map(([title, items]) =>
        '<section class="organization-datasets"><div class="organization-section-heading"><h2>' + title + '</h2><span>' + nf(items.length) + '</span></div><div class="cat-list">' +
        items.map(item => card(item, null, [])).join("") + '</div></section>').join("")
        : '<p class="organization-empty">' + tr("No published datasets yet.", "Опубликованных датасетов пока нет.", "Hozircha eʼlon qilingan toʻplamlar yoʻq.") + '</p>');
  } catch (error) {
    root.innerHTML = '<h1>' + tr("Could not load the organization", "Не удалось загрузить организацию", "Tashkilotni yuklab boʻlmadi") +
      '</h1><p role="alert">' + tr("Check your connection and try again.", "Проверьте соединение и попробуйте снова.", "Ulanishni tekshirib, qayta urinib koʻring.") +
      '</p><button class="btn btn-primary" id="retryOrganization">' + tr("Retry", "Повторить", "Qayta urinish") + '</button>';
    document.getElementById("retryOrganization").onclick = () => initOrganization({ symbolsUrl });
  }
}
