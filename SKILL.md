---
name: dokploy-hosting
description: 'Deploy, debug, migrate, or re-host the Hybrid Stack / bsol app on Dokploy. Use when setting up PostgreSQL, Redis, Docker Compose app services, scheduler jobs, Dokploy environment variables, domain mapping, runtime debugging, missing schema errors, Redis extension failures, transient 502 issues, or production database import into Dokploy.'
argument-hint: 'Describe the Dokploy task, environment, or failure you want handled'
user-invocable: true
---

# Dokploy Hosting for Hybrid Stack

Use this skill when working on Dokploy deployment and operations for the `bsol` / `hybrid-stack` application in `/var/www/hybrid-stack`.

This skill packages the proven hosting knowledge learned while moving the Laravel + Next.js stack onto Dokploy, including:

- architecture decisions
- environment setup
- deployment order
- common failures
- root-cause-based debugging
- database migration from the old production server
- safe validation steps after deploy/import

## When to Use

Use this skill when the task includes any of the following:

- hosting or re-hosting Hybrid Stack on Dokploy
- setting up Dokploy PostgreSQL / Redis / Docker Compose services
- configuring Dokploy environment variables
- mapping a domain to the Dokploy proxy service
- enabling Laravel scheduler in Dokploy
- debugging `500` errors after deploy
- debugging `502 Bad Gateway` during redeploy windows
- fixing Redis connection or `Class "Redis" not found` errors
- fixing missing-schema errors like `relation "users" does not exist`
- deciding whether to use internal service hostnames or exposed IP/port fallback
- importing the old production PostgreSQL database into Dokploy
- validating whether Dokploy deployment is actually healthy

## Do Not Use

Do not use this skill for:

- general Laravel feature development unrelated to Dokploy
- frontend-only UI design tasks
- unrelated database schema design work
- personal VS Code customization unrelated to this repository

## Verified Project Facts

Current stack:

- `backend/` → Laravel 13 API
- `frontend/` → Next.js 16 frontend
- PostgreSQL → primary DB
- Redis → cache / queue / sessions

Verified infrastructure facts:

- old production/native server IP: `103.157.253.197`
- Dokploy host/server IP: `103.157.253.196`
- old production domain: `bsol.zyrotechbd.com`
- Dokploy test/live domain used during migration: `bsol.zisan.me`
- Dokploy runs on a **Proxmox VM**
- old production stack was a **native LXC deployment**

Important interpretation:

- Docker on the old LXC runtime was not considered reliable
- Dokploy on the Proxmox VM **is valid for this project**

## Recommended Dokploy Architecture

Always prefer this layout:

1. one PostgreSQL service
2. one Redis service
3. one Docker Compose app service
4. one scheduled job for Laravel scheduler

Verified service names used previously:

- `bsol_hybrid-app` → Compose app
- `hybrid-redis` → Redis service
- `bsol_hybrid-postgres` → PostgreSQL service

Why this architecture is correct:

- frontend and backend are separate runtimes
- Laravel queue worker must be separate from web traffic
- Redis and PostgreSQL should remain managed services
- the app requires one domain to route both frontend and backend paths

Required path routing:

- `/` → frontend
- `/dashboard` → frontend
- `/api/*` → backend
- `/sanctum/*` → backend
- `/storage/*` → backend
- `/lp/*` → backend

## Required Repo Artifacts

Before touching Dokploy UI, confirm these files exist and are correct:

- `docker-compose.dokploy.yml`
- `.env.dokploy.example`
- `frontend/Dockerfile.dokploy`
- `frontend/.dockerignore`
- `backend/Dockerfile.dokploy`
- `backend/.dockerignore`
- `backend/docker/dokploy/000-default.conf`
- `backend/docker/dokploy/entrypoint.sh`
- `deploy/dokploy/nginx/default.conf`

If the repo scaffold is incomplete, fix the repo first. Do **not** try to improvise everything inside Dokploy UI.

