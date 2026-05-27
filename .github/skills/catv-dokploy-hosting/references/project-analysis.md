# CATV project analysis for Dokploy hosting

Scope: `/var/www/hybrid-stack/catv`

## Stack summary

- Frontend: React 19 + Vite 8 + React Router 7
- Backend: Node.js + Express
- ORM: Prisma
- Database: MariaDB / MySQL (`provider = "mysql"`)
- Auth: JWT + bcryptjs
- Background jobs: `node-cron` inside backend process
- Mobile app: Android app exists, but it is not required for hosting the web stack on Dokploy

## Important repo structure

- `package.json` → frontend build scripts (`dev`, `build`, `preview`)
- `server/package.json` → backend scripts (`start`, `dev`, Prisma tasks)
- `server/prisma/schema.prisma` → MariaDB data model
- `server/src/app.js` → Express routes and `/health`
- `server/src/index.js` → server startup + cron bootstrap
- `server/src/lib/billingScheduler.js` → recurring billing and auto-deposit cron logic
- `server/.env.example` → minimum env sample
- `src/App.jsx` and `src/pages/Home.jsx` → frontend routing and API base behavior

## Runtime behavior that matters for Dokploy

### Frontend behavior

- Vite frontend builds into static assets
- In production it calls API using relative same-origin base:
  - `/api`
- That means Dokploy deployment should preserve same-origin routing
- Best fit is a reverse proxy that serves frontend at `/` and proxies `/api` to backend

### Backend behavior

- Backend serves API routes under `/api/*`
- Health endpoint is mounted at:
  - `/health`
- This is **not** under `/api`
- Reverse proxy should therefore forward both:
  - `/api/*`
  - `/health`
  to backend

### Background jobs / scheduler behavior

- `server/src/index.js` always calls `scheduleMonthlyBilling()`
- `billingScheduler.js` uses `node-cron`
- Default schedules:
  - monthly bill generation: `5 0 1 * *`
  - auto-deposit: `0 23 * * *` (with last-day-of-month guard)
  - timezone default: `Asia/Dhaka`
- This means every running backend instance will register cron tasks
- Therefore Dokploy deployment should normally run **exactly one backend replica** unless cron is explicitly disabled on extra replicas

### Storage behavior

- Customer import/upload uses `multer.memoryStorage()`
- Current implementation processes uploaded files in memory
- No persistent upload directory is implied by current code
- MariaDB persistence matters; file volume persistence is not the main concern right now

## Minimum environment variables

Required:

- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`

Recommended extra runtime envs inferred from scheduler code:

- `BILLING_CRON`
- `BILLING_CRON_SCHEDULE`
- `BILLING_CRON_TZ`
- `COLLECTOR_AUTO_DEPOSIT_CRON`
- `COLLECTOR_AUTO_DEPOSIT_CRON_SCHEDULE`

## Recommended Dokploy architecture

Best-fit Dokploy layout for CATV:

1. one MariaDB database service
2. one Docker Compose app service
3. inside Compose app:
   - `proxy` (Nginx or equivalent reverse proxy)
   - `frontend` (build/serve Vite static app)
   - `backend` (Node/Express API)

Why this is preferred:

- frontend expects same-origin `/api`
- backend also exposes `/health`
- proxy can cleanly route both frontend and backend under one domain
- cron stays with the backend process without needing a separate scheduler unless future scaling requires it

## Dokploy routing requirements

Proxy should route:

- `/` → frontend static app
- `/api/*` → backend
- `/health` → backend

## Likely Dokploy pitfalls

1. If frontend is hosted separately and API is on another origin, frontend config and CORS strategy become more complex
2. If backend is scaled to multiple replicas, cron tasks may run multiple times
3. If `/health` is not proxied to backend, smoke tests may mislead you
4. If MariaDB connection string is wrong, Prisma-backed API routes will fail broadly
5. If API requests return HTML instead of JSON, reverse proxy is probably serving frontend HTML for `/api` requests

## Deployment validation checklist

1. frontend root `/` loads
2. `/health` returns backend JSON
3. `/api/auth/login` returns JSON, not HTML
4. backend can reach MariaDB
5. Prisma migrations were applied successfully
6. only one backend replica is running if cron is enabled

## GitHub URL note

Provided repo URL used by the user was:

- `git@github.com:rzzisan/zyro_catv.git`

That SSH-style URL could not be fetched via webpage retrieval in this environment, and the HTTPS page also returned `404`, so the local workspace copy at `/var/www/hybrid-stack/catv` was used as the source of truth for this analysis.
