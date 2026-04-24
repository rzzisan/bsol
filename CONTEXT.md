# Hybrid Stack Server Context

Last updated: 2026-04-24
Domain: `bsol.zyrotechbd.com`
Server IP: `103.157.253.197`

## 1. Objective

এই সার্ভারকে একটি production-ready Hybrid Stack environment হিসেবে প্রস্তুত করা হয়েছে যাতে নিচের stack ব্যবহার করে SaaS project develop ও deploy করা যায়:

- Backend: Laravel
- Frontend: Next.js
- Database: PostgreSQL
- Cache / Queue: Redis
- Web server / Reverse proxy: Nginx
- Process manager: Supervisor
- SSL: Let's Encrypt (Certbot)

---

## 2. Important environment fact

এই host একটি `LXC` environment-এর ভিতরে চলছে। এর আগে যাচাই করে দেখা গেছে এই host-এ Docker-based production deployment নির্ভরযোগ্য নয়। তাই project runtime native Linux packages দিয়ে configure করা হয়েছে।

### Why native stack was chosen

- LXC host-এ Docker container startup issue ছিল
- Native services (`nginx`, `php-fpm`, `postgresql`, `redis`, `supervisor`) এখানে বেশি stable
- Production troubleshooting সহজ
- Resource overhead কম

---

## 3. What was installed

নিচের runtime ও service packages install করা হয়েছে:

- `nginx`
- `php8.3-cli`
- `php8.3-fpm`
- `php8.3-pgsql`
- `php8.3-mbstring`
- `php8.3-xml`
- `php8.3-curl`
- `php8.3-zip`
- `php8.3-bcmath`
- `php8.3-intl`
- `php8.3-gd`
- `php8.3-sqlite3`
- `php-redis`
- `composer`
- `nodejs` (Node 22 via NodeSource repo)
- `postgresql`
- `redis-server`
- `supervisor`
- `certbot`
- `python3-certbot-nginx`

---

## 4. Project structure

Project root:

`/var/www/hybrid-stack`

### Subfolders

- `/var/www/hybrid-stack/backend` → Laravel backend
- `/var/www/hybrid-stack/frontend` → Next.js frontend

### Why this structure

- Backend এবং frontend clearly separated
- SaaS API এবং dashboard আলাদা lifecycle-এ maintain করা সহজ
- Reverse proxy configuration simpler হয়

---

## 5. Backend setup details

Laravel project create করা হয়েছে:

- Laravel version: `13.x`
- API scaffolding enabled
- Sanctum installed for API token-based authentication foundation

### Backend files edited

#### `/var/www/hybrid-stack/backend/.env`
Configured for production-style PostgreSQL + Redis environment.

Key changes:
- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://bsol.zyrotechbd.com`
- PostgreSQL connection added
- Redis cache/queue enabled
- Session driver set to file
- `FRONTEND_URL=https://bsol.zyrotechbd.com`

#### `/var/www/hybrid-stack/backend/app/Models/User.php`
Added:
- `Laravel\Sanctum\HasApiTokens`

Reason:
- Future SaaS API authentication-ready foundation

#### `/var/www/hybrid-stack/backend/routes/api.php`
Added:
- `/api/health`

Reason:
- Quick health check for deployment, monitoring, reverse proxy verification

### Backend production prep executed

- Database migrations run on PostgreSQL
- Laravel optimize command run
- Storage symlink checked

---

## 6. Database setup details

Database engine:
- PostgreSQL 16

Created:
- DB user: `hybrid_app`
- DB database: `hybrid_platform`

### Important note

কারণ PostgreSQL cluster default encoding ছিল `SQL_ASCII`, তাই database create করার সময় `template0` ব্যবহার করে UTF-8 database create করা হয়েছে.

Reason:
- Laravel and modern web apps-এর জন্য UTF-8 safer choice

### Sensitive credentials

Database password backend `.env`-এ configured আছে, কিন্তু security reason-এ এই context file-এ secret value intentionally রাখা হয়নি। পরে rotate করা উচিত.

---

## 7. Frontend setup details

Next.js app create করা হয়েছে:

- Next.js version: `16.x`
- TypeScript enabled
- Tailwind enabled
- ESLint enabled
- App Router enabled

### Frontend files edited

#### `/var/www/hybrid-stack/frontend/src/app/page.tsx`
Default starter page replace করে custom deployment-status landing page বসানো হয়েছে.

Reason:
- Server setup complete হয়েছে কিনা instantly visible করার জন্য
- আপনার future SaaS dashboard-এর placeholder হিসেবে কাজ করার জন্য

