<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'user_id', 'phone', 'name', 'email', 'address',
        'district', 'thana', 'area', 'notes', 'tags',
        'pathao_city_id', 'pathao_zone_id', 'pathao_area_id',
        'risk_level', 'fraud_score', 'is_blocked',
        'total_orders', 'total_spent', 'last_order_at',
    ];

    protected $casts = [
        'tags'          => 'array',
        'fraud_score'   => 'float',
        'is_blocked'    => 'boolean',
        'total_orders'  => 'integer',
        'total_spent'   => 'float',
        'last_order_at' => 'datetime',
    ];

    public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function orders(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        // Customer.user_id is always the shop owner id (see syncFromOrder below),
        // but individual Order rows carry the actual creator's id (which may be
        // a staff sub-account) — whereIn the whole shop pool, not just this id.
        // See staff_team_role_context.md §3.3.
        $shopUserIds = $this->user?->shopUserIds() ?? [$this->user_id];

        return $this->hasMany(Order::class, 'customer_phone', 'phone')
            ->whereIn('orders.user_id', $shopUserIds);
    }

    /**
     * Upsert a customer record from an order, updating aggregates.
     *
     * Keyed by the shop owner's id (not the order's own user_id, which is the
     * actual creator and may be a staff sub-account) so every team member
     * shares one aggregate customer profile per phone number instead of each
     * staff member fragmenting it into a separate row. See
     * staff_team_role_context.md §3.3.
     */
    public static function syncFromOrder(Order $order): self
    {
        $actingUser = $order->relationLoaded('user') ? $order->user : User::find($order->user_id);
        $shopOwnerId = $actingUser?->shopOwnerId() ?? $order->user_id;
        $shopUserIds = $actingUser?->shopUserIds() ?? [$order->user_id];

        $customer = self::firstOrNew([
            'user_id' => $shopOwnerId,
            'phone'   => $order->customer_phone,
        ]);

        if (! $customer->exists) {
            $customer->name           = $order->customer_name;
            $customer->address        = $order->customer_address;
            $customer->district       = $order->customer_district;
            $customer->thana          = $order->customer_thana;
            $customer->area           = $order->customer_area;
            $customer->pathao_city_id = $order->pathao_city_id;
            $customer->pathao_zone_id = $order->pathao_zone_id;
            $customer->pathao_area_id = $order->pathao_area_id;
            $customer->tags           = [];
        } else {
            if (empty($customer->name) && $order->customer_name)
                $customer->name = $order->customer_name;
            if (empty($customer->address) && $order->customer_address)
                $customer->address = $order->customer_address;
        }

        $agg = Order::whereIn('user_id', $shopUserIds)
            ->where('customer_phone', $order->customer_phone)
            ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total),0) as spent, MAX(created_at) as last_at')
            ->first();

        $customer->total_orders  = $agg->cnt ?? 0;
        $customer->total_spent   = $agg->spent ?? 0;
        $customer->last_order_at = $agg->last_at;
        $customer->save();

        return $customer;
    }
}
