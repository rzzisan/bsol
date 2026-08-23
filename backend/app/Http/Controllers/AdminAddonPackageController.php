<?php

namespace App\Http\Controllers;

use App\Models\AddonPackage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Super-admin CRUD for add-on packages — subscription_billing_context.md
 * §9.4. Mirrors AdminController::{list,create,update,delete}Package.
 * `type` is restricted to AddonPackage::CREATABLE_TYPES — see that
 * constant's docblock for why the other reserved type strings aren't
 * acceptable here yet.
 */
class AdminAddonPackageController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'packages' => AddonPackage::latest()->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        // quantity/duration_days only mean something for order_credit
        // (how many credits, how long they last) — storefront is a binary
        // unlock, co-terminous with the main plan, so it has neither
        // (StorefrontAddonService derives its own validity from
        // subscription_ends_at, not from this package).
        $validated = $request->validate([
            'type' => ['required', Rule::in(AddonPackage::CREATABLE_TYPES)],
            'name' => ['required', 'string', 'max:255'],
            'price' => ['required', 'numeric', 'min:0'],
            'quantity' => [Rule::requiredIf($request->input('type') === 'order_credit'), 'nullable', 'integer', 'min:1'],
            'duration_days' => [Rule::requiredIf($request->input('type') === 'order_credit'), 'nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $package = AddonPackage::create($validated);

        return response()->json([
            'message' => 'Add-on package created successfully.',
            'package' => $package,
        ], 201);
    }

    public function update(Request $request, AddonPackage $addonPackage): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'quantity' => ['sometimes', 'required', 'integer', 'min:1'],
            'duration_days' => ['sometimes', 'required', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        // type is deliberately immutable after creation — changing what a
        // package *is* out from under existing purchase history would be
        // confusing; make a new package instead.
        $addonPackage->update($validated);

        return response()->json([
            'message' => 'Add-on package updated successfully.',
            'package' => $addonPackage,
        ]);
    }

    public function destroy(AddonPackage $addonPackage): JsonResponse
    {
        $addonPackage->delete();

        return response()->json(['message' => 'Add-on package deleted.']);
    }
}
