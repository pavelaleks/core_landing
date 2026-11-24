/* Parse maintained scripts and verify every local ES-module dependency. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SourceTextModule } from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const checked = new Set();

function check(relative) {
  const filename = path.resolve(root, relative);
  if (checked.has(filename)) return;
  assert(fs.existsSync(filename), "Missing JavaScript file: " + relative);
  const module = new SourceTextModule(fs.readFileSync(filename, "utf8"), {
    identifier: filename,
  });
  checked.add(filename);
  for (const specifier of module.dependencySpecifiers) {
    if (!specifier.startsWith(".")) continue;
    const dependency = fileURLToPath(new URL(specifier, pathToFileURL(filename)));
    assert(
      dependency.startsWith(root),
      "Import outside the project: " + relative + " -> " + specifier,
    );
    check(path.relative(root, dependency));
  }
}

for (const entry of [
  "assets/account-store.js",
  "assets/account-session.js",
  "assets/app.js",
  "assets/graph3d.js",
  "assets/catalog-page.js",
  "assets/regions-page.js",
  "assets/rankings.js",
  "assets/how-page.js",
  "app/app.js",
]) {
  check(entry);
}

console.log("ok: " + checked.size + " JavaScript files parse; local module imports resolve");
