<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Shop identity/branding settings (Settings → Shop Profile). Pattern B,
 * owner-only — see ShopProfile model doc. Read here powers the dashboard
 * settings form; WaybillPdfService reads the model directly (not via this
 * controller) for the courier label's FROM/sender block.
 */
class ShopProfileController extends Controller
{
    public function show(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $profile = ShopProfile::firstOrNew(['user_id' => $ownerId]);

        if (! $profile->exists) {
            // Pre-fill (not persisted) from the account itself so the form
            // isn't blank for a shop that hasn't set this up yet. A brand
            // new (unsaved) model doesn't pick up the DB column defaults on
            // its own, so the sticker toggles need to be set explicitly too.
            $owner = auth()->user()->shopOwner();
            $profile->shop_name = $owner->name;
            $profile->phone = $owner->mobile;
            $profile->show_phone_on_sticker = true;
            $profile->show_address_on_sticker = true;
        }

        return response()->json(['success' => true, 'data' => $profile]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_name'   => 'required|string|max:150',
            'phone'       => 'required|string|max:20',
            'email'       => 'nullable|email|max:150',
            'address'     => 'required|string|max:500',
            'logo'        => 'nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
            'remove_logo' => 'nullable|boolean',
            'show_phone_on_sticker'   => 'nullable|boolean',
            'show_address_on_sticker' => 'nullable|boolean',
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $profile = ShopProfile::firstOrNew(['user_id' => $ownerId]);
        $profile->shop_name = $data['shop_name'];
        $profile->phone     = $data['phone'];
        $profile->email     = $data['email'] ?? null;
        $profile->address   = $data['address'];
        // Multipart form always sends these (frontend always includes them),
        // but default to true (existing behavior) if a caller omits them.
        $profile->show_phone_on_sticker   = $request->has('show_phone_on_sticker')
            ? $request->boolean('show_phone_on_sticker') : true;
        $profile->show_address_on_sticker = $request->has('show_address_on_sticker')
            ? $request->boolean('show_address_on_sticker') : true;

        if ($request->boolean('remove_logo') && $profile->logo_path) {
            Storage::disk('public')->delete($profile->logo_path);
            $profile->logo_path = null;
            $profile->logo_url  = null;
        }

        if ($request->hasFile('logo')) {
            if ($profile->logo_path) {
                Storage::disk('public')->delete($profile->logo_path);
            }
            $path = $request->file('logo')->store('shop-logos/' . $ownerId, 'public');
            $profile->logo_path = $path;
            $profile->logo_url  = Storage::disk('public')->url($path);
        }

        $profile->user_id = $ownerId;
        $profile->save();

        return response()->json(['success' => true, 'data' => $profile]);
    }
}
