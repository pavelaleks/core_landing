import { getSupabaseClient } from "./supabase-client.js";
import { allRows } from "./query.js";

export function listUniversities() {
  return allRows("organizations", "id,name,name_ru,name_en,name_uz,country,is_verified", query => query.eq("type", "university").order("id"));
}

export function organizationName(organization, lang = "ru") {
  return organization?.["name_" + lang] || organization?.name || "";
}

export async function createCompany(name) {
  const value = name.trim();
  if (!value || value.length > 200) throw new Error("Invalid company name");
  const client = await getSupabaseClient();
  const { data, error } = await client.from("organizations").insert({ type: "company", name: value }).select("*").single();
  if (error) throw error;
  return data;
}
