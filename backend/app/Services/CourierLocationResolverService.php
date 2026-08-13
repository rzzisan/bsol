<?php

namespace App\Services;

use App\Models\Order;

/**
 * Best-effort address -> courier-location-ID resolver, for booking Pathao/
 * RedX/Carrybee on a WooCommerce-synced order (which only ever has one
 * free-text `customer_address` blob — see ConnectOrderController::sync()
 * — never the structured city/district/postcode fields a dashboard-created
 * order can carry). Each courier needs a different strategy; there is no
 * generic solution. "No match" always beats "wrong match" here — a
 * mis-resolved city sends a parcel to the wrong place — so every path
 * returns resolved:false rather than guessing under MIN_CONFIDENCE.
 *
 * Only used for pathao/redx/carrybee — steadfast/paperfly/manual work with
 * just customer_address already and never call this.
 */
class CourierLocationResolverService
{
    private const MIN_CONFIDENCE = 60;

    public function __construct(
        private readonly PathaoLocationService $pathaoLocations,
        private readonly RedxService $redx,
        private readonly CarrybeeService $carrybee,
    ) {}

    /**
     * @return array{resolved: bool, message: ?string, fields: array}
     */
    public function resolveForCourier(string $courier, Order $order): array
    {
        return match ($courier) {
            'pathao' => $this->resolvePathao($order),
            'redx' => $this->resolveRedx($order),
            'carrybee' => $this->resolveCarrybee($order),
            default => ['resolved' => false, 'message' => 'Location resolution not applicable for this courier.', 'fields' => []],
        };
    }

    private function resolvePathao(Order $order): array
    {
        if (! $this->pathaoLocations->hasCredentials($order->user_id)) {
            return $this->fail('Pathao is not configured — add your Pathao API credentials in Settings → Courier first.');
        }

        $address = (string) $order->customer_address;

        $cities = $this->pathaoLocations->getCities($order->user_id);
        $city = $this->bestMatch($address, $cities);
        if (! $city) {
            return $this->fail('Could not determine the delivery city from this order\'s address for Pathao.');
        }

        $zones = $this->pathaoLocations->getZones($city['id'], $order->user_id);
        $zone = $this->bestMatch($address, $zones);
        if (! $zone) {
            return $this->fail("Determined the city (\"{$city['name']}\") but could not determine the zone within it for Pathao.");
        }

        // Area is a precision enhancement, not required by the remote API —
        // matches PathaoCourierProvider's own `if ($order->pathao_area_id)`
        // optionality, so a miss here doesn't block booking.
        $areas = $this->pathaoLocations->getAreas($zone['id'], $order->user_id);
        $area = $this->bestMatch($address, $areas);

        $order->update([
            'pathao_city_id' => $city['id'],
            'pathao_zone_id' => $zone['id'],
            'pathao_area_id' => $area['id'] ?? null,
        ]);

        return ['resolved' => true, 'message' => null, 'fields' => []];
    }

    private function resolveRedx(Order $order): array
    {
        if (! $this->redx->hasCredentials($order->user_id)) {
            return $this->fail('RedX is not configured — add your RedX API key in Settings → Courier first.');
        }

        $address = (string) $order->customer_address;
        $postCode = $this->extractBdPostCode($address);
        $candidates = $this->addressFragments($address);

        $areas = [];
        foreach ($candidates as $districtGuess) {
            $result = $this->redx->getAreas($order->user_id, $postCode, $districtGuess);
            if (! empty($result['success']) && ! empty($result['data'])) {
                $areas = $result['data'];
                break;
            }
        }

        // Postcode alone (no district guess) as a last resort.
        if (empty($areas) && $postCode) {
            $result = $this->redx->getAreas($order->user_id, $postCode, null);
            if (! empty($result['success'])) {
                $areas = $result['data'] ?? [];
            }
        }

        $area = $this->bestMatch($address, $areas);
        if (! $area) {
            return $this->fail('Could not determine the delivery area from this order\'s address for RedX.');
        }

        $order->update(['redx_area_id' => $area['id']]);

        // RedxCourierProvider has no order-column fallback for the area
        // *name* (only the id) — must ride along in the booking request.
        return ['resolved' => true, 'message' => null, 'fields' => ['delivery_area' => $area['name']]];
    }

