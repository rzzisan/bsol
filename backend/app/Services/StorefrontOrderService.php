<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\PhoneIntelCache;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Creates an Order from a storefront cart submission. A deliberate
 * near-duplicate of LandingPageOrderService rather than a shared base —
 * same reasoning as DigitalDeliveryService's docblock (this codebase's
 * established preference for small per-feature duplication over cross-
 * feature coupling): the two have a different source of line-item pricing
 * (a landing page's price_override/attached-product pivot vs. the
 * product's own price directly) and no landing_page_visits conversion
 * tracking applies here.
 *
 * seller_storefront_context.md §6/§12 (S3, S3b — payment_method is
 * whatever the checkout validated, COD or an online channel).
 */
class StorefrontOrderService
{
    /**
     * @param array<int, int> $shopUserIds
     * @param Collection<int, array<string, mixed>> $lineItems validated items:
     *   product_id, quantity, product_variant_id?
     * @param array<int, Product> $products keyed by product_id — already
     *   fetched + shop/status/visibility-checked by the caller
     */
    public function create(int $shopOwnerId, array $shopUserIds, array $validated, Collection $lineItems, array $products): Order
    {
        return DB::transaction(function () use ($shopOwnerId, $shopUserIds, $validated, $lineItems, $products) {
            $subtotal = 0;
            // See LandingPageOrderService::create() — held while expired.
            $held = app(HeldOrderService::class)->ownerIsLapsed($shopOwnerId);

            $order = Order::create([
                'user_id' => $shopOwnerId,
                'order_number' => Order::generateOrderNumber($shopUserIds),
                'public_token' => Str::random(40),
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'customer_email' => $validated['customer_email'] ?? null,
                'customer_address' => $validated['customer_address'],
                'customer_district' => $validated['customer_district'] ?? null,
                'customer_thana' => $validated['customer_thana'] ?? null,
                'customer_area' => $validated['customer_area'] ?? null,
                'source' => 'storefront',
                'source_ref' => null,
                'status' => 'pending',
                'payment_method' => $held ? 'cod' : ($validated['payment_method'] ?? 'cod'),
                'payment_status' => 'due',
                'shipping_charge' => (float) ($validated['shipping_charge'] ?? 0),
                'discount' => 0,
                'subtotal' => 0,
                'total' => 0,
                'notes' => $validated['notes'] ?? null,
                'fraud_score' => 0,
                'risk_level' => 'low',
            ]);

            if ($held) {
                app(HeldOrderService::class)->hold($order);
            }

            foreach ($lineItems as $item) {
                $productId = (int) $item['product_id'];
                $qty = (int) $item['quantity'];
                $product = $products[$productId] ?? null;
                if (! $product) {
                    continue;
                }

                $variant = null;
                if (! empty($item['product_variant_id'])) {
                    $variant = ProductVariant::query()
                        ->where('id', (int) $item['product_variant_id'])
                        ->where('product_id', $productId)
                        ->where('is_active', true)
                        ->first();
                }

                $regularPrice = (float) ($variant?->regular_price ?? $product->regular_price ?? $product->selling_price ?? 0);
                $discount = (float) ($variant?->discount ?? $product->discount ?? 0);
                $discountType = (string) ($variant?->discount_type ?? $product->discount_type ?? 'amount');
                $unitPrice = (float) ($variant?->selling_price ?? $product->selling_price ?? 0);
                $lineTotal = $unitPrice * $qty;
                $subtotal += $lineTotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'product_name' => $product->name,
                    'sku' => $variant?->sku ?? $product->sku,
                    'quantity' => $qty,
                    'regular_price' => $regularPrice,
                    'discount' => $discount,
                    'discount_type' => $discountType,
                    'unit_price' => $unitPrice,
                    'total' => $lineTotal,
                    'variant_info' => null,
                ]);
            }

            $shipping = (float) $order->shipping_charge;
            $order->update([
                'subtotal' => $subtotal,
                'total' => max(0, $subtotal + $shipping),
            ]);

            OrderStatusLog::create([
                'order_id' => $order->id,
                'old_status' => null,
                'new_status' => 'pending',
                'note' => 'Order created from storefront.',
                'changed_by' => null,
            ]);

            if (! $held) {
                Customer::syncFromOrder($order);
                PhoneIntelCache::bump($order->customer_phone);

                $accounting = app(AccountingService::class);
                $accounting->onOrderCreated($order);
                $accounting->onCourierChargeUpdated($order);
            }

            return $order->fresh(['items']);
        });
    }
}
