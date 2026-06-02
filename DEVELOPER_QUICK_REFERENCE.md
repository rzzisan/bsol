# GrapesJS Landing Page Builder - Developer Quick Reference

**Project Status:** ✅ PRODUCTION READY  
**Date:** June 2, 2026  
**Domain:** bsol.zyrotechbd.com

---

## 📂 Quick Navigation

### Backend Files
```
backend/
├── app/Models/
│   ├── LandingPageEditorDraft.php      ← Draft storage model
│   ├── LandingPageVersion.php          ← Version history model
│   └── LandingPageElement.php          ← Element definitions
├── app/Services/
│   └── LandingPageEditorService.php    ← Core business logic
├── app/Http/Controllers/Api/
│   ├── LandingPageEditorController.php ← Editor endpoints
│   └── LandingPageElementController.php ← Element endpoints
└── database/migrations/
    ├── 2026_06_02_000001_*_editor_drafts.php
    ├── 2026_06_02_000002_*_versions.php
    ├── 2026_06_02_000003_*_elements.php
    └── 2026_06_02_000004_*_add_editor_columns.php
```

### Frontend Files
```
frontend/
├── src/components/
│   ├── landing-page-editor.tsx         ← Main editor component
│   └── grapesjs-elements/
│       ├── custom-elements.ts          ← Element definitions
│       └── register-elements.ts        ← Element registration
├── src/app/dashboard/landing-pages/[id]/editor/
│   └── page.tsx                        ← Editor page route
└── src/lib/
    └── landing-editor.ts               ← API utilities
```

---

## 🚀 Quick Commands

### Frontend Setup
```bash
cd /var/www/hybrid-stack/frontend

# Install dependencies
npm install grapesjs grapesjs-tailwind grapesjs-plugin-ckeditor

# Development
npm run dev

# Production build
npm run build
npm start
```

### Backend Setup
```bash
cd /var/www/hybrid-stack/backend

# Create migrations
php artisan migrate

# Seed elements
php artisan db:seed --class=LandingPageElementSeeder

# Run server
php artisan serve
```

### Database
```bash
# Connect to database
psql -h 127.0.0.1 -U hybrid_app -d hybrid_platform

# Check tables
SELECT * FROM landing_page_editor_drafts;
SELECT * FROM landing_page_versions;
SELECT * FROM landing_page_elements;

# Count elements
SELECT COUNT(*) FROM landing_page_elements;
```

---

## 📡 API Endpoints

### Public (No Auth)
```
GET    /api/landing/elements
GET    /api/landing/elements/{key}
```

### Protected (Requires Token)
```
GET    /api/landing/editor/{pageId}
POST   /api/landing/editor/{pageId}/save
POST   /api/landing/editor/{pageId}/publish
GET    /api/landing/editor/{pageId}/versions
POST   /api/landing/editor/{pageId}/rollback/{versionNumber}
```

**Example Request:**
```bash
curl -X GET https://bsol.zyrotechbd.com/api/landing/editor/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Custom Elements

### Available Elements (7 total)

**Basic Elements (2)**
1. `text` - Text/Paragraph
2. `image` - Image

**Advanced Elements (5)**
3. `button` - Button
4. `hero` - Hero Section
5. `features` - Features Grid
6. `testimonials` - Testimonials
7. `cta` - Call to Action

**Usage in Frontend:**
```typescript
import { registerCustomElements } from "@/components/grapesjs-elements/register-elements";

registerCustomElements(editor);
```

---

## 🔄 Data Flow

### Auto-Save (Every 30 seconds)
```
Editor Changes
    ↓
isDirty = true
    ↓
Timer: 30 seconds
    ↓
POST /api/landing/editor/{id}/save
    ↓
Database + Redis Cache Updated
    ↓
UI Shows: "Saved at 10:35 AM"
```

### Publish Flow
```
User Clicks "Publish"
    ↓
Auto-save triggered
    ↓
POST /api/landing/editor/{id}/publish
    ↓
Version Created
    ↓
Page Status = "published"
    ↓
Redis Cache Cleared
    ↓
Success Message Shown
```

### Version History
```
Version 1 ← Version 2 ← Version 3 (Current)
    ↓         ↓           ↓
Stored    Stored      Published
```

---

## 🔐 Authentication

### Get Token
```bash
POST /login
{
  "email": "user@example.com",
  "password": "password"
}
# Returns: {"access_token": "1|xyz..."}
```

### Use Token
```bash
Authorization: Bearer 1|xyz...
```

### Token Lifetime
- Default: 24 hours
- Configure in: `config/sanctum.php`

---

## 🧪 Quick Tests

### Test Editor Load
```
Browser: https://bsol.zyrotechbd.com/dashboard/landing-pages/1/editor
Expected: GrapesJS editor loads without errors
```

### Test Auto-Save
```
1. Make a change in editor
2. Wait 30 seconds
3. Check: "Saved at" timestamp appears
4. DB: landing_page_editor_drafts has new record
```

### Test API
```bash
# List elements
curl https://bsol.zyrotechbd.com/api/landing/elements

