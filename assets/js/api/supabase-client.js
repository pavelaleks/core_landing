/* Official @supabase/supabase-js 2.119.2 browser bundle (MIT).
   Its npm SHA-512 was verified before vendoring; no CDN is used at runtime. */
let clientPromise;

function timedFetch(input, options = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 15000);
  if (options.signal) {
    if (options.signal.aborted) abort();
    else options.signal.addEventListener("abort", abort, { once: true });
  }
  return fetch(input, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeout);
    if (options.signal) options.signal.removeEventListener("abort", abort);
  });
}

export function getSupabaseClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      const config = window.CORE_CONFIG && window.CORE_CONFIG.supabase;
      if (!config || !config.url || !String(config.publishableKey).startsWith("sb_publishable_")) {
        throw Object.assign(new Error("Supabase public configuration is missing"), { code: "auth_not_configured" });
      }
      if (!globalThis.supabase || !globalThis.supabase.createClient) {
        throw Object.assign(new Error("Supabase browser bundle did not load"), { code: "auth_sdk_unavailable" });
      }
      return globalThis.supabase.createClient(config.url, config.publishableKey, {
        auth: {
          persistSession: true, autoRefreshToken: true, detectSessionInUrl: true,
          flowType: "implicit", storageKey: "core-supabase-auth-v1",
        },
        global: { fetch: timedFetch },
      });
    })().catch(error => { clientPromise = null; throw error; });
  }
  return clientPromise;
}
