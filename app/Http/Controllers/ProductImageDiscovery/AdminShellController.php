<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Contracts\View\View;
use Illuminate\Routing\Controller;

final class AdminShellController extends Controller
{
    public function __invoke(): View
    {
        return view('product-image-discovery.admin', [
            'apiBase' => '/'.trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/'),
            'packageApiBase' => '/'.trim((string) config('pid-admin.package_api_prefix', 'api/product-image-discovery'), '/'),
            'appName' => config('app.name', 'Product Image Discovery Admin'),
        ]);
    }
}
