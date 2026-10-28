<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Callbacks\CallbackLaunches;
use App\Callbacks\CallbackTargets;
use App\Callbacks\ImageDiscoveryCallbacks;
use App\Callbacks\ProductFinderCallbacks;
use App\Models\CallbackLaunch;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Validator;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attached by AppServiceProvider to the three start calls of the packages, after their own
 * authentication. A body with `callback_url` + `correlation_id` opens a launch whose phase end
 * is reported to that URL; the URL must be https and its host configured (422 otherwise, before
 * anything is queued). Without `callback_url` the call behaves exactly as before.
 */
final class RegistersCallbackLaunch
{
    public function __construct(
        private readonly CallbackTargets $targets,
        private readonly CallbackLaunches $launches,
        private readonly ImageDiscoveryCallbacks $imageDiscovery,
        private readonly ProductFinderCallbacks $productFinder,
    ) {}

    public function handle(Request $request, Closure $next, string $event): Response
    {
        $callback = $this->callback($request);

        return $event === CallbackLaunch::IMAGE_DISCOVERY
            ? $this->imageDiscovery($request, $next, $callback)
            : $this->productFinder($request, $next, $event, $callback);
    }

    /**
     * @return array{callback_url: string, correlation_id: string}|null
     */
    private function callback(Request $request): ?array
    {
        if (! $request->filled('callback_url')) {
            return null;
        }

        $validated = Validator::make($request->only(['callback_url', 'correlation_id']), [
            'callback_url' => ['required', 'string', 'max:2048', function (string $attribute, mixed $value, Closure $fail): void {
                if (! $this->targets->allows($value)) {
                    $fail('The callback url must be an https URL whose host is allowed to receive callbacks.');
                }
            }],
            'correlation_id' => ['required', 'string', 'max:191'],
        ])->validate();

        return ['callback_url' => $validated['callback_url'], 'correlation_id' => $validated['correlation_id']];
    }

    /**
     * POST /requests reuses the request of the same article (client_id + erp_model_color_id)
     * and starts a new search run: the callbacks still due for the previous start call are
     * superseded first, also when this one asks for none. The new launch is opened once the
     * controller succeeded and only counts runs numbered above the request's attempts at this
     * point, so the outcome of the previous run never fires it.
     *
     * @param  array{callback_url: string, correlation_id: string}|null  $callback
     */
    private function imageDiscovery(Request $request, Closure $next, ?array $callback): Response
    {
        $model = config('product-image-discovery.models.request', ProductImageDiscoveryRequest::class);
        $existing = $request->filled(['client_id', 'erp_model_color_id'])
            ? $model::query()
                ->where('client_id', $request->input('client_id'))
                ->where('erp_model_color_id', $request->input('erp_model_color_id'))
                ->first(['id', 'attempts'])
            : null;

        [, $superseded] = $existing === null
            ? [null, []]
            : $this->launches->open(CallbackLaunch::IMAGE_DISCOVERY, ImageDiscoveryCallbacks::RESOURCE_TYPE, $existing->getKey(), null);

        $response = $next($request);

        if (! $response->isSuccessful()) {
            $this->launches->rollback(null, $superseded);

            return $response;
        }

        $requestId = $existing?->getKey() ?? ($this->json($response)['request_id'] ?? null);

        if ($callback === null || (! is_int($requestId) && ! is_string($requestId))) {
            return $response;
        }

        [$launch] = $this->launches->open(
            CallbackLaunch::IMAGE_DISCOVERY,
            ImageDiscoveryCallbacks::RESOURCE_TYPE,
            $requestId,
            $callback,
            ['after_run' => (int) ($existing?->getAttribute('attempts') ?? 0)],
        );

        // The pipeline may already have finished (sync queue, fast worker).
        $this->imageDiscovery->evaluate($launch->resource_id);

        return $response;
    }

    /**
     * discover:now / scrape:now queue independent jobs: a call without callback_url (an
     * operator in the panel) leaves a pending launch alone, a call with one supersedes it.
     *
     * @param  array{callback_url: string, correlation_id: string}|null  $callback
     */
    private function productFinder(Request $request, Closure $next, string $event, ?array $callback): Response
    {
        $targetId = $request->route('id');

        if ($callback === null || $targetId === null) {
            return $next($request);
        }

        [$launch, $superseded] = $this->launches->open(
            $event,
            ProductFinderCallbacks::RESOURCE_TYPE,
            (string) $targetId,
            $callback,
            $event === CallbackLaunch::SCRAPE ? $this->productFinder->scrapeBaseline() : [],
        );

        // Carried by Laravel into the jobs this call queues (and the jobs those queue).
        Context::addHidden(ProductFinderCallbacks::CONTEXT_KEY, $launch->token);

        try {
            $response = $next($request);
        } finally {
            Context::forgetHidden(ProductFinderCallbacks::CONTEXT_KEY);
        }

        if (! $response->isSuccessful()) {
            $this->launches->rollback($launch, $superseded);

            return $response;
        }

        if ($event === CallbackLaunch::SCRAPE) {
            $this->productFinder->expectScrapes($launch, (int) ($this->json($response)['data']['queued'] ?? 0));
        }

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    private function json(Response $response): array
    {
        $data = $response instanceof JsonResponse
            ? $response->getData(true)
            : json_decode((string) $response->getContent(), true);

        return is_array($data) ? $data : [];
    }
}
