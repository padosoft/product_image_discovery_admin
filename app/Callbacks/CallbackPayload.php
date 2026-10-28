<?php

declare(strict_types=1);

namespace App\Callbacks;

use DateTimeInterface;
use DateTimeZone;

/**
 * Body and signature of a callback (contract "callback Product Finder → Gescat", §5-§6).
 * The body carries no business data: ids, statuses, counters and error codes only.
 */
final class CallbackPayload
{
    public const SIGNATURE_VERSION = 'v2';

    /**
     * The exact bytes that are signed and sent; stored once so every retry sends the same body.
     *
     * @param  array<string, mixed>  $data
     */
    public static function encode(
        string $eventId,
        string $event,
        DateTimeInterface $occurredAt,
        string $correlationId,
        string $resourceType,
        string $resourceId,
        string $status,
        array $data = [],
    ): string {
        $occurredAt = \DateTimeImmutable::createFromInterface($occurredAt)->setTimezone(new DateTimeZone('UTC'));

        return json_encode([
            'event_id' => $eventId,
            'event' => $event,
            'occurred_at' => $occurredAt->format('Y-m-d\TH:i:s\Z'),
            'correlation_id' => $correlationId,
            'resource' => ['type' => $resourceType, 'id' => $resourceId],
            'status' => $status,
            // {} rather than [] when empty.
            'data' => (object) $data,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /**
     * X-ProductFinder-Signature for one attempt: HMAC-SHA256 of "<timestamp>.<raw body>".
     */
    public static function sign(string $secret, int $timestamp, string $body): string
    {
        return self::SIGNATURE_VERSION.'='.hash_hmac('sha256', $timestamp.'.'.$body, $secret);
    }
}
