<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Callbacks\ProductFinderCallbacks;
use App\Models\CallbackEvent;
use App\Models\CallbackLaunch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Jobs\SyncJob;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Padosoft\PriceIntelligence\Enums\MatchStatus;
use Padosoft\PriceIntelligence\Jobs\DiscoverCompetitorUrlsJob;
use Padosoft\PriceIntelligence\Jobs\ExtractCompetitorAttributesJob;
use Padosoft\PriceIntelligence\Jobs\ScrapeCompetitorProductJob;
use Padosoft\PriceIntelligence\Models\ApiKey;
use Padosoft\PriceIntelligence\Models\CompetitorProduct;
use Padosoft\PriceIntelligence\Models\ContentSnapshot;
use Padosoft\PriceIntelligence\Models\MonitoringTarget;
use Padosoft\PriceIntelligence\Models\Product;
use Padosoft\PriceIntelligence\Models\Tenant;
use Padosoft\PriceIntelligence\Support\Tenant\TenantContext;
use Tests\TestCase;

final class ProductFinderCallbackTest extends TestCase
{
    use RefreshDatabase;

    private const CALLBACK_URL = 'https://gescat.test/api/ai-product-enrichment/callbacks/events';

    private string $apiKey;

    private MonitoringTarget $target;

    /** @var array{0: string, 1: int} body and status of every competitor page */
    private array $page = ['', 200];

    protected function setUp(): void
    {
        parent::setUp();

        config(['callbacks.secrets' => ['gescat.test' => 'test-secret-callback']]);
        Http::fake(fn (HttpRequest $request) => str_starts_with($request->url(), 'https://gescat.test/')
            ? Http::response(['ok' => true], 202)
            : Http::response(...$this->page));

        // Not the panel tenant (price-intelligence-admin.tenant_code): only the API key resolves it.
        $tenant = Tenant::query()->create(['code' => 'tenant-a', 'name' => 'Tenant A']);
        [, $this->apiKey] = ApiKey::issue($tenant->getKey(), 'gescat', []);
        app(TenantContext::class)->set($tenant->getKey());

        $product = Product::query()->create(['external_id' => 'SL-763435', 'name' => 'Le 5 à 7 Bea', 'brand' => 'Saint Laurent', 'currency' => 'EUR']);
        $this->target = MonitoringTarget::query()->create([
            'product_id' => $product->getKey(),
            'country' => 'IT',
            'status' => 'active',
            'priority' => 100,
        ]);
    }

    public function test_discovery_without_results_reports_zero_confirmed(): void
    {
        $this->start('discover:now', 'corr-a')->assertStatus(202);

        $this->assertSentOnce('product_finder.discovery.finished', 'corr-a', 'completed', ['confirmed_count' => 0]);
    }

    public function test_discovery_counts_every_confirmed_competitor_of_the_target(): void
    {
        $this->target->forceFill(['options' => ['given_urls' => ['https://shop-a.test/p/1', 'https://shop-b.test/p/1']]])->save();

        $this->start('discover:now', 'corr-a')->assertStatus(202);

        $this->assertSentOnce('product_finder.discovery.finished', 'corr-a', 'completed', ['confirmed_count' => 2]);
    }

    public function test_discovery_job_failing_reports_failed_with_an_error_code(): void
    {
        Queue::fake([DiscoverCompetitorUrlsJob::class]);
        $this->start('discover:now', 'corr-a')->assertStatus(202);
        Http::assertNothingSent();

        $this->finishJob($this->launch(), new DiscoverCompetitorUrlsJob($this->target->getKey(), $this->target->tenant_id), new \RuntimeException('search provider exploded at https://internal/x'));

        $this->assertSentOnce('product_finder.discovery.finished', 'corr-a', 'failed', [
            'confirmed_count' => 0,
            'error_code' => 'discovery_failed',
            'error_message' => 'The discovery step failed.',
        ]);
    }

