# ProPoisk Premium

Полноценный MVP-проект для GitHub: поисковая система в стиле **ya.ru** с выдачей через **DuckDuckGo API**, mini-app модальными окнами, профилем, PIN-защитой, инкогнито, подпиской One Premium, Oink Stars и реферальной системой.

## Стек
- **HTML + CSS + JavaScript** (frontend)
- **Node.js + Express** (backend API и хранение данных в JSON)

## Функции
- Поиск / Картинки / Видео через DuckDuckGo (`Instant Answer`, `i.js`, `v.js`)
- Встроенное открытие сайтов/видео/сервисов в модальном окне (как mini app)
- Меню сервисов в стиле экосистемы (легко расширяется через `public/services.json`)
- Профиль OINK ID с аватаром, именем и историей запросов
- Режим инкогнито с PIN-подтверждением
- Реферальная программа:
  - создание кампании (компания/игра/приложение)
  - генерация ссылки
  - одноразовая активация ссылки
  - награды и 14 дней One Premium
- Oink Stars:
  - ежедневный бонус +10 (по МСК)
  - покупка One Premium на 30 дней за 15000
- Документы: FAQ, Политика, Условия, лендинг OINK ID
- Баннер cookies при первом запуске
- Голосовой ввод (Web Speech API без ключей)

## Быстрый старт
```bash
npm install
npm start
```

Откройте: `http://localhost:3000`

## Структура
- `server.js` — backend/API
- `public/index.html` — интерфейс поиска
- `public/styles.css` — стили
- `public/app.js` — логика клиента
- `public/services.json` — конфиг сервисов меню
- `public/docs/*` — FAQ/Privacy/Terms
- `public/oink-id.html` — лендинг OINK ID
- `data/store.json` — простое хранилище

## Добавление сервисов
Отредактируйте `public/services.json`:
```json
{
  "id": "new-service",
  "title": "Новый сервис",
  "url": "https://example.com",
  "premium": true,
  "description": "Описание"
}
```


## Деплой
- **Vercel + custom domain `relaxdev.ru`**: см. `DEPLOY.md`
- **Render**: поддерживается через `render.yaml`
- **Railway/Heroku**: поддерживается через `Procfile`
- **Любая платформа с Docker**: готов `Dockerfile`

## Production notes
Для продакшена рекомендуется:
- перейти с JSON-хранилища на PostgreSQL/Redis,
- хешировать PIN через bcrypt,
- добавить JWT/сессии, rate-limit, captcha для анти-абуза,
- использовать очередь и отдельные воркеры,
- вынести метрики и логи (Grafana/ELK),
- добавить интеграционные тесты.
