<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sms_credit_settings', function (Blueprint $table) {
            $table->id();
            $table->decimal('rate_per_credit', 8, 4)->default(0.35)->comment('BDT cost per 1 SMS credit');
            $table->integer('chars_per_credit_english')->default(160)->comment('Chars per SMS segment for English/GSM');
            $table->integer('chars_per_credit_unicode')->default(70)->comment('Chars per SMS segment for Unicode/Bangla');
            $table->string('currency', 10)->default('BDT');
            $table->timestamps();
        });

        // Seed the single settings row
        DB::table('sms_credit_settings')->insert([
            'rate_per_credit' => 0.35,
            'chars_per_credit_english' => 160,
            'chars_per_credit_unicode' => 70,
            'currency' => 'BDT',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('sms_credit_settings');
    }
};
