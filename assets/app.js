/* CORE landing — interactions, i18n, live data views */
(function () {
  "use strict";
  var D = window.CORE_DATA || {};
  var G = window.CORE_GEO || {};
  var CFG = window.CORE_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- i18n ---------------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var lang = (function () {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "ru" || q === "en") return q;
    var s = store.get("core-lang");
    if (s === "ru" || s === "en") return s;
    var n = (navigator.language || "en").toLowerCase();
    return /^(ru|uz|kk|ky|tg|be|uk)/.test(n) ? "ru" : "en";
  })();
  var T = function (en, ru) { return lang === "ru" ? ru : en; };
  var nf = function (n) { return Number(n).toLocaleString(lang === "ru" ? "ru-RU" : "en-US"); };
  var listeners = [];
  var TITLES = {
    en: "CORE — Licensed Central Asian data for AI",
    ru: "CORE — лицензированные данные Центральной Азии для ИИ"
  };

  function applyLang() {
    document.documentElement.lang = lang;
    document.title = TITLES[lang];
    $$("[data-ru]").forEach(function (el) {
      if (el.dataset.en === undefined) el.dataset.en = el.innerHTML;
      el.innerHTML = lang === "ru" ? el.dataset.ru : el.dataset.en;
    });
    $$("[data-ru-ph]").forEach(function (el) {
      if (el.dataset.enPh === undefined) el.dataset.enPh = el.placeholder;
      el.placeholder = lang === "ru" ? el.dataset.ruPh : el.dataset.enPh;
    });
    $$(".lang button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); });
    $$(".seg button[data-c='']").forEach(function (b) { b.textContent = T("All", "Все"); });
    listeners.forEach(function (f) { f(); });
  }
  $$(".lang button").forEach(function (b) {
    b.addEventListener("click", function () {
      lang = b.dataset.lang; store.set("core-lang", lang); applyLang();
    });
  });

  /* ---------------- dictionaries ---------------- */
  var COUNTRY = { UZ: ["Uzbekistan", "Узбекистан"], KZ: ["Kazakhstan", "Казахстан"], KG: ["Kyrgyzstan", "Кыргызстан"], TJ: ["Tajikistan", "Таджикистан"], TM: ["Turkmenistan", "Туркменистан"] };
  var REGION = {
    "UZ-TK": ["Tashkent city", "г. Ташкент"], "UZ-TO": ["Tashkent reg.", "Ташкентская обл."], "UZ-SA": ["Samarkand", "Самарканд"],
    "UZ-AN": ["Andijan", "Андижан"], "UZ-BU": ["Bukhara", "Бухара"], "UZ-FA": ["Fergana", "Фергана"], "UZ-JI": ["Jizzakh", "Джизак"],
    "UZ-NG": ["Namangan", "Наманган"], "UZ-NW": ["Navoi", "Навои"], "UZ-QA": ["Kashkadarya", "Кашкадарья"], "UZ-QR": ["Karakalpakstan", "Каракалпакстан"],
    "UZ-SI": ["Syrdarya", "Сырдарья"], "UZ-SU": ["Surkhandarya", "Сурхандарья"], "UZ-XO": ["Khorezm", "Хорезм"]
  };
  var MEDTYPE = {
    hospital: ["Hospitals", "Больницы"], clinic: ["Clinics", "Клиники"], doctors: ["Private practices", "Частные кабинеты"],
    primary: ["Primary care", "Первичное звено"], dentist: ["Dental", "Стоматологии"], laboratory: ["Labs", "Лаборатории"], other: ["Other", "Другое"]
  };
  var SPEC = {
    "диагностика": "diagnostics", "кардиология": "cardiology", "лор": "ENT", "неврология": "neurology", "нейрохирургия": "neurosurgery",
    "онкология": "oncology", "ортопедия": "orthopedics", "офтальмология": "ophthalmology", "педиатрия": "pediatrics", "урология": "urology",
    "дерматология": "dermatology", "пластическая хирургия": "plastic surgery", "реабилитация": "rehabilitation", "стоматология": "dentistry",
    "гастроэнтерология": "gastroenterology", "гинекология": "gynecology", "хирургия": "surgery", "терапия": "internal medicine",
    "эндокринология": "endocrinology", "травматология": "traumatology", "косметология": "cosmetology", "лабораторная диагностика": "lab diagnostics",
    "репродуктология": "reproductive medicine", "трансплантология": "transplantology", "нефрология": "nephrology", "пульмонология": "pulmonology",
    "психиатрия": "psychiatry", "акушерство": "obstetrics", "акушерство / роддом": "obstetrics / maternity",
    "инфекционные болезни": "infectious diseases", "первичная помощь": "primary care", "маммология": "mammology", "физиотерапия": "physiotherapy"
  };
  var FIELD_RU = {
    "Agricultural and Biological Sciences": "Агро и биология", "Computer Science": "Компьютерные науки", "Social Sciences": "Социальные науки",
    "Environmental Science": "Экология", "Engineering": "Инженерия", "Medicine": "Медицина", "Arts and Humanities": "Гуманитарные науки",
    "Business, Management and Accounting": "Бизнес и менеджмент", "Biochemistry, Genetics and Molecular Biology": "Биохимия и генетика",
    "Psychology": "Психология", "Economics, Econometrics and Finance": "Экономика", "Earth and Planetary Sciences": "Науки о Земле",
    "Physics and Astronomy": "Физика", "Chemistry": "Химия", "Mathematics": "Математика", "Materials Science": "Материаловедение",
    "Energy": "Энергетика", "Decision Sciences": "Теория решений", "Health Professions": "Здравоохранение", "Nursing": "Сестринское дело",
    "Pharmacology, Toxicology and Pharmaceutics": "Фармакология", "Immunology and Microbiology": "Иммунология", "Neuroscience": "Нейронауки",
    "Chemical Engineering": "Хим. технологии", "Veterinary": "Ветеринария", "Dentistry": "Стоматология"
  };
  var LANG_NAME = { en: ["English", "Английский"], uz: ["Uzbek", "Узбекский"], ru: ["Russian", "Русский"], kk: ["Kazakh", "Казахский"], tr: ["Turkish", "Турецкий"], ky: ["Kyrgyz", "Кыргызский"], tg: ["Tajik", "Таджикский"], "?": ["Unknown", "Не указан"] };
  var pick = function (pair) { return pair ? (lang === "ru" ? pair[1] : pair[0]) : ""; };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------------- nav ---------------- */
  var nav = $(".nav");
  window.addEventListener("scroll", function () { nav.classList.toggle("scrolled", window.scrollY > 8); }, { passive: true });
  $(".burger").addEventListener("click", function () {
    var o = nav.classList.toggle("open"); this.setAttribute("aria-expanded", String(o));
  });
  $$(".nav-links a").forEach(function (a) { a.addEventListener("click", function () { nav.classList.remove("open"); }); });

  /* ---------------- bars helper ---------------- */
  function bars(el, rows, color, fmt) {
    if (!el) return;
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }));
    el.innerHTML = rows.map(function (r) {
      return '<div class="bar"><span>' + esc(r[0]) + '</span><div class="track"><div class="fill" style="background:' + (r[2] || color) + '" data-w="' + (r[1] / max * 100).toFixed(1) + '"></div></div><span class="v">' + (fmt ? fmt(r[1]) : nf(r[1])) + "</span></div>";
    }).join("");
    requestAnimationFrame(function () { $$(".fill", el).forEach(function (f) { f.style.width = f.dataset.w + "%"; }); });
  }

  /* ---------------- MAP ---------------- */
  var canvas = $("#map");
  var layers = { unis: true, med: true };
  var mapPts = [];
  function drawMap(progress) {
    if (!canvas) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth || 720, ch = cw * 460 / 720;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    var lon0 = 46.2, lon1 = 87.6, lat0 = 35.0, lat1 = 55.6, k = Math.cos(45 * Math.PI / 180);
    var sx = cw / ((lon1 - lon0) * k), sy = ch / (lat1 - lat0), s = Math.min(sx, sy) * 0.98;
    var ox = (cw - (lon1 - lon0) * k * s) / 2, oy = (ch - (lat1 - lat0) * s) / 2;
    var P = function (lon, lat) { return [ox + (lon - lon0) * k * s, oy + (lat1 - lat) * s]; };
    // countries
    var paths = {};
    Object.keys(G).forEach(function (c) {
      var p = new Path2D();
      G[c].forEach(function (ring) {
        ring.forEach(function (pt, i) { var q = P(pt[0], pt[1]); if (i) p.lineTo(q[0], q[1]); else p.moveTo(q[0], q[1]); });
        p.closePath();
      });
      paths[c] = p;
      var live = c !== "TM";
      ctx.fillStyle = live ? "rgba(61,219,193,0.035)" : "rgba(255,255,255,0.015)";
      ctx.fill(p);
      ctx.strokeStyle = live ? "rgba(61,219,193,0.28)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.8; ctx.stroke(p);
    });
    // dot matrix inside countries
    var step = Math.max(7, cw / 90);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    for (var y = step / 2; y < ch; y += step) {
      for (var x = step / 2; x < cw; x += step) {
        for (var c in paths) {
          if (ctx.isPointInPath(paths[c], x * dpr, y * dpr)) { ctx.fillRect(x - 0.6, y - 0.6, 1.2, 1.2); break; }
        }
      }
    }
    // labels
    ctx.font = "500 " + Math.max(9, cw / 75) + "px 'Geist Mono', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    [["KAZAKHSTAN", 67.5, 48.5], ["UZBEKISTAN", 61.4, 42.6], ["TURKMENISTAN", 56.2, 39.6], ["KYRGYZSTAN", 74.6, 42.25], ["TAJIKISTAN", 71.4, 38.1]].forEach(function (l) {
      var q = P(l[1], l[2]); var name = lang === "ru" ? pick(COUNTRY[l[0].slice(0, 2) === "KA" ? "KZ" : l[0].slice(0, 2) === "UZ" ? "UZ" : l[0].slice(0, 2) === "TU" ? "TM" : l[0].slice(0, 2) === "KY" ? "KG" : "TJ"]).toUpperCase() : l[0];
      ctx.textAlign = "center"; ctx.fillText(name, q[0], q[1]);
    });
    // data
    mapPts = [];
    progress = progress == null ? 1 : progress;
    var nU = layers.unis && D.unis ? Math.floor(D.unis.length * progress) : 0;
    var sc = Math.min(1, cw / 620);
    var uniR = function (u) { return (2.2 + Math.min(5, Math.sqrt(u[6] || 0) / 18)) * (0.55 + 0.45 * sc); };
    // 1) soft university halos (under everything)
    for (var h = 0; h < nU; h++) {
      var uh = D.unis[h], qh = P(uh[4], uh[3]), rh = uniR(uh) * 2.4;
      var g = ctx.createRadialGradient(qh[0], qh[1], 0, qh[0], qh[1], rh);
      g.addColorStop(0, "rgba(61,219,193,0.22)"); g.addColorStop(1, "rgba(61,219,193,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(qh[0], qh[1], rh, 0, 6.283); ctx.fill();
    }
    // 2) medical facilities
    if (layers.med && D.med) {
      var nMed = Math.floor(D.med.length * progress);
      for (var i = 0; i < nMed; i++) {
        var m = D.med[i], q = P(m[1], m[0]);
        ctx.fillStyle = m[3] >= 45 ? "rgba(255,190,70,1)" : "rgba(245,165,36,0.7)";
        var r = m[3] >= 45 ? 2.4 : 1.3;
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.283); ctx.fill();
        mapPts.push({ x: q[0], y: q[1], t: "med", d: m });
      }
    }
    // 3) university cores on top
    for (var j = 0; j < nU; j++) {
      var u = D.unis[j], qu = P(u[4], u[3]), rr = uniR(u);
      ctx.fillStyle = "#3ddbc1"; ctx.strokeStyle = "rgba(7,9,12,0.8)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(qu[0], qu[1], Math.max(2, rr * 0.6), 0, 6.283); ctx.fill(); ctx.stroke();
      mapPts.push({ x: qu[0], y: qu[1], t: "uni", d: u, r: rr });
    }
  }
  if (canvas) {
    var tip = $("#mapTip");
    var t0 = null;
    var animate = function (ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / 1600);
      drawMap(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(animate);
    };
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var startMap = function () { if (reduce) drawMap(1); else requestAnimationFrame(animate); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(startMap); else startMap();
    var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { drawMap(1); }, 120); });
    listeners.push(function () { drawMap(1); });
    $$(".chip[data-layer]").forEach(function (b) {
      b.addEventListener("click", function () { var l = b.dataset.layer; layers[l] = !layers[l]; b.classList.toggle("on", layers[l]); drawMap(1); });
    });
    canvas.addEventListener("mousemove", function (e) {
      var rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var best = null, bd = 144;
      for (var i = mapPts.length - 1; i >= 0; i--) {
        var p = mapPts[i], dx = p.x - mx, dy = p.y - my, d = dx * dx + dy * dy - (p.t === "uni" ? 30 : 0);
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) { tip.hidden = true; return; }
      var h;
      if (best.t === "uni") {
        var u = best.d;
        h = "<b>" + esc(u[1]) + "</b>" + esc(u[5] || "") + " · " + pick(COUNTRY[u[2]]) + "<br><span class='mono' style='color:var(--teal)'>" + u[0] + "</span> · " + nf(u[6]) + " " + T("works", "работ");
      } else {
        var m = best.d;
        h = "<b>" + pick(MEDTYPE[m[2]] || MEDTYPE.other) + "</b>" + pick(REGION[m[4]] || ["", ""]) + "<br>" + T("Med-tourism readiness", "Готовность к медтуризму") + ": <span style='color:var(--amber)'>" + m[3] + "/100</span>";
      }
      tip.innerHTML = h; tip.hidden = false;
      var tx = best.x + 16, ty = best.y + 18;
      if (tx > rect.width - 220) tx = best.x - 230;
      tip.style.left = tx + 16 + "px"; tip.style.top = ty + 40 + "px";
    });
    canvas.addEventListener("mouseleave", function () { tip.hidden = true; });
    $("#mUnis").textContent = nf((D.unis || []).length);
    listeners.push(function () { $("#mUnis").textContent = nf((D.unis || []).length); $("#mMed").textContent = nf((D.med || []).length); });
  }

  /* ---------------- counters ---------------- */
  var countersDone = false;
  function runCounters() {
    if (countersDone) return; countersDone = true;
    $$("[data-count]").forEach(function (el) {
      var target = +el.dataset.count, t0 = null;
      var step = function (ts) {
        if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / 1400), e = 1 - Math.pow(1 - p, 3);
        el.textContent = nf(Math.round(target * e)); if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  listeners.push(function () { if (countersDone) $$("[data-count]").forEach(function (el) { el.textContent = nf(+el.dataset.count); }); });

  /* ---------------- tabs ---------------- */
  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".tab").forEach(function (x) { x.classList.toggle("on", x === t); x.setAttribute("aria-selected", String(x === t)); });
      $$(".tabpanel").forEach(function (p) { p.classList.toggle("on", p.id === t.dataset.tab); });
      renderActive();
    });
  });

  /* ---------------- DS-0001 universities ---------------- */
  var uniFilter = { q: "", c: "" };
  function renderUni() {
    var rows = (D.unis || []).filter(function (u) {
      if (uniFilter.c && u[2] !== uniFilter.c) return false;
      if (!uniFilter.q) return true;
      var q = uniFilter.q.toLowerCase();
      return (u[1] + " " + u[5] + " " + u[0]).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return b[6] - a[6]; }).slice(0, 150);
    $("#uniTable tbody").innerHTML = rows.map(function (u) {
      return "<tr><td><span class='id'>" + u[0] + "</span></td><td>" + esc(u[1]) + "</td><td class='muted'>" + esc(u[5]) + "</td><td class='r'>" + nf(u[6]) + "</td></tr>";
    }).join("") || "<tr><td colspan='4' class='muted'>" + T("No matches", "Ничего не найдено") + "</td></tr>";
    var bc = D.uniByCountry || {};
    bars($("#uniBars"), ["UZ", "KZ", "KG", "TJ"].map(function (c) { return [pick(COUNTRY[c]), bc[c] || 0]; }), "var(--teal)");
  }
  $("#uniSearch").addEventListener("input", function () { uniFilter.q = this.value.trim(); renderUni(); });
  $$("#uniCountry button").forEach(function (b) {
    b.addEventListener("click", function () { $$("#uniCountry button").forEach(function (x) { x.classList.toggle("on", x === b); }); uniFilter.c = b.dataset.c; renderUni(); });
  });

  /* ---------------- DS-0002 medical ---------------- */
  function renderMed() {
    $("#medTable tbody").innerHTML = (D.medTop || []).map(function (m) {
      var spec = m.spec.map(function (s) { return lang === "ru" ? s : (SPEC[s] || s); }).join(", ");
      return "<tr><td><span class='id'>" + esc(m.id) + "</span></td><td>" + esc(m.name) + (m.intl ? " <span class='tag t-teal'>intl</span>" : "") + "</td><td class='muted'>" + esc(pick(REGION[m.region])) + "</td><td class='muted'>" + esc(spec) + "</td><td class='r'><span class='score'>" + m.score + "</span></td></tr>";
    }).join("");
    var mt = D.medTypes || {}, other = 0, rows = [];
    Object.keys(mt).forEach(function (k) { if (MEDTYPE[k] && k !== "other") rows.push([pick(MEDTYPE[k]), mt[k]]); else other += mt[k]; });
    rows.sort(function (a, b) { return b[1] - a[1]; }); rows.push([pick(MEDTYPE.other), other]);
    bars($("#medBars"), rows, "var(--amber)");
  }

  /* ---------------- DS-0003 publications ---------------- */
  function renderPub() {
    var svg = $("#pubChart"); if (!svg) return;
    var rows = (D.worksByYear || []).slice(1).filter(function (r) { return +r[0] >= 2010 && +r[0] <= 2026; });
    var W = 640, H = 260, pl = 44, pb = 24, pt = 10, n = rows.length;
    var tot = rows.map(function (r) { return +r[1] + +r[2] + +r[3] + +r[4]; });
    var max = Math.max.apply(null, tot) * 1.08;
    var bw = (W - pl - 10) / n, colors = ["#3ddbc1", "#9b8cff", "#f5a524", "#e86a8d"];
    var h = "";
    [0, 25000, 50000, 75000, 100000, 125000].forEach(function (v) {
      if (v > max) return;
      var y = H - pb - (v / max) * (H - pb - pt);
      h += "<line x1='" + pl + "' x2='" + W + "' y1='" + y + "' y2='" + y + "' stroke='rgba(255,255,255,.06)'/>";
      h += "<text x='" + (pl - 8) + "' y='" + (y + 4) + "' text-anchor='end'>" + (v ? v / 1000 + "k" : "0") + "</text>";
    });
    rows.forEach(function (r, i) {
      var x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = H - pb;
      for (var c = 1; c <= 4; c++) {
        var v = +r[c], hh = (v / max) * (H - pb - pt);
        if (hh > 0.2) h += "<rect x='" + x.toFixed(1) + "' y='" + (y - hh).toFixed(1) + "' width='" + w.toFixed(1) + "' height='" + hh.toFixed(1) + "' fill='" + colors[c - 1] + "' rx='1.5'><title>" + r[0] + " · " + ["UZ", "KZ", "KG", "TJ"][c - 1] + ": " + nf(v) + "</title></rect>";
        y -= hh;
      }
      if (+r[0] % 2 === 0) h += "<text x='" + (x + w / 2).toFixed(1) + "' y='" + (H - 6) + "' text-anchor='middle'>" + String(r[0]).slice(2) + "’</text>";
    });
    svg.innerHTML = h;
    var langs = (D.languages || []).slice(1, 7).map(function (r) { return [pick(LANG_NAME[r[0]] || [r[0], r[0]]), +r[1]]; });
    bars($("#langBars"), langs, "var(--violet)");
    $("#langBars").querySelectorAll(".bar").forEach(function (b) { b.style.gridTemplateColumns = "78px 1fr 64px"; });
    var pc = { RU: ["Russia", "Россия"], CN: ["China", "Китай"], US: ["USA", "США"], IN: ["India", "Индия"], TR: ["Türkiye", "Турция"], SA: ["Saudi Arabia", "Сауд. Аравия"], UA: ["Ukraine", "Украина"], DE: ["Germany", "Германия"], PK: ["Pakistan", "Пакистан"], GB: ["UK", "Великобритания"] };
    $("#partnerList").innerHTML = (D.partners || []).slice(1, 9).map(function (r) { return "<span class='tag'>" + esc(pick(pc[r[0]] || [r[0], r[0]])) + " · " + nf(r[1]) + "</span>"; }).join("");
  }

  /* ---------------- pipeline (548 datasets) ---------------- */
  var pf = { q: "", c: "", f: "" };
  var fieldSel = $("#pipeField");
  function fillFields() {
    var counts = {};
    (D.researchDatasets || []).forEach(function (d) { counts[d.f] = (counts[d.f] || 0) + 1; });
    var keep = fieldSel.value;
    var opts = Object.keys(counts).filter(Boolean).sort(function (a, b) { return counts[b] - counts[a]; });
    fieldSel.innerHTML = "<option value=''>" + T("All fields", "Все области") + "</option>" + opts.map(function (f) {
      return "<option value='" + esc(f) + "'>" + esc(lang === "ru" ? (FIELD_RU[f] || f) : f) + " (" + counts[f] + ")</option>";
    }).join("");
    fieldSel.value = keep;
  }
  function renderPipe() {
    var all = D.researchDatasets || [];
    var rows = all.filter(function (d) {
      if (pf.c && d.c.indexOf(pf.c) < 0) return false;
      if (pf.f && d.f !== pf.f) return false;
      if (pf.q) { var q = pf.q.toLowerCase(); if ((d.t + " " + d.u + " " + d.f).toLowerCase().indexOf(q) < 0) return false; }
      return true;
    }).sort(function (a, b) { return (b.y || 0) - (a.y || 0); });
    $("#pipeTable tbody").innerHTML = rows.slice(0, 250).map(function (d) {
      var link = d.doi ? "<a href='" + esc(d.doi) + "' target='_blank' rel='noopener'>" + esc(d.t) + "</a>" : esc(d.t);
      return "<tr><td class='muted'>" + esc(d.y) + "</td><td>" + link + (d.ca ? " <span class='tag t-teal'>CA</span>" : "") + "</td><td class='muted'>" + esc(d.u) + "</td><td class='muted'>" + esc(lang === "ru" ? (FIELD_RU[d.f] || d.f) : d.f) + "</td><td><span class='tag'>" + esc(d.lic || "—") + "</span></td></tr>";
    }).join("") || "<tr><td colspan='5' class='muted'>" + T("No matches", "Ничего не найдено") + "</td></tr>";
    $("#pipeCount").textContent = T("Showing ", "Показано ") + nf(Math.min(250, rows.length)) + T(" of ", " из ") + nf(rows.length);
    var unis = {}; all.forEach(function (d) { if (d.u) unis[d.u] = 1; });
    var samdu = all.filter(function (d) { return /Samarkand State University/i.test(d.u); }).length;
    $("#pipeStats").innerHTML =
      "<div><b>" + nf(all.length) + "</b><span>" + T("datasets", "датасетов") + "</span></div>" +
      "<div><b>" + nf(Object.keys(unis).length) + "</b><span>" + T("universities", "вузов") + "</span></div>" +
      "<div><b>" + nf(samdu) + "</b><span>" + T("at Samarkand State Univ.", "у СамГУ") + "</span></div>";
  }
  $("#pipeSearch").addEventListener("input", function () { pf.q = this.value.trim(); renderPipe(); });
  fieldSel.addEventListener("change", function () { pf.f = this.value; renderPipe(); });
  $$("#pipeCountry button").forEach(function (b) {
    b.addEventListener("click", function () { $$("#pipeCountry button").forEach(function (x) { x.classList.toggle("on", x === b); }); pf.c = b.dataset.c; renderPipe(); });
  });

  function renderActive() {
    var on = $(".tabpanel.on"); if (!on) return;
    if (on.id === "t-uni") renderUni();
    if (on.id === "t-med") renderMed();
    if (on.id === "t-pub") renderPub();
    if (on.id === "t-pipe") { fillFields(); renderPipe(); }
  }
  listeners.push(renderActive);

  /* ---------------- revenue calculator ---------------- */
  function calc() {
    var ds = +$("#cDs").value, lic = +$("#cLic").value, price = +$("#cPrice").value;
    $("#oDs").textContent = ds; $("#oLic").textContent = lic; $("#oPrice").textContent = nf(price);
    var uni = ds * lic * price * 0.7;
    $("#rUni").textContent = "$" + nf(Math.round(uni));
    $("#rAuth").textContent = "$" + nf(Math.round(uni * 0.3));
  }
  ["#cDs", "#cLic", "#cPrice"].forEach(function (s) { $(s).addEventListener("input", calc); });
  listeners.push(calc);

  /* ---------------- copy ---------------- */
  $$(".copy").forEach(function (b) {
    b.addEventListener("click", function () {
      var txt = $("#" + b.dataset.copy).innerText;
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () {
        b.textContent = T("copied", "скопировано"); setTimeout(function () { b.textContent = "copy"; }, 1400);
      }).catch(function () {});
    });
  });

  /* ---------------- lead form ---------------- */
  var form = $("#leadForm"), ftype = "buyer";
  var FORM_TEXT = {
    buyer: { org: ["Company", "Компания"], role: ["Role", "Должность"], msg: ["What data do you need? Languages, volume, timeline.", "Какие данные нужны? Языки, объём, сроки."] },
    bench: { org: ["Company", "Компания"], role: ["Role", "Должность"], msg: ["Which models do you want evaluated?", "Какие модели хотите проверить?"] },
    university: { org: ["University", "Университет"], role: ["Position", "Должность"], msg: ["Which collections or data could your university share?", "Какие фонды или данные мог бы предоставить ваш вуз?"] },
    researcher: { org: ["Your university", "Ваш университет"], role: ["Department / lab", "Кафедра / лаборатория"], msg: ["Describe the dataset: content, size, language, who holds the rights.", "Опишите датасет: содержание, объём, язык, у кого права."] },
    investor: { org: ["Fund / organization", "Фонд / организация"], role: ["Role", "Должность"], msg: ["Stage, ticket size, thesis.", "Стадия, размер чека, тезис."] }
  };
  function setType(t) {
    ftype = t;
    var segT = t === "bench" ? "buyer" : t;
    $$("#formType button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === segT); });
    form.elements.type.value = t;
    var ft = FORM_TEXT[t];
    $(".org-label").textContent = pick(ft.org);
    $(".role-label").textContent = pick(ft.role);
    $(".msg-label").textContent = pick(ft.msg);
    $(".f-buyer").hidden = !(t === "buyer" || t === "bench");
    $(".f-researcher").hidden = t !== "researcher";
    if (t === "bench") form.elements.usecase.selectedIndex = 1;
  }
  $$("#formType button").forEach(function (b) { b.addEventListener("click", function () { setType(b.dataset.t); }); });
  $$("[data-form]").forEach(function (a) { a.addEventListener("click", function () { setType(a.dataset.form); }); });
  listeners.push(function () { setType(ftype); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var status = $("#formStatus");
    status.classList.remove("err");
    $$("input[required]", form).forEach(function (i) { i.classList.add("touched"); });
    if (!form.checkValidity()) {
      status.classList.add("err");
      status.textContent = T("Please fill in name, email, organization and accept the privacy terms.", "Заполните имя, email, организацию и подтвердите согласие.");
      return;
    }
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    data.lang = lang; data.page = location.href; data.ts = new Date().toISOString();
    var TYPE_RU = { buyer: "покупатель", bench: "бенчмарк", university: "вуз", researcher: "исследователь", investor: "инвестор" };
    data._subject = "CORE · заявка: " + (TYPE_RU[data.type] || data.type) + " · " + data.org;
    data._template = "table"; data._captcha = "false";
    if (data.email) data._replyto = data.email;
    var btn = $("button[type=submit]", form); btn.disabled = true;
    var ok = function () {
      status.textContent = T("Thank you! We'll get back to you within 24 hours.", "Спасибо! Мы ответим в течение 24 часов.");
      form.reset(); setType(ftype); btn.disabled = false;
    };
    if (CFG.formEndpoint) {
      fetch(CFG.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data) })
        .then(function (r) { if (!r.ok) throw new Error(r.status); ok(); })
        .catch(function () { btn.disabled = false; status.classList.add("err"); status.textContent = T("Couldn't send. Please email us directly: ", "Не удалось отправить. Напишите нам: ") + (CFG.contactEmail || ""); });
    } else if (CFG.contactEmail) {
      var body = Object.keys(data).map(function (k) { return k + ": " + data[k]; }).join("\n");
      location.href = "mailto:" + CFG.contactEmail + "?subject=" + encodeURIComponent("CORE · " + data.type + " · " + data.org) + "&body=" + encodeURIComponent(body);
      ok();
    } else {
      btn.disabled = false; status.classList.add("err");
      status.textContent = T("The form is not connected yet (see assets/config.js).", "Форма ещё не подключена (см. assets/config.js).");
    }
  });

  /* ---------------- reveal ---------------- */
  var revealEls = $$(".sec-head, .card, .flow, .team, .strip-grid");
  if ("IntersectionObserver" in window) {
    revealEls.forEach(function (el) { if (!el.closest(".hero")) el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("in");
        if (en.target.classList.contains("strip-grid")) runCounters();
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else runCounters();

  applyLang();
})();
