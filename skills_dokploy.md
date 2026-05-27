# Dokploy skill — Hybrid Stack hosting playbook

Last updated: 2026-05-23  
Scope: `/var/www/hybrid-stack`

## 1. Skill purpose

এই ফাইলটি একটি **AI agent skill / deployment playbook**। এর উদ্দেশ্য:

- `bsol` / `hybrid-stack` project কীভাবে Dokploy-এ host করতে হবে তা দ্রুত মনে করিয়ে দেওয়া
- deployment-এর সময় কোন architecture choose করতে হবে তা নির্ধারণ করা
- previously encountered problems, root cause, fix, এবং preventive rule document করা
- environment create/deploy/debug/migrate flow future session-এ repeatable করা
- browser-assisted ও terminal-assisted Dokploy operations-এর সীমা ও best practice define করা

এটা শুধু summary না — future AI agent যেন **কম ভুল করে, দ্রুত diagnose করে, এবং repeatableভাবে deploy করতে পারে**, সেই লক্ষ্যেই লেখা।

---

## 2. Project identity and verified stack

Project layout:

- `backend/` → Laravel 13 API backend
- `frontend/` → Next.js 16 frontend
- PostgreSQL → primary database
- Redis → cache / queue / session backend

Live Dokploy testing domain used during this migration/debug cycle:

- `bsol.zisan.me`

Old/native production domain:

- `bsol.zyrotechbd.com`

Server facts learned:

- old production app server IP: `103.157.253.197`
- Dokploy host/server IP: `103.157.253.196`
- Dokploy is running inside a **Proxmox VM** ✅
- old production runtime was a **native stack on LXC**

Important conclusion:

- Docker-based deployment was risky on the old LXC host
- but **Dokploy on a proper VM is acceptable and workable** for this project

---

## 3. Recommended Dokploy architecture

For this project, the correct Dokploy layout is:

1. **One PostgreSQL database service**
2. **One Redis database service**
3. **One Docker Compose application service**
4. **One Dokploy scheduled job** for Laravel scheduler

Verified service names used in this project:

- `bsol_hybrid-app` → Docker Compose app
- `hybrid-redis` → Redis service
- `bsol_hybrid-postgres` → PostgreSQL service

### Why this architecture is correct

Because the app is not a single-process monolith:

- frontend and backend are separate runtimes
- Laravel queue worker needs its own process
- one domain must route both frontend and backend paths
- Redis and PostgreSQL should not be bundled into the app container

Required routing behavior:

- `/` → frontend
- `/dashboard` → frontend
- `/api/*` → backend
- `/sanctum/*` → backend
- `/storage/*` → backend
- `/lp/*` → backend

So:

- **single Dokploy app service without Compose is not enough**
- **Docker Compose is the correct Dokploy fit**

---

## 4. Dokploy-ready repo artifacts

### Root-level files

- `docker-compose.dokploy.yml` → main Dokploy compose definition
- `.env` → local/root placeholder env file for compose
- `.env.dokploy.example` → safe env reference for Dokploy UI

### Frontend files

- `frontend/Dockerfile.dokploy` → production image for Next.js
- `frontend/.dockerignore` → excludes unnecessary files from Docker build context

### Backend files

- `backend/Dockerfile.dokploy` → production image for Laravel backend/worker
- `backend/.dockerignore` → keeps image context clean
- `backend/docker/dokploy/000-default.conf` → Apache virtual host
- `backend/docker/dokploy/entrypoint.sh` → startup/bootstrap script

### Reverse proxy files

- `deploy/dokploy/nginx/default.conf` → path-based routing between frontend/backend

---

## 5. How the Dokploy environment was created

This section explains **what had to be prepared** before the app could run successfully.

### 5.1 Compose service configuration

For `bsol_hybrid-app`, use:

- service type: **Docker Compose**
- compose file: `docker-compose.dokploy.yml`
- repository root: `/var/www/hybrid-stack`
- branch: repo owner’s chosen deploy branch (`main` was used during this work)

### 5.2 Domain mapping

Attach public domain to the **proxy** service on port `80`.

