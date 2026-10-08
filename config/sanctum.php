<?php

return [
    // APP_URL's host is always stateful so the price-intelligence panel works on the deployed domain.
    'stateful' => array_values(array_filter(array_unique([
        ...explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,127.0.0.1,127.0.0.1:8000')),
        // Sanctum returns ",host:port" (meant for string concatenation): drop the leading comma.
        ltrim(Laravel\Sanctum\Sanctum::currentApplicationUrlWithPort(), ','),
    ]))),
    'guard' => ['web'],
    'expiration' => null,
    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),
    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],
];
