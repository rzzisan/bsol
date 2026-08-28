<?php

namespace App\Services\Courier\Concerns;

use Closure;
use Illuminate\Http\Client\ConnectionException;

/**
 * Shared retry policy for outbound courier API calls (Pathao/RedX/CarryBee/
 * Paperfly/Steadfast). `Http::retry($times, $ms)` with no `when` callback
 * retries — and, worse, eventually throws — on *any* non-2xx response, not
 * just a dropped connection. Every one of these services' callers inspects
 * a failed `$response->json()['message']` directly (bad credentials,
 * invalid area, etc. are ordinary business errors here, not transient
 * faults), so retrying/throwing on those would both waste calls and
 * replace the provider's own error message with a generic wrapped
 * exception. `retryOnConnectionFailureOnly()` + `throw: false` limits
 * retrying to a genuine connection-level failure (timeout, DNS, refused)
 * and always still returns the final response as-is.
 * See `pre_launch_polish_context.md` §গ.
 */
trait CourierHttpRetry
{
    protected function retryOnConnectionFailureOnly(): Closure
    {
        return fn ($exception) => $exception instanceof ConnectionException;
    }
}
