<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\LandingPageAnalyticsDaily;
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
                'content_json' => $validated['content_json'] ?? ['sections' => [], 'theme' => [], 'contact' => [], 'policy' => []],
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

        return response()->json([
            'success' => true,
            'data' => [
                'page' => $page,
                'preview_url' => '/store/' . $page->slug . '?preview=1',
            ],
        ]);
    }

    public function analytics(Request $request, int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $rows = LandingPageAnalyticsDaily::query()
            ->where('landing_page_id', $page->id)
            ->orderByDesc('view_date')
            ->limit(60)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'rows' => $rows,
                'summary' => [
                    'total_views' => (int) $rows->sum('total_views'),
                    'unique_visitors' => (int) $rows->sum('unique_visitors'),
                    'cta_clicks' => (int) $rows->sum('cta_clicks'),
                    'checkout_starts' => (int) $rows->sum('checkout_starts'),
                    'orders_completed' => (int) $rows->sum('orders_completed'),
                    'revenue' => (float) $rows->sum('revenue'),
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
            ->with('products.product')
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $order = DB::transaction(function () use ($validated, $page, $slug) {
            $landingProducts = $page->products->keyBy('product_id');
            $subtotal = 0.0;
            $normalizedItems = [];

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

            $shipping = (float) ($validated['shipping_charge'] ?? 0);
            $discount = (float) ($validated['discount'] ?? 0);
            $total = max(0, $subtotal + $shipping - $discount);

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
                'notes' => trim(($validated['notes'] ?? '') . "\nLanding Page: #{$page->id} ({$page->slug})"),
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
}
