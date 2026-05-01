<?php

namespace Tests\Feature;

use App\Models\PhoneOtpVerification;
use App\Models\RegistrationSetting;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OtpRegistrationDefaultsTest extends TestCase
{
    use RefreshDatabase;

    public function test_otp_registration_applies_admin_defined_default_status_and_package(): void
    {
        $package = SubscriptionPackage::create([
            'name' => 'Pro',
            'slug' => 'pro',
            'price' => 999,
            'duration_days' => 30,
        ]);

        RegistrationSetting::getSetting()->update([
            'default_user_status' => 'active',
            'default_subscription_package_id' => $package->id,
        ]);

        $token = str_repeat('t', 64);

        PhoneOtpVerification::create([
            'token' => $token,
            'mobile' => '8801700000000',
            'otp_code' => '123456',
            'purpose' => 'registration',
            'pending_data' => [
                'name' => 'OTP User',
                'mobile_raw' => '01700000000',
                'email' => 'otp-user@example.com',
                'password' => Hash::make('password123'),
            ],
            'attempts' => 0,
            'resend_count' => 0,
            'expires_at' => now()->addMinutes(5),
        ]);

        $this->postJson('/api/otp/verify-registration', [
            'token' => $token,
            'otp' => '123456',
        ])
            ->assertCreated()
            ->assertJsonPath('user.email', 'otp-user@example.com')
            ->assertJsonPath('user.user_status', 'active')
            ->assertJsonPath('user.subscription_package_id', $package->id);

        $this->assertDatabaseHas('users', [
            'email' => 'otp-user@example.com',
            'mobile' => '01700000000',
            'user_status' => 'active',
            'subscription_package_id' => $package->id,
        ]);

        $this->assertDatabaseHas('phone_otp_verifications', [
            'token' => $token,
        ]);

        $user = User::where('email', 'otp-user@example.com')->first();
        $this->assertNotNull($user);
    }
}
