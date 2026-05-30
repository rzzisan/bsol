<?php

namespace App\Http\Middleware;

use App\Services\LandingPageAnalyticsService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TrackLandingPageVisit
{
    private LandingPageAnalyticsService $analyticsService;

    public function __construct(LandingPageAnalyticsService $analyticsService)
    {
        $this->analyticsService = $analyticsService;
    }

    public function handle(Request $request, Closure $next): Response
    {
        // Extract landing page ID from route parameter
        $landingPageId = $request->route('landingPageId') ?? $request->route('id');
        
        if ($landingPageId) {
            try {
                $this->analyticsService->recordVisit(
                    (int) $landingPageId,
                    $this->getClientIp($request),
                    $request->header('referer'),
                    $request->header('user-agent'),
                    auth()->id()
                );
            } catch (\Exception $e) {
                // Log error but don't fail the request
                \Log::error('Landing page visit tracking failed', [
                    'landing_page_id' => $landingPageId,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $next($request);
    }

    /**
     * Get client IP address
     */
    private function getClientIp(Request $request): string
    {
        // Check for shared internet
        if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
            $ip = $_SERVER['HTTP_CLIENT_IP'];
        }
        // Check for IP passed from proxy
        elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
            $ip = trim($ips[0]);
        }
        // Check regular remote address
        else {
            $ip = $_SERVER['REMOTE_ADDR'] ?? $request->ip();
        }

        return $ip;
    }
}
