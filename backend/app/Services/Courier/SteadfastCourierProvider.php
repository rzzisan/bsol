<?php

namespace App\Services\Courier;

use App\Models\CourierSetting;
use App\Models\Order;
use App\Services\SteadfastService;

class SteadfastCourierProvider extends AbstractCourierProvider
{
    private function service(): SteadfastService
    {
        return new SteadfastService();
    }

    private function settings(int $userId): ?CourierSetting
    {
        $settings = CourierSetting::where('user_id', $userId)->first();

        return ($settings && $settings->steadfast_api_key) ? $settings : null;
    }

    public function book(Order $order, array $data): array
    {
        $settings = $this->settings($order->user_id);
        if (! $settings) {
            return ['success' => false, 'message' => 'Steadfast API credentials not configured. Go to Settings → Courier.'];
        }

        $address = $this->customerAddress($order);
        if ($address === '') {
            return ['success' => false, 'message' => 'Customer address is required for Steadfast booking.'];
        }

        $result = $this->service()->createOrder($settings->steadfast_api_key, $settings->steadfast_secret_key, [
            'invoice'           => $order->order_number,
            'recipient_name'    => $order->customer_name ?? $order->customer_phone,
            'recipient_phone'   => $order->customer_phone,
            'recipient_address' => $address,
            'cod_amount'        => $this->resolveCodAmount($order, $data),
            'note'              => $data['note'] ?? $order->notes ?? '',
            'delivery_type'     => isset($data['delivery_type']) && in_array((int) $data['delivery_type'], [0, 1], true)
                ? (int) $data['delivery_type']
                : null,
            'item_description'  => $data['item_description'] ?? null,
            'alternative_phone' => $data['alternative_phone'] ?? null,
            'recipient_email'   => $data['recipient_email'] ?? null,
            'total_lot'         => $data['total_lot'] ?? null,
        ]);

        $consignmentId = $this->service()->extractSteadfastConsignment($result);
        if ($consignmentId) {
            return [
                'success'        => true,
                'consignment_id' => (string) $consignmentId,
                // Steadfast's create_order response doesn't return a delivery
                // fee (unlike Pathao/Carrybee) — leave 'delivery_fee' unset
                // until a real fee source (balance/payments API) is wired in,
                // rather than writing a non-numeric value into that column.
                'message'        => 'Steadfast order booked.',
            ];
        }

        return ['success' => false, 'message' => $result['message'] ?? 'Steadfast booking failed.', 'raw' => $result];
    }

    public function bookBulk(array $orders, array $data): array
    {
        $settings = $this->settings($orders[0]->user_id ?? 0);
        if (! $settings) {
            return array_map(fn (Order $order) => [
                'order_id' => $order->id, 'order_number' => $order->order_number,
                'success' => false, 'consignment_id' => null,
                'message' => 'Steadfast credentials not configured.',
            ], $orders);
        }

        $service = $this->service();
        $items = array_map(function (Order $order) use ($data, $service) {
            $address = $this->customerAddress($order);

            return $service->formatBulkItem([
                'invoice'           => $order->order_number,
                'recipient_name'    => $order->customer_name ?? $order->customer_phone,
                'recipient_phone'   => $order->customer_phone,
                'recipient_address' => $address !== '' ? $address : 'Address not provided',
                'cod_amount'        => max(0, $order->dueAmount()),
                'note'              => $data['note'] ?? $order->notes ?? '',
                'item_description'  => $data['item_description'] ?? null,
                'delivery_type'     => isset($data['delivery_type']) ? (int) $data['delivery_type'] : null,
            ]);
        }, $orders);

        $result = $service->createBulkOrder($settings->steadfast_api_key, $settings->steadfast_secret_key, $items);

        $resultItems = $result['data'] ?? $result['result'] ?? $result;
        $resultItems = is_array($resultItems) ? array_values(array_filter($resultItems, fn ($item) => is_array($item))) : [];

        // Correlate by invoice (= order_number, which we send in each bulk
        // item) instead of array position — a purely positional match would
        // silently mis-assign tracking IDs to the wrong order if Steadfast's
        // bulk response ever reorders or drops an item.
        // (SAAS_MODULE_CONTEXT.md §17.3/§17.9.)
        $byInvoice = [];
        foreach ($resultItems as $item) {
            if (! empty($item['invoice'])) {
                $byInvoice[(string) $item['invoice']] = $item;
            }
        }

        $rows = [];
        foreach ($orders as $index => $order) {
            $item = $byInvoice[$order->order_number] ?? null;
            if ($item === null && ! empty($resultItems)) {
                // Response didn't echo a matching invoice — fall back to
                // positional match but flag it, since that's the risky path.
                $item = $resultItems[$index] ?? [];
                \Illuminate\Support\Facades\Log::warning('Steadfast bulk booking: invoice not found in response, used positional fallback match', [
                    'order_id'     => $order->id,
                    'order_number' => $order->order_number,
                ]);
            }
            $item ??= [];
            $consignmentId = $service->extractSteadfastConsignment($item);
            $message = $item['message'] ?? $item['status'] ?? null;
            $success = $consignmentId !== null || (isset($item['status']) && (string) $item['status'] === 'success');

            $rows[] = [
                'order_id'       => $order->id,
                'order_number'   => $order->order_number,
                'success'        => $success,
                'consignment_id' => $consignmentId,
                'message'        => $message,
            ];
        }

        return $rows;
    }

    public function track(Order $order): array
    {
        $settings = $this->settings($order->user_id);
        if (! $settings) {
            return ['success' => false, 'message' => 'Steadfast credentials not configured.', 'raw' => []];
        }

        $trackingId = (string) $order->courier_tracking_id;
        $result = ctype_digit($trackingId)
            ? $this->service()->getStatus($settings->steadfast_api_key, $settings->steadfast_secret_key, $trackingId)
            : $this->service()->getStatusByTrackingCode($settings->steadfast_api_key, $settings->steadfast_secret_key, $trackingId);

        return [
            'success' => true,
            'status'  => $result['delivery_status'] ?? null,
            'raw'     => $result,
        ];
    }
}
