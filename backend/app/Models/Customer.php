<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'user_id', 'phone', 'name', 'email', 'address',
        'district', 'thana', 'notes', 'tags',
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
        return $this->hasMany(Order::class, 'customer_phone', 'phone')
            ->where('orders.user_id', $this->user_id);
    }

    /**
     * Upsert a customer record from an order, updating aggregates.
     */
    public static function syncFromOrder(Order $order): self
    {
        $customer = self::firstOrNew([
            'user_id' => $order->user_id,
            'phone'   => $order->customer_phone,
        ]);

        if (! $customer->exists) {
            $customer->name     = $order->customer_name;
            $customer->address  = $order->customer_address;
            $customer->district = $order->customer_district;
            $customer->thana    = $order->customer_thana;
            $customer->tags     = [];
        } else {
            if (empty($customer->name) && $order->customer_name)
                $customer->name = $order->customer_name;
            if (empty($customer->address) && $order->customer_address)
                $customer->address = $order->customer_address;
        }

        $agg = Order::where('user_id', $order->user_id)
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
