import { authErrorMessage } from "../api/auth.js";
import { esc } from "../ui/format.js";

export function createAuthAccountPages({ store, auth, view, go, onLogin }) {
  let email = "";
  const message = text => { document.getElementById("accountMessage").textContent = text; };
  const status = '<p id="accountMessage" class="auth-message" role="status" aria-live="polite"></p>';
  const password = (label, autocomplete = "new-password", describedBy = "") =>
    '<label class="f"><span>' + label + '</span><input name="password" type="password" autocomplete="' + autocomplete + '"' +
    (describedBy ? ' aria-describedby="' + describedBy + '"' : "") + ' required minlength="6"></label>';

  function bindSubmit(work) {
    const form = document.getElementById("accountForm");
    form.onsubmit = async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const button = form.querySelector('button[type="submit"]');
      const output = document.getElementById("accountMessage");
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      output.textContent = "";
      try { await work(form, output); }
      catch (error) { output.textContent = authErrorMessage(error); }
      finally { button.disabled = false; form.removeAttribute("aria-busy"); }
    };
  }

  function vLogin(register) {
    view.innerHTML = '<div class="auth-layout"><div class="auth-intro"><span class="kicker">Личный кабинет CORE</span><h1>' +
      (register ? "Создайте аккаунт CORE" : "С возвращением") + '</h1><p class="lead">' +
      (register ? "Для регистрации достаточно email и пароля." : "Войдите в личный кабинет с вашим email и паролем.") + '</p></div>' +
      '<div class="card auth-card"><div class="auth-tabs"><a href="#login"' + (!register ? ' aria-current="page"' : "") + '>Вход</a><a href="#register"' + (register ? ' aria-current="page"' : "") + '>Регистрация</a></div>' +
      '<form id="accountForm"><label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required maxlength="254" value="' + esc(email) + '"></label>' +
      password("Пароль", register ? "new-password" : "current-password", register ? "accountPasswordHint" : "") +
      (register ? '<p id="accountPasswordHint" class="auth-hint">Не менее 6 символов.</p>' +
        '<label class="f"><span>Ваше имя <span class="field-optional">Необязательно</span></span><input name="name" autocomplete="name" maxlength="120"></label>' +
        '<label class="f"><span>Компания или университет <span class="field-optional">Необязательно</span></span><input name="org" autocomplete="organization" maxlength="200"></label>' +
        '<fieldset class="account-roles"><legend>Я представляю</legend><label><input type="radio" name="accountType" value="university" checked> Университет</label><label><input type="radio" name="accountType" value="buyer"> Партнёра</label></fieldset>' : "") +
      '<button class="btn btn-primary btn-block" type="submit">' + (register ? "Зарегистрироваться" : "Войти") + '</button>' + status + '</form></div></div>';
    if (store.auth.notice) { message(store.auth.notice); store.auth.notice = null; }
    bindSubmit(async (form, output) => {
      email = form.elements.email.value.trim();
      if (register) {
        await auth.signUp({
          email, password: form.elements.password.value, name: form.elements.name.value,
          org: form.elements.org.value, accountType: form.elements.accountType.value,
        });
        form.elements.password.value = "";
        onLogin();
      } else {
        await auth.signIn({ email, password: form.elements.password.value });
        form.elements.password.value = "";
        onLogin();
      }
    });
  }

  function vPassword() {
    view.innerHTML = '<a class="back" href="#account">Личный кабинет</a><h1>Новый пароль</h1>' +
      '<form id="accountForm" class="card auth-card">' + password("Новый пароль") +
      '<label class="f"><span>Повторите новый пароль</span><input name="confirmation" type="password" autocomplete="new-password" required minlength="6"></label>' +
      '<button class="btn btn-primary" type="submit">Сохранить пароль</button>' + status + '</form>';
    bindSubmit(async (form, output) => {
      if (form.elements.password.value !== form.elements.confirmation.value) { output.textContent = "Пароли не совпадают."; return; }
      await auth.updatePassword(form.elements.password.value);
      form.reset();
      store.auth.notice = "Пароль изменён.";
      go("#account");
    });
  }

  function vProfile() {
    const user = store.load().user;
    view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">Личный кабинет CORE</span><h1>' + esc(user.name || "Мой аккаунт") + '</h1><p class="lead">Данные вашего аккаунта.</p></div></div>' +
      '<div class="card auth-profile"><dl><dt>Email</dt><dd>' + esc(user.email) + '</dd><dt>Имя</dt><dd>' + esc(user.name || "Не указано") + '</dd><dt>Компания или университет</dt><dd>' + esc(user.org || "Не указаны") + '</dd></dl>' +
      '<div class="saved-actions"><a class="btn btn-ghost btn-sm" href="#password">Изменить пароль</a><a class="btn btn-ghost btn-sm" href="' + esc(store.catalogUrl("ru")) + '">Открыть каталог</a></div>' +
      '<p id="accountMessage" class="auth-message" role="status">' + esc(store.auth.notice || "") + '</p></div>';
    store.auth.notice = null;
  }

  function vLoading() { view.innerHTML = '<p class="lead" role="status">Проверяем вход…</p>'; }
  function vConnectionError(retry) {
    view.innerHTML = '<h1>Не удалось проверить вход</h1><p class="err" role="alert">' + esc(store.auth.error || "Проверьте соединение и попробуйте снова.") + '</p><button class="btn btn-primary" id="retryAuth">Повторить</button>';
    document.getElementById("retryAuth").onclick = retry;
  }
  return { vLogin, vPassword, vProfile, vLoading, vConnectionError };
}
