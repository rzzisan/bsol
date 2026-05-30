# Landing Page Analytics - Testing Guide

## ✅ Deployment Verification Checklist

### Database Migration Verification
```bash
# Check that tables were created
cd /var/www/hybrid-stack/backend
php artisan migrate:status
```

**Expected Output:**
```
  2026_05_30_000001_create_landing_page_visits_table ................... Ran
  2026_05_30_000002_create_landing_page_statistics_table ............... Ran
  2026_05_30_000003_create_landing_page_visit_orders_table ............. Ran
```

### Table Structure Verification
```bash
# In MySQL/Laravel Tinker
php artisan tinker

# Check table structures
Schema::getColumns('landing_page_visits');
Schema::getColumns('landing_page_statistics');
Schema::getColumns('landing_page_visit_orders');
```

### Service Registration
```php
// In Laravel Tinker
$service = app(\App\Services\IpLocationService::class);
echo get_class($service); // Should output: App\Services\IpLocationService

$analyticsService = app(\App\Services\LandingPageAnalyticsService::class);
echo get_class($analyticsService); // Should output: App\Services\LandingPageAnalyticsService
```

## 🧪 Manual Testing

### Test 1: Visit Recording

**Scenario**: Access a public landing page and verify visit is recorded

```bash
# Simulate a landing page view
curl -H "User-Agent: Mozilla/5.0" \
     -H "Referer: https://google.com" \
     https://your-domain/api/public/landing-pages/test-page

# Check database for new visit
php artisan tinker
> DB::table('landing_page_visits')->latest()->first();
```

**Expected**: New row in `landing_page_visits` with:
- ip_address populated
- country and city from IP lookup
- referrer: "https://google.com"
- user_agent containing "Mozilla"
- session_id populated
- created_at is recent

### Test 2: Statistics API

**Prerequisites**:
- Have a landing page with at least one visit
- Get valid authentication token

```bash
# Get statistics for landing page (ID: 1)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain/api/landing/analytics/1/statistics

# With date range
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain/api/landing/analytics/1/statistics?start_date=2024-01-01&end_date=2024-12-31"
```

**Expected Response**:
```json
{
  "total_visits": 1,
  "total_unique_visitors": 1,
  "total_orders": 0,
  "daily_stats": [
    {
      "date": "2024-05-30",
      "visits": 1,
      "unique_visitors": 1,
      "orders": 0
    }
  ]
}
```

### Test 3: Visitors API

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://your-domain/api/landing/analytics/1/visitors?limit=20&offset=0"
```

**Expected Response**:
```json
{
  "total": 1,
  "limit": 20,
  "offset": 0,
  "visitors": [
    {
      "id": 1,
      "ip_address": "203.0.113.42",
      "country": "Bangladesh",
      "city": "Dhaka",
      "latitude": 23.8103,
      "longitude": 90.4125,
      "referrer": "https://google.com",
      "visited_at": "2024-05-30T10:30:00Z",
      "orders_count": 0
    }
  ]
}
```

### Test 4: Country Stats

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain/api/landing/analytics/1/by-country
```

**Expected Response**:
```json
[
  {
    "country": "Bangladesh",
    "visits": 1,
    "unique_visitors": 1
  }
]
```

### Test 5: Referrer Stats

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain/api/landing/analytics/1/by-referrer
```

**Expected Response**:
```json
[
  {
    "referrer": "https://google.com",
    "visits": 1,
    "unique_visitors": 1
  }
]
```

### Test 6: Conversion Tracking

```bash
# First, get a visit ID
curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://your-domain/api/landing/analytics/1/visitors

# Link visit to order
curl -X POST \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"visit_id": 1, "order_id": 42}' \
     https://your-domain/api/landing/analytics/1/link-visit-to-order
```

**Expected Response**:
```json
{
  "success": true
}
```

**Verify**: Check that visitor now shows `orders_count: 1` and daily stats show `orders_placed: 1`

## 🎨 Frontend Testing

### Test 7: Analytics Dashboard Access

1. Navigate to: `https://your-domain/admin/landing-page-analytics/1`
2. Should see:
   - Summary cards with visitor metrics
   - Date filter inputs
   - Daily statistics table
   - Country breakdown
   - Traffic sources
   - Recent visitors list

### Test 8: Date Range Filtering

1. Open analytics dashboard
2. Enter start_date: `2024-05-01`
3. Enter end_date: `2024-05-31`
4. Observe metrics update to show only May data
5. Click "Reset" and verify all data appears again

### Test 9: Pagination

1. Create multiple test visits (20+)
2. In analytics dashboard recent visitors section
3. Verify "Next" button appears when total > 20
4. Click "Next" and verify new visitors appear
5. Click "Previous" and verify previous visitors reappear

### Test 10: Authorization

