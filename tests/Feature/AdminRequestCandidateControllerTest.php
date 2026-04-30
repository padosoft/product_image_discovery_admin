<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Tests\TestCase;

final class AdminRequestCandidateControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_candidates_are_sorted_and_paginated(): void
    {
        $requestRecord = $this->createDiscoveryRequest([
            'status' => 'manual_review',
        ]);
        $low = $this->createCandidate($requestRecord, [
            'final_score' => 54,
        ]);
        $high = $this->createCandidate($requestRecord, [
            'final_score' => 91,
        ]);

        $this->getJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/candidates?per_page=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $high->getKey())
            ->assertJsonPath('meta.per_page', 1);

        $this->getJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/candidates')
            ->assertOk()
            ->assertJsonPath('data.0.id', $high->getKey())
            ->assertJsonPath('data.1.id', $low->getKey());
    }

    public function test_candidate_approve_updates_request_and_candidate(): void
    {
        $requestRecord = $this->createDiscoveryRequest([
            'status' => 'manual_review',
            'final_score' => 61,
        ]);
        $candidate = $this->createCandidate($requestRecord, [
            'status' => 'candidate',
            'final_score' => 88,
        ]);

        $this->postJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/candidates/'.$candidate->getKey().'/approve')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('request.status', 'ready_to_publish')
            ->assertJsonPath('request.selected_candidate.id', $candidate->getKey())
            ->assertJsonPath('candidate.status', 'selected');

        $this->assertDatabaseHas('product_image_discovery_requests', [
            'id' => $requestRecord->getKey(),
            'status' => 'ready_to_publish',
            'selected_candidate_id' => $candidate->getKey(),
        ]);
        $this->assertDatabaseHas('product_image_discovery_candidates', [
            'id' => $candidate->getKey(),
            'status' => 'selected',
        ]);
        $this->assertDatabaseHas('product_image_discovery_events', [
            'request_id' => $requestRecord->getKey(),
            'candidate_id' => $candidate->getKey(),
            'event_type' => 'candidate_approved',
        ]);
    }

    public function test_candidate_reject_requires_notes_for_risky_reasons(): void
    {
        $requestRecord = $this->createDiscoveryRequest([
            'status' => 'manual_review',
        ]);
        $candidate = $this->createCandidate($requestRecord);

        $this->postJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/candidates/'.$candidate->getKey().'/reject', [
            'reason' => 'WRONG_COLOR',
            'notes' => '',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['notes']);
    }

    public function test_candidate_reject_keeps_request_in_manual_review_when_other_candidates_remain(): void
    {
        $requestRecord = $this->createDiscoveryRequest([
            'status' => 'manual_review',
        ]);
        $rejectedCandidate = $this->createCandidate($requestRecord, [
            'final_score' => 42,
        ]);
        $this->createCandidate($requestRecord, [
            'final_score' => 67,
        ]);

        $this->postJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/candidates/'.$rejectedCandidate->getKey().'/reject', [
            'reason' => 'LOW_CONFIDENCE',
            'notes' => 'The image is too weak to select.',
        ])
            ->assertOk()
            ->assertJsonPath('request.status', 'manual_review')
            ->assertJsonPath('candidate.status', 'rejected')
            ->assertJsonPath('candidate.rejection_reason', 'LOW_CONFIDENCE');

        $this->assertDatabaseHas('product_image_discovery_requests', [
            'id' => $requestRecord->getKey(),
            'status' => 'manual_review',
            'rejection_reason' => null,
        ]);
        $this->assertDatabaseHas('product_image_discovery_events', [
            'request_id' => $requestRecord->getKey(),
            'candidate_id' => $rejectedCandidate->getKey(),
            'event_type' => 'candidate_rejected',
        ]);
    }

    public function test_request_retry_requeues_the_request(): void
    {
        $requestRecord = $this->createDiscoveryRequest([
            'status' => 'failed',
            'attempts' => 2,
            'last_error' => 'Temporary failure.',
        ]);

        $this->postJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey().'/retry')
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('request.status', 'queued')
            ->assertJsonPath('request.attempts', 3);

        $this->assertDatabaseHas('product_image_discovery_requests', [
            'id' => $requestRecord->getKey(),
            'status' => 'queued',
            'attempts' => 3,
            'rejection_reason' => null,
        ]);
        $this->assertDatabaseHas('product_image_discovery_events', [
            'request_id' => $requestRecord->getKey(),
            'event_type' => 'request_retry_requested',
        ]);
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
