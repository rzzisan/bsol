<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Transaction;

class AccountingService
{
    /**
     * "Whatever's due on the invoice at the moment it's handed to the
     * courier is the COD amount" (courier_status_sync_context.md §4.1) — an
     * advance already collected before booking (and, per that same rule,
     * already recorded as its own income by the seller) is never part of
     * it. `courier_cod_amount` is exactly that figure — the amount actually
     * asked of the courier at booking time (book()'s own `$data['cod_amount']
     * ?? $order->total`, see courier_waybill_context.md). For an order never
     * yet booked with a courier (`courier_cod_amount` still null), nothing
     * has reduced what's owed, so the full order total is still correct.
     */
    private function codIncomeAmount(Order $order): float
    {
        return (float) ($order->courier_cod_amount ?? $order->total);
    }

    public function onOrderCreated(Order $order): void
    {
        if ($order->payment_method !== 'cod') {
            return;
        }

        Transaction::updateOrCreate(
            [
                'user_id' => $order->user_id,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'type' => Transaction::TYPE_INCOME,
                'category' => 'order_cod',
            ],
            [
                'status' => Transaction::STATUS_PENDING,
                'amount' => $this->codIncomeAmount($order),
                'note' => 'COD income (pending at order creation).',
                'transaction_date' => now()->toDateString(),
                'is_auto' => true,
                'meta' => ['order_number' => $order->order_number],
            ]
        );
    }

    public function onOrderDelivered(Order $order): void
    {
        if ($order->payment_method !== 'cod') {
            return;
        }

        Transaction::updateOrCreate(
            [
                'user_id' => $order->user_id,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'type' => Transaction::TYPE_INCOME,
                'category' => 'order_cod',
            ],
            [
                'status' => Transaction::STATUS_CONFIRMED,
                'amount' => $this->codIncomeAmount($order),
                'note' => 'COD income confirmed on delivered order.',
                'transaction_date' => now()->toDateString(),
                'is_auto' => true,
                'meta' => ['order_number' => $order->order_number],
            ]
        );

        // The courier collected the full remaining balance on handover — a
        // "partial" order (advance already paid, rest COD) and a plain
        // "due" order are both fully settled the moment delivery succeeds.
        // Was never auto-set anywhere before (courier_status_sync_context.md
        // §2) — the order detail page's payment badge stayed on whatever it
        // was at creation forever, even after the money was in hand.
        if ($order->payment_status !== 'paid') {
            $order->update(['payment_status' => 'paid']);
        }
    }

    /**
     * Keep the pending/confirmed COD income transaction's amount in sync
     * when an order's total changes after creation (e.g. shipping_charge or
     * discount edited). Previously only courier-charge edits refreshed the
     * ledger, so editing shipping/discount left the income transaction
     * amount stale against the order's real total. No-op if no income
     * transaction exists yet for this order (nothing to refresh).
     */
    public function onOrderTotalUpdated(Order $order): void
    {
        if ($order->payment_method !== 'cod') {
            return;
        }

        Transaction::where('user_id', $order->user_id)
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_INCOME)
            ->where('category', 'order_cod')
            ->update([
                'amount' => $this->codIncomeAmount($order),
            ]);
    }

    public function onOrderCancelledOrReturned(Order $order): void
    {
        Transaction::where('user_id', $order->user_id)
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_INCOME)
            ->delete();

        // Mirrors onOrderDelivered()'s auto-paid: a return reverses a
        // delivery whose COD was already marked collected, so the money is
        // no longer in hand either. Only touches orders this same
        // auto-paid logic put into "paid" — a seller's own manual
        // "paid"/"partial" note (e.g. an advance kept despite the return)
        // is left alone.
        if ($order->payment_method === 'cod' && $order->payment_status === 'paid') {
            $order->update(['payment_status' => 'due']);
        }
    }

    /**
     * A manual payment collection (cash/bank/bKash/etc, taken directly by
     * the seller — not the courier's own COD remittance) is its own income
     * event, recorded independently of the order_cod/courier_charge
     * transactions above. See manual_payment_collection_context.md §3.
     * discount-only entries (amount 0) book no transaction — nothing was
     * actually collected — but still recompute payment_status below.
     *
     * $category defaults to the seller-manual-collection bucket; the online-
     * payment flow (online_payment_context.md) passes 'order_online_payment'
     * so the ledger can distinguish auto-collected-via-gateway money from
     * money a seller typed in themselves, without changing any other
     * behavior here — same OrderPayment row shape either way.
     */
    public function recordManualPayment(OrderPayment $payment, ?string $category = null): void
    {
        if ((float) $payment->amount > 0) {
            Transaction::create([
                'user_id' => $payment->user_id,
                'type' => Transaction::TYPE_INCOME,
                'status' => Transaction::STATUS_CONFIRMED,
                'category' => $category ?? 'order_manual_payment',
                'reference_type' => 'order_payment',
                'reference_id' => $payment->id,
                'amount' => $payment->amount,
                'note' => $category === 'order_online_payment'
                    ? "Online payment verified ({$payment->purpose}/{$payment->method}) for order {$payment->order->order_number}."
                    : "Manual payment collected ({$payment->purpose}/{$payment->method}) for order {$payment->order->order_number}.",
                'transaction_date' => $payment->collected_at->toDateString(),
                'is_auto' => true,
                'meta' => [
                    'order_id' => $payment->order_id,
                    'order_number' => $payment->order->order_number,
                    'purpose' => $payment->purpose,
                    'method' => $payment->method,
                ],
            ]);
        }

        $this->syncPaymentStatus($payment->order);
    }

    /**
     * Deletes a manual payment entry's linked ledger transaction — used when
     * a seller removes a bad entry. Deliberately does NOT call
     * syncPaymentStatus() itself: the caller must delete the OrderPayment
     * row first (dueAmount() sums live from that table), then call
     * syncPaymentStatus() separately — doing it here would recompute due
     * while the now-reversed payment row still exists.
     */
    public function reverseManualPayment(OrderPayment $payment): void
    {
        Transaction::where('reference_type', 'order_payment')
            ->where('reference_id', $payment->id)
            ->delete();
    }

    /** Recomputes payment_status from the real due amount after any manual-payment change. */
    public function syncPaymentStatus(Order $order): void
    {
        $due = $order->dueAmount();

        $newStatus = match (true) {
            $due <= 0.0 => 'paid',
            $due < (float) $order->total => 'partial',
            default => 'due',
        };

        if ($order->payment_status !== $newStatus) {
            $order->update(['payment_status' => $newStatus]);
        }
    }

    public function onCourierChargeUpdated(Order $order): void
    {
        $charge = (float) ($order->courier_charge ?? 0);

        if ($charge <= 0) {
            Transaction::where('user_id', $order->user_id)
                ->where('reference_type', 'order')
                ->where('reference_id', $order->id)
                ->where('type', Transaction::TYPE_EXPENSE)
                ->where('category', 'courier_charge')
                ->delete();
            return;
        }

        Transaction::updateOrCreate(
            [
                'user_id' => $order->user_id,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'type' => Transaction::TYPE_EXPENSE,
                'category' => 'courier_charge',
            ],
            [
                'status' => Transaction::STATUS_CONFIRMED,
                'amount' => $charge,
                'note' => 'Courier charge expense from order.',
                'transaction_date' => now()->toDateString(),
                'is_auto' => true,
                'meta' => ['order_number' => $order->order_number],
            ]
        );
    }
}
