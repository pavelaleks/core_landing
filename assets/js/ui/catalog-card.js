import { renderDatasetUsage } from "./dataset-usage.js";
import { licenseName } from "../api/licenses.js";
import { organizationUrl } from "../api/organizations.js";
import { recordUnit } from "./data-labels.js";

export function createCatalogCard({ lang, L, tr, esc, nf, fieldName, account, symbolsUrl, usageResource }) {
  var TYPE = {
    base: [tr("CORE database", "База CORE", "CORE bazasi"), "t-teal"],
    prep: [tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan"), "t-violet"],
    layer: [tr("CORE data layer", "Слой данных CORE", "CORE maʼlumotlar qatlami"), "t-teal"],
    open: [tr("Scholars' open dataset", "Открытый набор учёных", "Olimlarning ochiq toʻplami"), ""],
    dataset: [tr("University or company dataset", "Набор университета или компании", "Universitet yoki kompaniya toʻplami"), "t-teal"]
  };
  var STATUS = {
    buy: [tr("Licensable now", "Можно лицензировать", "Hozir litsenziyalash mumkin"), "st-now"],
    demo: [tr("Demo access", "Демо-доступ", "Demo kirish"), "st-api"],
    open: [tr("Open at the source · CORE prepares on request", "Открыт у авторов · CORE подготовит по запросу", "Mualliflarda ochiq · CORE soʻrov boʻyicha tayyorlaydi"), "st-req"],
    request: [tr("Access under the dataset terms", "Доступ по условиям набора", "Toʻplam shartlari asosida kirish"), "st-req"]
  };

  function cardArt(it) {
    var theme = "dataset", topic = (it.f || "").toLowerCase();
    if (it.id === "uzbek-geography-terms" || /agric|earth|environment|geograph/.test(topic)) theme = "geography";
    else if (it.id === "insurance-literacy-syrdarya" || /social|sociolog|econom|financ|psycholog/.test(topic)) theme = "survey";
    else if (it.id === "covid-almaty-cohort" || /medic|health|nurs|dent|pharmac|immun/.test(topic)) theme = "medicine";
    return '<svg class="cat-art" viewBox="0 0 320 176" aria-hidden="true" focusable="false"><use href="' + symbolsUrl + '#' + theme + '"></use></svg>';
  }

  function card(it, currentUser, favoriteIds) {
    var ty = TYPE[it.t] || TYPE.dataset, st = STATUS[it.st] || STATUS.request, ext = it.t === "open";
    if (it.license) st = [licenseName(it.license, lang), it.license.id === "open-cc-by-4-0" ? "st-now" : "st-req"];
    var href = it.t === "dataset" ? it.href.replace("app/index.html#dataset/", "app/index.html?lang=" + lang + "#dataset/") : it.href;
    var orgName = esc(it.org[lang] || it.org.ru || it.org.en || it.org.uz || "");
    var organization = it.organizationId ? '<a class="cat-org" href="' + esc(organizationUrl(it.organizationId, lang)) + '">' + orgName + '</a>' : orgName;
    if (it.t === "prep" || ext) organization = tr("Source", "Источник", "Manba") + ' · ' + organization;
    var meta = [organization, esc((it.c || "").replace(/;\s*/g, " · ")), esc(fieldName(it.f))];
    if (it.y) meta.push(it.y);
    var facts = [];
    if (it.n != null) facts.push(nf(it.n) + " " + recordUnit(it.n, lang));
    if (it.tokens != null) facts.push(nf(it.tokens) + " " + tr("tokens", "токенов", "token"));
    if (it.lic && !it.license) facts.push(esc(it.lic));
    if (it.fm) facts.push(esc(it.fm));
    var actions = ext
      ? '<a class="btn btn-ghost btn-sm" href="' + esc(it.href) + '" target="_blank" rel="noopener">' + tr("Source", "Источник", "Manba") + ' ↗</a><a class="btn btn-ghost btn-sm" href="#contact" data-form="buyer">' + tr("Prepare via CORE", "Подготовить через CORE", "CORE orqali tayyorlash") + "</a>"
      : '<a class="btn btn-primary btn-sm" href="' + esc(/^app\//.test(href) && lang !== "en" ? "../" + href : href) + '">' + (it.st === "demo" ? tr("Open in the demo", "Открыть в демо", "Demoda ochish") : tr("Open", "Открыть", "Ochish")) + "</a>";
    if (account && (!currentUser || currentUser.role === "buyer")) {
      var saved = favoriteIds.indexOf(it.id) >= 0;
      actions += '<button type="button" class="favorite-button" data-favorite="' + esc(it.id) + '" aria-pressed="' + saved + '">' +
        (saved ? tr("Saved", "В избранном", "Saralanganlarda") : tr("Save dataset", "В избранное", "Saralanganlarga")) + '</button>';
    }
    var typeTag = it.t === "prep" ? '<a class="tag ' + ty[1] + '" href="' + esc(organizationUrl("ORG-CORE", lang)) + '">' + ty[0] + '</a>' : '<span class="tag ' + ty[1] + '">' + ty[0] + '</span>';
    return '<article class="cat-item card' + (ext ? "" : " cat-core") + '"><div class="cat-tags">' + typeTag + '<span class="st ' + st[1] + '">' + st[0] + "</span></div>" +
      '<div class="cat-card-title">' + cardArt(it) + "<h3>" + esc(L(it.title)) + '</h3></div><p class="cat-meta">' + meta.filter(Boolean).join(" · ") + "</p>" +
      (it.desc ? '<p class="cat-desc">' + esc(L(it.desc)) + "</p>" : "") +
      (usageResource?.ready ? renderDatasetUsage(usageResource.rows[it.id] || [], lang, true) : "") +
      '<div class="cat-foot"><span class="cat-facts">' + facts.join(" · ") + '</span><span class="cat-act">' + actions + "</span></div></article>";
  }

  return card;
}
