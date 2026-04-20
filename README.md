# ProPoisk Premium

Полноценное статическое приложение (HTML/CSS/JS) в стиле ya.ru:
- поиск с интеграцией DuckDuckGo API,
- вкладки Поиск / Картинки / Видео,
- меню сервисов (расширяется через `services.json`),
- mini-app модальные окна для сайтов/сервисов/видео,
- профиль OINK ID (аватар, имя, история),
- PIN-защита и режим инкогнито,
- One Premium + Oink Stars,
- реферальная система с одноразовой активацией,
- docs: FAQ / Политика / Условия,
- лендинг OINK ID,
- готовность к деплою на Vercel и другие платформы статики.

## Стек
- HTML
- CSS
- JavaScript (без backend)
- localStorage для хранения данных профиля

## Запуск локально
Откройте `index.html` в браузере
или запустите локальный сервер:

```bash
python3 -m http.server 8080
```

## Структура
- `index.html` — основной интерфейс
- `styles.css` — стили
- `app.js` — логика приложения
- `services.json` — конфиг сервисов
- `docs/faq.html` — FAQ
- `docs/policy.html` — политика
- `docs/terms.html` — условия
- `oink-id.html` — лендинг OINK ID

## Добавление сервисов
Отредактируйте `services.json`:

```json
{
  "id": "new-service",
  "title": "Новый сервис",
  "url": "https://example.com",
  "premium": true,
  "description": "Описание"
}
```

## Важно
- В статическом режиме часть внешних сайтов может блокировать iframe (X-Frame-Options/CSP).
- DuckDuckGo Instant Answer API отдает ограниченный формат результатов.
- Данные аккаунта и PIN хранятся только локально в браузере пользователя.
