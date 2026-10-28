<?php

declare(strict_types=1);

use App\Callbacks\CallbackAttempt;
use App\Callbacks\CallbackDeliverer;
use App\Callbacks\CallbackPayload;
use App\Callbacks\CallbackTargets;
use App\Callbacks\ProductFinderCallbacks;
use App\Models\CallbackEvent;
use App\Models\User;
use Database\Seeders\ProductImageDiscoveryDemoSeeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
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

Artisan::command('callbacks:ping {url : Callback URL of the client, e.g. https://<gescat-host>/api/ai-product-enrichment/callbacks/events}', function (CallbackTargets $targets, CallbackDeliverer $deliverer): int {
    $url = trim((string) $this->argument('url'));

    if (config('callbacks.secrets_invalid') === true) {
        $this->error('PRODUCT_FINDER_CALLBACK_SECRETS is not valid JSON: it must be an object like {"host": "secret"}. Fix it, then clear or rebuild the config cache.');

        return Command::INVALID;
    }

    if (! $targets->allows($url)) {
        $this->error('The URL must be https and its host must be listed in PRODUCT_FINDER_CALLBACK_SECRETS.');

        return Command::INVALID;
    }

    $eventId = (string) Str::uuid();
    $body = CallbackPayload::encode($eventId, 'ping', Carbon::now(), '', 'ping', '', 'completed');
    $result = $deliverer->send($url, $eventId, $body);

    $this->line(sprintf('Event %s sent to %s', $eventId, $url));

    if ($result->outcome === CallbackAttempt::DELIVERED) {
        $this->info(sprintf('Delivered: HTTP %d.', $result->status));

        return Command::SUCCESS;
    }

    $this->error(sprintf('Not delivered: %s.', $result->status !== null ? 'HTTP '.$result->status : $result->error));

    if ($result->status === 401) {
        $this->warn('Signature or timestamp refused: check that both sides use the same secret and that the clocks are in sync.');
    }

    return Command::FAILURE;
})->purpose('Send a signed ping callback to check the URL, the secret and the signature');

Artisan::command('callbacks:run-due', function (CallbackDeliverer $deliverer, ProductFinderCallbacks $productFinder): int {
    $queued = $deliverer->dispatchDue();
    $fired = $productFinder->sweepStaleScrapes();

    if ($queued > 0 || $fired > 0) {
        $this->info(sprintf('Queued %d callback attempt(s); sent %d scrape callback(s) without waiting for attributes.', $queued, $fired));
    }

    return Command::SUCCESS;
})->purpose('Queue the callback retries that are due');

Artisan::command('callbacks:list {--status= : pending, delivered or undelivered} {--limit=20}', function (): int {
    $events = CallbackEvent::query()
        ->when($this->option('status'), fn ($query, $status) => $query->where('delivery_status', $status))
        ->orderByDesc('id')
        ->limit(max(1, (int) $this->option('limit')))
        ->get();

    $this->table(
        ['id', 'event', 'resource', 'status', 'correlation_id', 'delivery', 'attempts', 'last HTTP', 'last error', 'next attempt'],
        $events->map(fn (CallbackEvent $event): array => [
            $event->getKey(),
            $event->event,
            $event->resource_type.' '.$event->resource_id,
            $event->status,
            $event->correlation_id,
            $event->delivery_status,
            $event->attempts,
            $event->last_response_status ?? '-',
            $event->last_error ?? '-',
            $event->next_attempt_at?->toDateTimeString() ?? '-',
        ])->all(),
    );

    return Command::SUCCESS;
})->purpose('List the latest callbacks and their delivery state');

Schedule::command('callbacks:run-due')->everyMinute()->withoutOverlapping();
