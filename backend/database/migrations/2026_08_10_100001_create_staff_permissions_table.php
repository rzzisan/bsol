<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('staff_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete(); // staff's own user id
            $table->string('module_key', 40); // 'orders'|'products'|'customers'|'courier'|'sms'|... — see staff_team_role_context.md §3.1
            $table->boolean('enabled')->default(false); // default-deny — owner must explicitly grant
            $table->timestamps();
            $table->unique(['user_id', 'module_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_permissions');
    }
};
