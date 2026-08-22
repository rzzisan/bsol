<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusLog;
use App\Models\Product;
use App\Support\PhoneIntelCache;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * CSV/Bulk order import — feature_roadmap_context.md "Bulk/CSV order import"
 * (§16.8). A deliberate near-duplicate of OrderController::store()'s
 * creation core rather than a shared refactor of it — same reasoning as
 * StorefrontOrderService's docblock (this codebase's established
 * preference for small per-feature duplication over cross-feature
 * coupling): CSV rows are meaningfully simpler (no variant matching,
 * always exactly one item) and reusing the same primitives without
 * touching the already-tested manual-create path avoids regression risk
 * there entirely.
 *
 * One CSV row = one order = one line item (v1 scope decision — a seller
 * needing multiple products per order adds it manually afterward via the
 * existing order-edit page).
 */
class OrderBulkImportService
{
    public const MAX_ROWS = 500;

    public const REQUIRED_HEADERS = ['customer_phone', 'product_name', 'quantity', 'unit_price'];

    public const ALL_HEADERS = [
        'customer_name', 'customer_phone', 'customer_address', 'customer_district', 'customer_thana',
        'product_name', 'sku', 'quantity', 'unit_price', 'shipping_charge', 'discount', 'payment_method', 'notes',
    ];

    public function templateCsv(): string
    {
        $csv = implode(',', self::ALL_HEADERS) . "\n";
        $example = [
            'Rahim Uddin', '01711223344', 'House 12, Road 4, Dhanmondi', 'Dhaka', 'Dhanmondi',
            'Cotton T-Shirt', 'TSHIRT-001', '2', '590', '70', '0', 'cod', 'Call before delivery',
        ];

        return $csv . implode(',', array_map(fn ($v) => '"' . str_replace('"', '""', $v) . '"', $example)) . "\n";
    }

    /**
     * Parses + validates every row without creating anything. Both
     * preview() and commit() (below) call this so they can never disagree
     * about what's valid.
     *
     * @param array<int, int> $shopUserIds
     * @return array{rows: array<int, array{row_number: int, data: array, errors: array}>, valid_count: int, invalid_count: int}
     */
    public function parseAndValidate(UploadedFile $file, int $ownerId, array $shopUserIds): array
    {
        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw new \RuntimeException('Could not read the uploaded file.');
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw new \RuntimeException('The file is empty.');
        }

        // Strip a leading UTF-8 BOM (common from Windows/Excel exports) and
        // normalize header names so "Customer Phone" == "customer_phone".
        $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', $header[0]);
        $header = array_map(fn ($h) => strtolower(trim(str_replace(' ', '_', (string) $h))), $header);

        $missing = array_diff(self::REQUIRED_HEADERS, $header);
        if ($missing !== []) {
            fclose($handle);
            throw new \RuntimeException('Missing required column(s): ' . implode(', ', $missing));
        }

        // SKU -> product_id lookup, scoped to this shop, so a row's `sku`
        // can optionally link a real product (same optional-link semantics
        // OrderItem.product_id already has elsewhere).
        $skusByCode = Product::query()
            ->whereIn('user_id', $shopUserIds)
            ->whereNotNull('sku')
            ->pluck('id', 'sku');

