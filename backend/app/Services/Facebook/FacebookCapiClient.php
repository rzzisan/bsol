<?php

namespace App\Services\Facebook;

use App\Models\PlatformFacebookSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin wrapper around Meta's Conversions API (server-side pixel events).
 * Unlike FacebookGraphClient (our platform app talking on a seller's Page),
 * every call here uses the seller's own pixel_id + CAPI access token —
 * this class never touches platform_facebook_settings credentials.
 */
class FacebookCapiClient
{
    /**
     * @param  array<string, mixed>  $eventData  A single Conversions API event object.
     */
    public function sendEvent(string $pixelId, string $accessToken, array $eventData, ?string $testEventCode = null): bool
    {
        $version = PlatformFacebookSetting::resolvedGraphVersion();

        $payload = ['data' => [$eventData], 'access_token' => $accessToken];
        if ($testEventCode) {
            $payload['test_event_code'] = $testEventCode;
        }

        try {
            $response = Http::asJson()
                ->timeout(10)
                ->post("https://graph.facebook.com/{$version}/{$pixelId}/events", $payload);
        } catch (\Throwable $e) {
            Log::warning('Facebook CAPI request failed', ['pixel_id' => $pixelId, 'error' => $e->getMessage()]);

            return false;
        }

        if (! $response->successful()) {
            Log::warning('Facebook CAPI event rejected', [
                'pixel_id' => $pixelId,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            return false;
        }

        return true;
    }
}
