import { esc } from "./format.js";

function key(url) { return url.pathname + url.search; }

export function datasetBackLink(lang = "ru", fallback = "catalog.html") {
  let previous;
  try { previous = JSON.parse(sessionStorage.getItem("core-dataset-return:" + key(new URL(location.href))) || "null"); } catch {}
  const url = previous && new URL(previous.url, location.href);
  const valid = url && url.origin === location.origin;
  const label = valid ? previous.label : { en: "Catalog", ru: "Каталог", uz: "Katalog" }[lang];
  return '<a class="back campus-text-link" data-dataset-back href="' + esc(valid ? url.href : fallback) + '">← ' + esc(label) + '</a>';
}

export function initDatasetNavigation() {
  const lang = document.documentElement.dataset.staticLang || "ru";
  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || link.hasAttribute("data-dataset-back") || link.target === "_blank" || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (key(url) === key(new URL(location.href))) return;
    if (url.origin !== location.origin || !/\/(?:dataset|regions)\.html$|\/datasets\/[^/]+\.html$/.test(url.pathname)) return;
    const label = /#favorites$/.test(location.href) ? ["Favorites", "Избранное", "Saralanganlar"] : /\/catalog\.html$/.test(location.pathname) ? ["Back to results", "Назад к результатам", "Natijalarga qaytish"] : /\/organization\.html$/.test(location.pathname) ? ["Organization", "К организации", "Tashkilotga"] : /\/digests\.html$/.test(location.pathname) ? ["Back to the selection", "К подборке", "Tanlovga"] : ["Back", "Назад", "Orqaga"];
    const languageIndex = lang === "en" ? 0 : lang === "uz" ? 2 : 1;
    try {
      sessionStorage.setItem("core-dataset-return:" + key(url), JSON.stringify({ url: location.href, label: label[languageIndex] }));
      sessionStorage.setItem("core-return-scroll", JSON.stringify({ url: location.href, y: window.scrollY }));
    } catch {}
  });
  let restored = false;
  function restore() {
    if (restored || document.getElementById("cat") && !document.getElementById("catList")) return;
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem("core-return-scroll") || "null"); } catch {}
    if (saved?.url === location.href) {
      restored = true;
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: saved.y, left: 0, behavior: "instant" })));
    }
  }
  window.addEventListener("pageshow", () => { restored = false; restore(); });
  window.addEventListener("core:catalog-ready", restore);
}
