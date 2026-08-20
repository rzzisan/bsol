<?php

namespace App\Services\Whatsapp;

use App\Jobs\SendAutomationWhatsappJob;
use App\Models\Order;
use App\Models\WhatsappAutomationLog;
use App\Models\WhatsappAutomationRule;
use App\Models\WhatsappBusinessConnection;
use App\Models\WhatsappMessage;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Structural port of SmsAutomationService — same trigger→claim→dispatch
 * shape, same partial-unique-index race-safety pattern
 * (whatsapp_automation_logs_active_claim_unique, mirrors
 * sms_automation_logs_active_claim_unique). No SMS-credit-style wallet
 * step: WhatsApp Cloud API's conversation-based pricing is billed by Meta
 * directly to the seller's own Business account, not brokered through us.
 * See whatsapp_context.md.
 */
class WhatsappAutomationService
{
    public function handleOrderStatusChanged(Order $order, ?string $oldStatus, string $newStatus): void
    {
        if ($oldStatus === $newStatus) {
            return;
        }

        $triggerEvent = $this->statusToTriggerEvent($newStatus);
        if (! $triggerEvent) {
            return;
        }

        $rules = WhatsappAutomationRule::query()
            ->where('user_id', $order->user_id)
            ->where('is_active', true)
            ->where('trigger_event', $triggerEvent)
            ->get();

        foreach ($rules as $rule) {
            try {
                // Wrapped in its own transaction so a caught unique-
                // violation only rolls back to a savepoint, not the whole
                // connection — under Postgres, an uncaught constraint
                // error inside an ambient transaction (e.g. a caller that
                // wraps this in DB::transaction(), or a test's
                // RefreshDatabase wrapper) poisons every subsequent
                // statement on that connection until rollback, which would
                // break the very fallback insert in the catch block below.
                $log = DB::transaction(fn () => WhatsappAutomationLog::create([
                    'user_id' => $order->user_id,
                    'rule_id' => $rule->id,
                    'order_id' => $order->id,
                    'trigger_event' => $triggerEvent,
                    'customer_phone' => $order->customer_phone,
                    'template_name' => $rule->template_name,
                    'status' => 'queued',
                ]));
            } catch (UniqueConstraintViolationException) {
                WhatsappAutomationLog::create([
                    'user_id' => $order->user_id,
                    'rule_id' => $rule->id,
                    'order_id' => $order->id,
                    'trigger_event' => $triggerEvent,
                    'customer_phone' => $order->customer_phone,
                    'status' => 'skipped',
                    'error_message' => 'Skipped duplicate trigger for this order/rule.',
                ]);
                continue;
            }

            if ((int) $rule->delay_minutes > 0) {
                SendAutomationWhatsappJob::dispatch($order->id, $rule->id, $log->id)
                    ->delay(now()->addMinutes((int) $rule->delay_minutes));

                continue;
            }

            $this->dispatchNow($order, $rule, $log);
        }
    }

    public function dispatchNow(Order $order, WhatsappAutomationRule $rule, ?WhatsappAutomationLog $log = null): void
    {
        $triggerEvent = $rule->trigger_event;

        $connection = WhatsappBusinessConnection::where('user_id', $order->user_id)->first();
        if (! $connection || ! $connection->isConnected()) {
            $this->finish($order, $rule, $triggerEvent, null, 'failed', 'WhatsApp is not connected.', log: $log);
            return;
        }

        $to = $this->formatWhatsappNumber((string) $order->customer_phone);
        if (! $to) {
            $this->finish($order, $rule, $triggerEvent, null, 'failed', 'Invalid customer phone number format.', log: $log);
            return;
        }

        $params = $this->resolveParams($rule->variable_mapping ?? [], $order);

        $result = app(WhatsappCloudApiClient::class)->sendTemplateMessage(
            $connection->phone_number_id,
            $connection->access_token,
            $to,
            $rule->template_name,
            $rule->language_code ?: 'en_US',
            $params,
        );

        if (! $result) {
            $this->finish($order, $rule, $triggerEvent, $params, 'failed', 'WhatsApp rejected the template send — check the template name/language are approved and match the variable count.', log: $log);
            return;
        }

        WhatsappMessage::create([
            'user_id' => $order->user_id,
            'whatsapp_business_connection_id' => $connection->id,
            'direction' => 'outbound',
            'wa_message_id' => $result['wa_message_id'],
            'wa_id' => $to,
            'message_type' => 'template',
            'template_name' => $rule->template_name,
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        $this->finish($order, $rule, $triggerEvent, $params, 'sent', null, now(), log: $log);
    }

    private function finish(
        Order $order,
        WhatsappAutomationRule $rule,
        string $triggerEvent,
        ?array $params,
        string $status,
        ?string $errorMessage,
        $sentAt = null,
        ?WhatsappAutomationLog $log = null,
    ): void {
        $attributes = [
            'template_name' => $rule->template_name,
            'rendered_params' => $params,
            'status' => $status,
            'error_message' => $errorMessage,
            'sent_at' => $sentAt,
        ];

        if ($log) {
            $log->fill($attributes)->save();
            return;
        }

        WhatsappAutomationLog::create($attributes + [
            'user_id' => $order->user_id,
            'rule_id' => $rule->id,
            'order_id' => $order->id,
            'trigger_event' => $triggerEvent,
            'customer_phone' => $order->customer_phone,
        ]);
    }

    /**
     * Same placeholder vocabulary as SmsAutomationService::renderTemplate(),
     * duplicated rather than shared — see class docblock.
     */
    private function resolveParams(array $variableMapping, Order $order): array
    {
        $map = [
            'customer_name' => (string) ($order->customer_name ?: 'Customer'),
            'order_number' => (string) $order->order_number,
            'total' => number_format((float) $order->total, 2, '.', ''),
            'courier' => (string) ($order->courier_name ?: ''),
            'tracking_id' => (string) ($order->courier_tracking_id ?: ''),
            'shop_name' => (string) config('app.name', 'Shop'),
            'delivery_date' => now()->format('Y-m-d'),
        ];

        return array_map(fn ($key) => $map[$key] ?? '', $variableMapping);
    }

    private function statusToTriggerEvent(string $status): ?string
    {
        return match ($status) {
            'confirmed' => 'order_confirmed',
            'shipped' => 'order_shipped',
            'delivered' => 'order_delivered',
            'cancelled' => 'order_cancelled',
            default => null,
        };
    }

    /** Same normalization convention as SmsAutomationService::formatBdPhoneNumber(), duplicated for the same reason. */
    private function formatWhatsappNumber(string $phone): ?string
    {
        $number = preg_replace('/[^0-9]/', '', $phone);

        if (str_starts_with($number, '00880')) {
            $number = substr($number, 2);
        }

        if (str_starts_with($number, '880')) {
            // already normalized
        } elseif (str_starts_with($number, '01')) {
            $number = '88' . $number;
        } elseif (strlen($number) === 10 && str_starts_with($number, '1')) {
            $number = '880' . $number;
        } else {
            $number = '88' . $number;
        }

        return preg_match('/^8801[0-9]{9}$/', $number) === 1 ? $number : null;
    }
}
