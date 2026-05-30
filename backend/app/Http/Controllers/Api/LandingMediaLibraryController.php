<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingMediaAsset;
use App\Models\ProductMediaSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LandingMediaLibraryController extends Controller
{
    public function index(): JsonResponse
    {
        $assets = LandingMediaAsset::query()
            ->where('user_id', auth()->id())
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $assets,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'min:1'],
            'files.*' => ['required', 'file', 'image'],
        ]);

        $policy = $this->effectivePolicy();
        $files = $request->file('files', []);

        if (count($files) > $policy['max_gallery_images']) {
            return response()->json([
                'success' => false,
                'message' => 'Max gallery image limit exceeded for a single upload.',
                'meta' => ['max_gallery_images' => $policy['max_gallery_images']],
            ], 422);
        }

        $maxFileBytes = $policy['max_file_size_mb'] * 1024 * 1024;
        $allowedMimes = array_map('strtolower', $policy['allowed_mime_types']);
        $created = [];

        foreach ($files as $file) {
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

            $path = $file->store('landing-media/' . auth()->id(), 'public');
            $url = Storage::disk('public')->url($path);

            $created[] = LandingMediaAsset::create([
                'user_id' => auth()->id(),
                'url' => $url,
                'file_path' => $path,
                'file_name' => $file->getClientOriginalName(),
                'mime_type' => $mime,
                'file_size_bytes' => $file->getSize(),
                'width' => $width,
                'height' => $height,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $created,
        ], 201);
    }

    public function policy(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => $this->effectivePolicy(),
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
