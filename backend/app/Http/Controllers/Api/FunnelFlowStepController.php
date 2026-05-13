<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funnel;
use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FunnelFlowStepController extends Controller
{
    /**
     * Get all steps for a funnel flow
     */
    public function index(Request $request, Funnel $funnel, FunnelFlow $flow): JsonResponse
    {
        $this->authorize('view', $funnel);

        if ($flow->funnel_id !== $funnel->id) {
            return response()->json([
                'success' => false,
                'message' => 'Flow does not belong to this funnel',
            ], 404);
        }

        $steps = $flow->steps()
            ->with('landingPage:id,title,slug,status')
            ->orderBy('step_order')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $steps,
        ]);
    }

    /**
     * Add a new step to a funnel flow
     */
    public function store(Request $request, Funnel $funnel, FunnelFlow $flow): JsonResponse
    {
        $this->authorize('update', $funnel);

        if ($flow->funnel_id !== $funnel->id) {
            return response()->json([
                'success' => false,
                'message' => 'Flow does not belong to this funnel',
            ], 404);
        }

        $validated = $request->validate([
            'step_type' => ['required', 'string', 'in:landing,checkout,order_bump,upsell,thank_you'],
            'landing_page_id' => ['required', 'integer', 'exists:landing_pages,id'],
            'slug' => ['nullable', 'string', 'max:220'],
            'is_enabled' => ['boolean'],
            'settings_json' => ['nullable', 'array'],
        ]);

        $this->assertLandingPageOwnership((int) $validated['landing_page_id'], $funnel->user_id);
        $this->assertCoreStepTypeConstraints($flow, $validated['step_type']);
        $this->assertStepDependencyConstraints($flow, $validated['step_type']);
        $this->assertTransitionReferences($flow, $validated['settings_json'] ?? [], null);

        // Calculate next step order
        $nextOrder = $flow->steps()->max('step_order') + 1;

        $step = FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => $validated['step_type'],
            'step_order' => $nextOrder,
            'landing_page_id' => $validated['landing_page_id'],
            'slug' => $validated['slug'] ?? strtolower($validated['step_type']),
            'is_enabled' => $validated['is_enabled'] ?? true,
            'settings_json' => $validated['settings_json'] ?? [],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Step added successfully',
            'data' => $step->load('landingPage'),
        ], 201);
    }

    /**
     * Update a step
     */
    public function update(Request $request, Funnel $funnel, FunnelFlow $flow, FunnelFlowStep $step): JsonResponse
    {
        $this->authorize('update', $funnel);

        if ($step->funnel_flow_id !== $flow->id || $flow->funnel_id !== $funnel->id) {
            return response()->json([
                'success' => false,
                'message' => 'Step does not belong to this flow',
            ], 404);
        }

        $validated = $request->validate([
            'step_type' => ['sometimes', 'string', 'in:landing,checkout,order_bump,upsell,thank_you'],
            'landing_page_id' => ['sometimes', 'integer', 'exists:landing_pages,id'],
            'slug' => ['sometimes', 'string', 'max:220'],
            'is_enabled' => ['boolean'],
            'settings_json' => ['nullable', 'array'],
        ]);

        if (array_key_exists('landing_page_id', $validated)) {
            $this->assertLandingPageOwnership((int) $validated['landing_page_id'], $funnel->user_id);
        }

        if (array_key_exists('step_type', $validated) && $validated['step_type'] !== $step->step_type) {
            $this->assertCoreStepTypeConstraints($flow, $validated['step_type'], $step->id);
            $this->assertStepDependencyConstraints($flow, $validated['step_type']);
        }

        if (array_key_exists('settings_json', $validated)) {
            $this->assertTransitionReferences($flow, $validated['settings_json'] ?? [], $step->id);
        }

        $step->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Step updated successfully',
            'data' => $step->load('landingPage'),
        ]);
    }

    /**
     * Delete a step
     */
    public function destroy(Request $request, Funnel $funnel, FunnelFlow $flow, FunnelFlowStep $step): JsonResponse
    {
        $this->authorize('update', $funnel);

        if ($step->funnel_flow_id !== $flow->id || $flow->funnel_id !== $funnel->id) {
            return response()->json([
                'success' => false,
                'message' => 'Step does not belong to this flow',
            ], 404);
        }

        $step->delete();

        return response()->json([
            'success' => true,
            'message' => 'Step deleted successfully',
        ]);
    }

    /**
     * Reorder steps within a flow
     */
    public function reorder(Request $request, Funnel $funnel, FunnelFlow $flow): JsonResponse
    {
        $this->authorize('update', $funnel);

        if ($flow->funnel_id !== $funnel->id) {
            return response()->json([
                'success' => false,
                'message' => 'Flow does not belong to this funnel',
            ], 404);
        }

        $validated = $request->validate([
            'steps' => ['required', 'array'],
            'steps.*.id' => ['required', 'integer', 'exists:funnel_flow_steps,id'],
            'steps.*.order' => ['required', 'integer', 'min:1'],
        ]);

        $existingIds = $flow->steps()->pluck('id')->all();
        $submittedIds = array_map(static fn (array $item) => (int) $item['id'], $validated['steps']);
        sort($existingIds);
        sort($submittedIds);

        if ($existingIds !== $submittedIds) {
            return response()->json([
                'success' => false,
                'message' => 'Reorder payload must include all and only the steps in this flow.',
            ], 422);
        }

        $orders = array_map(static fn (array $item) => (int) $item['order'], $validated['steps']);
        if (count($orders) !== count(array_unique($orders))) {
            return response()->json([
                'success' => false,
                'message' => 'Step orders must be unique.',
            ], 422);
        }

        foreach ($validated['steps'] as $stepData) {
            FunnelFlowStep::where('id', $stepData['id'])
                ->where('funnel_flow_id', $flow->id)
                ->update(['step_order' => $stepData['order']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Steps reordered successfully',
        ]);
    }

    private function assertLandingPageOwnership(int $landingPageId, int $funnelOwnerId): void
    {
        $landingPage = LandingPage::query()->find($landingPageId);

        if (! $landingPage || (int) $landingPage->user_id !== (int) $funnelOwnerId) {
            throw ValidationException::withMessages([
                'landing_page_id' => ['Selected landing page does not belong to this funnel owner.'],
            ]);
        }
    }

    private function assertCoreStepTypeConstraints(FunnelFlow $flow, string $incomingStepType, ?int $ignoreStepId = null): void
    {
        $uniqueCoreStepTypes = ['landing', 'checkout', 'thank_you'];
        if (! in_array($incomingStepType, $uniqueCoreStepTypes, true)) {
            return;
        }

        $exists = $flow->steps()
            ->when($ignoreStepId, fn ($q) => $q->where('id', '!=', $ignoreStepId))
            ->where('step_type', $incomingStepType)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'step_type' => ["Only one '{$incomingStepType}' step is allowed per flow."],
            ]);
        }
    }

    private function assertStepDependencyConstraints(FunnelFlow $flow, string $incomingStepType): void
    {
        if (! in_array($incomingStepType, ['order_bump', 'upsell', 'thank_you'], true)) {
            return;
        }

        $hasCheckout = $flow->steps()->where('step_type', 'checkout')->exists();
        if (! $hasCheckout && $incomingStepType !== 'checkout') {
            throw ValidationException::withMessages([
                'step_type' => ['A checkout step is required before adding order bump, upsell, or thank you steps.'],
            ]);
        }
    }

    private function assertTransitionReferences(FunnelFlow $flow, array $settingsJson, ?int $currentStepId): void
    {
        $transitionKeys = ['next_step_on_success', 'next_step_on_failure'];
        $allowedIds = $flow->steps()->pluck('id')->all();

        foreach ($transitionKeys as $key) {
            if (! array_key_exists($key, $settingsJson) || $settingsJson[$key] === null || $settingsJson[$key] === '') {
                continue;
            }

            $targetId = (int) $settingsJson[$key];
            if (! in_array($targetId, $allowedIds, true)) {
                throw ValidationException::withMessages([
                    'settings_json' => ["{$key} must reference a step inside the same flow."],
                ]);
            }

            if ($currentStepId && $targetId === (int) $currentStepId) {
                throw ValidationException::withMessages([
                    'settings_json' => ["{$key} cannot reference the current step itself."],
                ]);
            }
        }
    }
}
