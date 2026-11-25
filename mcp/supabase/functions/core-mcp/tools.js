// CORE MCP tools: universities and datasets from the CORE registry, researchers and works from OpenAlex.

import { searchUniversities, hasCyrillic, translit } from "./search.js";
import { CA_COUNTRIES, shortId } from "./openalex.js";
import { enrichWorks } from "./semanticscholar.js";

const SITE = "https://coredata.uz/";
const COUNTRY_NAMES = { UZ: "Uzbekistan", KZ: "Kazakhstan", KG: "Kyrgyzstan", TJ: "Tajikistan" };
const FACULTIES_NOTE =
  "CORE does not hold faculty or admission-program lists yet. research_areas (OpenAlex topics of the university's papers) is the closest proxy; for programs check the university website.";

const clamp = (n, lo, hi, dflt) => Math.min(hi, Math.max(lo, Number.isFinite(+n) && n !== null && n !== "" ? Math.round(+n) : dflt));
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)));
const byYear = (rows) => [...(rows || [])].sort((a, b) => b.year - a.year).slice(0, 6).map((c) => ({ year: c.year, works: c.works_count, citations: c.cited_by_count }));
const pick = (obj, lang = "en") => (obj && typeof obj === "object" ? obj[lang] || obj.en || obj.ru || Object.values(obj)[0] : obj);

// ------------------------------------------------------------------ universities

function universitySummary(u, hit) {
  return compact({
    id: u.id,
    name: u.name_en || u.name,
    name_ru: u.name_ru,
    name_national: u.name_national,
    acronyms: u.acronyms ? u.acronyms.split(";").map((s) => s.trim()) : null,
    country: u.country,
    city: u.city,
    website: u.website,
    founded: u.founded,
    works_count: u.works_count,
    h_index: u.h_index,
    matched_by: hit?.why,
  });
}

/** CORE ID, ROR, OpenAlex I-id, Wikidata Q-id, website or a name → university record (or null). */
export function resolveUniversity(data, ref) {
  if (!ref) return null;
  const s = String(ref).trim();
  if (data.byId.has(s.toUpperCase())) return data.byId.get(s.toUpperCase());
  const [hit] = searchUniversities(data.index, s, { limit: 1 });
  return hit ? hit.e.u : null;
}

function datasetsOf(data, uniId, max = 8) {
  const catalog = data.catalog
    .filter((d) => d.organization_id === uniId)
    .map((d) => compact({ id: d.id, title: pick(d.title), kind: d.kind, license: d.license, access: d.access_type, records: d.record_count, url: d.source_url ? new URL(d.source_url, SITE).href : null }));
  const inCatalog = new Set(catalog.map((d) => d.id));
  const research = data.research_datasets
    .filter((d) => d.university_id === uniId && !inCatalog.has(d.openalex))
    .map((d) => compact({ id: d.openalex, title: d.title, year: d.year, repository: d.repository_type, license: d.license, field: d.field, url: d.url, has_data_files: d.check === "data" }));
  const total = catalog.length + research.length;
  return compact({
    total,
    catalog: catalog.slice(0, max),
    research_datasets: research.slice(0, Math.max(0, max - Math.min(catalog.length, max))),
    more: total > max ? `${total - max} more: call search_datasets with university="${uniId}"` : null,
  });
}

/** Authors who really work at the institution: affiliated in ≥ 3 distinct years (fallback ≥ 2), by output. */
function coreStaff(authors, openalexId, limit) {
  const withYears = authors.map((a) => {
    const aff = (a.affiliations || []).find((x) => shortId(x.institution?.id) === openalexId);
    return { ...a, years_here: new Set(aff?.years || []).size };
  });
  for (const min of [3, 2, 0]) {
    const pickd = withYears.filter((a) => a.years_here >= min);
    if (pickd.length >= Math.min(limit, 3) || min === 0) return pickd.slice(0, limit);
  }
  return [];
}

