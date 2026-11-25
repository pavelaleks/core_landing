export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

const siteRoot = new URL("../../", import.meta.url);

export function datasetUrl(item, lang = "ru") {
  const id = item.id;
  const basePages = { "CORE-DS-0001": "universities", "CORE-DS-0002": "uz_medical_facilities", "CORE-DS-0003": "ca_publications" };
  const page = basePages[id] ? "datasets/" + basePages[id] + ".html" : id === "regions" ? "regions.html" : "dataset.html";
  const url = new URL((lang === "en" ? "" : lang + "/") + page, siteRoot);
  if (page === "dataset.html") url.searchParams.set("id", id);
  return url.href;
}

export function sourceLabel(value, lang = "ru") {
  const url = safeLink(value);
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  let name = /zenodo\./i.test(url) ? "Zenodo" : /mendeley\./i.test(url) ? "Mendeley Data" : /gbif\.|10\.15468\//i.test(url) ? "GBIF" : host;
  if (host === "doi.org" && name === host) name = "DOI";
  if (name === "DOI") return { en: "Original publication (DOI)", ru: "Исходная публикация (DOI)", uz: "Asl nashr (DOI)" }[lang];
  return { en: "Original publication on ", ru: "Исходная публикация на ", uz: "Asl nashr · " }[lang] + name;
}

export function isCoreDataset(item) {
  return item.t === "prep" || item.kind === "prep" || (item.organizationId || item.organization_id) === "ORG-CORE";
}
