# CORE MCP — вузы и учёные Центральной Азии для любого ИИ-агента

Публичный MCP-сервер CORE. Любой агент (Claude, ChatGPT, Cursor, ассистент абитуриента) подключает
один URL и получает инструменты:

| Инструмент | Что делает | Источник |
|---|---|---|
| `search_universities` | Ищет вуз по любому названию, аббревиатуре, городу, сайту или ID на любом языке: `СамГУ`, `SamDU`, `Самаркандский госуниверситет`, `НУУз`, `КазНУ`, `nuu.uz`. Если совпадение однозначное, сразу отдаёт полный профиль в `best_match` | реестр CORE + OpenAlex |
| `get_university` | Профиль вуза: названия на всех языках, страна, город, сайт, год основания, ROR, Wikidata, OpenAlex, публикации по годам, направления исследований, ведущие исследователи, датасеты в каталоге CORE | реестр CORE + OpenAlex |
| `search_researchers` | Учёные вузов UZ, KZ, KG, TJ по имени (кириллица или латиница: `Алексеев`). Можно ограничить вузом (`university: "СамГУ"`) | OpenAlex |
| `get_researcher` | Аффилиации с ID CORE, темы, метрики, самые цитируемые и новые работы, частые соавторы | OpenAlex + Semantic Scholar |
| `search_works` | Публикации вузов региона по теме, по вузу и с указанного года | OpenAlex + Semantic Scholar |
| `search_datasets` / `get_dataset` | Каталог CORE и открытые датасеты учёных ЦА: лицензия, поля, образец, ссылки | каталог CORE |

Так инструменты соответствуют карточкам на `agents.html`: University directory — это первые два,
Research and relationship search — `search_researchers`, `get_researcher` и `search_works`,
Dataset inspection — `search_datasets` и `get_dataset`.

## Откуда данные

- **Вузы и каталог** сервер читает из статического API сайта `https://coredata.uz/api/v0/`
  (`universities.json`, `public-catalog.json`, `research-datasets.json`, `catalog.json`) и держит
  их в памяти один час. Достаточно пересобрать и выложить сайт: сервер подхватит новые данные
  сам, передеплой не нужен.
- **Дополнительные названия** (до 7 языков, исторические названия, домены, связи вузов, число
  студентов) лежат в `supabase/functions/core-mcp/names.json`. Файл собран из core-hub
  (`universities.jsonl`), в нём только публичные поля. Обновить файл:
  `python3 -I mcp/tools/build_names.py ../capubs/db/universities/processed/universities.jsonl`.
- **Разговорные аббревиатуры**, которых нет в реестре (СамГУ, НУУз, ТашГТУ, КБТУ…), лежат
  в `supabase/functions/core-mcp/aliases.json`. Остальные поиск строит сам из названий: из
  «Самаркандский государственный университет» он получает `СГУ` и `СамГУ`, из «Samarqand Davlat
  Universiteti» — `SamDU`.
