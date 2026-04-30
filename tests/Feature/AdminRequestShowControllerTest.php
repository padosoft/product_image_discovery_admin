<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Tests\TestCase;

final class AdminRequestShowControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_request_detail_returns_candidates_and_loaded_relationships(): void
    {
        $requestRecord = ProductImageDiscoveryRequest::query()->create([
            'client_id' => 1,
            'erp_model_id' => 'HERO-001',
            'erp_model_color_id' => 'HERO-001-BLK',
            'brand' => 'Herno',
            'supplier' => 'Herno',
            'status' => 'manual_review',
            'final_score' => 61,
            'raw_payload' => ['request' => true],
        ]);

        $selectedCandidate = ProductImageDiscoveryCandidate::query()->create([
            'request_id' => $requestRecord->getKey(),
            'client_id' => 1,
            'source_domain' => 'cdn.example.com',
            'source_page_url' => 'https://cdn.example.com/product.html',
            'image_url' => 'https://cdn.example.com/product.jpg',
            'status' => 'selected',
            'final_score' => 88,
        ]);

        $bestCandidate = ProductImageDiscoveryCandidate::query()->create([
            'request_id' => $requestRecord->getKey(),
            'client_id' => 1,
            'source_domain' => 'cdn.example.com',
            'source_page_url' => 'https://cdn.example.com/product-2.html',
            'image_url' => 'https://cdn.example.com/product-2.jpg',
            'status' => 'candidate',
            'final_score' => 95,
        ]);

        $requestRecord->forceFill([
            'selected_candidate_id' => $selectedCandidate->getKey(),
            'best_candidate_id' => $bestCandidate->getKey(),
        ])->save();

        $this->getJson('/admin/product-image-discovery/requests/'.$requestRecord->getKey())
            ->assertOk()
            ->assertJsonPath('data.id', $requestRecord->getKey())
            ->assertJsonPath('data.selected_candidate.id', $selectedCandidate->getKey())
            ->assertJsonPath('data.best_candidate.id', $bestCandidate->getKey())
            ->assertJsonPath('candidates.0.id', $selectedCandidate->getKey());
    }
}
