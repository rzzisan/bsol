<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->boolean('admin_locked')->default(false)->after('status');
            $table->text('admin_lock_reason')->nullable()->after('admin_locked');
            $table->timestamp('admin_locked_at')->nullable()->after('admin_lock_reason');
            $table->foreignId('admin_locked_by')->nullable()->after('admin_locked_at')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('landing_pages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('admin_locked_by');
            $table->dropColumn(['admin_locked', 'admin_lock_reason', 'admin_locked_at']);
        });
    }
};
