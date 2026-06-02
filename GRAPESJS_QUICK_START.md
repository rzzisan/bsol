# GrapesJS Implementation Starter - Quick Start Guide

**Document Purpose:** দ্রুত শুরু করার জন্য GrapesJS setup guide  
**Target Domain:** `bsol.zyrotechbd.com`  
**Status:** Ready for POC (Proof of Concept)

---

## 🚀 Quick Start (30 minutes setup)

### Step 1: Install Dependencies

```bash
cd /var/www/hybrid-stack/frontend

npm install grapesjs grapesjs-tailwind grapesjs-plugin-ckeditor grapesjs-aviary
```

### Step 2: Create Editor Component

Create file: `frontend/src/components/landing-page-editor.tsx`

```tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import grapesjs from "grapesjs";
import grapesjsTailwind from "grapesjs-tailwind";
import GjsPluginCkeditor from "grapesjs-plugin-ckeditor";
import gjsAviary from "grapesjs-aviary";
import { getStoredToken } from "@/lib/dashboard-client";

interface LandingPageEditorProps {
  pageId: string;
  onSave?: (html: string, css: string) => void;
}

export function LandingPageEditor({ pageId, onSave }: LandingPageEditorProps) {
  const editorRef = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const token = getStoredToken();

  // Auto-save mechanism
  const autoSave = useCallback(async () => {
    if (!editorRef.current) return;

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
            editor_state: html,
            styles: css,
            components: JSON.stringify(components),
            component_styles: JSON.stringify(styles),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("Save failed");
      }

      setLastSaved(new Date());
      onSave?.(html, css);
    } catch (error) {
      console.error("Auto-save error:", error);
    } finally {
      setIsSaving(false);
    }
  }, [pageId, token, onSave]);

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
          container: "#gjs",
          height: "100vh",
          width: "auto",
          fromElement: false,
          storageManager: false, // We use custom backend
          undoManager: { trackChanges: true },
          assetManager: {
            uploadText: "Upload images",
            addBtnText: "Add image",
            modalTitle: "Select Image",
            typeFilter: "image",
          },
          blockManager: {
            blocks: [
              {
                id: "section",
                label: "Section",
                content: '<div class="w-full py-12 px-4 bg-white"></div>',
                category: "Basic",
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
              {
                id: "button",
                label: "Button",
                content: '<button class="px-4 py-2 bg-blue-600 text-white rounded">Click Me</button>',
                category: "Basic",
                attributes: { class: "fa fa-mouse-pointer" },
              },
              {
                id: "container",
                label: "Container",
                content:
                  '<div class="w-full max-w-6xl mx-auto px-4"><div class="grid grid-cols-3 gap-4"></div></div>',
                category: "Layout",
                attributes: { class: "fa fa-th" },
              },
            ],
          },
          plugins: [
            grapesjsTailwind,
            GjsPluginCkeditor,
            // gjsAviary, // Optional: image editor
          ],
          pluginsOpts: {
            grapesjsTailwind: {
              classPrefix: "",
              blocks: ["text-muted", "text-center", "text-right"],
            },
            grapesjs_ckeditor: {
              options: {
                toolbar: [
                  ["Bold", "Italic", "Underline"],
                  ["Link"],
                ],
              },
            },
          },
        });

        // Load saved content if exists
        if (data?.editor_state) {
          try {
            const components = JSON.parse(data.editor_state);
            editor.setComponents(components);
          } catch (e) {
            console.warn("Could not parse saved components");
          }
        }

        // Setup auto-save interval (every 30 seconds)
        const interval = setInterval(() => {
          autoSave();
        }, 30000);

        editorRef.current = editor;

        return () => clearInterval(interval);
      } catch (error) {
        console.error("Editor initialization error:", error);
      }
    };

    initEditor();
  }, [pageId, token, autoSave]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Landing Page Editor</h1>
          <div className="flex gap-2">
            <button
              onClick={() => autoSave()}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.undo();
                }
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Undo
            </button>
            <button
              onClick={() => {
                if (editorRef.current) {
                  editorRef.current.redo();
                }
              }}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Redo
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
        </div>
      </div>

      {/* Editor */}
      <div id="gjs" className="flex-1" />
    </div>
  );
}
```

### Step 3: Create Backend API Endpoint

Create file: `backend/app/Http/Controllers/Api/LandingPageEditorController.php`

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

