<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\FacebookLead;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FacebookLeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = FacebookLead::where('user_id', auth()->id())->orderByDesc('received_at');

        if ($request->filled('channel')) {
            $query->where('channel', $request->string('channel'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $leads = $query->with('customer:id,name,phone')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $leads->items(),
            'meta' => ['total' => $leads->total(), 'current_page' => $leads->currentPage(), 'last_page' => $leads->lastPage()],
        ]);
    }

    public function unreadCount(): JsonResponse
    {
        $count = FacebookLead::where('user_id', auth()->id())->where('is_read', false)->count();

        return response()->json(['success' => true, 'count' => $count]);
    }

    public function markRead(int $id): JsonResponse
    {
        $lead = FacebookLead::where('user_id', auth()->id())->findOrFail($id);
        $lead->update(['is_read' => true]);

        return response()->json(['success' => true, 'data' => $lead]);
    }

    public function ignore(int $id): JsonResponse
    {
        $lead = FacebookLead::where('user_id', auth()->id())->findOrFail($id);
        $lead->update(['status' => 'ignored', 'is_read' => true]);

        return response()->json(['success' => true, 'data' => $lead]);
    }

    public function convertToCustomer(Request $request, int $id): JsonResponse
    {
        $lead = FacebookLead::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^01[3-9][0-9]{8}$/'],
            'name' => ['nullable', 'string', 'max:150'],
        ]);

        $customer = DB::transaction(function () use ($lead, $data) {
            $customer = Customer::firstOrCreate(
                ['user_id' => $lead->user_id, 'phone' => $data['phone']],
                ['name' => $data['name'] ?? $lead->sender_name, 'tags' => []]
            );

            $lead->update([
                'detected_phone' => $data['phone'],
                'customer_id' => $customer->id,
                'status' => 'converted',
                'is_read' => true,
            ]);

            return $customer;
        });

        return response()->json(['success' => true, 'data' => ['lead' => $lead->fresh(), 'customer' => $customer]]);
    }
}
