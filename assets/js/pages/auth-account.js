import { authErrorMessage } from "../api/auth.js";
import { esc } from "../ui/format.js";
import { createProfile, ORGANIZATION_ROLES } from "../api/profiles.js";
import { organizationName, organizationUrl } from "../api/organizations.js";
import { databaseMessage } from "../api/query.js";
import { organizationFields, bindOrganizationFields } from "../ui/organization-fields.js";

export function createAuthAccountPages({ store, auth, view, go, onLogin, getProfileState, onProfileSaved }) {
  let email = "";
  const message = text => { document.getElementById("accountMessage").textContent = text; };
  const status = '<p id="accountMessage" class="auth-message" role="status" aria-live="polite"></p>';
  const password = (label, autocomplete = "new-password", describedBy = "") =>
    '<label class="f"><span>' + label + '</span><input name="password" type="password" autocomplete="' + autocomplete + '"' +
    (describedBy ? ' aria-describedby="' + describedBy + '"' : "") + ' required minlength="6"></label>';

  function bindSubmit(work, errorMessage = authErrorMessage) {
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
      catch (error) { output.textContent = errorMessage(error); }
      finally { button.disabled = false; form.removeAttribute("aria-busy"); }
    };
  }

  function vLogin(register) {
    const continuation = /\/favorite\/[^/]+$/.exec(location.hash)?.[0] || "";
    view.innerHTML = '<div class="auth-layout"><div class="auth-intro"><span class="kicker">Личный кабинет CORE</span><h1>' +
      (register ? "Создайте аккаунт CORE" : "С возвращением") + '</h1><p class="lead">' +
      (register ? "Выберите университет или укажите компанию. После подтверждения CORE вы сможете публиковать датасеты." : "Войдите в личный кабинет с вашим email и паролем.") + '</p></div>' +
      '<div class="card auth-card"><div class="auth-tabs"><a href="#login' + continuation + '"' + (!register ? ' aria-current="page"' : "") + '>Вход</a><a href="#register' + continuation + '"' + (register ? ' aria-current="page"' : "") + '>Регистрация</a></div>' +
      '<form id="accountForm"><label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false" required maxlength="254" value="' + esc(email) + '"></label>' +
      password("Пароль", register ? "new-password" : "current-password", register ? "accountPasswordHint" : "") +
      (register ? '<p id="accountPasswordHint" class="auth-hint">Не менее 6 символов.</p>' +
        '<label class="f"><span>Ваше имя <span class="field-optional">Необязательно</span></span><input name="name" autocomplete="name" maxlength="120"></label>' +
        organizationFields() + '<p class="account-verification-note">Аккаунт ожидает подтверждения CORE. До подтверждения можно готовить черновики; после — публиковать от имени организации.</p>' : "") +
      '<button class="btn btn-primary btn-block" type="submit">' + (register ? "Зарегистрироваться" : "Войти") + '</button>' + status + '</form></div></div>';
    if (!register) view.querySelector(".auth-card").insertAdjacentHTML("beforeend", '<a class="mvp-link auth-forgot" href="#reset-password">Забыли пароль?</a>');
    const organizationInput = register ? bindOrganizationFields(document.getElementById("accountForm")) : null;
    if (store.auth.notice) { message(store.auth.notice); store.auth.notice = null; }
    bindSubmit(async (form, output) => {
      email = form.elements.email.value.trim();
      if (register) {
        const organization = organizationInput();
        if (!organization) return;
        const input = { email, password: form.elements.password.value, name: form.elements.name.value, ...organization };
        let accountCreated = false;
        store.auth.registrationPending = true;
        try {
          const result = await auth.signUp(input);
          accountCreated = true;
          await createProfile(result.user?.id || result.session.user.id, input);
          store.auth.notice = "Аккаунт создан. Подтверждение выполняет команда CORE.";
        } catch (error) {
          if (!accountCreated) throw error;
          store.auth.notice = "Аккаунт создан, но профиль не сохранён. Завершите регистрацию. " + databaseMessage(error);
        } finally {
          store.auth.registrationPending = false;
          if (accountCreated) { onProfileSaved(); onLogin(); }
        }
      } else {
        await auth.signIn({ email, password: form.elements.password.value });
        form.elements.password.value = "";
        onLogin();
      }
    });
  }

  function vCompleteProfile() {
    const user = store.load().user;
    view.innerHTML = '<div class="cabinet-heading"><div><h1>Завершите регистрацию</h1><p class="lead">Аккаунт ' + esc(user.email) + ' уже создан. Выберите организацию и роль.</p></div></div>' +
      '<form id="accountForm" class="card auth-card"><label class="f"><span>Ваше имя</span><input name="name" maxlength="120" autocomplete="name" value="' + esc(user.name || "") + '"></label>' + organizationFields() +
      '<button class="btn btn-primary" type="submit">Сохранить профиль</button>' + status + '</form>';
    if (store.auth.notice) { message(store.auth.notice); store.auth.notice = null; }
    const organizationInput = bindOrganizationFields(document.getElementById("accountForm"), { accountType: user.role === "university" ? "university" : "buyer", org: user.org });
    bindSubmit(async form => {
      const organization = organizationInput();
      if (!organization) return;
      await createProfile(user.id, { name: form.elements.name.value, ...organization });
      store.auth.notice = "Профиль сохранён. Теперь можно готовить датасеты.";
      onProfileSaved();
      go("#account");
    }, databaseMessage);
  }

  function vResetPassword() {
    view.innerHTML = '<a class="back" href="#login">Вход</a><h1>Восстановить пароль</h1><form id="accountForm" class="card auth-card"><label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" required value="' + esc(email) + '"></label>' +
      '<button class="btn btn-primary" type="submit">Получить письмо</button>' + status + '</form>';
    bindSubmit(async (form, output) => {
      email = form.elements.email.value.trim();
      await auth.requestPasswordReset(email);
      output.textContent = "Если для этого адреса доступно восстановление, вы получите письмо со ссылкой.";
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
    const profile = getProfileState().data, organization = profile.organization;
    view.innerHTML = '<div class="cabinet-heading"><div><span class="kicker">Личный кабинет CORE</span><h1>' + esc(user.name || "Мой аккаунт") + '</h1><p class="lead">Данные вашего аккаунта.</p></div></div>' +
      '<div class="account-summary"><section class="card auth-profile"><div class="profile-status ' + (profile.is_verified ? 'is-verified' : '') + '">' + (profile.is_verified ? "Аккаунт подтверждён" : "Ожидает подтверждения CORE") + '</div><dl><dt>Email</dt><dd>' + esc(user.email) + '</dd><dt>Имя</dt><dd>' + esc(profile.name || "Не указано") + '</dd><dt>Роль в организации</dt><dd>' + esc(ORGANIZATION_ROLES[profile.role]) + '</dd></dl>' +
      '<p class="small muted">' + (profile.is_verified ? "Можно создавать и публиковать собственные датасеты." : "Можно создавать и сохранять собственные черновики. Публикация станет доступна после подтверждения CORE.") + '</p><button type="button" class="mvp-link" id="refreshProfile">Обновить статус</button></section>' +
      '<section class="card auth-profile"><span class="kicker">' + (organization.type === "university" ? "Университет" : "Компания") + '</span><h2>' + esc(organizationName(organization)) + '</h2><p class="profile-status ' + (organization.is_verified ? 'is-verified' : '') + '">' + (organization.is_verified ? "Организация подтверждена · демо" : "Организация не подтверждена") + '</p><p class="small muted">Подтверждение организации и вашего аккаунта показывается отдельно.</p><a class="mvp-link" href="' + esc(organizationUrl(organization.id, "ru")) + '">Страница организации →</a></section></div>' +
      '<div class="saved-actions"><a class="btn btn-primary" href="#datasets/new">Добавить датасет</a><a class="btn btn-ghost" href="#datasets">Мои датасеты</a><a class="btn btn-ghost btn-sm" href="#password">Изменить пароль</a><a class="btn btn-ghost btn-sm" href="' + esc(store.catalogUrl("ru")) + '">Открыть каталог</a></div>' +
      '<p id="accountMessage" class="auth-message" role="status">' + esc(store.auth.notice || "") + '</p>';
    document.getElementById("refreshProfile").onclick = onProfileSaved;
    store.auth.notice = null;
  }

  function vLoading() { view.innerHTML = '<p class="lead" role="status">Проверяем вход…</p>'; }
  function vConnectionError(retry) {
    view.innerHTML = '<h1>Не удалось проверить вход</h1><p class="err" role="alert">' + esc(store.auth.error || "Проверьте соединение и попробуйте снова.") + '</p><button class="btn btn-primary" id="retryAuth">Повторить</button>';
    document.getElementById("retryAuth").onclick = retry;
  }
  return { vLogin, vPassword, vProfile, vLoading, vConnectionError, vCompleteProfile, vResetPassword };
}
