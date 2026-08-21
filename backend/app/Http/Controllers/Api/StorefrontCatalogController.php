<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacebookPageConnection;
use App\Models\Product;
use App\Models\ProductCategory;
use App\Models\ProductReview;
use App\Models\ProductVariant;
use App\Models\ShopProfile;
use App\Models\StorefrontSetting;
use App\Support\LandingPageResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public (unauthenticated) storefront catalog — categories/products list +
 * product detail. seller_storefront_context.md §12 (S1).
 *
 * Every response is built through an explicit allowlist (publicProduct*()
 * below), never a raw model dump — cost_price, sku... wait no: cost_price,
 * user_id, digital_file_path/digital_external_url, source/source_ref and
 * every other internal column must never reach this controller's JSON. This
 * is deliberate: an earlier feature (digital_product_context.md) shipped a
 * real leak of exactly this kind (Product had no $hidden array, so a public
 * endpoint serialized the whole model) — an allowlist can't repeat that
 * mistake the way a hide-list can when a new column is added later.
 */
class StorefrontCatalogController extends Controller
{
    private const PER_PAGE_DEFAULT = 20;
    private const PER_PAGE_MAX = 60;

    /**
     * Bundled data for the storefront homepage (/store, S5/S6) — shop
     * identity, public-safe theme settings, featured categories/products in
     * one call rather than four round trips.
     */
    public function home(Request $request): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $ownerId = $label === null ? null : LandingPageResolver::shopOwnerIdForLabel($label);
        $shopUserIds = $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);

        if ($shopUserIds === null || $ownerId === null) {
            return $this->shopNotFound();
        }

        $shop = ShopProfile::where('user_id', $ownerId)->first();
        $storefront = StorefrontSetting::where('user_id', $ownerId)->first();
        $messengerPageId = FacebookPageConnection::where('user_id', $ownerId)
            ->where('status', 'connected')
            ->value('fb_page_id');

        $featuredCategoryIds = $storefront?->featured_category_ids ?? [];
        $featuredCategories = ProductCategory::whereIn('user_id', $shopUserIds)
            ->where('is_active', true)
            ->when(! empty($featuredCategoryIds), fn ($q) => $q->whereIn('id', $featuredCategoryIds))
            ->orderBy('sort_order')
            ->limit(12)
            ->get(['id', 'name', 'slug']);

        $featuredProducts = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->where('is_featured', true)
            ->orderByDesc('id')
            ->with('category:id,name,slug')
            ->limit(12)
            ->get();

        // Category-wise product rows (Ghorer Bazar-style homepage
        // sections, §1). Capped at 6 categories x 10 products — a
        // per-category query each, but catalogs at this stage are small
        // enough that this beats a single denormalized query for clarity.
        $categorySections = ProductCategory::whereIn('user_id', $shopUserIds)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->limit(6)
            ->get(['id', 'name', 'slug'])
            ->map(function (ProductCategory $category) {
                $products = Product::where('category_id', $category->id)
                    ->where('status', 'active')
                    ->where('show_in_storefront', true)
                    ->orderByDesc('id')
                    ->limit(10)
                    ->get();

                return $products->isEmpty() ? null : [
                    'category' => ['id' => $category->id, 'name' => $category->name, 'slug' => $category->slug],
                    'products' => $products->map(fn (Product $p) => $this->publicProductSummary($p))->values(),
                ];
            })
            ->filter()
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'shop_name' => $shop?->shop_name,
                'logo_url' => $shop?->logo_url,
                // Contact/deep-link info for the product page's Call/
                // WhatsApp/Messenger buttons (seller_storefront_context.md
                // §7) — plain tel:/wa.me/m.me links, no API calls, so this
                // is safe to expose publicly (same info a footer would show).
                'phone' => $shop?->phone,
                'whatsapp_number' => $storefront?->whatsapp_number ?: $shop?->phone,
                'show_call_button' => $storefront?->show_call_button ?? true,
                'show_whatsapp_button' => $storefront?->show_whatsapp_button ?? true,
                'show_messenger_button' => ($storefront?->show_messenger_button ?? true) && $messengerPageId !== null,
                'messenger_page_id' => $messengerPageId,
                'theme_primary_color' => $storefront?->theme_primary_color,
                // image_path is an internal storage detail (used server-side
                // to delete the file on replace/remove) — stripped here.
                'banner_images' => collect($storefront?->banner_images ?? [])
                    ->map(fn ($b) => ['image_url' => $b['image_url'] ?? null, 'link_url' => $b['link_url'] ?? null])
                    ->values(),
                'about_text' => $storefront?->about_text,
                'about_image_url' => $storefront?->about_image_url,
                'partner_logos' => collect($storefront?->partner_logos ?? [])
                    ->map(fn ($p) => ['image_url' => $p['image_url'] ?? null, 'link_url' => $p['link_url'] ?? null])
                    ->values(),
                'featured_categories' => $featuredCategories->map(fn (ProductCategory $c) => [
                    'id' => $c->id, 'name' => $c->name, 'slug' => $c->slug,
                ]),
                'featured_products' => $featuredProducts->map(fn (Product $p) => $this->publicProductSummary($p))->values(),
                'category_sections' => $categorySections,
            ],
        ]);
    }

    /**
     * Unpaginated slug + updated_at lists for /sitemap.xml (S8,
     * frontend/src/app/sitemap.ts) — a sitemap needs every URL in one
     * shot, not a paginated feed, so this is deliberately not the same
     * shape as products()/categories() above.
     */
    public function sitemapData(Request $request): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $shopUserIds = $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
        if ($shopUserIds === null) {
            return $this->shopNotFound();
        }

        $categories = ProductCategory::whereIn('user_id', $shopUserIds)
            ->where('is_active', true)
            ->get(['slug', 'updated_at']);

        $products = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->get(['slug', 'updated_at']);

        $landingPages = \App\Models\LandingPage::whereIn('user_id', $shopUserIds)
            ->where('status', 'published')
            ->get(['slug', 'updated_at']);

        return response()->json([
            'success' => true,
            'data' => [
                'categories' => $categories->map(fn ($c) => ['slug' => $c->slug, 'updated_at' => $c->updated_at])->values(),
                'products' => $products->map(fn ($p) => ['slug' => $p->slug, 'updated_at' => $p->updated_at])->values(),
                'landing_pages' => $landingPages->map(fn ($p) => ['slug' => $p->slug, 'updated_at' => $p->updated_at])->values(),
            ],
        ]);
    }

    public function categories(Request $request): JsonResponse
    {
        $shopUserIds = $this->shopUserIds($request);
        if ($shopUserIds === null) {
            return $this->shopNotFound();
        }

        $categories = ProductCategory::whereIn('user_id', $shopUserIds)
            ->where('is_active', true)
            ->withCount(['products' => fn (Builder $q) => $q->where('status', 'active')->where('show_in_storefront', true)])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'sort_order']);

        return response()->json([
            'success' => true,
            'data' => $categories->map(fn (ProductCategory $c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'product_count' => $c->products_count,
            ]),
        ]);
    }

    public function products(Request $request): JsonResponse
    {
        $shopUserIds = $this->shopUserIds($request);
        if ($shopUserIds === null) {
            return $this->shopNotFound();
        }

        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:160'],
            'q' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:newest,price_asc,price_desc,name_asc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:' . self::PER_PAGE_MAX],
        ]);

        $query = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->with('category:id,name,slug');

        if (! empty($data['category'])) {
            $query->whereHas('category', fn (Builder $q) => $q->where('slug', $data['category']));
        }

        if (! empty($data['q'])) {
            $term = '%' . $data['q'] . '%';
            $query->where('name', 'ilike', $term);
        }

        match ($data['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('selling_price', 'asc'),
            'price_desc' => $query->orderBy('selling_price', 'desc'),
            'name_asc' => $query->orderBy('name', 'asc'),
            default => $query->orderByDesc('id'),
        };

        $perPage = min((int) ($data['per_page'] ?? self::PER_PAGE_DEFAULT), self::PER_PAGE_MAX);
        $products = $query->paginate($perPage, page: $data['page'] ?? 1);

        return response()->json([
            'success' => true,
            'data' => collect($products->items())->map(fn (Product $p) => $this->publicProductSummary($p)),
            'meta' => [
                'total' => $products->total(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
                'per_page' => $products->perPage(),
            ],
        ]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());
        $shopUserIds = $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
        if ($shopUserIds === null) {
            return $this->shopNotFound();
        }

        $product = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->where('slug', $slug)
            ->with([
                'category:id,name,slug',
                'images',
                // Nested eager load goes inside the same closure, not as a
                // separate 'variants.optionValues.option' array entry — the
                // two forms don't merge reliably when mixed for one relation.
                'variants' => fn ($q) => $q->where('is_active', true)
                    ->orderBy('position')
                    ->with('optionValues.option'),
            ])
            ->first();

        if (! $product) {
            return response()->json(['success' => false, 'message' => 'Product not found.'], 404);
        }

        $ownerId = LandingPageResolver::shopOwnerIdForLabel($label);
        $storefront = $ownerId ? StorefrontSetting::where('user_id', $ownerId)->first() : null;

        $related = Product::whereIn('user_id', $shopUserIds)
            ->where('status', 'active')
            ->where('show_in_storefront', true)
            ->where('id', '!=', $product->id)
            ->when($product->category_id, fn ($q) => $q->where('category_id', $product->category_id))
            ->limit(8)
            ->get(['id', 'name', 'slug', 'thumbnail', 'regular_price', 'discount', 'discount_type', 'selling_price']);

        // S7 — average/count computed over ALL approved reviews (not just
        // the capped list below, which is display-only — a "load more"
        // paginated feed isn't worth it yet at this catalog's scale).
        $reviewStats = ProductReview::where('product_id', $product->id)
            ->where('is_approved', true)
            ->selectRaw('count(*) as count, coalesce(avg(rating), 0) as average')
            ->first();

        $approvedReviews = ProductReview::where('product_id', $product->id)
            ->where('is_approved', true)
            ->orderByDesc('id')
            ->limit(20)
            ->get(['customer_name', 'rating', 'comment', 'created_at']);

        return response()->json([
            'success' => true,
            'data' => array_merge($this->publicProductSummary($product), [
                'sku' => $product->sku,
                'description' => $product->description,
                'features' => $product->features ?? [],
                'specifications' => $product->specifications ?? [],
                'seo_content' => $product->seo_content,
                'warranty_text' => $product->warranty_override ?: $storefront?->warranty_policy_text,
                'delivery_text' => $product->delivery_override ?: $storefront?->delivery_policy_text,
                'images' => $product->images->map(fn ($img) => ['id' => $img->id, 'url' => $img->url])->values(),
                // NOT $product->variants: Product has a legacy `variants`
                // jsonb column (products.variants, pre-dates the
                // product_variants table) with the same name as the
                // variants() relation — attribute access always wins over
                // an eager-loaded relation of the same name in Eloquent, so
                // ->variants silently returns the (here, null) column
                // instead of the loaded collection. getRelation() bypasses
                // that collision.
                'variants' => $product->getRelation('variants')->map(fn ($v) => $this->publicVariant($v))->values(),
                'rating' => [
                    'average' => (float) round((float) $reviewStats->average, 1),
                    'count' => (int) $reviewStats->count,
                ],
                'reviews' => $approvedReviews->map(fn (ProductReview $r) => [
                    'customer_name' => $r->customer_name,
                    'rating' => $r->rating,
                    'comment' => $r->comment,
                    'created_at' => $r->created_at,
                ])->values(),
                'related_products' => $related->map(fn (Product $p) => $this->publicProductSummary($p))->values(),
            ]),
        ]);
    }

    /** @return array<string, mixed> */
    private function publicProductSummary(Product $product): array
    {
        return [
            'id' => $product->id,
            'slug' => $product->slug,
            'name' => $product->name,
            'thumbnail' => $product->thumbnail,
            'regular_price' => $product->regular_price,
            'discount' => $product->discount,
            'discount_type' => $product->discount_type,
            'selling_price' => $product->selling_price,
            'in_stock' => ! $product->track_stock || $product->stock > 0,
            'is_featured' => (bool) $product->is_featured,
            'product_type' => $product->product_type,
            'category' => $product->relationLoaded('category') && $product->category
                ? ['id' => $product->category->id, 'name' => $product->category->name, 'slug' => $product->category->slug]
                : null,
        ];
    }

    /** Explicit allowlist — never ProductVariantFormatter::format() here, that includes cost_price (merchant-only). */
    private function publicVariant(ProductVariant $variant): array
    {
        return [
            'id' => $variant->id,
            'sku' => $variant->sku,
            'regular_price' => $variant->regular_price,
            'discount' => $variant->discount,
            'discount_type' => $variant->discount_type,
            'selling_price' => $variant->selling_price,
            'in_stock' => $variant->stock_qty > 0,
            'image_url' => $variant->image_url,
            'options' => $variant->relationLoaded('optionValues')
                ? $variant->optionValues->map(fn ($ov) => [
                    'option_name' => $ov->option?->name,
                    'option_type' => $ov->option?->type,
                    'value' => $ov->value,
                    'label' => $ov->label,
                    'color_hex' => $ov->color_hex,
                ])
                : [],
        ];
    }

    /** @return array<int, int>|null */
    private function shopUserIds(Request $request): ?array
    {
        $label = LandingPageResolver::subdomainLabel($request->getHost());

        return $label === null ? null : LandingPageResolver::shopUserIdsForLabel($label);
    }

    private function shopNotFound(): JsonResponse
    {
        return response()->json(['success' => false, 'message' => 'Unknown shop.'], 404);
    }
}
