// Optional Semantic Scholar enrichment: TLDR summaries, abstracts and influential citation counts
// for works found in OpenAlex, matched by DOI. Enabled only when SEMANTIC_SCHOLAR_API_KEY is set
// (without a key the shared rate limit answers 429 most of the time). Never fails a tool call.

const BATCH_URL = "https://api.semanticscholar.org/graph/v1/paper/batch";
const FIELDS = "paperId,url,tldr,abstract,influentialCitationCount";
const ABSTRACT_MAX = 600;

export const bareDoi = (doi) => (doi ? String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() : null);

export function semanticScholarClient({ apiKey, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  apiKey = String(apiKey || "").trim().replace(/^["']|["']$/g, "");
  if (!apiKey) return null;
  const post = (ids) =>
    fetchImpl(`${BATCH_URL}?fields=${FIELDS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({ ids: ids.map((d) => `DOI:${d}`) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  /** dois → Map(bareDoi → {tldr, abstract, influential_citations, semantic_scholar}) */
  return async function lookup(dois) {
    const ids = [...new Set(dois.map(bareDoi).filter(Boolean))].slice(0, 500);
    const out = new Map();
    if (!ids.length) return out;
    try {
      let res = await post(ids);
      if (res.status === 429) {
        // The key allows about 1 request per second: wait once and retry.
        await new Promise((r) => setTimeout(r, 1200));
        res = await post(ids);
      }
      if (!res.ok) {
        out.error = `Semantic Scholar HTTP ${res.status}`;
        return out;
      }
      const rows = await res.json();
      rows.forEach((p, i) => {
        if (!p) return; // unknown DOI
        const abstract = p.abstract && p.abstract.length > ABSTRACT_MAX ? p.abstract.slice(0, ABSTRACT_MAX).replace(/\s+\S*$/, "") + " …" : p.abstract;
        out.set(ids[i], {
          tldr: p.tldr?.text || null,
          abstract: abstract || null,
          influential_citations: p.influentialCitationCount ?? null,
          semantic_scholar: p.url || null,
        });
      });
    } catch (err) {
      out.error = `Semantic Scholar unavailable: ${err?.name === "TimeoutError" ? "timeout" : err?.message || err}`; // answer without enrichment
    }
    return out;
  };
}

/** Add Semantic Scholar fields to work summaries in place (summaries carry `doi`). Returns an error note or null. */
export async function enrichWorks(s2, works) {
  if (!s2 || !works?.length) return null;
  const found = await s2(works.map((w) => w.doi));
  for (const w of works) {
    const extra = found.get(bareDoi(w.doi));
    if (extra) for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) w[k] = v;
  }
  return found.error || null;
}
