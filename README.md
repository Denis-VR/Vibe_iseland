<div align="center">

# 🏔 Тихая высота · Vibe Island

**Место для твоих мыслей.** Живые горные пейзажи, музыка и звуки природы для фокуса и отдыха — в браузере компьютера или Smart TV.

[**🌐 Открыть демо**](https://denis-vr.github.io/Vibe_iseland/) · [Запуск](#-запуск) · [Как устроено](#-как-устроено) · [Подробная документация](docs/DETAILS.md)

![React](https://img.shields.io/badge/React%2019-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind%204-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Node.js](https://img.shields.io/badge/Node.js%2024-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![SQLite](https://img.shields.io/badge/node%3Asqlite-003B57?style=flat-square&logo=sqlite&logoColor=white) ![Web Audio](https://img.shields.io/badge/Web%20Audio%20API-FF6F00?style=flat-square) [![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f?style=flat-square)](LICENSE)

<img src="docs/screenshots/hero.jpg" alt="Тихая высота — закат в горной долине" width="100%"/>

</div>

## ✨ Что внутри

<table>
<tr>
<td width="50%" valign="top">

### 🌄 Живая долина
Одна долина в **9 сценах**: весна, лето, осень, зима, рассвет, туман, дождь, закат, звёздная ночь. Плавные переходы между сценами, медленно плывущие облака, ночью светятся окна домиков.

</td>
<td width="50%" valign="top">

### 🌦 Реальная погода
Выбери город или своё местоположение — сцена подстроится под настоящую погоду, сезон и время суток по данным **Open-Meteo**: снег, дождь, туман, рассвет и закат.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎧 Микшер звуков
**12 каналов**: белый, розовый и коричневый шум, дождь, ливень, ветер, водопад, ручей, птицы, костёр и другие. Шумы синтезируются в Web Audio, природные звуки — полевые записи CC0.

</td>
<td width="50%" valign="top">

### 🎵 Музыка и фокус
9 встроенных композиций (36 минут) с выровненной громкостью, плейлисты, повтор и перемешивание. Крупный таймер сессии виден даже в режиме без интерфейса.

</td>
</tr>
</table>

<table>
<tr>
<td><img src="docs/screenshots/winter.jpg" alt="Зима"/></td>
<td><img src="docs/screenshots/night.jpg" alt="Звёздная ночь"/></td>
</tr>
<tr>
<td><img src="docs/screenshots/spring.jpg" alt="Весна"/></td>
<td><img src="docs/screenshots/fog.jpg" alt="Туман"/></td>
</tr>
</table>

📺 **Работает на телевизоре**: управление стрелками, Enter и Back — запусти сервер на компьютере и открой сайт в браузере Smart TV в той же сети.

## 🚀 Запуск

Нужен **Node.js 24+**.

```sh
npm ci
npm run build
npm start          # http://localhost:4173
```

Для разработки — `npm run dev` (порт 5173). Для телевизора в домашней сети — `HOST=0.0.0.0 npm start` и открыть `http://IP-КОМПЬЮТЕРА:4173`.

## GitHub Pages

Workflow `.github/workflows/pages.yml` собирает сайт для адреса проекта `https://denis-vr.github.io/Vibe_iseland/` и публикует папку `dist-local` после push в `main`. В настройках репозитория выбери **Settings → Pages → Build and deployment → Source: GitHub Actions**.

На Pages доступны сцены, встроенная музыка, звуковой микшер, таймер и локальные плейлисты (сохраняются только в браузере). Серверные функции, включая загрузку своих треков и общую библиотеку, требуют серверной версии.

## 🧩 Как устроено

```mermaid
flowchart LR
    UI[React UI<br/>сцены и микшер] -->|canvas| L[Переходы<br/>и освещение]
    UI -->|Web Audio| A[Синтез шумов<br/>+ записи CC0]
    UI -->|HTTP| S[Node.js сервер]
    S --> DB[(node:sqlite<br/>плейлисты, статистика)]
    S --> FS[Аудио]
    UI -->|погода| OM[Open-Meteo]
```

| Файл | Что делает |
|---|---|
| [`app/landscape.tsx`](app/landscape.tsx) | Переходы между сценами, облачные слои |
| [`app/noise-engine.ts`](app/noise-engine.ts) | Движок звука на Web Audio API |
| [`app/world.ts`](app/world.ts) | Порядок погоды, сезоны и освещение |
| [`server/index.mjs`](server/index.mjs) | Самостоятельный HTTP-сервер без фреймворков: SQLite, Range-запросы, защита Origin |

- **Без внешних зависимостей во время работы**: музыка лежит вместе с сайтом, пейзажи рисуются кодом, сервер — чистый `node:http`.
- **Приватность**: геопозиция запрашивается только по нажатию, на погодный сервис уходит центр ближайшего города, а не точные координаты.
- **Громкость**: все треки выровнены двухпроходным FFmpeg loudnorm до −21 LUFS.

## ✅ Проверки

```sh
npx tsc --noEmit
npm run lint
node --experimental-strip-types --test tests/world.test.ts tests/noise.test.ts tests/noise-engine.test.ts tests/local-server.test.mjs
```

Серверные тесты работают на временных SQLite-базах: пароль, запрет чужого Origin, конфликт ревизий, Range/HEAD, восстановление после перезапуска.

## 📄 Лицензия

Код распространяется по лицензии [MIT](LICENSE). Сторонние файлы сохраняют свои лицензии: [shadcn/ui](vendor/shadcn-tailwind-4.13.0.LICENSE.md), [плагин сборки](build/sites-vite-plugin.LICENSE), звуки — см. [SOURCES.md](public/audio/SOURCES.md).

## 📚 Дальше

- [Подробная документация](docs/DETAILS.md) — перенос на сервер, погода, таймер, статистика посещений
- [Развёртывание: nginx, systemd, HTTPS](deploy/README.md)
- [Источники звуков](public/audio/SOURCES.md)

---

<div align="center">

Сделал [Денис Рябчиков](https://github.com/Denis-VR) · если проект понравился — поставь ⭐

</div>
