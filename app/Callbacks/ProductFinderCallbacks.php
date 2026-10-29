<?php

declare(strict_types=1);

namespace App\Callbacks;

use App\Models\CallbackLaunch;
use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\DB;
use Padosoft\PriceIntelligence\Jobs\DiscoverCompetitorUrlsJob;
use Padosoft\PriceIntelligence\Jobs\ExtractCompetitorAttributesJob;
use Padosoft\PriceIntelligence\Jobs\ScrapeCompetitorProductJob;
use Padosoft\PriceIntelligence\Models\CompetitorProduct;
use Padosoft\PriceIntelligence\Models\ContentSnapshot;
use Padosoft\PriceIntelligence\Models\FetchLog;
use Throwable;

/**
 * product_finder.discovery.finished and product_finder.scrape.finished. The package has no
 * "finished" state: discover:now queues one DiscoverCompetitorUrlsJob, scrape:now one
 * ScrapeCompetitorProductJob per confirmed competitor, and a scrape may queue an
 * ExtractCompetitorAttributesJob. The start call puts its launch token in the hidden Context,
 * which Laravel carries into those jobs and the jobs they queue; the queue events below then
 * tell which launch a finished job belongs to. Jobs started by the scheduler or by an operator
 * carry no token and are ignored.
 */
final class ProductFinderCallbacks
{
    public const CONTEXT_KEY = 'callback_launch_token';

    public const RESOURCE_TYPE = 'monitoring_target';

    // Most telling first: the error code of a failed scrape is the first one found.
    private const SCRAPE_ERROR_PRIORITY = ['scraper_blocked', 'timeout', 'rate_limited', 'page_not_found', 'network_error', 'unreachable'];

    public function __construct(private readonly CallbackLaunches $launches) {}

    public function jobProcessed(JobProcessed $event): void
    {
        // Released jobs run again; failed ones are handled by jobFailed().
        if ($event->job->isReleased() || $event->job->hasFailed()) {
            return;
        }

        $this->guarded(fn () => $this->jobFinished($event->job, null));
    }

    public function jobFailed(JobFailed $event): void
    {
        $this->guarded(fn () => $this->jobFinished($event->job, $event->exception));
    }

    /**
     * Ids above which the snapshots and fetch logs belong to this scrape launch.
     *
     * @return array<string, int>
     */
    public function scrapeBaseline(): array
    {
        return [
            'after_snapshot_id' => (int) ContentSnapshot::query()->withoutTenantScope()->max('id'),
            'after_fetch_log_id' => (int) FetchLog::query()->withoutTenantScope()->max('id'),
        ];
    }

    /**
     * Called by the start call once scrape:now answered with the number of queued jobs.
     */
    public function expectScrapes(CallbackLaunch $launch, int $expected): void
    {
        $this->updateProgress($launch, static fn (array $progress): array => ['expected' => $expected] + $progress);
        $this->evaluateScrape($launch);
    }

    /**
     * Scrape launches whose jobs all finished but whose attribute extraction is still pending
     * after callbacks.attributes_wait_minutes (no worker on the `ai` queue): send them anyway.
     */
    public function sweepStaleScrapes(): int
    {
        $before = Carbon::now()->subMinutes(max(1, (int) config('callbacks.attributes_wait_minutes', 30)));
        $fired = 0;

        CallbackLaunch::query()
            ->pending()
            ->where('event', CallbackLaunch::SCRAPE)
            ->where('updated_at', '<=', $before)
            ->each(function (CallbackLaunch $launch) use (&$fired): void {
                $fired += $this->evaluateScrape($launch, force: true) ? 1 : 0;
            });

        return $fired;
    }

    private function jobFinished(Job $job, ?Throwable $exception): void
    {
        $name = QueuedCommand::name($job);

        if (! in_array($name, [DiscoverCompetitorUrlsJob::class, ScrapeCompetitorProductJob::class, ExtractCompetitorAttributesJob::class], true)) {
            return;
        }

        $token = Context::getHidden(self::CONTEXT_KEY);
        $launch = is_string($token) ? CallbackLaunch::query()->pending()->where('token', $token)->first() : null;

        if ($launch === null) {
            return;
        }

        match ($name) {
            DiscoverCompetitorUrlsJob::class => $this->discoveryFinished($launch, $exception),
            ScrapeCompetitorProductJob::class => $this->scrapeFinished($launch, $job, $exception),
            default => $this->evaluateScrape($launch),
        };
    }

