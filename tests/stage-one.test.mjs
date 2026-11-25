import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
async function moduleAt(relative, globals = {}) {
  const context = vm.createContext({ URL, setTimeout, clearTimeout, AbortController, window: {}, ...globals });
  const cache = new Map();
  function create(filename) {
    if (!cache.has(filename)) cache.set(filename, new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), { context, identifier: filename, initializeImportMeta(meta) { meta.url = pathToFileURL(filename).href; } }));
    return cache.get(filename);
  }
  const entry = create(path.join(root, relative));
  await entry.link((specifier, referencing) => create(fileURLToPath(new URL(specifier, pathToFileURL(referencing.identifier)))));
  await entry.evaluate();
  return entry.namespace;
}

test("catalog pagination follows actual rows returned when the server caps the page size", async () => {
  const source = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }], calls = [];
  const client = { from: () => ({ select: () => ({ range: async start => { calls.push(start); return { data: source.slice(start, start + 2), count: source.length, error: null }; } }) }) };
  const api = await moduleAt("assets/js/api/query.js", { window: { CORE_CONFIG: { supabase: { url: "https://example.test", publishableKey: "sb_publishable_test" } } }, supabase: { createClient: () => client } });
  const result = await api.allRows("datasets");
  assert.deepEqual(Array.from(result, row => row.id), [1, 2, 3, 4, 5]);
  assert.deepEqual(calls, [0, 2, 4]);
});

test("contact requests retain arbitrary contacts and a lost-response retry creates one row", async () => {
  const saved = new Map();
  let failure;
  const client = { from: table => {
    assert.equal(table, "contact_requests");
    return { insert: async row => {
      if (failure) return { error: failure };
      if (saved.has(row.id)) return { error: { code: "23505" } };
      saved.set(row.id, JSON.parse(JSON.stringify(row)));
      return { error: null };
    } };
  } };
  const api = await moduleAt("assets/js/api/contact-requests.js", { window: { CORE_CONFIG: { supabase: { url: "https://example.test", publishableKey: "sb_publishable_test" } } }, supabase: { createClient: () => client } });
  const values = { name: " Person ", contact: " @telegram-name ", consent: "on", page_url: "https://example.test/ru/", language: "ru" };
  await api.sendContactRequest(values, "same-retry-id");
  await api.sendContactRequest(values, "same-retry-id");
  assert.equal(saved.size, 1);
  assert.equal(saved.get("same-retry-id").contact, "@telegram-name");
  assert.equal(saved.get("same-retry-id").consent, true);
  await api.sendContactRequest({ ...values, contact: "", email: "person@example.test", form_variant: "detailed", org: "University", type: "university", dataset_id: "dataset-id" }, "detailed-id");
  assert.equal(saved.get("detailed-id").contact, "person@example.test");
  assert.equal(saved.get("detailed-id").dataset_id, "dataset-id");
  assert.equal(saved.get("detailed-id").details.org, "University");
  failure = { code: "42501" };
  await assert.rejects(api.sendContactRequest(values, "new-id"), error => error.code === "42501");
});

test("record labels agree with the count and dataset topics use the page language", async () => {
  const labels = await moduleAt("assets/js/ui/data-labels.js");
  for (const [count, word] of [[1, "запись"], [2, "записи"], [5, "записей"], [11, "записей"], [21, "запись"], [112, "записей"], [2982, "записи"]]) {
    assert.equal(labels.recordUnit(count, "ru"), word);
  }
  assert.equal(labels.recordUnit(1, "en"), "record");
  assert.equal(labels.recordUnit(21, "en"), "records");
  assert.equal(labels.recordUnit(3, "uz"), "yozuv");
  assert.equal(labels.datasetTopicName("Language and knowledge", "ru"), "Язык и знания");
  assert.equal(labels.datasetTopicName("Sociology and finance", "uz"), "Sotsiologiya va moliya");
});

test("an incomplete response cannot silently shorten the catalog", async () => {
  const client = { from: () => ({ select: () => ({ range: async () => ({ data: [], count: 3, error: null }) }) }) };
  const api = await moduleAt("assets/js/api/query.js", { window: { CORE_CONFIG: { supabase: { url: "https://example.test", publishableKey: "sb_publishable_test" } } }, supabase: { createClient: () => client } });
  await assert.rejects(api.allRows("datasets"), /Incomplete database response/);
});