## Verified Dokploy Environment Strategy

Use Dokploy environment variables UI for real secrets.

Critical keys:

- `APP_NAME`
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL`
- `APP_KEY`
- `FRONTEND_URL`
- `DB_CONNECTION=pgsql`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_CLIENT=phpredis`
- `REDIS_HOST`
- `REDIS_PORT`
- `CACHE_STORE=redis`
- `QUEUE_CONNECTION=redis`
- `SESSION_DRIVER=redis`
- `SANCTUM_STATEFUL_DOMAINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `RUN_MIGRATIONS`

Previously verified working values in this environment:

- `APP_URL=https://bsol.zisan.me`
- `FRONTEND_URL=https://bsol.zisan.me`
- `NEXT_PUBLIC_API_BASE_URL=https://bsol.zisan.me/api`
- `DB_HOST=103.157.253.196`
- `DB_PORT=15432`
- `DB_DATABASE=hybrid_platform`
- `DB_USERNAME=hybrid_app`
- `REDIS_CLIENT=phpredis`
- `REDIS_HOST=103.157.253.196`
- `REDIS_PORT=16379`

### Important Environment Lesson

In this Dokploy setup, the Compose app did **not** reliably resolve Dokploy standalone DB service hostnames.

Preferred fallback for this project:

- expose Postgres externally on `15432`
- expose Redis externally on `16379`
- point the app to Dokploy host IP `103.157.253.196`

Use internal service hostnames only if they are re-verified to work.

## Standard Procedure

### 1. Prepare the deployment

1. confirm repo scaffold exists
2. confirm Dokploy target is the Proxmox VM deployment
3. confirm whether DNS already points to Dokploy
4. if DNS is not ready, use a temporary test domain like `bsol.zisan.me`
5. confirm secrets will be configured in Dokploy UI, not committed to git

### 2. Configure Dokploy services

1. verify PostgreSQL service exists
2. verify Redis service exists
3. configure the Compose app to use `docker-compose.dokploy.yml`
4. attach the domain to the proxy service on port `80`
5. create the Laravel scheduler job with:
   - command: `php artisan schedule:run`
   - target: `backend`
   - cron: `* * * * *`

### 3. First deploy validation

Check in this order:

1. `/`
2. `/dashboard`
3. `/api/health`
4. one frontend static asset from the HTML
5. backend and worker logs

### 4. Runtime debugging procedure

If something returns `500` or behaves oddly:

1. verify backend image has PHP Redis extension
2. verify DB/Redis host and port values
3. determine whether the failure is:
   - connectivity
   - missing schema
   - transient redeploy window
   - data/runtime logic
4. if the error is unclear, temporarily set `APP_DEBUG=true`
5. reproduce the failing route
6. capture the exact exception
7. restore `APP_DEBUG=false` after diagnosis

### 5. Fresh database bootstrap procedure

If the target DB is empty or schema is missing:

1. set `RUN_MIGRATIONS=true`
2. redeploy
3. confirm migrations ran in backend logs
4. set `RUN_MIGRATIONS=false`
5. redeploy again

Never leave `RUN_MIGRATIONS=true` enabled indefinitely unless intentionally required.

### 6. Final smoke test

Use this sequence:

1. `GET /api/health` → expect `200`
2. `POST /api/otp/register` → expect `200` and OTP message
3. verify frontend root loads
4. verify dashboard route loads

## Known Problems and Proven Fixes

### Problem: `Class "Redis" not found`

Cause:

- Laravel uses `REDIS_CLIENT=phpredis`
- backend image did not yet include the PHP Redis extension

Fix:

- update `backend/Dockerfile.dokploy`
- add `$PHPIZE_DEPS`
- run `pecl install redis`
- run `docker-php-ext-enable redis`

Rule:

- if using `phpredis`, always bake the Redis extension into the image

### Problem: Dokploy service hostnames did not work reliably

Cause:

- compose app could not reliably resolve standalone Dokploy DB service hostnames in this environment

