<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\PaymentGatewayCredential;
use App\Models\Product;
use App\Services\StorefrontOrderService;
use App\Support\CheckoutFieldResolver;
use App\Support\LandingPageResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Storefront cart checkout. seller_storefront_context.md §6/§12 (S3, S3b).
 *
 * Online payment (wallet_manual + gateway_auto) added in S3b —
 * StorefrontPaymentController reuses OnlinePaymentService as-is (it was
 * already Order-based, not landing-page-specific) for channel listing,
 * gateway initiate, and wallet-claim submission. Same COD-blocked-for-
 * digital rule as landing-page checkout — see the guard below.
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
                'shipping_location' => ['nullable', Rule::in(['inside_dhaka', 'outside_dhaka'])],
                'customer_email' => ['nullable', 'email', 'max:255'],
                'payment_method' => ['nullable', Rule::in(array_merge(['cod', 'bkash', 'nagad', 'rocket'], PaymentGatewayCredential::PROVIDERS))],
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

        // COD makes no sense for digital products — no courier to collect
        // cash against. Same rule as landing-page checkout
        // (digital_product_context.md §4); an online payment channel is now
        // available (S3b) so this only blocks COD specifically, not every
        // digital-cart checkout.
        if ($productTypes->first() === Product::TYPE_DIGITAL && ($validated['payment_method'] ?? 'cod') === 'cod') {
            $message = 'ডিজিটাল প্রোডাক্টে ক্যাশ অন ডেলিভারি পাওয়া যাবে না — অনলাইনে পেমেন্ট করুন।';
            return response()->json(['success' => false, 'message' => $message, 'errors' => ['payment_method' => [$message]]], 422);
        }

        // A digital-only cart needs an email whenever any item has 'email'
        // configured as a delivery channel — same rule as landing-page
        // checkout (digital_product_context.md §3).
        if ($productTypes->first() === Product::TYPE_DIGITAL) {
            $needsEmail = $lineItems->contains(function ($item) use ($products) {
                $channels = $products->get((int) $item['product_id'])?->digital_delivery_channels ?? [];
                return in_array('email', (array) $channels, true);
            });

            if ($needsEmail && blank($validated['customer_email'] ?? null)) {
                $message = 'এই ডিজিটাল প্রোডাক্টটি পেতে একটি ইমেইল ঠিকানা প্রয়োজন।';
                return response()->json(['success' => false, 'message' => $message, 'errors' => ['customer_email' => [$message]]], 422);
            }
        }

        // shipping_location (when sent) overrides any raw shipping_charge
        // with the seller's own configured rate — never trust a client-
        // supplied amount when we can resolve it server-side ourselves.
        if (! empty($validated['shipping_location'])) {
            $storefront = \App\Models\StorefrontSetting::where('user_id', $ownerId)->first();
            $validated['shipping_charge'] = $storefront
                ? $storefront->shippingChargeFor($validated['shipping_location'])
                : (
                    $validated['shipping_location'] === 'outside_dhaka'
                        ? \App\Models\StorefrontSetting::DEFAULT_SHIPPING_OUTSIDE_DHAKA
                        : \App\Models\StorefrontSetting::DEFAULT_SHIPPING_INSIDE_DHAKA
                );
        }

        $order = app(StorefrontOrderService::class)->create($ownerId, $shopUserIds, $validated, $lineItems, $products->all());

        // Checkout is same-origin on the seller's own subdomain, so Meta's
        // own cookies (set by the base pixel code loaded earlier this
        // visit) are directly readable here — mirrors
        // LandingPageController::publicSubmitOrder(). SendFacebookCapiPurchaseEventJob
        // reads these two columns directly, not the request. See S9,
        // seller_storefront_context.md §12.
        $order->update([
            'fbp' => $request->cookie('_fbp'),
            'fbc' => $request->cookie('_fbc'),
        ]);

        // SendFacebookCapiPurchaseEventJob is source-agnostic under the hood
        // (resolves the seller's tracking_destinations from Order.user_id,
        // never assumed landing_page) — same dispatch call landing-page
        // checkout already uses, no job changes needed.
        \App\Jobs\SendFacebookCapiPurchaseEventJob::dispatch(
            $order->id,
            $request->ip(),
            $request->userAgent(),
            \App\Support\FrontendUrl::forUserPath($order->user, "order/{$order->public_token}"),
        );

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
                // id is not sensitive — landing-page thank-you pages already
                // carry it in the URL (?order={id}&token=...) — needed here
                // for the Purchase pixel/CAPI event_id (S9, "order_{id}",
                // matching SendFacebookCapiPurchaseEventJob's own id so
                // browser/server dedupe against each other).
                'id' => $order->id,
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
                    'product_id' => $item->product_id,
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