    private function resolveCarrybee(Order $order): array
    {
        if (! $this->carrybee->hasCredentials($order->user_id)) {
            return $this->fail('CarryBee is not configured — add your CarryBee credentials in Settings → Courier first.');
        }

        $address = (string) $order->customer_address;
        $result = $this->carrybee->searchAreas($order->user_id, $address);

        if (empty($result['success']) || empty($result['data'])) {
            return $this->fail('Could not determine the delivery area from this order\'s address for CarryBee.');
        }

        $item = $result['data'][0];
        // No test fixture pins CarryBee's exact response casing — defensive
        // key fallback until a real sandbox call confirms field names (see
        // SETUP.md).
        $cityId = $item['city_id'] ?? $item['cityId'] ?? null;
        $zoneId = $item['zone_id'] ?? $item['zoneId'] ?? null;
        $areaName = $item['area_name'] ?? $item['areaName'] ?? $item['name'] ?? null;

        if (! $cityId || ! $zoneId) {
            return $this->fail('CarryBee returned a location match without a usable city/zone id — booking blocked to avoid a misdirected parcel.');
        }

        // No carrybee_* columns exist on `orders` — always passed through
        // in the booking request, never persisted.
        return [
            'resolved' => true,
            'message' => null,
            'fields' => array_filter([
                'delivery_city_id' => $cityId,
                'delivery_zone_id' => $zoneId,
                'delivery_area_name' => $areaName,
            ]),
        ];
    }

    private function fail(string $message): array
    {
        return ['resolved' => false, 'message' => $message, 'fields' => []];
    }

    /**
     * Comma-separated fragments of the address, trimmed, longest-first —
     * a WooCommerce billing address is typically "street, area, city,
     * state, postcode", so later fragments are more likely to be a
     * district/city name worth trying as a RedX `district_name` guess.
     */
    private function addressFragments(string $address): array
    {
        $parts = array_map('trim', explode(',', $address));
        $parts = array_filter($parts, fn ($p) => $p !== '' && ! preg_match('/^\d+$/', $p));

        return array_reverse(array_values($parts));
    }

    private function extractBdPostCode(string $address): ?string
    {
        return preg_match('/\b(\d{4})\b/', $address, $m) ? $m[1] : null;
    }

    /**
     * A candidate name found verbatim inside the address is treated as a
     * confident hit (very common — "Mirpur DOHS, Dhaka" literally contains
     * "Dhaka"); otherwise similar_text() gives some tolerance for minor
     * typos/spacing differences. Nothing under MIN_CONFIDENCE is returned.
     */
    private function bestMatch(string $address, array $candidates, string $nameKey = 'name'): ?array
    {
        $addressNorm = $this->normalize($address);
        if ($addressNorm === '') {
            return null;
        }

        $best = null;
        $bestScore = 0.0;

        foreach ($candidates as $candidate) {
            $name = $candidate[$nameKey] ?? null;
            if (! $name) {
                continue;
            }
            $nameNorm = $this->normalize((string) $name);
            if ($nameNorm === '') {
                continue;
            }

            if (str_contains($addressNorm, $nameNorm)) {
                $score = 90 + min(10, mb_strlen($nameNorm) / 2);
            } else {
                similar_text($addressNorm, $nameNorm, $percent);
                $score = $percent;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $candidate;
            }
        }

        return $bestScore >= self::MIN_CONFIDENCE ? $best : null;
    }

    private function normalize(string $value): string
    {
        $value = mb_strtolower(trim($value));
        $value = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $value) ?? $value;

        return trim(preg_replace('/\s+/', ' ', $value) ?? $value);
    }
}
