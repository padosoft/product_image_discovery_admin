<?php

declare(strict_types=1);

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Padosoft\ProductImageDiscovery\Http\Middleware\EnsureProductImageDiscoveryAbility;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'pid.ability' => EnsureProductImageDiscoveryAbility::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(static function ($request, Throwable $e): bool {
            // Guests navigating admin pages must be redirected to /login, so authentication failures
            // render JSON only when the client asks for it (the React shell sends Accept: application/json).
            if ($e instanceof AuthenticationException) {
                return $request->expectsJson() || $request->is('api/*');
            }

            $adminPrefix = trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/');

            return $request->expectsJson()
                || $request->is('api/*')
                || $request->is($adminPrefix)
                || $request->is($adminPrefix.'/*');
        });
    })
    ->create();
