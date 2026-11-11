# CORE — лэндинг

Статический лэндинг CORE: лицензированные академические данные Центральной Азии для ИИ.
Без сборки: чистые HTML, CSS и JS. Три языка: EN, RU, UZ (латиница). Язык берётся из браузера, из параметра `?lang=en|ru|uz` или из переключателя на странице.

Узбекский перевод лежит в `assets/i18n-uz.js`: это словарь «русская строка → узбекская». Если поменяли русский текст в `index.html`, поправьте и ключ в словаре, иначе строка покажется по-русски.

## Структура

| Путь | Что это |
|---|---|
| `index.html` | Весь лэндинг. Английский текст в разметке, русский в атрибутах `data-ru` |
| `universities.html` | Страница для университетов: условия, кабинет, юридический путь, калькулятор, форма |
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
python3 tools/build_geo.py countries-50m.json assets/geo.js   # https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json
# граф знаний для 3D-сцены (полная база capubs, ~8 минут)
python3 -I tools/build_graph.py <capubs>/data/ca_publications.sqlite <core-hub>/db/datasets/universities/processed/universities.jsonl "<путь>/CORE — настоящие датасеты вузов ЦА (отбор).xlsx" assets/graph.js
```

## 3D-граф (CORE Graph)

`assets/graph3d.js` — сцена на three.js (подключается с jsDelivr через importmap). Слои: места → знания → соавторство → датасеты → мир. Без WebGL показывается 2D-карта.
Прямая ссылка на подграф вуза: `?uni=UNI-UZ-0138`. Её можно отправить вузу перед встречей.

В `data.js` нет имён авторов и контактов физических лиц. Атрибуция: © участники OpenStreetMap (ODbL), OpenAlex/ROR/Wikidata (CC0).
