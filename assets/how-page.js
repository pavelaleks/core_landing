/* "How CORE works" page: one data path in five stages, three ways CORE works, four viewpoints. */
(function () {
  "use strict";
  var root = document.getElementById("howApp");
  if (!root) return;
  var lang = document.documentElement.getAttribute("data-static-lang") || document.documentElement.lang || "en";
  var L = function (o) { return o[lang] || o.en; };
  var tr = function (en, ru, uz) { return { en: en, ru: ru, uz: uz }; };

  /* ---------- three ways CORE works ---------- */
  var MODELS = {
    uni: {
      tag: tr("Marketplace", "Маркетплейс", "Marketpleys"),
      name: tr("A university's own data", "Данные вуза", "Universitet maʼlumotlari"),
      line: tr("The university owns the data; CORE is the platform: catalog, contracts, payments, delivery.",
               "Данные принадлежат вузу, CORE — площадка: каталог, договоры, оплата, доставка.",
               "Maʼlumotlar universitetga tegishli, CORE — maydoncha: katalog, shartnomalar, toʻlov, yetkazib berish."),
      money: tr("University: 70% if the data is ready · 40–50% if CORE prepares it", "Вузу: 70%, если данные готовы · 40–50%, если готовит CORE", "Universitetga: maʼlumotlar tayyor boʻlsa 70% · CORE tayyorlasa 40–50%"),
      owner: tr("University", "Вуз", "Universitet"), prep: tr("University or CORE", "Вуз или CORE", "Universitet yoki CORE"),
      ex: tr("A department's field observations, a speech archive, a clinic's records", "Полевые наблюдения кафедры, архив записей речи, записи клиники", "Kafedraning dala kuzatuvlari, nutq yozuvlari arxivi, klinika yozuvlari")
    },
    core: {
      tag: tr("Provider", "Поставщик", "Yetkazib beruvchi"),
      name: tr("Data CORE builds itself", "Данные, которые готовим мы", "Biz tayyorlaydigan maʼlumotlar"),
      line: tr("CORE builds and maintains its own databases and collects data to order, with universities as paid contractors.",
               "CORE сам собирает и ведёт свои базы и собирает данные под заказ; вузы участвуют как исполнители за оплату.",
               "CORE oʻz bazalarini oʻzi yigʻadi va yuritadi, buyurtma boʻyicha maʼlumot yigʻadi; universitetlar haq evaziga ijrochi sifatida qatnashadi."),
      money: tr("Universities that run fieldwork or expert review are paid for the work", "Вузам, которые проводят опрос или экспертизу, — оплата работы", "Soʻrov yoki ekspertizani oʻtkazgan universitetlarga — ish haqi"),
      owner: tr("CORE, or the client for custom data", "CORE или заказчик (для данных под заказ)", "CORE yoki buyurtmachi (buyurtma maʼlumotlari uchun)"), prep: tr("CORE with university experts", "CORE с экспертами вузов", "CORE universitet ekspertlari bilan"),
      ex: tr("The universities registry, 48-region layer, a survey through regional universities", "Справочник вузов, слой 48 регионов, опрос через вузы регионов", "Universitetlar maʼlumotnomasi, 48 hudud qatlami, hudud universitetlari orqali soʻrov")
    },
    open: {
      tag: tr("Processor", "Обработчик", "Qayta ishlovchi"),
      name: tr("Scholars' open data", "Открытые данные учёных", "Olimlarning ochiq maʼlumotlari"),
      line: tr("Datasets scholars have already published openly; a partner university entrusts CORE with preparing them. The original stays free; we add the preparation.",
               "Наборы, которые учёные уже опубликовали открыто; вуз-партнёр поручает CORE их подготовку. Оригинал остаётся бесплатным — мы добавляем подготовку.",
               "Olimlar allaqachon ochiq eʼlon qilgan toʻplamlar; hamkor universitet ularni tayyorlashni CORE ga topshiradi. Asl nusxa bepul qoladi — biz tayyorlashni qoʻshamiz."),
      money: tr("University: a share under the partner agreement (40–50%) · authors always credited", "Вузу: доля по договору партнёрства (40–50%) · авторы всегда указаны", "Universitetga: hamkorlik shartnomasi boʻyicha ulush (40–50%) · mualliflar doimo koʻrsatiladi"),
      owner: tr("Authors and university; open licence", "Авторы и вуз; открытая лицензия", "Mualliflar va universitet; ochiq litsenziya"), prep: tr("CORE", "CORE", "CORE"),
      ex: tr("The KazNMU COVID-19 cohort, a Gulistan insurance survey, Uzbek geography terms", "Когорта COVID-19 КазНМУ, опрос о страховании из Гулистана, термины географии", "QMTU COVID-19 kogortasi, Gulistondagi sugʻurta soʻrovi, geografiya terminlari")
    }
  };

  /* ---------- five stages (model-specific where the path differs) ---------- */
  var STAGES = [
    { key: "source", icon: "01", title: tr("Source", "Источник", "Manba"),
      what: {
        uni: tr("Archives, lab and field records, texts and recordings held by a department. The university decides what may be offered.", "Архивы, записи лабораторий и экспедиций, тексты и записи кафедры. Вуз сам решает, что можно предлагать.", "Kafedra arxivlari, laboratoriya va ekspeditsiya yozuvlari, matnlar. Nimani taklif qilishni universitet oʻzi hal qiladi."),
        core: tr("Open registries and statistics, plus new data collected to order: surveys, expert answers, recordings.", "Открытые справочники и статистика, а также новые данные, собранные под заказ: опросы, ответы экспертов, записи.", "Ochiq maʼlumotnomalar va statistika, shuningdek buyurtma boʻyicha yigʻilgan yangi maʼlumotlar: soʻrovlar, ekspert javoblari, yozuvlar."),
        open: tr("Datasets the university's scholars have published on Zenodo, Mendeley Data, GBIF and others. We open each one and check there is real data inside.", "Наборы, которые учёные вуза опубликовали на Zenodo, Mendeley Data, GBIF и др. Каждый открываем и проверяем, что внутри действительно данные.", "Universitet olimlari Zenodo, Mendeley Data, GBIF va boshqalarda eʼlon qilgan toʻplamlar. Har birini ochib, ichida haqiqatan maʼlumot borligini tekshiramiz.")
      },
      out: tr("A list of candidate datasets", "Список наборов-кандидатов", "Nomzod toʻplamlar roʻyxati") },
    { key: "handover", icon: "02", title: tr("Handover", "Передача", "Topshirish"),
      what: {
        uni: tr("A staff member appointed by the university uploads the files in the university cabinet and confirms the rights. Nothing becomes visible: closed by default.", "Сотрудник, назначенный вузом, загружает файлы в кабинет вуза и подтверждает права. Ничего не становится видно: по умолчанию всё закрыто.", "Universitet tayinlagan xodim fayllarni universitet kabinetiga yuklaydi va huquqlarni tasdiqlaydi. Hech narsa koʻrinmaydi: sukut boʻyicha hammasi yopiq."),
        core: tr("A contract with the client or a university contractor: scope, sample, ethics approval, deadline.", "Договор с заказчиком или вузом-исполнителем: объём, выборка, одобрение этической комиссии, сроки.", "Buyurtmachi yoki ijrochi universitet bilan shartnoma: hajm, tanlanma, etika komissiyasi roziligi, muddatlar."),
        open: tr("The partner university confirms the list of its scholars' datasets and entrusts CORE with them; authors are notified and can object.", "Вуз-партнёр подтверждает список наборов своих учёных и поручает их CORE; авторов уведомляем, они могут возразить.", "Hamkor universitet olimlari toʻplamlari roʻyxatini tasdiqlaydi va ularni CORE ga topshiradi; mualliflar xabardor qilinadi va eʼtiroz bildirishi mumkin.")
      },
      out: tr("A signed handover with rights confirmed", "Подписанная передача с подтверждёнными правами", "Huquqlari tasdiqlangan imzolangan topshirish") },
    { key: "prepare", icon: "03", title: tr("Preparation", "Подготовка", "Tayyorlash"),
      what: {
        all: tr("Rights and personal-data check, cleaning, mapping to standards (e.g. ICD-10, ISO region codes), annotation with university experts, a datasheet and field descriptions in three languages.", "Проверка прав и личных данных, очистка, приведение к стандартам (например, МКБ-10, коды регионов ISO), разметка с экспертами вуза, паспорт набора и описание полей на трёх языках.", "Huquqlar va shaxsiy maʼlumotlarni tekshirish, tozalash, standartlarga keltirish (masalan, XKT-10, ISO hudud kodlari), universitet ekspertlari bilan belgilash, toʻplam pasporti va maydonlar tavsifi uch tilda.")
      },
      out: tr("A package: data, field descriptions, quality report, licence, Croissant metadata", "Пакет: данные, описание полей, отчёт о качестве, лицензия, метаданные Croissant", "Paket: maʼlumotlar, maydonlar tavsifi, sifat hisoboti, litsenziya, Croissant metamaʼlumotlari") },
    { key: "access", icon: "04", title: tr("Access", "Доступ", "Kirish"),
      what: {
        uni: tr("The catalog shows only the datasheet. A buyer requests access; the university approves each buyer; a licence is signed.", "В каталоге виден только паспорт. Покупатель запрашивает доступ, вуз одобряет каждого покупателя, подписывается лицензия.", "Katalogda faqat pasport koʻrinadi. Xaridor kirishni soʻraydi, universitet har bir xaridorni tasdiqlaydi, litsenziya imzolanadi."),
        core: tr("The client receives the data under the contract; CORE's own databases are sold by export or subscription.", "Заказчик получает данные по договору; собственные базы CORE продаются выгрузкой или подпиской.", "Buyurtmachi maʼlumotlarni shartnoma boʻyicha oladi; CORE ning oʻz bazalari eksport yoki obuna orqali sotiladi."),
        open: tr("The prepared version is licensed with attribution; the original remains free where its authors published it.", "Подготовленная версия лицензируется с указанием авторов; оригинал остаётся бесплатным там, где его опубликовали авторы.", "Tayyorlangan versiya mualliflar koʻrsatilgan holda litsenziyalanadi; asl nusxa mualliflar eʼlon qilgan joyda bepul qoladi.")
      },
      out: tr("API key, files (CSV, Parquet, JSONL), a private Hugging Face repo or S3", "Ключ API, файлы (CSV, Parquet, JSONL), приватный репозиторий Hugging Face или S3", "API kaliti, fayllar (CSV, Parquet, JSONL), maxfiy Hugging Face repozitoriysi yoki S3") },
    { key: "update", icon: "05", title: tr("Updates", "Обновления", "Yangilanishlar"),
      what: {
        all: tr("New records and corrections arrive as new versions with a change log. API addresses stay the same; subscribers get updates automatically. The university receives a report on who bought its data and what it earned.", "Новые записи и исправления выходят новыми версиями с журналом изменений. Адреса API не меняются, подписчики получают обновления автоматически. Вуз получает отчёт: кто купил его данные и сколько он заработал.", "Yangi yozuvlar va tuzatishlar oʻzgarishlar jurnali bilan yangi versiyalar sifatida chiqadi. API manzillari oʻzgarmaydi, obunachilar yangilanishlarni avtomatik oladi. Universitet hisobot oladi: maʼlumotlarini kim sotib oldi va qancha ishlab oldi.")
      },
      out: tr("Versions, change log, revenue report", "Версии, журнал изменений, отчёт о доходе", "Versiyalar, oʻzgarishlar jurnali, daromad hisoboti") }
  ];

  /* ---------- four viewpoints: one line per stage ---------- */
  var ROLES = {
    uni: { name: tr("University", "Вуз", "Universitet"), lines: [
      tr("You choose what to offer; nothing leaves without your decision.", "Вы выбираете, что предлагать; без вашего решения ничего не уходит.", "Nimani taklif qilishni siz tanlaysiz; qaroringizsiz hech narsa chiqmaydi."),
      tr("You appoint one person and sign the rights confirmation. Uploading costs nothing.", "Вы назначаете одного сотрудника и подписываете подтверждение прав. Загрузка бесплатна.", "Siz bitta xodimni tayinlaysiz va huquqlar tasdigʻini imzolaysiz. Yuklash bepul."),
      tr("Your experts review the annotation and are named in the datasheet.", "Ваши эксперты проверяют разметку и указаны в паспорте набора.", "Ekspertlaringiz belgilashni tekshiradi va toʻplam pasportida koʻrsatiladi."),
      tr("You approve every buyer and can stop new sales at any time.", "Вы одобряете каждого покупателя и можете в любой момент остановить новые продажи.", "Har bir xaridorni siz tasdiqlaysiz va istalgan vaqtda yangi sotuvlarni toʻxtata olasiz."),
      tr("You get a revenue report and your share; updates bring repeat income.", "Вы получаете отчёт и свою долю дохода; обновления дают повторный доход.", "Hisobot va daromad ulushingizni olasiz; yangilanishlar takroriy daromad keltiradi.")] },
    ai: { name: tr("AI company", "ИИ-компания", "SI kompaniyasi"), lines: [
      tr("Regional knowledge and local-language data that is not on the open web.", "Знания о регионе и данные на местных языках, которых нет в открытом интернете.", "Ochiq internetda yoʻq mintaqa haqidagi bilimlar va mahalliy tillardagi maʼlumotlar."),
      tr("Every dataset has a documented chain of rights from the university.", "У каждого набора — подтверждённая цепочка прав от вуза.", "Har bir toʻplamda universitetdan kelgan tasdiqlangan huquqlar zanjiri bor."),
      tr("AI-ready format: field schema, spans and IDs, Croissant metadata.", "Формат, готовый для ИИ: схема полей, разметка и ID, метаданные Croissant.", "SI uchun tayyor format: maydonlar sxemasi, belgilash va ID, Croissant metamaʼlumotlari."),
      tr("A licence for training and evaluation; API, Parquet/JSONL or a private HF repo.", "Лицензия на обучение и оценку моделей; API, Parquet/JSONL или приватный репозиторий HF.", "Modellarni oʻqitish va baholash uchun litsenziya; API, Parquet/JSONL yoki maxfiy HF repozitoriysi."),
      tr("New versions keep the same API; the change log shows what changed.", "Новые версии — по тому же API; журнал показывает, что изменилось.", "Yangi versiyalar — oʻsha API orqali; jurnal nima oʻzgarganini koʻrsatadi.")] },
    gov: { name: tr("Government", "Госорган", "Davlat idorasi"), lines: [
      tr("Data from the country's own universities, in national languages.", "Данные вузов своей страны, на национальных языках.", "Oʻz mamlakati universitetlari maʼlumotlari, milliy tillarda."),
      tr("Rights and personal data handled under national law; data stays in the country.", "Права и личные данные — по национальному закону; данные остаются в стране.", "Huquqlar va shaxsiy maʼlumotlar — milliy qonunga koʻra; maʼlumotlar mamlakatda qoladi."),
      tr("Texts and observations prepared for national corpora and data platforms.", "Тексты и наблюдения, подготовленные для национальных корпусов и платформ данных.", "Milliy korpuslar va maʼlumotlar platformalari uchun tayyorlangan matnlar va kuzatuvlar."),
      tr("Delivery under a contract or tender; aggregated data by region.", "Поставка по договору или тендеру; сводные данные по регионам.", "Shartnoma yoki tender boʻyicha yetkazib berish; hududlar boʻyicha umumlashtirilgan maʼlumotlar."),
      tr("Regular updates for monitoring programmes.", "Регулярные обновления для мониторинга программ.", "Dasturlarni monitoring qilish uchun muntazam yangilanishlar.")] },
    biz: { name: tr("Business", "Бизнес", "Biznes"), lines: [
      tr("Registries, regional data and surveys you cannot buy elsewhere in the region.", "Справочники, данные по регионам и опросы, которые в регионе больше негде купить.", "Mintaqada boshqa joyda sotib olib boʻlmaydigan maʼlumotnomalar, hududlar boʻyicha maʼlumotlar va soʻrovlar."),
      tr("A clear contract; for a survey — sample, regions and timing agreed up front.", "Понятный договор; для опроса — выборка, регионы и сроки согласуются заранее.", "Tushunarli shartnoma; soʻrov uchun — tanlanma, hududlar va muddatlar oldindan kelishiladi."),
      tr("Every record has a source and an update date; one region code across countries.", "У каждой записи — источник и дата обновления; один код региона во всех странах.", "Har bir yozuvda manba va yangilanish sanasi bor; barcha mamlakatlarda bitta hudud kodi."),
      tr("An Excel/CSV export, a subscription, an API or a ready report.", "Выгрузка в Excel/CSV, подписка, API или готовый отчёт.", "Excel/CSV eksporti, obuna, API yoki tayyor hisobot."),
      tr("Subscriptions refresh the data; you are told what changed.", "Подписка обновляет данные; вы видите, что изменилось.", "Obuna maʼlumotlarni yangilaydi; nima oʻzgarganini koʻrasiz.")] }
  };

  var UI = {
    model: tr("How the data reaches CORE", "Как данные попадают в CORE", "Maʼlumotlar CORE ga qanday keladi"),
    role: tr("Show it for", "Показать для", "Kim uchun koʻrsatish"),
    play: tr("▶ Walk the path", "▶ Пройти путь", "▶ Yoʻlni bosib oʻtish"),
    stop: tr("■ Stop", "■ Стоп", "■ Toʻxtatish"),
    what: tr("What happens", "Что происходит", "Nima sodir boʻladi"),
    out: tr("Result", "Результат", "Natija"),
    you: tr("For you", "Для вас", "Siz uchun"),
    owner: tr("Owner", "Владелец", "Egasi"), prep: tr("Who prepares", "Кто готовит", "Kim tayyorlaydi"), money: tr("Money", "Деньги", "Pul"), ex: tr("Examples", "Примеры", "Misollar")
  };

  var state = { model: "uni", role: "uni", stage: 0, timer: null };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  root.innerHTML =
    '<div class="hw-pick"><span class="hw-lbl">' + L(UI.model) + '</span><div class="hw-models" role="tablist">' +
    Object.keys(MODELS).map(function (k) { var m = MODELS[k]; return '<button role="tab" data-m="' + k + '"><span class="mono">' + L(m.tag) + "</span><b>" + L(m.name) + "</b></button>"; }).join("") +
    '</div></div><div class="hw-model card" id="hwModel"></div>' +
    '<div class="hw-pick hw-pick2"><span class="hw-lbl">' + L(UI.role) + '</span><div class="seg" id="hwRoles">' +
    Object.keys(ROLES).map(function (k) { return '<button data-r="' + k + '">' + L(ROLES[k].name) + "</button>"; }).join("") +
    '</div><button class="btn btn-ghost btn-sm" id="hwPlay">' + L(UI.play) + "</button></div>" +
    '<ol class="hw-path" id="hwPath">' + STAGES.map(function (s, i) { return '<li><button data-s="' + i + '"><span class="hw-n mono">' + s.icon + "</span><b>" + L(s.title) + '</b></button></li>'; }).join("") + "</ol>" +
    '<div class="hw-stage card" id="hwStage" aria-live="polite"></div>';

  function render() {
    var m = MODELS[state.model], s = STAGES[state.stage], r = ROLES[state.role];
    Array.prototype.forEach.call(root.querySelectorAll("[data-m]"), function (b) { b.classList.toggle("on", b.getAttribute("data-m") === state.model); b.setAttribute("aria-selected", b.getAttribute("data-m") === state.model); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-r]"), function (b) { b.classList.toggle("on", b.getAttribute("data-r") === state.role); });
    Array.prototype.forEach.call(root.querySelectorAll("[data-s]"), function (b, i) { b.parentNode.classList.toggle("on", i === state.stage); b.parentNode.classList.toggle("done", i < state.stage); });
    document.getElementById("hwModel").innerHTML = '<p class="hw-line">' + L(m.line) + '</p><dl class="hw-facts">' +
      [[UI.owner, m.owner], [UI.prep, m.prep], [UI.money, m.money], [UI.ex, m.ex]].map(function (x) { return "<div><dt>" + L(x[0]) + "</dt><dd>" + L(x[1]) + "</dd></div>"; }).join("") + "</dl>";
    var what = s.what[state.model] || s.what.all;
    document.getElementById("hwStage").innerHTML = '<span class="hw-n mono">' + s.icon + " · " + L(s.title) + "</span>" +
      '<div class="hw-cols"><div><span class="hw-k">' + L(UI.what) + "</span><p>" + esc(L(what)) + '</p><span class="hw-k">' + L(UI.out) + '</span><p class="hw-out">' + esc(L(s.out)) + "</p></div>" +
      '<div class="hw-you"><span class="hw-k">' + L(UI.you) + " · " + L(r.name) + "</span><p>" + esc(L(r.lines[state.stage])) + "</p></div></div>";
  }
  function stop() { if (state.timer) { clearInterval(state.timer); state.timer = null; } document.getElementById("hwPlay").textContent = L(UI.play); }
  root.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-m")) { state.model = b.getAttribute("data-m"); state.stage = 0; }
    else if (b.hasAttribute("data-r")) state.role = b.getAttribute("data-r");
    else if (b.hasAttribute("data-s")) { stop(); state.stage = +b.getAttribute("data-s"); }
    else if (b.id === "hwPlay") {
      if (state.timer) { stop(); return; }
      state.stage = 0; b.textContent = L(UI.stop);
      state.timer = setInterval(function () { if (state.stage >= STAGES.length - 1) { stop(); return; } state.stage++; render(); }, 2600);
    }
    render();
  });
  var q = new URLSearchParams(location.search);
  if (MODELS[q.get("model")]) state.model = q.get("model");
  if (ROLES[q.get("role")]) state.role = q.get("role");
  render();
})();
