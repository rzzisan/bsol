<?php

namespace App\Providers;

use App\Models\Funnel;
use App\Models\LandingPage;
use App\Policies\FunnelPolicy;
use App\Policies\LandingPagePolicy;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    protected $policies = [
        Funnel::class => FunnelPolicy::class,
        LandingPage::class => LandingPagePolicy::class,
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
