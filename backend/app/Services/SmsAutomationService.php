<?php

namespace App\Services;

use App\Jobs\SendAutomationSmsJob;
use App\Models\Order;
use App\Models\SmsAutomationLog;
use App\Models\SmsAutomationRule;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SmsAutomationService
{
    public function __construct(private readonly SmsCreditService $creditService) {}

    public function handleOrderStatusChanged(Order $order, ?string $oldStatus, string $newStatus): void
    {
        if ($oldStatus === $newStatus) {
            return;
        }

        $triggerEvent = $this->statusToTriggerEvent($newStatus);
        if (! $triggerEvent) {
            return;
        }

        $rules = SmsAutomationRule::query()
            ->where('user_id', $order->user_id)
            ->where('is_active', true)
            ->where('trigger_event', $triggerEvent)
            ->get();

        foreach ($rules as $rule) {
            // Atomically claim this (rule, order, trigger_event) slot via the
            // partial-unique index on (rule_id, order_id, trigger_event)
            // WHERE status IN ('queued','sent'). Only one concurrent request
            // can win this insert, so two racing status-change calls can no
            // longer both pass a check-then-act "already sent?" read and
            // both actually send a real SMS.
            try {
                $log = SmsAutomationLog::create([
                    'user_id' => $order->user_id,
                    'rule_id' => $rule->id,
                    'order_id' => $order->id,
                    'trigger_event' => $triggerEvent,
                    'customer_phone' => $order->customer_phone,
                    'rendered_message' => $this->renderTemplate($rule->template_text, $order),
                    'status' => 'queued',
                    'error_message' => null,
                    'sent_at' => null,
                ]);
            } catch (UniqueConstraintViolationException) {
                SmsAutomationLog::create([
                    'user_id' => $order->user_id,
                    'rule_id' => $rule->id,
                    'order_id' => $order->id,
                    'trigger_event' => $triggerEvent,
                    'customer_phone' => $order->customer_phone,
                    'rendered_message' => null,
                    'status' => 'skipped',
                    'error_message' => 'Skipped duplicate trigger for this order/rule.',
                    'sent_at' => null,
                ]);
                continue;
            }

            if ((int) $rule->delay_minutes > 0) {
                SendAutomationSmsJob::dispatch($order->id, $rule->id, $log->id)
                    ->delay(now()->addMinutes((int) $rule->delay_minutes));

                continue;
            }

            $this->dispatchNow($order, $rule, $log);
        }
    }

    /**
     * Send the automation SMS and finish the claimed log row.
     *
     * $log is the 'queued' row already claimed by handleOrderStatusChanged()
     * (directly, or via SendAutomationSmsJob for delayed rules) — every
     * outcome below UPDATEs that same row rather than creating a new one, so
     * exactly one row tracks this dispatch attempt from claim to completion.
     * A $log is optional only for ad-hoc/manual callers outside the normal
     * trigger flow, which fall back to creating their own row (no claim to
     * reuse, so no duplicate-guard applies to that path).
     */
    public function dispatchNow(Order $order, SmsAutomationRule $rule, ?SmsAutomationLog $log = null): void
    {
        $message = $this->renderTemplate($rule->template_text, $order);
        $triggerEvent = $rule->trigger_event;

        $user = User::find($order->user_id);
        if (! $user) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'User not found.', log: $log);
            return;
        }

        if (! $user->sms_gateway_id) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'No SMS gateway assigned.', log: $log);
            return;
        }

        $gateway = SmsGateway::find($user->sms_gateway_id);
        if (! $gateway || ! $gateway->is_enabled) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Assigned gateway unavailable/disabled.', log: $log);
            return;
        }

        if (
            blank($gateway->endpoint_url)
            || blank($gateway->api_key)
            || blank($gateway->secret_key)
            || blank($gateway->sender_id)
        ) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Gateway credentials are incomplete.', log: $log);
            return;
        }

        if ($gateway->provider !== 'khudebarta') {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Gateway provider not supported yet.', log: $log);
            return;
        }

        $recipient = $this->formatBdPhoneNumber((string) $order->customer_phone);
        if (! $recipient) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Invalid customer phone number format.', log: $log);
            return;
        }

        $creditsRequired = $this->creditService->calculateCreditsRequired($message);
        $balance = $this->creditService->getBalance($user->id);
        if ($balance < $creditsRequired) {
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', "Insufficient SMS credits. Required {$creditsRequired}, available {$balance}.", log: $log);
            return;
        }

        try {
            $response = Http::asForm()
                ->timeout(20)
                ->post($gateway->endpoint_url, [
                    'apikey' => $gateway->api_key,
                    'secretkey' => $gateway->secret_key,
                    'callerID' => $gateway->sender_id,
                    'toUser' => $recipient,
                    'messageContent' => $message,
                ]);
        } catch (\Throwable $e) {
            // Network/timeout failure — record it explicitly rather than
            // letting the job retry silently with no log trail (this was a
            // real gap: SendAutomationSmsJob's retries produced no
            // SmsAutomationLog row at all on a thrown exception, so a seller
            // never saw why a message never went out).
            Log::warning('sms_automation.gateway_exception', [
                'order_id' => $order->id,
                'rule_id' => $rule->id,
                'message' => $e->getMessage(),
            ]);
            $this->finishAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Gateway request failed: ' . $e->getMessage(), log: $log);
            return;
        }

        $body = (string) $response->body();
        $looksFailed = preg_match('/(error|failed|invalid|unauthorized)/i', $body) === 1;
        $ok = $response->successful() && ! $looksFailed;

        SmsHistory::create([
            'gateway_id' => $gateway->id,
            'user_id' => $user->id,
            'gateway_name' => $gateway->name,
            'provider' => $gateway->provider,
            'phone_number' => $recipient,
            'message' => $message,
            'status' => $ok ? 'sent' : 'failed',
            'http_status_code' => $response->status(),
            'response_body' => mb_substr($body, 0, 4000),
            'error_message' => $ok ? null : 'Gateway responded with failure signal.',
            'sent_at' => $ok ? now() : null,
        ]);

        $creditWarning = null;
        if ($ok) {
            $deducted = $this->creditService->deduct(
                userId: $user->id,
                credits: $creditsRequired,
                note: "Automation SMS ({$triggerEvent}) for order {$order->order_number}",
            );

            if (! $deducted) {
                // The SMS was already sent (money spent with the gateway) —
                // that can't be undone — but the credit ledger didn't move,
                // which under concurrent sends previously vanished
                // silently. Surface it loudly instead of pretending the
                // charge succeeded.
                $creditWarning = "WARNING: credit deduction failed (required {$creditsRequired}, balance check race) — SMS was sent but not charged.";
                Log::warning('sms_automation.credit_deduction_failed', [
                    'user_id' => $user->id,
                    'order_id' => $order->id,
                    'rule_id' => $rule->id,
                    'credits_required' => $creditsRequired,
                ]);
            }
        }

        $this->finishAutomationLog(
            $order,
            $rule,
            $triggerEvent,
            $message,
            $ok ? 'sent' : 'failed',
            $ok ? $creditWarning : 'Gateway responded with failure signal.',
            $ok ? now() : null,
            log: $log,
        );
    }

    private function finishAutomationLog(
        Order $order,
        SmsAutomationRule $rule,
        string $triggerEvent,
        ?string $message,
        string $status,
        ?string $errorMessage,
        $sentAt = null,
        ?SmsAutomationLog $log = null,
    ): void {
        $attributes = [
            'rendered_message' => $message,
            'status' => $status,
            'error_message' => $errorMessage,
            'sent_at' => $sentAt,
        ];

        if ($log) {
            $log->fill($attributes)->save();
            return;
        }

        SmsAutomationLog::create($attributes + [
            'user_id' => $order->user_id,
            'rule_id' => $rule->id,
            'order_id' => $order->id,
            'trigger_event' => $triggerEvent,
            'customer_phone' => $order->customer_phone,
        ]);
    }

    private function renderTemplate(string $template, Order $order): string
    {
        $map = [
            '{customer_name}' => (string) ($order->customer_name ?: 'Customer'),
            '{order_number}' => (string) $order->order_number,
            '{total}' => number_format((float) $order->total, 2, '.', ''),
            '{courier}' => (string) ($order->courier_name ?: ''),
            '{tracking_id}' => (string) ($order->courier_tracking_id ?: ''),
            '{shop_name}' => (string) config('app.name', 'Shop'),
            '{delivery_date}' => now()->format('Y-m-d'),
        ];

        return trim(strtr($template, $map));
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

    private function formatBdPhoneNumber(string $phone): ?string
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
