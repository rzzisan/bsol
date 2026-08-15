# BSOL — Per-Seller Subdomain / Custom Domain Context

প্রতিটি সেলার `zyrotechbd.com`-এর অধীনে নিজের পছন্দের একটা সাবডোমেইন নেবে (Shop Profile থেকে, availability চেক সহ), এবং সেই সাবডোমেইনেই তার **ড্যাশবোর্ড** ও **ল্যান্ডিং পেজ** দুটোই চলবে। `bsol.zyrotechbd.com`-এ লগইন করলে, সাবডোমেইন সেট থাকলে, সেলার নিজের সাবডোমেইনে রিডাইরেক্ট হবে।

**অবস্থা:** D1–D5 বাস্তবায়িত ও লাইভ (২০২৬-০৮-১৫)। DNS Cloudflare-এ, wildcard DNS + wildcard TLS + nginx regex block চালু, সেলাররা নিজেরাই সাবডোমেইন নিচ্ছেন। বাকি: §11-এর উন্মুক্ত সিদ্ধান্ত ও T8b (সেলারের নিজের ডোমেইন)। নিচের §1–§10 মূল ডিজাইন হিসেবে রাখা হয়েছে; বাস্তবায়নের সময় যা বদলেছে তা §14–§15-এ।

**সম্পর্কিত:** `CONTEXT.md` (§৮ nginx, §১০ SSL, §৩১ staff-role বাধ্যতামূলক চেকলিস্ট), `tracking_capi_context.md` (§8 — ট্র্যাকিং-এর দিক থেকে ডোমেইন মডেল, T8a/T8b ফেজ), `landing_page_context.md`, `feature_roadmap_context.md` আইটেম ৬।

---

## 1. Verified ground truth (কোড ও সার্ভার পড়ে যাচাই, ২০২৬-০৮-১৪)

| বিষয় | বাস্তব অবস্থা | তাৎপর্য |
|---|---|---|
| **Auth মেকানিজম** | Sanctum **personal access token** — `AuthController::login()` `$user->createToken('frontend')->plainTextToken` (`app/Http/Controllers/AuthController.php:45`), ফ্রন্টএন্ডে `localStorage.auth_token` (`frontend/src/lib/dashboard-client.ts:81-119`) | **পুরো ডিজাইনের ভিত্তি** — §2 দেখো |
| Session cookie | `SESSION_DOMAIN=null` — SPA auth-এ কুকি ব্যবহারই হয় না | ক্রস-সাবডোমেইন কুকি শেয়ারিং দরকার নেই |
| CORS | লাইভ preflight টেস্টে `Access-Control-Allow-Origin: *`, `supports_credentials` নেই | Bearer টোকেনে যেকোনো origin থেকে API কল আজই কাজ করে |
| API base URL | `NEXT_PUBLIC_API_BASE_URL="https://bsol.zyrotechbd.com/api"` — **absolute** | সাবডোমেইনে relative `/api`-তে বদলানোর সুপারিশ, §4.2 |
| Next.js middleware | **নেই** (`src/middleware.ts` অনুপস্থিত) | host-ভিত্তিক রাউটিং নতুন করে বানাতে হবে |
| nginx | একটাই server block, `server_name bsol.zyrotechbd.com`, `proxy_set_header Host $host` ইতিমধ্যে আছে | Next.js আসল host পায়; নতুন regex block যোগ করলেই হবে |
| `portal.zyrotechbd.com` | DNS → `.197` (এই সার্ভার), কিন্তু কোনো server block নেই → HTTP 404, HTTPS cert mismatch | কিছু ভাঙছে না, তবে reserved তালিকায় রাখতে হবে |
| `shop_profiles` | `user_id` unique (Pattern B, owner-only), কোনো domain/subdomain কলাম নেই | নতুন কলাম লাগবে, §5 |
| DNS | Cloudflare (`gina`/`pablo.ns.cloudflare.com`), ৪৯টা রেকর্ড, সব DNS-only, wildcard **এখনো নেই** | §6 |
| TLS | `bsol.zyrotechbd.com`-এর নিজস্ব Certbot cert, `certbot.timer` সক্রিয়, certbot 2.9.0 (apt) | wildcard আলাদা cert হিসেবে আসবে |

---

## 2. সবচেয়ে গুরুত্বপূর্ণ ফাইন্ডিং — auth per-origin, তাই ক্রস-সেলার চুরি কাঠামোগতভাবে অসম্ভব

প্রাথমিক আশঙ্কা ছিল: সেলারের ড্যাশবোর্ড আর সেলার-লিখিত ল্যান্ডিং পেজ HTML একই origin-এ থাকলে XSS দিয়ে টোকেন চুরি হবে। কোড পড়ে দেখা গেল ঝুঁকিটা যতটা ভাবা হয়েছিল তার চেয়ে অনেক সংকীর্ণ:

- টোকেন থাকে **`localStorage`**-এ, যা **origin-প্রতি সম্পূর্ণ আলাদা**। `seller2.zyrotechbd.com`-এর কোনো স্ক্রিপ্ট `seller1.zyrotechbd.com`-এর `localStorage` পড়তে **পারে না** — ব্রাউজারের same-origin policy এটা নিশ্চিত করে।
- কোনো session কুকি ব্যবহারই হয় না (`SESSION_DOMAIN=null`), তাই কুকি-ভিত্তিক ফাঁসের পথও নেই।
- ফলে সেলার নিজের সাবডোমেইনে যা-ই ইনজেক্ট করুক, সেটা শুধু **নিজের** origin-এ চলে — অন্য সেলারের অ্যাকাউন্ট ছুঁতে পারে না।

**অবশিষ্ট সংকীর্ণ ঝুঁকি:** BSOL-এর admin বা support কর্মী যদি কোনো সেলারের সাবডোমেইনে লগইন করে, আর সেই সেলারের ল্যান্ডিং পেজে ক্ষতিকর স্ক্রিপ্ট থাকে, তাহলে সেই কর্মীর টোকেন চুরি হতে পারে। প্রতিকার §9-এর নিয়ম ৩।

### হার্ড কনস্ট্রেইন্ট — এই তিনটা কখনো ভাঙা যাবে না

