<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderCreditWallet extends Model
{
    protected $fillable = ['user_id', 'balance', 'expires_at'];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public static function walletFor(int $userId): static
    {
        return static::firstOrCreate(['user_id' => $userId], ['balance' => 0]);
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /** What's actually usable right now — 0 once expired, regardless of the stored balance (§9.3 decision #2, no rollover). */
    public function availableBalance(): int
    {
        return $this->isExpired() ? 0 : $this->balance;
    }
}
