<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\FacebookLead;
use App\Models\Order;
use App\Services\Facebook\FacebookGraphClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FacebookLeadController extends Controller
{
    public function __construct(private readonly FacebookGraphClient $graphClient) {}

    public function index(Request $request): JsonResponse
    {
        $query = FacebookLead::where('user_id', auth()->id());

        if ($request->filled('channel')) {
            $query->where('channel', $request->string('channel'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->boolean('unread_only')) {
            $query->where('is_read', false);
        }
        if ($request->filled('q')) {
            $search = trim((string) $request->string('q'));
            $query->where(function ($sub) use ($search) {
                $sub->where('message', 'ilike', "%{$search}%")
                    ->orWhere('sender_name', 'ilike', "%{$search}%")
                    ->orWhere('detected_phone', 'ilike', "%{$search}%");
            });
        }

        $query->orderBy('received_at', $request->string('sort') === 'oldest' ? 'asc' : 'desc');

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $leads = $query->with(['customer:id,name,phone', 'pageConnection:id,page_name'])->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $this->withOrderAttribution($leads->items()),
            'meta' => ['total' => $leads->total(), 'current_page' => $leads->currentPage(), 'last_page' => $leads->lastPage()],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $lead = FacebookLead::where('user_id', auth()->id())->with(['customer:id,name,phone', 'pageConnection:id,page_name'])->findOrFail($id);
        [$lead] = $this->withOrderAttribution([$lead]);

        return response()->json(['success' => true, 'data' => $lead]);
    }

    /**
     * Attaches order_count/latest_order_id to each lead — lead → order
     * attribution via orders.source='facebook_inbox' + source_ref=lead id.
     * No schema change: mirrors the existing landing_page source/source_ref
     * pattern (see LandingPageController) rather than adding a new FK.
     *
     * @param  array<int, FacebookLead>  $leads
     * @return array<int, FacebookLead>
     */
    private function withOrderAttribution(array $leads): array
    {
        if (empty($leads)) {
            return $leads;
        }

        $leadIds = collect($leads)->pluck('id')->map(fn ($id) => (string) $id);

        $stats = Order::where('user_id', auth()->id())
            ->where('source', 'facebook_inbox')
            ->whereIn('source_ref', $leadIds)
            ->selectRaw('source_ref, COUNT(*) as order_count, MAX(id) as latest_order_id')
            ->groupBy('source_ref')
            ->get()
            ->keyBy('source_ref');

        foreach ($leads as $lead) {
            $stat = $stats->get((string) $lead->id);
            $lead->setAttribute('order_count', (int) ($stat->order_count ?? 0));
            $lead->setAttribute('latest_order_id', $stat->latest_order_id ?? null);
        }

        return $leads;
    }

    public function unreadCount(): JsonResponse
    {
        $count = FacebookLead::where('user_id', auth()->id())->where('is_read', false)->count();

        return response()->json(['success' => true, 'count' => $count]);
    }

    /**
     * Funnel summary for the leads inbox (§6 item 10) — unfiltered totals,
     * independent of whatever channel/status/search filter is currently
     * applied to index(). Orders count reuses the same source='facebook_inbox'
     * + source_ref=lead-id attribution as withOrderAttribution().
     */
    public function stats(): JsonResponse
    {
        $userId = auth()->id();

        $counts = FacebookLead::where('user_id', $userId)
            ->selectRaw("
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'new') as new_count,
                COUNT(*) FILTER (WHERE status = 'converted') as converted_count,
                COUNT(*) FILTER (WHERE status = 'ignored') as ignored_count,
                COUNT(*) FILTER (WHERE is_read = false) as unread_count
            ")
            ->first();

        $ordersCount = Order::where('user_id', $userId)
            ->where('source', 'facebook_inbox')
            ->whereIn('source_ref', function ($q) use ($userId) {
                $q->select(DB::raw('id::text'))->from('facebook_leads')->where('user_id', $userId);
            })
            ->distinct()
            ->count('source_ref');

        return response()->json([
            'success' => true,
            'data' => [
                'total' => (int) $counts->total,
                'new' => (int) $counts->new_count,
                'converted' => (int) $counts->converted_count,
                'ignored' => (int) $counts->ignored_count,
                'unread' => (int) $counts->unread_count,
                'orders' => $ordersCount,
            ],
        ]);
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

    /**
     * Sends a Page reply back to the lead — a Messenger message for
     * channel=message leads, a Page comment for channel=comment leads.
     * Comment replies need pages_manage_engagement, which isn't in
     * Advanced Access for this app yet (see facebook_integration_context.md)
     * — the Graph API call fails until that permission is granted on
     * reconnect, surfaced here as a normal 422 rather than a 500.
     */
    public function reply(Request $request, int $id): JsonResponse
    {
        $lead = FacebookLead::where('user_id', auth()->id())->with('pageConnection')->findOrFail($id);

        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $pageAccessToken = $lead->pageConnection?->page_access_token;
        if (! $pageAccessToken) {
            return response()->json(['success' => false, 'message' => 'Facebook Page is not connected.'], 422);
        }

        $sent = $lead->channel === 'message'
            ? $this->graphClient->sendMessage($lead->sender_fb_id, $pageAccessToken, $data['message'])
            : $this->graphClient->replyToComment($lead->fb_event_id, $pageAccessToken, $data['message']);

        if (! $sent) {
            $reason = $lead->channel === 'message'
                ? 'Facebook rejected the reply — the 24-hour messaging window for this conversation may have closed.'
                : 'Facebook rejected the reply — comment replies need the pages_manage_engagement permission, which this Page connection may not have granted yet.';

            return response()->json(['success' => false, 'message' => $reason], 422);
        }

        $lead->update(['replied_at' => now(), 'reply_message' => $data['message']]);

        return response()->json(['success' => true, 'data' => $lead->fresh()]);
    }
}
