<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Support\PhoneIntelCache;
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

        PhoneIntelCache::bump($data['phone']);

        return response()->json([
            'success' => true,
            'data'    => DB::table('customer_blacklist')->find($id),
        ], 201);
    }

    public function removeBlacklist(int $id): JsonResponse
    {
        $row = DB::table('customer_blacklist')
            ->where('user_id', auth()->id())
            ->where('id', $id)
            ->first();

        if (! $row) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        DB::table('customer_blacklist')
            ->where('user_id', auth()->id())
            ->where('id', $id)
            ->delete();

        PhoneIntelCache::bump($row->phone);

        return response()->json(['success' => true, 'message' => 'Removed from blacklist.']);
    }

    // ── Core scoring logic ────────────────────────────────────────────────────

    public function computeScore(int $userId, string $phone): array
    {
        $phone   = PhoneIntelCache::normalizePhone($phone);
        $match10 = PhoneIntelCache::phone10($phone);

        $sharedStats = PhoneIntelCache::remember('fraud-shared-stats', $match10, 180, function () use ($match10) {
            return Order::query()
                ->whereRaw("right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = ?", [$match10])
                ->selectRaw("COUNT(*) as total,
                    COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
                    COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
                    COUNT(*) FILTER (WHERE status = 'returned') as returned,
                    COUNT(DISTINCT user_id) as seller_count")
                ->first();
        });

        $globalBlacklistCount = (int) PhoneIntelCache::remember('fraud-global-blacklist', $match10, 180, function () use ($match10) {
            return DB::table('customer_blacklist')
                ->whereRaw("right(regexp_replace(phone, '\\D', '', 'g'), 10) = ?", [$match10])
                ->distinct('user_id')
                ->count('user_id');
        });

        $userOrders = PhoneIntelCache::remember('fraud-user-orders', $match10, 120, function () use ($match10, $userId) {
            return Order::query()
                ->where('user_id', $userId)
                ->whereRaw("right(regexp_replace(customer_phone, '\\D', '', 'g'), 10) = ?", [$match10])
                ->get(['id', 'status', 'risk_level', 'fraud_score', 'created_at', 'order_number', 'total']);
        }, $userId);

        // Only this user's order details are returned in list view
        $orders = collect($userOrders)
            ->values()
            ->map(fn ($o) => [
                'id'           => $o->id,
                'status'       => $o->status,
                'risk_level'   => $o->risk_level,
                'fraud_score'  => $o->fraud_score,
                'created_at'   => $o->created_at,
                'order_number' => $o->order_number,
                'total'        => $o->total,
            ]);

        $total       = (int) ($sharedStats->total ?? 0);
        $delivered   = (int) ($sharedStats->delivered ?? 0);
        $cancelled   = (int) ($sharedStats->cancelled ?? 0);
        $returned    = (int) ($sharedStats->returned ?? 0);
        $sellerCount = (int) ($sharedStats->seller_count ?? 0);

        $myTotal     = $orders->count();
        $myDelivered = $orders->where('status', 'delivered')->count();
        $myCancelled = $orders->where('status', 'cancelled')->count();
        $myReturned  = $orders->where('status', 'returned')->count();

        $score = 0;

        if ($total >= 3) {
            $returnRate  = $total > 0 ? ($returned / $total) : 0;
            $cancelRate  = $total > 0 ? ($cancelled / $total) : 0;
            $deliverRate = $total > 0 ? ($delivered / $total) : 0;

            if ($returnRate > 0.40) {
                $score += 30;
            }
            if ($cancelRate > 0.40) {
                $score += 20;
            }
            if ($returned >= 2) {
                $score += 15;
            }
            if ($deliverRate >= 0.7) {
                $score -= 20;
            }
        } elseif ($total >= 1) {
            if ($returned >= 1) {
                $score += 15;
            }
            if ($cancelled >= 1) {
                $score += 10;
            }
            if ($delivered >= 1) {
                $score -= 10;
            }
        }

        // Cross-user reuse pattern can indicate risky phone behavior.
        if ($sellerCount >= 3) {
            $score += 10;
        }

        // Phone format check
        if (strlen($phone) !== 11 || ! str_starts_with($phone, '0')) {
            $score += 5;
        }

        // My blacklist status (used by UI actions)
        $isBlacklisted = DB::table('customer_blacklist')
            ->where('user_id', $userId)
            ->whereRaw("right(regexp_replace(phone, '\\D', '', 'g'), 10) = ?", [$match10])
            ->exists();

        // Shared blacklist signal across all users
        if ($globalBlacklistCount > 0) {
            $score += 40;
        }

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
            'shared'         => [
                'seller_count'             => $sellerCount,
                'global_blacklisted_count' => $globalBlacklistCount,
                'my_total'                 => $myTotal,
                'my_delivered'             => $myDelivered,
                'my_cancelled'             => $myCancelled,
                'my_returned'              => $myReturned,
            ],
            'orders'         => $orders->values(),
        ];
    }
}
