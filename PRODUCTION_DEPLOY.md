# Production: Node 22 + PM2 + nginx + MariaDB 10.11

1. Установите зависимости: `npm install --omit=dev`.
2. Создайте БД `magflow` с `utf8mb4` и пользователя `@localhost`.
3. Заполните ENV по `.env.example`. Для unix-сокета задайте `DB_SOCKET`; TCP используется только если сокет не задан.
4. Запустите: `pm2 start ecosystem.config.cjs && pm2 save`.
5. nginx должен проксировать HTTPS-домен на `http://127.0.0.1:$PORT` и передавать `X-Forwarded-Proto $scheme`.

`data/db.json` содержит только `products`, `collections`, `pages`. Пользователи, сессии, заказы и заявки сохраняются только в MariaDB. При передеплое каталог можно заменить без потери заказов.

Root создаётся один раз из `ROOT_EMAIL`/`ROOT_PASSWORD`. Cookie получает `Secure` за HTTPS при `X-Forwarded-Proto: https` или `COOKIE_SECURE=true`.
