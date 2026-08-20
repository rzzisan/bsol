<?php

namespace App\Jobs;

use App\Models\SavedPaymentMethod;
use App\Models\SmsCredit;
use App\Models\SmsCreditPurchase;
use App\Models\SmsCreditSetting;
use App\Models\User;
use App\Services\NotificationDispatchService;
use App\Services\Payment\BkashPaymentGatewayClient;
use App\Services\SmsCreditService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Dispatched by SmsCreditService::deduct() when a wallet drops to/under
 * its auto_recharge_threshold. See auto_top_up_context.md.
 *
 * tries = 1, deliberately no automatic retry: chargeAgreement() creates a
 * new bKash paymentID every call, so Laravel retrying this job on a
 * transient failure (timeout, worker restart mid-flight) risks a second
 * real charge for the same shortfall. The next SMS send that still finds
 * the balance under threshold will naturally re-trigger this job anyway
 * (SmsCreditService::maybeTriggerAutoRecharge()'s cooldown just rate-
 * limits how often, it doesn't skip retrying) — safer to under-retry a
 * money-moving job than to over-retry one.
 */
class AutoRechargeSmsCreditJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    private const MAX_CONSECUTIVE_FAILURES = 3;

    public function __construct(private readonly int $userId) {}

    public function handle(BkashPaymentGatewayClient $bkash, SmsCreditService $creditService, NotificationDispatchService $notifications): void
    {
        $wallet = SmsCredit::where('user_id', $this->userId)->first();
        $method = SavedPaymentMethod::where('user_id', $this->userId)->where('provider', 'bkash')->first();

        // Re-check everything fresh — the dispatching deduct() call may be
        // stale by the time this job actually runs (balance topped up
        // manually meanwhile, auto-recharge disabled, agreement cancelled).
        if (! $wallet || ! $wallet->auto_recharge_enabled || $wallet->auto_recharge_credits <= 0) {
            return;
        }
        if ($wallet->balance > $wallet->auto_recharge_threshold) {
            return;
        }
        if (! $method || ! $method->isActive()) {
            return;
        }

        $wallet->update(['auto_recharge_last_attempted_at' => now()]);

        $user = User::find($this->userId);
        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $credits = $wallet->auto_recharge_credits;
        $amount = round($credits * $rate, 2);

        $purchase = SmsCreditPurchase::create([
            'user_id' => $this->userId,
            'credits' => $credits,
            'rate_used' => $rate,
            'amount' => $amount,
            'payment_method' => 'bkash_auto_recharge',
            'status' => 'pending',
        ]);

        $result = $this->charge($bkash, $method->agreement_id, $amount, $purchase->id);

        if (! $result) {
            $this->recordFailure($wallet, $purchase, $user, $notifications, 'bKash agreement charge failed.');

            return;
        }

        $purchase->update([
            'status' => 'approved',
            'trx_id' => $result['trxID'],
            'bkash_payment_id' => $result['paymentID'],
            'reviewed_at' => now(),
        ]);

        $creditService->recharge(
            userId: $this->userId,
            credits: $credits,
            rechargedBy: null,
            note: "Auto-recharge via saved bKash agreement (purchase #{$purchase->id})",
        );

        $wallet->update(['auto_recharge_failure_count' => 0]);

        if ($user) {
            $notifications->dispatch($user, 'sms_auto_recharge_success', $user->mobile, $user->email, [
                'credits' => $credits,
                'amount' => number_format($amount, 2),
                'trx_id' => $result['trxID'],
            ]);
        }
    }

    /** @return array{trxID:?string, paymentID:string}|null */
    private function charge(BkashPaymentGatewayClient $bkash, string $agreementId, float $amount, int $purchaseId): ?array
    {
        $created = $bkash->chargeAgreement($agreementId, number_format($amount, 2, '.', ''), 'SMSAR' . $purchaseId);
        if (! $created) {
            return null;
        }

        $executed = $bkash->executePayment($created['paymentID']);
        if (! $executed || $executed['transactionStatus'] !== 'Completed') {
            Log::warning('bKash auto-recharge execute did not complete', [
                'purchase_id' => $purchaseId,
                'status' => $executed['transactionStatus'] ?? 'no response',
            ]);

            return null;
        }

        return ['trxID' => $executed['trxID'], 'paymentID' => $created['paymentID']];
    }

    private function recordFailure(SmsCredit $wallet, SmsCreditPurchase $purchase, ?User $user, NotificationDispatchService $notifications, string $reason): void
    {
        $purchase->update(['status' => 'rejected', 'admin_note' => $reason]);

        $failureCount = $wallet->auto_recharge_failure_count + 1;
        $wallet->update(['auto_recharge_failure_count' => $failureCount]);

        if (! $user) {
            return;
        }

        if ($failureCount >= self::MAX_CONSECUTIVE_FAILURES) {
            $wallet->update(['auto_recharge_enabled' => false]);
            $notifications->dispatch($user, 'sms_auto_recharge_disabled', $user->mobile, $user->email, [
                'failure_count' => $failureCount,
            ]);

            return;
        }

        $notifications->dispatch($user, 'sms_auto_recharge_failed', $user->mobile, $user->email, [
            'failure_count' => $failureCount,
        ]);
    }
}
