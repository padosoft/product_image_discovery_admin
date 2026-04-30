<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Padosoft\ProductImageDiscovery\Database\Seeders\ProductImageDiscoveryDefaultsSeeder;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;
use Padosoft\ProductImageDiscovery\Models\ProductImageTrustedSource;

final class ProductImageDiscoveryDemoSeeder extends Seeder
{
    public function __construct(
        private readonly ProductImageDiscoveryDemoScenarioFactory $scenarioFactory = new ProductImageDiscoveryDemoScenarioFactory(),
    ) {}

    public function run(): void
    {
        $this->seed();
    }

    /**
     * @return array{requests: int, candidates: int, events: int}
     */
    public function seed(bool $fresh = false): array
    {
        app(ProductImageDiscoveryDefaultsSeeder::class)->run();
        $this->seedSupportRecords();

        return DB::transaction(function () use ($fresh): array {
            if ($fresh) {
                $this->deleteDemoRequests();
            }

            $summary = [
                'requests' => 0,
                'candidates' => 0,
                'events' => 0,
            ];

            foreach ($this->scenarioFactory->scenarios() as $scenario) {
                $counts = $this->seedScenario($scenario);

                $summary['requests'] += $counts['requests'];
                $summary['candidates'] += $counts['candidates'];
                $summary['events'] += $counts['events'];
            }

            return $summary;
        });
    }

