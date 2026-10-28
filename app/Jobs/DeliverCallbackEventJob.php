<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Callbacks\CallbackDeliverer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * One delivery attempt of an outbox callback. The retry schedule is CallbackDeliverer's, not the
 * queue's: a retry is a new job queued by `callbacks:run-due`.
 */
final class DeliverCallbackEventJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 1;

    public int $timeout = 60;

    /**
     * @param  int  $attempts  attempts already made when the job was queued
     */
    public function __construct(
        public readonly int $callbackEventId,
        public readonly int $attempts = 0,
    ) {
        $queue = config('callbacks.queue');

        if (is_string($queue) && $queue !== '') {
            $this->onQueue($queue);
        }
    }

    public function handle(CallbackDeliverer $deliverer): void
    {
        $deliverer->attempt($this->callbackEventId, $this->attempts);
    }
}
