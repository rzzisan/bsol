# LANDING_PAGE_STATISTIC_SKILL

## Overview
This skill encompasses the complete landing page analytics system implementation, including real-time visit tracking, conversion monitoring, geographic analytics, and seller dashboard integration.

## When to Use This Skill

Use this skill when:
- Debugging landing page visit tracking issues
- Adding new analytics metrics or visualizations
- Fixing authorization or authentication problems with analytics endpoints
- Extending visitor data collection (device type, browser, etc.)
- Optimizing analytics query performance
- Adding export or reporting features
- Troubleshooting IP geolocation lookups
- Integrating new analytics providers
- Creating analytics dashboards or reports
- Fixing analytics API endpoint issues
- Implementing new conversion tracking methods

## Core Components

### 1. Backend Services

#### IpLocationService (`/backend/app/Services/IpLocationService.php`)
**Purpose:** Geolocation lookup and caching

**Key Methods:**
- `getLocation(string $ip)`: Resolve IP to location with 30-day cache
- `fetchFromIpApi($ip)`: Use free ip-api.com provider
- `fetchFromIpStack($ip)`: Use paid IPStack provider
- `getLocalHostLocation()`: Handle localhost/127.0.0.1

**Configuration:** 
```php
env('IP_LOCATION_PROVIDER', 'ipapi') // 'ipapi' or 'ipstack'
env('IPSTACK_API_KEY')
```

