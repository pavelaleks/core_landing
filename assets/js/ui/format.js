export function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

export function nf(n) { return Number(n).toLocaleString("ru-RU"); }

export function date(t) { return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); }

export function toast(msg) {
  var d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d);
  setTimeout(function () { d.remove(); }, 3600);
}

export function pill(st) {
  var m = { pending: ["На рассмотрении", "p-wait"], approved: ["Доступ открыт", "p-ok"], declined: ["Отклонено", "p-no"] }[st];
  return '<span class="pill ' + m[1] + '">' + m[0] + "</span>";
}
