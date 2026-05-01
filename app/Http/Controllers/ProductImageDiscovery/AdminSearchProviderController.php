<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Padosoft\ProductImageDiscovery\Http\Concerns\ResolvesProductImageDiscovery;
use Padosoft\ProductImageDiscovery\Http\Requests\UpsertProductImageSearchProviderRequest;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoverySearchProviderResource;
use Padosoft\ProductImageDiscovery\Services\Search\Data\ProductImageSearchQueryData;
use Padosoft\ProductImageDiscovery\Services\Search\Data\SearchProviderDefinition;
use Padosoft\ProductImageDiscovery\Services\Search\SearchProviderConfigRepositoryInterface;
use Padosoft\ProductImageDiscovery\Services\Search\SearchProviderFactoryInterface;
use Padosoft\ProductImageDiscovery\Services\Search\SearchProviderManager;
use ReflectionClass;
use ReflectionException;

final class AdminSearchProviderController extends Controller
{
    use ResolvesProductImageDiscovery;

    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = max(1, min(100, (int) $request->integer('per_page', 25)));

        return ProductImageDiscoverySearchProviderResource::collection(
            $this->newQuery('search_provider')->orderBy('priority')->orderBy('code')->paginate($perPage)
        );
    }

    public function store(UpsertProductImageSearchProviderRequest $request): ProductImageDiscoverySearchProviderResource
    {
        $record = $this->newQuery('search_provider')->create($this->payloadWithWriteOnlySecrets($request->validated()));

        return new ProductImageDiscoverySearchProviderResource($record);
    }

    public function show(int|string $searchProvider): ProductImageDiscoverySearchProviderResource
    {
        return new ProductImageDiscoverySearchProviderResource($this->newQuery('search_provider')->findOrFail($searchProvider));
    }

    public function update(UpsertProductImageSearchProviderRequest $request, int|string $searchProvider): ProductImageDiscoverySearchProviderResource
    {
        $record = $this->newQuery('search_provider')->findOrFail($searchProvider);
        $record->fill($this->payloadWithWriteOnlySecrets($request->validated()));
        $record->save();

        return new ProductImageDiscoverySearchProviderResource($record);
    }

    public function destroy(int|string $searchProvider): Response
    {
        $record = $this->newQuery('search_provider')->findOrFail($searchProvider);
        $record->delete();

        return response()->noContent();
    }

    public function test(Request $request, int|string $searchProvider): JsonResponse
    {
        $record = $this->newQuery('search_provider')->findOrFail($searchProvider);
        $validated = $request->validate([
            'mode' => ['nullable', 'string', 'in:images,web'],
            'query' => ['nullable', 'string', 'max:200'],
            'brand' => ['nullable', 'string', 'max:120'],
            'model' => ['nullable', 'string', 'max:120'],
            'color' => ['nullable', 'string', 'max:80'],
            'ean' => ['nullable', 'string', 'max:80'],
            'supplier_sku' => ['nullable', 'string', 'max:120'],
            'site' => ['nullable', 'string', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);

        $definition = $this->definitionForProvider($record);
        $query = ProductImageSearchQueryData::fromArray([
            'query' => $validated['query'] ?? 'product image discovery provider test',
            'brand' => $validated['brand'] ?? null,
            'model' => $validated['model'] ?? null,
            'color' => $validated['color'] ?? null,
            'ean' => $validated['ean'] ?? null,
            'supplier_sku' => $validated['supplier_sku'] ?? null,
            'site' => $validated['site'] ?? null,
            'limit' => $validated['limit'] ?? 1,
            'metadata' => ['admin_test' => true],
        ]);

        $mode = $validated['mode'] ?? 'images';
        $started = hrtime(true);
        $result = $this->singleProviderManager($definition, app(SearchProviderManager::class))
            ->{$mode === 'web' ? 'searchWeb' : 'searchImages'}($query);
        $latencyMs = (int) round((hrtime(true) - $started) / 1_000_000);
        $attempts = $this->safeAttempts($result->attempts, $record);
        $lastAttempt = $attempts[array_key_last($attempts)] ?? [];
        $status = $result->results->count() > 0 ? 'success' : (string) ($lastAttempt['status'] ?? 'empty');

        return response()->json([
            'data' => [
                'provider_id' => $record->getKey(),
                'code' => $record->getAttribute('code'),
                'driver' => $record->getAttribute('driver'),
                'provider_active' => (bool) $record->getAttribute('is_active'),
                'has_api_key' => filled($record->getRawOriginal('api_key_encrypted')),
                'has_api_secret' => filled($record->getRawOriginal('api_secret_encrypted')),
                'mode' => $mode,
                'status' => $status,
                'latency_ms' => $latencyMs,
                'results_count' => $result->results->count(),
                'attempts' => $attempts,
                'message' => $this->statusMessage($status),
                'tested_at' => now()->toJSON(),
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function payloadWithWriteOnlySecrets(array $payload): array
    {
        foreach (['api_key' => 'api_key_encrypted', 'api_secret' => 'api_secret_encrypted'] as $inputKey => $storageKey) {
            if (! array_key_exists($inputKey, $payload)) {
                continue;
            }

            $value = $payload[$inputKey];
            unset($payload[$inputKey]);

            $payload[$storageKey] = is_string($value) && trim($value) !== '' ? $value : null;
        }

        return $payload;
    }

    private function definitionForProvider(Model $provider): SearchProviderDefinition
    {
        return SearchProviderDefinition::fromArray([
            'code' => $provider->getAttribute('code'),
            'name' => $provider->getAttribute('name'),
            'driver' => $provider->getAttribute('driver'),
            'base_url' => $provider->getAttribute('base_url'),
            'api_key' => $provider->getAttribute('api_key_encrypted'),
            'api_secret' => $provider->getAttribute('api_secret_encrypted'),
            'config' => $provider->getAttribute('config') ?? [],
            'priority' => $provider->getAttribute('priority'),
            'timeout_seconds' => $provider->getAttribute('timeout_seconds'),
            'rate_limit_per_minute' => $provider->getAttribute('rate_limit_per_minute'),
            'is_active' => true,
        ]);
    }

    private function singleProviderManager(SearchProviderDefinition $definition, SearchProviderManager $sourceManager): SearchProviderManager
    {
        $repository = new class($definition) implements SearchProviderConfigRepositoryInterface {
            public function __construct(private readonly SearchProviderDefinition $definition)
            {
            }

            public function getActiveProviders(): array
            {
                return [$this->definition];
            }
        };

        return new SearchProviderManager(
            repository: $repository,
            factories: $this->factoriesFromManager($sourceManager),
        );
    }

    /**
     * @return array<string, SearchProviderFactoryInterface>
     */
    private function factoriesFromManager(SearchProviderManager $manager): array
    {
        // SearchProviderManager has no public registry accessor; read the app-bound registry so host-added drivers remain testable.
        try {
            $reflection = new ReflectionClass($manager);
            $property = $reflection->getProperty('factories');
            $property->setAccessible(true);
            $factories = $property->getValue($manager);
        } catch (ReflectionException) {
            return [];
        }

        return is_array($factories) ? $factories : [];
    }

    /**
     * @param array<int, array<string, mixed>> $attempts
     * @return array<int, array<string, mixed>>
     */
    private function safeAttempts(array $attempts, Model $provider): array
    {
        return array_map(function (array $attempt) use ($provider): array {
            $safe = [
                'sequence' => $attempt['sequence'] ?? null,
                'method' => $attempt['method'] ?? null,
                'status' => $attempt['status'] ?? 'unknown',
            ];

            foreach (['reason', 'results_count'] as $key) {
                if (array_key_exists($key, $attempt)) {
                    $safe[$key] = $attempt[$key];
                }
            }

            if (array_key_exists('error', $attempt)) {
                $safe['error'] = $this->sanitizeProviderError((string) $attempt['error'], $provider);
            }

            return $safe;
        }, $attempts);
    }

    private function sanitizeProviderError(string $message, Model $provider): string
    {
        foreach (['api_key_encrypted', 'api_secret_encrypted'] as $attribute) {
            $secret = $provider->getAttribute($attribute);

            if (is_string($secret) && trim($secret) !== '') {
                $message = str_replace($secret, '[redacted]', $message);
            }
        }

        $message = (string) preg_replace(
            '/(authorization|api[-_ ]?key|api[-_ ]?secret|token|secret)(\\s*[:=]\\s*)[^\\s,;}]+/i',
            '$1$2[redacted]',
            $message,
        );

        return Str::limit($message, 500, '');
    }

    private function statusMessage(string $status): string
    {
        return match ($status) {
            'success' => 'Provider returned search results.',
            'empty' => 'Provider responded without results for the test query.',
            'skipped' => 'Provider could not run this test mode.',
            'failed' => 'Provider test failed. Review the sanitized attempt error.',
            default => 'Provider test completed.',
        };
    }
}
