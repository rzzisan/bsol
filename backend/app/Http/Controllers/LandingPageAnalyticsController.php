<?php

namespace App\Http\Controllers;

use App\Models\LandingPage;
use App\Services\LandingPageAnalyticsService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class LandingPageAnalyticsController extends Controller
{
    private LandingPageAnalyticsService $analyticsService;

    public function __construct(LandingPageAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    /**
     * Get landing page statistics
     */
    public function getStatistics(Request $request, int $landingPageId): JsonResponse
    {
        $landingPage = LandingPage::findOrFail($landingPageId);
        $this->authorize('view', $landingPage);

        $request->validate([
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
        ]);

        $stats = $this->analyticsService->getStatistics(
            $landingPageId,
            $request->input('start_date'),
            $request->input('end_date')
        );

        return response()->json($stats);
    }

    /**
     * Get visitor details
     */
    public function getVisitors(Request $request, int $landingPageId): JsonResponse
    {
        $landingPage = LandingPage::findOrFail($landingPageId);
        $this->authorize('view', $landingPage);

        $request->validate([
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
            'limit' => 'nullable|integer|min:1|max:500',
            'offset' => 'nullable|integer|min:0',
        ]);

        $visitors = $this->analyticsService->getVisitorDetails(
            $landingPageId,
            $request->input('start_date'),
            $request->input('end_date'),
            $request->input('limit', 100),
            $request->input('offset', 0)
        );

        return response()->json($visitors);
    }

    /**
     * Get statistics by country
     */
    public function getByCountry(Request $request, int $landingPageId): JsonResponse
    {
        $landingPage = LandingPage::findOrFail($landingPageId);
        $this->authorize('view', $landingPage);

        $request->validate([
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
        ]);

        $stats = $this->analyticsService->getStatisticsByCountry(
            $landingPageId,
            $request->input('start_date'),
            $request->input('end_date')
        );

        return response()->json($stats);
    }

    /**
     * Get statistics by referrer
     */
    public function getByReferrer(Request $request, int $landingPageId): JsonResponse
    {
        $landingPage = LandingPage::findOrFail($landingPageId);
        $this->authorize('view', $landingPage);

        $request->validate([
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d',
        ]);

        $stats = $this->analyticsService->getStatisticsByReferrer(
            $landingPageId,
            $request->input('start_date'),
            $request->input('end_date')
        );

        return response()->json($stats);
    }

    /**
     * Link visit to order
     */
    public function linkVisitToOrder(Request $request, int $landingPageId): JsonResponse
    {
        $landingPage = LandingPage::findOrFail($landingPageId);
        $this->authorize('update', $landingPage);

        $request->validate([
            'visit_id' => 'required|exists:landing_page_visits,id',
            'order_id' => 'required|exists:orders,id',
        ]);

        $this->analyticsService->linkVisitToOrder(
            $request->input('visit_id'),
            $request->input('order_id')
        );

        return response()->json(['success' => true]);
    }
}
