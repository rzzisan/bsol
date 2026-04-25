<?php

namespace App\Http\Controllers;

use App\Models\SmsCredit;
use App\Models\SmsCreditHistory;
use App\Models\SmsCreditSetting;
use App\Models\User;
use App\Services\SmsCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSmsCreditController extends Controller
{
    public function __construct(private readonly SmsCreditService $creditService) {}

    // ------------------------------------------------------------------ settings

    public function getSettings(): JsonResponse
    {
        $settings = SmsCreditSetting::getSetting();

        return response()->json([
            'settings' => [
                'id' => $settings->id,
                'rate_per_credit' => (float) $settings->rate_per_credit,
                'chars_per_credit_english' => $settings->chars_per_credit_english,
                'chars_per_credit_unicode' => $settings->chars_per_credit_unicode,
                'currency' => $settings->currency,
            ],
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rate_per_credit' => ['required', 'numeric', 'min:0.0001', 'max:9999'],
            'chars_per_credit_english' => ['sometimes', 'required', 'integer', 'min:1', 'max:1000'],
            'chars_per_credit_unicode' => ['sometimes', 'required', 'integer', 'min:1', 'max:1000'],
            'currency' => ['sometimes', 'required', 'string', 'max:10'],
        ]);

        $settings = SmsCreditSetting::getSetting();
        $settings->update($validated);

        return response()->json([
            'message' => 'SMS credit settings updated successfully.',
            'settings' => [
                'id' => $settings->id,
                'rate_per_credit' => (float) $settings->rate_per_credit,
                'chars_per_credit_english' => $settings->chars_per_credit_english,
                'chars_per_credit_unicode' => $settings->chars_per_credit_unicode,
                'currency' => $settings->currency,
            ],
        ]);
    }

    // ------------------------------------------------------------------ user credit list

    public function listUserCredits(): JsonResponse
    {
        $users = User::query()
            ->leftJoin('sms_credits', 'users.id', '=', 'sms_credits.user_id')
            ->orderBy('users.id')
            ->get([
                'users.id',
                'users.name',
                'users.email',
                'users.mobile',
                'users.role',
                \DB::raw('COALESCE(sms_credits.balance, 0) AS sms_balance'),
            ]);

        return response()->json([
            'users' => $users->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'mobile' => $u->mobile,
                'role' => $u->role,
                'sms_balance' => (int) $u->sms_balance,
            ]),
        ]);
    }

    // ------------------------------------------------------------------ recharge

    public function recharge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'credits' => ['required', 'integer', 'min:1', 'max:1000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $adminId = $request->user()?->id;

        $newBalance = $this->creditService->recharge(
            userId: $validated['user_id'],
            credits: $validated['credits'],
            rechargedBy: $adminId,
            note: $validated['note'] ?? null,
        );

        $user = User::find($validated['user_id']);

        return response()->json([
            'message' => "Recharged {$validated['credits']} credits for {$user->name}.",
            'user_id' => $user->id,
            'user_name' => $user->name,
            'credits_added' => $validated['credits'],
            'new_balance' => $newBalance,
        ]);
    }

    // ------------------------------------------------------------------ credit history

    public function creditHistory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'type' => ['nullable', Rule::in(['recharge', 'deduct'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = SmsCreditHistory::query()
            ->with([
                'user:id,name,email,mobile',
                'rechargedBy:id,name',
            ])
            ->latest('id');

        if (! empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (! empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        $histories = $query->paginate($perPage);

        return response()->json([
            'histories' => collect($histories->items())->map(fn (SmsCreditHistory $h) => [
                'id' => $h->id,
                'user_id' => $h->user_id,
                'user_name' => $h->user?->name,
                'user_mobile' => $h->user?->mobile,
                'type' => $h->type,
                'credits' => $h->credits,
                'balance_before' => $h->balance_before,
                'balance_after' => $h->balance_after,
                'note' => $h->note,
                'recharged_by_name' => $h->rechargedBy?->name,
                'created_at' => $h->created_at?->toIso8601String(),
            ]),
            'pagination' => [
                'total' => $histories->total(),
                'per_page' => $histories->perPage(),
                'current_page' => $histories->currentPage(),
                'last_page' => $histories->lastPage(),
            ],
        ]);
    }
}
