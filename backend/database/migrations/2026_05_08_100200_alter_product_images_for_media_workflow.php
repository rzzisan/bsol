<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            if (! Schema::hasColumn('product_images', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('product_id')->constrained('users')->cascadeOnDelete();
            }

            if (! Schema::hasColumn('product_images', 'file_path')) {
                $table->string('file_path', 500)->nullable()->after('url');
            }

            if (! Schema::hasColumn('product_images', 'file_name')) {
                $table->string('file_name', 255)->nullable()->after('file_path');
            }

            if (! Schema::hasColumn('product_images', 'mime_type')) {
                $table->string('mime_type', 120)->nullable()->after('file_name');
            }

            if (! Schema::hasColumn('product_images', 'file_size_bytes')) {
                $table->unsignedBigInteger('file_size_bytes')->nullable()->after('mime_type');
            }

            if (! Schema::hasColumn('product_images', 'width')) {
                $table->unsignedInteger('width')->nullable()->after('file_size_bytes');
            }

            if (! Schema::hasColumn('product_images', 'height')) {
                $table->unsignedInteger('height')->nullable()->after('width');
            }
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('UPDATE product_images pi SET user_id = p.user_id FROM products p WHERE p.id = pi.product_id AND pi.user_id IS NULL');
        } else {
            $rows = DB::table('product_images')->whereNull('user_id')->get(['id', 'product_id']);
            foreach ($rows as $row) {
                $ownerId = DB::table('products')->where('id', $row->product_id)->value('user_id');
                if ($ownerId) {
                    DB::table('product_images')->where('id', $row->id)->update(['user_id' => $ownerId]);
                }
            }
        }

        Schema::table('product_images', function (Blueprint $table) {
            $table->index(['product_id', 'is_primary']);
            $table->index(['user_id', 'product_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::table('product_images', function (Blueprint $table) {
            if (Schema::hasColumn('product_images', 'height')) {
                $table->dropColumn('height');
            }
            if (Schema::hasColumn('product_images', 'width')) {
                $table->dropColumn('width');
            }
            if (Schema::hasColumn('product_images', 'file_size_bytes')) {
                $table->dropColumn('file_size_bytes');
            }
            if (Schema::hasColumn('product_images', 'mime_type')) {
                $table->dropColumn('mime_type');
            }
            if (Schema::hasColumn('product_images', 'file_name')) {
                $table->dropColumn('file_name');
            }
            if (Schema::hasColumn('product_images', 'file_path')) {
                $table->dropColumn('file_path');
            }
            if (Schema::hasColumn('product_images', 'user_id')) {
                $table->dropConstrainedForeignId('user_id');
            }

            $table->dropIndex(['product_id', 'is_primary']);
            $table->dropIndex(['user_id', 'product_id', 'sort_order']);
        });
    }
};
