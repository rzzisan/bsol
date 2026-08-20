<?php

namespace App\Services;

use App\Jobs\AutoRechargeSmsCreditJob;
use App\Models\SmsCredit;
use App\Models\SmsCreditHistory;
use App\Models\SmsCreditSetting;
use Illuminate\Support\Facades\DB;

class SmsCreditService
{
    /**
     * Calculate how many SMS segments (= credits) a message consumes.
     * Unicode detection: if any character is outside the GSM-7 basic charset we treat as Unicode.
     */
    public function calculateCreditsRequired(string $message): int
    {
        $settings = SmsCreditSetting::getSetting();

        $isUnicode = $this->isUnicodeMessage($message);
        $charsPerSegment = $isUnicode
            ? (int) $settings->chars_per_credit_unicode
            : (int) $settings->chars_per_credit_english;

        $len = mb_strlen($message);

        return max(1, (int) ceil($len / $charsPerSegment));
    }

    /**
     * Get balance for a user (0 if no wallet yet).
     */
    public function getBalance(int $userId): int
    {
        return SmsCredit::walletFor($userId)->balance;
    }

    /**
     * Recharge credits for a user.
     * Returns the new balance.
     */
    public function recharge(int $userId, int $credits, ?int $rechargedBy = null, ?string $note = null): int
    {
        return DB::transaction(function () use ($userId, $credits, $rechargedBy, $note) {
            $wallet = SmsCredit::walletFor($userId);

            $balanceBefore = $wallet->balance;
            $wallet->increment('balance', $credits);
            $balanceAfter = $balanceBefore + $credits;

            SmsCreditHistory::create([
                'user_id' => $userId,
                'type' => 'recharge',
                'credits' => $credits,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'note' => $note,
                'recharged_by' => $rechargedBy,
            ]);

            return $balanceAfter;
        });
    }

    /**
     * Deduct credits for a user.
     * Returns false if insufficient balance; true on success.
     */
    public function deduct(int $userId, int $credits, ?string $note = null): bool
    {
        $wallet = DB::transaction(function () use ($userId, $credits, $note) {
            $wallet = SmsCredit::where('user_id', $userId)->lockForUpdate()->first();

            if (! $wallet || $wallet->balance < $credits) {
                return false;
            }

            $balanceBefore = $wallet->balance;
            $wallet->decrement('balance', $credits);
            $balanceAfter = $balanceBefore - $credits;

            SmsCreditHistory::create([
                'user_id' => $userId,
                'type' => 'deduct',
                'credits' => $credits,
                'balance_before' => $balanceBefore,
                'balance_after' => $balanceAfter,
                'note' => $note,
                'recharged_by' => null,
            ]);

            return $wallet;
        });

        if (! $wallet) {
            return false;
        }

        // Fail-open: auto-recharge is a fire-and-forget side effect of a
        // deduction that has already succeeded — nothing here can turn
        // this deduct() call itself into a failure. See
        // auto_top_up_context.md.
        $this->maybeTriggerAutoRecharge($wallet);

        return true;
    }

    /**
     * Dispatches the auto-recharge job at most once per cooldown window —
     * cheap enough to call after every deduction (single in-memory model,
     * no extra query) without needing its own scheduled sweep.
     */
    private function maybeTriggerAutoRecharge(SmsCredit $wallet): void
    {
        if (! $wallet->auto_recharge_enabled || $wallet->auto_recharge_credits <= 0) {
            return;
        }

        if ($wallet->balance > $wallet->auto_recharge_threshold) {
            return;
        }

        $cooldownUntil = $wallet->auto_recharge_last_attempted_at?->addMinutes(10);
        if ($cooldownUntil && $cooldownUntil->isFuture()) {
            return;
        }

        try {
            AutoRechargeSmsCreditJob::dispatch($wallet->user_id);
        } catch (\Throwable) {
            // Queue connection hiccup shouldn't affect the SMS that was
            // just sent/deducted for — this is best-effort only.
        }
    }

    /**
     * Naive Unicode detection: if any codepoint is > 127, treat as Unicode.
     */
    private function isUnicodeMessage(string $message): bool
    {
        return strlen($message) !== mb_strlen($message);
    }
}
