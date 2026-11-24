import { getSupabaseClient } from "./supabase-client.js";
import { createCompany } from "./organizations.js";

export const ORGANIZATION_ROLES = {
  contributor: "Преподаватель / сотрудник",
  coordinator: "Координатор данных — администратор",
  management: "Руководитель — администрация",
};

const columns = "*,organization:organizations(id,type,name,name_ru,name_en,name_uz,country,website,is_verified)";

export async function getProfile(userId) {
  const client = await getSupabaseClient();
  const { data, error } = await client.from("profiles").select(columns).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProfile(userId, input) {
  const existing = await getProfile(userId);
  if (existing) return existing;
  let organizationId = input.organizationId;
  if (input.accountType === "buyer") organizationId = (await createCompany(input.org)).id;
  if (!organizationId || !Object.hasOwn(ORGANIZATION_ROLES, input.organizationRole)) throw new Error("Invalid profile");
  const client = await getSupabaseClient();
  const { data, error } = await client.from("profiles").insert({
    user_id: userId, name: (input.name || "").trim(), organization_id: organizationId, role: input.organizationRole,
  }).select(columns).single();
  if (error?.code === "23505") return getProfile(userId);
  if (error) throw error;
  return data;
}
