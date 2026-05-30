# Dokploy Deployment - Database Migration Troubleshooting

## Problem
After deploying to dokploy, the analytics API returns **Error: API error: 500** with database errors:
```
ERROR:  relation "landing_page_visits" does not exist
ERROR:  relation "landing_page_statistics" does not exist
```

## Root Cause
The code was deployed to dokploy, but the **database migrations were NOT executed**. The 3 new tables required by the analytics feature were never created.

## Solution

### Step 1: SSH into Dokploy
Connect to your dokploy server:
```bash
ssh your-dokploy-user@your-dokploy-ip
```

### Step 2: Navigate to Backend Directory
```bash
cd /path/to/backend
# Usually something like:
# cd /app/backend
# or
# cd /var/www/hybrid-stack/backend
```

### Step 3: Run Migrations
Execute the migration script (created in this update):
```bash
bash run-migrations.sh
```

Or run migrations directly:
```bash
php artisan migrate --force
```

### Step 4: Verify Tables Were Created
Connect to your PostgreSQL database and verify:
```bash
# Option 1: Via psql
psql -U your_db_user -d your_database -c "\dt landing_page*"

# You should see:
# landing_page_visits
# landing_page_statistics
# landing_page_visit_orders
```

Or via Laravel Tinker:
```bash
php artisan tinker
>>> \DB::select('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE "%landing_page%"')
```

### Step 5: Restart Services
After migrations complete:
```bash
# Restart PHP-FPM
supervisorctl restart bsol_php_fpm

# Restart Laravel
supervisorctl restart bsol_laravel

# Or restart all
supervisorctl restart all
```

### Step 6: Test the API
Test the analytics endpoint:
```bash
curl -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  https://your-domain.com/api/landing/analytics/5/statistics
```

Should return (not 500 error):
```json
{
  "total_visits": 0,
  "total_unique_visitors": 0,
  "total_orders": 0,
  "daily_stats": []
}
```

---

## Advanced Debugging

### Check If Migrations Table Exists
```bash
php artisan tinker
>>> \DB::select('SELECT * FROM migrations ORDER BY batch DESC LIMIT 5')
```

Look for entries with name containing `landing_page_`.

### View Migration Status
```bash
php artisan migrate:status
```

Should show:
```
Migration Name                                          Batch Ran?
2026_05_30_000001_create_landing_page_visits_table     Yes
2026_05_30_000002_create_landing_page_statistics_table Yes
2026_05_30_000003_create_landing_page_visit_orders_table Yes
```

### Check Database Connection
Verify Laravel can connect to database:
```bash
php artisan tinker
>>> \DB::connection()->getPdo()
# Should not throw error
```

### View Actual Error Details
Check Laravel logs for detailed errors:
```bash
tail -100 storage/logs/laravel.log | grep -i "migration\|error\|landing_page"
```

### Rollback and Re-run (If Needed)
If migrations somehow got partially executed:
```bash
php artisan migrate:rollback --step=3  # Rollback last 3 migrations
php artisan migrate --force              # Re-run all
```

---

## Prevention for Future Deployments

### Option 1: Add to Dokploy Deployment Script
If your dokploy has a post-deployment hook, add:
```bash
cd backend && php artisan migrate --force
```

### Option 2: Use Dockerfile
Create `/backend/Dockerfile` with:
```dockerfile
FROM php:8.3-fpm

WORKDIR /app

# ... other setup ...

# Run migrations after code deployment
RUN php artisan migrate --force

CMD ["php-fpm"]
```

### Option 3: Create Dokploy Service Hook
In dokploy dashboard, add a post-deployment command:
```
cd /app/backend && php artisan migrate --force && supervisorctl restart all
```

---

## Verify Full System

After completing steps 1-6, test the complete flow:

### 1. Check Frontend Can Load Analytics Page
```
https://your-domain.com/dashboard/landing-page-analytics/5
```
Should show analytics dashboard (not error)

### 2. Check API Returns Data
```bash
curl -H "Authorization: Bearer $TOKEN" \
  'https://your-domain.com/api/landing/analytics/5/statistics'
```
Should return JSON (not 500)

### 3. Check Visitor Tracking Works
- Visit a landing page at `/lp/{slug}`
- Wait 5 seconds
- Refresh analytics dashboard
- Should show 1 new visit

### 4. Check Conversion Tracking
- Place an order from a landing page
- Go to analytics dashboard
- Should show the order linked to that visit

---

## Common Issues

### Issue: "FATAL: password authentication failed for user"
**Problem:** Database credentials are wrong in .env
**Solution:** 
```bash
# Check .env
cat .env | grep DB_

# Update if needed
nano .env
# Set correct: DB_HOST, DB_USERNAME, DB_PASSWORD, DB_DATABASE

# Test connection
php artisan tinker
>>> \DB::connection()->getPdo()
```

### Issue: "Doctrine\DBAL\Exception\TableNotFoundException"
**Problem:** Tables don't exist (same as original issue)
**Solution:** Run migrations as described in Step 3

### Issue: "No such file or directory"
**Problem:** Wrong directory or wrong path
**Solution:**
```bash
# Find the correct path
find / -name "artisan" -type f 2>/dev/null | head -5

# Navigate there
cd /path/to/backend
```

### Issue: "Access denied for user"
**Problem:** PHP-FPM running as different user than migrations
**Solution:**
```bash
# Run migrations as correct user
sudo -u www-data php artisan migrate --force

# Or check current user
whoami
```

---

## After Migrations - What Should Happen

1. **Tables Created:**
   - `landing_page_visits` (stores individual visits)
   - `landing_page_statistics` (daily aggregates)
   - `landing_page_visit_orders` (conversion links)

2. **Middleware Active:**
   - Automatic visit tracking on `/lp/{slug}` routes

3. **API Endpoints Working:**
   - `/api/landing/analytics/{id}/statistics`
   - `/api/landing/analytics/{id}/visitors`
   - `/api/landing/analytics/{id}/by-country`
   - `/api/landing/analytics/{id}/by-referrer`
   - `/api/landing/analytics/{id}/link-visit-to-order`

4. **Frontend Working:**
   - Analytics dashboard loads
   - Charts show data
   - Pagination works
   - Date filters work

---

## Support & Documentation

If you need more help:
1. Check `/landing_page_statistic.md` for complete implementation details
2. Check `/.github/skills/landing-page-statistics/SKILL.md` for skill documentation
3. Check `/backend/ANALYTICS_FEATURE.md` for backend feature doc
4. Check `/backend/ANALYTICS_TESTING.md` for testing guide

---

**Last Updated:** May 30, 2026
**Status:** Production Ready ✅
