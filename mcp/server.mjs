#!/usr/bin/env node
// Run the CORE MCP server locally (Node 22+, no dependencies).
//   node mcp/server.mjs                 → Streamable HTTP on http://localhost:8787/mcp
//   node mcp/server.mjs --stdio         → stdio transport (for clients that launch a command)
//   --local-data                        → read ./api/v0 from this repo instead of https://coredata.uz/api/v0/
//   PORT=9000 OPENALEX_API_KEY=… SEMANTIC_SCHOLAR_API_KEY=… node mcp/server.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
import { createHandler } from "./supabase/functions/core-mcp/mcp.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const localDir = path.join(here, "..", "api", "v0");
const readJson = args.includes("--local-data") ? async (name) => JSON.parse(await readFile(path.join(localDir, name), "utf8")) : undefined;

const handler = createHandler({
  readJson,
  dataUrl: process.env.CORE_DATA_URL,
  openAlexKey: process.env.OPENALEX_API_KEY,
  openAlexMailto: process.env.OPENALEX_MAILTO,
  semanticScholarKey: process.env.SEMANTIC_SCHOLAR_API_KEY,
});

if (args.includes("--stdio")) {
  // Newline-delimited JSON-RPC on stdin/stdout; logs go to stderr only.
  const rl = readline.createInterface({ input: process.stdin });
  rl.on("line", async (line) => {
    if (!line.trim()) return;
    const res = await handler(new Request("http://stdio/", { method: "POST", headers: { "Content-Type": "application/json" }, body: line }));
    if (res.status === 200) process.stdout.write((await res.text()) + "\n");
  });
} else {
  const port = Number(process.env.PORT || 8787);
  http
    .createServer(async (req, res) => {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const request = new Request(`http://localhost:${port}${req.url}`, {
        method: req.method,
        headers: req.headers,
        body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const response = await handler(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    })
    .listen(port, () => console.error(`CORE MCP server: http://localhost:${port}/mcp${readJson ? " (local data)" : ""}`));
}
