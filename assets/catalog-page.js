/* Catalog page: search and filter everything CORE offers or has found. */
(function () {
  "use strict";
  var ALL = window.CORE_CATALOG, root = document.getElementById("cat");
  if (!ALL || !root) return;
  var lang = document.documentElement.getAttribute("data-static-lang") || "en";
  var UZD = window.CORE_UZ || {}, TOP = window.CORE_TOPIC_RU || {};
  var L = function (o) { return o ? (o[lang] || o.ru || o.en || "") : ""; };
  var tr = function (en, ru, uz) { return lang === "en" ? en : lang === "uz" ? uz : ru; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var nf = function (n) { return Number(n).toLocaleString(lang === "en" ? "en-US" : "ru-RU"); };
  var FIELD_LOCAL = { Education: ["Education", "Образование", "Taʼlim"], Medicine: ["Medicine", "Медицина", "Tibbiyot"], Research: ["Research", "Наука", "Ilm-fan"], Demography: ["Demography", "Демография", "Demografiya"] };
  var fieldName = function (f) {
    if (FIELD_LOCAL[f]) return tr.apply(null, FIELD_LOCAL[f]);
    if (lang === "en") return f;
    var ru = TOP[f] || f; return lang === "uz" ? (UZD[ru] || ru) : ru;
  };
  var TYPE = {
    base: [tr("CORE database", "База CORE", "CORE bazasi"), "t-teal"],
    prep: [tr("Prepared by CORE", "Подготовлено CORE", "CORE tayyorlagan"), "t-violet"],
    layer: [tr("CORE data layer", "Слой данных CORE", "CORE maʼlumotlar qatlami"), "t-teal"],
    open: [tr("Scholars' open dataset", "Открытый набор учёных", "Olimlarning ochiq toʻplami"), ""]
  };
  var STATUS = {
    buy: [tr("Licensable now", "Можно лицензировать", "Hozir litsenziyalash mumkin"), "st-now"],
    demo: [tr("Demo access", "Демо-доступ", "Demo kirish"), "st-api"],
    open: [tr("Open at the source · CORE prepares on request", "Открыт у авторов · CORE подготовит по запросу", "Mualliflarda ochiq · CORE soʻrov boʻyicha tayyorlaydi"), "st-req"]
  };
  var GROUPS = [["", tr("Everything", "Всё", "Hammasi")], ["core", tr("From CORE", "От CORE", "CORE dan")], ["open", tr("Scholars' open datasets", "Открытые наборы учёных", "Olimlarning ochiq toʻplamlari")]];
  var state = { q: "", g: "", c: "", f: "", u: "", sort: "rel", shown: 24 };
  var q0 = new URLSearchParams(location.search);
  if (q0.get("q")) state.q = q0.get("q");
  if (q0.get("g")) state.g = q0.get("g");

  /* Universities: one entry per organisation, searchable by English, Russian and national names and acronyms */
  var ALT = window.CORE_UNI_ALT || {}, UNI = {}, UNIS = [];
  ALL.forEach(function (it) {
    var k = it.org.en; if (!k || k === "CORE") return;
    if (!UNI[k]) UNIS.push(UNI[k] = { k: k, label: lang !== "en" && it.org.ru ? it.org.ru : k, n: 0, hay: (k + " " + (it.org.ru || "") + " " + (ALT[k] || "")).toLowerCase() });
    UNI[k].n++;
  });
  UNIS.sort(function (a, b) { return b.n - a.n || a.label.localeCompare(b.label); });
  if (q0.get("u") && UNI[q0.get("u")]) state.u = q0.get("u");

  var fields = {};
  ALL.forEach(function (it) { if (it.f) fields[it.f] = (fields[it.f] || 0) + 1; });
  var fieldOpts = Object.keys(fields).sort(function (a, b) { return fields[b] - fields[a]; });

  root.innerHTML =
    '<div class="cat-search"><input type="search" id="catQ" autocomplete="off" placeholder="' + esc(tr("Search: corpus, wheat, Aral, clinics, survey, speech…", "Поиск: корпус, пшеница, Арал, клиники, опрос, речь…", "Qidiruv: korpus, bugʻdoy, Orol, klinikalar, soʻrov, nutq…")) + '" value="' + esc(state.q) + '">' +
    '<span class="cat-count" id="catN"></span></div>' +
    '<div class="cat-uni"><input type="search" id="catU" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="catUL" aria-label="' + esc(tr("University", "Университет", "Universitet")) + '" placeholder="' +
    esc(tr("University: e.g. Nazarbayev, Urgench, Samarkand…", "Университет: например, Назарбаев, Ургенч, Самарканд…", "Universitet: masalan, Nazarboyev, Urganch, Samarqand…")) + '" value="' + esc(state.u ? UNI[state.u].label : "") + '">' +
    '<span class="cat-uni-n">' + tr(UNIS.length + " universities", UNIS.length + " вузов", UNIS.length + " ta OTM") + '</span>' +
    '<div class="cat-uni-list card" id="catUL" role="listbox" hidden></div></div>' +
    '<div class="cat-filters"><div class="seg" id="catG">' + GROUPS.map(function (g) { return '<button data-g="' + g[0] + '">' + g[1] + "</button>"; }).join("") + "</div>" +
    '<div class="seg" id="catC"><button data-c="">' + tr("All countries", "Все страны", "Barcha mamlakatlar") + '</button><button data-c="UZ">UZ</button><button data-c="KZ">KZ</button><button data-c="KG">KG</button><button data-c="TJ">TJ</button></div>' +
    '<select id="catF" aria-label="' + tr("Field", "Область", "Soha") + '"><option value="">' + tr("All fields", "Все области", "Barcha sohalar") + "</option>" +
    fieldOpts.map(function (f) { return '<option value="' + esc(f) + '">' + esc(fieldName(f)) + " (" + fields[f] + ")</option>"; }).join("") + "</select>" +
    '<select id="catS" aria-label="' + tr("Sort", "Сортировка", "Saralash") + '"><option value="rel">' + tr("CORE first", "Сначала CORE", "Avval CORE") + '</option><option value="new">' + tr("Newest first", "Сначала новые", "Avval yangilari") + "</option></select></div>" +
    '<div class="cat-list" id="catList"></div><div class="cat-more"><button class="btn btn-ghost" id="catMore">' + tr("Show more", "Показать ещё", "Yana koʻrsatish") + "</button></div>";

  var list = document.getElementById("catList");
  function match(it) {
    if (state.g === "core" && it.t === "open") return false;
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
  var rank = { base: 0, layer: 1, prep: 2, open: 3 };
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
  function card(it) {
    var ty = TYPE[it.t], st = STATUS[it.st], ext = it.t === "open";
    var orgName = esc(lang === "en" ? it.org.en : (it.org.ru || it.org.en));
    var meta = [UNI[it.org.en] && state.u !== it.org.en ? '<button type="button" class="cat-org" data-u="' + esc(it.org.en) + '" title="' + esc(tr("All datasets of this university", "Все наборы этого вуза", "Shu OTMning barcha toʻplamlari")) + '">' + orgName + "</button>" : orgName, esc((it.c || "").replace(/;\s*/g, " · ")), esc(fieldName(it.f))];
    if (it.y) meta.push(it.y);
    var facts = [];
    if (it.n) facts.push(nf(it.n) + " " + tr("records", "записей", "yozuv"));
    if (it.lic) facts.push(esc(it.lic));
    if (it.fm) facts.push(esc(it.fm));
    var actions = ext
      ? '<a class="btn btn-ghost btn-sm" href="' + esc(it.href) + '" target="_blank" rel="noopener">' + tr("Source", "Источник", "Manba") + ' ↗</a><a class="btn btn-ghost btn-sm" href="#contact" data-form="buyer">' + tr("Prepare via CORE", "Подготовить через CORE", "CORE orqali tayyorlash") + "</a>"
      : '<a class="btn btn-primary btn-sm" href="' + esc(/^app\//.test(it.href) && lang !== "en" ? "../" + it.href : it.href) + '">' + (it.st === "demo" ? tr("Open in the demo", "Открыть в демо", "Demoda ochish") : tr("Open", "Открыть", "Ochish")) + "</a>";
    return '<article class="cat-item card' + (ext ? "" : " cat-core") + '"><div class="cat-tags"><span class="tag ' + ty[1] + '">' + ty[0] + '</span><span class="st ' + st[1] + '">' + st[0] + "</span></div>" +
      "<h3>" + esc(L(it.title)) + '</h3><p class="cat-meta">' + meta.filter(Boolean).join(" · ") + "</p>" +
      (it.desc ? '<p class="cat-desc">' + esc(L(it.desc)) + "</p>" : "") +
      '<div class="cat-foot"><span class="cat-facts">' + facts.join(" · ") + '</span><span class="cat-act">' + actions + "</span></div></article>";
  }
  function render() {
    var rows = ALL.filter(match).sort(function (a, b) {
      if (state.sort === "new") return (b.y || 0) - (a.y || 0) || rank[a.t] - rank[b.t];
      return rank[a.t] - rank[b.t] || (b.ca || 0) - (a.ca || 0) || (b.y || 0) - (a.y || 0);
    });
    document.getElementById("catN").textContent = tr("Found: ", "Найдено: ", "Topildi: ") + nf(rows.length);
    list.innerHTML = rows.length ? rows.slice(0, state.shown).map(card).join("") :
      '<div class="cat-empty card"><b>' + tr("Nothing found.", "Ничего не нашлось.", "Hech narsa topilmadi.") + "</b><p>" +
      tr("Tell us what you need — we will check university archives and collect it to order.", "Напишите, что нужно, — проверим архивы вузов и соберём под заказ.", "Nima kerakligini yozing — universitet arxivlarini tekshiramiz va buyurtma boʻyicha yigʻamiz.") +
      '</p><a class="btn btn-primary btn-sm" href="#contact" data-form="buyer">' + tr("Request data", "Запросить данные", "Maʼlumot soʻrash") + "</a></div>";
    document.getElementById("catMore").parentNode.hidden = rows.length <= state.shown;
    ["catG", "catC"].forEach(function (id) {
      var key = id === "catG" ? "g" : "c";
      Array.prototype.forEach.call(document.querySelectorAll("#" + id + " button"), function (b) { b.classList.toggle("on", b.getAttribute("data-" + key) === state[key]); });
    });
  }
  var tmr;
  document.getElementById("catQ").addEventListener("input", function () { var v = this.value; clearTimeout(tmr); tmr = setTimeout(function () { state.q = v.trim(); state.shown = 24; render(); }, 120); });
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-g")) { state.g = b.getAttribute("data-g"); state.shown = 24; render(); }
    if (b.hasAttribute("data-c")) { state.c = b.getAttribute("data-c"); state.shown = 24; render(); }
    if (b.id === "catMore") { state.shown += 24; render(); }
    if (b.hasAttribute("data-u")) { pickUni(b.getAttribute("data-u")); root.scrollIntoView({ behavior: "smooth" }); }
  });
  /* University picker */
  var uIn = document.getElementById("catU"), uList = document.getElementById("catUL"), uSel = -1, uRows = [];
  function syncUrl() {
    var p = new URLSearchParams(location.search);
    if (state.u) p.set("u", state.u); else p.delete("u");
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
    if (state.u && !words.length) uRows.unshift({ k: "", label: tr("All universities", "Все вузы", "Barcha OTMlar"), n: ALL.length });
    uSel = -1;
    uList.innerHTML = uRows.length ? uRows.map(function (u, i) {
      return '<button type="button" role="option" class="cat-uni-opt' + (u.k === state.u ? " on" : "") + '" data-i="' + i + '"><span>' + esc(u.label) + "</span><small>" + nf(u.n) + "</small></button>";
    }).join("") : '<p class="cat-uni-none">' + tr("No such university in the catalog yet.", "Такого вуза в каталоге пока нет.", "Bunday OTM katalogda hozircha yoʻq.") + "</p>";
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
  render();
})();
