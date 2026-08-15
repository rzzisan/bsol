<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AbandonedCheckout;
use App\Models\Customer;
use App\Models\LandingPage;
use App\Support\LandingPageResolver;
use App\Services\AbandonedCheckoutService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class AbandonedCheckoutController extends Controller
{
    // ── Public ───────────────────────────────────────────────────────────────

    public function save(Request $request, string $slug): JsonResponse
    {
        $page = LandingPageResolver::query($slug, $request)
            ->where('status', 'published')
            ->with(['products.product', 'products.variant.optionValues.option'])
            ->firstOrFail();

        $data = $request->validate([
            'session_token' => ['required', 'string', 'max:64'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
            'customer_email' => ['nullable', 'string', 'max:150'],
            'customer_address' => ['nullable', 'string', 'max:500'],
            'customer_district' => ['nullable', 'string', 'max:100'],
            'customer_thana' => ['nullable', 'string', 'max:100'],
            'customer_area' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'custom_fields' => ['nullable', 'array'],
            'items' => ['nullable', 'array'],
            'items.*.enabled' => ['nullable', 'boolean'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.product_variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        app(AbandonedCheckoutService::class)->capture($page, $data, $request->ip());

        return response()->json(['success' => true]);
    }

    public function resumeShow(Request $request, string $slug): JsonResponse
    {
        $page = LandingPageResolver::query($slug, $request)
            ->where('status', 'published')
            ->firstOrFail();

        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $checkout = app(AbandonedCheckoutService::class)->resume($page, $validated['token']);

        if (!$checkout) {
            abort(404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'session_token' => $checkout->session_token,
                'customer_name' => $checkout->customer_name,
                'customer_phone' => $checkout->customer_phone,
                'customer_email' => $checkout->customer_email,
                'customer_address' => $checkout->customer_address,
                'customer_district' => $checkout->customer_district,
                'customer_thana' => $checkout->customer_thana,
                'customer_area' => $checkout->customer_area,
                'notes' => $checkout->notes,
                'custom_fields' => $checkout->custom_fields,
                'items' => $checkout->items,
            ],
        ]);
    }

    // ── Merchant ─────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();
        $perPage = min((int) ($request->per_page ?? 20), 100);

        $query = AbandonedCheckout::query()
            ->whereIn('user_id', $shopUserIds)
            ->with('landingPage:id,title,slug,user_id,legacy_slug')
            ->with('platformApiKey:id,domain')
            ->with('order:id,order_number,status');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('landing_page_id')) {
            $query->where('landing_page_id', (int) $request->landing_page_id);
        }
        if ($request->filled('source')) {
            $query->where('source', $request->string('source'));
        }
        if ($request->filled('platform_api_key_id')) {
            $query->where('platform_api_key_id', (int) $request->platform_api_key_id);
        }
        if ($request->filled('date_from')) {
            $query->whereDate('last_activity_at', '>=', $request->date('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('last_activity_at', '<=', $request->date('date_to'));
        }
        if ($request->filled('q')) {
            $s = '%' . $request->string('q') . '%';
            $query->where(fn ($q) => $q->where('customer_name', 'ilike', $s)->orWhere('customer_phone', 'ilike', $s));
        }

        $rows = $query->orderByDesc('last_activity_at')->paginate($perPage);

        // The resume link the seller copies has to point at the page's real
        // address — on a subdomain that is not /lp/{slug} (custom_domain_context.md §14).
        collect($rows->items())->each(fn ($row) => $row->landingPage?->append('public_url'));

        $data = $this->attachCustomerValue(collect($rows->items()), auth()->user()->shopOwnerId());

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $rows->total(),
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $checkout = AbandonedCheckout::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->with(['landingPage:id,title,slug,user_id,legacy_slug', 'platformApiKey:id,domain', 'order:id,order_number,status'])
            ->findOrFail($id);

        $checkout->landingPage?->append('public_url');

        $data = $this->attachCustomerValue(collect([$checkout]), auth()->user()->shopOwnerId())->first();

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $checkout = AbandonedCheckout::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $validated = $request->validate([
            'status' => ['nullable', Rule::in(['active', 'dismissed', 'converted'])],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_phone' => ['nullable', 'string', 'max:20'],
            'customer_email' => ['nullable', 'string', 'max:150'],
            'customer_address' => ['nullable', 'string', 'max:500'],
            'customer_district' => ['nullable', 'string', 'max:100'],
            'customer_thana' => ['nullable', 'string', 'max:100'],
            'customer_area' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'custom_fields' => ['nullable', 'array'],
            'items' => ['nullable', 'array'],
            'items.*.product_id' => ['required_with:items', 'integer'],
            'items.*.product_variant_id' => ['nullable', 'integer'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1', 'max:100'],
            // Only meaningful together with status=converted — links this checkout
            // to an order created via the "Convert to Order" flow (order-intake-form).
            'order_id' => ['nullable', 'integer', Rule::exists('orders', 'id')->where('user_id', auth()->user()->shopOwnerId())],
        ]);

        if (array_key_exists('items', $validated)) {
            $checkout->load(['landingPage.products.product', 'landingPage.products.variant.optionValues.option']);
        }

        app(AbandonedCheckoutService::class)->applyEdit($checkout, $validated);

        return response()->json(['success' => true, 'data' => $checkout->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        $checkout = AbandonedCheckout::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $checkout->delete();

        return response()->json(['success' => true, 'message' => 'Abandoned checkout deleted.']);
    }

    public function stats(): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();

        $counts = AbandonedCheckout::whereIn('user_id', $shopUserIds)
            ->selectRaw("
                COUNT(*) FILTER (WHERE status = 'active') AS active,
                COUNT(*) FILTER (WHERE status = 'active' AND last_activity_at < ?) AS abandoned,
                COUNT(*) FILTER (WHERE status = 'converted') AS converted,
                COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
                COUNT(*) AS total
            ", [now()->subMinutes(AbandonedCheckout::ABANDONED_AFTER_MINUTES)])
            ->first();

        $conversionRate = $counts->total > 0
            ? round(($counts->converted / $counts->total) * 100, 1)
            : 0.0;

        return response()->json([
            'success' => true,
            'data' => array_merge((array) $counts, ['conversion_rate' => $conversionRate]),
        ]);
    }

    public function export(Request $request): Response
    {
        $shopUserIds = auth()->user()->shopUserIds();

        $rows = AbandonedCheckout::query()
            ->whereIn('user_id', $shopUserIds)
            ->with(['landingPage:id,title', 'platformApiKey:id,domain'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('last_activity_at')
            ->get();

        $csv = "ID,Source,Name,Phone,Email,Address,Items,Subtotal,Status,Last Activity\n";
        foreach ($rows as $row) {
            $items = collect($row->items ?? [])->map(fn ($i) => "{$i['name']} x{$i['quantity']}")->join('; ');
            $source = $row->landingPage?->title ?? $row->platformApiKey?->domain ?? $row->source;
            $csv .= implode(',', array_map(
                fn ($v) => '"' . str_replace('"', '""', (string) $v) . '"',
                [
                    $row->id,
                    $source,
                    $row->customer_name,
                    $row->customer_phone,
                    $row->customer_email,
                    $row->customer_address,
                    $items,
                    $row->subtotal,
                    $row->status,
                    $row->last_activity_at,
                ]
            )) . "\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename=abandoned-checkouts-' . now()->format('Y-m-d') . '.csv',
        ]);
    }

    /** Attach a lightweight {total_orders,total_spent,risk_level} block per matching phone, no external calls. */
    private function attachCustomerValue(\Illuminate\Support\Collection $rows, int $userId): \Illuminate\Support\Collection
    {
        $phones = $rows->pluck('customer_phone')->filter()->unique()->values();
        if ($phones->isEmpty()) {
            return $rows->map(fn ($row) => array_merge($row->toArray(), ['customer_value' => null]));
        }

        $customers = Customer::where('user_id', $userId)
            ->whereIn('phone', $phones)
            ->get(['phone', 'total_orders', 'total_spent', 'risk_level'])
            ->keyBy('phone');

        return $rows->map(function ($row) use ($customers) {
            $customer = $row->customer_phone ? $customers->get($row->customer_phone) : null;

            return array_merge($row->toArray(), [
                'customer_value' => $customer ? [
                    'total_orders' => $customer->total_orders,
                    'total_spent' => $customer->total_spent,
                    'risk_level' => $customer->risk_level,
                ] : null,
            ]);
        });
    }
}
