<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateProductMediaSettingsRequest;
use App\Models\ProductMediaSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class ProductMediaSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = ProductMediaSetting::query()
            ->whereIn('user_id', $this->adminScopeUserIds())
            ->where('is_active', true)
            ->latest('id')
            ->first();

        if (!$settings) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'max_gallery_images' => 8,
                    'max_file_size_mb' => 2,
                    'allowed_mime_types' => ['image/jpeg', 'image/png', 'image/webp'],
                    'min_width' => null,
                    'min_height' => null,
                    'max_width' => null,
                    'max_height' => null,
                    'thumbnail_required' => true,
                    'is_active' => true,
                ],
            ]);
        }

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }

    public function update(UpdateProductMediaSettingsRequest $request): JsonResponse
    {
        $data = $request->validated();

        $settings = ProductMediaSetting::create([
            ...$data,
            'user_id' => auth()->id(),
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Product media settings updated.',
            'data' => $settings,
        ]);
    }

    /**
     * @return array<int>
     */
    private function adminScopeUserIds(): array
    {
        if (auth()->user()->isAdmin()) {
            return User::where('role', 'admin')->pluck('id')->toArray();
        }

        return [auth()->id()];
    }
}
