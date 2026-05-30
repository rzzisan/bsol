<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_visit_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('landing_page_visit_id');
            $table->unsignedBigInteger('order_id');
            $table->timestamps();
            
            $table->unique(['landing_page_visit_id', 'order_id']);
            $table->index('landing_page_visit_id');
            $table->index('order_id');
            
            $table->foreign('landing_page_visit_id')->references('id')->on('landing_page_visits')->onDelete('cascade');
            $table->foreign('order_id')->references('id')->on('orders')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_visit_orders');
    }
};
