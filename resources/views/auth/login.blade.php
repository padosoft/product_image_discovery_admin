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
    <style>
        .pid-auth {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: var(--pid-bg);
        }
        .pid-auth__card {
            width: 100%;
            max-width: 360px;
            background: var(--pid-surface);
            border: 1px solid var(--pid-border);
            border-radius: var(--pid-radius);
            padding: 24px;
        }
        .pid-auth__title {
            margin: 0 0 4px;
            font-size: 18px;
            font-weight: 600;
            color: var(--pid-text);
        }
        .pid-auth__subtitle {
            margin: 0 0 20px;
            color: var(--pid-muted);
            font-size: 13px;
        }
        .pid-auth__field {
            display: block;
            margin-bottom: 14px;
            font-size: 13px;
            color: var(--pid-muted);
        }
        .pid-auth__field span {
            display: block;
            margin-bottom: 4px;
        }
        .pid-auth__input {
            width: 100%;
            padding: 8px 10px;
            border: 1px solid var(--pid-border);
            border-radius: 6px;
            background: var(--pid-surface);
            color: var(--pid-text);
            font: inherit;
            font-size: 14px;
        }
        .pid-auth__input:focus-visible {
            outline: 2px solid var(--pid-accent);
            outline-offset: 0;
            border-color: var(--pid-accent);
        }
        .pid-auth__remember {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 16px;
            font-size: 13px;
            color: var(--pid-muted);
        }
        .pid-auth__submit {
            width: 100%;
            padding: 9px 12px;
            border: 0;
            border-radius: 6px;
            background: var(--pid-accent);
            color: #fff;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
        }
        .pid-auth__submit:hover,
        .pid-auth__submit:focus-visible {
            outline: none;
            filter: brightness(1.05);
        }
        .pid-auth__alert {
            margin: 0 0 16px;
            padding: 10px 12px;
            background: var(--pid-danger-bg);
            color: var(--pid-danger-text);
            border-radius: 6px;
            font-size: 13px;
        }
        .pid-auth__alert ul {
            margin: 0;
            padding-left: 18px;
        }
    </style>
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
