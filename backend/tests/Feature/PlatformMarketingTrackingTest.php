<?php

namespace Tests\Feature;

use App\Jobs\SendPlatformMarketingEventJob;
use App\Models\PhoneOtpVerification;
use App\Models\PlatformFacebookSetting;
use App\Models\PlatformMarketingEvent;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\Marketing\PlatformMarketingEventService;
use App\Services\SubscriptionActivationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * BSOL's own acquisition-funnel tracking (platform_marketing_tracking_context.md)
 * — CompleteRegistration at signup, Subscribe at paid activation. Deliberately
 * separate from tracking_capi_context.md's seller-facing pipeline, so these
 * tests don't touch TrackingDestination/TrackingEvent at all.
 */
class PlatformMarketingTrackingTest extends TestCase
{
    use RefreshDatabase;

    private function configurePixel(): void
    {
        PlatformFacebookSetting::getSetting()->update([
            'marketing_pixel_id' => 'px_marketing_123',
            'marketing_capi_access_token' => 'marketing-secret-token',
        ]);
    }

    // -- Registration -------------------------------------------------------------

    public function test_send_registration_otp_stores_utm_and_click_attribution_in_pending_data(): void
    {
        $this->postJson('/api/otp/register', [
            'name' => 'Karim Uddin',
            'mobile' => '01712345678',
            'email' => 'karim@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'utm_source' => 'facebook',
            'utm_medium' => 'cpc',
            'utm_campaign' => 'launch',
            'fbclid' => 'clickid123',
            'landing_path' => '/',
        ])->assertOk();

        $record = PhoneOtpVerification::where('purpose', 'registration')->sole();

        $this->assertSame('facebook', $record->pending_data['signup_utm_source']);
        $this->assertSame('cpc', $record->pending_data['signup_utm_medium']);
        $this->assertSame('launch', $record->pending_data['signup_utm_campaign']);
        $this->assertSame('/', $record->pending_data['signup_landing_path']);
        // No _fbc cookie was sent, so it's synthesized from fbclid the same
        // way Meta's own Pixel would (TrackingUserDataBuilder::fbcFromClickId).
        $this->assertStringContainsString('fb.1.', $record->pending_data['signup_fbc']);
        $this->assertStringContainsString('clickid123', $record->pending_data['signup_fbc']);
        $this->assertNotNull($record->pending_data['signup_ip']);
    }

