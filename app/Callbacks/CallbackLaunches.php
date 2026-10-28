<?php

declare(strict_types=1);

namespace App\Callbacks;

use App\Jobs\DeliverCallbackEventJob;
use App\Models\CallbackEvent;
use App\Models\CallbackLaunch;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Opens a launch when a start call asks for a callback and fires its single event when the
 * phase ends. Only the latest start call of a resource fires: opening a launch supersedes the
 * pending ones of the same resource.
 */
final class CallbackLaunches
{
    /**
     * @param  array{callback_url: string, correlation_id: string}|null  $callback  null: the
     *                                                                              call asked for none
     * @param  array<string, mixed>  $progress
     * @return array{0: CallbackLaunch|null, 1: list<int>} the new launch and the superseded ids
     */
    public function open(string $event, string $resourceType, int|string $resourceId, ?array $callback, array $progress = []): array
    {
        return DB::transaction(function () use ($event, $resourceType, $resourceId, $callback, $progress): array {
            $superseded = CallbackLaunch::query()
                ->pending()
                ->where('event', $event)
                ->where('resource_id', (string) $resourceId)
                ->pluck('id')
                ->all();

            if ($superseded !== []) {
                CallbackLaunch::query()->whereKey($superseded)->update(['state' => CallbackLaunch::STATE_SUPERSEDED]);
            }

            $launch = $callback === null ? null : CallbackLaunch::query()->create([
                'event' => $event,
                'resource_type' => $resourceType,
                'resource_id' => (string) $resourceId,
                'token' => (string) Str::uuid(),
                'correlation_id' => $callback['correlation_id'],
                'callback_url' => $callback['callback_url'],
                'state' => CallbackLaunch::STATE_PENDING,
                'progress' => $progress === [] ? null : $progress,
            ]);

            return [$launch, array_map('intval', $superseded)];
        });
    }

    /**
     * Undo open() when the start call failed: the previous launches are due again.
     *
     * @param  list<int>  $superseded
     */
    public function rollback(?CallbackLaunch $launch, array $superseded): void
    {
        DB::transaction(function () use ($launch, $superseded): void {
            $launch?->delete();

            if ($superseded !== []) {
                CallbackLaunch::query()
                    ->whereKey($superseded)
                    ->where('state', CallbackLaunch::STATE_SUPERSEDED)
                    ->update(['state' => CallbackLaunch::STATE_PENDING]);
            }
        });
    }

    /**
     * Fire the launch once: store the event in the outbox and queue its delivery after the
     * commit. Returns null when another process already fired (or superseded) it.
     *
     * @param  array<string, mixed>  $data
     */
    public function fire(CallbackLaunch $launch, string $status, array $data = []): ?CallbackEvent
    {
        return DB::transaction(function () use ($launch, $status, $data): ?CallbackEvent {
            $claimed = CallbackLaunch::query()
                ->whereKey($launch->getKey())
                ->pending()
                ->update(['state' => CallbackLaunch::STATE_FIRED, 'updated_at' => Carbon::now()]);

            if ($claimed !== 1) {
                return null;
            }

            $eventId = (string) Str::uuid();
            $event = CallbackEvent::query()->create([
                'event_id' => $eventId,
                'event' => $launch->event,
                'resource_type' => $launch->resource_type,
                'resource_id' => $launch->resource_id,
                'correlation_id' => $launch->correlation_id,
                'status' => $status,
                'callback_url' => $launch->callback_url,
                'body' => CallbackPayload::encode(
                    $eventId,
                    $launch->event,
                    Carbon::now(),
                    $launch->correlation_id,
                    $launch->resource_type,
                    $launch->resource_id,
                    $status,
                    $data,
                ),
                'delivery_status' => CallbackEvent::PENDING,
                // The first attempt is queued right below; callbacks:run-due takes over if it is lost.
                'next_attempt_at' => Carbon::now()->addSeconds(CallbackDeliverer::DISPATCH_LEASE),
            ]);

            CallbackLaunch::query()->whereKey($launch->getKey())->update(['callback_event_id' => $event->getKey()]);

            DeliverCallbackEventJob::dispatch((int) $event->getKey(), 0)->afterCommit();

            return $event;
        });
    }
}