test("dataset edits retain other languages and distinguish unknown counts from zero", async () => {
  const api = await moduleAt("assets/js/api/datasets.js");
  const fields = api.datasetFields({ title: "Название", description: "Описание", countries: "uz, KZ", record_count: "0", token_count: "", links: [{ type: "source", title: "Источник", url: "https://example.org/data" }] }, "ru", { title: { en: "Existing title" }, description: { en: "Existing description" } });
  assert.equal(fields.title.en, "Existing title");
  assert.equal(fields.title.ru, "Название");
  assert.equal(fields.record_count, 0);
  assert.equal(fields.token_count, null);
  assert.deepEqual(Array.from(fields.countries), ["UZ", "KZ"]);
  assert.equal(fields.links[0].url, "https://example.org/data");
});

test("a short draft needs only a title and description and keeps omitted saved details", async () => {
  const api = await moduleAt("assets/js/api/datasets.js");
  const minimal = api.datasetFields({ title: "Название", description: "Описание" });
  assert.equal(minimal.license_id, null);
  assert.equal(minimal.token_count, null);

  const original = {
    title: { ru: "Прежнее название", en: "Existing title" }, description: { ru: "Описание", uz: "Tavsif" },
    category: "Research", countries: ["UZ", "KZ"], languages: ["uz", "ru"], record_count: 0,
    links: [{ type: "source", title: "Источник", url: "https://example.org/data" }], license_id: "metadata-only",
    token_count: 125, tokenizer: "example@1", token_method: "calculated", token_material: "text", data_version: "1"
  };
  const edited = api.datasetFields({ title: "Новое название", description: "Новое описание" }, "ru", original);
  assert.equal(edited.title.ru, "Новое название");
  assert.equal(edited.title.en, "Existing title");
  assert.equal(edited.description.uz, "Tavsif");
  for (const key of ["category", "countries", "languages", "record_count", "links", "license_id", "token_count", "tokenizer", "token_method", "token_material", "data_version"]) {
    assert.deepEqual(JSON.parse(JSON.stringify(edited[key])), original[key], key);
  }

  const cleared = api.datasetFields({ title: "Название", description: "Описание", category: "", countries: "", languages: "", record_count: "", links: [], license_id: "" }, "ru", original);
  assert.equal(cleared.category, "");
  assert.equal(cleared.countries.length, 0);
  assert.equal(cleared.languages.length, 0);
  assert.equal(cleared.record_count, null);
  assert.equal(cleared.links.length, 0);
  assert.equal(cleared.license_id, null);
  assert.equal(cleared.token_count, 125);
});

test("a token count for an earlier data version is cleared when the version changes", async () => {
  const api = await moduleAt("assets/js/api/datasets.js");
  const fields = api.datasetFields({ title: "Dataset", description: "Description", data_version: "2" }, "en", {
    token_count: 0, tokenizer: "example@1", token_method: "calculated", token_material: "text", data_version: "1"
  });
  assert.equal(fields.data_version, "2");
  for (const key of ["token_count", "tokenizer", "token_method", "token_material"]) assert.equal(fields[key], null);
});

test("a delayed dataset usage response leaves a replaced screen alone", async () => {
  let finishUsage;
  const usageResponse = new Promise(resolve => { finishUsage = resolve; });
  const usageBox = { isConnected: true, innerHTML: "" };
  const view = { innerHTML: "", querySelectorAll: () => [] };
  const record = { id: "DS-test", kind: "dataset", title: { ru: "Название" }, description: { ru: "Описание" }, links: [] };
  const client = { from: () => ({
    select() { return this; }, eq() { return this; }, order() { return this; },
    maybeSingle: async () => ({ data: record, error: null }),
    range: () => usageResponse
  }) };
  const page = await moduleAt("assets/js/pages/dataset-records.js", {
    URLSearchParams, location: { search: "" },
    window: { CORE_CONFIG: { supabase: { url: "https://example.test", publishableKey: "sb_publishable_test" } } },
    supabase: { createClient: () => client },
    document: { getElementById: id => id === "dataset-card-template"
      ? { innerHTML: "{{title}}{{usage}}" }
      : usageBox.isConnected ? usageBox : null }
  });
  const records = page.createDatasetRecords({
    view, store: { load: () => ({ user: null }), catalogUrl: () => "catalog.html" },
    go: () => {}, getProfileState: () => ({ data: null })
  });
  await records.vDetails(record.id);
  usageBox.isConnected = false;
  view.innerHTML = "Another screen";
  finishUsage({ data: [], error: null, count: 0 });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(view.innerHTML, "Another screen");
  assert.equal(usageBox.innerHTML, "");
});

