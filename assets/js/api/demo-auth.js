/* Browser-only demo authentication. Supabase is intentionally not connected yet. */
export function getAccountStore() {
  return window.CORE_ACCOUNT.demoStore();
}

export function authenticateDemo(input, universities) {
  var store = getAccountStore(), state = store.load();
  var email = input.email.trim().toLowerCase();
  var account = state.accounts.filter(function (a) { return a.email === email; })[0];
  if (!input.register) {
    if (!account) return { error: "Профиль с этим email не найден в этом браузере. Сначала зарегистрируйтесь." };
  } else {
    if (account) return { error: "Этот email уже зарегистрирован в этом браузере. Перейдите во вкладку «Войти»." };
    var role = input.role, uni = universities.filter(function (u) { return u.label === input.university.trim(); })[0];
    if (role === "university" && !uni) return { error: "Выберите университет из списка." };
    var org = role === "university" ? uni.name : input.org.trim(), name = input.name.trim();
    if (!name || !org) return { error: "Заполните имя и организацию." };
    account = { id: "account-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9), email: email, name: name, role: role, org: org };
    if (uni && role === "university") { account.uni = uni.id; account.uniName = uni.name; } else account.buyerOrg = org;
    state.accounts.push(account);
  }
  state.user = Object.assign({}, account);
  store.save();
  return { user: state.user };
}

export function signOutDemo() {
  var store = getAccountStore();
  store.s.user = null;
  store.save();
}
