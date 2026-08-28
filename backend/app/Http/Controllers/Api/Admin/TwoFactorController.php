<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\Security\AdminAuditLogger;
use App\Services\Security\RecoveryCodeService;
use App\Services\Security\TotpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Admin-facing two-factor (TOTP) setup — security_hardening_context.md §2.
 *
 * Setup/enable/disable all require an already-authenticated session (you
 * turn 2FA on from inside the dashboard, same as any authenticator-app
 * product) — the login-time challenge itself lives in AuthController, since
 * that request has no token yet.
 */
class TwoFactorController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        return response()->json([
            'enabled' => $request->user()->hasTwoFactorEnabled(),
            'pending_setup' => ! $request->user()->hasTwoFactorEnabled() && $request->user()->two_factor_secret !== null,
        ]);
    }

    /**
     * Generates a fresh secret and returns it (plus the otpauth:// URI) for
     * the admin to scan/enter into an authenticator app. Not yet active —
     * enable() below requires proving possession with a real code first, so
     * a setup request that's abandoned mid-way never silently turns 2FA on.
     */
    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return response()->json([
                'message' => 'Two-factor authentication is already enabled. Disable it first to set up a new device.',
            ], 422);
        }

        $secret = TotpService::generateSecret();
        $user->two_factor_secret = $secret;
        $user->save();

        return response()->json([
            'secret' => $secret,
            'otpauth_url' => TotpService::provisioningUri('BSOL', $user->email, $secret),
        ]);
    }

    /**
     * Confirms setup() by requiring one real code from the app before
     * flipping two_factor_confirmed_at — proves the admin actually has the
     * device working, not just that a secret exists on the row.
     */
    public function enable(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:20'],
        ]);

        $user = $request->user();

        if ($user->two_factor_secret === null) {
            return response()->json([
                'message' => 'Start setup first.',
            ], 422);
        }

        if ($user->hasTwoFactorEnabled()) {
            return response()->json([
                'message' => 'Two-factor authentication is already enabled.',
            ], 422);
        }

        if (! TotpService::verify($user->two_factor_secret, $data['code'])) {
            throw ValidationException::withMessages([
                'code' => ['That code is incorrect or expired. Check your authenticator app and try again.'],
            ]);
        }

        $codes = RecoveryCodeService::generate();

        $user->two_factor_confirmed_at = now();
        $user->two_factor_recovery_codes = $codes['hashed'];
        $user->save();

        AdminAuditLogger::log('admin.2fa_enabled', 'User', $user->id);

        return response()->json([
            'message' => 'Two-factor authentication is now enabled.',
            'recovery_codes' => $codes['plaintext'],
        ]);
    }

    /**
     * Requires the current password (not just an active session) — the
     * highest-blast-radius action a compromised-but-not-yet-detected
     * session could take is turning off the account's own 2FA, so this one
     * gate is deliberately stronger than the rest of this controller.
     */
    public function disable(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Incorrect password.'],
            ]);
        }

        $user->two_factor_secret = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        AdminAuditLogger::log('admin.2fa_disabled', 'User', $user->id);

        return response()->json(['message' => 'Two-factor authentication has been disabled.']);
    }

    public function regenerateRecoveryCodes(Request $request): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'string'],
        ]);

        $user = $request->user();

        if (! $user->hasTwoFactorEnabled()) {
            return response()->json(['message' => 'Two-factor authentication is not enabled.'], 422);
        }

        if (! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'password' => ['Incorrect password.'],
            ]);
        }

        $codes = RecoveryCodeService::generate();
        $user->two_factor_recovery_codes = $codes['hashed'];
        $user->save();

        AdminAuditLogger::log('admin.2fa_recovery_codes_regenerated', 'User', $user->id);

        return response()->json(['recovery_codes' => $codes['plaintext']]);
    }
}
