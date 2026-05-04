<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Transaction;

class AccountingService
{
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
                'amount' => (float) $order->total,
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
                'amount' => (float) $order->total,
                'note' => 'COD income confirmed on delivered order.',
                'transaction_date' => now()->toDateString(),
                'is_auto' => true,
                'meta' => ['order_number' => $order->order_number],
            ]
        );
    }

    public function onOrderCancelledOrReturned(Order $order): void
    {
        Transaction::where('user_id', $order->user_id)
            ->where('reference_type', 'order')
            ->where('reference_id', $order->id)
            ->where('type', Transaction::TYPE_INCOME)
            ->delete();
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
