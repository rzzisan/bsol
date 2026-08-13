<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformApiKey;
use FilesystemIterator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Symfony\Component\HttpFoundation\Response;
use ZipArchive;

/**
 * Dashboard-facing management of the seller's WordPress/WooCommerce connector
 * API key (Sanctum + owner_only — Pattern B, staff_team_role_context.md §3.3).
 * Distinct from the plugin-facing /api/connect/v1/* surface, which is
 * API-key-authenticated instead of Sanctum-authenticated.
 * See bsol_history_and_new_context.md §5.
 */
class WordpressApiKeyController extends Controller
{
    public function show(): JsonResponse
    {
        $key = PlatformApiKey::where('user_id', auth()->user()->shopOwnerId())->first();

        if (! $key) {
            return response()->json(['success' => true, 'data' => null]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'platform'      => $key->platform,
                'domain'        => $key->domain,
                'masked_key'    => $key->masked(),
                'status'        => $key->status,
                'last_used_at'  => $key->last_used_at,
                'created_at'    => $key->created_at,
                'otp_verification_enabled' => (bool) $key->otp_verification_enabled,
            ],
        ]);
    }

    /**
     * Toggle checkout OTP verification for WooCommerce orders on this
     * connection — independent of the key itself, so flipping it never
     * requires regenerating/reconnecting. See CheckoutOtpService, Phase 9.
     */
    public function updateOtpSetting(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => 'required|boolean',
        ]);

        $key = PlatformApiKey::where('user_id', auth()->user()->shopOwnerId())->first();

        if (! $key) {
            return response()->json(['success' => false, 'message' => 'No WordPress connection found.'], 404);
        }

        $key->update(['otp_verification_enabled' => $data['enabled']]);

        return response()->json(['success' => true, 'data' => ['otp_verification_enabled' => $key->otp_verification_enabled]]);
    }

    /**
     * Generate a new key or regenerate/reconnect an existing one — an
     * idempotent upsert on the owner's single row. The raw key is returned
     * exactly once, here; it is never persisted or re-derivable afterward.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $ownerId = auth()->user()->shopOwnerId();
        $rawKey = PlatformApiKey::generateRawKey();

        $key = PlatformApiKey::updateOrCreate(
            ['user_id' => $ownerId],
            [
                'platform'    => 'woocommerce',
                'domain'      => PlatformApiKey::normalizeHost($data['domain']),
                'key_hash'    => PlatformApiKey::hashKey($rawKey),
                'key_prefix'  => substr($rawKey, 0, 12),
                'status'      => 'pending',
                'revoked_at'  => null,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'API key generated. Save it now — it will not be shown again.',
            'data' => [
                'api_key'    => $rawKey,
                'platform'   => $key->platform,
                'domain'     => $key->domain,
                'masked_key' => $key->masked(),
                'status'     => $key->status,
            ],
        ], 201);
    }

    public function destroy(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $key = PlatformApiKey::where('user_id', $ownerId)->first();

        if (! $key) {
            return response()->json(['success' => false, 'message' => 'No API key found.'], 404);
        }

        $key->update(['status' => 'revoked', 'revoked_at' => now()]);

        return response()->json(['success' => true, 'message' => 'API key revoked.']);
    }

    /**
     * Public — the plugin zip has no secrets in it (the API key is entered
     * by the seller after install), and a plain <a href download> link is
     * far simpler than an authenticated blob-fetch dance for a static
     * asset. Built on-the-fly from the plugin source on every request so
     * it can never go stale relative to what's actually deployed.
     */
    public function downloadPlugin(): Response
    {
        $sourceDir = dirname(base_path()) . '/wordpress-plugin/bsol-connect';
        abort_unless(is_dir($sourceDir), 404, 'Plugin source not found.');

        $version = $this->resolvePluginVersion($sourceDir);

        $tempZip = tempnam(sys_get_temp_dir(), 'bsol-connect-') . '.zip';

        $zip = new ZipArchive();
        $zip->open($tempZip, ZipArchive::CREATE | ZipArchive::OVERWRITE);

        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($sourceDir, FilesystemIterator::SKIP_DOTS)
        );
        foreach ($files as $file) {
            $relativePath = substr($file->getPathname(), strlen($sourceDir) + 1);
            $zip->addFile($file->getPathname(), 'bsol-connect/' . $relativePath);
        }
        $zip->close();

        return response()->download($tempZip, "bsol-connect-v{$version}.zip")->deleteFileAfterSend(true);
    }

    /**
     * Public — same trust level as downloadPlugin() (no secrets, just a
     * version string), lets the plugin's own self-update notice
     * (class-bsol-update-checker.php) check without needing an API key.
     * download_url is returned rather than hardcoded plugin-side, so
     * there's only one URL for the plugin to know about.
     */
    public function pluginVersion(): JsonResponse
    {
        $sourceDir = dirname(base_path()) . '/wordpress-plugin/bsol-connect';

        return response()->json([
            'success' => true,
            'data' => [
                'version' => $this->resolvePluginVersion($sourceDir),
                'download_url' => url('/api/wordpress/plugin-download'),
            ],
        ]);
    }

    private function resolvePluginVersion(string $sourceDir): string
    {
        $version = '1.0.0';
        $mainFile = $sourceDir . '/bsol-connect.php';
        if (is_file($mainFile) && preg_match('/^\s*\*\s*Version:\s*([0-9.]+)/mi', file_get_contents($mainFile), $m)) {
            $version = $m[1];
        }

        return $version;
    }
}
