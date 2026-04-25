<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SmsCreditHistory extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'credits',
        'balance_before',
        'balance_after',
        'note',
        'recharged_by',
    ];

    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'balance_before' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function rechargedBy()
    {
        return $this->belongsTo(User::class, 'recharged_by');
    }
}
