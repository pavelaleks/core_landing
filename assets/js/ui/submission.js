import { STEPS } from "../api/demo-data.js";
import { esc, nf } from "./format.js";

export function pipe(st) {
  return '<div class="pipe">' + STEPS.map(function (s, i) { return '<span class="' + (i < st ? "done" : i === st ? (st === 4 ? "done" : "cur") : "") + '">' + (i < st || st === 4 ? "✓ " : "") + s + "</span>"; }).join("") + "</div>";
}

export function scanHtml(f) {
  if (!f) return "";
  var li = ["Файл: " + esc(f.name) + " · " + Math.max(1, Math.round(f.size / 1024)) + " КБ"];
  if (f.rows != null) {
    li.push(nf(f.rows) + " строк, " + f.cols + " столбцов, пустых ячеек " + Math.round(f.empty * 100) + "%");
    li.push(f.pii.length ? '<span class="err">Похоже на персональные данные: ' + esc(f.pii.join("; ")) + ". Нужно обезличить до продажи.</span>" : '<span class="ok">Персональных данных не найдено (имена, телефоны, e-mail, паспорт, ПИНФЛ/ИИН)</span>');
  } else li.push("Автоматическая проверка доступна для CSV; этот файл проверит оператор вручную.");
  return '<ul class="scan">' + li.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
}

export function scanCsv(txt) {
  var lines = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
  var sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : lines[0].indexOf("\t") >= 0 ? "\t" : ",";
  var head = lines[0].split(sep).map(function (h) { return h.replace(/^"|"$/g, "").trim(); });
  var body = lines.slice(1), cells = 0, empty = 0, pii = [];
  var H = /(^|_|\b)(name|fio|фио|имя|фамилия|familiya|ism|otasining|phone|tel|телефон|email|e-mail|почта|passport|паспорт|pinfl|пинфл|iin|иин|address|адрес|manzil|birth|рождени|tug.?ilgan)/i;
  head.forEach(function (h) { if (H.test(h)) pii.push("столбец «" + h + "»"); });
  var em = 0, ph = 0, idn = 0;
  body.slice(0, 5000).forEach(function (l) {
    var c = l.split(sep); cells += head.length;
    c.forEach(function (v) {
      v = v.replace(/^"|"$/g, "").trim(); if (!v) empty++;
      if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(v)) em++;
      if (/(\+?998|\+?7)[\s(-]*\d{2,3}[\s)-]*\d{3}[\s-]?\d{2}[\s-]?\d{2}/.test(v)) ph++;
      if (/^\d{12}$|^\d{14}$/.test(v)) idn++;
    });
    empty += Math.max(0, head.length - c.length);
  });
  if (em) pii.push(em + " адрес(ов) e-mail");
  if (ph) pii.push(ph + " номер(ов) телефона");
  if (idn) pii.push(idn + " значений, похожих на ПИНФЛ/ИИН");
  return { rows: body.length, cols: head.length, empty: cells ? empty / cells : 0, pii: pii };
}
