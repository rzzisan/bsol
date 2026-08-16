<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingPage;
use App\Models\PlatformApiKey;
use App\Models\TrackingDestination;
use App\Services\Facebook\FacebookCapiClient;
use App\Support\FrontendUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Dashboard CRUD for tracking_destinations (T3, tracking_capi_context.md
 * §6.1/§6.2) — a seller can run several Meta pixels (different ad
 * accounts/brands) and pin one to a specific landing page or connected
 * WooCommerce site instead of the shop-wide default every other event
 * falls back to (TrackingDestination::sendableFor()).
 *
 * Pattern B throughout (owner_only, tracking_capi_context.md §6.2's
 * staff-role checklist) — these are credentials, same as
 * FacebookPixelSettingController and PlatformApiKey's own CRUD.
 *
 * The shop-wide "Default" destination Settings → Facebook Page manages is
 * just scope_type IS NULL here — the same row, same table, no migration
 * between the two UIs. Deleting/editing it here is exactly equivalent to
 * doing so from that page.
 */
class TrackingDestinationController extends Controller
{
    public function index(): JsonResponse
    {
        $destinations = TrackingDestination::where('user_id', auth()->id())
            ->orderBy('id')
            ->get()
            ->map(fn (TrackingDestination $destination) => $this->present($destination));

        return response()->json(['success' => true, 'data' => $destinations]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);

        $destination = new TrackingDestination([
            'user_id' => auth()->id(),
            'provider' => 'meta', // §3.4 — the only provider implemented this round
        ]);
        $this->fill($destination, $data, $request);
        $destination->save();

        return response()->json(['success' => true, 'data' => $this->present($destination)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $destination = TrackingDestination::where('user_id', auth()->id())->findOrFail($id);

        $data = $this->validated($request);
        $this->fill($destination, $data, $request);
        $destination->save();

        return response()->json(['success' => true, 'data' => $this->present($destination)]);
    }

    public function destroy(int $id): JsonResponse
    {
        $destination = TrackingDestination::where('user_id', auth()->id())->findOrFail($id);
        $destination->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Same ad-hoc, unpersisted-event shape as
     * FacebookPixelSettingController::testEvent() — a connectivity check,
     * not a real visitor event, so it deliberately bypasses the ingest
     * pipeline (no quota spent, no tracking_events row).
     */
    public function testEvent(int $id, FacebookCapiClient $capi): JsonResponse
    {
        $destination = TrackingDestination::where('user_id', auth()->id())->findOrFail($id);

        if (! $destination->pixel_id || ! $destination->access_token) {
            return response()->json(['success' => false, 'message' => 'Set the Dataset ID and Access Token first.'], 422);
        }

        $ok = $capi->sendEvent($destination->pixel_id, $destination->access_token, [
            'event_name' => 'Purchase',
            'event_time' => now()->timestamp,
            'event_id' => 'test_' . Str::random(8),
            'action_source' => 'website',
            'event_source_url' => FrontendUrl::forUser(auth()->user()),
            'user_data' => ['ph' => [hash('sha256', '8801700000000')]],
            'custom_data' => ['currency' => 'BDT', 'value' => 100],
        ], $destination->test_event_code ?: null);

        $destination->update([
            'last_sent_at' => now(),
            'last_error' => $ok ? null : 'Test event was rejected — check the Dataset ID / Access Token.',
        ]);

        return response()->json([
            'success' => $ok,
            'message' => $ok
                ? 'Test event sent — check Events Manager → Test Events.'
                : 'Facebook rejected the test event. Check the Dataset ID / Access Token.',
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request): array
    {
        return $request->validate([
            'label' => ['required', 'string', 'max:100'],
            'pixel_id' => ['nullable', 'string', 'max:50'],
            'access_token' => ['nullable', 'string'],
            'test_event_code' => ['nullable', 'string', 'max:50'],
            'enabled' => ['nullable', 'boolean'],
            'scope_type' => ['nullable', 'in:landing_page,platform_api_key'],
            'scope_id' => ['nullable', 'integer', 'required_with:scope_type'],
        ]);
    }

    /** @param  array<string, mixed>  $data */
    private function fill(TrackingDestination $destination, array $data, Request $request): void
    {
        $destination->label = $data['label'];

        if ($request->has('pixel_id')) {
            $destination->pixel_id = $data['pixel_id'] ?: null;
        }
        // Blank access_token field = "leave unchanged" — the real token
        // never round-trips to the frontend (masked() only ever returns
        // access_token_set), matching FacebookPixelSettingController.
        if (! empty($data['access_token'])) {
            $destination->access_token = $data['access_token'];
        }
        if ($request->has('test_event_code')) {
            $destination->test_event_code = $data['test_event_code'] ?: null;
        }
        if ($request->has('enabled')) {
            $destination->enabled = (bool) $data['enabled'];
        }

        $scopeType = $data['scope_type'] ?? null;
        $scopeId = $scopeType !== null ? ($data['scope_id'] ?? null) : null;
        $this->assertOwnsScope($scopeType, $scopeId);

        $destination->scope_type = $scopeType;
        $destination->scope_id = $scopeId;
    }

    /**
     * A client-supplied scope_id pointing at another seller's page/site
     * would let them silently steal that seller's events (they'd start
     * flowing into this destination's pixel instead) — every scope must
     * be verified as this owner's own before it's ever saved.
     */
    private function assertOwnsScope(?string $scopeType, ?int $scopeId): void
    {
        if ($scopeType === null) {
            return;
        }

        $shopUserIds = auth()->user()->shopUserIds();

        $owns = match ($scopeType) {
            'landing_page' => LandingPage::whereIn('user_id', $shopUserIds)->where('id', $scopeId)->exists(),
            'platform_api_key' => PlatformApiKey::where('user_id', auth()->user()->shopOwnerId())->where('id', $scopeId)->exists(),
            default => false,
        };

        abort_unless($owns, 422, 'That landing page or connected site was not found.');
    }

    /** @return array<string, mixed> */
    private function present(TrackingDestination $destination): array
    {
        return array_merge($destination->masked(), [
            'scope_label' => $this->scopeLabel($destination),
        ]);
    }

    /** Human-readable form of scope_id for the dashboard list — never re-derived on the client. */
    private function scopeLabel(TrackingDestination $destination): ?string
    {
        return match ($destination->scope_type) {
            'landing_page' => LandingPage::find($destination->scope_id)?->title,
            'platform_api_key' => PlatformApiKey::find($destination->scope_id)?->domain,
            default => null,
        };
    }
}
