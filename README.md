# Giotto NFC Platform

Next.js 14 приложение для гостя, официанта и менеджера с server-first BFF для waiter flows.

## Что реализовано в waiter v1
- Полный цикл официанта: вызов гостя -> `Принято — иду` -> `Добавить в счёт` -> `Все обслужил`.
- Синхронизация с гостем в realtime (SSE): вызовы, добавления в счёт, запрос отзыва.
- Гостевой cooldown (120с) перенесён на сервер.
- Отзыв гостя после `Все обслужил`: модалка на гостевом экране, автоскрытие 60с, сохранение в state.
- BFF-архитектура с fallback:
  - Remote beta adapter (`GIOTTO_BETA_SERVER_URL`)
  - Demo adapter (локальный state)

## Запуск
```bash
npm install
npm run dev
```

Сайт: `http://localhost:3000`

## Environment
- `GIOTTO_BETA_SERVER_URL` (default: `http://localhost:3000`)
- `GIOTTO_FORCE_DEMO_BACKEND=1` — принудительно использовать локальный demo backend
- `GIOTTO_DEMO_JWT_SECRET` — секрет подписи demo JWT
- `GIOTTO_FIREBASE_SERVICE_ACCOUNT_JSON` — Firebase service account JSON для direct FCM доставки waiter push на Android

Примечание: логины/пароли официантов и менеджеров хранятся в `hall` state (DB слой), а не в env.

## Push notifications
- Waiter Android push отправляются напрямую через Firebase Cloud Messaging, а не через Expo Push Service.
- Мобильное приложение регистрирует native FCM token через `getDevicePushTokenAsync()`.
- Старые Expo-токены остаются временным fallback только для ещё не обновлённых устройств.

## Основные маршруты
- Гость:
  - `/table/<id>`
  - `/table/<id>/menu`
  - `/table/<id>/cart`
  - `/table/<id>/waiter`
  - `/table/<id>/complaint`
- Персонал:
  - `/login`
  - `/waiter`
  - `/waiter/tables/<id>`
  - `/waiter/tables/<id>/add-order`
  - `/manager`

## API и контракты
Полная документация BFF-контрактов, realtime-событий и fallback-поведения:
- [docs/waiter-bff.md](./docs/waiter-bff.md)

## Сборка
```bash
npm run build
npm run start
```
