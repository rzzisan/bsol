⚠️ বাধ্যতামূলক নির্দেশনা: এই `CONTEXT.md` ফাইলটি শুরু থেকে শেষ পর্যন্ত সম্পূর্ণ পড়া শেষ না করে কোনো development কাজ শুরু করা যাবে না।
আংশিক পড়ে কাজ শুরু করা হলে সেটি invalid execution হিসেবে গণ্য হবে।
# Hybrid Stack Server Context

Last updated: 2026-08-10 — **§৩১ যোগ হয়েছে: Staff/Team sub-account role এখন মাস্টার mandatory rule হিসেবে যোগ করা হয়েছে — নতুন যেকোনো ফিচার/মডিউল তৈরির আগে অবশ্যই পড়তে হবে** (সম্পূর্ণ reference: `staff_team_role_context.md`)। Older entries kept as-is:

Last updated: 2026-07-28 — Supervisor fully removed from frontend management (§28), landing pages bilingual bn/en support + dashboard-wide instant language-switch fix via LocaleContext (§29, §30).

📄 **সহ-ডকুমেন্ট**: ল্যান্ডিং পেজ বিল্ডার ফিচার (backend + frontend, সব ফাইল/লাইন নম্বরসহ)-এর জন্য আলাদা deep-reference ফাইল আছে — `/var/www/hybrid-stack/landing_page_context.md`। এই `CONTEXT.md` server/ops/deployment-level master context; landing-page-builder-related কাজের আগে ওই ফাইলটাও পড়ে নাও, এখানে সেটার বিষয়বস্তু ডুপ্লিকেট করা হয়নি।
Native/local host domain: `bsol.zyrotechbd.com`
Dokploy-hosted domain: `bsol.zisan.me`
Native/local host server IP: `103.157.253.197`

## 🚨 Mandatory domain selection rule (added: 2026-05-30)

Project owner directive (strict):

- Development, testing, debugging, UI verification, এবং feature validation-এর **default target সবসময়** `bsol.zyrotechbd.com` (local/native host) হবে।
- User explicitly না বললে `bsol.zisan.me` (Dokploy/remote) domain-এ navigation, পরীক্ষা, বা verification করা যাবে না।
- কোনো automation/agent/browser flow শুরু করার আগে domain resolve checklist run করতে হবে:
	1. User কি local বলেছে? → তাহলে `bsol.zyrotechbd.com` only
	2. User কি explicit remote/Dokploy বলেছে? → তখনই `bsol.zisan.me`
	3. Ambiguous হলে safe default = local domain

### Execution guardrail

- Domain mismatch prevent করার জন্য সব task-এ প্রথমে target domain announce/lock করতে হবে (internally):
	- `TARGET_DOMAIN=bsol.zyrotechbd.com` (default)
- Remote domain-এ accidental drift হলে সেটি execution error হিসেবে গণ্য হবে এবং সঙ্গে সঙ্গে local domain-এ ফিরে আসতে হবে।

### Practical examples

- Correct (default):
	- `https://bsol.zyrotechbd.com/dashboard/landing-pages/5/edit`
	- `https://bsol.zyrotechbd.com/api/health`
- Use only when explicitly requested for Dokploy validation:
	- `https://bsol.zisan.me/...`

এই rule future সব development/support session-এ mandatory authority হিসেবে প্রযোজ্য হবে।

## 🚨 Frontend process manager পরিবর্তন (added: 2026-07-23)

**গুরুত্বপূর্ণ:** এই ডকুমেন্টের পরবর্তী অংশে (এবং Section 9-এ) Next.js frontend-এর জন্য যেখানেই `supervisorctl restart hybrid-stack-frontend` / `supervisorctl status hybrid-stack-frontend`-জাতীয় কমান্ড উল্লেখ আছে, সেগুলো **আর সঠিক নয়** — নিচের বাস্তবতা এখন কার্যকর:

- Frontend (`127.0.0.1:3001`) এখন **systemd** দিয়ে ম্যানেজ হয়: `hybrid-frontend.service` (`Restart=always`, `User=root`, `ExecStart=/usr/bin/npm run start`)
- একটা `hybrid-healthcheck.timer` প্রতি মিনিটে `bsol.zyrotechbd.com`-এ frontend/backend health চেক করে এবং প্রয়োজনে `systemctl restart hybrid-frontend.service` (এবং backend অস্বাভাবিক হলে `php8.3-fpm`/`nginx`) চালায় — স্ক্রিপ্ট: `/usr/local/bin/hybrid-healthcheck.sh`
- Supervisor-এর `hybrid-stack-frontend` প্রোগ্রাম ডেফিনিশন **(2026-07-28 আপডেট) সম্পূর্ণ ডিলিট করা হয়েছে** — `/etc/supervisor/conf.d/` এখন সম্পূর্ণ খালি, কোনো `.conf` বা `.conf.disabled` backup ফাইল নেই। কারণ: সেটা systemd-এর সাথে port 3001-এর জন্য conflict করছিল এবং কখনোই সফলভাবে সার্ভ করছিল না (সবসময় FATAL দেখাত, যদিও সাইট আসলে systemd দিয়ে সচল ছিল)। একবার (2026-07-28) কেউ ভুলবশত ওই `.disabled` backup ফাইলকে `.conf`-এ rename করে `supervisorctl reread/update` চালালে সাথে সাথে systemd vs supervisor port-3001 conflict আবার reproduce হয় (দেখো §28) — তাই backup ফাইলটা রাখাই বিপজ্জনক প্রমাণিত হয়েছে, সম্পূর্ণ delete করে দেওয়া হয়েছে। `supervisor` systemd service নিজে এখনো installed/enabled/active আছে কিন্তু **কোনো program manage করে না** (`conf.d` খালি) — ভবিষ্যতে অন্য কোনো non-frontend প্রসেসের জন্য দরকার হলে ব্যবহার করা যাবে, কিন্তু frontend-এর জন্য আর কখনো `.conf` file পুনরায় তৈরি করা যাবে না।

