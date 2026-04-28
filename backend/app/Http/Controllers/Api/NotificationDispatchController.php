<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DispatchNotificationJob;
use App\Models\NotificationDispatchLog;
use App\Services\NotificationDispatchService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationDispatchController extends Controller
{
    public function __construct(private readonly NotificationDispatchService $dispatchService) {}

    public function dispatch(Request $request)
    {
        $validated = $request->validate([
            'use_case_key' => ['required', Rule::in([
                'phone_verification',
                'email_verification',
                'bill_notification',
                'forgot_password',
            ])],
            'recipient_phone' => ['nullable', 'string', 'max:40'],
            'recipient_email' => ['nullable', 'email', 'max:255'],
            'variables' => ['nullable', 'array'],
            'queue' => ['sometimes', 'boolean'],
        ]);

        if (empty($validated['recipient_phone']) && empty($validated['recipient_email'])) {
            return response()->json([
                'status' => 'error',
                'message' => 'At least one recipient is required (phone/email).',
            ], 422);
        }

        $actor = $request->user();
        $variables = (array) ($validated['variables'] ?? []);
        $queue = (bool) ($validated['queue'] ?? true);

        if ($queue) {
            NotificationDispatchLog::create([
                'user_id' => $actor->id,
                'use_case_key' => $validated['use_case_key'],
                'channel' => filled($validated['recipient_phone'] ?? null) ? 'sms' : 'email',
                'status' => 'queued',
                'recipient' => (string) ($validated['recipient_phone'] ?? $validated['recipient_email']),
                'provider' => 'queue',
                'attempts' => 0,
                'payload' => [
                    'recipient_phone' => $validated['recipient_phone'] ?? null,
                    'recipient_email' => $validated['recipient_email'] ?? null,
                    'variables' => $variables,
                ],
            ]);

            DispatchNotificationJob::dispatch(
                userId: $actor->id,
                useCaseKey: $validated['use_case_key'],
                recipientPhone: $validated['recipient_phone'] ?? null,
                recipientEmail: $validated['recipient_email'] ?? null,
                variables: $variables,
            )->onQueue('notifications');

            return response()->json([
                'status' => 'success',
                'message' => 'Notification queued successfully.',
            ], 202);
        }

        $result = $this->dispatchService->dispatch(
            user: $actor,
            useCaseKey: $validated['use_case_key'],
            recipientPhone: $validated['recipient_phone'] ?? null,
            recipientEmail: $validated['recipient_email'] ?? null,
            variables: $variables,
        );

        return response()->json($result, $result['status'] === 'success' ? 200 : 422);
    }

    public function logs(Request $request)
    {
        $validated = $request->validate([
            'use_case_key' => ['nullable', Rule::in([
                'phone_verification',
                'email_verification',
                'bill_notification',
                'forgot_password',
            ])],
            'channel' => ['nullable', Rule::in(['sms', 'email'])],
            'status' => ['nullable', Rule::in(['queued', 'sent', 'failed'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:200'],
        ]);

        $query = NotificationDispatchLog::query()
            ->where('user_id', auth()->id())
            ->latest('id');

        if (! empty($validated['use_case_key'])) {
            $query->where('use_case_key', $validated['use_case_key']);
        }

        if (! empty($validated['channel'])) {
            $query->where('channel', $validated['channel']);
        }

        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $perPage = (int) ($validated['per_page'] ?? 20);
        $logs = $query->paginate($perPage);

        return response()->json([
            'status' => 'success',
            'data' => $logs->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
