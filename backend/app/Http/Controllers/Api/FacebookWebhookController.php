<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlatformFacebookSetting;
use App\Services\Facebook\FacebookGraphClient;
use App\Services\Facebook\FacebookLeadCaptureService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Public, unauthenticated route Meta calls directly — auth boundary is the
 * verify-token handshake (GET) and the X-Hub-Signature-256 HMAC (POST), not
 * Sanctum. See CourierWebhook-equivalent none exists yet; this is the first
 * public-facing webhook receiver in the codebase.
 */
class FacebookWebhookController extends Controller
{
    public function __construct(
        private readonly FacebookGraphClient $graphClient,
        private readonly FacebookLeadCaptureService $captureService,
    ) {}

    public function verify(Request $request): Response
    {
        $mode = $request->query('hub_mode') ?? $request->query('hub.mode');
        $token = $request->query('hub_verify_token') ?? $request->query('hub.verify_token');
        $challenge = $request->query('hub_challenge') ?? $request->query('hub.challenge');

        if ($mode === 'subscribe' && $token === PlatformFacebookSetting::resolvedWebhookVerifyToken() && $challenge) {
            return response((string) $challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response('Forbidden', 403);
    }

    public function receive(Request $request): Response
    {
        $signature = $request->header('X-Hub-Signature-256');

        if (! $this->graphClient->verifySignature($request->getContent(), $signature)) {
            return response('Invalid signature', 403);
        }

        $payload = $request->json()->all();

        // Processed inline rather than queued: there is no queue worker
        // running in this deployment yet (verified 2026-08-02 — no
        // systemd/supervisor/cron consumer for QUEUE_CONNECTION=redis,
        // see SAAS_MODULE_CONTEXT.md §17.x), so a dispatch() here would
        // silently sit in Redis forever. The capture work itself is a
        // handful of DB writes with no outbound HTTP calls, so doing it
        // synchronously is fast enough to stay well within Meta's webhook
        // response-time budget.
        $this->captureService->handle($payload);

        return response('EVENT_RECEIVED', 200);
    }
}
