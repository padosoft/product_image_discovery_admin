<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Padosoft\ProductImageDiscovery\Database\Seeders\ProductImageDiscoveryDefaultsSeeder;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Padosoft\ProductImageDiscovery\ProductImageDiscoveryServiceProvider;
use Tests\TestCase;

final class PackageIntegrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_package_provider_and_migrations_load(): void
    {
        $this->assertTrue(class_exists(ProductImageDiscoveryServiceProvider::class));
        $this->assertTrue(Schema::hasTable('product_image_discovery_requests'));
        $this->assertTrue(Schema::hasTable('product_image_discovery_candidates'));
        $this->assertTrue(Schema::hasTable('product_image_search_providers'));

        $this->seed(ProductImageDiscoveryDefaultsSeeder::class);

        $this->assertDatabaseHas('product_image_search_providers', [
            'code' => 'brave',
            'driver' => 'brave',
        ]);
    }

    public function test_sqlite_setup_can_create_and_search_fake_discovery_request(): void
    {
        ProductImageDiscoveryRequest::query()->create([
            'client_id' => 1,
            'erp_model_id' => 'HERNO-PI002223D',
            'erp_model_color_id' => 'HERNO-PI002223D-CAMMELLO',
            'brand' => 'Herno',
            'supplier' => 'Herno',
            'supplier_sku' => 'PI002223D',
            'model_code' => 'PI002223D',
            'color_code' => 'CAMMELLO',
            'color_name' => 'Cammello',
            'category' => 'Donna > Maglie e camicie > Felpe e maglie',
            'material' => '100% Nylon',
            'raw_payload' => [
                'client_id' => 1,
                'erp_model_color_id' => 'HERNO-PI002223D-CAMMELLO',
                'brand' => 'Herno',
            ],
            'status' => 'manual_review',
            'final_score' => 72,
        ]);

        $this->getJson('/admin/product-image-discovery/requests/search?brand=Herno&status=manual_review')
            ->assertOk()
            ->assertJsonPath('data.0.brand', 'Herno')
            ->assertJsonPath('data.0.status', 'manual_review')
            ->assertJsonPath('data.0.final_score', 72);
    }
}
