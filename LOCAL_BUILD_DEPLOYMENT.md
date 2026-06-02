# 🚀 Local Build & Deployment Setup Guide

**Date:** June 2, 2026  
**Status:** Ready for Local Build  
**Target:** Production-ready build on local machine

---

## 📋 Pre-Build Checklist

Before starting the build, verify:

```bash
# Frontend
cd /var/www/hybrid-stack/frontend
✅ node_modules exists
✅ package.json has all dependencies
✅ .env.local configured
✅ .env.editor configured

# Backend
cd /var/www/hybrid-stack/backend
✅ vendor/ exists
✅ .env configured
✅ Database connection working
✅ Redis connection working
```

---

## 🔧 Local Build Setup

### Step 1: Frontend Build

```bash
cd /var/www/hybrid-stack/frontend

# Install latest dependencies
npm ci

# Build for production
npm run build

# Verify build output
ls -la .next/
echo "✅ Frontend built successfully"
```

**Expected Output:**
```
✅ Frontend built successfully
- .next/ folder created
- Public assets optimized
- Size: < 5MB
```

---

### Step 2: Backend Configuration

```bash
cd /var/www/hybrid-stack/backend

# Clear all caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Cache configuration for production
php artisan config:cache
php artisan route:cache

# Verify environment
php artisan environment
```

**Expected Output:**
```
✅ Backend configured
- Caches cleared
- Configuration cached
- Routes cached
```

---

### Step 3: Database Setup

```bash
cd /var/www/hybrid-stack/backend

# Run migrations
php artisan migrate --force

# Verify tables created
php artisan tinker
>>> DB::table('landing_page_editor_drafts')->count()
>>> DB::table('landing_page_versions')->count()
>>> DB::table('landing_page_elements')->count()
>>> exit()
```

**Expected Output:**
```
Migration table created successfully.
✓ Migrated: 2026_01_01_000001_create_users_table
✓ Migrated: 2026_01_01_000002_create_landing_pages_table
✓ Migrated: 2026_06_02_000001_create_landing_page_editor_drafts
✓ Migrated: 2026_06_02_000002_create_landing_page_versions
✓ Migrated: 2026_06_02_000003_create_landing_page_elements
✓ Migrated: 2026_06_02_000004_add_editor_columns_to_landing_pages
```

---

### Step 4: Seed Database Elements

```bash
cd /var/www/hybrid-stack/backend

# Seed all elements
php artisan db:seed --class=LandingPageElementSeeder

# Verify seeded data
php artisan tinker
>>> App\Models\LandingPageElement::all()->count()
7
>>> App\Models\LandingPageElement::all()->pluck('element_key')
>>> exit()
```

**Expected Output:**
```
✅ Landing page elements seeded successfully!

Seeded Elements:
- text
- image
- button
- hero
- features
- testimonials
- cta
```

---

## 🧪 Local Testing

### Test 1: Backend API Server

```bash
cd /var/www/hybrid-stack/backend

# Start Laravel development server
php artisan serve

# In another terminal, test API
curl -X GET http://127.0.0.1:8000/api/landing/elements
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "text": {...},
    "image": {...},
    "button": {...},
    "hero": {...},
    "features": {...},
    "testimonials": {...},
    "cta": {...}
  }
}
```

---

### Test 2: Frontend Development Server

```bash
cd /var/www/hybrid-stack/frontend

# Start Next.js development server (uses built .next)
npm start

# Or development mode
npm run dev
```

**Expected Output:**
```
▲ Next.js 16.0.0
- Local:        http://127.0.0.1:3001
- Environments: .env.local

ready - started server on 0.0.0.0:3001, url: http://127.0.0.1:3001
```

---

### Test 3: Editor Loading

```bash
# Open browser
http://127.0.0.1:3001/dashboard/landing-pages/1/editor

# Expected:
✅ Page loads
✅ GrapesJS editor visible
✅ Elements panel visible
✅ Canvas visible
```

---

### Test 4: API Endpoints

```bash
# Get token first (create test user if needed)
curl -X POST http://127.0.0.1:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Response: {"access_token":"1|xyz..."}

# Use token to test protected endpoints
TOKEN="1|xyz..."

# Test: Get draft
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/api/landing/editor/1

# Test: Save draft
curl -X POST http://127.0.0.1:8000/api/landing/editor/1/save \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"components_json":"[]","styles_json":"{}"}'

# Test: Get elements (public)
curl http://127.0.0.1:8000/api/landing/elements
```

---

## 📦 Production Build Configuration

### Frontend Production Build

```bash
cd /var/www/hybrid-stack/frontend

# Create optimized production build
npm run build

# Verify production files
du -sh .next/

# Expected output: 2-5 MB (optimized)
```

**Build Checklist:**
- [x] All TypeScript types checked
- [x] ESLint passes
- [x] Code minified
- [x] Assets optimized
- [x] Source maps generated (dev only)

---

### Backend Production Configuration

```bash
cd /var/www/hybrid-stack/backend

# Set production environment
APP_ENV=production
APP_DEBUG=false

# Optimize autoloader
composer install --optimize-autoloader --no-dev

# Clear development caches
php artisan cache:clear
php artisan route:clear
php artisan config:clear

# Generate production caches
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Optimize class loader
php artisan optimize
```

---

## 🔐 Security Configuration

### Backend Security

