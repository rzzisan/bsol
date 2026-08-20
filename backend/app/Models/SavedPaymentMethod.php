<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * A reusable, previously-authorized charge target (currently bKash
 * Agreement only). See auto_top_up_context.md. agreement_id is encrypted
 * at rest and must never appear in any API response — only a boolean
 * "connected"/status derived from this row should ever be exposed.
 */
#[Fillable(['user_id', 'provider', 'agreement_id', 'pending_payment_id', 'payer_reference', 'status'])]
class SavedPaymentMethod extends Model
{
    protected function casts(): array
    {
        return [
            'agreement_id' => 'encrypted',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'active' && filled($this->agreement_id);
    }
}
