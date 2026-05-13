<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\LandingPageAnalyticsDaily;
use App\Models\LandingPageConversionTracking;
use App\Models\LandingPageProduct;
use App\Models\LandingTemplate;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Models\RegistrationSetting;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LandingPageController extends Controller
{
    public function availableTemplates(Request $request): JsonResponse
    {
        $user = $request->user();
        $packageId = $this->resolveEffectivePackageId($user?->subscription_package_id);

        $templates = LandingTemplate::query()
            ->where('is_active', true)
            ->with('accessRules:id,template_id,package_id,is_enabled')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->filter(fn (LandingTemplate $template) => $this->isTemplateAllowedForPackage($template, $packageId))
            ->map(function (LandingTemplate $template) {
                $data = $template->toArray();
                $data['template_code'] = $template->code;
                $data['layout_profile'] = $template->layout_profile;
                $data['editor_mode'] = $template->editor_mode;
                $data['editable_fields_manifest'] = $this->editableFieldsManifest($template);

                return $data;
            })
            ->values();

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->get('per_page', 20)), 100);

        $query = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->with(['template:id,code,name_bn,name_en,thumbnail_url', 'products'])
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search')->toString() . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', $search)
                    ->orWhere('slug', 'ilike', $search);
            });
        }

        $result = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $result->items(),
            'meta' => [
                'total' => $result->total(),
                'current_page' => $result->currentPage(),
                'last_page' => $result->lastPage(),
                'per_page' => $result->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:landing_templates,id'],
            'title' => ['required', 'string', 'max:220'],
            'slug' => ['nullable', 'string', 'max:220'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'theme_tokens_json' => ['nullable', 'array'],
            'content_json' => ['nullable', 'array'],
            'products' => ['nullable', 'array'],
            'products.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'products.*.custom_title' => ['nullable', 'string', 'max:255'],
            'products.*.custom_price' => ['nullable', 'numeric', 'min:0'],
            'products.*.default_qty' => ['nullable', 'integer', 'min:1'],
            'products.*.display_order' => ['nullable', 'integer', 'min:0'],
            'products.*.is_featured' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();
        $template = LandingTemplate::with('accessRules')->findOrFail($validated['template_id']);
        $packageId = $this->resolveEffectivePackageId($user->subscription_package_id);

        if (! $template->is_active || ! $this->isTemplateAllowedForPackage($template, $packageId)) {
            throw ValidationException::withMessages([
                'template_id' => ['This template is not available for your account.'],
            ]);
        }

        $page = DB::transaction(function () use ($validated, $user, $template) {
            $slug = $this->ensureUniqueSlug($validated['slug'] ?? $validated['title']);

            $contentJson = $validated['content_json']
                ?? ($template->default_schema_json ?: ['sections' => [], 'theme' => [], 'contact' => [], 'policy' => []]);

            if ($this->isNaturivaLockedProfile($template)) {
                $this->validateLockedContentJson($contentJson);
            }

            $page = LandingPage::create([
                'user_id' => $user->id,
                'template_id' => $template->id,
                'title' => $validated['title'],
                'slug' => $slug,
                'status' => 'draft',
                'public_url' => '/store/' . $slug,
                'meta_title' => $validated['meta_title'] ?? null,
                'meta_description' => $validated['meta_description'] ?? null,
                'theme_tokens_json' => $validated['theme_tokens_json'] ?? null,
                'content_json' => $contentJson,
                'renderer_version' => $this->isNaturivaLockedProfile($template) ? 'naturiva-c2-v1' : null,
                'validation_snapshot_json' => $this->isNaturivaLockedProfile($template)
                    ? ['validated_at' => now()->toISOString(), 'layout_profile' => $template->layout_profile]
                    : null,
            ]);

            $this->syncPageProducts($page, $validated['products'] ?? [], $user->id);

            return $page;
        });

        return response()->json([
            'success' => true,
            'message' => 'Landing page created successfully.',
            'data' => $page->load(['template:id,code,name_bn,name_en', 'products.product:id,name,selling_price,thumbnail']),
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->with(['template', 'products.product:id,name,selling_price,thumbnail,status'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'template_id' => ['sometimes', 'integer', 'exists:landing_templates,id'],
            'title' => ['sometimes', 'string', 'max:220'],
            'slug' => ['sometimes', 'string', 'max:220'],
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string'],
            'theme_tokens_json' => ['nullable', 'array'],
            'content_json' => ['nullable', 'array'],
            'products' => ['nullable', 'array'],
            'products.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'products.*.custom_title' => ['nullable', 'string', 'max:255'],
            'products.*.custom_price' => ['nullable', 'numeric', 'min:0'],
            'products.*.default_qty' => ['nullable', 'integer', 'min:1'],
            'products.*.display_order' => ['nullable', 'integer', 'min:0'],
            'products.*.is_featured' => ['nullable', 'boolean'],
        ]);

        if (isset($validated['template_id'])) {
            $template = LandingTemplate::with('accessRules')->findOrFail($validated['template_id']);
            $packageId = $this->resolveEffectivePackageId($request->user()->subscription_package_id);
            if (! $template->is_active || ! $this->isTemplateAllowedForPackage($template, $packageId)) {
                throw ValidationException::withMessages([
                    'template_id' => ['This template is not available for your account.'],
                ]);
            }
        }

        DB::transaction(function () use ($validated, $request, $page) {
            $targetTemplate = isset($validated['template_id'])
                ? LandingTemplate::query()->find($validated['template_id'])
                : $page->template;

            if (! $targetTemplate) {
                throw ValidationException::withMessages([
                    'template_id' => ['Template not found.'],
                ]);
            }

            if ($this->isNaturivaLockedProfile($targetTemplate)) {
                if (array_key_exists('content_json', $validated)) {
                    $this->validateLockedContentJson((array) ($validated['content_json'] ?? []));
                }

                $validated['renderer_version'] = 'naturiva-c2-v1';
                $validated['validation_snapshot_json'] = [
                    'validated_at' => now()->toISOString(),
                    'layout_profile' => $targetTemplate->layout_profile,
                ];
            }

            if (isset($validated['slug']) && $validated['slug'] !== $page->slug) {
                $validated['slug'] = $this->ensureUniqueSlug($validated['slug'], $page->id);
                $validated['public_url'] = '/store/' . $validated['slug'];
            }

            $page->update($validated);

            if (array_key_exists('products', $validated)) {
                $this->syncPageProducts($page, $validated['products'] ?? [], $request->user()->id);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'Landing page updated successfully.',
            'data' => $page->fresh()->load(['template', 'products.product:id,name,selling_price,thumbnail,status']),
        ]);
    }

    public function publish(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->with('products')
            ->findOrFail($id);

        if ($page->products->isEmpty()) {
            throw ValidationException::withMessages([
                'products' => ['At least one product is required to publish.'],
            ]);
        }

        $policy = data_get($page->content_json, 'policy', []);
        if (empty($policy['privacy_url']) || empty($policy['terms_url'])) {
            throw ValidationException::withMessages([
                'content_json' => ['Privacy policy and terms URLs are required before publishing.'],
            ]);
        }

        $page->update([
            'status' => 'published',
            'published_at' => now(),
            'public_url' => '/store/' . $page->slug,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Landing page published successfully.',
            'data' => $page->fresh(),
        ]);
    }

    public function archive(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $page->update(['status' => 'archived']);

        return response()->json([
            'success' => true,
            'message' => 'Landing page archived successfully.',
            'data' => $page,
        ]);
    }

    public function preview(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->with(['template', 'products.product:id,name,selling_price,thumbnail,status'])
            ->findOrFail($id);

        $previewData = [
            'page' => $page,
            'preview_url' => '/store/' . $page->slug . '?preview=1',
        ];

        if ($page->template && $this->isNaturivaLockedProfile($page->template)) {
            $previewData['totals_snapshot'] = $this->lockedTotalsSnapshot((array) ($page->content_json ?? []));
            $previewData['validation_warnings'] = $this->lockedValidationWarnings((array) ($page->content_json ?? []));
        }

        return response()->json([
            'success' => true,
            'data' => $previewData,
        ]);
    }

    public function analytics(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'range' => ['nullable', 'string', 'in:7d,30d,custom'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
        ]);

        $range = (string) ($validated['range'] ?? '30d');
        $today = Carbon::today();

        if ($range === 'custom') {
            if (empty($validated['start_date']) || empty($validated['end_date'])) {
                throw ValidationException::withMessages([
                    'range' => ['Custom range requires both start_date and end_date.'],
                ]);
            }

            $startDate = Carbon::parse($validated['start_date'])->startOfDay();
            $endDate = Carbon::parse($validated['end_date'])->endOfDay();
        } elseif ($range === '7d') {
            $startDate = $today->copy()->subDays(6)->startOfDay();
            $endDate = $today->copy()->endOfDay();
        } else {
            $startDate = $today->copy()->subDays(29)->startOfDay();
            $endDate = $today->copy()->endOfDay();
        }

        if ($startDate->gt($endDate)) {
            throw ValidationException::withMessages([
                'range' => ['start_date cannot be greater than end_date.'],
            ]);
        }

        $rowsBaseQuery = LandingPageAnalyticsDaily::query()
            ->where('landing_page_id', $page->id)
            ->whereBetween('view_date', [$startDate->toDateString(), $endDate->toDateString()]);

        $rows = (clone $rowsBaseQuery)
            ->orderByDesc('view_date')
            ->get();

        $rowsByDate = (clone $rowsBaseQuery)
            ->orderBy('view_date')
            ->get()
            ->keyBy(fn (LandingPageAnalyticsDaily $row) => Carbon::parse($row->view_date)->toDateString());

        $totalViews = (int) $rows->sum('total_views');
        $checkoutStarts = (int) $rows->sum('checkout_starts');
        $ordersCompleted = (int) $rows->sum('orders_completed');

        $trend = [];
        $cursor = $startDate->copy()->startOfDay();

        while ($cursor->lte($endDate)) {
            $dateKey = $cursor->toDateString();
            /** @var LandingPageAnalyticsDaily|null $daily */
            $daily = $rowsByDate->get($dateKey);

            $trend[] = [
                'date' => $dateKey,
                'total_views' => (int) ($daily?->total_views ?? 0),
                'checkout_starts' => (int) ($daily?->checkout_starts ?? 0),
                'orders_completed' => (int) ($daily?->orders_completed ?? 0),
                'revenue' => (float) ($daily?->revenue ?? 0),
            ];

            $cursor->addDay();
        }

        $trackingBaseQuery = LandingPageConversionTracking::query()
            ->where('landing_page_id', $page->id)
            ->whereBetween('tracked_at', [$startDate->toDateTimeString(), $endDate->toDateTimeString()]);

        $sourceBreakdown = (clone $trackingBaseQuery)
            ->selectRaw("COALESCE(source, 'direct') as key, COUNT(*) as total")
            ->groupBy('key')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        $deviceBreakdown = (clone $trackingBaseQuery)
            ->selectRaw("COALESCE(device, 'unknown') as key, COUNT(*) as total")
            ->groupBy('key')
            ->orderByDesc('total')
            ->limit(8)
            ->get();

        $sourceTrend = (clone $trackingBaseQuery)
            ->selectRaw("DATE(tracked_at) as trend_date, COALESCE(source, 'direct') as key, COUNT(*) as total")
            ->groupBy('trend_date', 'key')
            ->orderBy('trend_date')
            ->orderByDesc('total')
            ->limit(300)
            ->get();

        $deviceTrend = (clone $trackingBaseQuery)
            ->selectRaw("DATE(tracked_at) as trend_date, COALESCE(device, 'unknown') as key, COUNT(*) as total")
            ->groupBy('trend_date', 'key')
            ->orderBy('trend_date')
            ->orderByDesc('total')
            ->limit(300)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'rows' => $rows,
                'range' => [
                    'range' => $range,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
                'summary' => [
                    'total_views' => $totalViews,
                    'unique_visitors' => (int) $rows->sum('unique_visitors'),
                    'cta_clicks' => (int) $rows->sum('cta_clicks'),
                    'checkout_starts' => $checkoutStarts,
                    'order_bumps_accepted' => (int) $rows->sum('order_bumps_accepted'),
                    'upsells_accepted' => (int) $rows->sum('upsells_accepted'),
                    'orders_completed' => $ordersCompleted,
                    'revenue' => (float) $rows->sum('revenue'),
                    'view_to_checkout_rate' => $totalViews > 0 ? round(($checkoutStarts / $totalViews) * 100, 2) : 0,
                    'checkout_to_order_rate' => $checkoutStarts > 0 ? round(($ordersCompleted / $checkoutStarts) * 100, 2) : 0,
                ],
                'trend' => $trend,
                'attribution' => [
                    'sources' => $sourceBreakdown,
                    'devices' => $deviceBreakdown,
                    'source_trend' => $sourceTrend,
                    'device_trend' => $deviceTrend,
                ],
            ],
        ]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with([
                'template:id,code,name_bn,name_en,description_bn,description_en,thumbnail_url',
                'products.product:id,name,selling_price,thumbnail,status',
            ])
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $page,
        ]);
    }

    public function submitOrder(Request $request, string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['products.product', 'template'])
            ->firstOrFail();

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:150'],
            'customer_phone' => ['required', 'string', 'max:20'],
            'customer_address' => ['required', 'string', 'max:500'],
            'customer_district' => ['nullable', 'string', 'max:100'],
            'customer_thana' => ['nullable', 'string', 'max:100'],
            'customer_area' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'shipping_charge' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'selected_package_id' => ['nullable', 'string', 'max:120'],
            'selected_shipping_id' => ['nullable', 'string', 'max:120'],
            'upsell_checked' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $isLockedProfile = $page->template && $this->isNaturivaLockedProfile($page->template);
        $lockedSelection = $isLockedProfile
            ? $this->resolveLockedOrderSelection(
                (array) ($page->content_json ?? []),
                isset($validated['selected_package_id']) ? (string) $validated['selected_package_id'] : null,
                isset($validated['selected_shipping_id']) ? (string) $validated['selected_shipping_id'] : null,
                (bool) ($validated['upsell_checked'] ?? false)
            )
            : null;

        $order = DB::transaction(function () use ($validated, $page, $slug, $isLockedProfile, $lockedSelection) {
            $landingProducts = $page->products->keyBy('product_id');
            $subtotal = 0.0;
            $normalizedItems = [];

            if ($isLockedProfile) {
                $primaryBinding = $page->products->sortBy('display_order')->first();
                if (! $primaryBinding || ! $primaryBinding->product || $primaryBinding->product->status !== 'active') {
                    throw ValidationException::withMessages([
                        'items' => ['No active product attached for locked landing checkout.'],
                    ]);
                }

                $packagePrice = (float) data_get($lockedSelection, 'package_price', 0);
                $subtotal = $packagePrice;

                $normalizedItems[] = [
                    'product' => $primaryBinding->product,
                    'qty' => 1,
                    'unit_price' => $packagePrice,
                    'line_total' => $packagePrice,
                    'custom_title' => (string) (data_get($lockedSelection, 'package_title', '') ?: $primaryBinding->custom_title),
                ];
            } else {
                foreach ($validated['items'] as $item) {
                    $productId = (int) $item['product_id'];
                    $qty = (int) $item['quantity'];

                    $landingBinding = $landingProducts->get($productId);
                    if (! $landingBinding) {
                        throw ValidationException::withMessages([
                            'items' => ["Product {$productId} is not part of this landing page."],
                        ]);
                    }

                    $product = $landingBinding->product;
                    if (! $product || $product->status !== 'active') {
                        throw ValidationException::withMessages([
                            'items' => ["Product {$productId} is unavailable."],
                        ]);
                    }

                    $unitPrice = (float) ($landingBinding->custom_price ?? $product->selling_price ?? 0);
                    $lineTotal = $unitPrice * $qty;
                    $subtotal += $lineTotal;

                    $normalizedItems[] = [
                        'product' => $product,
                        'qty' => $qty,
                        'unit_price' => $unitPrice,
                        'line_total' => $lineTotal,
                        'custom_title' => $landingBinding->custom_title,
                    ];
                }
            }

            $shipping = $isLockedProfile
                ? (float) data_get($lockedSelection, 'shipping_fee', 0) + (float) data_get($lockedSelection, 'upsell_price', 0)
                : (float) ($validated['shipping_charge'] ?? 0);
            $discount = (float) ($validated['discount'] ?? 0);
            $total = max(0, $subtotal + $shipping - $discount);

            if ($isLockedProfile && $lockedSelection) {
                $expectedTotal = (float) data_get($lockedSelection, 'total', $total);
                $total = $expectedTotal;
            }

            $order = Order::create([
                'user_id' => $page->user_id,
                'order_number' => Order::generateOrderNumber($page->user_id),
                'customer_name' => $validated['customer_name'],
                'customer_phone' => $validated['customer_phone'],
                'customer_address' => $validated['customer_address'],
                'customer_district' => $validated['customer_district'] ?? null,
                'customer_thana' => $validated['customer_thana'] ?? null,
                'customer_area' => $validated['customer_area'] ?? null,
                'source' => 'landing_page',
                'source_ref' => $slug,
                'status' => 'pending',
                'payment_method' => 'cod',
                'payment_status' => 'due',
                'subtotal' => $subtotal,
                'shipping_charge' => $shipping,
                'discount' => $discount,
                'total' => $total,
                'notes' => trim(($validated['notes'] ?? '')
                    . "\nLanding Page: #{$page->id} ({$page->slug})"
                    . ($isLockedProfile ? "\nLocked Checkout: " . json_encode([
                        'package_id' => data_get($lockedSelection, 'package_id'),
                        'shipping_id' => data_get($lockedSelection, 'shipping_id'),
                        'upsell_checked' => data_get($lockedSelection, 'upsell_checked'),
                        'upsell_price' => data_get($lockedSelection, 'upsell_price'),
                    ]) : '')
                ),
                'fraud_score' => 0,
                'risk_level' => 'low',
            ]);

            foreach ($normalizedItems as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product']->id,
                    'product_name' => $item['custom_title'] ?: $item['product']->name,
                    'sku' => $item['product']->sku,
                    'quantity' => $item['qty'],
                    'regular_price' => (float) ($item['product']->regular_price ?? $item['unit_price']),
                    'discount' => (float) ($item['product']->discount ?? 0),
                    'discount_type' => $item['product']->discount_type ?? 'amount',
                    'unit_price' => $item['unit_price'],
                    'total' => $item['line_total'],
                ]);
            }

            OrderStatusLog::create([
                'order_id' => $order->id,
                'old_status' => null,
                'new_status' => 'pending',
                'note' => 'Order created from landing page.',
                'changed_by' => null,
            ]);

            $this->incrementDailyAnalytics($page->id, 'orders_completed', 1);
            $this->incrementDailyAnalytics($page->id, 'revenue', $total);

            return $order;
        });

        return response()->json([
            'success' => true,
            'message' => 'Order submitted successfully.',
            'data' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
            ],
        ], 201);
    }

    private function ensureUniqueSlug(string $input, ?int $ignoreId = null): string
    {
        $base = Str::slug($input);
        if ($base === '') {
            $base = 'landing-page';
        }

        $slug = $base;
        $i = 1;

        while (LandingPage::query()
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->where('slug', $slug)
            ->exists()) {
            $slug = $base . '-' . $i;
            $i++;
        }

        return $slug;
    }

    private function isTemplateAllowedForPackage(LandingTemplate $template, ?int $packageId): bool
    {
        $rules = $template->accessRules;
        if ($rules->isEmpty()) {
            return true;
        }

        $globalRule = $rules->firstWhere('package_id', null);
        if ($globalRule) {
            return (bool) $globalRule->is_enabled;
        }

        if (! $packageId) {
            return false;
        }

        $packageRule = $rules->firstWhere('package_id', $packageId);
        return $packageRule ? (bool) $packageRule->is_enabled : false;
    }

    private function resolveEffectivePackageId(?int $packageId): ?int
    {
        if ($packageId) {
            return $packageId;
        }

        return RegistrationSetting::query()->value('default_subscription_package_id');
    }

    /**
     * @param  array<int, array<string, mixed>>  $products
     */
    private function syncPageProducts(LandingPage $page, array $products, int $userId): void
    {
        LandingPageProduct::query()->where('landing_page_id', $page->id)->delete();

        if (empty($products)) {
            return;
        }

        $productIds = collect($products)->pluck('product_id')->map(fn ($id) => (int) $id)->unique()->values();
        $validIds = Product::query()
            ->where('user_id', $userId)
            ->whereIn('id', $productIds)
            ->pluck('id')
            ->all();

        foreach ($products as $index => $item) {
            if (! in_array((int) $item['product_id'], $validIds, true)) {
                continue;
            }

            LandingPageProduct::create([
                'landing_page_id' => $page->id,
                'product_id' => (int) $item['product_id'],
                'custom_title' => $item['custom_title'] ?? null,
                'custom_price' => $item['custom_price'] ?? null,
                'default_qty' => max(1, (int) ($item['default_qty'] ?? 1)),
                'display_order' => (int) ($item['display_order'] ?? $index),
                'is_featured' => (bool) ($item['is_featured'] ?? false),
            ]);
        }
    }

    private function incrementDailyAnalytics(int $landingPageId, string $metric, float|int $value): void
    {
        $today = Carbon::today()->toDateString();

        $row = LandingPageAnalyticsDaily::query()
            ->where('landing_page_id', $landingPageId)
            ->whereDate('view_date', $today)
            ->first();

        if (! $row) {
            $row = LandingPageAnalyticsDaily::create([
                'landing_page_id' => $landingPageId,
                'view_date' => $today,
                'total_views' => 0,
                'unique_visitors' => 0,
                'cta_clicks' => 0,
                'checkout_starts' => 0,
                'orders_completed' => 0,
                'revenue' => 0,
            ]);
        }

        if ($metric === 'revenue') {
            $row->revenue = (float) $row->revenue + (float) $value;
            $row->save();
            return;
        }

        $row->increment($metric, (int) $value);
    }

    private function isNaturivaLockedProfile(LandingTemplate $template): bool
    {
        return $template->code === 'naturiva_package_upsell'
            && $template->layout_profile === 'naturiva_exact_clone_locked'
            && $template->editor_mode === 'locked';
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function editableFieldsManifest(LandingTemplate $template): array
    {
        if (! $this->isNaturivaLockedProfile($template)) {
            return [
                'mode' => ['flex'],
                'editable' => ['*'],
            ];
        }

        return [
            'mode' => ['locked'],
            'editable' => [
                'hero.title',
                'hero.subtitle',
                'hero.disclaimer',
                'proof.video_url',
                'proof.review_images',
                'offer_strip.cta_label',
                'offer_strip.package_highlights',
                'contact.call_numbers',
                'contact.whatsapp_numbers',
                'checkout.section_title',
                'checkout.packages',
                'checkout.shipping_options',
                'checkout.upsell',
                'checkout.cod_confirmation_text',
                'checkout.submit_label',
                'bottom_cta.text',
                'bottom_cta.phone',
                'policy.privacy_url',
                'policy.terms_url',
                'theme.primary',
                'theme.accent',
                'theme.button_text',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $contentJson
     */
    private function validateLockedContentJson(array $contentJson): void
    {
        $allowedTopKeys = [
            'layout_profile',
            'hero',
            'proof',
            'offer_strip',
            'contact',
            'checkout',
            'bottom_cta',
            'policy',
            'theme',
        ];

        $unknown = collect(array_keys($contentJson))
            ->reject(fn ($key) => in_array($key, $allowedTopKeys, true))
            ->values()
            ->all();

        if (! empty($unknown)) {
            throw ValidationException::withMessages([
                'content_json' => ['Unknown keys are not allowed for locked template: ' . implode(', ', $unknown)],
            ]);
        }

        $profile = (string) ($contentJson['layout_profile'] ?? '');
        if ($profile !== 'naturiva_exact_clone_locked') {
            throw ValidationException::withMessages([
                'content_json.layout_profile' => ['Locked template requires layout_profile=naturiva_exact_clone_locked.'],
            ]);
        }

        $packages = data_get($contentJson, 'checkout.packages', []);
        if (! is_array($packages) || count($packages) < 2 || count($packages) > 4) {
            throw ValidationException::withMessages([
                'content_json.checkout.packages' => ['Locked template requires 2 to 4 packages.'],
            ]);
        }

        $defaultPackageCount = collect($packages)->filter(fn ($pkg) => (bool) data_get($pkg, 'is_default', false))->count();
        if ($defaultPackageCount !== 1) {
            throw ValidationException::withMessages([
                'content_json.checkout.packages' => ['Exactly one package must be marked as default.'],
            ]);
        }

        $shippingOptions = data_get($contentJson, 'checkout.shipping_options', []);
        if (! is_array($shippingOptions) || count($shippingOptions) < 1 || count($shippingOptions) > 3) {
            throw ValidationException::withMessages([
                'content_json.checkout.shipping_options' => ['Locked template requires 1 to 3 shipping options.'],
            ]);
        }

        $defaultShippingCount = collect($shippingOptions)->filter(fn ($ship) => (bool) data_get($ship, 'is_default', false))->count();
        if ($defaultShippingCount !== 1) {
            throw ValidationException::withMessages([
                'content_json.checkout.shipping_options' => ['Exactly one shipping option must be default.'],
            ]);
        }

        $upsellPrice = data_get($contentJson, 'checkout.upsell.price', 0);
        if (! is_numeric($upsellPrice) || (float) $upsellPrice < 0) {
            throw ValidationException::withMessages([
                'content_json.checkout.upsell.price' => ['Upsell price must be a non-negative number.'],
            ]);
        }

        $privacyUrl = (string) data_get($contentJson, 'policy.privacy_url', '');
        $termsUrl = (string) data_get($contentJson, 'policy.terms_url', '');
        if ($privacyUrl === '' || $termsUrl === '') {
            throw ValidationException::withMessages([
                'content_json.policy' => ['Privacy and terms URLs are required for locked template.'],
            ]);
        }

        $phones = [
            ...collect((array) data_get($contentJson, 'contact.call_numbers', []))->map(fn ($v) => (string) $v)->all(),
            ...collect((array) data_get($contentJson, 'contact.whatsapp_numbers', []))->map(fn ($v) => (string) $v)->all(),
            (string) data_get($contentJson, 'bottom_cta.phone', ''),
        ];

        $normalizedPhones = collect($phones)
            ->map(fn ($phone) => preg_replace('/\s+/', '', trim($phone ?? '')))
            ->filter(fn ($phone) => filled($phone))
            ->values();

        if ($normalizedPhones->isEmpty()) {
            throw ValidationException::withMessages([
                'content_json.contact' => ['At least one contact number is required.'],
            ]);
        }

        $invalidPhone = $normalizedPhones->first(fn ($phone) => ! preg_match('/^(\\+?88)?01[3-9][0-9]{8}$/', $phone));
        if ($invalidPhone) {
            throw ValidationException::withMessages([
                'content_json.contact' => ['Invalid Bangladeshi phone format found: ' . $invalidPhone],
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $contentJson
     * @return array<string, float|int|string|bool|null>
     */
    private function lockedTotalsSnapshot(array $contentJson): array
    {
        $packages = (array) data_get($contentJson, 'checkout.packages', []);
        $shippingOptions = (array) data_get($contentJson, 'checkout.shipping_options', []);

        $defaultPackage = collect($packages)->first(fn ($pkg) => (bool) data_get($pkg, 'is_default', false));
        $defaultShipping = collect($shippingOptions)->first(fn ($ship) => (bool) data_get($ship, 'is_default', false));

        $packagePrice = (float) data_get($defaultPackage, 'price', 0);
        $shippingFee = (float) data_get($defaultShipping, 'fee', 0);
        $upsellEnabled = (bool) data_get($contentJson, 'checkout.upsell.enabled', false);
        $upsellPrice = $upsellEnabled ? (float) data_get($contentJson, 'checkout.upsell.price', 0) : 0.0;

        return [
            'default_package_id' => data_get($defaultPackage, 'id'),
            'default_shipping_id' => data_get($defaultShipping, 'id'),
            'package_price' => $packagePrice,
            'shipping_fee' => $shippingFee,
            'upsell_enabled' => $upsellEnabled,
            'upsell_price' => $upsellPrice,
            'total' => $packagePrice + $shippingFee + $upsellPrice,
        ];
    }

    /**
     * @param  array<string, mixed>  $contentJson
     * @return array<int, string>
     */
    private function lockedValidationWarnings(array $contentJson): array
    {
        $warnings = [];

        if (! filled((string) data_get($contentJson, 'proof.video_url', '')) && empty((array) data_get($contentJson, 'proof.review_images', []))) {
            $warnings[] = 'No proof video or review images configured.';
        }

        if (! filled((string) data_get($contentJson, 'checkout.cod_confirmation_text', ''))) {
            $warnings[] = 'COD confirmation text is empty.';
        }

        if (! filled((string) data_get($contentJson, 'bottom_cta.phone', ''))) {
            $warnings[] = 'Bottom CTA phone is empty.';
        }

        return $warnings;
    }

    /**
     * @param  array<string, mixed>  $contentJson
     * @return array<string, float|int|string|bool|null>
     */
    private function resolveLockedOrderSelection(array $contentJson, ?string $selectedPackageId, ?string $selectedShippingId, bool $upsellChecked): array
    {
        $packages = collect((array) data_get($contentJson, 'checkout.packages', []));
        $shippingOptions = collect((array) data_get($contentJson, 'checkout.shipping_options', []));

        $package = $selectedPackageId
            ? $packages->first(fn ($pkg) => (string) data_get($pkg, 'id') === $selectedPackageId)
            : $packages->first(fn ($pkg) => (bool) data_get($pkg, 'is_default', false));

        $shipping = $selectedShippingId
            ? $shippingOptions->first(fn ($opt) => (string) data_get($opt, 'id') === $selectedShippingId)
            : $shippingOptions->first(fn ($opt) => (bool) data_get($opt, 'is_default', false));

        if (! $package || ! $shipping) {
            throw ValidationException::withMessages([
                'selected_package_id' => ['Invalid package or shipping selection for locked checkout.'],
            ]);
        }

        $packagePrice = (float) data_get($package, 'price', 0);
        $shippingFee = (float) data_get($shipping, 'fee', 0);
        $upsellEnabled = (bool) data_get($contentJson, 'checkout.upsell.enabled', false);
        $upsellPrice = $upsellChecked && $upsellEnabled ? (float) data_get($contentJson, 'checkout.upsell.price', 0) : 0.0;

        return [
            'package_id' => (string) data_get($package, 'id', ''),
            'package_title' => (string) data_get($package, 'title', ''),
            'shipping_id' => (string) data_get($shipping, 'id', ''),
            'package_price' => $packagePrice,
            'shipping_fee' => $shippingFee,
            'upsell_checked' => $upsellChecked,
            'upsell_price' => $upsellPrice,
            'total' => $packagePrice + $shippingFee + $upsellPrice,
        ];
    }
}
