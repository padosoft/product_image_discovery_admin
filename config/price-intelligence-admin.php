<?php

use App\Http\Middleware\EnsurePasswordChanged;

// Full copy of padosoft/laravel-ai-price-intelligence-admin's config (mergeConfigFrom is shallow),
// adapted to this app: the panel uses the same session login as the image-discovery admin.
return [
    'path' => env('PRICE_INTELLIGENCE_ADMIN_PATH', 'admin/price-intelligence'),

    // `price-intelligence-admin` enforces the `price-intelligence:admin` gate (AppServiceProvider).
    'middleware' => ['web', 'auth', 'auth.session', EnsurePasswordChanged::class, 'price-intelligence-admin'],

    'api_base_url' => env('PRICE_INTELLIGENCE_ADMIN_API_BASE_URL', '/api/v1'),

    // 'cookie' = session on the same domain; /api/v1 is made stateful in config/price-intelligence.php.
    'auth_mode' => env('PRICE_INTELLIGENCE_ADMIN_AUTH_MODE', 'cookie'),

    // Polling by default: an SSE stream keeps a PHP worker busy for the whole page lifetime.
    'realtime' => env('PRICE_INTELLIGENCE_ADMIN_REALTIME', 'polling'),

    'realtime_poll_interval_ms' => (int) env('PRICE_INTELLIGENCE_ADMIN_REALTIME_POLL_MS', 15000),

    // Tenant code every admin user works on (App\Support\PriceIntelligence\AdminTenantResolver).
    'tenant_code' => env('PRICE_INTELLIGENCE_ADMIN_TENANT', 'gescat'),
];
