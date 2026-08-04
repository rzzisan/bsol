<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FacebookLead extends Model
{
    protected $fillable = [
        'user_id', 'facebook_page_connection_id', 'channel', 'fb_event_id',
        'sender_fb_id', 'sender_name', 'message', 'post_id', 'thread_id',
        'detected_phone', 'customer_id', 'status', 'is_read', 'raw_payload',
        'received_at', 'replied_at', 'reply_message',
    ];

    protected function casts(): array
    {
        return [
            'raw_payload' => 'array',
            'is_read' => 'boolean',
            'received_at' => 'datetime',
            'replied_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pageConnection(): BelongsTo
    {
        return $this->belongsTo(FacebookPageConnection::class, 'facebook_page_connection_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
