/* CORE landing — deployment settings. Fill in before going live. */
window.CORE_CONFIG = {
  // POST endpoint that accepts JSON leads (Formspree, Make/Zapier webhook, your own API, Telegram bot relay…).
  // Example: "https://formspree.io/f/xxxxxxx"
  // FormSubmit delivers each lead straight to the inbox. The very first submission sends an
  // activation email to this address — click "Activate Form" in it once.
  formEndpoint: "https://formsubmit.co/ajax/core@samdu.uz",
  // Fallback: if no endpoint is set, the form opens the visitor's mail client addressed here.
  contactEmail: "core@samdu.uz"
};