    public function test_only_the_latest_start_call_of_a_target_fires(): void
    {
        Queue::fake([DiscoverCompetitorUrlsJob::class]);
        $this->start('discover:now', 'corr-a')->assertStatus(202);
        $first = $this->launch();
        $this->start('discover:now', 'corr-b')->assertStatus(202);
        $second = $this->launch();
        // An operator's "Discover now" from the panel asks for no callback and changes nothing.
        $this->withHeader('X-Api-Key', $this->apiKey)->postJson("/api/v1/targets/{$this->target->getKey()}/discover:now")->assertStatus(202);

        $job = new DiscoverCompetitorUrlsJob($this->target->getKey(), $this->target->tenant_id);
        $this->finishJob($first, $job);
        Http::assertNothingSent();

        $this->finishJob($second, $job);
        $this->assertSentOnce('product_finder.discovery.finished', 'corr-b', 'completed', ['confirmed_count' => 0]);
        $this->assertSame(CallbackLaunch::STATE_SUPERSEDED, $first->fresh()->state);
    }

    public function test_jobs_without_a_launch_token_are_ignored(): void
    {
        Queue::fake([DiscoverCompetitorUrlsJob::class]);
        $this->start('discover:now', 'corr-a')->assertStatus(202);

        event(new JobProcessed('sync', $this->syncJob(new DiscoverCompetitorUrlsJob($this->target->getKey(), $this->target->tenant_id))));

        Http::assertNothingSent();
        $this->assertSame(CallbackLaunch::STATE_PENDING, $this->launch()->state);
    }

    public function test_scrape_reports_the_scraped_competitors(): void
    {
        $this->page = ['<html><head><title>Bea tote</title></head><body>Bea tote 1.290 €</body></html>', 200];
        $this->competitor('https://shop-a.test/p/1');
        $this->competitor('https://shop-b.test/p/1');
        $this->competitor('https://shop-c.test/p/1', MatchStatus::Suggested);

        $this->start('scrape:now', 'corr-a')->assertStatus(202)->assertJsonPath('data.queued', 2);

        $this->assertSentOnce('product_finder.scrape.finished', 'corr-a', 'completed', ['scraped_count' => 2]);
    }

    public function test_scrape_with_every_page_refused_reports_scraper_blocked(): void
    {
        $this->page = ['Forbidden', 403];
        $this->competitor('https://shop-a.test/p/1');

        $this->start('scrape:now', 'corr-a')->assertStatus(202);

        $this->assertSentOnce('product_finder.scrape.finished', 'corr-a', 'failed', [
            'scraped_count' => 0,
            'error_code' => 'scraper_blocked',
            'error_message' => 'The competitor site refused the request.',
        ]);
    }

    public function test_scrape_without_confirmed_competitors_reports_at_once(): void
    {
        $this->start('scrape:now', 'corr-a')->assertStatus(202)->assertJsonPath('data.queued', 0);

        $this->assertSentOnce('product_finder.scrape.finished', 'corr-a', 'completed', ['scraped_count' => 0]);
    }

    public function test_scrape_waits_for_the_attribute_extraction(): void
    {
        Queue::fake([ScrapeCompetitorProductJob::class]);
        $first = $this->competitor('https://shop-a.test/p/1');
        $second = $this->competitor('https://shop-b.test/p/1');
        $this->start('scrape:now', 'corr-a')->assertStatus(202);
        $launch = $this->launch();

        // What the two scrape jobs leave: one snapshot still waiting for the LLM step.
        $pending = $this->snapshot($first, 'pending');
        $this->snapshot($second, 'done');
        $this->finishJob($launch, new ScrapeCompetitorProductJob($first->getKey(), $first->tenant_id));
        Http::assertNothingSent();
        $this->finishJob($launch, new ScrapeCompetitorProductJob($second->getKey(), $second->tenant_id));
        Http::assertNothingSent();

        $pending->forceFill(['attributes_status' => 'done'])->save();
        $this->finishJob($launch, new ExtractCompetitorAttributesJob($pending->getKey(), $first->tenant_id, 'page text'));

        $this->assertSentOnce('product_finder.scrape.finished', 'corr-a', 'completed', ['scraped_count' => 2]);
    }

    public function test_attribute_wait_is_capped_by_the_scheduled_command(): void
    {
        Queue::fake([ScrapeCompetitorProductJob::class]);
        $competitor = $this->competitor('https://shop-a.test/p/1');
        $this->start('scrape:now', 'corr-a')->assertStatus(202);
        $launch = $this->launch();
        $this->snapshot($competitor, 'pending');
        $this->finishJob($launch, new ScrapeCompetitorProductJob($competitor->getKey(), $competitor->tenant_id));

        $this->artisan('callbacks:run-due')->assertSuccessful();
        Http::assertNothingSent();

        $this->travel(31)->minutes();
        $this->artisan('callbacks:run-due')->assertSuccessful();

        $this->assertSentOnce('product_finder.scrape.finished', 'corr-a', 'completed', ['scraped_count' => 1]);
    }

