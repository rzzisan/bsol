# Landing Page Statistics Feature - Implementation Documentation

## Overview
Comprehensive analytics system for landing pages enabling sellers to track visitor traffic, conversion rates, geographic distribution, and referrer sources. Integrated into seller dashboard with header, sidebar, and bilingual support.

---

## What Was Built

### 1. Database Layer (3 Migrations)
**Location:** `/backend/database/migrations/`

#### Migration 1: `2026_05_30_000001_create_landing_page_visits_table.php`
- **Purpose:** Store individual visitor records with complete metadata
- **Schema:**
  - id, landing_page_id (FK), ip_address, country, city, latitude, longitude
  - referrer, user_agent, session_id, user_id (FK nullable), created_at, updated_at
- **Indexes:** landing_page_id, ip_address, created_at, country
- **Why:** Real-time per-visit data for detailed analytics queries

#### Migration 2: `2026_05_30_000002_create_landing_page_statistics_table.php`
- **Purpose:** Daily aggregated statistics for performance optimization
- **Schema:**
  - id, landing_page_id (FK), date, total_visits, unique_visitors, orders_placed, created_at, updated_at
- **Unique Constraint:** (landing_page_id, date) prevents duplicates
- **Why:** Avoid recalculating daily metrics on every request

#### Migration 3: `2026_05_30_000003_create_landing_page_visit_orders_table.php`
- **Purpose:** Junction table linking visits to orders for conversion tracking
- **Schema:**
  - id, landing_page_visit_id (FK), order_id (FK), created_at, updated_at
- **Unique Constraint:** (landing_page_visit_id, order_id) prevents duplicates
- **Why:** Track which visits resulted in orders

---

## Services & Business Logic

### 2. IP Geolocation Service
**File:** `/backend/app/Services/IpLocationService.php`

**Functionality:**
- Resolves IP addresses to location data (country, city, lat/long)
- Multi-provider support with fallback:
  1. **ip-api.com** (free, 45 req/min) - Primary
  2. **IPStack** (paid, higher limits) - Fallback with API key
  3. **MaxMind** (stub) - Future support
- **30-day Redis cache** to minimize external API calls
- Special handling for localhost/127.0.0.1

**Key Methods:**
- `getLocation(string $ip)` - Main entry point
- `fetchFromIpApi($ip)` - Free API provider
- `fetchFromIpStack($ip)` - Paid provider
- `getLocalHostLocation()` - Localhost special case

**Why:** Enrich visit records with geographic context for analytics

### 3. Landing Page Analytics Service
**File:** `/backend/app/Services/LandingPageAnalyticsService.php`

**Functionality:**
- Core business logic for analytics data aggregation
- 7 public methods for different analytics queries

**Methods:**
1. `recordVisit($landingPageId, $ip, $referrer, $userAgent, $userId)`
   - Creates visit record with IP geolocation lookup
   - Non-blocking error handling

2. `getStatistics($landingPageId, $startDate, $endDate)`
   - Returns aggregated stats: total_visits, unique_visitors, total_orders, daily_stats[]

3. `getVisitorDetails($landingPageId, $startDate, $endDate, $limit, $offset)`
   - Returns paginated visitor list with IP, location, timestamp

4. `getStatisticsByCountry($landingPageId, $startDate, $endDate)`
   - Groups visits by country with unique visitor count

5. `getStatisticsByReferrer($landingPageId, $startDate, $endDate)`
   - Groups visits by traffic source (referrer URL)

6. `linkVisitToOrder($visitId, $orderId)`
   - Records conversion: visit → order

7. `updateDailyStatistics($landingPageId)`
   - Auto-aggregates daily metrics from individual visits

**Why:** Centralized, testable business logic separate from HTTP layer

### 4. Order Service Enhancement
**File:** `/backend/app/Services/LandingPageOrderService.php`

**Enhancement:**
- `linkVisitsToOrder(Order $order, LandingPage $page)`
  - Auto-links recent visits (30-minute window) to newly created order
  - Matches by: authenticated user_id OR IP address
  - Non-blocking with error logging

**Why:** Automatically track conversions without manual linking

---

## Eloquent Models

### 5. LandingPageVisit Model
**File:** `/backend/app/Models/LandingPageVisit.php`

