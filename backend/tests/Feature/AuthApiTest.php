<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_through_the_api(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Alice Doe',
            'email' => 'alice@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Registration successful.')
            ->assertJsonPath('user.email', 'alice@example.com')
            ->assertJsonStructure([
                'message',
                'token',
                'user' => ['id', 'name', 'email'],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'alice@example.com',
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
}