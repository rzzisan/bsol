<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())
            ->orderBy('sort_order')
            ->orderBy('name')
            ->withCount('products')
            ->get();

        return response()->json(['success' => true, 'data' => $categories]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:150',
            'description' => 'nullable|string|max:500',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);

        $data['user_id']    = auth()->id();
        $data['slug']       = $this->uniqueSlug($data['name']);
        $data['is_active']  = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 0;

        $category = ProductCategory::create($data);

        return response()->json(['success' => true, 'data' => $category], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $category = ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $data = $request->validate([
            'name'        => 'sometimes|required|string|max:150',
            'description' => 'nullable|string|max:500',
            'sort_order'  => 'nullable|integer|min:0',
            'is_active'   => 'nullable|boolean',
        ]);

        if (isset($data['name'])) {
            $data['slug'] = $this->uniqueSlug($data['name'], $id);
        }

        $category->update($data);

        return response()->json(['success' => true, 'data' => $category]);
    }

    /**
     * Featured Categories grid thumbnail (storefront's "caresolution"
     * template — falls back to a letter-circle when unset, see
     * seller_storefront_context.md §24 addendum). Mirrors
     * StorefrontSettingController::uploadBanner()'s single-image,
     * image_path-paired pattern.
     */
    public function uploadThumbnail(Request $request, int $id): JsonResponse
    {
        $category = ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ]);

        $ownerId = auth()->user()->shopOwnerId();

        if ($category->thumbnail_path) {
            Storage::disk('public')->delete($category->thumbnail_path);
        }

        $path = $request->file('image')->store('storefront/' . $ownerId . '/category-thumbnails', 'public');
        $category->thumbnail_url = Storage::disk('public')->url($path);
        $category->thumbnail_path = $path;
        $category->save();

        return response()->json(['success' => true, 'data' => $category]);
    }

    public function removeThumbnail(int $id): JsonResponse
    {
        $category = ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        if ($category->thumbnail_path) {
            Storage::disk('public')->delete($category->thumbnail_path);
        }
        $category->thumbnail_url = null;
        $category->thumbnail_path = null;
        $category->save();

        return response()->json(['success' => true, 'data' => $category]);
    }

    public function destroy(int $id): JsonResponse
    {
        $category = ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        // Move products to uncategorized instead of blocking delete
        $category->products()->update(['category_id' => null]);
        $category->delete();

        return response()->json(['success' => true, 'message' => 'Category deleted.']);
    }

    private function uniqueSlug(string $name, ?int $excludeId = null): string
    {
        $base = Str::slug($name);
        $slug = $base;
        $i    = 1;

        while (
            ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())
                ->where('slug', $slug)
                ->when($excludeId, fn($q) => $q->where('id', '!=', $excludeId))
                ->exists()
        ) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }
}