1. **`SESSION_DOMAIN` কখনো `.zyrotechbd.com` করা যাবে না।** করলেই সব সাবডোমেইন একে অপরের কুকি পড়তে পারবে এবং §2-এর পুরো নিরাপত্তা যুক্তি ভেঙে পড়বে।
2. **auth টোকেন কখনো কুকিতে সরানো যাবে না** (`localStorage` থেকে কুকিতে migrate করার প্রস্তাব এলে এই ডক দেখাতে হবে) — কুকি ডোমেইন-স্কোপড, `localStorage` origin-স্কোপড; পার্থক্যটাই এখানে নিরাপত্তা।
3. **ট্র্যাকিং কুকিও exact-host-এ**, `domain=` অ্যাট্রিবিউট ছাড়া (`tracking_capi_context.md §8.6.2`)।
4. **`x-bsol-shop-subdomain` কখনো ক্লায়েন্ট থেকে গ্রহণ করা যাবে না** — proxy সেট করে, proxy-ই ইনবাউন্ড কপি মুছে দেয়; এর উপর কোথাও অনুমোদন সিদ্ধান্ত নেওয়া যাবে না (`domain_security_audit.md` M-1)।
5. **`reserved_subdomains.is_system` row মুছে ফেলার পথ তৈরি করা যাবে না** (একই রিপোর্ট, §৫)।

**নিরাপত্তা অডিট:** `domain_security_audit.md` (২০২৬-০৮-১৫) — critical/high শূন্য, ২টি medium ঠিক করা হয়েছে।

---

## 3. URL কাঠামো

```
bsol.zyrotechbd.com          → SaaS-এর নিজস্ব হোম, লগইন, admin প্যানেল, এবং
                               সাবডোমেইন-বিহীন সেলারের ড্যাশবোর্ড (অপরিবর্তিত)
seller1.zyrotechbd.com/dashboard/...   → সেলারের ব্র্যান্ডেড ড্যাশবোর্ড
seller1.zyrotechbd.com/{slug}          → সেলারের ল্যান্ডিং পেজ
seller1.zyrotechbd.com/api/...         → একই origin-এ API (nginx থেকে Laravel)
```

**আপডেট (২০২৬-০৮-১৫):** প্ল্যাটফর্ম ডোমেইনে আর কোনো ল্যান্ডিং পেজ নেই — `/lp/{slug}` সরিয়ে ফেলা হয়েছে (§14)।

---

## 4. রাউটিং

### 4.1 হোস্ট রেজলিউশন

Next.js-এ নতুন **`src/proxy.ts`** (Next.js 16-এ Middleware-এর নতুন নাম Proxy; `middleware.ts` আর কাজ করে না) — `request.headers.get('host')` থেকে label বের করে:

- `bsol` → বর্তমান আচরণ, কোনো পরিবর্তন নেই।
- অন্য কোনো single-label → `GET /api/public/shop-by-subdomain/{label}` (ক্যাশড) দিয়ে সেলার resolve; না পাওয়া গেলে 404।
- resolve হলে request-এ একটা header/context বসিয়ে rewrite: `/{slug}` → `/lp/{slug}` (internal rewrite, URL বদলায় না), `/dashboard/*` যেমন আছে তেমনই।

`tracking_capi_context.md §8.0`-এর `TrackingHostResolver` এবং এই resolver **একই লুকআপ শেয়ার করবে** — দুটো আলাদা সত্যের উৎস হলে পরে অসঙ্গতি তৈরি হবে।

### 4.2 API একই origin-এ আনা

আজ `NEXT_PUBLIC_API_BASE_URL` absolute (`https://bsol.zyrotechbd.com/api`)। সাবডোমেইনে এটা রাখলে:
- প্রতিটা কল ক্রস-অরিজিন (CORS আজ `*` বলে কাজ করবে, কিন্তু preflight-এর বাড়তি রাউন্ড-ট্রিপ),
- এবং white-label ড্যাশবোর্ডের নেটওয়ার্ক ট্যাবে `bsol.zyrotechbd.com` দেখা যাবে — "নিজের ডোমেইন" অনুভূতির পরিপন্থী।

**সুপারিশ:** relative `/api`-তে বদলানো, আর প্রতিটা server block-এ `/api/` → Laravel রাউট করা (bsol block-এ যেমন আছে হুবহু তেমন)। তখন সব host-এ same-origin, CORS-এর দরকারই নেই। একই সাথে CORS `*` থেকে `^https://[a-z0-9-]+\.zyrotechbd\.com$` প্যাটার্নে কড়া করা যায় (defense in depth)।

### 4.3 Reserved path — ল্যান্ডিং পেজ slug এগুলোর সাথে সংঘাত করতে পারবে না

```
api, _next, storage, dashboard, admin, login, register, logout,
forgot-password, reset-password, verify-email, verify-phone,
privacy, terms, lp, store, auth, favicon.ico, robots.txt, sitemap.xml
```

(`frontend/src/app/`-এর বর্তমান রুট তালিকা থেকে নেওয়া — ভবিষ্যতে নতুন top-level রুট যোগ করলে এই তালিকাও বাড়াতে হবে, নাহলে পুরনো slug হঠাৎ ঢাকা পড়বে।)

---

## 5. ডেটা মডেল

### 5.1 `shop_profiles`-এ নতুন কলাম

```
subdomain          string(63) nullable  unique   — শুধু label, ডট ছাড়া ('zareen')
subdomain_status   string(20) default 'none'     — none | active | disabled
subdomain_set_at   timestamp nullable
```

Pattern B (owner-only) — `staff_team_role_context.md §3.3` অনুযায়ী staff এটা সেট/বদল করতে পারবে না, শুধু ব্যবহার করবে। রুট `owner_only` middleware-এ।

### 5.2 `subdomain_tombstones` (নতুন — নিরাপত্তার জন্য বাধ্যতামূলক)

```
id
label        string(63) unique
user_id      → আগে যার ছিল
released_at  timestamp
```

**কেন দরকার:** সেলার সাবডোমেইন বদলালে পুরনোটা যদি মুক্ত হয়ে যায়, অন্য সেলার সেটা দাবি করে **আগের সেলারের চালু বিজ্ঞাপনের ট্রাফিক, বুকমার্ক ও ব্যাক-লিংক উত্তরাধিকার পাবে** — কার্যত ট্রাফিক হাইজ্যাক। তাই ছেড়ে দেওয়া label চিরকাল সংরক্ষিত থাকবে, কেউ আর নিতে পারবে না। পুরনো label-এ এখন স্থায়ী 301 হয় শপের বর্তমান ঠিকানায় (§11 আইটেম ২)।