- **Учёные, работы и свежая статистика вузов** приходят из живого [OpenAlex API](https://docs.openalex.org)
  (CC0). Сервер ничего из этого не хранит. Если задан `OPENALEX_API_KEY`, ключ уходит
  в заголовке `Authorization`, а не в URL.
- **Пересказы статей** берутся из [Semantic Scholar](https://api.semanticscholar.org), если задан
  `SEMANTIC_SCHOLAR_API_KEY`. Сервер ищет работы из OpenAlex в Semantic Scholar по DOI и добавляет
  к ним `tldr` (суть работы одним предложением), `abstract` (до 600 символов) и
  `influential_citations`. Ключ уходит в заголовке `x-api-key`. Без ключа эти поля просто
  не появляются: общий лимит Semantic Scholar почти всегда отвечает 429. Если Semantic Scholar
  не ответил, инструмент всё равно отвечает, только без этих полей. Поиск учёных и привязка
  к вузам остаются на OpenAlex: в Semantic Scholar аффилиации заполнены редко.

**Факультетов и направлений подготовки в данных CORE пока нет.** Инструмент честно возвращает
`faculties: null` и пояснение. Как замену он отдаёт `research_areas`, то есть темы OpenAlex
по публикациям вуза. Откуда взять настоящие списки, см. «Что дальше».

## Запуск локально

Нужен Node 22+. Зависимостей нет, `npm install` не требуется.

```bash
cd mcp
npm start                 # http://localhost:8787/mcp, данные с coredata.uz
npm run start:local       # то же, но вузы и каталог из ../api/v0 этого репозитория
node server.mjs --stdio   # stdio-транспорт для клиентов, которые запускают команду
```

Тесты: офлайн-тесты подменяют OpenAlex, живой тест обращается к настоящему.

```bash
npm test                  # поиск (СамГУ, НУУз, КазНУ…), протокол MCP, все инструменты, HTTP-сервер
npm run test:live         # плюс живой OpenAlex: СамГУ и «Алексеев»
SEMANTIC_SCHOLAR_API_KEY=... npm run test:live   # плюс живой Semantic Scholar
```

Проверка в MCP Inspector:

```bash
npx @modelcontextprotocol/inspector
```

В открывшемся окне выберите Transport **Streamable HTTP** и URL `http://localhost:8787/mcp`,
нажмите Connect, затем откройте Tools.

## Развёртывание: Supabase Edge Function

**Почему Supabase.** Проект Supabase (`jjwzntypllcumagzbdcn`) у CORE уже есть. Функция
развёртывается одной командой: без своего сервера, без нового аккаунта и без новой оплаты
(в бесплатном тарифе 500 тыс. вызовов в месяц). Сервер stateless: каждый POST — один ответ
JSON. Поэтому ему подходит бессерверная функция, которая просыпается на запрос. Cloudflare
Worker подошёл бы так же, но для него нужен ещё один аккаунт и ещё одно место для секретов.
Код написан на стандартных Web API (`Request` → `Response`), поэтому перенос на Worker займёт
пару строк.

```bash
# один раз
brew install supabase/tap/supabase
supabase login

# из корня репозитория
supabase functions deploy core-mcp --project-ref jjwzntypllcumagzbdcn --workdir mcp --no-verify-jwt

# ключ Semantic Scholar: пересказы и аннотации статей
supabase secrets set SEMANTIC_SCHOLAR_API_KEY=... --project-ref jjwzntypllcumagzbdcn

# по желанию: ключ OpenAlex (больше лимит запросов)
supabase secrets set OPENALEX_API_KEY=... --project-ref jjwzntypllcumagzbdcn
```

`--workdir mcp` нужен, чтобы CLI взял функцию из `mcp/supabase/functions/core-mcp/`. Миграции
сайта в `supabase/` эта команда не трогает. `--no-verify-jwt` (и `verify_jwt = false`
в `mcp/supabase/config.toml`) делает сервер публичным, чтобы клиентам не нужен был ключ Supabase.

URL сервера после деплоя:

```
https://jjwzntypllcumagzbdcn.supabase.co/functions/v1/core-mcp
```

Проверка:

```bash
curl -s https://jjwzntypllcumagzbdcn.supabase.co/functions/v1/core-mcp
```

```bash
curl -s -X POST https://jjwzntypllcumagzbdcn.supabase.co/functions/v1/core-mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_universities","arguments":{"query":"СамГУ"}}}'
```

Переменные окружения, все необязательные: `SEMANTIC_SCHOLAR_API_KEY`, `OPENALEX_API_KEY`, `OPENALEX_MAILTO`, `CORE_DATA_URL`
(по умолчанию `https://coredata.uz/api/v0/`).

Красивый адрес вроде `mcp.coredata.uz` даёт Custom Domain в Supabase (платная опция).
Бесплатный вариант — прокси на Cloudflare перед этим URL.

## Подключение

**Claude Code**

```bash
claude mcp add --transport http core https://jjwzntypllcumagzbdcn.supabase.co/functions/v1/core-mcp
```

**Claude Desktop и claude.ai.** Settings → Connectors → Add custom connector, URL выше.
Если Desktop поддерживает только локальные серверы, используйте `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "core": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://jjwzntypllcumagzbdcn.supabase.co/functions/v1/core-mcp"]
    }
  }
}
```

**Любой MCP-клиент** (Cursor, VS Code, OpenAI Agents SDK, LangChain и т. д.): транспорт
Streamable HTTP, URL выше, без авторизации. В Cursor и VS Code это запись `"url": "…"` в конфиге
MCP. В Python SDK — `streamablehttp_client(URL)`.

**Без MCP:** обычный POST JSON-RPC, как в примере с `curl` выше.

## Устройство

```
mcp/
  server.mjs                         локальный запуск: HTTP или --stdio (Node)
  supabase/config.toml               конфиг только для этой функции
  supabase/functions/core-mcp/
    index.ts                         точка входа Supabase (Deno.serve)
    mcp.js                           MCP Streamable HTTP: initialize, tools/list, tools/call, ping
    tools.js                         инструменты и описания для агентов
    search.js                        поиск вузов: нормализация, транслитерация, аббревиатуры
    data.js                          загрузка данных coredata.uz и кэш
    openalex.js                      клиент OpenAlex
    semanticscholar.js               пересказы и аннотации из Semantic Scholar (по DOI)
    names.json, aliases.json         дополнительные названия и аббревиатуры
  tools/build_names.py               пересборка names.json из core-hub
  test/                              node --test
```

Протокол: MCP 2025-11-25 / 2025-06-18 / 2025-03-26, транспорт Streamable HTTP без сессий.
Ответы идут как `application/json`, SSE-поток не используется (GET с `Accept: text/event-stream`
получает 405, как разрешает спецификация). Все инструменты только читают данные.

## Что дальше

- **Факультеты и направления подготовки.** В Узбекистане это перечни направлений бакалавриата
  и квоты приёма Агентства по оценке знаний (uzbmb.uz, my.gov.uz) и «Приёмная кампания» на
  сайтах вузов. В Казахстане — классификатор образовательных программ и реестр ЕПВО
  (epvo.kz), в Кыргызстане — данные Минобрнауки КР о приёме. Удобнее всего сделать отдельный датасет CORE
  с ID вузов и отдавать его тем же `get_university`.
- **Учёные из своей базы.** В `capubs` лежит SQLite с 482 тыс. работ и авторами. Можно выгрузить
  компактный индекс авторов по вузам и не зависеть от лимитов OpenAlex. Сейчас сайт намеренно
  не публикует имена авторов, поэтому сначала нужно решить, можно ли их показывать.
