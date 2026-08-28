<?php

namespace App\Services\Security;

use App\Models\AdminAuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request as RequestFacade;

/**
 * Thin write-only helper for admin_audit_logs — security_hardening_context.md.
 *
 * Deliberately not wired into every single admin endpoint (dozens of them)
 * in this first pass; it covers the actions with real financial or
 * account-takeover blast radius (user role/delete, package pricing,
 * subscription/addon payment approval, 2FA changes, admin login). Add a
 * call here whenever a new admin action meets that bar — see
 * security_hardening_context.md §3 for the current list and how to extend it.
 */
class AdminAuditLogger
{
    /**
     * $actingAdminId defaults to the current auth guard (Auth::id()), which
     * is correct for every ordinary admin-authenticated request. Login
     * itself is the one exception — a Sanctum token is minted mid-request
     * but never attached to that request's auth guard, so Auth::id() would
     * silently log the action against nobody; AuthController passes the
     * just-authenticated user's id explicitly there instead.
     */
    public static function log(
        string $action,
        ?string $targetType = null,
        int|string|null $targetId = null,
        array $meta = [],
        ?int $actingAdminId = null,
    ): void {
        AdminAuditLog::create([
            'admin_user_id' => $actingAdminId ?? Auth::id(),
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId !== null ? (int) $targetId : null,
            'meta' => $meta,
            'ip_address' => RequestFacade::ip(),
        ]);
    }
}
