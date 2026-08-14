<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permanently retired subdomain labels (custom_domain_context.md §5.2).
 *
 * A released label must never become claimable again: live ad campaigns,
 * bookmarks and back-links keep pointing at it, so whoever claimed it next
 * would inherit the previous seller's traffic — a traffic hijack, not just
 * an inconvenience. Releasing a subdomain therefore writes a tombstone that
 * is never deleted, and availability checks treat a tombstoned label exactly
 * like a reserved one.
 *
 * user_id is nullOnDelete rather than cascade on purpose: the tombstone has
 * to outlive the account that created it, otherwise deleting the seller
 * would silently free the label again.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subdomain_tombstones', function (Blueprint $table) {
            $table->id();
            $table->string('label', 63)->unique();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('released_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subdomain_tombstones');
    }
};