#### `/var/www/hybrid-stack/frontend/.env.local`
Added public app config values, including API base URL.

Current API base URL:
- `https://bsol.zyrotechbd.com/api`

---

## 8. Nginx configuration

Main active site config:

`/etc/nginx/sites-available/default`

### How routing works

- `/` → proxied to Next.js on `127.0.0.1:3001`
- `/api` and `/api/*` → served by Laravel via `php8.3-fpm`
- `/sanctum/csrf-cookie` → routed to Laravel
- `/storage` → static access from Laravel public root

### Why this design was used

- Same domain under one host
- Frontend and API can share cookies/session strategy later if needed
- Clean SaaS deployment model

---

## 9. Supervisor configuration

Supervisor config file:

`/etc/supervisor/conf.d/hybrid-stack-frontend.conf`

### What it does

Runs Next.js production server automatically:

- Working directory: `/var/www/hybrid-stack/frontend`
- Command: `npm run start -- --hostname 127.0.0.1 --port 3001`
- User: `www-data`
- Auto restart enabled

### Why Supervisor was used

- Next.js app auto-restart after reboot/crash
- Easier than keeping manual terminal session alive
- Production-friendly process supervision

---

## 10. SSL and domain setup

Requested domain:
- `bsol.zyrotechbd.com`

### Domain validation result

Confirmed that:
- `bsol.zyrotechbd.com` resolves to `103.157.253.197`

### SSL setup performed

Installed:
- `certbot`
- `python3-certbot-nginx`

Certificate issued using Let's Encrypt for:
- `bsol.zyrotechbd.com`

### Certificate paths

- Certificate: `/etc/letsencrypt/live/bsol.zyrotechbd.com/fullchain.pem`
- Private key: `/etc/letsencrypt/live/bsol.zyrotechbd.com/privkey.pem`

### What Certbot changed

- Added HTTPS listener on port `443`
- Added SSL certificate references to Nginx config
- Added HTTP → HTTPS redirect
- Enabled `certbot.timer` for auto-renewal

### Verified results

- `https://bsol.zyrotechbd.com` returns `200 OK`
- `http://bsol.zyrotechbd.com` returns `301` redirect to HTTPS
- `certbot.timer` is enabled and active
- Certificate expiry currently: `2026-07-22`

---

## 11. Current live endpoints

### Main site
- `https://bsol.zyrotechbd.com/`

### API health
- `https://bsol.zyrotechbd.com/api/health`

---

## 12. Service status expected now

These services were enabled and started:

- `nginx`
- `php8.3-fpm`
- `postgresql`
- `redis-server`
- `supervisor`
- `certbot.timer`

### App runtime

- Next.js frontend runs under Supervisor on `127.0.0.1:3001`
- Laravel API runs through `php-fpm` behind Nginx

---

## 13. Files that matter most

### Server / runtime
- `/etc/nginx/sites-available/default`
- `/etc/supervisor/conf.d/hybrid-stack-frontend.conf`
- `/etc/letsencrypt/live/bsol.zyrotechbd.com/`

### Backend
- `/var/www/hybrid-stack/backend/.env`
- `/var/www/hybrid-stack/backend/routes/api.php`
- `/var/www/hybrid-stack/backend/app/Models/User.php`

### Frontend
- `/var/www/hybrid-stack/frontend/.env.local`
- `/var/www/hybrid-stack/frontend/src/app/page.tsx`

---

## 14. Why these choices were made

### Laravel for backend
- SaaS/API structure clear
- WordPress integration future-friendly
- Relational DB use-case fit করে

### Next.js for frontend
- Modern dashboard/UI build easier
- React ecosystem strong
- Reverse proxy deployment straightforward

### PostgreSQL
- Relational SaaS data model-এর জন্য strong choice
- Order, customer, subscription, billing data later cleanly handle করা যাবে

### Redis
- Queue, cache, future job processing foundation

### Nginx + Supervisor
- Lightweight
- Proven production stack
- Easy to maintain on VPS/LXC

---

## 15. Known follow-up recommendations

These are recommended next steps:

1. Database password rotate করা
2. Domain-based CORS / Sanctum stateful config tune করা
3. Queue worker add করা if background jobs start
4. Cron job / scheduler add করা for Laravel scheduled tasks
5. Real landing/dashboard build শুরু করা
6. WordPress plugin integration design করা
7. Basic monitoring এবং backup strategy add করা

---

## 16. Suggested next engineering phase

If development continues, best next steps are:

- Multi-tenant SaaS data model design
- Auth / admin panel foundation
- Subscription module
- Order intake API
- WooCommerce / WordPress connector
- Fake order intelligence module

