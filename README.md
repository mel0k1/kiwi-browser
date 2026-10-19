<div align="center">

# 🥝 Kiwi Browser

**Браузер на базе Firefox, который подстраивается под вас — а не наоборот.**

Форк [Zen Browser](https://github.com/zen-browser/desktop) с фокусом на глубокую кастомизацию интерфейса.

[![License: MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-green.svg)](https://www.mozilla.org/MPL/2.0/)
[![Engine](https://img.shields.io/badge/engine-Gecko%20·%20Firefox%20158-blue)](https://www.mozilla.org/firefox/)
[![Upstream](https://img.shields.io/badge/upstream-Zen%20Browser-8b5cf6)](https://github.com/zen-browser/desktop)
[![Builds](https://img.shields.io/badge/builds-Releases-orange)](../../releases)

</div>

## 🎯 Зачем нужен Kiwi

Zen Browser уже задал высокую планку среди продуктивных Firefox-браузеров. Kiwi идёт дальше: меньше догм в интерфейсе, больше настроек. Положение, размер и поведение ключевых элементов оболочки должны решать вы, а не разработчик. Мы не стремимся переписать всё — мы аккуратно развиваем то, что уже работает.

## 🗺️ Дорожная карта

- **Кастомизация боковой панели** — расположение сверху / снизу / слева / справа переключается прямо в настройках браузера
- **Расширенная кастомизация UI** — панели, отступы, поведение элементов интерфейса
- **Своё — по делу** — только функции, которые реально улучшают повседневную работу

## 📦 Установка

Проект в начале пути. Первые сборки появятся в разделе [Releases](../../releases).

## 🛠️ Сборка из исходников

Kiwi использует конвейер Zen: утилита `surfer` скачивает исходники Firefox, импортирует наши изменения в дерево `engine/` и собирает браузер через `mach`.

Требования: Linux, macOS или Windows · Node.js · Python 3 · Rust · ~40 ГБ на диске.

```bash
git clone https://github.com/mel0k1/kiwi-browser.git
cd kiwi-browser
npm install
npm run init      # скачать Firefox, импортировать изменения, bootstrap
npm run build     # сборка браузера
npm start         # запуск собранного браузера
```

Подробности о конвейере сборки — в [docs](./docs) и [документации Zen](https://docs.zen-browser.app).

## 🌿 Ветки

| Ветка    | Назначение                                        |
| -------- | ------------------------------------------------- |
| `dev`    | Основная разработка (как Twilight у Zen)          |
| `stable` | Релизная ветка, унаследована от Zen               |

## 📄 Лицензия

[MPL-2.0](./LICENSE). Kiwi — форк Zen Browser, построенного на движке Mozilla Firefox.
