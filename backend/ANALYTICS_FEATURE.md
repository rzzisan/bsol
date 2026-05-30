# Landing Page Analytics Feature

## Overview

The Landing Page Analytics feature provides comprehensive tracking and reporting of visitor activity on landing pages. It tracks:
- Total visits per landing page
- Unique visitors (by IP address)
- Geographic location of visitors (country, city)
- Traffic sources (referrers)
- Orders placed from landing pages
- Conversion tracking

## Database Schema

### `landing_page_visits`
Stores individual visit records with detailed metadata:
- `id` - Unique visit identifier
- `landing_page_id` - FK to landing_pages table
- `ip_address` - Visitor's IP address
- `country`, `city` - Geographic location from IP lookup
- `latitude`, `longitude` - Precise location coordinates
- `referrer` - HTTP referer URL
- `user_agent` - Browser/device information
- `session_id` - Unique session identifier
- `user_id` - FK to users table (if visitor is logged in)
- `created_at`, `updated_at` - Timestamps

**Indexes**: landing_page_id, ip_address, created_at, country

### `landing_page_statistics`
Daily aggregated statistics for caching/performance:
- `id` - Record identifier
- `landing_page_id` - FK to landing_pages table
- `date` - Date of statistics (YYYY-MM-DD)
- `total_visits` - Total visits on that day
- `unique_visitors` - Count of unique IPs
- `orders_placed` - Orders converted from visits
- `created_at`, `updated_at` - Timestamps

**Unique constraint**: (landing_page_id, date)
**Indexes**: landing_page_id, date

### `landing_page_visit_orders`
Junction table linking visits to orders:
- `id` - Record identifier
- `landing_page_visit_id` - FK to landing_page_visits
- `order_id` - FK to orders table
- `created_at`, `updated_at` - Timestamps

**Unique constraint**: (landing_page_visit_id, order_id)

## Services

### IpLocationService
Provides IP-to-location lookup with caching.

**Configuration** (in `config/services.php`):
```php
'ip_location' => [
    'provider' => env('IP_LOCATION_PROVIDER', 'ipapi'),
    'ipstack_key' => env('IPSTACK_API_KEY'),
]
```

**Environment Variables**:
- `IP_LOCATION_PROVIDER` - API provider to use (default: `ipapi`)
  - `ipapi` - Free ip-api.com service (no API key required)
  - `ipstack` - IPStack service (requires `IPSTACK_API_KEY`)
  - `maxmind` - MaxMind GeoIP2 (not yet implemented)
- `IPSTACK_API_KEY` - API key for IPStack (optional)

**Methods**:
```php
// Get single IP location
$location = $ipLocationService->getLocation('203.0.113.42');
// Returns:
// [
//     'country' => 'Bangladesh',
//     'city' => 'Dhaka',
//     'latitude' => 23.8103,
//     'longitude' => 90.4125,
//     'isp' => 'ISP Name'
// ]

// Get multiple IP locations
$locations = $ipLocationService->getLocations(['203.0.113.42', '198.51.100.42']);
```

### LandingPageAnalyticsService
Main service for recording visits and generating analytics reports.

**Methods**:

```php
// Record a visit
$visit = $analyticsService->recordVisit(
    $landingPageId,
    $ipAddress,
    $referrer,       // Optional
    $userAgent,      // Optional
    $userId          // Optional (if user is logged in)
);

// Get statistics for date range
$stats = $analyticsService->getStatistics(
    $landingPageId,
    '2024-01-01',    // start_date (optional)
    '2024-12-31'     // end_date (optional)
);
// Returns:
// [
//     'total_visits' => 1234,
//     'total_unique_visitors' => 456,
//     'total_orders' => 12,
//     'daily_stats' => [...]
// ]

// Get visitor details (with pagination)
$visitors = $analyticsService->getVisitorDetails(
    $landingPageId,
    '2024-01-01',    // start_date (optional)
    '2024-12-31',    // end_date (optional)
    100,             // limit (default: 100)
    0                // offset (default: 0)
);

// Get stats by country
$countries = $analyticsService->getStatisticsByCountry($landingPageId);

// Get stats by referrer
$referrers = $analyticsService->getStatisticsByReferrer($landingPageId);

// Link a visit to an order (for conversion tracking)
$analyticsService->linkVisitToOrder($visitId, $orderId);
```

## API Endpoints

All endpoints require authentication (`auth:sanctum`).

### Get Statistics
```
GET /api/landing/analytics/{landingPageId}/statistics
Query Parameters:
  - start_date: YYYY-MM-DD (optional)
  - end_date: YYYY-MM-DD (optional)

Response:
{
  "total_visits": 1234,
  "total_unique_visitors": 456,
  "total_orders": 12,
  "daily_stats": [
    {
      "date": "2024-01-01",
      "visits": 45,
      "unique_visitors": 23,
      "orders": 1
    }
  ]
}
```