### 5.3 Reserved subdomain তালিকা — **admin প্যানেল থেকে ম্যানেজ করা হয় (২০২৬-০৮-১৫)**

`reserved_subdomains` টেবিল, UI: **Admin → Settings → Reserved Subdomains**। আগে PHP const ছিল, ফলে zone-এ নতুন DNS রেকর্ড যোগ করে এখানে মিরর করতে ভুলে গেলে পরের deploy পর্যন্ত চালু সার্ভিসটা দাবিযোগ্য থেকে যেত। এখন ডেটা।

**`is_system` সুরক্ষা** — যেসব label ইতিমধ্যে DNS-এ resolve করে, বা মেইল/অবকাঠামো যেগুলোর উপর নির্ভর করে, সেগুলো UI-তে দেখা যায় কিন্তু **মুছে ফেলা যায় না**। কারণ `mail`/`cpanel` মুক্ত করলে সেলার শপের ইমেইল বা হোস্টিং প্যানেল দখল করে ফেলতে পারত — explicit DNS রেকর্ড সবসময় wildcard-কে হারায়, তাই ট্র্যাফিক আসল হোস্টেই যেত অথচ BSOL ভাবত label-টা সেলারের। প্রাথমিক ১২৮টা row **migration নিজেই** বসায় (৫১টা system), কোনো seeder-এর উপর নির্ভর নয় — যাতে কোনো এনভায়রনমেন্ট খালি অর্থাৎ উন্মুক্ত তালিকা নিয়ে চালু না হয়।

প্রাথমিক তালিকা যা থেকে এসেছে:

```
বিদ্যমান DNS রেকর্ড থেকে (৪৯টা রেকর্ড স্ক্যান করে):
  www, mail, ftp, webmail, cpanel, whm, webdisk, autodiscover, autoconfig,
  cpcontacts, cpcalendars, app, portal, isp, ai, saas, sub, catv, catv-dev,
  bsol, dokploy, dishbill, iptv

অবকাঠামো/ভবিষ্যতের জন্য:
  api, admin, ns1, ns2, ns, dns, smtp, imap, pop, pop3, mx, email,
  staging, stage, dev, test, demo, sandbox, beta, preview,
  cdn, static, assets, media, img, images, files, download,
  status, health, monitor, metrics, logs, backup,
  support, help, docs, doc, blog, news, shop, store, pay, payment,
  billing, invoice, account, accounts, auth, sso, id, login,
  dmarc, dkim, spf, postmaster, abuse, security, root, no-reply, noreply
```

**নিয়ম:** কোনো সেলার এমন label নিতে পারবে না যেটা ইতিমধ্যে Cloudflare-এ explicit DNS রেকর্ড হিসেবে আছে — নাহলে চালু সার্ভিস হাইজ্যাক হবে। তালিকা যোগ করার সময় zone-এর সাথে মিলিয়ে নিতে হবে।

### 5.4 Label ভ্যালিডেশন

```
^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$
```
- ৩–৬৩ অক্ষর (১-২ অক্ষর সংরক্ষিত রাখা হলো ভবিষ্যতের জন্য)
- শুরু/শেষে হাইফেন নয়, পরপর দুই হাইফেন নয়
- ৩য়-৪র্থ অক্ষরে `--` নয় (`xn--` punycode-এর সাথে সংঘাত এড়াতে)
- reserved তালিকা ও tombstone-এ নেই
- `shop_profiles.subdomain`-এ unique

### 5.5 Availability endpoint

```
GET /api/shop-profile/subdomain/check?label=zareen   (auth, owner_only, throttle:30,1)
    → { available: bool, reason: 'taken'|'reserved'|'invalid_format'|'too_short'|null }
```

চূড়ান্ত দাবি করার সময় **DB-স্তরে unique constraint-ই একমাত্র সত্য** — চেক ও সেভের মাঝে race condition হতে পারে, তাই `try/catch` করে unique violation ধরে বন্ধুত্বপূর্ণ বার্তা দিতে হবে (চেকের ফলাফলের উপর ভরসা করা যাবে না)।

---

## 6. লগইন ও রিডাইরেক্ট — handoff টোকেন

**সমস্যা:** টোকেন `localStorage`-এ, যা origin-প্রতি আলাদা। তাই `bsol.zyrotechbd.com`-এ লগইন করে `seller1.zyrotechbd.com`-এ রিডাইরেক্ট করলে সেখানে কোনো টোকেন থাকবে না — সেলারকে আবার লগইন করতে হবে। URL-এ টোকেন পাঠানো যাবে না (ব্রাউজার হিস্ট্রি, রেফারার, সার্ভার লগে থেকে যায়)।

**সমাধান — এক-বার-ব্যবহারযোগ্য handoff কোড:**

```
১. POST /api/login  (host: bsol.zyrotechbd.com)
   ↓ credential ঠিক আছে, এবং shop_profiles.subdomain = 'seller1', status = active
২. সার্ভার টোকেন ইস্যু করে না। বদলে Redis-এ রাখে:
      key   handoff:{random 48 bytes}
      value { user_id, target_host: 'seller1.zyrotechbd.com', issued_ip }
      TTL   60 সেকেন্ড
   রেসপন্স: { redirect_to: 'https://seller1.zyrotechbd.com/auth/handoff?code=...' }
৩. ব্রাউজার সেখানে যায়। /auth/handoff পেজ POST করে:
      POST /api/auth/handoff/exchange { code }   (host: seller1.zyrotechbd.com)
৪. সার্ভার যাচাই করে: কোড আছে, expire হয়নি, এবং request-এর Host == target_host।
   কোড সাথে সাথে মুছে ফেলে (single use), তারপর আসল টোকেন ইস্যু করে।
৫. পেজ টোকেন নিজের localStorage-এ রাখে → /dashboard-এ যায়।
```

**নিরাপত্তা বৈশিষ্ট্য:** কোডে টোকেন নেই; ৬০ সেকেন্ডে মেয়াদ শেষ; একবারই ব্যবহারযোগ্য; `target_host`-এ বাঁধা বলে অন্য কোথাও replay করা যায় না; `bsol.` origin-এ কোনো টোকেন কখনো তৈরিই হয় না।

