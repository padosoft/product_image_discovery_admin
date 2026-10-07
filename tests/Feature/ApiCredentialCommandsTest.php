<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Padosoft\PriceIntelligence\Models\ApiKey;
use Padosoft\PriceIntelligence\Models\Tenant;
use Tests\TestCase;

final class ApiCredentialCommandsTest extends TestCase
{
    use RefreshDatabase;

    protected bool $authenticateByDefault = false;

    public function test_create_api_user_creates_technical_user_once(): void
    {
        $this->artisan('pid-admin:create-api-user', ['email' => 'gescat-api@example.test', '--name' => 'Gescat API'])
            ->assertSuccessful();

        $user = User::query()->where('email', 'gescat-api@example.test')->firstOrFail();
        $this->assertSame('Gescat API', $user->name);
        $this->assertFalse($user->must_change_password);

        $this->artisan('pid-admin:create-api-user', ['email' => 'gescat-api@example.test', '--name' => 'Other'])
            ->expectsOutputToContain('already exists')
            ->assertSuccessful();

        $this->assertSame(1, User::query()->where('email', 'gescat-api@example.test')->count());
        $this->assertSame('Gescat API', $user->fresh()->name);
    }

    public function test_create_api_user_rejects_invalid_email(): void
    {
        $this->artisan('pid-admin:create-api-user', ['email' => 'not-an-email'])->assertFailed();

        $this->assertSame(0, User::query()->count());
    }

    public function test_create_api_token_issues_read_write_token_by_default(): void
    {
        $user = User::query()->create(['name' => 'Gescat API', 'email' => 'gescat-api@example.test', 'password' => 'irrelevant-pass']);

        $this->artisan('pid-admin:create-api-token', ['email' => 'gescat-api@example.test', '--name' => 'gescat'])
            ->expectsOutputToContain('Token (shown once): ')
            ->assertSuccessful();

        $token = PersonalAccessToken::query()->where('tokenable_id', $user->getKey())->firstOrFail();
        $this->assertSame('gescat', $token->name);
        $this->assertSame(['product-image-discovery:read', 'product-image-discovery:write'], $token->abilities);
        $this->assertNull($token->expires_at);
    }

    public function test_create_api_token_fails_for_unknown_user(): void
    {
        $this->artisan('pid-admin:create-api-token', ['email' => 'missing@example.test'])->assertFailed();

        $this->assertSame(0, PersonalAccessToken::query()->count());
    }

    public function test_create_price_key_creates_or_reuses_tenant_and_issues_scopeless_key(): void
    {
        $this->artisan('pid-admin:create-price-key', ['code' => 'gescat', '--tenant-name' => 'Gescat'])
            ->expectsOutputToContain('API key (shown once): pi_')
            ->assertSuccessful();

        $this->artisan('pid-admin:create-price-key', ['code' => 'gescat'])
            ->expectsOutputToContain('reused')
            ->assertSuccessful();

        $tenant = Tenant::query()->where('code', 'gescat')->firstOrFail();
        $this->assertSame('Gescat', $tenant->name);
        $this->assertSame(1, Tenant::query()->count());

        $keys = ApiKey::query()->withoutTenantScope()->where('tenant_id', $tenant->getKey())->get();
        $this->assertCount(2, $keys);
        $this->assertSame([], $keys->first()->scopes);
        $this->assertSame('gescat', $keys->first()->name);
    }
}
