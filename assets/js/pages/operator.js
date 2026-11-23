import { STEPS } from "../api/demo-data.js";
import { esc, date, pill, toast } from "../ui/format.js";
import { pipe, scanHtml } from "../ui/submission.js";
export function createOperatorPage({ store, view, ds, render }) {
  function vOps() {
    var S = store.s;
    var pend = S.requests.filter(function (r) { return r.status === "pending"; }), done = S.requests.filter(function (r) { return r.status !== "pending"; });
    var subs = S.submissions;
    view.innerHTML = '<span class="kicker">Оператор CORE</span><h1>Очередь</h1>' +
      '<div class="facts"><div><b>' + pend.length + "</b><span>заявок ждут решения</span></div><div><b>" + subs.filter(function (s) { return s.status < 4; }).length + "</b><span>наборов вузов в работе</span></div><div><b>" + S.requests.filter(function (r) { return r.status === "approved"; }).length + "</b><span>доступов выдано</span></div><div><b>" + S.downloads + "</b><span>скачиваний</span></div></div>" +
      '<h2>Заявки покупателей</h2><div class="card">' + (pend.length ? pend.map(function (r) {
        var d = ds(r.ds);
        return '<div class="item"><div><b>' + esc(r.org) + "</b> → " + esc(d.title_ru) + '<div class="sub">' + r.id + " · " + date(r.created) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + "<br>«" + esc(r.purpose) + "»</div></div>" +
          '<div class="acts"><button class="btn btn-teal btn-sm" data-ap="' + r.id + '">Одобрить</button><button class="btn btn-ghost btn-sm" data-dc="' + r.id + '">Отклонить</button></div></div>';
      }).join("") : '<p class="empty">Новых заявок нет.</p>') +
      (done.length ? '<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Решённые (' + done.length + ")</summary>" + done.map(function (r) { return '<div class="item"><div>' + esc(r.org) + " → " + esc(ds(r.ds).title_ru) + '</div><div class="acts">' + pill(r.status) + "</div></div>"; }).join("") + "</details>" : "") + "</div>" +
      '<h2>Наборы от вузов</h2><div class="card">' + (subs.length ? subs.map(function (s) {
        return '<div class="item"><div><b>' + esc(s.title) + '</b><div class="sub">' + esc(s.uniName) + " · " + s.id + " · подписант: " + esc(s.signer) + " · " + (s.model === "ready" ? "готовые данные" : "готовит CORE") + "</div>" + pipe(s.status) + scanHtml(s.file) + "</div>" +
          '<div class="acts">' + (s.status < 4 ? '<button class="btn btn-teal btn-sm" data-nx="' + s.id + '">' + (s.status === 3 ? "Опубликовать" : "Этап пройден →") + "</button>" : '<span class="pill p-ok">В каталоге</span>') + "</div></div>";
      }).join("") : '<p class="empty">Вузы пока ничего не загрузили.</p>') + "</div>" +
      '<p class="small muted" style="margin-top:14px">Опубликованный набор вуза в прототипе отмечается как «в каталоге»; в рабочей версии CORE выкладывает его вместе с паспортом и разметкой, как три набора в каталоге.</p>';
    Array.prototype.forEach.call(document.querySelectorAll("[data-ap],[data-dc]"), function (b) {
      b.onclick = function () {
        var rid = b.getAttribute("data-ap") || b.getAttribute("data-dc"), r = S.requests.filter(function (x) { return x.id === rid; })[0];
        r.status = b.hasAttribute("data-ap") ? "approved" : "declined"; r.decided = Date.now(); store.save();
        toast(r.status === "approved" ? "Доступ открыт. Переключитесь в роль покупателя, чтобы скачать пакет." : "Заявка отклонена."); render();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-nx]"), function (b) {
      b.onclick = function () {
        var s = S.submissions.filter(function (x) { return x.id === b.getAttribute("data-nx"); })[0];
        if (s.status === 2 && s.file && s.file.pii && s.file.pii.length && !confirm("В файле найдены признаки персональных данных. Подтверждаете, что вуз прислал обезличенную версию?")) return;
        s.status++; s.log.push({ t: Date.now(), s: s.status }); store.save(); toast("«" + s.title + "»: " + STEPS[s.status]); render();
      };
    });
  }

  return { vOps };
}
