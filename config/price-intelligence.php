<?php

use App\Support\PriceIntelligence\AdminTenantResolver;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

// Only the keys defined here override the package config (mergeConfigFrom is shallow):
// everything else keeps the defaults from padosoft/laravel-ai-price-intelligence.
return [
    // PRICE_INTELLIGENCE_QUEUE routes every lane to one queue, PRICE_INTELLIGENCE_QUEUE_<LANE> overrides a single lane.
    'queues' => [
        'discovery' => env('PRICE_INTELLIGENCE_QUEUE_DISCOVERY', env('PRICE_INTELLIGENCE_QUEUE', 'pi-discovery')),
        'scrape' => env('PRICE_INTELLIGENCE_QUEUE_SCRAPE', env('PRICE_INTELLIGENCE_QUEUE', 'pi-scrape')),
        'enrich' => env('PRICE_INTELLIGENCE_QUEUE_ENRICH', env('PRICE_INTELLIGENCE_QUEUE', 'pi-enrich')),
        'ai' => env('PRICE_INTELLIGENCE_QUEUE_AI', env('PRICE_INTELLIGENCE_QUEUE', 'pi-ai')),
        'notifications' => env('PRICE_INTELLIGENCE_QUEUE_NOTIFICATIONS', env('PRICE_INTELLIGENCE_QUEUE', 'pi-notifications')),
    ],

    // Package defaults plus a session for same-domain browser requests, so the
    // /admin/price-intelligence panel can call /api/v1 with the admin login.
    // Machine clients (Gescat) keep authenticating with X-Api-Key and stay stateless.
    'api' => [
        'prefix' => 'api/v1',
        'middleware' => ['api', EnsureFrontendRequestsAreStateful::class],
        'register_routes' => true,
        'tenant_resolver' => AdminTenantResolver::class,
    ],
];