### সঠিক কমান্ড (এখন থেকে ব্যবহার করুন)

```bash
systemctl status hybrid-frontend.service
systemctl restart hybrid-frontend.service
journalctl -u hybrid-frontend.service -n 50 --no-pager
```

Port `3001` conflict verify করতে: `ss -ltnp | grep 3001` এবং `systemctl status hybrid-frontend.service` — Supervisor আর এই প্রসেসের অংশ না।

Section 9 এবং এই ডকুমেন্টের troubleshooting sections-এ থাকা `supervisorctl ...` রেফারেন্সগুলো historical/deprecated হিসেবে বিবেচনা করুন, উপরের নতুন কমান্ডগুলো দিয়ে প্রতিস্থাপন করে পড়ুন।

## 1. Objective

এই সার্ভারকে একটি production-ready Hybrid Stack environment হিসেবে প্রস্তুত করা হয়েছে যাতে নিচের stack ব্যবহার করে SaaS project develop ও deploy করা যায়:

- Backend: Laravel
- Frontend: Next.js
- Database: PostgreSQL
- Cache / Queue: Redis
- Web server / Reverse proxy: Nginx
- Process manager: systemd (`hybrid-frontend.service` for Next.js) + `hybrid-healthcheck.timer` for auto-recovery — see "🚨 Frontend process manager পরিবর্তন" note above (Supervisor was originally used, now deprecated for this purpose)
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
- `supervisor` — installed, service enabled/active, কিন্তু (2026-07-28 থেকে) `/etc/supervisor/conf.d/` সম্পূর্ণ খালি — বর্তমানে কিছুই manage করে না (frontend systemd দিয়ে চলে, backend `php8.3-fpm` দিয়ে চলে); দেখো §9, §28
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

## 9. Frontend process management (systemd — updated 2026-07-23)

**পূর্বে এই সেকশন Supervisor বর্ণনা করত। বাস্তবে Supervisor এবং একটা systemd সার্ভিস দুটোই একসাথে port `3001`-এর জন্য প্রতিযোগিতা করছিল, এবং systemd-ই সবসময় জিতে সাইট সার্ভ করছিল — তাই Supervisor-এর ভাগ disable করে systemd-কে একমাত্র manager হিসেবে রাখা হয়েছে।**

### Systemd unit

`/etc/systemd/system/hybrid-frontend.service`

```ini
[Unit]
Description=Hybrid Stack Frontend (Next.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/hybrid-stack/frontend
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5
User=root
Group=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

- Working directory: `/var/www/hybrid-stack/frontend`
- Bind: `127.0.0.1:3001` (via `next start`, `PORT=3001` env)
- User: `root` (not `www-data` — this differs from other native services; kept as-is since it's already working and changing it is out of scope for a routine fix)
- `Restart=always` handles crash recovery

### Health check timer (second layer of auto-recovery)

- Timer: `hybrid-healthcheck.timer` (প্রতি মিনিটে চলে)
- Service: `hybrid-healthcheck.service` → script `/usr/local/bin/hybrid-healthcheck.sh`
- Script `https://bsol.zyrotechbd.com/` (frontend) এবং `/api/orders/create/bootstrap` (backend, `401` expected) চেক করে; frontend down থাকলে `systemctl restart hybrid-frontend.service`, backend down থাকলে `php8.3-fpm`/`nginx` restart করে

### Common commands

```bash
systemctl status hybrid-frontend.service
systemctl restart hybrid-frontend.service
journalctl -u hybrid-frontend.service -n 50 --no-pager
systemctl status hybrid-healthcheck.timer
```

### Supervisor (frontend থেকে সম্পূর্ণ সরিয়ে ফেলা হয়েছে — 2026-07-28)

- `/etc/supervisor/conf.d/hybrid-stack-frontend.conf` **ডিলিট করা হয়েছে সম্পূর্ণভাবে** (আগে `.conf.disabled` backup হিসেবে রাখা ছিল, সেটাও এখন নেই) — `/etc/supervisor/conf.d/` directory খালি
- `supervisorctl status` এখন কিছুই দেখাবে না (empty output) — এটা প্রত্যাশিত, error না
- **⚠️ কখনো এই config আবার তৈরি/enable করার চেষ্টা কোরো না** — systemd-এর `hybrid-frontend.service` একই port (3001) bind করে, দুটো একসাথে চললে conflict হবে (incident details: §28)
- Supervisor daemon নিজে চলছে (enabled/active) কিন্তু `conf.d` খালি থাকায় কিছুই manage করে না
- Supervisor অন্য কোনো hybrid-stack প্রসেস (backend ইত্যাদি) ম্যানেজ করে না — backend `php8.3-fpm.service` (systemd, স্ট্যান্ডার্ড) দিয়ে চলে, যেটা এই পরিবর্তনে প্রভাবিত হয়নি

---

## 10. SSL and domain setup

Requested domain:
- `bsol.zyrotechbd.com`

Additional Dokploy deployment domain:
- `bsol.zisan.me`

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

### Native/local host main site
- `https://bsol.zyrotechbd.com/`

### Native/local host API health
- `https://bsol.zyrotechbd.com/api/health`

### Dokploy-hosted main site
- `https://bsol.zisan.me/`

### Dokploy-hosted API health
- `https://bsol.zisan.me/api/health`

---

## 12. Service status expected now

These services were enabled and started:

- `nginx`
- `php8.3-fpm`
- `postgresql`
- `redis-server`
- `supervisor` (running, but manages nothing — see §9/§28)
- `certbot.timer`
- `hybrid-frontend.service` (systemd — actual frontend process manager)
- `hybrid-healthcheck.timer` (systemd — per-minute auto-recovery)

### App runtime

- Next.js frontend runs under **systemd** (`hybrid-frontend.service`) on `127.0.0.1:3001` — **not** Supervisor (see §9/§28)
- Laravel API runs through `php-fpm` behind Nginx

---

## 13. Files that matter most

### Server / runtime
- `/etc/nginx/sites-available/default`
- `/etc/systemd/system/hybrid-frontend.service` (actual frontend process manager — **not** Supervisor, see §9/§28)
- `/etc/systemd/system/hybrid-healthcheck.service` + `hybrid-healthcheck.timer`
- `/usr/local/bin/hybrid-healthcheck.sh`
- `/var/www/hybrid-stack/frontend/scripts/deploy-safe.sh` (uses `systemctl restart hybrid-frontend.service`, not supervisorctl — see §28)
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


---

## 25. Admin data isolation policy — `adminScopeUserIds()` pattern (2026-04-29)

### Background

সব admin user যেন একই shared pool-এর resources দেখতে পায় — এই requirement থেকে একটি standard data scoping pattern confirm করা হয়েছে।

### Route access এবং role security — বর্তমান অবস্থা

Backend route structure দুই স্তরে protected:

```
Route::middleware('auth:sanctum')->group(function () {
    // User + Admin উভয়ই access করতে পারে এমন routes (যেমন /sms/gateways, /me)

    Route::middleware('is_admin')->prefix('admin')->group(function () {
        // শুধুমাত্র admin role-এর user access করতে পারবে
        // EnsureUserIsAdmin middleware: role !== 'admin' হলে 403 Forbidden
    });
});
```

**Regular `user` role-এর user কি admin data দেখতে পারে?**

না। `EnsureUserIsAdmin` middleware (`app/Http/Middleware/EnsureUserIsAdmin.php`) সকল `/api/admin/*` route-এ enforce করা আছে। `role !== 'admin'` হলে HTTP 403 return করে, controller পর্যন্ত request পৌঁছায় না।

**SMS Gateways (`/api/sms/gateways`) সম্পর্কে বিশেষ নোট:**

এই route `is_admin` middleware ছাড়া — কিন্তু `AdminSmsGatewayController::myGateways()` controller-এ নিজেই role-check করা আছে:
- Admin হলে → সব enabled gateway দেখায়
- Regular user হলে → শুধু তার assigned gateway দেখায়

এটি **intentional design** — user নিজের gateway দিয়ে SMS পাঠাতে পারে।

### `adminScopeUserIds()` pattern — কীভাবে কাজ করে

Admin-shared resources-এর জন্য প্রতিটি relevant controller-এ এই private helper method রাখা হয়:

```php
private function adminScopeUserIds(): array
{
    if (auth()->user()->isAdmin()) {
        return User::where('role', 'admin')->pluck('id')->toArray();
    }

    return [auth()->id()];
}
```

Query-তে ব্যবহার:
```php
->whereIn('user_id', $this->adminScopeUserIds())
```

**Effect:**
- Admin1 login করলে → Admin1 + Admin2 + ... সব admin-এর records দেখা যায়
- Regular user login করলে → শুধু নিজের records দেখা যায়

**`store()` / `create()` তে:**
- সবসময় `'user_id' => auth()->id()` — audit trail-এর জন্য কে create করেছে সেটা track থাকে

### কোন controllers-এ এই pattern প্রযোজ্য হয়েছে (2026-04-29 পর্যন্ত)

| Controller | File | Applied |
|---|---|---|
| NotificationTemplateController | `Api/NotificationTemplateController.php` | ✅ |
| NotificationUseCaseBindingController | `Api/NotificationUseCaseBindingController.php` | ✅ |
| EmailConfigurationController | `Api/EmailConfigurationController.php` | ✅ |
| NotificationDispatchController (logs) | `Api/NotificationDispatchController.php` | ✅ |

**এই pattern প্রযোজ্য নয়:**
- `AdminSmsGatewayController::myHistory()` — SMS send history per-user হওয়া correct (নিজের send করা history)
- `AdminSmsCreditController` — credit management per-user intentional
- `OtpController`, `EmailOtpController` — verification flow per-user স্বাভাবিক

### ভবিষ্যৎ নতুন feature implement করার mandatory rule

নতুন backend feature implement করার সময় **প্রতিটি resource table-এ** নিচের প্রশ্নের উত্তর দিতে হবে:

> **"এই resource কি সব admin-এর কাছে shared হওয়া উচিত, নাকি per-user isolated?"**

**Shared হওয়া উচিত (adminScopeUserIds pattern apply করতে হবে):**
- System configuration (email config, SMS config, template, binding, rule)
- Platform-level reports বা logs যা admin team দেখে
- Shared notification/communication assets

**Per-user থাকা উচিত (adminScopeUserIds প্রয়োজন নেই):**
- Personal SMS/email send history
- Per-user credit/billing records
- Customer-facing data (order, invoice, subscription) — future multi-tenant-এ এগুলো customer-scoped হবে

### নতুন controller তৈরির checklist

নতুন controller তৈরি করলে এই checklist follow করতে হবে:

1. **Route placement ঠিক করা:**
   - Admin-only → `is_admin` middleware গ্রুপের ভেতরে `/admin/` prefix-সহ
   - User+Admin → `auth:sanctum` গ্রুপে, controller-এ নিজেই role-check করো

2. **Data scope নির্ধারণ:**
   - Shared admin resource → `adminScopeUserIds()` helper যোগ করো
   - Per-user resource → `where('user_id', auth()->id())` রাখো