**Important Notes:**
- Free ip-api: 45 requests/minute
- Caches 30 days in Redis
- Non-blocking error handling (doesn't fail requests)
- Returns: {country, city, latitude, longitude, isp}

#### LandingPageAnalyticsService (`/backend/app/Services/LandingPageAnalyticsService.php`)
**Purpose:** Core analytics business logic

**Key Methods:**
1. `recordVisit($landingPageId, $ip, $referrer, $userAgent, $userId)` - Record visitor
2. `getStatistics($landingPageId, $startDate, $endDate)` - Aggregate stats
3. `getVisitorDetails($landingPageId, $startDate, $endDate, $limit, $offset)` - Paginated visitors
4. `getStatisticsByCountry($landingPageId, $startDate, $endDate)` - Country breakdown
5. `getStatisticsByReferrer($landingPageId, $startDate, $endDate)` - Traffic source breakdown
6. `linkVisitToOrder($visitId, $orderId)` - Link conversion
7. `updateDailyStatistics($landingPageId)` - Aggregate daily stats

**Important Notes:**
- All methods include date range filtering
- Country/Referrer statistics use grouping and aggregation
- Handles nullable user_id (guests vs authenticated)
- Pagination: limit (default 20), offset

#### LandingPageOrderService Enhancement (`/backend/app/Services/LandingPageOrderService.php`)
**Purpose:** Auto-link visits to orders on creation

**Key Method:**
- `linkVisitsToOrder(Order $order, LandingPage $page)` - Auto-link recent visits (30-min window)

**Matching Logic:**
- First by authenticated user_id
- Fallback to IP address match
- Non-blocking with error logging

### 2. Middleware

#### TrackLandingPageVisit (`/backend/app/Http/Middleware/TrackLandingPageVisit.php`)
**Purpose:** Automatic visit recording on landing page access

**How It Works:**
1. Executes on every landing page request
2. Extracts IP from headers (X-Forwarded-For, CLIENT_IP, REMOTE_ADDR)
3. Captures: referrer, user-agent, session_id, auth user_id
4. Calls `LandingPageAnalyticsService->recordVisit()`
5. Non-blocking error handling

**Attachment:** Routes in `/backend/routes/web.php`
```php
Route::middleware('track_landing_page_visit')->group(function () {
    Route::get('/lp/{slug}', ...);
    Route::post('/lp/{slug}', ...);
});
```

**Important Notes:**
- Must be attached to landing page routes
- Alias registered in bootstrap/app.php
- Doesn't fail requests on errors

### 3. API Endpoints

**Base URL:** `/api/landing/analytics/{landingPageId}`

**All endpoints require:** `auth:sanctum` middleware

**All endpoints validate:** Seller ownership of landing page

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/statistics` | Aggregate stats + daily breakdown |
| GET | `/visitors` | Paginated visitor list |
| GET | `/by-country` | Country grouping |
| GET | `/by-referrer` | Referrer grouping |
| POST | `/link-visit-to-order` | Manual visit-order linking |

**Query Parameters:**
- `start_date`: YYYY-MM-DD (optional)
- `end_date`: YYYY-MM-DD (optional)
- `limit`: Number per page (default 20)
- `offset`: Pagination offset (default 0)

**Response Format:**
```json
{
  "total_visits": 25,
  "total_unique_visitors": 3,
  "total_orders": 3,
  "daily_stats": [
    {"date": "2026-05-30", "visits": 25, "unique_visitors": 3, "orders": 3}
  ]
}
```

### 4. Database Schema

**landing_page_visits table:**
- Stores individual visitor records
- FK to landing_pages, users (nullable)
- Indexes: landing_page_id, ip_address, created_at, country
- ~50KB per 1000 visits

**landing_page_statistics table:**
- Daily aggregated metrics
- FK to landing_pages
- Unique (landing_page_id, date)
- Much smaller than visits table

**landing_page_visit_orders table:**
- Junction table for conversions
- FK to landing_page_visits, orders
- Unique (landing_page_visit_id, order_id)
- Tracks which visits converted

### 5. Frontend Component

**Location:** `/frontend/src/app/dashboard/landing-page-analytics/[landingPageId]/page.tsx`

**Features:**
- Bilingual (Bengali/English) support
- Date range filtering
- 4 parallel API calls for data
- Summary cards: Visits, Unique Visitors, Orders
- Daily statistics table
- Country breakdown (scrollable)
- Traffic sources (scrollable)
- Recent visitors table with pagination
- UserShell integration for dashboard UI

**Authentication:**
- Reads `auth_token` from localStorage
- Sends Bearer token in Authorization header
- Early return if token missing

**Data Fetching:**
```typescript
// All 4 queries in parallel
Promise.all([
  fetch(`/api/landing/analytics/${landingPageId}/statistics?...`),
  fetch(`/api/landing/analytics/${landingPageId}/visitors?...`),
  fetch(`/api/landing/analytics/${landingPageId}/by-country?...`),
  fetch(`/api/landing/analytics/${landingPageId}/by-referrer?...`)
])
```

### 6. Configuration Files

**services.php:**
```php
'ip_location' => [
    'provider' => env('IP_LOCATION_PROVIDER', 'ipapi'),
    'ipstack_key' => env('IPSTACK_API_KEY')
]
```

**bootstrap/app.php:**
```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->alias([
        'track_landing_page_visit' => TrackLandingPageVisit::class,
    ]);
})
```

## Common Issues & Solutions

### Issue: No Visits Being Recorded
**Diagnostic:**
1. Check middleware is attached to `/lp/{slug}` routes
2. Verify middleware alias in bootstrap/app.php
3. Check database: `SELECT COUNT(*) FROM landing_page_visits;`
4. Check logs for exceptions

**Solution:** Ensure `middleware('track_landing_page_visit')` wraps landing page routes

---

### Issue: 404 on Analytics API Endpoints
**Diagnostic:**
1. Check route constraints: should have `.where('landingPageId', '[0-9]+')`
2. Verify landingPageId is numeric
3. Check route cache: `php artisan route:cache`

**Solution:** Add numeric constraint to route definition

---

### Issue: 401 Unauthorized on API Calls
**Diagnostic:**
1. Check token in browser localStorage under key `auth_token`
2. Verify Authorization header format: `Bearer ${token}`
3. Check token validity: `php artisan tinker` → `Auth::guard('sanctum')->user()`

**Solution:** Use `auth_token` key (not `token`) when reading from localStorage

---

### Issue: Slow Analytics Dashboard
**Diagnostic:**
1. Check daily stats aggregation: `SELECT COUNT(*) FROM landing_page_statistics;`
2. Monitor IP API rate limits (45 req/min free)
3. Check Redis cache: `redis-cli GET landing_page_visit_ip_*`

**Solution:** 
- Ensure `updateDailyStatistics()` is running (daily aggregation)
- Increase IPStack API key for higher rate limits
- Check Redis cache is working

---

### Issue: Wrong IP Address Detected
**Diagnostic:**
1. Check proxy header extraction in middleware
2. Verify app is behind proxy (nginx, cloudflare, etc.)
3. Test with `$_SERVER['HTTP_X_FORWARDED_FOR']`

**Solution:** Verify X-Forwarded-For header is being sent by reverse proxy

---

### Issue: IP Geolocation Always Fails Over to Same Provider
**Diagnostic:**
1. Check IPSTACK_API_KEY is set
2. Verify ip-api.com rate limits: 45 req/minute
3. Check Redis cache: `redis-cli`

**Solution:** 
- Set IPSTACK_API_KEY for higher rate limits
- Monitor rate limiting
- Consider dedicated geolocation database

---

## Testing Checklist

- [ ] Database migrations executed
- [ ] Middleware attached to landing page routes
- [ ] Analytics API endpoints return 200 with proper data
- [ ] Authorization check blocks unauthorized users
- [ ] Visits recorded on landing page access
- [ ] Orders auto-linked to recent visits
- [ ] Frontend dashboard loads without errors
- [ ] Date filtering works correctly
- [ ] Pagination controls work
- [ ] Country/Referrer grouping correct
- [ ] IP geolocation working
- [ ] Redis caching working
- [ ] Bearer token authentication working

## Performance Considerations

**Database Indexes:**
- landing_page_visits: (landing_page_id), (ip_address), (created_at), (country)
- landing_page_statistics: (landing_page_id, date)

**Query Optimization:**
- Use daily_stats table for month/year views
- Limit visitor list queries with pagination
- Cache daily statistics in Redis

**API Rate Limiting:**
- ip-api.com: 45 requests/minute (free)
- Use IPStack for production (paid)
- Redis cache prevents repeated lookups

**Frontend Optimization:**
- Parallel API calls (4 requests simultaneously)
- Pagination for visitor list (20 per page)
- Lazy load visualizations if added

## Related Files

**Backend:**
- `/backend/app/Services/IpLocationService.php`
- `/backend/app/Services/LandingPageAnalyticsService.php`
- `/backend/app/Services/LandingPageOrderService.php`
- `/backend/app/Models/LandingPageVisit.php`
- `/backend/app/Models/LandingPageStatistic.php`
- `/backend/app/Http/Controllers/LandingPageAnalyticsController.php`
- `/backend/app/Http/Middleware/TrackLandingPageVisit.php`
- `/backend/routes/api.php` (analytics routes)
- `/backend/routes/web.php` (middleware attachment)
- `/backend/bootstrap/app.php` (middleware registration)
- `/backend/config/services.php` (IP location config)
- `/backend/database/migrations/2026_05_30_00000*.php` (3 migrations)

**Frontend:**
- `/frontend/src/app/dashboard/landing-pages/page.tsx` (statistics link)
- `/frontend/src/app/dashboard/landing-page-analytics/[landingPageId]/page.tsx` (dashboard)
- `/frontend/src/components/user-shell.tsx` (dashboard wrapper)
- `/frontend/src/lib/dashboard-client.ts` (locale utilities)

**Documentation:**
- `/landing_page_statistic.md` (complete implementation doc)
- `ANALYTICS_FEATURE.md` (backend feature doc)
- `ANALYTICS_TESTING.md` (testing guide)

## Quick Reference Commands

```bash
# Check visits recorded
php artisan tinker
>>> LandingPageVisit::count()

# Check daily statistics
>>> LandingPageStatistic::where('landing_page_id', 5)->get()

# Test API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/api/landing/analytics/5/statistics?start_date=2026-05-30

# Clear analytics cache
php artisan cache:clear

# Rebuild frontend
cd /var/www/hybrid-stack/frontend && npm run build

# Deploy frontend
supervisorctl restart hybrid-stack-frontend

# Check service status
supervisorctl status hybrid-stack-frontend
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-05-30 | Initial implementation with visit tracking, analytics service, API endpoints, and seller dashboard |

---

**Last Updated:** May 30, 2026
**Maintained By:** Development Team
**Status:** Production Ready ✅