async function liveUniversity(oa, openalexId, limit) {
  const [inst, authors] = await Promise.all([
    oa(`institutions/${openalexId}`, { select: "id,display_name,works_count,cited_by_count,summary_stats,counts_by_year,topics" }),
    oa("authors", { filter: `last_known_institutions.id:${openalexId}`, sort: "works_count:desc", per_page: 100, select: "id,display_name,orcid,works_count,cited_by_count,summary_stats,topics,affiliations" }),
  ]);
  if (!inst) return { error: `OpenAlex has no institution ${openalexId}` };
  const fields = {};
  for (const t of inst.topics || []) {
    const f = t.field?.display_name;
    if (f) fields[f] = (fields[f] || 0) + t.count;
  }
  return {
    display_name: inst.display_name,
    works_count: inst.works_count,
    cited_by_count: inst.cited_by_count,
    h_index: inst.summary_stats?.h_index,
    i10_index: inst.summary_stats?.i10_index,
    works_by_year: byYear(inst.counts_by_year),
    research_areas: (inst.topics || []).slice(0, 12).map((t) => ({ topic: t.display_name, field: t.field?.display_name, works: t.count })),
    fields: Object.entries(fields).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([field, works]) => ({ field, works })),
    top_researchers: coreStaff(authors?.results || [], openalexId, limit).map((a) => compact({
      id: shortId(a.id),
      name: a.display_name,
      orcid: a.orcid ? a.orcid.replace("https://orcid.org/", "") : null,
      works_count: a.works_count,
      cited_by_count: a.cited_by_count,
      h_index: a.summary_stats?.h_index,
      main_topic: a.topics?.[0]?.display_name,
      years_affiliated: a.years_here,
    })),
    note: "top_researchers: most productive authors whose latest OpenAlex affiliation is this university and who list it in at least 3 different years (one-off guest affiliations are skipped).",
  };
}

export async function universityProfile(data, oa, u, { live = true, researchers = 10 } = {}) {
  const extra = data.extraNames[u.id] || {};
  const profile = compact({
    id: u.id,
    name: u.name_en || u.name,
    names: compact({ ...(extra.names || {}), ru: u.name_ru || extra.names?.ru, en: u.name_en || extra.names?.en, national: Object.values(extra.names || {}).includes(u.name_national) ? null : u.name_national }),
    acronyms: [...new Set([...(u.acronyms ? u.acronyms.split(";").map((s) => s.trim()) : []), ...(extra.acronyms || [])])],
    other_names: extra.aliases,
    country: u.country,
    country_name: COUNTRY_NAMES[u.country],
    city: u.city,
    location: u.lat != null ? { lat: u.lat, lon: u.lon } : null,
    website: u.website,
    founded: u.founded,
    students: extra.students,
    is_branch: extra.is_branch,
    relationships: extra.relationships,
    identifiers: compact({
      core: u.id,
      ror: u.ror ? `https://ror.org/${u.ror}` : null,
      wikidata: u.wikidata ? `https://www.wikidata.org/wiki/${u.wikidata}` : null,
      openalex: u.openalex ? `https://openalex.org/${u.openalex}` : null,
    }),
    publications_core_snapshot: compact({ works_count: u.works_count, cited_by_count: u.cited_by_count, h_index: u.h_index, i10_index: extra.i10_index, as_of: "2026-11-07" }),
    faculties: null,
    faculties_note: FACULTIES_NOTE,
    datasets_in_core: datasetsOf(data, u.id),
    core_page: `${SITE}organization.html?id=${u.id}`,
  });
  if (live && u.openalex && oa) {
    try {
      profile.publications_live = await liveUniversity(oa, u.openalex, researchers);
    } catch (err) {
      profile.publications_live = { error: String(err.message || err) };
    }
  }
  profile.source = `CORE university registry (${data.license}), live part from OpenAlex (CC0).`;
  return profile;
}

// ------------------------------------------------------------------ researchers

const yearSpan = (ys) => {
  if (!ys?.length) return null;
  const lo = Math.min(...ys), hi = Math.max(...ys);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
};

function caAffiliations(data, author) {
  return (author.affiliations || [])
    .filter((a) => CA_COUNTRIES.includes(String(a.institution?.country_code || "").toLowerCase()))
    .map((a) => {
      const u = data.byOpenAlex.get(shortId(a.institution.id));
      return compact({ core_id: u?.id, name: u ? u.name_en || u.name : a.institution.display_name, country: a.institution.country_code, years: yearSpan(a.years) });
    });
}

function researcherSummary(data, a) {
  return compact({
    id: shortId(a.id),
    name: a.display_name,
    other_names: (a.display_name_alternatives || []).filter((n) => n !== a.display_name).slice(0, 5),
    orcid: a.orcid ? a.orcid.replace("https://orcid.org/", "") : null,
    works_count: a.works_count,
    cited_by_count: a.cited_by_count,
    h_index: a.summary_stats?.h_index,
    current_institutions: (a.last_known_institutions || []).map((i) => compact({ core_id: data.byOpenAlex.get(shortId(i.id))?.id, name: i.display_name, country: i.country_code })),
    central_asia_affiliations: caAffiliations(data, a),
    topics: (a.topics || []).slice(0, 5).map((t) => t.display_name),
    openalex: a.id,
  });
}