3. **`adminScopeUserIds()` যোগ করার নিয়ম:**
   - Controller-এ `use App\Models\User;` import করো
   - Private helper method add করো (copy from existing controllers)
   - `index()`, `show()`, `update()`, `destroy()` — সব query-তে `whereIn` দিয়ে replace করো
   - `store()` / `create()` — `user_id` = `auth()->id()` রাখো (audit trail)

4. **Security verification:**
   - Regular user কি admin route access করতে পারছে কিনা test করো
   - `php artisan route:list` দিয়ে middleware assignment verify করো

### Anti-pattern — এগুলো করা যাবে না

```php
// ❌ Admin controller-এ hardcoded per-user filter
->where('user_id', auth()->id())  // Admin2 Admin1-এর data দেখতে পাবে না

// ❌ Middleware ছাড়া admin data expose করা
Route::get('/admin/configs', ...)  // is_admin middleware ছাড়া

// ❌ adminScopeUserIds ছাড়া shared resource query
NotificationTemplate::all()  // সব user-এর data leak হবে
```

### Production commit reference

- `38c3967` — Initial adminScopeUserIds implementation (3 controllers)
- `NotificationDispatchController` logs fix — same session (2026-04-29)

---

## 26. CSS chunk outage + permanent prevention update (2026-05-12)

### Incident summary

`/dashboard` route-এ মাঝে মাঝে UI plain/unstyled হচ্ছিল। Live checks-এ দেখা যায়:

- HTML stylesheet reference: `/_next/static/chunks/1361_rsy~dklu.css`
- ওই CSS request: `500 Internal Server Error`
- Preloaded CSS path: `/_next/static/chunks/188dtksfo.8-3.css`
- preload CSS request: `404 Not Found`

### Verified root cause

Problem backend/Laravel issue না; এটি frontend runtime/build artifact mismatch:

1. Running Next.js process যে chunk reference করছিল, filesystem artifact state তার সাথে consistent ছিল না
2. `.next` build output stale/inconsistent state-এ ছিল (manifest/chunk mismatch)
3. Result: HTML পুরনো/invalid CSS chunk reference করছিল, stylesheet fail হচ্ছিল, page unstyled দেখাচ্ছিল

### Permanent fix applied (this session)

1. `frontend/.next` clean করা হয়েছে
2. Clean production build run করা হয়েছে
3. Supervisor process restart করা হয়েছে (`hybrid-stack-frontend`)
4. Live smoke checks run করা হয়েছে:
	- `/dashboard` HTML load OK
	- active CSS chunk returns `200 OK`
	- `/api/health` returns `200 OK`

### Engineering hardening added (code-level)

#### `/var/www/hybrid-stack/frontend/package.json`

- `prebuild` hook add করা হয়েছে যাতে build-এর আগে `.next` force-clean হয়
- `deploy:prod:safe` script add করা হয়েছে যাতে standardized safe deploy flow run করা যায়

#### `/var/www/hybrid-stack/frontend/scripts/deploy-safe.sh`

একটি repeatable production-safe deploy script add করা হয়েছে যা:

1. `.next` clean করে
2. build output ownership align করে (`www-data`)
3. frontend build run করে
4. **(2026-07-28 আপডেট)** `systemctl restart hybrid-frontend.service` চালায় (আগে supervisor stop/start ব্যবহার হতো, এখন আর না — §28 দেখো)
5. `systemctl is-active` দিয়ে service status verify করে; বুট সম্পূর্ণ হতে সময় লাগতে পারে বলে smoke check-এ ১০ সেকেন্ড পর্যন্ত retry loop আছে
6. live smoke check করে (`/dashboard`, `/api/health`)
7. active CSS chunk detect করে HTTP `200` validate করে

### Mandatory future prevention rules

Frontend deploy complete বলার আগে **সবগুলো** pass করতে হবে:

1. Clean build (prebuild auto-clean active)
2. Supervisor restart
3. Supervisor running status verify
4. Live smoke check (`/dashboard`, `/api/health`)
5. Active CSS chunk URL detect + `200 OK` confirmation
6. Port `3001` conflict (`EADDRINUSE`) না থাকাটা ensure করতে হবে

### Operational command (recommended)

```
cd /var/www/hybrid-stack/frontend
npm run deploy:prod:safe
```

এই command pass না করলে deployment complete হিসেবে ধরা যাবে না।

---

## 27. Exact Git workflow for Dokploy deployment branch (2026-05-28)

### Mandatory branch policy

বর্তমান repository-তে deployment workflow এখন **two-branch model** follow করবে:

- `main` → primary development/source-of-truth branch
- `dokploy` → Dokploy deployment branch

### Critical rule

Dokploy-hosted production/staging app **`main` থেকে deploy করবে না**.

Dokploy app settings-এ git branch হিসেবে **`dokploy`** set থাকতে হবে.

### Current expected repository state

- remote branch `origin/dokploy` exists
- local branch `dokploy` exists
- `dokploy` branch is intended to mirror the deploy-ready state of `main`

### Day-to-day development rule

সাধারণ development flow:

1. নতুন feature / bug fix `main` branch-এ develop করতে হবে
2. `main` branch fully review/test/build-ready হলে `dokploy` branch update করতে হবে
3. Dokploy only `dokploy` branch-এর latest commit deploy করবে

### Exact standard workflow

`main`-এর latest code `dokploy`-এ publish করার exact command sequence:

```bash
cd /var/www/hybrid-stack
git checkout main
git pull origin main
git checkout dokploy
git merge --ff-only main
git push origin dokploy
```

### Why `--ff-only` is mandatory here

- `dokploy` branch ideally `main`-এর clean deployment mirror থাকবে
- unnecessary merge commit avoid করতে হবে
- যদি fast-forward possible না হয়, তার মানে `dokploy` branch-এ extra commit আছে এবং সেটা manually inspect করতে হবে