    private function seedSupportRecords(): void
    {
        ProductImageSearchProvider::query()->updateOrCreate(
            ['code' => 'fake-demo'],
            [
                'name' => 'Fake Demo Provider',
                'driver' => 'fake',
                'base_url' => 'https://demo-provider.example.test',
                'api_key_encrypted' => null,
                'api_secret_encrypted' => null,
                'config' => [
                    'supports_image_search' => true,
                    'supports_site_filter' => true,
                    'image_results' => [],
                    'notes' => 'Admin demo data is seeded directly; this provider documents the no-live-API mode.',
                ],
                'priority' => 1,
                'timeout_seconds' => 5,
                'rate_limit_per_minute' => null,
                'is_active' => true,
            ],
        );

        foreach ($this->trustedSources() as $source) {
            ProductImageTrustedSource::query()->updateOrCreate(
                [
                    'client_id' => $source['client_id'],
                    'domain' => $source['domain'],
                ],
                $source,
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function trustedSources(): array
    {
        return [
            [
                'client_id' => ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID,
                'domain' => 'herno.example.test',
                'source_name' => 'Herno Demo Brand Site',
                'source_type' => 'brand_site',
                'trust_score' => 95,
                'allow_search' => true,
                'allow_scraping' => true,
                'allow_download' => true,
                'allow_auto_publish' => false,
                'allow_description_import' => false,
                'respect_robots_txt' => true,
                'requires_manual_review' => true,
                'rate_limit_per_minute' => 60,
                'brand_scope' => ['Herno'],
                'supplier_scope' => ['Herno'],
                'url_patterns' => ['https://herno.example.test/*'],
                'permission_reference' => 'Local deterministic demo source. No live crawling.',
                'notes' => 'Seeded for request review compare mode.',
                'is_active' => true,
            ],
            [
                'client_id' => ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID,
                'domain' => 'nike.example.test',
                'source_name' => 'Nike Demo Brand Site',
                'source_type' => 'brand_site',
                'trust_score' => 96,
                'allow_search' => true,
                'allow_scraping' => true,
                'allow_download' => true,
                'allow_auto_publish' => true,
                'allow_description_import' => false,
                'respect_robots_txt' => true,
                'requires_manual_review' => false,
                'rate_limit_per_minute' => 60,
                'brand_scope' => ['Nike'],
                'supplier_scope' => ['Nike'],
                'url_patterns' => ['https://nike.example.test/*'],
                'permission_reference' => 'Local deterministic demo source. No live crawling.',
                'notes' => 'Seeded for selected-image filters.',
                'is_active' => true,
            ],
            [
                'client_id' => ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID,
                'domain' => 'luisaviaroma.example.test',
                'source_name' => 'LuisaViaRoma Demo Retailer',
                'source_type' => 'retailer',
                'trust_score' => 88,
                'allow_search' => true,
                'allow_scraping' => true,
                'allow_download' => true,
                'allow_auto_publish' => false,
                'allow_description_import' => false,
                'respect_robots_txt' => true,
                'requires_manual_review' => true,
                'rate_limit_per_minute' => 30,
                'brand_scope' => ['New Balance'],
                'supplier_scope' => ['LuisaViaRoma'],
                'url_patterns' => ['https://luisaviaroma.example.test/*'],
                'permission_reference' => 'Local deterministic demo source. No live crawling.',
                'notes' => 'Seeded for retry/no-candidate diagnostics.',
                'is_active' => true,
            ],
        ];
    }

    private function deleteDemoRequests(): void
    {
        ProductImageDiscoveryRequest::query()
            ->where('client_id', ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID)
            ->whereIn('erp_model_color_id', $this->scenarioFactory->demoErpModelColorIds())
            ->get()
            ->each(static function (ProductImageDiscoveryRequest $request): void {
                $request->events()->delete();
                $request->candidates()->delete();
                $request->delete();
            });
    }

    /**
     * @param array{
     *     slug: string,
     *     request: array<string, mixed>,
     *     candidates: array<int, array<string, mixed>>,
     *     best_candidate_key?: string|null,
     *     selected_candidate_key?: string|null,
     *     events: array<int, array<string, mixed>>
     * } $scenario
     *
     * @return array{requests: int, candidates: int, events: int}
     */
    private function seedScenario(array $scenario): array
    {
        $requestAttributes = $scenario['request'];
        $request = ProductImageDiscoveryRequest::query()
            ->where('client_id', $requestAttributes['client_id'])
            ->where('erp_model_color_id', $requestAttributes['erp_model_color_id'])
            ->first();

        if ($request !== null) {
            $request->forceFill([
                'best_candidate_id' => null,
                'selected_candidate_id' => null,
            ])->save();
            $request->events()->delete();
            $request->candidates()->delete();
        }

        $request = ProductImageDiscoveryRequest::query()->updateOrCreate(
            [
                'client_id' => $requestAttributes['client_id'],
                'erp_model_color_id' => $requestAttributes['erp_model_color_id'],
            ],
            $requestAttributes,
        );

        $candidateIdsByKey = [];

        foreach ($scenario['candidates'] as $candidateAttributes) {
            $key = (string) $candidateAttributes['key'];
            unset($candidateAttributes['key']);

            $candidate = ProductImageDiscoveryCandidate::query()->create(array_merge([
                'request_id' => $request->getKey(),
                'client_id' => $request->getAttribute('client_id'),
                'fingerprint' => hash('sha256', $scenario['slug'].'|'.$key),
            ], $candidateAttributes));

            $candidateIdsByKey[$key] = $candidate->getKey();
        }

        $request->forceFill([
            'best_candidate_id' => $this->candidateId($candidateIdsByKey, $scenario['best_candidate_key'] ?? null),
            'selected_candidate_id' => $this->candidateId($candidateIdsByKey, $scenario['selected_candidate_key'] ?? null),
        ])->save();

        $eventCount = $this->seedEvents($request, $candidateIdsByKey, $scenario['events']);

        return [
            'requests' => 1,
            'candidates' => count($candidateIdsByKey),
            'events' => $eventCount,
        ];
    }

    /**
     * @param array<string, int> $candidateIdsByKey
     */
    private function candidateId(array $candidateIdsByKey, ?string $key): ?int
    {
        if ($key === null || $key === '') {
            return null;
        }

        return $candidateIdsByKey[$key] ?? null;
    }

    /**
     * @param array<string, int> $candidateIdsByKey
     * @param array<int, array<string, mixed>> $events
     */
    private function seedEvents(ProductImageDiscoveryRequest $request, array $candidateIdsByKey, array $events): int
    {
        $baseTime = Carbon::parse('2026-05-01 09:00:00');

        foreach (array_values($events) as $index => $event) {
            $candidateKey = isset($event['candidate_key']) ? (string) $event['candidate_key'] : null;
            unset($event['candidate_key']);

            DB::table('product_image_discovery_events')->insert(array_merge([
                'request_id' => $request->getKey(),
                'candidate_id' => $this->candidateId($candidateIdsByKey, $candidateKey),
                'level' => 'info',
                'context' => null,
                'created_at' => $baseTime->copy()->addSeconds($index)->toDateTimeString(),
            ], [
                'event_type' => $event['event_type'],
                'level' => $event['level'] ?? 'info',
                'message' => $event['message'] ?? null,
                'context' => isset($event['context'])
                    ? json_encode($event['context'], JSON_THROW_ON_ERROR)
                    : null,
            ]));
        }

        return count($events);
    }
}
