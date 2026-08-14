<?php

namespace App\Services;

use App\Models\AbandonedCheckout;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\ProductVariant;

class AbandonedCheckoutService
{
    /**
     * Upsert the in-progress checkout snapshot for this browsing session.
     * Requires $page->products.product and $page->products.variant.optionValues.option
     * to already be eager-loaded (caller's responsibility).
     */
    public function capture(LandingPage $page, array $data, ?string $ip): AbandonedCheckout
    {
        $checkout = AbandonedCheckout::query()
            ->where('landing_page_id', $page->id)
            ->where('session_token', $data['session_token'])
            ->first();

        // Already converted/dismissed — don't resurrect it with stale form input
        // from a tab the visitor never closed.
        if ($checkout && $checkout->status !== 'active') {
            return $checkout;
        }

        $items = $this->snapshotItems($page, $data['items'] ?? []);
        $subtotal = collect($items)->sum(fn (array $item) => $item['unit_price'] * $item['quantity']);

        $attributes = [
            'user_id' => $page->user_id,
            'customer_name' => $data['customer_name'] ?? null,
            'customer_phone' => $data['customer_phone'] ?? null,
            'customer_email' => $data['customer_email'] ?? null,
            'customer_address' => $data['customer_address'] ?? null,
            'customer_district' => $data['customer_district'] ?? null,
            'customer_thana' => $data['customer_thana'] ?? null,
            'customer_area' => $data['customer_area'] ?? null,
            'notes' => $data['notes'] ?? null,
            'custom_fields' => $data['custom_fields'] ?? null,
            'items' => $items,
            'subtotal' => $subtotal,
            'ip_address' => $ip,
            'status' => 'active',
            'last_activity_at' => now(),
        ];

        if ($checkout) {
            $checkout->update($attributes);

            return $checkout;
        }

        return AbandonedCheckout::create(array_merge($attributes, [
            'landing_page_id' => $page->id,
            'session_token' => $data['session_token'],
        ]));
    }

    public function resume(LandingPage $page, string $token): ?AbandonedCheckout
    {
        return AbandonedCheckout::query()
            ->where('landing_page_id', $page->id)
            ->where('session_token', $token)
            ->first();
    }

    /**
     * Called right after a real order is created — marks the matching
     * in-progress checkout(s) as converted instead of leaving them stuck as
     * "abandoned" forever. Session-token match is tried first (exact, single
     * row); phone match is the fallback for cross-device/cross-tab completion.
     */
    public function convertMatching(LandingPage $page, Order $order, ?string $sessionToken, ?string $phone): void
    {
        if ($sessionToken) {
            $updated = AbandonedCheckout::query()
                ->where('landing_page_id', $page->id)
                ->where('user_id', $page->user_id)
                ->active()
                ->where('session_token', $sessionToken)
                ->update(['status' => 'converted', 'order_id' => $order->id]);

            if ($updated > 0) {
                return;
            }
        }

        if ($phone) {
            AbandonedCheckout::query()
                ->where('landing_page_id', $page->id)
                ->where('user_id', $page->user_id)
                ->active()
                ->where('customer_phone', $phone)
                ->update(['status' => 'converted', 'order_id' => $order->id]);
        }
    }

    /**
     * Merchant-driven edit from the dashboard detail page — only touches keys
     * actually present in $data, so a status-only PATCH (dismiss/reactivate)
     * doesn't clobber the captured snapshot, and vice versa.
     */
    public function applyEdit(AbandonedCheckout $checkout, array $data): AbandonedCheckout
    {
        $attributes = array_intersect_key($data, array_flip([
            'customer_name',
            'customer_phone',
            'customer_email',
            'customer_address',
            'customer_district',
            'customer_thana',
            'customer_area',
            'notes',
            'custom_fields',
            'status',
            'order_id',
        ]));

        if (array_key_exists('items', $data)) {
            // Dashboard edit form only sends the items it wants kept — treat
            // every entry as enabled (unlike the public capture payload, which
            // sends the full product list with an explicit enabled flag).
            $rawItems = array_map(fn (array $item) => array_merge($item, ['enabled' => true]), $data['items'] ?? []);
            $items = $this->snapshotItems($checkout->landingPage, $rawItems);
            $attributes['items'] = $items;
            $attributes['subtotal'] = collect($items)->sum(fn (array $item) => $item['unit_price'] * $item['quantity']);
        }

        $checkout->update($attributes);

        return $checkout;
    }

    // ── WooCommerce (Phase 17) ──────────────────────────────────────────────
    // Additive, not a generalization of the landing-page methods above —
    // those resolve items through $page->products (landing-page catalog
    // pivot: pinned variants, price overrides), a concept that doesn't exist
    // for WooCommerce. A WC cart line is already fully resolved (name/sku/
    // price) by the plugin from real WC_Cart data, so it's trusted as-is
    // here rather than re-resolved against BSOL's own catalog.

