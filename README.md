# CORE — лэндинг

Статический сайт CORE: лицензированные академические данные Центральной Азии для ИИ.
Три языка с отдельными адресами: `/` (EN), `/ru/`, `/uz/`. Сборка — один скрипт на стандартном Python, без зависимостей.

Согласованная архитектура без Vue, структура папок и план подключения регистрации, кабинета и каталога к Supabase: [Архитектура CORE и переход на Supabase](docs/architecture-supabase.md).

Рабочая регистрация, организации, подтверждение пользователя и карточки первого этапа: [подключение и проверка Supabase](supabase/README.md). Публичные копии из БД обновляются через `node tools/export_public_data.mjs`, затем обычной Python-сборкой. Первые дайджесты редактируются в `data-src/digests.json`.

## Как редактировать (важно)

**Страницы правятся только в `src/`** (`index.html` — главная для всех, `universities.html` — для вузов, `developers.html` — для разработчиков ИИ: каталог, API, MCP, формат данных). Файлы `index.html`, `universities.html`, `developers.html`, папки `ru/`, `uz/`, `datasets/`, `api/`, `hf/` и `sitemap.xml` собираются автоматически: ручные правки в них пропадут.

```bash
# 1. правим src/index.html, src/universities.html или src/developers.html (английский текст в разметке, русский — в data-ru)
# 2. если добавили или изменили русскую строку — добавляем её перевод в assets/i18n-uz.js
# 3. собираем
python3 -I tools/build_site.py
# 4. коммитим всё вместе; GitHub Actions проверяет, что собранные файлы не устарели
```

Обновить данные из core-hub (нужна локальная копия core-hub):

```bash
python3 -I tools/sync_from_core_hub.py ../core-hub   # публичный снимок → data-src/
python3 -I tools/build_site.py
```

`sync_from_core_hub.py` переносит только публичные поля: без путей к файлам, ответственных, заметок, имён авторов и платных полей (телефоны, сайты и т. п. у медучреждений).

## API v0 (работает сейчас, без ключа)

| Адрес | Что отдаёт |
|---|---|
| `api/v0/index.json` | Список адресов |
| `api/v0/catalog.json` | Карточки датасетов |
| `api/v0/datasets/<slug>.json` | Карточка, поля, ссылки |
| `api/v0/datasets/<slug>/sample.json`, `sample.csv` | Открытый образец |
| `api/v0/datasets/<slug>/croissant.json` | Метаданные MLCommons Croissant 1.0 |
| `api/v0/universities.json` | Полный справочник вузов (CC0) |
| `api/v0/research-datasets.json` | 548 записей о датасетах учёных ЦА, каждая проверена: у 405 есть файлы с данными (поле `check`, без авторов) |

Страницы датасетов `datasets/<slug>.html` содержат разметку schema.org/Dataset — для Google Dataset Search.

## Hugging Face

В `hf/` лежат два готовых пакета с карточками: `core-ca-universities` и `core-ca-research-datasets`. Загрузить:

```bash
pip install -U huggingface_hub
huggingface-cli login
huggingface-cli upload <org>/core-ca-universities hf/core-ca-universities . --repo-type dataset
huggingface-cli upload <org>/core-ca-research-datasets hf/core-ca-research-datasets . --repo-type dataset
```

## Структура

| Путь | Что это |
|---|---|
| `src/index.html` | Исходник главной. Английский текст в разметке, русский в атрибутах `data-ru` |
| `src/universities.html` | Исходник страницы для университетов |
| `data-src/` | Публичный снимок данных из core-hub — источник для API и страниц датасетов |
| `tools/build_site.py` | Сборка: языковые версии, страницы датасетов, API, Croissant, пакеты HF, sitemap |
| `privacy.html` | Политика конфиденциальности (нужна, потому что форма собирает персональные данные) |
| `assets/styles.css` | Дизайн: токены в `:root`, адаптив от 375 px |
| `assets/app.js` | i18n, карта на canvas, таблицы каталога, график, калькулятор, форма |
| `assets/data.js` | Выжимка данных из core-hub (генерируется, руками не правим) |
| `assets/geo.js` | Границы стран ЦА, Natural Earth через world-atlas (генерируется) |
| `assets/config.js` | **Заполнить перед запуском:** адрес приёма заявок и email |
| `tools/` | Скрипты пересборки `data.js` и `geo.js` |

## Перед запуском

1. Заявки уходят через FormSubmit на `pavel.alekseev.gasu@gmail.com` (`assets/config.js`). Первая отправка с сайта присылает на этот ящик письмо активации: один раз нажать в нём «Activate Form». До активации заявки не доставляются.
2. Проверить цены и модельные условия для вузов (70% вузу, не менее 30% его доли авторам) в `index.html`.
3. Показать `privacy.html` юристу и после регистрации ООО вписать юрлицо.
4. В `assets/config.js`: `telegram` — имя аккаунта или канала (кнопки Telegram появятся сами), `plausibleDomain` — домен в Plausible для аналитики.
5. Строка статуса под заголовком (`index.html`, класс `status-line`) — обновлять при каждом заметном шаге: меморандум, первый клиент, выход бенчмарка.
6. Картинка для соцсетей `assets/og.png` пересобирается командой `python3 -I tools/build_og.py assets/geo.js assets/data.js assets/og.png`. При переезде на свой домен поменять адреса в `og:url`, `og:image`, `canonical` и `sitemap.xml`.

