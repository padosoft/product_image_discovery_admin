<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Callbacks\CallbackPayload;
use App\Models\CallbackEvent;
use App\Models\CallbackLaunch;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Jobs\SyncJob;
use Illuminate\Queue\TimeoutExceededException;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Padosoft\ProductImageDiscovery\Jobs\IngestProductImageDiscoveryJob;
use Padosoft\ProductImageDiscovery\Jobs\SearchProductImageJob;
use Padosoft\ProductImageDiscovery\Jobs\VerifyCandidateImageJob;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Tests\TestCase;

final class ImageDiscoveryCallbackTest extends TestCase
{
    use RefreshDatabase;

    private const CALLBACK_URL = 'https://gescat.test/api/ai-product-enrichment/callbacks/events';

    private const SECRET = 'test-secret-callback';

    protected function setUp(): void
    {
        parent::setUp();

        config(['callbacks.secrets' => ['gescat.test' => self::SECRET]]);
        // The pipeline is driven by hand: only the callback delivery runs for real.
        Bus::fake([IngestProductImageDiscoveryJob::class]);
        Http::fake(['gescat.test/*' => Http::response(['ok' => true], 202)]);
        Sanctum::actingAs(User::query()->create([
            'name' => 'Gescat',
            'email' => 'gescat@example.test',
            'password' => 'unused-password',
        ]), ['product-image-discovery:read', 'product-image-discovery:write']);
    }

    public function test_callback_waits_until_no_candidate_of_the_current_run_is_in_the_pipeline(): void
    {
        $requestId = $this->startDiscovery('corr-a');
        $request = $this->startRun($requestId, 2);
        // Left by run 1, whose job never started: it must not block run 2.
        $stale = $this->candidate($requestId, 1, 'candidate');
        $match = $this->candidate($requestId, 2, 'verified_match');
        $this->candidate($requestId, 2, 'low_score_rejected');

        $request->forceFill(['status' => 'manual_review'])->save();
        Http::assertNothingSent();

        // Like AssessImageQualityJob: the request leaves its outcome before the candidate moves.
        $request->forceFill(['status' => 'quality_checking'])->save();
        $match->forceFill(['status' => 'quality_passed'])->save();
        Http::assertNothingSent();

        $request->forceFill(['status' => 'ready_to_publish'])->save();

        Http::assertSentCount(1);
        Http::assertSent(function (HttpRequest $sent) use ($requestId): bool {
            $body = json_decode($sent->body(), true);
            $timestamp = (int) $sent->header('X-ProductFinder-Timestamp')[0];

            return $sent->url() === self::CALLBACK_URL
                && $sent->header('Content-Type')[0] === 'application/json'
                && $sent->header('X-ProductFinder-Event-Id')[0] === $body['event_id']
                && $sent->header('X-ProductFinder-Signature')[0] === CallbackPayload::sign(self::SECRET, $timestamp, $sent->body())
                && $body['event'] === 'image_discovery.finished'
                && $body['correlation_id'] === 'corr-a'
                && $body['resource'] === ['type' => 'image_discovery_request', 'id' => (string) $requestId]
                && $body['status'] === 'ready_to_publish'
                && $body['data'] === ['candidates_count' => 2];
        });

        $this->assertDatabaseHas('callback_events', ['resource_id' => (string) $requestId, 'delivery_status' => CallbackEvent::DELIVERED, 'attempts' => 1]);

        // One event per launch: later saves send nothing more.
        $stale->forceFill(['status' => 'rejected'])->save();
        $request->forceFill(['status' => 'published'])->save();
        Http::assertSentCount(1);
    }

    public function test_reused_request_reports_to_the_latest_start_call(): void
    {
        $first = $this->startDiscovery('corr-a', 'https://gescat.test/old');
        $second = $this->startDiscovery('corr-b');

        $this->assertSame($first, $second);
        $this->assertSame(1, CallbackLaunch::query()->pending()->count());

        $this->startRun($second, 1)->forceFill(['status' => 'no_candidates_found'])->save();

        Http::assertSentCount(1);
        Http::assertSent(fn (HttpRequest $sent): bool => $sent->url() === self::CALLBACK_URL
            && json_decode($sent->body(), true)['correlation_id'] === 'corr-b'
            && json_decode($sent->body(), true)['data'] === ['candidates_count' => 0]);
    }

