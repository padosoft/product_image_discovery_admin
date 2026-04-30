<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;

Artisan::command('about:pid-admin', function (): void {
    $this->info('Product Image Discovery Admin demo app');
})->purpose('Show Product Image Discovery Admin app info');
