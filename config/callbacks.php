<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Signed completion callbacks (Product Finder / image discovery → client)
|--------------------------------------------------------------------------
| A client that starts a phase (POST /api/product-image-discovery/requests,
| POST /api/v1/targets/{id}/discover:now, POST /api/v1/targets/{id}/scrape:now) may send
| `callback_url` + `correlation_id`; when the phase ends the service POSTs one signed event
| there (notify-then-fetch: the client reads the result with its usual GET calls).
*/

$rawSecrets = trim((string) env('PRODUCT_FINDER_CALLBACK_SECRETS', ''));
$secrets = $rawSecrets === '' ? [] : json_decode($rawSecrets, true);

return [
    // JSON object "host" => "HMAC secret" (or "host:port" for a non-443 port). It is also the
    // allow-list: a callback_url is accepted only over https and for a host listed here, so the
    // allow-list and the secrets cannot drift apart. Empty = callbacks are refused (422).
    'secrets' => is_array($secrets) ? $secrets : [],

    // Set but not a JSON object (quoting mistake, for example): every callback is refused and
    // CallbackTargets logs an error, without the value.
    'secrets_invalid' => ! is_array($secrets),

    // Seconds allowed for each delivery attempt.
    'timeout' => (int) env('PRODUCT_FINDER_CALLBACK_TIMEOUT', 10),

    // Delay before each retry, in seconds: 1 min, 5 min, 15 min, 1 h, 3 h, 6 h. After the last
    // one the event stays `undelivered`.
    'retry_delays' => [60, 300, 900, 3600, 10800, 21600],

    // Queue of the delivery job; empty = the connection's default queue.
    'queue' => env('PRODUCT_FINDER_CALLBACK_QUEUE'),

    // product_finder.scrape.finished waits for the attribute extraction of the new snapshots.
    // Past this many minutes (no worker on the price-intelligence `ai` queue, for example) it is
    // sent anyway by `callbacks:run-due`.
    'attributes_wait_minutes' => (int) env('PRODUCT_FINDER_CALLBACK_ATTRIBUTES_WAIT_MINUTES', 30),
];
