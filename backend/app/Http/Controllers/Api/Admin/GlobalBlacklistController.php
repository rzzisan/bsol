<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Read-only admin oversight of the platform-wide customer blacklist —
 * pre_launch_polish_context.md §খ.
 *
 * Any seller can blacklist a phone number, and FraudController::computeScore()
 * gives every OTHER seller checking that same phone a +40 score bump the
 * moment any one seller has blacklisted it (globalBlacklistCount > 0) — with
 * no validation, rate-limit (now throttled, see routes/api.php), or way for
 * an admin to review who flagged what and why if abuse or a dispute is
 * suspected. This doesn't add a dispute workflow (no customer-facing portal
 * exists in this platform to submit one) — just the minimum oversight an
 * admin needs to manually investigate via existing tools (impersonation,
 * support chat) if a pattern looks wrong.
 */
class GlobalBlacklistController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = DB::table('customer_blacklist as cb')
            ->join('users as u', 'u.id', '=', 'cb.user_id')
            ->select([
                'cb.id', 'cb.phone', 'cb.reason', 'cb.blocked_at', 'cb.created_at',
                'u.id as seller_id', 'u.name as seller_name', 'u.email as seller_email',
            ]);

        if ($request->filled('phone')) {
            $query->where('cb.phone', 'like', '%' . $request->input('phone') . '%');
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 25)));
        $page = max(1, (int) $request->input('page', 1));

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('cb.created_at')
            ->forPage($page, $perPage)
            ->get();

        // How many DISTINCT sellers have blacklisted each phone on this page
        // — a phone flagged by several unrelated sellers is a much stronger
        // signal than a single flag, which is exactly the kind of context
        // an admin needs to tell "probably a real bad actor" from "one
        // seller's grudge" apart.
        $phones = $rows->pluck('phone')->unique()->values();
        $corroboration = DB::table('customer_blacklist')
            ->select('phone', DB::raw('count(distinct user_id) as seller_count'))
            ->whereIn('phone', $phones)
            ->groupBy('phone')
            ->pluck('seller_count', 'phone');

        $data = $rows->map(function ($row) use ($corroboration) {
            $row->seller_count = (int) ($corroboration[$row->phone] ?? 1);
            return $row;
        });

        return response()->json([
            'data' => $data,
            'total' => $total,
            'current_page' => $page,
            'last_page' => (int) ceil($total / $perPage),
        ]);
    }
}
