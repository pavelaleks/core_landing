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
