<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\LandingPage;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\ProductVariant;
use App\Support\PhoneIntelCache;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LandingPageOrderService
{
    public function create(LandingPage $page, array $validated, Collection $lineItems): Order
    {
        return DB::transaction(function () use ($page, $validated, $lineItems) {
            $userId = $page->user_id;
            $subtotal = 0;
            $landingProducts = $page->products->keyBy('product_id');

            $order = Order::create([
                'user_id' => $userId,
                'order_number' => Order::generateOrderNumber($userId),
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'customer_address' => $validated['customer_address'],
                'customer_district' => $validated['customer_district'] ?? null,
                'customer_thana' => $validated['customer_thana'] ?? null,
                'customer_area' => $validated['customer_area'] ?? null,
                'source' => 'landing_page',
                'source_ref' => (string) $page->id,
                'status' => 'pending',
                'payment_method' => 'cod',
                'payment_status' => 'due',
                'shipping_charge' => (float) ($validated['shipping_charge'] ?? data_get($page->content, 'shipping.inside_dhaka', 80)),
                'discount' => 0,
                'subtotal' => 0,
                'total' => 0,
                'notes' => $validated['notes'] ?? null,
                'fraud_score' => 0,
                'risk_level' => 'low',
            ]);

            foreach ($lineItems as $item) {
                $productId = (int) $item['product_id'];
                $qty = (int) $item['quantity'];

                $landingProduct = $landingProducts->get($productId);
                $product = $landingProduct?->product;
                if (!$landingProduct || !$product) {
                    continue;
                }

                $variant = null;
                if (!empty($item['product_variant_id'])) {
                    $variant = ProductVariant::query()
                        ->where('id', (int) $item['product_variant_id'])
                        ->where('product_id', $productId)
                        ->where('is_active', true)
                        ->first();
                }

                $regularPrice = (float) ($variant?->regular_price ?? $product->regular_price ?? $product->selling_price ?? 0);
                $discount = (float) ($variant?->discount ?? $product->discount ?? 0);
                $discountType = (string) ($variant?->discount_type ?? $product->discount_type ?? 'amount');
                $unitPrice = (float) ($landingProduct->price_override ?? $variant?->selling_price ?? $product->selling_price ?? 0);
                $lineTotal = $unitPrice * $qty;
                $subtotal += $lineTotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_variant_id' => $variant?->id,
                    'product_name' => $landingProduct->title_override ?: $product->name,
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
            $total = max(0, $subtotal + $shipping);
            $order->update([
                'subtotal' => $subtotal,
                'total' => $total,
            ]);

            OrderStatusLog::create([
                'order_id' => $order->id,
                'old_status' => null,
                'new_status' => 'pending',
                'note' => 'Order created from landing page.',
                'changed_by' => null,
            ]);

            // Link recent visits to this order for conversion tracking
            $this->linkVisitsToOrder($order, $page);

            Customer::syncFromOrder($order);
            PhoneIntelCache::bump($order->customer_phone);

            $accounting = app(AccountingService::class);
            $accounting->onOrderCreated($order);
            $accounting->onCourierChargeUpdated($order);

            return $order->fresh(['items']);
        });
    }

    /**
     * Link recent visits to order for conversion tracking
     */
    private function linkVisitsToOrder(Order $order, LandingPage $page): void
    {
        try {
            // Get recent visits from this session (within last 30 minutes)
            $recentVisits = DB::table('landing_page_visits')
                ->where('landing_page_id', $page->id)
                ->where('created_at', '>=', now()->subMinutes(30))
                // If user is authenticated, match by user_id; otherwise match by IP
                ->when(
                    auth()->check(),
                    fn ($q) => $q->where('user_id', auth()->id()),
                    fn ($q) => $q->where('ip_address', request()->ip())
                )
                ->pluck('id');

            // Link all recent visits to this order
            foreach ($recentVisits as $visitId) {
                DB::table('landing_page_visit_orders')->insertOrIgnore([
                    'landing_page_visit_id' => $visitId,
                    'order_id' => $order->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            // Log error but don't fail order creation
            \Log::error('Failed to link visits to order', [
                'order_id' => $order->id,
                'landing_page_id' => $page->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}