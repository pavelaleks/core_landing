// Supabase Edge Function entry point: public MCP server for CORE.
// Deploy: see mcp/README.md (supabase functions deploy core-mcp --no-verify-jwt).
import { createHandler } from "./mcp.js";

const handler = createHandler({
  dataUrl: Deno.env.get("CORE_DATA_URL") ?? undefined,
  openAlexKey: Deno.env.get("OPENALEX_API_KEY") ?? undefined,
  openAlexMailto: Deno.env.get("OPENALEX_MAILTO") ?? undefined,
  semanticScholarKey: Deno.env.get("SEMANTIC_SCHOLAR_API_KEY") ?? undefined,
});

Deno.serve(handler);