During Dokploy testing, verified domain:

- `bsol.zisan.me`

### 5.3 Scheduled job

Create a Dokploy scheduled job for Laravel scheduler:

- command: `php artisan schedule:run`
- target service: `backend`
- cron: `* * * * *`

### 5.4 Environment variables that matter

Minimum required Dokploy environment keys:

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
- `REDIS_PASSWORD` (if set)
- `CACHE_STORE=redis`
- `QUEUE_CONNECTION=redis`
- `SESSION_DRIVER=redis`
- `SANCTUM_STATEFUL_DOMAINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `RUN_MIGRATIONS`

### 5.5 Verified working Dokploy values

These values were actually verified in the live Dokploy environment:

- `APP_URL=https://bsol.zisan.me`
- `FRONTEND_URL=https://bsol.zisan.me`
- `NEXT_PUBLIC_API_BASE_URL=https://bsol.zisan.me/api`
- `DB_CONNECTION=pgsql`
- `DB_HOST=103.157.253.196`
- `DB_PORT=15432`
- `DB_DATABASE=hybrid_platform`
- `DB_USERNAME=hybrid_app`
- `REDIS_CLIENT=phpredis`
- `REDIS_HOST=103.157.253.196`
- `REDIS_PORT=16379`

### 5.6 Important environment lesson

Although Dokploy standalone Postgres/Redis services expose internal hostnames, in this environment the Compose app did **not** reliably resolve those hostnames.

The internal names that were expected to work were conceptually like:

- Dokploy Postgres internal hostname
- Dokploy Redis internal hostname

But in practice, the working fallback was:

- expose Postgres publicly on `15432`
- expose Redis publicly on `16379`
- point the app to Dokploy host IP `103.157.253.196`

This was a key deployment breakthrough.

---

## 6. Problems encountered, why they happened, and how they were fixed

This is the most important section for future deployments.

### 6.1 Problem: initial Dokploy deployment could not fully run the stack

#### Why it happened

Dokploy needed repo-side deployment artifacts that did not yet exist or were incomplete.

#### Symptoms

- app service not fully wired for multi-service runtime
- domain/proxy/backend/frontend expectations not aligned

#### Fix

Created and committed the Dokploy scaffold:

- `docker-compose.dokploy.yml`
- Dokploy Dockerfiles
- proxy config
- backend entrypoint config

#### Prevention rule

Never start Dokploy UI setup first and “figure out the repo later.”  
Prepare the repo scaffold first.

### 6.2 Problem: old production domain still pointed to old infrastructure

#### Why it happened

`bsol.zyrotechbd.com` was still serving the old/native production stack.

#### Symptoms

- confusion during smoke tests
- wrong server may respond even if Dokploy deploy is fine

#### Fix

Switched testing to:

- `bsol.zisan.me`

#### Prevention rule

If DNS is not yet switched, always use a **clean test domain** or direct-origin checks.

### 6.3 Problem: `Class "Redis" not found`

#### Why it happened

Laravel was configured with:

- `REDIS_CLIENT=phpredis`

But the Dokploy backend/worker image did not yet include the PHP Redis extension.

#### Symptoms

- backend/worker crashes
- runtime exception mentioning missing `Redis` class

#### Fix

Updated:

- `backend/Dockerfile.dokploy`

Added:

- `$PHPIZE_DEPS`
- `pecl install redis`
- `docker-php-ext-enable redis`

#### Prevention rule

If using `phpredis`, bake the extension into the production image.  
Do not assume Laravel runtime images already have it.

### 6.4 Problem: Redis/Postgres internal hostname resolution failed from the Compose app

#### Why it happened

In this Dokploy setup, standalone DB services did not reliably resolve from the compose app the way we initially expected.

#### Symptoms

- app containers unable to connect to Redis/Postgres using service hostnames
- health may partially work while deeper runtime requests fail

#### Fix

Exposed services externally:

- Redis → `16379`
- Postgres → `15432`

Then configured app env to use:

- `DB_HOST=103.157.253.196`
- `DB_PORT=15432`
- `REDIS_HOST=103.157.253.196`
- `REDIS_PORT=16379`