    public function test_start_call_without_callback_url_sends_nothing_and_cancels_the_pending_one(): void
    {
        $requestId = $this->startDiscovery('corr-a');
        $this->startDiscovery(null);

        $this->startRun($requestId, 1)->forceFill(['status' => 'no_candidates_found'])->save();

        Http::assertNothingSent();
        $this->assertSame(0, CallbackEvent::query()->count());
    }

    public function test_pipeline_finishing_inside_the_start_call_is_reported(): void
    {
        // A sync queue (or a very fast worker) decides the request before the start call returns.
        ProductImageDiscoveryRequest::saving(function (ProductImageDiscoveryRequest $request): void {
            if ($request->getAttribute('status')?->value === 'queued') {
                // What the search job writes for a run without results.
                $run = (int) $request->getAttribute('attempts') + 1;
                $rawPayload = $request->getAttribute('raw_payload');
                $rawPayload['context']['search'] = ['run' => $run, 'completed_at' => gmdate('c')];
                $request->forceFill(['status' => 'no_candidates_found', 'attempts' => $run, 'raw_payload' => $rawPayload]);
            }
        });

        // New article: the launch is opened after the request exists.
        $requestId = $this->startDiscovery('corr-a');
        // Reused article: the launch is opened before the controller runs.
        $this->startDiscovery('corr-b');

        Http::assertSentCount(2);
        Http::assertSent(fn (HttpRequest $sent): bool => json_decode($sent->body(), true)['correlation_id'] === 'corr-a'
            && json_decode($sent->body(), true)['resource']['id'] === (string) $requestId);
        Http::assertSent(fn (HttpRequest $sent): bool => json_decode($sent->body(), true)['correlation_id'] === 'corr-b');
    }

    public function test_outcome_of_the_previous_run_never_fires_the_new_launch(): void
    {
        $requestId = $this->startDiscovery(null);
        $this->startRun($requestId, 1)->forceFill(['status' => 'manual_review'])->save();

        $this->startDiscovery('corr-b');
        // A late job of run 1 decides the request again before the new search started.
        ProductImageDiscoveryRequest::query()->findOrFail($requestId)->forceFill(['status' => 'manual_review'])->save();
        Http::assertNothingSent();

        $this->startRun($requestId, 2)->forceFill(['status' => 'no_candidates_found'])->save();

        Http::assertSentCount(1);
        Http::assertSent(fn (HttpRequest $sent): bool => json_decode($sent->body(), true)['correlation_id'] === 'corr-b'
            && json_decode($sent->body(), true)['status'] === 'no_candidates_found');
    }

    public function test_job_failing_for_good_marks_the_request_failed_and_reports_it(): void
    {
        $requestId = $this->startDiscovery('corr-a');
        $request = $this->startRun($requestId, 1);
        $request->forceFill(['status' => 'searching'])->save();

        $this->failJob(new SearchProductImageJob($requestId), new TimeoutExceededException('SearchProductImageJob has timed out.'));

        $request->refresh();
        $this->assertSame('failed', $request->getAttribute('status')->value);
        $this->assertSame('The step took too long and was stopped.', $request->getAttribute('last_error'));

        Http::assertSentCount(1);
        Http::assertSent(fn (HttpRequest $sent): bool => json_decode($sent->body(), true)['status'] === 'failed'
            && json_decode($sent->body(), true)['data'] === [
                'candidates_count' => 0,
                'error_code' => 'timeout',
                'error_message' => 'The step took too long and was stopped.',
            ]);
    }

    public function test_job_of_an_earlier_run_failing_late_changes_nothing(): void
    {
        $requestId = $this->startDiscovery('corr-a');
        $old = $this->candidate($requestId, 1, 'candidate');
        $this->startRun($requestId, 2)->forceFill(['status' => 'verifying'])->save();

        $this->failJob(new VerifyCandidateImageJob($requestId, $old->getKey()), new \RuntimeException('boom'));

        $this->assertSame('verifying', ProductImageDiscoveryRequest::query()->find($requestId)->getAttribute('status')->value);
        Http::assertNothingSent();
    }

