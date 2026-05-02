<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Order extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id', 'order_number', 'customer_name', 'customer_phone',
        'customer_address', 'customer_district', 'customer_thana',
        'source', 'source_ref', 'status', 'payment_method', 'payment_status',
        'subtotal', 'shipping_charge', 'discount', 'total', 'notes',
        'fraud_score', 'risk_level',
        'courier_name', 'courier_tracking_id', 'courier_status', 'courier_charge',
        'assigned_to',
    ];

    protected $casts = [
        'subtotal'       => 'decimal:2',
        'shipping_charge' => 'decimal:2',
        'discount'       => 'decimal:2',
        'total'          => 'decimal:2',
        'courier_charge' => 'decimal:2',
        'fraud_score'    => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(OrderStatusLog::class)->orderBy('created_at', 'desc');
    }

    /** Generate next order number like ORD-20260502-0001 */
    public static function generateOrderNumber(int $userId): string
    {
        $prefix = 'ORD-' . now()->format('Ymd') . '-';
        $last   = static::where('user_id', $userId)
            ->where('order_number', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('order_number');

        $seq = $last ? ((int) substr($last, -4)) + 1 : 1;
        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}