**Relationships:**
- `belongsTo(LandingPage)` - Parent landing page
- `belongsTo(User, 'user_id')` - Authenticated visitor (nullable)
- `belongsToMany(Order via landing_page_visit_orders)` - Converted orders

**Casts:**
- latitude, longitude as float
- created_at, updated_at as datetime

**Why:** Eloquent ORM integration for type-safe queries

### 6. LandingPageStatistic Model
**File:** `/backend/app/Models/LandingPageStatistic.php`

**Relationships:**
- `belongsTo(LandingPage)` - Parent landing page

**Why:** Separate model for daily aggregates with proper relationships

---

## API Layer

### 7. Analytics Controller
**File:** `/backend/app/Http/Controllers/LandingPageAnalyticsController.php`

**Endpoints (all require `auth:sanctum`):**

1. **GET `/api/landing/analytics/{landingPageId}/statistics`**
   - Query params: start_date, end_date
   - Response: { total_visits, total_unique_visitors, total_orders, daily_stats[] }

2. **GET `/api/landing/analytics/{landingPageId}/visitors`**
   - Query params: start_date, end_date, limit=20, offset=0
   - Response: { total, limit, offset, visitors[] }

3. **GET `/api/landing/analytics/{landingPageId}/by-country`**
   - Query params: start_date, end_date
   - Response: [{ country, visits, unique_visitors }]

4. **GET `/api/landing/analytics/{landingPageId}/by-referrer`**
   - Query params: start_date, end_date
   - Response: [{ referrer, visits, unique_visitors }]

5. **POST `/api/landing/analytics/{landingPageId}/link-visit-to-order`**
   - Body: { visit_id, order_id }
   - Response: { success: true }

**Authorization:**
- Direct ownership validation: `if ($landingPage->user_id !== auth()->id()) return 403`
- Sellers only see their own landing page analytics

**Why:** RESTful API for frontend consumption with proper authentication

### 8. Visit Tracking Middleware
**File:** `/backend/app/Http/Middleware/TrackLandingPageVisit.php`

**Functionality:**
- Automatically records visit when landing page is accessed
- Extracts IP from:
  - X-Forwarded-For header (proxy)
  - HTTP_CLIENT_IP
  - REMOTE_ADDR (fallback)
- Captures: referrer, user-agent, session_id, authenticated user_id
- Non-blocking error handling

**Attached to Routes:**
- Wrapped around GET/POST `/lp/{slug}` in `routes/web.php`

**Why:** Automatic, transparent visit tracking without code changes to landing page controller

---

## Route Configuration

### 9. API Routes
**File:** `/backend/routes/api.php`

**Changes:**
- Added 5 analytics routes with numeric constraint: `.where('landingPageId', '[0-9]+')`
- Routes prefix: `/api/landing/analytics/`
- All require: `middleware('auth:sanctum')`

**Why:** Numeric constraint prevents regex confusion, auth guards seller-only access

### 10. Web Routes
**File:** `/backend/routes/web.php`

**Changes:**
- Wrapped `/lp/{slug}` routes with `middleware('track_landing_page_visit')`
- Enabled automatic visit recording

**Why:** Transparent middleware execution on landing page visits

---

## Frontend Implementation

### 11. Analytics Dashboard Page
**File:** `/frontend/src/app/dashboard/landing-page-analytics/[landingPageId]/page.tsx`

**Features:**
- **Locale Management:** Bilingual support (bn/en) from localStorage
- **Authentication:** Reads auth_token from localStorage, sends Bearer token
- **Data Fetching:** Parallel API calls for stats, visitors, country, referrer data
- **UI Components:**
  - Summary cards: Total Visits, Unique Visitors, Orders Placed
  - Date filter: Start/End date inputs with reset
  - Daily statistics table: Date, Visits, Unique Visitors, Orders
  - Country breakdown: Scrollable list of country visitors
  - Traffic sources: Referrer list
  - Recent visitors table: IP, Location, Timestamp, Orders with pagination
- **UserShell Integration:**
  - activeKey="landing-pages" (highlights menu item)
  - Bilingual page title: `${landingPageTitle} - স্ট্যাটিস্টিক্স / Statistics`
  - Bilingual subtitle with Bengali & English descriptions
- **Theme Variables:**
  - All styling uses CSS variables: `var(--surface)`, `var(--foreground)`, etc.
  - Consistent with seller dashboard theming

