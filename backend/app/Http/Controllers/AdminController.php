<?php

namespace App\Http\Controllers;

use App\Models\EmailOtpVerification;
use App\Models\RegistrationSetting;
use App\Models\SubscriptionPackage;
use App\Models\SmsGateway;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    private const USER_STATUSES = ['pending', 'active', 'inactive', 'expired', 'left'];

    public function dashboardSummary(): JsonResponse
    {
        return response()->json([
            'totals' => [
                'users' => User::count(),
                'admins' => User::where('role', 'admin')->count(),
                'active_packages' => SubscriptionPackage::where('is_active', true)->count(),
            ],
            'recent_users' => User::latest()->take(5)->get(['id', 'name', 'email', 'mobile', 'role', 'created_at']),
        ]);
    }

    public function listUsers(): JsonResponse
    {
        $users = User::query()
            ->with(['subscriptionPackage:id,name,slug', 'assignedGateway:id,name,provider'])
            ->leftJoin('sms_credits', 'users.id', '=', 'sms_credits.user_id')
            ->latest()
            ->get([
                'users.id',
                'users.name',
                'users.mobile',
                'users.email',
                'users.role',
                'users.user_status',
                'users.subscription_package_id',
                'users.sms_gateway_id',
                'users.created_at',
                \DB::raw('COALESCE(sms_credits.balance, 0) as sms_balance'),
            ]);

        return response()->json([
            'users' => $users,
        ]);
    }

    public function createUser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/', 'unique:users,mobile'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'user'])],
            'user_status' => ['sometimes', 'required', Rule::in(self::USER_STATUSES)],
            'subscription_package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
            'sms_gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
        ]);

        $user = User::create($validated);

        return response()->json([
            'message' => 'User created successfully.',
            'user' => $user->load('assignedGateway:id,name,provider'),
        ], 201);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/', Rule::unique('users', 'mobile')->ignore($user->id)],
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['sometimes', 'required', 'string', 'min:8'],
            'role' => ['sometimes', 'required', Rule::in(['admin', 'user'])],
            'user_status' => ['sometimes', 'required', Rule::in(self::USER_STATUSES)],
            'subscription_package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
            'sms_gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
        ]);

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
            'message' => 'User updated successfully.',
            'user' => $user->load('assignedGateway:id,name,provider'),
        ]);
    }

    public function deleteUser(User $user): JsonResponse
    {
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully.',
        ]);
    }

    public function listPackages(): JsonResponse
    {
        return response()->json([
            'packages' => SubscriptionPackage::latest()->get(),
        ]);
    }

    public function createPackage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'unique:subscription_packages,slug'],
            'price' => ['required', 'numeric', 'min:0'],
            'duration_days' => ['required', 'integer', 'min:1'],
            'max_orders' => ['nullable', 'integer', 'min:0'],
            'features' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (empty($validated['slug'])) {
            $validated['slug'] = $this->generateUniquePackageSlug($validated['name']);
        }

        $package = SubscriptionPackage::create($validated);

        return response()->json([
            'message' => 'Package created successfully.',
            'package' => $package,
        ], 201);
    }

    public function updatePackage(Request $request, SubscriptionPackage $package): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'slug' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('subscription_packages', 'slug')->ignore($package->id)],
            'price' => ['sometimes', 'required', 'numeric', 'min:0'],
            'duration_days' => ['sometimes', 'required', 'integer', 'min:1'],
            'max_orders' => ['nullable', 'integer', 'min:0'],
            'features' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $package->update($validated);

        return response()->json([
            'message' => 'Package updated successfully.',
            'package' => $package,
        ]);
    }

    public function deletePackage(SubscriptionPackage $package): JsonResponse
    {
        // If this package is the current registration default, clear it
        $regSetting = RegistrationSetting::getSetting();
        if ($regSetting->default_subscription_package_id === $package->id) {
            $regSetting->update(['default_subscription_package_id' => null]);
        }

        $package->delete();

        return response()->json([
            'message' => 'Package deleted successfully.',
        ]);
    }

    public function getRegistrationDefaults(): JsonResponse
    {
        $setting = RegistrationSetting::getSetting()->load('defaultPackage:id,name,slug');

        return response()->json([
            'defaults' => [
                'default_user_status' => $setting->default_user_status,
                'default_subscription_package_id' => $setting->default_subscription_package_id,
                'default_package' => $setting->defaultPackage,
            ],
        ]);
    }

    public function updateRegistrationDefaults(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'default_user_status' => ['required', Rule::in(self::USER_STATUSES)],
            'default_subscription_package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
        ]);

        $setting = RegistrationSetting::getSetting();
        $setting->update($validated);
        $setting->load('defaultPackage:id,name,slug');

        return response()->json([
            'message' => 'Registration defaults updated successfully.',
            'defaults' => [
                'default_user_status' => $setting->default_user_status,
                'default_subscription_package_id' => $setting->default_subscription_package_id,
                'default_package' => $setting->defaultPackage,
            ],
        ]);
    }

    private function generateUniquePackageSlug(string $name): string
    {
        $base = Str::slug($name);
        if ($base === '') {
            $base = 'package';
        }

        $slug = $base;
        $counter = 2;

        while (SubscriptionPackage::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$counter;
            $counter++;
        }

        return $slug;
    }
}
