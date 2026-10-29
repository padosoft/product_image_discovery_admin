<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Callbacks\CallbackPayload;
use App\Callbacks\CallbackTargets;
use DateTimeImmutable;
use PHPUnit\Framework\TestCase;

final class CallbackPayloadTest extends TestCase
{
    // Shared test vector of the contract: Gescat checks the same one.
    private const VECTOR_SECRET = 'test-secret-callback';

    private const VECTOR_TIMESTAMP = 1761646502;

    private const VECTOR_BODY = '{"event_id":"0f6c9a1e-7b2d-4f3a-9c51-8e2d7a4b6c10","event":"ping","occurred_at":"2026-10-28T10:15:02Z","correlation_id":"","resource":{"type":"ping","id":""},"status":"completed","data":{}}';

    private const VECTOR_SIGNATURE = 'v2=d0e32c17d5f053c25370a1200c3e9bde528f334c93ee0f5688c02490e15a55e9';

    public function test_signature_matches_the_shared_vector(): void
    {
        $this->assertSame(self::VECTOR_SIGNATURE, CallbackPayload::sign(self::VECTOR_SECRET, self::VECTOR_TIMESTAMP, self::VECTOR_BODY));
    }

    public function test_ping_body_is_encoded_byte_for_byte_like_the_vector(): void
    {
        $body = CallbackPayload::encode(
            '0f6c9a1e-7b2d-4f3a-9c51-8e2d7a4b6c10',
            'ping',
            new DateTimeImmutable('2026-10-28 11:15:02', new \DateTimeZone('Europe/Rome')),
            '',
            'ping',
            '',
            'completed',
        );

        $this->assertSame(self::VECTOR_BODY, $body);
    }

    public function test_body_keeps_slashes_and_unicode_unescaped(): void
    {
        $body = CallbackPayload::encode('id', 'product_finder.scrape.finished', new DateTimeImmutable('2026-10-28T10:15:02Z'), 'c/1', 'monitoring_target', '7', 'failed', [
            'error_code' => 'scraper_blocked',
            'error_message' => 'Città bloccata',
        ]);

        $this->assertStringContainsString('"correlation_id":"c/1"', $body);
        $this->assertStringContainsString('"data":{"error_code":"scraper_blocked","error_message":"Città bloccata"}', $body);
    }

    public function test_only_https_urls_of_configured_hosts_are_allowed(): void
    {
        $targets = new CallbackTargets([
            'gescat.example.com' => 'secret-a',
            'other.example.com:8443' => 'secret-b',
        ]);

        $this->assertSame('secret-a', $targets->secretFor('https://gescat.example.com/api/ai-product-enrichment/callbacks/events'));
        $this->assertSame('secret-a', $targets->secretFor('https://GESCAT.example.com:443/x'));
        $this->assertSame('secret-b', $targets->secretFor('https://other.example.com:8443/x'));

        $this->assertFalse($targets->allows('http://gescat.example.com/x'));
        $this->assertFalse($targets->allows('https://gescat.example.com:8443/x'));
        $this->assertFalse($targets->allows('https://other.example.com/x'));
        $this->assertFalse($targets->allows('https://user:pass@gescat.example.com/x'));
        $this->assertFalse($targets->allows('https://evil.example.com/?https://gescat.example.com'));
        $this->assertFalse($targets->allows('https://gescat.example.com.evil.test/x'));
        $this->assertFalse($targets->allows('//gescat.example.com/x'));
        $this->assertFalse($targets->allows(['https://gescat.example.com/x']));
    }
}
