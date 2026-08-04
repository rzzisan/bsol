<?php

namespace App\Services\Facebook;

use App\Models\Customer;
use App\Models\FacebookLead;
use App\Models\FacebookPageConnection;
use App\Support\PhoneIntelCache;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;

/**
 * Turns a raw Meta webhook payload (Page feed comments + Messenger
 * conversations) into FacebookLead rows, and auto-links/creates a Customer
 * when a BD phone number can be lifted from the message text — Facebook's
 * API never hands over a phone number directly, so this regex-detect is
 * the only "auto-save" path; everything else stays a lead for the seller
 * to review in /dashboard/leads.
 */
class FacebookLeadCaptureService
{
    private const BD_PHONE_PATTERN = '/(?:\+?88)?01[3-9]\d{8}/';

    public function __construct(private readonly FacebookGraphClient $graphClient) {}

    public function handle(array $payload): void
    {
        if (($payload['object'] ?? null) !== 'page') {
            return;
        }

        foreach ($payload['entry'] ?? [] as $entry) {
            $pageId = $entry['id'] ?? null;
            if (! $pageId) {
                continue;
            }

            $connection = FacebookPageConnection::where('fb_page_id', $pageId)
                ->where('status', 'connected')
                ->first();

            if (! $connection) {
                continue;
            }

            foreach ($entry['changes'] ?? [] as $change) {
                $this->captureComment($connection, $change);
            }

            foreach ($entry['messaging'] ?? [] as $event) {
                $this->captureMessage($connection, $event);
            }
        }
    }

    private function captureComment(FacebookPageConnection $connection, array $change): void
    {
        if (($change['field'] ?? null) !== 'feed') {
            return;
        }

        $value = $change['value'] ?? [];
        if (($value['item'] ?? null) !== 'comment' || ($value['verb'] ?? null) !== 'add') {
            return;
        }

        $commentId = $value['comment_id'] ?? null;
        if (! $commentId) {
            return;
        }

        // Replying to a comment from the dashboard (FacebookGraphClient::replyToComment)
        // posts a new comment as the Page — Meta re-delivers that as a normal
        // feed/comment webhook event, with no echo flag to distinguish it (unlike
        // Messenger). Without this check, every reply we send comes back as a
        // brand-new lead authored by "ourselves". Anything from.id === the
        // connected Page's own ID is our own reply, not an incoming lead.
        if (($value['from']['id'] ?? null) === $connection->fb_page_id) {
            return;
        }

        $this->storeLead($connection, [
            'channel' => 'comment',
            'fb_event_id' => $commentId,
            'sender_fb_id' => $value['from']['id'] ?? null,
            'sender_name' => $value['from']['name'] ?? null,
            'message' => $value['message'] ?? null,
            'post_id' => $value['post_id'] ?? null,
            'thread_id' => null,
            'raw_payload' => $value,
        ]);
    }

    private function captureMessage(FacebookPageConnection $connection, array $event): void
    {
        // Skip echoes of the page's own replies and non-text events (attachments only).
        if (! empty($event['message']['is_echo']) || empty($event['message']['text'])) {
            return;
        }

        $mid = $event['message']['mid'] ?? null;
        $senderId = $event['sender']['id'] ?? null;
        if (! $mid || ! $senderId) {
            return;
        }

        $this->storeLead($connection, [
            'channel' => 'message',
            'fb_event_id' => $mid,
            'sender_fb_id' => $senderId,
            'sender_name' => $connection->page_access_token
                ? $this->graphClient->getUserProfileName($senderId, $connection->page_access_token)
                : null,
            'message' => $event['message']['text'],
            'post_id' => null,
            'thread_id' => $senderId,
            'raw_payload' => $event,
        ]);
    }

    /**
     * @param  array<string, mixed>  $attrs
     */
    private function storeLead(FacebookPageConnection $connection, array $attrs): void
    {
        try {
            $lead = FacebookLead::firstOrCreate(
                ['channel' => $attrs['channel'], 'fb_event_id' => $attrs['fb_event_id']],
                array_merge($attrs, [
                    'user_id' => $connection->user_id,
                    'facebook_page_connection_id' => $connection->id,
                    'received_at' => now(),
                ])
            );
        } catch (UniqueConstraintViolationException) {
            // Concurrent redelivery of the same event lost the race — the other
            // request already persisted it, nothing left to do here.
            return;
        }

        if (! $lead->wasRecentlyCreated) {
            return;
        }

        $this->tryAutoLinkCustomer($lead);
    }

    private function tryAutoLinkCustomer(FacebookLead $lead): void
    {
        if (! $lead->message || ! preg_match(self::BD_PHONE_PATTERN, $lead->message, $m)) {
            return;
        }

        $phone = PhoneIntelCache::normalizePhone($m[0]);
        if (strlen($phone) !== 11) {
            return;
        }

        try {
            $customer = Customer::firstOrCreate(
                ['user_id' => $lead->user_id, 'phone' => $phone],
                ['name' => $lead->sender_name, 'tags' => []]
            );
        } catch (UniqueConstraintViolationException) {
            $customer = Customer::where('user_id', $lead->user_id)->where('phone', $phone)->first();
            if (! $customer) {
                Log::warning('facebook.lead.customer_link_race_unresolved', ['lead_id' => $lead->id]);

                return;
            }
        }

        $lead->update(['detected_phone' => $phone, 'customer_id' => $customer->id]);
    }
}
