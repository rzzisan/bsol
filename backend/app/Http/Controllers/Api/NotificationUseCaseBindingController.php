<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationTemplate;
use App\Models\NotificationUseCaseBinding;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationUseCaseBindingController extends Controller
{
    public function index()
    {
        $rows = NotificationUseCaseBinding::query()
            ->where('user_id', auth()->id())
            ->with([
                'smsTemplate:id,name,channel,language',
                'emailTemplate:id,name,channel,language',
            ])
            ->orderBy('use_case_key')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $this->validateTemplatesOwnership($validated);

        $binding = NotificationUseCaseBinding::updateOrCreate(
            [
                'user_id' => auth()->id(),
                'use_case_key' => $validated['use_case_key'],
            ],
            [
                'sms_template_id' => $validated['sms_template_id'] ?? null,
                'email_template_id' => $validated['email_template_id'] ?? null,
                'priority_channel' => $validated['priority_channel'],
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Use-case binding saved successfully.',
            'data' => $binding->load(['smsTemplate:id,name,channel,language', 'emailTemplate:id,name,channel,language']),
        ]);
    }

    public function show(string $id)
    {
        $binding = NotificationUseCaseBinding::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->with([
                'smsTemplate:id,name,channel,language',
                'emailTemplate:id,name,channel,language',
            ])
            ->first();

        if (! $binding) {
            return response()->json([
                'status' => 'error',
                'message' => 'Binding not found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $binding,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $binding = NotificationUseCaseBinding::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->first();

        if (! $binding) {
            return response()->json([
                'status' => 'error',
                'message' => 'Binding not found.',
            ], 404);
        }

        $validated = $this->validatePayload($request, true);

        $payload = [
            'sms_template_id' => array_key_exists('sms_template_id', $validated) ? $validated['sms_template_id'] : $binding->sms_template_id,
            'email_template_id' => array_key_exists('email_template_id', $validated) ? $validated['email_template_id'] : $binding->email_template_id,
            'priority_channel' => $validated['priority_channel'] ?? $binding->priority_channel,
            'is_active' => array_key_exists('is_active', $validated) ? (bool) $validated['is_active'] : $binding->is_active,
        ];

        $this->validateTemplatesOwnership($payload);

        $binding->update($payload);

        return response()->json([
            'status' => 'success',
            'message' => 'Binding updated successfully.',
            'data' => $binding->fresh()->load(['smsTemplate:id,name,channel,language', 'emailTemplate:id,name,channel,language']),
        ]);
    }

    public function destroy(string $id)
    {
        $binding = NotificationUseCaseBinding::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->first();

        if (! $binding) {
            return response()->json([
                'status' => 'error',
                'message' => 'Binding not found.',
            ], 404);
        }

        $binding->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Binding deleted successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes|' : '';

        return $request->validate([
            'use_case_key' => [$prefix.'required', Rule::in([
                'phone_verification',
                'email_verification',
                'bill_notification',
                'forgot_password',
            ])],
            'sms_template_id' => ['nullable', 'integer', 'exists:notification_templates,id'],
            'email_template_id' => ['nullable', 'integer', 'exists:notification_templates,id'],
            'priority_channel' => [$prefix.'required', Rule::in(['sms', 'email', 'both'])],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function validateTemplatesOwnership(array $payload): void
    {
        if (empty($payload['sms_template_id']) && empty($payload['email_template_id'])) {
            abort(response()->json([
                'status' => 'error',
                'message' => 'At least one template (sms/email) is required.',
            ], 422));
        }

        if (! empty($payload['sms_template_id'])) {
            $smsTemplate = NotificationTemplate::query()
                ->where('id', $payload['sms_template_id'])
                ->where('user_id', auth()->id())
                ->where('channel', 'sms')
                ->first();

            if (! $smsTemplate) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Invalid SMS template for this account.',
                ], 422));
            }
        }

        if (! empty($payload['email_template_id'])) {
            $emailTemplate = NotificationTemplate::query()
                ->where('id', $payload['email_template_id'])
                ->where('user_id', auth()->id())
                ->where('channel', 'email')
                ->first();

            if (! $emailTemplate) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Invalid Email template for this account.',
                ], 422));
            }
        }
    }
}
