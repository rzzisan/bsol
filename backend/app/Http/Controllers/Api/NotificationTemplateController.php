<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailConfiguration;
use App\Models\NotificationTemplate;
use App\Models\SmsGateway;
use App\Services\NotificationTemplateRenderer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationTemplateController extends Controller
{
    public function __construct(private readonly NotificationTemplateRenderer $renderer) {}

    public function index(Request $request)
    {
        $validated = $request->validate([
            'channel' => ['nullable', Rule::in(['sms', 'email'])],
        ]);

        $query = NotificationTemplate::query()
            ->where('user_id', auth()->id())
            ->with(['smsGateway:id,name,provider', 'emailConfiguration:id,name,host,from_email'])
            ->latest('id');

        if (! empty($validated['channel'])) {
            $query->where('channel', $validated['channel']);
        }

        return response()->json([
            'status' => 'success',
            'data' => $query->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);
        $this->validateChannelDependencies($validated);

        $exists = NotificationTemplate::query()
            ->where('user_id', auth()->id())
            ->where('channel', $validated['channel'])
            ->where('name', $validated['name'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Template name already exists in this channel.',
            ], 422);
        }

        $template = NotificationTemplate::create([
            ...$validated,
            'user_id' => auth()->id(),
            'variables' => $this->extractVariables($validated),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Template created successfully.',
            'data' => $template->load(['smsGateway:id,name,provider', 'emailConfiguration:id,name,host,from_email']),
        ], 201);
    }

    public function show(string $id)
    {
        $template = NotificationTemplate::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->with(['smsGateway:id,name,provider', 'emailConfiguration:id,name,host,from_email'])
            ->first();

        if (! $template) {
            return response()->json([
                'status' => 'error',
                'message' => 'Template not found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $template,
        ]);
    }

    public function update(Request $request, string $id)
    {
        $template = NotificationTemplate::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->first();

        if (! $template) {
            return response()->json([
                'status' => 'error',
                'message' => 'Template not found.',
            ], 404);
        }

        $validated = $this->validatePayload($request, true);
        $merged = [
            'channel' => $validated['channel'] ?? $template->channel,
            'sms_gateway_id' => array_key_exists('sms_gateway_id', $validated) ? $validated['sms_gateway_id'] : $template->sms_gateway_id,
            'email_configuration_id' => array_key_exists('email_configuration_id', $validated) ? $validated['email_configuration_id'] : $template->email_configuration_id,
            'subject' => array_key_exists('subject', $validated) ? $validated['subject'] : $template->subject,
            'body' => $validated['body'] ?? $template->body,
        ];

        $this->validateChannelDependencies($merged);

        if (isset($validated['name']) && $validated['name'] !== $template->name) {
            $exists = NotificationTemplate::query()
                ->where('user_id', auth()->id())
                ->where('channel', $merged['channel'])
                ->where('name', $validated['name'])
                ->where('id', '!=', $template->id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Template name already exists in this channel.',
                ], 422);
            }
        }

        $template->update([
            ...$validated,
            'variables' => $this->extractVariables([
                ...$template->toArray(),
                ...$validated,
            ]),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Template updated successfully.',
            'data' => $template->fresh()->load(['smsGateway:id,name,provider', 'emailConfiguration:id,name,host,from_email']),
        ]);
    }

    public function destroy(string $id)
    {
        $template = NotificationTemplate::query()
            ->where('id', $id)
            ->where('user_id', auth()->id())
            ->first();

        if (! $template) {
            return response()->json([
                'status' => 'error',
                'message' => 'Template not found.',
            ], 404);
        }

        $template->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Template deleted successfully.',
        ]);
    }

    public function preview(Request $request)
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', 'exists:notification_templates,id'],
            'variables' => ['nullable', 'array'],
        ]);

        $template = NotificationTemplate::query()
            ->where('id', $validated['template_id'])
            ->where('user_id', auth()->id())
            ->first();

        if (! $template) {
            return response()->json([
                'status' => 'error',
                'message' => 'Template not found.',
            ], 404);
        }

        $variables = (array) ($validated['variables'] ?? []);
        $bodyPreview = $this->renderer->render($template->body, $variables);
        $subjectPreview = $template->channel === 'email'
            ? $this->renderer->render((string) ($template->subject ?? ''), $variables)
            : null;

        return response()->json([
            'status' => 'success',
            'data' => [
                'channel' => $template->channel,
                'subject' => $subjectPreview['rendered'] ?? null,
                'body' => $bodyPreview['rendered'],
                'missing_placeholders' => array_values(array_unique([
                    ...($subjectPreview['missing'] ?? []),
                    ...$bodyPreview['missing'],
                ])),
                'available_placeholders' => array_values(array_unique([
                    ...($subjectPreview['placeholders'] ?? []),
                    ...$bodyPreview['placeholders'],
                ])),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, bool $partial = false): array
    {
        $prefix = $partial ? 'sometimes|' : '';

        return $request->validate([
            'name' => [$prefix.'required', 'string', 'max:160'],
            'channel' => [$prefix.'required', Rule::in(['sms', 'email'])],
            'language' => [$prefix.'required', Rule::in(['bn', 'en'])],
            'sms_gateway_id' => ['nullable', 'integer', 'exists:sms_gateways,id'],
            'email_configuration_id' => ['nullable', 'integer', 'exists:email_configurations,id'],
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => [$prefix.'required', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function validateChannelDependencies(array $payload): void
    {
        $channel = $payload['channel'] ?? null;

        if ($channel === 'sms') {
            if (empty($payload['sms_gateway_id'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'SMS template requires sms_gateway_id.',
                ], 422));
            }

            if (! empty($payload['email_configuration_id'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'SMS template cannot include email_configuration_id.',
                ], 422));
            }

            return;
        }

        if ($channel === 'email') {
            if (empty($payload['email_configuration_id'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Email template requires email_configuration_id.',
                ], 422));
            }

            if (empty($payload['subject'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Email template requires subject.',
                ], 422));
            }

            if (! empty($payload['sms_gateway_id'])) {
                abort(response()->json([
                    'status' => 'error',
                    'message' => 'Email template cannot include sms_gateway_id.',
                ], 422));
            }
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<int, string>
     */
    private function extractVariables(array $payload): array
    {
        $bodyPlaceholders = $this->renderer->extractPlaceholders((string) ($payload['body'] ?? ''));
        $subjectPlaceholders = $this->renderer->extractPlaceholders((string) ($payload['subject'] ?? ''));

        return array_values(array_unique([...$bodyPlaceholders, ...$subjectPlaceholders]));
    }
}
