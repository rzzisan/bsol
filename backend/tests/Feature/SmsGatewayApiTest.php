<?php

namespace Tests\Feature;

use App\Models\SmsGateway;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SmsGatewayApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_gateway_list_survives_unreadable_encrypted_credentials(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test-suite')->plainTextToken;

        DB::table('sms_gateways')->insert([
            'name' => 'Broken Gateway',
            'provider' => 'khudebarta',
            'endpoint_url' => 'https://example.com/send',
            'api_key' => 'not-a-valid-encrypted-payload',
            'secret_key' => 'still-not-valid',
            'sender_id' => 'Sender',
            'is_active' => true,
            'is_enabled' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->getJson('/api/admin/sms/gateways', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('gateways.0.name', 'Broken Gateway')
            ->assertJsonPath('gateways.0.has_api_key', true)
            ->assertJsonPath('gateways.0.has_secret_key', true)
            ->assertJsonPath('gateways.0.api_key_masked', '[unreadable]')
            ->assertJsonPath('gateways.0.secret_key_masked', '[unreadable]')
            ->assertJsonPath('gateways.0.credentials_decryptable', false);
    }

    public function test_send_endpoint_returns_clear_message_when_gateway_credentials_cannot_be_decrypted(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $token = $admin->createToken('test-suite')->plainTextToken;

        $gatewayId = DB::table('sms_gateways')->insertGetId([
            'name' => 'Broken Gateway',
            'provider' => 'khudebarta',
            'endpoint_url' => 'https://example.com/send',
            'api_key' => 'not-a-valid-encrypted-payload',
            'secret_key' => 'still-not-valid',
            'sender_id' => 'Sender',
            'is_active' => true,
            'is_enabled' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->postJson('/api/admin/sms/send', [
            'gateway_id' => $gatewayId,
            'phone_number' => '01700000000',
            'message' => 'Test SMS',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertStatus(500)
            ->assertJsonPath(
                'message',
                'SMS gateway credentials could not be decrypted. Verify Dokploy APP_KEY or re-save the gateway credentials.',
            );
    }
}
