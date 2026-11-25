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
