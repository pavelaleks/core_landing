// CORE public data: read from the static site API (https://coredata.uz/api/v0/) and cached in memory.
// The site stays the single source of truth: rebuild and publish the site, and the MCP server
// picks the new data up within an hour without a redeploy.

import { buildIndex, norm } from "./search.js";
import extraNames from "./names.json" with { type: "json" };
import curated from "./aliases.json" with { type: "json" };

export const DEFAULT_DATA_URL = "https://coredata.uz/api/v0/";
const TTL_MS = 60 * 60 * 1000;

/** readJson(name) for files under a base URL, e.g. "universities.json". */
export function urlReader(base = DEFAULT_DATA_URL) {
  const root = base.endsWith("/") ? base : base + "/";
  return async (name) => {
    const res = await fetch(root + name, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`CORE data ${name}: HTTP ${res.status}`);
    return res.json();
  };
}

let cache = null;

export async function loadData(readJson, { now = Date.now() } = {}) {
  if (cache && cache.readJson === readJson && now - cache.at < TTL_MS) return cache.data;
  const [uni, catalog, research, apiCatalog] = await Promise.all([
    readJson("universities.json"),
    readJson("public-catalog.json"),
    readJson("research-datasets.json").catch(() => ({ datasets: [] })),
    readJson("catalog.json").catch(() => ({ datasets: [] })),
  ]);
  const universities = uni.universities;
  const byId = new Map(universities.map((u) => [u.id, u]));
  const byOpenAlex = new Map(universities.filter((u) => u.openalex).map((u) => [u.openalex, u]));
  const index = buildIndex(universities, extraNames, curated.default ?? curated);

  // research-datasets.json names the university by its OpenAlex display name: map names to CORE IDs.
  const nameToId = new Map();
  for (const e of index) for (const n of e.nameNorms) if (!nameToId.has(n)) nameToId.set(n, e.u.id);
  const research_datasets = (research.datasets || []).map((d) => ({ ...d, university_id: nameToId.get(norm(d.university)) || null }));

  const data = {
    universities,
    byId,
    byOpenAlex,
    index,
    extraNames,
    catalog: catalog.datasets || [],
    licenses: catalog.licenses || [],
    usage: catalog.usage || [],
    research_datasets,
    api_catalog: apiCatalog.datasets || apiCatalog.items || [],
    license: uni.license,
    readJson,
  };
  cache = { at: now, readJson, data };
  return data;
}
