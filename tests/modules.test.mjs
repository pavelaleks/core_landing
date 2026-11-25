import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("../", import.meta.url));
const plain = value => JSON.parse(JSON.stringify(value));

function demoEnvironment(initial) {
  const storage = new Map(initial ? [["core-mvp-v1", JSON.stringify(initial)]] : []);
  const events = [];
  const window = { dispatchEvent: event => events.push(event.type) };
  const context = vm.createContext({
    window, URL, Event, setTimeout, clearTimeout,
    document: { currentScript: { src: "https://example.test/core_landing/assets/account-store.js?v=test" } },
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "assets/account-store.js"), "utf8"), context);
  return { context, storage, events, store: window.CORE_ACCOUNT.demoStore(), accountStore: window.CORE_ACCOUNT };
}

async function loadModule(relative, context) {
  const cache = new Map();
  function create(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), {
      context,
      identifier: filename,
      initializeImportMeta(meta) {
        meta.url = new URL(path.relative(root, filename).replaceAll(path.sep, "/"), "https://example.test/core_landing/").href;
      },
    });
    cache.set(filename, module);
    return module;
  }
  const entry = create(path.join(root, relative));
  await entry.link((specifier, referencing) => create(
    fileURLToPath(new URL(specifier, pathToFileURL(referencing.identifier))),
  ));
  await entry.evaluate();
  return entry.namespace;
}

test("shared account store preserves legacy data, identity and isolated favorites", async () => {
  const env = demoEnvironment({
    user: { id: "old-user", role: "buyer", email: "old@example.test" },
    accounts: [{ id: "old-user", email: "old@example.test" }],
    requests: [{ id: "R-existing", status: "approved" }],
    submissions: [{ id: "S-existing" }],
    favorites: { "old-user": ["universities"] }, downloads: 8, extra: "preserve",
  });
  const { seed } = await loadModule("assets/js/api/demo-data.js", env.context);
  const state = env.store.load(seed);
  assert.equal(state.requests[0].id, "R-existing");
  assert.equal(state.submissions[0].id, "S-existing");
  assert.equal(state.extra, "preserve");
  assert.equal(env.store.load(), state);
  const ids = env.store.favoriteIds();
  ids.push("not-saved");
  assert.deepEqual(plain(env.store.favoriteIds()), ["universities"]);
  assert.equal(env.store.toggleFavorite("regions"), true);
  assert.deepEqual(plain(env.store.favoriteIds()), ["universities", "regions"]);
  assert.deepEqual(env.events, ["core:account"]);
  state.user = { id: "another-user", role: "buyer" };
  env.store.save();
  assert.deepEqual(plain(env.store.favoriteIds()), []);
  state.user.role = "university";
  env.store.save();
  assert.equal(env.store.toggleFavorite("regions"), false);
  assert.equal(state.downloads, 8);
  assert.equal(env.store.catalogUrl("uz"), "https://example.test/core_landing/uz/catalog.html");
  assert.equal(env.store.cabinetUrl("#login"), "https://example.test/core_landing/app/index.html#login");
});

test("demo registration and login retain validation and existing account identity", async () => {
  const env = demoEnvironment();
  env.store.load();
  const { authenticateDemo, signOutDemo } = await loadModule("assets/js/api/demo-auth.js", env.context);
  assert.match(authenticateDemo({ email: "missing@example.test" }, []).error, /не найден/);
  const input = { register: true, email: " PARTNER@EXAMPLE.TEST ", name: " Test Partner ", role: "buyer", org: " Example Org ", university: "" };
  const first = authenticateDemo(input, []);
  assert.equal(first.user.email, "partner@example.test");
  assert.equal(first.user.name, "Test Partner");
  assert.equal(first.user.buyerOrg, "Example Org");
  assert.equal(JSON.parse(env.storage.get("core-mvp-v1")).accounts.length, 1);
  assert.match(authenticateDemo(input, []).error, /уже зарегистрирован/);
  signOutDemo();
  assert.equal(env.store.s.user, null);
  assert.equal(authenticateDemo({ email: "PARTNER@example.test" }, []).user.id, first.user.id);
  assert.match(authenticateDemo({ ...input, email: "uni@example.test", role: "university" }, []).error, /из списка/);
  const university = { id: "UNI-TEST", name: "Test University", label: "Test University (UZ)" };
  const uni = authenticateDemo({ ...input, email: "uni@example.test", role: "university", university: university.label }, [university]);
  assert.equal(uni.user.uni, "UNI-TEST");
  assert.equal(uni.user.org, university.name);
  assert.equal(env.store.s.accounts.length, 2);
});

