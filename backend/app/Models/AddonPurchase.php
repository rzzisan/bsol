<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'user_id', 'addon_package_id', 'amount', 'payment_method', 'sender_bkash_number',
    'trx_id', 'bkash_payment_id', 'screenshot_path', 'status', 'admin_note', 'reviewed_by', 'reviewed_at',
    // Bug caught live-verifying this feature (2026-08-23): missing here
    // meant AddonApplyService::apply()'s idempotency stamp
    // (`$purchase->update(['applied_at' => now()])`) silently no-op'd —
    // credits still got granted (grant() ran fine), but the guard against
    // a second apply() call on the same purchase was dead. The
    // controller's own status!=='pending' check happened to mask this in
    // the normal approve flow, so it wasn't caught by the test suite.
    'applied_at',
])]
class AddonPurchase extends Model
{
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'reviewed_at' => 'datetime',
            'applied_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function addonPackage()
    {
        return $this->belongsTo(AddonPackage::class);
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
