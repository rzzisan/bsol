<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StaffPermission;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Owner-only staff/team management — see staff_team_role_context.md §3.6/§3.7/§3.8.
 * Every route in this controller sits behind `auth:sanctum` + `owner_only`
 * middleware (routes/api.php), so `auth()->id()` here is always the shop
 * owner, never a staff account.
 */
class StaffController extends Controller
{
    public function index(): JsonResponse
    {
        $owner = auth()->user();

        $staff = User::where('owner_id', $owner->id)
            ->with('staffPermissions')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'email', 'mobile', 'staff_status', 'must_change_password', 'created_at']);

        return response()->json([
            'staff' => $staff->map(fn (User $member) => $this->presentStaff($member)),
            'seat_usage' => $this->seatUsage($owner),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $owner = auth()->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'mobile' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+\-\s]{7,20}$/', Rule::unique('users', 'mobile')->whereNull('deleted_at')],
            'temp_password' => ['nullable', 'string', 'min:8'],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['boolean'],
        ]);

        $seatUsage = $this->seatUsage($owner);
        if ($seatUsage['max_staff'] !== null && $seatUsage['used'] >= $seatUsage['max_staff']) {
            throw ValidationException::withMessages([
                'staff' => ["আপনার বর্তমান প্যাকেজে সর্বোচ্চ {$seatUsage['max_staff']} জন staff রাখা যাবে। আরও staff যোগ করতে প্যাকেজ আপগ্রেড করুন।"],
            ]);
        }

        $tempPassword = $validated['temp_password'] ?? Str::password(12, symbols: false);
        $permissions = $this->sanitizePermissions($validated['permissions'] ?? []);

        $staff = DB::transaction(function () use ($owner, $validated, $tempPassword, $permissions) {
            $staff = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'mobile' => $validated['mobile'] ?? null,
                'email_verified_at' => now(), // owner-created — treated as pre-verified
                'password' => $tempPassword, // 'hashed' cast on User model hashes this
                'role' => 'user',
                'owner_id' => $owner->id,
                'staff_status' => 'active',
                'must_change_password' => true,
            ]);

            $this->syncPermissions($staff, $permissions);

            return $staff;
        });

        return response()->json([
            'message' => 'Staff account created.',
            'staff' => $this->presentStaff($staff->fresh('staffPermissions')),
            'temp_password' => $tempPassword, // shown once — never retrievable again, plaintext is not stored
        ], 201);
    }

    public function update(Request $request, User $staff): JsonResponse
    {
        $this->authorizeOwnership($staff);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'staff_status' => ['sometimes', 'required', Rule::in(['active', 'suspended'])],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['boolean'],
        ]);

        DB::transaction(function () use ($staff, $validated) {
            $staff->fill(collect($validated)->only(['name', 'staff_status'])->all());

            if ($staff->isDirty('staff_status') && $staff->staff_status === 'suspended') {
                $staff->tokens()->delete(); // §3.8 — revoke immediately, don't rely on the flag alone
            }

            $staff->save();

            if (array_key_exists('permissions', $validated)) {
                $this->syncPermissions($staff, $this->sanitizePermissions($validated['permissions']));
            }
        });

        return response()->json([
            'message' => 'Staff account updated.',
            'staff' => $this->presentStaff($staff->fresh('staffPermissions')),
        ]);
    }

    public function resetPassword(Request $request, User $staff): JsonResponse
    {
        $this->authorizeOwnership($staff);

        $validated = $request->validate([
            'temp_password' => ['nullable', 'string', 'min:8'],
        ]);

        $tempPassword = $validated['temp_password'] ?? Str::password(12, symbols: false);

        $staff->update([
            'password' => $tempPassword,
            'must_change_password' => true,
        ]);
        $staff->tokens()->delete(); // force re-login with the new temp password

        return response()->json([
            'message' => 'Password reset. Share the new temporary password with the staff member.',
            'temp_password' => $tempPassword,
        ]);
    }

    public function destroy(User $staff): JsonResponse
    {
        $this->authorizeOwnership($staff);

        $staff->tokens()->delete();
        $staff->delete(); // SoftDeletes — orders/products created under this staff's user_id stay intact for audit

        return response()->json([
            'message' => 'Staff account removed.',
        ]);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private function authorizeOwnership(User $staff): void
    {
        abort_unless($staff->owner_id === auth()->id(), 404);
    }

    private function sanitizePermissions(array $permissions): array
    {
        return collect($permissions)
            ->only(StaffPermission::MODULE_KEYS)
            ->map(fn ($enabled) => (bool) $enabled)
            ->all();
    }

    private function syncPermissions(User $staff, array $permissions): void
    {
        foreach (StaffPermission::MODULE_KEYS as $moduleKey) {
            StaffPermission::updateOrCreate(
                ['user_id' => $staff->id, 'module_key' => $moduleKey],
                ['enabled' => $permissions[$moduleKey] ?? false]
            );
        }
    }

    private function seatUsage(User $owner): array
    {
        $maxStaff = $owner->subscriptionPackage?->max_staff; // null = unlimited

        return [
            'used' => User::where('owner_id', $owner->id)->count(),
            'max_staff' => $maxStaff,
        ];
    }

    private function presentStaff(User $member): array
    {
        return [
            'id' => $member->id,
            'name' => $member->name,
            'email' => $member->email,
            'mobile' => $member->mobile,
            'staff_status' => $member->staff_status,
            'must_change_password' => (bool) $member->must_change_password,
            'created_at' => $member->created_at,
            'permissions' => $member->staffPermissions
                ->pluck('enabled', 'module_key')
                ->all(),
        ];
    }
}
