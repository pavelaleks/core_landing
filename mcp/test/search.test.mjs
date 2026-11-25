// University name search: abbreviations, scripts, spellings. Offline, uses the repo's api/v0 data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildIndex, searchUniversities, abbreviations, skel, translit } from "../supabase/functions/core-mcp/search.js";

const fn = new URL("../supabase/functions/core-mcp/", import.meta.url);
const universities = JSON.parse(readFileSync(new URL("../../api/v0/universities.json", import.meta.url))).universities;
const index = buildIndex(universities, JSON.parse(readFileSync(new URL("names.json", fn))), JSON.parse(readFileSync(new URL("aliases.json", fn))));
const top = (q, opts) => searchUniversities(index, q, opts)[0]?.e.u.id;

test("СамГУ and its spellings find Samarkand State University first", () => {
  for (const q of ["СамГУ", "самгу", "SamDU", "СамДУ", "Samarkand State University", "Самаркандский государственный университет",
    "Самаркандский госуниверситет", "Samarqand davlat universiteti", "Самарканд", "samdu.uz", "UNI-UZ-0138", "02b6gy972", "I1299170990"]) {
    assert.equal(top(q), "UNI-UZ-0138", q);
  }
});

test("common abbreviations across the four countries", () => {
  const cases = {
    "НУУз": "UNI-UZ-0132", "NUU": "UNI-UZ-0132", "КазНУ": "UNI-KZ-0098", "ТашГТУ": "UNI-UZ-0147", "ЕНУ": "UNI-KZ-0070",
    "КБТУ": "UNI-KZ-0107", "Назарбаев университет": "UNI-KZ-0132", "КРСУ": "UNI-KG-0024", "AUCA": "UNI-KG-0011",
    "ТНУ": "UNI-TJ-0029", "ФерГУ": "UNI-UZ-0184", "БухГУ": "UNI-UZ-0102", "Al-Farabi": "UNI-KZ-0098",
  };
  for (const [q, id] of Object.entries(cases)) assert.equal(top(q), id, q);
});

test("filters by country and city", () => {
  const kz = searchUniversities(index, "", { country: "Казахстан", limit: 500 });
  assert.ok(kz.length > 100 && kz.every((h) => h.e.u.country === "KZ"));
  const sam = searchUniversities(index, "университет", { city: "Samarqand", limit: 50 });
  assert.ok(sam.length >= 3 && sam.every((h) => /samar/i.test(skel(h.e.u.city))));
});

test("nonsense finds nothing", () => {
  assert.equal(searchUniversities(index, "qwzxjv").length, 0);
});

test("helpers", () => {
  assert.ok(abbreviations("Самаркандский государственный университет").includes("самгу"));
  assert.ok(abbreviations("Alisher Navoiy nomidagi Samarqand Davlat Universiteti").includes("samdu"));
  assert.equal(translit("Алексеев"), "Alekseev");
  assert.equal(skel("Самарканд"), skel("Samarqand"));
});
