// MCP protocol and tools. Offline by default (OpenAlex is mocked); CORE_MCP_LIVE=1 also hits the real OpenAlex.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHandler } from "../supabase/functions/core-mcp/mcp.js";

const apiDir = new URL("../../api/v0/", import.meta.url);
const readJson = async (name) => JSON.parse(await readFile(new URL(name, apiDir), "utf8"));

// Fake OpenAlex: records requested URLs, returns canned authors / institution / works.
function fakeOpenAlex() {
  const seen = [];
  const author = {
    id: "https://openalex.org/A5000000001", display_name: "Pavel Alekseev", display_name_alternatives: ["П. Алексеев"],
    orcid: "https://orcid.org/0000-0000-0000-0001", works_count: 12, cited_by_count: 40, summary_stats: { h_index: 4 },
    affiliations: [{ institution: { id: "https://openalex.org/I1299170990", display_name: "Samarkand State University", country_code: "UZ" }, years: [2024, 2025] }],
    last_known_institutions: [{ id: "https://openalex.org/I1299170990", display_name: "Samarkand State University", country_code: "UZ" }],
    topics: [{ display_name: "Data science", count: 5, field: { display_name: "Computer Science" } }],
    counts_by_year: [{ year: 2024, works_count: 3, cited_by_count: 5 }, { year: 2025, works_count: 4, cited_by_count: 9 }],
    relevance_score: 10,
  };
  const work = {
    id: "https://openalex.org/W1", display_name: "A paper", publication_year: 2025, cited_by_count: 3, type: "article", doi: "https://doi.org/10.1000/ABC",
    authorships: [
      { author: { id: author.id, display_name: author.display_name }, institutions: [author.affiliations[0].institution] },
      { author: { id: "https://openalex.org/A2", display_name: "Co Author" }, institutions: [{ id: "https://openalex.org/I47151758", display_name: "NUU" }] },
    ],
  };
  const s2 = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === "api.semanticscholar.org") {
      s2.push({ url: u, headers: init.headers, ids: JSON.parse(init.body).ids });
      if (fetchImpl.s2Status) return new Response("{}", { status: fetchImpl.s2Status });
      const rows = JSON.parse(init.body).ids.map((id) => (id === "DOI:10.1000/abc" ? { paperId: "p1", url: "https://www.semanticscholar.org/paper/p1", tldr: { text: "Short summary." }, abstract: "Long abstract.", influentialCitationCount: 2 } : null));
      return new Response(JSON.stringify(rows), { headers: { "content-type": "application/json" } });
    }
    seen.push(u);
    let body;
    if (u.pathname.startsWith("/institutions/")) body = { id: "https://openalex.org/I1299170990", display_name: "Samarkand State University", works_count: 10000, summary_stats: { h_index: 56 }, counts_by_year: [{ year: 2025, works_count: 2000 }], topics: [{ display_name: "Turkic and Altaic Linguistics", count: 600, field: { display_name: "Arts and Humanities" } }] };
    else if (u.pathname === "/authors") body = { meta: { count: 1 }, results: [{ ...author, affiliations: [{ ...author.affiliations[0], years: [2022, 2023, 2024, 2025] }] }] };
    else if (u.pathname.startsWith("/authors/")) body = author;
    else if (u.pathname === "/works") body = { meta: { count: 1 }, results: [work] };
    else return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  return { fetchImpl, seen, s2 };
}

const rpc = (handler, method, params, id = 1) =>
  handler(new Request("http://local/mcp", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) }));
const call = async (handler, name, args) => {
  const res = await (await rpc(handler, "tools/call", { name, arguments: args })).json();
  assert.ok(!res.error, JSON.stringify(res.error));
  return res.result;
};

