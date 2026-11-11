/* CORE regional base layer page: bubble map, sortable table, region card, joined-record preview. */
(function () {
  "use strict";
  var RG = window.CORE_REGIONS, GEO = window.CORE_GEO || {};
  if (!RG || !document.getElementById("rgMap")) return;
  var UZD = window.CORE_UZ || {};
  var lang = document.documentElement.getAttribute("data-static-lang") || document.documentElement.lang || "en";
  var T = function (en, ru) { return lang === "en" ? en : lang === "uz" ? (UZD[ru] != null ? UZD[ru] : ru) : ru; };
  var nm = function (r) { return r.name[lang] || r.name.en; };
  var loc = lang === "en" ? "en-US" : "ru-RU";
  var nf = function (n) { return n == null ? "—" : Number(n).toLocaleString(loc); };
  var pct = function (x) { return x == null ? "—" : (Math.round(x * 1000) / 10).toLocaleString(loc) + "%"; };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var regions = RG.regions;
  var val = function (r, k) {
    if (k === "name") return nm(r);
    if (k === "behaviour") return r.behaviour.length;
    if (k in r.demographics) return r.demographics[k];
    if (k in r.core) return r.core[k];
    return null;
  };
  var state = { ind: "population", c: "", sel: "UZ-SI", sort: "population", dir: -1 };

  /* stats */
  var pop = regions.reduce(function (s, r) { return s + (r.demographics.population || 0); }, 0);
  var unis = regions.reduce(function (s, r) { return s + r.core.universities; }, 0);
  var clin = regions.reduce(function (s, r) { return s + r.core.clinics; }, 0);
  document.getElementById("rgStats").innerHTML = [
    [regions.length, T("regions", "регионов")], [4, T("countries", "стран")], [(Math.round(pop / 1e5) / 10).toLocaleString(loc) + (lang === "en" ? " M" : lang === "uz" ? " mln" : " млн"), T("people", "жителей")],
    [unis, T("universities placed in regions", "вузов привязано к регионам")], [nf(clin), T("medical facilities (Uzbekistan)", "медучреждений (Узбекистан)")],
    [regions.filter(function (r) { return r.behaviour.length; }).length, T("behaviour survey — example", "опрос о поведении — пример")]
  ].map(function (c) { return "<div><b>" + c[0] + "</b><span>" + c[1] + "</span></div>"; }).join("");

  /* map */
  var cv = document.getElementById("rgMap"), tip = document.getElementById("rgTip"), pts = [];
  var LON0 = 46, LON1 = 88, LAT0 = 35, LAT1 = 56;
  function draw() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), w = cv.clientWidth || 760, h = w * 0.6;
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + "px";
    var ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    var k = Math.cos(45.5 * Math.PI / 180), sx = w / ((LON1 - LON0) * k), sy = h / (LAT1 - LAT0), s = Math.min(sx, sy);
    var P = function (lon, lat) { return [(lon - LON0) * k * s + (w - (LON1 - LON0) * k * s) / 2, (LAT1 - lat) * s + (h - (LAT1 - LAT0) * s) / 2]; };
    Object.keys(GEO).forEach(function (c) {
      GEO[c].forEach(function (ring) {
        ctx.beginPath(); ring.forEach(function (p, i) { var q = P(p[0], p[1]); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); });
        ctx.closePath(); ctx.fillStyle = state.c && state.c !== c ? "rgba(255,255,255,.02)" : "rgba(61,219,193,.05)"; ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.stroke();
      });
    });
    var vs = regions.map(function (r) { return val(r, state.ind); }).filter(function (v) { return v != null; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs);
    pts = [];
    regions.slice().sort(function (a, b) { return (b.demographics.population || 0) - (a.demographics.population || 0); }).forEach(function (r) {
      if (!r.center) return;
      var q = P(r.center[1], r.center[0]), rad = 4 + Math.sqrt((r.demographics.population || 0) / 1e6) * 9 * (w / 760);
      var v = val(r, state.ind), f = v == null || hi === lo ? null : (v - lo) / (hi - lo);
      var dim = state.c && r.country !== state.c;
      ctx.beginPath(); ctx.arc(q[0], q[1], rad, 0, Math.PI * 2);
      ctx.fillStyle = f == null ? "rgba(140,150,160," + (dim ? .08 : .25) + ")" : "rgba(" + Math.round(61 + 184 * f) + "," + Math.round(219 - 54 * f) + "," + Math.round(193 - 157 * f) + "," + (dim ? .12 : .55) + ")";
      ctx.fill();
      ctx.lineWidth = r.iso === state.sel ? 2.5 : 1; ctx.strokeStyle = r.iso === state.sel ? "#fff" : "rgba(255,255,255,.35)"; ctx.stroke();
      if (r.behaviour.length) { ctx.beginPath(); ctx.arc(q[0], q[1], 3, 0, Math.PI * 2); ctx.fillStyle = "#f5a524"; ctx.fill(); }
      pts.push({ r: r, x: q[0], y: q[1], rad: rad });
    });
  }
  function hit(e) {
    var b = cv.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, best = null;
    pts.forEach(function (p) { var d = Math.hypot(p.x - x, p.y - y); if (d <= p.rad + 3 && (!best || p.rad < best.rad)) best = p; });
    return best;
  }
  cv.addEventListener("mousemove", function (e) {
    var p = hit(e); cv.style.cursor = p ? "pointer" : "default";
    if (!p) { tip.hidden = true; return; }
    var v = val(p.r, state.ind);
    tip.innerHTML = "<b>" + esc(nm(p.r)) + "</b>" + (/share|age_/.test(state.ind) ? pct(v) : nf(v));
    tip.style.left = Math.min(p.x + 12, cv.clientWidth - 200) + "px"; tip.style.top = p.y + 12 + "px"; tip.hidden = false;
  });
  cv.addEventListener("mouseleave", function () { tip.hidden = true; });
  cv.addEventListener("click", function (e) { var p = hit(e); if (p) select(p.r.iso); });

  /* detail card + joined record */
  function select(iso) { state.sel = iso; draw(); detail(); table(); }
  function detail() {
    var r = regions.filter(function (x) { return x.iso === state.sel; })[0], d = r.demographics, c = r.core;
    var rows = [[T("Population", "Население"), nf(d.population) + " · " + d.year + " " + T("", "год")], [T("Urban", "Город"), pct(d.urban_share)], [T("Women", "Женщины"), pct(d.female_share)],
      [T("Children 0–14", "Дети 0–14"), pct(d.age_0_14)], [T("Aged 65+", "65+ лет"), pct(d.age_65_plus)], [T("Universities", "Вузы"), nf(c.universities)],
      [T("Research works", "Научные работы"), nf(c.works)], [T("Scholar datasets", "Наборы учёных"), nf(c.open_datasets)], [T("Medical facilities", "Медучреждения"), r.country === "UZ" ? nf(c.clinics) : "—"]];
    var h = '<span class="mono small muted">' + r.iso + "</span><h3>" + esc(nm(r)) + '</h3><dl class="rg-dl2">' + rows.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>";
    if (r.behaviour.length) {
      var b = r.behaviour[0], i = b.indicators;
      h += '<div class="rg-beh"><b>' + T("Survey", "Опрос") + ": " + esc(lang === "en" ? b.survey : lang === "uz" ? (b.survey_uz || b.survey_ru) : b.survey_ru) + "</b><dl class=\"rg-dl2\">" +
        "<dt>" + T("High insurance inclusion", "Высокий охват страхованием") + "</dt><dd>" + i.insurance_high_inclusion_pct + "% (" + T("urban", "в городе") + " " + i.insurance_high_inclusion_pct_urban + "%, " + T("rural", "на селе") + " " + i.insurance_high_inclusion_pct_rural + "%)</dd>" +
        "<dt>" + T("Intention to buy, 1–5", "Намерение купить, 1–5") + "</dt><dd>" + String(i.intention_to_buy_1_5).replace(".", lang === "en" ? "." : ",") + "</dd>" +
        "<dt>" + T("Trust in insurers, 1–5", "Доверие к страховщикам, 1–5") + "</dt><dd>" + String(i.trust_in_insurers_1_5).replace(".", lang === "en" ? "." : ",") + "</dd></dl>" +
        '<a class="link-cta" href="' + (lang === "en" ? "" : "../") + 'app/index.html#demo">' + T("Open the dataset in the cabinet →", "Открыть набор в кабинете →") + "</a></div>";
    } else h += '<p class="small muted" style="margin-top:12px">' + T("No behaviour data for this region yet — we can collect it with a survey through the region's universities.", "Данных о поведении по региону пока нет — соберём опросом через вузы региона.") + "</p>";
    h += '<p class="small muted" style="margin-top:10px">' + T("Demographics source", "Источник демографии") + ": " + esc(d.source || "—") + "</p>";
    document.getElementById("rgDetail").innerHTML = h;
  }

  /* table */
  var tb = document.querySelector("#rgTable tbody");
  function table() {
    var list = regions.filter(function (r) { return !state.c || r.country === state.c; }).sort(function (a, b) {
      var x = val(a, state.sort), y = val(b, state.sort);
      if (x == null) return 1; if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.dir;
    });
    tb.innerHTML = list.map(function (r) {
      var d = r.demographics, c = r.core;
      return '<tr data-iso="' + r.iso + '" class="' + (r.iso === state.sel ? "on" : "") + '"><td><span class="mono small muted">' + r.iso + "</span> " + esc(nm(r)) + '</td><td class="r">' + nf(d.population) + ' <span class="muted small">' + d.year + "</span></td>" +
        '<td class="r">' + pct(d.urban_share) + '</td><td class="r">' + pct(d.age_0_14) + '</td><td class="r">' + pct(d.age_65_plus) + '</td><td class="r">' + nf(c.universities) + '</td><td class="r">' + nf(c.works) +
        '</td><td class="r">' + nf(c.open_datasets) + '</td><td class="r">' + (r.country === "UZ" ? nf(c.clinics) : "—") + "</td><td>" + (r.behaviour.length ? '<span class="tag t-amber">' + T("yes", "есть") + "</span>" : '<span class="muted small">' + T("no data", "нет данных") + "</span>") + "</td></tr>";
    }).join("");
  }
  tb.addEventListener("click", function (e) { var tr = e.target.closest("tr"); if (tr) { select(tr.getAttribute("data-iso")); document.getElementById("rgMap").scrollIntoView({ behavior: "smooth", block: "center" }); } });
  Array.prototype.forEach.call(document.querySelectorAll("#rgTable th"), function (th) {
    th.style.cursor = "pointer";
    th.addEventListener("click", function () { var k = th.getAttribute("data-k"); state.dir = state.sort === k ? -state.dir : (k === "name" ? 1 : -1); state.sort = k; table(); });
  });
  document.getElementById("rgInd").addEventListener("change", function () { state.ind = this.value; draw(); });
  Array.prototype.forEach.call(document.querySelectorAll("#rgCountry button"), function (b) {
    b.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll("#rgCountry button"), function (x) { x.classList.toggle("on", x === b); });
      state.c = b.getAttribute("data-c"); draw(); table();
    });
  });

  /* joined record (what the API returns for a region) */
  var si = regions.filter(function (r) { return r.iso === "UZ-SI"; })[0];
  var rec = { iso: si.iso, name: si.name[lang] || si.name.en, demographics: si.demographics, core: { universities: si.core.universities, works: si.core.works, open_datasets: si.core.open_datasets, clinics: si.core.clinics, clinics_per_100k: si.core.clinics_per_100k },
    behaviour: si.behaviour.map(function (b) { return { survey: b.survey, university: b.university, year: b.year, n: b.n, indicators: b.indicators }; }) };
  document.getElementById("rgJoin").textContent = "GET api/v0/regions.json → regions[\"UZ-SI\"]\n\n" + JSON.stringify(rec, null, 2);

  draw(); detail(); table();
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(draw, 150); });
})();
