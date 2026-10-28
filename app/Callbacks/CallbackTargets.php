<?php

declare(strict_types=1);

namespace App\Callbacks;

use Illuminate\Support\Facades\Log;

/**
 * Where callbacks may go and the secret each destination verifies them with. The configured
 * host → secret map (callbacks.secrets) is the allow-list: a callback_url is allowed only over
 * https, without credentials, and for a host that has a secret. It is checked when a client
 * starts a phase (422 there), not discovered when the event is sent (SSRF guard).
 */
final class CallbackTargets
{
    private const MAX_URL_LENGTH = 2048;

    /**
     * @param  array<string, string>  $secrets  normalized host[:port] => secret
     */
    public function __construct(private readonly array $secrets) {}

    /**
     * A map that cannot be used is logged as an error (never its values), otherwise the only
     * symptom would be every callback_url refused with 422.
     */
    public static function fromConfig(): self
    {
        if (config('callbacks.secrets_invalid') === true) {
            Log::error('PRODUCT_FINDER_CALLBACK_SECRETS is not a JSON object of "host": "secret": every callback is refused.');
        }

        $secrets = [];
        $skipped = [];

        foreach ((array) config('callbacks.secrets', []) as $host => $secret) {
            $normalized = is_string($host) ? strtolower(rtrim(trim($host), '.')) : '';

            if ($normalized !== '' && is_string($secret) && $secret !== '') {
                $secrets[$normalized] = $secret;
            } else {
                $skipped[] = (string) $host;
            }
        }

        if ($skipped !== []) {
            Log::error('PRODUCT_FINDER_CALLBACK_SECRETS has entries without a host or a secret: no callback goes to them.', ['entries' => $skipped]);
        }

        return new self($secrets);
    }

    public function allows(mixed $url): bool
    {
        return $this->secretFor($url) !== null;
    }

    public function secretFor(mixed $url): ?string
    {
        $host = $this->hostKey($url);

        return $host === null ? null : ($this->secrets[$host] ?? null);
    }

    /**
     * "host", or "host:port" for an explicit port other than 443; null when the URL is not an
     * absolute https URL without user info.
     */
    private function hostKey(mixed $url): ?string
    {
        if (! is_string($url) || $url === '' || strlen($url) > self::MAX_URL_LENGTH) {
            return null;
        }

        $parts = parse_url($url);

        if (! is_array($parts)
            || strtolower($parts['scheme'] ?? '') !== 'https'
            || ($parts['host'] ?? '') === ''
            || isset($parts['user'])
            || isset($parts['pass'])) {
            return null;
        }

        $host = strtolower(rtrim($parts['host'], '.'));
        $port = $parts['port'] ?? 443;

        return $port === 443 ? $host : $host.':'.$port;
    }
}
