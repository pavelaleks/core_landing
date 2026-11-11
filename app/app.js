/* CORE MVP cabinet.
   Three roles walk the main scenario end to end:
     buyer      — finds a dataset, sees what CORE added, requests access, downloads the package;
     university — uploads a dataset with a rights form, gets an automatic check, follows its status;
     operator   — approves access requests and moves university submissions through the pipeline.
   Storage: `store` below keeps everything in localStorage. It is the only place to swap for a
   shared backend (e.g. Supabase): same methods, remote tables. */
(function () {
  "use strict";
  var INVITE = "CORE-MVP";
  var KEY = "core-mvp-v1";
  var STEPS = ["Получен", "Проверка прав", "Проверка персональных данных", "Разметка и описание", "В каталоге"];
  var DS_UNI = { "uzbek-geography-terms": "UNI-UZ-0180", "insurance-literacy-syrdarya": "UNI-UZ-0017", "covid-almaty-cohort": "UNI-KZ-0094" };
  var PRICE = {
    "uzbek-geography-terms": "от $3 000 за корпус в год",
    "insurance-literacy-syrdarya": "от $1 500 за отчёт · от $3 000 за набор в год",
    "covid-almaty-cohort": "от $3 000 за набор в год",
  };
  var BA = {
    "uzbek-geography-terms": [
      ["oʻrmon / o'rmon / o‘rmon — три написания", "oʻrmon — одно стандартное"],
      ["aglomeratsiya и agglomeratsiya — два разных термина", "помечены как варианты одного термина"],
      ["aholi — только слово в списке", "aholi · население · population · категория «население, экономика» · в школьных учебниках 405 раз, в вузовских 175 · с 5 класса"],
      ["нет примеров употребления", "контекст из учебника для 817 терминов"],
    ],
    "insurance-literacy-syrdarya": [
      ["Financial_knowledge = «=AM2+AL2+AK2+…» (формула Excel)", "fin_knowledge_score = 6 (число)"],
      ["marrital_status", "marital_status"],
      ["age = 0", "age = пусто (опрос 16+), отмечено в отчёте"],
      ["Trust1 … Trust13 без описания", "«Доверие к страховщикам, вопрос 1» на трёх языках + индекс trust_idx"],
    ],
    "covid-almaty-cohort": [
      ["«нет роста», «отрицательно», «0»", "culture_result = no growth"],
      ["candida albicans / Candida albicans", "Candida albicans · Fungus · NCBI 5476"],
      ["azithromycin: 1, S, s", "azithromycin_sir = S · ATC J01FA10"],
      ["com_dm = 1 (диабет без кода)", "com_dm · МКБ-10 E10–E14; анализы с кодами LOINC"],
    ],
  };

  /* ---------------- store ---------------- */
  function seed() {
    var t = Date.now() - 864e5;
    return {
      user: null,
      requests: [{ id: "R-1001", ds: "insurance-literacy-syrdarya", org: "Demo Insurance LLC", name: "Отдел продуктов", purpose: "Понять, кому в регионах продавать страхование жизни и через какие каналы", use: "commercial", status: "pending", created: t }],
      submissions: [{
        id: "S-2001", uni: "UNI-UZ-0180", uniName: "Ургенчский государственный университет", title: "Наблюдения за засолением почв, Хорезм, 2019–2024",
        field: "Агро, вода и экология", desc: "Пробы почв с 40 участков, 6 лет", model: "process", status: 1, created: t,
        file: { name: "soil_salinity_khorezm.csv", size: 182044, rows: 1440, cols: 12, empty: 0.03, pii: [] },
        rights: { own: true, authors: true, personal: true, funder: true }, signer: "Проректор по науке", log: [{ t: t, s: 0 }, { t: t + 3600e3, s: 1 }],
      }],
      downloads: 0,
    };
  }
  var store = {
    s: null,
    load: function () {
      try { this.s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { this.s = null; }
      if (!this.s) this.s = seed();
      return this.s;
    },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) {} },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} this.s = seed(); },
  };
  var S = store.load();

  /* ---------------- helpers ---------------- */
  var view = document.getElementById("view");
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nf(n) { return Number(n).toLocaleString("ru-RU"); }
  function date(t) { return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }); }
  function id(p) { return p + "-" + Math.floor(1000 + Math.random() * 9000); }
  function toast(msg) {
    var d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 3600);
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }
  function pill(st) {
    var m = { pending: ["На рассмотрении", "p-wait"], approved: ["Доступ открыт", "p-ok"], declined: ["Отклонено", "p-no"] }[st];
    return '<span class="pill ' + m[1] + '">' + m[0] + "</span>";
  }
  var DS = [], UNIS = [];
  function ds(slug) { return DS.filter(function (d) { return d.slug === slug; })[0]; }
  function myReq(slug) {
    return S.requests.filter(function (r) { return r.ds === slug && S.user && r.org === S.user.org; }).sort(function (a, b) { return b.created - a.created; })[0];
  }

  /* ---------------- header ---------------- */
  var ROLES = { buyer: "Покупатель", university: "Вуз", operator: "Оператор CORE" };
  function header() {
    var nav = document.getElementById("nav"), who = document.getElementById("who");
    if (!S.user) { nav.hidden = who.hidden = true; return; }
    nav.hidden = who.hidden = false;
    var r = S.user.role, h = location.hash || "", links;
    var pend = S.requests.filter(function (x) { return x.status === "pending"; }).length + S.submissions.filter(function (x) { return x.status < 4; }).length;
    if (r === "buyer") links = [["#catalog", "Каталог"], ["#my", "Мои заявки"]];
    else if (r === "university") links = [["#uni", "Наши наборы"], ["#uni/new", "Загрузить набор"], ["#catalog", "Каталог"]];
    else links = [["#ops", "Очередь" + (pend ? '<span class="cnt">' + pend + "</span>" : "")], ["#catalog", "Каталог"]];
    nav.innerHTML = links.map(function (l) { return '<a href="' + l[0] + '" class="' + (h === l[0] || (l[0] === "#catalog" && h.indexOf("#ds/") === 0) ? "on" : "") + '">' + l[1] + "</a>"; }).join("");
    who.innerHTML = '<span class="lbl">' + esc(S.user.org) + '</span><select id="roleSel" aria-label="Роль">' +
      Object.keys(ROLES).map(function (k) { return '<option value="' + k + '"' + (k === r ? " selected" : "") + ">" + ROLES[k] + "</option>"; }).join("") +
      '</select><a href="#" id="logout" class="mvp-link">Выйти</a>';
    document.getElementById("roleSel").onchange = function () { switchRole(this.value); };
    document.getElementById("logout").onclick = function (e) { e.preventDefault(); S.user = null; store.save(); go("#login"); };
  }
  function switchRole(role) {
    var prev = S.user || {};
    S.user = { role: role, org: role === "operator" ? "CORE" : role === "university" ? (prev.uniName || "Гулистанский государственный университет") : (prev.buyerOrg || "Моя компания"),
      uni: role === "university" ? (prev.uni || "UNI-UZ-0017") : prev.uni, uniName: prev.uniName || "Гулистанский государственный университет", buyerOrg: prev.buyerOrg || "Моя компания" };
    if (role === "buyer") S.user.org = S.user.buyerOrg;
    if (role === "university") S.user.org = S.user.uniName;
    store.save();
    go(role === "buyer" ? "#catalog" : role === "university" ? "#uni" : "#ops");
  }

  /* ---------------- views ---------------- */
  function vLogin() {
    var ok = false; try { ok = sessionStorage.getItem("core-invite") === "1" || localStorage.getItem("core-invite") === "1"; } catch (e) {}
    view.innerHTML =
      '<span class="kicker">Закрытый прототип · вход по приглашению</span>' +
      "<h1>Кабинет CORE</h1>" +
      '<p class="lead">Здесь можно пройти весь путь данных: вуз загружает набор и подтверждает права, CORE проверяет и размечает, покупатель получает готовый пакет. ' +
      "В каталоге — три настоящих набора учёных из Узбекистана и Казахстана, подготовленные CORE.</p>" +
      (ok ? "" :
        '<div class="card" style="margin-top:24px;max-width:520px"><form id="inv"><label class="f"><span>Код приглашения</span><input id="code" autocomplete="off" placeholder="Например, CORE-…"></label>' +
        '<button class="btn btn-primary btn-sm">Продолжить</button><div class="err" id="ierr" hidden>Код не подошёл. Попросите код у команды CORE: pavel.alekseev.gasu@gmail.com</div></form></div>') +
      '<div id="roles"' + (ok ? "" : " hidden") + ">" +
      "<h2>Кем вы входите?</h2>" +
      '<div class="grid3">' +
      '<button class="card role" data-role="buyer"><span class="mono">ПОКУПАТЕЛЬ</span><b>Мне нужны данные</b><p>Компания, разработчик ИИ, страховая, фарма, госорган. Найти набор, посмотреть, что внутри, запросить доступ и скачать.</p></button>' +
      '<button class="card role" data-role="university"><span class="mono">ВУЗ</span><b>У нас есть данные</b><p>Сотрудник, уполномоченный вузом. Загрузить набор, подтвердить права, следить за проверкой и заявками.</p></button>' +
      '<button class="card role" data-role="operator"><span class="mono">ОПЕРАТОР CORE</span><b>Проверяю и выдаю доступ</b><p>Команда CORE. Одобрить заявки покупателей, провести набор вуза через проверку прав и разметку.</p></button>' +
      "</div>" +
      '<div class="card" style="margin-top:16px"><b>Сценарий проверки за 5 минут</b><ol class="steps">' +
      "<li>Войдите как <b>покупатель</b>, откройте любой набор, посмотрите «до и после» и отправьте заявку.</li>" +
      "<li>Переключитесь на <b>оператора CORE</b> (меню вверху справа) и одобрите заявку.</li>" +
      "<li>Вернитесь покупателем — скачайте пакет (данные, описание переменных на трёх языках, отчёт о качестве, лицензию) или получите ключ API и выполните SQL-запрос прямо на странице.</li>" +
      "<li>Войдите как <b>вуз</b> и загрузите свой CSV — система сразу проверит его, в том числе на персональные данные.</li>" +
      "<li>Оператором проведите набор вуза по этапам до каталога.</li></ol></div>" +
      '<div class="card" id="whoForm" hidden style="margin-top:16px;max-width:620px"></div></div>';
    var inv = document.getElementById("inv");
    if (inv) inv.onsubmit = function (e) {
      e.preventDefault();
      if (document.getElementById("code").value.trim().toUpperCase() === INVITE) {
        try { localStorage.setItem("core-invite", "1"); } catch (x) {}
        inv.parentNode.hidden = true; document.getElementById("roles").hidden = false;
      } else document.getElementById("ierr").hidden = false;
    };
    Array.prototype.forEach.call(document.querySelectorAll(".role"), function (b) {
      b.onclick = function () { askWho(b.getAttribute("data-role")); };
    });
  }
  function askWho(role) {
    var f = document.getElementById("whoForm"); f.hidden = false;
    if (role === "operator") { S.user = { role: "operator", org: "CORE" }; store.save(); go("#ops"); return; }
    if (role === "buyer") {
      f.innerHTML = '<form id="wf"><b>Покупатель</b><label class="f" style="margin-top:12px"><span>Организация</span><input id="wOrg" required placeholder="Например, ООО «Страховая компания»"></label>' +
        '<label class="f"><span>Ваше имя</span><input id="wName" required></label><button class="btn btn-primary btn-sm">Войти</button></form>';
      document.getElementById("wf").onsubmit = function (e) {
        e.preventDefault(); var o = document.getElementById("wOrg").value.trim();
        S.user = { role: "buyer", org: o, buyerOrg: o, name: document.getElementById("wName").value.trim() }; store.save(); go("#catalog");
      };
    } else {
      f.innerHTML = '<form id="wf"><b>Вуз</b><label class="f" style="margin-top:12px"><span>Ваш университет (справочник CORE, 397 вузов)</span><input id="wUni" list="uniList" required placeholder="Начните вводить название"><datalist id="uniList">' +
        UNIS.map(function (u) { return '<option value="' + esc(u.label) + '">'; }).join("") + "</datalist></label>" +
        '<label class="f"><span>Ваше имя и должность</span><input id="wName" required placeholder="Например, начальник научного отдела"></label>' +
        '<p class="small muted" style="margin-bottom:12px">В рабочей версии вход в кабинет вуза получает только сотрудник, которого вуз назначил письмом. Для демо подсказка: Гулистанский, Ургенчский госуниверситет или КазНМУ — у них уже есть наборы в каталоге.</p>' +
        '<button class="btn btn-primary btn-sm">Войти</button><div class="err" id="werr" hidden>Выберите вуз из списка</div></form>';
      document.getElementById("wf").onsubmit = function (e) {
        e.preventDefault(); var v = document.getElementById("wUni").value.trim();
        var u = UNIS.filter(function (x) { return x.label === v; })[0];
        if (!u) { document.getElementById("werr").hidden = false; return; }
        S.user = { role: "university", org: u.name, uni: u.id, uniName: u.name, name: document.getElementById("wName").value.trim() }; store.save(); go("#uni");
      };
    }
    f.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function vCatalog() {
    view.innerHTML = '<span class="kicker">Каталог · ' + DS.length + " набора</span><h1>Размеченные данные вузов</h1>" +
      '<p class="lead">Каждый набор — это открытые данные учёных, которые CORE привёл в порядок, разметил и описал. Откройте набор, чтобы увидеть, что именно мы сделали.</p>' +
      '<div class="grid3" style="margin-top:26px">' + DS.map(function (d) {
        var r = S.user && S.user.role === "buyer" ? myReq(d.slug) : null;
        return '<article class="card ds"><div class="meta"><span class="pill">' + esc(d.field_ru) + '</span><span class="pill">' + d.country + "</span>" + (r ? pill(r.status) : "") + "</div>" +
          "<h3>" + esc(d.title_ru) + "</h3><p>" + esc(d.uni_ru) + "</p>" +
          '<p><b style="color:var(--text)">' + nf(d.rows) + "</b> записей · " + d.columns + " полей</p>" +
          '<p>Для кого: ' + esc(d.buyers_ru) + "</p>" +
          '<a class="btn btn-ghost btn-sm" href="#ds/' + d.slug + '">Открыть →</a></article>';
      }).join("") + "</div>";
  }

  function insight(d) {
    var s = d.summary, h = "";
    if (d.key === "insurance") {
      var seg = [["all", "Все"], ["urban", "Город"], ["rural", "Село"], ["men", "Мужчины"], ["women", "Женщины"], ["age_16_29", "16–29 лет"], ["age_30_44", "30–44 года"], ["age_45_plus", "45+ лет"], ["higher_ed", "С высшим образованием"], ["no_higher_ed", "Без высшего"]];
      h += "<h2>Что видно сразу: кто уже застрахован</h2><p class=\"muted small\" style=\"margin-bottom:12px\">Доля людей с высоким охватом страхованием (индекс ≥ 3,5 из 5) и намерение купить, по сегментам. Это пример отчёта, который CORE делает для страховой компании.</p>" +
        '<div class="tbl-wrap"><table class="t"><tr><th>Сегмент</th><th>Человек</th><th>Высокий охват</th><th></th><th>Намерение купить, 1–5</th></tr>' +
        seg.map(function (x) { var v = s.segments[x[0]]; return "<tr><td>" + x[1] + '</td><td class="n">' + v.n + '</td><td class="n">' + v.high_inclusion_pct + '%</td><td><div class="bar"><i style="width:' + Math.min(100, v.high_inclusion_pct * 2) + '%"></i></div></td><td class="n">' + String(v.intention).replace(".", ",") + "</td></tr>"; }).join("") +
        "</table></div>" +
        '<p class="small" style="margin-top:12px;color:#c3cbd4">С намерением купить сильнее всего связаны: ' + s.drivers_of_intention.slice(0, 3).map(function (x) { return "<b>" + x[2].toLowerCase() + "</b> (r = " + String(x[4]).replace(".", ",") + ")"; }).join(", ") +
        ". Финансовая грамотность связана слабо (r = " + String(s.drivers_of_intention.filter(function (x) { return x[0] === "fin_literacy_score"; })[0][4]).replace(".", ",") + "): продавать надо пользу и доверие, а не обучение. Сельские жители застрахованы реже городских.</p>";
    } else if (d.key === "covid") {
      var order = ["Pre-VOC", "Alpha-dominant", "Delta-dominant"], lbl = { "Pre-VOC": "До новых вариантов (до 31.01.2021)", "Alpha-dominant": "Альфа (02–06.2021)", "Delta-dominant": "Дельта (07–12.2021)" };
      h += "<h2>Что видно сразу: исходы по волнам</h2>" +
        '<div class="tbl-wrap"><table class="t"><tr><th>Период</th><th>Пациентов</th><th>Смертность</th><th></th><th>Смерть или реанимация</th></tr>' +
        order.map(function (k) { var v = s.periods[k]; return "<tr><td>" + lbl[k] + '</td><td class="n">' + nf(v.n) + '</td><td class="n">' + String(v.death_pct).replace(".", ",") + '%</td><td><div class="bar"><i style="width:' + v.death_pct * 12 + '%"></i></div></td><td class="n">' + String(v.severe_pct).replace(".", ",") + "%</td></tr>"; }).join("") +
        "</table></div>" +
        '<p class="small" style="margin-top:12px;color:#c3cbd4">Чаще всего в посевах: ' + s.top_organisms.slice(0, 4).map(function (x) { return "<i>" + esc(x[0]) + "</i> (" + x[1] + ")"; }).join(", ") + ". " + s.coded_variables + " переменных получили стандартные коды (МКБ-10, LOINC, ATC, NCBI) — набор можно объединять с другими клиниками.</p>";
    } else {
      var max = s.categories[0][1];
      h += "<h2>Что видно сразу: о чём учебники</h2>" +
        '<div class="grid2"><div class="tbl-wrap"><table class="t"><tr><th>Категория (320 частых терминов)</th><th>Терминов</th><th></th></tr>' +
        s.categories.map(function (c) { return "<tr><td>" + esc(c[0]) + '</td><td class="n">' + c[1] + '</td><td><div class="bar"><i style="width:' + Math.round(100 * c[1] / max) + '%"></i></div></td></tr>'; }).join("") +
        '</table></div><div class="tbl-wrap"><table class="t"><tr><th>Узбекский</th><th>Русский</th><th>English</th><th>Школа</th><th>Вуз</th></tr>' +
        s.examples.slice(0, 9).map(function (e) { return "<tr><td>" + esc(e.term_uz) + "</td><td>" + esc(e.term_ru) + "</td><td>" + esc(e.term_en) + '</td><td class="n">' + nf(e.freq_school) + '</td><td class="n">' + nf(e.freq_university) + "</td></tr>"; }).join("") +
        "</table></div></div>";
    }
    return h;
  }

  function accessBox(d) {
    var u = S.user, base = "packages/" + d.slug + "/";
    if (u.role !== "buyer") {
      return '<div class="card"><b>Файлы пакета</b><p class="small muted" style="margin-top:6px">Вы смотрите как ' + ROLES[u.role].toLowerCase() + '. Покупателю файлы открываются после одобрения заявки.</p>' + files(d, base) + "</div>";
    }
    var r = myReq(d.slug);
    if (!r || r.status === "declined") {
      return '<div class="card"><b>Получить доступ</b><p class="small muted" style="margin:6px 0 14px">Ориентир цены для коммерческого использования: ' + PRICE[d.slug] + ". Для участников инкубатора — бесплатно.</p>" +
        (r ? '<p class="err">Прошлая заявка отклонена. Можно уточнить задачу и отправить снова.</p>' : "") +
        '<form id="reqf"><label class="f"><span>Для чего нужны данные</span><textarea id="rP" required placeholder="Например, обучаем модель / готовим продукт / исследование"></textarea></label>' +
        '<label class="f"><span>Использование</span><select id="rU"><option value="commercial">Коммерческое</option><option value="research">Некоммерческое исследование</option></select></label>' +
        '<button class="btn btn-teal btn-sm">Запросить доступ</button></form></div>';
    }
    if (r.status === "pending") {
      return '<div class="card"><b>Заявка отправлена</b> ' + pill("pending") + '<p class="small muted" style="margin-top:8px">Заявка ' + r.id + " от " + date(r.created) + ". CORE проверяет, подходит ли цель использования под лицензию и договор с вузом.</p>" +
        '<div class="hint">Демо: переключитесь в роль «Оператор CORE» (меню вверху справа) и одобрите заявку.</div>' +
        '<button class="btn btn-ghost btn-sm" id="asOp">Перейти в роль оператора →</button></div>';
    }
    return '<div class="card"><b>Доступ открыт</b> ' + pill("approved") + '<p class="small muted" style="margin-top:8px">Лицензия CC BY 4.0: указывайте авторов набора и CORE как подготовившего данные.</p>' +
      '<label class="chk"><input type="checkbox" id="lic"> Принимаю условия лицензии</label>' + '<div id="dlBox" hidden>' + files(d, base, true) + "</div>" +
      '<button class="btn btn-ghost btn-sm btn-block" id="toApi" style="margin-top:12px">Ключ API и SQL-запросы ↓</button></div>';
  }
  function files(d, base, live) {
    var f = [[d.zip, "Весь пакет (zip)", d.zip_kb + " КБ"], ["data/" + d.file, "Данные (CSV)", nf(d.rows) + " строк"], ["codebook.csv", "Описание переменных, 3 языка", "CSV"],
      ["DATASHEET.md", "Паспорт набора и отчёт о качестве", "MD"], ["croissant.json", "Метаданные Croissant", "JSON"], ["LICENSE.txt", "Лицензия и как цитировать", "TXT"]];
    return '<div class="dl">' + f.map(function (x) {
      var href = x[0] === d.zip ? "packages/" + d.zip : base + x[0];
      return live ? '<a href="' + href + '" download data-dl>' + x[1] + "<span>" + x[2] + "</span></a>" : '<a aria-disabled="true" style="opacity:.55;pointer-events:none">' + x[1] + "<span>" + x[2] + "</span></a>";
    }).join("") + "</div>";
  }

  function vDataset(slug) {
    var d = ds(slug); if (!d) { go("#catalog"); return; }
    var s = d.summary, p = d.preview, show = Math.min(p[0].length, 9);
    view.innerHTML = '<a class="back" href="#catalog">← Каталог</a><span class="kicker">' + esc(d.field_ru) + " · " + d.country + "</span><h1>" + esc(d.title_ru) + "</h1>" +
      '<p class="lead">' + esc(d.uni_ru) + ". Авторы: " + esc(d.authors.join(", ")) + '. Исходный набор: <a class="mvp-link" href="https://doi.org/' + esc(d.doi) + '" target="_blank" rel="noopener">doi.org/' + esc(d.doi) + "</a></p>" +
      '<div class="facts"><div><b>' + nf(d.rows) + "</b><span>записей</span></div><div><b>" + d.columns + "</b><span>полей</span></div><div><b>" + s.issues.length + "</b><span>находок в отчёте о качестве</span></div><div><b>3</b><span>языка описания</span></div></div>" +
      '<div class="cols"><div>' + apiSection(d) +
      "<h2 style=\"margin-top:0\">Что сделал CORE</h2><ul class=\"added\">" + d.added_ru.map(function (a) { return "<li>" + esc(a) + "</li>"; }).join("") + "</ul>" +
      "<h2>До и после</h2><div class=\"card\" style=\"padding:8px 20px\">" + (BA[slug] || []).map(function (x) { return '<div class="ba"><div class="b">' + esc(x[0]) + '</div><div class="arr">→</div><div class="a">' + esc(x[1]) + "</div></div>"; }).join("") + "</div>" +
      insight(d) +
      "<h2>Первые строки</h2><div class=\"tbl-wrap\"><table class=\"t mono\"><tr>" + p[0].slice(0, show).map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr>" +
      p.slice(1).map(function (r) { return "<tr>" + r.slice(0, show).map(function (c) { return "<td>" + esc(String(c).slice(0, 48)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>" +
      '<p class="small muted" style="margin-top:8px">Показаны ' + show + " из " + d.columns + " полей. Полная таблица — в пакете.</p>" +
      "<h2>Отчёт о качестве</h2><div class=\"tbl-wrap\"><table class=\"t\"><tr><th>Что</th><th>Где</th><th>Что нашли и сделали</th></tr>" +
      s.issues.map(function (i) { return "<tr><td>" + esc({ formula: "формула", naming: "названия", missing: "пропуски", invalid: "ошибка", check: "проверка", normalised: "стандарт", added: "добавлено" }[i.type] || i.type) + "</td><td class=\"mono small\">" + esc(i.column) + "</td><td>" + esc(i.detail) + "</td></tr>"; }).join("") + "</table></div>" +
      '<p class="small muted" style="margin-top:10px">Статус: демонстрация процесса CORE на открытых данных. Договор с вузом по этому набору ещё не подписан; CORE не продаёт исходные данные, только их подготовку. Разметка с пометкой «CORE draft» ждёт проверки экспертом вуза.</p>' +
      '</div><aside class="sticky" id="acc">' + accessBox(d) + "</aside></div>";
    wireAccess(d);
  }
  /* ---------------- API and SQL console (approved buyers) ---------------- */
  var TABLE = { "uzbek-geography-terms": "terms", "insurance-literacy-syrdarya": "insurance", "covid-almaty-cohort": "covid" };
  var EXAMPLES = {
    "covid-almaty-cohort": [
      ["Смертность по волнам", "SELECT period, count(*) AS patients,\n       round(100 * avg(death), 1) AS death_pct,\n       round(100 * avg(severe_outcome), 1) AS death_or_icu_pct\nFROM covid\nWHERE duplicate_record = 0\nGROUP BY period\nORDER BY death_pct DESC"],
      ["Микробы в посевах", "SELECT organism, organism_group, count(*) AS n\nFROM covid\nWHERE organism IS NOT NULL\nGROUP BY ALL\nORDER BY n DESC\nLIMIT 10"],
      ["Диабет и исход", "SELECT com_dm AS diabetes, count(*) AS patients,\n       round(100 * avg(severe_outcome), 1) AS death_or_icu_pct\nFROM covid WHERE duplicate_record = 0\nGROUP BY com_dm"],
    ],
    "insurance-literacy-syrdarya": [
      ["Город и село", "SELECT settlement, count(*) AS people,\n       round(avg(ins_inclusion_idx), 2) AS inclusion,\n       round(avg(intention_idx), 2) AS intention_to_buy\nFROM insurance\nGROUP BY settlement"],
      ["Доверие по образованию", "SELECT education, count(*) AS people,\n       round(avg(trust_idx), 2) AS trust\nFROM insurance\nGROUP BY education\nORDER BY trust DESC"],
      ["Кто готов купить", "SELECT gender, (age >= 30) AS age_30_plus, count(*) AS people,\n       round(100 * avg(CASE WHEN intention_idx >= 3.5 THEN 1 ELSE 0 END)) AS ready_pct\nFROM insurance WHERE age IS NOT NULL\nGROUP BY ALL ORDER BY ready_pct DESC"],
    ],
    "uzbek-geography-terms": [
      ["Термины по темам", "SELECT category_ru, count(*) AS terms\nFROM terms\nWHERE category IS NOT NULL\nGROUP BY category_ru\nORDER BY terms DESC"],
      ["Первые термины 5 класса", "SELECT term_uz, term_ru, term_en, freq_school, freq_university\nFROM terms\nWHERE first_level = '5' AND term_ru IS NOT NULL\nORDER BY freq_school DESC\nLIMIT 15"],
      ["Только в вузе", "SELECT term_uz, term_ru, freq_university\nFROM terms\nWHERE level_profile = 'university only'\nORDER BY freq_university DESC\nLIMIT 15"],
    ],
  };
  function apiKey(r) {
    var s = r.id + "|" + r.org, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "core_demo_" + (h >>> 0).toString(16) + r.id.replace(/\D/g, "");
  }
  function apiBase() { return new URL("api/v1/", location.href).href; }
  function apiSection(d) {
    var r = S.user.role === "buyer" ? myReq(d.slug) : null;
    if (!r || r.status !== "approved") return "";
    var key = apiKey(r), base = apiBase(), t = TABLE[d.slug];
    var curl = 'curl -H "X-Core-Key: ' + key + '" \\\n  ' + base + "datasets/" + d.slug + "/rows-1.json";
    var py = 'import requests\n\nBASE = "' + base + '"\nH = {"X-Core-Key": "' + key + '"}\n\nmeta = requests.get(BASE + "datasets/' + d.slug + '/index.json", headers=H).json()\nrows = [row for page in meta["links"]["rows"]\n        for row in requests.get(BASE + "datasets/' + d.slug + '/" + page, headers=H).json()["rows"]]\nprint(len(rows), "rows")';
    var js = 'const BASE = "' + base + '";\nconst H = { "X-Core-Key": "' + key + '" };\nconst meta = await fetch(BASE + "datasets/' + d.slug + '/index.json", { headers: H }).then(r => r.json());\nconst page1 = await fetch(BASE + "datasets/' + d.slug + '/rows-1.json", { headers: H }).then(r => r.json());';
    var ex = EXAMPLES[d.slug] || [];
    return '<section class="api card" id="api"><span class="kicker">Ваш доступ · API и запросы</span>' +
      '<div class="api-key"><span class="muted small">Ключ API</span><code id="apiKey">' + key + '</code><button class="btn btn-ghost btn-sm" data-copy="apiKey">Скопировать</button></div>' +
      '<p class="small muted">Прототип: ключ передаётся в заголовке X-Core-Key, но статическая демо-версия его не проверяет. В рабочей версии ключ работает только для одобренных наборов, а вуз видит число запросов.</p>' +
      '<div class="api-eps"><div><span class="mono">GET</span> datasets/' + d.slug + '/index.json <span class="muted">— описание, число строк, ссылки</span></div>' +
      '<div><span class="mono">GET</span> datasets/' + d.slug + '/fields.json <span class="muted">— поля, коды стандартов, подписи на 3 языках</span></div>' +
      '<div><span class="mono">GET</span> datasets/' + d.slug + '/rows-{n}.json <span class="muted">— данные, по 500 строк</span></div></div>' +
      '<div class="api-tabs" role="tablist"><button class="on" data-snip="s-curl">curl</button><button data-snip="s-py">Python</button><button data-snip="s-js">JavaScript</button><button data-snip="s-agent">ИИ-агент</button></div>' +
      '<pre class="snip" id="s-curl">' + esc(curl) + '</pre><pre class="snip" id="s-py" hidden>' + esc(py) + '</pre><pre class="snip" id="s-js" hidden>' + esc(js) + "</pre>" +
      '<div class="snip" id="s-agent" hidden><p class="small" style="color:#c3cbd4">Дайте агенту описание API в формате OpenAPI — он сам найдёт наборы, поля и страницы с данными. Подходит для GPT Actions, LangChain, LlamaIndex и MCP-адаптеров OpenAPI.</p>' +
      '<a class="mvp-link small" href="' + base + 'openapi.json" target="_blank" rel="noopener">' + esc(base) + "openapi.json</a></div>" +
      '<div class="api-try"><button class="btn btn-ghost btn-sm" id="tryApi">Выполнить запрос</button><span class="small muted" id="tryNote"></span></div><pre class="snip" id="tryOut" hidden></pre>' +
      '<h3 style="margin-top:22px">Запросы SQL прямо в браузере</h3><p class="small muted" style="margin-bottom:10px">Таблица <code>' + t + "</code> — все " + nf(d.rows) + " строк. Запрос выполняется у вас в браузере (DuckDB), ничего не отправляется на сервер.</p>" +
      '<div class="sql-ex">' + ex.map(function (e, i) { return '<button class="pill" data-ex="' + i + '">' + esc(e[0]) + "</button>"; }).join("") + "</div>" +
      '<textarea id="sql" class="sql" spellcheck="false">' + esc(ex.length ? ex[0][1] : "SELECT * FROM " + t + " LIMIT 10") + "</textarea>" +
      '<div class="api-try"><button class="btn btn-teal btn-sm" id="runSql">Выполнить SQL</button><span class="small muted" id="sqlNote"></span></div><div id="sqlOut"></div></section>';
  }
  var duck = null;
  function loadDuck() {
    if (duck) return duck;
    var V = "1.29.0";
    duck = import("https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@" + V + "/+esm").then(function (m) {
      return m.selectBundle(m.getJsDelivrBundles()).then(function (b) {
        var wurl = URL.createObjectURL(new Blob(['importScripts("' + b.mainWorker + '");'], { type: "text/javascript" }));
        var db = new m.AsyncDuckDB(new m.VoidLogger(), new Worker(wurl));
        return db.instantiate(b.mainModule, b.pthreadWorker).then(function () { URL.revokeObjectURL(wurl); return { db: db, loaded: {} }; });
      });
    });
    duck.catch(function () { duck = null; });
    return duck;
  }
  function ensureTable(D, d) {
    var t = TABLE[d.slug];
    if (D.loaded[t]) return Promise.resolve();
    return fetch("packages/" + d.slug + "/data/" + d.file).then(function (r) { return r.text(); }).then(function (txt) {
      return D.db.registerFileText(t + ".csv", txt).then(function () { return D.db.connect(); }).then(function (c) {
        return c.query("CREATE TABLE " + t + " AS SELECT * FROM read_csv_auto('" + t + ".csv', header = true)").then(function () { D.loaded[t] = true; return c.close(); });
      });
    });
  }
  function cell(v) {
    if (v == null) return '<span class="muted">—</span>';
    if (typeof v === "bigint") v = Number(v);
    if (typeof v === "boolean") return v ? "да" : "нет";
    if (typeof v === "number") return String(Math.round(v * 1000) / 1000).replace(".", ",");
    return esc(String(v).slice(0, 80));
  }
  function wireApi(d) {
    var sec = document.getElementById("api"); if (!sec) return;
    Array.prototype.forEach.call(sec.querySelectorAll("[data-snip]"), function (b) {
      b.onclick = function () {
        Array.prototype.forEach.call(sec.querySelectorAll("[data-snip]"), function (x) { x.classList.toggle("on", x === b); document.getElementById(x.getAttribute("data-snip")).hidden = x !== b; });
      };
    });
    sec.querySelector("[data-copy]").onclick = function () {
      var k = document.getElementById("apiKey").textContent;
      (navigator.clipboard ? navigator.clipboard.writeText(k) : Promise.reject()).then(function () { toast("Ключ скопирован"); }, function () { toast(k); });
    };
    document.getElementById("tryApi").onclick = function () {
      var out = document.getElementById("tryOut"), note = document.getElementById("tryNote"), t0 = performance.now();
      var url = apiBase() + "datasets/" + d.slug + "/rows-1.json";
      note.textContent = "GET " + url;
      fetch(url, { headers: { "X-Core-Key": apiKey(myReq(d.slug)) } }).then(function (r) { return r.json(); }).then(function (j) {
        var shown = { dataset: j.dataset, page: j.page, pages: j.pages, rows_total: j.rows_total, rows: j.rows.slice(0, 2), "…": (j.rows.length - 2) + " more rows on this page" };
        out.textContent = JSON.stringify(shown, null, 2); out.hidden = false;
        note.textContent = "200 OK · " + Math.round(performance.now() - t0) + " мс · " + j.rows.length + " строк на странице";
      }).catch(function () { note.textContent = "Не удалось выполнить запрос"; });
    };
    var ex = EXAMPLES[d.slug] || [];
    Array.prototype.forEach.call(sec.querySelectorAll("[data-ex]"), function (b) { b.onclick = function () { document.getElementById("sql").value = ex[+b.getAttribute("data-ex")][1]; }; });
    document.getElementById("runSql").onclick = function () {
      var note = document.getElementById("sqlNote"), out = document.getElementById("sqlOut"), btn = this, sql = document.getElementById("sql").value;
      btn.disabled = true; note.textContent = duck ? "Выполняю…" : "Загружаю движок запросов (один раз, ~7 МБ)…";
      var t0;
      loadDuck().then(function (D) { note.textContent = "Загружаю таблицу…"; return ensureTable(D, d).then(function () { return D.db.connect(); }); })
        .then(function (c) {
          t0 = performance.now(); note.textContent = "Выполняю…";
          return c.query(sql).then(function (res) { c.close(); return res; }, function (e) { c.close(); throw e; });
        })
        .then(function (res) {
          var cols = res.schema.fields.map(function (f) { return f.name; }), rows = res.toArray().slice(0, 200).map(function (r) { return r.toJSON(); });
          out.innerHTML = '<div class="tbl-wrap"><table class="t"><tr>' + cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr>" +
            rows.map(function (r) { return "<tr>" + cols.map(function (c) { return "<td>" + cell(r[c]) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
          note.textContent = res.numRows + " строк · " + Math.round(performance.now() - t0) + " мс" + (res.numRows > 200 ? " · показаны первые 200" : "");
        })
        .catch(function (e) { out.innerHTML = '<p class="err">' + esc(String(e && e.message || e).slice(0, 300)) + "</p>"; note.textContent = "Ошибка в запросе или движок не загрузился"; })
        .then(function () { btn.disabled = false; });
    };
  }
  function wireAccess(d) {
    wireApi(d);
    var ta = document.getElementById("toApi");
    if (ta) ta.onclick = function () { document.getElementById("api").scrollIntoView({ behavior: "smooth", block: "start" }); };
    var f = document.getElementById("reqf");
    if (f) f.onsubmit = function (e) {
      e.preventDefault();
      S.requests.push({ id: id("R"), ds: d.slug, org: S.user.org, name: S.user.name || "", purpose: document.getElementById("rP").value.trim(), use: document.getElementById("rU").value, status: "pending", created: Date.now() });
      store.save(); toast("Заявка отправлена. CORE ответит в течение рабочего дня."); render();
    };
    var a = document.getElementById("asOp"); if (a) a.onclick = function () { switchRole("operator"); };
    var lic = document.getElementById("lic");
    if (lic) lic.onchange = function () { document.getElementById("dlBox").hidden = !lic.checked; };
    Array.prototype.forEach.call(document.querySelectorAll("[data-dl]"), function (x) {
      x.addEventListener("click", function () { S.downloads++; var r = myReq(d.slug); if (r) r.downloads = (r.downloads || 0) + 1; store.save(); });
    });
  }

  function vMy() {
    var mine = S.requests.filter(function (r) { return r.org === S.user.org; }).sort(function (a, b) { return b.created - a.created; });
    view.innerHTML = "<h1>Мои заявки</h1>" + '<div class="card" style="margin-top:22px">' + (mine.length ? mine.map(function (r) {
      var d = ds(r.ds);
      return '<div class="item"><div><b>' + esc(d.title_ru) + '</b><div class="sub">' + r.id + " · " + date(r.created) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + " · " + esc(r.purpose) + "</div></div>" +
        '<div class="acts">' + pill(r.status) + '<a class="btn btn-ghost btn-sm" href="#ds/' + r.ds + '">' + (r.status === "approved" ? "Скачать" : "Открыть") + "</a></div></div>";
    }).join("") : '<p class="empty">Заявок пока нет. <a class="mvp-link" href="#catalog">Откройте каталог</a> и запросите доступ к набору.</p>') + "</div>";
  }

  function pipe(st) {
    return '<div class="pipe">' + STEPS.map(function (s, i) { return '<span class="' + (i < st ? "done" : i === st ? (st === 4 ? "done" : "cur") : "") + '">' + (i < st || st === 4 ? "✓ " : "") + s + "</span>"; }).join("") + "</div>";
  }
  function scanHtml(f) {
    if (!f) return "";
    var li = ["Файл: " + esc(f.name) + " · " + Math.max(1, Math.round(f.size / 1024)) + " КБ"];
    if (f.rows != null) {
      li.push(nf(f.rows) + " строк, " + f.cols + " столбцов, пустых ячеек " + Math.round(f.empty * 100) + "%");
      li.push(f.pii.length ? '<span class="err">Похоже на персональные данные: ' + esc(f.pii.join("; ")) + ". Нужно обезличить до продажи.</span>" : '<span class="ok">Персональных данных не найдено (имена, телефоны, e-mail, паспорт, ПИНФЛ/ИИН)</span>');
    } else li.push("Автоматическая проверка доступна для CSV; этот файл проверит оператор вручную.");
    return '<ul class="scan">' + li.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>";
  }

  function vUni() {
    var u = S.user, subs = S.submissions.filter(function (s) { return s.uni === u.uni; });
    var cat = DS.filter(function (d) { return DS_UNI[d.slug] === u.uni; });
    var reqs = S.requests.filter(function (r) { return cat.some(function (d) { return d.slug === r.ds; }); });
    view.innerHTML = '<span class="kicker">Кабинет вуза</span><h1>' + esc(u.uniName) + "</h1>" +
      '<p class="lead">Здесь видно, какие ваши наборы уже в каталоге, кто их запрашивает и на каком этапе проверки новые. Данные остаются собственностью вуза: покупатель получает лицензию на использование.</p>' +
      '<div class="facts"><div><b>' + cat.length + "</b><span>в каталоге</span></div><div><b>" + subs.filter(function (s) { return s.status < 4; }).length + "</b><span>на проверке</span></div><div><b>" + reqs.length + "</b><span>заявок покупателей</span></div><div><b>" + reqs.filter(function (r) { return r.status === "approved"; }).length + "</b><span>выдано доступов</span></div></div>" +
      '<div class="grid2"><div class="card"><b>Наборы в каталоге</b>' + (cat.length ? cat.map(function (d) {
        var n = reqs.filter(function (r) { return r.ds === d.slug; });
        return '<div class="item"><div><b>' + esc(d.title_ru) + '</b><div class="sub">' + nf(d.rows) + " записей · заявок: " + n.length + " · одобрено: " + n.filter(function (r) { return r.status === "approved"; }).length + "</div></div>" +
          '<div class="acts"><a class="btn btn-ghost btn-sm" href="#ds/' + d.slug + '">Открыть</a></div></div>';
      }).join("") : '<p class="empty">Пока нет. Загрузите первый набор — после проверки он появится здесь.</p>') + "</div>" +
      '<div class="card"><b>Заявки на ваши данные</b>' + (reqs.length ? reqs.map(function (r) {
        return '<div class="item"><div><b>' + esc(r.org) + '</b><div class="sub">' + esc(ds(r.ds).title_ru) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + "<br>«" + esc(r.purpose) + "»</div></div><div class=\"acts\">" + pill(r.status) + "</div></div>";
      }).join("") : '<p class="empty">Заявок пока нет.</p>') + "</div></div>" +
      '<h2>Загруженные наборы</h2><div class="card">' + (subs.length ? subs.map(function (s) {
        return '<div class="item"><div><b>' + esc(s.title) + '</b><div class="sub">' + s.id + " · " + esc(s.field) + " · " + date(s.created) + " · модель: " + (s.model === "ready" ? "готовые данные, вузу до 70%" : "CORE готовит, вузу 40–50%") + "</div>" + pipe(s.status) + scanHtml(s.file) + "</div></div>";
      }).join("") : '<p class="empty">Вы ещё ничего не загружали.</p>') + '<a class="btn btn-teal btn-sm" href="#uni/new" style="margin-top:14px">Загрузить набор</a></div>';
  }

  function vUniNew() {
    view.innerHTML = '<a class="back" href="#uni">← Кабинет вуза</a><h1>Загрузить набор</h1><p class="lead">Файл сразу проверяется у вас в браузере: размер, пропуски и признаки персональных данных. Затем CORE проверит права и подготовит описание.</p>' +
      '<form id="nf" class="card" style="margin-top:22px;max-width:760px">' +
      '<label class="f"><span>Название набора</span><input id="nT" required placeholder="Например, Наблюдения за засолением почв, 2019–2024"></label>' +
      '<label class="f"><span>Область</span><select id="nFld"><option>Язык и тексты</option><option>Социология и опросы</option><option>Медицина и здоровье</option><option>Агро, вода и экология</option><option>Биология и биохимия</option><option>История и наследие</option><option>Экономика и право</option><option>Другое</option></select></label>' +
      '<label class="f"><span>Коротко: что внутри, как собрано</span><textarea id="nD" required></textarea></label>' +
      '<label class="f"><span>Файл (CSV проверяется автоматически; до 20 МБ)</span><input type="file" id="nFile" required accept=".csv,.tsv,.txt,.xlsx,.xls,.zip,.json"></label><div id="scan"></div>' +
      '<h3 style="margin-top:20px">Права на данные</h3><p class="small muted">Все четыре пункта обязательны. В рабочей версии к ним прикладывается письмо вуза.</p>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Данные получены сотрудниками вуза или по проекту вуза</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Авторы согласны на лицензирование через CORE</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Персональных данных нет или они обезличены</label>' +
      '<label class="chk"><input type="checkbox" class="rt" required> Грантодатель и партнёры не запрещают передачу</label>' +
      '<label class="f" style="margin-top:12px"><span>Кто подписывает со стороны вуза</span><input id="nS" required placeholder="ФИО, должность (например, проректор по науке)"></label>' +
      '<h3 style="margin-top:20px">Кто готовит данные</h3>' +
      '<label class="chk"><input type="radio" name="m" value="ready"> Данные уже очищены и описаны — вузу до 70% дохода</label>' +
      '<label class="chk"><input type="radio" name="m" value="process" checked> Нужна подготовка CORE (очистка, разметка, описание) — вузу 40–50% дохода</label>' +
      '<button class="btn btn-teal" style="margin-top:16px">Отправить на проверку</button></form>';
    var fileInfo = null;
    document.getElementById("nFile").onchange = function () {
      var f = this.files[0], box = document.getElementById("scan"); fileInfo = null; if (!f) { box.innerHTML = ""; return; }
      if (f.size > 20 * 1048576) { box.innerHTML = '<p class="err">Файл больше 20 МБ — для прототипа загрузите выборку.</p>'; return; }
      fileInfo = { name: f.name, size: f.size, rows: null };
      if (!/\.(csv|tsv|txt)$/i.test(f.name)) { box.innerHTML = scanHtml(fileInfo); return; }
      var rd = new FileReader();
      rd.onload = function () { fileInfo = Object.assign(fileInfo, scanCsv(String(rd.result))); box.innerHTML = scanHtml(fileInfo); };
      rd.readAsText(f);
    };
    document.getElementById("nf").onsubmit = function (e) {
      e.preventDefault(); if (!fileInfo) return;
      var now = Date.now();
      S.submissions.unshift({ id: id("S"), uni: S.user.uni, uniName: S.user.uniName, title: document.getElementById("nT").value.trim(), field: document.getElementById("nFld").value,
        desc: document.getElementById("nD").value.trim(), model: (document.querySelector("input[name=m]:checked") || {}).value || "process", status: 0, created: now, file: fileInfo,
        rights: { own: true, authors: true, personal: true, funder: true }, signer: document.getElementById("nS").value.trim(), log: [{ t: now, s: 0 }] });
      store.save(); toast("Набор отправлен на проверку. Статус — в кабинете."); go("#uni");
    };
  }
  /* CSV scan: size, emptiness and personal-data signals in headers and values */
  function scanCsv(txt) {
    var lines = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
    var sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ";" : lines[0].indexOf("\t") >= 0 ? "\t" : ",";
    var head = lines[0].split(sep).map(function (h) { return h.replace(/^"|"$/g, "").trim(); });
    var body = lines.slice(1), cells = 0, empty = 0, pii = [];
    var H = /(^|_|\b)(name|fio|фио|имя|фамилия|familiya|ism|otasining|phone|tel|телефон|email|e-mail|почта|passport|паспорт|pinfl|пинфл|iin|иин|address|адрес|manzil|birth|рождени|tug.?ilgan)/i;
    head.forEach(function (h) { if (H.test(h)) pii.push("столбец «" + h + "»"); });
    var em = 0, ph = 0, idn = 0;
    body.slice(0, 5000).forEach(function (l) {
      var c = l.split(sep); cells += head.length;
      c.forEach(function (v) {
        v = v.replace(/^"|"$/g, "").trim(); if (!v) empty++;
        if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(v)) em++;
        if (/(\+?998|\+?7)[\s(-]*\d{2,3}[\s)-]*\d{3}[\s-]?\d{2}[\s-]?\d{2}/.test(v)) ph++;
        if (/^\d{12}$|^\d{14}$/.test(v)) idn++;
      });
      empty += Math.max(0, head.length - c.length);
    });
    if (em) pii.push(em + " адрес(ов) e-mail");
    if (ph) pii.push(ph + " номер(ов) телефона");
    if (idn) pii.push(idn + " значений, похожих на ПИНФЛ/ИИН");
    return { rows: body.length, cols: head.length, empty: cells ? empty / cells : 0, pii: pii };
  }

  function vOps() {
    var pend = S.requests.filter(function (r) { return r.status === "pending"; }), done = S.requests.filter(function (r) { return r.status !== "pending"; });
    var subs = S.submissions;
    view.innerHTML = '<span class="kicker">Оператор CORE</span><h1>Очередь</h1>' +
      '<div class="facts"><div><b>' + pend.length + "</b><span>заявок ждут решения</span></div><div><b>" + subs.filter(function (s) { return s.status < 4; }).length + "</b><span>наборов вузов в работе</span></div><div><b>" + S.requests.filter(function (r) { return r.status === "approved"; }).length + "</b><span>доступов выдано</span></div><div><b>" + S.downloads + "</b><span>скачиваний</span></div></div>" +
      '<h2>Заявки покупателей</h2><div class="card">' + (pend.length ? pend.map(function (r) {
        var d = ds(r.ds);
        return '<div class="item"><div><b>' + esc(r.org) + "</b> → " + esc(d.title_ru) + '<div class="sub">' + r.id + " · " + date(r.created) + " · " + (r.use === "commercial" ? "коммерческое" : "исследование") + "<br>«" + esc(r.purpose) + "»</div></div>" +
          '<div class="acts"><button class="btn btn-teal btn-sm" data-ap="' + r.id + '">Одобрить</button><button class="btn btn-ghost btn-sm" data-dc="' + r.id + '">Отклонить</button></div></div>';
      }).join("") : '<p class="empty">Новых заявок нет.</p>') +
      (done.length ? '<details style="margin-top:10px"><summary class="small muted" style="cursor:pointer">Решённые (' + done.length + ")</summary>" + done.map(function (r) { return '<div class="item"><div>' + esc(r.org) + " → " + esc(ds(r.ds).title_ru) + '</div><div class="acts">' + pill(r.status) + "</div></div>"; }).join("") + "</details>" : "") + "</div>" +
      '<h2>Наборы от вузов</h2><div class="card">' + (subs.length ? subs.map(function (s) {
        return '<div class="item"><div><b>' + esc(s.title) + '</b><div class="sub">' + esc(s.uniName) + " · " + s.id + " · подписант: " + esc(s.signer) + " · " + (s.model === "ready" ? "готовые данные" : "готовит CORE") + "</div>" + pipe(s.status) + scanHtml(s.file) + "</div>" +
          '<div class="acts">' + (s.status < 4 ? '<button class="btn btn-teal btn-sm" data-nx="' + s.id + '">' + (s.status === 3 ? "Опубликовать" : "Этап пройден →") + "</button>" : '<span class="pill p-ok">В каталоге</span>') + "</div></div>";
      }).join("") : '<p class="empty">Вузы пока ничего не загрузили.</p>') + "</div>" +
      '<p class="small muted" style="margin-top:14px">Опубликованный набор вуза в прототипе отмечается как «в каталоге»; в рабочей версии CORE выкладывает его вместе с паспортом и разметкой, как три набора в каталоге.</p>';
    Array.prototype.forEach.call(document.querySelectorAll("[data-ap],[data-dc]"), function (b) {
      b.onclick = function () {
        var rid = b.getAttribute("data-ap") || b.getAttribute("data-dc"), r = S.requests.filter(function (x) { return x.id === rid; })[0];
        r.status = b.hasAttribute("data-ap") ? "approved" : "declined"; r.decided = Date.now(); store.save();
        toast(r.status === "approved" ? "Доступ открыт. Переключитесь в роль покупателя, чтобы скачать пакет." : "Заявка отклонена."); render();
      };
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-nx]"), function (b) {
      b.onclick = function () {
        var s = S.submissions.filter(function (x) { return x.id === b.getAttribute("data-nx"); })[0];
        if (s.status === 2 && s.file && s.file.pii && s.file.pii.length && !confirm("В файле найдены признаки персональных данных. Подтверждаете, что вуз прислал обезличенную версию?")) return;
        s.status++; s.log.push({ t: Date.now(), s: s.status }); store.save(); toast("«" + s.title + "»: " + STEPS[s.status]); render();
      };
    });
  }

  /* ---------------- router ---------------- */
  /* #demo: a visitor from the public site becomes a demo buyer with one dataset already open */
  function startDemo(want) {
    try { localStorage.setItem("core-invite", "1"); } catch (e) {}
    var org = "Demo visitor", slug = ds(want) ? want : "uzbek-geography-terms";
    S.user = { role: "buyer", org: org, buyerOrg: org, name: "Demo" };
    if (!S.requests.some(function (r) { return r.org === org && r.ds === slug && r.status === "approved"; }))
      S.requests.push({ id: id("R"), ds: slug, org: org, name: "Demo", purpose: "Демо: знакомство с форматом и API", use: "commercial", status: "approved", created: Date.now(), decided: Date.now() });
    store.save();
    location.replace("#ds/" + slug);
    setTimeout(function () { toast("Демо: доступ к этому набору уже открыт — попробуйте API и SQL ниже. Другие наборы можно запросить и одобрить в роли оператора."); }, 400);
  }
  function render() {
    var h = location.hash || "";
    if (h === "#demo" || h.indexOf("#demo/") === 0) { startDemo(h.slice(6)); return; }
    if (!S.user && h !== "#login") { location.hash = "#login"; return; }
    header();
    window.scrollTo(0, 0);
    if (h === "#login") vLogin();
    else if (h === "#catalog") vCatalog();
    else if (h.indexOf("#ds/") === 0) vDataset(h.slice(4));
    else if (h === "#my") vMy();
    else if (h === "#uni") S.user.role === "university" ? vUni() : switchRole("university");
    else if (h === "#uni/new") vUniNew();
    else if (h === "#ops") S.user.role === "operator" ? vOps() : go("#catalog");
    else go(S.user.role === "university" ? "#uni" : S.user.role === "operator" ? "#ops" : "#catalog");
  }
  document.getElementById("reset").onclick = function (e) { e.preventDefault(); store.reset(); toast("Демо сброшено"); go("#login"); };
  window.addEventListener("hashchange", render);
  window.addEventListener("storage", function (e) { if (e.key === KEY) { store.load(); S = store.s; render(); } });

  Promise.all([fetch("packages/index.json").then(function (r) { return r.json(); }), fetch("../api/v0/universities.json").then(function (r) { return r.json(); }).catch(function () { return { universities: [] }; })])
    .then(function (res) {
      DS = res[0];
      UNIS = res[1].universities.map(function (u) {
        var n = u.name_ru || u.name_national || u.name_en || u.name;
        return { id: u.id, name: n, label: n + " (" + u.country + ")" };
      }).sort(function (a, b) { return a.label.localeCompare(b.label, "ru"); });
      render();
    })
    .catch(function () { view.innerHTML = '<p class="err">Не удалось загрузить каталог. Обновите страницу.</p>'; });
})();
