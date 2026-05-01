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
        $summary = ProductImageDiscoveryRequest::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as manual_review', [ProductImageDiscoveryRequestStatus::ManualReview->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as ready_to_publish', [ProductImageDiscoveryRequestStatus::ReadyToPublish->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as published', [ProductImageDiscoveryRequestStatus::Published->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed', [ProductImageDiscoveryRequestStatus::Failed->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as no_candidates_found', [ProductImageDiscoveryRequestStatus::NoCandidatesFound->value])
            ->selectRaw('SUM(CASE WHEN final_score BETWEEN 0 AND 59 THEN 1 ELSE 0 END) as score_0_59')
            ->selectRaw('SUM(CASE WHEN final_score BETWEEN 60 AND 79 THEN 1 ELSE 0 END) as score_60_79')
            ->selectRaw('SUM(CASE WHEN final_score BETWEEN 80 AND 100 THEN 1 ELSE 0 END) as score_80_100')
            ->first();

        $counts = [
            'total' => (int) ($summary?->getAttribute('total') ?? 0),
            'manual_review' => (int) ($summary?->getAttribute('manual_review') ?? 0),
            'ready_to_publish' => (int) ($summary?->getAttribute('ready_to_publish') ?? 0),
            'published' => (int) ($summary?->getAttribute('published') ?? 0),
            'failed' => (int) ($summary?->getAttribute('failed') ?? 0),
            'no_candidates_found' => (int) ($summary?->getAttribute('no_candidates_found') ?? 0),
        ];

        $scoreBuckets = [
            '0_59' => (int) ($summary?->getAttribute('score_0_59') ?? 0),
            '60_79' => (int) ($summary?->getAttribute('score_60_79') ?? 0),
            '80_100' => (int) ($summary?->getAttribute('score_80_100') ?? 0),
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