    public function test_job_failure_does_not_override_a_decided_request(): void
    {
        $requestId = $this->startDiscovery(null);
        $this->startRun($requestId, 1)->forceFill(['status' => 'manual_review'])->save();

        $this->failJob(new SearchProductImageJob($requestId), new \RuntimeException('late'));

        $this->assertSame('manual_review', ProductImageDiscoveryRequest::query()->find($requestId)->getAttribute('status')->value);
    }

    public function test_callback_url_must_be_https_and_allowed(): void
    {
        foreach (['http://gescat.test/callbacks', 'https://not-allowed.test/callbacks', 'not a url'] as $url) {
            $this->postJson('/api/product-image-discovery/requests', $this->payload() + [
                'callback_url' => $url,
                'correlation_id' => 'corr-a',
            ])->assertStatus(422)->assertJsonValidationErrors('callback_url');
        }

        $this->postJson('/api/product-image-discovery/requests', $this->payload() + ['callback_url' => self::CALLBACK_URL])
            ->assertStatus(422)
            ->assertJsonValidationErrors('correlation_id');

        $this->assertSame(0, ProductImageDiscoveryRequest::query()->count());
        Bus::assertNotDispatched(IngestProductImageDiscoveryJob::class);
    }

    public function test_callback_url_is_rejected_when_no_host_is_configured(): void
    {
        config(['callbacks.secrets' => []]);

        $this->postJson('/api/product-image-discovery/requests', $this->payload() + [
            'callback_url' => self::CALLBACK_URL,
            'correlation_id' => 'corr-a',
        ])->assertStatus(422);
    }

    public function test_admin_panel_store_route_does_not_take_callbacks(): void
    {
        $this->assertTrue(collect(app('router')->getRoutes()->getRoutes())->contains(
            fn ($route): bool => str_starts_with($route->uri(), 'admin/') && str_ends_with($route->uri(), '/requests') && in_array('POST', $route->methods(), true),
        ));

        foreach (app('router')->getRoutes()->getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'admin/')) {
                $this->assertNotContains('App\Http\Middleware\RegistersCallbackLaunch:image_discovery.finished', $route->gatherMiddleware(), $route->uri());
            }
        }
    }

    private function startDiscovery(?string $correlationId, string $callbackUrl = self::CALLBACK_URL): int
    {
        $payload = $this->payload();

        if ($correlationId !== null) {
            $payload += ['callback_url' => $callbackUrl, 'correlation_id' => $correlationId];
        }

        $response = $this->postJson('/api/product-image-discovery/requests', $payload)->assertSuccessful();

        return (int) $response->json('request_id');
    }

    /**
     * What the search job writes when a run starts.
     */
    private function startRun(int $requestId, int $run): ProductImageDiscoveryRequest
    {
        $request = ProductImageDiscoveryRequest::query()->findOrFail($requestId);
        $rawPayload = $request->getAttribute('raw_payload');
        $rawPayload['context']['search'] = ['run' => $run, 'completed_at' => gmdate('c')];
        $request->forceFill(['raw_payload' => $rawPayload, 'attempts' => $run, 'status' => 'searching'])->save();

        return $request;
    }

    private function candidate(int $requestId, int $run, string $status): ProductImageDiscoveryCandidate
    {
        return ProductImageDiscoveryCandidate::query()->create([
            'request_id' => $requestId,
            'search_run' => $run,
            'status' => $status,
            'image_url' => 'https://cdn.example.test/'.uniqid().'.jpg',
            'source_page_url' => 'https://shop.example.test/p',
            'source_domain' => 'shop.example.test',
            'fingerprint' => uniqid('fp-', true),
        ]);
    }

    private function failJob(object $command, \Throwable $exception): void
    {
        $payload = json_encode([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'displayName' => $command::class,
            'job' => 'Illuminate\Queue\CallQueuedHandler@call',
            'data' => ['commandName' => $command::class, 'command' => serialize($command)],
        ]);

        event(new JobFailed('sync', new SyncJob(app(), $payload, 'sync', 'default'), $exception));
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(): array
    {
        return [
            'client_id' => 1,
            'erp_model_id' => 'SL-763435',
            'erp_model_color_id' => 'SL-763435-CAMEL',
            'brand' => 'Saint Laurent',
            'model_code' => '763435008IW2885',
            'color_name' => 'Camel',
        ];
    }
}
