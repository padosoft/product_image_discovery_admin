<!doctype html>
<html lang="en" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Sign in &middot; {{ config('app.name', 'Product Image Discovery Admin') }}</title>
    @if (! app()->environment('testing') || file_exists(public_path('build/manifest.json')))
        @vite(['resources/css/admin-product-image-discovery.css'])
    @endif
    @include('auth.partials-style')
</head>
<body>
    <main class="pid-auth">
        <div class="pid-auth__card">
            <h1 class="pid-auth__title">Sign in</h1>
            <p class="pid-auth__subtitle">{{ config('app.name', 'Product Image Discovery Admin') }}</p>

            @if ($errors->any())
                <div class="pid-auth__alert" role="alert">
                    <ul>
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <form method="POST" action="{{ route('login') }}" novalidate>
                @csrf
                <label class="pid-auth__field">
                    <span>Email</span>
                    <input
                        type="email"
                        name="email"
                        value="{{ old('email') }}"
                        autocomplete="username"
                        required
                        autofocus
                        class="pid-auth__input"
                    >
                </label>
                <label class="pid-auth__field">
                    <span>Password</span>
                    <input
                        type="password"
                        name="password"
                        autocomplete="current-password"
                        required
                        class="pid-auth__input"
                    >
                </label>
                <label class="pid-auth__remember">
                    <input type="checkbox" name="remember" value="1">
                    Remember me on this browser
                </label>
                <button type="submit" class="pid-auth__submit">Sign in</button>
            </form>
        </div>
    </main>
</body>
</html>
