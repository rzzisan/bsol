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
        'user_id', 'order_number', 'public_token', 'customer_name', 'customer_phone',
        'customer_address', 'customer_district', 'customer_thana', 'customer_area',
        'pathao_city_id', 'pathao_zone_id', 'pathao_area_id', 'redx_area_id',
        'source', 'source_ref', 'platform_api_key_id', 'status', 'payment_method', 'payment_status',
        'subtotal', 'shipping_charge', 'discount', 'total', 'notes', 'custom_fields',
        'fraud_score', 'risk_level',
        'courier_name', 'courier_tracking_id', 'courier_status', 'courier_charge',
        'courier_cod_amount', 'courier_weight_kg', 'courier_booked_at',
        'assigned_to', 'otp_required', 'otp_verified_at',
    ];

    protected $casts = [
        'subtotal'       => 'decimal:2',
        'shipping_charge' => 'decimal:2',
        'discount'       => 'decimal:2',
        'total'          => 'decimal:2',
        'courier_charge' => 'decimal:2',
        'courier_cod_amount' => 'decimal:2',
        'courier_weight_kg' => 'decimal:2',
        'courier_booked_at' => 'datetime',
        'fraud_score'    => 'integer',
        'custom_fields'  => 'array',
        'otp_required'   => 'boolean',
        'otp_verified_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function platformApiKey(): BelongsTo
    {
        return $this->belongsTo(PlatformApiKey::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function statusLogs(): HasMany
    {
        return $this->hasMany(OrderStatusLog::class)->orderBy('created_at', 'desc');
    }

    /**
     * Generate next order number like ORD-20260502-0001.
     *
     * Accepts the whole shop pool (owner + staff, see
     * staff_team_role_context.md §3.3) rather than a single user id, so the
     * sequence stays team-wide unique/sequential regardless of which staff
     * member actually created the order — a per-creator sequence would let
     * two team members collide on the same order number the same day.
     *
     * @param int|array<int, int> $shopUserIds
     */
    public static function generateOrderNumber(int|array $shopUserIds): string
    {
        $shopUserIds = (array) $shopUserIds;
        $prefix = 'ORD-' . now()->format('Ymd') . '-';
        $last   = static::whereIn('user_id', $shopUserIds)
            ->where('order_number', 'like', $prefix . '%')
            ->orderByDesc('id')
            ->value('order_number');

        $seq = $last ? ((int) substr($last, -4)) + 1 : 1;
        return $prefix . str_pad($seq, 4, '0', STR_PAD_LEFT);
    }
}
