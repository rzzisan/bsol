<?php

namespace App\Http\Controllers;

use App\Models\PhoneOtpActivityLog;
use App\Models\PhoneOtpVerification;
use App\Models\RegistrationSetting;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class OtpController extends Controller
{
    /**
     * Step 1 – Validate registration data, store pending record, send OTP.
     */
    public function sendRegistrationOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'mobile'   => ['required', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/', 'unique:users,mobile'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
        ]);

        $normalizedMobile = $this->normalizeMobile($validated['mobile']);

        $blocked = PhoneOtpVerification::query()
            ->where('mobile', $normalizedMobile)
            ->where('purpose', 'registration')
            ->whereNotNull('blocked_until')
            ->where('blocked_until', '>', now())
            ->latest('id')
            ->first();

        if ($blocked) {
            $retryAfter = now()->diffInSeconds($blocked->blocked_until);
            $this->logOtpActivity(
                mobile: $normalizedMobile,
                eventType: 'registration_blocked',
                status: 'failed',
                message: 'Registration attempt blocked due to resend limit lock.',
                errorMessage: 'Phone number is temporarily blocked.',
                provider: 'system',
                metadata: ['retry_after_seconds' => $retryAfter]
            );

            return response()->json([
                'message' => 'This phone number is blocked for 1 hour due to too many resend attempts.',
                'retry_after_seconds' => $retryAfter,
            ], 429);
        }

        // Delete previous OTP attempts for this mobile
        PhoneOtpVerification::where('mobile', $normalizedMobile)
            ->where('purpose', 'registration')
            ->where(function ($query) {
                $query->whereNull('blocked_until')
                    ->orWhere('blocked_until', '<=', now());
            })
            ->delete();

        $otp   = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = bin2hex(random_bytes(32));

        PhoneOtpVerification::create([
            'token'        => $token,
            'mobile'       => $normalizedMobile,
            'otp_code'     => $otp,
            'purpose'      => 'registration',
            'pending_data' => [
                'name'     => $validated['name'],
                'mobile_raw' => $validated['mobile'],
                'email'    => $validated['email'],
                'password' => Hash::make($validated['password']),
            ],
            'resend_count' => 0,
            'last_sent_at' => now(),
            'next_resend_at' => now()->addMinute(),
            'expires_at' => now()->addMinutes(5),
        ]);

        // Send OTP via phone_verification use-case (configured by admin)
        $smsDispatch = $this->sendOtpSms($normalizedMobile, $validated['name'], $otp);

        $this->logOtpActivity(
            mobile: $normalizedMobile,
            eventType: 'otp_sent',
            status: $smsDispatch['status'],
            message: 'Registration OTP sent.',
            errorMessage: $smsDispatch['status'] === 'failed' ? ($smsDispatch['message'] ?? 'OTP SMS dispatch failed.') : null,
            provider: $smsDispatch['provider'] ?? null,
            metadata: [
                'use_case_key' => 'phone_verification',
                'remaining_resends' => 2,
            ]
        );

        $masked = substr($validated['mobile'], 0, 3)
            . str_repeat('*', max(0, strlen($validated['mobile']) - 5))
            . substr($validated['mobile'], -2);

        return response()->json([
            'message' => 'OTP sent to your mobile number.',
            'token'   => $token,
            'mobile'  => $masked,
            'next_resend_after_seconds' => 60,
        ]);
    }

    /**
     * Step 2 – Verify OTP and complete registration.
     */
    public function verifyRegistrationOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'otp'   => ['required', 'string', 'digits:6'],
        ]);

        $record = PhoneOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Invalid or expired session. Please register again.'], 422);
        }

        if ($record->isExpired()) {
            $this->logOtpActivity(
                mobile: $record->mobile,
                eventType: 'verify_failed',
                status: 'failed',
                message: 'OTP verification failed.',
                errorMessage: 'OTP expired.',
                provider: 'system'
            );
            $record->delete();
            return response()->json(['message' => 'OTP expired. Please register again.'], 422);
        }

        if ($record->attempts >= 5) {
            $record->delete();
            return response()->json(['message' => 'Too many attempts. Please register again.'], 422);
        }

        $record->increment('attempts');

        if ($record->otp_code !== $validated['otp']) {
            $remaining = 5 - $record->attempts;

            $this->logOtpActivity(
                mobile: $record->mobile,
                eventType: 'verify_failed',
                status: 'failed',
                message: 'OTP verification failed.',
                errorMessage: 'Incorrect OTP entered.',
                provider: 'system',
                metadata: [
                    'remaining_attempts' => $remaining,
                    'verify_attempt' => $record->attempts,
                ]
            );

            return response()->json([
                'message'           => 'Incorrect OTP. Please try again.',
                'remaining_attempts' => $remaining,
            ], 422);
        }

        // OTP correct – create user
        $pendingData = $record->pending_data;
        $rawMobile = (string) ($pendingData['mobile_raw'] ?? $record->mobile);

        if (User::where('mobile', $rawMobile)->exists()) {
            $record->delete();
            return response()->json(['message' => 'This mobile number is already registered.'], 422);
        }

        if (User::where('email', $pendingData['email'])->exists()) {
            $record->delete();
            return response()->json(['message' => 'This email is already registered.'], 422);
        }

        $registrationDefaults = RegistrationSetting::getSetting();

        $user = User::create([
            'name'               => $pendingData['name'],
            'mobile'             => $rawMobile,
            'email'              => $pendingData['email'],
            'password'           => $pendingData['password'],
            'role'               => 'user',
            'user_status'        => $registrationDefaults->default_user_status,
            'subscription_package_id' => $registrationDefaults->default_subscription_package_id,
            'mobile_verified_at' => now(),
        ]);

        $record->update(['verified_at' => now()]);

        $this->logOtpActivity(
            mobile: $record->mobile,
            eventType: 'verify_success',
            status: 'sent',
            message: 'OTP verification successful. Registration completed.',
            provider: 'system',
            metadata: ['user_id' => $user->id]
        );

        $authToken = $user->createToken('frontend')->plainTextToken;

        return response()->json([
            'message' => 'Phone verified. Registration successful.',
            'token'   => $authToken,
            'user'    => $user,
        ], 201);
    }

    /**
     * Resend OTP for an existing pending session.
     */
    public function resendOtp(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        $record = PhoneOtpVerification::where('token', $validated['token'])
            ->where('purpose', 'registration')
            ->whereNull('verified_at')
            ->first();

        if (! $record) {
            return response()->json(['message' => 'Session not found. Please register again.'], 422);
        }

        if ($record->blocked_until && now()->lt($record->blocked_until)) {
            $retryAfter = now()->diffInSeconds($record->blocked_until);

            return response()->json([
                'message' => 'This phone number is blocked for 1 hour due to too many resend attempts.',
                'retry_after_seconds' => $retryAfter,
            ], 429);
        }

        if ($record->isExpired()) {
            $this->logOtpActivity(
                mobile: $record->mobile,
                eventType: 'resend_failed',
                status: 'failed',
                message: 'OTP resend failed.',
                errorMessage: 'OTP session expired.',
                provider: 'system'
            );

            return response()->json(['message' => 'OTP expired. Please register again.'], 422);
        }

        if ($record->resend_count >= 2) {
            $blockedUntil = now()->addHour();
            $record->update(['blocked_until' => $blockedUntil]);

            $this->logOtpActivity(
                mobile: $record->mobile,
                eventType: 'resend_blocked',
                status: 'failed',
                message: 'OTP resend blocked.',
                errorMessage: 'Maximum resend limit exceeded. Number blocked for 1 hour.',
                provider: 'system',
                metadata: [
                    'resend_count' => $record->resend_count,
                    'blocked_until' => $blockedUntil->toIso8601String(),
                ]
            );

            return response()->json([
                'message' => 'Maximum resend limit exceeded. This number is blocked for 1 hour.',
                'retry_after_seconds' => 3600,
            ], 429);
        }

        if ($record->next_resend_at && now()->lt($record->next_resend_at)) {
            $waitSeconds = now()->diffInSeconds($record->next_resend_at);

            return response()->json([
                'message' => 'Please wait before requesting another OTP resend.',
                'retry_after_seconds' => $waitSeconds,
            ], 429);
        }

        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $nextResendCount = $record->resend_count + 1;

        $nextResendAt = null;
        if ($nextResendCount === 1) {
            $nextResendAt = now()->addMinutes(2);
        }

        $record->update([
            'otp_code'   => $otp,
            'attempts'   => 0,
            'resend_count' => $nextResendCount,
            'last_sent_at' => now(),
            'next_resend_at' => $nextResendAt,
            'expires_at' => now()->addMinutes(5),
        ]);

        $pendingData = $record->pending_data;
        $smsDispatch = $this->sendOtpSms($record->mobile, $pendingData['name'] ?? '', $otp);

        $this->logOtpActivity(
            mobile: $record->mobile,
            eventType: 'otp_resent',
            status: $smsDispatch['status'],
            message: 'Registration OTP resent.',
            errorMessage: $smsDispatch['status'] === 'failed' ? ($smsDispatch['message'] ?? 'OTP SMS dispatch failed.') : null,
            provider: $smsDispatch['provider'] ?? null,
            metadata: [
                'resend_count' => $nextResendCount,
                'remaining_resends' => max(0, 2 - $nextResendCount),
            ]
        );

        return response()->json([
            'message' => 'OTP resent successfully.',
            'remaining_resends' => max(0, 2 - $nextResendCount),
            'next_resend_after_seconds' => $nextResendAt ? now()->diffInSeconds($nextResendAt) : null,
        ]);
    }

    // -------------------------------------------------------------------------

    /**
     * @return array{status: string, message: string, provider?: string}
     */
    private function sendOtpSms(string $mobile, string $name, string $otp): array
    {
        // Find any admin who has an active phone_verification binding configured
        $adminUser = User::where('role', 'admin')
            ->whereHas('notificationUseCaseBindings', function ($q) {
                $q->where('use_case_key', 'phone_verification')->where('is_active', true);
            })
            ->first();

        if (! $adminUser) {
            return [
                'status' => 'failed',
                'message' => 'No active phone_verification binding configured by admin.',
                'provider' => 'system',
            ];
        }

        /** @var NotificationDispatchService $dispatcher */
        $dispatcher = app(NotificationDispatchService::class);

        $result = $dispatcher->dispatch($adminUser, 'phone_verification', $mobile, null, [
            'otp'      => $otp,
            'name'     => $name,
            'phone'    => $mobile,
            'app_name' => config('app.name'),
        ]);

        $smsRow = collect($result['results'] ?? [])->first(fn (array $row) => ($row['channel'] ?? null) === 'sms');

        if (! is_array($smsRow)) {
            return [
                'status' => 'failed',
                'message' => 'No SMS channel was dispatched for phone_verification.',
                'provider' => 'sms',
            ];
        }

        return [
            'status' => (($smsRow['status'] ?? null) === 'sent') ? 'sent' : 'failed',
            'message' => (string) ($smsRow['message'] ?? 'OTP dispatch completed.'),
            'provider' => 'sms',
        ];
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

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function logOtpActivity(
        string $mobile,
        string $eventType,
        string $status,
        string $message,
        ?string $errorMessage = null,
        ?string $provider = null,
        array $metadata = [],
    ): void {
        PhoneOtpActivityLog::create([
            'mobile' => $mobile,
            'event_type' => $eventType,
            'status' => $status === 'sent' ? 'sent' : 'failed',
            'provider' => $provider,
            'message' => $message,
            'error_message' => $errorMessage,
            'metadata' => $metadata,
        ]);
    }
}
