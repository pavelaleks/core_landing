/* Public fixtures only. No Auth accounts, credentials or private profiles. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const context = { window: {} };
for (const name of ["assets/catalog-index.js", "assets/graph.js"]) vm.runInNewContext(fs.readFileSync(path.join(root, name), "utf8"), context);
const universities = json("api/v0/universities.json").universities;
const organizations = universities.map(u => ({
  id: u.id, type: "university", name: u.name, name_ru: u.name_ru, name_en: u.name_en,
  name_uz: u.country === "UZ" ? u.name_national : null, country: u.country, website: u.website,
  external_ids: { ror: u.ror, wikidata: u.wikidata, openalex: u.openalex }, is_verified: true,
}));
organizations.push({ id: "ORG-CORE", type: "company", name: "CORE", name_ru: "CORE", name_en: "CORE", is_verified: true });
const universityIds = new Set(universities.map(u => u.id));
const graph = new Map();
for (const row of context.window.CORE_GRAPH.datasets) {
  const key = row[1] + "|" + row[3];
  if (graph.has(key)) throw new Error("Ambiguous existing university mapping: " + key);
  graph.set(key, row[0]);
}
const packageUniversities = { "uzbek-geography-terms": "UNI-UZ-0180", "insurance-literacy-syrdarya": "UNI-UZ-0017", "covid-almaty-cohort": "UNI-KZ-0094" };
const base = new Map(json("data-src/catalog.json").datasets.map(d => [d.id, d]));
const datasets = context.window.CORE_CATALOG.filter(item => ["base", "prep", "open", "layer"].includes(item.t)).map(item => {
  const organizationId = item.t === "open" ? graph.get(item.title.en.slice(0, 140) + "|" + item.y) : packageUniversities[item.id] || "ORG-CORE";
  if (!organizationId || (organizationId !== "ORG-CORE" && !universityIds.has(organizationId))) throw new Error("Missing organization: " + item.id);
  const original = base.get(item.id);
  return {
    id: item.id, organization_id: organizationId, kind: item.t,
    title: item.title, description: item.desc || {}, category: item.f || "",
    countries: (item.c || "").split(/;\s*/).filter(Boolean), languages: original?.languages || [],
    license: item.lic || "", links: /^https?:/.test(item.href) ? [{ type: "source", title: "Source", url: item.href }] : [],
    record_count: item.n ?? null, data_version: original?.version || null,
    publication_status: "published", access_type: item.st, source_url: item.href,
    formats: item.fm || null, publication_year: item.y || null, mentions_central_asia: !!item.ca,
  };
});
const translated = (en, ru, uz) => ({ en, ru, uz });
const consumers = [
  { id: "CON-DEMO-DIGEST", name: translated("Central Asian language resources review", "Обзор языковых ресурсов ЦА", "Markaziy Osiyo til resurslari sharhi"), type: "digest", is_demo: true },
  { id: "CON-DEMO-DICTIONARY", name: translated("Educational geography dictionary", "Учебный словарь географии", "Oʻquv geografiya lugʻati"), type: "application", is_demo: true },
  { id: "CON-DEMO-EVALUATION", name: translated("Uzbek translation evaluation", "Оценка узбекского перевода", "Oʻzbekcha tarjimani baholash"), type: "model", is_demo: true },
  { id: "CON-DEMO-ASSISTANT", name: translated("Teacher's assistant", "Помощник преподавателя", "Oʻqituvchi yordamchisi"), type: "agent", is_demo: true },
];
const purpose = {
  digest: translated("Include the dataset in a thematic overview.", "Включить набор в тематический обзор.", "Toʻplamni mavzuli sharhga kiritish."),
  dictionary: translated("Show terms and translations in a learning service.", "Показывать термины и переводы в учебном сервисе.", "Oʻquv xizmatida terminlar va tarjimalarni koʻrsatish."),
  evaluation: translated("Evaluate translation quality on the terminology.", "Проверять качество перевода терминологии.", "Terminologiya tarjimasi sifatini baholash."),
  assistant: translated("Answer questions with references to the dataset.", "Отвечать на вопросы со ссылкой на набор.", "Toʻplamga havola bilan savollarga javob berish."),
};
const usage = [
  ["uzbek-geography-terms", "CON-DEMO-DIGEST", "metadata", purpose.digest],
  ["uzbek-geography-terms", "CON-DEMO-DICTIONARY", "metadata", purpose.dictionary],
  ["uzbek-geography-terms", "CON-DEMO-DICTIONARY", "data", purpose.dictionary],
  ["uzbek-geography-terms", "CON-DEMO-EVALUATION", "data", purpose.evaluation],
  ["uzbek-geography-terms", "CON-DEMO-ASSISTANT", "data", purpose.assistant],
  [datasets.find(d => d.kind === "open").id, "CON-DEMO-DIGEST", "metadata", purpose.digest],
].map(([dataset_id, consumer_id, usage_scope, purpose]) => ({ dataset_id, consumer_id, usage_scope, purpose, is_demo: true }));

function insert(table, rows) {
  const columns = [...new Set(rows.flatMap(Object.keys))];
  const payload = JSON.stringify(rows).replaceAll("'", "''");
  return `insert into public.${table} (${columns.join(",")}) select ${columns.map(c => "r." + c).join(",")} from jsonb_populate_recordset(null::public.${table}, '${payload}'::jsonb) r on conflict do nothing;\n`;
}
// jsonb_populate_recordset supplies NULL for absent columns: include required defaults.
for (const row of organizations) Object.assign(row, { external_ids: row.external_ids || {} });
for (const row of consumers) Object.assign(row, { description: {} });
const sql = "-- Generated from existing public snapshots. Re-run: node tools/prepare_supabase_seed.mjs\n" +
  insert("organizations", organizations) + insert("datasets", datasets) + insert("consumers", consumers) + insert("dataset_usage", usage);
fs.mkdirSync(path.join(root, "supabase"), { recursive: true });
fs.writeFileSync(path.join(root, "supabase/seed.sql"), sql);
console.log(JSON.stringify({ universities: universities.length, organizations: organizations.length, datasets: datasets.length, consumers: consumers.length, usage: usage.length, sqlBytes: Buffer.byteLength(sql) }));
