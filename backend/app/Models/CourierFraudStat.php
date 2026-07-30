<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourierFraudStat extends Model
{
    protected $fillable = [
        'phone_number', 'courier_name',
        'total_parcels', 'total_delivered', 'total_cancelled', 'success_rate',
        'status', 'error_message', 'fetched_by_user_id', 'last_checked_at',
    ];

    protected $casts = [
        'last_checked_at' => 'datetime',
        'success_rate' => 'float',
    ];
}
