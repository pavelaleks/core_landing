import { DS_UNI, id } from "../api/demo-data.js";
import { esc, nf, date, pill, toast } from "../ui/format.js";
import { pipe, scanHtml, scanCsv } from "../ui/submission.js";
export function createSubmissionPages({ store, view, DS, ds, go }) {
  function vLegacyUni() {
    var S = store.s;
    var u = S.user, subs = S.submissions.filter(function (s) { return s.uni === u.uni; });
    var cat = DS.filter(function (d) { return DS_UNI[d.slug] === u.uni; });
    var reqs = S.requests.filter(function (r) { return cat.some(function (d) { return d.slug === r.ds; }); });
    view.innerHTML = '<span class="kicker">Кабинет вуза</span><h1>' + esc(u.uniName) + "</h1>" +
      '<p class="lead">Здесь видно, какие ваши наборы уже в каталоге, кто их запрашивает и на каком этапе проверки новые. Данные остаются собственностью вуза: покупатель получает лицензию на использование.</p>' +
      '<div class="facts"><div><b>' + cat.length + "</b><span>в каталоге</span></div><div><b>" + subs.filter(function (s) { return s.status < 4; }).length + "</b><span>на проверке</span></div><div><b>" + reqs.length + "</b><span>заявок покупателей</span></div><div><b>" + reqs.filter(function (r) { return r.status === "approved"; }).length + "</b><span>выдано доступов</span></div></div>" +
      '<div class="grid2"><div class="card"><b>Наборы в каталоге</b>' + (cat.length ? cat.map(function (d) {
        var n = reqs.filter(function (r) { return r.ds === d.slug; });
        return '<div class="item"><div><b>' + esc(d.title_ru) + '</b><div class="sub">' + nf(d.rows) + " записей · заявок: " + n.length + " · одобрено: " + n.filter(function (r) { return r.status === "approved"; }).length + "</div></div>" +
          '<div class="acts"><a class="btn btn-ghost btn-sm" href="#ds/' + d.slug + '">Открыть</a></div></div>';
      }).join("") : '<p class="empty">Пока нет. Загрузите первый набор — после проверки он появится здесь.</p>') + "</div>" +
      '<div class="card"><b>Заявки на ваши данные</b>' + (reqs.length ? reqs.map(function (r) {
        return '<div class="item"><div><b>' + esc(r.org) + '</b><div class="sub">' + esc(ds(r.ds).title_ru) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + "<br>«" + esc(r.purpose) + "»</div></div><div class=\"acts\">" + pill(r.status) + "</div></div>";
      }).join("") : '<p class="empty">Заявок пока нет.</p>') + "</div></div>" +
      '<h2>Загруженные наборы</h2><div class="card">' + (subs.length ? subs.map(function (s) {
        return '<div class="item"><div><b>' + esc(s.title) + '</b><div class="sub">' + s.id + " · " + esc(s.field) + " · " + date(s.created) + " · модель: " + (s.model === "ready" ? "готовые данные, вузу до 70%" : "CORE готовит, вузу 40–50%") + "</div>" + pipe(s.status) + scanHtml(s.file) + "</div></div>";
      }).join("") : '<p class="empty">Вы ещё ничего не загружали.</p>') + '<a class="btn btn-teal btn-sm" href="#uni/new" style="margin-top:14px">Загрузить набор</a></div>';
  }

  function vUniNew() {
    var S = store.s;
    view.innerHTML = '<a class="back" href="#uni">Кабинет университета</a><h1>Загрузить датасет</h1><p class="lead">Добавьте описание и выберите файл. В этой демо-версии проверка выполняется в браузере: сохраняются сведения о наборе, сам файл в CORE не отправляется.</p>' +
      '<form id="nf" class="card" style="margin-top:22px;max-width:760px">' +
      '<label class="f"><span>Название набора</span><input id="nT" required placeholder="Например, Наблюдения за засолением почв, 2019–2024"></label>' +
      '<label class="f"><span>Область</span><select id="nFld"><option>Язык и тексты</option><option>Социология и опросы</option><option>Медицина и здоровье</option><option>Агро, вода и экология</option><option>Биология и биохимия</option><option>История и наследие</option><option>Экономика и право</option><option>Другое</option></select></label>' +
      '<label class="f"><span>Коротко: что внутри, как собрано</span><textarea id="nD" required></textarea></label>' +
      '<label class="f"><span>Файл (CSV проверяется автоматически; до 20 МБ)</span><input type="file" id="nFile" required accept=".csv,.tsv,.txt,.xlsx,.xls,.zip,.json"></label><div id="scan"></div>' +
      '<h3 style="margin-top:20px">Права на данные</h3><p class="small muted">Все четыре пункта обязательны. В рабочей версии к ним прикладывается письмо вуза.</p>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Данные получены сотрудниками вуза или по проекту вуза</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Авторы согласны на лицензирование через CORE</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Персональных данных нет или они обезличены</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Грантодатель и партнёры не запрещают передачу</label>' +
      '<label class="f" style="margin-top:12px"><span>Кто подписывает со стороны вуза</span><input id="nS" required placeholder="ФИО, должность (например, проректор по науке)"></label>' +
      '<h3 style="margin-top:20px">Кто готовит данные</h3>' +
      '<label class="chk"><input type="radio" name="m" value="ready"> Данные уже очищены и описаны — вузу до 70% дохода</label>' +
      '<label class="chk"><input type="radio" name="m" value="process" checked> Нужна подготовка CORE (очистка, разметка, описание) — вузу 40–50% дохода</label>' +
      '<button class="btn btn-teal" style="margin-top:16px">Добавить в мои датасеты</button></form>';
    var fileInfo = null;
    document.getElementById("nFile").onchange = function () {
      var f = this.files[0], box = document.getElementById("scan"); fileInfo = null; if (!f) { box.innerHTML = ""; return; }
      if (f.size > 20 * 1048576) { box.innerHTML = '<p class="err">Файл больше 20 МБ — для прототипа загрузите выборку.</p>'; return; }
      fileInfo = { name: f.name, size: f.size, rows: null };
      if (!/\.(csv|tsv|txt)$/i.test(f.name)) { box.innerHTML = scanHtml(fileInfo); return; }
      var rd = new FileReader();
      rd.onload = function () { if (document.getElementById("nFile").files[0] !== f) return; fileInfo = Object.assign(fileInfo, scanCsv(String(rd.result))); box.innerHTML = scanHtml(fileInfo); };
      rd.readAsText(f);
    };
    document.getElementById("nf").onsubmit = function (e) {
      e.preventDefault(); if (!this.reportValidity() || !fileInfo) return;
      if (!document.getElementById("nT").value.trim() || !document.getElementById("nD").value.trim()) { toast("Заполните название и описание датасета."); return; }
      var now = Date.now();
      S.submissions.unshift({ id: id("S"), uni: S.user.uni, uniName: S.user.uniName, title: document.getElementById("nT").value.trim(), field: document.getElementById("nFld").value,
        desc: document.getElementById("nD").value.trim(), model: (document.querySelector("input[name=m]:checked") || {}).value || "process", status: 0, created: now, file: fileInfo,
        rights: { own: true, authors: true, personal: true, funder: true }, signer: document.getElementById("nS").value.trim(), log: [{ t: now, s: 0 }] });
      var saved = store.save(); toast(saved ? "Описание датасета сохранено в этом браузере." : "Описание добавлено на время сеанса: браузер не разрешил сохранение."); go("#uni");
    };
  }

  return { vLegacyUni, vUniNew };
}
