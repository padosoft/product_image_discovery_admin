<?php

declare(strict_types=1);

namespace App\Callbacks;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Queue\MaxAttemptsExceededException;
use Illuminate\Queue\TimeoutExceededException;
use Throwable;

/**
 * Stable error codes and short messages for `status: failed` callbacks. Exception messages are
 * never forwarded: they can carry URLs, SQL or paths.
 */
final class FailureCode
{
    private const MESSAGES = [
        'timeout' => 'The step took too long and was stopped.',
        'network_error' => 'A remote service could not be reached.',
        'rate_limited' => 'A remote service rate-limited the request.',
        'provider_error' => 'A remote service answered with an error.',
        'scraper_blocked' => 'The competitor site refused the request.',
        'page_not_found' => 'The competitor page no longer exists.',
        'unreachable' => 'The competitor page could not be fetched.',
    ];

    public static function fromThrowable(?Throwable $exception, string $default): string
    {
        return match (true) {
            $exception instanceof TimeoutExceededException,
            $exception instanceof MaxAttemptsExceededException => 'timeout',
            $exception instanceof ConnectionException => str_contains(strtolower($exception->getMessage()), 'timed out')
                || str_contains($exception->getMessage(), 'cURL error 28') ? 'timeout' : 'network_error',
            $exception instanceof RequestException => $exception->response->status() === 429 ? 'rate_limited' : 'provider_error',
            default => $default,
        };
    }

    /**
     * Code of an HTTP status logged for a competitor page fetch (0/null: no answer).
     */
    public static function fromFetchStatus(?int $status): string
    {
        return match (true) {
            in_array($status, [401, 403, 429, 503], true) => 'scraper_blocked',
            in_array($status, [404, 410], true) => 'page_not_found',
            default => 'unreachable',
        };
    }

    public static function message(string $code): string
    {
        if (isset(self::MESSAGES[$code])) {
            return self::MESSAGES[$code];
        }

        // <stage>_failed codes, e.g. search_failed → "The search step failed."
        $stage = str_ends_with($code, '_failed') ? substr($code, 0, -strlen('_failed')) : $code;

        return sprintf('The %s step failed.', str_replace('_', ' ', $stage));
    }

    /**
     * @return array{error_code: string, error_message: string}
     */
    public static function data(string $code): array
    {
        return ['error_code' => $code, 'error_message' => self::message($code)];
    }
}
