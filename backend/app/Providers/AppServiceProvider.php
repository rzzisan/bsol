<?php

namespace App\Providers;

use Anthropic\Client as AnthropicClient;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // AiSupportAgentService (support_ticketing_ai_context.md) resolves this
        // from the container rather than `new`-ing it directly, so feature tests
        // can swap in a fake client via $this->app->instance(...) without ever
        // hitting the real API.
        $this->app->singleton(AnthropicClient::class, function () {
            return new AnthropicClient(apiKey: config('services.anthropic.api_key') ?? '');
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
