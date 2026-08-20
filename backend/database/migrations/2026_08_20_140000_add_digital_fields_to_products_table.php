<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // 'physical' (default, unchanged behavior) | 'digital'.
            // digital products skip courier/inventory-reservation entirely
            // — see digital_product_context.md §5 (mixed-cart blocked).
            $table->string('product_type', 20)->default('physical')->after('category_id');

            // Only meaningful when product_type = 'digital'.
            // 'hosted_file' — file lives on this server, delivered via a
            //   token-gated + OTP-gated link (digital_deliveries table).
            // 'external_url' — seller supplies their own link (Google
            //   Drive, etc.) — no anti-piracy layer, it's not our file.
            $table->string('digital_delivery_type', 20)->nullable();

            // hosted_file fields — private disk only, never 'public'.
            $table->string('digital_file_path')->nullable();
            $table->string('digital_file_name')->nullable();
            $table->string('digital_file_mime_type')->nullable();
            $table->unsignedBigInteger('digital_file_size_bytes')->nullable();

            // external_url field.
            $table->text('digital_external_url')->nullable();

            // Which channels the seller wants delivery attempted through —
            // subset of ['email','sms']. In-app (order status page) is
            // always available regardless, not stored here.
            $table->jsonb('digital_delivery_channels')->nullable();

            $table->index('product_type');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['product_type']);
            $table->dropColumn([
                'product_type',
                'digital_delivery_type',
                'digital_file_path',
                'digital_file_name',
                'digital_file_mime_type',
                'digital_file_size_bytes',
                'digital_external_url',
                'digital_delivery_channels',
            ]);
        });
    }
};
