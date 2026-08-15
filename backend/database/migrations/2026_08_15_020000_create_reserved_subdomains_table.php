<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Subdomain labels sellers may not claim, managed from the admin panel
 * (custom_domain_context.md §5.3).
 *
 * Previously a PHP constant, which meant adding a DNS record to the zone and
 * forgetting to mirror it here left a live service claimable until the next
 * deploy. Now it's data.
 *
 * is_system marks the rows where removal would break or endanger something
 * live — every label that already resolves in DNS, plus the mail-policy and
 * core infrastructure names. Those stay visible in the UI but cannot be
 * deleted: freeing 'mail' or 'cpanel' would let a seller take over the
 * shop's email or the hosting control panel, and an explicit DNS record
 * always beats the wildcard, so BSOL would believe the label was theirs
 * while the traffic kept going to the real host.
 *
 * The initial rows are inserted here rather than in a seeder so that no
 * environment can come up with an empty — i.e. wide open — list.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reserved_subdomains', function (Blueprint $table) {
            $table->id();
            $table->string('label', 63)->unique();
            $table->string('reason', 200)->nullable();
            $table->boolean('is_system')->default(false);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        $rows = [];

        foreach (self::SYSTEM as $reason => $labels) {
            foreach ($labels as $label) {
                $rows[] = ['label' => $label, 'reason' => $reason, 'is_system' => true, 'created_at' => $now, 'updated_at' => $now];
            }
        }

        foreach (self::EDITABLE as $reason => $labels) {
            foreach ($labels as $label) {
                $rows[] = ['label' => $label, 'reason' => $reason, 'is_system' => false, 'created_at' => $now, 'updated_at' => $now];
            }
        }

        DB::table('reserved_subdomains')->insertOrIgnore($rows);
    }

    public function down(): void
    {
        Schema::dropIfExists('reserved_subdomains');
    }

    /** Removing any of these breaks or endangers something already live. */
    private const SYSTEM = [
        'Live DNS record — a seller claiming this would hijack a running service' => [
            'ai', 'app', 'autoconfig', 'autodiscover', 'bsol', 'caldav', 'caldavs',
            'carddav', 'carddavs', 'catv', 'catv-dev', 'cpanel', 'cpcalendars',
            'cpcontacts', 'default', 'dishbill', 'dmarc', 'dokploy', 'domainkey',
            'ftp', 'iptv', 'isp', 'mail', 'portal', 'saas', 'sub', 'webdisk',
            'webmail', 'whm', 'www',
        ],
        'Core infrastructure name' => [
            'api', 'admin', 'auth', 'login', 'ns', 'ns1', 'ns2', 'dns', 'mx',
            'smtp', 'imap', 'pop', 'pop3', 'email',
        ],
        'Mail policy / role account' => [
            'dkim', 'spf', 'postmaster', 'hostmaster', 'abuse', 'security', 'root',
        ],
    ];

    /** Sensible defaults the admin is free to release later. */
    private const EDITABLE = [
        'Environment name' => [
            'staging', 'stage', 'dev', 'test', 'testing', 'demo', 'sandbox',
            'beta', 'alpha', 'preview', 'local', 'localhost',
        ],
        'Asset delivery' => [
            'cdn', 'static', 'assets', 'media', 'img', 'images', 'files',
            'download', 'downloads', 'upload', 'uploads',
        ],
        'Operations' => [
            'status', 'health', 'monitor', 'monitoring', 'metrics', 'logs',
            'backup', 'backups', 'grafana', 'kibana', 'relay', 'gateway',
            'proxy', 'vpn', 'ssh',
        ],
        'Reserved for a future product surface' => [
            'support', 'help', 'helpdesk', 'docs', 'doc', 'blog', 'news',
            'shop', 'store', 'pay', 'payment', 'payments', 'checkout',
            'billing', 'invoice', 'account', 'accounts', 'sso', 'id',
            'signup', 'register', 'dashboard', 'panel', 'console',
            'partner', 'partners', 'affiliate', 'reseller', 'agency',
        ],
        'Brand' => [
            'zyro', 'zyrotech', 'zyrotechbd', 'official', 'www2',
            'noreply', 'no-reply', 'info', 'contact', 'sales',
        ],
    ];
};
