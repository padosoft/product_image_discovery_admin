<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AdminShellTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_shell_renders(): void
    {
        $this->get('/admin/product-image-discovery')
            ->assertOk()
            ->assertSee('product-image-discovery-admin')
            ->assertSee('Product Image Discovery Admin');
    }

    public function test_root_redirect_uses_configured_admin_prefix(): void
    {
        config(['pid-admin.route_prefix' => 'custom/pid-admin']);

        $this->get('/')
            ->assertRedirect('/custom/pid-admin');
    }
}
