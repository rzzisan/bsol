<?php

namespace Tests\Feature;

use App\Models\ProductCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Featured Categories grid thumbnail (storefront's "caresolution" template
 * addendum, seller_storefront_context.md §24) — falls back to a
 * letter-circle on the storefront when unset.
 */
class ProductCategoryThumbnailTest extends TestCase
{
    use RefreshDatabase;

    // Same Storage::fake() workaround as StorefrontSettingTest — see that
    // file's docblock for why.
    protected function setUp(): void
    {
        parent::setUp();

        $root = storage_path('framework/testing/disks/public-category-' . uniqid());
        config(['filesystems.disks.public.root' => $root]);
        (new \Illuminate\Filesystem\Filesystem())->makeDirectory($root, 0755, true);
    }

    public function test_owner_can_upload_replace_and_remove_a_category_thumbnail(): void
    {
        $owner = User::factory()->create();
        $category = ProductCategory::create(['user_id' => $owner->id, 'name' => 'Herbal', 'slug' => 'herbal']);
        Sanctum::actingAs($owner);

        $first = $this->postJson("/api/categories/{$category->id}/thumbnail", [
            'image' => UploadedFile::fake()->image('cat1.jpg'),
        ])->assertOk();

        $firstPath = ProductCategory::find($category->id)->thumbnail_path;
        $this->assertNotNull($first->json('data.thumbnail_url'));
        $this->assertTrue(Storage::disk('public')->exists($firstPath));

        // Replacing deletes the old file.
        $this->postJson("/api/categories/{$category->id}/thumbnail", [
            'image' => UploadedFile::fake()->image('cat2.jpg'),
        ])->assertOk();
        $this->assertFalse(Storage::disk('public')->exists($firstPath));

        $this->deleteJson("/api/categories/{$category->id}/thumbnail")
            ->assertOk()
            ->assertJsonPath('data.thumbnail_url', null);
    }

    public function test_cannot_upload_thumbnail_for_another_shops_category(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $category = ProductCategory::create(['user_id' => $other->id, 'name' => 'Herbal', 'slug' => 'herbal']);
        Sanctum::actingAs($owner);

        $this->postJson("/api/categories/{$category->id}/thumbnail", [
            'image' => UploadedFile::fake()->image('cat.jpg'),
        ])->assertStatus(404);
    }
}