#### Prevention rule

For this project, prefer the **verified IP + exposed port strategy** unless hostname resolution is reconfirmed to work.

### 6.4A Problem: SMS gateway pages returned `500` on Dokploy while SMS history still worked

#### Why it happened

The `sms_gateways` table stores `api_key` and `secret_key` using Laravel `encrypted` casts.

Only the SMS gateway endpoints read those encrypted fields, so if Dokploy is running with the wrong `APP_KEY`, gateway-related pages fail while unrelated SMS history pages can still work.

An extra trap exists in this repo:

- `docker-compose.dokploy.yml` loads the root `.env` as `env_file`
- the committed root `.env` contains a placeholder `APP_KEY`
- if Dokploy UI does not override `APP_KEY`, the runtime can inherit the placeholder value

#### Symptoms

- `/api/sms/gateways` returns `500`
- `/api/admin/sms/gateways` returns `500`
- SMS history endpoints still load
- production/native server may still work because it uses the original app key

#### Root cause pattern

- imported `sms_gateways.api_key` / `secret_key` data was encrypted with a different Laravel app key
- Dokploy runtime key did not match that original key

#### Fix

Use one of these:

1. set Dokploy `APP_KEY` to the original production Laravel key that encrypted the SMS gateway credentials
2. or re-save the SMS gateway credentials from the admin UI/DB under Dokploy's current `APP_KEY`

#### Prevention rule

If imported data contains Laravel-encrypted columns, keep the original `APP_KEY` during migration unless you intentionally re-encrypt the data afterwards.
Also verify Dokploy UI overrides the placeholder root `.env` values.

### 6.5 Problem: registration returned `500 Server Error`

#### Why it happened

At first it looked like a credential/connectivity problem, but the actual root cause was different.

#### Debug method used

Temporarily turned on:

- `APP_DEBUG=true`

Then hit the failing route to capture the real exception.

#### Actual root cause

The target Dokploy database was reachable, but schema was missing.

Observed error:

- `SQLSTATE[42P01]: Undefined table: 7 ERROR: relation "users" does not exist`

#### Fix

Used one-time migration bootstrap:

1. set `RUN_MIGRATIONS=true`
2. redeploy
3. confirm migrations in backend logs
4. set `RUN_MIGRATIONS=false`
5. redeploy again

#### Prevention rule

When a fresh Dokploy DB is used, verify **schema existence**, not just DB connectivity.

### 6.6 Problem: transient `502 Bad Gateway`

#### Why it happened

During build/redeploy/restart windows, Nginx/proxy may briefly point to containers that are not yet ready.

#### Symptoms

- `/api/health` or `/api/otp/register` temporarily returns `502`

#### Fix

Treat it as a restart-window hypothesis first, then recheck after deployment settles.

Order of checks:

1. deployment/build state in Dokploy
2. backend logs
3. `/api/health`
4. registration smoke test

#### Prevention rule

Do not declare failure on first `502` during active redeploy. Wait for the stack to settle.

### 6.7 Problem: old production database was not remotely reachable

#### Why it happened

Old production DB on `103.157.253.197:5432` did not accept direct remote access from the Dokploy-side host.

#### Symptoms

- `pg_isready -h 103.157.253.197 -p 5432` → no response
- remote `pg_dump` impossible

#### Fix

Use source-side/local dump on the old production server itself via SSH.

#### Prevention rule

For DB migration planning, always test:

- remote DB reachability
- SSH reachability

before promising a direct network dump.

### 6.8 Problem: target DB backup with local `pg_dump` failed due to version mismatch

#### Why it happened

This production host had PostgreSQL client `16.x`, while Dokploy target Postgres was `18.x`.

#### Symptoms

- `pg_dump: aborting because of server version mismatch`

#### Fix / practical handling

- source PG16 dump was still restorable into target PG18
- direct target backup from this host was not reliable without a PG18 client
- because target Dokploy DB was still effectively disposable/test state, import was allowed to proceed

#### Prevention rule

If target backup matters, use:

- PG18 client
- or Dokploy-side backup mechanism
- or a host with matching/newer PostgreSQL client tools

