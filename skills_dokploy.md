# Dokploy skill — Hybrid Stack hosting playbook

Last updated: 2026-05-22  
Scope: `/var/www/hybrid-stack`

## 1. Purpose

এই ফাইলের উদ্দেশ্য হলো future session-এ দ্রুত মনে করিয়ে দেওয়া:

- এই project Dokploy-এ কীভাবে deploy করতে হবে
- কোন service type ব্যবহার করতে হবে
- কোন mistakes avoid করতে হবে
- browser access / SSH access থাকলে assistant কোথায় পর্যন্ত সাহায্য করতে পারবে
- Dokploy-ready file structure কোথায় রাখা আছে

---

## 2. Current deployment decision

এই project-এর জন্য recommended Dokploy architecture:

1. **PostgreSQL database service**
2. **Redis database service**
3. **One Docker Compose app service**
4. **One Dokploy schedule job** for Laravel scheduler

### Why this is the chosen layout

Project stack multi-service:

- `backend/` → Laravel 13 API
- `frontend/` → Next.js 16 app
- PostgreSQL → primary relational database
- Redis → cache + queue
- Queue worker → separate process required
- Same domain routing required:
  - `/` → frontend
  - `/api/*` → backend
  - `/sanctum/*` → backend
  - `/storage/*` → backend
  - `/lp/*` → backend public landing pages

Because of this, **single Dokploy Application is not enough**.  
**Docker Compose** is the cleanest Dokploy fit.

---

## 3. Important hosting constraint learned

Earlier production context said Docker was unreliable inside a specific **LXC** host.

### Updated rule

- If Dokploy runs on a **proper VM in Proxmox**, Docker deployment is acceptable.
- If Dokploy runs on the old problematic **LXC host**, avoid using it for production runtime.

Current user clarified:

- Dokploy server is running inside a **Proxmox VM** ✅

So Dokploy deployment is now considered valid for this project.

---

## 4. Services already created in Dokploy

From the user's screenshot:

- `bsol_hybrid-app`
- `hybrid-redis`
- `bsol_hybrid-postgres`

Interpretation:

- `bsol_hybrid-app` should be the **Docker Compose** service
- `hybrid-redis` is the Redis DB service
- `bsol_hybrid-postgres` is the PostgreSQL DB service

---

## 5. Files created in repo for Dokploy

### Root

- `docker-compose.dokploy.yml` → main Dokploy compose stack
- `.env` → local placeholder values for compose-based deployment
- `.env.dokploy.example` → safe reference template for Dokploy envs

### Frontend

- `frontend/Dockerfile.dokploy` → Next.js production image build
- `frontend/.dockerignore` → excludes build noise from Docker context

### Backend

- `backend/Dockerfile.dokploy` → Laravel production image build
- `backend/.dockerignore` → excludes runtime/cache noise from Docker context
- `backend/docker/dokploy/000-default.conf` → Apache vhost pointing to `public/`
- `backend/docker/dokploy/entrypoint.sh` → Laravel container startup script

### Reverse proxy

- `deploy/dokploy/nginx/default.conf` → routes `/` to frontend and `/api`/`/storage`/`/lp` to backend

---

## 6. Dokploy UI configuration that should be used

### Compose service (`bsol_hybrid-app`)

Recommended settings:

- **Service type:** Docker Compose
- **Compose file:** `docker-compose.dokploy.yml`
- **Repository root:** `/var/www/hybrid-stack`
- **Branch:** production branch / main branch as chosen by owner

### Domain mapping

Attach domain to the **proxy** container on port `80`.

Public routing expected:

- `/` → `frontend`
- `/dashboard` → `frontend`
- `/api/*` → `backend`
- `/sanctum/*` → `backend`
- `/storage/*` → `backend`
- `/lp/*` → `backend`

### Scheduler job

Create a Dokploy **Compose Job** or equivalent scheduled job:

- command: `php artisan schedule:run`
- target service/container: `backend`
- cron: `* * * * *`

---

## 7. Required environment variables

Minimum required vars:

- `APP_NAME`
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL`
- `APP_KEY`
- `FRONTEND_URL`
- `DB_CONNECTION=pgsql`
- `DB_HOST`
- `DB_PORT=5432`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT=6379`
- `REDIS_PASSWORD` (if configured)
- `CACHE_STORE=redis`
- `QUEUE_CONNECTION=redis`
- `SESSION_DRIVER=redis`
- `SANCTUM_STATEFUL_DOMAINS`
- `NEXT_PUBLIC_API_BASE_URL`

### Important note

Do **not** keep real secrets in repo.  
Use Dokploy environment variables UI for production values.

---

## 8. Operational lessons learned

### 8.1 Route cache warning

Laravel `routes/api.php` contains a closure-based `/health` route.

That means:

- `php artisan route:cache` can fail
- do **not** assume full `optimize` route caching is safe

Current backend entrypoint therefore uses:

- `php artisan optimize:clear`
- `php artisan config:cache`

and intentionally **does not** run `route:cache`.

### 8.2 Queue worker separation

Laravel queue worker must run as a separate process/container.

Current compose stack includes:

- `backend` → web traffic
- `worker` → queue worker

### 8.3 Scheduler strategy

Laravel scheduler is better managed via Dokploy scheduled jobs instead of another always-on scheduler container.

### 8.4 Session storage choice

For Dokploy/container deployment, `SESSION_DRIVER=redis` is preferred over file sessions.

### 8.5 Storage persistence

Laravel `storage/` must persist across redeployments.

Current compose stack uses a named volume:

- `backend-storage`

---

## 9. What the assistant can do with browser access

Yes — the assistant can help operate Dokploy **through the browser tools**, but only with these boundaries:

### Possible

- open/shared page navigation
- clicking buttons
- filling non-sensitive fields
- checking logs, status, env screens, deployment tabs
- guiding domain mapping and compose config steps

### Not possible automatically

- accessing the user's local browser unless the page is shared
- reading hidden credentials magically
- typing passwords/API secrets supplied through chat if they are sensitive

### Best workflow

1. User opens Dokploy page
2. User shares that page with the assistant
3. User logs in manually if required
4. Assistant handles the rest of the UI steps

---

## 10. What the assistant can do with SSH access

Yes — if the user provides terminal access on the machine and logs in manually where needed, the assistant can:

- inspect files
- prepare deployment configs
- run non-secret commands
- validate Docker/compose files
- help with Dokploy-side setup commands

### Security rule

Passwords, tokens, API keys, SSH secrets should not be sent through normal chat text.  
If terminal login prompts for secrets, the user should type them directly.

---

## 11. Current recommended next steps

1. Open `bsol_hybrid-app` in Dokploy
2. Set it as a **Docker Compose** service
3. Point it to `docker-compose.dokploy.yml`
4. Add production env vars from `.env.dokploy.example`
5. Set domain to the proxy container port `80`
6. Deploy
7. Create scheduler job with `php artisan schedule:run`
8. Verify:
   - `/`
   - `/api/health`
   - `/dashboard`
   - `/storage/...` asset access if applicable

---

## 12. If a future session continues this journey

Use this file as a quick context source and remember:

- We are targeting **Dokploy on Proxmox VM**
- Preferred pattern is **Postgres + Redis + one Compose app + scheduler job**
- Repo already contains a Dokploy scaffold
- If user shares Dokploy browser page, assistant can do the UI work interactively
- If user provides terminal/SSH access, assistant can do the shell-side work interactively
