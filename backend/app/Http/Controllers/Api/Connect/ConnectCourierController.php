<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\CourierController;
use App\Models\Order;
use App\Services\CourierLocationResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Plugin-facing courier booking — /api/connect/v1/courier/*. Delegates to
 * the existing CourierController rather than duplicating provider dispatch
 * or the order courier_* column writeback. See
 * bsol_history_and_new_context.md §5.
 *
 * Pathao/RedX/Carrybee need their own city/zone/area *IDs*, which a
 * WooCommerce-synced order never carries directly (only one free-text
 * customer_address blob) — CourierLocationResolverService makes a
 * best-effort attempt to derive them before delegating. A confident
 * derivation isn't always possible; when it isn't, book() returns a clean
 * local error rather than letting the remote courier API fail cryptically.
 */
class ConnectCourierController extends Controller
{
    private const SUPPORTED_COURIERS = 'steadfast,paperfly,manual,pathao,redx,carrybee';
    private const LOCATION_RESOLVED_COURIERS = ['pathao', 'redx', 'carrybee'];

    public function __construct(
        private readonly CourierController $courierController,
        private readonly CourierLocationResolverService $locationResolver,
    ) {}

    public function book(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'courier'     => 'nullable|in:' . self::SUPPORTED_COURIERS,
            'tracking_id' => 'required_if:courier,manual|nullable|string|max:100',
            'cod_amount'  => 'nullable|numeric|min:0',
            'note'        => 'nullable|string|max:300',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        $courier = $data['courier'] ?? 'steadfast';
        $extraFields = [];

        if (in_array($courier, self::LOCATION_RESOLVED_COURIERS, true)) {
            $resolution = $this->locationResolver->resolveForCourier($courier, $order);
            if (! $resolution['resolved']) {
                return response()->json([
                    'success' => false,
                    'message' => $resolution['message'],
                    'error_code' => 'location_unresolved',
                ], 422);
            }
            $extraFields = $resolution['fields'];
        }

        $bookRequest = Request::create(
            '/api/courier/book/' . $order->id,
            'POST',
            array_merge(collect($data)->except('wc_order_id')->all(), $extraFields)
        );

        return $this->courierController->book($bookRequest, $order->id);
    }

    public function track(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        return $this->courierController->trackOrder($order->id);
    }

    public function cancel(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'reason'      => 'nullable|string|max:300',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        $cancelRequest = Request::create('/api/courier/cancel/' . $order->id, 'POST', collect($data)->except('wc_order_id')->all());

        return $this->courierController->cancelBooking($cancelRequest, $order->id);
    }

    /**
     * Only Steadfast exposes a balance check today — no fabricated balance
     * for providers that don't have one.
     */
    public function balance(): JsonResponse
    {
        return $this->courierController->steadfastBalance();
    }

    /**
     * Streams the same waybill/sticker-label PDF the dashboard generates —
     * 22 selectable templates, barcode/QR, real Bengali shaping, all
     * resolved automatically from the order's courier + the seller's saved
     * sticker settings. CourierController::waybill() already 404s if the
     * order hasn't been courier-booked yet (courier_tracking_id is null),
     * so no extra gate is needed here.
     */
    public function waybill(Request $request): Response
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'size'        => 'nullable|integer|in:58,80',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        $waybillRequest = Request::create('/api/courier/waybill/' . $order->id, 'GET', collect($data)->except('wc_order_id')->all());

        return $this->courierController->waybill($waybillRequest, $order->id);
    }

    private function findOrder(string $wcOrderId): ?Order
    {
        // Scoped by the specific connected site (platform_api_key_id), not
        // just the seller — see ConnectOrderController::sync() (Phase 16).
        return Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('source', 'woocommerce')
            ->where('platform_api_key_id', optional(request()->attributes->get('platform_api_key'))->id)
            ->where('source_ref', $wcOrderId)
            ->first();
    }

    private function orderNotFound(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'No synced order found for this wc_order_id.',
            'error_code' => 'order_not_found',
        ], 404);
    }
}
