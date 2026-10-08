<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Padosoft\PriceIntelligence\Models\ApiKey;
use Padosoft\PriceIntelligence\Models\Tenant;
use Tests\TestCase;

final class PriceIntelligenceAdminPanelTest extends TestCase
{
    use RefreshDatabase;

    protected bool $authenticateByDefault = false;

    public function test_guests_are_redirected_to_login(): void
    {
        $this->get('/admin/price-intelligence')->assertRedirect('/login');
        $this->get('/admin/price-intelligence/matches')->assertRedirect('/login');
    }

    public function test_operator_gets_the_panel_with_session_runtime_config(): void
    {
        $this->actingAs($this->operator());

        $this->get('/admin/price-intelligence/matches')
            ->assertOk()
            ->assertSee('window.__PI_ADMIN__', false)
            ->assertViewHas('runtime', static fn (array $runtime): bool => $runtime['apiBaseUrl'] === '/api/v1'
                && $runtime['auth']['mode'] === 'cookie'
                && $runtime['realtime']['driver'] === 'polling')
            ->assertSee('vendor/price-intelligence-admin/assets/', false)
            ->assertDontSee('Admin panel assets not found');
    }

    public function test_admin_shell_exposes_the_panel_url_when_the_package_is_installed(): void
    {
        $this->actingAs($this->operator());

        $this->get('/admin/product-image-discovery')
            ->assertOk()
            ->assertSee('priceIntelligenceUrl: '.json_encode(route('price-intelligence-admin.panel')), false);
    }

    public function test_operator_must_change_password_before_opening_the_panel(): void
    {
        $this->actingAs($this->operator(['must_change_password' => true]));

        $this->get('/admin/price-intelligence')->assertRedirect('/password/change');
    }

    public function test_session_user_reaches_the_api_on_the_configured_tenant(): void
    {
        $tenant = Tenant::query()->create(['code' => 'gescat', 'name' => 'Gescat']);
        $this->actingAs($this->operator());

        $this->getJson('/api/v1/tenants/me', ['Referer' => 'http://localhost/admin/price-intelligence'])
            ->assertOk()
            ->assertJsonPath('data.tenant.id', $tenant->getKey())
            ->assertJsonPath('data.tenant.code', 'gescat');
    }

    public function test_session_user_is_rejected_when_the_tenant_does_not_exist(): void
    {
        $this->actingAs($this->operator());

        $this->getJson('/api/v1/tenants/me')->assertUnauthorized();
    }

    public function test_api_key_clients_keep_working_without_a_session(): void
    {
        Tenant::query()->create(['code' => 'gescat', 'name' => 'Gescat']);
        $other = Tenant::query()->create(['code' => 'other', 'name' => 'Other']);
        [, $plain] = ApiKey::issue($other->getKey(), 'machine', []);

        $this->getJson('/api/v1/tenants/me', ['X-Api-Key' => $plain])
            ->assertOk()
            ->assertJsonPath('data.tenant.code', 'other');

        $this->getJson('/api/v1/tenants/me')->assertUnauthorized();
    }

    public function test_api_routes_start_a_session_only_for_frontend_requests(): void
    {
        $middleware = Route::getRoutes()->getByName('price-intelligence.tenants.me')?->gatherMiddleware() ?? [];

        $this->assertContains(EnsureFrontendRequestsAreStateful::class, $middleware);
    }

    public function test_app_url_host_is_a_stateful_domain(): void
    {
        config(['app.url' => 'https://image-discovery.example.test']);

        // Re-evaluate the config file against a production-like APP_URL (the cached value uses localhost).
        $stateful = (require config_path('sanctum.php'))['stateful'];

        $this->assertContains('image-discovery.example.test', $stateful);

        foreach ($stateful as $domain) {
            // Sanctum::currentApplicationUrlWithPort() prefixes a comma; a leftover one never matches a Referer.
            $this->assertStringStartsNotWith(',', $domain);
        }
    }

    /**
     * @param array<string, mixed> $attributes
     */
    private function operator(array $attributes = []): User
    {
        return User::query()->create(array_merge([
            'name' => 'Operator',
            'email' => 'operator@example.test',
            'password' => 'secret-password',
            'must_change_password' => false,
        ], $attributes));
    }
}
