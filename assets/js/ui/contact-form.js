import { sendContactRequest } from "../api/contact-requests.js";
import { esc } from "./format.js";

const rootUrl = new URL("../../../", import.meta.url);
const choose = (lang, en, ru, uz) => lang === "en" ? en : lang === "uz" ? uz : ru;

export function quickContactForm(lang = "ru", datasetId = "", requestType = "participation") {
  const tr = (en, ru, uz) => choose(lang, en, ru, uz);
  return '<form class="form quick-contact-form" data-contact-form data-dataset-id="' + esc(datasetId) + '"><input type="hidden" name="type" value="' + esc(requestType) + '">' +
    '<label><span>' + tr("Your name", "Как вас зовут?", "Ismingiz") + '</span><input name="name" autocomplete="name" required maxlength="120"></label>' +
    '<label><span>' + tr("How can we contact you?", "Как с вами связаться?", "Siz bilan qanday bogʻlanamiz?") + '</span><input name="contact" type="text" required maxlength="500" placeholder="' + tr("Telegram, phone, email or another contact", "Telegram, телефон, email или другой контакт", "Telegram, telefon, email yoki boshqa aloqa") + '"></label>' +
    '<label><span>' + tr("Comment · optional", "Комментарий · необязательно", "Izoh · ixtiyoriy") + '</span><textarea name="comment" rows="3" maxlength="20000"></textarea></label>' +
    '<label class="consent"><input type="checkbox" name="consent" required><span>' + tr("I agree to the processing of my information to reply to this request", "Согласен(на) на обработку данных для ответа на обращение", "Murojaatga javob berish uchun maʼlumotlarim qayta ishlanishiga roziman") + ' · <a href="' + new URL("documents/personal-data-consent.html", rootUrl).href + '" target="_blank" rel="noopener">' + tr("consent", "согласие", "rozilik") + '</a></span></label>' +
    '<button class="btn btn-primary" type="submit">' + (requestType === "participation" ? tr("I want to participate", "Хочу участвовать", "Ishtirok etmoqchiman") : tr("Send request", "Отправить запрос", "Soʻrov yuborish")) + '</button><p class="form-status small" role="status" aria-live="polite"></p></form>';
}

export function bindContactForms(root = document, lang = "ru") {
  for (const form of root.querySelectorAll("[data-contact-form]")) {
    if (form.dataset.bound) continue;
    form.dataset.bound = "true";
    form.elements.name.maxLength = 120;
    if (form.elements.email) form.elements.email.maxLength = 500;
    const requiredText = [form.elements.name, form.elements.contact || form.elements.email];
    for (const input of requiredText) input.addEventListener("input", () => input.setCustomValidity(""));
    let pending = null;
    form.addEventListener("submit", async event => {
      event.preventDefault();
      for (const input of requiredText) input.setCustomValidity(input.value.trim() ? "" : choose(lang, "Please fill in this field.", "Заполните это поле.", "Bu maydonni toʻldiring."));
      if (form.getAttribute("aria-busy") === "true" || !form.reportValidity()) return;
      const status = form.querySelector("[role=status]"), button = form.querySelector('[type="submit"]');
      const values = Object.fromEntries(new FormData(form));
      values.form_variant = form.id === "leadForm" ? "detailed" : "quick";
      values.language = lang;
      // Keep account tokens and other URL fragments out of the contact inbox.
      const page = new URL(location.href);
      page.hash = "";
      values.page_url = page.origin + page.pathname;
      values.dataset_id = form.dataset.datasetId || "";
      const fingerprint = JSON.stringify(values);
      if (!pending || pending.fingerprint !== fingerprint) pending = { id: crypto.randomUUID(), fingerprint };
      button.disabled = true;
      form.setAttribute("aria-busy", "true");
      status.classList.remove("err");
      status.textContent = choose(lang, "Sending…", "Отправляем…", "Yuborilmoqda…");
      try {
        await sendContactRequest(values, pending.id);
        status.textContent = choose(lang, "Thank you! Your request has been received.", "Спасибо! Ваше обращение получено.", "Rahmat! Murojaatingiz qabul qilindi.");
        form.reset();
        form.dispatchEvent(new Event("core:contact-sent"));
        pending = null;
      } catch {
        status.classList.add("err");
        status.textContent = choose(lang, "Could not send. Your text is saved here. Please try again.", "Не удалось отправить. Ваш текст сохранён в форме. Попробуйте ещё раз.", "Yuborib boʻlmadi. Matningiz shaklda saqlandi. Qayta urinib koʻring.");
      } finally {
        button.disabled = false;
        form.removeAttribute("aria-busy");
      }
    });
  }
}

export function mountQuickContacts(root = document, lang = "ru") {
  for (const target of root.querySelectorAll("[data-quick-contact]")) {
    if (!target.querySelector("form")) target.innerHTML = quickContactForm(lang, target.dataset.datasetId || "");
  }
  bindContactForms(root, lang);
}
