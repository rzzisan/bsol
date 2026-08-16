<?php

namespace App\Services;

use App\Models\Order;
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