    public function test_verify_registration_persists_attribution_on_the_user_and_queues_complete_registration(): void
    {
        $this->configurePixel();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $token = str_repeat('t', 64);
        PhoneOtpVerification::create([
            'token' => $token,
            'mobile' => '8801700000001',
            'otp_code' => '123456',
            'purpose' => 'registration',
            'pending_data' => [
                'name' => 'OTP User',
                'mobile_raw' => '01700000001',
                'email' => 'otp-attrib@example.com',
                'password' => Hash::make('password123'),
                'signup_utm_source' => 'facebook',
                'signup_utm_medium' => 'cpc',
                'signup_fbp' => 'fb.1.111.222',
                'signup_fbc' => 'fb.1.111.333',
                'signup_landing_path' => '/',
                'signup_ip' => '10.0.0.1',
                'signup_user_agent' => 'PHPUnit',
            ],
            'attempts' => 0,
            'resend_count' => 0,
            'expires_at' => now()->addMinutes(5),
        ]);

        $this->postJson('/api/otp/verify-registration', ['token' => $token, 'otp' => '123456'])
            ->assertCreated();

        $user = User::where('email', 'otp-attrib@example.com')->sole();
        $this->assertSame('facebook', $user->signup_utm_source);
        $this->assertSame('cpc', $user->signup_utm_medium);
        $this->assertSame('fb.1.111.222', $user->signup_fbp);
        $this->assertSame('fb.1.111.333', $user->signup_fbc);

        $event = PlatformMarketingEvent::sole();
        $this->assertSame('CompleteRegistration', $event->event_name);
        $this->assertSame('reg_' . $token, $event->event_id);
        $this->assertSame($user->id, $event->user_id);
        $this->assertSame('website', $event->action_source);
        $this->assertSame(PlatformMarketingEvent::STATUS_SENT, $event->status);
        $this->assertSame('fb.1.111.222', $event->user_data_hashed['fbp']);
        $this->assertSame([hash('sha256', '8801700000001')], $event->user_data_hashed['ph']);
        $this->assertSame([hash('sha256', (string) $user->id)], $event->user_data_hashed['external_id']);
        $this->assertStringContainsString('/', $event->custom_data['event_source_url']);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/px_marketing_123/events')
            && $request['access_token'] === 'marketing-secret-token'
            && $request['data'][0]['event_id'] === 'reg_' . $token
            && $request['data'][0]['action_source'] === 'website'
            && ! empty($request['data'][0]['event_source_url']));
    }

    // -- Dedup ----------------------------------------------------------------------

    public function test_a_repeated_event_id_is_never_sent_twice(): void
    {
        $this->configurePixel();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $service = app(PlatformMarketingEventService::class);
        $service->track('CompleteRegistration', 'reg_dup', ['ph' => '8801700000002']);
        $service->track('CompleteRegistration', 'reg_dup', ['ph' => '8801700000002']);

        $this->assertSame(1, PlatformMarketingEvent::count());
        Http::assertSentCount(1);
    }

    // -- Subscribe --------------------------------------------------------------

    public function test_subscription_activation_queues_subscribe_with_value_and_stored_attribution(): void
    {
        $this->configurePixel();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $package = SubscriptionPackage::create([
            'name' => 'Pro', 'slug' => 'pro-' . uniqid(), 'price' => 999, 'duration_days' => 30,
        ]);
        $user = User::factory()->create([
            'signup_fbp' => 'fb.1.999.111',
            'signup_fbc' => 'fb.1.999.222',
        ]);
        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'amount' => 999,
            'base_amount' => 999,
            'status' => 'approved',
        ]);

        app(SubscriptionActivationService::class)->activate($payment);

        $event = PlatformMarketingEvent::where('event_name', 'Subscribe')->sole();
        $this->assertSame('sub_' . $payment->id, $event->event_id);
        $this->assertSame($user->id, $event->user_id);
        $this->assertEquals(999.0, $event->custom_data['value']);
        $this->assertSame('BDT', $event->custom_data['currency']);
        $this->assertSame('fb.1.999.111', $event->user_data_hashed['fbp']);
        $this->assertSame([hash('sha256', (string) $user->id)], $event->user_data_hashed['external_id']);
        $this->assertStringContainsString('/dashboard/settings/subscription', $event->custom_data['event_source_url']);
        // Not a live browser request (admin/webhook triggered) — must not
        // claim 'website' without the client_user_agent that requires.
        $this->assertSame('system_generated', $event->action_source);
        $this->assertSame(PlatformMarketingEvent::STATUS_SENT, $event->status);
    }

    // -- Failure without credentials ---------------------------------------------

    public function test_the_job_fails_without_sending_when_no_pixel_is_configured(): void
    {
        Http::fake();

        $row = PlatformMarketingEvent::create([
            'event_name' => 'CompleteRegistration',
            'event_id' => 'reg_noconfig',
            'user_data_hashed' => ['ph' => [hash('sha256', '8801700000003')]],
            'status' => PlatformMarketingEvent::STATUS_QUEUED,
        ]);

        app()->call([new SendPlatformMarketingEventJob($row->id), 'handle']);

        $row->refresh();
        $this->assertSame(PlatformMarketingEvent::STATUS_FAILED, $row->status);
        $this->assertStringContainsString('No marketing Pixel', $row->error_message);
        Http::assertNothingSent();
    }

    // -- Admin settings ------------------------------------------------------------

    public function test_admin_can_save_and_the_response_masks_the_access_token(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => 'admin']));

        $this->putJson('/api/admin/settings/facebook', [
            'marketing_pixel_id' => 'px_555',
            'marketing_capi_access_token' => 'brand-new-token',
        ])->assertOk()
            ->assertJsonPath('data.marketing_pixel_id', 'px_555')
            ->assertJsonPath('data.marketing_capi_access_token_set', true)
            ->assertJsonMissingPath('data.marketing_capi_access_token');

        $this->assertSame('brand-new-token', PlatformFacebookSetting::getSetting()->marketing_capi_access_token);

        // A blank resubmit must not clobber the token already saved.
        $this->putJson('/api/admin/settings/facebook', [
            'marketing_pixel_id' => 'px_555',
            'marketing_capi_access_token' => '',
        ])->assertOk()
            ->assertJsonPath('data.marketing_capi_access_token_set', true);

        $this->assertSame('brand-new-token', PlatformFacebookSetting::getSetting()->fresh()->marketing_capi_access_token);
    }

    // -- Public Pixel ID endpoint ----------------------------------------------

    public function test_the_public_endpoint_exposes_only_the_pixel_id_never_the_access_token(): void
    {
        $this->configurePixel();

        $this->getJson('/api/public/marketing-pixel')
            ->assertOk()
            ->assertJsonPath('data.pixel_id', 'px_marketing_123')
            ->assertJsonMissingPath('data.marketing_capi_access_token');
    }

    public function test_the_public_endpoint_returns_null_when_unconfigured(): void
    {
        $this->getJson('/api/public/marketing-pixel')
            ->assertOk()
            ->assertJsonPath('data.pixel_id', null);
    }

    // -- Same-origin relay (ad-blocker fallback) -----------------------------

    public function test_the_relay_endpoint_ingests_an_allowed_event(): void
    {
        $this->configurePixel();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $this->postJson('/api/public/marketing-track', [
            'event_name' => 'ViewContent',
            'event_id' => 'relay_1',
            'event_source_url' => 'https://bsol.zyrotechbd.com/',
            'custom_data' => ['content_name' => 'features'],
            'user_data' => ['fbp' => 'fb.1.1.1'],
        ])->assertOk()->assertJson(['success' => true]);

        $event = PlatformMarketingEvent::sole();
        $this->assertSame('ViewContent', $event->event_name);
        $this->assertSame('relay_1', $event->event_id);
        $this->assertNull($event->user_id); // anonymous visitor
        $this->assertSame('fb.1.1.1', $event->user_data_hashed['fbp']);
        $this->assertSame(PlatformMarketingEvent::STATUS_SENT, $event->status);
    }

    public function test_the_relay_endpoint_rejects_an_event_name_outside_the_allowlist(): void
    {
        $this->postJson('/api/public/marketing-track', [
            'event_name' => 'Purchase', // never client-triggerable — only OtpController/SubscriptionActivationService may fire real conversions
            'event_id' => 'relay_2',
        ])->assertStatus(422);

        $this->assertSame(0, PlatformMarketingEvent::count());
    }

    public function test_the_relay_endpoint_synthesizes_fbc_from_fbclid_when_no_cookie_was_present(): void
    {
        $this->configurePixel();
        Http::fake(['graph.facebook.com/*' => Http::response(['events_received' => 1], 200)]);

        $this->postJson('/api/public/marketing-track', [
            'event_name' => 'ScrollDepth',
            'event_id' => 'relay_3',
            'custom_data' => ['percentage' => 75],
            'user_data' => ['fbclid' => 'clickid456'],
        ])->assertOk();

        $stored = PlatformMarketingEvent::sole()->user_data_hashed;
        $this->assertStringContainsString('fb.1.', $stored['fbc']);
        $this->assertStringContainsString('clickid456', $stored['fbc']);
    }
}
