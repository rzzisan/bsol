<?php

namespace App\Http\Controllers;

use App\Models\EmailOtpVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Direct registration is disabled. Use /api/otp/register and complete phone verification before account creation.',
            'requires_phone_verification' => true,
            'registration_endpoint' => '/api/otp/register',
        ], 410);
    }

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $token = $user->createToken('frontend')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user(),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/', Rule::unique('users', 'mobile')->ignore($user->id)],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required_with:password', 'string'],
            'password' => ['sometimes', 'required', 'string', 'min:8', 'confirmed'],
        ]);

        if (array_key_exists('password', $validated) && ! Hash::check((string) $validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        unset($validated['current_password']);

        $originalEmail = $user->email;
        $emailChanged = array_key_exists('email', $validated) && $validated['email'] !== $originalEmail;

        if ($emailChanged) {
            $validated['email_verified_at'] = null;
        }

        $user->update($validated);

        if ($emailChanged) {
            EmailOtpVerification::query()
                ->whereNull('verified_at')
                ->whereIn('email', array_values(array_unique([$originalEmail, $user->email])))
                ->delete();
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()?->currentAccessToken();

        if ($token) {
            $token->delete();
        } else {
            $request->user()?->tokens()->delete();
        }

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }
}