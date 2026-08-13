<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProductVariantController;
use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Plugin-facing product/variant sync — /api/connect/v1/products/sync.
 * Delegates to the existing ProductController::store()/update() and
 * ProductVariantController::store()/update() rather than duplicating
 * pricing/validation logic — same pattern as ConnectOrderController.
 * This endpoint itself is outbound (WooCommerce -> BSOL) only; the reverse
 * direction (BSOL -> WooCommerce stock push-back, for stock consumed by a
 * non-WooCommerce order) is handled separately by
 * Product::booted()/ProductVariant::booted() + PushWooCommerceStockJob —
 * this controller wraps its own writes in withoutEvents() below so they
 * don't loop back into that. See bsol_history_and_new_context.md §5.
 */
class ConnectProductController extends Controller
{
    public function __construct(
        private readonly ProductController $productController,
        private readonly ProductVariantController $productVariantController,
    ) {}

    public function sync(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_product_id'               => 'required|string|max:100',
            'name'                        => 'required|string|max:255',
            'sku'                         => 'required|string|max:100',
            'description'                 => 'nullable|string',
            'regular_price'               => 'nullable|numeric|min:0',
            'discount'                    => 'nullable|numeric|min:0',
            'stock_quantity'              => 'nullable|integer|min:0',
            'manage_stock'                => 'nullable|boolean',
            'status'                      => 'nullable|in:active,inactive',
            'image_url'                   => 'nullable|string|max:500',
            'type'                        => 'required|in:simple,variable',
            'variants'                    => 'nullable|array',
            'variants.*.wc_variation_id'  => 'required_with:variants|string|max:100',
            'variants.*.sku'              => 'required_with:variants|string|max:100',
            'variants.*.regular_price'    => 'required_with:variants|numeric|min:0',
            'variants.*.discount'         => 'nullable|numeric|min:0',
            'variants.*.stock_quantity'   => 'nullable|integer|min:0',
            'variants.*.image_url'        => 'nullable|string|max:500',
        ]);

        $merchant    = auth()->user();
        $shopUserIds = $merchant->shopUserIds();
        $isVariable  = $data['type'] === 'variable';
        $apiKey      = $request->attributes->get('platform_api_key');

        // Scoped by the specific site (platform_api_key_id), not just the
        // seller — two different WooCommerce sites both number their own
        // products 1, 2, 3, ... from scratch, so matching on source_ref
        // alone would collide across a seller's connected sites (Phase 16).
        $product = Product::whereIn('user_id', $shopUserIds)
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', $apiKey?->id)
            ->where('source_ref', $data['wc_product_id'])
            ->first();

        $productPayload = [
            'name'          => $data['name'],
            'sku'           => $data['sku'],
            // ProductController::store() requires a non-empty description
            // (a reasonable rule for a dashboard user manually creating a
            // product) — but plenty of real WooCommerce products have none
            // at all. Found via live QA against a real store (Phase 14):
            // an empty string here failed Laravel's `required` rule and
            // silently blocked every such product's sync. Fall back to the
            // product name rather than leave this required field empty.
            'description'   => ($data['description'] ?? '') !== '' ? $data['description'] : $data['name'],
            'regular_price' => $data['regular_price'] ?? 0,
            'discount'      => $data['discount'] ?? 0,
            'discount_type' => 'amount',
            // Variable-product parents don't carry their own stock in
            // WooCommerce — stock lives per-variation.
            'stock'         => $isVariable ? 0 : ($data['stock_quantity'] ?? 0),
            'track_stock'   => $isVariable ? false : (bool) ($data['manage_stock'] ?? false),
            'status'        => ($data['status'] ?? 'active') === 'active' ? 'active' : 'inactive',
            'thumbnail'     => $data['image_url'] ?? null,
            'has_variants'  => $isVariable,
            'source'        => 'woocommerce',
            'source_ref'    => (string) $data['wc_product_id'],
            'platform_api_key_id' => $apiKey?->id,
        ];

        // withoutEvents: this write is itself an inbound WooCommerce->BSOL
        // sync — without this it would immediately trigger
        // Product::booted()'s stock-push-back and echo straight back to
        // the same site that just told us this value. A *dashboard*
        // stock edit on the same product still pushes normally (untouched
        // by this suppression, which is scoped to just these two calls).
        if (! $product) {
            $productRequest = Request::create('/api/products', 'POST', $productPayload);
            $response = Product::withoutEvents(fn () => $this->productController->store($productRequest));
        } else {
            $productRequest = Request::create('/api/products/' . $product->id, 'PUT', $productPayload);
            $response = Product::withoutEvents(fn () => $this->productController->update($productRequest, $product->id));
        }

        $responseData = json_decode($response->getContent(), true);
        if (empty($responseData['success'])) {
            // Bubble validation errors (e.g. SKU conflict) back as-is —
            // same errors a dashboard user would see creating this product.
            return $response;
        }

        $productId    = $responseData['data']['id'];
        $productModel = Product::find($productId);

        $warnings = [];
        $variantsSynced = 0;

        foreach ($data['variants'] ?? [] as $variantData) {
            $variant = ProductVariant::where('product_id', $productId)
                ->where('source', 'woocommerce')
                ->where('source_ref', $variantData['wc_variation_id'])
                ->first();

            $variantPayload = [
                'sku'           => $variantData['sku'],
                'regular_price' => $variantData['regular_price'],
                'discount'      => $variantData['discount'] ?? 0,
                'discount_type' => 'amount',
                'stock_qty'     => $variantData['stock_quantity'] ?? 0,
                'image_url'     => $variantData['image_url'] ?? null,
                'source'        => 'woocommerce',
                'source_ref'    => (string) $variantData['wc_variation_id'],
            ];

            try {
                if (! $variant) {
                    $variantRequest = Request::create("/api/products/{$productId}/variants", 'POST', $variantPayload);
                    ProductVariant::withoutEvents(fn () => $this->productVariantController->store($variantRequest, $productModel));
                } else {
                    $variantRequest = Request::create("/api/products/{$productId}/variants/{$variant->id}", 'PUT', $variantPayload);
                    ProductVariant::withoutEvents(fn () => $this->productVariantController->update($variantRequest, $productModel, $variant));
                }
                $variantsSynced++;
            } catch (UniqueConstraintViolationException) {
                // product_variants.sku is unique across the entire
                // install, not just this seller's shop — a WC-supplied
                // SKU can legitimately collide with another seller's
                // existing variant. Skip it, don't fail the whole sync.
                $warnings[] = "SKU conflict for variant \"{$variantData['sku']}\" (already used elsewhere on the platform) — skipped.";
            } catch (ValidationException $e) {
                $warnings[] = "Variant \"{$variantData['sku']}\" sync failed: " . collect($e->errors())->flatten()->first();
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'product_id'      => $productId,
                'wc_product_id'   => $data['wc_product_id'],
                'variants_synced' => $variantsSynced,
                'warnings'        => $warnings,
            ],
        ]);
    }
}
