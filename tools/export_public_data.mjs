/* Anonymous export: RLS prevents profiles and drafts entering static output. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "assets/config.js"), "utf8"), context);
const config = context.window.CORE_CONFIG.supabase;
async function read(table, select, filter = {}) {
  const rows = [];
  let total;
  do {
    const params = new URLSearchParams({ select, order: table === "dataset_usage" ? "dataset_id,consumer_id,usage_scope" : "id", limit: "200", offset: String(rows.length), ...filter });
    const response = await fetch(config.url + "/rest/v1/" + table + "?" + params, { headers: { apikey: config.publishableKey, Prefer: "count=exact" }, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(table + ": HTTP " + response.status);
    const page = await response.json();
    const count = response.headers.get("content-range")?.split("/")[1];
    total = count && count !== "*" ? Number(count) : null;
    if (!page.length) { if (total != null && rows.length < total) throw new Error("Incomplete " + table); break; }
    rows.push(...page);
    if (total == null && page.length < 200) break;
  } while (total == null || rows.length < total);
  return rows;
}
const columns = "id,organization_id,kind,title,description,category,countries,languages,license_id,license,license_url,usage_terms,links,record_count,token_count,tokenizer,token_method,token_material,data_version,publication_status,access_type,source_url,formats,publication_year,mentions_central_asia,updated_at,organization:organizations(id,name,name_ru,name_en,name_uz,country),license_info:licenses(id,name,description,document_path,version)";
const datasets = await read("datasets", columns, { publication_status: "eq.published" });
const usage = await read("dataset_usage", "dataset_id,consumer_id,usage_scope,purpose,result_url,is_demo,consumer:consumers(id,name,type,description,url,is_demo,organization:organizations(id,name,name_ru,name_en,name_uz))");
if (datasets.some(d => d.publication_status !== "published")) throw new Error("Private record in public export");
const licenses = await read("licenses", "id,name,description,document_path,version");
const snapshot = { version: 1, licenses, datasets, usage };
fs.writeFileSync(path.join(root, "data-src/public-catalog.json"), JSON.stringify(snapshot, null, 1) + "\n");
console.log(JSON.stringify({ publishedDatasets: datasets.length, licenses: licenses.length, usage: usage.length }));