**যেসব কেসে রিডাইরেক্ট হবে না:** admin (`is_admin`), সাবডোমেইন সেট নেই, `subdomain_status != 'active'`, অথবা সেলার ইতিমধ্যেই নিজের সাবডোমেইনে লগইন করছে। Staff অ্যাকাউন্টের ক্ষেত্রে `shopOwnerId()`-এর সাবডোমেইন ব্যবহার হবে (staff-এর নিজের কোনো ShopProfile নেই — Pattern B)।

Redis ব্যবহার নিরাপদ: `CACHE_STORE=redis` এবং queue worker দুটোই লাইভ (verified)।

---

## 7. DNS

Cloudflare-এ **একটাই** রেকর্ড যোগ করতে হবে, তারপর নতুন সেলারের জন্য আর কোনো DNS কাজ নেই:

```
*   A   103.157.253.197   DNS only (grey cloud), TTL Auto
```

- **nginx-এর regex server block লাইভ হওয়ার পরেই** এটা যোগ করতে হবে — নাহলে যেকোনো অজানা সাবডোমেইন সার্টিফিকেট-নেম mismatch নিয়ে BSOL অ্যাপে গিয়ে পড়বে।
- Cloudflare ফ্রি প্ল্যানে wildcard **DNS-only হিসেবে** চলে; proxy করতে পেইড প্ল্যান লাগে (আর আমরা proxy চাই না — §9 নিয়ম ৪)।
- explicit রেকর্ড সবসময় wildcard-কে হারায়, তাই `www`/`mail`/`cpanel`/`ai`/`catv`/`dokploy` ইত্যাদি অক্ষত থাকবে।

---

## 8. TLS ও nginx

### 8.1 Wildcard সার্টিফিকেট

```bash
sudo apt install -y python3-certbot-dns-cloudflare
sudo install -m 600 /dev/null /etc/letsencrypt/cloudflare.ini
# ফাইলে এক লাইন: dns_cloudflare_api_token = <Cloudflare token, Zone:DNS:Edit, শুধু zyrotechbd.com>
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d '*.zyrotechbd.com' --cert-name wildcard-zyrotechbd
sudo certbot renew --dry-run
```

- Wildcard **শুধু DNS-01 challenge**-এ issue হয়; HTTP-01 কখনো wildcard দেয় না।
- `*.zyrotechbd.com` **এক লেভেল** কভার করে — `seller1.zyrotechbd.com` চলবে, `www.seller1.zyrotechbd.com` চলবে না (দরকারও নেই)।
- apex `zyrotechbd.com` এই cert-এ **নেই এবং থাকা উচিত নয়** — apex অন্য সার্ভারে (`.198`)।
- `bsol.zyrotechbd.com`-এর বিদ্যমান cert **আলাদা থাকবে, স্পর্শ করা হবে না** — চালু সিস্টেমে হাত না দেওয়াই নিরাপদ।
- `certbot.timer` আগে থেকেই সক্রিয়, তাই নবায়ন স্বয়ংক্রিয়।

### 8.2 nginx server block

