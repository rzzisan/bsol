<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Services\StorefrontOrderService;
use App\Support\CheckoutFieldResolver;
use App\Support\LandingPageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Storefront cart checkout. seller_storefront_context.md §6/§12 (S3).
 *
 * COD-only for now, deliberately: the online-payment channels
 * (OnlinePaymentController's wallet-claim/gateway-initiate flow) are tied
 * to a landing page ({slug} in the URL, page-level channel config) —
 * generalizing that whole surface to be storefront-compatible is a
 * separate, larger pass (its own S3b), not bundled into this one. A
 * digital-only cart therefore can't check out here yet either, since COD
 * is blocked for digital products (no online-payment option exists to
 * fall back to) — see the digital-only-cart guard below.
 */
class StorefrontCheckoutController extends Controller
{
    public function submitOrder(Request $request): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $ownerId = $label === null ? null : LandingPageResolver::shopOwnerIdForLabel($label);
        $shopUserIds = $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);

        if ($shopUserIds === null || $ownerId === null) {
            return response()->json(['success' => false, 'message' => 'Unknown shop.'], 404);
        }

        $resolvedFields = CheckoutFieldResolver::resolve(null);

        $validated = $request->validate(array_merge(
            CheckoutFieldResolver::buildRules($resolvedFields, true),
            [
                'shipping_charge' => ['nullable', 'numeric', 'min:0'],
                'customer_email' => ['nullable', 'email', 'max:255'],
                'items' => ['required', 'array', 'min:1'],
                'items.*.product_id' => ['required', 'integer'],
                'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
                'items.*.product_variant_id' => ['nullable', 'integer'],
            ],
        ));

        // Only products actually visible on this shop's storefront can be
        // ordered here — a guessed/hidden/cross-shop product id is dropped
        // silently, same defensive stance as LandingPageController's
        // $landingProducts->has() filter.
        $productIds = collect($validated['items'])->pluck('product_id')->unique()->values();
        $products = Product::whereIn('user_id', $shopUserIds)
            ->whereIn('id', $productIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->get()
            ->keyBy('id');

        $lineItems = collect($validated['items'])->filter(fn ($item) => $products->has((int) $item['product_id']))->values();

        if ($lineItems->isEmpty()) {
            $message = 'Please select at least one valid product.';
            return response()->json(['success' => false, 'message' => $message, 'errors' => ['items' => [$message]]], 422);
        }

        // Mixed cart block — same rule as landing-page checkout, see
        // digital_product_context.md §5.
        $productTypes = $lineItems
            ->map(fn ($item) => $products->get((int) $item['product_id'])?->product_type ?? Product::TYPE_PHYSICAL)
            ->unique();

        if ($productTypes->count() > 1) {
            $message = 'ডিজিটাল ও ফিজিকাল প্রোডাক্ট একসাথে অর্ডার করা যাবে না — আলাদাভাবে চেকআউট করুন।';
            return response()->json(['success' => false, 'message' => $message, 'errors' => ['items' => [$message]]], 422);
        }

        // COD-only checkout (see class docblock) means a digital-only cart
        // has nothing to pay with yet — block it here with an explicit
        // reason rather than silently accepting an order that can never be
        // paid/delivered.
        if ($productTypes->first() === Product::TYPE_DIGITAL) {
            $message = 'ডিজিটাল প্রোডাক্ট এই মুহূর্তে স্টোরফ্রন্ট থেকে অনলাইন পেমেন্ট ছাড়া কেনা যাচ্ছে না — শীঘ্রই আসছে।';
            return response()->json(['success' => false, 'message' => $message, 'errors' => ['items' => [$message]]], 422);
        }

        $order = app(StorefrontOrderService::class)->create($ownerId, $shopUserIds, $validated, $lineItems, $products->all());

        return response()->json([
            'success' => true,
            'message' => 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে। শিগগিরই আমাদের প্রতিনিধি যোগাযোগ করবে।',
            'data' => [
                'order_number' => $order->order_number,
                'public_token' => $order->public_token,
                'subtotal' => $order->subtotal,
                'shipping_charge' => $order->shipping_charge,
                'total' => $order->total,
            ],
        ], 201);
    }

    /** GET /public/storefront/orders/{token} — thank-you page lookup. */
    public function showOrder(Request $request, string $token): JsonResponse
    {
        $shopUserIds = $this->shopUserIds($request);
        if ($shopUserIds === null) {
            abort(404);
        }

        // Token-in-URL (not id+token) lookup — same pattern as
        // DigitalDeliveryController::findByToken(): the token column is
        // itself the lookup key (unique, random 40 chars), so a direct
        // where() is the right shape here (unlike publicShowOrder's
        // id-then-hash_equals, which exists because that route carries a
        // separate id + token pair).
        $order = Order::query()
            ->with('items')
            ->whereIn('user_id', $shopUserIds)
            ->where('source', 'storefront')
            ->where('public_token', $token)
            ->first();

        if (! $order) {
            abort(404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $order->order_number,
                'created_at' => $order->created_at,
                'status' => $order->status,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_address' => $order->customer_address,
                'subtotal' => $order->subtotal,
                'shipping_charge' => $order->shipping_charge,
                'discount' => $order->discount,
                'total' => $order->total,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total' => $item->total,
                ])->values(),
            ],
        ]);
    }

    /** @return array<int, int>|null */
    private function shopUserIds(Request $request): ?array
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        return $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
    }
}
