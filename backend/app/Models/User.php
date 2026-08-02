<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use App\Models\NotificationDispatchLog;
use App\Models\NotificationTemplate;
use App\Models\NotificationUseCaseBinding;
use App\Models\SubscriptionPackage;
use App\Models\SmsGateway;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'mobile', 'mobile_verified_at', 'email', 'email_verified_at', 'password', 'role', 'user_status', 'subscription_package_id', 'sms_gateway_id', 'subscription_status', 'subscription_started_at', 'subscription_ends_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at'      => 'datetime',
            'mobile_verified_at'     => 'datetime',
            'password'               => 'hashed',
            'subscription_started_at' => 'datetime',
            'subscription_ends_at'    => 'datetime',
            'deleted_at'              => 'datetime',
        ];
    }

    public function subscriptionPackage()
    {
        return $this->belongsTo(SubscriptionPackage::class, 'subscription_package_id');
    }

    public function subscriptionPayments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }

    public function isSubscriptionExpired(): bool
    {
        return $this->subscription_status === 'expired'
            || ($this->subscription_ends_at !== null && $this->subscription_ends_at->isPast());
    }

    public function assignedGateway()
    {
        return $this->belongsTo(SmsGateway::class, 'sms_gateway_id');
    }

    public function emailConfigurations()
    {
        return $this->hasMany(EmailConfiguration::class);
    }

    public function notificationTemplates()
    {
        return $this->hasMany(NotificationTemplate::class);
    }

    public function notificationUseCaseBindings()
    {
        return $this->hasMany(NotificationUseCaseBinding::class);
    }

    public function notificationDispatchLogs()
    {
        return $this->hasMany(NotificationDispatchLog::class);
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
