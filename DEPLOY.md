# Deploy для статического ProPoisk Premium

## Vercel
1. Импортируйте репозиторий в Vercel.
2. Выберите preset: **Other**.
3. Build command: пусто.
4. Output directory: `.`
5. Deploy.

## relaxdev.ru (или любой хостинг статики)
- Загрузите все файлы проекта в корень сайта.
- Точка входа: `index.html`.

## Netlify / Cloudflare Pages / GitHub Pages
- Deploy from Git.
- Build command не нужен.
- Publish directory: корень репозитория.

## Локальная проверка
```bash
python3 -m http.server 8080
```
Откройте: `http://localhost:8080`
