<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FraudController extends Controller
{
    // ── Compute fraud score for a phone number ────────────────────────────────

    public function checkPhone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => 'required|string|max:20',
        ]);

        $result = $this->computeScore(auth()->id(), $data['phone']);

        return response()->json(['success' => true, 'data' => $result]);
    }

    // ── Bulk check multiple phones ────────────────────────────────────────────

    public function bulkCheck(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phones'   => 'required|array|min:1|max:100',
            'phones.*' => 'required|string|max:20',
        ]);

        $results = [];
        foreach ($data['phones'] as $phone) {
            $results[] = $this->computeScore(auth()->id(), $phone);
        }

        return response()->json(['success' => true, 'data' => $results]);
    }

    // ── Blacklist ─────────────────────────────────────────────────────────────

    public function blacklist(Request $request): JsonResponse
    {
        $userId = auth()->id();
        $query  = DB::table('customer_blacklist')->where('user_id', $userId);

        if ($request->filled('search')) {
            $query->where('phone', 'like', '%' . $request->search . '%');
        }

        $perPage  = min((int) ($request->per_page ?? 20), 100);
        $total    = $query->count();
        $page     = max(1, (int) ($request->page ?? 1));
        $items    = $query->orderByDesc('blocked_at')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $items,
            'meta'    => [
                'total'        => $total,
                'current_page' => $page,
                'last_page'    => max(1, (int) ceil($total / $perPage)),
            ],
        ]);
    }

    public function addBlacklist(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone'  => 'required|string|max:20',
            'reason' => 'nullable|string|max:300',
        ]);

        $userId = auth()->id();

        $existing = DB::table('customer_blacklist')
            ->where('user_id', $userId)
            ->where('phone', $data['phone'])
            ->first();

        if ($existing) {
            return response()->json(['success' => false, 'message' => 'Phone already blacklisted.'], 422);
        }

        $id = DB::table('customer_blacklist')->insertGetId([
            'user_id'    => $userId,
            'phone'      => $data['phone'],
            'reason'     => $data['reason'] ?? null,
            'blocked_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data'    => DB::table('customer_blacklist')->find($id),
        ], 201);
    }

    public function removeBlacklist(int $id): JsonResponse
    {
        $deleted = DB::table('customer_blacklist')
            ->where('user_id', auth()->id())
            ->where('id', $id)
            ->delete();

        if (! $deleted) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        return response()->json(['success' => true, 'message' => 'Removed from blacklist.']);
    }

    // ── Core scoring logic ────────────────────────────────────────────────────

    public function computeScore(int $userId, string $phone): array
    {
        $phone = preg_replace('/\D/', '', $phone);

        // Get all orders for this phone by this user
        $orders = Order::where('user_id', $userId)
            ->where('customer_phone', 'like', '%' . substr($phone, -10))
            ->get(['id', 'status', 'risk_level', 'fraud_score', 'created_at', 'order_number', 'total']);

        $total     = $orders->count();
        $delivered = $orders->where('status', 'delivered')->count();
        $cancelled = $orders->where('status', 'cancelled')->count();
        $returned  = $orders->where('status', 'returned')->count();

        $score = 0;

        if ($total >= 3) {
            $returnRate  = $total > 0 ? ($returned / $total) : 0;
            $cancelRate  = $total > 0 ? ($cancelled / $total) : 0;
            $deliverRate = $total > 0 ? ($delivered / $total) : 0;

            if ($returnRate > 0.40)  $score += 30;
            if ($cancelRate > 0.40)  $score += 20;
            if ($returned >= 2)      $score += 15;
            if ($deliverRate >= 0.7) $score -= 20;
        } elseif ($total >= 1) {
            if ($returned >= 1)  $score += 15;
            if ($cancelled >= 1) $score += 10;
            if ($delivered >= 1) $score -= 10;
        }

        // Phone format check
        if (strlen($phone) !== 11 || ! str_starts_with($phone, '0')) {
            $score += 5;
        }

        // Blacklisted?
        $isBlacklisted = DB::table('customer_blacklist')
            ->where('user_id', $userId)
            ->where('phone', 'like', '%' . substr($phone, -10))
            ->exists();

        if ($isBlacklisted) $score += 40;

        $score = max(0, min(100, $score));

        $riskLevel = match (true) {
            $score >= 61 => 'high',
            $score >= 31 => 'medium',
            default      => 'low',
        };

        // Upsert fraud profile
        DB::table('customer_fraud_profiles')->updateOrInsert(
            ['user_id' => $userId, 'phone' => $phone],
            [
                'total_orders'    => $total,
                'delivered_count' => $delivered,
                'cancelled_count' => $cancelled,
                'return_count'    => $returned,
                'fraud_score'     => $score,
                'risk_level'      => $riskLevel,
                'last_updated'    => now(),
                'updated_at'      => now(),
            ]
        );

        return [
            'phone'          => $phone,
            'fraud_score'    => $score,
            'risk_level'     => $riskLevel,
            'is_blacklisted' => $isBlacklisted,
            'stats'          => compact('total', 'delivered', 'cancelled', 'returned'),
            'orders'         => $orders->values(),
        ];
    }
}
