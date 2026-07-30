<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin control over the SaaS attribution/liability footer shown on
 * every merchant's public landing page, and the public /terms page it links
 * to. Single-row settings, same pattern as RegistrationSetting::getSetting().
 */
class PlatformSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => PlatformSetting::getSetting()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'credit_text_bn' => ['nullable', 'string', 'max:500'],
            'credit_text_en' => ['nullable', 'string', 'max:500'],
            'terms_link_label_bn' => ['nullable', 'string', 'max:150'],
            'terms_link_label_en' => ['nullable', 'string', 'max:150'],
            'terms_title_bn' => ['nullable', 'string', 'max:200'],
            'terms_title_en' => ['nullable', 'string', 'max:200'],
            'terms_content_bn' => ['nullable', 'array'],
            'terms_content_en' => ['nullable', 'array'],
        ]);

        $setting = PlatformSetting::getSetting();
        $setting->update($data);

        return response()->json(['success' => true, 'data' => $setting->fresh()]);
    }
}
