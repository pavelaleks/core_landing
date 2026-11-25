// Optional Semantic Scholar enrichment: TLDR summaries, abstracts and influential citation counts
// for works found in OpenAlex, matched by DOI. Enabled only when SEMANTIC_SCHOLAR_API_KEY is set
// (without a key the shared rate limit answers 429 most of the time). Never fails a tool call.

const BATCH_URL = "https://api.semanticscholar.org/graph/v1/paper/batch";
const FIELDS = "paperId,url,tldr,abstract,influentialCitationCount";
const ABSTRACT_MAX = 600;

export const bareDoi = (doi) => (doi ? String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() : null);

export function semanticScholarClient({ apiKey, fetchImpl = fetch, timeoutMs = 8000 } = {}) {
  if (!apiKey) return null;
  /** dois → Map(bareDoi → {tldr, abstract, influential_citations, semantic_scholar}) */
  return async function lookup(dois) {
    const ids = [...new Set(dois.map(bareDoi).filter(Boolean))].slice(0, 500);
    const out = new Map();
    if (!ids.length) return out;
    try {
      const res = await fetchImpl(`${BATCH_URL}?fields=${FIELDS}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({ ids: ids.map((d) => `DOI:${d}`) }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) return out;
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
    } catch {
      // timeout or network error: answer without enrichment
    }
    return out;
  };
}

/** Add Semantic Scholar fields to work summaries in place (summaries carry `doi`). */
export async function enrichWorks(s2, works) {
  if (!s2 || !works?.length) return works;
  const found = await s2(works.map((w) => w.doi));
  for (const w of works) {
    const extra = found.get(bareDoi(w.doi));
    if (extra) for (const [k, v] of Object.entries(extra)) if (v !== null && v !== undefined) w[k] = v;
  }
  return works;
}
