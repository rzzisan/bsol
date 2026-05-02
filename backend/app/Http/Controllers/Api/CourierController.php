<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\SteadfastService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
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

    // ── Book Parcel ───────────────────────────────────────────────────────────

    public function book(Request $request, int $orderId): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($orderId);

        $data = $request->validate([
            'courier'       => 'nullable|in:steadfast,pathao,redx,manual',
            'cod_amount'    => 'nullable|numeric|min:0',
            'note'          => 'nullable|string|max:300',
            'tracking_id'   => 'nullable|string|max:100', // for manual entry
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

        return response()->json(['success' => false, 'message' => 'Courier not supported yet.'], 422);
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

    // ── Track ─────────────────────────────────────────────────────────────────

    public function trackOrder(int $orderId): JsonResponse
    {
        $order = Order::where('user_id', auth()->id())->findOrFail($orderId);

        if (! $order->courier_tracking_id) {
            return response()->json(['success' => false, 'message' => 'No tracking ID.'], 422);
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