const AUTHOR_FIELDS = "id,display_name,display_name_alternatives,orcid,works_count,cited_by_count,summary_stats,affiliations,last_known_institutions,topics,relevance_score";

export async function searchResearchers(data, oa, { query, university, limit = 10 }) {
  const per = clamp(limit, 1, 25, 10);
  let filter = `affiliations.institution.country_code:${CA_COUNTRIES}`;
  let uni = null;
  if (university) {
    uni = resolveUniversity(data, university);
    if (!uni) throw new Error(`University not found: ${university}`);
    if (!uni.openalex) throw new Error(`${uni.id} has no OpenAlex ID, so its researchers cannot be listed`);
    filter = `affiliations.institution.id:${uni.openalex}`;
  }
  const variants = [query];
  if (hasCyrillic(query)) variants.push(translit(query));
  const pages = await Promise.all(variants.map((q) => oa("authors", { search: q, filter, per_page: per, select: AUTHOR_FIELDS })));
  const seen = new Map();
  for (const p of pages) for (const a of p?.results || []) if (!seen.has(a.id) || (a.relevance_score || 0) > (seen.get(a.id).relevance_score || 0)) seen.set(a.id, a);
  const results = [...seen.values()].sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0) || b.works_count - a.works_count).slice(0, per);
  return compact({
    query,
    searched_as: variants.length > 1 ? variants : null,
    university: uni ? { id: uni.id, name: uni.name_en || uni.name } : null,
    scope: uni ? "authors ever affiliated with this university" : "authors ever affiliated with a university in UZ, KZ, KG or TJ",
    count: results.length,
    total_in_openalex: pages.reduce((s, p) => s + (p?.meta?.count || 0), 0),
    results: results.map((a) => researcherSummary(data, a)),
    next: "Call get_researcher with an id for works, co-authors and topics.",
    source: "OpenAlex (CC0), live",
  });
}

function workSummary(data, w, { authors = 5 } = {}) {
  const auths = w.authorships || [];
  const ca = new Map();
  for (const a of auths) for (const i of a.institutions || []) {
    const u = data.byOpenAlex.get(shortId(i.id));
    if (u) ca.set(u.id, u.name_en || u.name);
  }
  return compact({
    id: shortId(w.id),
    title: w.display_name || w.title,
    year: w.publication_year,
    type: w.type,
    doi: w.doi,
    cited_by_count: w.cited_by_count,
    topic: w.primary_topic?.display_name,
    field: w.primary_topic?.field?.display_name,
    open_access: w.open_access?.is_oa ? w.open_access.oa_url || true : false,
    authors: auths.slice(0, authors).map((a) => a.author?.display_name).concat(auths.length > authors ? [`+${auths.length - authors} more`] : []),
    central_asian_universities: [...ca].map(([id, name]) => ({ id, name })),
  });
}

const WORK_FIELDS = "id,display_name,publication_year,type,doi,cited_by_count,primary_topic,open_access,authorships";

function parseAuthorRef(ref) {
  const s = String(ref || "").trim();
  const a = s.match(/A\d{6,}/i);
  if (a) return `authors/${a[0].toUpperCase()}`;
  const orcid = s.match(/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i);
  if (orcid) return `authors/orcid:${orcid[0].toUpperCase()}`;
  return null;
}

