# GrapesJS Landing Page Builder - Deployment Guide

**Status:** ✅ PRODUCTION READY  
**Date:** June 2, 2026  
**Domain:** `bsol.zyrotechbd.com`

---

## 📋 Pre-Deployment Checklist

### Backend Checklist
- [x] All 4 migrations executed
- [x] Database tables created
- [x] 7 elements seeded
- [x] All API endpoints registered
- [x] Authentication configured (Sanctum)
- [x] Authorization policies set
- [x] Error handling implemented
- [x] Redis cache configured
- [x] Environment variables set

### Frontend Checklist
- [x] GrapesJS dependencies installed
- [x] Editor component built
- [x] Custom elements registered
- [x] Utility functions created
- [x] Page route configured
- [x] Authentication integrated
- [x] Environment files created
- [x] TypeScript types defined

### Database Checklist
- [x] PostgreSQL running
- [x] All tables created with indexes
- [x] Unique constraints set
- [x] Foreign keys configured
- [x] Triggers tested (if any)

### Infrastructure Checklist
- [x] Redis running
- [x] Nginx configured
- [x] SSL certificates active
- [x] Domain DNS configured
- [x] Reverse proxy working

---

## 🚀 Deployment Steps

### Step 1: Backend Deployment

```bash
cd /var/www/hybrid-stack/backend

# Pull latest code
git pull origin main

# Install dependencies
composer install --no-dev

# Run migrations
php artisan migrate --force

# Seed custom elements (only once)
php artisan db:seed --class=LandingPageElementSeeder

# Clear caches
php artisan cache:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Optimize autoloader
composer dump-autoload --optimize

# Restart Laravel service
sudo systemctl restart laravel
```

### Step 2: Frontend Deployment

```bash
cd /var/www/hybrid-stack/frontend

# Pull latest code
git pull origin main

# Install dependencies
npm ci --omit=dev

# Build application
npm run build

# Restart Next.js service
sudo systemctl restart nextjs
```

### Step 3: Verify Deployment

```bash
# Check backend health
curl https://bsol.zyrotechbd.com/api/health

# Check frontend load
curl https://bsol.zyrotechbd.com/

# Test editor endpoint
curl -H "Authorization: Bearer {TOKEN}" \
  https://bsol.zyrotechbd.com/api/landing/elements
```

---

## 🔧 Environment Configuration

### Backend (.env) - Production Settings

```env
# Application
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:HFk8uVk8lvo8UbUEUft1dfwlLF/Lk32CEgK3vbHtfYo=
APP_URL=https://bsol.zyrotechbd.com

# Database
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=hybrid_platform
DB_USERNAME=hybrid_app
DB_PASSWORD=HybridDbPass2026

# Cache & Queue
CACHE_STORE=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Landing Page Editor
REDIS_EDITOR_CACHE_TTL=86400
LANDING_EDITOR_AUTOSAVE_ENABLED=true
LANDING_EDITOR_VERSION_HISTORY_LIMIT=10

# Security
SANCTUM_STATEFUL_DOMAINS=bsol.zyrotechbd.com
SANCTUM_GUARD=web
```

### Frontend (.env.editor) - Production Settings

```env
NEXT_PUBLIC_API_BASE_URL=https://bsol.zyrotechbd.com
NEXT_PUBLIC_EDITOR_MAX_JSON_SIZE=5242880
NEXT_PUBLIC_EDITOR_AUTOSAVE_INTERVAL=30000
NEXT_PUBLIC_EDITOR_MAX_UNDO_STEPS=50
NEXT_PUBLIC_EDITOR_VERSION_HISTORY_LIMIT=10
```

---

## 📊 Performance Optimization

### Backend Optimization

1. **Database Indexes**
   ```sql
   -- Verify indexes exist
   SELECT * FROM pg_indexes 
   WHERE tablename IN ('landing_page_editor_drafts', 'landing_page_versions', 'landing_page_elements');
   ```

2. **Query Optimization**
   - All queries use indexes
   - N+1 queries prevented with relationships
   - Pagination implemented for list endpoints

3. **Caching Strategy**
   - Draft caching: 24 hours in Redis
   - Element registry: Cached in memory
   - Query caching: Enabled for listings

4. **Rate Limiting**
   ```php
   // Applied via Laravel middleware
   'throttle' => '60,1'  // 60 requests per minute
   ```

### Frontend Optimization

1. **Code Splitting**
   - GrapesJS loaded on demand
   - Components lazy-loaded

2. **Asset Optimization**
   - CSS minified
   - JavaScript minified
   - Images optimized

3. **Caching Headers**
   ```
   Cache-Control: max-age=3600
   ETag: {hash}
   ```

---

## 🔒 Security Best Practices

### API Security

1. **Authentication**
   - All protected endpoints require Sanctum token
   - Token validation on every request
   - Token expiration: 24 hours

2. **Authorization**
   - User can only access their own pages
   - Page policies enforced in controllers
   - Admin override capability

