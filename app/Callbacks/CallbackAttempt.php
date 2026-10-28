<?php

declare(strict_types=1);

namespace App\Callbacks;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;

/**
 * Outcome of one delivery attempt and what the retry policy (contract §7) makes of it.
 */
final class CallbackAttempt
{
    public const DELIVERED = 'delivered';

    public const RETRY = 'retry';

    // Not retried: the client refused the event (400, 404, other 4xx) or no secret is configured.
    public const DROP = 'drop';

    private function __construct(
        public readonly string $outcome,
        public readonly ?int $status = null,
        public readonly ?string $error = null,
        public readonly ?int $retryAfter = null,
    ) {}

    public static function fromResponse(Response $response): self
    {
        $status = $response->status();

        return match (true) {
            $status >= 200 && $status < 300 => new self(self::DELIVERED, $status),
            // 401: signature or clock mismatch, typically while a secret is being rotated.
            $status === 401,
            $status === 408,
            $status === 425,
            $status >= 500 => new self(self::RETRY, $status, 'http_'.$status),
            $status === 429 => new self(self::RETRY, $status, 'http_429', self::retryAfter($response->header('Retry-After'))),
            default => new self(self::DROP, $status, 'http_'.$status),
        };
    }

    public static function connectionFailed(string $error): self
    {
        return new self(self::RETRY, null, $error);
    }

    public static function refused(string $error): self
    {
        return new self(self::DROP, null, $error);
    }

    /**
     * Retry-After in seconds (delta-seconds or an HTTP date); null when absent or unreadable.
     */
    private static function retryAfter(string $value): ?int
    {
        $value = trim($value);

        if ($value === '') {
            return null;
        }

        if (ctype_digit($value)) {
            return (int) $value;
        }

        $timestamp = strtotime($value);

        return $timestamp === false ? null : max(0, $timestamp - Carbon::now()->getTimestamp());
    }
}
