<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_page_statistics', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('landing_page_id');
            $table->date('date');
            $table->unsignedInteger('total_visits')->default(0);
            $table->unsignedInteger('unique_visitors')->default(0);
            $table->unsignedInteger('orders_placed')->default(0);
            $table->timestamps();
            
            $table->unique(['landing_page_id', 'date']);
            $table->index('landing_page_id');
            $table->index('date');
            
            $table->foreign('landing_page_id')->references('id')->on('landing_pages')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_page_statistics');
    }
};
