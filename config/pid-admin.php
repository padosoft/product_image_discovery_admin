<?php

return [
    'route_prefix' => env('PID_ADMIN_ROUTE_PREFIX', 'admin/product-image-discovery'),
    'route_middleware' => array_values(array_filter(explode(',', env('PID_ADMIN_ROUTE_MIDDLEWARE', 'web')))),
    'debug_run_middleware' => array_values(array_filter(explode(',', env('PID_ADMIN_DEBUG_RUN_MIDDLEWARE', 'auth')))),
    'package_api_prefix' => env('PRODUCT_IMAGE_DISCOVERY_ROUTE_PREFIX', 'api/product-image-discovery'),
];
