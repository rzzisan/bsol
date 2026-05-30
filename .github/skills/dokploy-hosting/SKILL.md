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

### Problem: SMS gateway pages return `500` on Dokploy while SMS history still works

Cause:

- `sms_gateways.api_key` and `secret_key` use Laravel `encrypted` casts
- those routes are among the few places that actually read the encrypted gateway credentials
- if Dokploy runs with the wrong `APP_KEY`, gateway endpoints fail even though `/api/health` and SMS history may still work
- `docker-compose.dokploy.yml` loads root `.env` as `env_file`, so the committed placeholder `APP_KEY` can leak into runtime if Dokploy UI does not override it

Symptom pattern:

- `GET /api/sms/gateways` → `500`
- `GET /api/admin/sms/gateways` → `500`
- SMS history pages still load

Fix:

- set Dokploy `APP_KEY` to the original production Laravel key used when the SMS gateway credentials were encrypted
- or re-save/re-enter SMS gateway credentials under the current Dokploy `APP_KEY`

Rule:

- when importing DB data that contains Laravel-encrypted columns, preserve the original `APP_KEY` unless you explicitly plan to re-encrypt those values after import
- do not rely on the committed root `.env` placeholder values in Dokploy runtime

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

### Problem: `500` after code deploy with new database migrations

Cause:

- code was deployed but `php artisan migrate` was not executed in Dokploy
- new API endpoints tried to access tables that do not exist in the DB
- same as missing schema, but triggered by feature deployment not data import

Symptom:

- new feature endpoints return `500`
- error: `SQLSTATE[42P01]: Undefined table` for new table name
- existing endpoints still work
- `/api/health` still returns `200`

Fix:

- open Docker terminal in Dokploy
- run `cd /var/www/html && php artisan migrate --force`
- verify output shows all pending migrations completed
- restart services (Stop → Start in Dokploy UI)

Rule:

- migrations are NOT automatic after code deploy
- always run `php artisan migrate --force` explicitly in Dokploy Docker terminal
- treat migrations as a separate manual step in the deployment sequence

### Problem: `404 Not Found` on new API routes after code deploy

Cause:

- new routes were added to `routes/api.php` or `routes/web.php`
- Laravel route cache was stale from before the new code was deployed
- Nginx/Laravel cannot find the route in the cached route file

Symptom:

- new API endpoints return `404` (HTML page, not JSON)
- existing endpoints work fine
- error persists even after frontend refresh
- occurs immediately after deploying new routes

Example:

- `GET /api/landing/analytics/1/statistics` → `404`
- `GET /api/health` → `200` (works fine)

Fix:

- open Docker terminal in Dokploy
- run `php artisan route:clear && php artisan route:cache`
- optionally also run `php artisan config:clear` if new config keys were added
- refresh browser and retest

Rule:

- always clear route cache after deploying code with new routes
- include `route:clear && route:cache` in every feature deployment
- test new endpoints immediately after cache clear to verify they are now in the cache

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

## Deploying New Features with Database Schema Changes

Use this procedure when deploying a feature that includes new database tables, columns, or migrations to Dokploy production. This section documents the lessons learned from the Landing Page Analytics feature deployment (May 2026).

### Deployment Sequence

When a new feature includes database schema changes:

1. **Deploy code first** (backend image, frontend build)
   - push code to `dokploy` branch
   - trigger Dokploy build/deploy
   - do NOT assume the feature works yet

2. **Execute pending migrations** (critical step)
   - open Docker terminal in Dokploy UI
   - navigate to backend container: `cd /var/www/html`
   - run: `php artisan migrate --force`
   - verify output shows all migrations completed with timestamps
   - example success output: `150.26ms DONE` for each migration

3. **Restart all services**
   - in Dokploy UI, click Stop button for the Compose service
   - wait 5 seconds for services to stop
   - click Start button
   - wait 15 seconds for services to be ready

4. **Clear Laravel caches** (critical for route changes)
   - open Docker terminal again
   - run: `php artisan route:clear && php artisan route:cache`
   - if you added new config keys, also run: `php artisan config:clear`
   - these commands recache routes and config after the fresh deployment

5. **Validate with smoke tests**
   - test the main endpoint from the new feature
   - verify you get `200` with expected JSON, not `404` or `500`

### Common Problems with Schema-Change Deployments

#### Problem: `500 Server Error` with message like `relation '...' does not exist`

**Cause:**
- Code was deployed but database migrations were NOT executed
- Laravel tried to access a table that doesn't exist in the DB yet

**Symptom pattern:**
- new feature endpoints return `500`
- error log shows `SQLSTATE[42P01]: Undefined table`
- `/api/health` still works (no schema needed)

**Example from Landing Page Analytics deployment:**
```
API error: 500
Database error: relation 'landing_page_visits' does not exist
```

**Fix:**
1. open Docker terminal in Dokploy
2. run `php artisan migrate --force`
3. verify all 3 migrations completed
4. restart services (Stop → Start)
5. retest the endpoint

**Prevention rule:**
- ALWAYS execute migrations in Dokploy after deploying code that includes new migrations
- do not assume the automatic migration runner executed everything
- treat migrations as a manual deployment step, not an automatic side effect

#### Problem: `502 Bad Gateway` immediately after migration + deploy

**Cause:**
- services are in the middle of restarting or rebuilding
- backend container is not yet ready to accept traffic
- occurs during the window between build completion and full startup

**Symptom pattern:**
- homepage and dashboard briefly return `502`
- errors appear in browser network tab
- Dokploy UI shows services as "running"

**Fix:**
- wait 5-15 seconds for services to fully start
- recheck `/api/health`
- if `502` persists beyond 30 seconds, check backend logs for startup errors

