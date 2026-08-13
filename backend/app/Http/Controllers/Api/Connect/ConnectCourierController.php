<?php

namespace App\Http\Controllers\Api\Connect;

use App\Http\Controllers\Controller;
use App\Http\Controllers\Api\CourierController;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Plugin-facing courier booking — /api/connect/v1/courier/*. Delegates to
 * the existing CourierController rather than duplicating provider dispatch
 * or the order courier_* column writeback. See
 * bsol_history_and_new_context.md §5.
 *
 * Restricted to steadfast/paperfly/manual: Pathao, RedX, and Carrybee all
 * require their own city/zone/area *IDs*, which a WooCommerce-synced order
 * has no way to supply (pathao_city_id/pathao_zone_id/pathao_area_id/
 * redx_area_id are always null on such orders) — sending them anyway would
 * surface as a cryptic remote 422 instead of a clean local error. A real
 * address->location-ID resolver for those three is a separate later phase.
 */
class ConnectCourierController extends Controller
{
    private const SUPPORTED_COURIERS = 'steadfast,paperfly,manual';

    public function __construct(
        private readonly CourierController $courierController,
    ) {}

    public function book(Request $request): JsonResponse
    {
        $data = $request->validate([
            'wc_order_id' => 'required|string|max:100',
            'courier'     => 'nullable|in:' . self::SUPPORTED_COURIERS,
            'tracking_id' => 'required_if:courier,manual|nullable|string|max:100',
            'cod_amount'  => 'nullable|numeric|min:0',
            'note'        => 'nullable|string|max:300',
        ], [
            'courier.in' => 'Pathao, RedX, and Carrybee need location data BSOL cannot derive from a WooCommerce order yet — use Steadfast, Paperfly, or manual tracking entry.',
        ]);

        $order = $this->findOrder($data['wc_order_id']);
        if (! $order) {
            return $this->orderNotFound();
        }

        $bookRequest = Request::create('/api/courier/book/' . $order->id, 'POST', collect($data)->except('wc_order_id')->all());

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

    private function findOrder(string $wcOrderId): ?Order
    {
        return Order::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('source', 'woocommerce')
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
