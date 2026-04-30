<?php

return [
    'route_prefix' => env('PID_ADMIN_ROUTE_PREFIX', 'admin/product-image-discovery'),
    'route_middleware' => array_values(array_filter(explode(',', env('PID_ADMIN_ROUTE_MIDDLEWARE', 'web')))),
    'package_api_prefix' => env('PRODUCT_IMAGE_DISCOVERY_ROUTE_PREFIX', 'api/product-image-discovery'),
];