test("public data requests keep the repository prefix, headers and university labels", async () => {
  const calls = [];
  const context = vm.createContext({
    URL, window: { CORE_CATALOG: [{ id: "existing" }], CORE_UNI_ALT: { uni: "aliases" } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url.endsWith("packages/index.json")) return { json: async () => [{ slug: "sample" }] };
      if (url.endsWith("universities.json")) return { json: async () => ({ universities: [{ id: "U1", name_en: "University", country: "UZ" }] }) };
      if (url.endsWith(".csv")) return { text: async () => "x,y\n1,2" };
      return { json: async () => ({ rows: [{ x: 1 }] }) };
    },
  });
  const data = await loadModule("assets/js/api/datasets.js", context);
  assert.equal(data.getCatalog()[0].id, "existing");
  assert.equal(data.getUniversityAliases().uni, "aliases");
  const cabinet = await data.loadCabinetData();
  assert.equal(cabinet.universities[0].label, "University (UZ)");
  assert.equal(cabinet.datasets[0].slug, "sample");
  await data.fetchDatasetRows("sample", "core_demo_test");
  assert.equal(calls[2].url, "https://example.test/core_landing/app/api/v1/datasets/sample/rows-1.json");
  assert.equal(calls[2].options.headers["X-Core-Key"], "core_demo_test");
  assert.equal(await data.fetchDatasetCsv({ slug: "sample", file: "data.csv" }), "x,y\n1,2");
  assert.equal(calls[3].url, "https://example.test/core_landing/app/packages/sample/data/data.csv");
});

test("unavailable universities remain optional while package loading errors propagate", async () => {
  const context = vm.createContext({
    URL,
    fetch: async url => {
      if (url.endsWith("universities.json")) throw new Error("offline");
      return { json: async () => [] };
    },
  });
  const data = await loadModule("assets/js/api/datasets.js", context);
  assert.deepEqual(plain((await data.loadCabinetData()).universities), []);
  context.fetch = async () => { throw new Error("packages unavailable"); };
  await assert.rejects(data.loadCabinetData(), /packages unavailable/);
});

