# Deploy: Vercel + relaxdev.ru + другие платформы

## 1) Vercel (рекомендуется)

1. Импортируйте репозиторий в Vercel.
2. Framework preset: **Other**.
3. Build Command: оставьте пустым.
4. Output: не нужен (приложение запускается как Node function).
5. Deploy.

`vercel.json` уже настроен: все маршруты идут в `server.js`.

### Подключить домен `relaxdev.ru`

1. Откройте проект в Vercel → **Settings → Domains**.
2. Добавьте `relaxdev.ru` и `www.relaxdev.ru`.
3. У регистратора домена добавьте DNS-записи:
   - для корня (`@`): `A 76.76.21.21`
   - для `www`: `CNAME cname.vercel-dns.com`
4. Дождитесь статуса **Valid Configuration** в Vercel.
5. Назначьте `relaxdev.ru` как Primary Domain (опционально).

## 2) Render

В репозитории добавлен `render.yaml` для автоконфигурации.

- New + → Blueprint
- Выберите этот репозиторий
- Render сам создаст web service и запустит `npm start`

## 3) Railway / Heroku

В репозитории добавлен `Procfile`:

```txt
web: npm start
```

Достаточно подключить репозиторий и выбрать Node.js deploy.

## 4) Любая платформа с Docker

Есть готовый `Dockerfile` (Node 20 Alpine):

```bash
docker build -t propoisk-premium .
docker run -p 3000:3000 propoisk-premium
```

## Важно про хранение данных

Сейчас приложение хранит данные в JSON-файле. Для serverless (включая Vercel) это временное хранилище.

- На Vercel используется `/tmp/propoisk-store.json`.
- Данные могут теряться между cold start/перезапусками.

Для production рекомендуется вынести хранилище в Postgres/Redis/Supabase.
