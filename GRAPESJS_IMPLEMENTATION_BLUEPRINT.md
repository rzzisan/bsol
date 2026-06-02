# GrapesJS + Laravel API - A-Z Implementation Blueprint

**Project:** Hybrid Stack SaaS - Landing Page Builder (Elementor-like)  
**Date:** June 2, 2026  
**Target Domain:** `bsol.zyrotechbd.com`  
**Status:** Implementation Plan - Ready to Execute  
**Total Duration:** 16 weeks (4 phases)

---

## 🎯 Executive Summary

এই ডকুমেন্ট GrapesJS + Custom Laravel API দিয়ে একটি complete drag-and-drop landing page builder তৈরির সম্পূর্ণ step-by-step blueprint। প্রতিটি phase-এ কোন কোন files তৈরি হবে, কোন কোন changes করতে হবে, এবং কিভাবে test করতে হবে - সবকিছু বিস্তারিত।

---

## 📋 Overall Timeline (16 Weeks)

```
Week 1-2:    Phase 0 - Environment Setup
Week 3-4:    Phase 1 - Database Schema  
Week 5-8:    Phase 2 - Backend API (Core)
Week 9-12:   Phase 3 - Frontend Editor (Core)
Week 13-14:  Phase 4 - Custom Elements (5 basic)
Week 15-16:  Phase 5 - Testing, Deployment, Docs
```

---

## 📁 Phase 0: Environment & Initial Setup (Week 1-2)

### 0.1 Dependencies Installation

#### Frontend (Next.js 16)

```bash
cd /var/www/hybrid-stack/frontend

# Install GrapesJS and plugins
npm install grapesjs grapesjs-tailwind grapesjs-plugin-ckeditor

# Install UI libraries if not present
npm install lucide-react @radix-ui/react-dialog clsx
```

**Deliverables:**
- ✅ `package.json` updated
- ✅ `node_modules/` updated

#### Backend (Laravel 13)

```bash
cd /var/www/hybrid-stack/backend

# No new packages needed - use existing
# But verify composer.json has these:
# - illuminate/database
# - illuminate/redis
# - laravel/sanctum (already installed)
```

**Deliverables:**
- ✅ Verify `composer.json`

### 0.2 Environment Configuration Files

#### Frontend - New File: `.env.editor`

Location: `/var/www/hybrid-stack/frontend/.env.editor`

```env
NEXT_PUBLIC_EDITOR_MAX_JSON_SIZE=5242880
NEXT_PUBLIC_EDITOR_AUTOSAVE_INTERVAL=30000
NEXT_PUBLIC_EDITOR_MAX_UNDO_STEPS=50
```

#### Backend - Update `.env`

Location: `/var/www/hybrid-stack/backend/.env`

Add these if not present:
```env
REDIS_EDITOR_CACHE_TTL=86400
LANDING_EDITOR_AUTOSAVE_ENABLED=true
LANDING_EDITOR_VERSION_HISTORY_LIMIT=10
```

**Deliverables:**
- ✅ `frontend/.env.editor` created
- ✅ `backend/.env` updated

### 0.3 Folder Structure Creation

Create these directories:

**Frontend:**
```
frontend/src/
├── components/
│   ├── landing-page-editor.tsx          (NEW)
│   ├── grapesjs-elements/               (NEW)
│   │   ├── button-element.ts            (NEW)
│   │   ├── hero-element.ts              (NEW)
│   │   ├── features-element.ts          (NEW)
│   │   ├── testimonials-element.ts      (NEW)
│   │   └── cta-element.ts               (NEW)
│   └── ...existing
├── app/
│   └── dashboard/
│       └── landing-pages/
│           └── [id]/
│               └── editor/
│                   └── page.tsx         (NEW)
└── lib/
    └── landing-editor.ts                (NEW)

Backend:
app/Http/Controllers/Api/
├── LandingPageEditorController.php      (NEW)
└── LandingPageElementController.php     (NEW)

database/migrations/
├── 2026_06_02_create_landing_page_editor_drafts.php    (NEW)
├── 2026_06_02_create_landing_page_versions.php         (NEW)
└── 2026_06_02_create_landing_page_elements.php         (NEW)
```

**Deliverables:**
- ✅ All directories created
- ✅ Folder structure ready

---

## 📊 Phase 1: Database Schema & Migrations (Week 3-4)

