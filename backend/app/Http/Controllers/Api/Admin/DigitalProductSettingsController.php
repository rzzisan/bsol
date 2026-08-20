<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DigitalProductSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Admin-controlled global policy for hosted digital-product files — exact
 * clone of ProductMediaSettingsController's pattern (single "latest active"
 * row, admin writes, sellers only read via DigitalProductFileController::policy()).
 * See digital_product_context.md §2.
 */
class DigitalProductSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        $settings = DigitalProductSetting::query()
            ->whereIn('user_id', $this->adminScopeUserIds())
            ->where('is_active', true)
            ->latest('id')
            ->first();

        if (!$settings) {
            return response()->json([
                'status' => 'success',
                'data' => [...DigitalProductSetting::effective(), 'is_active' => true],
            ]);
        }

        return response()->json([
            'status' => 'success',
            'data' => $settings,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'max_file_size_mb' => ['required', 'integer', 'min:1', 'max:2048'],
            'allowed_extensions' => ['required', 'array', 'min:1'],
            'allowed_extensions.*' => ['string', 'max:20', 'regex:/^[a-z0-9]+$/i'],
            'download_link_expiry_hours' => ['required', 'integer', 'min:1', 'max:8760'],
            'max_downloads_per_purchase' => ['required', 'integer', 'min:1', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $settings = DigitalProductSetting::create([
            ...$data,
            'allowed_extensions' => array_values(array_map('strtolower', $data['allowed_extensions'])),
            'user_id' => auth()->id(),
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Digital product settings updated.',
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