1. Log in as non-admin user
2. Try to access: `https://your-domain/admin/landing-page-analytics/1`
3. Should see either 403 Forbidden or redirected
4. Permission checks should work per landing page ownership

## 🔍 Performance Testing

### Test 11: Large Dataset Performance

```bash
# Create 1000 test visits
php artisan tinker
for ($i = 0; $i < 1000; $i++) {
  \App\Models\LandingPageVisit::create([
    'landing_page_id' => 1,
    'ip_address' => '192.168.' . rand(0, 255) . '.' . rand(0, 255),
    'country' => 'Test',
    'city' => 'TestCity',
    'referrer' => 'https://test.com',
    'user_agent' => 'Test Agent',
    'session_id' => uniqid(),
  ]);
}
exit
```

**Test**: Query analytics with large dataset
- Statistics API should respond < 200ms
- Visitors API with pagination should respond < 500ms

### Test 12: IP Location Caching

```php
$service = app(\App\Services\IpLocationService::class);

// First call - hits API
$location1 = $service->getLocation('203.0.113.42');
// Should take 500-2000ms (actual API call)

// Second call - hits cache
$location2 = $service->getLocation('203.0.113.42');
// Should be < 10ms (cache hit)

// Verify same result
assert($location1 === $location2);
```

## 🐛 Troubleshooting Tests

### Test 13: Missing IP Location

If `country` is null:
1. Verify IP location API is accessible: `curl http://ip-api.com/json/203.0.113.42`
2. Check rate limiting: Some free tiers have low limits
3. Verify Laravel can make outbound HTTP requests
4. Check logs: `storage/logs/laravel.log`

### Test 14: Middleware Not Recording Visits

If analytics show no new visits:
1. Verify middleware is attached to routes
2. Check: `routes/api.php` for `track_landing_page_visit`
3. Verify bootstrap/app.php has middleware alias
4. Check that you're accessing the correct public landing page URL
5. Look for errors in `storage/logs/laravel.log`

### Test 15: Authorization Failures

If getting 403 or can't access analytics:
1. Verify user is authenticated (valid token)
2. Check that user owns the landing page
3. Verify `LandingPageAnalyticsController` authorize checks
4. Check: `Gate::policy` for landing page policies

## 📊 Data Validation

### Test 16: Data Integrity

```php
// Verify foreign key relationships
$visit = \App\Models\LandingPageVisit::find(1);
$visit->landingPage(); // Should exist
$visit->user(); // May be null
$visit->orders(); // Collection

// Verify statistics accuracy
$stats = \App\Models\LandingPageStatistic::where('landing_page_id', 1)->first();
$visitCount = \App\Models\LandingPageVisit::where('landing_page_id', 1)
    ->whereDate('created_at', $stats->date)
    ->count();
assert($stats->total_visits === $visitCount);
```

### Test 17: Cache Management

```php
// Verify cache works
Cache::put('test_cache', 'value', 60);
echo Cache::get('test_cache'); // Should output: value

// Verify IP cache pattern
$cached = Cache::get('ip_location_203.0.113.42');
echo ($cached !== null) ? 'Cached' : 'Not cached';
```

## 🚀 Load Testing

### Test 18: Concurrent Requests

```bash
# Simulate 100 concurrent requests to landing page
ab -n 100 -c 10 https://your-domain/api/public/landing-pages/test-page

# Verify:
# - All requests return 200
# - 100 new visits recorded
# - Database doesn't show errors
```

## ✨ Edge Cases

### Test 19: Localhost Access

```bash
# From localhost (127.0.0.1)
curl http://localhost/api/public/landing-pages/test-page

# Verify: country = "Local", city = "Localhost"
```

### Test 20: Multiple Visits from Same IP

```bash
# Visit twice with same IP
curl https://your-domain/api/public/landing-pages/test-page
curl https://your-domain/api/public/landing-pages/test-page

# Verify: 2 visits recorded, but unique_visitors = 1
```

## 📋 QA Checklist

- [ ] All migrations executed successfully
- [ ] Tables created with proper indexes
- [ ] IP location service resolves IPs correctly
- [ ] Visit recording middleware works
- [ ] Analytics API endpoints return correct data
- [ ] Date filtering works properly
- [ ] Frontend dashboard loads analytics data
- [ ] Pagination works with 20+ visitors
- [ ] Authorization works correctly
- [ ] Performance acceptable with 1000+ records
- [ ] Cache works for IP locations
- [ ] Conversion tracking accurate
- [ ] Error handling works gracefully
- [ ] Documentation is accurate

## 🎯 Success Criteria

✅ Analytics feature is ready for production when:
- All 20 tests pass
- No errors in application logs
- Performance is acceptable (< 500ms for API calls)
- Authorization is working correctly
- Frontend dashboard displays data properly
- Migrations are persistent and backward compatible