### If `dokploy` branch does not exist in a fresh clone

```bash
cd /var/www/hybrid-stack
git checkout main
git pull origin main
git checkout -b dokploy
git push -u origin dokploy
```

এর পরে standard workflow-এ ফিরে যেতে হবে.

### Rule for production deployment cut

যখন বলা হবে “Dokploy-এ deploy-ready branch update করো”, default interpretation হবে:

```bash
cd /var/www/hybrid-stack
git checkout main
git pull origin main
git checkout dokploy
git merge --ff-only main
git push origin dokploy
```

### Hotfix rule

Possible হলে hotfix-ও `main` branch-এ করতে হবে, তারপর `dokploy` update করতে হবে.

Preferred hotfix flow:

```bash
cd /var/www/hybrid-stack
git checkout main
# fix কাজ + commit
git push origin main
git checkout dokploy
git merge --ff-only main
git push origin dokploy
```

### If an emergency fix is committed directly on `dokploy`

এটা avoid করা উচিত. কিন্তু forced emergency হলে immediately `main`-এ back-merge করতে হবে, নাহলে দুই branch diverge করবে.

Recovery flow:

```bash
cd /var/www/hybrid-stack
git checkout main
git merge dokploy
git push origin main
git checkout dokploy
git push origin dokploy
```

তারপর future releases-এর আগে ensure করতে হবে যে `git merge --ff-only main` আবার cleanly কাজ করে.

### Pre-deploy verification checklist

`dokploy` branch push করার আগে minimum verify করতে হবে:

1. intended commit `main`-এ আছে
2. working tree clean (`git status`)
3. branch target correct (`git branch --show-current`)
4. `dokploy` push complete হয়েছে

Useful verification commands:

```bash
cd /var/www/hybrid-stack
git status --short --branch
git log --oneline --decorate -n 5 --all --simplify-by-decoration
```

### Frontend change reminder

যদি deployment local native stack-এ করা হয়, branch push যথেষ্ট না. Frontend runtime deploy-এর জন্য existing safe deploy flow follow করতে হবে:

```bash
cd /var/www/hybrid-stack/frontend
npm run deploy:prod:safe
```

### Final authority note

Future conversation/task-এ যদি branch workflow explicitly না-ও বলা হয়, default git/deployment assumption হবে:

- code work happens on `main`
- deploy branch is `dokploy`
- Dokploy deploys from `dokploy`


### বর্তমান branch drift status (checked: 2026-07-28)

`dokploy` branch এই মুহূর্তে `main` থেকে **৩২ commit পিছিয়ে আছে** (`git rev-list --count main ^dokploy` = 32)। `dokploy`-তে extra/unmerged কোনো commit নেই (`dokploy ^main` = 0), তাই fast-forward safe — `git merge --ff-only main` সমস্যা ছাড়াই কাজ করবে। এটা শুধু তথ্য হিসেবে নোট করা হলো; explicitly না বলা পর্যন্ত `dokploy` push কোরো না (§27-এর "Critical rule" অনুযায়ী)।

---

## 28. Supervisor সম্পূর্ণ অপসারণ + `deploy-safe.sh` systemd migration (incident + fix, 2026-07-28)

### যা ঘটেছিল

`npm run deploy:prod:safe` চালানোর সময় deploy script-এর `supervisorctl stop/start hybrid-stack-frontend` ধাপ ব্যর্থ হয় (`ERROR (no such process)`), কারণ frontend আসলে ততদিনে systemd (`hybrid-frontend.service`) দিয়ে চলছিল আর supervisor-এর config `.conf.disabled` অবস্থায় ছিল (§9-এ আগে থেকেই নোট করা ছিল)। Build নিজে সফল হয়েছিল এবং site healthy ছিল (dashboard/api/health/CSS chunk সব `200`), শুধু script-টা পুরনো supervisor assumption নিয়ে লেখা ছিল বলে exit code non-zero দিচ্ছিল।

এরপর "supervisor config ঠিক করে দাও" অনুরোধে ভুলবশত `.conf.disabled` ফাইলটাকে `.conf`-এ rename করে `supervisorctl reread && update` চালানো হয় — যেটা সাথে সাথে **port 3001-এ systemd বনাম supervisor conflict reproduce করে** (`EADDRINUSE`, supervisor প্রোগ্রাম `FATAL`/`BACKOFF` অবস্থায় আটকে যায়)। Root cause investigation করে নিশ্চিত হওয়া যায়:

- আসল, কার্যকর process manager হলো **systemd** (`hybrid-frontend.service`, enabled, `Restart=always`) + `hybrid-healthcheck.timer` (প্রতি মিনিটে auto-recovery)
- Supervisor config একেবারেই leftover/অব্যবহৃত ছিল, এবং সচল করলে systemd-এর সাথে port নিয়ে fight করে

### প্রয়োগ করা fix (স্থায়ী)

1. `/etc/supervisor/conf.d/hybrid-stack-frontend.conf(.disabled)` **সম্পূর্ণ ডিলিট করা হয়েছে** (আর কোনো backup রাখা হয়নি — কারণ backup ফাইলটাই বিপজ্জনক প্রমাণিত হয়েছে)
2. `/var/www/hybrid-stack/frontend/scripts/deploy-safe.sh` আপডেট করা হয়েছে:
   - `supervisorctl stop/start "$SUPERVISOR_PROGRAM"` → `systemctl restart hybrid-frontend.service`
   - manual port-3001 PID-hunt/kill ধাপ সরানো হয়েছে (systemd নিজেই cgroup-based clean restart করে)
   - `systemctl is-active --quiet` দিয়ে status verify; ব্যর্থ হলে `systemctl status --no-pager -l` দেখিয়ে exit 1
   - **নতুন**: live smoke check-এর আগে ১০ সেকেন্ড পর্যন্ত retry loop যোগ করা হয়েছে — কারণ `systemctl restart` কমান্ড রিটার্ন করে সাথে সাথেই "active" দেখায় (process spawn matched হলেই), কিন্তু Next.js আসলে port 3001-এ listen শুরু করতে আরও কয়েকশ মিলিসেকেন্ড থেকে ১-২ সেকেন্ড সময় নেয় — আগে এই race condition-এর কারণে প্রথম smoke-check curl `502` পেয়েছিল যদিও deploy আসলে ঠিকই ছিল
