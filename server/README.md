# Server scaffold for saitheinhtay.github.io

This server provides:
- Encrypted storage of exchange API credentials (server-side)
- Admin UI to manage accounts and toggle agent mode (`admin.html`)
- Sync endpoint to fetch balances from exchanges (`/api/sync`)
- Worker (`worker.js`) to run scheduled syncs when agent mode is enabled

## Quick start (local)

1. Install dependencies

```bash
cd server
npm install
```

2. Create a `.env` in `server/` with these values:

```
ADMIN_USER=admin
ADMIN_PASS=password
SERVER_SECRET=some_long_secret_here
AGENT_CRON=0 */30 * * * *   # every 30 minutes (cron with seconds)
```

3. Start the server

```bash
npm start
```

4. In another terminal start the worker (optional)

```bash
npm run worker
```

5. Open admin UI in browser:

```
http://localhost:3000/admin.html
```

Use the admin username/password from `.env` for the simple session auth.

## Deploy to Railway
1. Create a Railway project and connect this repository.
2. Set the `Root Directory` of the service to `server`.
3. Add Environment Variables in Railway Dashboard: `ADMIN_USER`, `ADMIN_PASS`, `SERVER_SECRET`, `AGENT_CRON`.
4. Set `Start Command` to `npm start`.
5. (Optional) Create a second Railway service for the worker and run `npm run worker` or use Railway Schedules to POST `/api/sync`.

## Notes & Security
- This scaffold stores API secrets encrypted using `SERVER_SECRET`. Keep `SERVER_SECRET` safe.
- Do NOT commit real API keys to GitHub. Use Environment Variables or add accounts via admin UI after deployment.
- Implement proper authentication in production (JWT/OAuth/Password hashing) — current admin auth is intentionally minimal for quick setup.

## Exchange implementations
- Binance balances implemented as an example.
- Bybit and MEXC handlers are stubs — implement exchange-specific signed requests in `index.js`'s `fetchBalancesForAccount`.

## Next Steps
- Add robust authentication (hash stored password, login sessions)
- Implement per-exchange signed requests (Bybit, MEXC)
- Implement rate-limiting and request caching
- Add optional DB (Postgres) for persistence
