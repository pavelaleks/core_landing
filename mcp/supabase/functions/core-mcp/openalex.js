// Minimal live OpenAlex client (CC0 data). Used for researchers, works and fresh publication stats.
// An optional OPENALEX_API_KEY goes in the Authorization header, never in the URL.

export const CA_COUNTRIES = "uz|kz|kg|tj";
const BASE = "https://api.openalex.org/";

export function openAlexClient({ apiKey, mailto, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  return async function get(path, params = {}) {
    const url = new URL(path, BASE);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    if (mailto) url.searchParams.set("mailto", mailto);
    const headers = { Accept: "application/json", "User-Agent": "core-mcp/0.1 (+https://coredata.uz)" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`OpenAlex ${url.pathname}: HTTP ${res.status}`);
    return res.json();
  };
}

/** "https://openalex.org/A5045044903" → "A5045044903" */
export const shortId = (id) => (id ? String(id).replace(/^https?:\/\/openalex\.org\//, "") : id);
