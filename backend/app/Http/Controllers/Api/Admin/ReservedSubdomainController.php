<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ReservedSubdomain;
use App\Models\ShopProfile;
use App\Support\SubdomainPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Admin management of the subdomain labels sellers cannot claim
 * (custom_domain_context.md §5.3). is_admin-gated by the route group.
 */
class ReservedSubdomainController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = ReservedSubdomain::query()
            ->when($request->filled('q'), function ($query) use ($request) {
                $term = '%' . $request->string('q') . '%';
                $query->where(fn ($q) => $q->where('label', 'ilike', $term)->orWhere('reason', 'ilike', $term));
            })
            ->orderByDesc('is_system')
            ->orderBy('label')
            ->get(['id', 'label', 'reason', 'is_system', 'created_at']);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate(['reason' => ['nullable', 'string', 'max:200']]);

        $label = SubdomainPolicy::normalize($request->input('label'));

        if (strlen($label) < 1 || ! preg_match('/^[a-z0-9][a-z0-9-]*[a-z0-9]?$/', $label)) {
            return response()->json([
                'success' => false,
                'message' => 'Use lowercase letters, numbers and hyphens only.',
                'error_code' => 'invalid_format',
            ], 422);
        }

        if (ReservedSubdomain::where('label', $label)->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'This label is already reserved.',
                'error_code' => 'already_reserved',
            ], 422);
        }

        // Reserving a label a seller is already using would not take it away
        // from them — nothing re-checks an existing subdomain — so it would
        // only look like it worked. Say so instead.
        $inUse = ShopProfile::where('subdomain', $label)->where('subdomain_status', 'active')->exists();

        if ($inUse) {
            return response()->json([
                'success' => false,
                'message' => 'A shop is currently using this subdomain. Ask them to change it first.',
                'error_code' => 'in_use',
            ], 422);
        }

        $row = ReservedSubdomain::create([
            'label' => $label,
            'reason' => $request->input('reason'),
            'is_system' => false,
            'created_by' => auth()->id(),
        ]);

        return response()->json(['success' => true, 'data' => $row], 201);
    }

    public function destroy(int $id): JsonResponse
    {
        $row = ReservedSubdomain::find($id);

        if (! $row) {
            return response()->json(['success' => false, 'message' => 'Not found.'], 404);
        }

        // Protected on purpose: these labels either resolve in DNS already or
        // carry mail/infrastructure, and releasing one would let a seller
        // take over a live service.
        if ($row->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'This label is protected — it points at a live service and cannot be released.',
                'error_code' => 'system_protected',
            ], 422);
        }

        $row->delete();

        return response()->json(['success' => true]);
    }
}
