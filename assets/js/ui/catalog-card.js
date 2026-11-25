import { renderDatasetUsage } from "./dataset-usage.js";
import { licenseName } from "../api/licenses.js";
import { organizationUrl } from "../api/organizations.js";
import { recordUnit } from "./data-labels.js";
import { datasetUrl, sourceLabel, isCoreDataset, safeLink } from "../url.js";

export function createCatalogCard({ lang, L, tr, esc, nf, fieldName, account, symbolsUrl, usageResource }) {
  function cardArt(it) {
    var theme = "dataset", topic = (it.f || "").toLowerCase();
    if (it.id === "uzbek-geography-terms" || /agric|earth|environment|geograph/.test(topic)) theme = "geography";
    else if (it.id === "insurance-literacy-syrdarya" || /social|sociolog|econom|financ|psycholog/.test(topic)) theme = "survey";
    else if (it.id === "covid-almaty-cohort" || /medic|health|nurs|dent|pharmac|immun/.test(topic)) theme = "medicine";
    return '<svg class="cat-art" viewBox="0 0 320 176" aria-hidden="true" focusable="false"><use href="' + symbolsUrl + '#' + theme + '"></use></svg>';
  }

  function card(it, currentUser, favoriteIds) {
    var ext = it.t === "open", demo = it.t === "prep" && it.st === "demo";
    var detailHref = datasetUrl(it, lang);
    var orgName = esc(it.org[lang] || it.org.ru || it.org.en || it.org.uz || "");
    var organization = it.organizationId ? '<a class="cat-org" href="' + esc(organizationUrl(it.organizationId, lang)) + '">' + orgName + '</a>' : orgName;
    var meta = [organization, esc((it.c || "").replace(/;\s*/g, " · ")), esc(fieldName(it.f))];
    if (it.y) meta.push(it.y);
    if (it.t === "prep") meta.push(tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan"));
    var facts = [];
    if (it.n != null) facts.push(nf(it.n) + " " + recordUnit(it.n, lang));
    if (it.tokens != null) facts.push(nf(it.tokens) + " " + tr("tokens", "токенов", "token"));
    var license = licenseName(it.license, lang) || it.lic;
    if (license) facts.push(esc(license));
    if (it.fm) facts.push(esc(it.fm));
    var actions = '<a class="btn btn-primary btn-sm" href="' + esc(detailHref) + '">' + tr("Dataset details", "О наборе", "Toʻplam haqida") + '</a>';
    if (ext && safeLink(it.href)) actions += '<a class="sheet-text-action" href="' + esc(safeLink(it.href)) + '" target="_blank" rel="noopener">' + esc(sourceLabel(it.href, lang)) + ' ↗</a>';
    const root = new URL("../../../", import.meta.url);
    const downloads = { "CORE-DS-0001": "api/v0/datasets/universities/sample.csv", "CORE-DS-0002": "api/v0/datasets/uz_medical_facilities/sample.csv", "CORE-DS-0003": "api/v0/datasets/ca_publications/sample.csv", regions: "api/v0/regions.csv" };
    const restricted = ["metadata-only", "by-agreement"].includes(it.license?.id);
    if (downloads[it.id] && !restricted) actions += '<a class="sheet-text-action" href="' + esc(new URL(downloads[it.id], root).href) + '" download>' + (["CORE-DS-0001", "regions"].includes(it.id) ? tr("Download CSV", "Скачать CSV", "CSVʼni yuklab olish") : tr("Download sample", "Скачать образец", "Namunani yuklab olish")) + '</a>';
    if (account && (!currentUser || currentUser.role === "buyer")) {
      var saved = favoriteIds.indexOf(it.id) >= 0;
      actions += '<button type="button" class="favorite-button" data-favorite="' + esc(it.id) + '" aria-pressed="' + saved + '">' +
        (saved ? tr("Saved", "В избранном", "Saralanganlarda") : tr("Save dataset", "В избранное", "Saralanganlarga")) + '</button>';
    }
    var badge = demo ? '<div class="cat-tags"><span class="st st-api">' + tr("Demo example", "Демонстрационный пример", "Namoyish namunasi") + '</span></div>' : '';
    var description = it.desc ? L(it.desc) : "";
    var usageRows = usageResource?.rows?.[it.id] || [];
    return '<article class="cat-item card' + (isCoreDataset(it) ? " cat-core" : "") + '">' + badge +
      '<div class="cat-card-title">' + cardArt(it) + '<h3><a class="mvp-link-inline" href="' + esc(detailHref) + '">' + esc(L(it.title)) + '</a></h3></div><p class="cat-meta">' + meta.filter(Boolean).join(" · ") + "</p>" +
      (description ? '<p class="cat-desc">' + esc(description) + "</p>" : "") +
      (usageResource?.ready && usageRows.length ? renderDatasetUsage(usageRows, lang, true) : "") +
      '<div class="cat-foot"><span class="cat-facts">' + facts.join(" · ") + '</span><span class="cat-act">' + actions + "</span></div></article>";
  }

  return card;
}
