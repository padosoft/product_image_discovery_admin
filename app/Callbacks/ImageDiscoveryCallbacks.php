<?php

declare(strict_types=1);

namespace App\Callbacks;

use App\Models\CallbackLaunch;
use App\Support\ProductImageDiscovery\LatestSearchRun;
use BackedEnum;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\DB;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Services\Support\SearchRun;
use Throwable;

/**
 * image_discovery.finished: sent once the request has an outcome and no candidate of its
 * latest search run is still in the pipeline. Candidates left by earlier runs (a re-POST reuses
 * the request) are ignored, like everywhere else in the admin. Evaluated after every save of a
 * request or candidate that has a pending launch.
 *
 * The package never writes `failed` itself: when one of its jobs fails for good, the request
 * would stay in searching/verifying forever. jobFailed() marks it failed (retryable) with a
 * stable error code, which also fires the callback.
 */
final class ImageDiscoveryCallbacks
{
    public const RESOURCE_TYPE = 'image_discovery_request';

    private const FINISHED_STATUSES = ['ready_to_publish', 'published', 'no_candidates_found', 'manual_review', 'rejected', 'failed'];

    private const IN_PIPELINE = ['candidate', 'verified_match', 'downloaded'];

    private const PACKAGE_JOBS = 'Padosoft\\ProductImageDiscovery\\Jobs\\';

    private const STAGE_CODES = [
        'IngestProductImageDiscoveryJob' => 'ingest_failed',
        'SearchProductImageJob' => 'search_failed',
        'ExtractCandidateSourcesJob' => 'extract_failed',
        'VerifyCandidateImageJob' => 'verify_failed',
        'DownloadCandidateImageJob' => 'download_failed',
        'AssessImageQualityJob' => 'quality_failed',
    ];

    public function __construct(private readonly CallbackLaunches $launches) {}

    /**
     * Model `saved` listener: runs once the surrounding transaction (if any) commits, and never
     * breaks the pipeline step that saved the model.
     */
    public function saved(Model $model): void
    {
        $requestId = $model instanceof ProductImageDiscoveryCandidate
            ? $model->getAttribute('request_id')
            : $model->getKey();

        if ($requestId === null) {
            return;
        }

        DB::afterCommit(function () use ($requestId): void {
            try {
                $this->evaluate($requestId);
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }

    public function evaluate(int|string $requestId): void
    {
        $launch = CallbackLaunch::latestPending(CallbackLaunch::IMAGE_DISCOVERY, $requestId);

        if ($launch === null) {
            return;
        }

        $request = $this->requestModel()::query()->find($requestId);

        if ($request === null) {
            return;
        }

        $status = self::value($request->getAttribute('status'));

        if (! in_array($status, self::FINISHED_STATUSES, true)) {
            return;
        }

        // Only a run started by (or after) this launch counts: until the search job numbers the
        // new run, the status may still be the previous run's outcome, or a late job of that run
        // may write one. `failed` is written by jobFailed(), which already skips late jobs of
        // earlier runs, and may come before the new run is numbered (ingest or search failing).
        $afterRun = $launch->progress['after_run'] ?? null;

        if ($status !== 'failed' && is_int($afterRun) && (SearchRun::current($request->getAttribute('raw_payload')) ?? 0) <= $afterRun) {
            return;
        }

        $statuses = LatestSearchRun::scope($request->candidates(), $request)
            ->pluck('status')
            ->map(static fn (mixed $value): mixed => self::value($value))
            ->all();

        // A failed request has no pipeline left: its candidates may never move again.
        if ($status !== 'failed' && array_intersect($statuses, self::IN_PIPELINE) !== []) {
            return;
        }

        $data = ['candidates_count' => count($statuses)];

        if ($status === 'failed') {
            $data += FailureCode::data((string) data_get($request->getAttribute('raw_payload'), 'context.failure.code', 'pipeline_failed'));
        }

        $this->launches->fire($launch, $status, $data);
    }

    public function jobFailed(JobFailed $event): void
    {
        try {
            $this->markFailed($event);
        } catch (Throwable $exception) {
            report($exception);
        }
    }

    private function markFailed(JobFailed $event): void
    {
        $name = QueuedCommand::name($event->job);

        if ($name === null || ! str_starts_with($name, self::PACKAGE_JOBS)) {
            return;
        }

        $command = QueuedCommand::instance($event->job);

        if ($command === null) {
            return;
        }

        $requestId = QueuedCommand::property($command, 'requestId') ?? QueuedCommand::property($command, 'payloadOrRequestId');

        if (! is_int($requestId) && ! is_string($requestId)) {
            return; // ingest from a raw payload: no request yet
        }

        $request = $this->requestModel()::query()->find($requestId);

        if ($request === null || in_array(self::value($request->getAttribute('status')), self::FINISHED_STATUSES, true)) {
            return;
        }

        // A job of an earlier run failing late says nothing about the current run.
        $candidateId = QueuedCommand::property($command, 'candidateId');
        $currentRun = SearchRun::current($request->getAttribute('raw_payload'));

        if ($candidateId !== null && $currentRun !== null) {
            $candidateRun = $request->candidates()->whereKey($candidateId)->value('search_run');

            if ($candidateRun !== null && (int) $candidateRun !== $currentRun) {
                return;
            }
        }

        $short = substr($name, strlen(self::PACKAGE_JOBS));
        $code = FailureCode::fromThrowable($event->exception, self::STAGE_CODES[$short] ?? 'pipeline_failed');
        $rawPayload = $request->getAttribute('raw_payload');
        $rawPayload = is_array($rawPayload) ? $rawPayload : [];
        $rawPayload['context']['failure'] = ['code' => $code, 'job' => $short, 'failed_at' => gmdate('c')];

        $request->forceFill([
            'status' => 'failed',
            'last_error' => FailureCode::message($code),
            'raw_payload' => $rawPayload,
        ])->save();
    }

    /**
     * @return class-string<Model>
     */
    private function requestModel(): string
    {
        return config('product-image-discovery.models.request', ProductImageDiscoveryRequest::class);
    }

    private static function value(mixed $value): mixed
    {
        return $value instanceof BackedEnum ? $value->value : $value;
    }
}
