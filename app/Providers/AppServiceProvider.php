<?php

declare(strict_types=1);

namespace App\Providers;

use App\Callbacks\CallbackTargets;
use App\Callbacks\ImageDiscoveryCallbacks;
use App\Callbacks\ProductFinderCallbacks;
use App\Http\Middleware\RegistersCallbackLaunch;
use App\Models\CallbackLaunch;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Routing\RouteCollection;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Padosoft\ProductImageDiscovery\Http\Controllers\Api\ProductImageDiscoveryRequestController;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Resolved on every use, so the host → secret map always follows the current config.
        $this->app->bind(CallbackTargets::class, static fn (): CallbackTargets => CallbackTargets::fromConfig());
    }

    public function boot(): void
    {
        // Every console user is an operator. The panel route already requires the session login
        // and a changed password, so token-only API users (Gescat) never reach this gate.
        Gate::define('price-intelligence:admin', static fn (User $user): bool => true);

        $this->registerCallbacks();
    }

    /**
     * Signed completion callbacks (config/callbacks.php): the packages know nothing about them,
     * so this app follows their models and queue jobs and wraps their three start calls.
     */
    private function registerCallbacks(): void
    {
        $requestModel = config('product-image-discovery.models.request', ProductImageDiscoveryRequest::class);
        $candidateModel = config('product-image-discovery.models.candidate', ProductImageDiscoveryCandidate::class);

        foreach ([$requestModel, $candidateModel] as $model) {
            Event::listen('eloquent.saved: '.$model, static function (Model $saved): void {
                app(ImageDiscoveryCallbacks::class)->saved($saved);
            });
        }

        Event::listen(JobFailed::class, [ImageDiscoveryCallbacks::class, 'jobFailed']);
        Event::listen(JobProcessed::class, [ProductFinderCallbacks::class, 'jobProcessed']);
        Event::listen(JobFailed::class, [ProductFinderCallbacks::class, 'jobFailed']);

        $this->app->booted(fn () => $this->attachCallbackLaunchMiddleware());
    }

    /**
     * The package routes are registered by their own providers; the middleware goes last on each
     * start route, so it runs after their authentication and ability checks. With cached routes
     * nothing is needed: route:cache boots the app, so the cache already carries it.
     */
    private function attachCallbackLaunchMiddleware(): void
    {
        $routes = Route::getRoutes();

        if ($this->app->routesAreCached() || ! $routes instanceof RouteCollection) {
            return;
        }

        $routes->refreshNameLookups();

        // By URI: the admin panel mounts the same store action under /admin, without callbacks.
        $imageDiscoveryStore = trim((string) config('product-image-discovery.route_prefix', 'api/product-image-discovery'), '/').'/requests';

        $startRoutes = [
            CallbackLaunch::IMAGE_DISCOVERY => collect($routes->getRoutes())->first(
                static fn ($route): bool => $route->uri() === $imageDiscoveryStore
                    && in_array('POST', $route->methods(), true)
                    && $route->getActionName() === ProductImageDiscoveryRequestController::class.'@store',
            ),
            CallbackLaunch::DISCOVERY => $routes->getByName('price-intelligence.targets.discover'),
            CallbackLaunch::SCRAPE => $routes->getByName('price-intelligence.targets.scrape'),
        ];

        foreach ($startRoutes as $event => $route) {
            if ($route === null) {
                Log::warning('Callback start route not found: callbacks for it are disabled.', ['event' => $event]);

                continue;
            }

            $route->middleware(RegistersCallbackLaunch::class.':'.$event);
        }
    }
}
