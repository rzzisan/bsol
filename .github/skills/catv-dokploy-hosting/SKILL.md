---
name: catv-dokploy-hosting
description: 'Deploy, debug, or prepare the Zyrotech CATV project for Dokploy. Use when hosting the React/Vite frontend with the Node/Express + Prisma backend on Dokploy, configuring MariaDB, setting up same-origin /api and /health proxy routing, handling Prisma migrations, or avoiding duplicate node-cron billing jobs.'
argument-hint: 'Describe the CATV Dokploy hosting or debugging task'
user-invocable: true
---

# CATV Dokploy Hosting

Use this skill when working on Dokploy hosting for the CATV project in `/var/www/hybrid-stack/catv`.

For deeper project facts and deployment analysis, read [project analysis](./references/project-analysis.md).

## When to Use

Use this skill when the task involves:

- hosting the `catv` project on Dokploy
- deciding Dokploy architecture for CATV
- configuring MariaDB for the CATV backend
- deploying React/Vite frontend + Node/Express backend together
- setting up reverse proxy rules for `/`, `/api/*`, and `/health`
- configuring Prisma migrations in Dokploy
- debugging API requests that return HTML instead of JSON
- debugging frontend/backend routing issues on the same domain
- preventing duplicate cron execution from multiple backend instances
- preparing Dockerfiles or Compose structure for CATV

## Do Not Use

Do not use this skill for:

- unrelated Laravel/Dokploy tasks for other projects
- Android app packaging or Play Store release work
- CATV feature development unrelated to hosting/runtime setup

## Verified CATV Architecture

The local CATV project analysis shows:

- frontend: React 19 + Vite 8
- backend: Node.js + Express
- ORM: Prisma
- database: MariaDB / MySQL
- auth: JWT + bcryptjs
- background jobs: `node-cron` started inside backend process

Important behavior:

- frontend uses same-origin `/api` in production
- backend exposes API under `/api/*`
- backend health route is `/health`
- backend startup automatically registers cron jobs via `scheduleMonthlyBilling()`

## Recommended Dokploy Architecture

Use this Dokploy layout:

1. one MariaDB database service
2. one Docker Compose app service
3. inside the Compose app:
   - `proxy`
   - `frontend`
   - `backend`

Why this is the best fit:

- Vite frontend is static after build
- Node backend serves JSON API
- same-origin `/api` is easiest with one reverse proxy
- `/health` must also reach backend
- keeping everything under one domain reduces CORS complexity

## Required Routing

Your reverse proxy must route:

- `/` → frontend
- `/api/*` → backend
- `/health` → backend

If `/api/*` goes to the frontend by mistake, the browser will often receive HTML and fail with JSON parse errors like `Unexpected token <`.

## Minimum Environment Variables

Backend env values required at minimum:

- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`

Scheduler-related env values you may also control:

- `BILLING_CRON`
- `BILLING_CRON_SCHEDULE`
- `BILLING_CRON_TZ`
- `COLLECTOR_AUTO_DEPOSIT_CRON`
- `COLLECTOR_AUTO_DEPOSIT_CRON_SCHEDULE`

## Standard Procedure

### 1. Inspect the repo before deployment

Confirm these facts from the repo:

- frontend root uses Vite build output
- backend lives under `server/`
- Prisma schema uses `provider = "mysql"`
- backend starts from `server/src/index.js`
- cron is started automatically from backend boot

### 2. Prepare Dokploy services

Create or verify:

1. one MariaDB service
2. one Compose application service
3. one public domain attached to the proxy container

### 3. Build the Compose app around three concerns

The Compose app should include:

- a frontend build/serve container for the Vite app
- a backend runtime container for Node/Express + Prisma
- a proxy container that serves frontend and forwards `/api/*` and `/health`

### 4. Configure the database correctly

Because Prisma uses MySQL/MariaDB, ensure:

- `DATABASE_URL` points to the Dokploy MariaDB service
- migrations run successfully before declaring the app healthy
- the backend container can connect before smoke testing frontend flows

### 5. Handle cron safely

This project uses `node-cron` inside the backend process.

That means:

- every backend instance will register cron jobs
- scaling backend replicas can create duplicate billing/deposit jobs

Safe default rule:

- run exactly **one backend replica** while cron is enabled

If horizontal scaling is needed later, create an explicit plan to disable cron on extra replicas or move cron responsibility into a dedicated worker/scheduler process.

### 6. Smoke test after deploy

Check in this order:

1. `/` loads the frontend
2. `/health` returns backend JSON
3. `/api/auth/login` responds with JSON, not HTML
4. frontend login screen can talk to the backend without parse errors
5. backend logs do not show Prisma DB connection failures

## Known Pitfalls and Fixes

### Problem: API returns HTML instead of JSON

Cause:

- proxy routed `/api` to the frontend instead of the backend

Fix:

- correct proxy routing for `/api/*`
- retest an auth endpoint directly

### Problem: health check looks broken even though API routes work

Cause:

- `/health` is a backend route, not a frontend route and not under `/api`

Fix:

- proxy `/health` to backend explicitly

### Problem: duplicate monthly billing or deposit automation

Cause:

- multiple backend instances all started `node-cron`

Fix:

- keep one backend replica
- or explicitly disable cron on non-primary replicas

### Problem: Prisma-backed endpoints fail across the board

Cause:

- MariaDB connection string wrong
- migrations not applied
- Prisma client/runtime not prepared correctly in the backend image

Fix:

- verify `DATABASE_URL`
- run Prisma generate/migrations during build/start workflow as appropriate
- recheck backend logs before testing frontend flows

### Problem: frontend and backend split across origins causes extra friction

Cause:

- frontend production code expects same-origin `/api`

Fix:

- prefer one-domain proxy setup in Dokploy

## Guardrails for Future Agents

When using this skill:

1. do not assume PostgreSQL — this project uses MariaDB
2. do not assume `/api/health` — backend health is `/health`
3. do not scale backend replicas casually because cron is embedded in the backend runtime
4. validate same-origin routing before debugging frontend code
5. test a JSON endpoint directly before assuming the backend is broken
6. prefer a single Compose app plus MariaDB service unless there is a strong reason to split services further

## Quick Summary

Remember these first:

- CATV is React/Vite + Node/Express + Prisma + MariaDB
- production frontend uses same-origin `/api`
- backend health route is `/health`
- `node-cron` runs inside backend boot
- safest Dokploy design is MariaDB service + one Compose app + reverse proxy
- one backend replica is the safe default while cron is enabled