3. **Input Validation**
   ```php
   $validated = $request->validate([
       'components_json' => 'nullable|string|max:5242880',
       'styles_json' => 'nullable|string',
       'html_output' => 'nullable|string',
       'css_output' => 'nullable|string',
       'metadata' => 'nullable|array',
   ]);
   ```

4. **CORS Configuration**
   ```php
   // Configured in config/cors.php
   'allowed_origins' => ['bsol.zyrotechbd.com'],
   'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE'],
   ```

### Database Security

1. **Password Hashing**
   - User passwords: bcrypt (rounds: 12)
   - API tokens: Sanctum tokens

2. **Data Encryption**
   - Sensitive data: Encrypted at rest
   - HTTPS: Required for all connections
   - SSL/TLS: Modern protocols only

3. **Access Control**
   - Database user: Limited permissions
   - Only required tables accessible
   - No root credentials in code

---

## 📈 Monitoring & Logging

### Application Logs

```bash
# Backend logs
tail -f /var/www/hybrid-stack/backend/storage/logs/laravel.log

# Frontend logs (PM2)
pm2 logs nextjs

# Redis logs
redis-cli monitor
```

### Performance Metrics

```bash
# Database query time
php artisan db:monitor

# Cache hits/misses
redis-cli info stats

# API response times
# Log via middleware
```

### Error Tracking

- **Local Development:** Sentry (optional)
- **Production:** Error tracking integrated in logs
- **Alert:** Critical errors logged and monitored

---

## 🔄 Rollback Procedure

### If Deployment Fails

```bash
# Backend Rollback
cd /var/www/hybrid-stack/backend
git revert HEAD
php artisan migrate:rollback
composer install

# Frontend Rollback
cd /var/www/hybrid-stack/frontend
git revert HEAD
npm install
npm run build
npm start

# Restart Services
sudo systemctl restart laravel nextjs
```

---

## 📞 Support & Troubleshooting

### Common Deployment Issues

**Issue: Database migrations fail**
```bash
# Solution:
php artisan migrate:status  # Check status
php artisan migrate:refresh  # Reset and re-run
```

**Issue: API endpoints 404**
```bash
# Solution:
php artisan route:clear
php artisan route:cache
```

**Issue: Frontend not loading**
```bash
# Solution:
npm run build  # Rebuild
npm start  # Restart
# Check for JavaScript errors in console
```

**Issue: Auto-save not working**
```bash
# Solution:
redis-cli ping  # Verify Redis running
php artisan config:clear
# Check network tab in browser DevTools
```

---

## 🎯 Post-Deployment Verification

### API Endpoints Verification

```bash
# Test all endpoints
scripts/test-api.sh
```

Script content:
```bash
#!/bin/bash
TOKEN="your_test_token"
API="https://bsol.zyrotechbd.com/api"

# Get elements
curl "$API/landing/elements"

# Test auth endpoints
curl -H "Authorization: Bearer $TOKEN" "$API/landing/editor/1"

# Test save endpoint
curl -X POST "$API/landing/editor/1/save" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"components_json":"[]"}'
```

### Frontend Verification

```bash
# Open editor in browser
# https://bsol.zyrotechbd.com/dashboard/landing-pages/1/editor

# Check:
# 1. Editor loads without errors
# 2. All elements in block manager
# 3. Auto-save works (check network tab)
# 4. Publish button functional
# 5. Undo/Redo works
```

---

## 📅 Maintenance Schedule

### Daily
- Monitor error logs
- Check system health
- Verify backup status

### Weekly
- Review API performance metrics
- Audit user activity
- Update security patches

### Monthly
- Database optimization
- Cache cleanup
- Version history cleanup

```bash
# Monthly cleanup script
php artisan landing:cleanup-versions --older-than=30
php artisan cache:prune
```

---

## 🔐 Backup & Recovery

### Backup Strategy

```bash
# Database backup
pg_dump -U hybrid_app hybrid_platform > backup_$(date +%Y%m%d).sql

# Application backup
tar -czf app_backup_$(date +%Y%m%d).tar.gz /var/www/hybrid-stack

# Schedule with cron (daily at 2 AM)
0 2 * * * /usr/local/bin/backup-app.sh
```

### Recovery Procedure

```bash
# Restore database
psql -U hybrid_app hybrid_platform < backup_20260602.sql

# Restore application
tar -xzf app_backup_20260602.tar.gz -C /var/www

# Restart services
sudo systemctl restart laravel nextjs
```

---

## ✅ Final Checklist

- [x] All code pushed to repository
- [x] All tests passing
- [x] Documentation complete
- [x] Environment variables configured
- [x] SSL certificates valid
- [x] Database backed up
- [x] Team trained on usage
- [x] Support channels established

---

**Status:** ✅ READY FOR PRODUCTION DEPLOYMENT

**Last Updated:** June 2, 2026  
**Next Review:** June 9, 2026

