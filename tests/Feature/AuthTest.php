<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

final class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_sees_login_form(): void
    {
        $this->get('/login')
            ->assertOk()
            ->assertSee('Sign in', false);
    }

    public function test_authenticated_user_visiting_login_is_redirected_to_admin_home(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)
            ->get('/login')
            ->assertRedirect('/admin/product-image-discovery');
    }

    public function test_login_succeeds_with_valid_credentials_and_regenerates_session(): void
    {
        $this->createUser();

        $beforeToken = csrf_token();

        $response = $this->post('/login', [
            'email' => 'op@example.test',
            'password' => 'super-secret-pass',
        ]);

        $response->assertRedirect('/admin/product-image-discovery');
        $this->assertAuthenticatedAs(User::query()->where('email', 'op@example.test')->firstOrFail());

        $this->assertNotSame($beforeToken, csrf_token());
    }

    public function test_login_redirects_back_to_intended_admin_url(): void
    {
        $this->createUser();

        $this->withSession(['url.intended' => '/admin/product-image-discovery/debug'])
            ->post('/login', [
                'email' => 'op@example.test',
                'password' => 'super-secret-pass',
            ])
            ->assertRedirect('/admin/product-image-discovery/debug');
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        $this->createUser();

        $this->from('/login')
            ->post('/login', [
                'email' => 'op@example.test',
                'password' => 'wrong-password',
            ])
            ->assertRedirect('/login')
            ->assertSessionHasErrors('email');

        $this->assertGuest();
    }

    public function test_login_validates_email_and_password_presence(): void
    {
        $this->from('/login')
            ->post('/login', [
                'email' => 'not-an-email',
                'password' => '',
            ])
            ->assertRedirect('/login')
            ->assertSessionHasErrors(['email', 'password']);

        $this->assertGuest();
    }

    public function test_logout_clears_session_and_redirects_to_login(): void
    {
        $user = $this->createUser();

        $this->actingAs($user)
            ->post('/logout')
            ->assertRedirect('/login');

        $this->assertGuest();
    }

    private function createUser(): User
    {
        return User::query()->create([
            'name' => 'Op',
            'email' => 'op@example.test',
            'password' => 'super-secret-pass',
        ]);
    }
}
