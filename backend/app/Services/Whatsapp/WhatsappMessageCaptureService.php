<?php

namespace App\Services\Whatsapp;

use App\Models\Customer;
use App\Models\WhatsappBusinessConnection;
use App\Models\WhatsappMessage;
use App\Support\PhoneIntelCache;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Turns a raw WhatsApp Cloud API webhook payload (object=whatsapp_business_account)
 * into whatsapp_messages rows — inbound customer messages become new rows,
 * delivery-status events (sent/delivered/read/failed) update the matching
 * outbound row by wa_message_id. Called from FacebookWebhookController::receive()
 * alongside FacebookLeadCaptureService (same shared webhook callback URL —
 * see whatsapp_context.md for why there's only one). Unlike Facebook's
 * best-effort regex-in-message-text phone detection, wa_id IS the
 * customer's WhatsApp-registered phone number, so customer auto-linking
 * here is exact, not a guess.
 */
class WhatsappMessageCaptureService
{
    public function handle(array $payload): void
    {
        if (($payload['object'] ?? null) !== 'whatsapp_business_account') {
            return;
        }

        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                if (($change['field'] ?? null) !== 'messages') {
                    continue;
                }

                $value = $change['value'] ?? [];
                $phoneNumberId = $value['metadata']['phone_number_id'] ?? null;
                if (! $phoneNumberId) {
                    continue;
                }

                $connection = WhatsappBusinessConnection::where('phone_number_id', $phoneNumberId)
                    ->where('status', 'connected')
                    ->first();
                if (! $connection) {
                    continue;
                }

                $contactNames = collect($value['contacts'] ?? [])
                    ->keyBy('wa_id')
                    ->map(fn ($c) => $c['profile']['name'] ?? null);

                foreach ($value['messages'] ?? [] as $message) {
                    $this->captureInbound($connection, $message, $contactNames->get($message['from'] ?? null));
                }

                foreach ($value['statuses'] ?? [] as $status) {
                    $this->applyStatus($status);
                }
            }
        }
    }

    private function captureInbound(WhatsappBusinessConnection $connection, array $message, ?string $contactName): void
    {
        $waMessageId = $message['id'] ?? null;
        $from = $message['from'] ?? null;
        if (! $waMessageId || ! $from) {
            return;
        }

        $type = $message['type'] ?? 'other';
        $body = match ($type) {
            'text' => $message['text']['body'] ?? null,
            'button' => $message['button']['text'] ?? null,
            'interactive' => $message['interactive']['button_reply']['title'] ?? $message['interactive']['list_reply']['title'] ?? null,
            default => null,
        };

        $attrs = [
            'user_id' => $connection->user_id,
            'whatsapp_business_connection_id' => $connection->id,
            'direction' => 'inbound',
            'wa_id' => $from,
            'contact_name' => $contactName,
            'message_type' => in_array($type, ['text', 'template'], true) ? $type : 'other',
            'body' => $body,
            'status' => 'received',
            'raw_payload' => $message,
            'received_at' => now(),
        ];

        try {
            $row = WhatsappMessage::firstOrCreate(['wa_message_id' => $waMessageId], $attrs);
        } catch (UniqueConstraintViolationException) {
            // Concurrent redelivery of the same event lost the race.
            return;
        }

        if (! $row->wasRecentlyCreated) {
            return;
        }

        $this->tryAutoLinkCustomer($row);
    }

    private function tryAutoLinkCustomer(WhatsappMessage $row): void
    {
        $phone = PhoneIntelCache::normalizePhone($row->wa_id);
        if (strlen($phone) !== 11) {
            return;
        }

        try {
            $customer = Customer::firstOrCreate(
                ['user_id' => $row->user_id, 'phone' => $phone],
                ['name' => $row->contact_name, 'tags' => []]
            );
        } catch (UniqueConstraintViolationException) {
            $customer = Customer::where('user_id', $row->user_id)->where('phone', $phone)->first();
            if (! $customer) {
                return;
            }
        }

        $row->update(['customer_id' => $customer->id]);
    }

    private function applyStatus(array $status): void
    {
        $waMessageId = $status['id'] ?? null;
        $newStatus = $status['status'] ?? null; // sent | delivered | read | failed
        if (! $waMessageId || ! in_array($newStatus, ['sent', 'delivered', 'read', 'failed'], true)) {
            return;
        }

        // Only ever advances an existing outbound row this platform itself
        // sent — never creates a row from a bare status event (an inbound
        // message row is only ever created by captureInbound() above).
        WhatsappMessage::where('wa_message_id', $waMessageId)
            ->where('direction', 'outbound')
            ->update(['status' => $newStatus]);
    }
}
