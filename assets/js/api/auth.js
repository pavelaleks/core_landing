import { getSupabaseClient } from "./supabase-client.js";

export function getAccountStore() { return window.CORE_ACCOUNT; }

export function authErrorMessage(error) {
  const messages = {
    invalid_credentials: "Неверный email или пароль.",
    email_not_confirmed: "Вход для этого аккаунта пока недоступен. Свяжитесь с командой CORE.",
    email_confirmation_required: "Не удалось завершить регистрацию. Свяжитесь с командой CORE.",
    user_already_exists: "Аккаунт уже существует. Используйте вход.",
    signup_disabled: "Регистрация временно недоступна.",
    weak_password: "Пароль не соответствует требованиям. Используйте более длинный пароль.",
    same_password: "Новый пароль должен отличаться от прежнего.",
    over_email_send_rate_limit: "Слишком много запросов писем. Подождите и попробуйте снова.",
    over_request_rate_limit: "Слишком много попыток. Подождите и попробуйте снова.",
    email_address_not_authorized: "Отправка писем на этот адрес пока недоступна. Свяжитесь с командой CORE.",
    email_address_invalid: "Проверьте адрес электронной почты.",
    otp_expired: "Ссылка истекла или уже использована. Запросите новое письмо.",
    access_denied: "Ссылка недействительна. Запросите новое письмо.",
    session_not_found: "Сессия завершилась. Войдите снова.",
    auth_not_configured: "Вход пока не настроен. Свяжитесь с командой CORE.",
    auth_sdk_unavailable: "Не удалось загрузить сервис входа. Обновите страницу и попробуйте снова.",
  };
  if (messages[error && error.code]) return messages[error.code];
  if (error && (error.name === "AbortError" || /fetch|network|offline|timeout/i.test(error.message || ""))) {
    return "Не удалось связаться с сервисом входа. Проверьте соединение и попробуйте снова.";
  }
  return "Не удалось выполнить действие. Попробуйте снова.";
}

/* Metadata describes the profile; account_type grants no administrative rights. */
export function accountFromUser(user) {
  if (!user) return null;
  const data = user.user_metadata || {};
  return {
    id: user.id, email: user.email || "",
    name: typeof data.name === "string" ? data.name : "",
    org: typeof data.organization === "string" ? data.organization : "",
    role: data.account_type === "university" ? "university" : "buyer",
    createdAt: user.created_at || "",
  };
}

export function createAuthService({ store = getAccountStore(), getClient = getSupabaseClient } = {}) {
  let initialization, subscription, revision = 0, pending = Promise.resolve();
  const apply = update => store.setAuthState(update);

  async function verifySession(client, session, ticket, event) {
    if (!session) {
      if (ticket === revision) apply({ user: null, status: "ready", error: null, event, recovery: false });
      return;
    }
    const { data, error } = await client.auth.getUser(session.access_token);
    if (ticket !== revision) return;
    if (error && ([401, 403].includes(error.status) || ["bad_jwt", "session_not_found", "user_not_found"].includes(error.code))) {
      apply({ user: null, status: "ready", error: null, event: "SIGNED_OUT", recovery: false, notice: "Сессия завершилась. Войдите снова." });
      return null;
    }
    if (error) throw error;
    if (!data.user) throw Object.assign(new Error("Session has no user"), { code: "session_not_found" });
    const user = accountFromUser(data.user);
    apply({ user, status: "ready", error: null, event, ...(event === "PASSWORD_RECOVERY" ? { recovery: true } : {}) });
    return user;
  }

  function observe(event, session, client) {
    if (event === "INITIAL_SESSION") return;
    const ticket = ++revision;
    if (!session) {
      pending = verifySession(client, null, ticket, event);
      return;
    }
    // The SDK holds its session lock during this callback: defer other Auth calls.
    pending = new Promise(resolve => setTimeout(resolve, 0)).then(() =>
      verifySession(client, session, ticket, event)
    ).catch(error => {
      if (ticket === revision) apply({ user: null, status: "error", error: authErrorMessage(error), event });
    });
  }

  const service = {
    initialize() {
      if (!initialization) {
        initialization = (async () => {
          apply({ status: "loading", error: null });
          const redirect = typeof location === "undefined" ? null : new URLSearchParams(location.hash.slice(1));
          const recovering = redirect && redirect.get("type") === "recovery" && redirect.has("access_token");
          const client = await getClient();
          if (!subscription) subscription = client.auth.onAuthStateChange((event, session) => observe(event, session, client)).data.subscription;
          const before = revision;
          const { data, error } = await client.auth.getSession();
          if (error) throw error;
          if (before === revision) await verifySession(client, data.session, ++revision, recovering ? "PASSWORD_RECOVERY" : "INITIAL_SESSION");
          else await pending;
          return store.load().user;
        })().catch(error => {
          apply({ user: null, status: "error", error: authErrorMessage(error) });
          initialization = null;
          throw error;
        });
      }
      return initialization;
    },
    async signIn({ email, password }) {
      const client = await getClient();
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      const user = await verifySession(client, data.session, ++revision, "SIGNED_IN");
      if (!user) throw Object.assign(new Error("Session is no longer valid"), { code: "session_not_found" });
      return data;
    },
    async signUp({ email, password, name = "", org = "", accountType, organizationId, organizationRole }) {
      const client = await getClient();
      const { data, error } = await client.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: {
          data: {
            name: name.trim(), organization: org.trim(), account_type: accountType === "university" ? "university" : "buyer",
            ...(organizationId ? { organization_id: organizationId } : {}),
            ...(organizationRole ? { organization_role: organizationRole } : {}),
          },
        },
      });
      if (error) throw error;
      if (!data.session) throw Object.assign(new Error("Immediate signup session required"), { code: "email_confirmation_required" });
      const user = await verifySession(client, data.session, ++revision, "SIGNED_IN");
      if (!user) throw Object.assign(new Error("Session is no longer valid"), { code: "session_not_found" });
      return data;
    },
    async signOut() {
      const client = await getClient();
      const { error } = await client.auth.signOut({ scope: "local" });
      if (error) throw error;
      ++revision;
      apply({ user: null, status: "ready", error: null, event: "SIGNED_OUT", recovery: false });
    },
    async updatePassword(password) {
      if (!store.load().user) throw Object.assign(new Error("Not signed in"), { code: "session_not_found" });
      const client = await getClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      apply({ recovery: false });
    },
    async requestPasswordReset(email) {
      const client = await getClient();
      const redirectTo = new URL("app/index.html", store.rootUrl).href;
      const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (error) throw error;
    },
  };
  return service;
}

let service;
export function getAuth() { if (!service) service = createAuthService(); return service; }
export function initAuth() { return getAuth().initialize(); }