test("initialize, tools/list, notifications, errors", async () => {
  const h = createHandler({ readJson, fetchImpl: fakeOpenAlex().fetchImpl });
  const init = await (await rpc(h, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } })).json();
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.ok(init.result.capabilities.tools);

  const note = await h(new Request("http://local/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) }));
  assert.equal(note.status, 202);

  const list = await (await rpc(h, "tools/list", {})).json();
  const names = list.result.tools.map((t) => t.name);
  for (const n of ["search_universities", "get_university", "search_researchers", "get_researcher", "search_works", "search_datasets", "get_dataset"]) assert.ok(names.includes(n), n);
  for (const t of list.result.tools) assert.equal(t.inputSchema.type, "object");

  const unknown = await (await rpc(h, "tools/call", { name: "nope", arguments: {} })).json();
  assert.equal(unknown.error.code, -32602);
  const bad = await (await rpc(h, "no/such/method", {})).json();
  assert.equal(bad.error.code, -32601);

  const sse = await h(new Request("http://local/mcp", { headers: { Accept: "text/event-stream" } }));
  assert.equal(sse.status, 405);
  const opt = await h(new Request("http://local/mcp", { method: "OPTIONS" }));
  assert.equal(opt.headers.get("access-control-allow-origin"), "*");
});

test("search_universities СамГУ returns Samarkand State University with a full profile", async () => {
  const h = createHandler({ readJson, fetchImpl: fakeOpenAlex().fetchImpl });
  const r = await call(h, "search_universities", { query: "СамГУ" });
  const out = r.structuredContent;
  assert.equal(out.results[0].id, "UNI-UZ-0138");
  assert.equal(out.results[0].name, "Samarkand State University");
  const p = out.best_match;
  assert.equal(p.country, "UZ");
  assert.equal(p.identifiers.ror, "https://ror.org/02b6gy972");
  assert.ok(p.names.uz && p.names.ru && p.names.en);
  assert.ok(p.datasets_in_core.total > 0);
  assert.equal(p.publications_live.research_areas[0].topic, "Turkic and Altaic Linguistics");
  assert.equal(p.publications_live.top_researchers[0].name, "Pavel Alekseev");
  assert.ok("faculties_note" in p);
  assert.match(r.content[0].text, /UNI-UZ-0138/);
});

test("get_university accepts any reference and can skip live data", async () => {
  const { fetchImpl, seen } = fakeOpenAlex();
  const h = createHandler({ readJson, fetchImpl });
  const r = (await call(h, "get_university", { id: "НУУз", live: false })).structuredContent;
  assert.equal(r.id, "UNI-UZ-0132");
  assert.equal(r.resolved_from, "НУУз");
  assert.equal(r.publications_live, undefined);
  assert.equal(seen.length, 0);
  const miss = await call(h, "get_university", { id: "qwzxjv" });
  assert.equal(miss.isError, true);
});

test("search_researchers Алексеев searches Cyrillic and Latin, maps affiliations to CORE IDs", async () => {
  const { fetchImpl, seen } = fakeOpenAlex();
  const h = createHandler({ readJson, fetchImpl });
  const out = (await call(h, "search_researchers", { query: "Алексеев" })).structuredContent;
  const searched = seen.map((u) => u.searchParams.get("search"));
  assert.deepEqual(searched.sort(), ["Alekseev", "Алексеев"].sort());
  assert.ok(seen.every((u) => u.searchParams.get("filter").includes("country_code:uz|kz|kg|tj")));
  assert.equal(out.results[0].name, "Pavel Alekseev");
  assert.equal(out.results[0].central_asia_affiliations[0].core_id, "UNI-UZ-0138");

  seen.length = 0;
  await call(h, "search_researchers", { query: "Alekseev", university: "СамГУ" });
  assert.equal(seen[0].searchParams.get("filter"), "affiliations.institution.id:I1299170990");
});

test("get_researcher returns works and co-authors", async () => {
  const h = createHandler({ readJson, fetchImpl: fakeOpenAlex().fetchImpl });
  const out = (await call(h, "get_researcher", { id: "https://openalex.org/A5000000001" })).structuredContent;
  assert.equal(out.id, "A5000000001");
  assert.equal(out.works_by_year[0].year, 2025);
  assert.equal(out.most_cited_works[0].central_asian_universities[0].id, "UNI-UZ-0138");
  assert.deepEqual(out.frequent_coauthors[0], { id: "A2", name: "Co Author", joint_works: 1, institutions: ["UNI-UZ-0132"] });
});