### 1.1 Database Migrations

#### Migration 1: Editor Drafts Table

File: `backend/database/migrations/2026_06_02_000001_create_landing_page_editor_drafts.php`

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_editor_drafts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            
            // Editor state - GrapesJS components JSON
            $table->longText('components_json')->nullable();
            
            // Editor styles - GrapesJS CSS
            $table->longText('styles_json')->nullable();
            
            // HTML output
            $table->longText('html_output')->nullable();
            
            // CSS output
            $table->longText('css_output')->nullable();
            
            // Metadata
            $table->json('metadata')->nullable();
            $table->timestamp('last_edited_at')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->unique(['landing_page_id', 'user_id']);
            $table->index('user_id');
            $table->index('last_edited_at');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_editor_drafts');
    }
};
```

**Key Points:**
- Unique constraint on (landing_page_id, user_id) to prevent duplicates
- longText for large JSON data
- Timestamps for tracking

#### Migration 2: Version History

File: `backend/database/migrations/2026_06_02_000002_create_landing_page_versions.php`

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('landing_page_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            
            // Version number (auto-increment per page)
            $table->unsignedInteger('version_number');
            
            // Content snapshot
            $table->longText('components_json');
            $table->longText('styles_json');
            
            // Version info
            $table->string('version_name')->nullable();
            $table->text('change_notes')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->unique(['landing_page_id', 'version_number']);
            $table->index('created_by');
            $table->index('created_at');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_versions');
    }
};
```

#### Migration 3: Custom Elements Registry

File: `backend/database/migrations/2026_06_02_000003_create_landing_page_elements.php`

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('landing_page_elements', function (Blueprint $table) {
            $table->id();
            $table->string('element_key', 100)->unique();
            $table->string('name_en', 180);
            $table->string('name_bn', 180)->nullable();
            $table->text('description')->nullable();
            
            // Element definition
            $table->longText('component_definition');
            $table->json('traits_definition')->nullable();
            
            // Category
            $table->string('category', 50);
            
            // Status
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            
            $table->timestamps();
            
            // Indexes
            $table->index(['category', 'is_active']);
            $table->index('sort_order');
        });
    }
    
    public function down(): void {
        Schema::dropIfExists('landing_page_elements');
    }
};
```

### 1.2 Update Existing Tables

Update `landing_pages` table to add editor support:

File: `backend/database/migrations/2026_06_02_000004_add_editor_columns_to_landing_pages.php`

```php
<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('landing_pages', function (Blueprint $table) {
            // Add these columns if they don't exist
            if (!Schema::hasColumn('landing_pages', 'editor_state')) {
                $table->json('editor_state')->nullable()->after('content');
            }
            if (!Schema::hasColumn('landing_pages', 'last_editor_save')) {
                $table->timestamp('last_editor_save')->nullable()->after('published_at');
            }
        });
    }
    
    public function down(): void {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropColumn(['editor_state', 'last_editor_save']);
        });
    }
};
```

### 1.3 Migration Execution

```bash
cd /var/www/hybrid-stack/backend

# Run migrations
php artisan migrate

# Verify
php artisan migrate:status
```

**Deliverables:**
- ✅ 4 migrations created
- ✅ All migrations executed successfully
- ✅ Database schema verified

---

## 🔌 Phase 2: Backend API Endpoints (Week 5-8)

### 2.1 Create Models

#### Model 1: LandingPageEditorDraft

File: `backend/app/Models/LandingPageEditorDraft.php`

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageEditorDraft extends Model
{
    protected $fillable = [
        'landing_page_id',
        'user_id',
        'components_json',
        'styles_json',
        'html_output',
        'css_output',
        'metadata',
        'last_edited_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'last_edited_at' => 'datetime',
    ];

    public function landingPage(): BelongsTo {
        return $this->belongsTo(LandingPage::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
```

#### Model 2: LandingPageVersion

