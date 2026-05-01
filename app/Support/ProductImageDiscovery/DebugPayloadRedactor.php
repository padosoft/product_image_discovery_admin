<?php

declare(strict_types=1);

namespace App\Support\ProductImageDiscovery;

final class DebugPayloadRedactor
{
    public static function redact(mixed $value): mixed
    {
        if (is_array($value)) {
            $redacted = [];

            foreach ($value as $key => $item) {
                if (is_string($key) && self::isSecretKey($key)) {
                    $redacted[$key] = filled($item) ? '[redacted]' : $item;
                    continue;
                }

                $redacted[$key] = self::redact($item);
            }

            return $redacted;
        }

        return $value;
    }

    public static function redactText(string $value): string
    {
        return preg_replace(
            '/((?:"|\')?(?:api[_-]?key|api[_-]?secret|authorization|credential|password|secret|token)(?:"|\')?\s*[:=]\s*)(?:"[^"]*"|\'[^\']*\'|[^\s,;]+)/i',
            '$1[redacted]',
            $value,
        ) ?? $value;
    }

    private static function isSecretKey(string $key): bool
    {
        if (preg_match('/^has_(api[_-]?key|api[_-]?secret)$/i', $key) === 1) {
            return false;
        }

        return preg_match('/(api[_-]?key|api[_-]?secret|authorization|credential|password|secret|token)/i', $key) === 1;
    }
}
