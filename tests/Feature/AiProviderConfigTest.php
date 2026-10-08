<?php

declare(strict_types=1);

namespace Tests\Feature;

use Tests\TestCase;

final class AiProviderConfigTest extends TestCase
{
    public function test_regolo_is_configured_for_laravel_ai_and_the_image_verifier(): void
    {
        $this->assertSame('regolo', config('ai.providers.regolo.driver'));
        $this->assertSame('https://api.regolo.ai/v1', config('ai.providers.regolo.url'));
        $this->assertSame('https://api.regolo.ai/v1', config('product-image-discovery.ai.providers.regolo.base_url'));
    }

    public function test_published_ai_config_keeps_laravel_ai_default_providers(): void
    {
        foreach (['anthropic', 'openai', 'openrouter'] as $provider) {
            $this->assertSame($provider, config("ai.providers.{$provider}.driver"));
        }
    }
}
