<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class SteadfastService
{
    private const BASE = 'https://portal.packzy.com/api/v1';

    public function createOrder(string $apiKey, string $secretKey, array $data): array
    {
        $response = Http::withHeaders([
            'Api-Key'    => $apiKey,
            'Secret-Key' => $secretKey,
        ])->timeout(15)->post(self::BASE . '/create_order', [
            'invoice'           => $data['invoice'],
            'recipient_name'    => $data['recipient_name'],
            'recipient_phone'   => $this->formatPhone($data['recipient_phone']),
            'recipient_address' => $data['recipient_address'],
            'cod_amount'        => (float) $data['cod_amount'],
            'note'              => $data['note'] ?? '',
        ]);

        return $response->json() ?? ['status' => 0, 'message' => 'Invalid response'];
    }

    public function getStatus(string $apiKey, string $secretKey, string $consignmentId): array
    {
        $response = Http::withHeaders([
            'Api-Key'    => $apiKey,
            'Secret-Key' => $secretKey,
        ])->timeout(15)->get(self::BASE . '/status_by_cid/' . $consignmentId);

        return $response->json() ?? ['status' => 0, 'message' => 'Invalid response'];
    }

    public function getBalance(string $apiKey, string $secretKey): array
    {
        $response = Http::withHeaders([
            'Api-Key'    => $apiKey,
            'Secret-Key' => $secretKey,
        ])->timeout(15)->get(self::BASE . '/get_balance');

        return $response->json() ?? [];
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
