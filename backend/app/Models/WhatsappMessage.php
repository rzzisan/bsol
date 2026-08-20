<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsappMessage extends Model
{
    protected $fillable = [
        'user_id', 'whatsapp_business_connection_id', 'direction', 'wa_message_id',
        'wa_id', 'contact_name', 'message_type', 'body', 'template_name', 'status',
        'customer_id', 'is_read', 'raw_payload', 'sent_at', 'received_at',
    ];

    protected function casts(): array
    {
        return [
            'raw_payload' => 'array',
            'is_read' => 'boolean',
            'sent_at' => 'datetime',
            'received_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(WhatsappBusinessConnection::class, 'whatsapp_business_connection_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
