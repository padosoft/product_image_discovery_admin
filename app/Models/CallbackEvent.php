<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Outbox row of one callback: the exact body that is signed and sent on every attempt, and its
 * delivery state (pending → delivered, or undelivered when the client refused it or the retries
 * ran out).
 *
 * @property int $id
 * @property string $event_id
 * @property string $event
 * @property string $resource_type
 * @property string $resource_id
 * @property string $correlation_id
 * @property string $status
 * @property string $callback_url
 * @property string $body
 * @property string $delivery_status
 * @property int $attempts
 * @property Carbon|null $next_attempt_at
 * @property Carbon|null $last_attempt_at
 * @property int|null $last_response_status
 * @property string|null $last_error
 * @property Carbon|null $delivered_at
 */
final class CallbackEvent extends Model
{
    public const PENDING = 'pending';

    public const DELIVERED = 'delivered';

    public const UNDELIVERED = 'undelivered';

    protected $table = 'callback_events';

    protected $fillable = [
        'event_id',
        'event',
        'resource_type',
        'resource_id',
        'correlation_id',
        'status',
        'callback_url',
        'body',
        'delivery_status',
        'attempts',
        'next_attempt_at',
        'last_attempt_at',
        'last_response_status',
        'last_error',
        'delivered_at',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'last_response_status' => 'integer',
        'next_attempt_at' => 'datetime',
        'last_attempt_at' => 'datetime',
        'delivered_at' => 'datetime',
    ];
}