Fix:

- expose Postgres on `15432`
- expose Redis on `16379`
- use Dokploy host IP `103.157.253.196`

Rule:

- prefer the verified external IP+port strategy for this project

### Problem: `500 Server Error` on OTP registration even though DB creds looked right

Cause:

- actual issue was missing schema, not bad credentials

Observed error pattern:

- `SQLSTATE[42P01]: Undefined table`
- `relation "users" does not exist`

Fix:

- run the one-time migration bootstrap using `RUN_MIGRATIONS=true`

Rule:

- always verify schema existence separately from connectivity

### Problem: transient `502 Bad Gateway`

Cause:

- backend/proxy restart window during deploy or env changes

Fix:

- wait for build/restart to settle
- recheck `/api/health`
- then rerun business-route smoke test

Rule:

- do not declare deployment failed on the first `502` during active redeploy

### Problem: old production Postgres was not remotely reachable

Cause:

- old production DB port `5432` was not open/reachable from Dokploy-side access path

Fix:

- SSH into the old production server
- run `pg_dump` locally there
- then restore into Dokploy target DB

Rule:

- check both DB reachability and SSH reachability before planning migration steps

### Problem: target backup failed with PostgreSQL client/server version mismatch

Cause:

- local client was PostgreSQL `16.x`
- Dokploy target server was PostgreSQL `18.x`

Symptom:

- `pg_dump: aborting because of server version mismatch`

Fix / handling:

- source PG16 dump still restored fine into target PG18
- for target backups, use PG18 client or Dokploy-side backup

Rule:

- if target backup matters, use matching or newer PostgreSQL client tools

### Problem: app logic may still fail after a successful DB import

Cause:

- data migration success and app behavior success are different validations

Verified lesson:

- table counts can match
- `/api/health` can still be `200`
- a business route can still fail afterwards

Rule:

- validate business routes after import, not just DB counts

## Database Import Procedure

Use this when moving the old/current production DB into Dokploy.

1. identify source and target clearly
   - source = old/current production DB
   - target = Dokploy Postgres used by `bsol_hybrid-app`
2. test whether the source DB is remotely reachable
3. if not reachable, SSH into source server
4. run local source dump there
5. import dump into target Dokploy DB
6. validate:
   - core table existence
   - count comparison for a few important tables
   - `/api/health`
   - OTP/register or another real business route

Safety rules:

- do not overwrite a meaningful target DB blindly
- if a target backup is required, confirm PostgreSQL client compatibility first
- do not confuse successful DB import with full application readiness

## Guardrails for Future Agents

When using this skill, the agent should:

1. prefer small, testable changes
2. change one deployment variable at a time when debugging
3. verify `/api/health` before concluding the stack is healthy
4. verify `/api/otp/register` before concluding the business flow is healthy
5. restore `APP_DEBUG=false` after exception capture
6. treat transient `502` and persistent `500` differently
7. document any new Dokploy-specific lesson back into project docs

## Access Boundaries

### Browser access

If Dokploy pages are shared, the agent can:

- inspect service settings
- inspect env tabs
- inspect logs tabs
- click non-sensitive UI elements
- guide setup and debugging

If pages are not shared, the agent cannot read them automatically.

### Terminal access

If terminal access is available, the agent can:

- inspect files and env state
- test DB connectivity
- run imports/exports
- validate health endpoints
- collect logs

Secrets such as passwords, tokens, and SSH credentials must be typed directly by the user when prompted.

## Quick Summary

Remember these facts first:

- Dokploy on Proxmox VM is valid for this project
- use Postgres + Redis + one Compose app + one scheduler job
- backend requires PHP Redis extension because `REDIS_CLIENT=phpredis`
- verified fallback is Dokploy host IP + exposed DB/Redis ports
- a fresh DB may need one-time `RUN_MIGRATIONS=true`
- transient `502` during redeploy is normal noise
- DB migration can succeed while application logic still needs further debugging
