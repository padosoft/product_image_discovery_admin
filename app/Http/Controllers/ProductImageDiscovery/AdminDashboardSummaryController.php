<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRequestStatus;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;

final class AdminDashboardSummaryController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $requests = ProductImageDiscoveryRequest::query();

        $counts = [
            'total' => (clone $requests)->count(),
            'manual_review' => (clone $requests)->where('status', ProductImageDiscoveryRequestStatus::ManualReview->value)->count(),
            'ready_to_publish' => (clone $requests)->where('status', ProductImageDiscoveryRequestStatus::ReadyToPublish->value)->count(),
            'published' => (clone $requests)->where('status', ProductImageDiscoveryRequestStatus::Published->value)->count(),
            'failed' => (clone $requests)->where('status', ProductImageDiscoveryRequestStatus::Failed->value)->count(),
            'no_candidates_found' => (clone $requests)->where('status', ProductImageDiscoveryRequestStatus::NoCandidatesFound->value)->count(),
        ];

        $scoreBuckets = [
            '0_59' => (clone $requests)->whereBetween('final_score', [0, 59])->count(),
            '60_79' => (clone $requests)->whereBetween('final_score', [60, 79])->count(),
            '80_100' => (clone $requests)->whereBetween('final_score', [80, 100])->count(),
        ];

        $providers = ProductImageSearchProvider::query()
            ->ordered()
            ->get()
            ->map(static fn (ProductImageSearchProvider $provider): array => [
                'code' => $provider->getAttribute('code'),
                'driver' => $provider->getAttribute('driver'),
                'active' => (bool) $provider->getAttribute('is_active'),
                'has_api_key' => filled($provider->getRawOriginal('api_key_encrypted')),
                'has_api_secret' => filled($provider->getRawOriginal('api_secret_encrypted')),
                'last_test_status' => null,
                'last_test_at' => null,
            ])
            ->values();

        return response()->json([
            'counts' => $counts,
            'score_buckets' => $scoreBuckets,
            'provider_status' => $providers,
            'queue_status' => collect(config('product-image-discovery.queues', []))
                ->map(static fn (): string => 'configured')
                ->all(),
        ]);
    }
}
