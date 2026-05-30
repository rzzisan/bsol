<?php

use App\Http\Controllers\LandingPageViewController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::middleware('track_landing_page_visit')->group(function () {
    Route::get('/lp/{slug}', [LandingPageViewController::class, 'show'])->name('landing-pages.show');
    Route::post('/lp/{slug}/order', [LandingPageViewController::class, 'submitOrder'])->name('landing-pages.order');
});