### 6.9 Problem: post-import app behavior may still differ from pre-import empty-db smoke tests

#### Why it happened

Once real production data is imported, application-level logic may fail for reasons unrelated to DB connectivity.

#### Verified observation

- DB import succeeded
- source and target counts matched for core tables
- `/api/health` returned `200`
- but OTP route later returned `500`, which indicates **application/runtime logic investigation may still be required after a successful import**

#### Prevention rule

Treat **data migration success** and **application behavior success** as two separate validations.

---

## 7. Proven deployment and debugging workflow

Use this order in future sessions.

### 7.1 Pre-deploy

1. Confirm Dokploy host is a proper VM, not the problematic old LXC runtime
2. Confirm repo contains Dokploy scaffold files
3. Confirm Compose app, Postgres, Redis services exist
4. Confirm domain strategy (`production` vs `temporary test domain`)
5. Confirm secrets will be entered in Dokploy UI, not committed

### 7.2 First deployment

1. Configure Compose app with `docker-compose.dokploy.yml`
2. Configure env vars in Dokploy
3. Attach domain to proxy port `80`
4. Deploy
5. Create scheduler job

### 7.3 Connectivity verification

1. Check `/`
2. Check `/dashboard`
3. Check `/api/health`
4. Check one asset from frontend HTML
5. Check backend/worker logs

### 7.4 If runtime errors occur

1. Verify Redis extension and client choice
2. Verify DB/Redis host and port strategy
3. Temporarily enable `APP_DEBUG=true` if needed
4. Capture the exact failing exception
5. Decide whether it is:
  - connectivity issue
  - missing schema issue
  - runtime logic/data issue

### 7.5 If schema is missing

1. set `RUN_MIGRATIONS=true`
2. redeploy
3. verify migration logs
4. set `RUN_MIGRATIONS=false`
5. redeploy again

### 7.6 Final smoke test

The preferred smoke test sequence is:

1. `GET /api/health` → expect `200`
2. `POST /api/otp/register` → expect `200` and OTP message
3. frontend root loads normally
4. dashboard route responds

---

## 8. Backend/container operational rules

### 8.1 Route cache rule

Laravel has a closure-based `/health` route, so:

- do not assume `route:cache` is safe

Current safe backend startup pattern:

- `php artisan optimize:clear`
- `php artisan config:cache`
- avoid `php artisan route:cache`

### 8.2 Queue worker rule

Queue worker must be a separate process/container.

Current compose model:

- `backend` → web traffic
- `worker` → queue consumer

### 8.3 Scheduler rule

Laravel scheduler is better as a Dokploy scheduled job than as another long-running app container.

### 8.4 Session rule

For Dokploy deployment, prefer:

- `SESSION_DRIVER=redis`

### 8.5 Storage rule

Laravel storage must survive redeploys.

Current solution:

- named volume `backend-storage`

---

## 9. Database backup and import runbook

### 9.1 Terms

- **Source** = current/old production database
- **Target** = Dokploy Postgres database used by `bsol_hybrid-app`

### 9.2 Preferred migration strategy

1. Test whether source DB is remotely reachable
2. If not reachable, SSH into source server
3. Run local source dump there
4. Import dump into target Dokploy DB
5. Validate core table counts and app behavior separately

### 9.3 Proven live migration notes from this project

This exact migration experience already happened:

- source DB dump was taken locally on the production server
- dump was restored into Dokploy Postgres
- source and target counts matched for `users` and `products`
- `/api/health` was still healthy after import

This proves the DB migration path is viable.

### 9.4 Safety notes

- do not overwrite a meaningful target DB blindly
- if target backup matters, ensure client/server version compatibility first
- PG client major version mismatch can block `pg_dump`
- DB import success does not guarantee app-level workflows will all immediately pass

### 9.5 Validation checklist after import

1. target Postgres accepts connections
2. key tables exist
3. record counts match for a few core tables
4. `/api/health` returns `200`
5. OTP/register or equivalent business route is tested

---

## 10. How to host Hybrid Stack on Dokploy with minimal problems in the future

