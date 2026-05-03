<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\PathaoLocationService;
use App\Services\SteadfastService;
use App\Services\PathaoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
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
            'default_courier'     => 'nullable|in:steadfast,pathao,redx,manual',
            'steadfast_api_key'   => 'nullable|string|max:200',
            'steadfast_secret_key'=> 'nullable|string|max:200',
            'pathao_client_id'    => 'nullable|string|max:200',
            'pathao_client_secret'=> 'nullable|string|max:200',
            'pathao_store_id'     => 'nullable|string|max:100',
            'pathao_username'     => 'nullable|email|max:200',
            'pathao_password'     => 'nullable|string|max:200',
            'redx_api_key'        => 'nullable|string|max:200',
        ]);

        // Only update keys that are actually sent (not masked placeholders)
        $existing = CourierSetting::firstOrNew(['user_id' => auth()->id()]);

        foreach ($data as $field => $value) {
            // Skip masked values (contain ***)
            if ($value !== null && str_contains((string) $value, '***')) continue;
            $existing->$field = $value;
        }
        $existing->user_id = auth()->id();
        $existing->save();

        return response()->json(['success' => true, 'data' => $existing->masked()]);
    }

    public function testConnection(Request $request): JsonResponse
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->steadfast_api_key) {
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
            'courier'       => 'nullable|in:steadfast,pathao,redx,manual',
            'cod_amount'    => 'nullable|numeric|min:0',
            'note'          => 'nullable|string|max:300',
            'tracking_id'   => 'nullable|string|max:100', // for manual entry
            // Pathao-specific
            'store_id'             => 'nullable|integer',
            'delivery_type'        => 'nullable|integer|in:48,12',
            'item_type'            => 'nullable|integer|in:1,2',
            'item_weight'          => 'nullable|numeric|min:0.5|max:10',
            'item_description'     => 'nullable|string|max:250',
            'special_instruction'  => 'nullable|string|max:300',
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

        return response()->json(['success' => false, 'message' => 'Courier not supported yet.'], 422);
    }

    public function bookBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'courier'            => 'required|in:pathao',
            'order_ids'          => 'required|array|min:2|max:200',
            'order_ids.*'        => 'integer',
            'store_id'           => 'nullable|integer',
            'delivery_type'      => 'nullable|integer|in:48,12',
            'item_type'          => 'nullable|integer|in:1,2',
            'item_weight'        => 'nullable|numeric|min:0.5|max:10',
            'item_description'   => 'nullable|string|max:250',
            'special_instruction'=> 'nullable|string|max:300',
            'note'               => 'nullable|string|max:300',
        ]);

        $orders = Order::where('user_id', auth()->id())
            ->whereIn('id', $data['order_ids'])
            ->whereIn('status', ['confirmed', 'processing'])
            ->whereNull('courier_tracking_id')
            ->get();

        if ($orders->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'No eligible orders found for bulk booking.'], 422);
        }

        $results = [];
        $successCount = 0;
        $failedCount  = 0;

        foreach ($orders as $order) {
            $result = $this->bookPathaoAndPersist($order, $data);
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

    private function bookSteadfast(Order $order, array $data): JsonResponse
    {
        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->steadfast_api_key) {
            return response()->json(['success' => false, 'message' => 'Steadfast API credentials not configured. Go to Settings → Courier.'], 422);
        }

        $service = new SteadfastService();
        $result  = $service->createOrder($settings->steadfast_api_key, $settings->steadfast_secret_key, [
            'invoice'           => $order->order_number,
            'recipient_name'    => $order->customer_name ?? $order->customer_phone,
            'recipient_phone'   => $order->customer_phone,
            'recipient_address' => $order->customer_address ?? ($order->customer_district . ', ' . $order->customer_thana),
            'cod_amount'        => $data['cod_amount'] ?? $order->total,
            'note'              => $data['note'] ?? $order->notes ?? '',
        ]);

        // Steadfast returns consignment_id on success
        if (isset($result['consignment']['consignment_id'])) {
            $consignmentId = $result['consignment']['consignment_id'];
            $order->update([
                'courier_name'        => 'steadfast',
                'courier_tracking_id' => (string) $consignmentId,
                'courier_status'      => 'booked',
                'courier_charge'      => $result['consignment']['current_status'] ?? null,
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

        if ($order->courier_name !== 'steadfast') {
            return response()->json(['success' => true, 'data' => ['status' => $order->courier_status], 'message' => 'Manual tracking.']);
        }

        $settings = CourierSetting::where('user_id', auth()->id())->first();
        if (! $settings || ! $settings->steadfast_api_key) {
            return response()->json(['success' => false, 'message' => 'Steadfast credentials not configured.'], 422);
        }

        $service = new SteadfastService();
        $result  = $service->getStatus($settings->steadfast_api_key, $settings->steadfast_secret_key, $order->courier_tracking_id);

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
