<?php

namespace App\Jobs;

use App\Models\PlatformFacebookSetting;
use App\Models\PlatformMarketingEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends one BSOL acquisition-funnel event to Meta's Conversions API
 * (platform_marketing_tracking_context.md). Same request shape as
 * MetaCapiDriver (the seller-facing driver) — not reused directly, since
 * that class is typed against TrackingDestination/TrackingEvent, which
 * carry per-seller/per-destination concepts this job has none of.
 */
class SendPlatformMarketingEventJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(private readonly int $eventId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(): void
    {
        $event = PlatformMarketingEvent::find($this->eventId);

        if (! $event || $event->status === PlatformMarketingEvent::STATUS_SENT) {
            return;
        }

        $pixelId = PlatformFacebookSetting::resolvedMarketingPixelId();
        $accessToken = PlatformFacebookSetting::resolvedMarketingCapiAccessToken();

        if (! $pixelId || ! $accessToken) {
            // Nothing configured yet — not worth retrying until an admin
            // sets it up (Admin → Settings → Facebook → Marketing Pixel).
            $event->update([
                'status' => PlatformMarketingEvent::STATUS_FAILED,
                'error_message' => 'No marketing Pixel ID / CAPI access token configured.',
            ]);

            return;
        }

        $version = PlatformFacebookSetting::resolvedGraphVersion();
        $testEventCode = PlatformFacebookSetting::resolvedMarketingTestEventCode();

        $customData = $event->custom_data ?? [];
        $eventSourceUrl = $customData['event_source_url'] ?? null;
        unset($customData['event_source_url']);

        $payload = [
            'data' => [array_filter([
                'event_name' => $event->event_name,
                'event_time' => $event->created_at->timestamp,
                'event_id' => $event->event_id,
                'action_source' => $event->action_source,
                'event_source_url' => $eventSourceUrl,
                'user_data' => $event->user_data_hashed ?: null,
                'custom_data' => $customData !== [] ? $customData : null,
            ], fn ($value) => $value !== null)],
            'access_token' => $accessToken,
        ];

        if ($testEventCode) {
            $payload['test_event_code'] = $testEventCode;
        }

        try {
            $response = Http::asJson()
                ->timeout(15)
                ->post("https://graph.facebook.com/{$version}/{$pixelId}/events", $payload);
        } catch (\Throwable $e) {
            Log::warning('Platform marketing CAPI request failed', [
                'event_id' => $event->id,
                'error' => $e->getMessage(),
            ]);

            throw new \RuntimeException("Platform marketing CAPI dispatch failed for event {$event->id}: {$e->getMessage()}");
        }

        if (! $response->successful()) {
            $error = $response->json('error.message') ?? ('HTTP ' . $response->status());

            $event->update([
                'response_code' => $response->status(),
                'error_message' => $error,
            ]);

            Log::warning('Platform marketing CAPI event rejected', [
                'event_id' => $event->id,
                'status' => $response->status(),
                'body' => $response->json(),
            ]);

            throw new \RuntimeException("Platform marketing CAPI dispatch failed for event {$event->id}: {$error}");
        }

        $event->update([
            'status' => PlatformMarketingEvent::STATUS_SENT,
            'response_code' => $response->status(),
            'error_message' => null,
            'sent_at' => now(),
        ]);
    }

    /** Runs once $tries is exhausted — mark the row done, no more retries. */
    public function failed(\Throwable $exception): void
    {
        $event = PlatformMarketingEvent::find($this->eventId);

        if (! $event || $event->status === PlatformMarketingEvent::STATUS_SENT) {
            return;
        }

        $event->update([
            'status' => PlatformMarketingEvent::STATUS_FAILED,
            'error_message' => $exception->getMessage(),
        ]);
    }
}