    private function discoveryFinished(CallbackLaunch $launch, ?Throwable $exception): void
    {
        if ($launch->event !== CallbackLaunch::DISCOVERY) {
            return;
        }

        // What GET /competitor-products?status=confirmed returns now, earlier runs included.
        $data = ['confirmed_count' => $this->confirmedCompetitors($launch->resource_id)->count()];

        if ($exception !== null) {
            $data += FailureCode::data(FailureCode::fromThrowable($exception, 'discovery_failed'));
        }

        $this->launches->fire($launch, $exception === null ? 'completed' : 'failed', $data);
    }

    private function scrapeFinished(CallbackLaunch $launch, Job $job, ?Throwable $exception): void
    {
        $command = QueuedCommand::instance($job);
        $competitorId = $command === null ? null : QueuedCommand::property($command, 'competitorProductId');

        if ($launch->event !== CallbackLaunch::SCRAPE || ! is_int($competitorId)) {
            return;
        }

        $outcome = $exception === null ? 'done' : FailureCode::fromThrowable($exception, 'scrape_failed');

        $this->updateProgress($launch, static function (array $progress) use ($competitorId, $outcome): array {
            $progress['finished'][(string) $competitorId] = $outcome;

            return $progress;
        });

        $this->evaluateScrape($launch);
    }

    /**
     * Fire scrape.finished once every queued scrape job finished and no snapshot of this
     * launch is still waiting for its attributes ($force skips that wait).
     */
    private function evaluateScrape(CallbackLaunch $launch, bool $force = false): bool
    {
        $launch = $launch->fresh();

        if ($launch === null || $launch->state !== CallbackLaunch::STATE_PENDING || $launch->event !== CallbackLaunch::SCRAPE) {
            return false;
        }

        $progress = $launch->progress ?? [];
        $expected = $progress['expected'] ?? null;
        $finished = (array) ($progress['finished'] ?? []);

        if (! is_int($expected) || count($finished) < $expected) {
            return false;
        }

        $ids = array_map('intval', array_keys($finished));
        $snapshots = ContentSnapshot::query()
            ->withoutTenantScope()
            ->whereIn('competitor_product_id', $ids)
            ->where('id', '>', (int) ($progress['after_snapshot_id'] ?? 0));

        if (! $force && (clone $snapshots)->where('attributes_status', 'pending')->exists()) {
            return false;
        }

        $scraped = (clone $snapshots)->distinct()->count('competitor_product_id');
        $data = ['scraped_count' => $scraped];
        $status = 'completed';

        if ($expected > 0 && $scraped === 0) {
            $status = 'failed';
            $data += FailureCode::data($this->scrapeErrorCode($ids, $finished, (int) ($progress['after_fetch_log_id'] ?? 0)));
        }

        return $this->launches->fire($launch, $status, $data) !== null;
    }

    /**
     * @param  list<int>  $ids
     * @param  array<string, string>  $finished
     */
    private function scrapeErrorCode(array $ids, array $finished, int $afterFetchLogId): string
    {
        $urls = CompetitorProduct::query()->withoutTenantScope()->whereKey($ids)->pluck('url')->all();
        $codes = array_values(array_filter($finished, static fn (string $outcome): bool => $outcome !== 'done'));

        if ($urls !== []) {
            $statuses = FetchLog::query()
                ->withoutTenantScope()
                ->where('id', '>', $afterFetchLogId)
                ->whereIn('url', $urls)
                ->pluck('status')
                ->all();

            foreach ($statuses as $status) {
                $codes[] = FailureCode::fromFetchStatus($status === null ? null : (int) $status);
            }
        }

        foreach (self::SCRAPE_ERROR_PRIORITY as $code) {
            if (in_array($code, $codes, true)) {
                return $code;
            }
        }

        return $codes[0] ?? 'scrape_failed';
    }

    private function confirmedCompetitors(string $targetId)
    {
        return CompetitorProduct::query()
            ->withoutTenantScope()
            ->where('monitoring_target_id', (int) $targetId)
            ->where('match_status', 'confirmed');
    }

    /**
     * Read-modify-write of the progress under a row lock: scrape jobs of one launch finish on
     * several workers at once.
     *
     * @param  callable(array<string, mixed>): array<string, mixed>  $change
     */
    private function updateProgress(CallbackLaunch $launch, callable $change): void
    {
        DB::transaction(function () use ($launch, $change): void {
            $locked = CallbackLaunch::query()->whereKey($launch->getKey())->lockForUpdate()->first();

            if ($locked !== null) {
                $locked->forceFill(['progress' => $change($locked->progress ?? [])])->save();
            }
        });
    }

    /**
     * Queue event listeners must never throw: the worker would mark a job that succeeded as failed.
     */
    private function guarded(callable $callback): void
    {
        try {
            $callback();
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