export async function researcherProfile(data, oa, { id, works = 10 }, s2 = null) {
  const n = clamp(works, 1, 25, 10);
  let path = parseAuthorRef(id);
  let resolved = null;
  if (!path) {
    const found = await searchResearchers(data, oa, { query: id, limit: 5 });
    if (!found.results?.length) throw new Error(`No Central Asian researcher found for "${id}"`);
    path = `authors/${found.results[0].id}`;
    resolved = { from: id, other_candidates: found.results.slice(1).map((r) => ({ id: r.id, name: r.name, current_institutions: r.current_institutions?.map((i) => i.name) })) };
  }
  const author = await oa(path, { select: AUTHOR_FIELDS.replace(",relevance_score", "") + ",counts_by_year" });
  if (!author) throw new Error(`OpenAlex has no author ${id}`);
  const aid = shortId(author.id);
  const [top, recent] = await Promise.all([
    oa("works", { filter: `author.id:${aid}`, sort: "cited_by_count:desc", per_page: n, select: WORK_FIELDS }),
    oa("works", { filter: `author.id:${aid}`, sort: "publication_date:desc", per_page: 100, select: WORK_FIELDS }),
  ]);
  // Co-authors from the latest 100 works, skipping large collaborations (> 50 authors).
  const co = new Map();
  for (const w of recent?.results || []) {
    const auths = w.authorships || [];
    if (auths.length > 50) continue;
    for (const a of auths) {
      const cid = shortId(a.author?.id);
      if (!cid || cid === aid) continue;
      const c = co.get(cid) || { id: cid, name: a.author.display_name, joint_works: 0, institutions: new Set() };
      c.joint_works++;
      for (const i of a.institutions || []) c.institutions.add(data.byOpenAlex.get(shortId(i.id))?.id || i.display_name);
      co.set(cid, c);
    }
  }
  const mostCited = (top?.results || []).map((w) => workSummary(data, w));
  const latest = (recent?.results || []).slice(0, n).map((w) => workSummary(data, w));
  await enrichWorks(s2, [...mostCited, ...latest]);
  const coauthors = [...co.values()].sort((a, b) => b.joint_works - a.joint_works).slice(0, 15).map((c) => ({ ...c, institutions: [...c.institutions].slice(0, 3) }));
  return compact({
    ...researcherSummary(data, author),
    resolved,
    topics: (author.topics || []).slice(0, 10).map((t) => ({ topic: t.display_name, field: t.field?.display_name, works: t.count })),
    works_by_year: byYear(author.counts_by_year),
    most_cited_works: mostCited,
    recent_works: latest,
    frequent_coauthors: coauthors,
    coauthors_note: "Counted over the latest 100 works, excluding papers with more than 50 authors.",
    source: (s2 ? "OpenAlex (CC0) and Semantic Scholar (tldr, abstract, influential_citations), live." : "OpenAlex (CC0), live.") + " Author disambiguation is OpenAlex's; one person can have several profiles.",
  });
}

// ------------------------------------------------------------------ works and datasets

export async function searchWorks(data, oa, { query, university, from_year, limit = 10 }, s2 = null) {
  const per = clamp(limit, 1, 25, 10);
  const filters = [];
  let uni = null;
  if (university) {
    uni = resolveUniversity(data, university);
    if (!uni?.openalex) throw new Error(`University not found or without OpenAlex ID: ${university}`);
    filters.push(`institutions.id:${uni.openalex}`);
  } else filters.push(`institutions.country_code:${CA_COUNTRIES}`);
  if (from_year) filters.push(`publication_year:>${clamp(from_year, 1900, 2100, 2000) - 1}`);
  const page = await oa("works", { search: query, filter: filters.join(","), per_page: per, select: WORK_FIELDS });
  return compact({
    query,
    university: uni ? { id: uni.id, name: uni.name_en || uni.name } : null,
    total_in_openalex: page?.meta?.count,
    results: await enrichWorks(s2, (page?.results || []).map((w) => workSummary(data, w))),
    source: s2 ? "OpenAlex (CC0) and Semantic Scholar (tldr, abstract, influential_citations), live" : "OpenAlex (CC0), live",
  });
}

function datasetHit(d) {
  return compact({ id: d.id, title: pick(d.title), title_ru: d.title?.ru, organization: d.organization ? { id: d.organization.id, name: d.organization.name_en || d.organization.name } : null, kind: d.kind, license: d.license, access: d.access_type, records: d.record_count, url: d.source_url ? new URL(d.source_url, SITE).href : null });
}

export function searchDatasets(data, { query, university, limit = 10 }) {
  const per = clamp(limit, 1, 50, 10);
  const uni = university ? resolveUniversity(data, university) : null;
  if (university && !uni) throw new Error(`University not found: ${university}`);
  const words = String(query || "").toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const score = (text) => (words.length ? words.filter((w) => text.toLowerCase().includes(w)).length / words.length : 1);
  const hits = [];
  for (const d of data.catalog) {
    if (uni && d.organization_id !== uni.id) continue;
    const s = score([d.id, ...Object.values(d.title || {}), ...Object.values(d.description || {}), d.category].join(" "));
    if (s >= 0.5) hits.push({ s: s + 0.1, r: { source: "core_catalog", ...datasetHit(d) } });
  }
  for (const d of data.research_datasets) {
    if (uni && d.university_id !== uni.id) continue;
    const s = score([d.openalex, d.title, d.field, d.university].join(" "));
    if (s >= 0.5) hits.push({ s, r: compact({ source: "research_datasets", id: d.openalex, title: d.title, year: d.year, university: d.university_id ? { id: d.university_id, name: d.university } : d.university, field: d.field, license: d.license, repository: d.repository_type, url: d.url, has_data_files: d.check === "data" }) });
  }
  hits.sort((a, b) => b.s - a.s);
  return { query: query || null, university: uni ? { id: uni.id, name: uni.name_en || uni.name } : undefined, total: hits.length, results: hits.slice(0, per).map((h) => h.r) };
}

