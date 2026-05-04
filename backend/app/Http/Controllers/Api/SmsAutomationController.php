<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SmsAutomationLog;
use App\Models\SmsAutomationRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SmsAutomationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);

        $rules = SmsAutomationRule::query()
            ->where('user_id', auth()->id())
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
            'available_triggers' => SmsAutomationRule::TRIGGER_EVENTS,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:120',
            'trigger_event' => ['required', 'string', Rule::in(SmsAutomationRule::TRIGGER_EVENTS)],
            'template_text' => 'required|string|max:2000',
            'delay_minutes' => 'nullable|integer|min:0|max:10080',
            'is_active' => 'nullable|boolean',
        ]);

        $rule = SmsAutomationRule::create([
            'user_id' => auth()->id(),
            'name' => $data['name'],
            'trigger_event' => $data['trigger_event'],
            'template_text' => $data['template_text'],
            'delay_minutes' => (int) ($data['delay_minutes'] ?? 0),
            'is_active' => (bool) ($data['is_active'] ?? true),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Automation rule created successfully.',
            'data' => $rule,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $rule = SmsAutomationRule::query()
            ->where('user_id', auth()->id())
            ->findOrFail($id);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'trigger_event' => ['sometimes', 'required', 'string', Rule::in(SmsAutomationRule::TRIGGER_EVENTS)],
            'template_text' => 'sometimes|required|string|max:2000',
            'delay_minutes' => 'sometimes|integer|min:0|max:10080',
            'is_active' => 'sometimes|boolean',
        ]);

        $rule->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Automation rule updated successfully.',
            'data' => $rule->fresh(),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $rule = SmsAutomationRule::query()
            ->where('user_id', auth()->id())
            ->findOrFail($id);

        $rule->delete();

        return response()->json([
            'success' => true,
            'message' => 'Automation rule deleted successfully.',
        ]);
    }

    public function logs(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);

        $logs = SmsAutomationLog::query()
            ->where('user_id', auth()->id())
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
}