---

## 17. Quick summary

এই conversation-এ যা করা হয়েছে, সংক্ষেপে:

- Server capability audit করা হয়েছে
- Docker বাদ দিয়ে native stack বেছে নেওয়া হয়েছে
- Laravel + Next.js + PostgreSQL stack install ও configure করা হয়েছে
- Laravel backend scaffold + API health endpoint তৈরি করা হয়েছে
- Next.js frontend scaffold + deployment page তৈরি করা হয়েছে
- PostgreSQL database/user তৈরি ও migrations run করা হয়েছে
- Redis এবং Supervisor configure করা হয়েছে
- Nginx reverse proxy setup করা হয়েছে
- Domain `bsol.zyrotechbd.com` bind করা হয়েছে
- Let's Encrypt SSL issue করা হয়েছে
- HTTP → HTTPS redirect enable করা হয়েছে
- Auto-renewal active করা হয়েছে

এই file-এর উদ্দেশ্য হলো future development-এর সময় context হারিয়ে না ফেলা এবং কোথায় কী আছে তা দ্রুত বুঝে নেওয়া.

---

## 18. SaaS product foundation update (2026-04-24)

Project owner requirement অনুযায়ী frontend-এ এখন একটি **feature-presentation-first foundation shell** তৈরি করা হয়েছে, যা Bangladesh-focused F-commerce SaaS vision দেখানোর জন্য optimized।

### What was implemented now

#### `/var/www/hybrid-stack/frontend/src/app/page.tsx`
Previous auth-centric UI replace করে একটি modular SaaS foundation page বসানো হয়েছে যেখানে:

- বাংলা / English language switcher
- Dark / Light theme switcher
- Mobile-first responsive layout
- 5টি core module presentation:
	1. Automated Order + Courier Management
	2. Fake Order Filtering + Customer Rating
	3. Landing Page + Single-page Checkout Builder
	4. Inventory + Ads ROI Tracker
	5. Messenger CRM + Broadcast
- MVP roadmap blocks (Phase 1/2/3)
- API health check CTA (`/api/health`) রাখা হয়েছে যাতে backend connectivity visible থাকে

#### `/var/www/hybrid-stack/frontend/src/app/globals.css`
Theme token system add করা হয়েছে:

- Shared design tokens: `--background`, `--foreground`, `--surface`, `--surface-soft`, `--border`, `--muted`, `--accent`
- `html[data-theme="light"]` এর মাধ্যমে light mode override
- Smooth color transition support

#### `/var/www/hybrid-stack/frontend/src/app/layout.tsx`
Metadata update করা হয়েছে যেন application purpose reflect করে:

- Title: `Hybrid Commerce SaaS`
- Description: bilingual mobile-first F-commerce SaaS foundation

### Why this foundation matters

- Product pitch/demo immediately possible
- Future dashboard modules plug-in করার জন্য section-based skeleton ready
- UI system এখন থেকেই bilingual + theming-aware হওয়ায় redesign cost কমবে
- Backend API integration expand করা সহজ হবে (existing Laravel `/api/*` structure compatible)

### Suggested next build steps from this baseline

1. Auth পুনরায় modular form-এ ফিরিয়ে আনা (separate `/auth` route)
2. Dashboard route groups তৈরি (`/orders`, `/couriers`, `/crm`, `/analytics`)
3. Shared component library তৈরি (cards, tables, labels, filters, modal)
4. Courier adapter interface define করা (Pathao/Steadfast/RedX)
5. Fake-order risk scoring-এর জন্য backend schema draft করা

---

## 19. Deployment incident note (2026-04-24)

### Issue observed

Frontend source + build artifact আপডেট থাকলেও live domain-এ কিছুক্ষণ **পুরনো auth UI** দেখা যাচ্ছিল।

### Root cause

- Next.js production process (`next start`) Supervisor-এর অধীনে চলছিল
- নতুন `npm run build` হওয়ার পর process restart করা হয়নি
- ফলে runtime পুরনো build snapshot serve করছিল

### Fix applied

1. `supervisorctl status` দিয়ে process verify
2. `supervisorctl restart hybrid-stack-frontend` run
3. domain HTML verify করে নতুন title/content confirm:
	- `Hybrid Commerce SaaS`
	- নতুন Bengali/English + theme-aware landing shell

### Operational reminder

Frontend deploy flow-এ build-এর পর restart mandatory:

1. `npm run build`
2. `supervisorctl restart hybrid-stack-frontend`
3. live smoke check (`/` and `/api/health`)
