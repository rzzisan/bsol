<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\LandingPageAnalyticsDaily;
use App\Models\LandingPageConversionTracking;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;

class LandingTrackingController extends Controller
{
    public function trackView(Request $request): JsonResponse
    {
        $payload = $this->validatedTrackingPayload($request);
        $page = $this->resolvePublishedPageBySlug($payload['slug']);

        $row = $this->dailyRow($page->id);
        $row->increment('total_views');
        if ($this->shouldCountAsUniqueVisitor($page->id, $payload)) {
            $row->increment('unique_visitors');
        }

        $this->storeConversionEvent($page->id, 'page_view', $payload);

        return response()->json([
            'success' => true,
            'message' => 'View tracked.',
        ]);
    }

    public function trackCta(Request $request): JsonResponse
    {
        $payload = $this->validatedTrackingPayload($request);
        $type = (string) ($request->input('type') ?? 'cta');
        $page = $this->resolvePublishedPageBySlug($payload['slug']);

        $row = $this->dailyRow($page->id);

        if ($type === 'checkout') {
            $row->increment('checkout_starts');
            $this->storeConversionEvent($page->id, 'checkout_start', $payload, ['type' => $type]);
        } else {
            $row->increment('cta_clicks');
            $this->storeConversionEvent($page->id, 'cta_click', $payload, ['type' => $type]);
        }

        return response()->json([
            'success' => true,
            'message' => 'CTA tracked.',
        ]);
    }

    public function trackCheckoutStart(Request $request): JsonResponse
    {
        $payload = $this->validatedTrackingPayload($request);
        $page = $this->resolvePublishedPageBySlug($payload['slug']);
        $row = $this->dailyRow($page->id);
        $row->increment('checkout_starts');
        $this->storeConversionEvent($page->id, 'checkout_start', $payload);

        return response()->json([
            'success' => true,
            'message' => 'Checkout start tracked.',
        ]);
    }

    public function trackOrderComplete(Request $request): JsonResponse
    {
        $validated = $request->validate([
            ...$this->trackingPayloadRules(),
            'revenue' => ['nullable', 'numeric', 'min:0'],
        ]);

        $page = $this->resolvePublishedPageBySlug((string) $validated['slug']);

        $row = $this->dailyRow($page->id);
        $row->increment('orders_completed');

        $revenue = (float) ($validated['revenue'] ?? 0);
        if ($revenue > 0) {
            $row->increment('revenue', $revenue);
        }

        $this->storeConversionEvent($page->id, 'order_complete', $validated, ['revenue' => $revenue]);

        return response()->json([
            'success' => true,
            'message' => 'Order completion tracked.',
        ]);
    }

    public function trackUpsell(Request $request): JsonResponse
    {
        $payload = $this->validatedTrackingPayload($request);
        $page = $this->resolvePublishedPageBySlug($payload['slug']);
        $row = $this->dailyRow($page->id);
        $row->increment('upsells_accepted');
        $this->storeConversionEvent($page->id, 'upsell_accept', $payload);

        return response()->json([
            'success' => true,
            'message' => 'Upsell acceptance tracked.',
        ]);
    }

    public function trackOrderBump(Request $request): JsonResponse
    {
        $payload = $this->validatedTrackingPayload($request);
        $page = $this->resolvePublishedPageBySlug($payload['slug']);
        $row = $this->dailyRow($page->id);
        $row->increment('order_bumps_accepted');
        $this->storeConversionEvent($page->id, 'order_bump_accept', $payload);

        return response()->json([
            'success' => true,
            'message' => 'Order bump acceptance tracked.',
        ]);
    }

    private function resolvePublishedPageBySlug(string $slug): LandingPage
    {
        return LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();
    }

    /**
     * @return array<string, mixed>
     */
    private function validatedTrackingPayload(Request $request): array
    {
        return $request->validate($this->trackingPayloadRules());
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function trackingPayloadRules(): array
    {
        return [
            'slug' => ['required', 'string', 'exists:landing_pages,slug'],
            'session_id' => ['nullable', 'string', 'max:120'],
            'visitor_id' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:60'],
            'device' => ['nullable', 'string', 'max:30'],
            'country' => ['nullable', 'string', 'size:2'],
            'metadata_json' => ['nullable', 'array'],
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param array<string, mixed> $extraMeta
     */
    private function storeConversionEvent(int $landingPageId, string $eventType, array $payload, array $extraMeta = []): void
    {
        $metadata = $payload['metadata_json'] ?? [];
        if (!is_array($metadata)) {
            $metadata = [];
        }
        $metadata = array_merge($metadata, $extraMeta);

        LandingPageConversionTracking::query()->create([
            'landing_page_id' => $landingPageId,
            'event_type' => $eventType,
            'session_id' => $payload['session_id'] ?? null,
            'visitor_id' => $payload['visitor_id'] ?? null,
            'source' => $payload['source'] ?? null,
            'device' => $payload['device'] ?? null,
            'country' => $payload['country'] ?? null,
            'metadata_json' => empty($metadata) ? null : $metadata,
            'tracked_at' => now(),
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function shouldCountAsUniqueVisitor(int $landingPageId, array $payload): bool
    {
        $visitorId = $payload['visitor_id'] ?? null;
        if (!is_string($visitorId) || trim($visitorId) === '') {
            return false;
        }

        return !LandingPageConversionTracking::query()
            ->where('landing_page_id', $landingPageId)
            ->where('event_type', 'page_view')
            ->where('visitor_id', $visitorId)
            ->whereDate('tracked_at', Carbon::today()->toDateString())
            ->exists();
    }

    private function dailyRow(int $landingPageId): LandingPageAnalyticsDaily
    {
        $today = Carbon::today()->toDateString();

        $existing = LandingPageAnalyticsDaily::query()
            ->where('landing_page_id', $landingPageId)
            ->whereDate('view_date', $today)
            ->first();

        if ($existing) {
            return $existing;
        }

        try {
            return LandingPageAnalyticsDaily::query()->create([
                'landing_page_id' => $landingPageId,
                'view_date' => $today,
                'total_views' => 0,
                'unique_visitors' => 0,
                'cta_clicks' => 0,
                'checkout_starts' => 0,
                'order_bumps_accepted' => 0,
                'upsells_accepted' => 0,
                'orders_completed' => 0,
                'revenue' => 0,
            ]);
        } catch (QueryException) {
            return LandingPageAnalyticsDaily::query()
                ->where('landing_page_id', $landingPageId)
                ->whereDate('view_date', $today)
                ->firstOrFail();
        }
    }
}
