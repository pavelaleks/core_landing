import { getSupabaseClient } from "./supabase-client.js";
import { allRows } from "./query.js";
import { safeLink } from "../url.js";
import { LICENSE_COLUMNS } from "./licenses.js";
export { safeLink } from "../url.js";

/* The synchronous getter remains for existing demo and favorites consumers. */
const rootUrl = new URL("../../../", import.meta.url);
const appUrl = value => new URL("app/" + value, rootUrl).href;

export function getCatalog() { return window.CORE_CATALOG; }
export function getUniversityAliases() { return window.CORE_UNI_ALT || {}; }
export function apiBase() { return appUrl("api/v1/"); }

const recordColumns = "*,organization:organizations(id,type,name,name_ru,name_en,name_uz,country),license_info:licenses(" + LICENSE_COLUMNS + ")";

export function toCatalogItem(record) {
  const organization = record.organization || {};
  return {
    id: record.id, t: record.kind, title: record.title, desc: record.description,
    org: { en: organization.name_en || organization.name || "", ru: organization.name_ru || organization.name || "", uz: organization.name_uz || organization.name || "" },
    organizationId: record.organization_id, c: (record.countries || []).join(";"), f: record.category,
    lic: record.license, license: record.license_info || null, st: record.access_type, n: record.record_count, y: record.publication_year,
    href: record.source_url || "app/index.html#dataset/" + encodeURIComponent(record.id),
    fm: record.formats, ca: record.mentions_central_asia ? 1 : 0,
    tokens: record.token_count, tokenizer: record.tokenizer, tokenMethod: record.token_method,
  };
}

export async function fetchCatalog() {
  const rows = await allRows("datasets", recordColumns, query => query.eq("publication_status", "published").order("id"));
  const items = rows.map(toCatalogItem);
  window.CORE_CATALOG = items;
  return items;
}

export function listOwnDatasets(userId) {
  return allRows("datasets", recordColumns, query => query.eq("owner_id", userId).order("updated_at", { ascending: false }).order("id"));
}

export async function getDataset(id) {
  const client = await getSupabaseClient();
  const { data, error } = await client.from("datasets").select(recordColumns).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDataset(id, fields, userId, organizationId) {
  const client = await getSupabaseClient();
  const query = id
    ? client.from("datasets").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId)
    : client.from("datasets").insert({ ...fields, owner_id: userId, organization_id: organizationId });
  const { data, error } = await query.select(recordColumns).single();
  if (error) throw error;
  return data;
}

export async function setPublicationStatus(id, status, userId) {
  const client = await getSupabaseClient();
  const { data, error } = await client.from("datasets").update({ publication_status: status, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", userId).select(recordColumns).single();
  if (error) throw error;
  return data;
}

export function fetchDatasetUsage(datasetId) {
  const columns = "dataset_id,consumer_id,usage_scope,purpose,result_url,is_demo,consumer:consumers(id,name,type,description,url,is_demo,organization:organizations(id,name,name_ru,name_en,name_uz))";
  return allRows("dataset_usage", columns, query => {
    if (datasetId) query = query.eq("dataset_id", datasetId);
    return query.order("dataset_id").order("consumer_id").order("usage_scope");
  });
}

export function datasetFields(input, language = "ru", original = {}) {
  const values = { ...original, ...input };
  const text = key => String(values[key] || "").trim();
  const integer = key => {
    if (values[key] == null || String(values[key]).trim() === "") return null;
    const value = Number(values[key]);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Укажите целое неотрицательное число.");
    return value;
  };
  if (!String(input.title || "").trim() || !String(input.description || "").trim()) throw new Error("Заполните название и описание.");
  const links = Array.isArray(values.links) ? values.links.map(link => {
    const url = safeLink(link.url);
    if (!url) throw new Error("В ссылках используйте полный адрес https:// или http://.");
    return { type: String(link.type || "documentation"), title: String(link.title || "").trim(), url };
  }) : String(values.links || "").split(/\r?\n/).filter(line => line.trim()).map(line => {
    const parts = line.split("|").map(part => part.trim());
    const url = safeLink(parts.length > 1 ? parts.pop() : parts[0]);
    if (!url) throw new Error("В ссылках используйте полный адрес https:// или http://.");
    const type = parts.length > 1 ? parts.shift() : "documentation";
    return { type, title: parts[0] && parts[0] !== url ? parts[0] : "", url };
  });
  const changedVersion = !Object.hasOwn(input, "token_count") && text("data_version") !== String(original.data_version || "").trim();
  const tokenCount = changedVersion ? null : integer("token_count");
  if (tokenCount != null && (!text("tokenizer") || !text("token_method") || !text("token_material") || !text("data_version"))) throw new Error("Для токенов укажите токенизатор, метод, материал и версию данных.");
  return {
    title: { ...(original.title || {}), [language]: text("title") },
    description: { ...(original.description || {}), [language]: text("description") },
    category: text("category"), countries: text("countries").toUpperCase().split(/[;,\s]+/).filter(Boolean),
    languages: text("languages").split(/[;,\s]+/).filter(Boolean), license_id: text("license_id") || null,
    links, record_count: integer("record_count"), token_count: tokenCount,
    tokenizer: tokenCount == null ? null : text("tokenizer"), token_method: tokenCount == null ? null : text("token_method"),
    token_material: tokenCount == null ? null : text("token_material"), data_version: text("data_version") || null,
  };
}

export function loadCabinetData() {
  return Promise.all([
    fetch(appUrl("packages/index.json")).then(function (r) { return r.json(); }),
    fetch(new URL("api/v0/universities.json", rootUrl).href).then(function (r) { return r.json(); }).catch(function () { return { universities: [] }; })
  ]).then(function (res) {
    return {
      datasets: res[0],
      universities: res[1].universities.map(function (u) {
        var n = u.name_ru || u.name_national || u.name_en || u.name;
        return { id: u.id, name: n, label: n + " (" + u.country + ")" };
      }).sort(function (a, b) { return a.label.localeCompare(b.label, "ru"); })
    };
  });
}

export function fetchDatasetRows(slug, key) {
  return fetch(apiBase() + "datasets/" + slug + "/rows-1.json", { headers: { "X-Core-Key": key } }).then(function (r) { return r.json(); });
}

export function fetchDatasetCsv(dataset) {
  return fetch(appUrl("packages/" + dataset.slug + "/data/" + dataset.file)).then(function (r) { return r.text(); });
}
