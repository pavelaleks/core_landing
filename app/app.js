/* Cabinet entry point. Keep its URL stable for existing links. */
import { initCabinet } from "../assets/js/pages/cabinet.js";

initCabinet();

/* Mobile header: logo + burger; the cabinet menu opens as a dropdown. */
const top = document.querySelector(".mvp-top"), burger = top.querySelector(".burger");
const setOpen = open => { top.classList.toggle("open", open); burger.setAttribute("aria-expanded", String(open)); };
burger.addEventListener("click", () => setOpen(!top.classList.contains("open")));
top.addEventListener("click", event => { if (event.target.closest("#nav a, #who button")) setOpen(false); });
window.addEventListener("hashchange", () => setOpen(false));
