<?php

namespace App\Services\Whatsapp;

use App\Models\PlatformFacebookSetting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Thin wrapper around the WhatsApp Cloud API (part of the same Meta Graph
 * API/App as FacebookGraphClient — WhatsApp Cloud API is a product on the
 * same App, not a separate app registration). Credentials are per-seller
 * (WhatsappBusinessConnection, seller-pasted phone_number_id + access
 * token — see whatsapp_context.md for why this avoids the App-Review-gated
 * Embedded Signup OAuth flow), but app_secret/webhook_verify_token/graph
 * version stay on PlatformFacebookSetting since they're app-level, same as
 * the Facebook Page/Messenger integration.
 */
class WhatsappCloudApiClient
{
    private function baseUrl(string $phoneNumberId): string
    {
        return 'https://graph.facebook.com/' . PlatformFacebookSetting::resolvedGraphVersion() . '/' . $phoneNumberId;
    }

    /**
     * Without this, Meta never delivers inbound webhook events for this
     * WABA to our /facebook/webhook URL at all — pasting phone_number_id +
     * access_token alone only enables sending, not receiving. This is the
     * WhatsApp-side equivalent of FacebookGraphClient::subscribeAppToPage()
     * (same shape: POST /{id}/subscribed_apps), just keyed by waba_id
     * instead of a Page id. Called once, right after a seller saves their
     * connection — see WhatsappConnectionController::update().
     */
    public function subscribeAppToWaba(string $wabaId, string $accessToken): bool
    {
        $response = Http::withToken($accessToken)->asJson()->timeout(15)
            ->post('https://graph.facebook.com/' . PlatformFacebookSetting::resolvedGraphVersion() . "/{$wabaId}/subscribed_apps");

        if (! $response->successful()) {
            Log::warning('whatsapp.subscribe_app_to_waba_failed', ['waba_id' => $wabaId, 'response' => $response->json()]);
        }

        return $response->successful() && (bool) ($response->json()['success'] ?? false);
    }

    /**
     * Order-status automation always fires outside the customer-initiated
     * 24h session window (the customer didn't just message us, we're
     * reacting to their order) — WhatsApp rejects free text there, a
     * pre-approved message template is the only option. $bodyParams are
     * positional, mapped onto the template's {{1}}, {{2}}, ... slots by
     * the caller (WhatsappAutomationService).
     *
     * @return array{wa_message_id:string}|null
     */
    public function sendTemplateMessage(
        string $phoneNumberId,
        string $accessToken,
        string $to,
        string $templateName,
        string $languageCode,
        array $bodyParams,
    ): ?array {
        $components = empty($bodyParams) ? [] : [[
            'type' => 'body',
            'parameters' => array_map(fn ($v) => ['type' => 'text', 'text' => (string) $v], $bodyParams),
        ]];

        $response = Http::withToken($accessToken)->asJson()->timeout(15)
            ->post("{$this->baseUrl($phoneNumberId)}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'template',
                'template' => [
                    'name' => $templateName,
                    'language' => ['code' => $languageCode],
                    'components' => $components,
                ],
            ]);

        if (! $response->successful() || ! $response->json('messages.0.id')) {
            Log::warning('whatsapp.send_template_failed', ['to' => $to, 'template' => $templateName, 'response' => $response->json()]);

            return null;
        }

        return ['wa_message_id' => $response->json('messages.0.id')];
    }

    /**
     * Free-form text — only accepted by Meta within the 24h window since
     * the customer's last inbound message. Used for inbox replies, never
     * for automation. A rejection here (window closed) surfaces as a
     * normal null, same shape as FacebookGraphClient::sendMessage()'s
     * 24h-window failure.
     *
     * @return array{wa_message_id:string}|null
     */
    public function sendTextMessage(string $phoneNumberId, string $accessToken, string $to, string $text): ?array
    {
        $response = Http::withToken($accessToken)->asJson()->timeout(15)
            ->post("{$this->baseUrl($phoneNumberId)}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['body' => $text],
            ]);

        if (! $response->successful() || ! $response->json('messages.0.id')) {
            Log::warning('whatsapp.send_text_failed', ['to' => $to, 'response' => $response->json()]);

            return null;
        }

        return ['wa_message_id' => $response->json('messages.0.id')];
    }

    /**
     * Same HMAC-over-raw-body scheme as FacebookGraphClient::verifySignature()
     * (same app secret — WhatsApp deliveries arrive on the same webhook
     * callback URL as Page events, see whatsapp_context.md). Duplicated
     * rather than shared, matching this codebase's established preference
     * for small per-channel duplication over a shared base class
     * (BkashPaymentGatewayClient vs BkashPgwPaymentGatewayClient).
     */
    public function verifySignature(string $rawBody, ?string $signatureHeader): bool
    {
        if (! $signatureHeader || ! str_starts_with($signatureHeader, 'sha256=')) {
            return false;
        }

        $appSecret = (string) PlatformFacebookSetting::resolvedAppSecret();
        if ($appSecret === '') {
            return false;
        }

        $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);

        return hash_equals($expected, $signatureHeader);
    }
}
