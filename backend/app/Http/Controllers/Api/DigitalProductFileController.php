<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DigitalProductSetting;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Upload/replace/remove the hosted file for a digital product — parallel to
 * ProductMediaController but for a single private-disk file per product
 * (not a gallery). See digital_product_context.md §2.
 */
class DigitalProductFileController extends Controller
{
    public function policy(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->effectivePolicy(),
        ]);
    }

    public function store(Request $request, int $product): JsonResponse
    {
        $item = Product::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($product);
        $policy = $this->effectivePolicy();

        $request->validate([
            'file' => ['required', 'file', 'max:' . ($policy['max_file_size_mb'] * 1024)],
        ]);

        $file = $request->file('file');
        $extension = strtolower((string) $file->getClientOriginalExtension());

        if (!in_array($extension, $policy['allowed_extensions'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Unsupported file type.',
                'meta' => ['allowed_extensions' => $policy['allowed_extensions']],
            ], 422);
        }

        if ($file->getSize() > $policy['max_file_size_mb'] * 1024 * 1024) {
            return response()->json([
                'success' => false,
                'message' => 'File size exceeds configured limit.',
                'meta' => ['max_file_size_mb' => $policy['max_file_size_mb']],
            ], 422);
        }

        // Replacing an existing file — remove the old blob so private disk
        // usage doesn't leak orphaned files (§6 storage-capacity concern).
        if ($item->digital_file_path) {
            Storage::disk('local')->delete($item->digital_file_path);
        }

        // Private disk ('local' driver, not web-exposed) — never 'public'.
        // See digital_product_context.md §1ঙ.
        $path = $file->store('digital-products/' . auth()->id() . '/' . $item->id, 'local');

        $item->update([
            'digital_delivery_type' => Product::DIGITAL_DELIVERY_HOSTED_FILE,
            'digital_file_path' => $path,
            'digital_file_name' => $file->getClientOriginalName(),
            'digital_file_mime_type' => (string) $file->getMimeType(),
            'digital_file_size_bytes' => $file->getSize(),
            'digital_external_url' => null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $item->fresh(),
        ], 201);
    }

    public function destroy(int $product): JsonResponse
    {
        $item = Product::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($product);

        if ($item->digital_file_path) {
            Storage::disk('local')->delete($item->digital_file_path);
        }

        $item->update([
            'digital_file_path' => null,
            'digital_file_name' => null,
            'digital_file_mime_type' => null,
            'digital_file_size_bytes' => null,
        ]);

        return response()->json(['success' => true, 'message' => 'Digital file removed.']);
    }

    private function effectivePolicy(): array
    {
        return DigitalProductSetting::effective();
    }
}
