<?php

use Padosoft\ProductImageDiscovery\Jobs\IngestProductImageDiscoveryJob;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoverySetting;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;
use Padosoft\ProductImageDiscovery\Models\ProductImageTrustedSource;

return [
    'route_prefix' => env('PRODUCT_IMAGE_DISCOVERY_ROUTE_PREFIX', 'api/product-image-discovery'),
    'route_middleware' => array_values(array_filter(explode(',', env('PRODUCT_IMAGE_DISCOVERY_ROUTE_MIDDLEWARE', 'api,auth:sanctum')))),
    'abilities' => [
        'read' => 'product-image-discovery:read',
        'write' => 'product-image-discovery:write',
        'admin' => 'product-image-discovery:admin',
        'review' => 'product-image-discovery:review',
        'settings' => 'product-image-discovery:settings',
    ],
    'models' => [
        'request' => ProductImageDiscoveryRequest::class,
        'candidate' => ProductImageDiscoveryCandidate::class,
        'setting' => ProductImageDiscoverySetting::class,
        'trusted_source' => ProductImageTrustedSource::class,
        'search_provider' => ProductImageSearchProvider::class,
        'event' => ProductImageDiscoveryEvent::class,
    ],
    'jobs' => [
        'ingest' => IngestProductImageDiscoveryJob::class,
    ],
    // Queue per pipeline stage. PRODUCT_IMAGE_DISCOVERY_QUEUE routes every stage to one queue,
    // PRODUCT_IMAGE_DISCOVERY_QUEUE_<STAGE> overrides a single stage. fetch/enhance/description
    // have no job in the package yet and are kept only for forward compatibility.
    'queues' => [
        'ingest' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_INGEST', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-ingest')),
        'search' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_SEARCH', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-search')),
        'fetch' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_FETCH', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-fetch')),
        'extract' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_EXTRACT', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-extract')),
        'verify' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_VERIFY', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-verify')),
        'download' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_DOWNLOAD', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-download')),
        'quality' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_QUALITY', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-quality')),
        'enhance' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_ENHANCE', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-enhance')),
        'description' => env('PRODUCT_IMAGE_DISCOVERY_QUEUE_DESCRIPTION', env('PRODUCT_IMAGE_DISCOVERY_QUEUE', 'image-discovery-description')),
    ],
    'storage' => [
        'disk' => env('PRODUCT_IMAGE_DISCOVERY_STORAGE_DISK', 'local'),
    ],
    'debug' => [
        'stop_on_first_good' => env('PRODUCT_IMAGE_DISCOVERY_DEBUG_STOP_ON_FIRST_GOOD', true),
        'good_score_threshold' => (int) env('PRODUCT_IMAGE_DISCOVERY_DEBUG_GOOD_SCORE_THRESHOLD', 65),
    ],
    'defaults' => [
        'search_max_queries_per_product' => 8,
        'search_max_results_per_query' => 20,
        'quality_min_width' => 800,
        'quality_min_height' => 800,
        'auto_publish_threshold' => 90,
        'manual_review_threshold' => 60,
        'reject_below_threshold' => 60,
    ],
    'ai' => [
        'enabled' => env('PRODUCT_IMAGE_DISCOVERY_AI_ENABLED', false),
        'provider' => env('PRODUCT_IMAGE_DISCOVERY_AI_PROVIDER', 'anthropic'),
        'timeout' => (int) env('PRODUCT_IMAGE_DISCOVERY_AI_TIMEOUT', 45),
        'fail_silently' => env('PRODUCT_IMAGE_DISCOVERY_AI_FAIL_SILENTLY', true),
        'attach_remote_image' => env('PRODUCT_IMAGE_DISCOVERY_AI_ATTACH_REMOTE_IMAGE', false),
        'vision_model' => env('PRODUCT_IMAGE_DISCOVERY_AI_VISION_MODEL'),
        'description_model' => env('PRODUCT_IMAGE_DISCOVERY_AI_DESCRIPTION_MODEL'),
        'providers' => [
            'openai' => [
                'api_key' => env('OPENAI_API_KEY'),
                'base_url' => env('OPENAI_URL', env('OPENAI_BASE_URL')),
            ],
            'anthropic' => [
                'api_key' => env('ANTHROPIC_API_KEY'),
                'base_url' => env('ANTHROPIC_URL', env('ANTHROPIC_BASE_URL')),
            ],
            'openrouter' => [
                'api_key' => env('OPENROUTER_API_KEY'),
                'base_url' => env('OPENROUTER_URL', env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')),
            ],
            'regolo' => [
                'api_key' => env('REGOLO_API_KEY'),
                'base_url' => env('REGOLO_URL', env('REGOLO_BASE_URL', 'https://api.regolo.ai/v1')),
            ],
        ],
    ],
];
