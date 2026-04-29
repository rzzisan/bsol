<?php

namespace App\Http\Controllers;

use App\Models\EmailOtpVerification;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class EmailOtpController extends Controller
{
    /**
     * Send verification email with OTP and link to authenticated user.
     */
    public function sendVerificationEmail(Request $request): JsonResponse
    {
        $request->user()->loadMissing('notificationUseCaseBindings');

        $email = $request->user()->email;

        // Check if email is already verified
        if ($request->user()->email_verified_at) {
            return response()->json([
                'message' => 'Your email is already verified.',
            ]);
        }

        // Check for existing unverified email OTP
        $existing = EmailOtpVerification::where('email', $email)
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if ($existing) {
            if ($existing->blocked_until && now()->lt($existing->blocked_until)) {
                $retryAfter = now()->diffInSeconds($existing->blocked_until);
                return response()->json([
                    'message' => 'This email is temporarily blocked. Please try again later.',
                    'retry_after_seconds' => $retryAfter,
                ], 429);
            }

            // If not blocked and not expired, return existing
            if (! $existing->isExpired() && $existing->next_resend_at && now()->lt($existing->next_resend_at)) {
                $waitSeconds = now()->diffInSeconds($existing->next_resend_at);
                return response()->json([
                    'message' => 'Please wait before requesting another email verification.',
                    'retry_after_seconds' => $waitSeconds,
                ], 429);
            }
        }

        // Delete old expired records
        EmailOtpVerification::where('email', $email)
            ->where('purpose', 'registration')
            ->where(function ($query) {
                $query->whereNull('blocked_until')
                    ->orWhere('blocked_until', '<=', now());
            })
            ->delete();

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = bin2hex(random_bytes(32));
        $verificationToken = Str::random(64);

        $emailOtp = EmailOtpVerification::create([
            'token' => $token,
            'email' => $email,
            'otp_code' => $otp,
            'verification_token' => $verificationToken,
            'purpose' => 'registration',
            'pending_data' => [
                'user_id' => $request->user()->id,
                'name' => $request->user()->name,
            ],
            'resend_count' => 0,
            'last_sent_at' => now(),
            'next_resend_at' => now()->addMinutes(2),
            'expires_at' => now()->addMinutes(30),
        ]);

        // Send verification email
        $emailDispatch = $this->sendVerificationEmailMessage($request->user(), $email, $otp, $verificationToken);

        $this->logEmailVerificationActivity(
            email: $email,
            eventType: 'email_verification_sent',
            status: $emailDispatch['status'],
            message: 'Email verification sent.',
            errorMessage: $emailDispatch['status'] === 'failed' ? ($emailDispatch['message'] ?? null) : null,
            provider: $emailDispatch['provider'] ?? null,
            metadata: [
                'user_id' => $request->user()->id,
                'use_case_key' => 'email_verification',
                'remaining_resends' => 2,
            ]
        );

        return response()->json([
            'message' => 'Email verification sent.',
            'token' => $token,
            'email' => $this->maskEmail($email),
            'next_resend_after_seconds' => 120,
        ]);
    }

    /**
     * Verify email using OTP code.
     */
    public function verifyEmailOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'otp' => ['required', 'string', 'digits:6'],
        ]);

        $record = EmailOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired session.'], 422);
        }

        if ($record->isExpired()) {
            $this->logEmailVerificationActivity(
                email: $record->email,
                eventType: 'email_verify_failed',
                status: 'failed',
                message: 'Email verification failed.',
                errorMessage: 'OTP expired.',
                provider: 'system'
            );
            $record->delete();
            return response()->json(['message' => 'OTP expired. Please request a new verification email.'], 422);
        }

        if ($record->attempts >= 5) {
            $record->delete();
            return response()->json(['message' => 'Too many attempts. Please request a new verification email.'], 422);
        }

        $record->increment('attempts');

        if ($record->otp_code !== $validated['otp']) {
            $remaining = 5 - $record->attempts;

            $this->logEmailVerificationActivity(
                email: $record->email,
                eventType: 'email_verify_failed',
                status: 'failed',
                message: 'Email verification failed.',
                errorMessage: 'Incorrect OTP entered.',
                provider: 'system',
                metadata: ['remaining_attempts' => $remaining]
            );

            return response()->json([
                'message' => 'Incorrect OTP. Please try again.',
                'remaining_attempts' => $remaining,
            ], 422);
        }

        // OTP correct – verify email
        $user = User::find($record->pending_data['user_id'] ?? null);

        if (! $user) {
            $record->delete();
            return response()->json(['message' => 'User not found.'], 422);
        }

        $user->update(['email_verified_at' => now()]);
        $record->update(['verified_at' => now()]);

        $this->logEmailVerificationActivity(
            email: $record->email,
            eventType: 'email_verify_success',
            status: 'sent',
            message: 'Email verified successfully.',
            provider: 'system',
            metadata: ['user_id' => $user->id]
        );

        return response()->json([
            'message' => 'Email verified successfully.',
            'user' => $user,
        ]);
    }

    /**
     * Verify email using link token.
     */
    public function verifyEmailLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $record = EmailOtpVerification::where('verification_token', $validated['token'])
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired verification link.'], 422);
        }

        if ($record->isExpired()) {
            $this->logEmailVerificationActivity(
                email: $record->email,
                eventType: 'email_link_expired',
                status: 'failed',
                message: 'Email verification link expired.',
                errorMessage: 'Verification link expired.',
                provider: 'system'
            );
            $record->delete();
            return response()->json(['message' => 'Verification link expired. Please request a new email.'], 422);
        }

        // Link token correct – verify email
        $user = User::find($record->pending_data['user_id'] ?? null);

        if (! $user) {
            $record->delete();
            return response()->json(['message' => 'User not found.'], 422);
        }

        $user->update(['email_verified_at' => now()]);
        $record->update(['verified_at' => now()]);

        $this->logEmailVerificationActivity(
            email: $record->email,
            eventType: 'email_verify_success',
            status: 'sent',
            message: 'Email verified successfully via link.',
            provider: 'system',
            metadata: ['user_id' => $user->id, 'verified_via' => 'link']
        );

        return response()->json([
            'message' => 'Email verified successfully.',
            'user' => $user,
        ]);
    }

    /**
     * Resend email verification OTP.
     */
    public function resendVerificationEmail(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $record = EmailOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Session not found.'], 422);
        }

        if ($record->blocked_until && now()->lt($record->blocked_until)) {
            $retryAfter = now()->diffInSeconds($record->blocked_until);
            return response()->json([
                'message' => 'This email is blocked for 1 hour due to too many resend attempts.',
                'retry_after_seconds' => $retryAfter,
            ], 429);
        }

        if ($record->isExpired()) {
            $this->logEmailVerificationActivity(
                email: $record->email,
                eventType: 'email_resend_failed',
                status: 'failed',
                message: 'Email resend failed.',
                errorMessage: 'OTP session expired.',
                provider: 'system'
            );
            return response()->json(['message' => 'OTP expired. Please request a new verification email.'], 422);
        }

        if ($record->resend_count >= 2) {
            $blockedUntil = now()->addHour();
            $record->update(['blocked_until' => $blockedUntil]);

            $this->logEmailVerificationActivity(
                email: $record->email,
                eventType: 'email_resend_blocked',
                status: 'failed',
                message: 'Email resend blocked.',
                errorMessage: 'Maximum resend limit exceeded. Email blocked for 1 hour.',
                provider: 'system',
                metadata: [
                    'resend_count' => $record->resend_count,
                    'blocked_until' => $blockedUntil->toIso8601String(),
                ]
            );

            return response()->json([
                'message' => 'Maximum resend limit exceeded. This email is blocked for 1 hour.',
                'retry_after_seconds' => 3600,
            ], 429);
        }

        if ($record->next_resend_at && now()->lt($record->next_resend_at)) {
            $waitSeconds = now()->diffInSeconds($record->next_resend_at);
            return response()->json([
                'message' => 'Please wait before requesting another email verification.',
                'retry_after_seconds' => $waitSeconds,
            ], 429);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $verificationToken = Str::random(64);
        $nextResendCount = $record->resend_count + 1;

        $nextResendAt = null;
        if ($nextResendCount === 1) {
            $nextResendAt = now()->addMinutes(5);
        }

        $record->update([
            'otp_code' => $otp,
            'verification_token' => $verificationToken,
            'attempts' => 0,
            'resend_count' => $nextResendCount,
            'last_sent_at' => now(),
            'next_resend_at' => $nextResendAt,
            'expires_at' => now()->addMinutes(30),
        ]);

        $user = User::find($record->pending_data['user_id'] ?? null);
        $emailDispatch = $this->sendVerificationEmailMessage($user, $record->email, $otp, $verificationToken);

        $this->logEmailVerificationActivity(
            email: $record->email,
            eventType: 'email_verification_resent',
            status: $emailDispatch['status'],
            message: 'Email verification resent.',
            errorMessage: $emailDispatch['status'] === 'failed' ? ($emailDispatch['message'] ?? null) : null,
            provider: $emailDispatch['provider'] ?? null,
            metadata: [
                'resend_count' => $nextResendCount,
                'remaining_resends' => max(0, 2 - $nextResendCount),
            ]
        );

        return response()->json([
            'message' => 'Email verification resent.',
            'remaining_resends' => max(0, 2 - $nextResendCount),
            'next_resend_after_seconds' => $nextResendAt ? now()->diffInSeconds($nextResendAt) : null,
        ]);
    }

    // -------------------------------------------------------------------------

    /**
     * @return array{status: string, message: string, provider?: string}
     */
    private function sendVerificationEmailMessage(?User $user, string $email, string $otp, string $verificationToken): array
    {
        if (! $user) {
            return [
                'status' => 'failed',
                'message' => 'User not found.',
                'provider' => 'system',
            ];
        }

        // Find admin with email_verification binding
        $adminUser = User::where('role', 'admin')
            ->whereHas('notificationUseCaseBindings', function ($q) {
                $q->where('use_case_key', 'email_verification')->where('is_active', true);
            })
            ->first();

        if (! $adminUser) {
            return [
                'status' => 'failed',
                'message' => 'No active email_verification binding configured by admin.',
                'provider' => 'system',
            ];
        }

        /** @var NotificationDispatchService $dispatcher */
        $dispatcher = app(NotificationDispatchService::class);

        // Build verification link URL manually since we need frontend URL
        $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'https://bsol.zyrotechbd.com'));
        $verificationLink = $frontendUrl . '/verify-email?token=' . urlencode($verificationToken);

        $result = $dispatcher->dispatch($adminUser, 'email_verification', $email, null, [
            'otp' => $otp,
            'name' => $user->name,
            'email' => $email,
            'verification_link' => $verificationLink,
            'app_name' => config('app.name'),
            'otp_expires_in_minutes' => 30,
        ]);

        $emailRow = collect($result['results'] ?? [])->first(fn (array $row) => ($row['channel'] ?? null) === 'email');

        if (! is_array($emailRow)) {
            return [
                'status' => 'failed',
                'message' => 'No email channel was dispatched for email_verification.',
                'provider' => 'email',
            ];
        }

        return [
            'status' => (($emailRow['status'] ?? null) === 'sent') ? 'sent' : 'failed',
            'message' => (string) ($emailRow['message'] ?? 'Email dispatch completed.'),
            'provider' => 'email',
        ];
    }

    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return str_repeat('*', strlen($email));
        }

        $name = $parts[0];
        $domain = $parts[1];

        if (strlen($name) <= 2) {
            $masked = str_repeat('*', strlen($name));
        } else {
            $masked = substr($name, 0, 2) . str_repeat('*', strlen($name) - 2);
        }

        return $masked . '@' . $domain;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function logEmailVerificationActivity(
        string $email,
        string $eventType,
        string $status,
        string $message,
        ?string $errorMessage = null,
        ?string $provider = null,
        array $metadata = [],
    ): void {
        // You can log to EmailOtpActivityLog or a unified log table
        // For now, we'll store in a similar way as phone OTP
        // In a future enhancement, we could create an EmailOtpActivityLog model
    }
}
