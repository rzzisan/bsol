<?php

namespace Tests\Feature;

use App\Models\NotificationUseCaseBinding;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class EmailVerificationDispatchTest extends TestCase
{
    use RefreshDatabase;

    public function test_email_verification_is_dispatched_to_email_recipient_slot(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        NotificationUseCaseBinding::create([
            'user_id' => $admin->id,
            'use_case_key' => 'email_verification',
            'priority_channel' => 'email',
            'is_active' => true,
        ]);

        $user = User::factory()->create([
            'email' => 'verify-me@example.com',
            'email_verified_at' => null,
        ]);

        $mock = Mockery::mock(NotificationDispatchService::class);
        $mock->shouldReceive('dispatch')
            ->once()
            ->withArgs(function (User $dispatchUser, string $useCaseKey, $recipientPhone, $recipientEmail, array $variables) use ($admin, $user) {
                return $dispatchUser->is($admin)
                    && $useCaseKey === 'email_verification'
                    && $recipientPhone === null
                    && $recipientEmail === $user->email
                    && ($variables['email'] ?? null) === $user->email
                    && isset($variables['otp'], $variables['verification_link']);
            })
            ->andReturn([
                'status' => 'success',
                'message' => 'Notification dispatch completed.',
                'results' => [
                    [
                        'channel' => 'email',
                        'status' => 'sent',
                        'message' => 'Accepted by SMTP server.',
                    ],
                ],
            ]);

        $this->app->instance(NotificationDispatchService::class, $mock);

        $token = $user->createToken('test-suite')->plainTextToken;

        $this->postJson('/api/email/send-verification', [], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Email verification sent.');
    }
}