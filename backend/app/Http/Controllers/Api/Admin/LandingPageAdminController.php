<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingPageAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->per_page ?? 20), 100);

        $pages = LandingPage::query()
            ->with(['user:id,name,email,mobile', 'template:id,code,name_bn,name_en', 'adminLockedBy:id,name'])
            ->withCount('products')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('locked'), fn ($q) => $q->where('admin_locked', $request->boolean('locked')))
            ->when($request->filled('seller'), function ($q) use ($request) {
                $term = $request->string('seller');
                $q->whereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('mobile', 'like', "%{$term}%"));
            })
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = $request->string('search');
                $q->where(function ($sq) use ($term) {
                    $sq->where('title', 'like', "%{$term}%")
                        ->orWhere('slug', 'like', "%{$term}%");
                });
            })
            ->orderByDesc('id')
            ->paginate($perPage);

        $data = collect($pages->items())->map(fn (LandingPage $page) => $this->formatPage($page))->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $pages->total(),
                'current_page' => $pages->currentPage(),
                'last_page' => $pages->lastPage(),
                'per_page' => $pages->perPage(),
            ],
        ]);
    }

    public function lock(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $page = LandingPage::query()->with(['user:id,name,email,mobile', 'template:id,code,name_bn,name_en'])->findOrFail($id);

        $page->update([
            'status' => 'draft',
            'admin_locked' => true,
            'admin_lock_reason' => $validated['reason'],
            'admin_locked_at' => now(),
            'admin_locked_by' => auth()->id(),
        ]);

        $page->setRelation('adminLockedBy', auth()->user());

        return response()->json([
            'success' => true,
            'message' => 'Landing page has been unpublished and locked.',
            'data' => $this->formatPage($page->fresh(['user:id,name,email,mobile', 'template:id,code,name_bn,name_en', 'adminLockedBy:id,name'])),
        ]);
    }

    public function unlock(int $id): JsonResponse
    {
        $page = LandingPage::query()->findOrFail($id);

        $page->update([
            'admin_locked' => false,
            'admin_lock_reason' => null,
            'admin_locked_at' => null,
            'admin_locked_by' => null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Landing page has been unlocked. The seller can publish it again.',
            'data' => $this->formatPage($page->fresh(['user:id,name,email,mobile', 'template:id,code,name_bn,name_en'])),
        ]);
    }

    private function formatPage(LandingPage $page): array
    {
        return [
            'id' => $page->id,
            'title' => $page->title,
            'slug' => $page->slug,
            'status' => $page->status,
            'admin_locked' => $page->admin_locked,
            'admin_lock_reason' => $page->admin_lock_reason,
            'admin_locked_at' => $page->admin_locked_at,
            'admin_locked_by' => $page->adminLockedBy,
            'product_count' => $page->products_count ?? $page->products()->count(),
            'template' => $page->template,
            'seller' => $page->user,
            'published_at' => $page->published_at,
            'created_at' => $page->created_at,
            'updated_at' => $page->updated_at,
        ];
    }
}
