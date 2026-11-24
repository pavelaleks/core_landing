import { getSupabaseClient } from "./supabase-client.js";

export async function allRows(table, columns = "*", configure = query => query) {
  const client = await getSupabaseClient();
  const rows = [];
  let total;
  do {
    const query = client.from(table).select(columns, { count: "exact" });
    const { data, error, count } = await configure(query).range(rows.length, rows.length + 199);
    if (error) throw error;
    total = count;
    if (!data?.length) {
      if (total != null && rows.length < total) throw new Error("Incomplete database response");
      break;
    }
    rows.push(...data);
    if (total == null && data.length < 200) break;
  } while (total == null || rows.length < total);
  return rows;
}

export function databaseMessage(error) {
  if (error?.code === "42501") return "Действие недоступно. Проверьте статус подтверждения аккаунта и права на карточку.";
  if (error?.code === "23503") return "Связанная запись не найдена. Обновите страницу и попробуйте снова.";
  if (error?.code === "23514") return "Проверьте заполненные поля.";
  if (error?.name === "AbortError" || /fetch|network|offline|timeout/i.test(error?.message || "")) return "Не удалось связаться с базой. Проверьте соединение и повторите действие.";
  return "Не удалось сохранить или загрузить данные. Попробуйте снова.";
}
