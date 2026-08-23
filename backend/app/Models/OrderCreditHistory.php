<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderCreditHistory extends Model
{
    protected $fillable = ['user_id', 'type', 'credits', 'balance_after', 'order_id', 'addon_purchase_id', 'note'];

    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
