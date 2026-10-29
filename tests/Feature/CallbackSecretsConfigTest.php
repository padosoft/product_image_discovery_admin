<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Callbacks\CallbackTargets;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

final class CallbackSecretsConfigTest extends TestCase
{
    private const VARIABLE = 'PRODUCT_FINDER_CALLBACK_SECRETS';

    /** @var array{server: mixed, env: mixed} */
    private array $original;

    protected function setUp(): void
    {
        parent::setUp();

        $this->original = ['server' => $_SERVER[self::VARIABLE] ?? null, 'env' => $_ENV[self::VARIABLE] ?? null];
        Log::spy();
    }

    protected function tearDown(): void
    {
        foreach (['server' => '_SERVER', 'env' => '_ENV'] as $key => $global) {
            if ($this->original[$key] === null) {
                unset($GLOBALS[$global][self::VARIABLE]);
            } else {
                $GLOBALS[$global][self::VARIABLE] = $this->original[$key];
            }
        }

        parent::tearDown();
    }

    public function test_a_value_that_is_not_json_refuses_every_callback_and_logs_an_error_without_the_value(): void
    {
        $this->loadConfig("{'gescat.test':'s3cr3t-value'}");

        $this->assertFalse(app(CallbackTargets::class)->allows('https://gescat.test/x'));

        Log::shouldHaveReceived('error')->once()->withArgs(
            fn (string $message, array $context = []): bool => str_contains($message, 'is not a JSON object')
                && ! str_contains($message.json_encode($context), 's3cr3t-value'),
        );
    }

    public function test_entries_without_a_secret_are_logged_by_host(): void
    {
        $this->loadConfig('{"gescat.test":"s3cr3t-value","other.test":""}');

        $targets = app(CallbackTargets::class);

        $this->assertTrue($targets->allows('https://gescat.test/x'));
        $this->assertFalse($targets->allows('https://other.test/x'));
        Log::shouldHaveReceived('error')->once()->withArgs(
            fn (string $message, array $context = []): bool => $context === ['entries' => ['other.test']],
        );
    }

    public function test_a_valid_or_unset_map_logs_nothing(): void
    {
        $this->loadConfig('{"gescat.test":"s3cr3t-value"}');
        $this->assertTrue(app(CallbackTargets::class)->allows('https://gescat.test/x'));

        $this->loadConfig('');
        $this->assertFalse(app(CallbackTargets::class)->allows('https://gescat.test/x'));

        Log::shouldNotHaveReceived('error');
    }

    public function test_ping_explains_a_map_that_is_not_json(): void
    {
        Http::fake();
        $this->loadConfig('{gescat.test:s3cr3t-value}');

        $this->artisan('callbacks:ping', ['url' => 'https://gescat.test/x'])
            ->expectsOutputToContain('is not valid JSON')
            ->assertExitCode(2);

        Http::assertNothingSent();
    }

    /**
     * Evaluate config/callbacks.php as a deploy with this value would.
     */
    private function loadConfig(string $value): void
    {
        $_SERVER[self::VARIABLE] = $_ENV[self::VARIABLE] = $value;

        config(['callbacks' => require config_path('callbacks.php')]);
    }
}