export async function getDataset(data, { id }) {
  const d = data.catalog.find((x) => x.id === id) || data.catalog.find((x) => x.id.toLowerCase() === String(id).toLowerCase());
  if (!d) {
    const r = data.research_datasets.find((x) => x.openalex === id);
    if (r) return { source: "research_datasets", ...r, note: "Open dataset by Central Asian researchers, listed from OpenAlex. Data lives in the repository at url." };
    throw new Error(`Dataset not found: ${id}. Use search_datasets to find IDs.`);
  }
  const out = compact({
    ...datasetHit(d),
    description: pick(d.description),
    description_ru: d.description?.ru,
    category: d.category,
    countries: d.countries,
    languages: d.languages,
    formats: d.formats,
    data_version: d.data_version,
    updated_at: d.updated_at,
    license_info: d.license_info ? { id: d.license_info.id, name: pick(d.license_info.name), terms: pick(d.license_info.description), document: d.license_info.document_path ? new URL(d.license_info.document_path, SITE).href : null } : null,
    used_by: data.usage.filter((x) => x.dataset_id === d.id).map((x) => ({ consumer: pick(x.consumer?.name), type: x.consumer?.type, purpose: pick(x.purpose), demo: x.is_demo })),
  });
  // Base datasets have a public card with fields and a sample in the static API.
  const card = data.api_catalog.find((x) => x.id === d.id);
  if (card?.slug) {
    try {
      const full = await data.readJson(`datasets/${card.slug}.json`);
      out.fields = full.fields;
      out.withheld_fields = full.withheld_fields;
      out.links = full.links;
      out.sample = (full.sample || []).slice(0, 3);
    } catch (err) {
      out.links = card.links;
    }
  }
  return out;
}

// ------------------------------------------------------------------ tool registry

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true };
const str = (description) => ({ type: "string", description });
const int = (description, d, max) => ({ type: "integer", description, default: d, minimum: 1, maximum: max });

