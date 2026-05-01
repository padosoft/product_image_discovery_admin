<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;

final class AdminHealthController extends Controller
{
    public function __invoke(Request $request, AdminShellController $shell): mixed
    {
        if (! $request->expectsJson()) {
            return $shell();
        }

        $storageDisk = (string) config('product-image-discovery.storage.disk', 'local');
        $storageConfig = config('filesystems.disks.'.$storageDisk);
        $aiProvider = (string) config('product-image-discovery.ai.provider', 'anthropic');
        $providers = $this->providerStatus();

        return response()->json([
            'data' => [
                'app' => [
                    'environment' => app()->environment(),
                    'debug' => (bool) config('app.debug'),
                    'admin_prefix' => trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/'),
                    'package_api_prefix' => trim((string) config('pid-admin.package_api_prefix', 'api/product-image-discovery'), '/'),
                ],
                'env_status' => $this->environmentStatus($providers),
                'ai' => [
                    'enabled' => (bool) config('product-image-discovery.ai.enabled', false),
                    'provider' => $aiProvider,
                    'timeout_seconds' => (int) config('product-image-discovery.ai.timeout', 45),
                    'fail_silently' => (bool) config('product-image-discovery.ai.fail_silently', true),
                    'attach_remote_image' => (bool) config('product-image-discovery.ai.attach_remote_image', false),
                    'vision_model_configured' => filled(config('product-image-discovery.ai.vision_model')),
                    'description_model_configured' => filled(config('product-image-discovery.ai.description_model')),
                    'provider_key_configured' => filled(config('product-image-discovery.ai.providers.'.$aiProvider.'.api_key')),
                    'providers' => $this->aiProviderStatus(),
                ],
                'storage' => [
                    'disk' => $storageDisk,
                    'configured' => is_array($storageConfig),
                    'driver' => is_array($storageConfig) ? ($storageConfig['driver'] ?? null) : null,
                ],
                'queue' => [
                    'connection' => (string) config('queue.default', 'sync'),
                    'queues' => $this->queueStatus(),
                ],
                'providers' => $providers,
            ],
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $providers
     * @return array<int, array<string, mixed>>
     */
    private function environmentStatus(array $providers): array
    {
        return [
            ['key' => 'BRAVE_SEARCH_API_KEY', 'configured' => $this->braveSearchKeyConfigured($providers), 'scope' => 'search'],
            ['key' => 'ANTHROPIC_API_KEY', 'configured' => filled(config('product-image-discovery.ai.providers.anthropic.api_key')), 'scope' => 'ai'],
            ['key' => 'OPENAI_API_KEY', 'configured' => filled(config('product-image-discovery.ai.providers.openai.api_key')), 'scope' => 'ai'],
            ['key' => 'OPENROUTER_API_KEY', 'configured' => filled(config('product-image-discovery.ai.providers.openrouter.api_key')), 'scope' => 'ai'],
        ];
    }

    /**
     * @param  array<int, array<string, mixed>>  $providers
     */
    private function braveSearchKeyConfigured(array $providers): bool
    {
        return collect($providers)
            ->contains(static fn (array $provider): bool => $provider['driver'] === 'brave' && $provider['has_api_key']);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function aiProviderStatus(): array
    {
        return collect(config('product-image-discovery.ai.providers', []))
            ->map(static fn (array $config, string $provider): array => [
                'provider' => $provider,
                'api_key_configured' => filled($config['api_key'] ?? null),
                'base_url_configured' => filled($config['base_url'] ?? null),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, string>>
     */
    private function queueStatus(): array
    {
        return collect(config('product-image-discovery.queues', []))
            ->map(static fn (string $queue, string $phase): array => [
                'phase' => $phase,
                'queue' => $queue,
                'status' => 'configured',
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function providerStatus(): array
    {
        return ProductImageSearchProvider::query()
            ->ordered()
            ->get()
            ->map(static function (ProductImageSearchProvider $provider): array {
                $timeoutSeconds = $provider->getAttribute('timeout_seconds');

                return [
                    'id' => $provider->getKey(),
                    'code' => $provider->getAttribute('code'),
                    'driver' => $provider->getAttribute('driver'),
                    'active' => (bool) $provider->getAttribute('is_active'),
                    'has_api_key' => filled($provider->getRawOriginal('api_key_encrypted')),
                    'has_api_secret' => filled($provider->getRawOriginal('api_secret_encrypted')),
                    'timeout_seconds' => $timeoutSeconds === null ? null : (int) $timeoutSeconds,
                    'rate_limit_per_minute' => $provider->getAttribute('rate_limit_per_minute'),
                    'last_test_status' => null,
                    'last_test_at' => null,
                ];
            })
            ->values()
            ->all();
    }
}
