<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

// The legacy server-rendered Blade fallback for /lp/{slug} (LandingPageViewController
// + resources/views/landing-pages/show.blade.php) was removed 2026-08-08 — it never
// had OTP/custom-checkout-field support, and in production nginx routes everything
// under `/` (including /lp/*) to the Next.js frontend (see /etc/nginx/sites-available/default),
// so this Laravel route was unreachable dead code. The real public landing page is
// frontend/src/app/lp/[slug]/page.tsx via the /api/public/landing-pages/{slug} API.
// (landing_page_context.md §15)
