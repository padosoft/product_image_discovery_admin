<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AdminAuthGuardTest extends TestCase
{
    use RefreshDatabase;

    protected bool $authenticateByDefault = false;

    public function test_guest_is_redirected_to_login_from_admin_pages(): void
    {
        foreach (['/admin/product-image-discovery', '/admin', '/admin/product-image-discovery/requests'] as $path) {
            $this->get($path)->assertRedirect(route('login'));
        }
    }

    public function test_root_leads_guest_to_login_through_admin_home(): void
    {
        $this->get('/')->assertRedirect('/admin/product-image-discovery');
        $this->followingRedirects()->get('/')->assertSee('Sign in');
    }

    public function test_guest_json_request_gets_401(): void
    {
        $this->getJson('/admin/product-image-discovery/health')->assertUnauthorized();
    }

    public function test_user_forced_to_change_password_is_redirected_and_json_gets_409(): void
    {
        $user = User::query()->create(['name' => 'Op', 'email' => 'op@example.test', 'password' => 'temporary-pass', 'must_change_password' => true]);

        $this->actingAs($user)->get('/admin/product-image-discovery')->assertRedirect(route('password.change'));
        $this->actingAs($user)->getJson('/admin/product-image-discovery/health')
            ->assertStatus(409)
            ->assertJson(['code' => 'password_change_required']);
        $this->actingAs($user)->get('/password/change')->assertOk()->assertSee('must choose a new password');
    }

    public function test_password_change_clears_flag_and_unlocks_admin(): void
    {
        $user = User::query()->create(['name' => 'Op', 'email' => 'op@example.test', 'password' => 'temporary-pass', 'must_change_password' => true]);

        $this->actingAs($user)->post('/password/change', [
            'current_password' => 'temporary-pass',
            'password' => 'a-brand-new-password',
            'password_confirmation' => 'a-brand-new-password',
        ])->assertRedirect('/admin/product-image-discovery');

        $this->assertFalse($user->fresh()->must_change_password);
        // The session that changed the password stays signed in.
        $this->get('/admin/product-image-discovery')->assertOk();
    }

    public function test_password_change_rejects_wrong_current_short_or_same_password(): void
    {
        $user = User::query()->create(['name' => 'Op', 'email' => 'op@example.test', 'password' => 'temporary-pass', 'must_change_password' => true]);

        foreach ([
            ['wrong', 'a-brand-new-password'],
            ['temporary-pass', 'short'],
            ['temporary-pass', 'temporary-pass'],
        ] as [$current, $new]) {
            $this->actingAs($user)->post('/password/change', [
                'current_password' => $current,
                'password' => $new,
                'password_confirmation' => $new,
            ])->assertSessionHasErrors();
        }

        $this->assertTrue($user->fresh()->must_change_password);
    }

    public function test_create_user_command_forces_password_change_also_on_existing_user(): void
    {
        $this->artisan('pid-admin:create-user', ['email' => 'new@example.test'])->assertSuccessful();
        $this->assertTrue(User::query()->where('email', 'new@example.test')->firstOrFail()->must_change_password);

        User::query()->where('email', 'new@example.test')->update(['must_change_password' => false]);

        $this->artisan('pid-admin:create-user', ['email' => 'new@example.test', '--password' => 'another-pass-123'])->assertSuccessful();
        $this->assertTrue(User::query()->where('email', 'new@example.test')->firstOrFail()->must_change_password);
    }

    public function test_other_sessions_are_logged_out_when_password_changes(): void
    {
        $user = User::query()->create(['name' => 'Op', 'email' => 'op@example.test', 'password' => 'first-password-1']);

        $this->actingAs($user)->get('/admin/product-image-discovery')->assertOk();

        // Simulates a password change from another browser or a `pid-admin:create-user --password` reset.
        User::query()->whereKey($user->getKey())->firstOrFail()->forceFill(['password' => 'second-password-2'])->save();
        // A real next request reloads the user from the session id instead of reusing the in-memory instance.
        $this->app['auth']->forgetGuards();

        $this->get('/admin/product-image-discovery')->assertRedirect(route('login'));
        $this->assertGuest();
    }
}
