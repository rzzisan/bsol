<?php

namespace App\Http\Controllers;

use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Services\SmsCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rule;

class AdminSmsGatewayController extends Controller
{
    public function __construct(private readonly SmsCreditService $creditService) {}

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

        $actor = $request->user();
        $actorId = $actor?->id;
        $isAdmin = (bool) $actor?->isAdmin();

        if (! $isAdmin && $actor?->sms_gateway_id) {
            $gateway = SmsGateway::find($actor->sms_gateway_id);
        } else {
            $gateway = isset($validated['gateway_id'])
                ? SmsGateway::find($validated['gateway_id'])
                : SmsGateway::where('is_active', true)->first();
        }

        $creditsRequired = $this->creditService->calculateCreditsRequired($validated['message']);

        if (! $isAdmin && $actorId) {
            $balance = $this->creditService->getBalance($actorId);

            if ($balance < $creditsRequired) {
                $this->createHistoryRecord(
                    gateway: $gateway,
                    userId: $actorId,
                    phoneNumber: $validated['phone_number'],
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: "Insufficient SMS credits. Required {$creditsRequired}, available {$balance}.",
                    sentAt: null,
                );

                return response()->json([
                    'message' => 'Insufficient SMS credits.',
                    'credits_required' => $creditsRequired,
                    'available_credits' => $balance,
                ], 402);
            }
        }

        if (! $gateway) {
            $this->createHistoryRecord(
                gateway: null,
                userId: $actorId,
                phoneNumber: $validated['phone_number'],
                message: $validated['message'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'No gateway selected or active gateway found.',
                sentAt: null,
            );

            return response()->json([
                'message' => 'No SMS gateway selected or active gateway found.',
            ], 422);
        }

        if (! $gateway->is_enabled) {
            $this->createHistoryRecord(
                gateway: $gateway,
                userId: $actorId,
                phoneNumber: $validated['phone_number'],
                message: $validated['message'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Selected SMS gateway is disabled.',
                sentAt: null,
            );

            return response()->json([
                'message' => 'Selected SMS gateway is disabled.',
            ], 422);
        }

        $phone = $this->formatBdPhoneNumber($validated['phone_number']);

        if (! $phone) {
            $this->createHistoryRecord(
                gateway: $gateway,
                userId: $actorId,
                phoneNumber: $validated['phone_number'],
                message: $validated['message'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Invalid phone number format.',
                sentAt: null,
            );

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
            $this->createHistoryRecord(
                gateway: $gateway,
                userId: $actorId,
                phoneNumber: $phone,
                message: $validated['message'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Gateway credentials are incomplete.',
                sentAt: null,
            );

            return response()->json([
                'message' => 'Gateway credentials are incomplete. Please update endpoint/API key/secret/sender ID.',
            ], 422);
        }

        if ($gateway->provider !== 'khudebarta') {
            $this->createHistoryRecord(
                gateway: $gateway,
                userId: $actorId,
                phoneNumber: $phone,
                message: $validated['message'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Provider is not supported yet.',
                sentAt: null,
            );

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

        $this->createHistoryRecord(
            gateway: $gateway,
            userId: $actorId,
            phoneNumber: $phone,
            message: $validated['message'],
            status: $ok ? 'sent' : 'failed',
            httpStatusCode: $response->status(),
            responseBody: mb_substr($body, 0, 4000),
            errorMessage: $ok ? null : 'Gateway responded with failure signal.',
            sentAt: $ok ? now() : null,
        );

        if (! $ok) {
            return response()->json([
                'message' => 'Failed to send SMS through gateway.',
                'gateway' => $gateway->name,
                'provider' => $gateway->provider,
                'status_code' => $response->status(),
                'response_body' => mb_substr($body, 0, 1000),
            ], 502);
        }

        if (! $isAdmin && $actorId) {
            $this->creditService->deduct(
                userId: $actorId,
                credits: $creditsRequired,
                note: "SMS sent to {$phone} via {$gateway->name}",
            );
        }

        return response()->json([
            'message' => 'SMS sent successfully.',
            'gateway' => $gateway->name,
            'provider' => $gateway->provider,
            'phone_number' => $phone,
            'credits_used' => $creditsRequired,
            'status_code' => $response->status(),
            'response_body' => mb_substr($body, 0, 1000),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['sent', 'failed'])],
            'gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);

        $query = SmsHistory::query()->latest('id');

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('phone_number', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhere('gateway_name', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (! empty($validated['gateway_id'])) {
            $query->where('gateway_id', $validated['gateway_id']);
        }

        $histories = $query->paginate($perPage);

        return response()->json([
            'histories' => collect($histories->items())->map(fn (SmsHistory $history) => [
                'id' => $history->id,
                'gateway_id' => $history->gateway_id,
                'gateway_name' => $history->gateway_name,
                'provider' => $history->provider,
                'phone_number' => $history->phone_number,
                'message' => $history->message,
                'status' => $history->status,
                'http_status_code' => $history->http_status_code,
                'response_body' => $history->response_body,
                'error_message' => $history->error_message,
                'sent_at' => optional($history->sent_at)?->toIso8601String(),
                'created_at' => optional($history->created_at)?->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $histories->currentPage(),
                'last_page' => $histories->lastPage(),
                'per_page' => $histories->perPage(),
                'total' => $histories->total(),
            ],
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

    private function createHistoryRecord(
        ?SmsGateway $gateway,
        ?int $userId,
        string $phoneNumber,
        string $message,
        string $status,
        ?int $httpStatusCode,
        ?string $responseBody,
        ?string $errorMessage,
        $sentAt,
    ): void {
        SmsHistory::create([
            'gateway_id' => $gateway?->id,
            'user_id' => $userId,
            'gateway_name' => $gateway?->name,
            'provider' => $gateway?->provider,
            'phone_number' => $phoneNumber,
            'message' => $message,
            'status' => $status,
            'http_status_code' => $httpStatusCode,
            'response_body' => $responseBody,
            'error_message' => $errorMessage,
            'sent_at' => $sentAt,
        ]);
    }
}
