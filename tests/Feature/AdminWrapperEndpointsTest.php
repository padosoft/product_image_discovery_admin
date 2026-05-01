<?php

declare(strict_types=1);

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoverySetting;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;
use Padosoft\ProductImageDiscovery\Models\ProductImageTrustedSource;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Tests\TestCase;

final class AdminWrapperEndpointsTest extends TestCase
{
    use RefreshDatabase;

    public function test_dashboard_summary_uses_package_statuses_and_never_exposes_provider_secrets(): void
    {
        $this->createDiscoveryRequest([
            'status' => 'manual_review',
            'final_score' => 58,
        ]);
        $this->createDiscoveryRequest([
            'status' => 'ready_to_publish',
            'final_score' => 82,
        ]);
        $this->createDiscoveryRequest([
            'status' => 'published',
            'final_score' => 91,
        ]);

        ProductImageSearchProvider::query()->create([
            'code' => 'brave',
            'name' => 'Brave',
            'driver' => 'brave',
            'api_key_encrypted' => 'test-api-key',
            'api_secret_encrypted' => null,
            'priority' => 10,
            'is_active' => true,
        ]);

        $this->getJson('/admin/product-image-discovery/dashboard-summary')
            ->assertOk()
            ->assertJsonPath('counts.total', 3)
            ->assertJsonPath('counts.manual_review', 1)
            ->assertJsonPath('counts.ready_to_publish', 1)
            ->assertJsonPath('counts.published', 1)
            ->assertJsonPath('score_buckets.0_59', 1)
            ->assertJsonPath('score_buckets.80_100', 2)
            ->assertJsonPath('provider_status.0.code', 'brave')
            ->assertJsonPath('provider_status.0.has_api_key', true)
            ->assertJsonPath('provider_status.0.has_api_secret', false)
            ->assertJsonMissing(['test-api-key']);
    }

