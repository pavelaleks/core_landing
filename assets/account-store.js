/* Browser-only demo state shared by the public catalog and the existing cabinet.
   This is not authentication or server storage. Keep the legacy key and records. */
(function () {
  "use strict";
  var KEY = "core-mvp-v1";
  var memory = null;
  var store = {
    key: KEY,
    s: null,
    load: function (seed) {
      var state = memory;
      try { state = JSON.parse(localStorage.getItem(KEY)) || state; } catch (e) {}
      if (!state || typeof state !== "object" || Array.isArray(state)) state = seed ? seed() : {};
      if (seed && !Array.isArray(state.submissions)) {
        var initial = seed();
        Object.keys(initial).forEach(function (key) { if (state[key] === undefined) state[key] = initial[key]; });
      }
      ["accounts", "requests", "submissions"].forEach(function (key) { if (!Array.isArray(state[key])) state[key] = []; });
      if (!state.favorites || typeof state.favorites !== "object" || Array.isArray(state.favorites)) state.favorites = {};
      if (!state.downloads) state.downloads = 0;
      if (!state.user) state.user = null;
      if (this.s && this.s !== state) {
        var current = this.s;
        Object.keys(current).forEach(function (key) { if (!(key in state)) delete current[key]; });
        Object.keys(state).forEach(function (key) { current[key] = state[key]; });
        state = current;
      }
      this.s = memory = state;
      return state;
    },
    save: function () {
      memory = this.s;
      try { localStorage.setItem(KEY, JSON.stringify(this.s)); return true; } catch (e) { return false; }
    },
    reset: function (seed) {
      try { localStorage.removeItem(KEY); } catch (e) {}
      this.s = memory = seed ? seed() : {};
      this.load();
      this.save();
    },
    userKey: function (user) {
      return user && (user.id || (user.role + ":" + (user.email || user.uni || user.org || "demo")));
    },
    favoriteIds: function () {
      var state = this.load(), key = this.userKey(state.user);
      return key && Array.isArray(state.favorites[key]) ? state.favorites[key].slice() : [];
    },
    toggleFavorite: function (id) {
      var state = this.load();
      if (!state.user || state.user.role !== "buyer") return false;
      var key = this.userKey(state.user), ids = this.favoriteIds(), at = ids.indexOf(id);
      if (at < 0) ids.push(id); else ids.splice(at, 1);
      this.s.favorites[key] = ids;
      this.save();
      window.dispatchEvent(new Event("core:account"));
      return true;
    }
  };
  window.CORE_ACCOUNT = store;
  store.rootUrl = new URL("../", document.currentScript.src).href;
  store.catalogUrl = function (lang) { return new URL((lang === "en" ? "" : (lang || "ru") + "/") + "catalog.html", store.rootUrl).href; };
  store.cabinetUrl = function (hash) { return new URL("app/index.html" + (hash || ""), store.rootUrl).href; };
})();
