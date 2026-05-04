<!doctype html>
<html lang="en" data-theme="light">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $appName }}</title>
    <script>
        window.PID_ADMIN = {
            apiBase: @json($apiBase),
            packageApiBase: @json($packageApiBase),
            appName: @json($appName),
            logoutUrl: @json($logoutUrl),
            csrfToken: @json($csrfToken)
        };
    </script>
    @if (! app()->environment('testing') || file_exists(public_path('build/manifest.json')))
        @vite(['resources/css/admin-product-image-discovery.css', 'resources/js/admin-product-image-discovery/main.jsx'])
    @endif
</head>
<body>
    <div id="product-image-discovery-admin" data-testid="product-image-discovery-admin">
        <div class="pid-noscript-shell">
            <aside class="pid-noscript-sidebar">Product Images</aside>
            <main class="pid-noscript-main">
                <div class="pid-noscript-topbar">Admin console</div>
                <p>Loading Product Image Discovery Admin...</p>
            </main>
        </div>
    </div>
</body>
</html>