3. Script-এর step count/numbering পুরনো buggy `[4/7]`/`[5/8]` মিশ্রণ থেকে consistent `[N/8]`-এ ঠিক করা হয়েছে

### ভবিষ্যতের জন্য mandatory rule

- **কখনো** `/etc/supervisor/conf.d/`-এ frontend-এর জন্য কোনো `.conf` file তৈরি/rename/enable কোরো না — systemd-ই একমাত্র frontend process manager, এটা permanent সিদ্ধান্ত
- Frontend deploy সবসময় `npm run deploy:prod:safe` দিয়ে করো (script এখন `systemctl` ব্যবহার করে, correct)
- কেউ যদি ভবিষ্যতে "supervisor দিয়ে frontend restart করো" বলে, সেটা এই ডকুমেন্টের ভিত্তিতে ভুল assumption ধরে নিয়ে বরং `systemctl restart hybrid-frontend.service` চালাতে হবে এবং user-কে জানাতে হবে যে supervisor আর ব্যবহৃত হয় না

---

## 29. Landing page builder — bilingual (bn/en) public page language (2026-07-28)

Landing-page-builder ফিচারের সম্পূর্ণ, বিস্তারিত reference এখন আলাদা ফাইলে আছে: **`/var/www/hybrid-stack/landing_page_context.md`** (§১৬ নতুন feature সেকশন)। এখানে শুধু সংক্ষিপ্ত pointer রাখা হলো যাতে ডুপ্লিকেশন না হয়:

- নতুন per-page setting: `content.settings.language: "bn" | "en"` (ডিফল্ট `"bn"`, পুরনো পেজে backward-compatible) — পাবলিক checkout/thank-you পেজের ফিক্সড UI চ্রোম (labels, বাটন, error message) এই ভাষায় দেখায়। এটা builder-এর নিজের dashboard-UI `locale` prop থেকে সম্পূর্ণ আলাদা জিনিস — গুলিয়ে ফেলা যাবে না।
- Frontend: `frontend/src/lib/landing-pages.ts` (`getDefaultCheckoutFields/getDefaultThankYou/getDefaultSettings(language)` factories), `public-landing-page-view.tsx` (`PUBLIC_UI_TEXT`), `thank-you-view.tsx` (`THANK_YOU_UI_TEXT`), `landing-page-builder.tsx` (Settings ট্যাবে ভাষা toggle + auto-translate-unedited-defaults লজিক)
- Backend: `CheckoutFieldResolver.php`, `CheckoutOtpService.php`, `CheckoutOtpController.php`, `LandingPageController.php` — সব bn/en message picker page-এর `content.settings.language` অনুযায়ী
- Deploy করা হয়েছে `npm run deploy:prod:safe` দিয়ে (§28-এর updated script), live verify করা হয়েছে


## ৩০. Dashboard-এর নিজস্ব bn/en toggle এখন সাথে সাথে পুরো পেজে effect করে — `LocaleContext` যোগ (2026-07-28)

আগে (§১৭, landing_page_context.md-এ ডকুমেন্টেড) topbar-এর "Language: EN/BN" toggle করলে সাথে সাথেই শুধু topbar/sidebar বদলাত, কিন্তু পেজের মূল body content বদলাতে পুরো page reload/navigation লাগত। কারণ: `UserShell`-এর নিজের `locale` state instantly reactive, কিন্তু প্রতিটা dashboard page component (landing-pages-এর ৪টা route সহ) নিজে আলাদাভাবে `getStoredLocale()` পড়ত (mount-এ একবার) — সেই read, `UserShell`-এর নিজের locale-sync effect-এর সাথে race করে ভুল/স্টেল ভ্যালুতে আটকে যেতে পারত (§১৭-এর মূল bug), আর এমনকি ঠিকভাবে read করলেও toggle click-এ live update হতো না (রিফ্রেশ/navigation লাগত)।

### Fix

- নতুন ফাইল **`frontend/src/lib/locale-context.tsx`**: `LocaleContext` (React Context) + `useLocale()` hook এক্সপোর্ট করে। Provider না থাকলে `getStoredLocale()`-এ fallback করে (safe default)।
- **`user-shell.tsx`**: `{children}`-কে `<LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>` দিয়ে wrap করা হয়েছে — `UserShell`-এর নিজস্ব, ইতিমধ্যে instantly-reactive `locale` state-ই এখন descendant page-গুলোর জন্য single source of truth।
- **`landing-page-builder.tsx`**: `locale` prop এখন `optional` — না দিলে `useLocale()` context থেকে resolve হয় (`const locale = localeProp ?? contextLocale;`)।
- **Landing-pages-এর ৪টা route file**:
  - `landing-pages/builder/create/page.tsx`, `landing-pages/[id]/builder/page.tsx` — নিজেদের `useState(getStoredLocale)` সরিয়ে `<LandingPageBuilder mode="..." />` (locale prop ছাড়াই, context থেকে auto-resolve হয়) রেন্ডার করে।
  - `landing-pages/page.tsx`, `landing-pages/[id]/page.tsx` — এই দুটো ফাইল নিজেই `<UserShell>` রেন্ডার করত (parent, not child), তাই সরাসরি `useLocale()` কল করলে কাজ করত না (Context শুধু descendant-দের জন্য কাজ করে, ancestor-দের জন্য না)। তাই প্রতিটাকে দুই ভাগে split করা হয়েছে: একটা পাতলা outer wrapper (যেটা `<UserShell><XyzContent /></UserShell>` রেন্ডার করে) + একটা `XyzContent` inner component (যেটা `UserShell`-এর children হিসেবে রেন্ডার হয় বলে `useLocale()` সঠিকভাবে কাজ করে)।

