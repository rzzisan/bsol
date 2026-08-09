<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Seller self-service SMS credit purchase — parallel to SubscriptionPayment
 * (subscription_billing_context.md §3). On approval (manual admin review or
 * bKash gateway auto-success) credits are granted via SmsCreditService::recharge().
 */
#[Fillable([
    'user_id', 'credits', 'rate_used', 'amount', 'payment_method', 'sender_bkash_number',
    'trx_id', 'bkash_payment_id', 'screenshot_path', 'status', 'admin_note', 'reviewed_by', 'reviewed_at',
])]
class SmsCreditPurchase extends Model
{
    protected function casts(): array
    {
        return [
            'rate_used' => 'decimal:4',
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
