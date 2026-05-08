<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductMediaUploadRequest;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductMediaSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductMediaController extends Controller
{
    public function policy(): JsonResponse
    {
        $policy = $this->effectivePolicy();

        return response()->json([
            'success' => true,
            'data' => $policy,
        ]);
    }

    public function index(int $product): JsonResponse
    {
        $item = Product::query()
            ->where('user_id', auth()->id())
            ->with(['images'])
            ->findOrFail($product);

        return response()->json([
            'success' => true,
            'data' => $item->images,
        ]);
    }

    public function store(ProductMediaUploadRequest $request, int $product): JsonResponse
    {
        $item = Product::query()->where('user_id', auth()->id())->findOrFail($product);
        $policy = $this->effectivePolicy();

        $existingCount = $item->images()->count();
        $files = $request->file('files', []);

        if (($existingCount + count($files)) > $policy['max_gallery_images']) {
            return response()->json([
                'success' => false,
                'message' => 'Max gallery image limit exceeded.',
                'meta' => ['max_gallery_images' => $policy['max_gallery_images']],
            ], 422);
        }

        $maxFileBytes = $policy['max_file_size_mb'] * 1024 * 1024;
        $allowedMimes = array_map('strtolower', $policy['allowed_mime_types']);

        $sortBase = (int) ($item->images()->max('sort_order') ?? -1);
        $created = [];

        foreach ($files as $index => $file) {
            $mime = strtolower((string) $file->getMimeType());
            if (!in_array($mime, $allowedMimes, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unsupported image type.',
                ], 422);
            }

            if ($file->getSize() > $maxFileBytes) {
                return response()->json([
                    'success' => false,
                    'message' => 'Image size exceeds configured limit.',
                ], 422);
            }

            $imageInfo = @getimagesize($file->getPathname()) ?: null;
            $width = $imageInfo[0] ?? null;
            $height = $imageInfo[1] ?? null;

            if (!$this->passesDimensionPolicy($width, $height, $policy)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Image dimensions are outside allowed policy range.',
                ], 422);
            }

            $path = $file->store("product-media/" . auth()->id() . "/{$item->id}", 'public');
            $url = Storage::disk('public')->url($path);

            $row = ProductImage::create([
                'product_id' => $item->id,
                'user_id' => auth()->id(),
                'url' => $url,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $mime,
                'file_size_bytes' => $file->getSize(),
                'width' => $width,
                'height' => $height,
                'sort_order' => $sortBase + $index + 1,
                'is_primary' => false,
            ]);

            $created[] = $row;
        }

        // Auto set thumbnail if not exists and product requires one.
        if ($item->images()->where('is_primary', true)->count() === 0 && count($created) > 0) {
            $created[0]->update(['is_primary' => true]);
            if (!$item->thumbnail) {
                $item->update(['thumbnail' => $created[0]->url]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $item->images()->orderBy('sort_order')->get(),
        ], 201);
    }

    public function reorder(Request $request, int $product): JsonResponse
    {
        $item = Product::query()->where('user_id', auth()->id())->findOrFail($product);

        $data = $request->validate([
            'order' => ['required', 'array', 'min:1'],
            'order.*' => ['required', 'integer'],
        ]);

        $ids = ProductImage::query()
            ->where('product_id', $item->id)
            ->where('user_id', auth()->id())
            ->pluck('id')
            ->toArray();

        foreach ($data['order'] as $sort => $id) {
            if (in_array($id, $ids, true)) {
                ProductImage::where('id', $id)->update(['sort_order' => $sort]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $item->images()->orderBy('sort_order')->get(),
        ]);
    }

    public function setThumbnail(int $product, int $mediaId): JsonResponse
    {
        $item = Product::query()->where('user_id', auth()->id())->findOrFail($product);

        $media = ProductImage::query()
            ->where('product_id', $item->id)
            ->where('user_id', auth()->id())
            ->findOrFail($mediaId);

        ProductImage::query()
            ->where('product_id', $item->id)
            ->where('user_id', auth()->id())
            ->update(['is_primary' => false]);

        $media->update(['is_primary' => true]);
        $item->update(['thumbnail' => $media->url]);

        return response()->json([
            'success' => true,
            'data' => $item->images()->orderBy('sort_order')->get(),
        ]);
    }

    public function destroy(int $product, int $mediaId): JsonResponse
    {
        $item = Product::query()->where('user_id', auth()->id())->findOrFail($product);
        $policy = $this->effectivePolicy();

        $media = ProductImage::query()
            ->where('product_id', $item->id)
            ->where('user_id', auth()->id())
            ->findOrFail($mediaId);

        $total = $item->images()->count();
        if ($policy['thumbnail_required'] && $media->is_primary && $total <= 1 && $item->status === 'active') {
            return response()->json([
                'success' => false,
                'message' => 'At least one thumbnail is required for active product.',
            ], 422);
        }

        if ($media->file_path) {
            Storage::disk('public')->delete($media->file_path);
        }
        $wasPrimary = $media->is_primary;
        $media->delete();

        if ($wasPrimary) {
            $newPrimary = $item->images()->orderBy('sort_order')->first();
            if ($newPrimary) {
                $newPrimary->update(['is_primary' => true]);
                $item->update(['thumbnail' => $newPrimary->url]);
            } else {
                $item->update(['thumbnail' => null]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $item->images()->orderBy('sort_order')->get(),
        ]);
    }

    private function effectivePolicy(): array
    {
        $settings = ProductMediaSetting::query()
            ->where('is_active', true)
            ->latest('id')
            ->first();

        return [
            'max_gallery_images' => (int) ($settings?->max_gallery_images ?? 8),
            'max_file_size_mb' => (int) ($settings?->max_file_size_mb ?? 2),
            'allowed_mime_types' => $settings?->allowed_mime_types ?: ['image/jpeg', 'image/png', 'image/webp'],
            'min_width' => $settings?->min_width,
            'min_height' => $settings?->min_height,
            'max_width' => $settings?->max_width,
            'max_height' => $settings?->max_height,
            'thumbnail_required' => (bool) ($settings?->thumbnail_required ?? true),
        ];
    }

    private function passesDimensionPolicy(?int $width, ?int $height, array $policy): bool
    {
        if (!$width || !$height) {
            return true;
        }

        if (!empty($policy['min_width']) && $width < (int) $policy['min_width']) {
            return false;
        }
        if (!empty($policy['min_height']) && $height < (int) $policy['min_height']) {
            return false;
        }
        if (!empty($policy['max_width']) && $width > (int) $policy['max_width']) {
            return false;
        }
        if (!empty($policy['max_height']) && $height > (int) $policy['max_height']) {
            return false;
        }

        return true;
    }
}
