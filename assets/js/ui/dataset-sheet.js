import { esc } from "./format.js";

const sectionNames = {
  data: ["Data and insights", "Данные и инфографика", "Maʼlumotlar va infografika"],
  api: ["API and examples", "API и примеры", "API va misollar"],
  passport: ["Datasheet and quality", "Паспорт и качество", "Toʻplam pasporti va sifat"],
  access: ["Access and terms", "Доступ и условия", "Kirish va shartlar"],
};

export function sheetSection(key, body, lang = "ru") {
  if (!body) return "";
  const title = sectionNames[key][lang === "en" ? 0 : lang === "uz" ? 2 : 1];
  return '<details class="sheet-section" id="sheet-' + key + '"' + (key === "data" ? " open" : "") + '><summary>' + title + '</summary><div class="sheet-body">' + body + '</div></details>';
}

export function sheetFacts(values) {
  const facts = values.filter(value => value != null && value !== "");
  return facts.length ? '<p class="sheet-facts">' + facts.map(value => '<span>' + esc(value) + '</span>').join("") + '</p>' : "";
}

export function sheetMeta(rows) {
  const entries = rows.filter(([, value]) => value != null && value !== "");
  return entries.length ? '<dl class="sheet-meta">' + entries.map(([label, value]) => '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>').join("") + '</dl>' : "";
}

export function openSheetSection(view, key) {
  const details = view.querySelector("#sheet-" + key);
  if (!details) return;
  details.open = true;
  details.querySelector("summary").focus({ preventScroll: true });
  details.scrollIntoView({ block: "start" });
}

export function wireSheetActions(view) {
  for (const button of view.querySelectorAll("[data-sheet-open]")) {
    button.onclick = () => openSheetSection(view, button.dataset.sheetOpen);
  }
}

export function datasetSheet(slots) {
  const template = document.getElementById("dataset-card-template");
  return template.innerHTML.replace(/\{\{(\w+)\}\}/g, (_, name) => slots[name] || "");
}