File: `backend/app/Models/LandingPageVersion.php`

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageVersion extends Model
{
    protected $fillable = [
        'landing_page_id',
        'created_by',
        'version_number',
        'components_json',
        'styles_json',
        'version_name',
        'change_notes',
    ];

    public function landingPage(): BelongsTo {
        return $this->belongsTo(LandingPage::class);
    }

    public function createdBy(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by');
    }
}
```

#### Model 3: LandingPageElement

File: `backend/app/Models/LandingPageElement.php`

```php
<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandingPageElement extends Model
{
    protected $fillable = [
        'element_key',
        'name_en',
        'name_bn',
        'description',
        'component_definition',
        'traits_definition',
        'category',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'traits_definition' => 'array',
        'is_active' => 'boolean',
    ];

    public static function getActive($category = null) {
        $query = self::where('is_active', true)->orderBy('sort_order');
        
        if ($category) {
            $query->where('category', $category);
        }
        
        return $query->get();
    }
}
```

**Deliverables:**
- ✅ 3 Models created
- ✅ Relationships defined

### 2.2 Create Services

#### Service 1: LandingPageEditorService

File: `backend/app/Services/LandingPageEditorService.php`

```php
<?php
namespace App\Services;

use App\Models\LandingPage;
use App\Models\LandingPageEditorDraft;
use App\Models\LandingPageVersion;
use Illuminate\Support\Facades\Redis;

class LandingPageEditorService
{
    private const REDIS_DRAFT_KEY = 'landing_editor:draft:%d';
    private const REDIS_DRAFT_TTL = 86400; // 24 hours

    /**
     * Get editor draft (from Redis or database)
     */
    public function getDraft(int $pageId, int $userId): ?LandingPageEditorDraft
    {
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        
        // Try Redis first
        $cached = Redis::get($cacheKey);
        if ($cached) {
            return json_decode($cached, true);
        }
        
        // Fall back to database
        return LandingPageEditorDraft::where([
            'landing_page_id' => $pageId,
            'user_id' => $userId,
        ])->first();
    }

