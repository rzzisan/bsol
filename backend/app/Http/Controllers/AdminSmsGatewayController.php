<?php

namespace App\Http\Controllers;

use App\Models\SmsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class AdminSmsGatewayController extends Controller
{
    public function index(): JsonResponse
    {
        $this->ensureDefaultKhudebartaGateway();

        $gateways = SmsGateway::query()
            ->orderByDesc('is_active')
            ->orderBy('id')
            ->get()
            ->map(fn (SmsGateway $gateway) => $this->transformGateway($gateway));

        return response()->json([
            'gateways' => $gateways,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'provider' => ['required', 'string', Rule::in(['khudebarta'])],
            'endpoint_url' => ['nullable', 'url', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'secret_key' => ['nullable', 'string', 'max:1000'],
            'sender_id' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'is_enabled' => ['sometimes', 'boolean'],
        ]);

        $gateway = SmsGateway::create([
            'name' => $validated['name'],
            'provider' => $validated['provider'],
            'endpoint_url' => $validated['endpoint_url'] ?? null,
            'api_key' => $validated['api_key'] ?? null,
            'secret_key' => $validated['secret_key'] ?? null,
            'sender_id' => $validated['sender_id'] ?? null,
            'is_active' => (bool) ($validated['is_active'] ?? false),
            'is_enabled' => (bool) ($validated['is_enabled'] ?? true),
        ]);

        if ($gateway->is_active) {
            SmsGateway::where('id', '!=', $gateway->id)->update(['is_active' => false]);
        }

        return response()->json([
            'message' => 'SMS gateway created successfully.',
            'gateway' => $this->transformGateway($gateway->fresh()),
        ], 201);
    }

    public function update(Request $request, SmsGateway $smsGateway): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:120'],
            'provider' => ['sometimes', 'required', 'string', Rule::in(['khudebarta'])],
            'endpoint_url' => ['nullable', 'url', 'max:255'],
            'api_key' => ['nullable', 'string', 'max:1000'],
            'secret_key' => ['nullable', 'string', 'max:1000'],
            'sender_id' => ['nullable', 'string', 'max:120'],
            'is_active' => ['sometimes', 'boolean'],
            'is_enabled' => ['sometimes', 'boolean'],
        ]);

        $payload = [];

        foreach (['name', 'provider', 'endpoint_url', 'sender_id', 'is_active', 'is_enabled'] as $field) {
            if (array_key_exists($field, $validated)) {
                $payload[$field] = $validated[$field];
            }
        }

        if (array_key_exists('api_key', $validated) && filled($validated['api_key'])) {
            $payload['api_key'] = $validated['api_key'];
        }

        if (array_key_exists('secret_key', $validated) && filled($validated['secret_key'])) {
            $payload['secret_key'] = $validated['secret_key'];
        }

        $smsGateway->update($payload);

        if (($payload['is_active'] ?? false) === true) {
            SmsGateway::where('id', '!=', $smsGateway->id)->update(['is_active' => false]);
        }

        return response()->json([
            'message' => 'SMS gateway updated successfully.',
            'gateway' => $this->transformGateway($smsGateway->fresh()),
        ]);
    }

    public function destroy(SmsGateway $smsGateway): JsonResponse
    {
        if (SmsGateway::count() === 1) {
            return response()->json([
                'message' => 'At least one gateway is required.',
            ], 422);
        }

        $wasActive = $smsGateway->is_active;
        $smsGateway->delete();

        if ($wasActive) {
            $fallback = SmsGateway::query()->orderBy('id')->first();
            if ($fallback) {
                $fallback->update(['is_active' => true]);
            }
        }

        return response()->json([
            'message' => 'SMS gateway deleted successfully.',
        ]);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
            'phone_number' => ['required', 'string', 'max:30'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $gateway = isset($validated['gateway_id'])
            ? SmsGateway::find($validated['gateway_id'])
            : SmsGateway::where('is_active', true)->first();

        if (! $gateway) {
            return response()->json([
                'message' => 'No SMS gateway selected or active gateway found.',
            ], 422);
        }

        if (! $gateway->is_enabled) {
            return response()->json([
                'message' => 'Selected SMS gateway is disabled.',
            ], 422);
        }

        $phone = $this->formatBdPhoneNumber($validated['phone_number']);

        if (! $phone) {
            return response()->json([
                'message' => 'Invalid phone number format. Use a valid BD mobile number.',
            ], 422);
        }

        if (
            blank($gateway->endpoint_url)
            || blank($gateway->api_key)
            || blank($gateway->secret_key)
            || blank($gateway->sender_id)
        ) {
            return response()->json([
                'message' => 'Gateway credentials are incomplete. Please update endpoint/API key/secret/sender ID.',
            ], 422);
        }

        if ($gateway->provider !== 'khudebarta') {
            return response()->json([
                'message' => 'Selected gateway provider is not supported yet.',
            ], 422);
        }

        $response = Http::asForm()
            ->timeout(20)
            ->post($gateway->endpoint_url, [
                'apikey' => $gateway->api_key,
                'secretkey' => $gateway->secret_key,
                'callerID' => $gateway->sender_id,
                'toUser' => $phone,
                'messageContent' => $validated['message'],
            ]);

        $body = (string) $response->body();
        $looksFailed = preg_match('/(error|failed|invalid|unauthorized)/i', $body) === 1;
        $ok = $response->successful() && ! $looksFailed;

        if (! $ok) {
            return response()->json([
                'message' => 'Failed to send SMS through gateway.',
                'gateway' => $gateway->name,
                'provider' => $gateway->provider,
                'status_code' => $response->status(),
                'response_body' => mb_substr($body, 0, 1000),
            ], 502);
        }

        return response()->json([
            'message' => 'SMS sent successfully.',
            'gateway' => $gateway->name,
            'provider' => $gateway->provider,
            'phone_number' => $phone,
            'status_code' => $response->status(),
            'response_body' => mb_substr($body, 0, 1000),
        ]);
    }

    private function ensureDefaultKhudebartaGateway(): void
    {
        if (SmsGateway::query()->exists()) {
            return;
        }

        SmsGateway::create([
            'name' => 'Khudebarta',
            'provider' => 'khudebarta',
            'endpoint_url' => null,
            'api_key' => null,
            'secret_key' => null,
            'sender_id' => null,
            'is_active' => true,
            'is_enabled' => true,
        ]);
    }

    private function transformGateway(SmsGateway $gateway): array
    {
        return [
            'id' => $gateway->id,
            'name' => $gateway->name,
            'provider' => $gateway->provider,
            'endpoint_url' => $gateway->endpoint_url,
            'sender_id' => $gateway->sender_id,
            'is_active' => $gateway->is_active,
            'is_enabled' => $gateway->is_enabled,
            'has_api_key' => filled($gateway->api_key),
            'has_secret_key' => filled($gateway->secret_key),
            'api_key_masked' => $this->maskSecret($gateway->api_key),
            'secret_key_masked' => $this->maskSecret($gateway->secret_key),
            'updated_at' => optional($gateway->updated_at)?->toIso8601String(),
            'created_at' => optional($gateway->created_at)?->toIso8601String(),
        ];
    }

    private function maskSecret(?string $value): ?string
    {
        if (blank($value)) {
            return null;
        }

        $trimmed = trim($value);
        $length = mb_strlen($trimmed);

        if ($length <= 6) {
            return str_repeat('*', $length);
        }

        $prefix = mb_substr($trimmed, 0, 3);
        $suffix = mb_substr($trimmed, -2);

        return $prefix . str_repeat('*', max(2, $length - 5)) . $suffix;
    }

    private function formatBdPhoneNumber(string $phone): ?string
    {
        $number = preg_replace('/[^0-9]/', '', $phone);

        if (str_starts_with($number, '00880')) {
            $number = substr($number, 2);
        }

        if (str_starts_with($number, '880')) {
            // already normalized
        } elseif (str_starts_with($number, '01')) {
            $number = '88' . $number;
        } elseif (strlen($number) === 10 && str_starts_with($number, '1')) {
            $number = '880' . $number;
        } else {
            $number = '88' . $number;
        }

        return preg_match('/^8801[0-9]{9}$/', $number) === 1 ? $number : null;
    }
}
