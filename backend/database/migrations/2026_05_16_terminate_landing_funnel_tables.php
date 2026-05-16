<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::disableForeignKeyConstraints();

        Schema::dropIfExists('funnel_flow_steps');
        Schema::dropIfExists('funnel_flows');
        Schema::dropIfExists('funnels');

        Schema::dropIfExists('landing_page_conversion_tracking');
        Schema::dropIfExists('landing_page_order_bumps');
        Schema::dropIfExists('landing_page_upsells');
        Schema::dropIfExists('landing_page_steps');
        Schema::dropIfExists('landing_page_blocks');
        Schema::dropIfExists('landing_page_products');
        Schema::dropIfExists('landing_page_analytics_daily');
        Schema::dropIfExists('landing_pages');
        Schema::dropIfExists('landing_template_access_rules');
        Schema::dropIfExists('landing_templates');

        Schema::enableForeignKeyConstraints();
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        // No rollback for table drops
    }
};