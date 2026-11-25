import { getAccountStore } from "../api/auth.js";
import { getCatalog, getUniversityAliases, fetchCatalog, fetchDatasetUsage } from "../api/datasets.js";
import { createCatalogCard } from "../ui/catalog-card.js";
import { datasetTopicName } from "../ui/data-labels.js";
import { isCoreDataset } from "../url.js";

export async function initCatalog({ symbolsUrl }) {
  var previousItems = getCatalog() || [], ALL, root = document.getElementById("cat");
  if (!root) return;
  var lang = document.documentElement.getAttribute("data-static-lang") || "en";
  var L = function (o) { return o ? (o[lang] || o.ru || o.en || "") : ""; };
  var tr = function (en, ru, uz) { return lang === "en" ? en : lang === "uz" ? uz : ru; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var nf = function (n) { return Number(n).toLocaleString(lang === "en" ? "en-US" : "ru-RU"); };
  root.innerHTML = '<p class="lead" role="status">' + tr("Loading the catalog…", "Загружаем каталог…", "Katalog yuklanmoqda…") + '</p>';
  try { ALL = await fetchCatalog(); }
  catch (error) {
    root.innerHTML = '<div class="card"><p role="alert">' + tr("The catalog could not be loaded. Check your connection and try again.", "Не удалось загрузить каталог. Проверьте соединение и попробуйте снова.", "Katalogni yuklab boʻlmadi. Ulanishni tekshirib, qayta urinib koʻring.") + '</p><button type="button" class="btn btn-primary" id="retryCatalog">' + tr("Retry", "Повторить", "Qayta urinish") + '</button></div>';
    document.getElementById("retryCatalog").onclick = () => initCatalog({ symbolsUrl });
    return;
  }
  var fieldName = value => datasetTopicName(value, lang);
  var GROUPS = [["", tr("Everything", "Всё", "Hammasi")], ["core", tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan")], ["open", tr("External publications", "Внешние публикации", "Tashqi nashrlar")]];
  var state = { q: "", g: "", c: "", f: "", u: "", sort: "rel", shown: 24 };
  var account = getAccountStore(), currentUser = null, favoriteIds = [];
  var q0 = new URLSearchParams(location.search);
  if (q0.get("q")) state.q = q0.get("q");
  if (q0.get("g")) state.g = q0.get("g");
  for (const parameter of ["c", "f"]) if (q0.get(parameter)) state[parameter] = q0.get(parameter);
  if (q0.get("sort") === "new") state.sort = "new";
  const shown = Number(q0.get("shown"));
  if (Number.isSafeInteger(shown) && shown >= 24) state.shown = Math.min(shown, Math.max(24, ALL.length));

  /* Universities: one entry per organisation, searchable by English, Russian and national names and acronyms */
  var ALT = getUniversityAliases(), UNI = {}, UNIS = [];
  ALL.forEach(function (it) {
    var k = it.org.en; if (!k || k === "CORE") return;
    if (!UNI[k]) UNIS.push(UNI[k] = { k: k, label: lang !== "en" && it.org.ru ? it.org.ru : k, n: 0, hay: (k + " " + (it.org.ru || "") + " " + (ALT[k] || "")).toLowerCase() });
    UNI[k].n++;
  });
  UNIS.sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label); });
  if (q0.get("u") && UNI[q0.get("u")]) state.u = q0.get("u");
  else if (q0.get("u")) {
    const old = previousItems.find(item => item.org.en === q0.get("u"));
    const current = old && ALL.find(item => item.id === old.id);
    if (current && UNI[current.org.en]) state.u = current.org.en;
  }

  var fields = {};
  ALL.forEach(function (it) { if (it.f) fields[it.f] = (fields[it.f] || 0) + 1; });
  var fieldOpts = Object.keys(fields).sort(function (a, b) { return fields[b] - fields[a]; });

  root.innerHTML =
    '<div class="cat-search"><input type="search" id="catQ" autocomplete="off" placeholder="' + esc(tr("Search: corpus, wheat, Aral, clinics, survey, speech…", "Поиск: корпус, пшеница, Арал, клиники, опрос, речь…", "Qidiruv: korpus, bugʻdoy, Orol, klinikalar, soʻrov, nutq…")) + '" value="' + esc(state.q) + '">' +
    '<span class="cat-count" id="catN"></span></div>' +
    '<div class="cat-uni"><input type="search" id="catU" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="catUL" aria-label="' + esc(tr("Organization", "Организация", "Tashkilot")) + '" placeholder="' +
    esc(tr("University or company: name…", "Университет или компания: название…", "Universitet yoki kompaniya nomi…")) + '" value="' + esc(state.u ? UNI[state.u].label : "") + '">' +
    '<span class="cat-uni-n">' + tr(UNIS.length + " organizations", UNIS.length + " организаций", UNIS.length + " ta tashkilot") + '</span>' +
    '<div class="cat-uni-list card" id="catUL" role="listbox" hidden></div></div>' +
    '<div class="cat-filters"><div class="seg" id="catG">' + GROUPS.map(function (g) { return '<button data-g="' + g[0] + '">' + g[1] + "</button>"; }).join("") + "</div>" +
    '<div class="seg" id="catC"><button data-c="">' + tr("All countries", "Все страны", "Barcha mamlakatlar") + '</button><button data-c="UZ">UZ</button><button data-c="KZ">KZ</button><button data-c="KG">KG</button><button data-c="TJ">TJ</button></div>' +
    '<select id="catF" aria-label="' + tr("Field", "Область", "Soha") + '"><option value="">' + tr("All fields", "Все области", "Barcha sohalar") + "</option>" +
    fieldOpts.map(function (f) { return '<option value="' + esc(f) + '">' + esc(fieldName(f)) + " (" + fields[f] + ")</option>"; }).join("") + "</select>" +
    '<select id="catS" aria-label="' + tr("Sort", "Сортировка", "Saralash") + '"><option value="rel">' + tr("CORE first", "Сначала CORE", "Avval CORE") + '</option><option value="new">' + tr("Newest first", "Сначала новые", "Avval yangilari") + "</option></select></div>" +
    '<p class="favorite-status" id="favoriteStatus" role="status"></p><p class="small muted" id="usageStatus" role="status"></p><div class="cat-list" id="catList"></div><div class="cat-more"><button class="btn btn-ghost" id="catMore">' + tr("Show more", "Показать ещё", "Yana koʻrsatish") + "</button></div>";

  var list = document.getElementById("catList");
  var usageResource = { ready: false, rows: {} };
  var card = createCatalogCard({ lang, L, tr, esc, nf, fieldName, UNI, state, account, symbolsUrl, usageResource });
  function match(it) {
    if (state.g === "core" && !isCoreDataset(it)) return false;
    if (state.g === "open" && it.t !== "open") return false;
    if (state.c && (it.c || "").indexOf(state.c) < 0) return false;
    if (state.f && it.f !== state.f) return false;
    if (state.u && it.org.en !== state.u) return false;
    if (state.q) {
      var hay = (L(it.title) + " " + (it.title.en || "") + " " + L(it.desc) + " " + (it.org.en || "") + " " + (it.org.ru || "") + " " + (ALT[it.org.en] || "") + " " + it.f + " " + fieldName(it.f) + " " + (it.fm || "")).toLowerCase();
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        var alts = [words[i]].concat(SYN.filter(function (s) { return words[i].indexOf(s[0]) === 0 || s[0].indexOf(words[i]) === 0 && words[i].length >= 4; }).map(function (s) { return s[1]; }));
        if (!alts.some(function (a) { return hay.indexOf(a) >= 0; })) return false;
      }
    }
    return true;
  }
  var rank = { base: 0, layer: 1, prep: 2, dataset: 3, open: 4 };
  /* Russian and Uzbek stems -> English words, so a search in RU/UZ finds English titles */
  var SYN = [["пшениц", "wheat"], ["bugʻdoy", "wheat"], ["хлопок", "cotton"], ["хлопч", "cotton"], ["paxta", "cotton"], ["вод", "water"], ["suv", "water"], ["почв", "soil"], ["tuproq", "soil"],
    ["климат", "climat"], ["iqlim", "climat"], ["засух", "drought"], ["арал", "aral"], ["orol", "aral"], ["урож", "yield"], ["сельск", "agricult"], ["qishloq", "agricult"], ["растен", "plant"], ["флор", "flora"],
    ["животн", "animal"], ["птиц", "bird"], ["рыб", "fish"], ["лес", "forest"], ["речь", "speech"], ["речев", "speech"], ["nutq", "speech"], ["голос", "voice"], ["корпус", "corpus"], ["korpus", "corpus"],
    ["текст", "text"], ["matn", "text"], ["язык", "language"], ["til", "language"], ["узбек", "uzbek"], ["oʻzbek", "uzbek"], ["казах", "kazakh"], ["qozoq", "kazakh"], ["кыргыз", "kyrgyz"], ["таджик", "tajik"],
    ["перевод", "translat"], ["опрос", "survey"], ["soʻrov", "survey"], ["анкет", "questionnaire"], ["студент", "student"], ["talaba", "student"], ["образован", "educat"], ["taʼlim", "educat"],
    ["медицин", "medic"], ["tibbiy", "medic"], ["клиник", "clinic"], ["больниц", "hospital"], ["пациент", "patient"], ["bemor", "patient"], ["рак", "cancer"], ["ген", "gene"], ["днк", "dna"], ["covid", "covid"],
    ["экономик", "econom"], ["iqtisod", "econom"], ["финанс", "financ"], ["банк", "bank"], ["страхов", "insur"], ["sugʻurta", "insur"], ["право", "law"], ["закон", "law"], ["huquq", "law"],
    ["истор", "histor"], ["tarix", "histor"], ["археолог", "archaeolog"], ["наслед", "heritage"], ["туризм", "touris"], ["город", "urban"], ["транспорт", "transport"], ["энерг", "energ"],
    ["изображен", "image"], ["снимк", "image"], ["спутник", "satellite"], ["модел", "model"], ["нейросет", "neural"], ["машинн", "machine learning"], ["землетряс", "earthquake"], ["геолог", "geolog"]];
  function render() {
    syncUrl();
    if (account) { currentUser = account.load().user; favoriteIds = account.favoriteIds(); }
    var rows = ALL.filter(match).sort(function (a, b) {
      if (state.sort === "new") return (b.y || 0) - (a.y || 0) || rank[a.t] - rank[b.t];
      return rank[a.t] - rank[b.t] || (b.ca || 0) - (a.ca || 0) || (b.y || 0) - (a.y || 0);
    });
    document.getElementById("catN").textContent = tr("Found: ", "Найдено: ", "Topildi: ") + nf(rows.length);
    list.innerHTML = rows.length ? rows.slice(0, state.shown).map(function (it) { return card(it, currentUser, favoriteIds); }).join("") :
      '<div class="cat-empty card"><b>' + tr("Nothing found.", "Ничего не нашлось.", "Hech narsa topilmadi.") + "</b><p>" +
      tr("Tell us what you need — we will check university archives and collect it to order.", "Напишите, что нужно, — проверим архивы вузов и соберём под заказ.", "Nima kerakligini yozing — universitet arxivlarini tekshiramiz va buyurtma boʻyicha yigʻamiz.") +
      '</p><a class="btn btn-primary btn-sm" href="#contact" data-form="buyer">' + tr("Request data", "Запросить данные", "Maʼlumot soʻrash") + "</a></div>";
    document.getElementById("catMore").parentNode.hidden = rows.length <= state.shown;
    ["catG", "catC"].forEach(function (id) {
      var key = id === "catG" ? "g" : "c";
      Array.prototype.forEach.call(document.querySelectorAll("#" + id + " button"), function (b) { b.classList.toggle("on", b.getAttribute("data-" + key) === state[key]); });
    });
    window.dispatchEvent(new Event("core:catalog-ready"));
  }
  var tmr;
  document.getElementById("catQ").addEventListener("input", function () { var v = this.value; clearTimeout(tmr); tmr = setTimeout(function () { state.q = v.trim(); state.shown = 24; render(); }, 120); });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-favorite")) {
      var datasetId = b.getAttribute("data-favorite");
      if (!account.toggleFavorite(datasetId)) { location.href = account.cabinetUrl("#login/favorite/" + encodeURIComponent(datasetId)); return; }
      render();
      var updated = root.querySelector('[data-favorite="' + CSS.escape(datasetId) + '"]');
      if (updated) updated.focus({ preventScroll: true });
      document.getElementById("favoriteStatus").textContent = tr("Selection updated in this browser's demo profile.", "Подборка обновлена в демо-профиле этого браузера.", "Tanlanma ushbu brauzerdagi namoyish profilida yangilandi.");
      return;
    }
    if (b.hasAttribute("data-g")) { state.g = b.getAttribute("data-g"); state.shown = 24; render(); }
    if (b.hasAttribute("data-c")) { state.c = b.getAttribute("data-c"); state.shown = 24; render(); }
    if (b.id === "catMore") { state.shown += 24; render(); }
    if (b.hasAttribute("data-u")) { pickUni(b.getAttribute("data-u")); root.scrollIntoView({ behavior: "smooth" }); }
  });
  window.addEventListener("storage", function (e) { if (account && e.key === account.key) render(); });
  window.addEventListener("pageshow", function () { render(); });
  window.addEventListener("core:account", function () { render(); });
  /* University picker */
  var uIn = document.getElementById("catU"), uList = document.getElementById("catUL"), uSel = -1, uRows = [];
  function syncUrl() {
    var p = new URLSearchParams(location.search);
    for (const key of ["q", "g", "c", "f", "u"]) {
      if (state[key]) p.set(key, state[key]); else p.delete(key);
    }
    if (state.sort !== "rel") p.set("sort", state.sort); else p.delete("sort");
    if (state.shown > 24) p.set("shown", state.shown); else p.delete("shown");
    var qs = p.toString(); history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  }
  /* Cyrillic -> Latin, so "самарканд" finds "Samarkand" when the registry has no Russian name;
     "h" is ignored on both sides because spellings differ (Fergana / Ferghana) */
  var LAT = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", қ: "q", ғ: "gh", ў: "o", ҳ: "h", ә: "a", ө: "o", ү: "u", ұ: "u", і: "i", ң: "n" };
  function lat(w) { return w.replace(/[а-яёқғўҳәөүұің]/g, function (c) { return LAT[c]; }); }
  function pickUni(k) {
    state.u = k || ""; state.shown = 24;
    uIn.value = state.u ? UNI[state.u].label : "";
    closeUni(); syncUrl(); render();
  }
  function closeUni() { uList.hidden = true; uIn.setAttribute("aria-expanded", "false"); uSel = -1; }
  function openUni() {
    var v = uIn.value.trim().toLowerCase();
    if (state.u && uIn.value === UNI[state.u].label) v = "";
    var words = v.split(/\s+/).filter(Boolean);
    uRows = UNIS.filter(function (u) { return words.every(function (w) { return u.hay.indexOf(w) >= 0 || u.hay.replace(/h/g, "").indexOf(lat(w).replace(/h/g, "")) >= 0; }); }).slice(0, 8);
    if (state.u && !words.length) uRows.unshift({ k: "", label: tr("All organizations", "Все организации", "Barcha tashkilotlar"), n: ALL.length });
    uSel = -1;
    uList.innerHTML = uRows.length ? uRows.map(function (u, i) {
      return '<button type="button" role="option" class="cat-uni-opt' + (u.k === state.u ? " on" : "") + '" data-i="' + i + '"><span>' + esc(u.label) + "</span><small>" + nf(u.n) + "</small></button>";
    }).join("") : '<p class="cat-uni-none">' + tr("No such organization in the catalog yet.", "Такой организации в каталоге пока нет.", "Bunday tashkilot katalogda hozircha yoʻq.") + "</p>";
    uList.hidden = false; uIn.setAttribute("aria-expanded", "true");
  }
  function hl() { Array.prototype.forEach.call(uList.querySelectorAll(".cat-uni-opt"), function (b, i) { b.classList.toggle("hl", i === uSel); if (i === uSel) b.scrollIntoView({ block: "nearest" }); }); }
  uIn.addEventListener("focus", function () { uIn.value = ""; openUni(); });
  uIn.addEventListener("input", function () { if (!uIn.value.trim() && state.u) { pickUni(""); uIn.focus(); } openUni(); });
  uIn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (uList.hidden) openUni(); if (!uRows.length) return; uSel = (uSel + (e.key === "ArrowDown" ? 1 : uRows.length - 1)) % uRows.length; hl(); }
    else if (e.key === "Enter") { e.preventDefault(); var r = uRows[uSel < 0 ? 0 : uSel]; if (r && !uList.hidden) { pickUni(r.k); uIn.blur(); } }
    else if (e.key === "Escape") { closeUni(); uIn.value = state.u ? UNI[state.u].label : ""; }
  });
  uList.addEventListener("mousedown", function (e) { e.preventDefault(); });
  uList.addEventListener("click", function (e) { var b = e.target.closest(".cat-uni-opt"); if (b) { pickUni(uRows[+b.getAttribute("data-i")].k); uIn.blur(); } });
  uIn.addEventListener("blur", function () { closeUni(); uIn.value = state.u ? UNI[state.u].label : ""; });

  document.getElementById("catF").addEventListener("change", function () { state.f = this.value; state.shown = 24; render(); });
  document.getElementById("catS").addEventListener("change", function () { state.sort = this.value; render(); });
  document.getElementById("catF").value = state.f;
  document.getElementById("catS").value = state.sort;
  render();
  async function loadUsage() {
    const message = document.getElementById("usageStatus");
    message.textContent = tr("Loading information about use…", "Загружаем сведения об использовании…", "Foydalanish maʼlumoti yuklanmoqda…");
    try {
      const rows = await fetchDatasetUsage();
      usageResource.rows = {};
      rows.forEach(row => { (usageResource.rows[row.dataset_id] ||= []).push(row); });
      usageResource.ready = true;
      message.textContent = tr("Demo examples of use are marked in the dataset cards.", "Демонстрационные примеры использования отмечены в карточках.", "Foydalanishning namoyish misollari toʻplam kartalarida belgilangan.");
      render();
    } catch (error) {
      message.innerHTML = tr("Information about use could not be loaded.", "Сведения об использовании не удалось загрузить.", "Foydalanish maʼlumotini yuklab boʻlmadi.") + ' <button type="button" class="mvp-link" id="retryCatalogUsage">' + tr("Retry", "Повторить", "Qayta urinish") + '</button>';
      document.getElementById("retryCatalogUsage").onclick = loadUsage;
    }
  }
  loadUsage();
}
