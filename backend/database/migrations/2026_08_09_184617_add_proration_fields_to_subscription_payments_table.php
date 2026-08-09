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
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->decimal('base_amount', 10, 2)->nullable()->after('amount');
            $table->decimal('proration_credit', 10, 2)->default(0)->after('base_amount');
            $table->foreignId('previous_package_id')->nullable()->after('package_id')
                ->constrained('subscription_packages')->nullOnDelete();
            $table->json('invoice_breakdown')->nullable()->after('proration_credit');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subscription_payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('previous_package_id');
            $table->dropColumn(['base_amount', 'proration_credit', 'invoice_breakdown']);
        });
    }
};