    /**
     * Save draft to Redis and database
     */
    public function saveDraft(
        int $pageId,
        int $userId,
        array $data
    ): LandingPageEditorDraft {
        // Update database
        $draft = LandingPageEditorDraft::updateOrCreate(
            [
                'landing_page_id' => $pageId,
                'user_id' => $userId,
            ],
            [
                'components_json' => $data['components_json'] ?? null,
                'styles_json' => $data['styles_json'] ?? null,
                'html_output' => $data['html_output'] ?? null,
                'css_output' => $data['css_output'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'last_edited_at' => now(),
            ]
        );
        
        // Update Redis cache
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        Redis::setex($cacheKey, self::REDIS_DRAFT_TTL, json_encode($draft));
        
        return $draft;
    }

    /**
     * Publish draft (create version and update landing page)
     */
    public function publishDraft(int $pageId, int $userId): LandingPage
    {
        $draft = LandingPageEditorDraft::where([
            'landing_page_id' => $pageId,
            'user_id' => $userId,
        ])->firstOrFail();

        $page = LandingPage::findOrFail($pageId);

        // Create version
        $latestVersion = LandingPageVersion::where('landing_page_id', $pageId)
            ->max('version_number') ?? 0;

        LandingPageVersion::create([
            'landing_page_id' => $pageId,
            'created_by' => $userId,
            'version_number' => $latestVersion + 1,
            'components_json' => $draft->components_json,
            'styles_json' => $draft->styles_json,
            'version_name' => "Version " . ($latestVersion + 1),
        ]);

        // Update page
        $page->update([
            'status' => 'published',
            'published_at' => now(),
            'editor_state' => [
                'components' => $draft->components_json,
                'styles' => $draft->styles_json,
                'html' => $draft->html_output,
                'css' => $draft->css_output,
            ],
        ]);

        // Clear cache
        $cacheKey = sprintf(self::REDIS_DRAFT_KEY, $pageId);
        Redis::del($cacheKey);

        return $page;
    }

    /**
     * Get version history
     */
    public function getVersions(int $pageId, int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return LandingPageVersion::where('landing_page_id', $pageId)
            ->orderByDesc('version_number')
            ->limit($limit)
            ->get();
    }

    /**
     * Rollback to version
     */
    public function rollbackToVersion(int $pageId, int $userId, int $versionNumber): LandingPageEditorDraft
    {
        $version = LandingPageVersion::where([
            'landing_page_id' => $pageId,
            'version_number' => $versionNumber,
        ])->firstOrFail();

        return $this->saveDraft($pageId, $userId, [
            'components_json' => $version->components_json,
            'styles_json' => $version->styles_json,
        ]);
    }
}
```

### 2.3 Create Controllers

#### Controller: LandingPageEditorController

File: `backend/app/Http/Controllers/Api/LandingPageEditorController.php`

```php
<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Services\LandingPageEditorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingPageEditorController extends Controller
{
    private LandingPageEditorService $editorService;

    public function __construct(LandingPageEditorService $editorService)
    {
        $this->editorService = $editorService;
    }

    /**
     * GET /api/landing/editor/{pageId}
     * Get editor draft
     */
    public function getDraft(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $draft = $this->editorService->getDraft($pageId, auth()->id());

        return response()->json([
            'success' => true,
            'data' => $draft,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/save
     * Save draft (auto-save)
     */
    public function saveDraft(Request $request, int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $validated = $request->validate([
            'components_json' => 'nullable|string',
            'styles_json' => 'nullable|string',
            'html_output' => 'nullable|string',
            'css_output' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $draft = $this->editorService->saveDraft($pageId, auth()->id(), $validated);

        return response()->json([
            'success' => true,
            'message' => 'Draft saved successfully',
            'data' => $draft,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/publish
     * Publish page
     */
    public function publishPage(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $publishedPage = $this->editorService->publishDraft($pageId, auth()->id());

        return response()->json([
            'success' => true,
            'message' => 'Page published successfully',
            'data' => $publishedPage,
        ]);
    }

    /**
     * GET /api/landing/editor/{pageId}/versions
     * Get version history
     */
    public function getVersions(int $pageId): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('view', $page);

        $versions = $this->editorService->getVersions($pageId);

        return response()->json([
            'success' => true,
            'data' => $versions,
        ]);
    }

    /**
     * POST /api/landing/editor/{pageId}/rollback/{versionNumber}
     * Rollback to version
     */
    public function rollbackToVersion(int $pageId, int $versionNumber): JsonResponse
    {
        $page = LandingPage::findOrFail($pageId);
        $this->authorize('update', $page);

        $draft = $this->editorService->rollbackToVersion($pageId, auth()->id(), $versionNumber);

        return response()->json([
            'success' => true,
            'message' => 'Rolled back to version ' . $versionNumber,
            'data' => $draft,
        ]);
    }
}
```

#### Controller: LandingPageElementController

File: `backend/app/Http/Controllers/Api/LandingPageElementController.php`

```php
<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPageElement;
use Illuminate\Http\JsonResponse;

class LandingPageElementController extends Controller
{
    /**
     * GET /api/landing/elements
     * Get all available elements grouped by category
     */
    public function index(): JsonResponse
    {
        $elements = LandingPageElement::where('is_active', true)
            ->orderBy('category')
            ->orderBy('sort_order')
            ->get()
            ->groupBy('category');

        return response()->json([
            'success' => true,
            'data' => $elements,
        ]);
    }

    /**
     * GET /api/landing/elements/{key}
     * Get single element definition
     */
    public function show(string $key): JsonResponse
    {
        $element = LandingPageElement::where('element_key', $key)
            ->where('is_active', true)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $element,
        ]);
    }
}
```

### 2.4 Update Routes

File: `backend/routes/api.php`

Add these routes:

```php
// Landing Page Editor Routes
Route::middleware('auth:sanctum')->group(function () {
    // Editor draft management
    Route::get('/landing/editor/{pageId}', 
        [LandingPageEditorController::class, 'getDraft']);
    Route::post('/landing/editor/{pageId}/save', 
        [LandingPageEditorController::class, 'saveDraft']);
    Route::post('/landing/editor/{pageId}/publish', 
        [LandingPageEditorController::class, 'publishPage']);
    
    // Version management
    Route::get('/landing/editor/{pageId}/versions', 
        [LandingPageEditorController::class, 'getVersions']);
    Route::post('/landing/editor/{pageId}/rollback/{versionNumber}', 
        [LandingPageEditorController::class, 'rollbackToVersion']);
});

// Public element registry
Route::get('/landing/elements', 
    [LandingPageElementController::class, 'index']);
Route::get('/landing/elements/{key}', 
    [LandingPageElementController::class, 'show']);
```

### 2.5 Create Seeder (Optional)

File: `backend/database/seeders/LandingPageElementSeeder.php`

```php
<?php
namespace Database\Seeders;

use App\Models\LandingPageElement;
use Illuminate\Database\Seeder;

class LandingPageElementSeeder extends Seeder
{
    public function run(): void
    {
        $elements = [
            // Basic Elements
            [
                'element_key' => 'heading',
                'name_en' => 'Heading',
                'name_bn' => 'শিরোনাম',
                'category' => 'basic',
                'sort_order' => 1,
                'component_definition' => '<h1>Your Heading</h1>',
            ],
            [
                'element_key' => 'paragraph',
                'name_en' => 'Paragraph',
                'name_bn' => 'অনুচ্ছেদ',
                'category' => 'basic',
                'sort_order' => 2,
                'component_definition' => '<p>Your text here</p>',
            ],
            // ... more elements
        ];

        foreach ($elements as $element) {
            LandingPageElement::updateOrCreate(
                ['element_key' => $element['element_key']],
                $element
            );
        }
    }
}
```

Run seeder:
```bash
php artisan db:seed --class=LandingPageElementSeeder
```

**Deliverables:**
- ✅ 3 Models created
- ✅ 1 Service created
- ✅ 2 Controllers created  
- ✅ Routes added
- ✅ Data seeded

---

## 🎨 Phase 3: Frontend GrapesJS Component (Week 9-12)

### 3.1 Create Core Editor Component

File: `frontend/src/components/landing-page-editor.tsx`

(Using code from GRAPESJS_QUICK_START.md with enhancements)

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs from "grapesjs";
import grapesjsTailwind from "grapesjs-tailwind";
import GjsPluginCkeditor from "grapesjs-plugin-ckeditor";
import { getStoredToken } from "@/lib/dashboard-client";

interface LandingPageEditorProps {
  pageId: string;
  onSave?: (html: string, css: string) => void;
}

export function LandingPageEditor({ pageId, onSave }: LandingPageEditorProps) {
  const editorRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const token = getStoredToken();
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save mechanism
  const autoSave = useCallback(async () => {
    if (!editorRef.current || !isDirty) return;

    setIsSaving(true);
    try {
      const html = editorRef.current.getHtml();
      const css = editorRef.current.getCss();
      const components = editorRef.current.getComponents();
      const styles = editorRef.current.getStyles();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            components_json: JSON.stringify(components),
            styles_json: JSON.stringify(styles),
            html_output: html,
            css_output: css,
          }),
        }
      );

      if (!response.ok) throw new Error("Save failed");

      setLastSaved(new Date());
      setIsDirty(false);
      onSave?.(html, css);
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [pageId, token, onSave, isDirty]);

  // Initialize editor
  useEffect(() => {
    const initEditor = async () => {
      try {
        // Load existing page data
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to load page");

        const { data } = await response.json();

        // Initialize GrapesJS
        const editor = grapesjs.init({
          container: "#gjs-editor",
          height: "100vh",
          width: "auto",
          storageManager: false,
          undoManager: { trackChanges: true },
          plugins: [grapesjsTailwind, GjsPluginCkeditor],
          pluginsOpts: {
            grapesjsTailwind: {},
            "grapesjs-plugin-ckeditor": {
              options: {
                toolbar: ["Bold", "Italic", "Underline", "Link"],
              },
            },
          },
          blockManager: {
            blocks: [
              {
                id: "section",
                label: "Section",
                content: '<section class="w-full py-12 px-4"></section>',
                category: "Layout",
                attributes: { class: "fa fa-square-o" },
              },
              {
                id: "text",
                label: "Text",
                content: "<p>Your text here</p>",
                category: "Basic",
                attributes: { class: "fa fa-font" },
              },
              {
                id: "image",
                label: "Image",
                content:
                  '<img src="https://via.placeholder.com/350x250" alt="image" />',
                category: "Basic",
                attributes: { class: "fa fa-image" },
              },
            ],
          },
        });

        // Load saved content if exists
        if (data?.components_json) {
          try {
            const components = JSON.parse(data.components_json);
            editor.setComponents(components);
          } catch (e) {
            console.warn("Could not parse saved components");
          }
        }

        // Mark dirty on changes
        editor.on("change:component", () => setIsDirty(true));
        editor.on("style:change", () => setIsDirty(true));

        editorRef.current = editor;

        // Setup auto-save interval
        autoSaveIntervalRef.current = setInterval(() => {
          autoSave();
        }, 30000); // 30 seconds

        return () => {
          if (autoSaveIntervalRef.current) {
            clearInterval(autoSaveIntervalRef.current);
          }
          editor.destroy();
        };
      } catch (error) {
        console.error("Editor initialization error:", error);
      }
    };

    initEditor();
  }, [pageId, token, autoSave]);

  // Manual save
  const handleManualSave = () => {
    autoSave();
  };

  // Publish page
  const handlePublish = async () => {
    if (!editorRef.current) return;

    try {
      // Save first
      await autoSave();

      // Then publish
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) throw new Error("Publish failed");

      const result = await response.json();
      alert("Page published successfully!");
      console.log("Published page:", result.data);
    } catch (error) {
      console.error("Publish error:", error);
      alert("Failed to publish page");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Landing Page Editor</h1>
          <div className="flex gap-2">
            <button
              onClick={handleManualSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => editorRef.current?.undo()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Undo
            </button>
            <button
              onClick={() => editorRef.current?.redo()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Redo
            </button>
            <button
              onClick={handlePublish}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Publish
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600">
          {isSaving && <span className="animate-pulse">Saving...</span>}
          {lastSaved && !isSaving && (
            <span className="text-green-600">
              Saved at {lastSaved.toLocaleTimeString()}
            </span>
          )}
          {isDirty && !isSaving && <span className="text-orange-600">● Unsaved changes</span>}
        </div>
      </div>

      {/* Editor */}
      <div id="gjs-editor" className="flex-1" />
    </div>
  );
}
```

### 3.2 Create Page Route

File: `frontend/src/app/dashboard/landing-pages/[id]/editor/page.tsx`

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { LandingPageEditor } from "@/components/landing-page-editor";

export default function LandingPageEditorPage() {
  const params = useParams();
  const pageId = params.id as string;
  const router = useRouter();

  useEffect(() => {
    // Redirect if not logged in
    // This should be handled by layout middleware
  }, [router]);

  return (
    <div className="h-screen w-screen">
      <LandingPageEditor
        pageId={pageId}
        onSave={(html, css) => {
          console.log("Page saved", { html, css });
        }}
      />
    </div>
  );
}
```

### 3.3 Create Utilities

File: `frontend/src/lib/landing-editor.ts`

```typescript
export async function fetchEditorDraft(pageId: string, token: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error("Failed to fetch draft");
  return response.json();
}

export async function saveEditorDraft(
  pageId: string,
  data: {
    components_json: string;
    styles_json: string;
    html_output: string;
    css_output: string;
  },
  token: string
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) throw new Error("Failed to save draft");
  return response.json();
}

export async function publishEditorPage(pageId: string, token: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) throw new Error("Failed to publish page");
  return response.json();
}

export async function getVersionHistory(pageId: string, token: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_BASE_URL || "/api"}/landing/editor/${pageId}/versions`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) throw new Error("Failed to fetch versions");
  return response.json();
}
```

**Deliverables:**
- ✅ Editor component created
- ✅ Page route created
- ✅ Utility functions created

---

## 🧩 Phase 4: Custom Elements (Week 13-14)

(Detailed implementation in GRAPESJS_CUSTOM_ELEMENTS.md - will implement 5 basic elements)

**Elements to implement:**
1. Button Element
2. Hero Section
3. Features Grid
4. Testimonials
5. CTA Section

Each element will have:
- Component definition
- Traits (editable properties)
- Styling options
- Block registration

**Deliverables:**
- ✅ 5 element files created
- ✅ All elements registered
- ✅ All elements tested

---

## ✅ Phase 5-6: Testing, Deployment, Docs (Week 15-16)

### Testing Checklist:
- [ ] Editor loads without errors
- [ ] Auto-save works (30s interval)
- [ ] Undo/Redo works
- [ ] All 5 elements dragable
- [ ] Publish functionality works
- [ ] Version history works
- [ ] Rollback works
- [ ] Mobile responsive

### Documentation:
- [ ] API documentation
- [ ] Component usage guide
- [ ] Deployment steps
- [ ] User manual

---

## 🎯 Success Criteria

✅ **Fully functional** GrapesJS landing page builder with:
- Auto-save every 30 seconds
- Version history (10 versions)
- 5 ready-to-use elements
- Full CRUD operations
- Multi-user support
- Mobile responsive

---

**Total Effort:** 16 weeks  
**Team Size:** 1-2 developers  
**Status:** ✅ READY TO IMPLEMENT

