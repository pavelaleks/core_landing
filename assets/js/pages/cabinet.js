import { getAccountStore, getAuth, initAuth, authErrorMessage } from "../api/auth.js";
import { createAuthAccountPages } from "./auth-account.js";
import { initDemoCabinet } from "./demo-cabinet.js";
import { createAccountPages } from "./account.js";
import { getCatalog } from "../api/datasets.js";
import { esc } from "../ui/format.js";

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
  function onLogin() {
    if (favorite && store.load().user && (getCatalog() || []).some(item => item.id === favorite) && !store.favoriteIds().includes(favorite)) store.toggleFavorite(favorite);
    const destination = favorite ? "#favorites" : "#account";
    favorite = "";
    go(destination);
  }
  const pages = createAuthAccountPages({ store, auth, view, go, onLogin });
  const { vFavorites } = createAccountPages({ store, view, DS: [], UNIS: [], go, home: () => "#account" });

  function header() {
    const user = store.load().user, nav = document.getElementById("nav"), who = document.getElementById("who");
    nav.hidden = who.hidden = !user;
    if (!user) { nav.innerHTML = who.innerHTML = ""; return; }
    nav.innerHTML = '<a href="#account"' + (location.hash === "#account" ? ' class="on"' : "") + '>Мой аккаунт</a>' +
      (user.role === "buyer" ? '<a href="#favorites">Избранное</a>' : "") + '<a href="' + esc(store.catalogUrl("ru")) + '">Общий каталог</a>';
    who.innerHTML = '<span class="lbl">' + esc(user.org || user.email) + '</span><button type="button" id="logout" class="mvp-link">Выйти</button>';
    document.getElementById("logout").onclick = async event => {
      event.currentTarget.disabled = true;
      try { await auth.signOut(); go("#login"); }
      catch (error) { store.auth.notice = authErrorMessage(error); go("#account"); }
    };
  }

  function render() {
    header();
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
      if (/^#(?:login|register)(?:\/|$)/.test(hash)) pages.vLogin(hash.startsWith("#register"));
      else go("#login");
      return;
    }
    if (hash === "#password") pages.vPassword();
    else if (hash === "#favorites" && user.role === "buyer") vFavorites();
    else if (hash === "#account") pages.vProfile();
    else go("#account");
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("core:account", render);
  render();
  initAuth().catch(() => {});
}
