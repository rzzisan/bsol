<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id', 'package_id', 'previous_package_id', 'amount', 'base_amount', 'proration_credit',
    'invoice_breakdown', 'payment_method', 'sender_bkash_number',
    'trx_id', 'bkash_payment_id', 'screenshot_path', 'status', 'admin_note', 'reviewed_by', 'reviewed_at',
])]
class SubscriptionPayment extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'base_amount' => 'decimal:2',
            'proration_credit' => 'decimal:2',
            'invoice_breakdown' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function package()
    {
        return $this->belongsTo(SubscriptionPackage::class, 'package_id');
    }

    public function previousPackage()
    {
        return $this->belongsTo(SubscriptionPackage::class, 'previous_package_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
