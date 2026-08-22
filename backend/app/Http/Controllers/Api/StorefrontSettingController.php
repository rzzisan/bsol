<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\StorefrontSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Storefront homepage/theme settings (Settings → Storefront). Pattern B,
 * owner-only — mirrors ShopProfileController. §0/§5.1/§12 (S0/S5) of
 * seller_storefront_context.md. Text/toggle fields go through update() as
 * JSON; banner/partner-logo/about images are separate multipart endpoints
 * (mirrors ProductGalleryManager's incremental add-one-at-a-time pattern,
 * not a monolithic form submit) — each stored image keeps an internal
 * *_path alongside the public *_url, same pair ShopProfile.logo_path/
 * logo_url uses, so removal can actually delete the file.
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
            'theme_template' => ['nullable', Rule::in([
                StorefrontSetting::THEME_STANDARD,
                StorefrontSetting::THEME_CARESOLUTION,
            ])],
            'shipping_charge_inside_dhaka' => ['nullable', 'numeric', 'min:0'],
            'shipping_charge_outside_dhaka' => ['nullable', 'numeric', 'min:0'],
            'theme_primary_color' => ['nullable', 'string', 'max:7'],
            'about_text' => ['nullable', 'string'],
            // about_image_url not accepted here — only via the dedicated
            // upload endpoint below (keeps it paired with about_image_path).
            'whatsapp_number' => ['nullable', 'string', 'max:20'],
            'show_call_button' => ['nullable', 'boolean'],
            'show_whatsapp_button' => ['nullable', 'boolean'],
            'show_messenger_button' => ['nullable', 'boolean'],
            'warranty_policy_text' => ['nullable', 'string'],
            'delivery_policy_text' => ['nullable', 'string'],
            'featured_category_ids' => ['nullable', 'array'],
            'featured_category_ids.*' => ['integer'],
            // banner_images/partner_logos are NOT accepted here on purpose —
            // each entry carries an internal image_path (for file cleanup on
            // removal) that a generic JSON round-trip would silently drop.
            // They're managed only through the dedicated upload/remove
            // endpoints below.
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

    public function uploadBanner(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
            'link_url' => ['nullable', 'url', 'max:500'],
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::firstOrNew(['user_id' => $ownerId]);
        $settings->user_id = $ownerId;

        $path = $request->file('image')->store('storefront/' . $ownerId . '/banners', 'public');
        $banners = $settings->banner_images ?? [];
        $banners[] = [
            'image_url' => Storage::disk('public')->url($path),
            'image_path' => $path,
            'link_url' => $data['link_url'] ?? null,
        ];
        $settings->banner_images = $banners;
        $settings->save();

        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function removeBanner(int $index): JsonResponse
    {
        return $this->removeImageAt('banner_images', $index);
    }

    public function uploadPartnerLogo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'link_url' => ['nullable', 'url', 'max:500'],
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::firstOrNew(['user_id' => $ownerId]);
        $settings->user_id = $ownerId;

        $path = $request->file('image')->store('storefront/' . $ownerId . '/partners', 'public');
        $logos = $settings->partner_logos ?? [];
        $logos[] = [
            'image_url' => Storage::disk('public')->url($path),
            'image_path' => $path,
            'link_url' => $data['link_url'] ?? null,
        ];
        $settings->partner_logos = $logos;
        $settings->save();

        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function removePartnerLogo(int $index): JsonResponse
    {
        return $this->removeImageAt('partner_logos', $index);
    }

    public function uploadAboutImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::firstOrNew(['user_id' => $ownerId]);
        $settings->user_id = $ownerId;

        if ($settings->about_image_path) {
            Storage::disk('public')->delete($settings->about_image_path);
        }

        $path = $request->file('image')->store('storefront/' . $ownerId . '/about', 'public');
        $settings->about_image_url = Storage::disk('public')->url($path);
        $settings->about_image_path = $path;
        $settings->save();

        return response()->json(['success' => true, 'data' => $settings]);
    }

    public function removeAboutImage(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::where('user_id', $ownerId)->firstOrFail();

        if ($settings->about_image_path) {
            Storage::disk('public')->delete($settings->about_image_path);
        }
        $settings->about_image_url = null;
        $settings->about_image_path = null;
        $settings->save();

        return response()->json(['success' => true, 'data' => $settings]);
    }

    /** @param 'banner_images'|'partner_logos' $field */
    private function removeImageAt(string $field, int $index): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $settings = StorefrontSetting::where('user_id', $ownerId)->firstOrFail();

        $items = $settings->{$field} ?? [];
        if (isset($items[$index])) {
            if (! empty($items[$index]['image_path'])) {
                Storage::disk('public')->delete($items[$index]['image_path']);
            }
            unset($items[$index]);
            $settings->{$field} = array_values($items);
            $settings->save();
        }

        return response()->json(['success' => true, 'data' => $settings]);
    }
}