    public function test_request_search_applies_zero_score_filters(): void
    {
        $zeroScore = $this->createDiscoveryRequest([
            'brand' => 'Zero',
            'final_score' => 0,
        ]);
        $this->createDiscoveryRequest([
            'brand' => 'Ten',
            'final_score' => 10,
        ]);

        $this->getJson('/admin/product-image-discovery/requests/search?max_score=0')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $zeroScore->getKey())
            ->assertJsonPath('data.0.final_score', 0);
    }

    public function test_admin_settings_wrapper_supports_crud_and_type_validation(): void
    {
        ProductImageDiscoverySetting::query()->create([
            'client_id' => null,
            'setting_key' => 'decision.manual_review_threshold',
            'setting_value' => 55,
            'value_type' => 'integer',
            'description' => 'Manual review threshold',
            'is_active' => true,
        ]);

        $this->getJson('/admin/product-image-discovery/settings')
            ->assertOk()
            ->assertJsonPath('data.0.setting_key', 'decision.manual_review_threshold')
            ->assertJsonPath('data.0.setting_value', 55)
            ->assertJsonPath('data.0.is_active', true);

        $createdId = $this->postJson('/admin/product-image-discovery/settings', [
            'client_id' => 42,
            'setting_key' => 'quality.allowed_mime_types',
            'setting_value' => '["image/jpeg","image/webp"]',
            'value_type' => 'json',
            'description' => 'Client mime allow list',
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.client_id', 42)
            ->assertJsonPath('data.setting_value.0', 'image/jpeg')
            ->json('data.id');

        $this->putJson('/admin/product-image-discovery/settings/'.$createdId, [
            'client_id' => 42,
            'setting_key' => 'quality.allowed_mime_types',
            'setting_value' => ['image/png'],
            'value_type' => 'json',
            'description' => 'Updated mime allow list',
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.setting_value.0', 'image/png')
            ->assertJsonPath('data.is_active', false);

        $this->postJson('/admin/product-image-discovery/settings', [
            'setting_key' => 'broken.json',
            'setting_value' => '{bad json',
            'value_type' => 'json',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['setting_value']);

        $this->deleteJson('/admin/product-image-discovery/settings/'.$createdId)
            ->assertNoContent();

        $this->assertDatabaseMissing('product_image_discovery_settings', [
            'id' => $createdId,
        ]);
    }

    public function test_settings_ui_path_serves_shell_for_browser_requests(): void
    {
        $this->get('/admin/product-image-discovery/settings')
            ->assertOk()
            ->assertHeader('Content-Type', 'text/html; charset=UTF-8')
            ->assertSee('product-image-discovery-admin');

        $this->getJson('/admin/product-image-discovery/settings')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_admin_configuration_wrappers_support_provider_and_trusted_source_crud_without_secret_exposure(): void
    {
        $providerId = $this->postJson('/admin/product-image-discovery/search-providers', [
            'code' => 'serpapi-client',
            'name' => 'SerpAPI Client',
            'driver' => 'serpapi',
            'base_url' => 'https://serpapi.com',
            'api_key' => 'secret-key',
            'api_secret' => 'secret-secret',
            'config' => ['supports_image_search' => true],
            'priority' => 15,
            'timeout_seconds' => 20,
            'rate_limit_per_minute' => 40,
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'serpapi-client')
            ->assertJsonPath('data.has_api_key', true)
            ->assertJsonPath('data.has_api_secret', true)
            ->assertJsonMissing(['secret-key'])
            ->assertJsonMissing(['secret-secret'])
            ->json('data.id');

        $provider = ProductImageSearchProvider::query()->findOrFail($providerId);
        $rawApiKey = $provider->getRawOriginal('api_key_encrypted');

        $this->assertNotNull($rawApiKey);
        $this->assertNotSame('secret-key', $rawApiKey);

        $this->putJson('/admin/product-image-discovery/search-providers/'.$providerId, [
            'code' => 'serpapi-client',
            'name' => 'SerpAPI Client Updated',
            'driver' => 'serpapi',
            'base_url' => 'https://serpapi.com',
            'api_secret' => '',
            'config' => ['supports_image_search' => true, 'max_results_per_request' => 20],
            'priority' => 16,
            'timeout_seconds' => 25,
            'rate_limit_per_minute' => 35,
            'is_active' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.has_api_key', true)
            ->assertJsonPath('data.has_api_secret', false)
            ->assertJsonMissing(['secret-key']);

        $provider->refresh();
        $this->assertSame($rawApiKey, $provider->getRawOriginal('api_key_encrypted'));
        $this->assertNull($provider->getRawOriginal('api_secret_encrypted'));

        $trustedSourceId = $this->postJson('/admin/product-image-discovery/trusted-sources', [
            'client_id' => 42,
            'domain' => 'https://www.brand.example.test/catalog',
            'source_name' => 'Brand Site',
            'source_type' => 'brand_site',
            'trust_score' => 94,
            'allow_search' => true,
            'allow_scraping' => true,
            'allow_download' => true,
            'allow_auto_publish' => true,
            'allow_description_import' => false,
            'respect_robots_txt' => true,
            'requires_manual_review' => false,
            'rate_limit_per_minute' => 30,
            'brand_scope' => ['Acme'],
            'supplier_scope' => ['Primary'],
            'url_patterns' => ['https://brand.example.test/*'],
            'permission_reference' => 'Contract 42',
            'notes' => 'Approved for catalog images.',
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.domain', 'brand.example.test')
            ->assertJsonPath('data.trust_score', 94)
            ->assertJsonPath('data.allow_auto_publish', true)
            ->assertJsonPath('data.requires_manual_review', false)
            ->assertJsonPath('data.brand_scope.0', 'Acme')
            ->json('data.id');

        $this->putJson('/admin/product-image-discovery/trusted-sources/'.$trustedSourceId, [
            'client_id' => 42,
            'domain' => 'brand.example.test',
            'source_name' => 'Brand Site',
            'source_type' => 'brand_site',
            'trust_score' => 88,
            'allow_search' => true,
            'allow_scraping' => true,
            'allow_download' => true,
            'allow_auto_publish' => false,
            'allow_description_import' => false,
            'respect_robots_txt' => true,
            'requires_manual_review' => true,
            'rate_limit_per_minute' => 30,
            'brand_scope' => ['Acme'],
            'supplier_scope' => ['Primary'],
            'url_patterns' => ['https://brand.example.test/*'],
            'permission_reference' => 'Contract 42',
            'notes' => 'Manual review required.',
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.trust_score', 88)
            ->assertJsonPath('data.allow_auto_publish', false)
            ->assertJsonPath('data.requires_manual_review', true);

        $this->postJson('/admin/product-image-discovery/trusted-sources', [
            'domain' => 'not a domain',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['domain']);

        $this->deleteJson('/admin/product-image-discovery/search-providers/'.$providerId)
            ->assertNoContent();
        $this->deleteJson('/admin/product-image-discovery/trusted-sources/'.$trustedSourceId)
            ->assertNoContent();

        $this->assertDatabaseMissing('product_image_search_providers', ['id' => $providerId]);
        $this->assertDatabaseMissing('product_image_trusted_sources', ['id' => $trustedSourceId]);
        $this->assertSame(0, ProductImageTrustedSource::query()->whereKey($trustedSourceId)->count());
    }

    public function test_admin_search_provider_index_honors_per_page_query(): void
    {
        foreach (range(1, 3) as $index) {
            ProductImageSearchProvider::query()->create([
                'code' => 'provider-'.$index,
                'name' => 'Provider '.$index,
                'driver' => 'fake',
                'config' => [],
                'priority' => $index,
                'timeout_seconds' => 15,
                'is_active' => true,
            ]);
        }

        $this->getJson('/admin/product-image-discovery/search-providers?per_page=2')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.per_page', 2)
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_admin_search_provider_test_runs_single_provider_without_exposing_secrets(): void
    {
        $provider = ProductImageSearchProvider::query()->create([
            'code' => 'fake-health',
            'name' => 'Fake Health',
            'driver' => 'fake',
            'api_key_encrypted' => 'provider-test-secret',
            'config' => [
                'image_results' => [
                    [
                        'title' => 'Result',
                        'page_url' => 'https://brand.example.test/product',
                        'image_url' => 'https://brand.example.test/product.jpg',
                        'source_domain' => 'brand.example.test',
                    ],
                ],
            ],
            'priority' => 5,
            'timeout_seconds' => 15,
            'is_active' => true,
        ]);

        $response = $this->postJson('/admin/product-image-discovery/search-providers/'.$provider->getKey().'/test', [
            'mode' => 'images',
            'query' => 'brand product',
            'limit' => 1,
        ])
            ->assertOk()
            ->assertJsonPath('data.code', 'fake-health')
            ->assertJsonPath('data.driver', 'fake')
            ->assertJsonPath('data.provider_active', true)
            ->assertJsonPath('data.has_api_key', true)
            ->assertJsonPath('data.status', 'success')
            ->assertJsonPath('data.results_count', 1)
            ->assertJsonPath('data.attempts.0.status', 'success')
            ->assertJsonPath('data.attempts.0.results_count', 1)
            ->assertJsonMissingPath('data.results')
            ->assertJsonMissingPath('data.provider.api_key');

        $this->assertStringNotContainsString('provider-test-secret', $response->getContent());
    }

    public function test_admin_search_provider_test_returns_sanitized_failures(): void
    {
        $provider = ProductImageSearchProvider::query()->create([
            'code' => 'fake-failure',
            'name' => 'Fake Failure',
            'driver' => 'fake',
            'api_key_encrypted' => 'failure-secret',
            'config' => ['throw' => true],
            'priority' => 5,
            'timeout_seconds' => 15,
            'is_active' => false,
        ]);

        $response = $this->postJson('/admin/product-image-discovery/search-providers/'.$provider->getKey().'/test')
            ->assertOk()
            ->assertJsonPath('data.code', 'fake-failure')
            ->assertJsonPath('data.provider_active', false)
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.results_count', 0)
            ->assertJsonPath('data.attempts.0.status', 'failed')
            ->assertJsonStructure(['data' => ['latency_ms', 'attempts' => [['error']]]]);

        $this->assertStringNotContainsString('failure-secret', $response->getContent());
    }

    public function test_request_search_date_to_filters_include_the_full_day(): void
    {
        $included = $this->createDiscoveryRequest([
            'brand' => 'Included',
        ]);
        $included->forceFill([
            'created_at' => CarbonImmutable::parse('2026-04-30 18:45:00'),
            'updated_at' => CarbonImmutable::parse('2026-04-30 21:15:00'),
        ])->save();

        $excluded = $this->createDiscoveryRequest([
            'brand' => 'Excluded',
        ]);
        $excluded->forceFill([
            'created_at' => CarbonImmutable::parse('2026-05-01 00:00:00'),
            'updated_at' => CarbonImmutable::parse('2026-05-01 00:00:00'),
        ])->save();

        $this->getJson('/admin/product-image-discovery/requests/search?created_to=2026-04-30&updated_to=2026-04-30')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $included->getKey())
            ->assertJsonPath('data.0.brand', 'Included');
    }

    public function test_custom_admin_prefix_still_returns_json_errors(): void
    {
        config(['pid-admin.route_prefix' => 'custom/pid-admin']);

        $this->get('/custom/pid-admin/requests/not-a-number/events')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json')
            ->assertJsonStructure(['message']);
    }

    public function test_request_events_are_isolated_and_chronological(): void
    {
        $requestRecord = $this->createDiscoveryRequest();
        $candidate = $this->createCandidate($requestRecord);
        $otherRequest = $this->createDiscoveryRequest();

        ProductImageDiscoveryEvent::query()->create([
            'request_id' => $otherRequest->getKey(),
            'event_type' => 'other.request',
            'level' => 'info',
            'message' => 'Other request event.',
            'context' => ['ignored' => true],
            'created_at' => CarbonImmutable::parse('2026-04-30 08:00:00'),
        ]);

        $first = ProductImageDiscoveryEvent::query()->create([
            'request_id' => $requestRecord->getKey(),
            'event_type' => 'pipeline.started',
            'level' => 'info',
            'message' => 'Pipeline started.',
            'context' => ['step' => 'search'],
            'created_at' => CarbonImmutable::parse('2026-04-30 09:00:01'),
        ]);
        $second = ProductImageDiscoveryEvent::query()->create([
            'request_id' => $requestRecord->getKey(),
            'candidate_id' => $candidate->getKey(),
            'event_type' => 'candidate.created',
            'level' => 'info',
            'message' => 'Candidate created.',
            'context' => ['candidate' => true],
            'created_at' => CarbonImmutable::parse('2026-04-30 09:00:02'),
        ]);

        $response = $this->getJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/events')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $first->getKey())
            ->assertJsonPath('data.0.event_type', 'pipeline.started')
            ->assertJsonPath('data.0.context.step', 'search')
            ->assertJsonPath('data.1.id', $second->getKey())
            ->assertJsonPath('data.1.candidate_id', $candidate->getKey());

        $this->assertSame(
            [$first->getKey(), $second->getKey()],
            array_column($response->json('data'), 'id'),
        );
    }

    public function test_wrapper_detail_routes_return_json_not_shell_for_invalid_ids(): void
    {
        $this->getJson('/admin/product-image-discovery/requests/not-a-number/events')
            ->assertNotFound()
            ->assertJsonPath('message', 'Not Found');

        $this->getJson('/admin/product-image-discovery/candidates/not-a-number/image')
            ->assertNotFound()
            ->assertJsonPath('message', 'Not Found');
    }

    public function test_candidate_image_streams_local_file_when_available(): void
    {
        Storage::fake('pid-images');
        config(['product-image-discovery.storage.disk' => 'pid-images']);
        Storage::disk('pid-images')->put('candidates/local.jpg', 'local-image-bytes');

        $candidate = $this->createCandidate($this->createDiscoveryRequest(), [
            'image_url' => 'https://cdn.example.test/fallback.jpg',
            'local_original_path' => 'candidates/local.jpg',
            'mime_type' => 'image/jpeg',
        ]);

        $response = $this->get('/admin/product-image-discovery/candidates/'.$candidate->getKey().'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/jpeg')
            ->assertHeader('X-PID-Image-Source', 'local')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->assertInstanceOf(StreamedResponse::class, $response->baseResponse);
        $this->assertSame('local-image-bytes', $response->streamedContent());
    }

    public function test_candidate_image_falls_back_to_inline_data_when_local_file_is_missing(): void
    {
        Storage::fake('pid-images');
        config(['product-image-discovery.storage.disk' => 'pid-images']);

        $candidate = $this->createCandidate($this->createDiscoveryRequest(), [
            'image_url' => 'data:image/png;base64,'.base64_encode('inline-image-bytes'),
            'local_original_path' => 'candidates/missing.png',
            'mime_type' => 'image/png',
        ]);

        $response = $this->get('/admin/product-image-discovery/candidates/'.$candidate->getKey().'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-PID-Image-Source', 'inline')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $this->assertSame('inline-image-bytes', $response->getContent());
    }

    public function test_candidate_image_returns_not_found_when_no_safe_source_is_available(): void
    {
        Storage::fake('pid-images');
        config(['product-image-discovery.storage.disk' => 'pid-images']);

        $candidate = $this->createCandidate($this->createDiscoveryRequest(), [
            'image_url' => 'file:///tmp/not-redirectable.jpg',
            'local_original_path' => null,
        ]);

        $this->getJson('/admin/product-image-discovery/candidates/'.$candidate->getKey().'/image')
            ->assertNotFound()
            ->assertJsonPath('message', 'Candidate image is not available.');
    }

    public function test_candidate_image_blocks_localhost_remote_redirects(): void
    {
        Storage::fake('pid-images');
        config(['product-image-discovery.storage.disk' => 'pid-images']);

        $candidate = $this->createCandidate($this->createDiscoveryRequest(), [
            'image_url' => 'http://127.0.0.1/internal-image.jpg',
            'local_original_path' => null,
        ]);

        $this->getJson('/admin/product-image-discovery/candidates/'.$candidate->getKey().'/image')
            ->assertNotFound()
            ->assertJsonPath('message', 'Candidate image is not available.');
    }

    public function test_candidate_image_redirects_to_public_remote_images(): void
    {
        Storage::fake('pid-images');
        config(['product-image-discovery.storage.disk' => 'pid-images']);

        $candidate = $this->createCandidate($this->createDiscoveryRequest(), [
            'image_url' => 'https://cdn.example.com/product.jpg',
            'local_original_path' => null,
        ]);

        $this->get('/admin/product-image-discovery/candidates/'.$candidate->getKey().'/image')
            ->assertRedirect('https://cdn.example.com/product.jpg')
            ->assertHeader('X-PID-Image-Source', 'remote');
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createDiscoveryRequest(array $overrides = []): ProductImageDiscoveryRequest
    {
        static $sequence = 0;

        $sequence++;

        return ProductImageDiscoveryRequest::query()->create(array_merge([
            'client_id' => 1,
            'erp_model_id' => 'MODEL-'.$sequence,
            'erp_model_color_id' => 'MODEL-'.$sequence.'-BLACK',
            'brand' => 'Acme',
            'supplier' => 'Acme',
            'raw_payload' => ['sequence' => $sequence],
            'status' => 'pending',
            'final_score' => null,
        ], $overrides));
    }

    /**
     * @param array<string, mixed> $overrides
     */
    private function createCandidate(ProductImageDiscoveryRequest $requestRecord, array $overrides = []): ProductImageDiscoveryCandidate
    {
        return ProductImageDiscoveryCandidate::query()->create(array_merge([
            'request_id' => $requestRecord->getKey(),
            'client_id' => $requestRecord->getAttribute('client_id'),
            'source_domain' => 'cdn.example.test',
            'source_page_url' => 'https://cdn.example.test/products/model.html',
            'image_url' => 'https://cdn.example.test/products/model.jpg',
            'final_score' => 70,
            'status' => 'candidate',
        ], $overrides));
    }
}