**Why:** Full-featured analytics dashboard integrated into seller dashboard UI

### 12. Landing Pages List Update
**File:** `/frontend/src/app/dashboard/landing-pages/page.tsx`

**Changes:**
- Added statistics link: `<Link href={/dashboard/landing-page-analytics/${page.id}}>`
- Bilingual text: "স্ট্যাটিস্টিক্স" / "Statistics"
- Link position: Between View and Edit actions

**Why:** Direct access to analytics from landing pages list

---

## Configuration

### 13. Services Configuration
**File:** `/backend/config/services.php`

**Addition:**
```php
'ip_location' => [
    'provider' => env('IP_LOCATION_PROVIDER', 'ipapi'),
    'ipstack_key' => env('IPSTACK_API_KEY')
]
```

**Why:** Externalize provider selection and API keys

### 14. Bootstrap Configuration
**File:** `/backend/bootstrap/app.php`

**Addition:**
```php
'track_landing_page_visit' => TrackLandingPageVisit::class
```

**Why:** Register middleware alias for web routes usage

---

## Issues Resolved

### Issue 1: 404 Route Matching
- **Problem:** Analytics API endpoints returned 404 "Not Found"
- **Root Cause:** Route patterns didn't constrain landingPageId to numeric values
- **Solution:** Added `.where('landingPageId', '[0-9]+')` to all 5 analytics routes
- **Result:** Routes now properly match numeric IDs

### Issue 2: 401 Unauthorized Errors
- **Problem:** All analytics API endpoints returning 401 despite Bearer token
- **Root Cause:** Frontend using wrong localStorage key - 'token' instead of 'auth_token'
- **Solution:** Changed `localStorage.getItem('token')` → `localStorage.getItem('auth_token')`
- **Result:** Token correctly retrieved and sent in Authorization header

### Issue 3: Authorization Check Failed
- **Problem:** Controller using undefined policy authorization
- **Root Cause:** Policy-based authorization without explicit policy class
- **Solution:** Replaced with direct ownership validation: `if ($landingPage->user_id !== auth()->id()) return 403`
- **Result:** Sellers only see their own page analytics

### Issue 4: Visits Not Recorded
- **Problem:** Analytics dashboard showing 0 visits after accessing landing page
- **Root Cause:** TrackLandingPageVisit middleware not attached to landing page routes
- **Solution:** Wrapped `/lp/{slug}` routes with middleware in routes/web.php
- **Result:** Visits automatically recorded to database

### Issue 5: Orders Failing with Parse Error
- **Problem:** Orders couldn't be placed from landing page
- **Root Cause:** PHP Parse Error - missing closing brace in LandingPageOrderService.php
- **Solution:** Added missing closing brace at end of file
- **Result:** Orders successfully placed and auto-linked to visits

### Issue 6: Page Lacked Dashboard Integration
- **Problem:** Analytics page showing without header, sidebar, navigation
- **Root Cause:** Page component not wrapped with UserShell dashboard wrapper
- **Solution:** Wrapped main return with UserShell component with proper props
- **Result:** Analytics page now displays with full dashboard UI

### Issue 7: Wrong Route Structure
- **Problem:** Analytics page at `/admin/landing-page-analytics` (admin route) but for sellers
- **Root Cause:** URL structure inconsistent with seller dashboard routes
- **Solution:** Moved page from `/admin/` to `/dashboard/landing-page-analytics/`
- **Result:** Proper route hierarchy: `/dashboard/landing-pages` → `/dashboard/landing-page-analytics/`

---

## Technical Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js | 16.2.4 |
| Frontend | React | 19.2.4 |
| Frontend | TypeScript | - |
| Backend | Laravel | 13.x |
| Backend | PHP | 8.3.6 |
| Database | PostgreSQL | 16 |
| Auth | Laravel Sanctum | Bearers |
| Cache | Redis | - |
| Geolocation | ip-api.com | free |
| Geolocation | IPStack | paid (fallback) |

---

## Testing Performed

### Database Validation
- ✅ 3 migrations executed successfully
- ✅ 20 total visits recorded
- ✅ 9 landing page orders created
- ✅ 8 visit-order conversions tracked
- ✅ 5.26% conversion rate on page #5

