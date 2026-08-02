<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\SmsAutomationLog;
use App\Models\SmsAutomationRule;
use App\Services\SmsAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendAutomationSmsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $orderId,
        public int $ruleId,
        public ?int $logId = null,
    ) {}

    public int $tries = 3;

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function handle(SmsAutomationService $service): void
    {
        $order = Order::find($this->orderId);
        $rule = SmsAutomationRule::find($this->ruleId);

        if (! $order || ! $rule || ! $rule->is_active) {
            return;
        }

        $log = $this->logId ? SmsAutomationLog::find($this->logId) : null;

        $service->dispatchNow($order, $rule, $log);
    }

    public function failed(\Throwable $exception): void
    {
        // All 3 tries exhausted on a thrown exception (network/timeout) —
        // without this, the claimed 'queued' log row was previously left
        // stuck forever with no failure reason, and the seller saw nothing
        // in their automation log explaining why the SMS never went out.
        Log::error('sms_automation.job_failed', [
            'order_id' => $this->orderId,
            'rule_id' => $this->ruleId,
            'log_id' => $this->logId,
            'error' => $exception->getMessage(),
        ]);

        if (! $this->logId) {
            return;
        }

        $log = SmsAutomationLog::find($this->logId);
        if ($log && $log->status === 'queued') {
            $log->update([
                'status' => 'failed',
                'error_message' => 'Job failed after retries: ' . $exception->getMessage(),
            ]);
        }
    }
}
