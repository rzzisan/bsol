<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\AccountingService;
use App\Services\OrderBulkImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Bulk/CSV order import — feature_roadmap_context.md "Bulk/CSV order
 * import" (§16.8). Preview-then-commit (see OrderBulkImportService's
 * docblock): both endpoints run the same stateless parse+validate — the
 * client re-uploads the same file for commit as it did for preview, no
 * server-side temp-file/token layer.
 */
class OrderBulkImportController extends Controller
{
    public function __construct(
        private readonly OrderBulkImportService $importer,
        private readonly AccountingService $accountingService,
    ) {}

    public function template(): Response
    {
        return response($this->importer->templateCsv(), 200, [
            'Content-Type' => 'text/csv; charset=utf-8',
            'Content-Disposition' => 'attachment; filename=bsol-order-import-template.csv',
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);

        $ownerId = auth()->user()->shopOwnerId();
        $shopUserIds = auth()->user()->shopUserIds();

        try {
            $result = $this->importer->parseAndValidate($request->file('file'), $ownerId, $shopUserIds);
        } catch (\RuntimeException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total_rows' => count($result['rows']),
                'valid_count' => $result['valid_count'],
                'invalid_count' => $result['invalid_count'],
                'rows' => $result['rows'],
            ],
        ]);
    }

    public function commit(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt', 'max:2048']]);

        $actingUserId = auth()->id();
        $ownerId = auth()->user()->shopOwnerId();
        $shopUserIds = auth()->user()->shopUserIds();

        try {
            $parsed = $this->importer->parseAndValidate($request->file('file'), $ownerId, $shopUserIds);
        } catch (\RuntimeException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        $validRows = array_values(array_filter($parsed['rows'], fn ($r) => $r['errors'] === []));

        $maxOrders = auth()->user()->shopOwner()->subscriptionPackage?->max_orders;
        $remainingQuota = null;
        if ($maxOrders !== null) {
            $ordersThisMonth = Order::whereIn('user_id', $shopUserIds)
                ->whereYear('created_at', now()->year)
                ->whereMonth('created_at', now()->month)
                ->count();
            $remainingQuota = max(0, $maxOrders - $ordersThisMonth);
        }

        $result = $this->importer->commit($validRows, $actingUserId, $ownerId, $shopUserIds, $remainingQuota, $this->accountingService);

        return response()->json([
            'success' => true,
            'data' => [
                'created_count' => count($result['created']),
                'created_order_numbers' => collect($result['created'])->pluck('order_number'),
                'skipped_for_quota' => $result['skipped_for_quota'],
                'skipped' => collect($parsed['rows'])
                    ->where('errors', '!=', [])
                    ->map(fn ($r) => ['row_number' => $r['row_number'], 'errors' => $r['errors']])
                    ->values(),
            ],
        ]);
    }
}
