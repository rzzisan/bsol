<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\StorefrontSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Storefront homepage/theme settings (Settings → Storefront). Pattern B,
 * owner-only — mirrors ShopProfileController. §0/§5.1/§12 (S0) of
 * seller_storefront_context.md. Theme/banner fields accepted here now so
 * one migration covers the whole table, but the dashboard UI for most of
 * them ships in S5 — only homepage_mode is wired to a UI in S0.
 */
class StorefrontSettingController extends Controller
{
    public function show(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::firstOrNew(['user_id' => $ownerId]);

        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'homepage_mode' => ['required', Rule::in([
                StorefrontSetting::HOMEPAGE_STOREFRONT,
                StorefrontSetting::HOMEPAGE_LANDING_PAGE,
            ])],
            'homepage_landing_page_id' => ['nullable', 'integer'],
            'theme_primary_color' => ['nullable', 'string', 'max:7'],
            'about_text' => ['nullable', 'string'],
            'about_image_url' => ['nullable', 'string', 'max:500'],
            'whatsapp_number' => ['nullable', 'string', 'max:20'],
            'show_call_button' => ['nullable', 'boolean'],
            'show_whatsapp_button' => ['nullable', 'boolean'],
            'show_messenger_button' => ['nullable', 'boolean'],
            'warranty_policy_text' => ['nullable', 'string'],
            'delivery_policy_text' => ['nullable', 'string'],
            'banner_images' => ['nullable', 'array'],
            'banner_images.*.image_url' => ['required_with:banner_images', 'string', 'max:500'],
            'banner_images.*.link_url' => ['nullable', 'string', 'max:500'],
            'featured_category_ids' => ['nullable', 'array'],
            'featured_category_ids.*' => ['integer'],
            'partner_logos' => ['nullable', 'array'],
            'partner_logos.*.image_url' => ['required_with:partner_logos', 'string', 'max:500'],
            'partner_logos.*.link_url' => ['nullable', 'string', 'max:500'],
        ]);

        $ownerId = auth()->user()->shopOwnerId();

        if (($data['homepage_mode'] ?? null) === StorefrontSetting::HOMEPAGE_LANDING_PAGE) {
            $pageId = $data['homepage_landing_page_id'] ?? null;

            if (! $pageId) {
                throw ValidationException::withMessages([
                    'homepage_landing_page_id' => ['A landing page must be selected for this homepage mode.'],
                ]);
            }

            // Pattern A ownership check — a landing page created by any
            // staff of this shop is a valid pick, not just the owner's own.
            $page = LandingPage::whereIn('user_id', auth()->user()->shopUserIds())
                ->findOrFail($pageId);

            if ($page->status !== 'published') {
                throw ValidationException::withMessages([
                    'homepage_landing_page_id' => ['Only a published landing page can be set as the homepage.'],
                ]);
            }
        } else {
            $data['homepage_landing_page_id'] = null;
        }

        $settings = StorefrontSetting::firstOrNew(['user_id' => $ownerId]);
        $settings->fill($data);
        $settings->user_id = $ownerId;
        $settings->save();

        return response()->json(['success' => true, 'data' => $settings]);
    }
}
