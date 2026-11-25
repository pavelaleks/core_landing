import { authenticateDemo } from "../api/demo-auth.js";
import { getCatalog } from "../api/datasets.js";
import { STEPS, DS_UNI } from "../api/demo-data.js";
import { esc, date } from "../ui/format.js";
import { scanHtml } from "../ui/submission.js";
import { datasetUrl } from "../url.js";

export function createAccountPages({ store, view, DS, UNIS, go, home }) {
  function favoriteContinuation() {
    var value = location.hash.split("/favorite/")[1];
    try { return value ? decodeURIComponent(value) : ""; } catch (e) { return ""; }
  }

  function finishLogin(favorite) {
    var S = store.s;
    if (favorite && S.user.role === "buyer" && (getCatalog() || []).some(function (d) { return d.id === favorite; }) && store.favoriteIds().indexOf(favorite) < 0) store.toggleFavorite(favorite);
    S = store.s;
    go(home());
  }

  function vLogin() {
    var S = store.s;
    var register = location.hash.indexOf("#register") === 0, favorite = favoriteContinuation();
    var suffix = favorite ? "/favorite/" + encodeURIComponent(favorite) : "";
    view.innerHTML = '<div class="auth-layout"><div class="auth-intro"><span class="kicker">Личный кабинет CORE</span><h1>' + (register ? "Ваше пространство данных" : "С возвращением") + '</h1>' +
      '<p class="lead">Университет собирает свои датасеты в одном месте. Партнёр сохраняет подходящие наборы из общего каталога.</p>' +
      '<p class="demo-note">Демонстрационная версия: вход по email без пароля. Профили и избранное сохраняются только в этом браузере.</p></div>' +
      '<div class="card auth-card"><div class="auth-tabs"><a href="#login' + suffix + '"' + (!register ? ' aria-current="page"' : "") + '>Войти</a><a href="#register' + suffix + '"' + (register ? ' aria-current="page"' : "") + '>Зарегистрироваться</a></div>' +
      '<form id="accountForm"><label class="f"><span>Рабочий email</span><input name="email" type="email" autocomplete="email" required maxlength="254"></label>' +
      (register ? '<label class="f"><span>Ваше имя</span><input name="name" autocomplete="name" required maxlength="120"></label>' +
        '<fieldset class="account-roles"><legend>Я представляю</legend><label><input type="radio" name="role" value="university" checked> Университет</label><label><input type="radio" name="role" value="buyer"> Партнёра</label></fieldset>' +
        '<label class="f" id="accountUni"><span>Университет</span><input name="university" list="accountUnis" required placeholder="Начните вводить название"><datalist id="accountUnis">' + UNIS.map(function (u) { return '<option value="' + esc(u.label) + '">'; }).join("") + '</datalist></label>' +
        '<label class="f" id="accountOrg" hidden><span>Организация</span><input name="org" autocomplete="organization" disabled maxlength="200"></label>' : "") +
      '<button class="btn btn-primary btn-block" type="submit">' + (register ? "Создать демо-профиль" : "Войти в демо-кабинет") + '</button><p id="accountError" class="err" role="status"></p></form></div></div>';
    var f = document.getElementById("accountForm");
    if (register) f.onchange = function () {
      var university = f.elements.role.value === "university";
      document.getElementById("accountUni").hidden = !university;
      document.getElementById("accountOrg").hidden = university;
      f.elements.university.disabled = !university; f.elements.university.required = university;
      f.elements.org.disabled = university; f.elements.org.required = !university;
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var result = authenticateDemo({
        register: register, email: f.elements.email.value,
        role: register ? f.elements.role.value : "",
        university: register ? f.elements.university.value : "",
        org: register ? f.elements.org.value : "",
        name: register ? f.elements.name.value : ""
      }, UNIS);
      if (result.error) { document.getElementById("accountError").textContent = result.error; return; }
      finishLogin(favorite);
    };
  }

  function vFavorites() {
    var S = store.s;
    var ids = store.favoriteIds(), catalog = getCatalog() || [];
    var favorites = ids.map(function (id) { return catalog.filter(function (d) { return d.id === id; })[0]; }).filter(Boolean);
    view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">Личный кабинет</span><h1>Избранные датасеты</h1><p class="lead">Ваша подборка для будущих проектов и сотрудничества.</p></div><a class="btn btn-primary" href="' + store.catalogUrl("ru") + '">Найти данные</a></div>' +
      (favorites.length ? '<div class="saved-grid">' + favorites.map(function (d) {
        var url = datasetUrl(d, "ru");
        return '<article class="card saved-card"><p class="small muted">' + esc(d.org.ru || d.org.en) + '</p><h2><a href="' + esc(url) + '">' + esc(d.title.ru || d.title.en) + '</a></h2>' +
          (d.desc ? '<p>' + esc(d.desc.ru || d.desc.en || "") + '</p>' : "") + '<div class="saved-actions"><a class="btn btn-ghost btn-sm" href="' + esc(url) + '">О наборе</a><button class="remove-favorite" data-remove-favorite="' + esc(d.id) + '">Убрать из избранного</button></div></article>';
      }).join("") + '</div>' : '<div class="card cabinet-empty"><h2>Сохраните первый датасет</h2><p>Откройте общий каталог и нажмите «В избранное» на подходящей карточке. Здесь появится ваша подборка.</p><a class="btn btn-ghost" href="' + store.catalogUrl("ru") + '">Перейти в каталог</a></div>') +
      (store.isDemo ? '<p class="cabinet-secondary"><a class="mvp-link" href="#my">Мои заявки на доступ</a></p>' : '<p class="cabinet-secondary">Избранное сохраняется только в этом браузере.</p>');
    Array.prototype.forEach.call(view.querySelectorAll("[data-remove-favorite]"), function (b) { b.onclick = function () { store.toggleFavorite(b.getAttribute("data-remove-favorite")); S = store.s; vFavorites(); }; });
  }

  function vUni() {
    var S = store.s;
    var user = S.user, submissions = S.submissions.filter(function (s) { return s.uni === user.uni; });
    var published = DS.filter(function (d) { return DS_UNI[d.slug] === user.uni; });
    view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">' + esc(user.uniName || user.org) + '</span><h1>Мои датасеты</h1><p class="lead">Результаты исследований вашего университета в одном месте.</p></div><a class="btn btn-primary" href="#uni/new"><span aria-hidden="true">+</span> Загрузить датасет</a></div>' +
      (!submissions.length && !published.length ? '<div class="card cabinet-empty"><h2>Добавьте первый датасет</h2><p>Укажите название и описание, затем выберите файл. В демо сохранится описание набора; файл останется у вас.</p><a class="btn btn-ghost" href="#uni/new">Загрузить датасет</a></div>' :
      '<div class="university-list">' + submissions.map(function (s) {
        return '<article class="card university-dataset"><div><span class="dataset-status">' + esc(s.status === 0 ? "Описание сохранено · демо" : STEPS[s.status] || STEPS[0]) + '</span><h2>' + esc(s.title) + '</h2><p>' + esc(s.desc) + '</p><p class="small muted">' + esc(s.field) + ' · ' + date(s.created) + '</p></div>' +
          '<details><summary>Описание загрузки</summary><p>' + esc(s.file && s.file.name || "") + '</p>' + scanHtml(s.file || {}) + '<p class="small muted">В демо сохранены сведения о файле, без передачи в CORE.</p></details></article>';
      }).join("") + published.map(function (d) { return '<article class="card university-dataset"><div><span class="dataset-status">Демонстрационный пример</span><h2>' + esc(d.title_ru) + '</h2><p>' + esc(d.buyers_ru) + '</p></div><a class="btn btn-ghost btn-sm" href="#ds/' + d.slug + '">Открыть</a></article>'; }).join("") + '</div>') +
      '<p class="cabinet-secondary"><a class="mvp-link" href="#uni/legacy">Заявки и этапы обработки</a></p>';
  }

  return { vLogin, vFavorites, vUni };
}