    /**
     * Upsert the in-progress WooCommerce checkout snapshot for this browsing
     * session, scoped by the specific connected site (platform_api_key_id)
     * rather than landing_page_id — two different sites' checkout sessions
     * must never collide just because a session-key generator produced the
     * same value twice (same reasoning as Order/Product's Phase 16 scoping).
     */
    public function captureWooCommerce(int $userId, ?int $platformApiKeyId, array $data, ?string $ip): AbandonedCheckout
    {
        $checkout = AbandonedCheckout::query()
            ->where('platform_api_key_id', $platformApiKeyId)
            ->where('source', 'woocommerce')
            ->where('session_token', $data['session_token'])
            ->first();

        // Already converted/dismissed — don't resurrect it with stale form
        // input from a tab the visitor never closed.
        if ($checkout && $checkout->status !== 'active') {
            return $checkout;
        }

        $items = $data['items'] ?? [];
        $subtotal = collect($items)->sum(fn (array $item) => ($item['unit_price'] ?? 0) * ($item['quantity'] ?? 1));

        $attributes = [
            'user_id' => $userId,
            'customer_name' => $data['customer_name'] ?? null,
            'customer_phone' => $data['customer_phone'] ?? null,
            'customer_email' => $data['customer_email'] ?? null,
            'customer_address' => $data['customer_address'] ?? null,
            'items' => $items,
            'subtotal' => $subtotal,
            'ip_address' => $ip,
            'status' => 'active',
            'last_activity_at' => now(),
        ];

        if ($checkout) {
            $checkout->update($attributes);

            return $checkout;
        }

        return AbandonedCheckout::create(array_merge($attributes, [
            'source' => 'woocommerce',
            'platform_api_key_id' => $platformApiKeyId,
            'session_token' => $data['session_token'],
        ]));
    }

    /**
     * Called right after a real WooCommerce-synced order is created — marks
     * the matching in-progress checkout(s) as converted instead of leaving
     * them stuck as "abandoned" forever. Session-token match is tried first
     * (exact, single row, if the plugin forwarded one); phone match is the
     * fallback for cross-device/cross-tab completion or an older plugin
     * version that doesn't send a session_token yet.
     */
    public function convertMatchingWooCommerce(int $userId, ?int $platformApiKeyId, Order $order, ?string $sessionToken, ?string $phone): void
    {
        if ($sessionToken) {
            $updated = AbandonedCheckout::query()
                ->where('platform_api_key_id', $platformApiKeyId)
                ->where('user_id', $userId)
                ->where('source', 'woocommerce')
                ->active()
                ->where('session_token', $sessionToken)
                ->update(['status' => 'converted', 'order_id' => $order->id]);

            if ($updated > 0) {
                return;
            }
        }

        if ($phone) {
            AbandonedCheckout::query()
                ->where('platform_api_key_id', $platformApiKeyId)
                ->where('user_id', $userId)
                ->where('source', 'woocommerce')
                ->active()
                ->where('customer_phone', $phone)
                ->update(['status' => 'converted', 'order_id' => $order->id]);
        }
    }

    public function snapshotItems(LandingPage $page, array $rawItems): array
    {
        $landingProducts = $page->products->keyBy('product_id');

        return collect($rawItems)
            ->filter(fn ($item) => !empty($item['enabled']) && isset($item['product_id']) && $landingProducts->has((int) $item['product_id']))
            ->map(function (array $item) use ($landingProducts) {
                $landingProduct = $landingProducts->get((int) $item['product_id']);
                $product = $landingProduct->product;

                // Merchant-pinned variant (attach mode 2) always wins over
                // whatever the customer's browser sent; otherwise trust the
                // customer's own in-page selection (attach mode 1), validated
                // against this exact product so a stray/foreign id can't
                // spoof a different variant's price into the snapshot.
                $variant = $landingProduct->variant;
                if (!$variant && !empty($item['product_variant_id'])) {
                    $variant = ProductVariant::query()
                        ->where('id', (int) $item['product_variant_id'])
                        ->where('product_id', (int) $item['product_id'])
                        ->where('is_active', true)
                        ->with('optionValues.option')
                        ->first();
                }

                $variantLabel = null;
                if ($variant) {
                    $variantLabel = $variant->relationLoaded('optionValues')
                        ? $variant->optionValues->map(fn ($ov) => $ov->label ?: $ov->value)->filter()->implode(' / ')
                        : null;
                }

                return [
                    'product_id' => (int) $item['product_id'],
                    'product_variant_id' => $variant?->id,
                    'variant_label' => $variantLabel ?: null,
                    'name' => $landingProduct->title_override ?: ($product?->name ?? 'Product'),
                    'sku' => $variant?->sku ?? $product?->sku ?? null,
                    'image' => $variant?->image_url ?? $product?->thumbnail ?? null,
                    'quantity' => max(1, (int) ($item['quantity'] ?? 1)),
                    'unit_price' => (float) ($landingProduct->price_override ?? $variant?->selling_price ?? $product?->selling_price ?? 0),
                ];
            })
            ->values()
            ->all();
    }
}
