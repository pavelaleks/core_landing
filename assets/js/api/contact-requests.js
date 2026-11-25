import { getSupabaseClient } from "./supabase-client.js";

export async function sendContactRequest(values, id) {
  const text = key => String(values[key] || "").trim();
  const record = {
    id, name: text("name"), contact: text("contact") || text("email"),
    comment: text("comment") || text("message"),
    form_variant: values.form_variant === "detailed" ? "detailed" : "quick",
    request_type: text("type") || "participation",
    details: Object.fromEntries(["org", "role", "usecase", "link"].filter(key => text(key)).map(key => [key, text(key)])),
    page_url: text("page_url"), language: text("language") || "ru",
    dataset_id: text("dataset_id") || null, consent: values.consent === "on" || values.consent === true,
  };
  const client = await getSupabaseClient();
  const { error } = await client.from("contact_requests").insert(record);
  // A retried request keeps its UUID, including when the first response was lost.
  if (error && error.code !== "23505") throw error;
}
