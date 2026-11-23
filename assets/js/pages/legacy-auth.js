import { INVITE, ROLES } from "../api/demo-data.js";
import { esc } from "../ui/format.js";
export function createLegacyAuth({ store, view, UNIS, go }) {
  function legacyHeader() {
    var S = store.s;
    var nav = document.getElementById("nav"), who = document.getElementById("who");
    if (!S.user) { nav.hidden = who.hidden = true; return; }
    nav.hidden = who.hidden = false;
    var r = S.user.role, h = location.hash || "", links;
    var pend = S.requests.filter(function (x) { return x.status === "pending"; }).length + S.submissions.filter(function (x) { return x.status < 4; }).length;
    if (r === "buyer") links = [["#catalog", "Каталог"], ["#my", "Мои заявки"]];
    else if (r === "university") links = [["#uni", "Наши наборы"], ["#uni/new", "Загрузить набор"], ["#catalog", "Каталог"]];
    else links = [["#ops", "Очередь" + (pend ? '<span class="cnt">' + pend + "</span>" : "")], ["#catalog", "Каталог"]];
    nav.innerHTML = links.map(function (l) { return '<a href="' + l[0] + '" class="' + (h === l[0] || (l[0] === "#catalog" && h.indexOf("#ds/") === 0) ? "on" : "") + '">' + l[1] + "</a>"; }).join("");
    who.innerHTML = '<span class="lbl">' + esc(S.user.org) + '</span><select id="roleSel" aria-label="Роль">' +
      Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (k === r ? " selected" : "") + ">" + ROLES[k] + "</option>"; }).join("") +
      '</select><a href="#" id="logout" class="mvp-link">Выйти</a>';
    document.getElementById("roleSel").onchange = function () { switchRole(this.value); };
    document.getElementById("logout").onclick = function (e) { e.preventDefault(); S.user = null; store.save(); go("#login"); };
  }

  function switchRole(role) {
    var S = store.s;
    var prev = S.user || {};
    S.user = { role: role, org: role === "operator" ? "CORE" : role === "university" ? (prev.uniName || "Гулистанский государственный университет") : (prev.buyerOrg || "Моя компания"),
      uni: role === "university" ? (prev.uni || "UNI-UZ-0017") : prev.uni, uniName: prev.uniName || "Гулистанский государственный университет", buyerOrg: prev.buyerOrg || "Моя компания" };
    if (role === "buyer") S.user.org = S.user.buyerOrg;
    if (role === "university") S.user.org = S.user.uniName;
    store.save();
    go(role === "buyer" ? "#catalog" : role === "university" ? "#uni" : "#ops");
  }

  function vLegacyLogin() {
    var ok = false; try { ok = sessionStorage.getItem("core-invite") === "1" || localStorage.getItem("core-invite") === "1"; } catch (e) {}
    view.innerHTML =
      '<span class="kicker">Закрытый прототип · вход по приглашению</span>' +
      "<h1>Кабинет CORE</h1>" +
      '<p class="lead">Здесь можно пройти весь путь данных: вуз загружает набор и подтверждает права, CORE проверяет и размечает, покупатель получает готовый пакет. ' +
      "В каталоге — три настоящих набора учёных из Узбекистана и Казахстана, подготовленные CORE.</p>" +
      (ok ? "" :
        '<div class="card" style="margin-top:24px;max-width:520px"><form id="inv"><label class="f"><span>Код приглашения</span><input id="code" autocomplete="off" placeholder="Например, CORE-…"></label>' +
        '<button class="btn btn-primary btn-sm">Продолжить</button><div class="err" id="ierr" hidden>Код не подошёл. Попросите код у команды CORE: pavel.alekseev.gasu@gmail.com</div></form></div>') +
      '<div id="roles"' + (ok ? "" : " hidden") + ">" +
      "<h2>Кем вы входите?</h2>" +
      '<div class="grid3">' +
      '<button class="card role-card" data-role="buyer"><span class="rc-k">Покупатель</span><b>Мне нужны данные</b><p>Компания, разработчик ИИ, страховая, фарма, госорган. Найти набор, посмотреть, что внутри, запросить доступ и скачать.</p></button>' +
      '<button class="card role-card" data-role="university"><span class="rc-k">Вуз</span><b>У нас есть данные</b><p>Сотрудник, уполномоченный вузом. Загрузить набор, подтвердить права, следить за проверкой и заявками.</p></button>' +
      '<button class="card role-card" data-role="operator"><span class="rc-k">Оператор CORE</span><b>Проверяю и выдаю доступ</b><p>Команда CORE. Одобрить заявки покупателей, провести набор вуза через проверку прав и разметку.</p></button>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><b>Сценарий проверки за 5 минут</b><ol class="steps">' +
      "<li>Войдите как <b>покупатель</b>, откройте любой набор, посмотрите «до и после» и отправьте заявку.</li>" +
      "<li>Переключитесь на <b>оператора CORE</b> (меню вверху справа) и одобрите заявку.</li>" +
      "<li>Вернитесь покупателем — скачайте пакет (данные, описание переменных на трёх языках, отчёт о качестве, лицензию) или получите ключ API и выполните SQL-запрос прямо на странице.</li>" +
      "<li>Войдите как <b>вуз</b> и загрузите свой CSV — система сразу проверит его, в том числе на персональные данные.</li>" +
      "<li>Оператором проведите набор вуза по этапам до каталога.</li></ol></div>" +
      '<div class="card" id="whoForm" hidden style="margin-top:16px;max-width:620px"></div></div>';
    var inv = document.getElementById("inv");
    if (inv) inv.onsubmit = function (e) {
      e.preventDefault();
      if (document.getElementById("code").value.trim().toUpperCase() === INVITE) {
        try { localStorage.setItem("core-invite", "1"); } catch (x) {}
        inv.parentNode.hidden = true; document.getElementById("roles").hidden = false;
      } else document.getElementById("ierr").hidden = false;
    };
    Array.prototype.forEach.call(document.querySelectorAll(".role-card"), function (b) {
      b.onclick = function () { askWho(b.getAttribute("data-role")); };
    });
  }

  function askWho(role) {
    var S = store.s;
    var f = document.getElementById("whoForm"); f.hidden = false;
    if (role === "operator") { S.user = { role: "operator", org: "CORE" }; store.save(); go("#ops"); return; }
    if (role === "buyer") {
      f.innerHTML = '<form id="wf"><b>Покупатель</b><label class="f" style="margin-top:12px"><span>Организация</span><input id="wOrg" required placeholder="Например, ООО «Страховая компания»"></label>' +
        '<label class="f"><span>Ваше имя</span><input id="wName" required></label><button class="btn btn-primary btn-sm">Войти</button></form>';
      document.getElementById("wf").onsubmit = function (e) {
        e.preventDefault(); var o = document.getElementById("wOrg").value.trim();
        S.user = { role: "buyer", org: o, buyerOrg: o, name: document.getElementById("wName").value.trim() }; store.save(); go("#catalog");
      };
    } else {
      f.innerHTML = '<form id="wf"><b>Вуз</b><label class="f" style="margin-top:12px"><span>Ваш университет (справочник CORE, 397 вузов)</span><input id="wUni" list="uniList" required placeholder="Начните вводить название"><datalist id="uniList">' +
        UNIS.map(function (u) { return '<option value="' + esc(u.label) + '">'; }).join("") + "</datalist></label>" +
        '<label class="f"><span>Ваше имя и должность</span><input id="wName" required placeholder="Например, начальник научного отдела"></label>' +
        '<p class="small muted" style="margin-bottom:12px">В рабочей версии вход в кабинет вуза получает только сотрудник, которого вуз назначил письмом. Для демо подсказка: Гулистанский, Ургенчский госуниверситет или КазНМУ — у них уже есть наборы в каталоге.</p>' +
        '<button class="btn btn-primary btn-sm">Войти</button><div class="err" id="werr" hidden>Выберите вуз из списка</div></form>';
      document.getElementById("wf").onsubmit = function (e) {
        e.preventDefault(); var v = document.getElementById("wUni").value.trim();
        var u = UNIS.filter(function (x) { return x.label === v; })[0];
        if (!u) { document.getElementById("werr").hidden = false; return; }
        S.user = { role: "university", org: u.name, uni: u.id, uniName: u.name, name: document.getElementById("wName").value.trim() }; store.save(); go("#uni");
      };
    }
    f.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return { legacyHeader, switchRole, vLegacyLogin };
}
