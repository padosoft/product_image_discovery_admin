<?php

declare(strict_types=1);

use Database\Seeders\ProductImageDiscoveryDemoSeeder;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Console\Command\Command;

Artisan::command('about:pid-admin', function (): void {
    $this->info('Product Image Discovery Admin demo app');
})->purpose('Show Product Image Discovery Admin app info');

Artisan::command('pid-admin:seed-demo {--fresh : Delete existing PID admin demo requests before seeding}', function (): int {
    $summary = app(ProductImageDiscoveryDemoSeeder::class)->seed((bool) $this->option('fresh'));

    $this->info(sprintf(
        'Seeded Product Image Discovery demo data: %d requests, %d candidates, %d events.',
        $summary['requests'],
        $summary['candidates'],
        $summary['events'],
    ));

    return Command::SUCCESS;
})->purpose('Seed deterministic Product Image Discovery admin demo requests');
