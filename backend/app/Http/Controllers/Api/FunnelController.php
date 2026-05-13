<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Funnel;
use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use App\Models\LandingPageBlock;
use App\Models\LandingPageConversionTracking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class FunnelController extends Controller
{
    /**
     * List all funnels for the authenticated user
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int)($request->get('per_page', 20)), 100);

        $query = Funnel::query()
            ->where('user_id', $request->user()->id)
            ->with(['flows' => fn($q) => $q->where('is_active', true)])
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status')->toString());
        }

        if ($request->filled('search')) {
            $search = '%' . $request->string('search')->toString() . '%';
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', $search)
                    ->orWhere('slug', 'ilike', $search);
            });
        }

        $result = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $result->items(),
            'meta' => [
                'total' => $result->total(),
                'current_page' => $result->currentPage(),
                'last_page' => $result->lastPage(),
                'per_page' => $result->perPage(),
            ],
        ]);
    }

    /**
     * Create a new funnel
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:220'],
            'slug' => ['nullable', 'string', 'max:220', 'unique:funnels'],
            'theme_tokens_json' => ['nullable', 'array'],
            'settings_json' => ['nullable', 'array'],
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['status'] = 'draft';

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name']) . '-' . time();
        }

        $funnel = Funnel::create($validated);

        // Create default flow
        $flow = FunnelFlow::create([
            'funnel_id' => $funnel->id,
            'name' => 'Default Flow',
            'version' => 1,
            'is_active' => true,
        ]);

        // Create default landing page and steps
        $landingPage = LandingPage::create([
            'user_id' => $request->user()->id,
            'template_id' => 1,
            'title' => $funnel->name . ' - Landing',
            'slug' => $funnel->slug . '-landing',
            'status' => 'draft',
            'theme_tokens_json' => $validated['theme_tokens_json'] ?? [],
            'content_json' => ['sections' => []],
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'landing',
            'step_order' => 1,
            'landing_page_id' => $landingPage->id,
            'slug' => 'landing',
            'is_enabled' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Funnel created successfully',
            'data' => $funnel->load(['flows']),
        ], 201);
    }

    /**
     * Show a specific funnel
     */
    public function show(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('view', $funnel);

        return response()->json([
            'success' => true,
            'data' => $funnel->load(['flows.steps.landingPage']),
        ]);
    }

    /**
     * Update a funnel
     */
    public function update(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('update', $funnel);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:220'],
            'theme_tokens_json' => ['nullable', 'array'],
            'settings_json' => ['nullable', 'array'],
        ]);

        $funnel->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'Funnel updated successfully',
            'data' => $funnel,
        ]);
    }

    /**
     * Publish a funnel
     */
    public function publish(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('update', $funnel);

        // Validate funnel before publishing
        if (!$this->validateFunnelForPublish($funnel)) {
            return response()->json([
                'success' => false,
                'message' => 'Funnel validation failed. Ensure all steps have required fields.',
            ], 422);
        }

        $funnel->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Funnel published successfully',
            'data' => $funnel,
        ]);
    }

    /**
     * Archive a funnel
     */
    public function archive(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('update', $funnel);

        $funnel->update(['status' => 'archived']);

        return response()->json([
            'success' => true,
            'message' => 'Funnel archived successfully',
        ]);
    }

    /**
     * Delete a funnel
     */
    public function destroy(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('delete', $funnel);

        $funnel->delete();

        return response()->json([
            'success' => true,
            'message' => 'Funnel deleted successfully',
        ]);
    }

    /**
     * Get funnel preview (unpublished content)
     */
    public function preview(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('view', $funnel);

        $flow = $funnel->flows()->where('is_active', true)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'funnel' => $funnel,
                'flow' => $flow?->load(['steps.landingPage.blocks']),
            ],
        ]);
    }

    /**
     * Get funnel analytics
     */
    public function analytics(Request $request, Funnel $funnel): JsonResponse
    {
        $this->authorize('view', $funnel);

        $flow = $funnel->flows()->where('is_active', true)->first();
        if (!$flow) {
            return response()->json([
                'success' => true,
                'data' => ['steps' => []],
            ]);
        }

        $steps = $flow->steps()->get();
        $analyticsData = [];

        foreach ($steps as $step) {
            if ($step->landing_page_id) {
                $conversions = LandingPageConversionTracking::where('landing_page_id', $step->landing_page_id)
                    ->selectRaw('event_type, COUNT(*) as count')
                    ->groupBy('event_type')
                    ->get()
                    ->pluck('count', 'event_type')
                    ->toArray();

                $analyticsData[] = [
                    'step_id' => $step->id,
                    'step_type' => $step->step_type,
                    'conversions' => $conversions,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $analyticsData,
        ]);
    }

    /**
     * Validate funnel before publishing
     */
    private function validateFunnelForPublish(Funnel $funnel): bool
    {
        $flow = $funnel->flows()->where('is_active', true)->first();
        if (!$flow) {
            return false;
        }

        $steps = $flow->steps()->get();
        if ($steps->isEmpty()) {
            return false;
        }

        foreach ($steps as $step) {
            if (!$step->landing_page_id) {
                return false;
            }

            $landingPage = $step->landingPage;
            if (!$landingPage || empty($landingPage->title)) {
                return false;
            }
        }

        return true;
    }
}
