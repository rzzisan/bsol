<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\Courier\CourierFactory;
use App\Services\Courier\CourierStatusSyncService;
use App\Services\PathaoLocationService;
use App\Services\SteadfastService;
use App\Services\PathaoService;
use App\Services\RedxService;
use App\Services\CarrybeeService;
use App\Services\WaybillPdfService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CourierController extends Controller
{
    public function __construct(
        private readonly CourierStatusSyncService $courierStatusSyncService,
    ) {}

    private function getSteadfastSettings(): ?CourierSetting
    {
        $settings = CourierSetting::where('user_id', auth()->user()->shopOwnerId())->first();

        if (! $settings || ! $settings->steadfast_api_key) {
            return null;
        }

        return $settings;
    }

    /**
     * The authoritative COD amount for a booking. Defaults to the order's
     * real due balance (never the full total — a partially/manually-paid
     * order must not ask the courier to collect money already in hand, see
     * manual_payment_collection_context.md §3খ). Staff sub-accounts cannot
     * override this at all — whatever they submit is ignored — only the
     * shop owner may hand-set a different figure (e.g. a courier-specific
     * partial-COD arrangement).
     */
    private function resolveCodAmount(Order $order, ?float $submitted): float
    {
        $due = max(0, $order->dueAmount());

        if (auth()->user()->isStaff()) {
            return $due;
        }

        return $submitted ?? $due;
    }

    // ── Pathao Location Dropdowns ─────────────────────────────────────────────

    public function cities(): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $cities = $svc->getCities(auth()->user()->shopOwnerId());
        return response()->json(['success' => true, 'data' => $cities, 'has_credentials' => $svc->hasCredentials(auth()->user()->shopOwnerId())]);
    }

    public function zones(int $cityId): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $zones = $svc->getZones($cityId, auth()->user()->shopOwnerId());
        return response()->json(['success' => true, 'data' => $zones]);
    }

    public function areas(int $zoneId): JsonResponse
    {
        $svc   = new PathaoLocationService();
        $areas = $svc->getAreas($zoneId, auth()->user()->shopOwnerId());
        return response()->json(['success' => true, 'data' => $areas]);
    }

    // ── RedX Areas / Pickup Stores / Charge ─────────────────────────────────────

    public function redxAreas(Request $request): JsonResponse
    {
        $svc    = new RedxService();
        $result = $svc->getAreas(auth()->user()->shopOwnerId(), $request->query('post_code'), $request->query('district_name'));
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function redxPickupStores(): JsonResponse
    {
        $svc    = new RedxService();
        $result = $svc->getPickupStores(auth()->user()->shopOwnerId());
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
        $result = $svc->createPickupStore(auth()->user()->shopOwnerId(), $data);
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
            auth()->user()->shopOwnerId(),
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
        $result = $svc->getCities(auth()->user()->shopOwnerId());
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeZones(int $cityId): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getZones(auth()->user()->shopOwnerId(), $cityId);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeAreas(int $cityId, int $zoneId): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getAreas(auth()->user()->shopOwnerId(), $cityId, $zoneId);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeAreaSuggestion(Request $request): JsonResponse
    {
        $data = $request->validate(['search' => 'required|string|min:3']);
        $svc    = new CarrybeeService();
        $result = $svc->searchAreas(auth()->user()->shopOwnerId(), $data['search']);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    public function carrybeeStores(): JsonResponse
    {
        $svc    = new CarrybeeService();
        $result = $svc->getStores(auth()->user()->shopOwnerId());
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
        $result = $svc->createStore(auth()->user()->shopOwnerId(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── Courier Settings ──────────────────────────────────────────────────────

    public function getSettings(): JsonResponse
    {
        $settings = CourierSetting::firstOrNew(['user_id' => auth()->user()->shopOwnerId()]);

        return response()->json([
            'success' => true,
            'data'    => $settings->exists ? $settings->masked() : null,
        ]);
    }

    public function saveSettings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'default_courier'     => 'nullable|in:steadfast,pathao,redx,carrybee,paperfly,manual',
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
            'paperfly_api_key'    => 'nullable|string|max:255',
            'paperfly_store_name' => 'nullable|string|max:100',
        ]);

        // Only update keys that are actually sent (not masked placeholders)
        $existing = CourierSetting::firstOrNew(['user_id' => auth()->user()->shopOwnerId()]);

        // These columns are NOT NULL in the DB; an empty selection must not blank them out
        $notNullable = ['default_courier', 'redx_environment', 'carrybee_environment'];

        foreach ($data as $field => $value) {
            // Skip masked values (contain ***)
            if ($value !== null && str_contains((string) $value, '***')) continue;
            if ($value === null && in_array($field, $notNullable, true)) continue;
            $existing->$field = $value;
        }
        $existing->user_id = auth()->user()->shopOwnerId();
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
        if (! $svc->hasCredentials(auth()->user()->shopOwnerId())) {
            return response()->json(['success' => false, 'message' => 'Pathao credentials not configured. Go to Settings → Courier.'], 422);
        }
        $token = $svc->getToken(auth()->user()->shopOwnerId());
        if (! $token) {
            return response()->json(['success' => false, 'message' => 'Failed to get Pathao access token. Check your credentials.'], 422);
        }
        $stores = $svc->getStores(auth()->user()->shopOwnerId());
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
        $result = $svc->getStores(auth()->user()->shopOwnerId());
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
        $result = $svc->createStore(auth()->user()->shopOwnerId(), $data);
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
        $result = $svc->calculatePrice(auth()->user()->shopOwnerId(), $data);
        return response()->json($result, $result['success'] ? 200 : 422);
    }

    // ── Book Parcel ───────────────────────────────────────────────────────────

    public function book(Request $request, int $orderId): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($orderId);

        $data = $request->validate([
            'courier'       => 'nullable|in:steadfast,pathao,redx,carrybee,paperfly,manual',
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
            // Paperfly-specific
            'paperfly_store_name'  => 'nullable|string|max:100',
            'product_brief'        => 'nullable|string|max:200',
        ]);

        $courier = $data['courier'] ?? 'steadfast';

        // Resolved once, then injected back into $data so every provider's
        // own internal fallback (AbstractCourierProvider::resolveCodAmount())
        // sees the same, staff-safe value — see
        // manual_payment_collection_context.md §3খ.
        $codAmount = $this->resolveCodAmount($order, isset($data['cod_amount']) ? (float) $data['cod_amount'] : null);
        $data['cod_amount'] = $codAmount;

        // Manual tracking entry
        if ($courier === 'manual' || isset($data['tracking_id'])) {
            $order->update([
                'courier_name'        => $courier,
                'courier_tracking_id' => $data['tracking_id'] ?? null,
                'courier_status'      => 'booked',
                'status'              => 'processing',
                // The amount actually asked of the courier, not order->total
                // (may be a partial COD — see courier_waybill_context.md and
                // manual_payment_collection_context.md §3খ).
                'courier_cod_amount'  => $codAmount,
                'courier_booked_at'   => now(),
            ]);
            return response()->json(['success' => true, 'data' => $order, 'message' => 'Manual tracking saved.']);
        }

        $provider = CourierFactory::make($courier);
        if (! $provider) {
            return response()->json(['success' => false, 'message' => 'Courier not supported yet.'], 422);
        }

        $result = $provider->book($order, $data);

        if ($result['success']) {
            $update = [
                'courier_name'        => $courier,
                'courier_tracking_id' => $result['consignment_id'],
                'courier_status'      => $result['courier_status'] ?? 'booked',
                'status'              => 'processing',
                // Same reasoning as the manual branch above.
                'courier_cod_amount'  => $codAmount,
                'courier_weight_kg'   => $data['item_weight'] ?? $data['parcel_weight_kg'] ?? null,
                'courier_booked_at'   => now(),
            ];
            if (($result['delivery_fee'] ?? null) !== null) {
                $update['courier_charge'] = $result['delivery_fee'];
            }
            $order->update($update);

            return response()->json([
                'success'        => true,
                'data'           => $order->fresh(),
                'consignment_id' => $result['consignment_id'],
                'delivery_fee'   => $result['delivery_fee'] ?? null,
                'message'        => $result['message'] ?? ucfirst($courier) . ' order booked.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => $result['message'] ?? ucfirst($courier) . ' booking failed.',
            'errors'  => $result['errors'] ?? null,
            'raw'     => $result['raw'] ?? null,
        ], 422);
    }

    public function bookBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'courier'            => 'required|in:pathao,steadfast,redx,paperfly',
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
        // support yet. Paperfly needs no such per-order lookup (storeName comes
        // from the seller's default in Settings → Courier), so it's bulk-eligible.

        $orders = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->whereIn('id', $data['order_ids'])
            ->whereIn('status', ['confirmed', 'processing'])
            ->whereNull('courier_tracking_id')
            ->get();

        if ($orders->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'No eligible orders found for bulk booking.'], 422);
        }

        $provider = CourierFactory::make($data['courier']);
        if (! $provider) {
            return response()->json(['success' => false, 'message' => 'Courier not supported for bulk booking.'], 422);
        }

        $results = $provider->bookBulk($orders->all(), $data);

        // Persist the successfully-booked orders — bookBulk() only reports
        // the outcome, it doesn't touch the DB (unlike single book()).
        $ordersById = $orders->keyBy('id');
        foreach ($results as $row) {
            if (! $row['success'] || ! $row['consignment_id']) {
                continue;
            }
            $bulkOrder = $ordersById[$row['order_id']] ?? null;
            $update = [
                'courier_name'        => $data['courier'],
                'courier_tracking_id' => $row['consignment_id'],
                'courier_status'      => $row['courier_status'] ?? 'booked',
                'status'              => 'processing',
                // Was never persisted here before (manual_payment_collection_context.md
                // §3খ) — AccountingService::codIncomeAmount() would otherwise
                // fall back to the full order total on delivery.
                'courier_cod_amount'  => $bulkOrder ? max(0, $bulkOrder->dueAmount()) : null,
            ];
            if (($row['delivery_fee'] ?? null) !== null) {
                $update['courier_charge'] = $row['delivery_fee'];
            }
            $bulkOrder?->update($update);
        }

        $successCount = count(array_filter($results, fn ($r) => $r['success']));
        $failedCount  = count($results) - $successCount;

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

    // ── Track ─────────────────────────────────────────────────────────────────

    public function trackOrder(int $orderId): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($orderId);

        if (! $order->courier_tracking_id) {
            return response()->json(['success' => false, 'message' => 'No tracking ID.'], 422);
        }

        // sync() persists courier_status and — when the raw status maps to a
        // confident outcome — cascades it into order.status via
        // OrderStatusService::transition() (inventory, COD accounting,
        // payment_status, order_status_logs, the Meta OrderDelivered pixel
        // event). See CourierStatusSyncService's docblock.
        $result = $this->courierStatusSyncService->sync($order);

        return response()->json([
            'success' => $result['success'],
            'data'    => $result['raw'] ?? [],
            'order'   => $order->fresh(),
            'message' => $result['message'] ?? null,
        ], $result['success'] ? 200 : 422);
    }

    public function cancelBooking(Request $request, int $orderId): JsonResponse
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($orderId);

        if (! $order->courier_tracking_id) {
            return response()->json(['success' => false, 'message' => 'No courier booking to cancel.'], 422);
        }

        $data = $request->validate([
            'reason' => 'nullable|string|max:300',
        ]);

        $provider = CourierFactory::make($order->courier_name);
        if (! $provider) {
            return response()->json(['success' => false, 'message' => 'Manual/unsupported courier tracking cannot be cancelled via API.'], 422);
        }

        $result = $provider->cancel($order, $data['reason'] ?? '');

        if (! $result['success']) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? ucfirst($order->courier_name) . ' cancellation failed.',
                'raw'     => $result['raw'] ?? null,
            ], 422);
        }

        $order->update(['courier_status' => 'cancelled']);

        return response()->json([
            'success' => true,
            'data'    => $order->fresh(),
            'message' => $result['message'] ?? 'Courier booking cancelled.',
        ]);
    }

    // ── Booked orders (with tracking) ─────────────────────────────────────────

    public function booked(Request $request): JsonResponse
    {
        $query = Order::whereIn('user_id', auth()->user()->shopUserIds())
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
        $query = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->whereIn('status', ['confirmed', 'processing'])
            ->whereNull('courier_tracking_id')
            ->orderByDesc('created_at');

        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('order_number', 'ilike', $s)->orWhere('customer_phone', 'ilike', $s));
        }

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $orders  = $query->withPaymentTotals()->paginate($perPage);
        Order::attachDueAmounts($orders->getCollection());

        return response()->json([
            'success' => true,
            'data'    => $orders->items(),
            'meta'    => ['total' => $orders->total(), 'current_page' => $orders->currentPage(), 'last_page' => $orders->lastPage()],
        ]);
    }

    // ── Waybill / Label PDF ──────────────────────────────────────────────────

    public function waybill(Request $request, int $orderId): Response
    {
        $order = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->whereNotNull('courier_tracking_id')
            ->findOrFail($orderId);

        $widthMm = (int) $request->query('size', 80);
        $pdf = app(WaybillPdfService::class)->render([$order], $widthMm);

        return $pdf->stream("waybill-{$order->order_number}.pdf")
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }

    public function waybillBulk(Request $request): Response
    {
        $data = $request->validate([
            'order_ids'   => 'required|array|min:1|max:200',
            'order_ids.*' => 'integer',
            'size'        => 'nullable|integer|in:58,80',
        ]);

        $orders = Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->whereIn('id', $data['order_ids'])
            ->whereNotNull('courier_tracking_id')
            ->orderByDesc('updated_at')
            ->get();

        abort_if($orders->isEmpty(), 422, 'No booked orders found for the selected IDs.');

        $pdf = app(WaybillPdfService::class)->render($orders, (int) ($data['size'] ?? 80));

        return $pdf->stream('waybills.pdf')
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
