<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourierFraudStat extends Model
{
    protected $fillable = [
        'phone_number', 'courier_name', 'data_type',
        'total_parcels', 'total_delivered', 'total_cancelled', 'success_rate', 'rating',
        'status', 'error_message', 'fetched_by_user_id', 'last_checked_at',
    ];

    protected $casts = [
        'last_checked_at' => 'datetime',
        'success_rate' => 'float',
    ];

    public function fetchedBy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class, 'fetched_by_user_id');
    }
}
