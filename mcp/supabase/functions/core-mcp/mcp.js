// MCP over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch)
// and gets a JSON reply. No sessions and no SSE stream are needed for read-only tools.
// Web-standard Request → Response, so the same handler runs in Supabase (Deno) and Node.

import { loadData, urlReader, DEFAULT_DATA_URL } from "./data.js";
import { openAlexClient } from "./openalex.js";
import { semanticScholarClient } from "./semanticscholar.js";
import { TOOLS, callTool } from "./tools.js";

export const SERVER_INFO = { name: "core-central-asia", title: "CORE — universities and researchers of Central Asia", version: "0.1.0" };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS =
  "CORE (coredata.uz) covers 397 universities of Uzbekistan, Kazakhstan, Kyrgyzstan and Tajikistan with persistent CORE IDs (UNI-UZ-0138 …), and their researchers, publications and datasets. " +
  "Start with search_universities for any university name or abbreviation (it returns the full profile when the match is clear), or search_researchers for a person. " +
  "Researcher, work and live publication data come from OpenAlex. Cite CORE IDs and source links in answers.";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID, apikey, x-client-info",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...extra } });
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/**
 * createHandler({ readJson?, dataUrl?, openAlexKey?, openAlexMailto?, semanticScholarKey?, fetchImpl? }) → (Request) => Promise<Response>
 * readJson(name) overrides where CORE data comes from (tests read the repo's api/v0 folder).
 */
export function createHandler(opts = {}) {
  const readJson = opts.readJson || urlReader(opts.dataUrl || DEFAULT_DATA_URL);
  const oa = openAlexClient({ apiKey: opts.openAlexKey, mailto: opts.openAlexMailto, fetchImpl: opts.fetchImpl });
  const s2 = semanticScholarClient({ apiKey: opts.semanticScholarKey, fetchImpl: opts.fetchImpl });

  async function handleMessage(msg) {
    if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
      return msg && "id" in msg && msg.method === undefined ? null : rpcError(msg?.id, -32600, "Invalid JSON-RPC request");
    }
    const isNotification = !("id" in msg);
    const { id, method, params } = msg;
    try {
      let result;
      switch (method) {
        case "initialize": {
          const asked = params?.protocolVersion;
          result = {
            protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          };
          break;
        }
        case "ping":
          result = {};
          break;
        case "tools/list":
          result = { tools: TOOLS };
          break;
        case "tools/call": {
          const tool = TOOLS.find((t) => t.name === params?.name);
          if (!tool) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
          try {
            const data = await loadData(readJson);
            const out = await callTool(tool.name, params.arguments, { data, oa, s2 });
            result = { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out };
          } catch (err) {
            result = { content: [{ type: "text", text: `Error: ${err?.message || err}` }], isError: true };
          }
          break;
        }
        case "resources/list":
          result = { resources: [] };
          break;
        case "prompts/list":
          result = { prompts: [] };
          break;
        default:
          if (method.startsWith("notifications/")) return null;
          return isNotification ? null : rpcError(id, -32601, `Method not found: ${method}`);
      }
      return isNotification ? null : { jsonrpc: "2.0", id, result };
    } catch (err) {
      return isNotification ? null : rpcError(id, -32603, String(err?.message || err));
    }
  }

  return async function handler(req) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "GET") {
      // No server-initiated stream: SSE clients get 405 as the spec allows; browsers get a short description.
      if ((req.headers.get("accept") || "").includes("text/event-stream")) return json(rpcError(null, -32000, "SSE stream not supported; use POST"), 405, { Allow: "POST" });
      return json({ ...SERVER_INFO, transport: "streamable-http", usage: "POST JSON-RPC MCP messages to this URL", tools: TOOLS.map((t) => t.name), docs: "https://coredata.uz/agents.html" });
    }
    if (req.method === "DELETE") return new Response(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
    if (req.method !== "POST") return json(rpcError(null, -32000, "Method not allowed"), 405);

    let body;
    try {
      body = await req.json();
    } catch {
      return json(rpcError(null, -32700, "Parse error"), 400);
    }
    const replies = (await Promise.all((Array.isArray(body) ? body : [body]).map(handleMessage))).filter(Boolean);
    if (!replies.length) return new Response(null, { status: 202, headers: CORS });
    return json(Array.isArray(body) ? replies : replies[0]);
  };
}
