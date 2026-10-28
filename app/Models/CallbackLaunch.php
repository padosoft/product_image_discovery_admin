<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * A start call (image discovery request, Product Finder discover:now / scrape:now) that asked
 * for a callback. It stays pending until its phase ends, then fires exactly one CallbackEvent;
 * a newer start call of the same resource supersedes it.
 *
 * @property int $id
 * @property string $event
 * @property string $resource_type
 * @property string $resource_id
 * @property string $token
 * @property string $correlation_id
 * @property string $callback_url
 * @property string $state
 * @property array<string, mixed>|null $progress
 * @property int|null $callback_event_id
 */
final class CallbackLaunch extends Model
{
    public const IMAGE_DISCOVERY = 'image_discovery.finished';

    public const DISCOVERY = 'product_finder.discovery.finished';

    public const SCRAPE = 'product_finder.scrape.finished';

    public const STATE_PENDING = 'pending';

    public const STATE_FIRED = 'fired';

    public const STATE_SUPERSEDED = 'superseded';

    protected $table = 'callback_launches';

    protected $fillable = [
        'event',
        'resource_type',
        'resource_id',
        'token',
        'correlation_id',
        'callback_url',
        'state',
        'progress',
        'callback_event_id',
    ];

    protected $casts = [
        'progress' => 'array',
        'callback_event_id' => 'integer',
    ];

    /**
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopePending(Builder $query): Builder
    {
        return $query->where('state', self::STATE_PENDING);
    }

    /**
     * The launch that fires for a resource: the latest pending one.
     */
    public static function latestPending(string $event, int|string $resourceId): ?self
    {
        return self::query()
            ->pending()
            ->where('event', $event)
            ->where('resource_id', (string) $resourceId)
            ->orderByDesc('id')
            ->first();
    }
}