### API Validation
- ✅ All 5 endpoints functional with authorization
- ✅ Bearer token authentication working
- ✅ Pagination working (limit, offset)
- ✅ Date filtering working (start_date, end_date)
- ✅ Country grouping working
- ✅ Referrer grouping working

### Frontend Validation
- ✅ Build successful: 97 modules, 0 TypeScript errors
- ✅ Authentication flow working
- ✅ All 4 API calls executing in parallel
- ✅ Data display correct
- ✅ Pagination controls working
- ✅ Date filters working
- ✅ Dashboard integration complete

---

## Deployment

### Build Process
```bash
cd /var/www/hybrid-stack/frontend
npm run build
# ✅ Build successful in 505ms
```

### Service Restart
```bash
supervisorctl restart hybrid-stack-frontend
# ✅ Frontend running on port 3001
```

### Nginx Routing
- Frontend: http://127.0.0.1:3001 (proxied via nginx)
- Backend API: http://127.0.0.1:8000 (Laravel)

---

## File Structure

```
/backend/
├── app/
│   ├── Services/
│   │   ├── IpLocationService.php (IP geolocation)
│   │   ├── LandingPageAnalyticsService.php (analytics logic)
│   │   └── LandingPageOrderService.php (order creation + visit linking)
│   ├── Models/
│   │   ├── LandingPageVisit.php
│   │   └── LandingPageStatistic.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   └── LandingPageAnalyticsController.php
│   │   └── Middleware/
│   │       └── TrackLandingPageVisit.php
│   └── ...
├── database/
│   └── migrations/
│       ├── 2026_05_30_000001_create_landing_page_visits_table.php
│       ├── 2026_05_30_000002_create_landing_page_statistics_table.php
│       └── 2026_05_30_000003_create_landing_page_visit_orders_table.php
├── routes/
│   ├── api.php (5 analytics endpoints)
│   └── web.php (middleware attachment)
├── bootstrap/
│   └── app.php (middleware registration)
├── config/
│   └── services.php (IP location config)
└── ...

/frontend/
├── src/
│   └── app/
│       └── dashboard/
│           ├── landing-pages/
│           │   └── page.tsx (list with statistics link)
│           └── landing-page-analytics/
│               └── [landingPageId]/
│                   └── page.tsx (full analytics dashboard)
└── ...
```

---

## Key Decisions

### Why Service Layer?
- Testable business logic separate from HTTP concerns
- Reusable across multiple controllers/commands
- Easy to mock for testing

### Why Separate Statistics Table?
- Avoid recalculating metrics on every request
- Daily aggregation for performance
- Faster dashboard loads
- Historical data preservation

### Why Redis Cache for IP Geolocation?
- Minimize external API calls (rate limits)
- 30-day cache avoids repeated lookups
- Fallback provider support
- Non-blocking error handling

### Why Middleware for Visit Tracking?
- Transparent tracking without modifying controller code
- Automatic execution on every landing page visit
- Can be enabled/disabled globally
- Centralized error handling

### Why Dashboard Route Not Admin?
- Analytics is a seller feature, not admin
- Proper URL hierarchy: `/dashboard/*`
- Prevents accidental admin access
- UserShell integration with seller menu

---

## Future Enhancements

1. **Dashboard Charts:** Visualize trends with Chart.js/Recharts
2. **Export Reports:** PDF/CSV export functionality
3. **Advanced Filtering:** Device type, browser, OS breakdowns
4. **Goal Tracking:** Custom conversion goals per landing page
5. **A/B Testing:** Compare multiple landing page variants
6. **Email Reports:** Scheduled analytics emails to sellers

---

## Support & Maintenance

### Monitoring
- Check supervisor status: `supervisorctl status hybrid-stack-frontend`
- Monitor Redis cache hits/misses
- Track IP API rate limits

### Troubleshooting
- **No visits recorded:** Check middleware attachment in routes/web.php
- **401 errors:** Verify auth_token in localStorage
- **Slow analytics:** Check daily_stats aggregation running
- **IP geolocation failing:** Check Redis cache, fallback to IPStack

---

## Documentation References
- Backend API: See ANALYTICS_FEATURE.md in backend/
- Testing: See ANALYTICS_TESTING.md in backend/
- Frontend: Component TypeScript interfaces documented in-code
