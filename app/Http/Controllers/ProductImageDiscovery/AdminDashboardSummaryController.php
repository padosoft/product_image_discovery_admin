<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRequestStatus as RequestStatus;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;

final class AdminDashboardSummaryController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $summary = ProductImageDiscoveryRequest::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as manual_review', [RequestStatus::ManualReview->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as ready_to_publish', [RequestStatus::ReadyToPublish->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as published', [RequestStatus::Published->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as failed', [RequestStatus::Failed->value])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as no_candidates_found', [RequestStatus::NoCandidatesFound->value])
            ->selectRaw('SUM(CASE WHEN final_score IS NULL THEN 1 ELSE 0 END) as score_unknown')
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
            'unknown' => (int) ($summary?->getAttribute('score_unknown') ?? 0),
            '0_59' => (int) ($summary?->getAttribute('score_0_59') ?? 0),
            '60_79' => (int) ($summary?->getAttribute('score_60_79') ?? 0),
            '80_100' => (int) ($summary?->getAttribute('score_80_100') ?? 0),
        ];

        $providers = ProductImageSearchProvider::query()
            ->ordered()
            ->get()
            ->map(static fn (ProductImageSearchProvider $provider): array => [
                'id' => $provider->getKey(),
                'code' => $provider->getAttribute('code'),
                'driver' => $provider->getAttribute('driver'),
                'active' => (bool) $provider->getAttribute('is_active'),
                'has_api_key' => filled($provider->getRawOriginal('api_key_encrypted')),
                'has_api_secret' => filled($provider->getRawOriginal('api_secret_encrypted')),
                'timeout_seconds' => $provider->getAttribute('timeout_seconds') === null ? null : (int) $provider->getAttribute('timeout_seconds'),
                'rate_limit_per_minute' => $provider->getAttribute('rate_limit_per_minute'),
                'last_test_status' => null,
                'last_test_at' => null,
            ])
            ->values();
        $queueRows = collect(config('product-image-discovery.queues', []))
            ->map(static fn (string $queue, string $phase): array => [
                'phase' => $phase,
                'queue' => $queue,
                'status' => 'configured',
            ])
            ->values();
        $latestManualReview = ProductImageDiscoveryRequest::query()
            ->withCount('candidates')
            ->where('status', RequestStatus::ManualReview->value)
            ->latest('updated_at')
            ->latest('id')
            ->first();
        $latestAttention = ProductImageDiscoveryRequest::query()
            ->withCount('candidates')
            ->whereIn('status', [
                RequestStatus::Failed->value,
                RequestStatus::NoCandidatesFound->value,
            ])
            ->latest('updated_at')
            ->latest('id')
            ->first();

        return response()->json([
            'counts' => $counts,
            'score_buckets' => $scoreBuckets,
            'provider_status' => $providers,
            'provider_health' => [
                'configured' => $providers->count(),
                'active' => $providers->where('active', true)->count(),
                'missing_credentials' => $providers->filter(static fn (array $provider): bool => ! $provider['has_api_key'])->count(),
            ],
            'queue_status' => collect(config('product-image-discovery.queues', []))
                ->map(static fn (): string => 'configured')
                ->all(),
            'queue_rows' => $queueRows,
            'latest_manual_review' => $this->requestSummary($latestManualReview),
            'latest_attention' => $this->requestSummary($latestAttention),
            'shortcut_actions' => [
                [
                    'id' => 'manual_review',
                    'label' => 'Manual review',
                    'page' => 'review',
                    'filters' => ['manual_review_required' => 'true'],
                ],
                [
                    'id' => 'failed',
                    'label' => 'Failed requests',
                    'page' => 'requests',
                    'filters' => ['status' => RequestStatus::Failed->value],
                ],
                [
                    'id' => 'no_candidates',
                    'label' => 'No candidates',
                    'page' => 'requests',
                    'filters' => ['status' => RequestStatus::NoCandidatesFound->value],
                ],
                [
                    'id' => 'ready',
                    'label' => 'Ready to publish',
                    'page' => 'requests',
                    'filters' => ['status' => RequestStatus::ReadyToPublish->value],
                ],
            ],
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function requestSummary(?ProductImageDiscoveryRequest $request): ?array
    {
        if (! $request instanceof ProductImageDiscoveryRequest) {
            return null;
        }

        return [
            'id' => $request->getKey(),
            'client_id' => $request->getAttribute('client_id'),
            'erp_model_color_id' => $request->getAttribute('erp_model_color_id'),
            'brand' => $request->getAttribute('brand'),
            'supplier' => $request->getAttribute('supplier'),
            'status' => $request->getRawOriginal('status'),
            'final_score' => $request->getAttribute('final_score'),
            'candidate_count' => (int) $request->getAttribute('candidates_count'),
            'updated_at' => $request->getAttribute('updated_at'),
        ];
    }
}