This is the future-safe runbook.

### 10.1 Before touching Dokploy UI

Make sure the repo already contains:

- compose file
- backend Dockerfile
- frontend Dockerfile
- reverse proxy config
- backend entrypoint script

### 10.2 In Dokploy

1. Create/verify PostgreSQL service
2. Create/verify Redis service
3. Create/verify Compose app
4. Create/verify scheduler job
5. Fill env vars
6. Use temporary domain if production DNS still points elsewhere

### 10.3 Environment strategy

For this project, prefer the already verified values/behavior:

- `REDIS_CLIENT=phpredis`
- DB and Redis through Dokploy host IP + exposed external ports
- `RUN_MIGRATIONS=false` by default
- temporary `APP_DEBUG=true` only while debugging
- restore `APP_DEBUG=false` after diagnosis

### 10.4 Deployment verification

Always verify:

- root page response
- dashboard response
- one frontend asset response
- `/api/health`
- `/api/otp/register`

### 10.5 If something breaks

Fast triage questions:

1. Is it a transient redeploy `502`?
2. Is Redis extension missing?
3. Are DB/Redis env hosts wrong?
4. Is schema missing?
5. Is the issue only appearing after real data import?

### 10.6 Golden rule

Do not change many variables at once.  
Change one thing, redeploy, verify, then continue.

That rule saved time repeatedly in this project.

---

## 11. What the assistant can do with browser access

If the user shares Dokploy pages, the assistant can:

- navigate Dokploy pages
- inspect deployment tabs, env tabs, service tabs, logs
- click buttons
- guide domain mapping and service setup
- read non-secret credentials shown in shared UI if visible

Assistant cannot safely do the following through chat alone:

- invent hidden secrets
- read the user’s local browser if the page is not shared
- send passwords/tokens through normal chat

Best workflow:

1. user opens Dokploy
2. user shares the page
3. user logs in manually if needed
4. assistant performs the guided UI work

---

## 12. What the assistant can do with SSH / terminal access

If terminal access is available and the user types secrets manually when needed, the assistant can:

- inspect app files
- inspect env/config state
- run DB connection tests
- run backup/import commands
- validate health endpoints
- collect logs and diagnose runtime errors

Security rule:

- passwords, tokens, SSH secrets, and API keys should be typed directly by the user when prompted

---

## 13. AI agent operating instructions for future sessions

If an AI agent is asked to deploy `bsol` / `hybrid-stack` to Dokploy, it should:

1. confirm Dokploy scaffold exists in repo
2. confirm target architecture = Postgres + Redis + Compose app + scheduler
3. confirm whether production DNS or temporary domain is being used
4. prefer verified IP+port fallback for DB/Redis in this environment
5. verify PHP Redis extension exists in backend image
6. use `APP_DEBUG=true` only temporarily when diagnosing unknown `500`s
7. distinguish clearly between:
  - connectivity problem
  - missing schema problem
  - transient redeploy problem
  - post-import data/runtime problem
8. if DB is fresh, use one-time `RUN_MIGRATIONS=true`, then disable it again
9. after any important change, verify `/api/health` and then `POST /api/otp/register`
10. document newly learned operational facts back into this file

---

## 14. Quick memory summary

If a future session needs the shortest possible summary, remember this:

- Dokploy on Proxmox VM is valid for this project
- use Postgres + Redis + one Compose app + one scheduler job
- backend needs PHP Redis extension because `REDIS_CLIENT=phpredis`
- internal Dokploy DB/Redis hostnames were unreliable here; IP + exposed ports worked
- transient `502` during redeploy is common noise
- missing schema caused a misleading registration `500`
- one-time `RUN_MIGRATIONS=true` fixed fresh DB bootstrap
- old production DB migration succeeded via source-side dump and target restore
- target PG version mismatch can break local target backups if client is older

---

## 15. Final recommendation

Future hosting of `bsol` on Dokploy should follow this principle:

> **Prepare repo artifacts first, configure environment carefully, validate connectivity separately from schema, and validate business routes separately from health checks.**

That is the core lesson from this entire Dokploy journey.
