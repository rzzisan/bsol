<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Self-referencing FK: null = normal owner/admin account (backward
            // compatible for every existing row); set = this is a staff
            // sub-account belonging to that owner. See staff_team_role_context.md §3.1.
            $table->foreignId('owner_id')->nullable()->after('role')
                ->constrained('users')->cascadeOnDelete();
            $table->string('staff_status', 20)->default('active')->after('owner_id'); // active|suspended — only meaningful when owner_id is set
            $table->boolean('must_change_password')->default(false)->after('staff_status');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['staff_status', 'must_change_password']);
            $table->dropConstrainedForeignId('owner_id');
        });
    }
};
