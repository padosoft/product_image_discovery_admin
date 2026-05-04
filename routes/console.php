<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\ProductImageDiscoveryDemoSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
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

Artisan::command('pid-admin:create-user {email} {--name=Admin} {--password= : Plain password; if omitted a random one is generated and displayed once}', function (): int {
    $email = trim((string) $this->argument('email'));

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $this->error(sprintf('Invalid email address: %s', $email === '' ? '(empty)' : $email));

        return Command::INVALID;
    }

    $name = (string) ($this->option('name') ?: 'Admin');
    $providedPassword = $this->option('password');
    $hasProvidedPassword = is_string($providedPassword) && $providedPassword !== '';
    $password = $hasProvidedPassword ? $providedPassword : Str::random(16);

    $user = User::query()->updateOrCreate(
        ['email' => $email],
        [
            'name' => $name,
            'password' => $password,
        ],
    );

    $this->info(sprintf('User %s saved (id=%d).', $user->getAttribute('email'), $user->getKey()));

    if (! $hasProvidedPassword) {
        $this->warn('Generated password (shown once): '.$password);
    }

    return Command::SUCCESS;
})->purpose('Create or update a Product Image Discovery admin user');
