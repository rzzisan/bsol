<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SteadfastService
{
    private const BASE = 'https://portal.packzy.com/api/v1';

    private function client(string $apiKey, string $secretKey)
    {
        return Http::withHeaders([
            'Api-Key'    => $apiKey,
            'Secret-Key' => $secretKey,
            'Content-Type' => 'application/json',
        ])->timeout(20);
    }

    private function jsonResponse($response, array $fallback = []): array
    {
        return $response->json() ?? ($fallback ?: ['status' => 0, 'message' => 'Invalid response']);
    }

    public function createOrder(string $apiKey, string $secretKey, array $data): array
    {
        $response = $this->client($apiKey, $secretKey)->post(self::BASE . '/create_order', [
            'invoice'           => $data['invoice'],
            'recipient_name'    => $data['recipient_name'],
            'recipient_phone'   => $this->formatPhone($data['recipient_phone']),
            'recipient_address' => $data['recipient_address'],
            'cod_amount'        => (float) $data['cod_amount'],
            'note'              => $data['note'] ?? '',
        ]);

        return $this->jsonResponse($response);
    }

    public function createBulkOrder(string $apiKey, string $secretKey, array $items): array
    {
        $response = $this->client($apiKey, $secretKey)->post(self::BASE . '/create_order/bulk-order', [
            'data' => json_encode(array_values($items)),
        ]);

        return $this->jsonResponse($response);
    }

    public function getStatus(string $apiKey, string $secretKey, string $consignmentId): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/status_by_cid/' . urlencode($consignmentId));

        return $this->jsonResponse($response);
    }

    public function getStatusByInvoice(string $apiKey, string $secretKey, string $invoice): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/status_by_invoice/' . urlencode($invoice));

        return $this->jsonResponse($response);
    }

    public function getStatusByTrackingCode(string $apiKey, string $secretKey, string $trackingCode): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/status_by_trackingcode/' . urlencode($trackingCode));

        return $this->jsonResponse($response);
    }

    public function getBalance(string $apiKey, string $secretKey): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/get_balance');

        return $this->jsonResponse($response, []);
    }

    public function createReturnRequest(string $apiKey, string $secretKey, array $data): array
    {
        $payload = ['reason' => $data['reason'] ?? null];

        if (! empty($data['consignment_id'])) {
            $payload['consignment_id'] = $data['consignment_id'];
        } elseif (! empty($data['invoice'])) {
            $payload['invoice'] = $data['invoice'];
        } elseif (! empty($data['tracking_code'])) {
            $payload['tracking_code'] = $data['tracking_code'];
        }

        $payload = array_filter($payload, fn ($v) => $v !== null && $v !== '');

        $response = $this->client($apiKey, $secretKey)->post(self::BASE . '/create_return_request', $payload);

        return $this->jsonResponse($response);
    }

    public function getReturnRequest(string $apiKey, string $secretKey, int|string $id): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/get_return_request/' . urlencode((string) $id));

        return $this->jsonResponse($response);
    }

    public function getReturnRequests(string $apiKey, string $secretKey): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/get_return_requests');

        return $this->jsonResponse($response, []);
    }

    public function getPayments(string $apiKey, string $secretKey): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/payments');

        return $this->jsonResponse($response, []);
    }

    public function getPayment(string $apiKey, string $secretKey, int|string $paymentId): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/payments/' . urlencode((string) $paymentId));

        return $this->jsonResponse($response, []);
    }

    public function getPoliceStations(string $apiKey, string $secretKey): array
    {
        $response = $this->client($apiKey, $secretKey)->get(self::BASE . '/police_stations');

        return $this->jsonResponse($response, []);
    }

    public function extractSteadfastTracking(array $result): ?string
    {
        return $result['tracking_code']
            ?? $result['trackingCode']
            ?? data_get($result, 'consignment.tracking_code')
            ?? data_get($result, 'data.tracking_code')
            ?? null;
    }

    public function extractSteadfastConsignment(array $result): ?string
    {
        $id = $result['consignment_id']
            ?? data_get($result, 'consignment.consignment_id')
            ?? data_get($result, 'data.consignment.consignment_id')
            ?? data_get($result, 'data.consignment_id')
            ?? null;

        return $id !== null ? (string) $id : null;
    }

    public function formatBulkItem(array $data): array
    {
        return [
            'invoice'           => $data['invoice'],
            'recipient_name'    => Str::limit((string) $data['recipient_name'], 100, ''),
            'recipient_phone'   => $this->formatPhone((string) $data['recipient_phone']),
            'recipient_address' => $data['recipient_address'],
            'cod_amount'        => (float) $data['cod_amount'],
            'note'              => $data['note'] ?? '',
        ];

    }

    private function formatPhone(string $phone): string
    {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        if (strlen($phone) > 11) {
            $phone = substr($phone, -11);
        }
        return $phone;
    }
}
