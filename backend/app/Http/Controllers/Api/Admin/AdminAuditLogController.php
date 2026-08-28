<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminAuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Read-only listing for the admin audit trail — security_hardening_context.md §3.
 * Shared-admin resource (every admin sees every other admin's actions, same
 * as the flat admin role model elsewhere — CONTEXT.md §25 "admin-shared").
 */
class AdminAuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AdminAuditLog::query()->with('admin:id,name,email')->latest();

        if ($request->filled('admin_user_id')) {
            $query->where('admin_user_id', (int) $request->input('admin_user_id'));
        }

        if ($request->filled('action')) {
            $query->where('action', 'like', '%' . $request->input('action') . '%');
        }

        if ($request->filled('from')) {
            $query->whereDate('created_at', '>=', $request->input('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('created_at', '<=', $request->input('to'));
        }

        $perPage = min(100, max(1, (int) $request->input('per_page', 25)));

        return response()->json($query->paginate($perPage));
    }
}
