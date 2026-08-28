<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // domain_security_audit.md §I-2 — tightened from '*' to the platform
    // apex + every seller subdomain. Not a token-leak fix by itself (the
    // Bearer token lives in localStorage, origin-scoped and unreadable by
    // any other site regardless of this setting, and supports_credentials
    // stays false below) — this is defense-in-depth once the seller-
    // subdomain set is a known, closed shape, per the audit's own
    // assessment. Every legitimate call in this app is already same-origin
    // (frontend/src/proxy.ts, storefront-client.ts, public-landing-page-
    // view.tsx all use relative /api/... paths), so this should never
    // actually reject a real caller.
    'allowed_origins' => [],

    'allowed_origins_patterns' => [
        '#^https://([a-z0-9-]+\.)?' . preg_quote(env('SUBDOMAIN_APEX', 'zyrotechbd.com'), '#') . '$#i',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
