<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_through_the_api(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Alice Doe',
            'mobile' => '01700000000',
            'email' => 'alice@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Registration successful.')
            ->assertJsonPath('user.email', 'alice@example.com')
            ->assertJsonPath('user.role', 'user')
            ->assertJsonStructure([
                'message',
                'token',
                'user' => ['id', 'name', 'mobile', 'email', 'role'],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'alice@example.com',
            'mobile' => '01700000000',
            'role' => 'user',
        ]);
    }

    public function test_user_can_login_and_fetch_profile(): void
    {
        $user = User::factory()->create([
            'email' => 'bob@example.com',
            'password' => Hash::make('secret-pass'),
        ]);

        $loginResponse = $this->postJson('/api/login', [
            'email' => 'bob@example.com',
            'password' => 'secret-pass',
        ]);

        $token = $loginResponse->json('token');

        $loginResponse
            ->assertOk()
            ->assertJsonPath('message', 'Login successful.')
            ->assertJsonPath('user.email', $user->email);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_login_requires_valid_credentials(): void
    {
        User::factory()->create([
            'email' => 'carol@example.com',
            'password' => Hash::make('valid-pass'),
        ]);

        $this->postJson('/api/login', [
            'email' => 'carol@example.com',
            'password' => 'wrong-pass',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_authenticated_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-suite')->plainTextToken;

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Logout successful.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_authenticated_user_can_update_own_profile(): void
    {
        $user = User::factory()->create([
            'name' => 'Old Name',
            'email' => 'old@example.com',
            'mobile' => '01711111111',
            'email_verified_at' => Carbon::now(),
            'password' => Hash::make('old-password'),
        ]);

        $token = $user->createToken('test-suite')->plainTextToken;

        $response = $this->putJson('/api/me', [
            'name' => 'Updated Name',
            'mobile' => '01722222222',
            'email' => 'updated@example.com',
            'current_password' => 'old-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('message', 'Profile updated successfully.')
            ->assertJsonPath('user.name', 'Updated Name')
            ->assertJsonPath('user.mobile', '01722222222')
            ->assertJsonPath('user.email', 'updated@example.com');

        $user->refresh();

        $this->assertSame('Updated Name', $user->name);
        $this->assertSame('01722222222', $user->mobile);
        $this->assertSame('updated@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
        $this->assertTrue(Hash::check('new-password', $user->password));
    }

    public function test_profile_password_update_requires_valid_current_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('old-password'),
        ]);

        $token = $user->createToken('test-suite')->plainTextToken;

        $response = $this->putJson('/api/me', [
            'current_password' => 'wrong-current-password',
            'password' => 'new-password',
            'password_confirmation' => 'new-password',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $user->refresh();
        $this->assertTrue(Hash::check('old-password', $user->password));
    }
}