test("catalog card links, artwork and favorite controls retain their language and role behavior", async () => {
  const { createCatalogCard } = await loadModule("assets/js/ui/catalog-card.js", vm.createContext({ URL }));
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const options = {
    lang: "ru", L: value => value.ru || value.en,
    tr: (en, ru) => ru, esc, nf: value => String(value), fieldName: value => value,
    UNI: {}, state: { u: "" }, account: {}, symbolsUrl: "https://example.test/core_landing/assets/illustrations/data-symbols.svg",
  };
  const render = createCatalogCard(options);
  const item = {
    id: "uzbek-geography-terms", t: "prep", st: "demo", org: { en: "University" }, organizationId: "UNI-UZ-0180",
    title: { en: "English", ru: "Русский" }, href: "app/index.html#demo/uzbek-geography-terms", f: "Research", c: "UZ",
  };
  const guest = render(item, null, []);
  assert.match(guest, /href="https:\/\/example.test\/core_landing\/ru\/dataset.html\?id=uzbek-geography-terms"/);
  assert.doesNotMatch(guest, /#demo\//);
  assert.match(guest, /data-symbols.svg#geography/);
  assert.match(guest, /Русский/);
  assert.match(guest, /organization\.html\?id=UNI-UZ-0180/);
  assert.match(guest, /Подготовлено CORE/);
  assert.match(guest, /Демонстрационный пример/);
  assert.match(guest, /data-favorite=/);
  assert.match(render(item, { role: "buyer" }, [item.id]), /aria-pressed="true"/);
  assert.doesNotMatch(render(item, { role: "university" }, []), /data-favorite=/);
  const external = render({ ...item, id: "W-example", t: "open", st: "open", href: "https://doi.org/example" }, null, []);
  assert.match(external, /<h3><a [^>]*href="https:\/\/example.test\/core_landing\/ru\/dataset.html\?id=W-example"/);
  assert.match(external, /href="https:\/\/doi.org\/example" target="_blank" rel="noopener"/);
  assert.match(external, /Исходная публикация \(DOI\)/);
  const { isCoreDataset } = await loadModule("assets/js/url.js", vm.createContext({ URL }));
  assert.equal(isCoreDataset({ t: "dataset", organizationId: "UNI-UZ-0180" }), false);
  assert.equal(isCoreDataset({ t: "prep", organizationId: "UNI-UZ-0180" }), true);
  assert.doesNotMatch(external, /Открытый набор|CORE подготовит|Подготовить через CORE|class="cat-tags"/);
  const withoutSource = render({ ...item, id: "W-without-source", t: "open", st: "open", href: "app/index.html#dataset/W-without-source" }, null, []);
  assert.doesNotMatch(withoutSource, /Открыть источник/);
  const licensed = render({ ...item, t: "dataset", lic: "Legacy source license", license: { id: "by-agreement", name: { ru: "Доступ по соглашению" } }, href: "app/index.html#dataset/DS-example" }, null, []);
  assert.match(licensed, /Доступ по соглашению/);
  assert.doesNotMatch(licensed, /\[object Object\]|Legacy source license|Доступ по условиям набора/);
  const uzRender = createCatalogCard({ ...options, lang: "uz", tr: (en, ru, uz) => uz });
  const uzCard = uzRender({ ...item, org: { en: "English name", ru: "Русское имя", uz: "Oʻzbekcha nom" } }, null, []);
  assert.match(uzCard, /Oʻzbekcha nom/);
  assert.doesNotMatch(uzCard, /Русское имя/);
});

test("CSV preview retains delimiter, empty-cell and personal-data detection behavior", async () => {
  const { scanCsv } = await loadModule("assets/js/ui/submission.js", vm.createContext({}));
  const clean = scanCsv("record_id\tmeasurement\r\n1\t42\r\n2\t\r\n");
  assert.equal(clean.rows, 2);
  assert.equal(clean.cols, 2);
  assert.equal(clean.empty, 0.25);
  assert.deepEqual(plain(clean.pii), []);
  const flagged = scanCsv("name;email;phone\nExample;person@example.test;+79991234567");
  assert.equal(flagged.cols, 3);
  assert.equal(flagged.rows, 1);
  assert(flagged.pii.some(value => value.includes("e-mail")));
  assert(flagged.pii.some(value => value.includes("телефона")));
});

test("the upload form saves the same demo metadata without storing raw file contents", async () => {
  const env = demoEnvironment();
  env.store.load();
  env.store.s.user = { role: "university", uni: "UNI-TEST", uniName: "Test University" };
  env.store.save();
  const file = { name: "measurements.csv", size: 39 };
  const nodes = {
    nT: { value: "  Measurements  " }, nD: { value: "  Two sample rows  " },
    nFld: { value: "Агро, вода и экология" }, nS: { value: "Test Signer" },
    nFile: { files: [file] }, scan: { innerHTML: "" }, nf: { reportValidity: () => true },
  };
  const view = { innerHTML: "" }, messages = [], routes = [];
  env.context.document = {
    getElementById: id => nodes[id],
    querySelector: () => ({ value: "process" }),
    createElement: () => ({ remove() {} }),
    body: { appendChild: element => messages.push(element.textContent) },
  };
  env.context.setTimeout = () => 0;
  env.context.FileReader = class {
    readAsText() {
      this.result = "record_id,measurement\n1,12.5\n2,18.0";
      this.onload();
    }
  };
  const { createSubmissionPages } = await loadModule("assets/js/pages/submissions.js", env.context);
  const page = createSubmissionPages({ store: env.store, view, DS: [], ds: () => null, go: route => routes.push(route) });
  page.vUniNew();
  nodes.nFile.onchange();
  assert.match(nodes.scan.innerHTML, /2 строк, 2 столбцов/);
  nodes.nf.onsubmit({ preventDefault() {} });
  const saved = JSON.parse(env.storage.get("core-mvp-v1")).submissions[0];
  assert.equal(saved.title, "Measurements");
  assert.equal(saved.desc, "Two sample rows");
  assert.equal(saved.uni, "UNI-TEST");
  assert.equal(saved.file.name, file.name);
  assert.equal(saved.file.rows, 2);
  assert.equal(saved.status, 0);
  assert.equal(saved.log[0].s, 0);
  assert.equal("contents" in saved.file, false);
  assert.equal("data" in saved.file, false);
  assert.match(messages[0], /сохранено в этом браузере/);
  assert.deepEqual(routes, ["#uni"]);
});
