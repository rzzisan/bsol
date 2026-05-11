<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\LandingPageAnalyticsDaily;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LandingTrackingController extends Controller
{
    public function trackView(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'exists:landing_pages,slug'],
        ]);

        $page = LandingPage::query()
            ->where('slug', $validated['slug'])
            ->where('status', 'published')
            ->firstOrFail();

        $row = $this->dailyRow($page->id);
        $row->increment('total_views');

        return response()->json([
            'success' => true,
            'message' => 'View tracked.',
        ]);
    }

    public function trackCta(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'exists:landing_pages,slug'],
            'type' => ['nullable', 'string'],
        ]);

        $page = LandingPage::query()
            ->where('slug', $validated['slug'])
            ->where('status', 'published')
            ->firstOrFail();

        $row = $this->dailyRow($page->id);
        $type = $validated['type'] ?? 'cta';

        if ($type === 'checkout') {
            $row->increment('checkout_starts');
        } else {
            $row->increment('cta_clicks');
        }

        return response()->json([
            'success' => true,
            'message' => 'CTA tracked.',
        ]);
    }

    private function dailyRow(int $landingPageId): LandingPageAnalyticsDaily
    {
        return LandingPageAnalyticsDaily::query()->firstOrCreate(
            [
                'landing_page_id' => $landingPageId,
                'view_date' => Carbon::today()->toDateString(),
            ],
            [
                'total_views' => 0,
                'unique_visitors' => 0,
                'cta_clicks' => 0,
                'checkout_starts' => 0,
                'orders_completed' => 0,
                'revenue' => 0,
            ]
        );
    }
}
