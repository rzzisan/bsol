<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-courier sticker template overrides (sparse — only couriers the seller
 * explicitly customized get a row here). WaybillPdfService resolves a
 * template for an order as: this table (by courier_name) -> sticker_settings
 * .default_template_key -> 'classic'. See courier_waybill_context.md §6.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sticker_courier_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('courier_name', 50);
            $table->string('template_key', 50);
            $table->timestamps();
            $table->unique(['user_id', 'courier_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sticker_courier_templates');
    }
};
