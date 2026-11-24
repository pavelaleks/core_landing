import { listUniversities, organizationName } from "../api/organizations.js";
import { ORGANIZATION_ROLES } from "../api/profiles.js";
import { databaseMessage } from "../api/query.js";
import { esc } from "./format.js";

let universitiesPromise;
export function organizationFields() {
  return '<fieldset class="account-roles"><legend>Я представляю</legend><label><input type="radio" name="accountType" value="university" checked> Университет</label><label><input type="radio" name="accountType" value="buyer"> Компанию</label></fieldset>' +
    '<label class="f" id="registrationUniversity"><span>Университет</span><input name="university" list="registrationUniversities" placeholder="Начните вводить название или страну" autocomplete="off" required><datalist id="registrationUniversities"></datalist></label>' +
    '<label class="f" id="registrationCompany" hidden><span>Название компании</span><input name="org" autocomplete="organization" maxlength="200" disabled></label>' +
    '<p id="universityLoadStatus" class="small muted" role="status">Загружаем список университетов…</p>' +
    '<label class="f"><span>Ваша роль в организации</span><select name="organizationRole">' +
    Object.entries(ORGANIZATION_ROLES).map(([id, label]) => '<option value="' + id + '">' + esc(label) + '</option>').join("") + '</select></label>' +
    '<p class="auth-hint">Роль описывает вашу работу в организации. Подтверждение аккаунта выполняет команда CORE.</p>';
}

export function bindOrganizationFields(form, initial = {}) {
  let universities = [];
  const university = form.elements.university, company = form.elements.org;
  const status = form.querySelector("#universityLoadStatus");
  function switchType() {
    const isUniversity = form.elements.accountType.value === "university";
    form.querySelector("#registrationUniversity").hidden = !isUniversity;
    form.querySelector("#registrationCompany").hidden = isUniversity;
    university.disabled = !isUniversity; university.required = isUniversity;
    company.disabled = isUniversity; company.required = !isUniversity;
    status.hidden = !isUniversity;
  }
  form.querySelectorAll('[name="accountType"]').forEach(input => input.addEventListener("change", switchType));
  university.addEventListener("input", () => university.setCustomValidity(""));
  company.addEventListener("input", () => company.setCustomValidity(""));
  if (initial.accountType === "buyer") form.elements.accountType.value = "buyer";
  company.value = initial.org || "";
  if (Object.hasOwn(ORGANIZATION_ROLES, initial.organizationRole)) form.elements.organizationRole.value = initial.organizationRole;
  switchType();
  async function load() {
    status.textContent = "Загружаем список университетов…";
    if (!universitiesPromise) universitiesPromise = listUniversities().catch(error => { universitiesPromise = null; throw error; });
    try {
      const rows = await universitiesPromise;
      if (!form.isConnected) return;
      universities = rows.map(row => ({ ...row, label: organizationName(row) + " · " + row.country }));
      universities.sort((a, b) => a.label.localeCompare(b.label, "ru"));
      form.querySelector("#registrationUniversities").innerHTML = universities.map(row => '<option value="' + esc(row.label) + '" label="' + esc([row.name_en, row.name_uz, row.name].filter(Boolean).join(" · ")) + '"></option>').join("");
      const selected = universities.find(row => row.id === initial.organizationId || organizationName(row) === initial.org);
      if (selected) university.value = selected.label;
      status.textContent = universities.length + " университетов. Выберите название из списка.";
    } catch (error) {
      if (!form.isConnected) return;
      status.innerHTML = esc(databaseMessage(error)) + ' <button type="button" class="mvp-link" id="retryUniversities">Повторить</button>';
      form.querySelector("#retryUniversities").onclick = load;
    }
  }
  load();
  return () => {
    const accountType = form.elements.accountType.value;
    const selected = universities.find(row => row.label === university.value.trim());
    if (accountType === "university" && !selected) {
      university.setCustomValidity("Выберите университет из загруженного списка.");
      university.reportValidity();
      return null;
    }
    const org = accountType === "university" ? organizationName(selected) : company.value.trim();
    if (!org) { company.setCustomValidity("Укажите название компании."); company.reportValidity(); return null; }
    company.setCustomValidity("");
    return { accountType, org, organizationId: selected?.id, organizationRole: form.elements.organizationRole.value };
  };
}
