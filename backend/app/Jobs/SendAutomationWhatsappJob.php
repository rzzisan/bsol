<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\WhatsappAutomationLog;
use App\Models\WhatsappAutomationRule;
use App\Services\Whatsapp\WhatsappAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/** Mirrors SendAutomationSmsJob exactly — see that class for the reasoning. */
class SendAutomationWhatsappJob implements ShouldQueue
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

    public function handle(WhatsappAutomationService $service): void
    {
        $order = Order::find($this->orderId);
        $rule = WhatsappAutomationRule::find($this->ruleId);

        if (! $order || ! $rule || ! $rule->is_active) {
            return;
        }

        $log = $this->logId ? WhatsappAutomationLog::find($this->logId) : null;

        $service->dispatchNow($order, $rule, $log);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('whatsapp_automation.job_failed', [
            'order_id' => $this->orderId,
            'rule_id' => $this->ruleId,
            'log_id' => $this->logId,
            'error' => $exception->getMessage(),
        ]);

        if (! $this->logId) {
            return;
        }

        $log = WhatsappAutomationLog::find($this->logId);
        if ($log && $log->status === 'queued') {
            $log->update([
                'status' => 'failed',
                'error_message' => 'Job failed after retries: ' . $exception->getMessage(),
            ]);
        }
    }
}