### Get Visitors
```
GET /api/landing/analytics/{landingPageId}/visitors
Query Parameters:
  - start_date: YYYY-MM-DD (optional)
  - end_date: YYYY-MM-DD (optional)
  - limit: 1-500 (default: 100)
  - offset: 0+ (default: 0)

Response:
{
  "total": 5000,
  "limit": 100,
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
      "visited_at": "2024-01-15T10:30:00Z",
      "orders_count": 1
    }
  ]
}
```

### Get Statistics by Country
```
GET /api/landing/analytics/{landingPageId}/by-country
Query Parameters:
  - start_date: YYYY-MM-DD (optional)
  - end_date: YYYY-MM-DD (optional)

Response:
[
  {
    "country": "Bangladesh",
    "visits": 450,
    "unique_visitors": 200
  },
  {
    "country": "India",
    "visits": 300,
    "unique_visitors": 150
  }
]
```

### Get Statistics by Referrer
```
GET /api/landing/analytics/{landingPageId}/by-referrer
Query Parameters:
  - start_date: YYYY-MM-DD (optional)
  - end_date: YYYY-MM-DD (optional)

Response:
[
  {
    "referrer": "https://google.com",
    "visits": 450,
    "unique_visitors": 200
  },
  {
    "referrer": "https://facebook.com",
    "visits": 300,
    "unique_visitors": 150
  }
]
```

### Link Visit to Order
```
POST /api/landing/analytics/{landingPageId}/link-visit-to-order
Request Body:
{
  "visit_id": 123,
  "order_id": 456
}

Response:
{
  "success": true
}
```

## Frontend Components

### LandingPageAnalyticsDashboard
React component at `/src/app/admin/landing-page-analytics/[landingPageId]/page.tsx`

**Features**:
- Summary cards (total visits, unique visitors, orders)
- Daily statistics table
- Country-wise visitor breakdown
- Traffic source (referrer) analysis
- Recent visitors list with pagination
- Date range filtering
- Real-time data loading

**Usage**:
Navigate to `/admin/landing-page-analytics/{landingPageId}` to view analytics for a specific landing page.

## Middleware

### TrackLandingPageVisit
Middleware that automatically records visits when a landing page is accessed.

**Configuration**: Added to routes in `routes/api.php`:
```php
Route::get('/public/landing-pages/{slug}', [LandingPageController::class, 'publicShow'])
    ->middleware('track_landing_page_visit');
Route::post('/public/landing-pages/{slug}/order', [LandingPageController::class, 'publicSubmitOrder'])
    ->middleware('track_landing_page_visit');
```

**Captured Data**:
- IP address (with proxy header detection)
- Referrer URL
- User agent
- Session ID
- Authenticated user ID (if logged in)
- IP geolocation (country, city, latitude, longitude)

## Setup Instructions

### Backend Setup

1. **Run Migrations**:
```bash
php artisan migrate --force
```

2. **Configure Environment** (in `.env`):
```bash
# Optional: Choose IP location provider
IP_LOCATION_PROVIDER=ipapi

# For IPStack provider (optional):
# IPSTACK_API_KEY=your_api_key_here
```

3. **Service Provider** (auto-registered):
Services are auto-resolved via dependency injection in controllers/services.

### Frontend Setup

1. **Create Navigation Link** (in admin dashboard):
```tsx
<Link href={`/admin/landing-page-analytics/${landingPageId}`}>
  View Analytics
</Link>
```

2. **Access Dashboard**:
Navigate to the analytics page for any landing page to view complete visitor metrics.

## Caching Strategy

- **IP Location Caching**: Locations are cached for 30 days to reduce API calls
- **Daily Statistics**: Automatically aggregated and cached in `landing_page_statistics` table
- **Query Optimization**: Indexed columns for fast filtering by date, country, landing page

## Performance Considerations

1. **Large Visitor Datasets**: Use date range filtering to reduce query load
2. **IP Location API Limits**: ip-api.com has rate limits; consider upgrading to IPStack for production
3. **Database Indexes**: Ensure indexes are created (migrations handle this automatically)
4. **Archive Old Data**: Consider archiving visit records older than 90 days to manage table size

## Troubleshooting

### IP Location Shows "Local" or Missing
- Check if IP is localhost (127.0.0.1) - this is by design
- Verify IP location API is working: Test with curl
- Check rate limiting on IP location service

### No Visits Being Recorded
- Verify middleware is attached to landing page routes
- Check database connection and table creation
- Review Laravel logs: `storage/logs/laravel.log`

### Authorization Errors
- Ensure user has `view` permission on landing page
- Check authentication token is valid

## Future Enhancements

- [ ] Bot/crawler filtering
- [ ] Custom conversion funnels
- [ ] Email reports
- [ ] Heatmap integration
- [ ] A/B testing support
- [ ] Goals and KPI tracking
- [ ] Real-time visitor notifications
