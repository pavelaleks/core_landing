import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
const user = {
  id: "11111111-1111-4111-8111-111111111111", email: "client@example.test",
  email_confirmed_at: "2026-11-23T00:00:00Z", created_at: "2026-11-23T00:00:00Z",
  user_metadata: { name: "Client", organization: "Example", account_type: "buyer" },
};
const session = { access_token: "test-session-token", user };

async function environment(initial = {}, location) {
  const storage = new Map([["core-mvp-v1", JSON.stringify(initial)]]), events = [];
  const window = { dispatchEvent: event => events.push(event.type) };
  const context = vm.createContext({
    window, URL, URLSearchParams, Event, setTimeout, clearTimeout, location,
    document: { currentScript: { src: "https://example.test/core_landing/assets/account-store.js" } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  });
  vm.runInContext(fs.readFileSync(path.join(root, "assets/account-store.js"), "utf8"), context);
  const cache = new Map();
  const create = filename => {
    if (cache.has(filename)) return cache.get(filename);
    const module = new vm.SourceTextModule(fs.readFileSync(filename, "utf8"), {
      context, identifier: filename,
      initializeImportMeta(meta) { meta.url = pathToFileURL(filename).href; },
    });
    cache.set(filename, module);
    return module;
  };
  const module = create(path.join(root, "assets/js/api/auth.js"));
  await module.link((specifier, referencing) => create(fileURLToPath(new URL(specifier, pathToFileURL(referencing.identifier)))));
  await module.evaluate();
  return { api: module.namespace, store: window.CORE_ACCOUNT, storage, events };
}

function fakeClient(overrides = {}) {
  let observer;
  const calls = [];
  const auth = {
    onAuthStateChange(callback) { observer = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async token => { calls.push(["getUser", token]); return { data: { user }, error: null }; },
    signInWithPassword: async input => { calls.push(["signIn", input]); return { data: { session }, error: null }; },
    signUp: async input => { calls.push(["signUp", input]); return { data: { user, session }, error: null }; },
    signOut: async input => { calls.push(["signOut", input]); return { error: null }; },
    updateUser: async input => { calls.push(["updateUser", input]); return { data: { user }, error: null }; },
    ...overrides,
  };
  return { auth, calls, emit: (event, value) => observer(event, value) };
}

test("saved demo identities and demo role changes cannot sign in a real account", async () => {
  const env = await environment({ user: { id: "spoofed", role: "operator" }, accounts: [{ email: "demo@example.test" }], favorites: { old: ["regions"] } });
  assert.equal(env.store.load().user, null);
  const demo = env.store.demoStore();
  assert.equal(demo.load().user.role, "operator");
  demo.s.user = { role: "operator", id: "another-demo" };
  demo.save();
  assert.equal(env.store.load().user, null);
  const client = fakeClient();
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  await auth.signIn({ email: " CLIENT@EXAMPLE.TEST ", password: " password with spaces " });
  assert.equal(env.store.load().user.id, user.id);
  assert.equal(client.calls.find(c => c[0] === "signIn")[1].password, " password with spaces ");
  demo.s.user = { role: "operator" }; demo.save();
  assert.equal(env.store.load().user.id, user.id);
  env.store.save();
  const saved = env.storage.get("core-mvp-v1");
  assert.equal(JSON.parse(saved).user, null);
  assert(!saved.includes("password with spaces"));
  assert(!saved.includes(session.access_token));
});

test("initial sessions are verified remotely and user-controlled metadata grants no admin role", async () => {
  const env = await environment();
  const verified = { ...user, user_metadata: { name: "Verified", account_type: "operator", role: "operator" } };
  const client = fakeClient({
    getSession: async () => ({ data: { session: { ...session, user: { ...user, email: "forged@example.test" } } }, error: null }),
    getUser: async () => ({ data: { user: verified }, error: null }),
  });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  assert.equal(env.store.s.user.email, user.email);
  assert.equal(env.store.s.user.name, "Verified");
  assert.equal(env.store.s.user.role, "buyer");
});

test("signup immediately verifies the new session without email or redirect options", async () => {
  const env = await environment(), client = fakeClient();
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  const result = await auth.signUp({ email: " CLIENT@EXAMPLE.TEST ", password: "new-password", name: " Client ", org: " Example ", accountType: "operator" });
  assert.equal(result.session.access_token, session.access_token);
  assert.equal(env.store.s.user.id, user.id);
  const input = client.calls.find(c => c[0] === "signUp")[1];
  assert.equal(input.email, user.email);
  assert.deepEqual(Object.keys(input.options), ["data"]);
  assert.deepEqual(plain(input.options.data), { name: "Client", organization: "Example", account_type: "buyer" });
  assert(!env.storage.get("core-mvp-v1").includes("new-password"));
});

test("signup accepts email and password without a name or organization", async () => {
  for (const profile of [{}, { name: "   ", org: "   " }]) {
    const env = await environment();
    const registered = { ...user, user_metadata: { name: "", organization: "", account_type: "university" } };
    const registeredSession = { ...session, user: registered };
    const client = fakeClient({
      signUp: async input => { client.calls.push(["signUp", input]); return { data: { user: registered, session: registeredSession }, error: null }; },
      getUser: async () => ({ data: { user: registered }, error: null }),
    });
    const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
    await auth.initialize();
    await auth.signUp({ email: user.email, password: "new-password", accountType: "university", ...profile });
    assert.equal(env.store.s.user.id, user.id);
    assert.equal(env.store.s.user.email, user.email);
    assert.equal(env.store.s.user.name, "");
    assert.equal(env.store.s.user.org, "");
    assert.deepEqual(plain(client.calls.find(call => call[0] === "signUp")[1].options.data), {
      name: "", organization: "", account_type: "university",
    });
  }
});

test("invalid credentials keep the visitor signed out and show a useful message", async () => {
  const env = await environment(), failure = { code: "invalid_credentials" };
  const client = fakeClient({ signInWithPassword: async () => ({ data: {}, error: failure }) });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  await assert.rejects(auth.signIn({ email: user.email, password: "wrong-password" }), error => error === failure);
  assert.equal(env.store.s.user, null);
  assert.match(env.api.authErrorMessage(failure), /Неверный email или пароль/);
});

test("cross-tab signout wins over an in-flight user verification", async () => {
  const env = await environment();
  let finish;
  const client = fakeClient({ getUser: () => new Promise(resolve => { finish = resolve; }) });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  client.emit("SIGNED_IN", session);
  await tick();
  client.emit("SIGNED_OUT", null);
  finish({ data: { user }, error: null });
  await tick();
  assert.equal(env.store.s.user, null);
  assert.equal(env.store.auth.event, "SIGNED_OUT");
});

test("recovery defers verification outside the SDK callback and permits password updates only with a session", async () => {
  const env = await environment();
  let inCallback = false;
  const client = fakeClient({ getUser: async () => { assert.equal(inCallback, false); return { data: { user }, error: null }; } });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  await assert.rejects(auth.updatePassword("new-password"), error => error.code === "session_not_found");
  inCallback = true; client.emit("PASSWORD_RECOVERY", session); inCallback = false;
  await tick();
  assert.equal(env.store.auth.recovery, true);
  assert.equal(env.store.s.user.id, user.id);
  await auth.updatePassword("new-password");
  assert.equal(env.store.auth.recovery, false);
});

test("a signup requiring email confirmation cannot be mistaken for a successful login", async () => {
  const env = await environment(), client = fakeClient({ signUp: async () => ({ data: { user, session: null }, error: null }) });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  await assert.rejects(auth.signUp({ email: user.email, password: "new-password", name: "Client", org: "Example", accountType: "buyer" }), error => error.code === "email_confirmation_required");
  assert.equal(env.store.s.user, null);
  assert.equal(client.calls.some(call => call[0] === "getUser"), false);
});

test("network failures finish loading and initialization can be retried", async () => {
  const env = await environment(), client = fakeClient();
  let offline = true;
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => { if (offline) throw new Error("Failed to fetch"); return client; } });
  await assert.rejects(auth.initialize(), /fetch/);
  assert.equal(env.store.auth.status, "error");
  assert.match(env.store.auth.error, /соединение/);
  offline = false;
  await auth.initialize();
  assert.equal(env.store.auth.status, "ready");
  assert.equal(env.store.s.user, null);
});