`bsol` block-এর `location` কাঠামো হুবহু অনুসরণ করবে (একই `/api/`, `/storage/`, `/_next/`, `/` রাউটিং), শুধু `server_name` regex ও cert আলাদা। **exact-match `bsol.zyrotechbd.com` সবসময় regex-এর আগে জেতে**, তাই ড্যাশবোর্ড/API-তে কোনো প্রভাব পড়বে না।

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    # কোট করা বাধ্যতামূলক — নিচের সতর্কতা দেখো
    server_name "~^(?<seller>[a-z0-9][a-z0-9-]{1,61}[a-z0-9])\.zyrotechbd\.com$";

    ssl_certificate     /etc/letsencrypt/live/wildcard-zyrotechbd/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wildcard-zyrotechbd/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/hybrid-stack/backend/public;
    index index.php;
    client_max_body_size 20M;

    location = /api            { try_files $uri /index.php?$query_string; }
    location ^~ /api/          { try_files $uri /index.php?$query_string; }
    location ^~ /storage/      { try_files $uri $uri/ =404; add_header Cache-Control "public, max-age=31536000, immutable"; access_log off; }
    location ~ \.php$          { include snippets/fastcgi-php.conf; fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name; fastcgi_pass unix:/run/php/php8.3-fpm.sock; }

    location ^~ /_next/static/ { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1; proxy_set_header Host $host; add_header Cache-Control "public, max-age=31536000, immutable"; access_log off; }
    location ^~ /_next/image   { proxy_pass http://127.0.0.1:3001; proxy_http_version 1.1; proxy_set_header Host $host; access_log off; }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }

    location ~ /\.(?!well-known).* { deny all; }
}
```

অজানা সাবডোমেইন nginx-এ আটকানো হবে না (nginx জানে না কোন label বৈধ) — অ্যাপ্লিকেশন স্তরে middleware 404 দেবে, কারণ বৈধতার সত্য DB-তে।

**সতর্কতা (২০২৬-০৮-১৪-এ বাস্তবে ধরা পড়েছে):** nginx `{` ও `}`-কে ব্লক-ডিলিমিটার হিসেবে পার্স করে, তাই `{1,61}` কোয়ান্টিফায়ারওয়ালা regex **অবশ্যই ডাবল-কোটে** দিতে হবে। কোট ছাড়া `nginx -t` ব্যর্থ হয়:
`[emerg] directive "server_name" is not terminated by ";"`. একই সতর্কতা ৮০ ও ৪৪৩ — দুই block-এই প্রযোজ্য।

---

## 9. নিরাপত্তা নিয়ম

1. **`SESSION_DOMAIN=null` অপরিবর্তনীয়** (§2 হার্ড কনস্ট্রেইন্ট)।
2. **auth টোকেন `localStorage`-এই থাকবে**, কুকিতে নয়।
3. **BSOL admin/support কখনো সেলারের সাবডোমেইনে লগইন করবে না** — সবসময় `bsol.zyrotechbd.com`। সেলার-লিখিত ল্যান্ডিং HTML একই origin-এ চলে, তাই এটাই একমাত্র অবশিষ্ট টোকেন-চুরির পথ। handoff লজিকে `is_admin` হলে রিডাইরেক্ট সম্পূর্ণ বন্ধ (§6)।
4. **Cloudflare proxy (orange cloud) বন্ধ থাকবে** — চালু করলে client IP `CF-Connecting-IP`-তে চলে যায়; nginx-এ `set_real_ip_from`/`real_ip_header` কনফিগার না করলে ফ্রড ডিটেকশন, `TrackLandingPageVisit` ও Facebook CAPI-র সব IP ভুল হবে (`tracking_capi_context.md §8.6.6`)।
5. **Released সাবডোমেইন চিরকাল tombstone-এ** (§5.2) — ট্রাফিক হাইজ্যাক ঠেকাতে।
6. **সেলার কখনো বিদ্যমান DNS রেকর্ডের নাম দাবি করতে পারবে না** (§5.3)।

---

## 10. ট্র্যাকিং-এর সাথে সম্পর্ক

এই ফিচার `tracking_capi_context.md`-এর **T8a** — সেটার §8.3 কেস C2। **সম্পন্ন**, এবং এর ফলে ট্র্যাকিং পরিকল্পনার একটা বড় অংশ বাতিল হয়ে গেছে (ওই ডকের §8.2 কেস B, §11-এর ৬/৯/১০/১১ — ২০২৬-০৮-১৫-এ হালনাগাদ করা হয়েছে):

- `_fbp`/`_fbc` কুকি exact-host-এ থাকায় ক্রস-সেলার দূষণ শেষ — শেয়ার্ড ডোমেইনের সবচেয়ে বড় correctness bug (`tracking_capi_context.md §8.2` সমস্যা ১) কাঠামোগতভাবে সমাধান। ফলে সেলার সাবডোমেইনে **browser Pixel + server CAPI দুটোই চলবে (Full tracking)**।
- ⚠️ **Pixel কখনো `/dashboard/*`-এ লোড হবে না** — ল্যান্ডিং পেজ ও ড্যাশবোর্ড একই origin-এ, তাই সেলারের নিজের ব্রাউজিং ইভেন্ট হয়ে কোটা খেত ও audience নষ্ট করত, আর ড্যাশবোর্ড URL-এর অর্ডার/ফোন `event_source_url` হিসেবে Meta-তে চলে যেত।
- ⚠️ **সাবডোমেইন বদলালে ট্র্যাকিং রিসেট হয়** — `_fbp`/`_fbc` হারায়, `event_source_url` বদলায়, আর retired label-এর 301 ingest POST-কে GET-এ নামিয়ে **নীরবে** ভেঙে দেয় (§18-এর একই কারণ)। বিজ্ঞাপন চালু থাকলে ঠিকানা বদলানো যাবে না — বদলানোর UI-তে এই সতর্কতা যোগ হবে (T6)।
- ⚠️ **একই apex রাখায় শেয়ার্ড রেপুটেশন ঝুঁকি বহাল** — ট্র্যাকিং ডকের §8.6.4 আলাদা apex সুপারিশ করেছিল; ঝুঁকি ও প্রশমন সেখানে লেখা।
- **Meta domain verification — যাচাই হয়ে গেছে (২০২৬-০৮-১৫): সেলার নিজে পারবে না।** Meta শুধু **root ডোমেইন** verify করতে দেয়, সাবডোমেইন নয়, আর একটা root ডোমেইন **একটাই business**-এ থাকতে পারে (`tracking_capi_context.md §11.7`)। ফলে:
  - ✅ **`zyrotechbd.com` একবার verify করলেই প্রতিটি সেলার সাবডোমেইন ঢেকে যায়** — বর্তমান ও ভবিষ্যতের সব। এককালীন ~১০ মিনিট, Cloudflare-এ একটা TXT রেকর্ড।
  - ⏸️ **কিন্তু এখনই verify করা হচ্ছে না** (§11.7a): "Share this Domain with a partner" ডায়ালগের একমাত্র অধিকারটাই "Link to domain" (বিজ্ঞাপনে এই ডোমেইনের লিংক দেওয়া) — অর্থাৎ verified ডোমেইনে বিজ্ঞাপন দেওয়া অনুমতি-নিয়ন্ত্রিত। verify করার পর সেলারদের **প্রতিজনের Business ID partner হিসেবে যোগ করতে হবে কি না** তা আগে জানতে হবে; লাগলে সেটা per-seller ম্যানুয়াল ধাপ — ঠিক যা এড়াতে এই ফিচার বানানো। domain verification CAPI-র জন্য দরকার নেই, তাই অপেক্ষা করার খরচ শূন্য।
  - ⚠️ **AEM/iOS ইভেন্ট প্রায়োরিটি প্ল্যাটফর্ম-স্তরে একক** — সব সেলারের জন্য একই ম্যাপিং, সেলার নিজে বদলাতে পারবে না। COD-এ `Purchase` সর্বোচ্চ রাখাই কার্যত সবার জন্য সঠিক, তাই বাস্তবে এটা খুব কমই কাউকে আটকাবে।
  - এটা আলাদা apex নিলেও বদলাত না — "আমাদের ডোমেইনে থাকা"-রই অন্তর্নিহিত মূল্য। সেলার-প্রতি verification একমাত্র **T8b** (সেলারের নিজের ডোমেইন)-এ সম্ভব, যা T8b-র বিক্রয়-যুক্তিকে সুনির্দিষ্ট করে।
- host resolver দুটো ফিচারে একটাই থাকবে (§4.1) — ট্র্যাকিং নতুন `TrackingHostResolver` বানাবে না, `LandingPageResolver`-ই ব্যবহার করবে।

---

## 11. উন্মুক্ত সিদ্ধান্ত

1. ~~**ল্যান্ডিং পেজ root path-এ নাকি `/lp/{slug}`?**~~ — **সিদ্ধান্ত: root path** (`seller1.<apex>/offer`), §4.3-এর reserved তালিকা সহ। D5-এ বাস্তবায়িত।
2. ~~**সাবডোমেইন বদলালে পুরনোটায় 301**~~ — **হয়ে গেছে।** tombstone-এর `user_id` থেকে শপের বর্তমান host বের করে resolver `moved_to` ফেরত দেয়, proxy path+query সহ 301 করে। যে shop-এর এখন কোনো ঠিকানা নেই, তার পুরনো label আগের মতোই 404।
3. **সেলারের নিজের ডোমেইন (T8b)** — `lp.sellershop.com` CNAME → আমাদের সার্ভার, per-domain Certbot HTTP-01। এই রাউন্ডে নয়।
4. ~~**`NEXT_PUBLIC_API_BASE_URL` relative করা হবে কি না**~~ — **দরকার হয়নি।** পাবলিক ল্যান্ডিং কম্পোনেন্টগুলো আগে থেকেই relative `/api/...` ব্যবহার করে, আর handoff পেজ ইচ্ছাকৃতভাবে relative। ড্যাশবোর্ডের বাকি কলগুলো absolute থেকে গেছে (CORS `*` + Bearer টোকেনে কাজ করে); শুধু নেটওয়ার্ক ট্যাবে `bsol.` দেখা যায়। পরে চাইলে বদলানো যাবে, এখন প্রয়োজন নেই।
5. ~~**Admin কি কোনোভাবে সেলারের সাবডোমেইন দেখতে পারবে**~~ — **সমাধান হয়েছে: impersonation, প্ল্যাটফর্ম origin থেকে।** §16 দেখো।

---

## 14. ল্যান্ডিং পেজ ও slug (D5, সিদ্ধান্ত ২০২৬-০৮-১৪)

**নিয়ম:** ল্যান্ডিং পেজ ব্যবহার করতে হলে সাবডোমেইন **বাধ্যতামূলক** — বিজ্ঞাপন সেলারের নিজের ডোমেইনে চলবে।

- **URL:** `https://{sub}.{apex}/{slug}` — `/lp/` prefix ছাড়া। checkout-এর thank-you ধাপও একই ডোমেইনে (`/{slug}/thank-you`), কারণ মাঝপথে ডোমেইন বদলালে `_fbp`/`_fbc` কুকি হারিয়ে ট্র্যাকিং ভেঙে যেত।
- **Slug uniqueness:** shop-প্রতি (`unique(user_id, slug)` + অ্যাপ-স্তরে `shopUserIds()`-scoped চেক)। দুই সেলার একই `offer` রাখতে পারে, কারণ host আলাদা করে।
- **Publish গেট:** সাবডোমেইন ছাড়া publish করা যাবে না (`error_code: subdomain_required`)। Draft তৈরি/এডিট করা যাবে — সেলার ঠিকানা বাছার আগেই পেজ বানাতে পারে। ইতিমধ্যে published পেজ (যাদের মালিকের সাবডোমেইন নেই) অপরিবর্তিত থাকে ও এডিটযোগ্য থাকে; শুধু draft→published রূপান্তর আটকায়।
- **`/lp/` রুট ও `legacy_slug` সরানো হয়েছে (২০২৬-০৮-১৫)।** প্রথমে `legacy_slug` রাখা হয়েছিল সাবডোমেইনের আগেকার পেজগুলোর `bsol.{apex}/lp/{slug}` ঠিকানা বাঁচাতে (তখন ২১২ ভিজিট ও ২৩ অর্ডার দেখে ধরে নেওয়া হয়েছিল ট্র্যাফিক আসল)। পরে নিশ্চিত হওয়া গেল ওগুলো টেস্ট ডেটা, আর যে দুটো শপের প্রকাশিত পেজ আছে দুটোরই এখন নিজস্ব সাবডোমেইন — তাই পুরনো ঠিকানার উপর বাস্তবে কিছুই নির্ভর করছিল না। এখন **ল্যান্ডিং পেজ শুধু সেলারের নিজের host-এ**।
  - `/lp/` এখনো Next.js-এর ভেতরের render target (proxy `/{slug}` → `/lp/{slug}` rewrite করে), কিন্তু proxy যেকোনো host-এ সরাসরি `/lp/...` রিকোয়েস্ট 404 করে। rewrite proxy-কে পুনরায় ডাকে না, তাই ভেতরের রেন্ডার অক্ষত থাকে।
  - `canonicalUrl()` এখন **nullable** — সাবডোমেইনহীন শপের পেজের কোনো পাবলিক ঠিকানা নেই, আর একটা বানিয়ে দেওয়া মানে সেলারকে 404 করা লিংক ধরিয়ে দেওয়া। publish করতে সাবডোমেইন লাগে, তাই এটা শুধু draft-এ ঘটে।
- **`LandingPageResolver`** — প্রতিটি পাবলিক ল্যান্ডিং endpoint এখানেই যায়, রিকোয়েস্টের Host থেকে শপ বের করে। সেলার সাবডোমেইন → ওই শপের `slug`; **প্ল্যাটফর্ম host বা মালিকবিহীন সাবডোমেইন → কিছুই না** (নাহলে `unknown.{apex}/offer` অন্য সেলারের পেজ দেখাত)। ফ্রন্টএন্ডে কোনো পরিবর্তন লাগেনি, কারণ পাবলিক কলগুলো আগে থেকেই same-origin relative।
- **অজানা slug এখন সত্যিকারের 404** (আগে "unavailable" লেখা 200 পেজ) — বিজ্ঞাপনের গন্তব্যে soft-200 মানে টাইপো করা ক্যাম্পেইন লিংক সুস্থ দেখায় আর মৃত URL ইনডেক্স হয়।
- **duplicate content আর নেই** — এক পেজ, এক ঠিকানা। (মাঝখানে `/lp/` → canonical রিডাইরেক্ট ছিল; `/lp/` পুরোপুরি সরে যাওয়ায় সেটারও আর দরকার নেই।)
- **URL builder একটাই** — `LandingPage::canonicalUrl()`। সেলার ড্যাশবোর্ড, admin তালিকা ও abandoned-checkout resume লিংক সবাই এটাই পড়ে। ফ্রন্টএন্ডের পাবলিক ফ্লোতে `landingPathForSlug()` (host অনুযায়ী `/{slug}` বা `/lp/{slug}`); ড্যাশবোর্ড/admin ইচ্ছাকৃতভাবে সেটা ব্যবহার করে না, কারণ ওরা অন্য শপের পেজ দেখাতে পারে।

## 15. জানা সীমাবদ্ধতা

- **`www.{seller}.{apex}` কাজ করে না** — Let's Encrypt wildcard এক লেভেল কভার করে (`*.{apex}`), দুই লেভেল (`*.*.{apex}`) ইস্যু করা যায় না। কেউ `www.` লিখলে ব্রাউজার সার্টিফিকেট সতর্কতা দেখাবে। সমাধান নেই (per-host cert ছাড়া); সেলারকে `www.` ছাড়া ঠিকানা দিতে হবে, এবং কোথাও `www.` সহ লিংক দেখানো যাবে না।
- ~~**`FRONTEND_URL` এখনো `bsol.{apex}`**~~ — **সমাধান হয়েছে।** `App\Support\FrontendUrl` এখন সেলারের নিজের ঠিকানা ফেরত দেয়: email verification লিংক, তিনটা gateway/OAuth কলব্যাক (bKash subscription, bKash SMS credit, Facebook connect), আর CAPI test event-এর `event_source_url`।
  **গুরুত্বপূর্ণ ডিজাইন সিদ্ধান্ত:** ঠিকানা বের করা হয় **ব্যবহারকারী থেকে, রিকোয়েস্টের `Host` হেডার থেকে নয়**। এই URL গুলো ইমেইলে ও পেমেন্ট-গেটওয়ে কলব্যাকে যায়; Host হেডার আক্রমণকারী-নিয়ন্ত্রিত, তাই সেটা বিশ্বাস করলে প্রতিটাই open redirect / phishing ভেক্টর হয়ে যেত। Facebook কলব্যাকে signed state-এর `user_id` থেকে, bKash কলব্যাকে payment রেকর্ডের মালিক থেকে resolve হয় — state/payment না পাওয়া গেলে প্ল্যাটফর্ম URL-ই একমাত্র নিরাপদ গন্তব্য।
  `LandingPage::canonicalUrl()`-এর fallback ইচ্ছাকৃতভাবে প্ল্যাটফর্ম URL-ই রাখে — সাবডোমেইনহীন শপের পেজের ঠিকানা ওটাই।
- **ড্যাশবোর্ডের API কল এখনো absolute** (`bsol.{apex}/api`) — CORS `*` + Bearer টোকেনে কাজ করে; শুধু নেটওয়ার্ক ট্যাবে প্ল্যাটফর্ম ডোমেইন দেখা যায়। পাবলিক ল্যান্ডিং ফ্লো ও handoff relative, তাই কার্যকারিতায় প্রভাব নেই (§11.4)।

## 12. ফেজ পরিকল্পনা

| ফেজ | পরিধি | নির্ভরতা |
|---|---|---|
| **D1** | Wildcard cert issue + nginx regex block + wildcard DNS রেকর্ড | Cloudflare API token (ব্যবহারকারীর কাছে) |
| **D2** | Backend: `shop_profiles` কলাম, `subdomain_tombstones`, reserved const, ভ্যালিডেশন, availability endpoint, `GET /public/shop-by-subdomain/{label}` | — |
| **D3** | Handoff টোকেন (§6): login রেসপন্সে `redirect_to`, `/auth/handoff/exchange`, Redis স্টোর | D2 |
| **D4** | Frontend: `src/middleware.ts` host resolver, `/auth/handoff` পেজ, Shop Profile-এ সাবডোমেইন UI (live availability চেক), relative API base | D2, D3 |
| **D5** | ল্যান্ডিং পেজ সাবডোমেইনে (`/{slug}` rewrite), `/lp/{slug}` alias হিসেবে বহাল | D4 |
| **D6** | ট্র্যাকিং Full tier চালু করা সাবডোমেইনে (`tracking_capi_context.md` T6-এর সাথে) | D5 + ট্র্যাকিং T6 |

**প্রতি ফেজের চেকলিস্ট:** isolated Postgres schema-তে টেস্ট, ২টা পরিচিত pre-existing failure baseline, `php artisan migrate --force`, frontend বদলালে `deploy-safe.sh`, এবং **staff-role তিন-কেস verification** (owner → 200, granted staff → 200, non-granted/owner_only route staff → 403) — `CONTEXT.md §৩১` অনুযায়ী বাধ্যতামূলক।

---

## 13. বাকি ধাপ (এই মুহূর্তে)

**সার্ভার অ্যাক্সেসের সীমা (verified ২০২৬-০৮-১৪):** assistant যে অ্যাকাউন্টে চলে (`claude-dev`, হোস্ট `pdns` = `103.157.253.197`, অর্থাৎ এটাই সঠিক BSOL সার্ভার — হোস্টনেমটা বিভ্রান্তিকর হলেও) তার sudo অনুমতি সংকীর্ণ allowlist:

```
systemctl restart|status|is-active hybrid-frontend.service
systemctl restart php8.3-fpm
systemctl restart|reload nginx
chown -R www-data:www-data /var/www/hybrid-stack/frontend/.next
frontend/scripts/deploy-safe.sh
(www-data) ALL
```

অর্থাৎ `apt`, `certbot`, `/etc/nginx/` বা `/etc/letsencrypt/`-এ লেখা — কিছুই assistant করতে পারে না, কিন্তু **`nginx -t` করার পর reload করতে পারে**। তাই server block assistant তৈরি করে দেবে, ফাইলটা জায়গামতো বসাতে হবে root-এ।

| # | কাজ | কার |
|---|---|---|
| 1 | Cloudflare API token তৈরি (My Profile → API Tokens → Edit zone DNS, শুধু `zyrotechbd.com`) ও `/etc/letsencrypt/cloudflare.ini`-তে বসানো | ব্যবহারকারী (root) |
| 2 | `python3-certbot-dns-cloudflare` ইনস্টল + wildcard cert issue + `renew --dry-run` | ব্যবহারকারী (root) |
| 3 | server block ফাইল তৈরি | assistant (সম্পন্ন) |
| 4 | ফাইলটা `/etc/nginx/sites-available/`-এ কপি + symlink + `nginx -t` | ব্যবহারকারী (root) |
| 5 | `systemctl reload nginx` | assistant |
| 6 | Cloudflare-এ `*` A রেকর্ড যোগ (ধাপ ৪-৫-এর পরে) | ব্যবহারকারী |
| 7 | D2–D5 implementation | assistant |


---

## 16. Admin support access — impersonation (§11.5, সমাধান ২০২৬-০৮-১৫)

**সমস্যা:** §9 নিয়ম ৩ বলে admin সেলারের সাবডোমেইনে লগইন করবে না — সেখানে সেলারের নিজের লেখা ল্যান্ডিং-পেজ HTML চলে, আর সেই origin-এর `localStorage`-এ admin টোকেন থাকা মানে টোকেন চুরির একমাত্র অবশিষ্ট পথ খুলে দেওয়া। কিন্তু সাপোর্টের জন্য সেলার যা দেখে সেটা দেখা দরকার।

**সমাধান:** `POST /admin/users/{id}/impersonate` — admin সেলারের একটা টোকেন পায় এবং **প্ল্যাটফর্ম origin-এই** (`bsol.{apex}/dashboard`) সেলারের ড্যাশবোর্ড দেখে। ওই origin-এ সেলার-লিখিত কোনো markup চলে না, তাই নিয়ম ৩ অক্ষুণ্ন থাকে অথচ সাপোর্ট ঠিক একই ড্যাশবোর্ড দেখে।

- **টোকেন ৬০ মিনিটে মেয়াদোত্তীর্ণ** (Sanctum `expiresAt`) — ভুলে খোলা রাখা ট্যাব নিজে থেকেই বন্ধ হয়।
- **নাম `impersonation:admin-{id}`** — সেশন শেষ হওয়ার পরেও `personal_access_tokens`-এ ট্রেইল থেকে যায়; সাথে `Log::warning`-এ admin/target/IP।
- **admin-কে impersonate করা যায় না** (`target_is_admin`, 403) — এটা সেলার অ্যাকাউন্ট দেখার টুল, অন্য প্রশাসকের ক্ষমতা ধার করার নয়।
- **UI**: Admin → Active Customers → "দেখুন" বাটন। ড্যাশবোর্ডে হলুদ ব্যানার ("সাপোর্ট মোড — আপনি X হিসেবে দেখছেন") + "অ্যাডমিনে ফিরুন"। admin-এর নিজের টোকেন `admin_token_backup`-এ রাখা হয়, তাই ফিরে আসতে আবার লগইন লাগে না।
- **সার্ভারে কোনো "acting as" state নেই** — টোকেনটাই সেলারের। তাই ব্যানারের flag ক্লায়েন্ট-সাইড; এটা প্রদর্শনের জন্য, নিরাপত্তা সীমানা নয় (আসল সীমানা টোকেনের মেয়াদ ও scope)।


---

## 17. Onboarding — নতুন সেলারের বাধ্যতামূলক সেটআপ (২০২৬-০৮-১৫)

রেজিস্ট্রেশন প্ল্যাটফর্ম ডোমেইনে (`bsol.{apex}`) হয়। ফোন verify হওয়ার পর সেলার সরাসরি ড্যাশবোর্ডে না গিয়ে `/onboarding`-এ যায়:

1. **শপ প্রোফাইল** (নাম, ফোন, ঠিকানা) — কুরিয়ার ওয়েবিল/ইনভয়েসে লাগে।
2. **শপের ঠিকানা (সাবডোমেইন)** — live availability চেক সহ, বদলানোর পরিণতির সতর্কতাসহ।

শেষ হলে **সেলার নিজের ঠিকানায় রিডাইরেক্ট হয়ে যায়**।

**কেন দুটোই বাধ্যতামূলক:** সাবডোমেইন ছাড়া ল্যান্ডিং পেজ publish করা যায় না (§14), আর প্রোফাইল সেভ না করে সাবডোমেইন দাবি করা যায় না — অর্থাৎ ধাপ দুটো এড়িয়ে গেলে অ্যাকাউন্ট দিয়ে আসলে বিক্রি করাই যায় না।

**`POST /auth/handoff/start` কেন লাগল:** সেলার সাবডোমেইন দাবি করে সেশনের মাঝপথে, যখন তার টোকেন প্ল্যাটফর্ম origin-এ। `localStorage` origin পার হয় না, তাই লগইন-টাইমের handoff-ই যথেষ্ট নয় — এই authenticated endpoint নিজের ঠিকানার জন্য একটা single-use কোড দেয়, ফলে আবার লগইন করতে হয় না।

**Gate:** `UserShell` — `onboarding.required` হলে `/onboarding`-এ পাঠায়। admin ও staff অব্যাহতিপ্রাপ্ত (কারও নিজের `ShopProfile` নেই; staff owner-এরটা ব্যবহার করে), impersonation সেশনও অব্যাহতিপ্রাপ্ত।

**পরের লগইন:** সেলার প্ল্যাটফর্ম ডোমেইনে লগইন করলে §6-এর handoff তাকে সাথে সাথে নিজের ঠিকানায় নিয়ে যায় — এই আচরণ D3 থেকেই আছে।

---

## 18. WordPress Connect API কোন ডোমেইন ব্যবহার করে

**প্ল্যাটফর্ম ডোমেইন — এবং সেটাই থাকা উচিত।** প্লাগইনে hardcoded:

```
BSOL_API_URL = https://bsol.zyrotechbd.com/api/connect/v1/
```

**কেন সেলারের সাবডোমেইন নয়:**

1. **পরিচয় API key থেকে আসে, host থেকে নয়** — `AuthenticatePlatformApiKey` key hash দিয়ে merchant resolve করে, আর `X-Client-Domain` মেলায় **WooCommerce সাইটের** ডোমেইনের সাথে (`platform_api_keys.domain`), সেলারের BSOL সাবডোমেইনের সাথে নয়। host এখানে কোনো তথ্যই যোগ করে না।
2. **এটা server-to-server** — কোনো ব্রাউজার, origin বা কুকি নেই। per-origin টোকেন নিরাপত্তার যুক্তি (§2) এখানে প্রযোজ্যই নয়।
3. **স্থায়িত্বই নির্ণায়ক** — সেলারের সাবডোমেইন পরিবর্তনযোগ্য (বদলাতে/ছাড়তে পারে)। প্লাগইন সেদিকে তাক করা থাকলে সাবডোমেইন বদলানোর মুহূর্তে **প্রতিটি কানেক্টেড WooCommerce সাইট ভেঙে যেত**। আর retired label-এ আমরা যে 301 দিই, বেশিরভাগ HTTP ক্লায়েন্ট 301-এ POST-কে GET-এ নামিয়ে দেয় — অর্থাৎ sync নীরবে ব্যর্থ হতো, দৃশ্যমান ত্রুটি ছাড়াই।
4. **সেলার এই URL দেখেই না**, তাই ব্র্যান্ডিং সুবিধাও নেই।

**সংশ্লিষ্ট সংশোধন:** `WordpressApiKeyController::pluginVersion()`-এর `download_url` আগে request Host থেকে তৈরি হতো, ফলে সেলার নিজের সাবডোমেইন থেকে খুললে ভিন্ন URL আসত। এখন `config('app.url')`-এ pinned — প্লাগইনের নিজের API base-এর সাথে সঙ্গতিপূর্ণ।