### গুরুত্বপূর্ণ architectural rule (ভবিষ্যতের জন্য)

React Context শুধু **descendant** কম্পোনেন্টে কাজ করে — যে কম্পোনেন্ট নিজেই Provider রেন্ডার করে (এখানে `UserShell`), সেই কম্পোনেন্ট নিজে বা তার **parent/ancestor** কখনো সেই Context consume করতে পারবে না। তাই:
- যদি কোনো dashboard page component নিজে `<UserShell>...</UserShell>` রেন্ডার করে, আর তার নিজের body content-এ locale দরকার হয় — body content-টাকে অবশ্যই একটা **আলাদা child component**-এ বের করে আনতে হবে (`UserShell`-এর children হিসেবে), তারপর সেই child component-এ `useLocale()` কল করতে হবে। সরাসরি outer wrapper component-এ `useLocale()` কল করলে ভুল (stale/default) ভ্যালু পাবে।
- নতুন dashboard page লেখার সময় `useState("bn") + useEffect(() => setLocale(getStoredLocale()), [])` প্যাটার্ন **ব্যবহার কোরো না** — `useLocale()` hook ব্যবহার করো (child/descendant component-এ), অথবা প্রয়োজনে `useState<Locale>(getStoredLocale)` lazy initializer (§১৭-এ described, শুধু non-live fallback হিসেবে)।

### Commit reference

- `9a85a82` — bilingual public landing pages + LocaleContext fix + deploy-safe.sh systemd migration (pushed to `origin/main`, 2026-07-28)

---

## ৩১. 🚨 বাধ্যতামূলক: Staff/Team sub-account role — নতুন যেকোনো ফিচার/মডিউলে মেনে চলতে হবে (2026-08-10)

**Staff/Team sub-account role** ফিচার (shop owner তার নিজের একাউন্টের অধীনে সীমিত-অনুমতির staff একাউন্ট তৈরি করতে পারে) এখন পুরো SaaS-এ (Phase 1+2, সব মডিউল) কার্যকর। সম্পূর্ণ, গভীর reference: **`/var/www/hybrid-stack/staff_team_role_context.md`** — এখানে শুধু সংক্ষিপ্ত mandatory pointer রাখা হলো (§25-এর `adminScopeUserIds()` pattern-এর সাথে গুলিয়ে ফেলা যাবে না — সেটা admin-shared resource-এর জন্য, এটা per-shop owner+staff-এর জন্য, দুটো সম্পূর্ণ আলাদা concept, দুটোই এখনো active/correct)।

**এখন থেকে নতুন যেকোনো backend controller/route বা frontend module/menu-item তৈরি করার সময় নিচের প্রশ্নগুলোর উত্তর দিয়ে শুরু করতে হবে** (`staff_team_role_context.md §3.3`/`§9.3`-এ বিস্তারিত উদাহরণসহ):

1. **এই resource কি shop-এর সবাই (owner+staff) একসাথে দেখবে/এডিট করবে, নাকি শুধু owner-এর একার জিনিস?**
   - **Pattern A (team-shared)** — reads: `whereIn('user_id', auth()->user()->shopUserIds())`; writes: `auth()->id()` অপরিবর্তিত থাকে (audit trail, কে আসলে তৈরি/এডিট করেছে)। উদাহরণ: order, product, customer, transaction, landing page।
   - **Pattern B (owner-only credential/singleton)** — সবসময় `auth()->user()->shopOwnerId()` (single value, `whereIn` না)। staff কখনো এই resource নিজে তৈরি/এডিট করতে পারবে না, শুধু "ব্যবহার" করতে পারে (permission থাকলে)। উদাহরণ: courier API credential, SMS gateway assignment, SMS credit wallet, subscription/billing, blacklist/fraud profile (shop-wide singleton)।
2. **⚠️ সবচেয়ে সাধারণ ভুল (এই সেশনে বাস্তবে ধরা পড়েছে, `§9.3` দেখো):** কোনো Pattern-A resource (যেমন landing page) যদি ভেতরে কোনো Pattern-B resource-কে (order, courier credential, SMS wallet) reference করে creator-এর `user_id` দিয়ে — তাহলে সেই `user_id` সরাসরি trust করা যাবে না, `shopOwnerId()`-এ resolve করে ব্যবহার করতে হবে। নাহলে staff-তৈরি resource থেকে যা downstream তৈরি হয় (যেমন landing-page checkout থেকে আসা অর্ডার) ভুল owner-এ গিয়ে পুরো ফিচার নিঃশব্দে ভেঙে যায়।
3. **নতুন module-level permission দরকার হলে**: `backend/app/Models/StaffPermission.php::MODULE_KEYS` এবং `frontend/src/lib/dashboard-client.ts::STAFF_MODULE_KEYS` দুই জায়গাতেই entry যোগ করো (কোনো migration লাগে না, plain string column) + route-এ `staff_permission:{module}` বা `owner_only` middleware।
4. **Frontend মেনু**: নতুন dashboard মেনু আইটেম `frontend/src/components/user-shell.tsx`-এর `MODULE_KEY_BY_MENU_ITEM` ম্যাপে যোগ না করলে সেটা default-deny-এ staff-এর কাছে hide হয়ে যাবে (এমনকি permission grant থাকলেও) — ইচ্ছাকৃতভাবে fail-safe, কিন্তু মনে রাখতে হবে।
5. **Staff management UI**: নতুন module permission হলে `frontend/src/app/dashboard/settings/staff/page.tsx`-এর `MODULE_KEYS`/`moduleLabels`-এও যোগ করতে হবে যাতে owner সেটা toggle করতে পারে।

