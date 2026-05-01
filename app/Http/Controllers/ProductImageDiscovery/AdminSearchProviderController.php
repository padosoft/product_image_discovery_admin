<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\Response;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Http\Concerns\ResolvesProductImageDiscovery;
use Padosoft\ProductImageDiscovery\Http\Requests\UpsertProductImageSearchProviderRequest;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoverySearchProviderResource;

final class AdminSearchProviderController extends Controller
{
    use ResolvesProductImageDiscovery;

    public function index(Request $request)
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
}
