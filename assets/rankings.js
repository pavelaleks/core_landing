(() => {
  "use strict";
  const root = document.getElementById("rankings");
  if (!root) return;

  const lists = JSON.parse(root.querySelector("[data-ranking-lists]").textContent);
  const full = root.dataset.mode === "full";
  const limit = Number(root.dataset.limit);
  const language = document.documentElement.lang;
  const numbers = new Intl.NumberFormat(language);
  const tabs = [...root.querySelectorAll("[role=tab]")];
  const panel = root.querySelector("[role=tabpanel]");
  const field = root.querySelector("select");
  const search = root.querySelector("input[type=search]");
  const table = root.querySelector("table");
  const body = table.tBodies[0];
  const unit = table.querySelector("th[data-open]");
  const pager = root.querySelector(".rank-pager");
  const steps = [...root.querySelectorAll("[data-step]")];
  const range = root.querySelector("[data-range]");
  const of = root.querySelector(".rank-footer").dataset.of;
  const pageLink = root.querySelector("[data-back], [data-full-list]");
  const languageLinks = [...document.querySelectorAll(".lang a[data-lang]")];
  let metric = "open";
  let page = 0;

  for (const time of root.querySelectorAll("time")) {
    const date = new Date(time.dateTime + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) continue;
    const options = { year: "numeric", month: "long", timeZone: "UTC" };
    if (time.parentElement.dataset.source === "works") options.day = "numeric";
    time.textContent = date.toLocaleDateString(language, options);
  }

  function normalize(value) {
    return value.toLowerCase().normalize("NFC").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  const searchNames = new Map();
  if (full) {
    for (const [id, university] of Object.entries(lists.universities)) {
      searchNames.set(id, normalize(university.name + " " + university.aliases));
    }
  }

  function setParams(url, includeSearch) {
    if (metric === "works") url.searchParams.set("rank", "works");
    else url.searchParams.delete("rank");
    if (metric === "open" && field.value) url.searchParams.set("field", field.value);
    else url.searchParams.delete("field");
    if (includeSearch && search && search.value) url.searchParams.set("q", search.value);
    else url.searchParams.delete("q");
  }

  function updateLinks() {
    const destination = new URL(pageLink.href);
    setParams(destination, false);
    pageLink.href = destination.href;
    for (const link of languageLinks) {
      const target = new URL(link.href);
      setParams(target, full);
      if (!full && (location.hash === "#rankings" || metric === "works" || field.value)) target.hash = "rankings";
      link.href = target.href;
    }
  }

  function draw() {
    const open = metric === "open";
    for (const tab of tabs) {
      const active = tab.dataset.metric === metric;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    panel.setAttribute("aria-labelledby", "rank-" + metric);
    table.setAttribute("aria-labelledby", "rankings-title rank-" + metric);
    field.closest("label").hidden = !open;
    root.querySelector(".rank-filters").hidden = !full && !open;
    for (const source of root.querySelectorAll("[data-source]")) source.hidden = source.dataset.source !== metric;
    unit.textContent = unit.dataset[metric];

    const ranked = open ? lists.open[field.value] : lists.works;
    const words = search ? normalize(search.value).split(" ").filter(Boolean) : [];
    const matches = words.length ? ranked.filter(row => words.every(word => searchNames.get(row.id).includes(word))) : ranked;
    const start = page * limit;
    const visible = matches.slice(start, start + limit);
    body.replaceChildren();
    for (const row of visible) {
      const university = lists.universities[row.id];
      const tr = body.insertRow();
      tr.insertCell().textContent = row.place;
      const name = document.createElement("strong");
      const link = document.createElement("a");
      link.href = "organization.html?id=" + encodeURIComponent(row.id);
      link.textContent = university.name;
      name.append(link);
      const country = document.createElement("small");
      country.textContent = university.country;
      tr.insertCell().append(name, country);
      tr.insertCell().textContent = numbers.format(row.value);
    }
    if (!visible.length) {
      const cell = body.insertRow().insertCell();
      cell.colSpan = 3;
      cell.textContent = body.dataset.empty;
    }
    if (full) {
      range.textContent = matches.length ? (start + 1) + "–" + (start + visible.length) + " " + of + " " + numbers.format(matches.length) : body.dataset.empty;
      for (const button of steps) button.disabled = Number(button.dataset.step) < 0 ? page === 0 : start + limit >= matches.length;
      pager.classList.toggle("rank-no-matches", matches.length === 0);
    }
    updateLinks();
  }

  function choose() {
    page = 0;
    draw();
    const url = new URL(location.href);
    setParams(url, full);
    if (url.href !== location.href) {
      // Some file viewers disallow history changes. Links still carry the selection.
      try { history.replaceState(history.state, "", url.href); } catch {}
    }
  }

  function readLocation() {
    const params = new URLSearchParams(location.search);
    metric = params.get("rank") === "works" ? "works" : "open";
    const requested = params.get("field") || "";
    field.value = Object.hasOwn(lists.open, requested) ? requested : "";
    if (search) search.value = params.get("q") || "";
    page = 0;
    draw();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => { metric = tab.dataset.metric; choose(); });
    tab.addEventListener("keydown", event => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      const target = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
      event.preventDefault();
      tabs[target].focus();
      tabs[target].click();
    });
  });
  field.addEventListener("change", choose);
  if (search) search.addEventListener("input", choose);
  for (const button of steps) {
    button.addEventListener("click", () => { page += Number(button.dataset.step); draw(); });
  }
  window.addEventListener("popstate", readLocation);
  readLocation();
})();
