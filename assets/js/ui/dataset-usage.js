import { esc } from "./format.js";
import { safeLink } from "../url.js";

export function groupUsage(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.consumer) continue;
    if (!groups.has(row.consumer_id)) groups.set(row.consumer_id, { consumer: row.consumer, rows: [], isDemo: !!row.consumer.is_demo });
    const group = groups.get(row.consumer_id);
    group.rows.push(row); group.isDemo ||= !!row.is_demo;
  }
  return [...groups.values()];
}

export function renderDatasetUsage(rows, lang = "ru", compact = false) {
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  const local = value => value?.[lang] || value?.ru || value?.en || "";
  const groups = groupUsage(rows);
  const type = {
    research: tr("Research", "Исследование", "Tadqiqot"), digest: tr("Digest", "Дайджест", "Sharh"),
    catalog: tr("Catalog", "Каталог", "Katalog"), analytics: tr("Analytics", "Аналитика", "Tahlil"),
    application: tr("Application", "Прикладной сервис", "Amaliy xizmat"), model: tr("Model training or evaluation", "Обучение или проверка модели", "Modelni oʻqitish yoki baholash"),
    agent: tr("Assistant", "Ассистент", "Yordamchi"),
  };
  const empty = '<p class="small muted">' + tr("Information about use has not been added yet.", "Сведения об использовании пока не добавлены.", "Foydalanish haqida maʼlumot hali qoʻshilmagan.") + '</p>';
  const body = groups.map(group => {
    const consumer = group.consumer, url = safeLink(consumer.url);
    const name = esc(local(consumer.name));
    const organization = consumer.organization;
    const scopes = [...new Set(group.rows.map(row => row.usage_scope))].map(scope => scope === "data" ? tr("Data", "Содержимое", "Maʼlumotlar") : tr("Metadata", "Метаданные", "Metamaʼlumotlar"));
    const purposes = [...new Set(group.rows.map(row => local(row.purpose)).filter(Boolean))];
    const results = [...new Set(group.rows.map(row => safeLink(row.result_url)).filter(Boolean))];
    return '<li><div class="usage-title">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + name + '</a>' : '<b>' + name + '</b>') +
      (group.isDemo ? '<span class="usage-demo">' + tr("Demo", "Демо", "Namoyish") + '</span>' : '') + '</div><p class="small muted">' +
      [type[consumer.type], organization && (organization['name_' + lang] || organization.name), scopes.join(" + ")].filter(Boolean).map(esc).join(" · ") + '</p>' +
      purposes.map(purpose => '<p class="small">' + esc(purpose) + '</p>').join("") +
      results.map(result => '<a class="small" href="' + esc(result) + '" target="_blank" rel="noopener">' + tr("Result", "Результат", "Natija") + '</a>').join(" ") + '</li>';
  }).join("");
  const detail = groups.length ? '<ul class="usage-list">' + body + '</ul>' : empty;
  if (!compact) return groups.length ? '<details class="sheet-section dataset-usage"><summary>' + tr("Where the data is used", "Где используется", "Qayerda ishlatiladi") + '</summary><div class="sheet-body">' + detail + '</div></details>' : "";
  return '<details class="usage-compact"><summary>' + tr("Who uses the data", "Кто использует данные", "Maʼlumotlardan kim foydalanadi") + ': ' + groups.length +
    (groups.length ? ' · ' + groups.slice(0, 2).map(group => esc(local(group.consumer.name))).join(", ") : '') + '</summary>' + detail + '</details>';
}
