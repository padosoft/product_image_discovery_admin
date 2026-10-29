<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Callbacks\CallbackDeliverer;
use App\Callbacks\CallbackLaunches;
use App\Callbacks\CallbackPayload;
use App\Jobs\DeliverCallbackEventJob;
use App\Models\CallbackEvent;
use App\Models\CallbackLaunch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Queue;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

final class CallbackDeliveryTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://gescat.test/api/ai-product-enrichment/callbacks/events';

    protected function setUp(): void
    {
        parent::setUp();

        config(['callbacks.secrets' => ['gescat.test' => 'test-secret-callback']]);
        Carbon::setTestNow('2026-10-28 10:00:00');
    }

    /**
     * @return iterable<string, array{0: int, 1: string, 2: int|null}>
     */
    public static function responses(): iterable
    {
        yield '202 accepted' => [202, CallbackEvent::DELIVERED, null];
        yield '200 duplicate' => [200, CallbackEvent::DELIVERED, null];
        yield '400 invalid body' => [400, CallbackEvent::UNDELIVERED, null];
        yield '401 bad signature' => [401, CallbackEvent::PENDING, 60];
        yield '404 unknown correlation' => [404, CallbackEvent::UNDELIVERED, null];
        yield '422 other refusal' => [422, CallbackEvent::UNDELIVERED, null];
        yield '429 without Retry-After' => [429, CallbackEvent::PENDING, 60];
        yield '500 server error' => [500, CallbackEvent::PENDING, 60];
        yield '503 unavailable' => [503, CallbackEvent::PENDING, 60];
    }

    #[DataProvider('responses')]
    public function test_retry_policy_for_each_response(int $status, string $deliveryStatus, ?int $retryIn): void
    {
        Http::fake(['gescat.test/*' => Http::response($status === 200 ? ['ok' => true, 'duplicate' => true] : ['ok' => $status < 300], $status)]);

        $event = $this->fire();

        $event->refresh();
        $this->assertSame($deliveryStatus, $event->delivery_status);
        $this->assertSame(1, $event->attempts);
        $this->assertSame($status, $event->last_response_status);
        $this->assertSame($retryIn === null ? null : Carbon::now()->addSeconds($retryIn)->toDateTimeString(), $event->next_attempt_at?->toDateTimeString());
    }

    public function test_bad_signature_raises_an_alert_and_bad_body_an_error(): void
    {
        Log::spy();
        Http::fakeSequence('gescat.test/*')->push([], 401)->push([], 400);

        $event = $this->fire();
        $this->retry($event);

        Log::shouldHaveReceived('alert')->once();
        Log::shouldHaveReceived('error')->once();
    }

    public function test_retry_after_is_honoured(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 429, ['Retry-After' => '120'])]);

        $event = $this->fire()->refresh();

        $this->assertSame(CallbackEvent::PENDING, $event->delivery_status);
        $this->assertSame('2026-10-28 10:02:00', $event->next_attempt_at->toDateTimeString());
    }

    public function test_network_errors_and_timeouts_are_retried(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 28: Operation timed out after 10001 milliseconds'));

        $event = $this->fire()->refresh();

        $this->assertSame(CallbackEvent::PENDING, $event->delivery_status);
        $this->assertNull($event->last_response_status);
        $this->assertSame('timeout', $event->last_error);
    }

    public function test_retries_follow_the_schedule_then_the_event_stays_undelivered(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 503)]);
        $event = $this->fire();
        $waits = [];

        for ($attempt = 1; $attempt <= 6; $attempt++) {
            $event->refresh();
            $waits[] = (int) Carbon::now()->diffInSeconds($event->next_attempt_at);
            $this->retry($event);
        }

        $event->refresh();
        $this->assertSame([60, 300, 900, 3600, 10800, 21600], $waits);
        $this->assertSame(7, $event->attempts);
        $this->assertSame(CallbackEvent::UNDELIVERED, $event->delivery_status);
        $this->assertSame('retries_exhausted:http_503', $event->last_error);
        Http::assertSentCount(7);
    }

    public function test_every_retry_sends_the_same_body_with_a_fresh_timestamp_and_signature(): void
    {
        Http::fakeSequence('gescat.test/*')->push([], 500)->push(['ok' => true], 202);
        $event = $this->fire();
        $this->retry($event);

        $sent = Http::recorded()->map(fn (array $pair): HttpRequest => $pair[0])->values();

        $this->assertCount(2, $sent);
        $this->assertSame($sent[0]->body(), $sent[1]->body());
        $this->assertSame($sent[0]->header('X-ProductFinder-Event-Id'), $sent[1]->header('X-ProductFinder-Event-Id'));
        $this->assertNotSame($sent[0]->header('X-ProductFinder-Timestamp'), $sent[1]->header('X-ProductFinder-Timestamp'));

        foreach ($sent as $request) {
            $timestamp = (int) $request->header('X-ProductFinder-Timestamp')[0];
            $this->assertSame(CallbackPayload::sign('test-secret-callback', $timestamp, $request->body()), $request->header('X-ProductFinder-Signature')[0]);
        }

        $this->assertSame(CallbackEvent::DELIVERED, $event->refresh()->delivery_status);
    }

    public function test_run_due_queues_each_due_event_once(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 500)]);
        $event = $this->fire();
        Queue::fake();
        $this->travel(61)->seconds();

        $this->artisan('callbacks:run-due')->assertSuccessful();
        $this->artisan('callbacks:run-due')->assertSuccessful();

        Queue::assertPushed(DeliverCallbackEventJob::class, 1);
        Queue::assertPushed(DeliverCallbackEventJob::class, fn (DeliverCallbackEventJob $job): bool => $job->callbackEventId === $event->getKey() && $job->attempts === 1);
    }

    public function test_a_duplicate_job_for_an_attempt_already_made_does_nothing(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 500)]);
        $event = $this->fire();

        (new DeliverCallbackEventJob($event->getKey(), 0))->handle(app(CallbackDeliverer::class));

        Http::assertSentCount(1);
    }

    public function test_host_removed_from_the_configuration_is_not_called(): void
    {
        Http::fake();
        config(['callbacks.secrets' => ['gescat.test' => 'test-secret-callback']]);
        $launch = $this->launch();
        config(['callbacks.secrets' => []]);

        $event = app(CallbackLaunches::class)->fire($launch, 'completed', ['confirmed_count' => 0])->refresh();

        Http::assertNothingSent();
        $this->assertSame(CallbackEvent::UNDELIVERED, $event->delivery_status);
        $this->assertSame('host_not_allowed', $event->last_error);
    }

    public function test_a_launch_fires_only_once(): void
    {
        Http::fake(['gescat.test/*' => Http::response(['ok' => true], 202)]);
        $launch = $this->launch();

        $this->assertNotNull(app(CallbackLaunches::class)->fire($launch, 'completed'));
        $this->assertNull(app(CallbackLaunches::class)->fire($launch, 'completed'));
        $this->assertSame(1, CallbackEvent::query()->count());
    }

    public function test_ping_command_sends_a_signed_ping(): void
    {
        Http::fake(['gescat.test/*' => Http::response(['ok' => true], 202)]);

        $this->artisan('callbacks:ping', ['url' => self::URL])
            ->expectsOutputToContain('Delivered: HTTP 202.')
            ->assertSuccessful();

        Http::assertSent(function (HttpRequest $request): bool {
            $body = json_decode($request->body(), true);
            $timestamp = (int) $request->header('X-ProductFinder-Timestamp')[0];

            return $body['event'] === 'ping'
                && $body['resource'] === ['type' => 'ping', 'id' => '']
                && $body['status'] === 'completed'
                && str_ends_with($request->body(), '"data":{}}')
                && $request->header('X-ProductFinder-Signature')[0] === CallbackPayload::sign('test-secret-callback', $timestamp, $request->body());
        });
    }

    public function test_ping_command_reports_a_refused_signature(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 401)]);

        $this->artisan('callbacks:ping', ['url' => self::URL])
            ->expectsOutputToContain('Not delivered: HTTP 401.')
            ->assertFailed();
    }

    public function test_ping_command_refuses_hosts_outside_the_allow_list(): void
    {
        Http::fake();

        $this->artisan('callbacks:ping', ['url' => 'https://evil.test/x'])->assertExitCode(2);
        $this->artisan('callbacks:ping', ['url' => 'http://gescat.test/x'])->assertExitCode(2);

        Http::assertNothingSent();
    }

    public function test_list_command_shows_the_delivery_state(): void
    {
        Http::fake(['gescat.test/*' => Http::response([], 404)]);
        $this->fire();

        $this->artisan('callbacks:list')
            ->expectsOutputToContain('undelivered')
            ->assertSuccessful();
    }

    private function launch(): CallbackLaunch
    {
        [$launch] = app(CallbackLaunches::class)->open(
            CallbackLaunch::DISCOVERY,
            'monitoring_target',
            '42',
            ['callback_url' => self::URL, 'correlation_id' => 'corr-a'],
        );

        return $launch;
    }

    /**
     * Fire a launch: the first attempt runs at once on the sync queue.
     */
    private function fire(): CallbackEvent
    {
        return app(CallbackLaunches::class)->fire($this->launch(), 'completed', ['confirmed_count' => 0]);
    }

    /**
     * Move to the next attempt time and run it, like callbacks:run-due and a worker would.
     */
    private function retry(CallbackEvent $event): void
    {
        $event->refresh();
        Carbon::setTestNow($event->next_attempt_at);
        app(CallbackDeliverer::class)->attempt($event->getKey(), $event->attempts);
    }
}
