⚠️ বাধ্যতামূলক নির্দেশনা: এই `CONTEXT.md` ফাইলটি শুরু থেকে শেষ পর্যন্ত সম্পূর্ণ পড়া শেষ না করে কোনো development কাজ শুরু করা যাবে না।
আংশিক পড়ে কাজ শুরু করা হলে সেটি invalid execution হিসেবে গণ্য হবে।
# Hybrid Stack Server Context

Last updated: 2026-04-25
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

---

## 20. Ongoing frontend development directives

Future frontend development-এর জন্য নিচের rules follow করতে হবে:

### Page/content rules

- প্রতিটি **নতুন page** বাংলা এবং English—উভয় ভাষায় usable হতে হবে
- Language switcher support ছাড়া কোনো new public-facing page final ধরা যাবে না
- Text/content structure এমনভাবে লিখতে হবে যাতে later i18n extraction সহজ হয়

### UI/UX rules

- প্রতিটি নতুন page এবং component **mobile-first** approach-এ build করতে হবে
- Small screen, tablet, এবং desktop—সব viewport-এ readable ও usable layout নিশ্চিত করতে হবে
- Dark / Light theme compatibility maintain করতে হবে

### Build and deployment rules

- Frontend-এ নতুন code, UI change, route change, styling change, বা content update করার পর **frontend build mandatory**
- Required deploy flow:
	1. `cd /var/www/hybrid-stack/frontend`
	2. `npm run build`
	3. `supervisorctl restart hybrid-stack-frontend`
	4. live smoke check (`/` and `/api/health`)

### Practical expectation

- কোনো নতুন screen implement করলে by default bilingual + responsive + theme-aware হিসেবে build করতে হবে
- শুধু desktop view target করে page তৈরি করা যাবে না
- build verification ছাড়া frontend change complete ধরা যাবে না

---

## 21. Homepage auth implementation update (2026-04-24)

Project owner request অনুযায়ী homepage-এ login + registration form fully integrate করা হয়েছে এবং backend API-এর সাথে end-to-end কাজ নিশ্চিত করা হয়েছে।

### Backend changes

#### `/var/www/hybrid-stack/backend/database/migrations/2026_04_24_093035_add_mobile_to_users_table.php`
- `users` table-এ `mobile` column add করা হয়েছে

#### `/var/www/hybrid-stack/backend/app/Models/User.php`
- Fillable list update করে `mobile` include করা হয়েছে

#### `/var/www/hybrid-stack/backend/app/Http/Controllers/AuthController.php`
- Register validation-এ `mobile` field add করা হয়েছে
- Validation rules:
	- required
	- string
	- max:20
	- mobile format regex check
	- unique in users table
- Password confirmed + minimum length (`8`) rule active আছে

### Frontend changes

#### `/var/www/hybrid-stack/frontend/src/app/page.tsx`
Homepage-এ bilingual auth section add করা হয়েছে:

- Login tab:
	- Email
	- Password
- Registration tab:
	- Name
	- Mobile number
	- Email address
	- Password
	- Confirm password
- Client-side validation:
	- password minimum 8 characters
	- confirm password match check
- Success flow:
	- API success হলে token + user data localStorage-এ store হয়
	- logged-in state UI show করে (name/email/mobile)
	- logout action included
- UI compatibility:
	- বাংলা / English supported
	- dark / light theme compatible
	- mobile-first responsive layout maintained

### Deployment steps executed

1. Backend migration run:
	 - `php artisan migrate --force`
2. Frontend production build run:
	 - `npm run build`
3. Frontend runtime restart:
	 - `supervisorctl restart hybrid-stack-frontend`
4. Smoke checks:
	 - `https://bsol.zyrotechbd.com/api/health` returns `status: ok`
	 - `https://bsol.zyrotechbd.com/` returns HTTP `200`

---

## 22. Mandatory design & layout consistency policy (2026-04-24)

Project owner feedback অনুযায়ী notice করা হয়েছে যে admin-related নতুন page-গুলোর মধ্যে design ধারাবাহিকতা ভেঙে গিয়েছিল। তাই এখন থেকে নিচের policy **mandatory**:

### Core principle

- পুরো application-এ একটি unified design language maintain করতে হবে
- নতুন page বা module implement করার সময় existing dashboard design থেকে বিচ্যুতি করা যাবে না, unless explicitly approved
- “Function works” যথেষ্ট না — “visual consistency” equally required

### Design system source of truth

Frontend styling-এর primary source:

- `/var/www/hybrid-stack/frontend/src/app/globals.css`