# Get draft
curl -H "Authorization: Bearer TOKEN" \
  https://bsol.zyrotechbd.com/api/landing/editor/1

# Save draft
curl -X POST https://bsol.zyrotechbd.com/api/landing/editor/1/save \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"components_json":"[]"}'
```

---

## 📊 Database Queries

### Get User's Recent Drafts
```sql
SELECT * FROM landing_page_editor_drafts 
WHERE user_id = ? 
ORDER BY last_edited_at DESC 
LIMIT 10;
```

### Get Page Versions
```sql
SELECT * FROM landing_page_versions 
WHERE landing_page_id = ? 
ORDER BY version_number DESC;
```

### Get Available Elements
```sql
SELECT * FROM landing_page_elements 
WHERE is_active = true 
ORDER BY category, sort_order;
```

### Count Elements by Category
```sql
SELECT category, COUNT(*) FROM landing_page_elements 
GROUP BY category;
```

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Editor not loading | Check browser console, verify token |
| Auto-save not working | Verify Redis running, check network tab |
| API 404 errors | Run `php artisan route:cache`, restart |
| Elements missing | Run seeder: `php artisan db:seed --class=LandingPageElementSeeder` |
| Database error | Check connection: `psql -U hybrid_app -d hybrid_platform` |

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `API_REFERENCE.md` | Complete API documentation |
| `DEPLOYMENT_GUIDE.md` | Production deployment steps |
| `TESTING_VALIDATION.md` | Testing checklist |
| `GRAPESJS_IMPLEMENTATION_BLUEPRINT.md` | Implementation phases |
| `IMPLEMENTATION_SUMMARY.md` | Project overview |
| `GRAPESJS_QUICK_START.md` | Getting started guide |

---

## 🔧 Configuration Files

### Frontend (.env.editor)
```env
NEXT_PUBLIC_EDITOR_MAX_JSON_SIZE=5242880
NEXT_PUBLIC_EDITOR_AUTOSAVE_INTERVAL=30000
NEXT_PUBLIC_EDITOR_MAX_UNDO_STEPS=50
```

### Backend (.env updates)
```env
REDIS_EDITOR_CACHE_TTL=86400
LANDING_EDITOR_AUTOSAVE_ENABLED=true
LANDING_EDITOR_VERSION_HISTORY_LIMIT=10
```

---

## 📞 Useful Resources

### Laravel Documentation
- Models: https://laravel.com/docs/eloquent
- Controllers: https://laravel.com/docs/controllers
- Migrations: https://laravel.com/docs/migrations
- Sanctum: https://laravel.com/docs/sanctum

### GrapesJS Documentation
- GitHub: https://github.com/GrapesJS/grapesjs
- Docs: https://grapesjs.com
- Plugins: https://grapesjs.com/plugins.html

### Next.js Documentation
- Docs: https://nextjs.org/docs
- API Routes: https://nextjs.org/docs/api-routes

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All migrations executed
- [ ] Elements seeded
- [ ] Environment variables set
- [ ] API endpoints tested
- [ ] Frontend built
- [ ] SSL certificates valid
- [ ] Database backed up
- [ ] Nginx configured
- [ ] Redis running
- [ ] Services restarted

---

## 📈 Performance Monitoring

### Check API Response Times
```bash
# Monitor requests
tail -f /var/www/hybrid-stack/backend/storage/logs/laravel.log | grep "POST\|GET"

# Check slow queries
# In Laravel: Log slow queries > 100ms
```

### Monitor Redis Cache
```bash
redis-cli
> INFO stats
> MONITOR
```

### Check Database
```bash
# Connection count
SELECT count(*) FROM pg_stat_activity;

# Running queries
SELECT * FROM pg_stat_activity WHERE state = 'active';
```

---

## 🎓 Learning Resources

### For New Team Members
1. Read `IMPLEMENTATION_SUMMARY.md`
2. Review `API_REFERENCE.md`
3. Check code comments in main files
4. Test API endpoints locally
5. Load editor in browser
6. Try adding/editing elements

### For Developers
1. Study `LandingPageEditorService.php` (business logic)
2. Review `LandingPageEditorController.php` (API)
3. Examine `landing-page-editor.tsx` (frontend)
4. Test migrations and seeds
5. Review test checklist

---

**Quick Reference Card v1.0**  
**Updated:** June 2, 2026

