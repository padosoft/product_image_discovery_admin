<?php

declare(strict_types=1);

namespace App\Providers;

use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Every console user is an operator. The panel route already requires the session login
        // and a changed password, so token-only API users (Gescat) never reach this gate.
        Gate::define('price-intelligence:admin', static fn (User $user): bool => true);
    }
}
