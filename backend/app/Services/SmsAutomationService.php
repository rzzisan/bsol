<?php

namespace App\Services;

use App\Jobs\SendAutomationSmsJob;
use App\Models\Order;
use App\Models\SmsAutomationLog;
use App\Models\SmsAutomationRule;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;
use Illuminate\Support\Facades\Http;

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
            $alreadySent = SmsAutomationLog::query()
                ->where('rule_id', $rule->id)
                ->where('order_id', $order->id)
                ->where('trigger_event', $triggerEvent)
                ->where('status', 'sent')
                ->exists();

            if ($alreadySent) {
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
                SmsAutomationLog::create([
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

                SendAutomationSmsJob::dispatch($order->id, $rule->id)
                    ->delay(now()->addMinutes((int) $rule->delay_minutes));

                continue;
            }

            $this->dispatchNow($order, $rule);
        }
    }

    public function dispatchNow(Order $order, SmsAutomationRule $rule): void
    {
        $message = $this->renderTemplate($rule->template_text, $order);
        $triggerEvent = $rule->trigger_event;

        $user = User::find($order->user_id);
        if (! $user) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'User not found.');
            return;
        }

        if (! $user->sms_gateway_id) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'No SMS gateway assigned.');
            return;
        }

        $gateway = SmsGateway::find($user->sms_gateway_id);
        if (! $gateway || ! $gateway->is_enabled) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Assigned gateway unavailable/disabled.');
            return;
        }

        if (
            blank($gateway->endpoint_url)
            || blank($gateway->api_key)
            || blank($gateway->secret_key)
            || blank($gateway->sender_id)
        ) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Gateway credentials are incomplete.');
            return;
        }

        if ($gateway->provider !== 'khudebarta') {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Gateway provider not supported yet.');
            return;
        }

        $recipient = $this->formatBdPhoneNumber((string) $order->customer_phone);
        if (! $recipient) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', 'Invalid customer phone number format.');
            return;
        }

        $creditsRequired = $this->creditService->calculateCreditsRequired($message);
        $balance = $this->creditService->getBalance($user->id);
        if ($balance < $creditsRequired) {
            $this->createAutomationLog($order, $rule, $triggerEvent, $message, 'failed', "Insufficient SMS credits. Required {$creditsRequired}, available {$balance}.");
            return;
        }

        $response = Http::asForm()
            ->timeout(20)
            ->post($gateway->endpoint_url, [
                'apikey' => $gateway->api_key,
                'secretkey' => $gateway->secret_key,
                'callerID' => $gateway->sender_id,
                'toUser' => $recipient,
                'messageContent' => $message,
            ]);

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

        if ($ok) {
            $this->creditService->deduct(
                userId: $user->id,
                credits: $creditsRequired,
                note: "Automation SMS ({$triggerEvent}) for order {$order->order_number}",
            );
        }

        $this->createAutomationLog(
            $order,
            $rule,
            $triggerEvent,
            $message,
            $ok ? 'sent' : 'failed',
            $ok ? null : 'Gateway responded with failure signal.',
            $ok ? now() : null,
        );
    }

    private function createAutomationLog(
        Order $order,
        SmsAutomationRule $rule,
        string $triggerEvent,
        ?string $message,
        string $status,
        ?string $errorMessage,
        $sentAt = null,
    ): void {
        SmsAutomationLog::create([
            'user_id' => $order->user_id,
            'rule_id' => $rule->id,
            'order_id' => $order->id,
            'trigger_event' => $triggerEvent,
            'customer_phone' => $order->customer_phone,
            'rendered_message' => $message,
            'status' => $status,
            'error_message' => $errorMessage,
            'sent_at' => $sentAt,
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
