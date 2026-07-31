<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\PathaoLocationService;
use App\Services\SteadfastService;
use App\Services\PathaoService;
use App\Services\RedxService;
use App\Services\CarrybeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
    private function getSteadfastSettings(): ?CourierSetting
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();

        if (! $settings || ! $settings->steadfast_api_key) {
            return null;
        }

        return $settings;
    }

    // ── Pathao Location Dropdowns ─────────────────────────────────────────────

    public function cities(): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $cities = $svc->getCities(auth()->id());
        return response()->json(['success' => true, 'data' => $cities, 'has_credentials' => $svc->hasCredentials(auth()->id())]);
    }

    public function zones(int $cityId): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $zones = $svc->getZones($cityId, auth()->id());
        return response()->json(['success' => true, 'data' => $zones]);
    }

    public function areas(int $zoneId): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $areas = $svc->getAreas($zoneId, auth()->id());
        return response()->json(['success' => true, 'data' => $areas]);
    }

    // ── RedX Areas / Pickup Stores / Charge ─────────────────────────────────────

    public function redxAreas(Request $request): JsonResponse
    {
        $svc    = new RedxService();
        $result = $svc->getAreas(auth()->id(), $request->query('post_code'), $request->query('district_name'));
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function redxPickupStores(): JsonResponse
    {
        $svc    = new RedxService();
        $result = $svc->getPickupStores(auth()->id());
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function createRedxPickupStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'    => 'required|string|min:3|max:50',
            'phone'   => 'required|string|max:20',
            'address' => 'required|string|min:10|max:200',
            'area_id' => 'required|integer',
        ]);
        $svc    = new RedxService();
        $result = $svc->createPickupStore(auth()->id(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function redxCharge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'delivery_area_id' => 'required|integer',
            'pickup_area_id'   => 'required|integer',
            'cod_amount'       => 'required|numeric|min:0',
            'weight_kg'        => 'required|numeric|min:0.01',
        ]);
        $svc    = new RedxService();
        $result = $svc->calculateCharge(
            auth()->id(),
            $data['delivery_area_id'],
            $data['pickup_area_id'],
            (float) $data['cod_amount'],
            (float) $data['weight_kg'] * 1000
        );
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── CarryBee Location / Stores ───────────────────────────────────────────

    public function carrybeeCities(): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getCities(auth()->id());
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeZones(int $cityId): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getZones(auth()->id(), $cityId);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeAreas(int $cityId, int $zoneId): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getAreas(auth()->id(), $cityId, $zoneId);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeAreaSuggestion(Request $request): JsonResponse
    {
        $data = $request->validate(['search' => 'required|string|min:3']);
        $svc    = new CarrybeeService();
        $result = $svc->searchAreas(auth()->id(), $data['search']);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeStores(): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getStores(auth()->id());
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function createCarrybeeStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                             => 'required|string|min:3|max:30',
            'contact_person_name'               => 'required|string|min:3|max:30',
            'contact_person_number'             => 'required|string|max:20',
            'contact_person_secondary_number'   => 'nullable|string|max:20',
            'address'                           => 'required|string|min:3|max:100',
            'city_id'                            => 'required|integer',
            'zone_id'                            => 'required|integer',
            'area_id'                            => 'required|integer',
        ]);
        $svc    = new CarrybeeService();
        $result = $svc->createStore(auth()->id(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── Courier Settings ──────────────────────────────────────────────────────

    public function getSettings(): JsonResponse
    {
        $settings = CourierSetting::firstOrNew(['user_id' => auth()->id()]);

        return response()->json([
            'success' => true,
            'data'    => $settings->exists ? $settings->masked() : null,
        ]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'default_courier'     => 'nullable|in:steadfast,pathao,redx,carrybee,manual',
            'steadfast_api_key'   => 'nullable|string|max:200',
            'steadfast_secret_key'=> 'nullable|string|max:200',
            'pathao_client_id'    => 'nullable|string|max:200',
            'pathao_client_secret'=> 'nullable|string|max:200',
            'pathao_store_id'     => 'nullable|string|max:100',
            'pathao_username'     => 'nullable|email|max:200',
            'pathao_password'     => 'nullable|string|max:200',
            'redx_api_key'        => 'nullable|string|max:4000',
            'redx_environment'    => 'nullable|in:sandbox,production',
            'redx_pickup_store_id'=> 'nullable|integer',
            'redx_phone'          => 'nullable|string|max:20',
            'redx_password'       => 'nullable|string|max:200',
            'carrybee_phone'      => 'nullable|string|max:20',
            'carrybee_password'   => 'nullable|string|max:200',
            'carrybee_client_id'      => 'nullable|string|max:255',
            'carrybee_client_secret'  => 'nullable|string|max:255',
            'carrybee_client_context' => 'nullable|string|max:255',
            'carrybee_environment'    => 'nullable|in:sandbox,production',
            'carrybee_store_id'       => 'nullable|string|max:100',
            'paperfly_username'   => 'nullable|string|max:200',
            'paperfly_password'   => 'nullable|string|max:200',
        ]);

        // Only update keys that are actually sent (not masked placeholders)
        $existing = CourierSetting::firstOrNew(['user_id' => auth()->id()]);

        // These columns are NOT NULL in the DB; an empty selection must not blank them out
        $notNullable = ['default_courier', 'redx_environment', 'carrybee_environment'];

        foreach ($data as $field => $value) {
            // Skip masked values (contain ***)
            if ($value !== null && str_contains((string) $value, '***')) continue;
            if ($value === null && in_array($field, $notNullable, true)) continue;
            $existing->$field = $value;
        }
        $existing->user_id = auth()->id();
        $existing->save();

        return response()->json(['success' => true, 'data' => $existing->masked()]);
    }

    public function testConnection(Request $request): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result  = $service->getBalance($settings->steadfast_api_key, $settings->steadfast_secret_key);

        $ok = isset($result['status']) && $result['status'] == 200;
        return response()->json([
            'success' => $ok,
            'data'    => $result,
            'message' => $ok ? 'Connection successful.' : ($result['message'] ?? 'Connection failed.'),
        ]);
    }

    public function testSteadfastFraudCheck(Request $request): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        // Balance/booking access can be fine while fraud_check is gated separately
        // by Steadfast, so probe the endpoint itself with a throwaway BD number.
        $service = new SteadfastService();
        $result  = $service->fraudCheck($settings->steadfast_api_key, $settings->steadfast_secret_key, '01700000000');

        $ok = isset($result['total_delivered']) || isset($result['total_parcels']);
        return response()->json([
            'success' => $ok,
            'message' => $ok ? 'Fraud check access is active.' : ($result['message'] ?? 'Fraud check request failed.'),
        ]);
    }

    // ── Steadfast Utilities ───────────────────────────────────────────────────

    public function steadfastBalance(): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getBalance($settings->steadfast_api_key, $settings->steadfast_secret_key);

        return response()->json([
            'success' => isset($result['status']) ? (int) $result['status'] === 200 : ! empty($result),
            'data'    => $result,
        ]);
    }

    public function steadfastStatusByConsignment(string $id): JsonResponse
    {
        return $this->steadfastStatusLookup('consignment', $id);
    }

    public function steadfastStatusByInvoice(string $invoice): JsonResponse
    {
        return $this->steadfastStatusLookup('invoice', $invoice);
    }

    public function steadfastStatusByTracking(string $trackingCode): JsonResponse
    {
        return $this->steadfastStatusLookup('tracking', $trackingCode);
    }

    private function steadfastStatusLookup(string $type, string $value): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = match ($type) {
            'invoice'     => $service->getStatusByInvoice($settings->steadfast_api_key, $settings->steadfast_secret_key, $value),
            'tracking'    => $service->getStatusByTrackingCode($settings->steadfast_api_key, $settings->steadfast_secret_key, $value),
            default       => $service->getStatus($settings->steadfast_api_key, $settings->steadfast_secret_key, $value),
        };

        return response()->json([
            'success' => isset($result['status']) ? (int) $result['status'] === 200 : ! empty($result),
            'data'    => $result,
        ], isset($result['status']) && (int) $result['status'] !== 200 ? 422 : 200);
    }

    public function steadfastReturnRequests(): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getReturnRequests($settings->steadfast_api_key, $settings->steadfast_secret_key);

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function steadfastReturnRequest(int|string $id): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getReturnRequest($settings->steadfast_api_key, $settings->steadfast_secret_key, $id);

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function createSteadfastReturnRequest(Request $request): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $data = $request->validate([
            'consignment_id' => 'nullable|string|max:100',
            'invoice'        => 'nullable|string|max:100',
            'tracking_code'  => 'nullable|string|max:100',
            'reason'         => 'nullable|string|max:300',
        ]);

        if (empty($data['consignment_id']) && empty($data['invoice']) && empty($data['tracking_code'])) {
            return response()->json(['success' => false, 'message' => 'Provide consignment ID, invoice, or tracking code.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->createReturnRequest($settings->steadfast_api_key, $settings->steadfast_secret_key, $data);

        return response()->json([
            'success' => ! empty($result),
            'data'    => $result,
            'message' => $result['message'] ?? 'Return request submitted.',
        ], isset($result['status']) && (int) $result['status'] !== 200 ? 422 : 200);
    }

    public function steadfastPayments(): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getPayments($settings->steadfast_api_key, $settings->steadfast_secret_key);

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function steadfastPayment(int|string $paymentId): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getPayment($settings->steadfast_api_key, $settings->steadfast_secret_key, $paymentId);

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function steadfastPoliceStations(): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result = $service->getPoliceStations($settings->steadfast_api_key, $settings->steadfast_secret_key);

        return response()->json(['success' => true, 'data' => $result]);
    }

    public function testPathaoConnection(): JsonResponse
    {
        $svc = new PathaoService();
        if (! $svc->hasCredentials(auth()->id())) {
            return response()->json(['success' => false, 'message' => 'Pathao credentials not configured. Go to Settings → Courier.'], 422);
        }
        $token = $svc->getToken(auth()->id());
        if (! $token) {
            return response()->json(['success' => false, 'message' => 'Failed to get Pathao access token. Check your credentials.'], 422);
        }
        $stores = $svc->getStores(auth()->id());
        return response()->json([
            'success' => true,
            'message' => 'Pathao connection successful.',
            'data'    => ['store_count' => count($stores['data'] ?? [])],
        ]);
    }

    // ── Pathao Stores ──────────────────────────────────────────────────────────

    public function pathaoStores(): JsonResponse
    {
        $svc    = new PathaoService();
        $result = $svc->getStores(auth()->id());
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function createPathaoStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'             => 'required|string|min:3|max:50',
            'contact_name'     => 'required|string|min:3|max:50',
            'contact_number'   => 'required|string|size:11',
            'secondary_contact'=> 'nullable|string|size:11',
            'address'          => 'required|string|min:15|max:120',
            'city_id'          => 'required|integer',
            'zone_id'          => 'required|integer',
            'area_id'          => 'required|integer',
        ]);
        $svc    = new PathaoService();
        $result = $svc->createStore(auth()->id(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── Price Calculation ──────────────────────────────────────────────────────

    public function pathaoPrice(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_id'       => 'required|integer',
            'item_type'      => 'required|integer|in:1,2',
            'delivery_type'  => 'required|integer|in:48,12',
            'item_weight'    => 'required|numeric|min:0.5|max:10',
            'recipient_city' => 'required|integer',
            'recipient_zone' => 'required|integer',
        ]);
        $svc    = new PathaoService();
        $result = $svc->calculatePrice(auth()->id(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── Book Parcel ───────────────────────────────────────────────────────────

    public function book(Request $request, int $orderId): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($orderId);

        $data = $request->validate([
            'courier'       => 'nullable|in:steadfast,pathao,redx,carrybee,manual',
            'cod_amount'    => 'nullable|numeric|min:0',
            'note'          => 'nullable|string|max:300',
            'tracking_id'   => 'nullable|string|max:100', // for manual entry
            // Steadfast optional fields
            'delivery_type'       => 'nullable|integer|in:0,1,12,48',
            'item_description'    => 'nullable|string|max:250',
            'alternative_phone'   => 'nullable|string|max:20',
            'recipient_email'     => 'nullable|email|max:150',
            'total_lot'           => 'nullable|numeric|min:0',
            // Pathao-specific
            'store_id'             => 'nullable|integer',
            'item_type'            => 'nullable|integer|in:1,2',
            'item_weight'          => 'nullable|numeric|min:0.5|max:10',
            'special_instruction'  => 'nullable|string|max:300',
            // RedX-specific
            'delivery_area_id'     => 'nullable|integer',
            'delivery_area'        => 'nullable|string|max:100',
            'pickup_store_id'      => 'nullable|integer',
            'value'                => 'nullable|numeric|min:0',
            'parcel_weight_kg'     => 'nullable|numeric|min:0.01',
            // CarryBee-specific
            'carrybee_store_id'    => 'nullable|string|max:100',
            'delivery_city_id'     => 'nullable|integer',
            'delivery_zone_id'     => 'nullable|integer',
            'delivery_area_name'   => 'nullable|string|max:100',
        ]);

        $courier = $data['courier'] ?? 'steadfast';

        // Manual tracking entry
        if ($courier === 'manual' || isset($data['tracking_id'])) {
            $order->update([
                'courier_name'        => $courier,
                'courier_tracking_id' => $data['tracking_id'] ?? null,
                'courier_status'      => 'booked',
                'status'              => 'processing',
            ]);
            return response()->json(['success' => true, 'data' => $order, 'message' => 'Manual tracking saved.']);
        }

        if ($courier === 'steadfast') {
            return $this->bookSteadfast($order, $data);
        }

        if ($courier === 'pathao') {
            return $this->bookPathao($order, $data);
        }

        if ($courier === 'redx') {
            return $this->bookRedx($order, $data);
        }

        if ($courier === 'carrybee') {
            return $this->bookCarrybee($order, $data);
        }

        return response()->json(['success' => false, 'message' => 'Courier not supported yet.'], 422);
    }

    public function bookBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'courier'            => 'required|in:pathao,steadfast,redx',
            'order_ids'          => 'required|array|min:2|max:200',
            'order_ids.*'        => 'integer',
            'store_id'           => 'nullable|integer',
            'delivery_type'      => 'nullable|integer|in:48,12',
            'item_type'          => 'nullable|integer|in:1,2',
            'item_weight'        => 'nullable|numeric|min:0.5|max:10',
            'item_description'   => 'nullable|string|max:250',
            'special_instruction'=> 'nullable|string|max:300',
            'note'               => 'nullable|string|max:300',
            // RedX-specific
            'pickup_store_id'    => 'nullable|integer',
            'parcel_weight_kg'   => 'nullable|numeric|min:0.01',
            'delivery_area'      => 'nullable|string|max:100',
        ]);
        // CarryBee is intentionally excluded from bulk booking — like RedX's area
        // pick, it needs a per-order location search that the bulk UI doesn't
        // support yet.

        $orders = Order::where('user_id', auth()->id())
            ->whereIn('id', $data['order_ids'])
            ->whereIn('status', ['confirmed', 'processing'])
            ->whereNull('courier_tracking_id')
            ->get();

        if ($orders->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'No eligible orders found for bulk booking.'], 422);
        }

        if ($data['courier'] === 'steadfast') {
            return $this->bookSteadfastBulk($orders->all(), $data);
        }

        $results = [];
        $successCount = 0;
        $failedCount  = 0;

        foreach ($orders as $order) {
            $result = $data['courier'] === 'redx'
                ? $this->bookRedxAndPersist($order, $data)
                : $this->bookPathaoAndPersist($order, $data);
            $results[] = [
                'order_id'       => $order->id,
                'order_number'   => $order->order_number,
                'success'        => $result['success'],
                'consignment_id' => $result['consignment_id'] ?? null,
                'message'        => $result['message'] ?? null,
            ];

            if ($result['success']) {
                $successCount++;
            } else {
                $failedCount++;
            }
        }

        return response()->json([
            'success' => $successCount > 0,
            'message' => "Bulk booking completed. Success: {$successCount}, Failed: {$failedCount}",
            'data'    => [
                'total'    => $orders->count(),
                'success'  => $successCount,
                'failed'   => $failedCount,
                'results'  => $results,
            ],
        ], $successCount > 0 ? 200 : 422);
    }

    private function bookSteadfastBulk(array $orders, array $data): JsonResponse
    {
        $settings = $this->getSteadfastSettings();
        if (! $settings) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $items = array_map(function (Order $order) use ($data, $service) {
            $address = trim(implode(', ', array_filter([
                $order->customer_address,
                $order->customer_area,
                $order->customer_thana,
                $order->customer_district,
            ])));

            return $service->formatBulkItem([
                'invoice'           => $order->order_number,
                'recipient_name'    => $order->customer_name ?? $order->customer_phone,
                'recipient_phone'   => $order->customer_phone,
                'recipient_address' => $address !== '' ? $address : 'Address not provided',
                'cod_amount'        => $order->total,
                'note'              => $data['note'] ?? $order->notes ?? '',
                'item_description'  => $data['item_description'] ?? null,
                'delivery_type'     => isset($data['delivery_type']) ? (int) $data['delivery_type'] : null,
            ]);
        }, $orders);

        $result = $service->createBulkOrder($settings->steadfast_api_key, $settings->steadfast_secret_key, $items);

        $successCount = 0;
        $failedCount = 0;
        $results = [];

        $resultItems = $result['data'] ?? $result['result'] ?? $result;
        $resultItems = is_array($resultItems) ? array_values(array_filter($resultItems, fn ($item) => is_array($item))) : [];

        foreach ($orders as $index => $order) {
            $item = $resultItems[$index] ?? [];
            $consignmentId = $service->extractSteadfastConsignment($item);
            $message = $item['message'] ?? $item['status'] ?? null;
            $success = $consignmentId !== null || (isset($item['status']) && (string) $item['status'] === 'success');

            if ($success && $consignmentId !== null) {
                $order->update([
                    'courier_name'        => 'steadfast',
                    'courier_tracking_id' => $consignmentId,
                    'courier_status'      => 'booked',
                    'status'              => 'processing',
                ]);
                $successCount++;
            } else {
                $failedCount++;
            }

            $results[] = [
                'order_id'       => $order->id,
                'order_number'   => $order->order_number,
                'success'        => $success,
                'consignment_id' => $consignmentId,
                'message'        => $message,
            ];
        }

        return response()->json([
            'success' => $successCount > 0,
            'message' => "Bulk booking completed. Success: {$successCount}, Failed: {$failedCount}",
            'data'    => [
                'total'   => count($orders),
                'success' => $successCount,
                'failed'  => $failedCount,
                'results' => $results,
                'raw'     => $result,
            ],
        ], $successCount > 0 ? 200 : 422);
    }

    private function bookSteadfast(Order $order, array $data): JsonResponse
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->steadfast_api_key) {
            return response()->json(['success' => false, 'message' => 'Steadfast API credentials not configured. Go to Settings → Courier.'], 422);
        }

        $address = trim(implode(', ', array_filter([
            $order->customer_address,
            $order->customer_area,
            $order->customer_thana,
            $order->customer_district,
        ])));

        if ($address === '') {
            return response()->json(['success' => false, 'message' => 'Customer address is required for Steadfast booking.'], 422);
        }

        $service = new SteadfastService();
        $result  = $service->createOrder($settings->steadfast_api_key, $settings->steadfast_secret_key, [
            'invoice'           => $order->order_number,
            'recipient_name'    => $order->customer_name ?? $order->customer_phone,
            'recipient_phone'   => $order->customer_phone,
            'recipient_address' => $address,
            'cod_amount'        => $data['cod_amount'] ?? $order->total,
            'note'              => $data['note'] ?? $order->notes ?? '',
            'delivery_type'     => isset($data['delivery_type']) && in_array((int) $data['delivery_type'], [0, 1], true)
                ? (int) $data['delivery_type']
                : null,
            'item_description'  => $data['item_description'] ?? null,
            'alternative_phone' => $data['alternative_phone'] ?? null,
            'recipient_email'   => $data['recipient_email'] ?? null,
            'total_lot'         => $data['total_lot'] ?? null,
        ]);

        // Steadfast returns consignment_id on success
        $consignmentId = $service->extractSteadfastConsignment($result);
        if ($consignmentId) {
            $order->update([
                'courier_name'        => 'steadfast',
                'courier_tracking_id' => (string) $consignmentId,
                'courier_status'      => 'booked',
                'courier_charge'      => data_get($result, 'consignment.current_status') ?? null,
                'status'              => 'processing',
            ]);
            return response()->json(['success' => true, 'data' => $order, 'consignment_id' => $consignmentId]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? 'Steadfast booking failed.',
            'raw'     => $result,
        ], 422);
    }

    private function bookPathao(Order $order, array $data): JsonResponse
    {
        $result = $this->bookPathaoAndPersist($order, $data);

        if ($result['success']) {
            return response()->json([
                'success'        => true,
                'data'           => $order->fresh(),
                'consignment_id' => $result['consignment_id'],
                'delivery_fee'   => $result['delivery_fee'] ?? null,
                'message'        => $result['message'] ?? 'Pathao order booked.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? 'Pathao booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ], 422);
    }

    private function bookPathaoAndPersist(Order $order, array $data): array
    {
        $svc      = new PathaoService();
        $payload  = $this->buildPathaoPayload($order, $data);

        if (! $payload['success']) {
            return $payload;
        }

        $result = $svc->createOrder(auth()->id(), $payload['payload']);

        if ($result['success']) {
            $order->update([
                'courier_name'        => 'pathao',
                'courier_tracking_id' => $result['consignment_id'],
                'courier_status'      => strtolower($result['order_status'] ?? 'booked'),
                'courier_charge'      => $result['delivery_fee'] ?? null,
                'status'              => 'processing',
            ]);
            return $result;
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'Pathao booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    private function buildPathaoPayload(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();

        $storeId = $data['store_id'] ?? ($settings->pathao_store_id ?? null);
        if (! $storeId) {
            return ['success' => false, 'message' => 'Pathao store_id is required. Configure it in Settings → Courier.'];
        }

        $address = $order->customer_address ?? '';
        if ($order->customer_district) $address .= ', ' . $order->customer_district;
        if ($order->customer_thana)    $address .= ', ' . $order->customer_thana;
        if ($order->customer_area)     $address .= ', ' . $order->customer_area;
        $address = trim($address, ', ');

        if (strlen($address) < 10) {
            $address = ($address ?: ($order->customer_district ?? 'Bangladesh')) . ', Bangladesh';
        }

        $payload = [
            'store_id'             => (int) $storeId,
            'merchant_order_id'    => $order->order_number,
            'recipient_name'       => $order->customer_name ?? $order->customer_phone,
            'recipient_phone'      => $order->customer_phone,
            'recipient_address'    => substr($address, 0, 220),
            'delivery_type'        => $data['delivery_type'] ?? 48,
            'item_type'            => $data['item_type'] ?? 2,
            'item_quantity'        => 1,
            'item_weight'          => $data['item_weight'] ?? 0.5,
            'amount_to_collect'    => (int) ($data['cod_amount'] ?? $order->total),
        ];

        if ($order->pathao_city_id) $payload['recipient_city'] = $order->pathao_city_id;
        if ($order->pathao_zone_id) $payload['recipient_zone'] = $order->pathao_zone_id;
        if ($order->pathao_area_id) $payload['recipient_area'] = $order->pathao_area_id;

        if (! empty($data['special_instruction'])) $payload['special_instruction'] = $data['special_instruction'];
        if (! empty($data['item_description']))    $payload['item_description']    = $data['item_description'];
        if (! empty($data['note']))                $payload['special_instruction'] = $data['note'];

        return ['success' => true, 'payload' => $payload];
    }

    private function bookRedx(Order $order, array $data): JsonResponse
    {
        $result = $this->bookRedxAndPersist($order, $data);

        if ($result['success']) {
            return response()->json([
                'success'        => true,
                'data'           => $order->fresh(),
                'consignment_id' => $result['consignment_id'],
                'message'        => $result['message'] ?? 'RedX parcel booked.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? 'RedX booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ], 422);
    }

    private function bookRedxAndPersist(Order $order, array $data): array
    {
        $svc     = new RedxService();
        $payload = $this->buildRedxPayload($order, $data);

        if (! $payload['success']) {
            return $payload;
        }

        $result = $svc->createParcel(auth()->id(), $payload['payload']);

        if ($result['success']) {
            $order->update([
                'courier_name'        => 'redx',
                'courier_tracking_id' => $result['tracking_id'],
                'courier_status'      => 'booked',
                'status'              => 'processing',
            ]);
            return ['success' => true, 'consignment_id' => $result['tracking_id'], 'message' => 'RedX parcel booked.'];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'RedX booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    private function buildRedxPayload(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->redx_api_key) {
            return ['success' => false, 'message' => 'RedX API credentials not configured. Go to Settings → Courier.'];
        }

        $pickupStoreId = $data['pickup_store_id'] ?? $settings->redx_pickup_store_id ?? null;
        if (! $pickupStoreId) {
            return ['success' => false, 'message' => 'RedX pickup store is required. Configure a default in Settings → Courier or select one when booking.'];
        }

        $deliveryAreaId = $data['delivery_area_id'] ?? $order->redx_area_id ?? null;
        $deliveryAreaName = $data['delivery_area'] ?? null;
        if (! $deliveryAreaId || ! $deliveryAreaName) {
            return ['success' => false, 'message' => 'RedX delivery area is required. Search and select the customer\'s area when booking.'];
        }

        $address = trim(implode(', ', array_filter([
            $order->customer_address,
            $order->customer_area,
            $order->customer_thana,
            $order->customer_district,
        ])));

        if ($address === '') {
            return ['success' => false, 'message' => 'Customer address is required for RedX booking.'];
        }

        $codAmount = (float) ($data['cod_amount'] ?? $order->total);
        $value     = (float) ($data['value'] ?? $codAmount);
        $weightKg  = (float) ($data['parcel_weight_kg'] ?? 0.5);

        $payload = [
            'customer_name'          => $order->customer_name ?? $order->customer_phone,
            'customer_phone'         => $order->customer_phone,
            'delivery_area'          => $deliveryAreaName,
            'delivery_area_id'       => (int) $deliveryAreaId,
            'customer_address'       => substr($address, 0, 220),
            'merchant_invoice_id'    => $order->order_number,
            'cash_collection_amount' => $codAmount,
            'parcel_weight'          => (int) round($weightKg * 1000),
            'value'                  => $value,
            'pickup_store_id'        => (int) $pickupStoreId,
        ];

        $instruction = $data['note'] ?? $order->notes ?? '';
        if ($instruction !== '') {
            $payload['instruction'] = $instruction;
        }

        return ['success' => true, 'payload' => $payload];
    }

    private function bookCarrybee(Order $order, array $data): JsonResponse
    {
        $result = $this->bookCarrybeeAndPersist($order, $data);

        if ($result['success']) {
            return response()->json([
                'success'        => true,
                'data'           => $order->fresh(),
                'consignment_id' => $result['consignment_id'],
                'message'        => $result['message'] ?? 'CarryBee order booked.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? 'CarryBee booking failed.',
            'causes'  => $result['causes'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ], 422);
    }

    private function bookCarrybeeAndPersist(Order $order, array $data): array
    {
        $svc     = new CarrybeeService();
        $payload = $this->buildCarrybeePayload($order, $data);

        if (! $payload['success']) {
            return $payload;
        }

        $result = $svc->createOrder(auth()->id(), $payload['payload']);

        if ($result['success']) {
            $order->update([
                'courier_name'        => 'carrybee',
                'courier_tracking_id' => $result['data']['consignment_id'],
                'courier_status'      => 'booked',
                'courier_charge'      => $result['data']['delivery_fee'] ?? null,
                'status'              => 'processing',
            ]);
            return ['success' => true, 'consignment_id' => $result['data']['consignment_id'], 'message' => 'CarryBee order booked.'];
        }

        return [
            'success' => false,
            'message' => $result['message'] ?? 'CarryBee booking failed.',
            'causes'  => $result['causes'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ];
    }

    private function buildCarrybeePayload(Order $order, array $data): array
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->carrybee_client_id || ! $settings->carrybee_client_secret || ! $settings->carrybee_client_context) {
            return ['success' => false, 'message' => 'CarryBee API credentials not configured. Go to Settings → Courier.'];
        }

        $storeId = $data['carrybee_store_id'] ?? $settings->carrybee_store_id ?? null;
        if (! $storeId) {
            return ['success' => false, 'message' => 'CarryBee pickup store is required. Configure a default in Settings → Courier or select one when booking.'];
        }

        $cityId = $data['delivery_city_id'] ?? null;
        $zoneId = $data['delivery_zone_id'] ?? null;
        if (! $cityId || ! $zoneId) {
            return ['success' => false, 'message' => 'CarryBee delivery city/zone is required. Search and select the customer\'s area when booking.'];
        }

        $address = trim(implode(', ', array_filter([
            $order->customer_address,
            $order->customer_area,
            $order->customer_thana,
            $order->customer_district,
        ])));

        if (strlen($address) < 10) {
            return ['success' => false, 'message' => 'Customer address is too short for CarryBee booking (min 10 chars).'];
        }

        $weightKg = (float) ($data['parcel_weight_kg'] ?? 0.5);

        $payload = [
            'store_id'           => (string) $storeId,
            'merchant_order_id'  => $order->order_number,
            'delivery_type'      => 1, // Normal
            'product_type'       => 1, // Parcel
            'recipient_phone'    => $order->customer_phone,
            'recipient_name'     => $order->customer_name ?? $order->customer_phone,
            'recipient_address'  => substr($address, 0, 200),
            'city_id'            => (int) $cityId,
            'zone_id'            => (int) $zoneId,
            'item_weight'        => (int) round($weightKg * 1000),
            'collectable_amount' => (int) ($data['cod_amount'] ?? $order->total),
        ];

        if (! empty($data['delivery_area_id'])) $payload['area_id'] = (int) $data['delivery_area_id'];

        $instruction = $data['note'] ?? $order->notes ?? '';
        if ($instruction !== '') {
            $payload['special_instruction'] = substr($instruction, 0, 255);
        }

        return ['success' => true, 'payload' => $payload];
    }

    // ── Track ─────────────────────────────────────────────────────────────────

    public function trackOrder(int $orderId): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($orderId);

        if (! $order->courier_tracking_id) {
            return response()->json(['success' => false, 'message' => 'No tracking ID.'], 422);
        }
        if ($order->courier_name === 'pathao') {
            $svc    = new PathaoService();
            $result = $svc->getOrderInfo(auth()->id(), $order->courier_tracking_id);
            if ($result['success'] && isset($result['data']['order_status_slug'])) {
                $order->update(['courier_status' => $result['data']['order_status_slug']]);
            }
            return response()->json(['success' => true, 'data' => $result['data'] ?? [], 'order' => $order->fresh()]);
        }

        if ($order->courier_name === 'redx') {
            $svc    = new RedxService();
            $result = $svc->getParcelInfo(auth()->id(), (string) $order->courier_tracking_id);
            if ($result['success'] && isset($result['data']['status'])) {
                $order->update(['courier_status' => $result['data']['status']]);
            }
            return response()->json(['success' => true, 'data' => $result['data'] ?? [], 'order' => $order->fresh()]);
        }

        if ($order->courier_name === 'carrybee') {
            $svc    = new CarrybeeService();
            $result = $svc->getOrderDetails(auth()->id(), (string) $order->courier_tracking_id);
            if ($result['success'] && isset($result['data']['transfer_status'])) {
                $order->update(['courier_status' => $result['data']['transfer_status']]);
            }
            return response()->json(['success' => true, 'data' => $result['data'] ?? [], 'order' => $order->fresh()]);
        }

        if ($order->courier_name !== 'steadfast') {
            return response()->json(['success' => true, 'data' => ['status' => $order->courier_status], 'message' => 'Manual tracking.']);
        }

        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->steadfast_api_key) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $trackingId = (string) $order->courier_tracking_id;
        $result  = ctype_digit($trackingId)
            ? $service->getStatus($settings->steadfast_api_key, $settings->steadfast_secret_key, $trackingId)
            : $service->getStatusByTrackingCode($settings->steadfast_api_key, $settings->steadfast_secret_key, $trackingId);

        if (isset($result['delivery_status'])) {
            $order->update(['courier_status' => $result['delivery_status']]);
        }

        return response()->json(['success' => true, 'data' => $result, 'order' => $order]);
    }

    // ── Booked orders (with tracking) ─────────────────────────────────────────

    public function booked(Request $request): JsonResponse
    {
        $query = Order::where('user_id', auth()->id())
            ->whereNotNull('courier_tracking_id')
            ->orderByDesc('updated_at');

        if ($request->filled('courier_name')) {
            $query->where('courier_name', $request->courier_name);
        }
        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('order_number', 'ilike', $s)->orWhere('customer_phone', 'ilike', $s));
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $orders  = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $orders->items(),
            'meta'    => ['total' => $orders->total(), 'current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage()],
        ]);
    }

    // ── Ready to book (confirmed/processing, no tracking) ────────────────────

    public function readyToBook(Request $request): JsonResponse
    {
        $query = Order::where('user_id', auth()->id())
            ->whereIn('status', ['confirmed', 'processing'])
            ->whereNull('courier_tracking_id')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('order_number', 'ilike', $s)->orWhere('customer_phone', 'ilike', $s));
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $orders  = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data'    => $orders->items(),
            'meta'    => ['total' => $orders->total(), 'current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage()],
        ]);
    }
}
