/* CORE admin: list and edit requests, users, organizations, datasets.
   All reads and writes go through admin_list / admin_update in Supabase,
   which refuse anyone who is not in public.admins. */
import { getSupabaseClient } from "../api/supabase-client.js";
import { esc } from "../ui/format.js";

const STATUS = { new: "Новая", in_progress: "В работе", done: "Закрыта" };
const PUBLICATION = { draft: "Черновик", published: "Опубликован", unpublished: "Снят" };
const yes = value => value ? "Да" : "—";
const day = value => value ? new Date(value).toLocaleDateString("ru-RU") : "";
const text = value => value && typeof value === "object" ? (value.ru || value.en || value.uz || "") : value ?? "";

const SECTIONS = {
  requests: {
    title: "Заявки", key: "id",
    columns: [["created_at", "Дата", day], ["status", "Статус", v => (v === "new" ? "● " : "") + (STATUS[v] || v)], ["name", "Имя"], ["contact", "Контакт"], ["request_type", "Тип"], ["comment", "Комментарий"]],
    fields: [["status", "Статус", "select", STATUS], ["admin_note", "Заметка команды", "textarea"]],
  },
  users: {
    title: "Пользователи", key: "user_id",
    columns: [["registered_at", "Дата", day], ["email", "Email"], ["name", "Имя"], ["organization_name", "Организация"], ["is_verified", "Подтверждён", yes], ["is_admin", "Админ", yes]],
    fields: [["is_verified", "Подтверждён (может публиковать)", "bool"], ["name", "Имя", "text"], ["role", "Роль", "select", { contributor: "Сотрудник", coordinator: "Координатор данных", management: "Руководитель" }], ["organization_id", "ID организации", "text"]],
    editable: row => row.has_profile,
  },
  organizations: {
    title: "Организации", key: "id",
    columns: [["name", "Название"], ["type", "Тип", v => v === "university" ? "Вуз" : "Компания"], ["country", "Страна"], ["users", "Польз."], ["datasets", "Датасеты"], ["is_verified", "Подтверждена", yes]],
    fields: [["is_verified", "Подтверждена", "bool"], ["name", "Название", "text"], ["name_ru", "Название RU", "text"], ["name_en", "Название EN", "text"], ["name_uz", "Название UZ", "text"], ["type", "Тип", "select", { university: "Вуз", company: "Компания" }], ["country", "Страна (код)", "text"], ["website", "Сайт", "text"]],
  },
  datasets: {
    title: "Датасеты", key: "id",
    columns: [["updated_at", "Обновлён", day], ["title", "Название", text], ["organization_name", "Организация"], ["owner_email", "Автор"], ["publication_status", "Статус", v => PUBLICATION[v] || v]],
    fields: [["publication_status", "Статус публикации", "select", PUBLICATION], ["title", "Название", "i18n"], ["description", "Описание", "i18n-long"], ["category", "Категория", "text"], ["access_type", "Доступ", "select", { request: "По запросу", buy: "Покупка", demo: "Демо", open: "Открытый" }], ["license_id", "Лицензия", "select", { "": "—", "metadata-only": "Только метаданные", "by-agreement": "По соглашению", "open-cc-by-4-0": "CC BY 4.0" }], ["organization_id", "ID организации", "text"]],
  },
  subscribers: {
    title: "Подписчики", key: "email",
    columns: [["created_at", "Дата", day], ["email", "Email"], ["language", "Язык"]],
    fields: [],
  },
};

const view = document.getElementById("view");
const cache = {};
let client;

async function rpc(name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}

function errorText(error) {
  if (error?.code === "42501") return "У этого аккаунта нет прав администратора.";
  if (error?.code === "PGRST202") return "В базе нет функций админки. Примените миграцию 20261125150000_admin_newsletter_mail.sql.";
  return "Ошибка: " + (error?.message || error);
}

function field([key, label, type, options], row) {
  const value = row[key];
  if (type === "bool") return '<label class="check"><input type="checkbox" name="' + key + '"' + (value ? " checked" : "") + '> ' + esc(label) + '</label>';
  if (type === "select") return '<label>' + esc(label) + '<select name="' + key + '">' + Object.entries(options).map(([v, l]) => '<option value="' + esc(v) + '"' + ((value ?? "") === v ? " selected" : "") + '>' + esc(l) + '</option>').join("") + '</select></label>';
  if (type === "textarea") return '<label>' + esc(label) + '<textarea name="' + key + '" rows="4">' + esc(value || "") + '</textarea></label>';
  if (type === "i18n" || type === "i18n-long") return ["ru", "en", "uz"].map(lang => '<label>' + esc(label) + ' ' + lang.toUpperCase() +
    (type === "i18n" ? '<input name="' + key + '.' + lang + '" value="' + esc(value?.[lang] || "") + '">' : '<textarea name="' + key + '.' + lang + '" rows="3">' + esc(value?.[lang] || "") + '</textarea>') + '</label>').join("");
  return '<label>' + esc(label) + '<input name="' + key + '" value="' + esc(value ?? "") + '"></label>';
}

