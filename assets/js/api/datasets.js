/* Current public snapshots. This module is the boundary for future database calls. */
const rootUrl = new URL("../../../", import.meta.url);
const appUrl = value => new URL("app/" + value, rootUrl).href;

export function getCatalog() { return window.CORE_CATALOG; }
export function getUniversityAliases() { return window.CORE_UNI_ALT || {}; }
export function apiBase() { return appUrl("api/v1/"); }

export function loadCabinetData() {
  return Promise.all([
    fetch(appUrl("packages/index.json")).then(function (r) { return r.json(); }),
    fetch(new URL("api/v0/universities.json", rootUrl).href).then(function (r) { return r.json(); }).catch(function () { return { universities: [] }; })
  ]).then(function (res) {
    return {
      datasets: res[0],
      universities: res[1].universities.map(function (u) {
        var n = u.name_ru || u.name_national || u.name_en || u.name;
        return { id: u.id, name: n, label: n + " (" + u.country + ")" };
      }).sort(function (a, b) { return a.label.localeCompare(b.label, "ru"); })
    };
  });
}

export function fetchDatasetRows(slug, key) {
  return fetch(apiBase() + "datasets/" + slug + "/rows-1.json", { headers: { "X-Core-Key": key } }).then(function (r) { return r.json(); });
}

export function fetchDatasetCsv(dataset) {
  return fetch(appUrl("packages/" + dataset.slug + "/data/" + dataset.file)).then(function (r) { return r.text(); });
}
