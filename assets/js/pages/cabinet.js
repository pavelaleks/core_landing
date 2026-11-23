import { getAccountStore, signOutDemo } from "../api/auth.js";
import { seed, id } from "../api/demo-data.js";
import { loadCabinetData } from "../api/datasets.js";
import { esc, toast } from "../ui/format.js";
import { createAccountPages } from "./account.js";
import { createLegacyAuth } from "./legacy-auth.js";
import { createAccessPages } from "./access.js";
import { createDatasetPage } from "./dataset.js";
import { createSubmissionPages } from "./submissions.js";
import { createOperatorPage } from "./operator.js";

export function initCabinet() {
  var store = getAccountStore(), KEY = store.key, view = document.getElementById("view");
  var DS = [], UNIS = [];
  store.load(seed);

  function go(h) { if (location.hash === h) render(); else location.hash = h; }

  var { legacyHeader, switchRole, vLegacyLogin } = createLegacyAuth({ store, view, UNIS, go });
  var { vLogin, vFavorites, vUni } = createAccountPages({ store, view, DS, UNIS, go, home });
  var { vCatalog, vMy } = createAccessPages({ store, view, DS, ds, myReq });
  var { vDataset } = createDatasetPage({ store, view, ds, myReq, go, render, switchRole });
  var { vLegacyUni, vUniNew } = createSubmissionPages({ store, view, DS, ds, go });
  var { vOps } = createOperatorPage({ store, view, ds, render });

  function ds(slug) { return DS.filter(function (d) { return d.slug === slug; })[0]; }

  function myReq(slug) {
    var S = store.s;
    return S.requests.filter(function (r) { return r.ds === slug && S.user && r.org === S.user.org; }).sort(function (a, b) { return b.created - a.created; })[0];
  }

  function home() {
    var S = store.s;
    return S.user && S.user.role === "university" ? "#uni" : S.user && S.user.role === "operator" ? "#ops" : "#favorites";
  }

  function header() {
    var S = store.s;
    if (S.user && S.user.role === "operator") { legacyHeader(); return; }
    var nav = document.getElementById("nav"), who = document.getElementById("who");
    nav.hidden = who.hidden = !S.user;
    if (!S.user) return;
    var university = S.user.role === "university";
    nav.innerHTML = '<a href="' + home() + '" class="on">' + (university ? "Мои датасеты" : "Избранное") + '</a><a href="' + store.catalogUrl("ru") + '">Общий каталог</a>';
    who.innerHTML = '<span class="lbl">' + esc(S.user.org) + '</span><a href="#login" id="logout" class="mvp-link">Выйти</a>';
    document.getElementById("logout").onclick = function (e) { e.preventDefault(); signOutDemo(); go("#login"); };
  }

  function startDemo(want) {
    var S = store.s;
    if (S.user) { go("#ds/" + (ds(want) ? want : "uzbek-geography-terms")); return; }
    try { localStorage.setItem("core-invite", "1"); } catch (e) {}
    var org = "Demo visitor", slug = ds(want) ? want : "uzbek-geography-terms";
    S.user = { role: "buyer", org: org, buyerOrg: org, name: "Demo" };
    if (!S.requests.some(function (r) { return r.org === org && r.ds === slug && r.status === "approved"; }))
      S.requests.push({ id: id("R"), ds: slug, org: org, name: "Demo", purpose: "Демо: знакомство с форматом и API", use: "commercial", status: "approved", created: Date.now(), decided: Date.now() });
    store.save();
    location.replace("#ds/" + slug);
    setTimeout(function () { toast("Демо: доступ к этому набору уже открыт — попробуйте API и SQL ниже. Другие наборы можно запросить и одобрить в роли оператора."); }, 400);
  }

  function render() {
    var S = store.s;
    var h = location.hash || "";
    if (h === "#demo" || h.indexOf("#demo/") === 0) { startDemo(h.slice(6)); return; }
    if (!S.user && !/^#(?:login|register)(?:\/|$)/.test(h) && h !== "#legacy") { go("#login"); return; }
    header();
    window.scrollTo(0, 0);
    if (/^#(?:login|register)(?:\/|$)/.test(h)) vLogin();
    else if (h === "#legacy") vLegacyLogin();
    else if (h === "#favorites") S.user.role === "buyer" ? vFavorites() : go(home());
    else if (h === "#catalog") vCatalog();
    else if (h.indexOf("#ds/") === 0) vDataset(h.slice(4));
    else if (h === "#my") vMy();
    else if (h === "#uni") S.user.role === "university" ? vUni() : go(home());
    else if (h === "#uni/new") S.user.role === "university" ? vUniNew() : go(home());
    else if (h === "#uni/legacy") S.user.role === "university" ? vLegacyUni() : go(home());
    else if (h === "#ops") S.user.role === "operator" ? vOps() : go("#catalog");
    else go(home());
  }

  document.getElementById("reset").onclick = function (e) { e.preventDefault(); store.reset(seed); toast("Демо сброшено"); go("#login"); };
  window.addEventListener("hashchange", render);
  window.addEventListener("storage", function (e) { if (e.key === KEY) { store.load(); render(); } });

  loadCabinetData().then(function (data) {
    DS.push(...data.datasets);
    UNIS.push(...data.universities);
    render();
  }).catch(function () { view.innerHTML = '<p class="err">Не удалось загрузить каталог. Обновите страницу.</p>'; });
}
