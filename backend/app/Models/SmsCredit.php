<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsCredit extends Model
{
    protected $fillable = [
        'user_id', 'balance',
        'auto_recharge_enabled', 'auto_recharge_threshold', 'auto_recharge_credits',
        'auto_recharge_failure_count', 'auto_recharge_last_attempted_at',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
            'auto_recharge_enabled' => 'boolean',
            'auto_recharge_threshold' => 'integer',
            'auto_recharge_credits' => 'integer',
            'auto_recharge_failure_count' => 'integer',
            'auto_recharge_last_attempted_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get or create the credit wallet for a user.
     */
    public static function walletFor(int $userId): static
    {
        return static::firstOrCreate(
            ['user_id' => $userId],
            ['balance' => 0],
        );
    }
}
