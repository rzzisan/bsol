<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\ProductVariant;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ProductVariantController extends Controller
{
    // ──────────────────────────────────────────────────────────────────────
    // OPTIONS
    // ──────────────────────────────────────────────────────────────────────

    /** GET /products/{product}/options */
    public function optionIndex(Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $options = $product->options()->with('values')->get();

        return response()->json(['success' => true, 'data' => $options]);
    }

    /** POST /products/{product}/options */
    public function optionStore(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $data = $request->validate([
            'name'         => 'required|string|max:100',
            'display_name' => 'nullable|string|max:100',
            'type'         => 'nullable|in:select,color_swatch,image_swatch,text',
            'is_required'  => 'nullable|boolean',
            'position'     => 'nullable|integer|min:0',
            'values'       => 'nullable|array',
            'values.*.value'     => 'required|string|max:100',
            'values.*.label'     => 'nullable|string|max:100',
            'values.*.color_hex' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'values.*.image_url' => 'nullable|string|max:500',
            'values.*.position'  => 'nullable|integer|min:0',
        ]);

        $option = $product->options()->create([
            'name'         => $data['name'],
            'display_name' => $data['display_name'] ?? null,
            'type'         => $data['type'] ?? 'select',
            'is_required'  => $data['is_required'] ?? true,
            'position'     => $data['position'] ?? $product->options()->count(),
        ]);

        foreach ($data['values'] ?? [] as $i => $v) {
            $option->values()->create([
                'value'     => $v['value'],
                'label'     => $v['label'] ?? null,
                'color_hex' => $v['color_hex'] ?? null,
                'image_url' => $v['image_url'] ?? null,
                'position'  => $v['position'] ?? $i,
            ]);
        }

        $option->load('values');

        // Ensure has_variants is flagged
        $product->update(['has_variants' => true]);

        return response()->json(['success' => true, 'data' => $option], 201);
    }

    /** PUT /products/{product}/options/{option} */
    public function optionUpdate(Request $request, Product $product, ProductOption $option): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($option->product_id !== $product->id, 404);

        $data = $request->validate([
            'name'         => 'sometimes|required|string|max:100',
            'display_name' => 'nullable|string|max:100',
            'type'         => 'nullable|in:select,color_swatch,image_swatch,text',
            'is_required'  => 'nullable|boolean',
            'position'     => 'nullable|integer|min:0',
        ]);

        $option->update($data);

        return response()->json(['success' => true, 'data' => $option->load('values')]);
    }

    /** DELETE /products/{product}/options/{option} */
    public function optionDestroy(Product $product, ProductOption $option): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($option->product_id !== $product->id, 404);

        $option->delete(); // cascades to values and pivot

        return response()->json(['success' => true, 'message' => 'Option deleted.']);
    }

    /** POST /products/{product}/options/{option}/values */
    public function valueStore(Request $request, Product $product, ProductOption $option): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($option->product_id !== $product->id, 404);

        $data = $request->validate([
            'value'     => 'required|string|max:100',
            'label'     => 'nullable|string|max:100',
            'color_hex' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'image_url' => 'nullable|string|max:500',
            'position'  => 'nullable|integer|min:0',
        ]);

        $value = $option->values()->create([
            'value'     => $data['value'],
            'label'     => $data['label'] ?? null,
            'color_hex' => $data['color_hex'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'position'  => $data['position'] ?? $option->values()->count(),
        ]);

        return response()->json(['success' => true, 'data' => $value], 201);
    }

    /** PUT /products/{product}/options/{option}/values/{value} */
    public function valueUpdate(Request $request, Product $product, ProductOption $option, ProductOptionValue $value): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($option->product_id !== $product->id, 404);
        abort_if($value->product_option_id !== $option->id, 404);

        $data = $request->validate([
            'value'     => 'sometimes|required|string|max:100',
            'label'     => 'nullable|string|max:100',
            'color_hex' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'image_url' => 'nullable|string|max:500',
            'position'  => 'nullable|integer|min:0',
        ]);

        $value->update($data);

        return response()->json(['success' => true, 'data' => $value]);
    }

    /** DELETE /products/{product}/options/{option}/values/{value} */
    public function valueDestroy(Product $product, ProductOption $option, ProductOptionValue $value): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($option->product_id !== $product->id, 404);
        abort_if($value->product_option_id !== $option->id, 404);

        $value->delete();

        return response()->json(['success' => true, 'message' => 'Option value deleted.']);
    }

    // ──────────────────────────────────────────────────────────────────────
    // VARIANTS
    // ──────────────────────────────────────────────────────────────────────

    /** GET /products/{product}/variants */
    public function index(Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $variants = $product->variants()
            ->with('optionValues')
            ->orderBy('position')
            ->get()
            ->map(fn ($v) => $this->formatVariant($v));

        return response()->json(['success' => true, 'data' => $variants]);
    }

    /** POST /products/{product}/variants */
    public function store(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $data = $this->validateVariantPayload($request, $product);

        $variant = $this->createVariant($product, $data);

        return response()->json(['success' => true, 'data' => $this->formatVariant($variant)], 201);
    }

    /** PUT /products/{product}/variants/{variant} */
    public function update(Request $request, Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($variant->product_id !== $product->id, 404);

        $data = $this->validateVariantPayload($request, $product, $variant->id);

        $optionValueIds = $data['option_value_ids'] ?? null;
        $resolvedImageUrl = $data['image_url'] ?? $variant->image_url;
        if (!$resolvedImageUrl && is_array($optionValueIds) && count($optionValueIds) > 0) {
            $selectedValues = ProductOptionValue::query()
                ->whereIn('id', $optionValueIds)
                ->with('option:id,type')
                ->get();
            $resolvedImageUrl = $this->pickPreferredVariantImageFromOptionValues($selectedValues);
        }

        $variant->update([
            'sku'               => $data['sku'] ?? $variant->sku,
            'regular_price'     => $data['regular_price'] ?? $variant->regular_price,
            'discount'          => $data['discount'] ?? $variant->discount,
            'discount_type'     => $data['discount_type'] ?? $variant->discount_type,
            'cost_price'        => $data['cost_price'] ?? $variant->cost_price,
            'stock_qty'         => $data['stock_qty'] ?? $variant->stock_qty,
            'low_stock_threshold'=> $data['low_stock_threshold'] ?? $variant->low_stock_threshold,
            'weight'            => $data['weight'] ?? $variant->weight,
            'image_url'         => $resolvedImageUrl,
            'is_active'         => $data['is_active'] ?? $variant->is_active,
            'position'          => $data['position'] ?? $variant->position,
        ]);

        // Re-sync option values
        if (isset($data['option_value_ids'])) {
            $variant->optionValues()->sync($data['option_value_ids']);
        }

        return response()->json(['success' => true, 'data' => $this->formatVariant($variant->fresh(['optionValues']))]);
    }

    /** DELETE /products/{product}/variants/{variant} */
    public function destroy(Product $product, ProductVariant $variant): JsonResponse
    {
        $this->authorizeProduct($product);
        abort_if($variant->product_id !== $product->id, 404);

        $variant->delete(); // soft delete

        $hasAnyActiveVariants = $product->variants()->where('is_active', true)->exists();
        if (!$hasAnyActiveVariants) {
            $product->update(['has_variants' => false]);
        }

        return response()->json(['success' => true, 'message' => 'Variant deleted.']);
    }

    /**
     * POST /products/{product}/variants/generate
     * Generates Cartesian product of options → variants (skips existing SKUs).
     */
    public function generate(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $data = $request->validate([
            'sku_prefix'     => 'nullable|string|max:50',
            'default_price'  => 'required|numeric|min:0',
            'default_discount'=> 'nullable|numeric|min:0',
            'discount_type'  => 'nullable|in:amount,percent',
            'default_cost'   => 'nullable|numeric|min:0',
            'default_stock'  => 'nullable|integer|min:0',
        ]);

        // Load all options with their values
        $options = $product->options()->with('values')->orderBy('position')->get();

        if ($options->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'No options defined. Add options first.'], 422);
        }

        // Build Cartesian product of option value IDs
        $valueGroups = $options->map(fn ($opt) => $opt->values->values())->all();
        $combinations = $this->cartesian($valueGroups);

        if (count($combinations) > 100) {
            return response()->json([
                'success' => false,
                'message' => 'Too many combinations (' . count($combinations) . '). Maximum 100 variants per product. Remove some option values.',
            ], 422);
        }

        $prefix    = strtoupper($data['sku_prefix'] ?? Str::upper(Str::slug($product->name, '-')));
        $created   = 0;
        $skipped   = 0;
        $nextPos   = $product->variants()->withTrashed()->count();

        foreach ($combinations as $combo) {
            // Build SKU from value slugs: PREFIX-RED-M-128GB
            $slugParts = collect($combo)->map(fn ($v) => Str::upper(Str::slug($v->value, '-')))->implode('-');
            $sku = $prefix . '-' . $slugParts;

            // Skip if SKU already exists globally (including soft-deleted rows)
            if (ProductVariant::withTrashed()->where('sku', $sku)->exists()) {
                $skipped++;
                continue;
            }

            try {
                $comboImageUrl = $this->pickPreferredVariantImageFromOptionValues($combo);

                $variant = ProductVariant::create([
                    'product_id'    => $product->id,
                    'sku'           => $sku,
                    'regular_price' => $data['default_price'],
                    'discount'      => $data['default_discount'] ?? 0,
                    'discount_type' => $data['discount_type'] ?? 'amount',
                    'cost_price'    => $data['default_cost'] ?? 0,
                    'stock_qty'     => $data['default_stock'] ?? 0,
                    'image_url'     => $comboImageUrl,
                    'is_active'     => true,
                    'position'      => $nextPos++,
                ]);

                $variant->optionValues()->sync(collect($combo)->pluck('id')->toArray());
                $created++;
            } catch (UniqueConstraintViolationException) {
                // In case of race-condition or slug collisions, skip instead of failing whole request.
                $skipped++;
                continue;
            }
        }

        $product->update(['has_variants' => true]);

        return response()->json([
            'success' => true,
            'data'    => [
                'created' => $created,
                'skipped' => $skipped,
                'total'   => $created + $skipped,
            ],
            'message' => "$created variants generated" . ($skipped ? ", $skipped skipped (duplicate SKU)." : '.'),
        ]);
    }

    /**
     * PUT /products/{product}/variants/bulk
     * Bulk update price / stock for multiple variants.
     */
    public function bulkUpdate(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $data = $request->validate([
            'variants'                => 'required|array|min:1|max:100',
            'variants.*.id'           => 'required|integer',
            'variants.*.regular_price'=> 'nullable|numeric|min:0',
            'variants.*.discount'     => 'nullable|numeric|min:0',
            'variants.*.discount_type'=> 'nullable|in:amount,percent',
            'variants.*.cost_price'   => 'nullable|numeric|min:0',
            'variants.*.stock_qty'    => 'nullable|integer|min:0',
            'variants.*.is_active'    => 'nullable|boolean',
        ]);

        $variantIds = collect($data['variants'])->pluck('id');
        $variants   = $product->variants()->whereIn('id', $variantIds)->get()->keyBy('id');

        foreach ($data['variants'] as $row) {
            $variant = $variants[$row['id']] ?? null;
            if (!$variant) continue;

            $updateData = array_filter([
                'regular_price' => $row['regular_price'] ?? null,
                'discount'      => $row['discount'] ?? null,
                'discount_type' => $row['discount_type'] ?? null,
                'cost_price'    => $row['cost_price'] ?? null,
                'stock_qty'     => $row['stock_qty'] ?? null,
                'is_active'     => $row['is_active'] ?? null,
            ], fn ($v) => $v !== null);

            if (!empty($updateData)) {
                $variant->update($updateData); // boot() will re-compute selling_price
            }
        }

        return response()->json(['success' => true, 'message' => 'Variants updated.']);
    }

    /**
     * GET /products/{product}/variants/resolve
     * Resolve option_value_ids → matching variant (for storefront/order picker).
     */
    public function resolve(Request $request, Product $product): JsonResponse
    {
        $this->authorizeProduct($product);

        $data = $request->validate([
            'option_value_ids'   => 'required|array|min:1',
            'option_value_ids.*' => 'integer',
        ]);

        $ids   = collect($data['option_value_ids'])->sort()->values()->toArray();
        $count = count($ids);

        $variant = $product->variants()
            ->whereHas('optionValues', fn ($q) => $q->whereIn('product_option_values.id', $ids), '=', $count)
            ->where('is_active', true)
            ->first();

        if (!$variant) {
            return response()->json(['success' => false, 'message' => 'No matching variant found.'], 404);
        }

        $variant->load('optionValues');

        return response()->json(['success' => true, 'data' => $this->formatVariant($variant)]);
    }

    // ──────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────

    private function authorizeProduct(Product $product): void
    {
        abort_if($product->user_id !== auth()->id(), 403);
    }

    private function formatVariant(ProductVariant $variant): array
    {
        return [
            'id'                  => $variant->id,
            'sku'                 => $variant->sku,
            'regular_price'       => $variant->regular_price,
            'discount'            => $variant->discount,
            'discount_type'       => $variant->discount_type,
            'selling_price'       => $variant->selling_price,
            'cost_price'          => $variant->cost_price,
            'stock_qty'           => $variant->stock_qty,
            'low_stock_threshold' => $variant->low_stock_threshold,
            'weight'              => $variant->weight,
            'image_url'           => $variant->image_url,
            'is_active'           => $variant->is_active,
            'position'            => $variant->position,
            'is_low_stock'        => $variant->isLowStock(),
            'options'             => $variant->relationLoaded('optionValues')
                ? $variant->optionValues->map(fn ($ov) => [
                    'option_value_id' => $ov->id,
                    'option_id'       => $ov->option?->id,
                    'option_name'     => $ov->option?->name,
                    'option_type'     => $ov->option?->type,
                    'value'           => $ov->value,
                    'label'           => $ov->label,
                    'color_hex'       => $ov->color_hex,
                    'image_url'       => $ov->image_url,
                ])
                : [],
        ];
    }

    private function validateVariantPayload(Request $request, Product $product, ?int $ignoreId = null): array
    {
        $skuRule = 'required|string|max:100|unique:product_variants,sku' . ($ignoreId ? ",$ignoreId" : '') . ',id,deleted_at,NULL';

        return $request->validate([
            'sku'                => $skuRule,
            'regular_price'      => 'required|numeric|min:0',
            'discount'           => 'nullable|numeric|min:0',
            'discount_type'      => 'nullable|in:amount,percent',
            'cost_price'         => 'nullable|numeric|min:0',
            'stock_qty'          => 'nullable|integer|min:0',
            'low_stock_threshold'=> 'nullable|integer|min:0',
            'weight'             => 'nullable|numeric|min:0',
            'image_url'          => 'nullable|string|max:500',
            'is_active'          => 'nullable|boolean',
            'position'           => 'nullable|integer|min:0',
            'option_value_ids'   => 'nullable|array',
            'option_value_ids.*' => 'integer|exists:product_option_values,id',
        ]);
    }

    private function createVariant(Product $product, array $data): ProductVariant
    {
        $resolvedImageUrl = $data['image_url'] ?? null;

        if (!$resolvedImageUrl && !empty($data['option_value_ids'])) {
            $selectedValues = ProductOptionValue::query()
                ->whereIn('id', $data['option_value_ids'])
                ->with('option:id,type')
                ->get();
            $resolvedImageUrl = $this->pickPreferredVariantImageFromOptionValues($selectedValues);
        }

        $variant = ProductVariant::create([
            'product_id'         => $product->id,
            'sku'                => $data['sku'],
            'regular_price'      => $data['regular_price'],
            'discount'           => $data['discount'] ?? 0,
            'discount_type'      => $data['discount_type'] ?? 'amount',
            'cost_price'         => $data['cost_price'] ?? 0,
            'stock_qty'          => $data['stock_qty'] ?? 0,
            'low_stock_threshold'=> $data['low_stock_threshold'] ?? 5,
            'weight'             => $data['weight'] ?? null,
            'image_url'          => $resolvedImageUrl,
            'is_active'          => $data['is_active'] ?? true,
            'position'           => $data['position'] ?? $product->variants()->count(),
        ]);

        if (!empty($data['option_value_ids'])) {
            $variant->optionValues()->sync($data['option_value_ids']);
        }

        $product->update(['has_variants' => true]);

        return $variant->load('optionValues');
    }

    /**
     * Compute the Cartesian product of arrays of ProductOptionValue objects.
     */
    private function cartesian(array $groups): array
    {
        $result = [[]];

        foreach ($groups as $group) {
            $append = [];
            foreach ($result as $combo) {
                foreach ($group as $value) {
                    $append[] = array_merge($combo, [$value]);
                }
            }
            $result = $append;
        }

        return $result;
    }

    /**
     * Picks the best image candidate for a variant from selected option values.
     * Priority: image_swatch values first, then any value that has image_url.
     */
    private function pickPreferredVariantImageFromOptionValues(iterable $optionValues): ?string
    {
        $values = collect($optionValues)->filter(fn ($v) => !empty($v->image_url))->values();

        if ($values->isEmpty()) {
            return null;
        }

        $imageSwatch = $values->first(fn ($v) => ($v->option?->type ?? null) === 'image_swatch');
        if ($imageSwatch) {
            return (string) $imageSwatch->image_url;
        }

        return (string) $values->first()->image_url;
    }
}
