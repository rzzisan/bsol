<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    public const CATEGORIES = ['billing', 'order', 'product', 'technical', 'account', 'other'];

    public const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

    public const STATUSES = ['open', 'pending', 'resolved', 'closed'];

    protected $fillable = [
        'ticket_number', 'user_id', 'subject', 'category', 'priority', 'status',
        'assigned_admin_id', 'ai_handled', 'escalated', 'escalation_reason',
        'last_message_at', 'last_message_preview', 'last_message_sender_type',
        'user_unread_count', 'admin_unread_count',
        'resolved_by', 'resolved_at', 'closed_by', 'closed_at',
    ];

    protected function casts(): array
    {
        return [
            'ai_handled' => 'boolean',
            'escalated' => 'boolean',
            'last_message_at' => 'datetime',
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_admin_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class, 'ticket_id');
    }
}
