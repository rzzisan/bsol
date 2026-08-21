<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::whereIn('user_id', auth()->user()->shopUserIds())
            ->with(['category:id,name', 'images'])
            ->withCount(['variants as active_variants_count' => fn ($q) => $q->where('is_active', true)])
            ->withTrashed(false);

        // Filters
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('category_id')) {
            $query->where('category_id', $request->category_id);
        }
        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn($q) => $q->where('name', 'ilike', $s)->orWhere('sku', 'ilike', $s));
        }
        if ($request->boolean('low_stock')) {
            $query->where('track_stock', true)->whereColumn('stock', '<=', 'low_stock_alert');
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $products = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $products->items(),
            'meta'    => [
                'total'        => $products->total(),
                'current_page' => $products->currentPage(),
                'last_page'    => $products->lastPage(),
                'per_page'     => $products->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|max:255',
            'category_id'      => 'nullable|integer|exists:product_categories,id',
            'sku'              => [
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->where(fn ($q) => $q->whereIn('user_id', auth()->user()->shopUserIds())->whereNull('deleted_at')),
            ],
            'description'      => 'required|string',
            'regular_price'    => 'nullable|numeric|min:0',
            'discount'         => 'nullable|numeric|min:0',
            'discount_type'    => 'nullable|in:amount,percent',
            'selling_price'    => 'nullable|numeric|min:0',
            'cost_price'       => 'nullable|numeric|min:0',
            'stock'            => 'nullable|integer|min:0',
            'low_stock_alert'  => 'nullable|integer|min:0',
            'track_stock'      => 'nullable|boolean',
            'has_variants'     => 'nullable|boolean',
            'unit'             => 'nullable|string|max:50',
            'status'           => 'nullable|in:active,inactive,archived',
            'variants'         => 'nullable|array',
            'thumbnail'        => 'nullable|string|max:500',
            'images'           => 'nullable|array',
            'images.*'         => 'string|max:500',
            'source'           => 'nullable|in:manual,woocommerce',
            'source_ref'       => 'nullable|string|max:255',
            'platform_api_key_id' => 'nullable|integer|exists:platform_api_keys,id',
            ...$this->digitalFieldRules(),
            ...$this->storefrontFieldRules(),
        ]);

        $this->normalizeDigitalFields($data);
        $data['slug'] = $this->uniqueSlug($data['name']);

        $data['user_id']     = auth()->id();
        $data['discount_type'] = $data['discount_type'] ?? 'amount';
        $data['regular_price'] = isset($data['regular_price']) ? (float) $data['regular_price'] : (float) ($data['selling_price'] ?? 0);
        $data['discount']    = $data['discount'] ?? 0;
        $this->ensureValidDiscountValue($data['discount_type'], (float) $data['discount']);
        $data['selling_price'] = $this->calculateSellingPrice(
            (float) $data['regular_price'],
            (float) $data['discount'],
            (string) $data['discount_type']
        );
        $data['cost_price']  = $data['cost_price'] ?? 0;
        $data['track_stock'] = $data['track_stock'] ?? false;
        $data['has_variants'] = $data['has_variants'] ?? false;
        $data['status']      = $data['status'] ?? 'active';

        // Validate category belongs to this user
        if (!empty($data['category_id'])) {
            $this->validateCategoryOwnership($data['category_id']);
        }

        $images = $data['images'] ?? [];
        unset($data['images']);

        $product = Product::create($data);

        // Save extra images
        foreach ($images as $i => $url) {
            ProductImage::create([
                'product_id' => $product->id,
                'url'        => $url,
                'is_primary' => $i === 0 && empty($data['thumbnail']),
                'sort_order' => $i,
            ]);
        }

        $product->load(['category:id,name', 'images']);

        return response()->json(['success' => true, 'data' => $product], 201);
    }

    public function show(int $id): JsonResponse
    {
        $product = Product::whereIn('user_id', auth()->user()->shopUserIds())
            ->with(['category:id,name', 'images'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $product]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $data = $request->validate([
            'name'            => 'sometimes|required|string|max:255',
            'category_id'     => 'nullable|integer|exists:product_categories,id',
            'sku'             => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->where(fn ($q) => $q->whereIn('user_id', auth()->user()->shopUserIds())->whereNull('deleted_at'))->ignore($product->id),
            ],
            'description'     => 'sometimes|required|string',
            'regular_price'   => 'nullable|numeric|min:0',
            'discount'        => 'nullable|numeric|min:0',
            'discount_type'   => 'nullable|in:amount,percent',
            'selling_price'   => 'nullable|numeric|min:0',
            'cost_price'      => 'nullable|numeric|min:0',
            'stock'           => 'nullable|integer|min:0',
            'low_stock_alert' => 'nullable|integer|min:0',
            'track_stock'     => 'nullable|boolean',
            'has_variants'    => 'nullable|boolean',
            'unit'            => 'nullable|string|max:50',
            'status'          => 'nullable|in:active,inactive,archived',
            'variants'        => 'nullable|array',
            'thumbnail'       => 'nullable|string|max:500',
            'source'          => 'nullable|in:manual,woocommerce',
            'source_ref'      => 'nullable|string|max:255',
            'platform_api_key_id' => 'nullable|integer|exists:platform_api_keys,id',
            ...$this->digitalFieldRules(),
            ...$this->storefrontFieldRules(),
        ]);

        $this->normalizeDigitalFields($data);

        // Slug is set once at creation and never re-derived from a later
        // name edit — a public /product/{slug} link must stay stable, not
        // shift under a seller fixing a typo in the name (unlike SKU/name,
        // there's no seller-facing slug field to edit it deliberately yet).
        if (! $product->slug) {
            $data['slug'] = $this->uniqueSlug($data['name'] ?? $product->name, $product->id);
        }

        if (!empty($data['category_id'])) {
            $this->validateCategoryOwnership($data['category_id']);
        }

        $discountType = $data['discount_type'] ?? (string) ($product->discount_type ?: 'amount');
        $discountValue = array_key_exists('discount', $data) ? (float) $data['discount'] : (float) ($product->discount ?? 0);
        $regularPrice = array_key_exists('regular_price', $data)
            ? (float) $data['regular_price']
            : (float) ($product->regular_price ?? $product->selling_price ?? 0);

        $this->ensureValidDiscountValue($discountType, $discountValue);

        $data['discount_type'] = $discountType;
        $data['discount'] = $discountValue;
        $data['regular_price'] = $regularPrice;
        $data['selling_price'] = $this->calculateSellingPrice($regularPrice, $discountValue, $discountType);

        $product->update($data);
        $product->load(['category:id,name', 'images']);

        return response()->json(['success' => true, 'data' => $product]);
    }

    public function destroy(int $id): JsonResponse
    {
        $product = Product::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $product->delete(); // soft delete

        return response()->json(['success' => true, 'message' => 'Product deleted.']);
    }

    public function stats(): JsonResponse
    {
        $shopUserIds = auth()->user()->shopUserIds();

        $total    = Product::whereIn('user_id', $shopUserIds)->count();
        $active   = Product::whereIn('user_id', $shopUserIds)->where('status', 'active')->count();
        $inactive = Product::whereIn('user_id', $shopUserIds)->where('status', 'inactive')->count();
        $lowStock = Product::whereIn('user_id', $shopUserIds)
            ->where('track_stock', true)
            ->whereColumn('stock', '<=', 'low_stock_alert')
            ->count();
        $outOfStock = Product::whereIn('user_id', $shopUserIds)
            ->where('track_stock', true)
            ->where('stock', 0)
            ->count();

        return response()->json([
            'success' => true,
            'data' => compact('total', 'active', 'inactive', 'lowStock', 'outOfStock'),
        ]);
    }

    public function adjustStock(Request $request, int $id): JsonResponse
    {
        $product = Product::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);

        $data = $request->validate([
            'adjustment' => 'required|integer', // positive = add, negative = subtract
            'reason'     => 'nullable|string|max:255',
        ]);

        $newStock = max(0, $product->stock + $data['adjustment']);
        $product->update(['stock' => $newStock]);

        return response()->json([
            'success'   => true,
            'data'      => ['stock' => $newStock],
            'message'   => 'Stock adjusted.',
        ]);
    }

    /** @return array<string, mixed> */
    private function digitalFieldRules(): array
    {
        return [
            'product_type' => ['nullable', Rule::in([Product::TYPE_PHYSICAL, Product::TYPE_DIGITAL])],
            'digital_delivery_type' => [
                'nullable',
                Rule::in([Product::DIGITAL_DELIVERY_HOSTED_FILE, Product::DIGITAL_DELIVERY_EXTERNAL_URL]),
            ],
            'digital_external_url' => ['nullable', 'url', 'max:2000'],
            'digital_delivery_channels' => ['nullable', 'array'],
            'digital_delivery_channels.*' => [Rule::in(['email', 'sms'])],
            // Anti-piracy OTP gate for hosted_file — seller-configurable,
            // default true. See digital_product_context.md §0ক-4/§14.
            'digital_require_otp' => ['nullable', 'boolean'],
        ];
    }

    /**
     * external_url is only meaningful for that delivery type — clear it
     * when the seller switches to hosted_file (the actual file upload is a
     * separate multipart request, DigitalProductFileController::store()).
     *
     * @param array<string, mixed> $data
     */
    private function normalizeDigitalFields(array &$data): void
    {
        if (($data['product_type'] ?? null) !== Product::TYPE_DIGITAL) {
            return;
        }

        if (($data['digital_delivery_type'] ?? null) === Product::DIGITAL_DELIVERY_HOSTED_FILE) {
            $data['digital_external_url'] = null;
        }
    }

    /**
     * Per-shop unique (owner+staff), mirrors ProductCategoryController's own
     * uniqueSlug() and LandingPageController::resolveSlug() — same
     * counter-suffix approach, kept small and duplicated rather than
     * shared, matching this codebase's stated preference (see
     * digital_product_context.md's DigitalDeliveryService docblock).
     */
    private function uniqueSlug(string $name, ?int $excludeId = null): string
    {
        $shopUserIds = auth()->user()->shopUserIds();
        $base = \Illuminate\Support\Str::slug($name) ?: 'product';
        $slug = $base;
        $i = 1;

        while (
            Product::whereIn('user_id', $shopUserIds)
                ->where('slug', $slug)
                ->when($excludeId, fn ($q) => $q->where('id', '!=', $excludeId))
                ->exists()
        ) {
            $slug = $base . '-' . ++$i;
        }

        return $slug;
    }

    /** @return array<string, mixed> */
    private function storefrontFieldRules(): array
    {
        return [
            'show_in_storefront' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:255'],
            'specifications' => ['nullable', 'array'],
            'specifications.*.group' => ['required_with:specifications', 'string', 'max:100'],
            'specifications.*.items' => ['required_with:specifications', 'array'],
            'specifications.*.items.*.label' => ['required_with:specifications', 'string', 'max:100'],
            'specifications.*.items.*.value' => ['required_with:specifications', 'string', 'max:500'],
            'seo_content' => ['nullable', 'string'],
            'warranty_override' => ['nullable', 'string'],
            'delivery_override' => ['nullable', 'string'],
        ];
    }

    private function validateCategoryOwnership(int $categoryId): void
    {
        \App\Models\ProductCategory::whereIn('user_id', auth()->user()->shopUserIds())
            ->findOrFail($categoryId);
    }

    private function calculateSellingPrice(float $regularPrice, float $discount, string $discountType): float
    {
        if ($discountType === 'percent') {
            return max(0, $regularPrice - (($regularPrice * $discount) / 100));
        }

        return max(0, $regularPrice - $discount);
    }

    /**
     * @throws ValidationException
     */
    private function ensureValidDiscountValue(string $discountType, float $discount): void
    {
        if ($discountType === 'percent' && $discount > 100) {
            throw ValidationException::withMessages([
                'discount' => ['Percentage discount cannot be more than 100.'],
            ]);
        }
    }
}
