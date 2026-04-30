<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Padosoft\ProductImageDiscovery\Database\Seeders\ProductImageDiscoveryDefaultsSeeder;

final class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(ProductImageDiscoveryDefaultsSeeder::class);
    }
}
