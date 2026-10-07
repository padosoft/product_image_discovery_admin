<?php

declare(strict_types=1);

use App\Models\User;
use Database\Seeders\ProductImageDiscoveryDemoSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;
use Padosoft\PriceIntelligence\Models\ApiKey;
use Padosoft\PriceIntelligence\Models\Tenant;
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

Artisan::command('pid-admin:create-user {email} {--name= : Display name (defaults to "Admin" on create, kept as-is on update unless provided)} {--password= : Plain password; if omitted a random one is generated and displayed once}', function (): int {
    $email = trim((string) $this->argument('email'));

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $this->error(sprintf('Invalid email address: %s', $email === '' ? '(empty)' : $email));

        return Command::INVALID;
    }

    $rawName = $this->option('name');
    $trimmedName = is_string($rawName) ? trim($rawName) : '';
    $hasProvidedName = $trimmedName !== '';

    $rawPassword = $this->option('password');
    $hasProvidedPassword = is_string($rawPassword) && trim($rawPassword) !== '';

    $user = User::query()->firstOrNew(['email' => $email]);
    $isNewUser = ! $user->exists;
    $generatedPassword = null;

    if ($hasProvidedName) {
        $user->name = $trimmedName;
    } elseif ($isNewUser) {
        $user->name = 'Admin';
    }

    if ($hasProvidedPassword) {
        $user->password = $rawPassword;
        $user->must_change_password = true;
    } elseif ($isNewUser) {
        $generatedPassword = Str::random(16);
        $user->password = $generatedPassword;
        $user->must_change_password = true;
    }

    $user->save();

    $this->info(sprintf('User %s saved (id=%d).', $user->getAttribute('email'), $user->getKey()));

    if ($user->getAttribute('must_change_password')) {
        $this->line('The user must change the password at the first login.');
    }

    if ($generatedPassword !== null) {
        $this->warn('Generated password (shown once): '.$generatedPassword);
    }

    return Command::SUCCESS;
})->purpose('Create or update a Product Image Discovery admin user');

Artisan::command('pid-admin:create-api-user {email} {--name= : Display name (defaults to "API" on create)}', function (): int {
    $email = trim((string) $this->argument('email'));

    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $this->error(sprintf('Invalid email address: %s', $email === '' ? '(empty)' : $email));

        return Command::INVALID;
    }

    $existing = User::query()->where('email', $email)->first();

    if ($existing !== null) {
        $this->info(sprintf('User %s already exists (id=%d), skipped.', $email, $existing->getKey()));

        return Command::SUCCESS;
    }

    $rawName = $this->option('name');
    $name = is_string($rawName) && trim($rawName) !== '' ? trim($rawName) : 'API';

    // Technical user: it only owns API tokens, nobody knows its password.
    $user = User::query()->create([
        'email' => $email,
        'name' => $name,
        'password' => Str::random(64),
        'must_change_password' => false,
    ]);

    $this->info(sprintf('API user %s created (id=%d).', $email, $user->getKey()));

    return Command::SUCCESS;
})->purpose('Create a technical user that owns API tokens (no panel access)');

Artisan::command('pid-admin:create-api-token {email} {--name=api : Token name} {--ability=* : Token abilities (defaults to product-image-discovery:read and :write)}', function (): int {
    $email = trim((string) $this->argument('email'));
    $user = User::query()->where('email', $email)->first();

    if ($user === null) {
        $this->error(sprintf('User not found: %s', $email === '' ? '(empty)' : $email));

        return Command::FAILURE;
    }

    $rawName = $this->option('name');
    $name = is_string($rawName) && trim($rawName) !== '' ? trim($rawName) : 'api';

    $abilities = array_values(array_filter(
        array_map(static fn (mixed $ability): string => trim((string) $ability), (array) $this->option('ability')),
        static fn (string $ability): bool => $ability !== '',
    ));

    if ($abilities === []) {
        $abilities = ['product-image-discovery:read', 'product-image-discovery:write'];
    }

    $token = $user->createToken($name, $abilities);

    $this->info(sprintf('Token "%s" created for %s with abilities: %s.', $name, $email, implode(', ', $abilities)));
    $this->warn('Token (shown once): '.$token->plainTextToken);

    return Command::SUCCESS;
})->purpose('Issue a non-expiring Sanctum token for the Product Image Discovery API');

Artisan::command('pid-admin:create-price-key {code : Tenant code, reused if it already exists} {--tenant-name= : Tenant display name (defaults to the code on create)} {--key-name= : API key name (defaults to the code)}', function (): int {
    $code = trim((string) $this->argument('code'));

    if ($code === '') {
        $this->error('Tenant code cannot be empty.');

        return Command::INVALID;
    }

    $rawTenantName = $this->option('tenant-name');
    $tenantName = is_string($rawTenantName) && trim($rawTenantName) !== '' ? trim($rawTenantName) : $code;

    $rawKeyName = $this->option('key-name');
    $keyName = is_string($rawKeyName) && trim($rawKeyName) !== '' ? trim($rawKeyName) : $code;

    $tenant = Tenant::query()->firstOrCreate(['code' => $code], ['name' => $tenantName]);

    // No extra scopes: regular API calls need none, and the key cannot manage other keys.
    [, $plaintext] = ApiKey::issue($tenant->getKey(), $keyName, []);

    $this->info(sprintf('Tenant %s (id=%d) %s.', $code, $tenant->getKey(), $tenant->wasRecentlyCreated ? 'created' : 'reused'));
    $this->warn('API key (shown once): '.$plaintext);

    return Command::SUCCESS;
})->purpose('Create (or reuse) a Price Intelligence tenant and issue an API key for it');
