<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rules\Password;

final class ChangePasswordController extends Controller
{
    public function show(Request $request): View
    {
        return view('auth.change-password', [
            'forced' => (bool) $request->user()?->getAttribute('must_change_password'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password'],
            'password' => ['required', 'string', 'confirmed', 'different:current_password', Password::min(8)],
        ]);

        $user = $request->user();
        $user->password = $validated['password'];
        $user->must_change_password = false;
        $user->save();

        $request->session()->regenerate();

        return redirect()->intended('/'.trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/'));
    }
}