        $rows = [];
        $rowNumber = 1; // header is row 1, first data row is row 2
        while (($line = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if (count(array_filter($line, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue; // skip blank lines
            }
            if (count($rows) >= self::MAX_ROWS) {
                fclose($handle);
                throw new \RuntimeException('This file has more than ' . self::MAX_ROWS . ' rows — please split it into multiple files.');
            }

            $data = [];
            foreach ($header as $i => $key) {
                $data[$key] = isset($line[$i]) ? trim((string) $line[$i]) : null;
            }

            $errors = $this->validateRow($data);
            $productId = null;
            if (! empty($data['sku']) && $skusByCode->has($data['sku'])) {
                $productId = $skusByCode->get($data['sku']);
            }

            $rows[] = [
                'row_number' => $rowNumber,
                'data' => $data,
                'product_id' => $productId,
                'errors' => $errors,
            ];
        }
        fclose($handle);

        $validCount = collect($rows)->where('errors', [])->count();

        return [
            'rows' => $rows,
            'valid_count' => $validCount,
            'invalid_count' => count($rows) - $validCount,
        ];
    }

    /** @return array<int, string> */
    private function validateRow(array $data): array
    {
        $validator = Validator::make($data, [
            'customer_phone' => ['required', 'string', 'max:20'],
            'customer_name' => ['nullable', 'string', 'max:150'],
            'product_name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'integer', 'min:1'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'shipping_charge' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'payment_method' => ['nullable', 'in:cod,online,bkash'],
        ]);

        return $validator->fails() ? $validator->errors()->all() : [];
    }

    /**
     * Creates one Order per currently-valid row, up to $remainingQuota, all
     * inside one transaction (all created or none, on an unexpected
     * mid-batch failure — every row here already passed parseAndValidate()).
     *
     * @param array<int, array> $validRows rows from parseAndValidate() with errors === []
     * @param array<int, int> $shopUserIds
     * @return array{created: array<int, Order>, skipped_for_quota: int}
     */
    public function commit(array $validRows, int $actingUserId, int $ownerId, array $shopUserIds, ?int $remainingQuota, AccountingService $accounting): array
    {
        $toCreate = $remainingQuota !== null ? array_slice($validRows, 0, max(0, $remainingQuota)) : $validRows;
        $skippedForQuota = count($validRows) - count($toCreate);

        $created = DB::transaction(function () use ($toCreate, $actingUserId, $ownerId, $shopUserIds, $accounting) {
            $orders = [];
            foreach ($toCreate as $row) {
                $data = $row['data'];
                $quantity = (int) $data['quantity'];
                $unitPrice = (float) $data['unit_price'];
                $subtotal = $quantity * $unitPrice;
                $shippingCharge = (float) ($data['shipping_charge'] ?? 0);
                $discount = (float) ($data['discount'] ?? 0);
                $total = max(0, $subtotal + $shippingCharge - $discount);

                $order = Order::create([
                    'user_id' => $ownerId,
                    'order_number' => Order::generateOrderNumber($shopUserIds),
                    'customer_name' => $data['customer_name'] ?: null,
                    'customer_phone' => $data['customer_phone'],
                    'customer_address' => $data['customer_address'] ?: null,
                    'customer_district' => $data['customer_district'] ?: null,
                    'customer_thana' => $data['customer_thana'] ?: null,
                    'source' => 'bulk_import',
                    'status' => 'pending',
                    'payment_method' => $data['payment_method'] ?: 'cod',
                    'payment_status' => 'due',
                    'subtotal' => $subtotal,
                    'shipping_charge' => $shippingCharge,
                    'discount' => $discount,
                    'total' => $total,
                    'notes' => $data['notes'] ?: null,
                    'fraud_score' => 0,
                    'risk_level' => 'low',
                ]);

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $row['product_id'],
                    'product_name' => $data['product_name'],
                    'sku' => $data['sku'] ?: null,
                    'quantity' => $quantity,
                    'regular_price' => $unitPrice,
                    'discount' => 0,
                    'discount_type' => 'amount',
                    'unit_price' => $unitPrice,
                    'total' => $subtotal,
                ]);

                OrderStatusLog::create([
                    'order_id' => $order->id,
                    'old_status' => null,
                    'new_status' => 'pending',
                    'note' => 'Order created via CSV bulk import.',
                    'changed_by' => $actingUserId,
                ]);

                $order->load(['items', 'statusLogs']);
                Customer::syncFromOrder($order);
                PhoneIntelCache::bump($order->customer_phone);
                $accounting->onOrderCreated($order);
                $accounting->onCourierChargeUpdated($order);

                $orders[] = $order;
            }

            return $orders;
        });

        return ['created' => $created, 'skipped_for_quota' => $skippedForQuota];
    }
}
