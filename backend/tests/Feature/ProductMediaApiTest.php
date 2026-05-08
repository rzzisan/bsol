<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductMediaApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_upload_product_media_and_set_thumbnail(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'user']);
        $product = Product::create([
            'user_id' => $user->id,
            'name' => 'Test Product',
            'sku' => 'SKU-1',
            'description' => 'desc',
            'selling_price' => 100,
            'cost_price' => 50,
            'stock' => 10,
            'track_stock' => true,
            'status' => 'active',
        ]);

        $token = $user->createToken('test-suite')->plainTextToken;

        $upload = $this->postJson("/api/products/{$product->id}/media", [
            'files' => [
                UploadedFile::fake()->image('a.jpg', 600, 600),
            ],
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $upload->assertCreated()->assertJsonPath('success', true);

        $mediaId = $upload->json('data.0.id');

        $this->putJson("/api/products/{$product->id}/media/{$mediaId}/set-thumbnail", [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk()->assertJsonPath('success', true);
    }

    public function test_admin_can_update_product_media_settings_and_user_can_read_policy(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $seller = User::factory()->create(['role' => 'user']);

        $adminToken = $admin->createToken('test-suite')->plainTextToken;
        $sellerToken = $seller->createToken('test-suite')->plainTextToken;

        $this->putJson('/api/admin/settings/product-media', [
            'max_gallery_images' => 5,
            'max_file_size_mb' => 3,
            'allowed_mime_types' => ['image/jpeg', 'image/png'],
            'thumbnail_required' => true,
            'is_active' => true,
        ], [
            'Authorization' => 'Bearer '.$adminToken,
        ])->assertOk()->assertJsonPath('status', 'success');

        $this->getJson('/api/products/media-policy', [
            'Authorization' => 'Bearer '.$sellerToken,
        ])
            ->assertOk()
            ->assertJsonPath('data.max_gallery_images', 5)
            ->assertJsonPath('data.max_file_size_mb', 3);
    }

    public function test_order_create_bootstrap_returns_products_and_categories(): void
    {
        $user = User::factory()->create(['role' => 'user']);
        Product::create([
            'user_id' => $user->id,
            'name' => 'Boot Product',
            'sku' => 'BOOT-1',
            'description' => 'desc',
            'selling_price' => 150,
            'cost_price' => 100,
            'stock' => 12,
            'track_stock' => true,
            'status' => 'active',
        ]);

        $token = $user->createToken('test-suite')->plainTextToken;

        $this->getJson('/api/orders/create/bootstrap', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => ['products', 'categories', 'defaults'],
            ]);
    }
}