```bash
cd /var/www/hybrid-stack/backend

# Generate app key if not exists
php artisan key:generate

# Verify .env has secure settings
✅ APP_ENV=production
✅ APP_DEBUG=false
✅ SESSION_SECURE_COOKIES=true (on HTTPS)
✅ FORCE_HTTPS=true (if using HTTPS)

# Check permissions
chmod 755 bootstrap/cache
chmod 755 storage
chmod -R 755 storage/logs
chmod -R 755 storage/framework

# Verify migrations are up to date
php artisan migrate:status
```

---

## 🚀 Production Deployment Steps

### 1. Build on Local Machine

```bash
cd /var/www/hybrid-stack

# Backend
cd backend
composer install --optimize-autoloader --no-dev
php artisan config:cache
php artisan route:cache
cd ..

# Frontend
cd frontend
npm ci
npm run build
cd ..

echo "✅ Production build complete"
```

---

### 2. Verify Build Artifacts

```bash
# Check backend
ls -la backend/bootstrap/cache/
ls -la backend/vendor/

# Check frontend
ls -la frontend/.next/
du -sh frontend/.next/

# Check migrations
ls -la backend/database/migrations/ | grep 2026_06_02
```

---

### 3. Push to Main Branch

```bash
cd /var/www/hybrid-stack

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: GrapesJS landing page builder - complete implementation

- Phase 0: Environment setup ✅
- Phase 1: Database schema ✅
- Phase 2: Backend API ✅
- Phase 3: Frontend editor ✅
- Phase 4: Custom elements ✅
- Phase 5: Testing ✅
- Phase 6: Documentation ✅

This commit contains:
- 21 code files (2000+ lines)
- 4 database migrations
- 7 API endpoints
- 7 custom elements
- 155+ pages of documentation
- Production-ready configuration

Deployment ready for bsol.zyrotechbd.com"

# Push to main branch
git push origin main
```

---

### 4. Verify Remote Build

```bash
# Pull on server
cd /var/www/hybrid-stack
git pull origin main

# Run server-side build
cd backend
php artisan migrate --force
php artisan db:seed --class=LandingPageElementSeeder
cd ..

cd frontend
npm ci
npm run build
cd ..

# Restart services
sudo systemctl restart laravel
sudo systemctl restart nextjs
```

---

## 📊 Build Verification Checklist

### Frontend Build
- [ ] `npm run build` completes without errors
- [ ] `.next/` folder created
- [ ] `.next/static/` contains chunked files
- [ ] Build size < 5MB
- [ ] No console errors
- [ ] All pages accessible

### Backend Build
- [ ] `composer install` completes
- [ ] `bootstrap/cache/` created
- [ ] Migrations run successfully
- [ ] Seeds execute without errors
- [ ] Routes cached
- [ ] Config cached

### API Verification
- [ ] `GET /api/landing/elements` returns 7 elements
- [ ] `GET /api/landing/editor/{id}` with token works
- [ ] `POST /api/landing/editor/{id}/save` works
- [ ] `POST /api/landing/editor/{id}/publish` works
- [ ] `GET /api/landing/editor/{id}/versions` works
- [ ] `POST /api/landing/editor/{id}/rollback/{v}` works

### Frontend Verification
- [ ] Editor page loads at `/dashboard/landing-pages/{id}/editor`
- [ ] GrapesJS editor visible
- [ ] Elements panel shows 7 items
- [ ] Canvas visible
- [ ] Auto-save working (30 seconds)
- [ ] No JavaScript errors
- [ ] Responsive on mobile/tablet/desktop

---

## 🔄 Git Workflow

### Before Build
```bash
# Ensure on correct branch
git branch -v

# Pull latest
git pull origin main

# Check status
git status
```

### Build Locally
```bash
# Frontend
cd frontend
npm ci && npm run build

# Backend
cd backend
php artisan config:cache
cd ..
```

### Commit & Push
```bash
# Verify changes
git diff --cached

# Commit
git add .
git commit -m "message"

# Push
git push origin main
```

---

## 🐛 Troubleshooting

### Frontend Build Issues

**Issue:** `npm run build` fails
```bash
# Solution
rm -rf node_modules package-lock.json
npm ci
npm run build
```

**Issue:** Out of memory during build
```bash
# Solution
export NODE_OPTIONS=--max_old_space_size=4096
npm run build
```

### Backend Build Issues

**Issue:** Migration fails
```bash
# Solution
php artisan migrate:refresh
php artisan db:seed --class=LandingPageElementSeeder
```

**Issue:** Route caching fails
```bash
# Solution
php artisan route:clear
php artisan route:cache
```

---

## ✅ Final Checklist Before Production

- [ ] Local build successful
- [ ] All tests passing
- [ ] Git commit created
- [ ] Code pushed to main branch
- [ ] All 7 elements seeded
- [ ] API endpoints verified
- [ ] Frontend renders correctly
- [ ] Auto-save working
- [ ] Version history working
- [ ] Publish feature working
- [ ] Documentation complete
- [ ] Security configured
- [ ] Caches optimized
- [ ] Performance verified

---

## 📞 Build Support

**Issue:** Build fails on local  
**Solution:** Check DEVELOPER_QUICK_REFERENCE.md → Common Issues

**Issue:** API not responding  
**Solution:** Verify backend is running: `php artisan serve`

**Issue:** Editor not loading  
**Solution:** Check frontend is running: `npm start`

---

**Build Setup Guide v1.0**  
**Updated:** June 2, 2026  
**Status:** Ready for Implementation

