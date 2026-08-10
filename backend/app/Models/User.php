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

#[Fillable(['name', 'mobile', 'mobile_verified_at', 'email', 'email_verified_at', 'password', 'role', 'user_status', 'subscription_package_id', 'sms_gateway_id', 'subscription_status', 'subscription_started_at', 'subscription_ends_at', 'owner_id', 'staff_status', 'must_change_password'])]
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
            'must_change_password'    => 'boolean',
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

    // ── Staff/Team sub-account role — see staff_team_role_context.md §3.2 ──

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function staffMembers()
    {
        return $this->hasMany(User::class, 'owner_id');
    }

    public function staffPermissions()
    {
        return $this->hasMany(StaffPermission::class);
    }

    public function isStaff(): bool
    {
        return $this->owner_id !== null;
    }

    /** The shop-owning account's id — self, unless this is a staff sub-account. */
    public function shopOwnerId(): int
    {
        return $this->owner_id ?? $this->id;
    }

    /** The shop-owning account itself — self, unless this is a staff sub-account.
     *  Use this (not $this) when reading owner-level singleton resources
     *  (Pattern B, e.g. subscriptionPackage) so staff correctly see the
     *  shop's plan instead of their own (always-empty) fields. */
    public function shopOwner(): User
    {
        return $this->isStaff() ? ($this->owner ?? $this) : $this;
    }

    /** Owner + all of that owner's staff — the "shop pool" for shared (Pattern A) data scoping. */
    public function shopUserIds(): array
    {
        $ownerId = $this->shopOwnerId();

        return static::where('id', $ownerId)->orWhere('owner_id', $ownerId)->pluck('id')->all();
    }

    /** Owner/admin accounts always pass; staff accounts need an explicit enabled grant. */
    public function hasStaffPermission(string $moduleKey): bool
    {
        if (! $this->isStaff()) {
            return true;
        }

        return $this->staffPermissions()->where('module_key', $moduleKey)->where('enabled', true)->exists();
    }
}