Theme token rules:

- নতুন UI-তে hardcoded random color ব্যবহার করা যাবে না যদি token equivalent থাকে
- Primary token family reuse করতে হবে:
	- `--background`
	- `--foreground`
	- `--surface`
	- `--surface-soft`
	- `--border`
	- `--muted`
	- `--accent`
- Dark এবং Light mode-এ contrast/readability preserve করতে হবে

### Admin dashboard layout continuity rules

Admin route group-এর সব পেজে নিচের structure maintain করতে হবে:

1. Top header bar (consistent height, spacing, action alignment)
2. Left sidebar navigation (same width behavior + collapse/expand pattern)
3. Same sidebar color family and active-state pattern
4. Same content container spacing/grid rhythm
5. Same card/table border radius, shadow depth, and border treatment

### Sidebar and menu behavior rules

- Sidebar collapse/expand interaction সব admin sub-page-এ identical হতে হবে
- Menu hierarchy maintain করতে হবে:
	- Main menu click → submenu expand/collapse (if children exist)
- Active route highlight সবসময় visible থাকতে হবে
- Submenu item spacing, typography, এবং indicator style consistent হতে হবে

### Table UI consistency rules (for customer/package/billing lists)

- Table header background, text color, এবং row border style shared হতে হবে
- Zebra/hover behavior consistent হতে হবে
- Cell padding এবং typography scale fixed রাখতে হবে
- Status badge style (active/pending/paid/due) reusable pattern হিসেবে define ও reuse করতে হবে
- একই ধরনের data table-এ একই column alignment convention follow করতে হবে

### Component reuse expectation

যেসব UI pattern বারবার আসবে সেগুলো reusable component হিসেবে centralize করতে হবে (gradually):

- Sidebar shell
- Top header bar
- Stats card
- Data table wrapper
- Status badges

### Delivery and review checklist (must pass before marking complete)

প্রতি frontend UI task complete বলার আগে verify করতে হবে:

1. Existing admin/user design language-এর সাথে visual match আছে কিনা
2. Mobile/tablet/desktop-এ layout break করছে কিনা
3. Dark/light theme-এ color mismatch আছে কিনা
4. বাংলা/English text length change-এ alignment ভাঙছে কিনা
5. Build run হয়েছে কিনা (`npm run build`)
6. Supervisor restart + smoke check হয়েছে কিনা

### Operational enforcement

- Future context update-এর সময় যদি নতুন কোনো design exception নেওয়া হয়, এখানে explicitly লিখতে হবে
- Design inconsistency report হলে next task-এ bug-priority হিসেবে fix করতে হবে
- এই policy ignore করে করা UI change “final” হিসেবে গ্রহণযোগ্য হবে না

---

## 23. External reference projects: `catv` এবং `zyro` (2026-04-25)

বর্তমান `hybrid-stack` project-এ future development acceleration-এর জন্য root-level দুইটি আলাদা project reference হিসেবে ব্যবহার করা হবে:

- `/var/www/hybrid-stack/catv`
- `/var/www/hybrid-stack/zyro`

এগুলো **runtime dependency** নয়; এগুলো primarily **implementation reference / code example source** হিসেবে ব্যবহার হবে।

### 23.1 `catv` project সম্পর্কে সংক্ষিপ্ত ধারণা

`catv` একটি Bengali-first CATV billing product codebase, যেখানে:

- Frontend: React + Vite + React Router
- Backend: Node.js + Express
- Database: MariaDB via Prisma
- Auth: JWT + phone/password ভিত্তিক flow

Observed reusable patterns:

- Layout shell pattern (`AppLayout`, Sidebar, Topbar, responsive collapse/off-canvas)
- Modular page segmentation (Areas/Managers/Collectors/Billing/Reports)
- Frontend থেকে `/api/*` consume করার clean structure
- Express route grouping + health endpoint style

### 23.2 `zyro` project সম্পর্কে সংক্ষিপ্ত ধারণা

`zyro` একটি large-scale PHP SaaS platform, যেখানে API-first এবং multi-website/multi-tenant pattern heavily ব্যবহৃত:

- Core stack: Native PHP (MVC-style structure), MySQL/MariaDB, Tailwind-based UI
- Strong service separation: Controllers / Models / Services / Core
- API security pattern: API key + domain binding (`core/api_auth_guard.php`)
- Operational modules: Fraud check, landing template system, automation jobs, marketing/courier/CAPI integrations

Observed reusable patterns:

- Thin-client integration mindset (plugin/client side minimal logic)
- Queue-first async processing guideline (jobs table + cron workers)
- Reusable response/validation/service abstraction approach
- Changelog-driven iterative delivery discipline

### 23.3 `hybrid-stack`-এ এই দুই project কীভাবে ব্যবহার হবে

`backend` (Laravel) এবং `frontend` (Next.js)-এ feature implement করার সময়:

1. `catv` থেকে primarily UI shell, navigation behavior, module breakdown, এবং API consumption style reference নেওয়া হবে
2. `zyro` থেকে primarily API security, multi-tenant isolation, service-layer ভাবনা, async job processing, এবং product workflow reference নেওয়া হবে
3. Copy-paste নয়; **concept adaptation** করতে হবে যেন Laravel 13 + Next.js 16 architecture-এর সাথে fully compatible থাকে

### 23.4 Reference ব্যবহার করার mandatory guardrails

- কোনো secret, token, password, বা hardcoded domain reference project থেকে copy করা যাবে না
- `catv/CONTEXT-production.md`-এ conflict marker থাকলে সেটা source-of-truth হিসেবে use করা যাবে না; stable guidance হিসেবে `catv/CONTEXT.md` এবং actual code structure verify করতে হবে
- `zyro`-র PHP example সরাসরি `hybrid-stack/frontend`-এ ব্যবহার করা যাবে না; pattern translate করে implement করতে হবে
- `hybrid-stack`-এর established policies (bilingual, mobile-first, dark/light theme, design consistency) সবসময় final authority হবে

### 23.5 Practical expectation for future tasks

- নতুন feature implement করার আগে engineer/agent প্রথমে `CONTEXT.md` + relevant reference section পড়ে scope confirm করবে
- Required হলে `catv`/`zyro` থেকে only minimal relevant snippet inspect করা হবে
- Final implementation সবসময় `hybrid-stack` coding standard, deployment flow, এবং architecture boundary follow করবে

---

## 24. Frontend build হলেও নতুন design live না হওয়ার incident note (2026-04-25)

### Issue summary

Frontend-এ নতুন code + `npm run build` successful হলেও live domain-এ page plain/unstyled দেখাচ্ছিল এবং login form submit করলে URL-এ query string (`?login_email=...&login_password=...`) যোগ হচ্ছিল।

### Verified root cause

এটা backend restart issue ছিল না।

মূল সমস্যা ছিল **stale Next.js runtime process + chunk mismatch**:

1. Running process পুরনো build reference ধরে ছিল
2. নতুন build overwrite হওয়ার পরে পুরনো CSS chunk file আর filesystem-এ ছিল না
3. HTML old CSS chunk path serve করছিল (`/_next/static/chunks/...css`), কিন্তু asset request `500` দিচ্ছিল
4. CSS/JS load না হওয়ায় page plain দেখাচ্ছিল এবং client-side form handler attach না হয়ে browser default GET submit করছিল

### Fix applied

1. Frontend process restart করা হয়েছে (`supervisorctl restart hybrid-stack-frontend`)
2. নতুন runtime PID confirm করা হয়েছে
3. live HTML থেকে বর্তমান CSS chunk path verify করা হয়েছে
4. CSS chunk response `200 OK` confirm করা হয়েছে

### How to detect this problem quickly (future)

Symptoms দেখলে বুঝবে frontend runtime stale:

- UI suddenly plain (Tailwind/style apply হচ্ছে না)
- login/register submit করলে URL-এ raw query params চলে আসে
- Browser devtools-এ `/_next/static/chunks/*.css` বা `*.js` request fail (often 404/500)

### Mandatory safe deploy flow (frontend)

Frontend deploy-এর পরে নিচের flow strictভাবে follow করতে হবে:

1. `cd /var/www/hybrid-stack/frontend`
2. `npm run build`
3. `supervisorctl restart hybrid-stack-frontend`
4. `supervisorctl status hybrid-stack-frontend` (must be `RUNNING`)
5. live smoke check:
	- `https://bsol.zyrotechbd.com/`
	- `https://bsol.zyrotechbd.com/api/health`
6. asset check (recommended): homepage HTML থেকে current CSS chunk path নিয়ে ensure `200 OK`

### Operational guardrail

- **Never** treat frontend deployment complete after build only
- Build success + process restart + asset health check — তিনটি pass না করলে deployment incomplete ধরা হবে
- যদি restart মাঝপথে interrupted হয়, সঙ্গে সঙ্গে `status` check করে process আবার start/restart করতে হবে