**Verification-এ নতুন যোগ**: নতুন module/controller লেখার পর rollback-wrapped tinker/live-HTTP টেস্টে staff-account দিয়ে (ক) granted module → 200, (খ) non-granted module → 403 `staff_permission_denied`, (গ) owner-only route staff দিয়ে → 403 `owner_only` — এই তিনটা কেস অবশ্যই যাচাই করতে হবে, শুধু owner দিয়ে টেস্ট করলে যথেষ্ট না।

`SAAS_MODULE_CONTEXT.md §5/§6/§7`-এর checklist এই rule অনুযায়ী আপডেট করা হয়েছে (২০২৬-০৮-১০)।


---

## ৩২. 🚨 বাধ্যতামূলক: প্রতিটি সেলারের নিজস্ব সাবডোমেইন — নতুন যেকোনো ফিচারে মেনে চলতে হবে (2026-08-15)

SaaS-এর URL কাঠামো বদলে গেছে। **প্রতিটি সেলার এখন `{label}.zyrotechbd.com`-এ নিজের ঠিকানা পায়, এবং সেখানেই তার ড্যাশবোর্ড ও ল্যান্ডিং পেজ চলে।** সম্পূর্ণ ডিজাইন, নিরাপত্তা যুক্তি ও ফেজ লগ: **`custom_domain_context.md`**; নিরাপত্তা অডিট: `domain_security_audit.md`।

**অবকাঠামোতে যা বদলেছে** (§৮ nginx ও §১০ SSL এখন অসম্পূর্ণ, এই সেকশনটাই হালনাগাদ):
- DNS এখন **Cloudflare**-এ (`gina`/`pablo.ns.cloudflare.com`), `*.zyrotechbd.com` wildcard A → `103.157.253.197`।
- Wildcard TLS: `/etc/letsencrypt/live/wildcard-zyrotechbd/`, `certbot-dns-cloudflare` (DNS-01) দিয়ে স্বয়ংক্রিয় নবায়ন। `bsol.zyrotechbd.com`-এর নিজস্ব cert আলাদাই আছে।
- nginx-এ দ্বিতীয় server block: `server_name "~^(?<seller>...)\.zyrotechbd\.com$"` (**regex-এ ব্রেস থাকায় কোট করা বাধ্যতামূলক**)। exact-match block সবসময় regex-এর আগে জেতে।
- Next.js 16-এ Middleware-এর নাম **Proxy** — `frontend/src/proxy.ts`, `middleware.ts` নয়।

**নতুন ফিচার লেখার সময় যে প্রশ্নগুলোর উত্তর দিয়ে শুরু করতে হবে:**

1. **এই কোড কি request-এর Host থেকে কিছু সিদ্ধান্ত নেয়?** পাবলিক ল্যান্ডিং লুকআপ সবসময় `LandingPageResolver` দিয়ে যাবে (slug এখন shop-প্রতি unique, globally নয়)। ব্রাউজারমুখী URL সবসময় `App\Support\FrontendUrl` দিয়ে — **ব্যবহারকারী থেকে resolve হয়, Host থেকে নয়**, কারণ এগুলো ইমেইল ও পেমেন্ট কলব্যাকে যায়।
2. **নতুন কোনো top-level frontend রুট যোগ করলে** `proxy.ts`-এর `APP_PATHS`-এ যোগ করতে হবে, নাহলে সেলারের ল্যান্ডিং পেজ slug সেটাকে ঢেকে দেবে।
3. **`zyrotechbd.com`-এ নতুন DNS রেকর্ড যোগ করলে** সেই label সাথে সাথে Admin → Settings → Reserved Subdomains-এ যোগ করতে হবে, নাহলে সেলার সেটা দাবি করে চালু সার্ভিস হাইজ্যাক করতে পারবে।
4. **সাবডোমেইন = Pattern B** (owner-only, `shop_profiles`-এ)। staff দাবি/ছাড়তে পারে না, কিন্তু owner-এর ঠিকানা ব্যবহার করে।

**অলঙ্ঘনীয় নিরাপত্তা শর্ত** (`domain_security_audit.md §৫`-এ সাতটি, সবচেয়ে গুরুত্বপূর্ণ তিনটি এখানে):
- **`SESSION_DOMAIN` কখনো `.zyrotechbd.com` করা যাবে না**, আর auth টোকেন কখনো `localStorage` থেকে কুকিতে সরানো যাবে না — কুকি ডোমেইন-স্কোপড, `localStorage` origin-স্কোপড; এই পার্থক্যটাই ক্রস-সেলার টোকেন চুরি অসম্ভব করে রাখে।
- **কোনো অ্যাকাউন্ট নিজের নয় এমন সাবডোমেইনে লগইন করতে পারবে না**, এবং সেলার সাবডোমেইনে কখনো লগইন ফর্ম রেন্ডার করা যাবে না। admin সাপোর্টের একমাত্র পথ প্ল্যাটফর্ম origin থেকে impersonation (Admin → Active Customers → "দেখুন")।
- **`x-bsol-shop-subdomain` কখনো ক্লায়েন্ট থেকে গ্রহণ করা যাবে না** — proxy সেট করে, proxy-ই ইনবাউন্ড কপি মুছে দেয়।
