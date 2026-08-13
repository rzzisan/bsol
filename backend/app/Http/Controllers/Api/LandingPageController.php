<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendFacebookCapiPurchaseEventJob;
use App\Services\AbandonedCheckoutService;
use App\Services\CheckoutOtpService;
use App\Services\LandingPageOrderService;
use App\Support\CheckoutFieldResolver;
use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\Order;
use App\Models\LandingTemplate;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Support\ProductVariantFormatter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LandingPageController extends Controller
{
    private function publicUrlFor(LandingPage $page): string
    {
        $baseUrl = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $baseUrl . '/lp/' . $page->slug;
    }

    public function publicShow(string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['template', 'products.product.images', 'products.variant.optionValues.option'])
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => array_merge($page->toArray(), [
                'public_url' => $this->publicUrlFor($page),
            ]),
        ]);
    }

    public function publicSubmitOrder(Request $request, string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['products.product.images', 'products.variant.optionValues.option'])
            ->firstOrFail();

        $settings = $page->content['settings'] ?? [];
        $language = $settings['language'] ?? 'bn';
        $resolvedFields = CheckoutFieldResolver::resolve($page->content['checkout_fields'] ?? null, $language);
        $phoneValidationEnabled = (bool) ($settings['phone_validation_enabled'] ?? true);
        // Mirrors getDefaultSettings() in frontend/src/lib/landing-pages.ts.
        $phoneValidationMessage = trim((string) ($settings['phone_validation_message'] ?? '')) ?: (
            $language === 'en'
                ? 'Enter a valid 11-digit Bangladeshi mobile number (e.g. 017XXXXXXXX)'
                : 'সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)'
        );

        $validated = $request->validate(array_merge(
            CheckoutFieldResolver::buildRules($resolvedFields, $phoneValidationEnabled),
            [
                'shipping_charge' => ['nullable', 'numeric', 'min:0'],
                'items' => ['required', 'array', 'min:1'],
                'items.*.enabled' => ['nullable', 'boolean'],
                'items.*.product_id' => ['required', 'integer'],
                'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
                'items.*.product_variant_id' => ['nullable', 'integer'],
            ]
        ), [
            'customer_phone.regex' => $phoneValidationMessage,
        ]);

        $landingProducts = $page->products->keyBy('product_id');
        $lineItems = collect($validated['items'])
            ->filter(fn ($item) => !empty($item['enabled']))
            ->filter(fn ($item) => isset($item['product_id']) && $landingProducts->has((int) $item['product_id']))
            ->values();

        if ($lineItems->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'Please select at least one valid product from this landing page.',
                'errors' => [
                    'items' => ['Please select at least one valid product from this landing page.'],
                ],
            ], 422);
        }

        $order = app(LandingPageOrderService::class)->create($page, $validated, $lineItems, $resolvedFields);
        app(CheckoutOtpService::class)->maybeSendForOrder($page->content['settings'] ?? [], $order);
        app(AbandonedCheckoutService::class)->convertMatching(
            $page,
            $order,
            $request->input('checkout_session_id'),
            $validated['customer_phone'] ?? null
        );

        // Facebook Conversions API — §6 item 4. Dashboard-entered orders
        // still don't fire this (no ad-attributable checkout event to
        // report); WooCommerce-synced orders do, via the equivalent
        // dispatch in ConnectOrderController::sync() — see Phase 10 in
        // wordpress_connect_context.md. No-ops for sellers who haven't set
        // up CAPI (job checks facebook_pixel_settings.enabled and returns
        // early).
        SendFacebookCapiPurchaseEventJob::dispatch(
            $order->id,
            $request->ip(),
            $request->userAgent(),
            $this->publicUrlFor($page),
        );

        return response()->json([
            'success' => true,
            'message' => 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে। শিগগিরই আমাদের প্রতিনিধি যোগাযোগ করবে।',
            'data' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'public_token' => $order->public_token,
                'subtotal' => $order->subtotal,
                'shipping_charge' => $order->shipping_charge,
                'total' => $order->total,
            ],
        ], 201);
    }

    public function publicShowOrder(Request $request, string $slug, int $orderId): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $order = Order::query()
            ->with('items')
            ->where('id', $orderId)
            ->where('source', 'landing_page')
            ->where('source_ref', (string) $page->id)
            ->whereNotNull('public_token')
            ->first();

        // Same 404 for every failure mode — don't reveal which check failed.
        if (!$order || !hash_equals($order->public_token, $validated['token'])) {
            abort(404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'order_number' => $order->order_number,
                'created_at' => $order->created_at,
                'status' => $order->status,
                'otp_required' => (bool) $order->otp_required,
                'otp_verified' => (bool) $order->otp_verified_at,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'customer_address' => $order->customer_address,
                'customer_district' => $order->customer_district,
                'customer_thana' => $order->customer_thana,
                'customer_area' => $order->customer_area,
                'subtotal' => $order->subtotal,
                'shipping_charge' => $order->shipping_charge,
                'discount' => $order->discount,
                'total' => $order->total,
                'custom_fields' => $order->custom_fields,
                'items' => $order->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'total' => $item->total,
                ])->values(),
            ],
        ]);
    }

    /**
     * Unauthenticated product option lookup for the public checkout's inline
     * variant picker ("mode 1" — customer picks the variant themselves). Only
     * ever exposes a product that is actually attached to this published page,
     * so this can't be used as a generic product-data oracle.
     */
    public function publicProductOptions(string $slug, int $productId): JsonResponse
    {
        $product = $this->publicAttachedProduct($slug, $productId);

        return response()->json([
            'success' => true,
            'data' => $product->options()->with('values')->get(),
        ]);
    }

    /** POST /public/landing-pages/{slug}/products/{productId}/variants/resolve */
    public function publicResolveVariant(Request $request, string $slug, int $productId): JsonResponse
    {
        $product = $this->publicAttachedProduct($slug, $productId);

        $data = $request->validate([
            'option_value_ids' => ['required', 'array', 'min:1'],
            'option_value_ids.*' => ['integer'],
        ]);

        $ids = collect($data['option_value_ids'])->sort()->values()->toArray();
        $count = count($ids);

        $variant = $product->variants()
            ->whereHas('optionValues', fn ($q) => $q->whereIn('product_option_values.id', $ids), '=', $count)
            ->where('is_active', true)
            ->first();

        if (!$variant) {
            return response()->json(['success' => false, 'message' => 'No matching variant found.'], 404);
        }

        $variant->load('optionValues.option');

        return response()->json(['success' => true, 'data' => ProductVariantFormatter::format($variant)]);
    }

    /** Product must belong to a published page and actually be attached to it. */
    private function publicAttachedProduct(string $slug, int $productId): Product
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        $attached = $page->products()->where('product_id', $productId)->exists();
        abort_unless($attached, 404);

        return Product::query()->where('id', $productId)->firstOrFail();
    }

    public function index(Request $request): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();
        $perPage = min((int) ($request->per_page ?? 20), 100);

        $pages = LandingPage::query()
            ->whereIn('user_id', $shopUserIds)
            ->with(['template:id,code,name_bn,name_en', 'products'])
            ->orderByDesc('id')
            ->paginate($perPage);

        $data = collect($pages->items())->map(function (LandingPage $page) {
            return [
                'id' => $page->id,
                'title' => $page->title,
                'slug' => $page->slug,
                'status' => $page->status,
                'admin_locked' => $page->admin_locked,
                'admin_lock_reason' => $page->admin_lock_reason,
                'published_at' => $page->published_at,
                'product_count' => $page->products->count(),
                'template' => $page->template,
                'public_url' => $this->publicUrlFor($page),
                'created_at' => $page->created_at,
                'updated_at' => $page->updated_at,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $data,
            'meta' => [
                'total' => $pages->total(),
                'current_page' => $pages->currentPage(),
                'last_page' => $pages->lastPage(),
                'per_page' => $pages->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $actingUserId = auth()->id(); // audit — the LandingPage row itself stays Pattern A (creator)
        $shopUserIds = auth()->user()->shopUserIds();
        $data = $this->validatePayload($request, $shopUserIds);

        $page = DB::transaction(function () use ($data, $actingUserId, $shopUserIds) {
            $slug = $this->resolveSlug($data['slug'] ?? null, $data['title']);

            $page = LandingPage::create([
                'user_id' => $actingUserId,
                'template_id' => $data['template_id'] ?? null,
                'title' => $data['title'],
                'slug' => $slug,
                'status' => $data['status'] ?? 'draft',
                'theme_settings' => $data['theme_settings'] ?? $this->defaultTheme(),
                'content' => $data['content'] ?? $this->defaultContent($data['title']),
                'seo_meta' => $data['seo_meta'] ?? [],
                'custom_css' => $data['custom_css'] ?? null,
                'published_at' => ($data['status'] ?? 'draft') === 'published' ? now() : null,
            ]);

            $this->syncProducts($page, $data['products'] ?? [], $shopUserIds);

            return $page->load(['template', 'products.product.images', 'products.variant.optionValues.option']);
        });

        return response()->json(['success' => true, 'data' => $page], 201);
    }

    public function show(int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->with(['template', 'products.product.images', 'products.variant.optionValues.option'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => array_merge($page->toArray(), [
                'public_url' => $this->publicUrlFor($page),
            ]),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();
        $page = LandingPage::query()->whereIn('user_id', $shopUserIds)->findOrFail($id);
        $data = $this->validatePayload($request, $shopUserIds, $page);

        if (($data['status'] ?? null) === 'published' && $page->admin_locked) {
            return response()->json([
                'success' => false,
                'message' => 'This landing page has been locked by the admin and cannot be published.',
                'admin_lock_reason' => $page->admin_lock_reason,
            ], 403);
        }

        $page = DB::transaction(function () use ($page, $data, $shopUserIds) {
            $status = $data['status'] ?? $page->status;
            $slug = $this->resolveSlug(
                $data['slug'] ?? $page->slug,
                $data['title'] ?? $page->title,
                $page->id
            );

            $page->update([
                'template_id' => $data['template_id'] ?? $page->template_id,
                'title' => $data['title'] ?? $page->title,
                'slug' => $slug,
                'status' => $status,
                'theme_settings' => $data['theme_settings'] ?? $page->theme_settings,
                'content' => $data['content'] ?? $page->content,
                'seo_meta' => $data['seo_meta'] ?? $page->seo_meta,
                'custom_css' => array_key_exists('custom_css', $data) ? $data['custom_css'] : $page->custom_css,
                'published_at' => $status === 'published' ? ($page->published_at ?? now()) : null,
            ]);

            if (array_key_exists('products', $data)) {
                $this->syncProducts($page, $data['products'] ?? [], $shopUserIds);
            }

            return $page->load(['template', 'products.product.images', 'products.variant.optionValues.option']);
        });

        return response()->json(['success' => true, 'data' => $page]);
    }

    public function destroy(int $id): JsonResponse
    {
        $page = LandingPage::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $page->delete();

        return response()->json([
            'success' => true,
            'message' => 'Landing page deleted.',
        ]);
    }

    public function publish(int $id): JsonResponse
    {
        $page = LandingPage::query()->whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        if ($page->admin_locked) {
            return response()->json([
                'success' => false,
                'message' => 'This landing page has been locked by the admin and cannot be published.',
                'admin_lock_reason' => $page->admin_lock_reason,
            ], 403);
        }

        $page->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $page->fresh(['template', 'products.product.images', 'products.variant.optionValues.option']),
        ]);
    }

    /** @param array<int, int> $shopUserIds */
    private function validatePayload(Request $request, array $shopUserIds, ?LandingPage $page = null): array
    {
        $pageId = $page?->id;

        $validated = $request->validate([
            'template_id' => ['nullable', 'integer', Rule::exists('landing_templates', 'id')->where(fn ($query) => $query->where('is_active', true))],
            'title' => ['required_without:id', 'string', 'max:180'],
            'slug' => [
                'nullable',
                'string',
                'max:200',
                Rule::unique('landing_pages', 'slug')->ignore($pageId),
            ],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'theme_settings' => ['nullable', 'array'],
            'content' => ['nullable', 'array'],
            'seo_meta' => ['nullable', 'array'],
            'custom_css' => ['nullable', 'string'],

            'products' => ['nullable', 'array'],
            'products.*.product_id' => [
                'required',
                'integer',
                Rule::exists('products', 'id')->where(fn ($q) => $q->whereIn('user_id', $shopUserIds)),
            ],
            // Pinned variant when the merchant attaches one specific
            // combination instead of the whole product — validated against
            // its own product_id in syncProducts() since Rule::exists here
            // can't see the sibling product_id for this row.
            'products.*.product_variant_id' => ['nullable', 'integer'],
            'products.*.title_override' => ['nullable', 'string', 'max:180'],
            'products.*.subtitle' => ['nullable', 'string', 'max:220'],
            'products.*.badge_text' => ['nullable', 'string', 'max:80'],
            'products.*.price_override' => ['nullable', 'numeric', 'min:0'],
            'products.*.default_qty' => ['nullable', 'integer', 'min:1', 'max:100'],
            'products.*.selected_by_default' => ['nullable', 'boolean'],
            'products.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);

        $this->assertVideoEmbedUrlsAllowed($validated['content']['video_embeds'] ?? []);

        return $validated;
    }

    /**
     * The no-code builder lets a merchant paste a plain video URL, which is
     * turned into an <iframe src> on the public page — validate the domain
     * server-side too (not just in the frontend) since that's the actual
     * XSS/injection boundary.
     */
    private function assertVideoEmbedUrlsAllowed(array $videoEmbeds): void
    {
        $allowedHostPattern = '/^(www\.)?(youtube\.com|youtu\.be|vimeo\.com|facebook\.com|fb\.watch)$/i';

        foreach ($videoEmbeds as $embed) {
            $url = $embed['url'] ?? null;
            if (!$url) {
                continue;
            }

            $host = parse_url($url, PHP_URL_HOST);
            if (!$host || !preg_match($allowedHostPattern, $host)) {
                throw ValidationException::withMessages([
                    'content.video_embeds' => 'Video URL must be a YouTube, Facebook, or Vimeo link.',
                ]);
            }
        }
    }

    private function resolveSlug(?string $requestedSlug, string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($requestedSlug ?: $title);
        if (blank($base)) {
            $base = 'landing-page';
        }

        $slug = $base;
        $counter = 1;
        while (
            LandingPage::query()
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->where('slug', $slug)
                ->exists()
        ) {
            $counter++;
            $slug = $base . '-' . $counter;
        }

        return $slug;
    }

    /** @param array<int, int> $shopUserIds */
    private function syncProducts(LandingPage $page, array $products, array $shopUserIds): void
    {
        $productIds = collect($products)->pluck('product_id')->filter()->unique()->values();
        if ($productIds->isEmpty()) {
            $page->products()->delete();
            return;
        }

        $validIds = Product::query()
            ->whereIn('user_id', $shopUserIds)
            ->whereIn('id', $productIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        // Pinned variants (mode: merchant picks one exact combination while
        // building the page) must actually belong to their row's product —
        // load them keyed by "productId:variantId" so a mismatched pair is
        // silently dropped rather than pinning the wrong product's variant.
        $variantIds = collect($products)->pluck('product_variant_id')->filter()->unique()->values();
        $validVariantKeys = $variantIds->isEmpty() ? collect() : ProductVariant::query()
            ->whereIn('id', $variantIds)
            ->get(['id', 'product_id'])
            ->map(fn ($v) => $v->product_id . ':' . $v->id)
            ->all();

        $rows = collect($products)
            ->filter(fn ($item) => in_array((int) ($item['product_id'] ?? 0), $validIds, true))
            ->values()
            ->map(function ($item, $index) use ($page, $validVariantKeys) {
                $variantId = $item['product_variant_id'] ?? null;
                $key = $variantId ? ((int) $item['product_id'] . ':' . (int) $variantId) : null;

                return [
                    'landing_page_id' => $page->id,
                    'product_id' => (int) $item['product_id'],
                    'product_variant_id' => ($key && in_array($key, $validVariantKeys, true)) ? (int) $variantId : null,
                    'title_override' => $item['title_override'] ?? null,
                    'subtitle' => $item['subtitle'] ?? null,
                    'badge_text' => $item['badge_text'] ?? null,
                    'price_override' => $item['price_override'] ?? null,
                    'default_qty' => max(1, (int) ($item['default_qty'] ?? 1)),
                    'selected_by_default' => (bool) ($item['selected_by_default'] ?? true),
                    'sort_order' => (int) ($item['sort_order'] ?? ($index + 1)),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            });

        $page->products()->delete();
        if ($rows->isNotEmpty()) {
            LandingPageProduct::insert($rows->all());
        }
    }

    private function defaultTheme(): array
    {
        return [
            'primary_color' => '#0f766e',
            'accent_color' => '#f97316',
            'background_color' => '#f8fafc',
            'text_color' => '#0f172a',
            'button_text_color' => '#ffffff',
            'font_family' => 'Hind Siliguri',
        ];
    }

    private function defaultContent(string $title): array
    {
        return [
            'hero' => [
                'headline' => $title,
                'subheadline' => 'আপনার প্রোডাক্টের জন্য কনভার্টিং সেলার ল্যান্ডিং পেজ।',
                'cta_text' => 'অর্ডার করতে চাই',
            ],
            'features' => [],
            'reviews' => [],
            'faq' => [],
            'contact' => ['phone' => null],
            'shipping' => ['inside_dhaka' => 80, 'outside_dhaka' => 120],
        ];
    }
}
