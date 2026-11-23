/* Catalog entry point. Asset URLs stay relative to the existing assets directory. */
import { initCatalog } from "./js/pages/catalog.js";

initCatalog({ symbolsUrl: new URL("illustrations/data-symbols.svg", import.meta.url).href });
