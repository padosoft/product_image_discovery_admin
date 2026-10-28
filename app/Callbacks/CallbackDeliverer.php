<?php

declare(strict_types=1);

namespace App\Callbacks;

use App\Jobs\DeliverCallbackEventJob;
use App\Models\CallbackEvent;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends signed callbacks and applies the retry policy: every 2xx is delivered; 401, 408, 429,
 * 5xx and network errors are retried after 1 min, 5 min, 15 min, 1 h, 3 h and 6 h; anything
 * else (400 bad body, 404 unknown correlation, ...) is not retried. The state lives on the
 * outbox row (callbacks:list shows it).
 *
 * The first attempt is queued when the event is stored; retries are queued by
 * `callbacks:run-due` (scheduler, every minute) once next_attempt_at is past. Managed queues
 * refuse delays over 15 minutes and the sync queue ignores delays, so retries do not rely on
 * delayed jobs.
 */
final class CallbackDeliverer
{
    // A queued attempt that has not run after this many seconds is queued again.
    public const DISPATCH_LEASE = 300;

    public function __construct(private readonly CallbackTargets $targets) {}

    /**
     * One signed POST of the given body. The timestamp is the one of this attempt; the body is
     * sent exactly as signed.
     */
    public function send(string $url, string $eventId, string $body): CallbackAttempt
    {
        $secret = $this->targets->secretFor($url);

        if ($secret === null) {
            return CallbackAttempt::refused('host_not_allowed');
        }

        $timestamp = Carbon::now()->getTimestamp();

        try {
            $response = Http::timeout(max(1, (int) config('callbacks.timeout', 10)))
                ->connectTimeout(5)
                ->withoutRedirecting()
                ->withHeaders([
                    'X-ProductFinder-Event-Id' => $eventId,
                    'X-ProductFinder-Timestamp' => (string) $timestamp,
                    'X-ProductFinder-Signature' => CallbackPayload::sign($secret, $timestamp, $body),
                ])
                ->withBody($body, 'application/json')
                ->post($url);
        } catch (ConnectionException $exception) {
            return CallbackAttempt::connectionFailed(FailureCode::fromThrowable($exception, 'network_error'));
        }

        return CallbackAttempt::fromResponse($response);
    }

    /**
     * Queue an attempt for every pending event that is due. Each one is leased for
     * DISPATCH_LEASE seconds (next_attempt_at moves forward), so the next run does not queue it
     * again while the job waits in the queue.
     */
    public function dispatchDue(int $limit = 200): int
    {
        $now = Carbon::now();
        $queued = 0;

        $due = CallbackEvent::query()
            ->where('delivery_status', CallbackEvent::PENDING)
            ->where('next_attempt_at', '<=', $now)
            ->orderBy('next_attempt_at')
            ->limit($limit)
            ->get(['id', 'attempts', 'next_attempt_at']);

        foreach ($due as $event) {
            $leased = CallbackEvent::query()
                ->whereKey($event->getKey())
                ->where('delivery_status', CallbackEvent::PENDING)
                ->where('next_attempt_at', $event->getRawOriginal('next_attempt_at'))
                ->update(['next_attempt_at' => $now->copy()->addSeconds(self::DISPATCH_LEASE)]);

            if ($leased === 1) {
                DeliverCallbackEventJob::dispatch((int) $event->getKey(), $event->attempts);
                $queued++;
            }
        }

        return $queued;
    }

    /**
     * Make attempt number $attempts + 1 of an outbox event, then record the outcome. A job queued
     * for an attempt that already happened (a duplicate) does nothing.
     */
    public function attempt(int $callbackEventId, int $attempts): void
    {
        $event = CallbackEvent::query()->find($callbackEventId);

        if ($event === null || $event->delivery_status !== CallbackEvent::PENDING || $event->attempts !== $attempts) {
            return;
        }

        // Claim the attempt: of two jobs for the same attempt only one sends.
        $claimed = CallbackEvent::query()
            ->whereKey($event->getKey())
            ->where('delivery_status', CallbackEvent::PENDING)
            ->where('attempts', $attempts)
            ->update(['attempts' => $attempts + 1, 'last_attempt_at' => Carbon::now()]);

        if ($claimed !== 1) {
            return;
        }

        $result = $this->send($event->callback_url, $event->event_id, $event->body);
        $attributes = [
            'attempts' => $attempts + 1,
            'last_attempt_at' => Carbon::now(),
            'last_response_status' => $result->status,
            'last_error' => $result->error,
        ];

        if ($result->outcome === CallbackAttempt::DELIVERED) {
            $event->forceFill(array_merge($attributes, [
                'delivery_status' => CallbackEvent::DELIVERED,
                'delivered_at' => Carbon::now(),
                'next_attempt_at' => null,
            ]))->save();

            return;
        }

        $delays = array_values((array) config('callbacks.retry_delays', []));
        $retry = $result->outcome === CallbackAttempt::RETRY && $attempts < count($delays);

        $this->log($event, $result, $retry);

        if (! $retry) {
            $event->forceFill(array_merge($attributes, [
                'delivery_status' => CallbackEvent::UNDELIVERED,
                'next_attempt_at' => null,
                'last_error' => $result->outcome === CallbackAttempt::RETRY ? 'retries_exhausted:'.$result->error : $result->error,
            ]))->save();

            return;
        }

        // Retry-After is honoured, up to the longest delay of the schedule.
        $delay = $result->retryAfter !== null
            ? min(max($result->retryAfter, 1), (int) max($delays))
            : (int) $delays[$attempts];

        $event->forceFill(array_merge($attributes, ['next_attempt_at' => Carbon::now()->addSeconds($delay)]))->save();
    }

    private function log(CallbackEvent $event, CallbackAttempt $result, bool $retry): void
    {
        $context = [
            'event_id' => $event->event_id,
            'event' => $event->event,
            'host' => parse_url($event->callback_url, PHP_URL_HOST),
            'response_status' => $result->status,
            'error' => $result->error,
            'will_retry' => $retry,
        ];

        match (true) {
            // Signature or timestamp refused: secret out of sync between the two sides, or clock skew.
            $result->status === 401 => Log::alert('Callback refused: signature or timestamp not accepted.', $context),
            // The client says the body is invalid: a bug on this side.
            $result->status === 400 => Log::error('Callback refused: body not valid for the client.', $context),
            $retry => Log::warning('Callback not delivered, will retry.', $context),
            default => Log::warning('Callback not delivered, not retried.', $context),
        };
    }
}