## Локальный просмотр

```bash
python3 -m http.server 8765
```

## Размещение

Скопировать файлы папки на любой статический хостинг (nginx/Apache, shared-хостинг, Cloudflare Pages, Netlify). Серверный код не нужен.

## Пересборка данных из core-hub

```bash
python3 tools/build_data.py <core-hub>/db/datasets "<путь>/CORE — настоящие датасеты вузов ЦА (отбор).xlsx" assets/data.js
python3 tools/build_geo.py countries-10m.json assets/geo.js   # https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json
# граф знаний для 3D-сцены (полная база capubs, ~8 минут)
python3 -I tools/build_graph.py <capubs>/data/ca_publications.sqlite <core-hub>/db/datasets/universities/processed/universities.jsonl "<путь>/CORE — настоящие датасеты вузов ЦА (отбор).xlsx" assets/graph.js
```

## 3D-граф (CORE Graph)

`assets/graph3d.js` — сцена на three.js (подключается с jsDelivr через importmap). Слои: места → знания → соавторство → датасеты → мир. Без WebGL показывается 2D-карта.
Прямая ссылка на подграф вуза: `?uni=UNI-UZ-0138`. Её можно отправить вузу перед встречей.

В `data.js` нет имён авторов и контактов физических лиц. Атрибуция: © участники OpenStreetMap (ODbL), OpenAlex/ROR/Wikidata (CC0).

## Тон текстов

Главная и страница для вузов пишутся для человека без технического образования: что мы делаем, что нужно от вуза, что он получает.
Технические термины (API, MCP, разметка спанами, Croissant, SFT/DPO) — только на странице для разработчиков.
В русской и узбекской версиях не должно быть английского, кроме названий статей на языке оригинала и имён собственных.

## Регионы (regions.html)

`tools/build_regions.py` собирает слой регионов: 48 регионов UZ, KZ, KG, TJ по кодам ISO 3166-2, официальная демография (OCHA/UNFPA COD-PS с HDX, CC BY-IGO: UZ 2018, KZ 2023, KG 2018, TJ 2019), вузы (по координатам и границам geoBoundaries ADM1, ODbL; регионы, созданные после 2017 года, — по городу), научные работы, наборы учёных, медучреждения UZ и опросы, подготовленные CORE. Результат: `data-src/regions.json`, `assets/regions.js`, API `api/v0/regions.json` и `regions.csv`.

```bash
python3 -I tools/build_regions.py <папка с CSV COD-PS> <папка с geoBoundaries ADM1 GeoJSON>
```

## Каталог (catalog.html)

`tools/build_catalog.py` собирает единый индекс `assets/catalog-index.js`: базы CORE (`data-src/catalog.json`), наборы, подготовленные CORE (`app/packages/index.json`), слой регионов (`data-src/regions.json`) и 405 проверенных открытых наборов учёных (`assets/data.js`). Запускать после обновления любого из источников, затем `tools/build_site.py`.

## Документы (documents.html)

Существующий пункт «Конфиденциальность» в меню подвала сайта и кабинета ведёт в раздел «Документы». Отдельной ссылки «Документы» под меню нет. [src/documents.html](src/documents.html) содержит указатель с лицензиями, политикой конфиденциальности и согласием, с пояснениями на английском, русском и узбекском. Полные предоставленные юридические тексты размещены на русском; их язык и статус проекта обозначены явно.

Комплект редакции 1.1 от 23 ноября 2026 года переиспользован из `C:/projects/DataLab - docs/docs/dataset-licenses/` в [data-src/documents/dataset-licenses](data-src/documents/dataset-licenses/). Общая редакция 1.2 от 24 ноября заменяет привязку к университету формулировкой «правообладатель»: одни и те же три лицензии доступны университетам и компаниям. Сохранены README, тексты формы и шаблон соглашения. Сборка не зависит от наличия соседнего проекта.

[tools/build_site.py](tools/build_site.py) преобразует четыре лицензионных документа и [типовой проект согласия](data-src/documents/personal-data-consent.md) в HTML по шаблону [src/document.html](src/document.html), сохраняет исходные тексты для скачивания и включает страницы в sitemap. Каталог `documents/` генерируется; вручную в нём ничего не редактируется. [privacy.html](privacy.html) переиспользуется, новый вариант политики не создаётся.

Три лицензии установлены в общем справочнике `licenses`; форма датасета сохраняет выбранную `license_id`, показывает пояснение и системную ссылку на полный текст. Произвольный ввод лицензии, её URL и повторных условий убран. Исходные лицензии импортированных наборов сохранены. Фиксация юридических согласий, заключение отдельных соглашений и доступ к файлам этим выбором не реализуются. Точное описание объёма и проверки приведены в [архитектурном документе](docs/architecture-supabase.md#документы-и-условия-публикации) и [инструкции Supabase](supabase/README.md).
