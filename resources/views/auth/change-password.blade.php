<!doctype html>
<html lang="en" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Change password &middot; {{ config('app.name', 'Product Image Discovery Admin') }}</title>
    @if (! app()->environment('testing') || file_exists(public_path('build/manifest.json')))
        @vite(['resources/css/admin-product-image-discovery.css'])
    @endif
    @include('auth.partials-style')
</head>
<body>
    <main class="pid-auth">
        <div class="pid-auth__card">
            <h1 class="pid-auth__title">Change password</h1>
            <p class="pid-auth__subtitle">
                @if ($forced)
                    You must choose a new password before continuing.
                @else
                    {{ config('app.name', 'Product Image Discovery Admin') }}
                @endif
            </p>

            @if ($errors->any())
                <div class="pid-auth__alert" role="alert">
                    <ul>
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('password.update') }}" novalidate>
                @csrf
                <label class="pid-auth__field">
                    <span>Current password</span>
                    <input type="password" name="current_password" autocomplete="current-password" required autofocus class="pid-auth__input">
                </label>
                <label class="pid-auth__field">
                    <span>New password (min. 8 characters)</span>
                    <input type="password" name="password" autocomplete="new-password" required class="pid-auth__input">
                </label>
                <label class="pid-auth__field">
                    <span>Confirm new password</span>
                    <input type="password" name="password_confirmation" autocomplete="new-password" required class="pid-auth__input">
                </label>
                <button type="submit" class="pid-auth__submit">Change password</button>
            </form>

            <form method="POST" action="{{ route('logout') }}" style="margin-top:12px">
                @csrf
                <button type="submit" class="pid-auth__submit" style="background:transparent;color:var(--pid-muted);border:1px solid var(--pid-border)">Sign out</button>
            </form>
        </div>
    </main>
</body>
</html>
