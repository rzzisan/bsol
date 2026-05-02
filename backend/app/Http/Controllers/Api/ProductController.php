<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Product::where('user_id', auth()->id())
            ->with(['category:id,name', 'images'])
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
            'sku'              => 'nullable|string|max:100',
            'description'      => 'nullable|string',
            'selling_price'    => 'required|numeric|min:0',
            'cost_price'       => 'nullable|numeric|min:0',
            'stock'            => 'nullable|integer|min:0',
            'low_stock_alert'  => 'nullable|integer|min:0',
            'track_stock'      => 'nullable|boolean',
            'unit'             => 'nullable|string|max:50',
            'status'           => 'nullable|in:active,inactive,archived',
            'variants'         => 'nullable|array',
            'thumbnail'        => 'nullable|string|max:500',
            'images'           => 'nullable|array',
            'images.*'         => 'string|max:500',
        ]);

        $data['user_id']     = auth()->id();
        $data['cost_price']  = $data['cost_price'] ?? 0;
        $data['track_stock'] = $data['track_stock'] ?? false;
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
        $product = Product::where('user_id', auth()->id())
            ->with(['category:id,name', 'images'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $product]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'name'            => 'sometimes|required|string|max:255',
            'category_id'     => 'nullable|integer|exists:product_categories,id',
            'sku'             => 'nullable|string|max:100',
            'description'     => 'nullable|string',
            'selling_price'   => 'sometimes|required|numeric|min:0',
            'cost_price'      => 'nullable|numeric|min:0',
            'stock'           => 'nullable|integer|min:0',
            'low_stock_alert' => 'nullable|integer|min:0',
            'track_stock'     => 'nullable|boolean',
            'unit'            => 'nullable|string|max:50',
            'status'          => 'nullable|in:active,inactive,archived',
            'variants'        => 'nullable|array',
            'thumbnail'       => 'nullable|string|max:500',
        ]);

        if (!empty($data['category_id'])) {
            $this->validateCategoryOwnership($data['category_id']);
        }

        $product->update($data);
        $product->load(['category:id,name', 'images']);

        return response()->json(['success' => true, 'data' => $product]);
    }

    public function destroy(int $id): JsonResponse
    {
        $product = Product::where('user_id', auth()->id())->findOrFail($id);
        $product->delete(); // soft delete

        return response()->json(['success' => true, 'message' => 'Product deleted.']);
    }

    public function stats(): JsonResponse
    {
        $userId = auth()->id();

        $total    = Product::where('user_id', $userId)->count();
        $active   = Product::where('user_id', $userId)->where('status', 'active')->count();
        $inactive = Product::where('user_id', $userId)->where('status', 'inactive')->count();
        $lowStock = Product::where('user_id', $userId)
            ->where('track_stock', true)
            ->whereColumn('stock', '<=', 'low_stock_alert')
            ->count();
        $outOfStock = Product::where('user_id', $userId)
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
        $product = Product::where('user_id', auth()->id())->findOrFail($id);

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

    private function validateCategoryOwnership(int $categoryId): void
    {
        \App\Models\ProductCategory::where('user_id', auth()->id())
            ->findOrFail($categoryId);
    }
}
