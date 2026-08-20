<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WhatsappBusinessConnection extends Model
{
    protected $fillable = [
        'user_id', 'phone_number_id', 'waba_id', 'display_phone_number',
        'access_token', 'status', 'last_error', 'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'access_token' => 'encrypted',
            'verified_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WhatsappMessage::class);
    }

    public function isConnected(): bool
    {
        return $this->status === 'connected' && filled($this->access_token) && filled($this->phone_number_id);
    }

    /** Admin/seller-display version — access_token never round-trips. */
    public function masked(): array
    {
        return [
            'phone_number_id' => $this->phone_number_id,
            'waba_id' => $this->waba_id,
            'display_phone_number' => $this->display_phone_number,
            'access_token_set' => filled($this->access_token),
            'status' => $this->status,
            'last_error' => $this->last_error,
            'verified_at' => $this->verified_at,
        ];
    }
}
