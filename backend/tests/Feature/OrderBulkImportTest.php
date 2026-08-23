<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\Product;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Bulk/CSV order import — feature_roadmap_context.md "Bulk/CSV order
 * import" (§16.8) / OrderBulkImportService's docblock.
 */
class OrderBulkImportTest extends TestCase
{
    use RefreshDatabase;

    private function csvFile(string $content, string $name = 'orders.csv'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'bulk_import_test_');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, 'text/csv', null, true);
    }

    private const HEADER = 'customer_name,customer_phone,customer_address,customer_district,customer_thana,product_name,sku,quantity,unit_price,shipping_charge,discount,payment_method,notes';

    public function test_template_download_has_the_documented_header_row(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $res = $this->get('/api/orders/bulk-import/template')->assertOk();
        $this->assertStringStartsWith(self::HEADER, $res->getContent());
    }

    public function test_preview_reports_valid_and_invalid_rows_with_row_numbers_and_sku_match(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);
        $product = Product::factory()->create(['user_id' => $owner->id, 'sku' => 'TSHIRT-001']);

        $csv = self::HEADER . "\n"
            . 'Rahim,01711223344,Dhaka,Dhaka,Dhanmondi,Cotton T-Shirt,TSHIRT-001,2,590,70,0,cod,' . "\n"
            . 'Karim,,Dhaka,,,Leather Bag,,1,1450,,,,'."\n"; // missing phone -> invalid

        $res = $this->postJson('/api/orders/bulk-import/preview', ['file' => $this->csvFile($csv)])->assertOk();

        $this->assertSame(2, $res->json('data.total_rows'));
        $this->assertSame(1, $res->json('data.valid_count'));
        $this->assertSame(1, $res->json('data.invalid_count'));

        $rows = $res->json('data.rows');
        $this->assertSame(2, $rows[0]['row_number']); // header is row 1
        $this->assertSame([], $rows[0]['errors']);
        $this->assertSame($product->id, $rows[0]['product_id']);
        $this->assertSame(3, $rows[1]['row_number']);
        $this->assertNotEmpty($rows[1]['errors']);
    }

    public function test_commit_creates_only_valid_rows_with_correct_totals_and_never_creates_invalid_ones(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $csv = self::HEADER . "\n"
            . 'Rahim,01711223344,Dhaka,,,Cotton T-Shirt,,2,590,70,10,cod,'."\n"
            . 'Karim,,Dhaka,,,Leather Bag,,1,1450,,,,'."\n"; // missing phone

        $res = $this->postJson('/api/orders/bulk-import/commit', ['file' => $this->csvFile($csv)])->assertOk();

        $this->assertSame(1, $res->json('data.created_count'));
        $this->assertCount(1, $res->json('data.skipped'));
        $this->assertSame(3, $res->json('data.skipped.0.row_number'));

        $this->assertSame(1, Order::where('user_id', $owner->id)->count());
        $order = Order::where('user_id', $owner->id)->first();
        $this->assertSame('bulk_import', $order->source);
        $this->assertSame('01711223344', $order->customer_phone);
        $this->assertSame('1180.00', $order->subtotal); // 2 * 590
        $this->assertSame('1240.00', $order->total); // 1180 + 70 shipping - 10 discount
        $this->assertSame(1, $order->items()->count());
    }

    public function test_monthly_order_limit_does_not_block_bulk_creation_any_more(): void
    {
        // Order quota redesign (subscription_billing_context.md §9.2-A) —
        // creation is always unlimited now, even with max_orders=1; the
        // limit only bites later when an order is first moved out of
        // 'pending' (see EnsurePackageFeatureTest's sibling,
        // OrderProcessingQuotaTest, for that gate).
        $package = SubscriptionPackage::create([
            'name' => 'Starter', 'slug' => 'starter', 'price' => 500,
            'duration_days' => 30, 'max_orders' => 1, 'is_active' => true,
        ]);
        $owner = User::factory()->create(['subscription_package_id' => $package->id]);
        Sanctum::actingAs($owner);

        $csv = self::HEADER . "\n"
            . 'A,01711111111,,,,T-Shirt,,1,500,,,,'."\n"
            . 'B,01722222222,,,,Bag,,1,1000,,,,'."\n";

        $res = $this->postJson('/api/orders/bulk-import/commit', ['file' => $this->csvFile($csv)])->assertOk();

        $this->assertSame(2, $res->json('data.created_count'));
        $this->assertSame(2, Order::where('user_id', $owner->id)->count());
        $this->assertNull(Order::where('user_id', $owner->id)->first()->quota_consumed_at);
    }

    public function test_file_with_more_than_max_rows_is_rejected(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $lines = [self::HEADER];
        for ($i = 0; $i < \App\Services\OrderBulkImportService::MAX_ROWS + 1; $i++) {
            $lines[] = "Customer {$i},017{$i}0000000,,,,Product,,1,100,,,,";
        }
        $csv = implode("\n", $lines) . "\n";

        $this->postJson('/api/orders/bulk-import/preview', ['file' => $this->csvFile($csv)])
            ->assertStatus(422);
    }

    public function test_non_csv_file_is_rejected(): void
    {
        $owner = User::factory()->create();
        Sanctum::actingAs($owner);

        $path = tempnam(sys_get_temp_dir(), 'bulk_import_test_');
        file_put_contents($path, '%PDF-1.4 not a csv');
        $file = new UploadedFile($path, 'orders.pdf', 'application/pdf', null, true);

        $this->postJson('/api/orders/bulk-import/preview', ['file' => $file])
            ->assertStatus(422);
    }

    public function test_staff_without_orders_module_is_denied(): void
    {
        $owner = User::factory()->create();
        // Default-deny — no staff_permissions row for 'orders' at all.
        $staff = User::factory()->create(['owner_id' => $owner->id]);
        Sanctum::actingAs($staff);

        $this->get('/api/orders/bulk-import/template')->assertStatus(403);
    }
}