class LandingPageEditorController extends Controller
{
    /**
     * Get editor draft
     */
    public function getDraft(int $id): JsonResponse
    {
        $page = LandingPage::findOrFail($id);
        
        // Authorization check
        if ($page->user_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Try to get from Redis cache first (latest auto-save)
        $cacheKey = "landing_editor:{$id}:draft";
        $cachedDraft = Redis::get($cacheKey);

        if ($cachedDraft) {
            return response()->json([
                'success' => true,
                'data' => json_decode($cachedDraft, true),
                'source' => 'redis',
            ]);
        }

        // Fall back to database
        return response()->json([
            'success' => true,
            'data' => [
                'editor_state' => $page->content['editor_state'] ?? null,
                'styles' => $page->content['styles'] ?? null,
            ],
            'source' => 'database',
        ]);
    }

    /**
     * Save editor draft (auto-save)
     */
    public function saveDraft(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::findOrFail($id);

        // Authorization check
        if ($page->user_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'editor_state' => 'string',
            'styles' => 'string',
            'components' => 'nullable|string',
            'component_styles' => 'nullable|string',
        ]);

        // Save to Redis cache (expires in 24 hours)
        $cacheKey = "landing_editor:{$id}:draft";
        Redis::setex($cacheKey, 86400, json_encode($validated));

        // Save to database (for persistence)
        $page->update([
            'content' => array_merge($page->content ?? [], [
                'editor_state' => $validated['editor_state'],
                'styles' => $validated['styles'],
                'components' => $validated['components'] ?? null,
                'component_styles' => $validated['component_styles'] ?? null,
                'last_editor_save' => now(),
            ]),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Draft saved successfully',
        ]);
    }

    /**
     * Publish page (move to production)
     */
    public function publishPage(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::findOrFail($id);

        if ($page->user_id !== auth()->id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Get current draft
        $cacheKey = "landing_editor:{$id}:draft";
        $draft = Redis::get($cacheKey);

        if (!$draft) {
            return response()->json(['error' => 'No draft to publish'], 400);
        }

        $draftData = json_decode($draft, true);

        // Update page
        $page->update([
            'status' => 'published',
            'published_at' => now(),
            'content' => array_merge($page->content ?? [], $draftData),
        ]);

        // Clear cache
        Redis::del($cacheKey);

        return response()->json([
            'success' => true,
            'message' => 'Page published successfully',
            'public_url' => route('landing.show', $page->slug),
        ]);
    }
}
```

### Step 4: Add Routes

In `backend/routes/api.php`:

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/landing/editor/{id}', [LandingPageEditorController::class, 'getDraft']);
    Route::post('/landing/editor/{id}/save', [LandingPageEditorController::class, 'saveDraft']);
    Route::post('/landing/editor/{id}/publish', [LandingPageEditorController::class, 'publishPage']);
});
```

### Step 5: Create Database Table

Migration file: `backend/database/migrations/2026_06_02_add_editor_state.php`

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->json('editor_state')->nullable()->after('content');
            $table->timestamp('last_editor_save')->nullable()->after('published_at');
        });
    }

    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropColumn(['editor_state', 'last_editor_save']);
        });
    }
};
```

Run migration:

```bash
cd /var/www/hybrid-stack/backend
php artisan migrate
```

### Step 6: Add Page Route

Create page: `frontend/src/app/dashboard/landing-pages/[id]/editor/page.tsx`

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { LandingPageEditor } from "@/components/landing-page-editor";

export default function LandingPageEditorPage() {
  const params = useParams();
  const pageId = params.id as string;
  const router = useRouter();

  return (
    <LandingPageEditor
      pageId={pageId}
      onSave={(html, css) => {
        console.log("Page saved", { html, css });
      }}
    />
  );
}
```

---

## 📋 MVP Checklist

- [ ] GrapesJS installed and configured
- [ ] Frontend editor component created
- [ ] Backend API endpoints implemented
- [ ] Database migrations run
- [ ] Routes added
- [ ] Auto-save mechanism working
- [ ] Test with sample content
- [ ] Publish functionality working

---

## 🧪 Testing

### Local Testing:

```bash
# Terminal 1: Backend
cd /var/www/hybrid-stack/backend
php artisan serve

# Terminal 2: Frontend
cd /var/www/hybrid-stack/frontend
npm run dev

# Navigate to: http://localhost:3000/dashboard/landing-pages/1/editor
```

---

## 🔄 Next Steps After POC

1. **Add more elements** (Phase 1 MVP)
   - Icon element
   - Video element
   - Gallery/Carousel

2. **Styling options**
   - Color picker
   - Typography controls
   - Responsive spacing

3. **Version history**
   - Save versions
   - Rollback capability

4. **Performance**
   - Optimize JSON size
   - Compress stored state
   - Index database columns

---

## 📊 Performance Tips

- Keep editor state JSON < 5MB
- Use Redis with 24h TTL for drafts
- Compress CSS/HTML before storage
- Index `landing_pages.user_id` and `status`
- Clear old Redis cache after 7 days

---

## 🚨 Common Issues & Fixes

### Issue: "Blocks not showing"
**Solution:** Ensure blockManager is properly configured

### Issue: "Save fails"
**Solution:** Check Bearer token in headers, verify CORS

### Issue: "Editor slow with large pages"
**Solution:** Break into multiple sections, use lazy loading

---

## 📚 GrapesJS Useful Docs

- [GrapesJS Docs](https://grapesjs.com/docs)
- [Block Manager](https://grapesjs.com/docs/modules/Blocks.html)
- [Component Model](https://grapesjs.com/docs/modules/Components.html)
- [Style Manager](https://grapesjs.com/docs/modules/Styles.html)

---

**Created:** June 2, 2026  
**Ready to implement:** Yes  
**Estimated time:** 5-7 days for POC
