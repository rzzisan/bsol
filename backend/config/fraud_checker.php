<?php

return [

    // How long a successful courier fraud-check result stays fresh before re-fetching.
    'cache_ttl_hours' => env('FRAUD_CHECKER_CACHE_TTL_HOURS', 24),

    // How long a failed fetch (bad creds, courier changed its login flow, rate limit) is
    // left alone before retrying, so a broken courier isn't hit on every single check.
    'error_cooldown_minutes' => env('FRAUD_CHECKER_ERROR_COOLDOWN_MINUTES', 30),

    // HTTP timeout (seconds) for each courier login/lookup request.
    'http_timeout' => env('FRAUD_CHECKER_HTTP_TIMEOUT', 15),

];