test("an expired or invalid saved Auth token returns to login instead of trapping the user on retry", async () => {
  const env = await environment();
  const client = fakeClient({
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: null }, error: { code: "bad_jwt", status: 401 } }),
  });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  assert.equal(env.store.auth.status, "ready");
  assert.equal(env.store.s.user, null);
  assert.match(env.store.auth.notice, /Войдите снова/);
});

test("a valid recovery link survives an SDK recovery event emitted before subscription", async () => {
  const env = await environment({}, { hash: "#access_token=test-session-token&type=recovery" });
  const client = fakeClient({ getSession: async () => ({ data: { session }, error: null }) });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  assert.equal(env.store.auth.recovery, true);
  assert.equal(env.store.s.user.id, user.id);
});

test("logout clears verified UI identity and a failed logout remains retryable", async () => {
  const env = await environment();
  const client = fakeClient({ getSession: async () => ({ data: { session }, error: null }) });
  const auth = env.api.createAuthService({ store: env.store, getClient: async () => client });
  await auth.initialize();
  client.auth.signOut = async () => ({ error: new Error("Network unavailable") });
  await assert.rejects(auth.signOut(), /Network/);
  assert.equal(env.store.s.user.id, user.id);
  client.auth.signOut = async () => ({ error: null });
  await auth.signOut();
  assert.equal(env.store.s.user, null);
  assert.equal(env.store.auth.recovery, false);
});
