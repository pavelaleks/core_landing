export function createCatalogCard({ lang, L, tr, esc, nf, fieldName, UNI, state, account, symbolsUrl }) {
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

  function cardArt(it) {
    var theme = "dataset", topic = (it.f || "").toLowerCase();
    if (it.id === "uzbek-geography-terms" || /agric|earth|environment|geograph/.test(topic)) theme = "geography";
    else if (it.id === "insurance-literacy-syrdarya" || /social|sociolog|econom|financ|psycholog/.test(topic)) theme = "survey";
    else if (it.id === "covid-almaty-cohort" || /medic|health|nurs|dent|pharmac|immun/.test(topic)) theme = "medicine";
    return '<svg class="cat-art" viewBox="0 0 320 176" aria-hidden="true" focusable="false"><use href="' + symbolsUrl + '#' + theme + '"></use></svg>';
  }

  function card(it, currentUser, favoriteIds) {
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
    if (account && (!currentUser || currentUser.role === "buyer")) {
      var saved = favoriteIds.indexOf(it.id) >= 0;
      actions += '<button type="button" class="favorite-button" data-favorite="' + esc(it.id) + '" aria-pressed="' + saved + '">' +
        (saved ? tr("Saved", "В избранном", "Saralanganlarda") : tr("Save dataset", "В избранное", "Saralanganlarga")) + '</button>';
    }
    return '<article class="cat-item card' + (ext ? "" : " cat-core") + '"><div class="cat-tags"><span class="tag ' + ty[1] + '">' + ty[0] + '</span><span class="st ' + st[1] + '">' + st[0] + "</span></div>" +
      '<div class="cat-card-title">' + cardArt(it) + "<h3>" + esc(L(it.title)) + '</h3></div><p class="cat-meta">' + meta.filter(Boolean).join(" · ") + "</p>" +
      (it.desc ? '<p class="cat-desc">' + esc(L(it.desc)) + "</p>" : "") +
      '<div class="cat-foot"><span class="cat-facts">' + facts.join(" · ") + '</span><span class="cat-act">' + actions + "</span></div></article>";
  }

  return card;
}
