<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ip_location' => [
        'provider' => env('IP_LOCATION_PROVIDER', 'ipapi'),
        'ipstack_key' => env('IPSTACK_API_KEY'),
    ],

    // AiSupportAgentService (support_ticketing_ai_context.md) — server-side
    // only, never exposed to the frontend. Gated separately by
    // platform_ai_support_settings.is_enabled (the admin kill switch).
    'anthropic' => [
        'api_key' => env('ANTHROPIC_API_KEY'),
    ],

    // Meta for Developers App — see SAAS_MODULE_CONTEXT.md §16.3 for setup
    // steps (create app, add "Facebook Login for Business" + "Webhooks"
    // products, subscribe page fields feed+messages, App Review for
    // pages_messaging/pages_manage_engagement before this works for
    // non-admin testers).
    'facebook' => [
        'app_id' => env('FACEBOOK_APP_ID'),
        'login_config_id' => env('FACEBOOK_LOGIN_CONFIG_ID'),
        'app_secret' => env('FACEBOOK_APP_SECRET'),
        'webhook_verify_token' => env('FACEBOOK_WEBHOOK_VERIFY_TOKEN'),
        'graph_version' => env('FACEBOOK_GRAPH_VERSION', 'v21.0'),
        // BSOL's own acquisition-funnel Pixel — platform_marketing_tracking_context.md.
        // DB value in platform_facebook_settings wins when set (admin UI),
        // these are only the env fallback.
        'marketing_pixel_id' => env('META_PIXEL_ID'),
        'marketing_capi_access_token' => env('META_CAPI_ACCESS_TOKEN'),
        'marketing_test_event_code' => env('META_CAPI_TEST_EVENT_CODE'),
    ],

    // bKash Payment Gateway (Tokenized Checkout) — platform's own merchant
    // account, used to auto-verify subscription billing payments
    // (SAAS_MODULE_CONTEXT.md §16.4). DB value in platform_billing_settings
    // wins when set (admin UI), falls back here — same pattern as 'facebook'.
    'bkash' => [
        'app_key' => env('BKASH_APP_KEY'),
        'app_secret' => env('BKASH_APP_SECRET'),
        'username' => env('BKASH_USERNAME'),
        'password' => env('BKASH_PASSWORD'),
        'sandbox' => env('BKASH_SANDBOX', true),
    ],

];
