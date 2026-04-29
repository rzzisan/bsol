<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailOtpVerification extends Model
{
    protected $fillable = [
        'token',
        'email',
        'otp_code',
        'verification_token',
        'purpose',
        'pending_data',
        'attempts',
        'resend_count',
        'last_sent_at',
        'next_resend_at',
        'blocked_until',
        'expires_at',
        'verified_at',
    ];

    protected function casts(): array
    {
        return [
            'pending_data' => 'array',
            'last_sent_at' => 'datetime',
            'next_resend_at' => 'datetime',
            'blocked_until' => 'datetime',
            'expires_at'   => 'datetime',
            'verified_at'  => 'datetime',
        ];
    }

    public function isExpired(): bool
    {
        return now()->gt($this->expires_at);
    }
}
