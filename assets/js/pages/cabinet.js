import { getAccountStore, getAuth, initAuth, authErrorMessage } from "../api/auth.js";
import { createAuthAccountPages } from "./auth-account.js";
import { initDemoCabinet } from "./demo-cabinet.js";
import { createAccountPages } from "./account.js";
import { getCatalog, fetchCatalog } from "../api/datasets.js";
import { esc } from "../ui/format.js";
import { getProfile } from "../api/profiles.js";
import { organizationName } from "../api/organizations.js";
import { databaseMessage } from "../api/query.js";
import { createDatasetRecords } from "./dataset-records.js";

export function initCabinet() {
  if (/^#demo(?:\/|$)/.test(location.hash)) { initDemoCabinet(); return; }
  const store = getAccountStore(), auth = getAuth(), view = document.getElementById("view");
  const callback = new URLSearchParams(location.hash.slice(1));
  if (callback.has("error")) {
    store.auth.notice = authErrorMessage({ code: callback.get("error_code") || callback.get("error") });
    history.replaceState(null, "", location.pathname + location.search + "#login");
  }
  let favorite = "";
  try { favorite = decodeURIComponent(location.hash.split("/favorite/")[1] || ""); } catch (error) {}
  const go = hash => { if (location.hash === hash) render(); else location.hash = hash; };
  async function onLogin() {
    if (favorite) {
      try { await fetchCatalog(); }
      catch { store.auth.notice = "Не удалось загрузить каталог для избранного. Повторите добавление из каталога."; }
    }
    if (favorite && store.load().user && (getCatalog() || []).some(item => item.id === favorite) && !store.favoriteIds().includes(favorite)) store.toggleFavorite(favorite);
    const destination = favorite ? "#favorites" : "#account";
    favorite = "";
    go(destination);
  }
  let profile = { userId: null, status: "idle", data: null }, profileRevision = 0, lastHash = "";
  const getProfileState = () => profile;
  function refreshProfile() {
    const user = store.load().user;
    if (!user) return;
    const ticket = ++profileRevision;
    profile = { userId: user.id, status: "loading", data: null };
    getProfile(user.id).then(data => {
      if (ticket !== profileRevision || store.load().user?.id !== user.id) return;
      profile = { userId: user.id, status: "ready", data };
      render();
    }).catch(error => {
      if (ticket !== profileRevision) return;
      profile = { userId: user.id, status: "error", data: null, error };
      render();
    });
    render();
  }
  const pages = createAuthAccountPages({ store, auth, view, go, onLogin, getProfileState, onProfileSaved: refreshProfile });
  const records = createDatasetRecords({ store, view, go, getProfileState });
  const { vFavorites } = createAccountPages({ store, view, DS: [], UNIS: [], go, home: () => "#account" });

  function header() {
    const user = store.load().user, nav = document.getElementById("nav"), who = document.getElementById("who");
    nav.hidden = who.hidden = !user;
    if (!user) { nav.innerHTML = who.innerHTML = ""; return; }
    nav.innerHTML = '<a href="#account"' + (location.hash === "#account" ? ' class="on"' : "") + '>Мой аккаунт</a><a href="#datasets">Мои датасеты</a>' +
      (user.role === "buyer" ? '<a href="#favorites">Избранное</a>' : "") + '<a href="' + esc(store.catalogUrl("ru")) + '">Общий каталог</a>';
    who.innerHTML = '<span class="lbl" title="' + esc(user.org || user.email) + '">' + esc(user.org || user.email) + '</span><button type="button" id="logout" class="mvp-link">Выйти</button>';
    document.getElementById("logout").onclick = async event => {
      event.currentTarget.disabled = true;
      try { await auth.signOut(); go("#login"); }
      catch (error) { store.auth.notice = authErrorMessage(error); go("#account"); }
    };
  }

  function render() {
    if (lastHash !== location.hash) { records.cancel(); lastHash = location.hash; }
    const sessionUser = store.load().user;
    if (sessionUser && profile.userId === sessionUser.id && profile.data) {
      // Legacy UI labels only. Database policies always use the trusted profile.
      sessionUser.role = profile.data.organization.type === "university" ? "university" : "buyer";
      sessionUser.org = organizationName(profile.data.organization);
      sessionUser.name = profile.data.name;
    }
    header();
    if (store.auth.registrationPending) { pages.vLoading(); return; }
    const publicMatch = /^#dataset\/(.+)$/.exec(location.hash);
    if (publicMatch && !sessionUser) {
      try { records.vDetails(decodeURIComponent(publicMatch[1])); } catch { go("#account"); }
      return;
    }
    if (store.auth.status === "loading") { pages.vLoading(); return; }
    if (store.auth.status === "error") { pages.vConnectionError(() => initAuth().catch(() => {})); return; }
    const hash = location.hash, user = store.load().user;
    if (/^#demo(?:\/|$)/.test(hash)) {
      const url = new URL(store.cabinetUrl(hash));
      url.searchParams.set("demo", "1");
      location.href = url.href;
      return;
    }
    if (user && store.auth.recovery && hash !== "#password") { go("#password"); return; }
    if (!user) {
      if (profile.userId) { profileRevision++; profile = { userId: null, status: "idle", data: null }; }
      if (hash === "#reset-password") { pages.vResetPassword(); return; }
      if (/^#(?:login|register)(?:\/|$)/.test(hash)) pages.vLogin(hash.startsWith("#register"));
      else go("#login");
      return;
    }
    if (hash === "#password") { pages.vPassword(); return; }
    if (profile.userId !== user.id || profile.status === "idle") { refreshProfile(); return; }
    if (profile.status === "loading") { pages.vLoading(); return; }
    if (profile.status === "error") {
      view.innerHTML = '<h1>Не удалось загрузить профиль</h1><p class="err" role="alert">' + esc(databaseMessage(profile.error)) + '</p><button class="btn btn-primary" id="retryProfile">Повторить</button>';
      document.getElementById("retryProfile").onclick = refreshProfile;
      return;
    }
    if (!profile.data) { pages.vCompleteProfile(); return; }
    if (publicMatch) { try { records.vDetails(decodeURIComponent(publicMatch[1])); } catch { go("#datasets"); } }
    else if (hash === "#datasets") records.vList();
    else if (hash === "#datasets/new") records.vEditor();
    else if (hash.startsWith("#datasets/edit/")) { try { records.vEditor(decodeURIComponent(hash.slice(15))); } catch { go("#datasets"); } }
    else if (hash === "#favorites" && user.role === "buyer") {
      pages.vLoading();
      fetchCatalog().then(() => { if (location.hash === "#favorites" && store.load().user?.id === user.id) vFavorites(); }).catch(error => {
        if (location.hash !== "#favorites") return;
        view.innerHTML = '<p class="err" role="alert">' + esc(databaseMessage(error)) + '</p><button class="btn btn-ghost" id="retryFavorites">Повторить</button>';
        document.getElementById("retryFavorites").onclick = render;
      });
    }
    else if (hash === "#account") pages.vProfile();
    else go("#account");
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("core:account", render);
  render();
  initAuth().catch(() => {});
}
