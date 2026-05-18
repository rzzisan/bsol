<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LandingPageOrderService;
use App\Models\LandingPage;
use App\Models\LandingPageProduct;
use App\Models\LandingTemplate;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class LandingPageController extends Controller
{
    public function publicShow(string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['template', 'products.product'])
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => array_merge($page->toArray(), [
                'public_url' => route('landing-pages.show', ['slug' => $page->slug]),
            ]),
        ]);
    }

    public function publicSubmitOrder(Request $request, string $slug): JsonResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['products.product'])
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
            'items' => ['required', 'array', 'min:1'],
            'items.*.enabled' => ['nullable', 'boolean'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.product_variant_id' => ['nullable', 'integer'],
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

        $order = app(LandingPageOrderService::class)->create($page, $validated, $lineItems);

        return response()->json([
            'success' => true,
            'message' => 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে। শিগগিরই আমাদের প্রতিনিধি যোগাযোগ করবে।',
            'data' => [
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'subtotal' => $order->subtotal,
                'shipping_charge' => $order->shipping_charge,
                'total' => $order->total,
            ],
        ], 201);
    }

    public function importFiles(): JsonResponse
    {
        $jsonDir = dirname(base_path()) . '/landing_page_json';

        if (!is_dir($jsonDir)) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $files = collect(glob($jsonDir . '/*.json') ?: [])
            ->map(fn (string $path) => basename($path))
            ->values();

        return response()->json([
            'success' => true,
            'data' => $files,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = auth()->id();
        $perPage = min((int) ($request->per_page ?? 20), 100);

        $pages = LandingPage::query()
            ->where('user_id', $userId)
            ->with(['template:id,code,name_bn,name_en', 'products'])
            ->orderByDesc('id')
            ->paginate($perPage);

        $data = collect($pages->items())->map(function (LandingPage $page) {
            return [
                'id' => $page->id,
                'title' => $page->title,
                'slug' => $page->slug,
                'status' => $page->status,
                'published_at' => $page->published_at,
                'product_count' => $page->products->count(),
                'template' => $page->template,
                'public_url' => route('landing-pages.show', ['slug' => $page->slug]),
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
        $userId = auth()->id();
        $data = $this->validatePayload($request, $userId);

        $page = DB::transaction(function () use ($data, $userId) {
            $slug = $this->resolveSlug($data['slug'] ?? null, $data['title']);

            $page = LandingPage::create([
                'user_id' => $userId,
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

            $this->syncProducts($page, $data['products'] ?? [], $userId);

            return $page->load(['template', 'products.product']);
        });

        return response()->json(['success' => true, 'data' => $page], 201);
    }

    public function show(int $id): JsonResponse
    {
        $page = LandingPage::query()
            ->where('user_id', auth()->id())
            ->with(['template', 'products.product'])
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => array_merge($page->toArray(), [
                'public_url' => route('landing-pages.show', ['slug' => $page->slug]),
            ]),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $userId = auth()->id();
        $page = LandingPage::query()->where('user_id', $userId)->findOrFail($id);
        $data = $this->validatePayload($request, $userId, $page);

        $page = DB::transaction(function () use ($page, $data, $userId) {
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
                $this->syncProducts($page, $data['products'] ?? [], $userId);
            }

            return $page->load(['template', 'products.product']);
        });

        return response()->json(['success' => true, 'data' => $page]);
    }

    public function destroy(int $id): JsonResponse
    {
        $page = LandingPage::query()->where('user_id', auth()->id())->findOrFail($id);
        $page->delete();

        return response()->json([
            'success' => true,
            'message' => 'Landing page deleted.',
        ]);
    }

    public function publish(int $id): JsonResponse
    {
        $page = LandingPage::query()->where('user_id', auth()->id())->findOrFail($id);
        $page->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'data' => $page->fresh(['template', 'products.product']),
        ]);
    }

    public function importFromJson(Request $request): JsonResponse
    {
        $data = $request->validate([
            'file_name' => ['required', 'string', 'max:190'],
            'template_id' => ['nullable', 'integer', Rule::exists('landing_templates', 'id')->where(fn ($query) => $query->where('is_active', true))],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
        ]);

        $safeFile = basename($data['file_name']);
        if (!str_ends_with(strtolower($safeFile), '.json')) {
            return response()->json([
                'success' => false,
                'message' => 'Only .json file is allowed.',
            ], 422);
        }

        $jsonPath = dirname(base_path()) . '/landing_page_json/' . $safeFile;
        if (!is_file($jsonPath)) {
            return response()->json([
                'success' => false,
                'message' => 'JSON file not found.',
            ], 404);
        }

        $payload = json_decode((string) file_get_contents($jsonPath), true);
        if (!is_array($payload) || empty($payload)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid JSON format.',
            ], 422);
        }

        $first = $payload[0] ?? [];
        $title = $first['title'] ?? Str::of($safeFile)->beforeLast('.')->replace(['-', '_'], ' ')->title()->toString();

        $steps = collect($first['steps'] ?? []);
        $checkoutStep = $steps->firstWhere('type', 'checkout') ?? $steps->first();
        $html = is_array($checkoutStep) ? ($checkoutStep['post_content'] ?? null) : null;

        $status = $data['status'] ?? 'draft';
        $template = null;
        if (!empty($data['template_id'])) {
            $template = LandingTemplate::query()->where('is_active', true)->find($data['template_id']);
        }

        $page = LandingPage::create([
            'user_id' => auth()->id(),
            'template_id' => $template?->id,
            'title' => $title,
            'slug' => $this->resolveSlug(null, $title),
            'status' => $status,
            'theme_settings' => $this->defaultTheme(),
            'content' => [
                'hero' => [
                    'headline' => $title,
                    'subheadline' => 'এই পেজটি JSON থেকে ইমপোর্ট করা হয়েছে।',
                    'cta_text' => 'অর্ডার করতে চাই',
                ],
                'html_sections' => $html ? [['title' => 'Imported Section', 'html' => $html]] : [],
                'features' => [],
                'reviews' => [],
                'faq' => [],
                'contact' => ['phone' => null],
                'shipping' => ['inside_dhaka' => 80, 'outside_dhaka' => 120],
            ],
            'seo_meta' => [
                'meta_title' => $title,
            ],
            'published_at' => $status === 'published' ? now() : null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'JSON imported successfully.',
            'data' => $page->load(['template', 'products.product']),
        ], 201);
    }

    private function validatePayload(Request $request, int $userId, ?LandingPage $page = null): array
    {
        $pageId = $page?->id;

        return $request->validate([
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
                Rule::exists('products', 'id')->where('user_id', $userId),
            ],
            'products.*.title_override' => ['nullable', 'string', 'max:180'],
            'products.*.subtitle' => ['nullable', 'string', 'max:220'],
            'products.*.badge_text' => ['nullable', 'string', 'max:80'],
            'products.*.price_override' => ['nullable', 'numeric', 'min:0'],
            'products.*.default_qty' => ['nullable', 'integer', 'min:1', 'max:100'],
            'products.*.selected_by_default' => ['nullable', 'boolean'],
            'products.*.sort_order' => ['nullable', 'integer', 'min:0', 'max:999'],
        ]);
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

    private function syncProducts(LandingPage $page, array $products, int $userId): void
    {
        $productIds = collect($products)->pluck('product_id')->filter()->unique()->values();
        if ($productIds->isEmpty()) {
            $page->products()->delete();
            return;
        }

        $validIds = Product::query()
            ->where('user_id', $userId)
            ->whereIn('id', $productIds)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $rows = collect($products)
            ->filter(fn ($item) => in_array((int) ($item['product_id'] ?? 0), $validIds, true))
            ->values()
            ->map(function ($item, $index) use ($page) {
                return [
                    'landing_page_id' => $page->id,
                    'product_id' => (int) $item['product_id'],
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
