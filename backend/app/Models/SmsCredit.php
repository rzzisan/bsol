<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsCredit extends Model
{
    protected $fillable = ['user_id', 'balance'];

    protected function casts(): array
    {
        return [
            'balance' => 'integer',
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
