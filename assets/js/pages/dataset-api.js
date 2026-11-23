import { TABLE, EXAMPLES } from "../api/demo-data.js";
import { apiBase, fetchDatasetRows } from "../api/datasets.js";
import { loadDuck, ensureTable, isDuckLoaded } from "../api/sql.js";
import { esc, nf, toast } from "../ui/format.js";
export function createDatasetApi({ store, myReq }) {
  function apiKey(r) {
    var s = r.id + "|" + r.org, h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return "core_demo_" + (h >>> 0).toString(16) + r.id.replace(/\D/g, "");
  }

  function apiSection(d) {
    var S = store.s;
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
      fetchDatasetRows(d.slug, apiKey(myReq(d.slug))).then(function (j) {
        var shown = { dataset: j.dataset, page: j.page, pages: j.pages, rows_total: j.rows_total, rows: j.rows.slice(0, 2), "…": (j.rows.length - 2) + " more rows on this page" };
        out.textContent = JSON.stringify(shown, null, 2); out.hidden = false;
        note.textContent = "200 OK · " + Math.round(performance.now() - t0) + " мс · " + j.rows.length + " строк на странице";
      }).catch(function () { note.textContent = "Не удалось выполнить запрос"; });
    };
    var ex = EXAMPLES[d.slug] || [];
    Array.prototype.forEach.call(sec.querySelectorAll("[data-ex]"), function (b) { b.onclick = function () { document.getElementById("sql").value = ex[+b.getAttribute("data-ex")][1]; }; });
    document.getElementById("runSql").onclick = function () {
      var note = document.getElementById("sqlNote"), out = document.getElementById("sqlOut"), btn = this, sql = document.getElementById("sql").value;
      btn.disabled = true; note.textContent = isDuckLoaded() ? "Выполняю…" : "Загружаю движок запросов (один раз, ~7 МБ)…";
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

  return { apiSection, wireApi };
}
