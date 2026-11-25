import { mountQuickContacts } from "./js/ui/contact-form.js";

const lang = document.documentElement.dataset.staticLang || "ru";
mountQuickContacts(document, lang);
const refresh = () => {
  const guest = !window.CORE_ACCOUNT?.load().user;
  for (const element of document.querySelectorAll("[data-guest-only]")) element.hidden = !guest;
};
refresh();
window.addEventListener("core:account", refresh);
document.addEventListener("core:quick-contact", () => { mountQuickContacts(document, lang); refresh(); });
// "Where shall we start?" cards lead to the one short form below and keep the request type.
document.addEventListener("click", event => {
  const link = event.target.closest("[data-request-type]");
  const type = link && document.querySelector('#participate input[name="type"]');
  if (type) type.value = link.dataset.requestType;
});