**Prevention rule:**
- do not declare deployment failed on the first `502`
- allow time for container startup after restart
- verify `/api/health` returns `200` before testing business routes

#### Problem: `404 Not Found` on new API endpoints after migration + deploy

**Cause:**
- Laravel route cache is stale after the fresh deployment
- new routes exist in code but are not in the cached route file
- the app is serving cached routes from before the new code was deployed

**Symptom pattern:**
- frontend renders but new API calls return `404`
- error response is HTML (not JSON), indicating Nginx/Laravel could not find the route
- other existing endpoints still work fine

**Example from Landing Page Analytics deployment:**
```
GET /api/landing/analytics/1/statistics → 404
GET /api/landing/pages → 200 (works fine)
```

**Fix:**
1. open Docker terminal in Dokploy
2. run: `php artisan route:clear && php artisan route:cache`
3. if you added new config keys: `php artisan config:clear`
4. refresh the browser and retest API calls

**Prevention rule:**
- always clear route cache after deploying code with new routes
- treat cache clearing as part of the standard deployment checklist
- if unsure, run all three: `route:clear`, `config:clear`, `cache:clear`

### Landing Page Analytics Feature: Complete Deployment History

To illustrate the full procedure, here is the exact sequence that successfully deployed the Landing Page Analytics feature:

**Local development:**
- 3 new migrations created for `landing_page_visits`, `landing_page_statistics`, `landing_page_visit_orders`
- Laravel middleware `TrackLandingPageVisit` created for visit tracking
- 5 new API endpoints added in `api.php` with numeric route constraints
- Next.js analytics dashboard component created at `/dashboard/landing-page-analytics/`

**Deployment to Dokploy:**

1. Pushed code to `dokploy` branch → Dokploy triggered build
2. Frontend loaded without errors → dashboard UI rendered
3. **Issue encountered:** API returned `500: relation 'landing_page_visits' does not exist`
4. **Cause identified:** Migrations not yet executed in Dokploy DB
5. **Action taken:** Executed `php artisan migrate --force` in Docker terminal
   - Output: All 3 migrations completed successfully (150ms, 28ms, 24ms)
6. **Issue: 502 Bad Gateway** appeared after migrations
7. **Cause:** Services needed restart after migrations
8. **Action taken:** Clicked Stop, waited 5 sec, clicked Start, waited 15 sec
9. **Issue: 404 Not Found** on API endpoints
10. **Cause:** Route cache was stale from before the new migrations
11. **Action taken:** Executed `php artisan route:clear && php artisan route:cache`
    - Output: "Route cache cleared successfully" + "Routes cached successfully"
12. **Result:** ✅ All endpoints now return `200` with correct JSON data

**Final validation:**
- `/dashboard/landing-page-analytics/5` loads with real visitor data
- 4 visits displayed, geolocation shows Bangladesh
- Daily statistics table populated
- All 5 API endpoints responding correctly

### Deployment Checklist for Schema-Change Features

Use this checklist every time you deploy a feature with database changes:

- [ ] Code pushed to `dokploy` branch
- [ ] Dokploy build completed (check build logs)
- [ ] Frontend homepage loads without 502/503
- [ ] Ran `php artisan migrate --force` in Docker terminal
- [ ] Verified all migrations show "DONE" in output
- [ ] Services stopped and restarted (Stop button → Start button)
- [ ] Waited 15 seconds for services to become ready
- [ ] Ran `php artisan route:clear && php artisan route:cache`
- [ ] Tested main endpoint with `GET /api/health` → expect `200`
- [ ] Tested new feature endpoint → expect `200` with expected JSON
- [ ] Tested existing endpoints still work → expect normal behavior
- [ ] Checked Dokploy service logs for any warnings or errors

### Landing Page Carousel / Media Library rollout note

Use this exact sequence when deploying the landing-page carousel image feature that adds the `landing_media_assets` table and the media-library API routes:

1. push the implementation to `main`
2. fast-forward merge `main` into `dokploy`
3. push `dokploy` so Dokploy builds from the deploy branch
4. after the Dokploy build finishes, open the Docker terminal and run `php artisan migrate --force`
5. run `php artisan route:clear && php artisan route:cache` to pick up the new media-library routes
6. run `php artisan config:clear` if any new config values were introduced
7. stop and start the Compose service from Dokploy UI so the frontend and backend restart together
8. wait for the services to become healthy, then verify:
   - `GET /api/health` → `200`
   - `GET /api/landing/media-library` → `200`
   - `GET /api/landing/media-library/policy` → `200`
   - the landing page editor loads without 500/404
9. if the media library returns empty on a fresh database, confirm the authenticated user has uploaded assets or import the expected production rows first

Important rule:

- this feature is **not** complete on Dokploy until the migration, route cache, and smoke checks all pass
- do not rely on the build alone; schema-backed landing-page features need an explicit post-deploy database step

### Best Practices to Avoid Future Issues

1. **Always migrate before testing**
   - do not assume Dokploy ran migrations automatically
   - run `php artisan migrate --force` explicitly in Docker terminal

2. **Clear caches after code deploy**
   - run `route:clear && route:cache` after deploying code changes
   - include in every deployment checklist

3. **Validate schema before assuming API failure**
   - a `500` with "relation does not exist" means schema is missing
   - fix schema first, not the API code

4. **Separate migration success from application behavior**
   - migrations can complete successfully while business logic still fails
   - test actual feature workflow after schema validation

5. **Document new migrations in deployment notes**
   - note the number of new migrations
   - note table names and critical columns
   - helps future troubleshooting

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
