<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\SmsAutomationRule;
use App\Services\SmsAutomationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendAutomationSmsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $orderId,
        public int $ruleId,
    ) {}

    public int $tries = 3;

    public function handle(SmsAutomationService $service): void
    {
        $order = Order::find($this->orderId);
        $rule = SmsAutomationRule::find($this->ruleId);

        if (! $order || ! $rule || ! $rule->is_active) {
            return;
        }

        $service->dispatchNow($order, $rule);
    }
}
