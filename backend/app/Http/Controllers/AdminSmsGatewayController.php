<?php

namespace App\Http\Controllers;

use App\Models\PhoneOtpActivityLog;
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

    public function myGateways(Request $request): JsonResponse
    {
        $actor = $request->user();

        if (! $actor) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'gateways' => [],
            ], 401);
        }

        if ($actor->isAdmin()) {
            $gateways = SmsGateway::query()
                ->where('is_enabled', true)
                ->orderByDesc('is_active')
                ->orderBy('id')
                ->get()
                ->map(fn (SmsGateway $gateway) => $this->transformGateway($gateway));

            return response()->json([
                'gateways' => $gateways,
            ]);
        }

        if (! $actor->sms_gateway_id) {
            return response()->json([
                'message' => 'No SMS gateway assigned to this user.',
                'gateways' => [],
            ]);
        }

        $gateway = SmsGateway::query()
            ->where('id', $actor->sms_gateway_id)
            ->where('is_enabled', true)
            ->first();

        if (! $gateway) {
            return response()->json([
                'message' => 'Assigned SMS gateway is unavailable or disabled.',
                'gateways' => [],
            ]);
        }

        return response()->json([
            'gateways' => [$this->transformGateway($gateway)],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'phone_numbers' => ['nullable', 'string', 'max:5000'],
        ]);

        $actor = $request->user();
        $actorId = $actor?->id;
        $creditsPerSms = $this->creditService->calculateCreditsRequired($validated['message']);
        $recipientCount = max(1, count($this->extractRecipients($validated['phone_numbers'] ?? null)));
        $totalCreditsRequired = $creditsPerSms * $recipientCount;

        $available = $actorId ? $this->creditService->getBalance($actorId) : 0;

        return response()->json([
            'credits_required' => $totalCreditsRequired,
            'credits_per_sms' => $creditsPerSms,
            'recipients_count' => $recipientCount,
            'total_credits_required' => $totalCreditsRequired,
            'available_credits' => $available,
            'can_send' => $available >= $totalCreditsRequired,
        ]);
    }

    public function myHistory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['sent', 'failed'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $actor = $request->user();
        $actorId = $actor?->id;

        if (! $actorId) {
            return response()->json([
                'message' => 'Unauthenticated.',
                'histories' => [],
            ], 401);
        }

        $perPage = (int) ($validated['per_page'] ?? 20);

        $query = SmsHistory::query()
            ->where('user_id', $actorId)
            ->latest('id');

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

        $histories = $query->paginate($perPage);

        return response()->json([
            'histories' => collect($histories->items())->map(fn (SmsHistory $history) => [
                'id' => $history->id,
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
            'phone_number' => ['required', 'string', 'max:5000'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $rawRecipients = $this->extractRecipients($validated['phone_number']);

        if (count($rawRecipients) === 0) {
            return response()->json([
                'message' => 'No valid recipient found. Use comma, semicolon, pipe, or new line as separators.',
            ], 422);
        }

        $actor = $request->user();
        $actorId = $actor?->id;
        $isAdmin = (bool) $actor?->isAdmin();

        if (! $isAdmin) {
            if (! $actor?->sms_gateway_id) {
                $this->createHistoryRecord(
                    gateway: null,
                    userId: $actorId,
                    phoneNumber: $validated['phone_number'],
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'No SMS gateway assigned to this user.',
                    sentAt: null,
                );

                return response()->json([
                    'message' => 'No SMS gateway assigned. Please contact admin.',
                ], 422);
            }

            $gateway = SmsGateway::find($actor->sms_gateway_id);
        } else {
            $gateway = isset($validated['gateway_id'])
                ? SmsGateway::find($validated['gateway_id'])
                : SmsGateway::where('is_active', true)->first();
        }

        if (! $gateway) {
            foreach ($rawRecipients as $rawRecipient) {
                $this->createHistoryRecord(
                    gateway: null,
                    userId: $actorId,
                    phoneNumber: $rawRecipient,
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'No gateway selected or active gateway found.',
                    sentAt: null,
                );
            }

            return response()->json([
                'message' => 'No SMS gateway selected or active gateway found.',
            ], 422);
        }

        if (! $gateway->is_enabled) {
            foreach ($rawRecipients as $rawRecipient) {
                $this->createHistoryRecord(
                    gateway: $gateway,
                    userId: $actorId,
                    phoneNumber: $rawRecipient,
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'Selected SMS gateway is disabled.',
                    sentAt: null,
                );
            }

            return response()->json([
                'message' => 'Selected SMS gateway is disabled.',
            ], 422);
        }

        if (
            blank($gateway->endpoint_url)
            || blank($gateway->api_key)
            || blank($gateway->secret_key)
            || blank($gateway->sender_id)
        ) {
            foreach ($rawRecipients as $rawRecipient) {
                $this->createHistoryRecord(
                    gateway: $gateway,
                    userId: $actorId,
                    phoneNumber: $rawRecipient,
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'Gateway credentials are incomplete.',
                    sentAt: null,
                );
            }

            return response()->json([
                'message' => 'Gateway credentials are incomplete. Please update endpoint/API key/secret/sender ID.',
            ], 422);
        }

        if ($gateway->provider !== 'khudebarta') {
            foreach ($rawRecipients as $rawRecipient) {
                $this->createHistoryRecord(
                    gateway: $gateway,
                    userId: $actorId,
                    phoneNumber: $rawRecipient,
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'Provider is not supported yet.',
                    sentAt: null,
                );
            }

            return response()->json([
                'message' => 'Selected gateway provider is not supported yet.',
            ], 422);
        }

        $creditsPerSms = $this->creditService->calculateCreditsRequired($validated['message']);
        $normalizedRecipients = [];
        $invalidRecipients = [];

        foreach ($rawRecipients as $rawRecipient) {
            $normalized = $this->formatBdPhoneNumber($rawRecipient);
            if ($normalized) {
                $normalizedRecipients[] = $normalized;
            } else {
                $invalidRecipients[] = $rawRecipient;
                $this->createHistoryRecord(
                    gateway: $gateway,
                    userId: $actorId,
                    phoneNumber: $rawRecipient,
                    message: $validated['message'],
                    status: 'failed',
                    httpStatusCode: null,
                    responseBody: null,
                    errorMessage: 'Invalid phone number format.',
                    sentAt: null,
                );
            }
        }

        $normalizedRecipients = array_values(array_unique($normalizedRecipients));

        if (count($normalizedRecipients) === 0) {
            return response()->json([
                'message' => 'No valid phone number found. Use valid BD numbers.',
                'invalid_numbers' => $invalidRecipients,
            ], 422);
        }

        $totalCreditsRequired = $creditsPerSms * count($normalizedRecipients);

        if (! $isAdmin && $actorId) {
            $balance = $this->creditService->getBalance($actorId);

            if ($balance < $totalCreditsRequired) {
                foreach ($normalizedRecipients as $recipient) {
                    $this->createHistoryRecord(
                        gateway: $gateway,
                        userId: $actorId,
                        phoneNumber: $recipient,
                        message: $validated['message'],
                        status: 'failed',
                        httpStatusCode: null,
                        responseBody: null,
                        errorMessage: "Insufficient SMS credits. Required {$totalCreditsRequired}, available {$balance}.",
                        sentAt: null,
                    );
                }

                return response()->json([
                    'message' => 'Insufficient SMS credits.',
                    'recipients_count' => count($normalizedRecipients),
                    'credits_per_sms' => $creditsPerSms,
                    'credits_required' => $totalCreditsRequired,
                    'available_credits' => $balance,
                ], 402);
            }
        }

        $results = [];
        $successCount = 0;
        $failedCount = count($invalidRecipients);

        foreach ($normalizedRecipients as $recipient) {
            $response = Http::asForm()
                ->timeout(20)
                ->post($gateway->endpoint_url, [
                    'apikey' => $gateway->api_key,
                    'secretkey' => $gateway->secret_key,
                    'callerID' => $gateway->sender_id,
                    'toUser' => $recipient,
                    'messageContent' => $validated['message'],
                ]);

            $body = (string) $response->body();
            $looksFailed = preg_match('/(error|failed|invalid|unauthorized)/i', $body) === 1;
            $ok = $response->successful() && ! $looksFailed;

            $this->createHistoryRecord(
                gateway: $gateway,
                userId: $actorId,
                phoneNumber: $recipient,
                message: $validated['message'],
                status: $ok ? 'sent' : 'failed',
                httpStatusCode: $response->status(),
                responseBody: mb_substr($body, 0, 4000),
                errorMessage: $ok ? null : 'Gateway responded with failure signal.',
                sentAt: $ok ? now() : null,
            );

            if ($ok) {
                $successCount++;

                if (! $isAdmin && $actorId) {
                    $this->creditService->deduct(
                        userId: $actorId,
                        credits: $creditsPerSms,
                        note: "SMS sent to {$recipient} via {$gateway->name}",
                    );
                }
            } else {
                $failedCount++;
            }

            $results[] = [
                'phone_number' => $recipient,
                'status' => $ok ? 'sent' : 'failed',
                'status_code' => $response->status(),
                'response_body' => mb_substr($body, 0, 1000),
            ];
        }

        $creditsUsed = $successCount * $creditsPerSms;
        $totalRequested = count($normalizedRecipients) + count($invalidRecipients);

        if ($successCount === 0) {
            return response()->json([
                'message' => 'Failed to send SMS through gateway.',
                'gateway' => $gateway->name,
                'provider' => $gateway->provider,
                'requested_count' => $totalRequested,
                'success_count' => $successCount,
                'failed_count' => $failedCount,
                'credits_per_sms' => $creditsPerSms,
                'credits_used' => $creditsUsed,
                'invalid_numbers' => $invalidRecipients,
                'results' => $results,
            ], 502);
        }

        $statusCode = $failedCount > 0 ? 207 : 200;

        return response()->json([
            'message' => $failedCount > 0
                ? "SMS sent to {$successCount} of {$totalRequested} recipients."
                : 'SMS sent successfully.',
            'gateway' => $gateway->name,
            'provider' => $gateway->provider,
            'requested_count' => $totalRequested,
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'recipients_count' => count($normalizedRecipients),
            'credits_per_sms' => $creditsPerSms,
            'credits_used' => $creditsUsed,
            'invalid_numbers' => $invalidRecipients,
            'results' => $results,
        ], $statusCode);
    }

    public function history(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'status' => ['nullable', Rule::in(['sent', 'failed'])],
            'gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 50);
        $page = (int) ($validated['page'] ?? 1);

        $smsQuery = SmsHistory::query()->latest('id');

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $smsQuery->where(function ($q) use ($search) {
                $q->where('phone_number', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhere('gateway_name', 'like', "%{$search}%")
                    ->orWhere('provider', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['status'])) {
            $smsQuery->where('status', $validated['status']);
        }

        if (! empty($validated['gateway_id'])) {
            $smsQuery->where('gateway_id', $validated['gateway_id']);
        }

        $smsRows = $smsQuery->get()->map(fn (SmsHistory $history) => [
            'id' => 'sms-'.$history->id,
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
            'source' => 'sms_history',
            'event_type' => 'sms_send',
        ]);

        $otpQuery = PhoneOtpActivityLog::query()->latest('id');

        if (! empty($validated['search'])) {
            $search = $validated['search'];
            $otpQuery->where(function ($q) use ($search) {
                $q->where('mobile', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhere('error_message', 'like', "%{$search}%")
                    ->orWhere('event_type', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['status'])) {
            $otpQuery->where('status', $validated['status']);
        }

        $otpRows = $otpQuery->get()->map(fn (PhoneOtpActivityLog $log) => [
            'id' => 'otp-'.$log->id,
            'gateway_id' => null,
            'gateway_name' => 'OTP Verification',
            'provider' => $log->provider,
            'phone_number' => $log->mobile,
            'message' => $log->message,
            'status' => $log->status,
            'http_status_code' => null,
            'response_body' => null,
            'error_message' => $log->error_message,
            'sent_at' => $log->status === 'sent' ? optional($log->created_at)?->toIso8601String() : null,
            'created_at' => optional($log->created_at)?->toIso8601String(),
            'source' => 'otp_registration',
            'event_type' => $log->event_type,
        ]);

        $merged = $smsRows
            ->concat($otpRows)
            ->sortByDesc(fn (array $row) => (string) ($row['created_at'] ?? $row['sent_at'] ?? ''))
            ->values();

        $total = $merged->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min($page, $lastPage);
        $offset = ($currentPage - 1) * $perPage;

        $items = $merged->slice($offset, $perPage)->values();

        return response()->json([
            'histories' => $items,
            'meta' => [
                'current_page' => $currentPage,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
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

    private function extractRecipients(?string $raw): array
    {
        if (blank($raw)) {
            return [];
        }

        $parts = preg_split('/[\n,;|]+/', (string) $raw) ?: [];
        $parts = array_map(fn ($part) => trim((string) $part), $parts);
        $parts = array_filter($parts, fn ($part) => $part !== '');

        return array_values(array_unique($parts));
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
