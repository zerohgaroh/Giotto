# Giotto — гость за столом

Next.js 14: хаб стола после NFC, меню с корзиной, вызов официанта с таймером, жалоба, Wi-Fi (демо).

## Запуск

```bash
npm install
npm run dev
```

- Сайт: **`http://localhost:3000`** — обязательно с портом **`:3000`**. Только `http://localhost` без порта часто открывает не Next -> «голый» HTML без Tailwind.
- Демо-стол: `http://localhost:3000/table/demo` (замените `demo` на номер стола из NFC)

## Маршруты

| Путь | Экран |
|------|--------|
| `/table/<id>` | Хаб: меню, вызов, жалоба, счет, Wi-Fi |
| `/table/<id>/menu` | Меню + нижняя панель «Корзина» / «Вызов» |
| `/table/<id>/cart` | Корзина |
| `/table/<id>/waiter` | Таймер вызова (`?intent=bill` — счет) |
| `/table/<id>/complaint` | Жалоба |

## Сборка

```bash
npm run build && npm run start
```
