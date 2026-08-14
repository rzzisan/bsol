<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopProfile;
use App\Models\SubdomainTombstone;
use App\Support\SubdomainPolicy;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

    /**
     * Live availability check for the Shop Profile subdomain field.
     *
     * Advisory only — the answer can go stale between this call and the
     * save, so setSubdomain() re-checks and relies on the DB unique index as
     * the real arbiter (custom_domain_context.md §5.5).
     */
    public function checkSubdomain(Request $request): JsonResponse
    {
        $label = SubdomainPolicy::normalize($request->query('label'));
        $reason = SubdomainPolicy::rejectionReason($label, auth()->user()->shopOwnerId());

        return response()->json([
            'success' => true,
            'data' => [
                'label' => $label,
                'available' => $reason === null,
                'reason' => $reason,
                'host' => $reason === null && $label
                    ? $label . '.' . config('app.subdomain_apex')
                    : null,
            ],
        ]);
    }

    /**
     * Claim or change the shop's subdomain. Changing one tombstones the old
     * label permanently so no other seller can inherit its traffic — see
     * SubdomainTombstone.
     */
    public function setSubdomain(Request $request): JsonResponse
    {
        $request->validate(['label' => 'required|string|max:100']);

        $ownerId = auth()->user()->shopOwnerId();
        $label = SubdomainPolicy::normalize($request->input('label'));
        $reason = SubdomainPolicy::rejectionReason($label, $ownerId);

        if ($reason !== null) {
            return response()->json([
                'success' => false,
                'message' => self::rejectionMessage($reason),
                'error_code' => $reason,
            ], 422);
        }

        $profile = ShopProfile::where('user_id', $ownerId)->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'Save your shop profile before choosing a subdomain.',
                'error_code' => 'profile_missing',
            ], 422);
        }

        if ($profile->subdomain === $label && $profile->subdomain_status === 'active') {
            return response()->json(['success' => true, 'data' => $profile]);
        }

        try {
            DB::transaction(function () use ($profile, $label, $ownerId) {
                if ($profile->subdomain && $profile->subdomain !== $label) {
                    SubdomainTombstone::firstOrCreate(
                        ['label' => $profile->subdomain],
                        ['user_id' => $ownerId, 'released_at' => now()],
                    );
                }

                $profile->update([
                    'subdomain' => $label,
                    'subdomain_status' => 'active',
                    'subdomain_set_at' => now(),
                ]);
            });
        } catch (QueryException $e) {
            // Two sellers submitting the same label at once: the unique index
            // is the arbiter, not the availability check above.
            return response()->json([
                'success' => false,
                'message' => self::rejectionMessage('taken'),
                'error_code' => 'taken',
            ], 422);
        }

        return response()->json(['success' => true, 'data' => $profile->fresh()]);
    }

    /**
     * Give up the subdomain. The label is tombstoned, never freed.
     */
    public function releaseSubdomain(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $profile = ShopProfile::where('user_id', $ownerId)->first();

        if (! $profile || ! $profile->subdomain) {
            return response()->json([
                'success' => false,
                'message' => 'No subdomain is set for this shop.',
                'error_code' => 'no_subdomain',
            ], 422);
        }

        DB::transaction(function () use ($profile, $ownerId) {
            SubdomainTombstone::firstOrCreate(
                ['label' => $profile->subdomain],
                ['user_id' => $ownerId, 'released_at' => now()],
            );

            $profile->update([
                'subdomain' => null,
                'subdomain_status' => 'none',
                'subdomain_set_at' => null,
            ]);
        });

        return response()->json(['success' => true, 'data' => $profile->fresh()]);
    }

    /**
     * Public host resolver used by the Next.js middleware to decide whether
     * {label}.{apex} belongs to a real shop (custom_domain_context.md §4.1).
     *
     * Deliberately minimal: branding only, no user_id and nothing that isn't
     * already visible on the seller's own public pages.
     */
    public function publicResolveSubdomain(string $label): JsonResponse
    {
        $profile = ShopProfile::where('subdomain', SubdomainPolicy::normalize($label))
            ->where('subdomain_status', 'active')
            ->first();

        if (! $profile) {
            return response()->json([
                'success' => false,
                'message' => 'Unknown subdomain.',
                'error_code' => 'subdomain_not_found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'subdomain' => $profile->subdomain,
                'shop_name' => $profile->shop_name,
                'logo_url' => $profile->logo_url,
            ],
        ]);
    }

    private static function rejectionMessage(string $reason): string
    {
        return match ($reason) {
            'too_short' => 'Subdomain must be at least ' . SubdomainPolicy::MIN_LENGTH . ' characters.',
            'too_long' => 'Subdomain must be at most ' . SubdomainPolicy::MAX_LENGTH . ' characters.',
            'invalid_format' => 'Use lowercase letters, numbers and single hyphens only, starting and ending with a letter or number.',
            'reserved' => 'This subdomain is reserved and cannot be used.',
            'taken' => 'This subdomain is already taken.',
            default => 'This subdomain cannot be used.',
        };
    }
}
