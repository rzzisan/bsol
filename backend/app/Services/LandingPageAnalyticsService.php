<?php

namespace App\Services;

use App\Models\LandingPage;
use App\Models\LandingPageVisit;
use App\Models\LandingPageStatistic;
use Illuminate\Support\Facades\DB;

class LandingPageAnalyticsService
{
    private IpLocationService $ipLocationService;

    public function __construct(IpLocationService $ipLocationService)
    {
        $this->ipLocationService = $ipLocationService;
    }

    /**
     * Record a visit to a landing page
     */
    public function recordVisit(
        int $landingPageId,
        string $ipAddress,
        ?string $referrer = null,
        ?string $userAgent = null,
        ?int $userId = null
    ): LandingPageVisit {
        // Get location from IP
        $locationData = $this->ipLocationService->getLocation($ipAddress);

        // Create visit record
        $visit = LandingPageVisit::create([
            'landing_page_id' => $landingPageId,
            'ip_address' => $ipAddress,
            'country' => $locationData['country'] ?? null,
            'city' => $locationData['city'] ?? null,
            'latitude' => $locationData['latitude'] ?? null,
            'longitude' => $locationData['longitude'] ?? null,
            'referrer' => $referrer,
            'user_agent' => $userAgent,
            'session_id' => session()->getId(),
            'user_id' => $userId,
        ]);

        // Update daily statistics
        $this->updateDailyStatistics($landingPageId);

        return $visit;
    }

    /**
     * Get statistics for a landing page
     */
    public function getStatistics(
        int $landingPageId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        $query = LandingPageStatistic::where('landing_page_id', $landingPageId);

        if ($startDate) {
            $query->whereDate('date', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('date', '<=', $endDate);
        }

        $stats = $query->orderBy('date', 'asc')->get();

        return [
            'total_visits' => $stats->sum('total_visits'),
            'total_unique_visitors' => $stats->sum('unique_visitors'),
            'total_orders' => $stats->sum('orders_placed'),
            'daily_stats' => $stats->map(fn ($stat) => [
                'date' => $stat->date->format('Y-m-d'),
                'visits' => $stat->total_visits,
                'unique_visitors' => $stat->unique_visitors,
                'orders' => $stat->orders_placed,
            ])->toArray(),
        ];
    }

    /**
     * Get visitor details for a landing page
     */
    public function getVisitorDetails(
        int $landingPageId,
        ?string $startDate = null,
        ?string $endDate = null,
        int $limit = 100,
        int $offset = 0
    ): array {
        $query = LandingPageVisit::where('landing_page_id', $landingPageId);

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        $total = $query->count();
        $visitors = $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->offset($offset)
            ->get()
            ->map(fn ($visit) => [
                'id' => $visit->id,
                'ip_address' => $visit->ip_address,
                'country' => $visit->country,
                'city' => $visit->city,
                'latitude' => $visit->latitude,
                'longitude' => $visit->longitude,
                'referrer' => $visit->referrer,
                'visited_at' => $visit->created_at,
                'orders_count' => $visit->orders()->count(),
            ])->toArray();

        return [
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
            'visitors' => $visitors,
        ];
    }

    /**
     * Get statistics by country
     */
    public function getStatisticsByCountry(
        int $landingPageId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        $query = LandingPageVisit::where('landing_page_id', $landingPageId)
            ->whereNotNull('country')
            ->select('country')
            ->selectRaw('COUNT(*) as visits')
            ->selectRaw('COUNT(DISTINCT ip_address) as unique_visitors');

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        return $query->groupBy('country')
            ->orderByDesc('visits')
            ->get()
            ->toArray();
    }

    /**
     * Get statistics by referrer
     */
    public function getStatisticsByReferrer(
        int $landingPageId,
        ?string $startDate = null,
        ?string $endDate = null
    ): array {
        $query = LandingPageVisit::where('landing_page_id', $landingPageId)
            ->whereNotNull('referrer')
            ->select('referrer')
            ->selectRaw('COUNT(*) as visits')
            ->selectRaw('COUNT(DISTINCT ip_address) as unique_visitors');

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }
        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        return $query->groupBy('referrer')
            ->orderByDesc('visits')
            ->get()
            ->toArray();
    }

    /**
     * Link a visit to an order
     */
    public function linkVisitToOrder(int $visitId, int $orderId): void
    {
        $visit = LandingPageVisit::findOrFail($visitId);
        $visit->orders()->syncWithoutDetaching([$orderId]);

        // Update daily statistics
        $this->updateDailyStatistics($visit->landing_page_id);
    }

    /**
     * Update daily statistics
     */
    private function updateDailyStatistics(int $landingPageId): void
    {
        $today = now()->toDateString();

        // Get today's visit data
        $visits = LandingPageVisit::where('landing_page_id', $landingPageId)
            ->whereDate('created_at', $today)
            ->get();

        $totalVisits = $visits->count();
        $uniqueVisitors = $visits->pluck('ip_address')->unique()->count();

        // Count orders from these visits
        $ordersCount = DB::table('landing_page_visit_orders')
            ->whereIn('landing_page_visit_id', $visits->pluck('id'))
            ->distinct('order_id')
            ->count('order_id');

        // Update or create daily statistic
        LandingPageStatistic::updateOrCreate(
            [
                'landing_page_id' => $landingPageId,
                'date' => $today,
            ],
            [
                'total_visits' => $totalVisits,
                'unique_visitors' => $uniqueVisitors,
                'orders_placed' => $ordersCount,
            ]
        );
    }
}
