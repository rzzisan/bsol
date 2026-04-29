<?php

namespace App\Http\Controllers;

use App\Models\EmailOtpVerification;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    /**
     * Step 1: Find account by email or mobile number.
     * Returns masked email so the user can choose delivery method.
     */
    public function findAccount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
        ]);

        $identifier = trim($validated['identifier']);

        $user = $this->findUserByIdentifier($identifier);

        if (! $user) {
            return response()->json([
                'message' => 'No account found with this email or mobile number.',
            ], 404);
        }

        return response()->json([
            'message' => 'Account found.',
            'masked_email' => filled($user->email) ? $this->maskEmail((string) $user->email) : null,
            'masked_mobile' => filled($user->mobile) ? $this->maskMobile((string) $user->mobile) : null,
            'has_email' => ! empty($user->email),
            'has_mobile' => ! empty($user->mobile),
        ]);
    }

    /**
     * Step 2: Send password reset OTP via selected channel.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'method'     => ['required', 'string', 'in:email,sms'],
        ]);

        $identifier = trim($validated['identifier']);
        $method = (string) $validated['method'];

        $user = $this->findUserByIdentifier($identifier);

        if (! $user) {
            return response()->json(['message' => 'No account found.'], 404);
        }

        if ($method === 'email' && empty($user->email)) {
            return response()->json(['message' => 'This account has no email address configured.'], 422);
        }

        if ($method === 'sms' && empty($user->mobile)) {
            return response()->json(['message' => 'This account has no mobile number configured.'], 422);
        }

        $deliveryTarget = $method === 'sms'
            ? $this->normalizeMobile((string) $user->mobile)
            : (string) $user->email;

        if (blank($deliveryTarget)) {
            return response()->json(['message' => 'Invalid delivery target.'], 422);
        }

        // Check for recent unexpired record to prevent spam
        $existing = EmailOtpVerification::where('email', $deliveryTarget)
            ->where('purpose', 'password_reset')
            ->whereNull('verified_at')
            ->first();

        if ($existing) {
            if ($existing->blocked_until && now()->lt($existing->blocked_until)) {
                $retryAfter = now()->diffInSeconds($existing->blocked_until);
                return response()->json([
                    'message' => 'Too many attempts. Please try again later.',
                    'retry_after_seconds' => $retryAfter,
                ], 429);
            }

            if (! $existing->isExpired() && $existing->next_resend_at && now()->lt($existing->next_resend_at)) {
                $waitSeconds = now()->diffInSeconds($existing->next_resend_at);
                return response()->json([
                    'message' => 'Please wait before requesting another OTP.',
                    'retry_after_seconds' => $waitSeconds,
                ], 429);
            }
        }

        // Clean up old records
        EmailOtpVerification::where('email', $deliveryTarget)
            ->where('purpose', 'password_reset')
            ->where(function ($query) {
                $query->whereNull('blocked_until')
                    ->orWhere('blocked_until', '<=', now());
            })
            ->delete();

        $otp   = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = bin2hex(random_bytes(32));

        EmailOtpVerification::create([
            'token'              => $token,
            'email'              => $deliveryTarget,
            'otp_code'           => $otp,
            'verification_token' => null,
            'purpose'            => 'password_reset',
            'pending_data'       => [
                'user_id' => $user->id,
                'delivery_method' => $method,
                'email' => $user->email,
                'mobile' => $user->mobile,
            ],
            'resend_count'       => 0,
            'last_sent_at'       => now(),
            'next_resend_at'     => now()->addMinutes(2),
            'expires_at'         => now()->addMinutes(30),
        ]);

        $dispatch = $this->sendPasswordResetOtp($user, $method, $deliveryTarget, $otp);

        if ($dispatch['status'] === 'failed') {
            return response()->json([
                'message' => 'Failed to send OTP. Please check admin notification settings.',
                'debug'   => $dispatch['message'],
            ], 500);
        }

        return response()->json([
            'message'                  => $method === 'sms' ? 'OTP sent to your mobile number.' : 'OTP sent to your email address.',
            'token'                    => $token,
            'method'                   => $method,
            'masked_email'             => filled($user->email) ? $this->maskEmail((string) $user->email) : null,
            'masked_mobile'            => filled($user->mobile) ? $this->maskMobile((string) $user->mobile) : null,
            'masked_target'            => $method === 'sms'
                ? $this->maskMobile((string) $user->mobile)
                : $this->maskEmail((string) $user->email),
            'next_resend_after_seconds' => 120,
        ]);
    }

    /**
     * Resend password reset OTP.
     */
    public function resendOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $record = EmailOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'password_reset')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Session not found or already used.'], 422);
        }

        if ($record->blocked_until && now()->lt($record->blocked_until)) {
            $retryAfter = now()->diffInSeconds($record->blocked_until);
            return response()->json([
                'message' => 'Too many resend attempts. Please try again later.',
                'retry_after_seconds' => $retryAfter,
            ], 429);
        }

        if ($record->isExpired()) {
            $record->delete();
            return response()->json(['message' => 'Session expired. Please start the process again.'], 422);
        }

        if ($record->resend_count >= 2) {
            $blockedUntil = now()->addHour();
            $record->update(['blocked_until' => $blockedUntil]);
            return response()->json([
                'message' => 'Maximum resend limit exceeded. Please try again in 1 hour.',
                'retry_after_seconds' => 3600,
            ], 429);
        }

        if ($record->next_resend_at && now()->lt($record->next_resend_at)) {
            $waitSeconds = now()->diffInSeconds($record->next_resend_at);
            return response()->json([
                'message' => 'Please wait before requesting another OTP.',
                'retry_after_seconds' => $waitSeconds,
            ], 429);
        }

        $otp   = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $nextResendCount = $record->resend_count + 1;
        $nextResendAt    = $nextResendCount === 1 ? now()->addMinutes(5) : null;

        $record->update([
            'otp_code'       => $otp,
            'attempts'       => 0,
            'resend_count'   => $nextResendCount,
            'last_sent_at'   => now(),
            'next_resend_at' => $nextResendAt,
            'expires_at'     => now()->addMinutes(30),
        ]);

        $user = User::find($record->pending_data['user_id'] ?? null);
        $method = (string) ($record->pending_data['delivery_method'] ?? 'email');
        $dispatch = $this->sendPasswordResetOtp($user, $method, (string) $record->email, $otp);

        if ($dispatch['status'] === 'failed') {
            return response()->json([
                'message' => 'Failed to resend OTP.',
                'debug' => $dispatch['message'],
            ], 500);
        }

        return response()->json([
            'message'                  => 'OTP resent successfully.',
            'method'                   => $method,
            'masked_target'            => $method === 'sms'
                ? $this->maskMobile((string) $record->email)
                : $this->maskEmail((string) $record->email),
            'next_resend_after_seconds' => $nextResendAt ? 300 : null,
            'remaining_resends'        => max(0, 2 - $nextResendCount),
        ]);
    }

    /**
     * Step 3: Verify OTP → returns a reset_token for the final step.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'otp'   => ['required', 'string', 'digits:6'],
        ]);

        $record = EmailOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'password_reset')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired session.'], 422);
        }

        if ($record->isExpired()) {
            $record->delete();
            return response()->json(['message' => 'OTP expired. Please start again.'], 422);
        }

        if ($record->attempts >= 5) {
            $record->delete();
            return response()->json(['message' => 'Too many incorrect attempts. Please start again.'], 422);
        }

        $record->increment('attempts');

        if ($record->otp_code !== $validated['otp']) {
            $remaining = 5 - $record->attempts;
            return response()->json([
                'message'            => 'Incorrect OTP. Please try again.',
                'remaining_attempts' => $remaining,
            ], 422);
        }

        // OTP verified — generate a one-time reset token
        $resetToken = Str::random(64);
        $record->update([
            'verification_token' => $resetToken,
            'verified_at'        => now(),
        ]);

        return response()->json([
            'message'     => 'OTP verified successfully.',
            'reset_token' => $resetToken,
        ]);
    }

    /**
     * Step 4: Reset password using the verified reset_token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reset_token'           => ['required', 'string'],
            'password'              => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $record = EmailOtpVerification::where('verification_token', $validated['reset_token'])
            ->where('purpose', 'password_reset')
            ->whereNotNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired reset token.'], 422);
        }

        // The reset token window: 15 minutes after OTP was verified
        if ($record->verified_at && now()->diffInMinutes($record->verified_at) > 15) {
            $record->delete();
            return response()->json(['message' => 'Reset token expired. Please start the process again.'], 422);
        }

        $user = User::find($record->pending_data['user_id'] ?? null);

        if (! $user) {
            $record->delete();
            return response()->json(['message' => 'User not found.'], 422);
        }

        $user->update(['password' => Hash::make($validated['password'])]);

        // Invalidate all existing tokens for security
        $user->tokens()->delete();

        // Clean up reset record
        $record->delete();

        return response()->json([
            'message' => 'Password reset successfully. Please login with your new password.',
        ]);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private function sendPasswordResetOtp(?User $user, string $method, string $target, string $otp): array
    {
        if (! $user) {
            return ['status' => 'failed', 'message' => 'User not found.'];
        }

        $adminUser = User::where('role', 'admin')
            ->whereHas('notificationUseCaseBindings', function ($q) {
                $q->where('use_case_key', 'forgot_password')->where('is_active', true);
            })
            ->first();

        if (! $adminUser) {
            return [
                'status'  => 'failed',
                'message' => 'No active forgot_password notification binding configured by admin.',
            ];
        }

        /** @var NotificationDispatchService $dispatcher */
        $dispatcher = app(NotificationDispatchService::class);

        $result = $dispatcher->dispatch(
            $adminUser,
            'forgot_password',
            $method === 'sms' ? $target : null,
            $method === 'email' ? $target : null,
            [
            'otp'                    => $otp,
            'name'                   => $user->name,
            'email'                  => $user->email,
            'phone'                  => $this->normalizeMobile((string) $user->mobile),
            'app_name'               => config('app.name'),
            'otp_expires_in_minutes' => 30,
        ]
        );

        $row = collect($result['results'] ?? [])->first(fn (array $item) => ($item['channel'] ?? null) === $method);

        if (! is_array($row)) {
            return [
                'status' => 'failed',
                'message' => $method === 'sms'
                    ? 'No SMS channel dispatched for forgot_password.'
                    : 'No email channel dispatched for forgot_password.',
            ];
        }

        return [
            'status'  => (($row['status'] ?? null) === 'sent') ? 'sent' : 'failed',
            'message' => (string) ($row['message'] ?? 'OTP dispatch completed.'),
        ];
    }

    private function findUserByIdentifier(string $identifier): ?User
    {
        $normalizedMobile = $this->normalizeMobile($identifier);

        return User::where('email', $identifier)
            ->orWhere('mobile', $identifier)
            ->orWhere('mobile', $normalizedMobile)
            ->first();
    }

    private function normalizeMobile(string $mobile): string
    {
        $number = preg_replace('/[^0-9]/', '', $mobile) ?? '';

        if (str_starts_with($number, '00880')) {
            $number = substr($number, 2);
        }

        if (str_starts_with($number, '880')) {
            return $number;
        }

        if (str_starts_with($number, '01')) {
            return '88'.$number;
        }

        if (strlen($number) === 10 && str_starts_with($number, '1')) {
            return '880'.$number;
        }

        return $number;
    }

    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return str_repeat('*', strlen($email));
        }

        $name   = $parts[0];
        $domain = $parts[1];

        if (strlen($name) <= 2) {
            $masked = str_repeat('*', strlen($name));
        } else {
            $masked = substr($name, 0, 2) . str_repeat('*', strlen($name) - 2);
        }

        return $masked . '@' . $domain;
    }

    private function maskMobile(string $mobile): string
    {
        $digits = preg_replace('/[^0-9]/', '', $mobile) ?? '';

        if (strlen($digits) <= 4) {
            return str_repeat('*', strlen($digits));
        }

        return substr($digits, 0, 4) . str_repeat('*', max(0, strlen($digits) - 7)) . substr($digits, -3);
    }
}
