<?php

namespace App\Http\Controllers;

use App\Models\EmailOtpVerification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\ShopProfile;
use App\Models\User;
use App\Services\SubdomainHandoffService;
use App\Support\FrontendUrl;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly SubdomainHandoffService $handoff) {}

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

        if ($user->isStaff() && $user->staff_status !== 'active') {
            throw ValidationException::withMessages([
                'email' => ['This staff account has been suspended.'],
            ]);
        }

        // Never mint a token in another shop's origin: that origin also
        // serves their own landing-page HTML, so a token sitting in its
        // localStorage is reachable from whatever they publish there. Admins
        // hit this too — support access goes through impersonation on the
        // platform origin instead (custom_domain_context.md §11.5).
        if ($this->handoff->isForeignSubdomain($user, $request->getHost())) {
            return response()->json([
                'message' => 'Sign in at ' . FrontendUrl::platform() . ' — this address belongs to another shop.',
                'error_code' => 'foreign_subdomain',
                'login_url' => FrontendUrl::platform(),
            ], 403);
        }

        // A seller with a branded subdomain finishes logging in there, not
        // here. No token is minted on this origin — the destination mints
        // its own after exchanging the code (custom_domain_context.md §6).
        $targetHost = $this->handoff->redirectHostFor($user, $request->getHost());

        if ($targetHost !== null) {
            $code = $this->handoff->issue($user, $targetHost, $request->ip());

            return response()->json([
                'message' => 'Continue on your shop address.',
                'redirect_to' => $this->handoff->redirectUrl($targetHost, $code),
            ]);
        }

        $token = $user->createToken('frontend')->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
            ...$this->staffAuthContext($user),
        ]);
    }

    /**
     * Second half of the subdomain handoff: the destination origin trades a
     * single-use code for its own token. Public by necessity — the caller
     * has no token yet, which is the entire point.
     */
    public function exchangeHandoff(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:128']]);

        $user = $this->handoff->redeem($data['code'], $request->getHost(), $request->ip());

        if (! $user) {
            return response()->json([
                'message' => 'This sign-in link has expired or already been used. Please log in again.',
                'error_code' => 'handoff_invalid',
            ], 422);
        }

        if ($user->isStaff() && $user->staff_status !== 'active') {
            return response()->json([
                'message' => 'This staff account has been suspended.',
                'error_code' => 'staff_suspended',
            ], 403);
        }

        return response()->json([
            'message' => 'Login successful.',
            'token' => $user->createToken('frontend')->plainTextToken,
            'user' => $user,
            ...$this->staffAuthContext($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $user,
            ...$this->staffAuthContext($user),
        ]);
    }

    /**
     * Staff/Team sub-account role context — see staff_team_role_context.md §3.7.
     * `permissions`/`owner_name` are only meaningful (and only included) for
     * staff accounts; owner/admin accounts always have full access.
     */
    private function staffAuthContext(User $user): array
    {
        $context = [
            'is_staff' => $user->isStaff(),
            'must_change_password' => (bool) $user->must_change_password,
            'onboarding' => $this->onboardingState($user),
        ];

        if ($user->isStaff()) {
            $context['owner_name'] = $user->owner?->name;
            $context['permissions'] = $user->staffPermissions()->pluck('enabled', 'module_key')->all();
        }

        return $context;
    }

    /**
     * What a new seller still has to do before their shop has an address.
     *
     * Both steps are mandatory: a landing page cannot be published without a
     * subdomain, and a subdomain cannot be claimed without a saved profile —
     * so a seller who skips them has an account that cannot actually sell.
     * Admins and staff are exempt: neither owns a ShopProfile (staff use
     * their owner's).
     *
     * @return array{required: bool, needs_shop_profile: bool, needs_subdomain: bool, subdomain_host: string|null}
     */
    private function onboardingState(User $user): array
    {
        if ($user->isAdmin() || $user->isStaff()) {
            return ['required' => false, 'needs_shop_profile' => false, 'needs_subdomain' => false, 'subdomain_host' => null];
        }

        $profile = ShopProfile::where('user_id', $user->shopOwnerId())->first();
        $needsProfile = $profile === null;
        $needsSubdomain = $profile?->subdomainHost() === null;

        return [
            'required' => $needsProfile || $needsSubdomain,
            'needs_shop_profile' => $needsProfile,
            'needs_subdomain' => $needsSubdomain,
            'subdomain_host' => $profile?->subdomainHost(),
        ];
    }

    /**
     * Hand an already-signed-in session over to the caller's own subdomain.
     *
     * Login handles this at sign-in time, but a seller who claims their
     * subdomain mid-session is still holding a token minted on the platform
     * origin — and localStorage does not cross origins, so they would
     * otherwise have to sign in again to reach their new address.
     */
    public function startHandoff(Request $request): JsonResponse
    {
        $user = $request->user();
        $targetHost = $this->handoff->redirectHostFor($user, $request->getHost());

        if ($targetHost === null) {
            return response()->json([
                'message' => 'This account has no separate address to move to.',
                'error_code' => 'no_target_host',
            ], 422);
        }

        return response()->json([
            'redirect_to' => $this->handoff->redirectUrl(
                $targetHost,
                $this->handoff->issue($user, $targetHost, $request->ip()),
            ),
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

        if (array_key_exists('password', $validated)) {
            $validated['must_change_password'] = false; // clears the forced-change flag from staff temp-password creation, §3.7
        }

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