export const TOOLS = [
  {
    name: "search_universities",
    title: "Search universities of Central Asia",
    description:
      "Find universities in Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan by any name, abbreviation, city, website or ID, in any language or script: 'СамГУ', 'SamDU', 'Самаркандский госуниверситет', 'НУУз', 'КазНУ', 'nuu.uz', 'ROR 02b6gy972'. Returns candidates with persistent CORE IDs; when the match is unambiguous, best_match carries the full profile (names, identifiers, publication activity, research areas, top researchers, datasets).",
    inputSchema: {
      type: "object",
      properties: {
        query: str("Name, abbreviation, city, website or identifier. Empty with country/city lists universities."),
        country: str("Optional filter: UZ, KZ, KG, TJ or the country name"),
        city: str("Optional city filter, any spelling (Samarkand, Самарканд, Samarqand)"),
        limit: int("Max candidates", 5, 25),
      },
    },
    annotations: { ...RO, openWorldHint: true },
  },
  {
    name: "get_university",
    title: "University profile",
    description:
      "Full profile of one university: names in all languages, acronyms, country, city, website, founding year, ROR/Wikidata/OpenAlex IDs, publication activity by year, main research areas, most productive researchers, and datasets in the CORE catalog. Accepts a CORE ID (UNI-UZ-0138), ROR, OpenAlex or Wikidata ID, website, or a name/abbreviation.",
    inputSchema: {
      type: "object",
      properties: {
        id: str("CORE ID, external ID, website or name"),
        live: { type: "boolean", description: "Add fresh stats, research areas and researchers from OpenAlex", default: true },
        researchers: int("How many top researchers to include", 10, 25),
      },
      required: ["id"],
    },
    annotations: { ...RO, openWorldHint: true },
  },
  {
    name: "search_researchers",
    title: "Search researchers",
    description:
      "Find researchers affiliated with Central Asian universities by name (Latin or Cyrillic: 'Алексеев', 'Alekseev', 'Artikov A.'). Optionally restrict to one university (any name or ID, e.g. 'СамГУ'). Returns OpenAlex author IDs, ORCID, affiliations with CORE IDs, metrics and topics.",
    inputSchema: {
      type: "object",
      properties: { query: str("Researcher name"), university: str("Optional university: name, abbreviation or ID"), limit: int("Max results", 10, 25) },
      required: ["query"],
    },
    annotations: { ...RO, openWorldHint: true },
  },
  {
    name: "get_researcher",
    title: "Researcher profile",
    description:
      "Profile of one researcher: affiliations (with CORE university IDs), topics, metrics, publications per year, most cited and recent works (with tldr and abstract when Semantic Scholar is enabled), frequent co-authors. Accepts an OpenAlex author ID (A5045044903), an ORCID, or a name (the best Central Asian match is used and other candidates are listed).",
    inputSchema: {
      type: "object",
      properties: { id: str("OpenAlex author ID, ORCID or name"), works: int("How many works per list", 10, 25) },
      required: ["id"],
    },
    annotations: { ...RO, openWorldHint: true },
  },
  {
    name: "search_works",
    title: "Search publications",
    description: "Search papers by Central Asian universities by topic or title, optionally for one university and from a year. Each work lists the Central Asian universities involved with CORE IDs. When Semantic Scholar is enabled, works also carry a one-sentence tldr, a short abstract and influential_citations.",
    inputSchema: {
      type: "object",
      properties: { query: str("Topic, keywords or title"), university: str("Optional university: name, abbreviation or ID"), from_year: { type: "integer", description: "Only works published in or after this year" }, limit: int("Max results", 10, 25) },
      required: ["query"],
    },
    annotations: { ...RO, openWorldHint: true },
  },
  {
    name: "search_datasets",
    title: "Search datasets",
    description: "Search the CORE catalog and the list of open research datasets by Central Asian scholars, by keywords and/or university. Returns dataset IDs, licenses, access type and links.",
    inputSchema: {
      type: "object",
      properties: { query: str("Keywords (empty lists all)"), university: str("Optional university: name, abbreviation or ID"), limit: int("Max results", 10, 50) },
    },
    annotations: { ...RO, openWorldHint: false },
  },
  {
    name: "get_dataset",
    title: "Inspect a dataset",
    description: "Description, license and terms, fields (schema), withheld fields, sample records and links for one dataset from search_datasets (e.g. CORE-DS-0001, covid-almaty-cohort, W6892086253).",
    inputSchema: { type: "object", properties: { id: str("Dataset ID") }, required: ["id"] },
    annotations: { ...RO, openWorldHint: false },
  },
];

export async function callTool(name, args, { data, oa, s2 = null }) {
  args = args || {};
  switch (name) {
    case "search_universities": {
      const hits = searchUniversities(data.index, args.query || "", { country: args.country, city: args.city, limit: clamp(args.limit, 1, 25, 5) });
      const out = { query: args.query || "", count: hits.length, results: hits.map((h) => universitySummary(h.e.u, h)) };
      const [a, b] = hits;
      const confident = a && args.query && (a.score >= 790 || hits.length === 1 || a.score - (b?.score ?? 0) >= 50);
      if (confident) out.best_match = await universityProfile(data, oa, a.e.u, { researchers: 5 });
      else if (hits.length) out.next = "Several candidates match; call get_university with the right id.";
      else out.next = "Nothing found. Try another spelling, the city, or the English name.";
      return out;
    }
    case "get_university": {
      const u = resolveUniversity(data, args.id);
      if (!u) throw new Error(`University not found: ${args.id}. Use search_universities.`);
      const p = await universityProfile(data, oa, u, { live: args.live !== false, researchers: clamp(args.researchers, 1, 25, 10) });
      if (!data.byId.has(String(args.id).toUpperCase())) p.resolved_from = args.id;
      return p;
    }
    case "search_researchers":
      if (!args.query) throw new Error("query is required");
      return searchResearchers(data, oa, args);
    case "get_researcher":
      if (!args.id) throw new Error("id is required");
      return researcherProfile(data, oa, args, s2);
    case "search_works":
      if (!args.query) throw new Error("query is required");
      return searchWorks(data, oa, args, s2);
    case "search_datasets":
      return searchDatasets(data, args);
    case "get_dataset":
      if (!args.id) throw new Error("id is required");
      return getDataset(data, args);
    default:
      return undefined;
  }
}
