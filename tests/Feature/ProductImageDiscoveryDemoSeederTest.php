<?php

declare(strict_types=1);

namespace Tests\Feature;

use Database\Seeders\ProductImageDiscoveryDemoScenarioFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\Models\ProductImageSearchProvider;
use Padosoft\ProductImageDiscovery\Models\ProductImageTrustedSource;
use Tests\TestCase;

final class ProductImageDiscoveryDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_command_creates_review_scenarios_without_live_services(): void
    {
        $this->artisan('pid-admin:seed-demo')
            ->expectsOutput('Seeded Product Image Discovery demo data: 3 requests, 5 candidates, 7 events.')
            ->assertExitCode(0);

        $requests = ProductImageDiscoveryRequest::query()
            ->where('client_id', ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID)
            ->get()
            ->keyBy('erp_model_color_id');

        $this->assertCount(3, $requests);
        $this->assertDemoSupportRecordsWereSeeded();

        $herno = $requests->get('HERNO-PI002223D-CAMMELLO');
        $this->assertInstanceOf(ProductImageDiscoveryRequest::class, $herno);
        $this->assertSame('manual_review', $herno->getRawOriginal('status'));
        $this->assertSame('Herno', $herno->getAttribute('brand'));
        $this->assertNotNull($herno->getAttribute('best_candidate_id'));
        $this->assertNull($herno->getAttribute('selected_candidate_id'));
        $this->assertSame(3, $herno->candidates()->count());
        $this->assertSame(3, $herno->events()->count());

        $wrongColor = $herno->candidates()
            ->where('source_domain', 'fashion-market.example.test')
            ->firstOrFail();
        $this->assertSame('rejected', $wrongColor->getRawOriginal('status'));
        $this->assertSame('WRONG_COLOR', $wrongColor->getRawOriginal('rejection_reason'));

        $nike = $requests->get('NIKE-AF1-07-CW2288-111');
        $this->assertInstanceOf(ProductImageDiscoveryRequest::class, $nike);
        $this->assertSame('ready_to_publish', $nike->getRawOriginal('status'));
        $this->assertNotNull($nike->getAttribute('selected_candidate_id'));
        $this->assertSame(2, $nike->candidates()->count());

        $newBalance = $requests->get('LVR-78I-AM9016');
        $this->assertInstanceOf(ProductImageDiscoveryRequest::class, $newBalance);
        $this->assertSame('failed', $newBalance->getRawOriginal('status'));
        $this->assertSame(0, $newBalance->candidates()->count());
        $this->assertSame('Fake demo provider timed out before candidates were retained.', $newBalance->getAttribute('last_error'));

        $this->getJson('/admin/product-image-discovery/requests/search?client_id=9001&manual_review_required=1')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.brand', 'Herno');

        $imageResponse = $this->get('/admin/product-image-discovery/candidates/'.$herno->getAttribute('best_candidate_id').'/image')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png')
            ->assertHeader('X-PID-Image-Source', 'inline');

        $this->assertStringStartsWith("\x89PNG", $imageResponse->getContent());
    }

    public function test_demo_seed_command_is_idempotent_and_fresh_safe(): void
    {
        $this->artisan('pid-admin:seed-demo')->assertExitCode(0);
        $this->artisan('pid-admin:seed-demo')->assertExitCode(0);

        $this->assertDemoCounts();

        $this->artisan('pid-admin:seed-demo', ['--fresh' => true])->assertExitCode(0);

        $this->assertDemoCounts();
    }

    private function assertDemoCounts(): void
    {
        $this->assertSame(
            3,
            ProductImageDiscoveryRequest::query()
                ->where('client_id', ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID)
                ->count(),
        );

        $requestIds = ProductImageDiscoveryRequest::query()
            ->where('client_id', ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID)
            ->pluck('id');

        $this->assertSame(
            5,
            ProductImageDiscoveryCandidate::query()
                ->whereIn('request_id', $requestIds)
                ->count(),
        );

        $this->assertSame(
            7,
            ProductImageDiscoveryEvent::query()
                ->whereIn('request_id', $requestIds)
                ->count(),
        );
    }

    private function assertDemoSupportRecordsWereSeeded(): void
    {
        $provider = ProductImageSearchProvider::query()
            ->where('code', 'fake-demo')
            ->firstOrFail();

        $this->assertSame('fake', $provider->getAttribute('driver'));
        $this->assertTrue((bool) $provider->getAttribute('is_active'));
        $this->assertNull($provider->getRawOriginal('api_key_encrypted'));
        $this->assertNull($provider->getRawOriginal('api_secret_encrypted'));

        $this->assertSame(
            3,
            ProductImageTrustedSource::query()
                ->where('client_id', ProductImageDiscoveryDemoScenarioFactory::DEMO_CLIENT_ID)
                ->count(),
        );

        $this->getJson('/admin/product-image-discovery/dashboard-summary')
            ->assertOk()
            ->assertJsonFragment([
                'code' => 'fake-demo',
                'driver' => 'fake',
                'has_api_key' => false,
                'has_api_secret' => false,
            ]);
    }
}
