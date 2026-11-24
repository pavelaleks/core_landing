import { allRows } from "./query.js";

const order = ["metadata-only", "by-agreement", "open-cc-by-4-0"];
export const LICENSE_COLUMNS = "id,name,description,document_path,version";
export const localLicenseText = (value, lang = "ru") => value?.[lang] || value?.ru || value?.en || value?.uz || "";
export const licenseName = (license, lang = "ru") => localLicenseText(license?.name, lang);
export const licenseDescription = (license, lang = "ru") => localLicenseText(license?.description, lang);
export function licenseUrl(license) {
  const path = license?.document_path;
  return typeof path === "string" && /^documents\/[a-z0-9-]+\.html$/.test(path) ? new URL(path, new URL("../../../", import.meta.url)).href : "";
}
export function listLicenses() {
  return allRows("licenses", LICENSE_COLUMNS, query => query.order("id")).then(rows => rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)));
}
export function publicationLicenseMessage(record, lang = "ru") {
  const tr = (en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;
  if (!record.license_id) return tr("Choose a license before publishing.", "Выберите лицензию перед публикацией.", "Eʼlon qilishdan oldin litsenziyani tanlang.");
  if (record.license_id !== "open-cc-by-4-0" && record.links?.some(link => link.type === "data")) {
    return tr("This license publishes the description only. Remove public links to data files before publishing.", "Эта лицензия предусматривает публикацию описания. Перед публикацией уберите ссылки на файлы данных.", "Bu litsenziya faqat tavsifni eʼlon qilishni nazarda tutadi. Eʼlon qilishdan oldin maʼlumotlar fayllariga havolalarni olib tashlang.");
  }
  return "";
}