    public function test_start_call_rejects_a_callback_url_outside_the_allow_list(): void
    {
        Queue::fake();

        $this->withHeader('X-Api-Key', $this->apiKey)
            ->postJson("/api/v1/targets/{$this->target->getKey()}/discover:now", ['callback_url' => 'https://evil.test/x', 'correlation_id' => 'corr-a'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('callback_url');
        $this->withHeader('X-Api-Key', $this->apiKey)
            ->postJson("/api/v1/targets/{$this->target->getKey()}/scrape:now", ['callback_url' => 'http://gescat.test/x', 'correlation_id' => 'corr-a'])
            ->assertStatus(422);

        Queue::assertNothingPushed();
        $this->assertSame(0, CallbackLaunch::query()->count());
    }

    public function test_unauthenticated_start_call_fails_before_the_callback_check(): void
    {
        $this->postJson("/api/v1/targets/{$this->target->getKey()}/discover:now", ['callback_url' => 'https://evil.test/x', 'correlation_id' => 'c'], ['Accept' => 'application/json'])
            ->assertUnauthorized();
    }

    public function test_failed_start_call_leaves_no_launch(): void
    {
        $this->withHeader('X-Api-Key', $this->apiKey)
            ->postJson('/api/v1/targets/999999/discover:now', ['callback_url' => self::CALLBACK_URL, 'correlation_id' => 'corr-a'])
            ->assertNotFound();

        $this->assertSame(0, CallbackLaunch::query()->count());
        $this->assertSame(0, CallbackEvent::query()->count());
    }

    private function start(string $action, string $correlationId)
    {
        return $this->withHeader('X-Api-Key', $this->apiKey)->postJson(
            "/api/v1/targets/{$this->target->getKey()}/{$action}",
            ['callback_url' => self::CALLBACK_URL, 'correlation_id' => $correlationId],
        );
    }

    private function launch(): CallbackLaunch
    {
        return CallbackLaunch::query()->orderByDesc('id')->firstOrFail();
    }

    private function competitor(string $url, MatchStatus $status = MatchStatus::Confirmed): CompetitorProduct
    {
        return CompetitorProduct::query()->create([
            'monitoring_target_id' => $this->target->getKey(),
            'url' => $url,
            'match_status' => $status,
            'match_confidence' => 90,
        ]);
    }

    private function snapshot(CompetitorProduct $competitor, string $attributesStatus): ContentSnapshot
    {
        return ContentSnapshot::query()->create([
            'competitor_product_id' => $competitor->getKey(),
            'captured_at' => now(),
            'title' => 'Bea tote',
            'attributes_status' => $attributesStatus,
        ]);
    }

    /**
     * A queue worker finishing (or failing) a job queued by the given launch.
     */
    private function finishJob(CallbackLaunch $launch, object $command, ?\Throwable $exception = null): void
    {
        Context::addHidden(ProductFinderCallbacks::CONTEXT_KEY, $launch->token);

        try {
            event($exception === null
                ? new JobProcessed('sync', $this->syncJob($command))
                : new JobFailed('sync', $this->syncJob($command), $exception));
        } finally {
            Context::forgetHidden(ProductFinderCallbacks::CONTEXT_KEY);
        }
    }

    private function syncJob(object $command): SyncJob
    {
        return new SyncJob(app(), (string) json_encode([
            'uuid' => (string) Str::uuid(),
            'displayName' => $command::class,
            'job' => 'Illuminate\Queue\CallQueuedHandler@call',
            'data' => ['commandName' => $command::class, 'command' => serialize($command)],
        ]), 'sync', 'default');
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function assertSentOnce(string $event, string $correlationId, string $status, array $data): void
    {
        $callbacks = Http::recorded(fn (HttpRequest $request): bool => str_starts_with($request->url(), 'https://gescat.test/'))->values();

        $this->assertCount(1, $callbacks);
        $body = json_decode($callbacks[0][0]->body(), true);

        $this->assertSame($event, $body['event']);
        $this->assertSame($correlationId, $body['correlation_id']);
        $this->assertSame(['type' => 'monitoring_target', 'id' => (string) $this->target->getKey()], $body['resource']);
        $this->assertSame($status, $body['status']);
        $this->assertSame($data, $body['data']);
    }
}
