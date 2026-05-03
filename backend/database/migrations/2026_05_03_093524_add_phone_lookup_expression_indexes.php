<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement("CREATE INDEX IF NOT EXISTS idx_orders_phone10 ON orders ((right(regexp_replace(customer_phone, '\\D', '', 'g'), 10)))");
        DB::statement("CREATE INDEX IF NOT EXISTS idx_orders_user_phone10 ON orders (user_id, (right(regexp_replace(customer_phone, '\\D', '', 'g'), 10)))");

        DB::statement("CREATE INDEX IF NOT EXISTS idx_customers_phone10 ON customers ((right(regexp_replace(phone, '\\D', '', 'g'), 10)))");
        DB::statement("CREATE INDEX IF NOT EXISTS idx_customers_user_phone10 ON customers (user_id, (right(regexp_replace(phone, '\\D', '', 'g'), 10)))");

        DB::statement("CREATE INDEX IF NOT EXISTS idx_blacklist_phone10 ON customer_blacklist ((right(regexp_replace(phone, '\\D', '', 'g'), 10)))");
        DB::statement("CREATE INDEX IF NOT EXISTS idx_blacklist_user_phone10 ON customer_blacklist (user_id, (right(regexp_replace(phone, '\\D', '', 'g'), 10)))");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::getConnection()->getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS idx_orders_phone10');
        DB::statement('DROP INDEX IF EXISTS idx_orders_user_phone10');
        DB::statement('DROP INDEX IF EXISTS idx_customers_phone10');
        DB::statement('DROP INDEX IF EXISTS idx_customers_user_phone10');
        DB::statement('DROP INDEX IF EXISTS idx_blacklist_phone10');
        DB::statement('DROP INDEX IF EXISTS idx_blacklist_user_phone10');
    }
};
