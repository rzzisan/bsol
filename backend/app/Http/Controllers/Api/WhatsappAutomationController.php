<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsappAutomationLog;
use App\Models\WhatsappAutomationRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Mirrors SmsAutomationController's shape exactly — see that class. */
class WhatsappAutomationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);

        $rules = WhatsappAutomationRule::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->orderByDesc('is_active')
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $rules->items(),
            'meta' => [
                'total' => $rules->total(),
                'current_page' => $rules->currentPage(),
                'last_page' => $rules->lastPage(),
                'per_page' => $rules->perPage(),
            ],
            'available_triggers' => WhatsappAutomationRule::TRIGGER_EVENTS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $rule = WhatsappAutomationRule::create($data + ['user_id' => auth()->id()]);

        return response()->json([
            'success' => true,
            'message' => 'Automation rule created successfully.',
            'data' => $rule,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rule = WhatsappAutomationRule::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->findOrFail($id);

        $data = $this->validated($request, partial: true);
        $rule->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Automation rule updated successfully.',
            'data' => $rule->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $rule = WhatsappAutomationRule::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->findOrFail($id);

        $rule->delete();

        return response()->json(['success' => true, 'message' => 'Automation rule deleted successfully.']);
    }

    public function logs(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);

        $logs = WhatsappAutomationLog::query()
            ->whereIn('user_id', auth()->user()->shopUserIds())
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->latest('id')
            ->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'meta' => [
                'total' => $logs->total(),
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
            ],
        ]);
    }

    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';

        return $request->validate([
            'name' => "{$req}|string|max:120",
            'trigger_event' => [$partial ? 'sometimes' : 'required', 'string', Rule::in(WhatsappAutomationRule::TRIGGER_EVENTS)],
            'template_name' => "{$req}|string|max:120",
            'language_code' => 'nullable|string|max:10',
            'variable_mapping' => 'nullable|array',
            'variable_mapping.*' => 'string|max:60',
            'delay_minutes' => 'nullable|integer|min:0|max:10080',
            'is_active' => 'nullable|boolean',
        ]);
    }
}
