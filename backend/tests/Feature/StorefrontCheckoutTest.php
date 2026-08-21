<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\ShopProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * S3 of seller_storefront_context.md — storefront cart checkout, COD-only
 * (see StorefrontCheckoutController's class docblock for why).
 */
class StorefrontCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private function apex(): string
    {
        return config('app.subdomain_apex');
    }

    private function seller(string $subdomain, string $shopName = 'Shop'): User
    {
        $user = User::factory()->create();

        ShopProfile::create([
            'user_id' => $user->id,
            'shop_name' => $shopName,
            'phone' => '01711223344',
            'address' => 'Dhaka',
            'subdomain' => $subdomain,
            'subdomain_status' => 'active',
        ]);

        return $user;
    }

    private function product(User $owner, array $attrs = []): Product
    {
        return Product::create(array_merge([
            'user_id' => $owner->id,
            'name' => 'Test Product',
            'sku' => 'SKU-' . uniqid(),
            'slug' => 'test-product-' . uniqid(),
            'description' => 'A description.',
            'regular_price' => 500,
            'discount' => 0,
            'discount_type' => 'amount',
            'selling_price' => 500,
            'cost_price' => 200,
            'stock' => 10,
            'track_stock' => true,
            'status' => 'active',
            'show_in_storefront' => true,
        ], $attrs));
    }

    private function checkoutPayload(array $items, array $overrides = []): array
    {
        return array_merge([
            'customer_name' => 'Rahim',
            'customer_phone' => '01711112222',
            'customer_address' => 'House 1, Road 2, Dhaka',
            'items' => $items,
        ], $overrides);
    }

    public function test_submits_a_cod_order_and_computes_totals(): void
    {
        $a = $this->seller('shopa');
        $p1 = $this->product($a, ['selling_price' => 500]);
        $p2 = $this->product($a, ['selling_price' => 300]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([
                ['product_id' => $p1->id, 'quantity' => 2],
                ['product_id' => $p2->id, 'quantity' => 1],
            ]),
        );

        $response->assertCreated()
            ->assertJsonPath('data.subtotal', '1300.00')
            ->assertJsonPath('data.total', '1300.00');

        $order = Order::where('order_number', $response->json('data.order_number'))->first();
        $this->assertNotNull($order);
        $this->assertSame($a->id, $order->user_id);
        $this->assertSame('storefront', $order->source);
        $this->assertSame('cod', $order->payment_method);
        $this->assertSame('pending', $order->status);
        $this->assertCount(2, $order->items);
    }

    public function test_ignores_products_from_another_shop(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');
        $mine = $this->product($a);
        $notMine = $this->product($b);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([
                ['product_id' => $mine->id, 'quantity' => 1],
                ['product_id' => $notMine->id, 'quantity' => 1],
            ]),
        );

        $response->assertCreated();
        $order = Order::where('order_number', $response->json('data.order_number'))->first();
        $this->assertCount(1, $order->items);
        $this->assertSame($mine->id, $order->items->first()->product_id);
    }

    public function test_rejects_mixed_physical_and_digital_cart(): void
    {
        $a = $this->seller('shopa');
        $physical = $this->product($a, ['product_type' => 'physical']);
        $digital = $this->product($a, [
            'product_type' => 'digital',
            'digital_delivery_type' => 'external_url',
            'digital_external_url' => 'https://example.com/file.zip',
        ]);

        $response = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([
                ['product_id' => $physical->id, 'quantity' => 1],
                ['product_id' => $digital->id, 'quantity' => 1],
            ]),
        );

        $response->assertStatus(422);
        $this->assertStringContainsString('একসাথে', $response->json('errors.items.0'));
    }

    /** payment_method defaults to 'cod' when omitted — see StorefrontPaymentTest for the online-payment path (S3b). */
    public function test_rejects_digital_cart_on_cod_default(): void
    {
        $a = $this->seller('shopa');
        $digital = $this->product($a, [
            'product_type' => 'digital',
            'digital_delivery_type' => 'external_url',
            'digital_external_url' => 'https://example.com/file.zip',
        ]);

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([['product_id' => $digital->id, 'quantity' => 1]]),
        )->assertStatus(422);
    }

    public function test_rejects_empty_items(): void
    {
        $a = $this->seller('shopa');

        $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([]),
        )->assertStatus(422);
    }

    public function test_show_order_resolves_by_token_scoped_to_shop(): void
    {
        $a = $this->seller('shopa');
        $b = $this->seller('shopb');
        $product = $this->product($a);

        $submit = $this->postJson(
            "https://shopa.{$this->apex()}/api/public/storefront/orders",
            $this->checkoutPayload([['product_id' => $product->id, 'quantity' => 1]]),
        )->assertCreated();

        $token = $submit->json('data.public_token');

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/orders/{$token}")
            ->assertOk()
            ->assertJsonPath('data.customer_name', 'Rahim')
            ->assertJsonCount(1, 'data.items');

        // Another shop's host can't see it, even with the right token.
        $this->getJson("https://shopb.{$this->apex()}/api/public/storefront/orders/{$token}")
            ->assertNotFound();

        $this->getJson("https://shopa.{$this->apex()}/api/public/storefront/orders/wrong-token")
            ->assertNotFound();
    }

    public function test_requires_customer_name_phone_and_address(): void
    {
        $a = $this->seller('shopa');
        $product = $this->product($a);

        $this->postJson("https://shopa.{$this->apex()}/api/public/storefront/orders", [
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])->assertStatus(422)
            ->assertJsonValidationErrors(['customer_name', 'customer_phone', 'customer_address']);
    }
}
