<?php

declare(strict_types=1);

namespace Tests\Feature;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;
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
