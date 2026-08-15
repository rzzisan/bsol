<?php

namespace Tests\Feature;

use App\Models\PhoneOtpVerification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

/**
 * Registration deliberately lets a soft-deleted account's email be reused.
 * The unique index used to cover trashed rows too, so every check passed and
 * User::create() then failed — the seller saw "Server Error" at the OTP step.
 */
class RegistrationEmailReuseTest extends TestCase
{
    use RefreshDatabase;

    private function pendingOtp(string $email, string $mobile): PhoneOtpVerification
    {
        return PhoneOtpVerification::create([
            'mobile' => $mobile,
            'otp_code' => '123456',
            'token' => 'tok-' . uniqid(),
            'purpose' => 'registration',
            'expires_at' => now()->addMinutes(10),
            'attempts' => 0,
            'pending_data' => [
                'name' => 'New Seller',
                'email' => $email,
                'mobile_raw' => $mobile,
                'password' => Hash::make('secret-password'),
            ],
        ]);
    }

    public function test_an_email_freed_by_a_soft_deleted_account_can_be_registered_again(): void
    {
        $old = User::factory()->create(['email' => 'reuse@example.com', 'mobile' => '01700000001']);
        $old->delete();

        $this->assertSoftDeleted('users', ['id' => $old->id]);

        $record = $this->pendingOtp('reuse@example.com', '01700000002');

        $this->postJson('/api/otp/verify-registration', ['token' => $record->token, 'otp' => '123456'])
            ->assertCreated();

        // The new account exists alongside the trashed one.
        $this->assertSame(1, User::where('email', 'reuse@example.com')->count());
        $this->assertSame(2, User::withTrashed()->where('email', 'reuse@example.com')->count());
    }

    /** A live account still blocks the email — only trashed rows are ignored. */
    public function test_a_live_account_still_blocks_its_email(): void
    {
        User::factory()->create(['email' => 'taken@example.com', 'mobile' => '01700000003']);

        $record = $this->pendingOtp('taken@example.com', '01700000004');

        $this->postJson('/api/otp/verify-registration', ['token' => $record->token, 'otp' => '123456'])
            ->assertStatus(422);

        $this->assertSame(1, User::where('email', 'taken@example.com')->count());
    }
}