function readPatch(form, fields, row) {
  const patch = {};
  for (const [key, , type] of fields) {
    if (type === "bool") patch[key] = form.elements[key].checked;
    else if (type === "i18n" || type === "i18n-long") {
      const value = { ...(row[key] || {}) };
      for (const lang of ["ru", "en", "uz"]) { const v = form.elements[key + "." + lang].value.trim(); if (v) value[lang] = v; else delete value[lang]; }
      patch[key] = value;
    } else {
      const v = form.elements[key].value.trim();
      patch[key] = v === "" && type === "select" ? null : v;
    }
  }
  // Send only what the admin changed, so untouched empty fields are never overwritten.
  const same = (a, b) => JSON.stringify(a ?? "") === JSON.stringify(b ?? "");
  for (const key of Object.keys(patch)) if (same(patch[key], row[key])) delete patch[key];
  return patch;
}

function openEditor(name, row) {
  const section = SECTIONS[name];
  const canEdit = section.fields.length && (!section.editable || section.editable(row));
  const dialog = document.createElement("dialog");
  dialog.className = "adm-dialog";
  dialog.innerHTML = '<form method="dialog"><h2>' + esc(section.title) + '</h2>' +
    (canEdit ? section.fields.map(f => field(f, row)).join("") : '<p class="muted">' + (section.fields.length ? "Профиль не заполнен: пользователь ещё не выбрал организацию." : "Только просмотр.") + '</p>') +
    '<details><summary class="small muted">Все поля</summary><pre>' + esc(JSON.stringify(row, null, 2)) + '</pre></details>' +
    '<p class="small err" role="alert"></p><div class="adm-actions"><button class="btn btn-ghost btn-sm" value="cancel">Закрыть</button>' +
    (canEdit ? '<button class="btn btn-primary btn-sm" value="save" type="submit">Сохранить</button>' : "") + '</div></form>';
  document.body.appendChild(dialog);
  dialog.addEventListener("close", () => dialog.remove());
  const form = dialog.querySelector("form");
  form.addEventListener("submit", async event => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await rpc("admin_update", { section: name, row_id: String(row[section.key]), patch: readPatch(form, section.fields, row) });
      delete cache[name];
      dialog.close();
      show(name);
    } catch (error) {
      form.querySelector("[role=alert]").textContent = errorText(error);
      button.disabled = false;
    }
  });
  dialog.showModal();
}

function renderTable(name, rows, query) {
  const section = SECTIONS[name];
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter(row => JSON.stringify(row).toLowerCase().includes(q)) : rows;
  const wrap = document.getElementById("admTable");
  wrap.innerHTML = '<p class="small muted">Показано ' + shown.length + ' из ' + rows.length + '. Нажмите на строку, чтобы открыть.</p>' +
    '<div class="adm-wrap"><table class="adm-table"><thead><tr>' + section.columns.map(c => '<th>' + esc(c[1]) + '</th>').join("") + '</tr></thead><tbody>' +
    shown.slice(0, 500).map(row => '<tr data-i="' + rows.indexOf(row) + '">' + section.columns.map(([key, , format]) => {
      return '<td>' + esc(format ? format(row[key], row) : text(row[key])) + '</td>';
    }).join("") + '</tr>').join("") + '</tbody></table></div>';
  wrap.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => openEditor(name, rows[+tr.dataset.i]));
}

async function show(name) {
  if (!SECTIONS[name]) name = "requests";
  view.innerHTML = '<h1>Админка</h1><nav class="adm-tabs">' + Object.entries(SECTIONS).map(([key, s]) =>
    '<a href="#' + key + '"' + (key === name ? ' class="on"' : "") + '>' + esc(s.title) + (cache[key] ? '<b>' + cache[key].length + '</b>' : "") + '</a>').join("") +
    '</nav><input class="adm-search" type="search" placeholder="Поиск" id="admSearch"><div id="admTable"><p class="muted" role="status">Загрузка…</p></div>';
  try {
    cache[name] = cache[name] || await rpc("admin_list", { section: name });
    const tab = view.querySelector('.adm-tabs a[href="#' + name + '"]');
    if (tab && !tab.querySelector("b")) tab.insertAdjacentHTML("beforeend", "<b>" + cache[name].length + "</b>");
    const search = document.getElementById("admSearch");
    search.oninput = () => renderTable(name, cache[name], search.value);
    renderTable(name, cache[name], "");
  } catch (error) {
    document.getElementById("admTable").innerHTML = '<p class="err" role="alert">' + esc(errorText(error)) + '</p>';
  }
}

async function start() {
  try {
    client = await getSupabaseClient();
    const { data } = await client.auth.getSession();
    if (!data.session) {
      view.innerHTML = '<h1>Админка</h1><p class="lead">Сначала войдите в личный кабинет аккаунтом администратора.</p><a class="btn btn-primary" href="index.html#login">Войти</a>';
      return;
    }
    window.addEventListener("hashchange", () => show(location.hash.slice(1)));
    show(location.hash.slice(1));
  } catch (error) {
    view.innerHTML = '<p class="err" role="alert">' + esc(errorText(error)) + '</p>';
  }
}

start();