test("Semantic Scholar enriches works only when a key is set, and never breaks a call", async () => {
  const plain = fakeOpenAlex();
  const h0 = createHandler({ readJson, fetchImpl: plain.fetchImpl });
  const w0 = (await call(h0, "search_works", { query: "paper" })).structuredContent.results[0];
  assert.equal(w0.tldr, undefined);
  assert.equal(plain.s2.length, 0);

  const fake = fakeOpenAlex();
  const h = createHandler({ readJson, fetchImpl: fake.fetchImpl, semanticScholarKey: "test-key" });
  const w = (await call(h, "search_works", { query: "paper" })).structuredContent.results[0];
  assert.equal(w.tldr, "Short summary.");
  assert.equal(w.abstract, "Long abstract.");
  assert.equal(w.influential_citations, 2);
  assert.equal(fake.s2[0].headers["x-api-key"], "test-key");
  assert.deepEqual(fake.s2[0].ids, ["DOI:10.1000/abc"]);
  assert.ok(!fake.s2[0].url.search.includes("test-key"));

  const r = (await call(h, "get_researcher", { id: "A5000000001" })).structuredContent;
  assert.equal(r.most_cited_works[0].tldr, "Short summary.");

  fake.fetchImpl.s2Status = 500;
  const res = await call(h, "search_works", { query: "paper" });
  assert.ok(!res.isError);
  assert.equal(res.structuredContent.results[0].tldr, undefined);
  assert.equal(res.structuredContent.enrichment_note, "Semantic Scholar HTTP 500");
});

test("datasets: search by university and inspect", async () => {
  const h = createHandler({ readJson, fetchImpl: fakeOpenAlex().fetchImpl });
  const s = (await call(h, "search_datasets", { query: "COVID" })).structuredContent;
  assert.ok(s.results.some((d) => d.id === "covid-almaty-cohort"));
  const byUni = (await call(h, "search_datasets", { university: "СамГУ", limit: 50 })).structuredContent;
  assert.ok(byUni.total > 0);
  const d = (await call(h, "get_dataset", { id: "CORE-DS-0001" })).structuredContent;
  assert.equal(d.license, "CC0-1.0");
  assert.ok(d.fields.some((f) => f.name === "id"));
});

test("HTTP server answers MCP over Streamable HTTP", async (t) => {
  const port = 18000 + Math.floor(Math.random() * 1000);
  const proc = spawn(process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url)), "--local-data"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "ignore", "pipe"] });
  t.after(() => proc.kill());
  await new Promise((resolve, reject) => {
    proc.stderr.on("data", (d) => String(d).includes("CORE MCP server") && resolve());
    proc.on("exit", (c) => reject(new Error(`server exited ${c}`)));
  });
  const post = (body) => fetch(`http://localhost:${port}/mcp`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify(body) });
  const init = await (await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } })).json();
  assert.equal(init.result.serverInfo.name, "core-central-asia");
  const r = await (await post({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "get_university", arguments: { id: "SamDU", live: false } } })).json();
  assert.equal(r.result.structuredContent.id, "UNI-UZ-0138");
});

test("live OpenAlex: СамГУ and Алексеев", { skip: !process.env.CORE_MCP_LIVE && "set CORE_MCP_LIVE=1" }, async () => {
  const h = createHandler({ readJson, openAlexKey: process.env.OPENALEX_API_KEY });
  const uni = (await call(h, "search_universities", { query: "СамГУ" })).structuredContent;
  assert.equal(uni.best_match.id, "UNI-UZ-0138");
  assert.ok(uni.best_match.publications_live.works_count > 5000);
  assert.ok(uni.best_match.publications_live.top_researchers.length > 0);
  const ppl = (await call(h, "search_researchers", { query: "Алексеев" })).structuredContent;
  assert.ok(ppl.results.length > 0);
  assert.ok(ppl.results.every((a) => a.central_asia_affiliations.length > 0));
  const one = (await call(h, "get_researcher", { id: ppl.results[0].id })).structuredContent;
  assert.ok(one.most_cited_works.length > 0);
});

test("live Semantic Scholar enrichment", { skip: !(process.env.CORE_MCP_LIVE && process.env.SEMANTIC_SCHOLAR_API_KEY) && "set CORE_MCP_LIVE=1 and SEMANTIC_SCHOLAR_API_KEY" }, async () => {
  const h = createHandler({ readJson, semanticScholarKey: process.env.SEMANTIC_SCHOLAR_API_KEY });
  const out = (await call(h, "search_works", { query: "Aral Sea dust", limit: 10 })).structuredContent;
  assert.ok(out.results.some((w) => w.tldr || w.abstract), "no work got tldr/abstract from Semantic Scholar");
});