test("token claims require a method, tokenizer, material and version; executable links are rejected", async () => {
  const api = await moduleAt("assets/js/api/datasets.js");
  const base = { title: "Dataset", description: "Description", token_count: "0" };
  assert.throws(() => api.datasetFields(base), /токенизатор/);
  const fields = api.datasetFields({ ...base, tokenizer: "example@1", token_method: "calculated", token_material: "Text column", data_version: "1" });
  assert.equal(fields.token_count, 0);
  assert.throws(() => api.datasetFields({ title: "Dataset", description: "Description", links: [{ url: "javascript:alert(1)" }] }), /https/);
  assert.throws(() => api.datasetFields({ title: "Dataset", description: "Description", record_count: "-1" }), /неотрицательное/);
});

test("one consumer using metadata and data is counted once and demo evidence stays marked", async () => {
  const api = await moduleAt("assets/js/ui/dataset-usage.js");
  const consumer = { id: "one", type: "agent", name: { ru: "<Помощник>" }, url: "javascript:alert(1)", is_demo: true };
  const rows = ["metadata", "data"].map(usage_scope => ({ consumer_id: "one", consumer, usage_scope, purpose: { ru: "Проверка" }, is_demo: true }));
  assert.equal(api.groupUsage(rows).length, 1);
  const html = api.renderDatasetUsage(rows, "ru", true);
  assert.match(html, /Кто использует данные: 1/);
  assert.match(html, /Метаданные/);
  assert.match(html, /Содержимое/);
  assert.match(html, /Демо/);
  assert.match(html, /&lt;Помощник&gt;/);
  assert(!html.includes("javascript:"));
});

test("dataset writes use the selected license ID without copying editable license terms", async () => {
  const api = await moduleAt("assets/js/api/datasets.js");
  const fields = api.datasetFields({ title: "Dataset", description: "Description", license_id: "by-agreement", license: "Uncontrolled text", license_url: "https://example.org/other", usage_terms: "Different terms" });
  assert.equal(fields.license_id, "by-agreement");
  for (const key of ["license", "license_url", "usage_terms"]) assert.equal(Object.hasOwn(fields, key), false);
});

test("license publication rules distinguish data files from examples of application", async () => {
  const api = await moduleAt("assets/js/api/licenses.js");
  assert.match(api.publicationLicenseMessage({}), /Выберите лицензию/);
  for (const license_id of ["metadata-only", "by-agreement"]) {
    assert.equal(api.publicationLicenseMessage({ license_id, links: [{ type: "example", url: "https://example.org/research" }] }), "");
    assert.match(api.publicationLicenseMessage({ license_id, links: [{ type: "data", url: "https://example.org/data.csv" }] }), /файлы данных/);
  }
  assert.equal(api.publicationLicenseMessage({ license_id: "open-cc-by-4-0", links: [{ type: "data" }] }), "");
});

test("license labels are localized and full texts resolve only to installed documents", async () => {
  const api = await moduleAt("assets/js/api/licenses.js");
  const license = { name: { ru: "Только метаданные", en: "Metadata only", uz: "Faqat metamaʼlumotlar" }, document_path: "documents/metadata-only.html" };
  assert.equal(api.licenseName(license, "en"), "Metadata only");
  assert.equal(api.licenseName(license, "ru"), "Только метаданные");
  assert.match(api.licenseUrl(license), /\/documents\/metadata-only\.html$/);
  assert.equal(api.licenseUrl({ document_path: "https://example.org/other" }), "");
  assert.equal(api.licenseUrl({ document_path: "documents/../private.html" }), "");
});
