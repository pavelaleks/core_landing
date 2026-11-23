import { TABLE } from "./demo-data.js";
import { fetchDatasetCsv } from "./datasets.js";

var duck = null;

export function loadDuck() {
  if (duck) return duck;
  var V = "1.29.0";
  duck = import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@" + V + "/+esm").then(function (m) {
    return m.selectBundle(m.getJsDelivrBundles()).then(function (b) {
      var wurl = URL.createObjectURL(new Blob(['importScripts("' + b.mainWorker + '");'], { type: "text/javascript" }));
      var db = new m.AsyncDuckDB(new m.VoidLogger(), new Worker(wurl));
      return db.instantiate(b.mainModule, b.pthreadWorker).then(function () { URL.revokeObjectURL(wurl); return { db: db, loaded: {} }; });
    });
  });
  duck.catch(function () { duck = null; });
  return duck;
}

export function ensureTable(D, d) {
  var t = TABLE[d.slug];
  if (D.loaded[t]) return Promise.resolve();
  return fetchDatasetCsv(d).then(function (txt) {
    return D.db.registerFileText(t + ".csv", txt).then(function () { return D.db.connect(); }).then(function (c) {
      return c.query("CREATE TABLE " + t + " AS SELECT * FROM read_csv_auto('" + t + ".csv', header = true)").then(function () { D.loaded[t] = true; return c.close(); });
    });
  });
}

export function isDuckLoaded() { return Boolean(duck); }
