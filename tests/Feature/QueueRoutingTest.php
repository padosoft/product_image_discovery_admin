<?php

declare(strict_types=1);

namespace Tests\Feature;

use Padosoft\PriceIntelligence\Jobs\ScrapeCompetitorProductJob;
use Padosoft\ProductImageDiscovery\Jobs\SearchProductImageJob;
use Padosoft\ProductImageDiscovery\Jobs\VerifyCandidateImageJob;
use Tests\TestCase;

final class QueueRoutingTest extends TestCase
{
    public function test_default_queue_names_are_preserved(): void
    {
        $this->assertSame('image-discovery-verify', config('product-image-discovery.queues.verify'));
        $this->assertSame('pi-scrape', config('price-intelligence.queues.scrape'));
    }

    public function test_app_price_intelligence_config_keeps_package_defaults(): void
    {
        $this->assertNotNull(config('price-intelligence.tables.tenants'));
        $this->assertNotNull(config('price-intelligence.tenancy'));
    }

    public function test_jobs_are_dispatched_on_the_configured_queue(): void
    {
        config([
            'product-image-discovery.queues.search' => 'image-discovery-api',
            'product-image-discovery.queues.verify' => 'image-discovery-api',
            'price-intelligence.queues.scrape' => 'default',
        ]);

        $this->assertSame('image-discovery-api', (new SearchProductImageJob(1))->queue);
        $this->assertSame('image-discovery-api', (new VerifyCandidateImageJob(1, 2))->queue);
        $this->assertSame('default', (new ScrapeCompetitorProductJob(1, 1))->queue);
    }
}
